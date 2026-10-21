import type { AdminOrderResponse } from './dto/admin-order.response';
import type { OrderResponse } from './dto/order.response';
import type { OrderStatus } from './order-status';
import type { AdminOrderRow, OrderRowShape } from './orders.repository';

/**
 * Hình dạng một đơn của mọi API đơn (spec 0004 AC-4). `startsAt` và `endsAt` lấy từ kỳ gói của đơn, `null` khi
 * đơn chưa có kỳ (chưa trả hoặc đã hủy). `status` có `CHECK` ở DB nên ép kiểu hẹp là an toàn.
 */
export function toOrderResponse(order: OrderRowShape): OrderResponse {
	return {
		id: order.id,
		code: order.code,
		planId: order.planId,
		planName: order.planName,
		price: order.price,
		maxListings: order.maxListings,
		durationDays: order.durationDays,
		status: order.status as OrderStatus,
		paidAt: order.paidAt,
		cancelledAt: order.cancelledAt,
		startsAt: order.subscription?.startsAt ?? null,
		endsAt: order.subscription?.endsAt ?? null,
		createdAt: order.createdAt,
	};
}

/**
 * Một dòng của `GET /orders/all` (spec 0010 AC-1, AC-5): mười ba trường của một đơn cộng `landlord`. Mapper chọn
 * từng trường nên dù `row` có thêm gì cũng không lọt ra: từ `users` chỉ có `id`, `name`, `email`.
 */
export function toAdminOrderResponse(row: AdminOrderRow): AdminOrderResponse {
	return {
		...toOrderResponse(row),
		landlord: {
			id: row.user.id,
			name: row.user.name,
			email: row.user.email,
		},
	};
}
