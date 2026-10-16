import {
	extractListingCode,
	generateListingCode,
	LISTING_CODE_LENGTH,
} from './listing-code';

describe('generateListingCode', () => {
	it('luôn dài 8 ký tự, chỉ gồm chữ thường và số dễ đọc', () => {
		for (let i = 0; i < 500; i += 1) {
			const code = generateListingCode();
			expect(code).toHaveLength(LISTING_CODE_LENGTH);
			expect(code).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]{8}$/);
		}
	});

	it('không sinh chữ dễ nhầm i, l, o và số 0, 1', () => {
		const joined = Array.from({ length: 2000 }, generateListingCode).join(
			'',
		);
		expect(joined).not.toMatch(/[ilo01]/);
	});

	it('hai lần sinh gần như không bao giờ trùng', () => {
		const codes = new Set(
			Array.from({ length: 2000 }, generateListingCode),
		);
		expect(codes.size).toBe(2000);
	});
});

describe('extractListingCode (spec 0002 AC-11)', () => {
	it.each([
		['phong-dep-gan-cho-abcd2345', 'abcd2345'],
		['abcd2345', 'abcd2345'],
		['tin-abcd2345', 'abcd2345'],
		['phong-tro-quan-1-q-9k8m7n6p', '9k8m7n6p'],
		['sai-slug-nhung-dung-ma-abcd2345', 'abcd2345'],
	])('lấy mã từ %s', (slugCode, expected) => {
		expect(extractListingCode(slugCode)).toBe(expected);
	});

	it.each([
		'',
		'-',
		'phong-dep-abc',
		'phong-dep-abcd23456',
		'phong-dep-ABCD2345',
		'phong-dep-abcd234!',
		'abcd-2345',
		'phong-dep-',
		'abcd2345-',
	])('không lấy được mã từ "%s" thì trả null', (slugCode) => {
		expect(extractListingCode(slugCode)).toBeNull();
	});
});
