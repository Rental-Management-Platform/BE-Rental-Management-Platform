/** Số di động Việt Nam sau khi chuẩn hóa: `0` cộng 9 chữ số, đầu số 3, 5, 7, 8 hoặc 9 (spec 0002 AC-13). */
export const PHONE_PATTERN = /^0(3|5|7|8|9)\d{8}$/;

/**
 * Chuẩn hóa về một dạng duy nhất để kiểm trùng đúng: bỏ dấu cách, dấu chấm, dấu gạch;
 * đầu `+84` hoặc `84` đổi thành `0`. Không kiểm định dạng ở đây (việc của PHONE_PATTERN).
 */
export function normalizePhone(raw: string): string {
	const compact = raw.replace(/[\s.-]/g, '');
	if (compact.startsWith('+84')) return `0${compact.slice(3)}`;
	if (compact.startsWith('84')) return `0${compact.slice(2)}`;
	return compact;
}

/** Dạng quốc tế đầy đủ: `+84` hoặc `84` cộng đúng 9 chữ số. */
const INTERNATIONAL_PATTERN = /^\+?84\d{9}$/;

/**
 * Chuỗi chữ số để tìm trong cột số điện thoại từ ô tìm kiếm (spec 0007 AC-4). Bỏ dấu cách, chấm, gạch; dạng quốc
 * tế đầy đủ đổi về `0` cộng 9 chữ số; dạng khác giữ nguyên nếu chỉ gồm chữ số, nên `84` vẫn tìm chuỗi `84`. Có chữ
 * cái hay ký tự khác thì `null`: ô tìm kiếm không so với cột số điện thoại.
 */
export function toPhoneNeedle(raw: string): string | null {
	const compact = raw.replace(/[\s.-]/g, '');
	if (INTERNATIONAL_PATTERN.test(compact)) return normalizePhone(compact);
	return /^\d+$/.test(compact) ? compact : null;
}
