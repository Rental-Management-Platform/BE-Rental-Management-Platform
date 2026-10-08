import {
	IsDefined,
	IsEmail,
	IsIn,
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	MinLength,
	ValidateIf,
} from 'class-validator';
import { SELF_REGISTER_TYPES } from '../../common/auth/account-type';
import type { SelfRegisterType } from '../../common/auth/account-type';
import { NormalizePhone } from '../../common/decorators/normalize-phone.decorator';
import { Trim } from '../../common/decorators/trim.decorator';
import { PHONE_PATTERN } from '../../common/phone';

/**
 * Không có trường `roles`: với `forbidNonWhitelisted`, gửi nó bị từ chối 400. `accountType` chỉ nhận
 * `landlord` hoặc `tenant`, nên không ai tự đăng ký thành admin được (spec 0002 AC-1).
 */
export class RegisterDto {
	@Trim()
	@IsEmail()
	@MaxLength(254)
	email: string;

	/** Không @Trim: khoảng trắng đầu hoặc cuối có thể là một phần của mật khẩu. */
	@IsString({ message: 'Mật khẩu phải là chuỗi ký tự.' })
	@MinLength(8, { message: 'Mật khẩu phải có ít nhất 8 ký tự.' })
	@MaxLength(128, { message: 'Mật khẩu không được dài quá 128 ký tự.' })
	password: string;

	@IsOptional()
	@Trim()
	@IsString()
	@MaxLength(100)
	name?: string;

	/** Bắt buộc chọn, không có giá trị mặc định; không đổi được sau khi đăng ký. */
	@IsIn([...SELF_REGISTER_TYPES], {
		message:
			'Loại tài khoản phải là landlord (người đăng bài) hoặc tenant (người tìm trọ).',
	})
	accountType: SelfRegisterType;

	/** Bắt buộc với landlord; tenant có thể bỏ trống, nếu có thì cũng chuẩn hóa và kiểm định dạng. */
	@ValidateIf(
		(dto: RegisterDto) =>
			dto.accountType === 'landlord' || dto.phone !== undefined,
	)
	@NormalizePhone()
	@IsDefined({ message: 'Người đăng bài phải có số điện thoại.' })
	@IsString({ message: 'Số điện thoại không hợp lệ.' })
	@Matches(PHONE_PATTERN, { message: 'Số điện thoại không hợp lệ.' })
	phone?: string;
}
