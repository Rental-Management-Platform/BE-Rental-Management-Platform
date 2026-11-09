import { orNull } from '../reviews/reviews.mapper';
import { parseReviewStatus } from '../reviews/review-status';
import type { ModerationListingReviewResponse } from './dto/listing-review.response';
import type { ModerationListingReviewRow } from './listing-reviews.repository';

/**
 * Phần tử của admin (spec 0015 AC-11, AC-12): id và tên người viết, `{ id, code, title }` của tin, không email hay số
 * điện thoại. `hiddenReason` chỉ có khi đang `hidden_by_admin` (và có dòng log); còn lại luôn `null`, kể cả khi lý do
 * truyền vào là chữ của một lần ẩn cũ. Tên người viết đi qua cùng ánh xạ tên (`orNull`) với đánh giá chủ trọ.
 */
export function toModerationListingReview(
	row: ModerationListingReviewRow,
	hiddenReason: string | null,
): ModerationListingReviewResponse {
	const status = parseReviewStatus(row.status);
	return {
		id: row.id,
		status,
		stars: row.stars,
		comment: row.comment,
		hiddenReason: status === 'hidden_by_admin' ? hiddenReason : null,
		author: { id: row.author.id, name: orNull(row.author.name) },
		listing: {
			id: row.listing.id,
			code: row.listing.code,
			title: row.listing.title,
		},
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
