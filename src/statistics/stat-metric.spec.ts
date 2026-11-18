import { percentChange, ratePercent, toMetric } from './stat-metric';

describe('percentChange (spec 0017 AC-3)', () => {
	it.each([
		[5, 3, 66.7],
		[3, 5, -40],
		[4, 4, 0],
		[0, 0, null],
		[7, 0, null],
		[0, 7, -100],
		[1, 3, -66.7],
		[2, 3, -33.3],
		[10, 1, 900],
		[128, 96, 33.3],
		[9, 6, 50],
	])('value %d so với previous %d ra %p', (value, previous, expected) => {
		expect(percentChange(value, previous)).toBe(expected);
	});

	it('previous bằng 0 thì null dù value bằng 0 hay lớn hơn 0, không bao giờ Infinity hay NaN', () => {
		expect(percentChange(0, 0)).toBeNull();
		expect(percentChange(5, 0)).toBeNull();
		expect(percentChange(1_000_000, 0)).toBeNull();
	});

	it('hai số bằng nhau ra 0, không phải -0', () => {
		expect(Object.is(percentChange(4, 4), 0)).toBe(true);
		expect(Object.is(percentChange(0, 0), 0)).toBe(false);
		expect(Object.is(percentChange(199_000, 199_000), 0)).toBe(true);
	});

	it('giảm nhỏ đến mức làm tròn về 0 cũng ra 0, không ra -0', () => {
		const result = percentChange(2_099_999_999, 2_100_000_000);
		expect(Object.is(result, 0)).toBe(true);
	});

	it('nửa làm tròn ra xa số 0 ở cả hai dấu', () => {
		// 1/16 = 6.25% đúng nửa: tăng thì lên 6.3, giảm thì xuống -6.3.
		expect(percentChange(17, 16)).toBe(6.3);
		expect(percentChange(15, 16)).toBe(-6.3);
		// 1/8 = 12.5% đúng nửa ở chữ số thập phân thứ nhất: không cần làm tròn, giữ nguyên.
		expect(percentChange(9, 8)).toBe(12.5);
		expect(percentChange(7, 8)).toBe(-12.5);
		// 1/400 = 0.25%: nửa của 0.1 thì ra 0.3 (xa số 0), âm ra -0.3.
		expect(percentChange(401, 400)).toBe(0.3);
		expect(percentChange(399, 400)).toBe(-0.3);
	});

	it('không làm tròn lên khi chưa đến nửa', () => {
		// 1/3 = 33.33...
		expect(percentChange(4, 3)).toBe(33.3);
		// 1/7 = 14.2857...
		expect(percentChange(8, 7)).toBe(14.3);
	});

	it('số tiền lớn vẫn đúng và không tràn số nguyên an toàn', () => {
		expect(percentChange(3_000_000_000, 100_000_000)).toBe(2900);
		expect(percentChange(2_100_000_001, 2_100_000_000)).toBe(0);
	});
});

describe('ratePercent (spec 0017 AC-10)', () => {
	it.each([
		[1, 3, 33.3],
		[2, 3, 66.7],
		[3, 3, 100],
		[0, 3, 0],
		[6, 8, 75],
		[4, 5, 80],
		[1, 8, 12.5],
		[1, 16, 6.3],
		[1, 400, 0.3],
	])('%d trên %d ra %p', (part, whole, expected) => {
		expect(ratePercent(part, whole)).toBe(expected);
	});

	it('không có mẫu số thì null, không phải 0 và không chia cho 0', () => {
		expect(ratePercent(0, 0)).toBeNull();
		expect(ratePercent(5, 0)).toBeNull();
	});
});

describe('toMetric', () => {
	it('giữ nguyên hai số và tính changePercent', () => {
		expect(toMetric(128, 96)).toEqual({
			value: 128,
			previous: 96,
			changePercent: 33.3,
		});
		expect(toMetric(3, 0)).toEqual({
			value: 3,
			previous: 0,
			changePercent: null,
		});
		expect(toMetric(0, 0)).toEqual({
			value: 0,
			previous: 0,
			changePercent: null,
		});
	});
});
