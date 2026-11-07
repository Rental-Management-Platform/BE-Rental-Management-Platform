/**
 * Hồ sơ công khai của một chủ trọ (spec 0005 AC-1, thêm hai trường đánh giá ở spec 0014 AC-1): đúng chín trường,
 * không email, không số điện thoại, không danh sách hay danh tính người theo dõi hay người đánh giá. Cả ba API
 * (`GET`, `POST`, `DELETE`) cùng trả hình dạng này.
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
	/**
	 * Số đánh giá hiện công khai: đánh giá `visible` mà người viết là tài khoản đang hoạt động. Luôn bằng `total` của
	 * `GET /landlords/:id/reviews` (spec 0014 AC-1).
	 */
	readonly reviewCount: number;
	/** Số sao trung bình của đúng các đánh giá trên, làm tròn một chữ số thập phân; `null` khi `reviewCount` là 0. */
	readonly ratingAverage: number | null;
	/** `null` với khách; `true` hoặc `false` với người đã đăng nhập. */
	readonly isFollowing: boolean | null;
}
