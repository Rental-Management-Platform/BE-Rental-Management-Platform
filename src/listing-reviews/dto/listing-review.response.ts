import type { ReviewStatus } from '../../reviews/review-status';

/**
 * Phần tử của admin cho đánh giá phòng (spec 0015 AC-11, AC-12): `GET /moderation/listing-reviews` và kết quả của
 * `hide`, `unhide`. Mọi trạng thái, kèm id và tên người viết và `{ id, code, title }` của tin; không email hay số điện
 * thoại. Hình dạng phía công khai và phía người viết dùng lại kiểu của `src/reviews/dto/review.response.ts`.
 */
export interface ModerationListingReviewResponse {
	readonly id: string;
	readonly status: ReviewStatus;
	readonly stars: number;
	readonly comment: string | null;
	/** Lý do admin ẩn gần nhất khi đang `hidden_by_admin`; còn lại `null`. */
	readonly hiddenReason: string | null;
	readonly author: { readonly id: string; readonly name: string | null };
	readonly listing: {
		readonly id: string;
		readonly code: string;
		readonly title: string;
	};
	readonly createdAt: Date;
	readonly updatedAt: Date;
}
