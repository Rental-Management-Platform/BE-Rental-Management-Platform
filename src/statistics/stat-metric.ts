/**
 * Một con số theo kỳ: giá trị của kỳ này, của kỳ liền trước cùng độ dài, và phần trăm đổi (spec 0017 AC-3). Chỉ con
 * số theo kỳ mới có kỳ trước; số của trạng thái hiện tại là số thường.
 */
export interface Metric {
	readonly value: number;
	readonly previous: number;
	/** Một chữ số thập phân; `null` khi `previous` bằng 0 (không chia cho 0). */
	readonly changePercent: number | null;
}

/**
 * `floor(a / b)` bằng số nguyên: `%` của số nguyên là chính xác, còn `a / b` rồi `Math.floor` có thể làm tròn lên
 * một đơn vị khi `a` rất lớn. `a` không âm và `b` dương.
 */
function floorDivide(a: number, b: number): number {
	return (a - (a % b)) / b;
}

/**
 * Phần trăm đổi `(value − previous) / previous × 100` làm tròn một chữ số thập phân, nửa làm tròn ra xa số 0, tính
 * bằng số nguyên (spec 0017 AC-3): `dấu × floor((2000 × |value − previous| + previous) / (2 × previous)) / 10`, dấu theo
 * `value − previous`. `previous` bằng 0 thì `null`, dù `value` bằng 0 hay lớn hơn 0. Hai số bằng nhau ra `0`, không
 * bao giờ `-0`.
 */
export function percentChange(value: number, previous: number): number | null {
	if (previous === 0) return null;
	const difference = value - previous;
	if (difference === 0) return 0;
	const tenths = floorDivide(
		2000 * Math.abs(difference) + previous,
		2 * previous,
	);
	// Đổi nhỏ đến mức làm tròn về 0 cũng ra 0, không ra -0.
	if (tenths === 0) return 0;
	return (difference < 0 ? -tenths : tenths) / 10;
}

/**
 * Tỉ lệ `part ÷ whole × 100` một chữ số thập phân, nửa làm tròn lên, tính bằng số nguyên (spec 0017 AC-10):
 * `floor((2000 × part + whole) / (2 × whole)) / 10`. `whole` bằng 0 thì `null` (không có mẫu số, không phải 0%).
 */
export function ratePercent(part: number, whole: number): number | null {
	if (whole === 0) return null;
	return floorDivide(2000 * part + whole, 2 * whole) / 10;
}

/** Ghép hai số của hai kỳ thành một Metric. */
export function toMetric(value: number, previous: number): Metric {
	return { value, previous, changePercent: percentChange(value, previous) };
}
