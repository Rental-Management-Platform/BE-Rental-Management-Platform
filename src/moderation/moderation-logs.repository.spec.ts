import type { PrismaService } from '../database/prisma.service';
import { ModerationLogsRepository } from './moderation-logs.repository';

const REVIEW_A = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8e11';
const REVIEW_B = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8e12';

function build(rows: Array<{ targetId: string; reason: string }> = []) {
	const findMany = jest.fn(() => Promise.resolve(rows));
	const repository = new ModerationLogsRepository({
		moderationLog: { findMany },
	} as unknown as PrismaService);
	return { repository, findMany };
}

describe('ModerationLogsRepository.findLatestListingReviewHideReasons (spec 0015 AC-8, AC-11)', () => {
	it('lọc đúng loại đích listing_review và hành động hide_listing_review, không lẫn đánh giá chủ trọ', async () => {
		const { repository, findMany } = build();
		await repository.findLatestListingReviewHideReasons([REVIEW_A]);
		expect(findMany).toHaveBeenCalledWith({
			where: {
				targetType: 'listing_review',
				targetId: { in: [REVIEW_A] },
				action: 'hide_listing_review',
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			select: { targetId: true, reason: true },
		});
	});

	it('không có id nào thì không truy vấn và trả bản đồ rỗng', async () => {
		const { repository, findMany } = build();
		const reasons = await repository.findLatestListingReviewHideReasons([]);
		expect(reasons.size).toBe(0);
		expect(findMany).not.toHaveBeenCalled();
	});

	it('mỗi đánh giá giữ lý do của dòng mới nhất (dòng đầu tiên theo thứ tự giảm dần)', async () => {
		const { repository } = build([
			{ targetId: REVIEW_A, reason: 'Lý do mới' },
			{ targetId: REVIEW_B, reason: 'Của đánh giá khác' },
			{ targetId: REVIEW_A, reason: 'Lý do cũ' },
		]);
		const reasons = await repository.findLatestListingReviewHideReasons([
			REVIEW_A,
			REVIEW_B,
		]);
		expect(reasons.get(REVIEW_A)).toBe('Lý do mới');
		expect(reasons.get(REVIEW_B)).toBe('Của đánh giá khác');
	});

	it('hàm của đánh giá chủ trọ vẫn lọc loại đích review và hành động hide_review', async () => {
		const { repository, findMany } = build();
		await repository.findLatestReviewHideReasons([REVIEW_A]);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					targetType: 'review',
					targetId: { in: [REVIEW_A] },
					action: 'hide_review',
				},
			}),
		);
	});
});
