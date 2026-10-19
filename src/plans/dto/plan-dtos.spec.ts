import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { CreatePlanDto } from './create-plan.dto';
import { UpdatePlanDto } from './update-plan.dto';

type DtoClass = new () => object;

async function validate(
	metatype: DtoClass,
	payload: object,
): Promise<{ errors: readonly FieldError[]; value: unknown }> {
	try {
		const value: unknown = await createValidationPipe().transform(payload, {
			type: 'body',
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

const fields = (errors: readonly FieldError[]): string[] => [
	...new Set(errors.map((error) => error.field)),
];

const base = { name: 'Nâng cao', price: 199_000, maxListings: 15 };

describe('CreatePlanDto (spec 0004 AC-2)', () => {
	it('chấp nhận thân tối thiểu: tên, giá, số tin', async () => {
		const { errors } = await validate(CreatePlanDto, base);
		expect(errors).toEqual([]);
	});

	it('chấp nhận thân đầy đủ kèm số ngày và cờ bán', async () => {
		const { errors } = await validate(CreatePlanDto, {
			...base,
			durationDays: 90,
			isActive: false,
		});
		expect(errors).toEqual([]);
	});

	it('cắt khoảng trắng đầu cuối của tên', async () => {
		const { value } = await validate(CreatePlanDto, {
			...base,
			name: '  Cơ bản  ',
		});
		expect(value).toMatchObject({ name: 'Cơ bản' });
	});

	it.each([
		['name', 'dài 2', { name: 'ab' }],
		['name', 'dài 60', { name: 'a'.repeat(60) }],
		['price', '0 (gói miễn phí)', { price: 0 }],
		['price', '100.000.000', { price: 100_000_000 }],
		['maxListings', '1', { maxListings: 1 }],
		['maxListings', '1000', { maxListings: 1000 }],
		['durationDays', '1', { durationDays: 1 }],
		['durationDays', '365', { durationDays: 365 }],
	])('nhận biên %s %s', async (_field, _label, patch) => {
		const { errors } = await validate(CreatePlanDto, { ...base, ...patch });
		expect(errors).toEqual([]);
	});

	it.each([
		['name', 'dài 1', { name: 'a' }],
		['name', 'dài 61', { name: 'a'.repeat(61) }],
		['name', 'chỉ có khoảng trắng', { name: '   ' }],
		['name', 'là số', { name: 123 }],
		['price', '-1', { price: -1 }],
		['price', '100.000.001', { price: 100_000_001 }],
		['price', 'là số thập phân', { price: 99_000.5 }],
		['price', 'viết thành chữ', { price: '99000' }],
		['maxListings', '0', { maxListings: 0 }],
		['maxListings', '1001', { maxListings: 1001 }],
		['maxListings', 'là số thập phân', { maxListings: 5.5 }],
		['durationDays', '0', { durationDays: 0 }],
		['durationDays', '366', { durationDays: 366 }],
		['durationDays', 'là null', { durationDays: null }],
		['isActive', 'là chữ', { isActive: 'true' }],
		['isActive', 'là null', { isActive: null }],
	])(
		'từ chối %s khi %s, lỗi nằm ở đúng trường',
		async (field, _label, patch) => {
			const { errors } = await validate(CreatePlanDto, {
				...base,
				...patch,
			});
			expect(fields(errors)).toEqual([field]);
			for (const error of errors)
				expect(error.message).toMatch(/\P{ASCII}/u);
		},
	);

	it.each(['name', 'price', 'maxListings'])(
		'bắt buộc có %s',
		async (field) => {
			const payload: Record<string, unknown> = { ...base };
			delete payload[field];
			const { errors } = await validate(CreatePlanDto, payload);
			expect(fields(errors)).toEqual([field]);
		},
	);

	it('từ chối trường lạ như id hay createdAt', async () => {
		const { errors } = await validate(CreatePlanDto, {
			...base,
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01',
			createdAt: '2026-10-19',
		});
		expect(fields(errors).sort()).toEqual(['createdAt', 'id']);
	});
});

describe('UpdatePlanDto (spec 0004 AC-2)', () => {
	it('chấp nhận thân rỗng (không đổi gì)', async () => {
		const { errors } = await validate(UpdatePlanDto, {});
		expect(errors).toEqual([]);
	});

	it('chấp nhận từng trường riêng lẻ, kể cả tắt gói', async () => {
		for (const patch of [
			{ name: 'Gói mới' },
			{ price: 0 },
			{ maxListings: 1000 },
			{ durationDays: 365 },
			{ isActive: false },
		]) {
			const { errors } = await validate(UpdatePlanDto, patch);
			expect(errors).toEqual([]);
		}
	});

	it.each([
		['name', { name: null }],
		['name', { name: 'a' }],
		['price', { price: null }],
		['price', { price: -5 }],
		['price', { price: 100_000_001 }],
		['maxListings', { maxListings: 0 }],
		['maxListings', { maxListings: null }],
		['durationDays', { durationDays: 366 }],
		['durationDays', { durationDays: null }],
		['isActive', { isActive: null }],
		['isActive', { isActive: 1 }],
	])('từ chối %s sai: %j', async (field, patch) => {
		const { errors } = await validate(UpdatePlanDto, patch);
		expect(fields(errors)).toEqual([field]);
	});

	it('từ chối trường lạ', async () => {
		const { errors } = await validate(UpdatePlanDto, { code: 'x' });
		expect(fields(errors)).toEqual(['code']);
	});
});
