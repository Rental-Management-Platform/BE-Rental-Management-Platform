import { normalizePhone, PHONE_PATTERN } from './phone';

describe('normalizePhone', () => {
	it.each([
		['0912345678', '0912345678'],
		['+84912345678', '0912345678'],
		['84912345678', '0912345678'],
		['+84 912.345.678', '0912345678'],
		['091-234-5678', '0912345678'],
		[' 0912 345 678 ', '0912345678'],
	])('%j thành %j', (raw, expected) => {
		expect(normalizePhone(raw)).toBe(expected);
	});

	it('hai cách gõ cùng một số cho cùng một kết quả (để kiểm trùng đúng)', () => {
		expect(normalizePhone('+84 912 345 678')).toBe(
			normalizePhone('0912.345.678'),
		);
	});
});

describe('PHONE_PATTERN', () => {
	it.each([
		'0912345678',
		'0388765432',
		'0521234567',
		'0771234567',
		'0851234567',
	])('nhận số di động hợp lệ %s', (phone) => {
		expect(PHONE_PATTERN.test(phone)).toBe(true);
	});

	it.each([
		'0212345678', // đầu số 2 không phải di động
		'091234567', // thiếu một chữ số
		'09123456789', // thừa một chữ số
		'+84912345678', // chưa chuẩn hóa
		'09123abcde',
		'',
	])('từ chối %j', (phone) => {
		expect(PHONE_PATTERN.test(phone)).toBe(false);
	});
});
