/**
 * Khoảng giá trị admin được đặt cho một gói (spec 0004 AC-2). Cùng con số với các `CHECK` của bảng `plans`
 * trong migration `20261019090000_membership_plans_orders`: DTO trả 400 trước, `CHECK` là chốt cuối.
 */
export const PLAN_LIMITS = {
	nameMin: 2,
	nameMax: 60,
	/** Đồng Việt Nam; 0 là gói miễn phí. */
	priceMin: 0,
	priceMax: 100_000_000,
	maxListingsMin: 1,
	maxListingsMax: 1000,
	durationDaysMin: 1,
	durationDaysMax: 365,
} as const;
