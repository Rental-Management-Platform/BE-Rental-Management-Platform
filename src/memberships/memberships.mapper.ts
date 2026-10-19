import type { ActiveSubscription } from '../subscriptions/subscriptions.repository';
import type {
	MembershipResponse,
	SubscriptionResponse,
} from './dto/membership.response';
import type { Membership } from './memberships.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Số ngày dùng thử còn lại (spec 0004 AC-10, "Value sourcing"): chỉ phụ thuộc `trialEndsAt` và `now`, không
 * phụ thuộc `state` (đang có gói thì `state` là `plan` nhưng dùng thử vẫn có thể còn): `ceil((trialEndsAt - now) /
 * 1 ngày)` khi còn dùng thử, `0` khi đã hết, `null` khi tài khoản không có hạn dùng thử.
 */
function trialDaysLeft(trialEndsAt: Date | null, now: Date): number | null {
	if (trialEndsAt === null) return null;
	const left = trialEndsAt.getTime() - now.getTime();
	return left > 0 ? Math.ceil(left / DAY_MS) : 0;
}

/** `null` khi không có kỳ đang chạy; `daysLeft` làm tròn lên, `paidUntil` là `ends_at` lớn nhất của các kỳ. */
function toSubscription(
	subscription: ActiveSubscription | null,
	paidUntil: Date | null,
	now: Date,
): SubscriptionResponse | null {
	if (subscription === null) return null;
	return {
		orderCode: subscription.order.code,
		planName: subscription.order.planName,
		startsAt: subscription.startsAt,
		endsAt: subscription.endsAt,
		daysLeft: Math.ceil(
			(subscription.endsAt.getTime() - now.getTime()) / DAY_MS,
		),
		paidUntil: paidUntil ?? subscription.endsAt,
	};
}

/** Thân `GET /me/membership` từ hạn mức hiện hành và số tin đang hiện (spec 0003 AC-10, spec 0004 AC-10). */
export function toMembershipResponse(
	membership: Membership,
	visibleCount: number,
	paidUntil: Date | null,
	now: Date,
): MembershipResponse {
	return {
		state: membership.state,
		trialEndsAt: membership.trialEndsAt,
		trialDaysLeft: trialDaysLeft(membership.trialEndsAt, now),
		subscription: toSubscription(membership.subscription, paidUntil, now),
		listingLimit: membership.limit,
		visibleCount,
		remaining: Math.max(0, membership.limit - visibleCount),
		overLimitCount: Math.max(0, visibleCount - membership.limit),
	};
}
