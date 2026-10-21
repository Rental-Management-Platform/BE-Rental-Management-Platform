import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { ListUsersQueryDto } from './list-users-query.dto';

async function validate(
	query: object,
): Promise<{ fields: string[]; value: unknown }> {
	try {
		const value: unknown = await createValidationPipe().transform(query, {
			type: 'query',
			metatype: ListUsersQueryDto,
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

describe('ListUsersQueryDto (spec 0007 AC-1 đến AC-3)', () => {
	it('không tham số nào: trang 1, 20 dòng, không lọc', async () => {
		const { fields, value } = await validate({});
		expect(fields).toEqual([]);
		expect(value).toMatchObject({ page: 1, pageSize: 20 });
		const query = value as ListUsersQueryDto;
		expect(query.accountType).toBeUndefined();
		expect(query.status).toBeUndefined();
		expect(query.q).toBeUndefined();
	});

	it.each([['admin'], ['landlord'], ['tenant']])(
		'chấp nhận accountType=%s',
		async (accountType) => {
			expect((await validate({ accountType })).fields).toEqual([]);
		},
	);

	it.each([['active'], ['locked']])('chấp nhận status=%s', async (status) => {
		expect((await validate({ status })).fields).toEqual([]);
	});

	it('chấp nhận cả hai bộ lọc cùng q và phân trang', async () => {
		const { fields, value } = await validate({
			accountType: 'landlord',
			status: 'locked',
			q: 'nam',
			page: '2',
			pageSize: '50',
		});
		expect(fields).toEqual([]);
		expect(value).toMatchObject({
			accountType: 'landlord',
			status: 'locked',
			q: 'nam',
			page: 2,
			pageSize: 50,
		});
	});

	it('cắt khoảng trắng hai đầu của q', async () => {
		const { value } = await validate({ q: '  Nguyễn Văn  ' });
		expect(value).toMatchObject({ q: 'Nguyễn Văn' });
	});

	it('q toàn khoảng trắng thành chuỗi rỗng (Service coi như không lọc chữ)', async () => {
		const { fields, value } = await validate({ q: '   ' });
		expect(fields).toEqual([]);
		expect(value).toMatchObject({ q: '' });
	});

	it('q dài đúng 254 ký tự được nhận, 255 ký tự bị từ chối', async () => {
		expect((await validate({ q: 'a'.repeat(254) })).fields).toEqual([]);
		expect((await validate({ q: 'a'.repeat(255) })).fields).toEqual(['q']);
	});

	it('q quá 254 ký tự tính sau khi cắt khoảng trắng', async () => {
		expect((await validate({ q: ` ${'a'.repeat(254)} ` })).fields).toEqual(
			[],
		);
	});

	it.each([
		['accountType lạ', { accountType: 'root' }, 'accountType'],
		['accountType viết hoa', { accountType: 'ADMIN' }, 'accountType'],
		['status lạ', { status: 'x' }, 'status'],
		['status là deleted', { status: 'deleted' }, 'status'],
		['pageSize 51', { pageSize: '51' }, 'pageSize'],
		['pageSize 0', { pageSize: '0' }, 'pageSize'],
		['page 0', { page: '0' }, 'page'],
		['tham số lạ sort', { sort: 'asc' }, 'sort'],
		['tham số lạ landlordId', { landlordId: 'x' }, 'landlordId'],
	])('từ chối %s', async (_label, query, field) => {
		expect((await validate(query)).fields).toEqual([field]);
	});

	it('mỗi tham số chỉ nhận một giá trị: lặp tham số thành mảng bị từ chối', async () => {
		expect(
			(await validate({ status: ['active', 'locked'] })).fields,
		).toEqual(['status']);
		expect((await validate({ q: ['a', 'b'] })).fields).toEqual(['q']);
	});
});
