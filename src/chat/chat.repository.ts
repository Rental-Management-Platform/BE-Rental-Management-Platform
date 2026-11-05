import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';

/** Bên nào của cuộc trò chuyện: người nhắn (`tenant_id`) hay chủ trọ (`landlord_id`). */
export type ChatSide = 'tenant' | 'landlord';

/** Ảnh bìa của tin trong hộp thư là ảnh có `position` nhỏ nhất, như tin tóm tắt công khai. */
const coverImage = {
	orderBy: { position: 'asc' },
	take: 1,
	select: { storageKey: true },
} satisfies Prisma.Listing$imagesArgs;

/**
 * Phần tin và hai người của một phần tử cuộc trò chuyện. Chỉ chọn `id` và `name` của người dùng: chat không bao giờ
 * đọc, nên không bao giờ trả, số điện thoại hay email (spec 0013 AC-7, AC-8). Tin đã xóa mềm vẫn đọc được.
 */
const conversationInclude = {
	listing: {
		select: {
			id: true,
			code: true,
			title: true,
			price: true,
			images: coverImage,
		},
	},
	tenant: { select: { id: true, name: true } },
	landlord: { select: { id: true, name: true } },
} satisfies Prisma.ConversationInclude;

/** Trạng thái của người kia, để quyết định gửi được hay không (spec 0013 AC-5). */
const peerSelect = {
	id: true,
	status: true,
	deletedAt: true,
} satisfies Prisma.UserSelect;

const messageSelect = {
	id: true,
	seq: true,
	senderId: true,
	body: true,
	createdAt: true,
} satisfies Prisma.MessageSelect;

export type ConversationRow = Prisma.ConversationGetPayload<{
	include: typeof conversationInclude;
}>;

/** Cuộc trò chuyện kèm trạng thái hai tài khoản, đủ để kiểm người gọi và người kia trước khi gửi. */
export type ConversationForSend = Prisma.ConversationGetPayload<{
	select: {
		id: true;
		tenantId: true;
		landlordId: true;
		tenant: { select: typeof peerSelect };
		landlord: { select: typeof peerSelect };
	};
}>;

export type MessageRow = Prisma.MessageGetPayload<{
	select: typeof messageSelect;
}>;

/** Tin cuối của một cuộc trò chuyện, kèm id cuộc trò chuyện để ghép lại với hộp thư. */
export interface LastMessageRow extends MessageRow {
	readonly conversationId: string;
}

/** Cửa sổ đọc tin theo `seq` (spec 0013 AC-6): tin mới nhất, các tin sau `seq`, hoặc các tin ngay trước `seq`. */
export type MessageWindow =
	| { readonly kind: 'latest' }
	| { readonly kind: 'after'; readonly seq: number }
	| { readonly kind: 'before'; readonly seq: number };

interface WriteResult {
	readonly id: string;
	readonly last_seq: number;
	readonly last_message_at: Date;
}

/** Hai số của `countUnread` khi đọc thô: Prisma trả `bigint` cho `count` và `sum`. */
interface UnreadRawRow {
	readonly unreadConversations: bigint;
	readonly unreadMessages: bigint;
}

/**
 * Nơi duy nhất chạm hai bảng `conversations` và `messages` (spec 0013). Hai việc ghi tin dùng SQL thô để `seq` đúng
 * và liên tiếp: câu lệnh tăng `last_seq` khóa hàng cuộc trò chuyện nên các lần ghi đồng thời xếp hàng. Việc đánh dấu
 * đã đọc và đếm chưa đọc cũng là SQL thô (`GREATEST`/`LEAST` và `UNION ALL` mà Prisma không viết được). Việc đọc cờ
 * công khai của tin nằm ở `ListingsRepository` (nơi duy nhất giữ hai mảnh SQL hiển thị công khai).
 *
 * `last_message_at` và `created_at` của tin mới lấy từ `clock_timestamp()` của DB, đánh giá trong chính câu lệnh đã
 * khóa hàng, rồi tin nhắn lấy đúng giá trị đó. Nhờ vậy giờ không bao giờ lùi so với `seq`, kể cả khi hai giao dịch
 * bắt đầu theo một thứ tự và lấy khóa theo thứ tự khác (`now()` là giờ bắt đầu giao dịch nên có thể lùi).
 */
