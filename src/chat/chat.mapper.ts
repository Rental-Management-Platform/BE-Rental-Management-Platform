import { toSlug } from '../common/text/to-slug';
import { toImageUrl } from '../listings/listings.mapper';
import type {
	ConversationResponse,
	MessageResponse,
} from './dto/chat.response';
import type { ConversationRow, MessageRow } from './chat.repository';

/** Tên trống hay chỉ khoảng trắng là `null`: giá trị trống không bao giờ là chuỗi rỗng (như tên chủ trọ ở tin công khai). */
function orNull(value: string | null): string | null {
	return value === null || value.trim() === '' ? null : value;
}

/** Một tin nhắn: `isMine` là `sender_id` bằng người gọi (spec 0013, "Value sourcing"). */
export function toMessage(row: MessageRow, userId: string): MessageResponse {
	return {
		id: row.id,
		seq: row.seq,
		senderId: row.senderId,
		isMine: row.senderId === userId,
		body: row.body,
		createdAt: row.createdAt,
	};
}

/**
 * Phần tử cuộc trò chuyện của hộp thư, chi tiết và route mở (spec 0013 AC-7). `myRole` là `tenant` khi người gọi là
 * `tenant_id`, ngược lại `landlord`; `otherUser` là bên còn lại, chỉ `id` và `name`. Tin nằm ở `listing` giữ
 * `title`, `code`, `slug`, `price` của chính nó kể cả khi đã xóa mềm. `coverImageUrl` chỉ có khi `isPublic`, vì
 * `/media/public` không phát ảnh của tin đang ẩn. `unreadCount` (AC-10) là `last_seq` trừ mốc đã đọc của người gọi:
 * gửi tin đã dời mốc của chính mình tới `seq` mới, nên phần còn lại đúng là tin của bên kia; mốc đọc không bao giờ
 * ra khỏi phản hồi, chỉ hiệu số.
 */
export function toConversationItem(
	row: ConversationRow,
	lastMessage: MessageRow,
	userId: string,
	isPublic: boolean,
): ConversationResponse {
	const isTenant = row.tenantId === userId;
	const other = isTenant ? row.landlord : row.tenant;
	const cover = row.listing.images[0];
	return {
		id: row.id,
		myRole: isTenant ? 'tenant' : 'landlord',
		listing: {
			id: row.listing.id,
			code: row.listing.code,
			slug: toSlug(row.listing.title),
			title: row.listing.title,
			price: row.listing.price,
			coverImageUrl:
				isPublic && cover !== undefined
					? toImageUrl(cover.storageKey)
					: null,
			isPublic,
		},
		otherUser: { id: other.id, name: orNull(other.name) },
		lastMessage: {
			seq: lastMessage.seq,
			senderId: lastMessage.senderId,
			isMine: lastMessage.senderId === userId,
			body: lastMessage.body,
			createdAt: lastMessage.createdAt,
		},
		lastMessageAt: row.lastMessageAt,
		createdAt: row.createdAt,
		unreadCount:
			row.lastSeq - (isTenant ? row.tenantReadSeq : row.landlordReadSeq),
	};
}
