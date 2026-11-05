import type { AccountType } from '../common/auth/account-type';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import type { ListingsRepository } from '../listings/listings.repository';
import type { SettingsService } from '../settings/settings.service';
import {
	ADMIN_ID,
	CONVERSATION_ID,
	LANDLORD_ID,
	LISTING_ID,
	NOW,
	OUTSIDER_ID,
	TENANT_ID,
	conversationRow,
	messageRow,
} from './chat.fixtures';
import type {
	ChatRepository,
	ConversationForSend,
	ConversationRow,
	LastMessageRow,
	MessageRow,
} from './chat.repository';
import { ChatService } from './chat.service';
import type { MessagesQueryDto } from './dto/chat-queries.dto';

function userOf(userId: string, accountType: AccountType): RequestUser {
	return { userId, sessionId: 'phien-1', accountType, permissions: [] };
}

const TENANT = userOf(TENANT_ID, 'tenant');
const LANDLORD = userOf(LANDLORD_ID, 'landlord');
const ADMIN = userOf(ADMIN_ID, 'admin');

/** Giao dịch giả: `run` chạy hàm với cái này, để test thấy Repository nhận đúng `tx` của Service. */
const TX = { tx: true };

interface Options {
	visible?: boolean;
	landlordId?: string | null;
	opened?: { conversationId: string; message: MessageRow };
	row?: ConversationRow | null;
	forSend?: ConversationForSend | null;
	appended?: MessageRow | null;
	lastSeq?: number | null;
	window?: { rows: MessageRow[]; hasMore: boolean };
	inbox?: { rows: ConversationRow[]; total: number };
	publicIds?: string[];
	lastMessages?: LastMessageRow[];
	advanced?: boolean;
	unread?: { unreadConversations: number; unreadMessages: number };
}

function active(id: string) {
	return { id, status: 'active', deletedAt: null as Date | null };
}

function forSend(
	peers: {
		tenant?: Partial<ReturnType<typeof active>>;
		landlord?: Partial<ReturnType<typeof active>>;
	} = {},
): ConversationForSend {
	return {
		id: CONVERSATION_ID,
		tenantId: TENANT_ID,
		landlordId: LANDLORD_ID,
		tenant: { ...active(TENANT_ID), ...peers.tenant },
		landlord: { ...active(LANDLORD_ID), ...peers.landlord },
	};
}

function build(options: Options = {}) {
	const row = options.row === undefined ? conversationRow() : options.row;
	const repository = {
		openConversation: jest.fn(() =>
			Promise.resolve(
				options.opened ?? {
					conversationId: CONVERSATION_ID,
					message: messageRow(1, TENANT_ID),
				},
			),
		),
		appendMessage: jest.fn(() =>
			Promise.resolve(
				options.appended === undefined
					? messageRow(5, TENANT_ID)
					: options.appended,
			),
		),
		findForParticipant: jest.fn(() => Promise.resolve(row)),
		findParticipantLastSeq: jest.fn(() =>
			Promise.resolve(
				options.lastSeq === undefined ? 4 : options.lastSeq,
			),
		),
		findForSend: jest.fn(() =>
			Promise.resolve(
				options.forSend === undefined ? forSend() : options.forSend,
			),
		),
		findInboxPage: jest.fn(() =>
			Promise.resolve(options.inbox ?? { rows: [], total: 0 }),
		),
		findLastMessages: jest.fn(
			(rows: readonly { id: string; lastSeq: number }[]) =>
				Promise.resolve(
					new Map(
						(
							options.lastMessages ??
							rows.map((r) => ({
								...messageRow(r.lastSeq, TENANT_ID),
								conversationId: r.id,
							}))
						).map((m) => [m.conversationId, m]),
					),
				),
		),
		findMessages: jest.fn(() =>
			Promise.resolve(options.window ?? { rows: [], hasMore: false }),
		),
		advanceReadMarker: jest.fn(() =>
			Promise.resolve(options.advanced ?? true),
		),
		countUnread: jest.fn(() =>
			Promise.resolve(
				options.unread ?? { unreadConversations: 0, unreadMessages: 0 },
			),
		),
	};
	const listings = {
		isPubliclyVisible: jest.fn(() =>
			Promise.resolve(options.visible ?? true),
		),
		findLandlordIdOf: jest.fn(() =>
			Promise.resolve(
				options.landlordId === undefined
					? LANDLORD_ID
					: options.landlordId,
			),
		),
		findPublicIds: jest.fn(() =>
			Promise.resolve(new Set(options.publicIds ?? [LISTING_ID])),
		),
	};
	const settings = { getValue: jest.fn(() => Promise.resolve(3)) };
	const transactions = {
		run: jest.fn(<T>(fn: (tx: unknown) => Promise<T>) => fn(TX)),
	};
	const service = new ChatService(
		repository as unknown as ChatRepository,
		listings as unknown as ListingsRepository,
		settings as unknown as SettingsService,
		transactions as unknown as TransactionRunner,
	);
	return { service, repository, listings, settings, transactions };
}

