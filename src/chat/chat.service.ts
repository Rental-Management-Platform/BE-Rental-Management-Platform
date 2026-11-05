import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { ListingsRepository } from '../listings/listings.repository';
import type { PublicVisibility } from '../listings/listings.repository';
import { SettingsService } from '../settings/settings.service';
import { toConversationItem, toMessage } from './chat.mapper';
import { ChatRepository } from './chat.repository';
import type {
	ConversationRow,
	MessageWindow,
	ChatSide,
} from './chat.repository';
import type {
	ConversationResponse,
	MessageResponse,
	MessagesPageResponse,
	OpenConversationResponse,
	UnreadSummaryResponse,
} from './dto/chat.response';
import type {
	ConversationsQueryDto,
	MessagesQueryDto,
} from './dto/chat-queries.dto';

/**
 * Chat giữa người tìm trọ và chủ trọ (spec 0013). Người nhắn và người gửi luôn là người trong token, chủ trọ luôn
 * lấy từ tin; không bao giờ từ body hay đường dẫn. Mọi route đọc và ghi đều qua điều kiện "người gọi là một trong
 * hai bên" nằm ngay trong truy vấn, nên người ngoài và id không có cùng nhận 404 `CONVERSATION_NOT_FOUND`. Không
 * dòng log hay thông báo lỗi nào chứa nội dung tin nhắn.
 */
@Injectable()
export class ChatService {
	constructor(
		private readonly repository: ChatRepository,
		private readonly listings: ListingsRepository,
		private readonly settings: SettingsService,
		private readonly transactions: TransactionRunner,
	) {}

	/**
	 * Mở cuộc trò chuyện từ một tin hoặc nhắn thêm vào cuộc trò chuyện đã có của cặp (tin, người gọi) (spec 0013
	 * AC-1, AC-2). Thứ tự kiểm lỗi: admin (403), tin có đang hiện công khai không (không thì 404
	 * `LISTING_NOT_FOUND`, giống chi tiết tin, để không ai dò được tin đang ẩn), chủ trọ của tin có phải chính người
	 * gọi không (409 `CANNOT_CHAT_WITH_SELF`), rồi một giao dịch ghi. `now` là đồng hồ ứng dụng do controller lấy một
	 * lần mỗi request, dùng cho luật hiển thị công khai.
	 */
	async open(
		user: RequestUser,
		listingId: string,
		body: string,
		now: Date,
	): Promise<OpenConversationResponse> {
		this.assertNotAdmin(user);
		const visibility = await this.publicVisibility(now);
		const visible = await this.listings.isPubliclyVisible(
			listingId,
			visibility,
		);
		if (!visible) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		const landlordId = await this.listings.findLandlordIdOf(listingId);
		if (landlordId === null) {
			throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		}
		if (landlordId === user.userId) {
			throw new AppException(ErrorCode.CANNOT_CHAT_WITH_SELF);
		}
		const opened = await this.transactions.run((tx) =>
			this.repository.openConversation(
				{ listingId, tenantId: user.userId, landlordId, body },
				tx,
			),
		);
		const conversation = await this.readItem(
			opened.conversationId,
			user.userId,
			visibility,
		);
		return {
			conversation,
			message: toMessage(opened.message, user.userId),
		};
	}

	/**
	 * Gửi một tin vào cuộc trò chuyện (spec 0013 AC-3, AC-5). Thứ tự kiểm lỗi: admin (403), đọc cuộc trò chuyện kèm
	 * trạng thái hai tài khoản và kiểm người gọi là một trong hai bên (404), người kia còn hoạt động (409
	 * `CHAT_PEER_UNAVAILABLE` khi bị khóa hay xóa mềm), rồi một giao dịch ghi. Người kia bị khóa đúng giữa lúc đọc
	 * và lúc ghi thì tin vẫn được ghi; vô hại. Tài khoản của chính người gửi bị khóa đã bị `@FreshAuth` chặn trước.
	 */
	async send(
		user: RequestUser,
		conversationId: string,
		body: string,
	): Promise<MessageResponse> {
		this.assertNotAdmin(user);
		const conversation = await this.repository.findForSend(
			conversationId,
			user.userId,
		);
		if (conversation === null) {
			throw new AppException(ErrorCode.CONVERSATION_NOT_FOUND);
		}
		const side: ChatSide =
			conversation.tenantId === user.userId ? 'tenant' : 'landlord';
		const peer =
			side === 'tenant' ? conversation.landlord : conversation.tenant;
		if (peer.status !== 'active' || peer.deletedAt !== null) {
			throw new AppException(ErrorCode.CHAT_PEER_UNAVAILABLE);
		}
		const message = await this.transactions.run((tx) =>
			this.repository.appendMessage(
				{ conversationId, senderId: user.userId, side, body },
				tx,
			),
		);
		if (message === null) {
			throw new AppException(ErrorCode.CONVERSATION_NOT_FOUND);
		}
		return toMessage(message, user.userId);
	}

