import type { OrderResponse } from './order.response';

/** Chủ trọ của một đơn: chỉ ba trường, không bao giờ có số điện thoại, mật khẩu băm hay cột nào khác của `users`. */
export interface OrderLandlord {
	readonly id: string;
	readonly name: string | null;
	readonly email: string;
}

/** Một dòng của `GET /orders/all` (spec 0010 AC-1): hình dạng một đơn của spec 0004 cộng chủ trọ. */
export interface AdminOrderResponse extends OrderResponse {
	readonly landlord: OrderLandlord;
}

/** Số đơn `paid` và tổng `price` (đồng) của đúng tập đang lọc, không phụ thuộc trang (spec 0010 AC-4). */
export interface OrderSummary {
	readonly paidCount: number;
	readonly paidAmount: number;
}

/** Trang của `GET /orders/all`: `{ items, total, page, pageSize, summary }`. */
export interface AdminOrderPage {
	readonly items: readonly AdminOrderResponse[];
	readonly total: number;
	readonly page: number;
	readonly pageSize: number;
	readonly summary: OrderSummary;
}
