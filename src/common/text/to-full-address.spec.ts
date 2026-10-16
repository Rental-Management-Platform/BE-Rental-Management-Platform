import { toFullAddress } from './to-full-address';

const benThanh = {
	name: 'Phường Bến Thành',
	provinceName: 'Thành phố Hồ Chí Minh',
};

describe('toFullAddress', () => {
	it('ghép số nhà và đường, phường hoặc xã, tỉnh hoặc thành phố theo đúng thứ tự', () => {
		expect(toFullAddress('12 Lê Lợi', benThanh)).toBe(
			'12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		);
	});

	it('đổi tên phường thì địa chỉ đổi theo, vì ghép lúc đọc', () => {
		expect(
			toFullAddress('12 Lê Lợi', { ...benThanh, name: 'Phường Sài Gòn' }),
		).toBe('12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh');
	});

	it('không thêm quận huyện ở bất cứ đâu', () => {
		expect(toFullAddress('5 Nguyễn Huệ', benThanh)).not.toMatch(
			/quận|huyện/i,
		);
	});

	it('xã và đặc khu cũng ghép giống phường', () => {
		expect(
			toFullAddress('Ấp 1', {
				name: 'Đặc khu Côn Đảo',
				provinceName: 'Thành phố Hồ Chí Minh',
			}),
		).toBe('Ấp 1, Đặc khu Côn Đảo, Thành phố Hồ Chí Minh');
	});
});
