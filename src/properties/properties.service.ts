import { Injectable } from '@nestjs/common';
import { CatalogService } from '../catalog/catalog.service';
import { assertOwner } from '../common/auth/ownership';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Page, PaginationQueryDto } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { toSearchKey } from '../common/text/to-search-key';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Prisma, Ward } from '../generated/prisma/client';
import { ListingsRepository } from '../listings/listings.repository';
import type { CreatePropertyDto } from './dto/create-property.dto';
import type { PropertyFeeDto } from './dto/property-fee.dto';
import type {
	PropertyListItemResponse,
	PropertyResponse,
} from './dto/property.response';
import type { UpdatePropertyDto } from './dto/update-property.dto';
import { toPropertyListItem, toPropertyResponse } from './properties.mapper';
import { PropertiesRepository } from './properties.repository';
import type { NewFee, PropertyChanges } from './properties.repository';

/** Ghi chú rỗng (hoặc chỉ có khoảng trắng, đã bị `@Trim()` cắt) lưu là `null`, không bao giờ chuỗi rỗng. */
function toNewFees(fees: readonly PropertyFeeDto[]): NewFee[] {
	return fees.map((fee) => ({
		kind: fee.kind,
		price: fee.price,
		unit: fee.unit,
		note: fee.note === undefined || fee.note === '' ? null : fee.note,
	}));
}

/**
 * Nhà trọ của chủ trọ (spec 0002 AC-3, AC-4, AC-16). Chủ nhà trọ luôn là người đang đăng nhập; mọi thao tác
 * lên nhà trọ cụ thể kiểm chủ sở hữu bằng `assertOwner` (spec 0003 AC-5). Sửa và xóa mềm khóa dòng nhà trọ
 * rồi mới kiểm và ghi, nên hai request đua nhau không làm trạng thái lệch.
 */
@Injectable()
export class PropertiesService {
	constructor(
		private readonly repository: PropertiesRepository,
		private readonly listings: ListingsRepository,
		private readonly catalog: CatalogService,
		private readonly transactions: TransactionRunner,
	) {}

	async create(
		user: RequestUser,
		dto: CreatePropertyDto,
	): Promise<PropertyResponse> {
		const id = await this.transactions.run(async (tx) => {
			await this.requireWard(dto.wardCode, tx);
			const amenityKeys = dto.amenityKeys ?? [];
			await this.requireAmenities(amenityKeys, tx);
			return this.repository.create(
				{
					landlordId: user.userId,
					name: dto.name,
					addressText: dto.addressText,
					wardCode: dto.wardCode,
					latitude: dto.latitude ?? null,
					longitude: dto.longitude ?? null,
					fees: toNewFees(dto.fees ?? []),
					amenityKeys,
				},
				tx,
			);
		});
		return this.readCommitted(id);
	}

	/** Nhà trọ của chính người gọi, mới nhất trước, kèm số tin chưa xóa. */
	async list(
		user: RequestUser,
		query: PaginationQueryDto,
	): Promise<Page<PropertyListItemResponse>> {
		const { rows, total } = await this.repository.findPageByLandlord(
			user.userId,
			skipOf(query),
			query.pageSize,
		);
		return toPage(rows.map(toPropertyListItem), total, query);
	}

	async get(user: RequestUser, id: string): Promise<PropertyResponse> {
		const property = await this.repository.findById(id);
		if (property === null) {
			throw new AppException(ErrorCode.PROPERTY_NOT_FOUND);
		}
		assertOwner(user, property.landlordId);
		return toPropertyResponse(property);
	}

	async update(
		user: RequestUser,
		id: string,
		dto: UpdatePropertyDto,
	): Promise<PropertyResponse> {
		await this.transactions.run(async (tx) => {
			const locked = await this.repository.lockLiveById(id, tx);
			if (locked === null) {
				throw new AppException(ErrorCode.PROPERTY_NOT_FOUND);
			}
			assertOwner(user, locked.landlordId);
			const current = await this.repository.findAddressSource(id, tx);

			const ward =
				dto.wardCode === undefined || dto.wardCode === current.wardCode
					? current.ward
					: await this.requireWard(dto.wardCode, tx);
			if (dto.amenityKeys !== undefined) {
				await this.requireAmenities(dto.amenityKeys, tx);
			}

			await this.repository.update(id, this.changesOf(dto), tx);
			if (dto.fees !== undefined) {
				await this.repository.replaceFees(id, toNewFees(dto.fees), tx);
			}
			if (dto.amenityKeys !== undefined) {
				await this.repository.replaceAmenities(id, dto.amenityKeys, tx);
			}

			const name = dto.name ?? current.name;
			const addressText = dto.addressText ?? current.addressText;
			if (
				name !== current.name ||
				addressText !== current.addressText ||
				ward.code !== current.wardCode
			) {
				await this.refreshSearchKeys(
					id,
					name,
					addressText,
					ward.name,
					tx,
				);
			}
		});
		return this.readCommitted(id);
	}

