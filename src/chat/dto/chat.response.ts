/** Một tin nhắn (spec 0013, "Hình dạng trả về"). `isMine` suy ra từ `senderId` và người gọi. */
export interface MessageResponse {
	readonly id: string;
	readonly seq: number;
	readonly senderId: string;
	readonly isMine: boolean;
	readonly body: string;
	readonly createdAt: Date;
}

/** Tin cuối của một cuộc trò chuyện: như tin nhắn nhưng không có `id`. */
export type LastMessageResponse = Omit<MessageResponse, 'id'>;

/**
 * Tin trong phần tử cuộc trò chuyện. `isPublic` đúng bằng việc khách mở được tin ở `GET /listings/:slugCode` ngay lúc
 * đọc; khi `false` thì `coverImageUrl` là `null` vì `/media/public` chỉ phát ảnh của tin đang hiện.
 */
export interface ConversationListingResponse {
	readonly id: string;
	readonly code: string;
	readonly slug: string;
	readonly title: string;
	readonly price: number;
	readonly coverImageUrl: string | null;
	readonly isPublic: boolean;
}

/**
 * Phần tử cuộc trò chuyện của hộp thư, chi tiết, route mở và route đánh dấu đã đọc. Không có số điện thoại, email
 * hay mốc đọc của ai; chỉ có số tin chưa đọc của chính người gọi.
 */
export interface ConversationResponse {
	readonly id: string;
	/** `tenant` khi người gọi là người nhắn (`tenant_id`), ngược lại `landlord`. */
	readonly myRole: 'tenant' | 'landlord';
	readonly listing: ConversationListingResponse;
	readonly otherUser: { readonly id: string; readonly name: string | null };
	readonly lastMessage: LastMessageResponse;
	readonly lastMessageAt: Date;
	readonly createdAt: Date;
	/** `last_seq` trừ mốc đã đọc của người gọi: đúng số tin của bên kia sau mốc (spec 0013 AC-10). */
	readonly unreadCount: number;
}

/** Kết quả của `GET /me/conversations/unread-count`: số cuộc trò chuyện còn tin chưa đọc và tổng số tin chưa đọc. */
export interface UnreadSummaryResponse {
	readonly unreadConversations: number;
	readonly unreadMessages: number;
}

/** Kết quả của `POST /listings/:id/conversations`. */
export interface OpenConversationResponse {
	readonly conversation: ConversationResponse;
	readonly message: MessageResponse;
}

/** Kết quả của `GET /conversations/:id/messages`: `items` luôn xếp `seq` tăng dần. */
export interface MessagesPageResponse {
	readonly items: readonly MessageResponse[];
	readonly hasMore: boolean;
	readonly lastSeq: number;
}