async function errorOf(promise: Promise<unknown>): Promise<AppException> {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(AppException);
	return error as AppException;
}

function query(partial: Partial<MessagesQueryDto> = {}): MessagesQueryDto {
	return Object.assign({ limit: 30 } as MessagesQueryDto, partial);
}

describe('ChatService.open (spec 0013 AC-1, AC-2, AC-8)', () => {
	it('tin hiện công khai: ghi bằng một giao dịch với người nhắn từ token, chủ trọ từ tin, nội dung từ body', async () => {
		const { service, repository, transactions } = build();
		const result = await service.open(
			TENANT,
			LISTING_ID,
			'Còn phòng không?',
			NOW,
		);
		expect(transactions.run).toHaveBeenCalledTimes(1);
		expect(repository.openConversation).toHaveBeenCalledWith(
			{
				listingId: LISTING_ID,
				tenantId: TENANT_ID,
				landlordId: LANDLORD_ID,
				body: 'Còn phòng không?',
			},
			TX,
		);
		expect(result.message).toMatchObject({
			seq: 1,
			senderId: TENANT_ID,
			isMine: true,
		});
		expect(result.conversation).toMatchObject({
			id: CONVERSATION_ID,
			myRole: 'tenant',
		});
	});

	it('kiểm hiển thị bằng đúng `now` của request và hạn mức dùng thử đọc một lần từ settings', async () => {
		const { service, listings, settings } = build();
		await service.open(TENANT, LISTING_ID, 'Chào', NOW);
		expect(settings.getValue).toHaveBeenCalledTimes(1);
		expect(settings.getValue).toHaveBeenCalledWith('trial_listing_limit');
		expect(listings.isPubliclyVisible).toHaveBeenCalledWith(LISTING_ID, {
			now: NOW,
			trialListingLimit: 3,
		});
		expect(listings.findPublicIds).toHaveBeenCalledWith([LISTING_ID], {
			now: NOW,
			trialListingLimit: 3,
		});
	});

	it('đọc lại phần tử cuộc trò chuyện theo id vừa ghi và theo người gọi', async () => {
		const { service, repository } = build();
		await service.open(TENANT, LISTING_ID, 'Chào', NOW);
		expect(repository.findForParticipant).toHaveBeenCalledWith(
			CONVERSATION_ID,
			TENANT_ID,
		);
	});

	it('tin không hiện công khai: 404 LISTING_NOT_FOUND, không mở giao dịch, không đọc chủ trọ', async () => {
		const { service, repository, transactions, listings } = build({
			visible: false,
		});
		const error = await errorOf(
			service.open(TENANT, LISTING_ID, 'Chào', NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_NOT_FOUND);
		expect(transactions.run).not.toHaveBeenCalled();
		expect(repository.openConversation).not.toHaveBeenCalled();
		expect(listings.findLandlordIdOf).not.toHaveBeenCalled();
	});

	it('tin biến mất giữa lúc kiểm và lúc đọc chủ trọ: 404 LISTING_NOT_FOUND, không ghi', async () => {
		const { service, repository } = build({ landlordId: null });
		const error = await errorOf(
			service.open(TENANT, LISTING_ID, 'Chào', NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_NOT_FOUND);
		expect(repository.openConversation).not.toHaveBeenCalled();
	});

	it('chủ trọ của tin tự mở cuộc trò chuyện (đã được cấp quyền): 409 CANNOT_CHAT_WITH_SELF, không ghi', async () => {
		const { service, repository, transactions } = build();
		const error = await errorOf(
			service.open(LANDLORD, LISTING_ID, 'Chào', NOW),
		);
		expect(error.code).toBe(ErrorCode.CANNOT_CHAT_WITH_SELF);
		expect(transactions.run).not.toHaveBeenCalled();
		expect(repository.openConversation).not.toHaveBeenCalled();
	});

	it('chủ trọ được cấp quyền mở với tin của chủ trọ khác thì được, tư cách người nhắn', async () => {
		const { service, repository } = build({ landlordId: OUTSIDER_ID });
		await service.open(LANDLORD, LISTING_ID, 'Chào', NOW);
		expect(repository.openConversation).toHaveBeenCalledWith(
			expect.objectContaining({
				tenantId: LANDLORD_ID,
				landlordId: OUTSIDER_ID,
			}),
			TX,
		);
	});

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn, không ghi dòng nào', async () => {
		const { service, repository, listings, settings, transactions } =
			build();
		const error = await errorOf(
			service.open(ADMIN, LISTING_ID, 'Chào', NOW),
		);
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(settings.getValue).not.toHaveBeenCalled();
		expect(listings.isPubliclyVisible).not.toHaveBeenCalled();
		expect(transactions.run).not.toHaveBeenCalled();
		expect(repository.openConversation).not.toHaveBeenCalled();
	});
});

