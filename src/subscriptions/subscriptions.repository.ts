import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export interface NewSubscription {
	readonly userId: string;
	readonly orderId: string;
	readonly startsAt: Date;
	readonly endsAt: Date;
}

/** Kỳ đang chạy cùng phần của đơn đã chốt mà hạn mức và `/me/membership` cần (spec 0004 AC-8, AC-10). */
export interface ActiveSubscription {
	readonly startsAt: Date;
	readonly endsAt: Date;
	readonly order: {
		readonly code: string;
		readonly planName: string;
		readonly maxListings: number;
	};
}

/**
 * Nơi duy nhất chạm bảng `subscriptions` (spec 0004, spec 0005). Kỳ gói không có trạng thái lưu: "đang chạy"
 * suy ra từ `starts_at`, `ends_at` và `now`. Ràng buộc loại trừ ở DB bảo đảm hai kỳ của cùng một chủ trọ không
 * chồng nhau; người gọi `create` phải đã khóa dòng `users` của chủ trọ.
 */
@Injectable()
export class SubscriptionsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Có `tx` thì chạy trong giao dịch đó, không thì dùng kết nối thường. */
	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	/** `ends_at` lớn nhất trong các kỳ của chủ trọ (đã hết hay chưa), hoặc `null` khi chưa có kỳ nào. */
	async findLatestEndsAt(
		userId: string,
		tx?: Prisma.TransactionClient,
	): Promise<Date | null> {
		const result = await this.client(tx).subscription.aggregate({
			where: { userId },
			_max: { endsAt: true },
		});
		return result._max.endsAt;
	}

	/**
	 * Kỳ đang chạy tại `now`: `starts_at <= now < ends_at` (khoảng nửa mở, đúng lúc `ends_at` là hết). Ràng buộc
	 * loại trừ bảo đảm có tối đa một kỳ như vậy.
	 */
	findActive(
		userId: string,
		now: Date,
		tx?: Prisma.TransactionClient,
	): Promise<ActiveSubscription | null> {
		return this.client(tx).subscription.findFirst({
			where: { userId, startsAt: { lte: now }, endsAt: { gt: now } },
			select: {
				startsAt: true,
				endsAt: true,
				order: {
					select: { code: true, planName: true, maxListings: true },
				},
			},
		});
	}

	async create(
		input: NewSubscription,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.subscription.create({ data: { ...input } });
	}
}
