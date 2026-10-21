import type { RevenueGroupBy } from '../order-status';

/** Doanh thu của một gói: các đơn `paid` trong khoảng, gom theo `plan_id` (spec 0010 AC-7). */
export interface RevenueByPlan {
	readonly planId: string;
	/** Tên HIỆN TẠI của gói; `paidAmount` thì cộng giá đã chốt trên từng đơn. */
	readonly planName: string;
	readonly paidCount: number;
	readonly paidAmount: number;
}

/** Doanh thu của một ngày (`YYYY-MM-DD`) hoặc một tháng (`YYYY-MM`) theo giờ Việt Nam của `paid_at`. */
export interface RevenuePeriod {
	readonly period: string;
	readonly paidCount: number;
	readonly paidAmount: number;
}

/** Phản hồi của `GET /orders/revenue` (spec 0010 AC-6). */
export interface RevenueResponse {
	/** Đúng như đã gửi, hoặc `null` khi không gửi (không chặn phía đó). */
	readonly from: string | null;
	readonly to: string | null;
	readonly groupBy: RevenueGroupBy;
	/** Luôn là múi giờ của một "ngày" trong API: `Asia/Ho_Chi_Minh`. */
	readonly timeZone: string;
	readonly paidCount: number;
	readonly paidAmount: number;
	readonly byPlan: readonly RevenueByPlan[];
	readonly series: readonly RevenuePeriod[];
}