describe('ChatService.send (spec 0013 AC-3, AC-5, AC-8)', () => {
	it('người nhắn gửi: ghi bên tenant bằng một giao dịch, trả tin của chính mình', async () => {
		const { service, repository, transactions } = build();
		const message = await service.send(TENANT, CONVERSATION_ID, 'Chào anh');
		expect(transactions.run).toHaveBeenCalledTimes(1);
		expect(repository.appendMessage).toHaveBeenCalledWith(
			{
				conversationId: CONVERSATION_ID,
				senderId: TENANT_ID,
				side: 'tenant',
				body: 'Chào anh',
			},
			TX,
		);
		expect(message).toMatchObject({ seq: 5, isMine: true });
	});

	it('chủ trọ trả lời: ghi bên landlord, isMine theo người gọi', async () => {
		const { service, repository } = build({
			appended: messageRow(5, LANDLORD_ID),
		});
		const message = await service.send(
			LANDLORD,
			CONVERSATION_ID,
			'Còn nhé',
		);
		expect(repository.appendMessage).toHaveBeenCalledWith(
			{
				conversationId: CONVERSATION_ID,
				senderId: LANDLORD_ID,
				side: 'landlord',
				body: 'Còn nhé',
			},
			TX,
		);
		expect(message.isMine).toBe(true);
	});

	it('kiểm người gọi ngay trong truy vấn đọc: truyền id cuộc trò chuyện và id người gọi', async () => {
		const { service, repository } = build();
		await service.send(TENANT, CONVERSATION_ID, 'Chào');
		expect(repository.findForSend).toHaveBeenCalledWith(
			CONVERSATION_ID,
			TENANT_ID,
		);
	});

	it('người ngoài hoặc id không có (cùng một kết quả null): 404 CONVERSATION_NOT_FOUND, không ghi', async () => {
		const { service, repository, transactions } = build({ forSend: null });
		const error = await errorOf(
			service.send(TENANT, CONVERSATION_ID, 'Chào'),
		);
		expect(error.code).toBe(ErrorCode.CONVERSATION_NOT_FOUND);
		expect(transactions.run).not.toHaveBeenCalled();
		expect(repository.appendMessage).not.toHaveBeenCalled();
	});

	it.each([
		['chủ trọ bị khóa', { landlord: { status: 'locked' } }, TENANT],
		['chủ trọ đã xóa mềm', { landlord: { deletedAt: NOW } }, TENANT],
		['người nhắn bị khóa', { tenant: { status: 'locked' } }, LANDLORD],
		['người nhắn đã xóa mềm', { tenant: { deletedAt: NOW } }, LANDLORD],
	])(
		'%s: người kia không nhận được, 409 CHAT_PEER_UNAVAILABLE và không ghi',
		async (_name, peers, caller) => {
			const { service, repository, transactions } = build({
				forSend: forSend(peers),
			});
			const error = await errorOf(
				service.send(caller, CONVERSATION_ID, 'Chào'),
			);
			expect(error.code).toBe(ErrorCode.CHAT_PEER_UNAVAILABLE);
			expect(transactions.run).not.toHaveBeenCalled();
			expect(repository.appendMessage).not.toHaveBeenCalled();
		},
	);

	it('tài khoản của chính người gửi không bị Service kiểm lại (FreshAuth đã lo): bên kia còn hoạt động thì gửi được', async () => {
		const { service, repository } = build({
			forSend: forSend({ tenant: { status: 'locked' } }),
		});
		await service.send(TENANT, CONVERSATION_ID, 'Chào');
		expect(repository.appendMessage).toHaveBeenCalledTimes(1);
	});

	it('câu ghi không còn hàng nào (cuộc trò chuyện biến mất): 404 CONVERSATION_NOT_FOUND', async () => {
		const { service } = build({ appended: null });
		const error = await errorOf(
			service.send(TENANT, CONVERSATION_ID, 'Chào'),
		);
		expect(error.code).toBe(ErrorCode.CONVERSATION_NOT_FOUND);
	});

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn', async () => {
		const { service, repository } = build();
		const error = await errorOf(
			service.send(ADMIN, CONVERSATION_ID, 'Chào'),
		);
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.findForSend).not.toHaveBeenCalled();
		expect(repository.appendMessage).not.toHaveBeenCalled();
	});
});

