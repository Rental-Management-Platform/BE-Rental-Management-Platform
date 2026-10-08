import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NewPassword } from './new-password.decorator';

export class ChangePasswordDto {
	/** Không @MinLength: chính sách độ dài chỉ áp khi đặt mật khẩu mới, không chặn nhầm tài khoản cũ. */
	@IsString()
	@IsNotEmpty()
	@MaxLength(128)
	currentPassword: string;

	@NewPassword()
	newPassword: string;
}