@Injectable()
export class ChatRepository {
	constructor(private readonly prisma: PrismaService) {}

	// ----- ghi -----

	/**
	 * Mở cuộc trò chuyện hoặc thêm tin vào cuộc trò chuyện đã có của cặp (tin, người nhắn), rồi ghi tin (spec 0013 AC-1).
	 * Một câu `INSERT ... ON CONFLICT (listing_id, tenant_id) DO UPDATE`: tạo mới thì `last_seq` và mốc đọc của người
	 * nhắn là 1; đã có thì tăng `last_seq` thêm 1, dời mốc của người nhắn tới `seq` mới (gửi tin coi như đã đọc hết)
	 * và đặt giờ tin cuối. `landlord_id` của hàng đã có không bị đổi. Hai lần gọi đồng thời ra đúng một hàng và hai
	 * `seq` liên tiếp. Gọi trong giao dịch, tuần tự: không chạy hai truy vấn song song trên cùng `tx`.
	 */
	async openConversation(
		input: {
			readonly listingId: string;
			readonly tenantId: string;
			readonly landlordId: string;
			readonly body: string;
		},
		tx: Prisma.TransactionClient,
	): Promise<{ conversationId: string; message: MessageRow }> {
		const rows = await tx.$queryRaw<WriteResult[]>`
			INSERT INTO conversations
				(listing_id, tenant_id, landlord_id, last_seq, tenant_read_seq, last_message_at)
			VALUES
				(${input.listingId}::uuid, ${input.tenantId}::uuid, ${input.landlordId}::uuid, 1, 1, clock_timestamp())
			ON CONFLICT (listing_id, tenant_id) DO UPDATE
			SET last_seq = conversations.last_seq + 1,
				tenant_read_seq = conversations.last_seq + 1,
				last_message_at = clock_timestamp()
			RETURNING id, last_seq, last_message_at`;
		const written = this.single(rows);
		const message = await tx.message.create({
			data: {
				conversationId: written.id,
				seq: written.last_seq,
				senderId: input.tenantId,
				body: input.body,
				createdAt: written.last_message_at,
			},
			select: messageSelect,
		});
		return { conversationId: written.id, message };
	}

	/**
	 * Thêm một tin vào cuộc trò chuyện có sẵn (spec 0013 AC-3). Một câu `UPDATE ... RETURNING` tăng `last_seq`, đặt
	 * giờ tin cuối và dời mốc đã đọc của chính người gửi tới `seq` mới; nó khóa hàng nên các lần gửi cùng lúc xếp
	 * hàng và nhận `seq` liên tiếp. Rồi ghi tin với đúng `seq` đó. Cột mốc chọn theo bên của người gửi bằng hai câu
	 * lệnh riêng, không dùng `CASE`. Trả `null` nếu không có hàng nào (cuộc trò chuyện không tồn tại).
	 */
	async appendMessage(
		input: {
			readonly conversationId: string;
			readonly senderId: string;
			readonly side: ChatSide;
			readonly body: string;
		},
		tx: Prisma.TransactionClient,
	): Promise<MessageRow | null> {
		const rows =
			input.side === 'tenant'
				? await tx.$queryRaw<WriteResult[]>`
					UPDATE conversations
					SET last_seq = last_seq + 1,
						tenant_read_seq = last_seq + 1,
						last_message_at = clock_timestamp()
					WHERE id = ${input.conversationId}::uuid
					RETURNING id, last_seq, last_message_at`
				: await tx.$queryRaw<WriteResult[]>`
					UPDATE conversations
					SET last_seq = last_seq + 1,
						landlord_read_seq = last_seq + 1,
						last_message_at = clock_timestamp()
					WHERE id = ${input.conversationId}::uuid
					RETURNING id, last_seq, last_message_at`;
		const written = rows[0];
		if (written === undefined) return null;
		return tx.message.create({
			data: {
				conversationId: written.id,
				seq: written.last_seq,
				senderId: input.senderId,
				body: input.body,
				createdAt: written.last_message_at,
			},
			select: messageSelect,
		});
	}

