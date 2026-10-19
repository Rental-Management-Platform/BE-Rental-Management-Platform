import type { OrderWithPeriod } from './orders.repository';

/** Dữ liệu mẫu dùng chung cho test của module đơn. */
export const LANDLORD_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
export const PLAN_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';
export const ORDER_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';

/** Đơn `pending` của chủ trọ mặc định, chốt gói "Nâng cao" 199.000 đ, 15 tin, 30 ngày. */
export function orderRow(
	overrides: Partial<OrderWithPeriod> = {},
): OrderWithPeriod {
	return {
		id: ORDER_ID,
		code: 'k7m2xq9p',
		userId: LANDLORD_ID,
		planId: PLAN_ID,
		planName: 'Nâng cao',
		price: 199_000,
		maxListings: 15,
		durationDays: 30,
		status: 'pending',
		paidAt: null,
		cancelledAt: null,
		createdAt: new Date('2026-10-19T02:59:30.000Z'),
		updatedAt: new Date('2026-10-19T02:59:30.000Z'),
		subscription: null,
		...overrides,
	};
}
