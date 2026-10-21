import { normalizePhone, PHONE_PATTERN, toPhoneNeedle } from './phone';

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

describe('toPhoneNeedle (spec 0007 AC-4)', () => {
	it.each([
		['0901234567', '0901234567'],
		['0901 234 567', '0901234567'],
		['0901.234.567', '0901234567'],
		['090-123-4567', '0901234567'],
		['+84901234567', '0901234567'],
		['84901234567', '0901234567'],
		['+84 901 234 567', '0901234567'],
	])('%j thành %j', (raw, expected) => {
		expect(toPhoneNeedle(raw)).toBe(expected);
	});

	it.each([
		['84', '84'], // chưa đủ 9 chữ số sau 84: vẫn là chuỗi 84
		['8490', '8490'],
		['841234567', '841234567'], // 84 cộng 7 chữ số
		['0901', '0901'],
		['12', '12'],
		['849012345678', '849012345678'], // 84 cộng 10 chữ số: không phải dạng quốc tế đầy đủ
	])('%j giữ nguyên chữ số đã gõ: %j', (raw, expected) => {
		expect(toPhoneNeedle(raw)).toBe(expected);
	});

	it.each([
		'nam',
		'nam@example.com',
		'0901abc',
		'+84',
		'+84abc901234567',
		'%',
		'_',
		'',
		'   ',
	])('%j không so với cột số điện thoại: null', (raw) => {
		expect(toPhoneNeedle(raw)).toBeNull();
	});
});
