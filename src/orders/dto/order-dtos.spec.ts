import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { CreateOrderDto } from './create-order.dto';
import { ListOrdersQueryDto } from './order-queries.dto';

type DtoClass = new () => object;

async function validate(
	metatype: DtoClass,
	payload: object,
	type: 'body' | 'query' = 'body',
): Promise<{ errors: readonly FieldError[]; value: unknown }> {
	try {
		const value: unknown = await createValidationPipe().transform(payload, {
			type,
			metatype,
		});
		return { errors: [], value };
	} catch (error: unknown) {
		if (error instanceof AppException) {
			return { errors: error.fieldErrors, value: undefined };
		}
		throw error;
	}
}

const PLAN_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';

describe('CreateOrderDto (spec 0004 AC-3)', () => {
	it('chấp nhận planId là uuid', async () => {
		const { errors } = await validate(CreateOrderDto, { planId: PLAN_ID });
		expect(errors).toEqual([]);
	});

	it.each([
		['thiếu planId', {}],
		['planId không phải uuid', { planId: 'abc' }],
		['planId là số', { planId: 12 }],
		['planId rỗng', { planId: '' }],
	])('%s: 400 trên trường planId', async (_name, payload) => {
		const { errors } = await validate(CreateOrderDto, payload);
		expect(errors.map((error) => error.field)).toContain('planId');
	});

	it('báo bằng câu tiếng Việt', async () => {
		const { errors } = await validate(CreateOrderDto, { planId: 'abc' });
		expect(errors[0]?.message).toBe('Phải là mã gói hợp lệ.');
	});

	it('không nhận giá, số tin hay số ngày từ client (chỉ planId được phép)', async () => {
		const { errors } = await validate(CreateOrderDto, {
			planId: PLAN_ID,
			price: 1,
			maxListings: 9999,
			durationDays: 365,
		});
		const fields = errors.map((error) => error.field).sort();
		expect(fields).toEqual(['durationDays', 'maxListings', 'price']);
	});
});

describe('ListOrdersQueryDto (spec 0004 AC-4)', () => {
	it('mặc định trang 1, 20 dòng, không lọc', async () => {
		const { value } = await validate(ListOrdersQueryDto, {}, 'query');
		expect(value).toMatchObject({ page: 1, pageSize: 20 });
	});

	it.each(['pending', 'paid', 'cancelled'])(
		'chấp nhận lọc status=%s',
		async (status) => {
			const { errors } = await validate(
				ListOrdersQueryDto,
				{ status },
				'query',
			);
			expect(errors).toEqual([]);
		},
	);

	it('status lạ: 400 trên trường status', async () => {
		const { errors } = await validate(
			ListOrdersQueryDto,
			{ status: 'refunded' },
			'query',
		);
		expect(errors.map((error) => error.field)).toEqual(['status']);
	});

	it('pageSize quá 50: 400', async () => {
		const { errors } = await validate(
			ListOrdersQueryDto,
			{ pageSize: '51' },
			'query',
		);
		expect(errors.map((error) => error.field)).toEqual(['pageSize']);
	});
});
