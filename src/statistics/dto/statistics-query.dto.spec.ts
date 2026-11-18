import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { StatisticsQueryDto } from './statistics-query.dto';

async function validate(
	query: object,
): Promise<{ fields: string[]; value: unknown }> {
	try {
		const value: unknown = await createValidationPipe().transform(query, {
			type: 'query',
			metatype: StatisticsQueryDto,
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

describe('StatisticsQueryDto (spec 0017 AC-2)', () => {
	it('không tham số nào là hợp lệ: cả from và to đều tùy chọn', async () => {
		const { fields, value } = await validate({});
		expect(fields).toEqual([]);
		const query = value as StatisticsQueryDto;
		expect(query.from).toBeUndefined();
		expect(query.to).toBeUndefined();
	});

	it('chấp nhận from, to, hoặc cả hai', async () => {
		expect((await validate({ from: '2026-10-18' })).fields).toEqual([]);
		expect((await validate({ to: '2026-11-16' })).fields).toEqual([]);
		const { fields, value } = await validate({
			from: '2026-10-18',
			to: '2026-11-16',
		});
		expect(fields).toEqual([]);
		expect(value).toMatchObject({ from: '2026-10-18', to: '2026-11-16' });
	});

	it('chấp nhận hai biên năm 2000 và 2100', async () => {
		expect(
			(await validate({ from: '2000-01-01', to: '2100-12-31' })).fields,
		).toEqual([]);
	});

	it.each([
		['from', '2026-02-30'],
		['from', '1999-12-31'],
		['from', '2101-01-01'],
		['to', '21/10/2026'],
		['to', '2026-1-5'],
		['to', 'hôm nay'],
		['from', ''],
		['to', '2026-13-01'],
	])('%s=%j bị 400 ở đúng trường đó', async (field, value) => {
		expect((await validate({ [field]: value })).fields).toEqual([field]);
	});

	it('mỗi trường sai báo ở trường của nó', async () => {
		const { fields } = await validate({ from: '2026-02-30', to: 'abc' });
		expect(fields.sort()).toEqual(['from', 'to']);
	});

	it.each([['groupBy'], ['sort'], ['page'], ['pageSize'], ['landlordId']])(
		'tham số lạ %s bị 400',
		async (name) => {
			const { fields } = await validate({ [name]: 'day' });
			expect(fields).toEqual([name]);
		},
	);
});
