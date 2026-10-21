import { Injectable } from '@nestjs/common';
import { APP_TIME_ZONE, toSqlTimestamp } from '../common/time/app-time-zone';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { OrderSummary } from './dto/admin-order.response';
import type { RevenueByPlan, RevenuePeriod } from './dto/revenue.response';
import { OrderCodeTakenError } from './order-code';
import type { OrderStatus, RevenueGroupBy } from './order-status';

/** Kỳ gói của đơn `paid` đi kèm mọi lần đọc đơn (`null` khi đơn chưa trả hoặc đã hủy). */
const periodInclude = {
	subscription: { select: { startsAt: true, endsAt: true } },
} satisfies Prisma.OrderInclude;

export type OrderWithPeriod = Prisma.OrderGetPayload<{
	include: typeof periodInclude;
}>;

/** Một đơn kèm kỳ gói mà không cần `userId` và `updatedAt`: đủ để dựng `OrderResponse` (cả đọc đầy đủ lẫn `select`). */
export type OrderRowShape = Omit<OrderWithPeriod, 'userId' | 'updatedAt'>;

/**
 * Cột của danh sách admin (spec 0010 AC-5): đúng cột của một đơn, kỳ gói, và ba cột `id`, `name`, `email` của chủ trọ.
 * `select` liệt kê từng cột nên `phone`, `passwordHash`, `trialEndsAt` không bao giờ được đọc ra khỏi database.
 */
const adminSelect = {
	id: true,
	code: true,
	planId: true,
	planName: true,
	price: true,
	maxListings: true,
	durationDays: true,
	status: true,
	paidAt: true,
	cancelledAt: true,
	createdAt: true,
	subscription: { select: { startsAt: true, endsAt: true } },
	user: { select: { id: true, name: true, email: true } },
} satisfies Prisma.OrderSelect;

export type AdminOrderRow = Prisma.OrderGetPayload<{
	select: typeof adminSelect;
}>;

/** Bộ lọc của `GET /orders/all`; mọi bộ lọc đều tùy chọn và có mặt thì phải thỏa cả. */
export interface AdminOrderFilter {
	readonly status?: OrderStatus;
	/** Khớp `orders.user_id`. */
	readonly landlordId?: string;
	readonly planId?: string;
	/** Gồm: `created_at >= createdFrom`. */
	readonly createdFrom?: Date;
	/** Không gồm: `created_at < createdBefore`. */
	readonly createdBefore?: Date;
}

function adminWhere(filter: AdminOrderFilter): Prisma.OrderWhereInput {
	const created: Prisma.DateTimeFilter = {
		...(filter.createdFrom === undefined
			? {}
			: { gte: filter.createdFrom }),
		...(filter.createdBefore === undefined
			? {}
			: { lt: filter.createdBefore }),
	};
	return {
		...(filter.status === undefined ? {} : { status: filter.status }),
		...(filter.landlordId === undefined
			? {}
			: { userId: filter.landlordId }),
		...(filter.planId === undefined ? {} : { planId: filter.planId }),
		...(Object.keys(created).length === 0 ? {} : { createdAt: created }),
	};
}

/** Khoảng thời điểm `paid_at` của thống kê: `from` gồm, `before` không gồm; thiếu phía nào là không chặn phía đó. */
export interface RevenueRange {
	readonly from?: Date;
	readonly before?: Date;
}

/** Hai kiểu dòng của câu thống kê: gom theo gói hoặc gom theo ngày hay tháng. */
export interface RevenueRows {
	readonly byPlan: RevenueByPlan[];
	readonly series: RevenuePeriod[];
}

interface RevenueRawRow {
	readonly kind: 'plan' | 'period';
	readonly key: string;
	readonly label: string | null;
	readonly paidCount: number;
	/** `SUM(...)::bigint`: Prisma trả `bigint` cho cột int8, nên đổi sang `number` ở `findRevenue`. */
	readonly paidAmount: bigint | number;
}

/** Mẫu `to_char` của từng cách gom. Đây là danh sách trắng: mẫu không bao giờ đến từ chuỗi người dùng. */
const PERIOD_FORMATS: Readonly<Record<RevenueGroupBy, string>> = {
	day: 'YYYY-MM-DD',
	month: 'YYYY-MM',
};

