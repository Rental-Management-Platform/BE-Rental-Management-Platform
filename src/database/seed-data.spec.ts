import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	CITY_BOXES,
	COORDINATE_MARGIN_DEGREES,
} from '../properties/coordinate-area';
import { loadAmenitySeed, loadWardBoundsSeed, loadWardSeed } from './seed-data';

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

/**
 * Hộp bao của 168 phường (spec 0012 AC-6), dựng từ ranh giới của `thanglequoc/vietnamese-provinces-database` tag
 * `v5.2.0` bằng `src/database/scripts/build-ward-bounds.ts` (xem prisma/seed-data/README.md). Test này canh để
 * file luôn khớp `wards.json` và vừa hai khung thành phố, nên đổi một trong hai mà quên dựng lại sẽ báo ngay.
 */
describe('seed-data: hộp bao phường (ward-bounds.json)', () => {
	const wards = loadWardSeed();
	const bounds = loadWardBoundsSeed();

	it('có đúng 168 dòng, mã trùng từng mã trong wards.json, không thiếu không thừa', () => {
		expect(bounds).toHaveLength(168);
		expect(bounds.map((item) => item.code).sort()).toEqual(
			wards.map((ward) => ward.code).sort(),
		);
	});

	it('đã sắp theo mã', () => {
		const codes = bounds.map((item) => item.code);
		expect([...codes].sort()).toEqual(codes);
	});

	it('min không lớn hơn max và trong miền ±90, ±180 (vừa CHECK wards_bounds_check)', () => {
		for (const item of bounds) {
			expect(item.minLatitude).toBeLessThanOrEqual(item.maxLatitude);
			expect(item.minLongitude).toBeLessThanOrEqual(item.maxLongitude);
			expect(Math.abs(item.minLatitude)).toBeLessThanOrEqual(90);
			expect(Math.abs(item.maxLatitude)).toBeLessThanOrEqual(90);
			expect(Math.abs(item.minLongitude)).toBeLessThanOrEqual(180);
			expect(Math.abs(item.maxLongitude)).toBeLessThanOrEqual(180);
		}
	});

	it('mọi số làm tròn đến không quá 5 chữ số thập phân', () => {
		for (const item of bounds) {
			for (const value of [
				item.minLatitude,
				item.maxLatitude,
				item.minLongitude,
				item.maxLongitude,
			]) {
				expect(
					Math.abs(value * 1e5 - Math.round(value * 1e5)),
				).toBeLessThan(1e-6);
			}
		}
	});

	it('mỗi hộp nới 0.0045 độ nằm trọn trong một trong hai khung thành phố, nên điểm trong hộp thô luôn qua lớp 1', () => {
		for (const item of bounds) {
			const widened = {
				minLatitude: item.minLatitude - COORDINATE_MARGIN_DEGREES,
				maxLatitude: item.maxLatitude + COORDINATE_MARGIN_DEGREES,
				minLongitude: item.minLongitude - COORDINATE_MARGIN_DEGREES,
				maxLongitude: item.maxLongitude + COORDINATE_MARGIN_DEGREES,
			};
			const fits = CITY_BOXES.some(
				(box) =>
					widened.minLatitude >= box.minLatitude &&
					widened.maxLatitude <= box.maxLatitude &&
					widened.minLongitude >= box.minLongitude &&
					widened.maxLongitude <= box.maxLongitude,
			);
			expect({ code: item.code, fits }).toEqual({
				code: item.code,
				fits: true,
			});
		}
	});

	it('Côn Đảo (26732) nằm trong khung Côn Đảo, 167 đơn vị còn lại nằm trong khung đất liền', () => {
		const [mainland, island] = CITY_BOXES;
		for (const item of bounds) {
			const box = item.code === '26732' ? island : mainland;
			expect(item.minLatitude).toBeGreaterThanOrEqual(
				box?.minLatitude ?? 0,
			);
			expect(item.maxLatitude).toBeLessThanOrEqual(box?.maxLatitude ?? 0);
			expect(item.minLongitude).toBeGreaterThanOrEqual(
				box?.minLongitude ?? 0,
			);
			expect(item.maxLongitude).toBeLessThanOrEqual(
				box?.maxLongitude ?? 0,
			);
		}
	});

	it('phường nhỏ nhất (Bình Tây, 27367) và lớn nhất trên đất liền (An Thới Đông, 27673) có cỡ đúng như đã đo', () => {
		const sizeOf = (code: string) => {
			const item = bounds.find((candidate) => candidate.code === code);
			if (item === undefined) throw new Error(`thiếu ${code}`);
			return {
				height: (item.maxLatitude - item.minLatitude) * 111.3,
				width: (item.maxLongitude - item.minLongitude) * 109,
			};
		};
		expect(sizeOf('27367').height).toBeCloseTo(0.92, 1);
		expect(sizeOf('27367').width).toBeCloseTo(1.86, 1);
		expect(sizeOf('27673').height).toBeGreaterThan(20);
	});
});

describe('seed-data: bộ nạp hộp phường từ chối dữ liệu hỏng', () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), 'seed-bounds-'));
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	const write = (content: unknown): void => {
		writeFileSync(join(dir, 'ward-bounds.json'), JSON.stringify(content));
	};
	const row = {
		code: '26743',
		minLatitude: 10.76341,
		maxLatitude: 10.77959,
		minLongitude: 106.68449,
		maxLongitude: 106.70266,
	};

	it('không phải mảng', () => {
		write({ bounds: [] });
		expect(() => loadWardBoundsSeed(dir)).toThrow('phải là một mảng');
	});

	it('mã phường không đủ 5 chữ số', () => {
		write([{ ...row, code: '760' }]);
		expect(() => loadWardBoundsSeed(dir)).toThrow('5 chữ số');
	});

	it('mã phường trùng', () => {
		write([row, row]);
		expect(() => loadWardBoundsSeed(dir)).toThrow('bị trùng');
	});

	it('thiếu một số hoặc không phải số', () => {
		write([
			Object.fromEntries(
				Object.entries(row).filter(([key]) => key !== 'maxLongitude'),
			),
		]);
		expect(() => loadWardBoundsSeed(dir)).toThrow('"maxLongitude"');
		write([{ ...row, minLatitude: '10.7' }]);
		expect(() => loadWardBoundsSeed(dir)).toThrow('"minLatitude"');
	});

	it('min lớn hơn max (vi phạm CHECK)', () => {
		write([{ ...row, minLatitude: 11, maxLatitude: 10 }]);
		expect(() => loadWardBoundsSeed(dir)).toThrow('min lớn hơn max');
		write([{ ...row, minLongitude: 107, maxLongitude: 106 }]);
		expect(() => loadWardBoundsSeed(dir)).toThrow('min lớn hơn max');
	});

	it('ngoài miền ±90 và ±180 (vi phạm CHECK)', () => {
		write([{ ...row, maxLatitude: 91 }]);
		expect(() => loadWardBoundsSeed(dir)).toThrow('"maxLatitude"');
		write([{ ...row, maxLongitude: 181 }]);
		expect(() => loadWardBoundsSeed(dir)).toThrow('"maxLongitude"');
	});

	it('nhận dữ liệu hợp lệ', () => {
		write([row]);
		expect(loadWardBoundsSeed(dir)).toEqual([row]);
	});
});
