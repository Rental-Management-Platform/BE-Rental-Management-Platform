import type { ReviewStatus } from '../review-status';

/**
 * Phần tử danh sách công khai `GET /landlords/:id/reviews` (spec 0014 AC-2). Không email, số điện thoại, id người
 * viết hay trạng thái: chỉ có tên người viết (có thể `null`) và cờ `isMine` để FE hiện nút sửa.
 */
export interface PublicReviewResponse {
	readonly id: string;
	readonly stars: number;
	/** `null` khi không có nhận xét. */
	readonly comment: string | null;
	readonly author: { readonly name: string | null };
	/** `null` với khách; `true` hoặc `false` với người đã đăng nhập. */
	readonly isMine: boolean | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/**
 * Đánh giá của chính người gọi (spec 0014 AC-8): `review` của `GET /landlords/:id/review`, và kết quả của `POST` và
 * `PATCH`. Có `status` và `hiddenReason` để người viết biết khi admin đã ẩn.
 */
export interface MyReviewResponse {
	readonly id: string;
	readonly stars: number;
	readonly comment: string | null;
	readonly status: ReviewStatus;
	/** Lý do admin ẩn gần nhất khi đang `hidden_by_admin`; còn lại `null`. */
	readonly hiddenReason: string | null;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/** `GET /landlords/:id/review` (spec 0014 AC-8). */
export interface MyReviewStateResponse {
	readonly review: MyReviewResponse | null;
	/** `true` đúng khi chưa có đánh giá, người gọi giữ `review:create`, không phải chính chủ trọ và đã đủ điều kiện. */
	readonly canReview: boolean;
}

/** Phần tử của admin (spec 0014 AC-11, AC-12): mọi trạng thái, kèm id và tên hai bên; không email hay số điện thoại. */
export interface ModerationReviewResponse {
	readonly id: string;
	readonly status: ReviewStatus;
	readonly stars: number;
	readonly comment: string | null;
	readonly hiddenReason: string | null;
	readonly author: { readonly id: string; readonly name: string | null };
	readonly landlord: { readonly id: string; readonly name: string | null };
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
