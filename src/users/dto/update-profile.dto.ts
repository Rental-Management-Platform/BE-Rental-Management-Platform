import {
	IsOptional,
	IsString,
	Matches,
	MaxLength,
	ValidateIf,
} from 'class-validator';
import { NormalizePhone } from '../../common/decorators/normalize-phone.decorator';
import { Trim } from '../../common/decorators/trim.decorator';
import { PHONE_PATTERN } from '../../common/phone';

/**
 * Body sửa hồ sơ (spec 0008 AC-2 đến AC-5): chỉ `name` và `phone`, cả hai tùy chọn; trường vắng mặt thì giữ
 * nguyên. Mọi trường khác (`email`, `accountType`, `status`, `id`...) bị `forbidNonWhitelisted` chặn bằng 400.
 * `null` có nghĩa xóa giá trị; chủ trọ không xóa được số điện thoại, nhưng DTO không biết loại tài khoản nên
 * việc đó do `UsersService.updateProfile` chặn.
 */
export class UpdateProfileDto {
	/** Cắt khoảng trắng, tối đa 100 ký tự. `null` hoặc chuỗi rỗng sau khi cắt thì Service lưu null. */
	@IsOptional()
	@Trim()
	@IsString()
	@MaxLength(100)
	name?: string | null;

	/**
	 * Cùng chuẩn hóa và định dạng với đăng ký. `null` đi qua (xóa số, nếu loại tài khoản cho phép); chuỗi rỗng
	 * không đi qua mà bị `@Matches` chặn, như `RegisterDto`.
	 */
	@ValidateIf(
		(_dto: unknown, value: unknown) =>
			value !== undefined && value !== null,
	)
	@NormalizePhone()
	@IsString({ message: 'Số điện thoại không hợp lệ.' })
	@Matches(PHONE_PATTERN, { message: 'Số điện thoại không hợp lệ.' })
	phone?: string | null;
}
