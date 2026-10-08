import { AppException } from '../../common/errors/app.exception';
import { createValidationPipe } from '../../common/errors/create-validation-pipe';
import type { FieldError } from '../../common/errors/error-code';
import { ChangePasswordDto } from './change-password.dto';
import { ForgotPasswordDto } from './forgot-password.dto';
import { ResetPasswordDto } from './reset-password.dto';

async function fieldsOf(
	metatype: new () => object,
	payload: object,
): Promise<readonly FieldError[]> {
	try {
		await createValidationPipe().transform(payload, {
			type: 'body',
			metatype,
		});
		return [];
	} catch (error: unknown) {
		if (error instanceof AppException) return error.fieldErrors;
		throw error;
	}
}

/** Một trường vi phạm nhiều ràng buộc thì có nhiều dòng lỗi; test chỉ cần biết trường nào sai. */
function uniqueFields(errors: readonly FieldError[]): string[] {
	return [...new Set(errors.map((e) => e.field))].sort();
}

describe('ForgotPasswordDto', () => {
	it('chấp nhận email hợp lệ (cắt khoảng trắng) và từ chối email sai', async () => {
		expect(
			await fieldsOf(ForgotPasswordDto, { email: '  an@example.com ' }),
		).toEqual([]);
		const errors = await fieldsOf(ForgotPasswordDto, {
			email: 'khong-phai',
		});
		expect(uniqueFields(errors)).toEqual(['email']);
	});
});

describe('ResetPasswordDto', () => {
	it('chấp nhận token cùng mật khẩu mới hợp lệ', async () => {
		expect(
			await fieldsOf(ResetPasswordDto, {
				token: 'abc',
				newPassword: 'mat-khau-moi-1',
			}),
		).toEqual([]);
	});

	it('từ chối token trống và mật khẩu mới ngắn hơn 8 ký tự, bằng tiếng Việt', async () => {
		const errors = await fieldsOf(ResetPasswordDto, {
			token: '',
			newPassword: 'ngan',
		});
		expect(uniqueFields(errors)).toEqual(['newPassword', 'token']);
		expect(errors.find((e) => e.field === 'newPassword')?.message).toBe(
			'Mật khẩu phải có ít nhất 8 ký tự.',
		);
	});

	it('từ chối mật khẩu mới dài hơn 128 ký tự', async () => {
		const errors = await fieldsOf(ResetPasswordDto, {
			token: 'abc',
			newPassword: 'a'.repeat(129),
		});
		expect(uniqueFields(errors)).toEqual(['newPassword']);
	});
});

describe('ChangePasswordDto', () => {
	it('chấp nhận mật khẩu hiện tại ngắn (không áp luật độ dài cho mật khẩu cũ)', async () => {
		expect(
			await fieldsOf(ChangePasswordDto, {
				currentPassword: 'cu',
				newPassword: 'mat-khau-moi-1',
			}),
		).toEqual([]);
	});

	it('từ chối thiếu mật khẩu hiện tại hoặc mật khẩu mới ngắn', async () => {
		const errors = await fieldsOf(ChangePasswordDto, {
			newPassword: 'ngan',
		});
		expect(uniqueFields(errors)).toEqual([
			'currentPassword',
			'newPassword',
		]);
	});

	it('từ chối trường lạ', async () => {
		const errors = await fieldsOf(ChangePasswordDto, {
			currentPassword: 'cu',
			newPassword: 'mat-khau-moi-1',
			roles: ['admin'],
		});
		expect(uniqueFields(errors)).toEqual(['roles']);
	});
});
