import {
	IsEmail,
	IsOptional,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

/**
 * Không có trường `roles`: với `forbidNonWhitelisted`, gửi nó bị từ chối 400
 * (vá lỗ hổng tự đăng ký admin, spec 0002 AC-1).
 */
export class RegisterDto {
	@Trim()
	@IsEmail()
	@MaxLength(254)
	email: string;

	/** Không @Trim: khoảng trắng đầu hoặc cuối có thể là một phần của mật khẩu. */
	@IsString()
	@MinLength(8)
	@MaxLength(128)
	password: string;

	@IsOptional()
	@Trim()
	@IsString()
	@MaxLength(100)
	name?: string;
	f;
}
