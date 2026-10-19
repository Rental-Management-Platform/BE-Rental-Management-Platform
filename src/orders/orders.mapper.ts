import type { OrderResponse } from './dto/order.response';
import type { OrderStatus } from './order-status';
import type { OrderWithPeriod } from './orders.repository';

/**
 * Hình dạng một đơn của mọi API đơn (spec 0004 AC-4). `startsAt` và `endsAt` lấy từ kỳ gói của đơn, `null` khi
 * đơn chưa có kỳ (chưa trả hoặc đã hủy). `status` có `CHECK` ở DB nên ép kiểu hẹp là an toàn.
 */
export function toOrderResponse(order: OrderWithPeriod): OrderResponse {
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
