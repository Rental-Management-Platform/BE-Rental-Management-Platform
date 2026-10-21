import { IsOptional } from 'class-validator';
import { AppException } from '../errors/app.exception';
import { createValidationPipe } from '../errors/create-validation-pipe';
import type { FieldError } from '../errors/error-code';
import {
	IsCalendarDate,
	IsNotBeforeDate,
	isCalendarDate,
} from './calendar-date';

class RangeDto {
	@IsOptional()
	@IsCalendarDate()
	from?: string;

	@IsOptional()
	@IsCalendarDate()
	@IsNotBeforeDate('from')
	to?: string;
}

async function errorsOf(query: object): Promise<FieldError[]> {
	try {
		await createValidationPipe().transform(query, {
			type: 'query',
			metatype: RangeDto,
		});
		return [];
	} catch (error: unknown) {
		if (error instanceof AppException) return [...error.fieldErrors];
		throw error;
	}
}

describe('isCalendarDate (spec 0010 AC-3)', () => {
	it.each([
		'2000-01-01',
		'2026-10-21',
		'2024-02-29', // năm nhuận
		'2100-12-31',
		'2026-04-30',
	])('nhận %s', (value) => {
		expect(isCalendarDate(value)).toBe(true);
	});

	it.each([
		['30 tháng 2', '2026-02-30'],
		['29 tháng 2 năm thường', '2026-02-29'],
		['31 tháng 4', '2026-04-31'],
		['tháng 13', '2026-13-01'],
		['tháng 0', '2026-00-10'],
		['ngày 0', '2026-10-00'],
		['ngày 32', '2026-10-32'],
		['năm 1999', '1999-12-31'],
		['năm 2101', '2101-01-01'],
		['năm 0000', '0000-01-01'],
		['dạng ngày/tháng/năm', '21/10/2026'],
		['thiếu số 0 đệm', '2026-1-1'],
		['có giờ', '2026-10-21T00:00:00Z'],
		['có khoảng trắng', ' 2026-10-21'],
		['chuỗi rỗng', ''],
		['chữ', 'hôm nay'],
	])('từ chối %s (%s)', (_label, value) => {
		expect(isCalendarDate(value)).toBe(false);
	});

	it('từ chối giá trị không phải chuỗi (tham số lặp thành mảng, số, null)', () => {
		expect(isCalendarDate(['2026-10-21'])).toBe(false);
		expect(isCalendarDate(20261021)).toBe(false);
		expect(isCalendarDate(null)).toBe(false);
		expect(isCalendarDate(undefined)).toBe(false);
	});
});

describe('IsCalendarDate và IsNotBeforeDate qua ValidationPipe', () => {
	it('không gửi gì, chỉ một đầu, hoặc from bằng to: hợp lệ', async () => {
		expect(await errorsOf({})).toEqual([]);
		expect(await errorsOf({ from: '2026-10-01' })).toEqual([]);
		expect(await errorsOf({ to: '2026-10-31' })).toEqual([]);
		expect(
			await errorsOf({ from: '2026-10-21', to: '2026-10-21' }),
		).toEqual([]);
	});

	it('from lớn hơn to báo ở trường to, không phải from', async () => {
		const errors = await errorsOf({ from: '2026-10-21', to: '2026-10-20' });
		expect(errors.map((error) => error.field)).toEqual(['to']);
		expect(errors[0].code).toBe('isNotBeforeDate');
	});

	it('from sai dạng chỉ báo ở from, to hợp lệ không bị báo thêm', async () => {
		const errors = await errorsOf({ from: '2026-02-30', to: '2026-03-01' });
		expect(errors.map((error) => error.field)).toEqual(['from']);
	});

	it('to sai dạng chỉ báo một lỗi ở to (không thêm lỗi so sánh)', async () => {
		const errors = await errorsOf({ from: '2026-10-01', to: '21/10/2026' });
		expect(errors.map((error) => error.field)).toEqual(['to']);
		expect(errors).toHaveLength(1);
	});

	it('cả hai sai thì mỗi trường một lỗi', async () => {
		const errors = await errorsOf({ from: '1999-12-31', to: '2101-01-01' });
		expect(errors.map((error) => error.field).sort()).toEqual([
			'from',
			'to',
		]);
	});

	it('thông báo lỗi là tiếng Việt, nêu khoảng năm', async () => {
		const [error] = await errorsOf({ from: '2026-02-30' });
		expect(error.message).toContain('YYYY-MM-DD');
		expect(error.message).toContain('2000');
		expect(error.message).toContain('2100');
	});

	it('tham số lặp (mảng) bị từ chối', async () => {
		const errors = await errorsOf({ from: ['2026-10-01', '2026-10-02'] });
		expect(errors.map((error) => error.field)).toEqual(['from']);
	});
});
