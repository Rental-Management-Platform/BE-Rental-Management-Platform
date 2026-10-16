import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, Ward } from '../generated/prisma/client';

/** Xóa mềm (spec 0005): mọi phương thức đọc `properties` đều thêm điều kiện này, trừ tên có `IncludingDeleted`. */
const notDeleted = { deletedAt: null } satisfies Prisma.PropertyWhereInput;

/** Phần đi kèm mọi lần đọc nhà trọ: phường (kèm tỉnh), phí và tiện ích (kèm tên). */
const detailInclude = {
	ward: true,
	fees: true,
	amenities: { include: { amenity: true } },
} satisfies Prisma.PropertyInclude;

/** Danh sách thêm số tin chưa xóa mềm của từng nhà trọ (`listingCount`). */
const listInclude = {
	...detailInclude,
	_count: { select: { listings: { where: { deletedAt: null } } } },
} satisfies Prisma.PropertyInclude;

export type PropertyDetail = Prisma.PropertyGetPayload<{
	include: typeof detailInclude;
}>;
export type PropertyListRow = Prisma.PropertyGetPayload<{
	include: typeof listInclude;
}>;

/** Phần của nhà trọ làm nên `search_key` của tin: tên, địa chỉ và phường. */
export interface PropertyAddressSource {
	readonly name: string;
	readonly addressText: string;
	readonly wardCode: string;
	readonly ward: Ward;
}

export interface NewFee {
	readonly kind: string;
	readonly price: number;
	readonly unit: string;
	readonly note: string | null;
}

export interface NewProperty {
	readonly landlordId: string;
	readonly name: string;
	readonly addressText: string;
	readonly wardCode: string;
	readonly latitude: number | null;
	readonly longitude: number | null;
	readonly fees: readonly NewFee[];
	readonly amenityKeys: readonly string[];
}

/** Các cột của nhà trọ có thể đổi qua PATCH; cột nào vắng thì giữ nguyên. */
export interface PropertyChanges {
	name?: string;
	addressText?: string;
	wardCode?: string;
	latitude?: number | null;
	longitude?: number | null;
}

/** Nơi duy nhất của module nhà trọ chạm `properties`, `property_fees`, `property_amenities` (spec 0002, spec 0005). */
@Injectable()
export class PropertiesRepository {
	constructor(private readonly prisma: PrismaService) {}

	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	/**
	 * Tạo nhà trọ rồi phí rồi tiện ích, từng câu một trong giao dịch của Service (hoặc xong cả ba, hoặc không
	 * gì cả), và trả id. Không dùng `create` lồng nhau, và không đọc lại kèm nhiều quan hệ trong giao dịch:
	 * Prisma chạy các nhánh đó song song trên cùng một kết nối của giao dịch, và `pg` đã báo sẽ bỏ hỗ trợ kiểu
	 * đó ở bản 9. Service đọc đầy đủ bằng `findById` sau khi giao dịch xong.
	 */
	async create(
		input: NewProperty,
		tx: Prisma.TransactionClient,
	): Promise<string> {
		const { id } = await tx.property.create({
			data: {
				landlordId: input.landlordId,
				name: input.name,
				addressText: input.addressText,
				wardCode: input.wardCode,
				latitude: input.latitude,
				longitude: input.longitude,
			},
			select: { id: true },
		});
		await this.insertFees(id, input.fees, tx);
		await this.insertAmenities(id, input.amenityKeys, tx);
		return id;
	}

	/**
	 * Đọc đầy đủ một nhà trọ chưa xóa. Gọi ngoài giao dịch (hoặc sau khi giao dịch xong): đọc kèm phí,
	 * tiện ích và phường trong một giao dịch đang mở làm Prisma chạy song song trên một kết nối.
	 */
	findById(id: string): Promise<PropertyDetail | null> {
		return this.prisma.property.findFirst({
			where: { id, ...notDeleted },
			include: detailInclude,
		});
	}

