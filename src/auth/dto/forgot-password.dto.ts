import { IsEmail, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

export class ForgotPasswordDto {
	@Trim()
	@IsEmail()
	@MaxLength(254)
	email: string;
}
