import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { OrderCodeTakenError } from './order-code';
import type { OrderStatus } from './order-status';

/** Kỳ gói của đơn `paid` đi kèm mọi lần đọc đơn (`null` khi đơn chưa trả hoặc đã hủy). */
const periodInclude = {
	subscription: { select: { startsAt: true, endsAt: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithPeriod = Prisma.OrderGetPayload<{
	include: typeof periodInclude;
}>;

/** Mới nhất trước; `id` (uuidv7) phá thế hòa nên thứ tự luôn xác định. */
const NEWEST_FIRST = [
	{ createdAt: 'desc' },
	{ id: 'desc' },
] satisfies Prisma.OrderOrderByWithRelationInput[];

/** Đơn mới: bốn trường bản chốt (`planName`, `price`, `maxListings`, `durationDays`) không bao giờ đổi về sau. */
export interface NewOrder {
	readonly code: string;
	readonly userId: string;
	readonly planId: string;
	readonly planName: string;
	readonly price: number;
	readonly maxListings: number;
	readonly durationDays: number;
}

/** Dòng đơn đã khóa bằng `FOR UPDATE`: đủ để kiểm chủ sở hữu, trạng thái và dựng kỳ gói. */
export interface LockedOrder {
	readonly id: string;
	readonly userId: string;
	readonly planId: string;
	readonly durationDays: number;
	readonly status: string;
}

/** Nơi duy nhất của module đơn chạm bảng `orders` (spec 0004, spec 0005). */
@Injectable()
export class OrdersRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Chèn đơn `pending`. Trùng `code` thì ném `OrderCodeTakenError` (Prisma `P2002`) để Service sinh mã khác và
	 * thử lại bằng một giao dịch mới. Chỉ mục duy nhất một phần `orders_user_pending_unique` cũng ra `P2002`, nhưng
	 * chỉ xảy ra khi người gọi bỏ sót khóa dòng `users` và hủy đơn chờ cũ; khi đó các lần thử lại cũng thất bại và
	 * Service báo lỗi hệ thống, không im lặng.
	 */
	async create(
		input: NewOrder,
		tx: Prisma.TransactionClient,
	): Promise<string> {
		try {
			const { id } = await tx.order.create({
				data: { ...input },
				select: { id: true },
			});
			return id;
		} catch (error: unknown) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				throw new OrderCodeTakenError({ cause: error });
			}
			throw error;
		}
	}

	/** Hủy đơn `pending` của chủ trọ (nếu có) vì họ vừa tạo đơn mới; `cancelled_at` là `now`. */
	async cancelPendingOfUser(
		userId: string,
		now: Date,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		await tx.order.updateMany({
			where: { userId, status: 'pending' },
			data: { status: 'cancelled', cancelledAt: now },
		});
	}

	/**
	 * Khóa dòng đơn bằng `SELECT ... FOR UPDATE` và trả các cột cần để quyết định, hoặc `null` khi không có đơn.
	 * Thanh toán và hủy cùng khóa dòng này nên tuần tự với nhau và với việc tạo đơn mới của cùng chủ trọ.
	 */
	async lockById(
		id: string,
		tx: Prisma.TransactionClient,
	): Promise<LockedOrder | null> {
		const rows = await tx.$queryRaw<LockedOrder[]>`
      SELECT id, user_id AS "userId", plan_id AS "planId",
             duration_days AS "durationDays", status
      FROM orders
      WHERE id = ${id}::uuid
      FOR UPDATE`;
		return rows[0] ?? null;
	}

	/** `pending` sang `paid`, `paid_at` là `now`. Trả `false` khi đơn không còn `pending`. */
	async markPaid(
		id: string,
		now: Date,
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		return this.transition(id, 'paid', { paidAt: now }, tx);
	}

	/** `pending` sang `cancelled`, `cancelled_at` là `now`. Trả `false` khi đơn không còn `pending`. */
	async markCancelled(
		id: string,
		now: Date,
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		return this.transition(id, 'cancelled', { cancelledAt: now }, tx);
	}

	private async transition(
		id: string,
		to: OrderStatus,
		stamp: { paidAt: Date } | { cancelledAt: Date },
		tx: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await tx.order.updateMany({
			where: { id, status: 'pending' },
			data: { status: to, ...stamp },
		});
		return result.count === 1;
	}

	/** Một đơn kèm kỳ gói, hoặc `null`. Đọc bằng kết nối thường, sau khi giao dịch ghi đã xong. */
	findById(id: string): Promise<OrderWithPeriod | null> {
		return this.prisma.order.findUnique({
			where: { id },
			include: periodInclude,
		});
	}

	/** Một trang đơn của chủ trọ, mới nhất trước, lọc `status` nếu có; kèm tổng số cùng điều kiện. */
	async findOwnPage(
		userId: string,
		status: OrderStatus | undefined,
		skip: number,
		take: number,
	): Promise<{ rows: OrderWithPeriod[]; total: number }> {
		const where: Prisma.OrderWhereInput = {
			userId,
			...(status === undefined ? {} : { status }),
		};
		const [rows, total] = await Promise.all([
			this.prisma.order.findMany({
				where,
				include: periodInclude,
				orderBy: NEWEST_FIRST,
				skip,
				take,
			}),
			this.prisma.order.count({ where }),
		]);
		return { rows, total };
	}
}
