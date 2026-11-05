import {
	assembleWardBounds,
	boxOfCoordinates,
	roundBoxOutward,
	roundDown,
	roundUp,
	wardBoundsOfGeoJson,
} from './ward-bounds';

/** Một FeatureCollection đúng kiểu tệp của bộ dữ liệu: một Feature, một MultiPolygon. */
function featureCollection(
	code: string,
	coordinates: unknown,
	overrides: Record<string, unknown> = {},
): unknown {
	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				id: code,
				properties: { code, fullName: 'Phường thử' },
				geometry: { type: 'MultiPolygon', coordinates },
				...overrides,
			},
		],
	};
}

// [kinh độ, vĩ độ]: GeoJSON để kinh độ trước.
const SQUARE = [
	[
		[
			[106.629773, 10.939776],
			[106.689268, 10.939776],
			[106.689268, 10.996653],
			[106.629773, 10.996653],
			[106.629773, 10.939776],
		],
	],
];

describe('roundDown và roundUp: làm tròn ra ngoài đến 5 chữ số thập phân (spec 0012 AC-6)', () => {
	it('số có 6 chữ số thập phân: min xuống, max lên', () => {
		expect(roundDown(10.939776)).toBe(10.93977);
		expect(roundUp(10.996653)).toBe(10.99666);
	});

	it('số đã đúng 5 chữ số giữ nguyên, không bị đẩy thêm một bậc do sai số dấu phẩy động', () => {
		for (const value of [106.62977, 10.93977, 8.57705, 107.57193]) {
			expect(roundDown(value)).toBe(value);
			expect(roundUp(value)).toBe(value);
		}
	});

	it('hộp đã làm tròn không bao giờ co lại: min <= gốc, max >= gốc, với nhiều số ngẫu nhiên', () => {
		let seed = 12345;
		const next = () => {
			seed = (seed * 1103515245 + 12345) % 2147483648;
			return seed / 2147483648;
		};
		for (let i = 0; i < 2000; i += 1) {
			const value = 8 + next() * 100;
			expect(roundDown(value)).toBeLessThanOrEqual(value);
			expect(roundUp(value)).toBeGreaterThanOrEqual(value);
			expect(value - roundDown(value)).toBeLessThan(1.5e-5);
			expect(roundUp(value) - value).toBeLessThan(1.5e-5);
		}
	});

	it('số âm cũng làm tròn ra ngoài', () => {
		expect(roundDown(-10.000001)).toBeLessThanOrEqual(-10.000001);
		expect(roundUp(-10.000009)).toBeGreaterThanOrEqual(-10.000009);
	});
});

describe('boxOfCoordinates', () => {
	it('lấy cực trị của mọi đỉnh MultiPolygon, vĩ độ là số thứ hai', () => {
		expect(boxOfCoordinates(SQUARE, 'thử')).toEqual({
			minLatitude: 10.939776,
			maxLatitude: 10.996653,
			minLongitude: 106.629773,
			maxLongitude: 106.689268,
		});
	});

	it('hiểu cả Polygon (lồng ít hơn một cấp) và nhiều đa giác', () => {
		const polygon = SQUARE[0];
		expect(boxOfCoordinates(polygon, 'thử').maxLatitude).toBe(10.996653);
		const two = [
			...SQUARE,
			[
				[
					[106.8, 10.5],
					[106.9, 10.6],
				],
			],
		];
		const box = boxOfCoordinates(two, 'thử');
		expect(box.minLatitude).toBe(10.5);
		expect(box.maxLongitude).toBe(106.9);
	});

	it('bỏ qua cao độ ở phần tử thứ ba', () => {
		expect(boxOfCoordinates([[1, 2, 999]], 'thử')).toEqual({
			minLatitude: 2,
			maxLatitude: 2,
			minLongitude: 1,
			maxLongitude: 1,
		});
	});

	it('từ chối hình rỗng, đỉnh thiếu vĩ độ, và giá trị không phải số hữu hạn', () => {
		expect(() => boxOfCoordinates([], 'thử')).toThrow('không có đỉnh');
		expect(() => boxOfCoordinates([[106.1]], 'thử')).toThrow('thiếu vĩ độ');
		expect(() => boxOfCoordinates([[106.1, Number.NaN]], 'thử')).toThrow(
			'hữu hạn',
		);
		expect(() => boxOfCoordinates('x', 'thử')).toThrow('mảng lồng nhau');
	});
});

describe('wardBoundsOfGeoJson', () => {
	it('trả mã và hộp đã làm tròn ra ngoài', () => {
		expect(
			wardBoundsOfGeoJson(featureCollection('25747', SQUARE), 'a'),
		).toEqual({
			code: '25747',
			minLatitude: 10.93977,
			maxLatitude: 10.99666,
			minLongitude: 106.62977,
			maxLongitude: 106.68927,
		});
	});

	it('hộp đã làm tròn bao trọn hộp gốc', () => {
		const raw = boxOfCoordinates(SQUARE, 'a');
		const rounded = roundBoxOutward(raw);
		expect(rounded.minLatitude).toBeLessThanOrEqual(raw.minLatitude);
		expect(rounded.maxLatitude).toBeGreaterThanOrEqual(raw.maxLatitude);
		expect(rounded.minLongitude).toBeLessThanOrEqual(raw.minLongitude);
		expect(rounded.maxLongitude).toBeGreaterThanOrEqual(raw.maxLongitude);
	});

	it('từ chối tệp sai hình: không phải FeatureCollection, không đúng một feature', () => {
		expect(() => wardBoundsOfGeoJson([], 'a')).toThrow('FeatureCollection');
		expect(() =>
			wardBoundsOfGeoJson(
				{ type: 'FeatureCollection', features: [] },
				'a',
			),
		).toThrow('đúng 1 feature');
	});

	it('từ chối mã không đủ 5 chữ số, hoặc id khác mã', () => {
		expect(() =>
			wardBoundsOfGeoJson(featureCollection('760', SQUARE), 'a'),
		).toThrow('5 chữ số');
		expect(() =>
			wardBoundsOfGeoJson(
				featureCollection('25747', SQUARE, { id: '25750' }),
				'a',
			),
		).toThrow('khác properties.code');
	});

	it('từ chối feature thiếu geometry', () => {
		expect(() =>
			wardBoundsOfGeoJson(
				featureCollection('25747', SQUARE, { geometry: null }),
				'a',
			),
		).toThrow('thiếu geometry');
	});
});

describe('assembleWardBounds: ghép các tệp, từ chối khi mã không khớp wards.json', () => {
	const part = (code: string) => ({
		code,
		minLatitude: 10,
		maxLatitude: 11,
		minLongitude: 106,
		maxLongitude: 107,
	});

	it('xếp theo mã', () => {
		const result = assembleWardBounds(
			[part('3'), part('1'), part('2')],
			['1', '2', '3'],
		);
		expect(result.map((item) => item.code)).toEqual(['1', '2', '3']);
	});

	it('thiếu một mã thì từ chối', () => {
		expect(() =>
			assembleWardBounds([part('1'), part('2')], ['1', '2', '3']),
		).toThrow('thiếu 1');
	});

	it('thừa một mã thì từ chối', () => {
		expect(() =>
			assembleWardBounds([part('1'), part('2'), part('9')], ['1', '2']),
		).toThrow('thừa 1');
	});

	it('mã trùng giữa các tệp thì từ chối', () => {
		expect(() => assembleWardBounds([part('1'), part('1')], ['1'])).toThrow(
			'bị trùng',
		);
	});
});
