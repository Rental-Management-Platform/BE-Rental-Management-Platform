import type { MembershipState } from '../memberships.service';

/** Kỳ gói đang chạy trong `GET /me/membership` (spec 0004 AC-10). */
export interface SubscriptionResponse {
	/** Mã của đơn đã mua kỳ này. */
	readonly orderCode: string;
	/** Tên gói đã chốt trên đơn. */
	readonly planName: string;
	readonly startsAt: Date;
	readonly endsAt: Date;
	/** Số ngày còn lại của kỳ này, làm tròn lên. */
	readonly daysLeft: number;
	/** `ends_at` lớn nhất trong các kỳ của chủ trọ: đã trả đến ngày nào (kể cả các kỳ nối tiếp chưa tới). */
	readonly paidUntil: Date;
}

/** Thân của `GET /me/membership` (spec 0003 AC-10, spec 0004 AC-10). */
export interface MembershipResponse {
	readonly state: MembershipState;
	/** Hạn dùng thử (cột `users.trial_ends_at`); `null` với tài khoản không phải chủ trọ. */
	readonly trialEndsAt: Date | null;
	/** Số ngày còn lại, làm tròn lên; `0` khi đã hết; `null` khi không có hạn dùng thử. Không phụ thuộc `state`. */
	readonly trialDaysLeft: number | null;
	/** Kỳ gói đang chạy, hoặc `null` khi không có. */
	readonly subscription: SubscriptionResponse | null;
	/** Số tin `visible` tối đa được hiện cùng lúc. */
	readonly listingLimit: number;
	/** Số tin `visible` chưa xóa, kể cả tin đang bị ẩn bớt khỏi công khai vì vượt hạn mức. */
	readonly visibleCount: number;
	readonly remaining: number;
	/** Số tin đang bị ẩn bớt khỏi công khai vì vượt hạn mức. */
	readonly overLimitCount: number;
}