describe('ChatService.listMessages (spec 0013 AC-6, AC-8)', () => {
	const rows = [messageRow(3, LANDLORD_ID), messageRow(4, TENANT_ID)];

	it('không tham số: cửa sổ latest, đúng limit, items theo thứ tự repository trả', async () => {
		const { service, repository } = build({
			window: { rows, hasMore: true },
		});
		const page = await service.listMessages(
			TENANT,
			CONVERSATION_ID,
			query({ limit: 2 }),
		);
		expect(repository.findMessages).toHaveBeenCalledWith(
			CONVERSATION_ID,
			{ kind: 'latest' },
			2,
		);
		expect(page.items.map((m) => [m.seq, m.isMine])).toEqual([
			[3, false],
			[4, true],
		]);
		expect(page.hasMore).toBe(true);
	});

	it('afterSeq=0 vẫn là cửa sổ after (0 không bị coi là vắng mặt)', async () => {
		const { service, repository } = build();
		await service.listMessages(
			TENANT,
			CONVERSATION_ID,
			query({ afterSeq: 0 }),
		);
		expect(repository.findMessages).toHaveBeenCalledWith(
			CONVERSATION_ID,
			{ kind: 'after', seq: 0 },
			30,
		);
	});

	it('beforeSeq=N là cửa sổ before', async () => {
		const { service, repository } = build();
		await service.listMessages(
			TENANT,
			CONVERSATION_ID,
			query({ beforeSeq: 7 }),
		);
		expect(repository.findMessages).toHaveBeenCalledWith(
			CONVERSATION_ID,
			{ kind: 'before', seq: 7 },
			30,
		);
	});

	it('gửi cả afterSeq lẫn beforeSeq: 400 VALIDATION_FAILED kèm trường, trước mọi lần đọc DB', async () => {
		const { service, repository } = build();
		const error = await errorOf(
			service.listMessages(
				TENANT,
				CONVERSATION_ID,
				query({ afterSeq: 1, beforeSeq: 5 }),
			),
		);
		expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
		expect(error.fieldErrors.map((f) => f.field)).toEqual(['beforeSeq']);
		expect(repository.findParticipantLastSeq).not.toHaveBeenCalled();
		expect(repository.findMessages).not.toHaveBeenCalled();
	});

	it('người ngoài hoặc id không có: 404 CONVERSATION_NOT_FOUND và không đọc tin', async () => {
		const { service, repository } = build({ lastSeq: null });
		const error = await errorOf(
			service.listMessages(
				{ ...TENANT, userId: OUTSIDER_ID },
				CONVERSATION_ID,
				query(),
			),
		);
		expect(error.code).toBe(ErrorCode.CONVERSATION_NOT_FOUND);
		expect(repository.findParticipantLastSeq).toHaveBeenCalledWith(
			CONVERSATION_ID,
			OUTSIDER_ID,
		);
		expect(repository.findMessages).not.toHaveBeenCalled();
	});

	it('lastSeq là số tin hiện có; nếu một tin đến giữa hai lần đọc thì không nhỏ hơn phần tử cuối', async () => {
		const stale = build({
			lastSeq: 3,
			window: { rows, hasMore: false },
		});
		const page = await stale.service.listMessages(
			TENANT,
			CONVERSATION_ID,
			query(),
		);
		expect(page.lastSeq).toBe(4);
		const normal = build({ lastSeq: 9, window: { rows, hasMore: false } });
		expect(
			(
				await normal.service.listMessages(
					TENANT,
					CONVERSATION_ID,
					query(),
				)
			).lastSeq,
		).toBe(9);
	});

	it('cuộc trò chuyện chưa có tin nào trong cửa sổ: items rỗng, lastSeq giữ nguyên', async () => {
		const { service } = build({ lastSeq: 4 });
		await expect(
			service.listMessages(
				TENANT,
				CONVERSATION_ID,
				query({ afterSeq: 4 }),
			),
		).resolves.toEqual({ items: [], hasMore: false, lastSeq: 4 });
	});

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn', async () => {
		const { service, repository } = build();
		const error = await errorOf(
			service.listMessages(ADMIN, CONVERSATION_ID, query()),
		);
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.findParticipantLastSeq).not.toHaveBeenCalled();
	});
});

