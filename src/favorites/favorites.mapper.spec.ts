import { publicSummaryRow } from '../listings/listings.fixtures';
import { toListingSummary } from '../listings/listings.mapper';
import { toSavedListing } from './favorites.mapper';

const SAVED_AT = new Date('2026-10-20T03:00:00.000Z');

describe('toSavedListing (spec 0006 AC-4)', () => {
	it('là tin tóm tắt công khai y nguyên (cùng hàm ánh xạ với GET /listings) cộng favoritedAt và isFavorite true', () => {
		const row = publicSummaryRow();
		expect(toSavedListing({ row, favoritedAt: SAVED_AT })).toEqual({
			...toListingSummary(row),
			favoritedAt: SAVED_AT,
			isFavorite: true,
		});
	});

	it('có fullAddress, slug và chủ trọ chỉ với id và tên (không số điện thoại)', () => {
		const saved = toSavedListing({
			row: publicSummaryRow(),
			favoritedAt: SAVED_AT,
		});
		expect(saved.fullAddress).toBe(
			'12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		);
		expect(saved.slug).toBe('phong-dep-co-gac-gan-cho-ben-thanh');
		expect(Object.keys(saved.landlord).sort()).toEqual(['id', 'name']);
	});

	it('không mang trường của chủ trọ hay kiểm duyệt: không status, không viewCount, không moderationReason', () => {
		const keys = Object.keys(
			toSavedListing({ row: publicSummaryRow(), favoritedAt: SAVED_AT }),
		);
		for (const forbidden of ['status', 'viewCount', 'moderationReason']) {
			expect(keys).not.toContain(forbidden);
		}
	});
});
