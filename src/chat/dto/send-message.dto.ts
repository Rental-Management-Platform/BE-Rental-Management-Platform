import { IsNotEmpty, IsString, MaxLength, NotContains } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { CHAT_LIMITS } from '../chat-limits';

/**
 * Body của mở cuộc trò chuyện và gửi tin (spec 0013 AC-4): chuỗi, bỏ khoảng trắng hai đầu, dài 1 đến 1000 ký tự sau
 * khi bỏ, không chứa NUL. Xuống dòng ở giữa được giữ nguyên. NUL phải bị chặn ở đây vì PostgreSQL không lưu được
 * `\u0000` trong `text`, lọt xuống DB sẽ thành lỗi 500.
 */
export class SendMessageDto {
	@Trim()
	@IsString()
	@IsNotEmpty({ message: 'Tin nhắn không được để trống.' })
	@MaxLength(CHAT_LIMITS.bodyMax, {
		message: `Tin nhắn tối đa ${CHAT_LIMITS.bodyMax} ký tự.`,
	})
	@NotContains('\u0000', { message: 'Tin nhắn chứa ký tự không hợp lệ.' })
	body: string;
}
