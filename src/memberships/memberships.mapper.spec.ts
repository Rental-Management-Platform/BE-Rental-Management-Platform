import { toMembershipResponse } from './memberships.mapper';
import type { Membership } from './memberships.service';

const NOW = new Date('2026-10-19T03:00:00.000Z');
const DAY_MS = 86_400_000;

const trial = (msLeft: number, limit = 2): Membership => ({
	state: 'trial',
	limit,
	trialEndsAt: new Date(NOW.getTime() + msLeft),
});

describe('toMembershipResponse (spec 0003 AC-10)', () => {
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
				toMembershipResponse(trial(msLeft), 0, NOW).trialDaysLeft,
			).toBe(days);
		});

		it('hết dùng thử thì 0 khi vẫn có trialEndsAt', () => {
			const expired: Membership = {
				state: 'expired',
				limit: 0,
				trialEndsAt: new Date(NOW.getTime() - 5 * DAY_MS),
			};
			expect(toMembershipResponse(expired, 0, NOW).trialDaysLeft).toBe(0);
		});

		it('null khi tài khoản không có trialEndsAt', () => {
			const none: Membership = {
				state: 'expired',
				limit: 0,
				trialEndsAt: null,
			};
			expect(toMembershipResponse(none, 0, NOW).trialDaysLeft).toBeNull();
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
					toMembershipResponse(trial(DAY_MS), visibleCount, NOW),
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
				toMembershipResponse(trial(DAY_MS, 0), 4, NOW),
			).toMatchObject({ remaining: 0, overLimitCount: 4 });
		});
	});

	it('trả đúng bảy trường của hợp đồng, không lộ gì thêm', () => {
		const response = toMembershipResponse(trial(DAY_MS), 1, NOW);
		expect(Object.keys(response).sort()).toEqual([
			'listingLimit',
			'overLimitCount',
			'remaining',
			'state',
			'trialDaysLeft',
			'trialEndsAt',
			'visibleCount',
		]);
	});
});
