import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadAmenitySeed, loadWardSeed } from './seed-data';

/**
 * Dữ liệu địa chỉ theo đơn vị hành chính hai cấp sau sáp nhập (xem prisma/seed-data/README.md): tỉnh hoặc
 * thành phố rồi phường, xã, đặc khu; không còn quận huyện. TP. Hồ Chí Minh mới (mã 79, đã gồm Bình Dương và
 * Bà Rịa Vũng Tàu cũ) có đúng 168 đơn vị cấp xã. Test này chặn việc lỡ trộn dữ liệu trước sáp nhập.
 */
describe('seed-data: phường, xã, đặc khu của TP. Hồ Chí Minh sau sáp nhập', () => {
	const wards = loadWardSeed();

	it('có đúng 168 dòng, mã duy nhất', () => {
		expect(wards).toHaveLength(168);
		expect(new Set(wards.map((ward) => ward.code)).size).toBe(168);
	});

	it('mã gồm đúng 5 chữ số và đã sắp theo mã', () => {
		for (const ward of wards) expect(ward.code).toMatch(/^[0-9]{5}$/);
		const codes = wards.map((ward) => ward.code);
		expect([...codes].sort()).toEqual(codes);
	});

	it('mọi dòng thuộc tỉnh mã 79, Thành phố Hồ Chí Minh', () => {
		for (const ward of wards) {
			expect(ward.provinceCode).toBe('79');
			expect(ward.provinceName).toBe('Thành phố Hồ Chí Minh');
		}
	});

	it('cơ cấu 113 phường, 54 xã, 1 đặc khu', () => {
		const count = (prefix: string): number =>
			wards.filter((ward) => ward.name.startsWith(`${prefix} `)).length;
		expect(count('Phường')).toBe(113);
		expect(count('Xã')).toBe(54);
		expect(count('Đặc khu')).toBe(1);
	});

	it('tên đầy đủ kèm loại đơn vị, không còn cấp quận huyện, duy nhất và ở dạng NFC', () => {
		for (const ward of wards) {
			expect(ward.name).toMatch(/^(Phường|Xã|Đặc khu) \S/u);
			expect(ward.name).not.toMatch(/quận|huyện/iu);
			expect(ward.name).toBe(ward.name.normalize('NFC'));
		}
		expect(new Set(wards.map((ward) => ward.name)).size).toBe(168);
	});

	it('có các đơn vị của hai tỉnh cũ đã sáp nhập vào TP. Hồ Chí Minh mới', () => {
		const names = wards.map((ward) => ward.name);
		expect(names).toContain('Phường Thủ Dầu Một'); // Bình Dương cũ
		expect(names).toContain('Phường Vũng Tàu'); // Bà Rịa Vũng Tàu cũ
		expect(names).toContain('Phường Bến Thành'); // TP.HCM cũ
		expect(wards.find((ward) => ward.code === '26732')?.name).toBe(
			'Đặc khu Côn Đảo',
		);
	});
});

describe('seed-data: tiện ích mẫu', () => {
	it('có 13 tiện ích đúng khóa của spec 0002, khóa duy nhất', () => {
		const amenities = loadAmenitySeed();
		expect(amenities.map((amenity) => amenity.key).sort()).toEqual(
			[
				'wifi',
				'air_conditioner',
				'water_heater',
				'private_bathroom',
				'kitchen',
				'loft',
				'washing_machine',
				'parking',
				'elevator',
				'security_camera',
				'free_hours',
				'furnished',
				'balcony',
			].sort(),
		);
		for (const amenity of amenities) {
			expect(amenity.key).toMatch(/^[a-z][a-z0-9_]{1,29}$/);
			expect(amenity.name.trim().length).toBeGreaterThan(0);
		}
	});
});

describe('seed-data: bộ nạp từ chối dữ liệu hỏng', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'seed-data-'));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	const write = (file: string, content: unknown): void => {
		writeFileSync(join(dir, file), JSON.stringify(content));
	};
	const ward = {
		code: '26734',
		name: 'Phường Sài Gòn',
		provinceCode: '79',
		provinceName: 'Thành phố Hồ Chí Minh',
	};

	it('không phải mảng', () => {
		write('wards.json', { wards: [] });
		expect(() => loadWardSeed(dir)).toThrow('phải là một mảng');
	});

	it('mã phường không đủ 5 chữ số (dấu hiệu dữ liệu cũ trước sáp nhập hoặc nhập sai)', () => {
		write('wards.json', [{ ...ward, code: '760' }]);
		expect(() => loadWardSeed(dir)).toThrow('5 chữ số');
	});

	it('mã phường trùng', () => {
		write('wards.json', [ward, ward]);
		expect(() => loadWardSeed(dir)).toThrow('bị trùng');
	});

	it('thiếu tên phường', () => {
		write('wards.json', [{ ...ward, name: '  ' }]);
		expect(() => loadWardSeed(dir)).toThrow('"name"');
	});

	it('khóa tiện ích sai dạng', () => {
		write('amenities.json', [{ key: 'Wifi Free', name: 'Wifi' }]);
		expect(() => loadAmenitySeed(dir)).toThrow('sai dạng');
	});

	it('nhận dữ liệu hợp lệ', () => {
		write('wards.json', [ward]);
		expect(loadWardSeed(dir)).toEqual([ward]);
	});
});
