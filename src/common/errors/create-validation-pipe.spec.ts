import { RegisterDto } from '../../auth/dto/register.dto';
import { AppException } from './app.exception';
import {
	createValidationPipe,
	VALIDATION_MESSAGES,
} from './create-validation-pipe';
import type { FieldError } from './error-code';

async function validate(payload: object): Promise<{
	errors: readonly FieldError[];
	value: unknown;
}> {
	try {
		const value: unknown = await createValidationPipe().transform(payload, {
			type: 'body',
			metatype: RegisterDto,
		});
		return { errors: [], value };
	} catch (error: unknown) {
		if (error instanceof AppException) {
			return { errors: error.fieldErrors, value: undefined };
		}
		throw error;
	}
}

const base = {
	email: 'nguoi.dung@example.com',
	password: 'mat-khau-hop-le',
	accountType: 'tenant',
};

describe('thông báo kiểm tra dữ liệu bằng tiếng Việt', () => {
	it('mọi câu trong bảng đều có dấu tiếng Việt (không sót câu tiếng Anh)', () => {
		for (const message of Object.values(VALIDATION_MESSAGES)) {
			expect(message).toMatch(/\P{ASCII}/u);
		}
	});

	it('lỗi từ class-validator được đổi sang tiếng Việt', async () => {
		const { errors } = await validate({
			email: 'khong-phai-email',
			password: 'ngan',
			accountType: 'tenant',
		});
		const email = errors.find((e) => e.field === 'email');
		expect(email?.message).toBe('Phải là địa chỉ email hợp lệ.');
		const password = errors.find((e) => e.field === 'password');
		expect(password?.message).toBe('Mật khẩu phải có ít nhất 8 ký tự.');
		for (const error of errors) expect(error.message).toMatch(/\P{ASCII}/u);
	});

	it('trường lạ như roles bị từ chối bằng câu tiếng Việt', async () => {
		const { errors } = await validate({ ...base, roles: ['admin'] });
		expect(errors).toContainEqual({
			field: 'roles',
			code: 'whitelistValidation',
			message: 'Trường này không được phép gửi lên.',
		});
	});

	it('không tự đăng ký thành admin được', async () => {
		const { errors } = await validate({ ...base, accountType: 'admin' });
		expect(errors.some((e) => e.field === 'accountType')).toBe(true);
	});
});

describe('số điện thoại khi đăng ký (spec 0002 AC-13)', () => {
	it('người đăng bài thiếu số điện thoại bị từ chối', async () => {
		const { errors } = await validate({ ...base, accountType: 'landlord' });
		expect(errors).toContainEqual(
			expect.objectContaining({
				field: 'phone',
				message: 'Người đăng bài phải có số điện thoại.',
			}),
		);
	});

	it('người đăng bài nhập +84 có dấu chấm được chuẩn hóa về 0xxxxxxxxx', async () => {
		const { errors, value } = await validate({
			...base,
			accountType: 'landlord',
			phone: '+84 912.345.678',
		});
		expect(errors).toEqual([]);
		expect(value).toEqual(expect.objectContaining({ phone: '0912345678' }));
	});

	it('số sai định dạng bị từ chối', async () => {
		const { errors } = await validate({
			...base,
			accountType: 'landlord',
			phone: '0212345678',
		});
		expect(errors).toContainEqual(
			expect.objectContaining({
				field: 'phone',
				message: 'Số điện thoại không hợp lệ.',
			}),
		);
	});

	it('người tìm trọ có thể bỏ trống số điện thoại', async () => {
		const { errors } = await validate(base);
		expect(errors).toEqual([]);
	});

	it('người tìm trọ nếu khai số thì số cũng phải đúng định dạng', async () => {
		const { errors } = await validate({ ...base, phone: '123' });
		expect(errors.some((e) => e.field === 'phone')).toBe(true);
	});
});
