import { AppException } from '../errors/app.exception';
import { createValidationPipe } from '../errors/create-validation-pipe';
import { MAX_PAGE, PaginationQueryDto, skipOf, toPage } from './pagination';

async function parse(
	query: Record<string, string>,
): Promise<PaginationQueryDto> {
	return (await createValidationPipe().transform(query, {
		type: 'query',
		metatype: PaginationQueryDto,
	})) as PaginationQueryDto;
}

async function errorFields(query: Record<string, string>): Promise<string[]> {
	try {
		await parse(query);
	} catch (error: unknown) {
		if (error instanceof AppException) {
			return [...new Set(error.fieldErrors.map((e) => e.field))];
		}
		throw error;
	}
	return [];
}

describe('PaginationQueryDto (spec 0002)', () => {
	it('mặc định trang 1, 20 dòng', async () => {
		const query = await parse({});
		expect(query.page).toBe(1);
		expect(query.pageSize).toBe(20);
	});

	it('đổi chuỗi trên query thành số', async () => {
		const query = await parse({ page: '3', pageSize: '50' });
		expect(query).toMatchObject({ page: 3, pageSize: 50 });
	});

	it.each([
		['page = 0', { page: '0' }, 'page'],
		['page âm', { page: '-1' }, 'page'],
		['page thập phân', { page: '1.5' }, 'page'],
		['page không phải số', { page: 'abc' }, 'page'],
		['page rỗng', { page: '' }, 'page'],
		['page quá lớn', { page: String(MAX_PAGE + 1) }, 'page'],
		['pageSize = 0', { pageSize: '0' }, 'pageSize'],
		['pageSize = 51', { pageSize: '51' }, 'pageSize'],
		['pageSize không phải số', { pageSize: 'x' }, 'pageSize'],
	])('từ chối %s', async (_name, query, field) => {
		expect(await errorFields(query)).toEqual([field]);
	});

	it('từ chối tham số lạ', async () => {
		expect(await errorFields({ sort: 'asc' })).toEqual(['sort']);
	});
});

describe('skipOf và toPage', () => {
	it('bỏ qua đúng số dòng của các trang trước', () => {
		expect(skipOf({ page: 1, pageSize: 20 })).toBe(0);
		expect(skipOf({ page: 3, pageSize: 20 })).toBe(40);
		expect(skipOf({ page: 2, pageSize: 50 })).toBe(50);
	});

	it('trả đúng hình dạng { items, total, page, pageSize }', () => {
		expect(toPage(['a', 'b'], 7, { page: 2, pageSize: 2 })).toEqual({
			items: ['a', 'b'],
			total: 7,
			page: 2,
			pageSize: 2,
		});
	});
});
