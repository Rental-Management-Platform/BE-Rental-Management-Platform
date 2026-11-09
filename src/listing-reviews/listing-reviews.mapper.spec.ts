import { TENANT_ID } from '../reviews/reviews.fixtures';
import {
	LISTING_CODE,
	LISTING_ID,
	LISTING_TITLE,
	moderationListingReviewRow,
} from './listing-reviews.fixtures';
import { toModerationListingReview } from './listing-reviews.mapper';

describe('toModerationListingReview (spec 0015 AC-11)', () => {
	it('có id và tên người viết, tin { id, code, title }, đúng chín trường, không email hay số điện thoại', () => {
		const item = toModerationListingReview(
			moderationListingReviewRow(),
			null,
		);
		expect(Object.keys(item).sort()).toEqual([
			'author',
			'comment',
			'createdAt',
			'hiddenReason',
			'id',
			'listing',
			'stars',
			'status',
			'updatedAt',
		]);
		expect(item.author).toEqual({ id: TENANT_ID, name: 'Bạn Lan' });
		expect(item.listing).toEqual({
			id: LISTING_ID,
			code: LISTING_CODE,
			title: LISTING_TITLE,
		});
		expect(Object.keys(item.author).sort()).toEqual(['id', 'name']);
		expect(Object.keys(item.listing).sort()).toEqual([
			'code',
			'id',
			'title',
		]);
	});

	it('không có trường landlord (đó là hình dạng của đánh giá chủ trọ)', () => {
		const item = toModerationListingReview(
			moderationListingReviewRow(),
			null,
		);
		expect(item).not.toHaveProperty('landlord');
	});

	it('hiddenReason chỉ có khi đang bị ẩn', () => {
		expect(
			toModerationListingReview(
				moderationListingReviewRow({ status: 'hidden_by_admin' }),
				'Spam',
			).hiddenReason,
		).toBe('Spam');
		expect(
			toModerationListingReview(moderationListingReviewRow(), 'Spam')
				.hiddenReason,
		).toBeNull();
	});

	it('đang bị ẩn mà không có dòng log thì hiddenReason là null', () => {
		expect(
			toModerationListingReview(
				moderationListingReviewRow({ status: 'hidden_by_admin' }),
				null,
			).hiddenReason,
		).toBeNull();
	});

	it('tên người viết trống thì null (cùng ánh xạ tên với đánh giá chủ trọ)', () => {
		const item = toModerationListingReview(
			moderationListingReviewRow({
				author: { id: TENANT_ID, name: '  ' },
			}),
			null,
		);
		expect(item.author.name).toBeNull();
		expect(
			toModerationListingReview(
				moderationListingReviewRow({
					author: { id: TENANT_ID, name: null },
				}),
				null,
			).author.name,
		).toBeNull();
	});

	it('trạng thái lạ trong DB là lỗi hệ thống, không phải dữ liệu trả ra', () => {
		expect(() =>
			toModerationListingReview(
				moderationListingReviewRow({ status: 'deleted' }),
				null,
			),
		).toThrow('Trạng thái đánh giá không hợp lệ trong DB');
	});
});
