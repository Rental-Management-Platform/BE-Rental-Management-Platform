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
import { isInsideCity, isNearWard, toWardBounds } from './coordinate-area';
import type { CreatePropertyDto } from './dto/create-property.dto';
import type { PropertyFeeDto } from './dto/property-fee.dto';
import type {
	PropertyListItemResponse,
	PropertyResponse,
} from './dto/property.response';
import type { UpdatePropertyDto } from './dto/update-property.dto';
import { toPropertyListItem, toPropertyResponse } from './properties.mapper';
import { PropertiesRepository } from './properties.repository';
import type {
	NewFee,
	PropertyAddressSource,
	PropertyChanges,
} from './properties.repository';

/** Ghi chú rỗng (hoặc chỉ có khoảng trắng, đã bị `@Trim()` cắt) lưu là `null`, không bao giờ chuỗi rỗng. */
function toNewFees(fees: readonly PropertyFeeDto[]): NewFee[] {
	return fees.map((fee) => ({
		kind: fee.kind,
		price: fee.price,
		unit: fee.unit,
		note: fee.note === undefined || fee.note === '' ? null : fee.note,
	}));
}

/** Cặp tọa độ gửi lên khi cả hai là số; `null` hay vắng (không có gì để kiểm) thì `null`. DTO đã bảo đảm hai trường đi cặp. */
function sentPoint(dto: {
	latitude?: number | null;
	longitude?: number | null;
}): { latitude: number; longitude: number } | null {
	const { latitude, longitude } = dto;
	return typeof latitude === 'number' && typeof longitude === 'number'
		? { latitude, longitude }
		: null;
}

/** `sent`: tọa độ vừa gửi lên. `stored`: tọa độ đang lưu, bị phường mới làm trượt (spec 0012 AC-5 b). */
type CoordinateOrigin = 'sent' | 'stored';

const SENT_HINT = 'Hãy ghim lại trong hoặc sát ranh giới phường này.';
const STORED_HINT =
	'Hãy gửi tọa độ mới cùng phường mới, hoặc gửi latitude và longitude đều là null để xóa.';

/** Lỗi tọa độ: cùng một mã cho cả hai trường, mỗi trường một câu riêng (spec 0012 AC-1, AC-2). */
function coordinateError(
	code: ErrorCode,
	messages: { latitude: string; longitude: string },
): AppException {
	return new AppException(code, [
		{ field: 'latitude', code, message: messages.latitude },
		{ field: 'longitude', code, message: messages.longitude },
	]);
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
			const ward = await this.requireWard(dto.wardCode, tx);
			const amenityKeys = dto.amenityKeys ?? [];
			await this.requireAmenities(amenityKeys, tx);
			const point = sentPoint(dto);
			if (point !== null) {
				this.requireCoordinateAllowed(point, ward, 'sent');
			}
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
			this.requireCoordinateOnUpdate(dto, current, ward);

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

	/**
	 * Quyết định có kiểm tọa độ khi sửa không (spec 0012 AC-5), rồi kiểm với phường hiệu lực `ward`:
	 * - có cặp số trong body: kiểm cặp đó (a);
	 * - body không đụng tọa độ (`latitude` vắng) mà phường đổi sang mã khác phường đang lưu, và nhà trọ đang có
	 *   tọa độ: kiểm tọa độ đang lưu với phường mới (b). `current` được đọc sau khi khóa dòng nên hai PATCH
	 *   đồng thời không cùng thấy một tọa độ cũ (d);
	 * - `null` cả hai (xóa tọa độ), hoặc không đụng tới tọa độ lẫn phường: không kiểm gì (c), nên nhà trọ cũ có
	 *   tọa độ ngoài vùng vẫn sửa được các trường khác và vẫn xóa được tọa độ.
	 */
	private requireCoordinateOnUpdate(
		dto: UpdatePropertyDto,
		current: PropertyAddressSource,
		ward: Ward,
	): void {
		const sent = sentPoint(dto);
		if (sent !== null) {
			this.requireCoordinateAllowed(sent, ward, 'sent');
			return;
		}
		const touchesCoordinate = dto.latitude !== undefined;
		const changesWard = ward.code !== current.wardCode;
		if (
			!touchesCoordinate &&
			changesWard &&
			current.latitude !== null &&
			current.longitude !== null
		) {
			this.requireCoordinateAllowed(
				{ latitude: current.latitude, longitude: current.longitude },
				ward,
				'stored',
			);
		}
	}

	/**
	 * Hai lớp kiểm tọa độ của spec 0012. Lớp 1: nằm trong một trong hai khung bao quanh thành phố
	 * (`COORDINATE_OUT_OF_AREA`). Lớp 2: nằm trong hộp của phường đã chọn nới 500 m (`COORDINATE_FAR_FROM_WARD`);
	 * phường không có hộp (admin thêm qua API, hay seed chưa chạy) thì bỏ lớp 2. Đứng sau mọi kiểm danh mục
	 * (`WARD_UNKNOWN`, `AMENITY_UNKNOWN`) và trước mọi lần ghi, nên lỗi thì không ghi gì. Lỗi nằm ở cả cặp, không
	 * chỉ ra được một trong hai số là sai, nên báo cả `latitude` lẫn `longitude`. `origin` chỉ để chọn câu lỗi:
	 * `sent` là tọa độ vừa gửi, `stored` là tọa độ đang lưu bị phường mới làm trượt.
	 */
	private requireCoordinateAllowed(
		point: { latitude: number; longitude: number },
		ward: Ward,
		origin: CoordinateOrigin,
	): void {
		if (!isInsideCity(point.latitude, point.longitude)) {
			throw coordinateError(ErrorCode.COORDINATE_OUT_OF_AREA, {
				latitude:
					origin === 'sent'
						? 'Vĩ độ nằm ngoài khu vực Thành phố Hồ Chí Minh.'
						: `Vĩ độ đang lưu của nhà trọ nằm ngoài khu vực Thành phố Hồ Chí Minh. ${STORED_HINT}`,
				longitude:
					origin === 'sent'
						? 'Kinh độ nằm ngoài khu vực Thành phố Hồ Chí Minh.'
						: `Kinh độ đang lưu của nhà trọ nằm ngoài khu vực Thành phố Hồ Chí Minh. ${STORED_HINT}`,
			});
		}
		const bounds = toWardBounds(ward);
		if (bounds === null) return;
		if (isNearWard(point.latitude, point.longitude, bounds)) return;
		throw coordinateError(ErrorCode.COORDINATE_FAR_FROM_WARD, {
			latitude:
				origin === 'sent'
					? `Vĩ độ cách xa ${ward.name}. ${SENT_HINT}`
					: `Vĩ độ đang lưu của nhà trọ quá xa ${ward.name}. ${STORED_HINT}`,
			longitude:
				origin === 'sent'
					? `Kinh độ cách xa ${ward.name}. ${SENT_HINT}`
					: `Kinh độ đang lưu của nhà trọ quá xa ${ward.name}. ${STORED_HINT}`,
		});
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