	/** Xóa mềm; còn tin chưa xóa thì chặn (AC-4). Khóa dòng trước khi đếm để không lọt tin đăng cùng lúc. */
	remove(user: RequestUser, id: string): Promise<void> {
		return this.transactions.run(async (tx) => {
			const locked = await this.repository.lockLiveById(id, tx);
			if (locked === null) {
				throw new AppException(ErrorCode.PROPERTY_NOT_FOUND);
			}
			assertOwner(user, locked.landlordId);
			if ((await this.listings.countLiveByProperty(id, tx)) > 0) {
				throw new AppException(ErrorCode.PROPERTY_HAS_LISTINGS);
			}
			await this.repository.markDeleted(id, tx);
		});
	}

	/**
	 * Đọc nhà trọ vừa ghi để trả về, SAU khi giao dịch đã xong (đọc nhiều quan hệ trong giao dịch đang mở làm
	 * Prisma chạy song song trên một kết nối, xem `PropertiesRepository.create`). Chỉ lệch nếu ngay giữa hai
	 * bước chính chủ xóa nhà trọ, khi đó 404 là đúng.
	 */
	private async readCommitted(id: string): Promise<PropertyResponse> {
		const property = await this.repository.findById(id);
		if (property === null) {
			throw new AppException(ErrorCode.PROPERTY_NOT_FOUND);
		}
		return toPropertyResponse(property);
	}

	/** Chỉ các cột gửi lên; cặp tọa độ đã được DTO bảo đảm đi cùng nhau. */
	private changesOf(dto: UpdatePropertyDto): PropertyChanges {
		const changes: PropertyChanges = {};
		if (dto.name !== undefined) changes.name = dto.name;
		if (dto.addressText !== undefined)
			changes.addressText = dto.addressText;
		if (dto.wardCode !== undefined) changes.wardCode = dto.wardCode;
		if (dto.latitude !== undefined) {
			changes.latitude = dto.latitude;
			changes.longitude = dto.longitude ?? null;
		}
		return changes;
	}

	private async requireWard(
		code: string,
		tx: Prisma.TransactionClient,
	): Promise<Ward> {
		const ward = await this.catalog.findWard(code, tx);
		if (ward === null) {
			throw new AppException(ErrorCode.WARD_UNKNOWN, [
				{
					field: 'wardCode',
					code: ErrorCode.WARD_UNKNOWN,
					message: `Phường hoặc xã không có trong danh mục: ${code}`,
				},
			]);
		}
		return ward;
	}

	private async requireAmenities(
		keys: readonly string[],
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const unknown = await this.catalog.findUnknownAmenityKeys(keys, tx);
		if (unknown.length > 0) {
			throw new AppException(ErrorCode.AMENITY_UNKNOWN, [
				{
					field: 'amenityKeys',
					code: ErrorCode.AMENITY_UNKNOWN,
					message: `Tiện ích không có trong danh mục: ${unknown.join(', ')}`,
				},
			]);
		}
	}

	/**
	 * Một trong ba đường duy nhất cập nhật `search_key` (spec 0002, "Key invariants"): nhà trọ đổi tên, địa
	 * chỉ hay phường thì dựng lại khóa của mọi tin chưa xóa của nó, trong cùng giao dịch. Lặp từng tin, chấp
	 * nhận ở quy mô demo.
	 */
	private async refreshSearchKeys(
		propertyId: string,
		name: string,
		addressText: string,
		wardName: string,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const rows = await this.listings.findLiveTitlesByProperty(
			propertyId,
			tx,
		);
		for (const row of rows) {
			await this.listings.setSearchKey(
				row.id,
				toSearchKey(row.title, name, addressText, wardName),
				tx,
			);
		}
	}
}
