import { orderRow } from './orders.fixtures';
import { toOrderResponse } from './orders.mapper';

const STARTS = new Date('2026-10-19T03:00:00.000Z');
const ENDS = new Date('2026-11-18T03:00:00.000Z');

describe('toOrderResponse (spec 0004 AC-4)', () => {
	it('đơn pending: có đủ mười ba trường, kỳ gói là null và không lộ user_id hay updated_at', () => {
		const response = toOrderResponse(orderRow());
		expect(Object.keys(response).sort()).toEqual([
			'cancelledAt',
			'code',
			'createdAt',
			'durationDays',
			'endsAt',
			'id',
			'maxListings',
			'paidAt',
			'planId',
			'planName',
			'price',
			'startsAt',
			'status',
		]);
		expect(response).toMatchObject({
			code: 'k7m2xq9p',
			planName: 'Nâng cao',
			price: 199_000,
			maxListings: 15,
			durationDays: 30,
			status: 'pending',
			paidAt: null,
			cancelledAt: null,
			startsAt: null,
			endsAt: null,
		});
		expect(response).not.toHaveProperty('userId');
	});

	it('đơn paid: startsAt và endsAt lấy từ kỳ gói của đơn', () => {
		const response = toOrderResponse(
			orderRow({
				status: 'paid',
				paidAt: STARTS,
				subscription: { startsAt: STARTS, endsAt: ENDS },
			}),
		);
		expect(response.status).toBe('paid');
		expect(response.paidAt).toEqual(STARTS);
		expect(response.startsAt).toEqual(STARTS);
		expect(response.endsAt).toEqual(ENDS);
	});

	it('đơn cancelled: có cancelledAt, kỳ gói vẫn là null', () => {
		const response = toOrderResponse(
			orderRow({ status: 'cancelled', cancelledAt: STARTS }),
		);
		expect(response.cancelledAt).toEqual(STARTS);
		expect(response.startsAt).toBeNull();
		expect(response.endsAt).toBeNull();
	});
});
