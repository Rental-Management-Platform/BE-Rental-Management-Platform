import type {
	ModerationReviewRow,
	OwnReviewRow,
	PublicReviewRow,
} from './reviews.repository';

/** Dữ liệu dựng sẵn chỉ dùng cho test của module đánh giá (như `chat.fixtures.ts`). */
export const LANDLORD_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
export const TENANT_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';
export const OTHER_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d04';
export const ADMIN_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';
export const REVIEW_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8e11';
export const CREATED = new Date('2026-11-07T03:10:00.000Z');
export const UPDATED = new Date('2026-11-07T04:20:00.000Z');

export function ownReviewRow(
	overrides: Partial<OwnReviewRow> = {},
): OwnReviewRow {
	return {
		id: REVIEW_ID,
		stars: 4,
		comment: 'Chủ trọ trả lời nhanh, phòng đúng như ảnh.',
		status: 'visible',
		createdAt: CREATED,
		updatedAt: UPDATED,
		...overrides,
	};
}

export function publicReviewRow(
	overrides: Partial<PublicReviewRow> = {},
): PublicReviewRow {
	return {
		id: REVIEW_ID,
		stars: 4,
		comment: 'Chủ trọ trả lời nhanh, phòng đúng như ảnh.',
		authorId: TENANT_ID,
		createdAt: CREATED,
		updatedAt: UPDATED,
		author: { name: 'Bạn Lan' },
		...overrides,
	};
}

export function moderationReviewRow(
	overrides: Partial<ModerationReviewRow> = {},
): ModerationReviewRow {
	return {
		id: REVIEW_ID,
		status: 'visible',
		stars: 1,
		comment: 'Nội dung bị báo vi phạm.',
		createdAt: CREATED,
		updatedAt: UPDATED,
		author: { id: TENANT_ID, name: 'Bạn Lan' },
		landlord: { id: LANDLORD_ID, name: 'Anh Minh' },
		...overrides,
	};
}
