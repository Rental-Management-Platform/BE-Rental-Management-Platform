import type { MembershipResponse } from './dto/membership.response';
import type { Membership } from './memberships.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Số ngày dùng thử còn lại (spec 0003, "Value sourcing"): `ceil((trialEndsAt - now) / 1 ngày)` khi còn dùng
 * thử, `0` khi đã hết, `null` khi tài khoản không có hạn dùng thử.
 */
function trialDaysLeft(membership: Membership, now: Date): number | null {
	if (membership.trialEndsAt === null) return null;
	if (membership.state !== 'trial') return 0;
	return Math.ceil(
		(membership.trialEndsAt.getTime() - now.getTime()) / DAY_MS,
	);
}

/** Thân `GET /me/membership` từ hạn mức hiện hành và số tin đang hiện (spec 0003 AC-10). */
export function toMembershipResponse(
	membership: Membership,
	visibleCount: number,
	now: Date,
): MembershipResponse {
	return {
		state: membership.state,
		trialEndsAt: membership.trialEndsAt,
		trialDaysLeft: trialDaysLeft(membership, now),
		listingLimit: membership.limit,
		visibleCount,
		remaining: Math.max(0, membership.limit - visibleCount),
		overLimitCount: Math.max(0, visibleCount - membership.limit),
	};
}
