import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import {
	ListAllOrdersQueryDto,
	RevenueQueryDto,
} from './admin-order-queries.dto';

const LANDLORD = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
const PLAN = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';

async function validate(
	query: object,
): Promise<{ fields: string[]; value: unknown }> {
	try {
		const value: unknown = await createValidationPipe().transform(query, {
			type: 'query',
			metatype: ListAllOrdersQueryDto,
		});
		return { fields: [], value };
	} catch (error: unknown) {
		if (error instanceof AppException) {
			const errors: readonly FieldError[] = error.fieldErrors;
			return {
				fields: [...new Set(errors.map((item) => item.field))],
				value: undefined,
			};
		}
		throw error;
	}
}

describe('ListAllOrdersQueryDto (spec 0010 AC-1 đến AC-3)', () => {
	it('không tham số nào: trang 1, 20 dòng, không lọc', async () => {
		const { fields, value } = await validate({});
		expect(fields).toEqual([]);
		expect(value).toMatchObject({ page: 1, pageSize: 20 });
		const query = value as ListAllOrdersQueryDto;
		expect(query.status).toBeUndefined();
		expect(query.landlordId).toBeUndefined();
		expect(query.planId).toBeUndefined();
		expect(query.from).toBeUndefined();
		expect(query.to).toBeUndefined();
	});

	it.each([['pending'], ['paid'], ['cancelled']])(
		'chấp nhận status=%s',
		async (status) => {
			expect((await validate({ status })).fields).toEqual([]);
		},
	);

	it('chấp nhận cả ba bộ lọc, hai ngày và phân trang cùng lúc', async () => {
		const { fields, value } = await validate({
			status: 'paid',
			landlordId: LANDLORD,
			planId: PLAN,
			from: '2026-10-01',
			to: '2026-10-31',
			page: '3',
			pageSize: '50',
		});
		expect(fields).toEqual([]);
		expect(value).toMatchObject({
			status: 'paid',
			landlordId: LANDLORD,
			planId: PLAN,
			from: '2026-10-01',
			to: '2026-10-31',
			page: 3,
			pageSize: 50,
		});
	});

	it('chỉ gửi một trong hai ngày cũng được; from bằng to cũng được', async () => {
		expect((await validate({ from: '2026-10-01' })).fields).toEqual([]);
		expect((await validate({ to: '2026-10-31' })).fields).toEqual([]);
		expect(
			(await validate({ from: '2026-10-21', to: '2026-10-21' })).fields,
		).toEqual([]);
	});

	it.each([
		['status lạ', { status: 'x' }, 'status'],
		['status viết hoa', { status: 'PAID' }, 'status'],
		['landlordId không phải UUID', { landlordId: 'abc' }, 'landlordId'],
		['planId không phải UUID', { planId: '123' }, 'planId'],
		['pageSize 51', { pageSize: '51' }, 'pageSize'],
		['pageSize 0', { pageSize: '0' }, 'pageSize'],
		['page 0', { page: '0' }, 'page'],
		['tham số lạ sort', { sort: 'asc' }, 'sort'],
		['tham số lạ q', { q: 'k7m2xq9p' }, 'q'],
		['tham số lạ groupBy', { groupBy: 'day' }, 'groupBy'],
		['from 30 tháng 2', { from: '2026-02-30' }, 'from'],
		['from năm 1999', { from: '1999-12-31' }, 'from'],
		['from sai dạng ngày/tháng/năm', { from: '21/10/2026' }, 'from'],
		['to năm 2101', { to: '2101-01-01' }, 'to'],
		[
			'from lớn hơn to báo ở to',
			{ from: '2026-10-21', to: '2026-10-20' },
			'to',
		],
	])('từ chối %s', async (_label, query, field) => {
		expect((await validate(query)).fields).toEqual([field]);
	});

	it('mỗi tham số chỉ nhận một giá trị: lặp tham số thành mảng bị từ chối', async () => {
		expect(
			(await validate({ status: ['paid', 'pending'] })).fields,
		).toEqual(['status']);
		expect(
			(await validate({ landlordId: [LANDLORD, PLAN] })).fields,
		).toEqual(['landlordId']);
		expect(
			(await validate({ from: ['2026-10-01', '2026-10-02'] })).fields,
		).toEqual(['from']);
	});

	it('nhận UUID chữ hoa', async () => {
		expect(
			(await validate({ landlordId: LANDLORD.toUpperCase() })).fields,
		).toEqual([]);
	});
});

