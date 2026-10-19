import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { UpdateSettingDto } from './update-setting.dto';

async function validate(payload: object): Promise<{
	errors: readonly FieldError[];
	value: unknown;
}> {
	try {
		const value: unknown = await createValidationPipe().transform(payload, {
			type: 'body',
			metatype: UpdateSettingDto,
		});
		return { errors: [], value };
	} catch (error: unknown) {
		if (error instanceof AppException) {
			return { errors: error.fieldErrors, value: undefined };
		}
		throw error;
	}
}

describe('UpdateSettingDto (AC-2)', () => {
	it.each([0, 1, 30, 365, -1, 366])(
		'nhận số nguyên %d (khoảng do Service kiểm)',
		async (value) => {
			const result = await validate({ value });
			expect(result.errors).toEqual([]);
		},
	);

	it.each([
		['số thập phân', { value: 1.5 }],
		['chữ', { value: 'abc' }],
		['số viết thành chữ', { value: '5' }],
		['null', { value: null }],
		['thiếu trường value', {}],
		['mảng', { value: [1] }],
		['boolean', { value: true }],
	])('từ chối %s bằng lỗi ở trường value', async (_label, payload) => {
		const { errors } = await validate(payload);
		expect(errors.length).toBeGreaterThan(0);
		expect(errors[0]?.field).toBe('value');
		expect(errors[0]?.message).toMatch(/\P{ASCII}/u);
	});

	it('từ chối trường lạ', async () => {
		const { errors } = await validate({ value: 5, key: 'trial_days' });
		expect(errors.some((error) => error.field === 'key')).toBe(true);
	});
});
