import { loadWardBoundsSeed } from '../database/seed-data';
import {
	CITY_BOXES,
	COORDINATE_MARGIN_DEGREES,
	isInsideCity,
	isNearWard,
	toWardBounds,
} from './coordinate-area';
import type { GeoBox } from './coordinate-area';

/** Một chút nhỏ hơn mọi lề đo được, đủ để đứng sát ngoài biên mà không chạm biên. */
const JUST = 0.000001;

describe('CITY_BOXES (spec 0012 AC-1)', () => {
	it('đúng hai khung: đất liền và Côn Đảo, với con số của spec', () => {
		expect(CITY_BOXES).toEqual([
			{
				minLatitude: 10.2,
				maxLatitude: 11.7,
				minLongitude: 106.2,
				maxLongitude: 107.7,
			},
			{
				minLatitude: 8.4,
				maxLatitude: 8.9,
				minLongitude: 105.9,
				maxLongitude: 106.9,
			},
		]);
	});
});

describe('isInsideCity (spec 0012 AC-1)', () => {
	describe.each(CITY_BOXES.map((box, index) => [index, box] as const))(
		'khung %i',
		(_index, box) => {
			const midLat = (box.minLatitude + box.maxLatitude) / 2;
			const midLon = (box.minLongitude + box.maxLongitude) / 2;

			it('bốn góc là trong (đúng biên tính là trong)', () => {
				for (const latitude of [box.minLatitude, box.maxLatitude]) {
					for (const longitude of [
						box.minLongitude,
						box.maxLongitude,
					]) {
						expect(isInsideCity(latitude, longitude)).toBe(true);
					}
				}
			});

			it('bốn cạnh (điểm giữa mỗi cạnh) là trong', () => {
				expect(isInsideCity(box.minLatitude, midLon)).toBe(true);
				expect(isInsideCity(box.maxLatitude, midLon)).toBe(true);
				expect(isInsideCity(midLat, box.minLongitude)).toBe(true);
				expect(isInsideCity(midLat, box.maxLongitude)).toBe(true);
			});

			it('ngay sát ngoài mỗi cạnh là ngoài', () => {
				expect(isInsideCity(box.minLatitude - JUST, midLon)).toBe(
					false,
				);
				expect(isInsideCity(box.maxLatitude + JUST, midLon)).toBe(
					false,
				);
				expect(isInsideCity(midLat, box.minLongitude - JUST)).toBe(
					false,
				);
				expect(isInsideCity(midLat, box.maxLongitude + JUST)).toBe(
					false,
				);
			});
		},
	);

	it('điểm thật trong thành phố là trong: Vũng Tàu, Củ Chi, Bến Thành, Côn Đảo', () => {
		expect(isInsideCity(10.346, 107.0843)).toBe(true);
		expect(isInsideCity(10.9731, 106.4936)).toBe(true);
		expect(isInsideCity(10.7721, 106.698)).toBe(true);
		expect(isInsideCity(8.6934, 106.6086)).toBe(true);
	});

	it('điểm ngoài thành phố là ngoài: Hà Nội, (0, 0), giữa biển, ngoài khơi', () => {
		expect(isInsideCity(21.0285, 105.8542)).toBe(false);
		expect(isInsideCity(0, 0)).toBe(false);
		expect(isInsideCity(9.5, 106.5)).toBe(false);
		expect(isInsideCity(10.5, 108.5)).toBe(false);
	});

	it('vĩ độ của khung này ghép với kinh độ của khung kia vẫn là ngoài (không phải hình bao chung)', () => {
		expect(isInsideCity(8.6, 107.2)).toBe(false);
		expect(isInsideCity(10.5, 106.0)).toBe(false);
	});

	it('số không hữu hạn là ngoài, không ném lỗi', () => {
		expect(isInsideCity(Number.NaN, 106.7)).toBe(false);
		expect(isInsideCity(10.7, Number.NaN)).toBe(false);
		expect(isInsideCity(Number.POSITIVE_INFINITY, 106.7)).toBe(false);
	});
});

describe('COORDINATE_MARGIN_DEGREES (spec 0012 AC-2)', () => {
	it('là 0.0045 độ, khoảng 500 m', () => {
		expect(COORDINATE_MARGIN_DEGREES).toBe(0.0045);
	});
});

describe('toWardBounds (spec 0012 AC-2)', () => {
	it('đủ bốn cột thì trả hộp thô, chưa nới', () => {
		expect(
			toWardBounds({
				minLatitude: 10.1,
				maxLatitude: 10.2,
				minLongitude: 106.1,
				maxLongitude: 106.2,
			}),
		).toEqual({
			minLatitude: 10.1,
			maxLatitude: 10.2,
			minLongitude: 106.1,
			maxLongitude: 106.2,
		});
	});

	it('cả bốn cột rỗng thì null: phường không có hộp', () => {
		expect(
			toWardBounds({
				minLatitude: null,
				maxLatitude: null,
				minLongitude: null,
				maxLongitude: null,
			}),
		).toBeNull();
	});

	it.each(['minLatitude', 'maxLatitude', 'minLongitude', 'maxLongitude'])(
		'chỉ rỗng cột %s cũng coi là không có hộp',
		(missing) => {
			const full = {
				minLatitude: 10.1,
				maxLatitude: 10.2,
				minLongitude: 106.1,
				maxLongitude: 106.2,
			};
			expect(toWardBounds({ ...full, [missing]: null })).toBeNull();
		},
	);

	it('hộp có giá trị 0 vẫn là hộp, không bị nhầm với rỗng', () => {
		expect(
			toWardBounds({
				minLatitude: 0,
				maxLatitude: 0,
				minLongitude: 0,
				maxLongitude: 0,
			}),
		).not.toBeNull();
	});
});

