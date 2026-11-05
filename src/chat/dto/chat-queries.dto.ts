import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination';
import { CHAT_LIMITS } from '../chat-limits';

/**
 * Query của `GET /conversations/:id/messages` (spec 0013 AC-6): `limit` 1 đến 100 (mặc định 30), `afterSeq` từ 0,
 * `beforeSeq` từ 1. Gửi cả hai là 400 `VALIDATION_FAILED`; Service chặn vì cần so hai trường.
 */
export class MessagesQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(CHAT_LIMITS.messagesMax)
	limit: number = CHAT_LIMITS.messagesDefault;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(CHAT_LIMITS.seqMax)
	afterSeq?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(CHAT_LIMITS.seqMax)
	beforeSeq?: number;
}

/** Query của `GET /me/conversations` (spec 0013 AC-7): phân trang chung cộng lọc tùy chọn theo một tin. */
export class ConversationsQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsUUID(undefined, { message: 'Phải là mã tin hợp lệ.' })
	listingId?: string;
}
