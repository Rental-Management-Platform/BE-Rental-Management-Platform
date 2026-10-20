/**
 * Hồ sơ công khai của một chủ trọ (spec 0005 AC-1): đúng bảy trường, không email, không số điện thoại, không
 * danh sách hay danh tính người theo dõi. Cả ba API (`GET`, `POST`, `DELETE`) cùng trả hình dạng này.
 */
export interface LandlordProfileResponse {
	readonly id: string;
	/** `users.name`; rỗng hoặc chỉ khoảng trắng thì `null`. */
	readonly name: string | null;
	/** `users.created_at`. */
	readonly joinedAt: Date;
	/** Số người theo dõi đang hoạt động (tài khoản `active`, chưa xóa mềm); mỗi người một lần. */
	readonly followerCount: number;
	/** Tổng `view_count` của mọi tin thuộc mọi nhà trọ của chủ trọ, kể cả tin đang ẩn và đã xóa mềm. */
	readonly totalViewCount: number;
	/** Số tin đang hiện công khai ngay lúc đọc; bằng số tin của chủ trọ này mà `GET /listings` trả. */
	readonly publicListingCount: number;
	/** `null` với khách; `true` hoặc `false` với người đã đăng nhập. */
	readonly isFollowing: boolean | null;
}
