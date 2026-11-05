import { IsInt, Max, Min } from 'class-validator';
import { CHAT_LIMITS } from '../chat-limits';

/**
 * Body của `POST /conversations/:id/read` (spec 0013 AC-11): `upToSeq` là số nguyên từ 0 đến giới hạn của cột int.
 * Số lớn hơn `last_seq` của cuộc trò chuyện không phải lỗi: DB kẹp xuống `last_seq`. Không đổi kiểu từ chuỗi, nên
 * `"3"` bị 400 như mọi trường số khác trong body.
 */
export class ReadConversationDto {
	@IsInt()
	@Min(0)
	@Max(CHAT_LIMITS.seqMax)
	upToSeq: number;
}