async function validateRevenue(
	query: object,
): Promise<{ fields: string[]; value: unknown }> {
	try {
		const value: unknown = await createValidationPipe().transform(query, {
			type: 'query',
			metatype: RevenueQueryDto,
		});
		return { fields: [], value };
	} catch (error: unknown) {
		if (error instanceof AppException) {
			const errors: readonly FieldError[] = error.fieldErrors;
			return {
				fields: [...new Set(errors.map((item) => item.field))],
				value: undefined,
			};
		}
		throw error;
	}
}

describe('RevenueQueryDto (spec 0010 AC-6)', () => {
	it('không tham số nào: không chặn phía nào, groupBy mặc định là month', async () => {
		const { fields, value } = await validateRevenue({});
		expect(fields).toEqual([]);
		const query = value as RevenueQueryDto;
		expect(query.groupBy).toBe('month');
		expect(query.from).toBeUndefined();
		expect(query.to).toBeUndefined();
	});

	it.each([['day'], ['month']])('chấp nhận groupBy=%s', async (groupBy) => {
		const { fields, value } = await validateRevenue({ groupBy });
		expect(fields).toEqual([]);
		expect((value as RevenueQueryDto).groupBy).toBe(groupBy);
	});

	it('chấp nhận from, to và groupBy cùng lúc, trả lại đúng chuỗi đã gửi', async () => {
		const { fields, value } = await validateRevenue({
			from: '2026-10-01',
			to: '2026-10-31',
			groupBy: 'day',
		});
		expect(fields).toEqual([]);
		expect(value).toMatchObject({
			from: '2026-10-01',
			to: '2026-10-31',
			groupBy: 'day',
		});
	});

	it('chỉ gửi một trong hai ngày, hoặc from bằng to, đều hợp lệ', async () => {
		expect((await validateRevenue({ from: '2026-10-01' })).fields).toEqual(
			[],
		);
		expect((await validateRevenue({ to: '2026-10-31' })).fields).toEqual(
			[],
		);
		expect(
			(await validateRevenue({ from: '2026-10-21', to: '2026-10-21' }))
				.fields,
		).toEqual([]);
	});

	it.each([
		['groupBy lạ', { groupBy: 'week' }, 'groupBy'],
		['groupBy viết hoa', { groupBy: 'DAY' }, 'groupBy'],
		['groupBy rỗng', { groupBy: '' }, 'groupBy'],
		['from 30 tháng 2', { from: '2026-02-30' }, 'from'],
		['from năm 1999', { from: '1999-12-31' }, 'from'],
		['to năm 2101', { to: '2101-01-01' }, 'to'],
		['to sai dạng', { to: '21/10/2026' }, 'to'],
		[
			'from lớn hơn to báo ở to',
			{ from: '2026-10-21', to: '2026-10-20' },
			'to',
		],
		['tham số lạ của danh sách: status', { status: 'paid' }, 'status'],
		['tham số lạ của danh sách: page', { page: '1' }, 'page'],
		['tham số lạ của danh sách: pageSize', { pageSize: '5' }, 'pageSize'],
		[
			'tham số lạ của danh sách: landlordId',
			{ landlordId: 'x' },
			'landlordId',
		],
		['tham số lạ sort', { sort: 'asc' }, 'sort'],
	])('từ chối %s', async (_label, query, field) => {
		expect((await validateRevenue(query)).fields).toEqual([field]);
	});

	it('lặp groupBy thành mảng bị từ chối', async () => {
		expect(
			(await validateRevenue({ groupBy: ['day', 'month'] })).fields,
		).toEqual(['groupBy']);
	});
});
