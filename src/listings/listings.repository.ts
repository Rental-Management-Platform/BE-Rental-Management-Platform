import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

/** Xóa mềm (spec 0005): mọi phương thức đọc `listings` đều thêm điều kiện này, trừ tên có `IncludingDeleted`. */
const notDeleted = { deletedAt: null } satisfies Prisma.ListingWhereInput;

/**
 * Nơi duy nhất của module tin chạm bảng `listings` (spec 0002, spec 0005). Mốc 2 chỉ có ba phương thức
 * mà module nhà trọ cần: đếm tin còn sống để chặn xóa nhà trọ (AC-4) và làm mới `search_key` khi nhà trọ
 * đổi tên, địa chỉ hay phường (AC-7). Mốc 3 thêm đăng tin, danh sách và chi tiết vào đây.
 */
@Injectable()
export class ListingsRepository {
	constructor(private readonly prisma: PrismaService) {}

	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	/** Số tin chưa xóa mềm của một nhà trọ, mọi trạng thái (kể cả đang ẩn). */
	countLiveByProperty(
		propertyId: string,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		return this.client(tx).listing.count({
			where: { propertyId, ...notDeleted },
		});
	}

	/** Id và tiêu đề của mọi tin chưa xóa mềm thuộc nhà trọ: đủ để dựng lại `search_key` của từng tin. */
	findLiveTitlesByProperty(
		propertyId: string,
		tx?: Prisma.TransactionClient,
	): Promise<{ id: string; title: string }[]> {
		return this.client(tx).listing.findMany({
			where: { propertyId, ...notDeleted },
			select: { id: true, title: true },
			orderBy: { id: 'asc' },
		});
	}

	async setSearchKey(
		id: string,
		searchKey: string,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		await this.client(tx).listing.update({
			where: { id },
			data: { searchKey },
		});
	}
}