describe('isNearWard (spec 0012 AC-2)', () => {
	const box: GeoBox = {
		minLatitude: 10.76341,
		maxLatitude: 10.77959,
		minLongitude: 106.68449,
		maxLongitude: 106.70266,
	};
	const midLat = (box.minLatitude + box.maxLatitude) / 2;
	const midLon = (box.minLongitude + box.maxLongitude) / 2;
	// Biên nới tính bằng đúng biểu thức trong code, nên so bằng nhau không dính sai số dấu phẩy động.
	const edge = {
		minLatitude: box.minLatitude - COORDINATE_MARGIN_DEGREES,
		maxLatitude: box.maxLatitude + COORDINATE_MARGIN_DEGREES,
		minLongitude: box.minLongitude - COORDINATE_MARGIN_DEGREES,
		maxLongitude: box.maxLongitude + COORDINATE_MARGIN_DEGREES,
	};

	it('điểm giữa hộp là gần', () => {
		expect(isNearWard(midLat, midLon, box)).toBe(true);
	});

	it('điểm trong hộp thô nhưng sát cạnh là gần', () => {
		expect(isNearWard(box.minLatitude, box.minLongitude, box)).toBe(true);
		expect(isNearWard(box.maxLatitude, box.maxLongitude, box)).toBe(true);
	});

	it('đúng biên hộp đã nới ở cả bốn cạnh là gần (đúng biên tính là trong)', () => {
		expect(isNearWard(edge.minLatitude, midLon, box)).toBe(true);
		expect(isNearWard(edge.maxLatitude, midLon, box)).toBe(true);
		expect(isNearWard(midLat, edge.minLongitude, box)).toBe(true);
		expect(isNearWard(midLat, edge.maxLongitude, box)).toBe(true);
	});

	it('đúng biên hộp đã nới ở bốn góc là gần', () => {
		for (const latitude of [edge.minLatitude, edge.maxLatitude]) {
			for (const longitude of [edge.minLongitude, edge.maxLongitude]) {
				expect(isNearWard(latitude, longitude, box)).toBe(true);
			}
		}
	});

	it('lệch thêm một phần triệu độ ra ngoài mỗi cạnh là xa', () => {
		expect(isNearWard(edge.minLatitude - JUST, midLon, box)).toBe(false);
		expect(isNearWard(edge.maxLatitude + JUST, midLon, box)).toBe(false);
		expect(isNearWard(midLat, edge.minLongitude - JUST, box)).toBe(false);
		expect(isNearWard(midLat, edge.maxLongitude + JUST, box)).toBe(false);
	});

	it('nới cả hai trục: vĩ độ trong hộp nới nhưng kinh độ ngoài thì vẫn xa', () => {
		expect(isNearWard(midLat, edge.maxLongitude + JUST, box)).toBe(false);
		expect(isNearWard(edge.maxLatitude + JUST, midLon, box)).toBe(false);
	});

	it('số không hữu hạn là xa, không ném lỗi', () => {
		expect(isNearWard(Number.NaN, midLon, box)).toBe(false);
		expect(isNearWard(midLat, Number.NaN, box)).toBe(false);
	});

	describe('ba cỡ phường thật: nhỏ nhất, lớn nhất trên đất liền, và đặc khu Côn Đảo (ward-bounds.json)', () => {
		const bounds = loadWardBoundsSeed();
		const boxOf = (code: string): GeoBox => {
			const found = bounds.find((item) => item.code === code);
			if (found === undefined) throw new Error(`thiếu hộp của ${code}`);
			return found;
		};

		it.each([
			['Phường Bình Tây (nhỏ nhất)', '27367'],
			['Xã An Thới Đông (lớn nhất trên đất liền)', '27673'],
			['Đặc khu Côn Đảo', '26732'],
		])('%s: giữa hộp gần, ngoài mép nới xa', (_name, code) => {
			const ward = boxOf(code);
			const lat = (ward.minLatitude + ward.maxLatitude) / 2;
			const lon = (ward.minLongitude + ward.maxLongitude) / 2;
			expect(isNearWard(lat, lon, ward)).toBe(true);
			expect(
				isNearWard(
					ward.maxLatitude + COORDINATE_MARGIN_DEGREES + JUST,
					lon,
					ward,
				),
			).toBe(false);
			expect(
				isNearWard(
					lat,
					ward.minLongitude - COORDINATE_MARGIN_DEGREES - JUST,
					ward,
				),
			).toBe(false);
		});

		it('điểm ở phường khác, cách xa phường đã chọn: Bến Thành so với Bình Tây', () => {
			// Điểm giữa Bến Thành (26743) nằm ngoài hộp nới của Bình Tây (27367): hai phường cách nhau vài km.
			const benThanh = boxOf('26743');
			const lat = (benThanh.minLatitude + benThanh.maxLatitude) / 2;
			const lon = (benThanh.minLongitude + benThanh.maxLongitude) / 2;
			expect(isNearWard(lat, lon, boxOf('27367'))).toBe(false);
			expect(isNearWard(lat, lon, benThanh)).toBe(true);
		});
	});
});
