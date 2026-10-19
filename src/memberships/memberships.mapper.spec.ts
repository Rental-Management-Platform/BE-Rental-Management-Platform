import { toMembershipResponse } from './memberships.mapper';
import type { Membership } from './memberships.service';

const NOW = new Date('2026-10-19T03:00:00.000Z');
const DAY_MS = 86_400_000;

const trial = (msLeft: number, limit = 2): Membership => ({
	state: 'trial',
	limit,
	trialEndsAt: new Date(NOW.getTime() + msLeft),
	subscription: null,
});

/** Chủ trọ có gói đang chạy còn `msLeft` mili giây; `trialEndsAt` độc lập với gói. */
const plan = (
	msLeft: number,
	trialEndsAt: Date | null = new Date(NOW.getTime() - DAY_MS),
	limit = 15,
): Membership => ({
	state: 'plan',
	limit,
	trialEndsAt,
	subscription: {
		startsAt: new Date(NOW.getTime() + msLeft - 30 * DAY_MS),
		endsAt: new Date(NOW.getTime() + msLeft),
		order: { code: 'k7m2xq9p', planName: 'Nâng cao', maxListings: limit },
	},
});

describe('toMembershipResponse (spec 0003 AC-10, spec 0004 AC-10)', () => {
	describe('trialDaysLeft', () => {
		it.each([
			[1, 1],
			[DAY_MS - 1, 1],
			[DAY_MS, 1],
			[DAY_MS + 1, 2],
			[29 * DAY_MS + 1, 30],
			[30 * DAY_MS, 30],
		])('còn %i ms thì %i ngày (làm tròn lên)', (msLeft, days) => {
			expect(
				toMembershipResponse(trial(msLeft), 0, null, NOW).trialDaysLeft,
			).toBe(days);
		});

		it('hết dùng thử thì 0 khi vẫn có trialEndsAt', () => {
			const expired: Membership = {
				state: 'expired',
				limit: 0,
				trialEndsAt: new Date(NOW.getTime() - 5 * DAY_MS),
				subscription: null,
			};
			expect(
				toMembershipResponse(expired, 0, null, NOW).trialDaysLeft,
			).toBe(0);
		});

		it('đúng lúc trialEndsAt bằng now là hết: 0', () => {
			expect(
				toMembershipResponse(trial(0), 0, null, NOW).trialDaysLeft,
			).toBe(0);
		});

		it('null khi tài khoản không có trialEndsAt', () => {
			const none: Membership = {
				state: 'expired',
				limit: 0,
				trialEndsAt: null,
				subscription: null,
			};
			expect(
				toMembershipResponse(none, 0, null, NOW).trialDaysLeft,
			).toBeNull();
		});

		it('không phụ thuộc state: đang có gói mà dùng thử còn thì vẫn đếm ngày dùng thử', () => {
			const response = toMembershipResponse(
				plan(10 * DAY_MS, new Date(NOW.getTime() + 3 * DAY_MS + 1)),
				0,
				null,
				NOW,
			);
			expect(response.state).toBe('plan');
			expect(response.trialDaysLeft).toBe(4);
		});

		it('đang có gói mà dùng thử đã hết thì 0, không có trialEndsAt thì null', () => {
			expect(
				toMembershipResponse(plan(DAY_MS), 0, null, NOW).trialDaysLeft,
			).toBe(0);
			expect(
				toMembershipResponse(plan(DAY_MS, null), 0, null, NOW)
					.trialDaysLeft,
			).toBeNull();
		});
	});

	describe('subscription', () => {
		it('null khi không có kỳ đang chạy (dùng thử hoặc hết hạn)', () => {
			expect(
				toMembershipResponse(trial(DAY_MS), 0, null, NOW).subscription,
			).toBeNull();
		});

		it('có kỳ đang chạy: mã đơn, tên gói đã chốt, hai đầu kỳ, daysLeft và paidUntil', () => {
			const membership = plan(20 * DAY_MS);
			const paidUntil = new Date(NOW.getTime() + 50 * DAY_MS);
			expect(
				toMembershipResponse(membership, 0, paidUntil, NOW)
					.subscription,
			).toEqual({
				orderCode: 'k7m2xq9p',
				planName: 'Nâng cao',
				startsAt: membership.subscription?.startsAt,
				endsAt: membership.subscription?.endsAt,
				daysLeft: 20,
				paidUntil,
			});
		});

		it.each([
			[1, 1],
			[DAY_MS - 1, 1],
			[DAY_MS, 1],
			[DAY_MS + 1, 2],
			[30 * DAY_MS, 30],
		])('daysLeft: còn %i ms thì %i ngày (làm tròn lên)', (msLeft, days) => {
			expect(
				toMembershipResponse(plan(msLeft), 0, null, NOW).subscription
					?.daysLeft,
			).toBe(days);
		});

		it('paidUntil lấy từ giá trị truyền vào; vắng thì rơi về ends_at của kỳ đang chạy', () => {
			const membership = plan(5 * DAY_MS);
			const later = new Date(NOW.getTime() + 35 * DAY_MS);
			expect(
				toMembershipResponse(membership, 0, later, NOW).subscription
					?.paidUntil,
			).toEqual(later);
			expect(
				toMembershipResponse(membership, 0, null, NOW).subscription
					?.paidUntil,
			).toEqual(membership.subscription?.endsAt);
		});
	});

	describe('remaining và overLimitCount', () => {
		it.each([
			[0, 2, 0],
			[1, 1, 0],
			[2, 0, 0],
			[3, 0, 1],
			[5, 0, 3],
		])(
			'đang hiện %i trên hạn mức 2: remaining %i, overLimitCount %i',
			(visibleCount, remaining, overLimitCount) => {
				expect(
					toMembershipResponse(
						trial(DAY_MS),
						visibleCount,
						null,
						NOW,
					),
				).toMatchObject({
					listingLimit: 2,
					visibleCount,
					remaining,
					overLimitCount,
				});
			},
		);

		it('hạn mức 0 thì mọi tin đang hiện là phần vượt', () => {
			expect(
				toMembershipResponse(trial(DAY_MS, 0), 4, null, NOW),
			).toMatchObject({ remaining: 0, overLimitCount: 4 });
		});

		it('state plan tính theo hạn mức của gói: 18 tin trên hạn mức 15 thì vượt 3', () => {
			expect(
				toMembershipResponse(plan(DAY_MS), 18, null, NOW),
			).toMatchObject({
				state: 'plan',
				listingLimit: 15,
				visibleCount: 18,
				remaining: 0,
				overLimitCount: 3,
			});
			expect(
				toMembershipResponse(plan(DAY_MS), 10, null, NOW),
			).toMatchObject({ remaining: 5, overLimitCount: 0 });
		});
	});

	it('trả đúng tám trường của hợp đồng, không lộ gì thêm', () => {
		const response = toMembershipResponse(trial(DAY_MS), 1, null, NOW);
		expect(Object.keys(response).sort()).toEqual([
			'listingLimit',
			'overLimitCount',
			'remaining',
			'state',
			'subscription',
			'trialDaysLeft',
			'trialEndsAt',
			'visibleCount',
		]);
	});

	it('subscription chỉ có sáu trường, không lộ id hay maxListings của đơn', () => {
		const response = toMembershipResponse(plan(DAY_MS), 0, null, NOW);
		expect(Object.keys(response.subscription ?? {}).sort()).toEqual([
			'daysLeft',
			'endsAt',
			'orderCode',
			'paidUntil',
			'planName',
			'startsAt',
		]);
	});
});
