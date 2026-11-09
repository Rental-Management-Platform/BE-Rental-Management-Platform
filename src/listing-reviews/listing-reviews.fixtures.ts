import {
	CREATED,
	REVIEW_ID,
	TENANT_ID,
	UPDATED,
} from '../reviews/reviews.fixtures';
import type { ModerationListingReviewRow } from './listing-reviews.repository';

/** Dữ liệu dựng sẵn chỉ dùng cho test kiểm duyệt đánh giá phòng (cùng khuôn `reviews.fixtures.ts`). */
export const LISTING_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d09';
export const LISTING_CODE = 'k7m2xq9a';
export const LISTING_TITLE = 'Phòng 20m² gần ĐH Bách Khoa';

export function moderationListingReviewRow(
	overrides: Partial<ModerationListingReviewRow> = {},
): ModerationListingReviewRow {
	return {
		id: REVIEW_ID,
		status: 'visible',
		stars: 1,
		comment: 'Nội dung bị báo vi phạm.',
		createdAt: CREATED,
		updatedAt: UPDATED,
		author: { id: TENANT_ID, name: 'Bạn Lan' },
		listing: { id: LISTING_ID, code: LISTING_CODE, title: LISTING_TITLE },
		...overrides,
	};
}
