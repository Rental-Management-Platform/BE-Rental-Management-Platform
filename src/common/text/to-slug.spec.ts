import { toSlug } from './to-slug';

describe('toSlug', () => {
	it('bỏ dấu, chữ thường, nối bằng gạch ngang', () => {
		expect(toSlug('Phòng trọ đẹp gần ĐH Bách Khoa')).toBe(
			'phong-tro-dep-gan-dh-bach-khoa',
		);
	});

	it('ký tự lạ và nhiều ký tự liền nhau thành một gạch ngang, bỏ gạch ở hai đầu', () => {
		expect(toSlug('  ***Phòng!!! 25m² / tầng 3***  ')).toBe(
			'phong-25m-tang-3',
		);
	});

	it('cắt tối đa 60 ký tự và không để gạch ngang ở cuối', () => {
		const slug = toSlug('a'.repeat(59) + ' ' + 'b'.repeat(30));
		expect(slug.length).toBeLessThanOrEqual(60);
		expect(slug.endsWith('-')).toBe(false);
		expect(slug.startsWith('a'.repeat(59))).toBe(true);
	});

	it.each(['', '   ', '!!!', '???...', '----'])(
		'tiêu đề %j không có chữ hay số nào thì dùng "tin"',
		(title) => {
			expect(toSlug(title)).toBe('tin');
		},
	);

	it('chỉ gồm chữ thường, số và gạch ngang', () => {
		expect(toSlug('Căn hộ 1PN – Đặc khu Côn Đảo, giá 5.500.000đ')).toMatch(
			/^[a-z0-9-]+$/,
		);
	});
});
