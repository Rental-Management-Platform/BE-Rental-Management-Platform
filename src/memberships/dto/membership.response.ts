import type { MembershipState } from '../memberships.service';

/** Thân của `GET /me/membership` (spec 0003 AC-10). Hàng 10 chỉ thêm `state = 'plan'` và trường `subscription`. */
export interface MembershipResponse {
	readonly state: MembershipState;
	/** Hạn dùng thử (cột `users.trial_ends_at`); `null` với tài khoản không phải chủ trọ. */
	readonly trialEndsAt: Date | null;
	/** Số ngày còn lại, làm tròn lên; `0` khi đã hết; `null` khi không có hạn dùng thử. */
	readonly trialDaysLeft: number | null;
	/** Số tin `visible` tối đa được hiện cùng lúc. */
	readonly listingLimit: number;
	/** Số tin `visible` chưa xóa, kể cả tin đang bị ẩn bớt khỏi công khai vì vượt hạn mức. */
	readonly visibleCount: number;
	readonly remaining: number;
	/** Số tin đang bị ẩn bớt khỏi công khai vì vượt hạn mức. */
	readonly overLimitCount: number;
}
