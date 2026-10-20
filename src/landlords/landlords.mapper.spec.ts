import { toLandlordProfile } from './landlords.mapper';
import type { LandlordRow } from './landlords.repository';

const JOINED = new Date('2026-10-05T03:00:00.000Z');
const COUNTS = {
	followerCount: 12,
	totalViewCount: 1840,
	publicListingCount: 2,
};

function landlord(name: string | null): LandlordRow {
	return {
		id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01',
		name,
		createdAt: JOINED,
	};
}

describe('toLandlordProfile (spec 0005 AC-1)', () => {
	it('có đúng bảy trường, đúng giá trị', () => {
		expect(toLandlordProfile(landlord('Anh Nam'), COUNTS, false)).toEqual({
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01',
			name: 'Anh Nam',
			joinedAt: JOINED,
			followerCount: 12,
			totalViewCount: 1840,
			publicListingCount: 2,
			isFollowing: false,
		});
	});

	it('không lộ cột nào khác của users: dù dòng đầu vào mang email, số điện thoại hay mật khẩu', () => {
		const row = {
			...landlord('Anh Nam'),
			email: 'nam@example.com',
			phone: '0901234567',
			passwordHash: 'x',
		} as LandlordRow;
		expect(
			Object.keys(toLandlordProfile(row, COUNTS, null)).sort(),
		).toEqual([
			'followerCount',
			'id',
			'isFollowing',
			'joinedAt',
			'name',
			'publicListingCount',
			'totalViewCount',
		]);
	});

	it.each([[null], [''], ['   '], ['\t\n']])(
		'tên trống (%j) thì name là null, không phải chuỗi rỗng',
		(name) => {
			expect(
				toLandlordProfile(landlord(name), COUNTS, null).name,
			).toBeNull();
		},
	);

	it('tên có chữ thì giữ nguyên như đã lưu', () => {
		expect(
			toLandlordProfile(landlord(' Chị  Hoa '), COUNTS, null).name,
		).toBe(' Chị  Hoa ');
	});

	it.each([[null], [true], [false]])(
		'isFollowing đi qua nguyên vẹn: khách là null, người xem là true hoặc false (%j)',
		(isFollowing) => {
			expect(
				toLandlordProfile(landlord('A'), COUNTS, isFollowing)
					.isFollowing,
			).toBe(isFollowing);
		},
	);
});
