import { applyDecorators } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Luật cho mật khẩu được đặt mới: chuỗi dài 8 đến 128 ký tự (spec 0002 AC-12). Dùng chung cho đăng
 * ký, đặt lại và đổi mật khẩu để ba nơi không lệch nhau. Không `@Trim`: khoảng trắng đầu hoặc cuối
 * có thể là một phần của mật khẩu.
 */
export function NewPassword(): PropertyDecorator {
	return applyDecorators(
		IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' }),
		MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' }),
		MaxLength(128, { message: 'Mật khẩu không được dài quá 128 ký tự.' }),
	);
}
