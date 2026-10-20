import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export interface NewListingImage {
	readonly listingId: string;
	readonly position: number;
	readonly storageKey: string;
}

/** Dòng ảnh đủ để dựng `{ id, position, url }` (spec 0002 AC-8). */
export interface ListingImageRow {
	readonly id: string;
	readonly position: number;
	readonly storageKey: string;
}

/**
 * Nơi duy nhất chạm bảng `listing_images` (spec 0002, spec 0005). Tối đa 5 ảnh mỗi tin do `CHECK position`
 * cộng `UNIQUE (listing_id, position)` ở DB; khóa dòng tin ở đây để hai lần tải đồng thời không đụng ràng
 * buộc (nếu không sẽ thành 500 thay vì 409 `LISTING_IMAGE_LIMIT`).
 */
@Injectable()
export class ListingImagesRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Khóa dòng tin chưa xóa mềm bằng `SELECT ... FOR UPDATE` cho đến hết giao dịch. `false` nếu tin không còn
	 * (đã xóa mềm ngay giữa chừng). Chỉ khóa dòng `listings`, là khóa cuối của thứ tự `users`, `properties`,
	 * `listings` (spec 0003), nên không tạo vòng chờ.
	 */
	async lockListing(
		listingId: string,
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const rows = await tx.$queryRaw<{ id: string }[]>`
			SELECT id FROM listings
			WHERE id = ${listingId}::uuid AND deleted_at IS NULL
			FOR UPDATE`;
		return rows.length === 1;
	}

	/** Các `position` đang dùng của một tin. */
	async findPositions(
		listingId: string,
		tx: Prisma.TransactionClient,
	): Promise<number[]> {
		const rows = await tx.listingImage.findMany({
			where: { listingId },
			select: { position: true },
		});
		return rows.map((row) => row.position);
	}

	create(
		input: NewListingImage,
		tx: Prisma.TransactionClient,
	): Promise<ListingImageRow> {
		return tx.listingImage.create({
			data: { ...input },
			select: { id: true, position: true, storageKey: true },
		});
	}

	/** Ảnh `imageId` của đúng tin `listingId`, hoặc `null` (không có, hay thuộc tin khác). */
	findInListing(
		listingId: string,
		imageId: string,
	): Promise<ListingImageRow | null> {
		return this.prisma.listingImage.findFirst({
			where: { id: imageId, listingId },
			select: { id: true, position: true, storageKey: true },
		});
	}

	/** Xóa dòng ảnh. `false` nếu dòng không còn (xóa đua với một lần xóa khác). Ảnh nhỏ nhất còn lại thành ảnh bìa. */
	async delete(listingId: string, imageId: string): Promise<boolean> {
		const result = await this.prisma.listingImage.deleteMany({
			where: { id: imageId, listingId },
		});
		return result.count === 1;
	}

	/** Tin của ảnh có `storage_key` này, hoặc `null`. Dùng cho route phục vụ ảnh. */
	findByStorageKey(
		storageKey: string,
	): Promise<{ listingId: string } | null> {
		return this.prisma.listingImage.findUnique({
			where: { storageKey },
			select: { listingId: true },
		});
	}
}
