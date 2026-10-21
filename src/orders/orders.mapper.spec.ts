import { orderRow } from './orders.fixtures';
import { toAdminOrderResponse, toOrderResponse } from './orders.mapper';
import type { AdminOrderRow } from './orders.repository';

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

describe('toAdminOrderResponse (spec 0010 AC-1, AC-5)', () => {
	const landlord = {
		id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03',
		name: 'Nguyễn Văn Nam',
		email: 'nam@example.com',
	};

	it('mười ba trường của một đơn cộng landlord, đúng nghĩa như spec 0004', () => {
		const paid = orderRow({
			status: 'paid',
			paidAt: STARTS,
			subscription: { startsAt: STARTS, endsAt: ENDS },
		});
		const response = toAdminOrderResponse({ ...paid, user: landlord });
		expect(Object.keys(response).sort()).toEqual([
			'cancelledAt',
			'code',
			'createdAt',
			'durationDays',
			'endsAt',
			'id',
			'landlord',
			'maxListings',
			'paidAt',
			'planId',
			'planName',
			'price',
			'startsAt',
			'status',
		]);
		expect(response).toMatchObject({
			...toOrderResponse(paid),
			landlord,
		});
		expect(response.startsAt).toEqual(STARTS);
		expect(response.endsAt).toEqual(ENDS);
	});

	it('landlord.name có thể là null', () => {
		const response = toAdminOrderResponse({
			...orderRow(),
			user: { ...landlord, name: null },
		});
		expect(response.landlord).toEqual({ ...landlord, name: null });
	});

	it('không lộ trường thừa: dù hàng có thêm userId, updatedAt hay cột của users, phản hồi chỉ có các trường đã liệt kê', () => {
		const leaky = {
			...orderRow(),
			user: {
				...landlord,
				phone: '0912345678',
				passwordHash: '$argon2id$secret',
				trialEndsAt: STARTS,
			},
		} as AdminOrderRow;
		const response = toAdminOrderResponse(leaky);
		const text = JSON.stringify(response);
		expect(Object.keys(response.landlord).sort()).toEqual([
			'email',
			'id',
			'name',
		]);
		expect(response).not.toHaveProperty('userId');
		expect(response).not.toHaveProperty('updatedAt');
		for (const forbidden of [
			'phone',
			'passwordHash',
			'trialEndsAt',
			'0912345678',
			'argon2id',
		]) {
			expect(text).not.toContain(forbidden);
		}
	});
});