	/**
	 * Đọc tin theo `seq` (spec 0013 AC-6). Không đổi mốc đã đọc. `afterSeq` cùng `beforeSeq` là 400
	 * `VALIDATION_FAILED`, kiểm trước mọi lần đọc DB. `lastSeq` lấy lúc kiểm người gọi; nếu một tin đến giữa hai lần
	 * đọc thì `items` có thể có `seq` lớn hơn nó, nên trả số lớn hơn trong hai để `lastSeq` không bao giờ nhỏ hơn
	 * một phần tử.
	 */
	async listMessages(
		user: RequestUser,
		conversationId: string,
		query: MessagesQueryDto,
	): Promise<MessagesPageResponse> {
		this.assertNotAdmin(user);
		if (query.afterSeq !== undefined && query.beforeSeq !== undefined) {
			throw new AppException(ErrorCode.VALIDATION_FAILED, [
				{
					field: 'beforeSeq',
					code: 'afterSeqAndBeforeSeq',
					message:
						'Chỉ gửi afterSeq hoặc beforeSeq, không gửi cả hai.',
				},
			]);
		}
		const lastSeq = await this.repository.findParticipantLastSeq(
			conversationId,
			user.userId,
		);
		if (lastSeq === null) {
			throw new AppException(ErrorCode.CONVERSATION_NOT_FOUND);
		}
		const window: MessageWindow =
			query.afterSeq !== undefined
				? { kind: 'after', seq: query.afterSeq }
				: query.beforeSeq !== undefined
					? { kind: 'before', seq: query.beforeSeq }
					: { kind: 'latest' };
		const { rows, hasMore } = await this.repository.findMessages(
			conversationId,
			window,
			query.limit,
		);
		const newest = rows[rows.length - 1]?.seq ?? 0;
		return {
			items: rows.map((row) => toMessage(row, user.userId)),
			hasMore,
			lastSeq: Math.max(lastSeq, newest),
		};
	}

	/** Một cuộc trò chuyện của người gọi (spec 0013 AC-7, AC-8); người ngoài và id không có cùng 404. */
	async get(
		user: RequestUser,
		conversationId: string,
		now: Date,
	): Promise<ConversationResponse> {
		this.assertNotAdmin(user);
		return this.readItem(
			conversationId,
			user.userId,
			await this.publicVisibility(now),
		);
	}

	/**
	 * Hộp thư của người gọi, cái có tin mới nhất nằm trên (spec 0013 AC-7). `listingId` lọc theo một tin. Cờ
	 * `isPublic` của cả trang tính bằng một truy vấn qua đúng luật hiển thị công khai của danh sách tin.
	 */
	async listInbox(
		user: RequestUser,
		query: ConversationsQueryDto,
		now: Date,
	): Promise<Page<ConversationResponse>> {
		this.assertNotAdmin(user);
		const { rows, total } = await this.repository.findInboxPage(
			user.userId,
			query.listingId,
			skipOf(query),
			query.pageSize,
		);
		const items = await this.toItems(
			rows,
			user.userId,
			await this.publicVisibility(now),
		);
		return toPage(items, total, query);
	}

