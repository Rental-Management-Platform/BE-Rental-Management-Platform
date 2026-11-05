import {
	Body,
	Controller,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { ChatService } from './chat.service';
import {
	ConversationsQueryDto,
	MessagesQueryDto,
} from './dto/chat-queries.dto';
import type {
	ConversationResponse,
	MessageResponse,
	MessagesPageResponse,
	OpenConversationResponse,
	UnreadSummaryResponse,
} from './dto/chat.response';
import { ReadConversationDto } from './dto/read-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

/**
 * Mở cuộc trò chuyện từ một tin (spec 0013 AC-1, AC-2). Người nhắn luôn là người trong token. Trả 201 mặc định của
 * `POST`. `@FreshAuth()` để tài khoản vừa bị khóa dừng nhắn ngay (AC-5). Mọi route chat trả
 * `Cache-Control: private, no-store` vì nội dung riêng và đổi liên tục.
 */
@Controller('listings/:id/conversations')
export class ListingConversationsController {
	constructor(private readonly chat: ChatService) {}

	@Post()
	@RequirePermissions('conversation:create')
	@FreshAuth()
	@RateLimited('conversationStart')
	@Header('Cache-Control', 'private, no-store')
	open(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: SendMessageDto,
	): Promise<OpenConversationResponse> {
		return this.chat.open(user, id, dto.body, new Date());
	}
}

/**
 * Các route theo một cuộc trò chuyện (spec 0013 AC-3 đến AC-11): gửi tin, đọc tin theo con trỏ `seq`, chi tiết,
 * đánh dấu đã đọc.
 * Hai bên của cuộc trò chuyện là hai người duy nhất đọc được; người ngoài và id không có cùng 404.
 */
@Controller('conversations')
export class ConversationsController {
	constructor(private readonly chat: ChatService) {}

	@Post(':id/messages')
	@RequirePermissions('message:create')
	@FreshAuth()
	@RateLimited('messageWrite')
	@Header('Cache-Control', 'private, no-store')
	send(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: SendMessageDto,
	): Promise<MessageResponse> {
		return this.chat.send(user, id, dto.body);
	}

	@Get(':id/messages')
	@RequirePermissions('conversation:read')
	@RateLimited('chatRead')
	@Header('Cache-Control', 'private, no-store')
	messages(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Query() query: MessagesQueryDto,
	): Promise<MessagesPageResponse> {
		return this.chat.listMessages(user, id, query);
	}

	@Get(':id')
	@RequirePermissions('conversation:read')
	@RateLimited('chatRead')
	@Header('Cache-Control', 'private, no-store')
	detail(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<ConversationResponse> {
		return this.chat.get(user, id, new Date());
	}

	/**
	 * Đánh dấu đã đọc (spec 0013 AC-11): `200` kèm phần tử như `GET /conversations/:id`. Không `@FreshAuth()`: đọc
	 * luôn được, kể cả khi tài khoản vừa bị khóa (AC-5). Cùng nhóm `chatRead` với các route đọc, mỗi route đếm riêng.
	 */
	@Post(':id/read')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('conversation:update')
	@RateLimited('chatRead')
	@Header('Cache-Control', 'private, no-store')
	markRead(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: ReadConversationDto,
	): Promise<ConversationResponse> {
		return this.chat.markRead(user, id, dto.upToSeq, new Date());
	}
}

/** Hộp thư và cái chuông của chính người gọi (spec 0013 AC-7, AC-10). */
@Controller('me/conversations')
export class MeConversationsController {
	constructor(private readonly chat: ChatService) {}

	@Get()
	@RequirePermissions('conversation:read')
	@RateLimited('chatRead')
	@Header('Cache-Control', 'private, no-store')
	inbox(
		@CurrentUser() user: RequestUser,
		@Query() query: ConversationsQueryDto,
	): Promise<Page<ConversationResponse>> {
		return this.chat.listInbox(user, query, new Date());
	}

	/** Số cuộc trò chuyện còn tin chưa đọc và tổng số tin chưa đọc (AC-10). Không tham số. */
	@Get('unread-count')
	@RequirePermissions('conversation:read')
	@RateLimited('chatRead')
	@Header('Cache-Control', 'private, no-store')
	unreadCount(
		@CurrentUser() user: RequestUser,
	): Promise<UnreadSummaryResponse> {
		return this.chat.unreadSummary(user);
	}
}