describe('ChatService.get (spec 0013 AC-7, AC-8)', () => {
	it('trả đúng một phần tử, đọc theo (id, người gọi)', async () => {
		const { service, repository } = build();
		const item = await service.get(LANDLORD, CONVERSATION_ID, NOW);
		expect(repository.findForParticipant).toHaveBeenCalledWith(
			CONVERSATION_ID,
			LANDLORD_ID,
		);
		expect(item).toMatchObject({
			id: CONVERSATION_ID,
			myRole: 'landlord',
			otherUser: { id: TENANT_ID },
		});
	});

	it('người ngoài hoặc id không có: 404 CONVERSATION_NOT_FOUND, không tính isPublic', async () => {
		const { service, listings } = build({ row: null });
		const error = await errorOf(service.get(TENANT, CONVERSATION_ID, NOW));
		expect(error.code).toBe(ErrorCode.CONVERSATION_NOT_FOUND);
		expect(listings.findPublicIds).not.toHaveBeenCalled();
	});

	it('isPublic theo luật hiển thị công khai ngay lúc đọc: tin hết hiện thì false và ảnh bìa null (AC-9)', async () => {
		const { service } = build({ publicIds: [] });
		const item = await service.get(TENANT, CONVERSATION_ID, NOW);
		expect(item.listing.isPublic).toBe(false);
		expect(item.listing.coverImageUrl).toBeNull();
	});

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn', async () => {
		const { service, repository } = build();
		const error = await errorOf(service.get(ADMIN, CONVERSATION_ID, NOW));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.findForParticipant).not.toHaveBeenCalled();
	});
});

describe('ChatService.listInbox (spec 0013 AC-7, AC-8)', () => {
	const second = conversationRow({
		id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d52',
		listing: {
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d12',
			code: 'zz9yy8xx',
			title: 'Căn hộ mini',
			price: 5_000_000,
			images: [],
		},
		lastSeq: 2,
	});

	it('phân trang: skip theo page và pageSize, lọc listingId truyền xuống, total từ repository', async () => {
		const { service, repository } = build({
			inbox: { rows: [conversationRow(), second], total: 7 },
		});
		const page = await service.listInbox(
			TENANT,
			Object.assign({ page: 3, pageSize: 2 }, { listingId: LISTING_ID }),
			NOW,
		);
		expect(repository.findInboxPage).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
			4,
			2,
		);
		expect(page).toMatchObject({ total: 7, page: 3, pageSize: 2 });
		expect(page.items.map((item) => item.id)).toEqual([
			CONVERSATION_ID,
			'0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d52',
		]);
	});

	it('cờ isPublic tính một lần cho cả trang: tin có trong tập công khai là true, tin khác false', async () => {
		const { service, listings } = build({
			inbox: { rows: [conversationRow(), second], total: 2 },
			publicIds: [LISTING_ID],
		});
		const page = await service.listInbox(
			TENANT,
			{ page: 1, pageSize: 20 },
			NOW,
		);
		expect(listings.findPublicIds).toHaveBeenCalledTimes(1);
		expect(listings.findPublicIds).toHaveBeenCalledWith(
			[LISTING_ID, '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d12'],
			{ now: NOW, trialListingLimit: 3 },
		);
		expect(page.items.map((item) => item.listing.isPublic)).toEqual([
			true,
			false,
		]);
	});

	it('hộp thư rỗng: items rỗng, vẫn trả page và pageSize', async () => {
		const { service } = build();
		await expect(
			service.listInbox(TENANT, { page: 1, pageSize: 20 }, NOW),
		).resolves.toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
	});

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn', async () => {
		const { service, repository } = build();
		const error = await errorOf(
			service.listInbox(ADMIN, { page: 1, pageSize: 20 }, NOW),
		);
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.findInboxPage).not.toHaveBeenCalled();
	});
});

