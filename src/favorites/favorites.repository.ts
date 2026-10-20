import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

/**
 * Nơi duy nhất chạm bảng `favorites` (spec 0006). Việc đọc danh sách đã lưu nối `favorites` với luật hiển thị công
 * khai nên nằm ở `ListingsRepository` (nơi duy nhất đọc bảng `listings`), không ở đây.
 */
@Injectable()
export class FavoritesRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Ghi dòng lưu bằng một câu `INSERT ... ON CONFLICT DO NOTHING` (`createMany` với `skipDuplicates`): cặp đã có thì
	 * không làm gì và không lỗi, nên bấm lặp hay nhiều lần gọi đồng thời vẫn ra đúng một dòng (spec 0006 AC-1).
	 */
	async addFavorite(userId: string, listingId: string): Promise<void> {
		await this.prisma.favorite.createMany({
			data: [{ userId, listingId }],
			skipDuplicates: true,
		});
	}

	/** Xóa dòng lưu của đúng cặp; không có dòng nào thì không làm gì và không lỗi (spec 0006 AC-2). */
	async removeFavorite(userId: string, listingId: string): Promise<void> {
		await this.prisma.favorite.deleteMany({ where: { userId, listingId } });
	}

	/**
	 * Trong các tin của một trang, những tin `userId` đã lưu: một truy vấn theo khóa chính (`user_id`, `listing_id`
	 * thuộc trang), để gắn `isFavorite` cho cả trang danh sách công khai (spec 0006 AC-6).
	 */
	async findSavedIds(
		userId: string,
		listingIds: readonly string[],
	): Promise<ReadonlySet<string>> {
		const rows = await this.prisma.favorite.findMany({
			where: { userId, listingId: { in: [...listingIds] } },
			select: { listingId: true },
		});
		return new Set(rows.map((row) => row.listingId));
	}

	/** Người này có đang lưu tin không: có dòng `favorites` cho cặp (userId, listingId). Dùng cho chi tiết tin công khai. */
	async isFavorite(userId: string, listingId: string): Promise<boolean> {
		const row = await this.prisma.favorite.findUnique({
			where: { userId_listingId: { userId, listingId } },
			select: { userId: true },
		});
		return row !== null;
	}
}
