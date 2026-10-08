import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NewPassword } from './new-password.decorator';

export class ResetPasswordDto {
	/** Token lấy từ liên kết trong email. Chỉ kiểm có mặt: sai hay lạ thì trả `RESET_TOKEN_INVALID`. */
	@IsString()
	@IsNotEmpty()
	@MaxLength(200)
	token: string;

	@NewPassword()
	newPassword: string;
}
