import { toSearchKey } from './to-search-key';

describe('toSearchKey', () => {
	it('bỏ dấu tiếng Việt và đổi chữ thường', () => {
		expect(toSearchKey('Phòng trọ Gần Đại học Bách Khoa')).toBe(
			'phong tro gan dai hoc bach khoa',
		);
	});

	it('đổi đ và Đ thành d', () => {
		expect(toSearchKey('Đường Đinh Tiên Hoàng')).toBe(
			'duong dinh tien hoang',
		);
	});

	it('địa chỉ mới sau sáp nhập: tìm "tan dinh" ra Phường Tân Định', () => {
		expect(toSearchKey('Phường Tân Định')).toContain('tan dinh');
		expect(toSearchKey('Đặc khu Côn Đảo')).toBe('dac khu con dao');
		expect(toSearchKey('Phường Thủ Dầu Một')).toBe('phuong thu dau mot');
	});

	it('hai cách đặt dấu thanh Hoà và Hòa ra cùng một khóa', () => {
		expect(toSearchKey('Phường Hoà Lợi')).toBe(
			toSearchKey('Phường Hòa Lợi'),
		);
		expect(toSearchKey('Xã Phú Hoà Đông')).toBe('xa phu hoa dong');
	});

	it('dạng NFD và NFC của cùng một chữ ra cùng một khóa', () => {
		const composed = 'Phường Bến Thành'.normalize('NFC');
		const decomposed = 'Phường Bến Thành'.normalize('NFD');
		expect(toSearchKey(decomposed)).toBe(toSearchKey(composed));
	});

	it('gộp nhiều phần, bỏ phần rỗng hoặc null, gộp khoảng trắng', () => {
		expect(
			toSearchKey(
				'  Phòng   A1 ',
				null,
				undefined,
				'12 Lê Lợi',
				'',
				'Phường Bến Thành',
			),
		).toBe('phong a1 12 le loi phuong ben thanh');
	});

	it('không có phần nào thì ra chuỗi rỗng', () => {
		expect(toSearchKey()).toBe('');
		expect(toSearchKey(null, undefined, '   ')).toBe('');
	});

	it('giữ nguyên ký tự % và _ (việc thoát nằm ở lúc tìm, không ở khóa)', () => {
		expect(toSearchKey('Giảm 50% _ gấp')).toBe('giam 50% _ gap');
	});
});
