import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { UpdateProfileDto } from './update-profile.dto';

async function validate(
	body: object,
): Promise<{ errors: readonly FieldError[]; value: UpdateProfileDto | null }> {
	try {
		const value = (await createValidationPipe().transform(body, {
			type: 'body',
			metatype: UpdateProfileDto,
		})) as UpdateProfileDto;
		return { errors: [], value };
	} catch (error: unknown) {
		if (error instanceof AppException) {
			return { errors: error.fieldErrors, value: null };
		}
		throw error;
	}
}

function fieldsOf(errors: readonly FieldError[]): string[] {
	return [...new Set(errors.map((item) => item.field))];
}

describe('UpdateProfileDto (spec 0008 AC-2, AC-3, AC-5)', () => {
	describe('name', () => {
		it('vắng mặt thì không có tên trong kết quả (giữ nguyên)', async () => {
			const { errors, value } = await validate({});
			expect(errors).toEqual([]);
			expect(value?.name).toBeUndefined();
			expect(value?.phone).toBeUndefined();
		});

		it('cắt khoảng trắng hai đầu', async () => {
			const { errors, value } = await validate({ name: '  Lan  ' });
			expect(errors).toEqual([]);
			expect(value?.name).toBe('Lan');
		});

		it.each([
			['null', null, null],
			['chuỗi rỗng', '', ''],
			['chuỗi toàn khoảng trắng', '   ', ''],
		])('%s đi qua để Service xóa tên', async (_label, input, expected) => {
			const { errors, value } = await validate({ name: input });
			expect(errors).toEqual([]);
			expect(value?.name).toBe(expected);
		});

		it('đúng 100 ký tự thì qua, 101 ký tự thì 400 trường name', async () => {
			expect((await validate({ name: 'a'.repeat(100) })).errors).toEqual(
				[],
			);
			const tooLong = await validate({ name: 'a'.repeat(101) });
			expect(fieldsOf(tooLong.errors)).toEqual(['name']);
		});

		it.each([[42], [true], [['Lan']], [{ first: 'Lan' }]])(
			'kiểu không phải chuỗi (%j) bị 400 trường name',
			async (name) => {
				expect(fieldsOf((await validate({ name })).errors)).toEqual([
					'name',
				]);
			},
		);
	});

	describe('phone', () => {
		it.each([
			['0912345678', '0912345678'],
			['+84 912.345.678', '0912345678'],
			['84-912-345-678', '0912345678'],
			['0312345678', '0312345678'],
		])('chuẩn hóa %j thành %j', async (input, expected) => {
			const { errors, value } = await validate({ phone: input });
			expect(errors).toEqual([]);
			expect(value?.phone).toBe(expected);
		});

		it('null đi qua để Service xóa số hoặc chặn chủ trọ', async () => {
			const { errors, value } = await validate({ phone: null });
			expect(errors).toEqual([]);
			expect(value?.phone).toBeNull();
		});

		it.each([
			['chuỗi rỗng', ''],
			['toàn khoảng trắng', '   '],
			['quá ngắn', '12345'],
			['đầu số 02 (máy bàn)', '0212345678'],
			['có chữ cái', '09123abcde'],
			['dư một chữ số', '09123456789'],
			['số', 912345678],
			['mảng', ['0912345678']],
		])(
			'%s bị 400 trường phone với câu tiếng Việt',
			async (_label, phone) => {
				const { errors } = await validate({ phone });
				expect(fieldsOf(errors)).toEqual(['phone']);
				expect(errors.map((item) => item.message)).toContain(
					'Số điện thoại không hợp lệ.',
				);
			},
		);
	});

	describe('trường không được sửa (AC-5)', () => {
		it.each([
			'email',
			'accountType',
			'status',
			'id',
			'roles',
			'password',
			'passwordHash',
			'lockedReason',
			'createdAt',
			'trialEndsAt',
			'unknownField',
		])('gửi %s bị 400 đúng tên trường', async (field) => {
			const { errors } = await validate({ [field]: 'x' });
			expect(fieldsOf(errors)).toEqual([field]);
		});

		it('gửi cùng lúc trường hợp lệ và trường lạ vẫn bị 400', async () => {
			const { errors } = await validate({
				name: 'Lan',
				accountType: 'admin',
			});
			expect(fieldsOf(errors)).toEqual(['accountType']);
		});
	});
});