describe('ChatService: unreadCount của phần tử (spec 0013 AC-10)', () => {
	// lastSeq 4, người nhắn đã đọc tới 4, chủ trọ đã đọc tới 2 (fixture mặc định).
	it('người nhắn thấy last_seq trừ mốc của mình, chủ trọ thấy last_seq trừ mốc của chủ trọ', async () => {
		const { service } = build();
		const asTenant = await service.get(TENANT, CONVERSATION_ID, NOW);
		const asLandlord = await service.get(LANDLORD, CONVERSATION_ID, NOW);
		expect(asTenant.unreadCount).toBe(0);
		expect(asLandlord.unreadCount).toBe(2);
	});

	it('hộp thư mang unreadCount của từng cuộc trò chuyện theo người gọi', async () => {
		const other = conversationRow({
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d52',
			lastSeq: 9,
			tenantReadSeq: 3,
			landlordReadSeq: 9,
		});
		const { service } = build({
			inbox: { rows: [conversationRow(), other], total: 2 },
		});
		const asTenant = await service.listInbox(
			TENANT,
			{ page: 1, pageSize: 20 },
			NOW,
		);
		expect(asTenant.items.map((item) => item.unreadCount)).toEqual([0, 6]);
		const asLandlord = await service.listInbox(
			LANDLORD,
			{ page: 1, pageSize: 20 },
			NOW,
		);
		expect(asLandlord.items.map((item) => item.unreadCount)).toEqual([
			2, 0,
		]);
	});

	it('route mở trả phần tử với unreadCount 0: mở đã dời mốc của người nhắn tới tin vừa gửi', async () => {
		const { service } = build({
			row: conversationRow({
				lastSeq: 1,
				tenantReadSeq: 1,
				landlordReadSeq: 0,
			}),
		});
		const result = await service.open(TENANT, LISTING_ID, 'Chào', NOW);
		expect(result.conversation.unreadCount).toBe(0);
	});
});

describe('ChatService.markRead (spec 0013 AC-11, AC-8)', () => {
	it('dời mốc của người gọi tới upToSeq rồi trả phần tử mới đọc lại, đúng dạng GET /conversations/:id', async () => {
		const { service, repository, transactions } = build();
		const item = await service.markRead(LANDLORD, CONVERSATION_ID, 3, NOW);
		expect(repository.advanceReadMarker).toHaveBeenCalledWith(
			CONVERSATION_ID,
			LANDLORD_ID,
			3,
		);
		// Đọc lại theo (id, người gọi), không tin phản hồi của câu UPDATE.
		expect(repository.findForParticipant).toHaveBeenCalledWith(
			CONVERSATION_ID,
			LANDLORD_ID,
		);
		expect(item).toMatchObject({ id: CONVERSATION_ID, myRole: 'landlord' });
		// Một câu UPDATE tự nguyên tử, không cần giao dịch.
		expect(transactions.run).not.toHaveBeenCalled();
	});

	it('người ngoài hoặc id không có: 404 CONVERSATION_NOT_FOUND và không đọc lại phần tử', async () => {
		const { service, repository } = build({ advanced: false });
		const error = await errorOf(
			service.markRead(
				userOf(OUTSIDER_ID, 'tenant'),
				CONVERSATION_ID,
				3,
				NOW,
			),
		);
		expect(error.code).toBe(ErrorCode.CONVERSATION_NOT_FOUND);
		expect(repository.findForParticipant).not.toHaveBeenCalled();
	});

	it('không kiểm người kia: đọc luôn được dù bên kia bị khóa (AC-5)', async () => {
		const { service, repository } = build({
			forSend: forSend({ landlord: { status: 'locked' } }),
		});
		await expect(
			service.markRead(TENANT, CONVERSATION_ID, 4, NOW),
		).resolves.toMatchObject({ id: CONVERSATION_ID });
		expect(repository.findForSend).not.toHaveBeenCalled();
	});

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn', async () => {
		const { service, repository } = build();
		const error = await errorOf(
			service.markRead(ADMIN, CONVERSATION_ID, 1, NOW),
		);
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.advanceReadMarker).not.toHaveBeenCalled();
	});
});

describe('ChatService.unreadSummary (spec 0013 AC-10)', () => {
	it('trả hai số của người gọi từ repository, đếm theo id trong token', async () => {
		const { service, repository } = build({
			unread: { unreadConversations: 2, unreadMessages: 7 },
		});
		await expect(service.unreadSummary(TENANT)).resolves.toEqual({
			unreadConversations: 2,
			unreadMessages: 7,
		});
		expect(repository.countUnread).toHaveBeenCalledWith(TENANT_ID);
	});

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn', async () => {
		const { service, repository } = build();
		const error = await errorOf(service.unreadSummary(ADMIN));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.countUnread).not.toHaveBeenCalled();
	});
});