/**
 * Một câu SQL cho cả hai phép gom (spec 0010 AC-6 đến AC-8): CTE `paid` chọn các đơn `paid` có `paid_at` trong
 * khoảng, rồi `UNION ALL` gom theo gói (nối `plans` lấy tên hiện tại) và gom theo `period`. Cùng một câu nên cùng một
 * ảnh chụp dữ liệu, ba con số tổng luôn bằng nhau dù có thanh toán đang diễn ra. `period` đổi sang giờ Việt Nam bằng
 * `AT TIME ZONE`, không phụ thuộc múi giờ phiên của database. Cận ngày đi vào dưới dạng chuỗi ISO có `Z` (bài học múi
 * giờ của tham số `Date`); múi giờ và mẫu định dạng là tham số ràng buộc. `SUM(...)::bigint` không bao giờ ép về
 * `int4`: tổng vượt 2,1 tỷ đồng vẫn đúng.
 */
export function revenueQuery(
	range: RevenueRange,
	groupBy: RevenueGroupBy,
): Prisma.Sql {
	const lower =
		range.from === undefined
			? Prisma.empty
			: Prisma.sql`AND o.paid_at >= ${toSqlTimestamp(range.from)}::timestamptz`;
	const upper =
		range.before === undefined
			? Prisma.empty
			: Prisma.sql`AND o.paid_at < ${toSqlTimestamp(range.before)}::timestamptz`;
	return Prisma.sql`
		WITH paid AS (
			SELECT o.plan_id, o.price,
			       to_char(o.paid_at AT TIME ZONE ${APP_TIME_ZONE}::text, ${PERIOD_FORMATS[groupBy]}::text) AS period
			FROM orders o
			WHERE o.status = 'paid' ${lower} ${upper}
		)
		SELECT 'plan' AS kind, p.plan_id::text AS key, pl.name AS label,
		       count(*)::int AS "paidCount", sum(p.price)::bigint AS "paidAmount"
		FROM paid p JOIN plans pl ON pl.id = p.plan_id
		GROUP BY p.plan_id, pl.name
		UNION ALL
		SELECT 'period' AS kind, period AS key, NULL AS label,
		       count(*)::int AS "paidCount", sum(price)::bigint AS "paidAmount"
		FROM paid
		GROUP BY period`;
}

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

	/**
	 * Một trang đơn của MỌI chủ trọ cho admin (spec 0010 AC-1 đến AC-5), mới nhất trước. Ba truy vấn cùng `where` chạy
	 * song song: các dòng, `total`, và `summary` (số đơn `paid` cùng tổng `price` của đúng tập lọc). `summary` thêm
	 * `status = 'paid'` bằng `AND` chứ không ghi đè `status`, nên lọc `status=pending` cho `summary` bằng 0.
	 */
	async findAdminPage(
		filter: AdminOrderFilter,
		skip: number,
		take: number,
	): Promise<{
		rows: AdminOrderRow[];
		total: number;
		summary: OrderSummary;
	}> {
		const where = adminWhere(filter);
		const [rows, total, paid] = await Promise.all([
			this.prisma.order.findMany({
				where,
				select: adminSelect,
				orderBy: NEWEST_FIRST,
				skip,
				take,
			}),
			this.prisma.order.count({ where }),
			this.prisma.order.aggregate({
				where: { AND: [where, { status: 'paid' }] },
				_count: { _all: true },
				_sum: { price: true },
			}),
		]);
		return {
			rows,
			total,
			summary: {
				paidCount: paid._count._all,
				paidAmount: paid._sum.price ?? 0,
			},
		};
	}

	/**
	 * Thống kê doanh thu của các đơn `paid` có `paid_at` trong khoảng (spec 0010 AC-6 đến AC-8), từ MỘT câu SQL (xem
	 * `revenueQuery`). Trả các dòng chưa sắp xếp; Service sắp xếp và cộng tổng. `paidAmount` đổi từ `bigint` sang
	 * `number` bằng `Number()` (an toàn: tổng đồng của một demo xa dưới 2^53).
	 */
	async findRevenue(
		range: RevenueRange,
		groupBy: RevenueGroupBy,
	): Promise<RevenueRows> {
		const raw = await this.prisma.$queryRaw<RevenueRawRow[]>(
			revenueQuery(range, groupBy),
		);
		const byPlan: RevenueByPlan[] = [];
		const series: RevenuePeriod[] = [];
		for (const row of raw) {
			const paidAmount = Number(row.paidAmount);
			if (row.kind === 'plan') {
				byPlan.push({
					planId: row.key,
					planName: row.label ?? '',
					paidCount: row.paidCount,
					paidAmount,
				});
			} else {
				series.push({
					period: row.key,
					paidCount: row.paidCount,
					paidAmount,
				});
			}
		}
		return { byPlan, series };
	}
}
