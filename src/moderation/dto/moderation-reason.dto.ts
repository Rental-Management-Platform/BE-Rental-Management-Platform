import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';

/** Khóa và mở khóa bắt buộc có lý do (BR-13). */
export class ModerationReasonDto {
	@Trim()
	@IsString()
	@IsNotEmpty({ message: 'Phải nêu lý do.' })
	@MaxLength(500)
	reason: string;
}