	/** Tên, địa chỉ và phường hiện tại của nhà trọ đang giữ khóa dòng: nguồn của `search_key` trước khi sửa. */
	findAddressSource(
		id: string,
		tx: Prisma.TransactionClient,
	): Promise<PropertyAddressSource> {
		return tx.property.findFirstOrThrow({
			where: { id, ...notDeleted },
			select: {
				name: true,
				addressText: true,
				wardCode: true,
				ward: true,
			},
		});
	}

	/**
	 * Nhà trọ chưa xóa của một chủ trọ, mới nhất trước (`created_at DESC, id DESC`), kèm tổng số. Hai câu
	 * chạy song song nên chỉ dùng kết nối thường (mỗi câu một kết nối), không nhận giao dịch.
	 */
	async findPageByLandlord(
		landlordId: string,
		skip: number,
		take: number,
	): Promise<{ rows: PropertyListRow[]; total: number }> {
		const where = { landlordId, ...notDeleted };
		const [rows, total] = await Promise.all([
			this.prisma.property.findMany({
				where,
				include: listInclude,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
			}),
			this.prisma.property.count({ where }),
		]);
		return { rows, total };
	}

	/**
	 * Khóa dòng nhà trọ chưa xóa bằng `SELECT ... FOR UPDATE` và trả chủ của nó, hoặc `null` nếu không có
	 * hay đã xóa mềm. Sửa, xóa mềm nhà trọ và (mốc 3) đăng tin vào nhà trọ cùng khóa dòng này nên tuần tự
	 * với nhau: không thể có tin sống nằm dưới nhà trọ đã xóa mềm (spec 0002 AC-4), và `search_key` của tin
	 * mới luôn dựng từ tên nhà trọ mới nhất.
	 */
	async lockLiveById(
		id: string,
		tx: Prisma.TransactionClient,
	): Promise<{ landlordId: string } | null> {
		const rows = await tx.$queryRaw<{ landlord_id: string }[]>`
      SELECT landlord_id FROM properties
      WHERE id = ${id}::uuid AND deleted_at IS NULL
      FOR UPDATE`;
		const row = rows[0];
		return row === undefined ? null : { landlordId: row.landlord_id };
	}

	/** Ghi các cột đổi và luôn đặt lại `updated_at` (cả khi chỉ đổi phí hay tiện ích). Gọi sau `lockLiveById`. */
	async update(
		id: string,
		changes: PropertyChanges,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		await this.client(tx).property.update({
			where: { id },
			data: { ...changes, updatedAt: new Date() },
		});
	}

	/** Thay toàn bộ phí: xóa hết rồi thêm danh sách mới. Chạy trong giao dịch của Service. */
	async replaceFees(
		propertyId: string,
		fees: readonly NewFee[],
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.propertyFee.deleteMany({ where: { propertyId } });
		await this.insertFees(propertyId, fees, tx);
	}

	/** Thay toàn bộ tiện ích: xóa hết rồi thêm danh sách mới. Chạy trong giao dịch của Service. */
	async replaceAmenities(
		propertyId: string,
		amenityKeys: readonly string[],
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.propertyAmenity.deleteMany({ where: { propertyId } });
		await this.insertAmenities(propertyId, amenityKeys, tx);
	}

	private async insertFees(
		propertyId: string,
		fees: readonly NewFee[],
		tx: Prisma.TransactionClient,
	): Promise<void> {
		if (fees.length === 0) return;
		await tx.propertyFee.createMany({
			data: fees.map((fee) => ({ propertyId, ...fee })),
		});
	}

	private async insertAmenities(
		propertyId: string,
		amenityKeys: readonly string[],
		tx: Prisma.TransactionClient,
	): Promise<void> {
		if (amenityKeys.length === 0) return;
		await tx.propertyAmenity.createMany({
			data: amenityKeys.map((amenityKey) => ({ propertyId, amenityKey })),
		});
	}

	/** Xóa mềm: đặt `deleted_at`. Phí và tiện ích giữ nguyên. Gọi sau `lockLiveById`. */
	async markDeleted(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		await this.client(tx).property.update({
			where: { id },
			data: { deletedAt: new Date() },
		});
	}
}