	/**
	 * Dời mốc đã đọc của người gọi tới `upToSeq`, không lùi và không vượt tin cuối (spec 0013 AC-11): mốc mới là
	 * `GREATEST(mốc cũ, LEAST(upToSeq, last_seq))`. Điều kiện "người gọi là một trong hai bên" nằm ngay trong câu
	 * `UPDATE` (thử bên người nhắn trước, rồi bên chủ trọ; `tenant_id` khác `landlord_id` nên tối đa một câu khớp),
	 * và mỗi bên một câu riêng vì cột mốc khác nhau, không dùng `CASE`. Câu lệnh khóa hàng và đọc `last_seq` mới nhất
	 * sau khi chờ khóa, nên một tin đến giữa chừng không bao giờ làm mốc vượt `last_seq`. Không đụng `last_seq` hay
	 * `last_message_at`. Trả `false` khi không câu nào khớp (không có cuộc trò chuyện, hay người gọi là người ngoài);
	 * gọi lặp vẫn khớp nên vẫn `true`.
	 */
	async advanceReadMarker(
		conversationId: string,
		userId: string,
		upToSeq: number,
	): Promise<boolean> {
		const asTenant = await this.prisma.$executeRaw`
			UPDATE conversations
			SET tenant_read_seq = GREATEST(tenant_read_seq, LEAST(${upToSeq}::int, last_seq))
			WHERE id = ${conversationId}::uuid AND tenant_id = ${userId}::uuid`;
		if (asTenant > 0) return true;
		const asLandlord = await this.prisma.$executeRaw`
			UPDATE conversations
			SET landlord_read_seq = GREATEST(landlord_read_seq, LEAST(${upToSeq}::int, last_seq))
			WHERE id = ${conversationId}::uuid AND landlord_id = ${userId}::uuid`;
		return asLandlord > 0;
	}

	private single(rows: readonly WriteResult[]): WriteResult {
		const row = rows[0];
		if (row === undefined) {
			throw new Error('Câu lệnh ghi cuộc trò chuyện không trả dòng nào.');
		}
		return row;
	}

	// ----- đọc -----

	/**
	 * Cuộc trò chuyện của đúng hai bên, hoặc `null` khi không có hay người gọi không phải một trong hai bên: hai
	 * trường hợp không phân biệt được (spec 0013 AC-8). Điều kiện người tham gia nằm ngay trong truy vấn.
	 */
	findForParticipant(
		id: string,
		userId: string,
	): Promise<ConversationRow | null> {
		return this.prisma.conversation.findFirst({
			where: {
				id,
				OR: [{ tenantId: userId }, { landlordId: userId }],
			},
			include: conversationInclude,
		});
	}

	/** Như `findForParticipant` nhưng chỉ đọc `id` và `last_seq`, đủ để kiểm người gọi trước khi đọc tin. */
	findParticipantLastSeq(id: string, userId: string): Promise<number | null> {
		return this.prisma.conversation
			.findFirst({
				where: {
					id,
					OR: [{ tenantId: userId }, { landlordId: userId }],
				},
				select: { lastSeq: true },
			})
			.then((row) => row?.lastSeq ?? null);
	}

	/** Cuộc trò chuyện kèm trạng thái hai tài khoản, không khóa: dùng để kiểm trước khi gửi (spec 0013 AC-3, AC-5). */
	findForSend(
		id: string,
		userId: string,
	): Promise<ConversationForSend | null> {
		return this.prisma.conversation.findFirst({
			where: {
				id,
				OR: [{ tenantId: userId }, { landlordId: userId }],
			},
			select: {
				id: true,
				tenantId: true,
				landlordId: true,
				tenant: { select: peerSelect },
				landlord: { select: peerSelect },
			},
		});
	}

