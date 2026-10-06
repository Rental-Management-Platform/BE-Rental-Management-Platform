import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class LoginDto {
  @Trim()
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** Không @MinLength: chính sách độ dài chỉ áp khi đặt mật khẩu, không chặn nhầm tài khoản cũ. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}
