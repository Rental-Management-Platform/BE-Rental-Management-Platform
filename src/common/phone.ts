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