	/**
	 * Một trang hộp thư của `userId`, mới nhất trước, kèm tổng số (spec 0013 AC-7). Điều kiện
	 * `tenant_id = ? OR landlord_id = ?` có chỉ mục riêng cho mỗi nhánh; thứ tự `last_message_at` giảm dần rồi `id`
	 * giảm dần. `listingId` lọc theo một tin khi có.
	 */
	async findInboxPage(
		userId: string,
		listingId: string | undefined,
		skip: number,
		take: number,
	): Promise<{ rows: ConversationRow[]; total: number }> {
		const where = {
			OR: [{ tenantId: userId }, { landlordId: userId }],
			...(listingId === undefined ? {} : { listingId }),
		} satisfies Prisma.ConversationWhereInput;
		const [rows, total] = await Promise.all([
			this.prisma.conversation.findMany({
				where,
				orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
				include: conversationInclude,
			}),
			this.prisma.conversation.count({ where }),
		]);
		return { rows, total };
	}

	/**
	 * Số cuộc trò chuyện còn tin chưa đọc và tổng số tin chưa đọc của `userId` (spec 0013 AC-10): `last_seq` trừ
	 * mốc đã đọc của người gọi, gom từ hai nhánh (là người nhắn, là chủ trọ) mỗi nhánh dùng chỉ mục riêng. Một hàng
	 * không bao giờ nằm ở cả hai nhánh vì `tenant_id` khác `landlord_id`, nên `UNION ALL` không đếm đôi. `count` và
	 * `sum` của PostgreSQL là `bigint`; đổi sang `number` bằng `Number()` (số tin của một người xa dưới 2^53).
	 */
	async countUnread(
		userId: string,
	): Promise<{ unreadConversations: number; unreadMessages: number }> {
		const rows = await this.prisma.$queryRaw<UnreadRawRow[]>`
			SELECT count(*) FILTER (WHERE unread > 0) AS "unreadConversations",
			       COALESCE(sum(unread), 0) AS "unreadMessages"
			FROM (
				SELECT last_seq - tenant_read_seq AS unread
				FROM conversations WHERE tenant_id = ${userId}::uuid
				UNION ALL
				SELECT last_seq - landlord_read_seq AS unread
				FROM conversations WHERE landlord_id = ${userId}::uuid
			) AS mine`;
		const row = rows[0];
		return {
			unreadConversations: Number(row?.unreadConversations ?? 0),
			unreadMessages: Number(row?.unreadMessages ?? 0),
		};
	}

	/**
	 * Tin cuối của từng cuộc trò chuyện (`seq` bằng `last_seq`), một truy vấn theo khóa (`conversation_id`, `seq`)
	 * cho cả trang. Cuộc trò chuyện nào không có tin thì vắng mặt (không xảy ra: mở luôn ghi tin 1).
	 */
	async findLastMessages(
		conversations: readonly { id: string; lastSeq: number }[],
	): Promise<ReadonlyMap<string, LastMessageRow>> {
		if (conversations.length === 0) return new Map();
		const rows = await this.prisma.message.findMany({
			where: {
				OR: conversations.map((conversation) => ({
					conversationId: conversation.id,
					seq: conversation.lastSeq,
				})),
			},
			select: { ...messageSelect, conversationId: true },
		});
		return new Map(rows.map((row) => [row.conversationId, row]));
	}

	/**
	 * Tối đa `limit` tin theo cửa sổ, luôn trả theo `seq` tăng dần, kèm `hasMore` (spec 0013 AC-6). Lấy `limit + 1`
	 * hàng theo chỉ mục (`conversation_id`, `seq`) rồi cắt lại: `latest` và `before` đọc từ `seq` lớn xuống rồi đảo
	 * lại (hàng dư là tin cũ hơn nhất); `after` đọc từ nhỏ lên (hàng dư là tin mới hơn nhất).
	 */
	async findMessages(
		conversationId: string,
		window: MessageWindow,
		limit: number,
	): Promise<{ rows: MessageRow[]; hasMore: boolean }> {
		const ascending = window.kind === 'after';
		const found = await this.prisma.message.findMany({
			where: {
				conversationId,
				...(window.kind === 'after' ? { seq: { gt: window.seq } } : {}),
				...(window.kind === 'before'
					? { seq: { lt: window.seq } }
					: {}),
			},
			orderBy: { seq: ascending ? 'asc' : 'desc' },
			take: limit + 1,
			select: messageSelect,
		});
		const hasMore = found.length > limit;
		const page = hasMore ? found.slice(0, limit) : found;
		return { rows: ascending ? page : page.reverse(), hasMore };
	}
}