	/**
	 * Đánh dấu đã đọc tới `upToSeq` (spec 0013 AC-11). Một câu `UPDATE` kẹp mốc bằng `GREATEST` và `LEAST` và tự kiểm
	 * người gọi là một trong hai bên; không hàng nào khớp thì 404 `CONVERSATION_NOT_FOUND`, người ngoài và id không có
	 * không phân biệt được. Không kiểm người kia nên đọc luôn được, kể cả khi bên kia bị khóa (AC-5). Rồi đọc lại phần
	 * tử để trả đúng dạng `GET /conversations/:id` với `unreadCount` mới; tin đến giữa hai bước vẫn còn chưa đọc.
	 */
	async markRead(
		user: RequestUser,
		conversationId: string,
		upToSeq: number,
		now: Date,
	): Promise<ConversationResponse> {
		this.assertNotAdmin(user);
		const matched = await this.repository.advanceReadMarker(
			conversationId,
			user.userId,
			upToSeq,
		);
		if (!matched) throw new AppException(ErrorCode.CONVERSATION_NOT_FOUND);
		return this.readItem(
			conversationId,
			user.userId,
			await this.publicVisibility(now),
		);
	}

	/** Số cuộc trò chuyện còn tin chưa đọc và tổng số tin chưa đọc của người gọi, cho cái chuông (spec 0013 AC-10). */
	async unreadSummary(user: RequestUser): Promise<UnreadSummaryResponse> {
		this.assertNotAdmin(user);
		return this.repository.countUnread(user.userId);
	}

	/** Đọc một phần tử cuộc trò chuyện của người gọi, hoặc 404 `CONVERSATION_NOT_FOUND`. */
	private async readItem(
		conversationId: string,
		userId: string,
		visibility: PublicVisibility,
	): Promise<ConversationResponse> {
		const row = await this.repository.findForParticipant(
			conversationId,
			userId,
		);
		const [item] =
			row === null ? [] : await this.toItems([row], userId, visibility);
		if (item === undefined) {
			throw new AppException(ErrorCode.CONVERSATION_NOT_FOUND);
		}
		return item;
	}

	/**
	 * Ghép tin cuối (một truy vấn) và cờ `isPublic` (một truy vấn) vào các hàng của một trang. Hai truy vấn độc lập
	 * nên chạy song song trên kết nối thường, không phải trên một giao dịch.
	 */
	private async toItems(
		rows: readonly ConversationRow[],
		userId: string,
		visibility: PublicVisibility,
	): Promise<ConversationResponse[]> {
		const [lastMessages, publicIds] = await Promise.all([
			this.repository.findLastMessages(rows),
			this.listings.findPublicIds(
				rows.map((row) => row.listing.id),
				visibility,
			),
		]);
		return rows.flatMap((row) => {
			const lastMessage = lastMessages.get(row.id);
			return lastMessage === undefined
				? []
				: [
						toConversationItem(
							row,
							lastMessage,
							userId,
							publicIds.has(row.listing.id),
						),
					];
		});
	}

	/**
	 * Admin không dùng chat (spec 0013 AC-8: 403 `PERMISSION_DENIED`, không ghi dòng nào). Quyền của admin tính trong
	 * code là `manage` mọi module (`ADMIN_PERMISSIONS`), nên `conversation:*` và `message:*` qua được guard quyền;
	 * kiểm loại tài khoản ở đây, như theo dõi chủ trọ (spec 0005), lưu tin (spec 0006) và đơn mua gói (spec 0004).
	 * Chat không có góc nhìn kiểm duyệt cho admin; muốn dừng một người lạm dụng thì khóa tài khoản. Chạy sau kiểm
	 * `INVALID_ID` và `VALIDATION_FAILED` của pipe, nên admin gửi id hay body sai nhận 400 chứ không phải 403.
	 */
	private assertNotAdmin(user: RequestUser): void {
		if (user.accountType === 'admin') {
			throw new AppException(ErrorCode.PERMISSION_DENIED);
		}
	}

	/** Hạn mức dùng thử đọc một lần mỗi request cho luật hiển thị công khai, giống `GET /listings`. */
	private async publicVisibility(now: Date): Promise<PublicVisibility> {
		return {
			now,
			trialListingLimit: await this.settings.getValue(
				'trial_listing_limit',
			),
		};
	}
}
