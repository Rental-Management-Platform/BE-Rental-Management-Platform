import type { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
	AT,
	CONVERSATION_ID,
	LANDLORD_ID,
	LISTING_ID,
	TENANT_ID,
	conversationRow,
	messageRow,
} from './chat.fixtures';
import { ChatRepository } from './chat.repository';

/** Đối số của lần gọi thẻ mẫu `$queryRaw`: đoạn chữ tĩnh nối bằng `?`, rồi các giá trị chèn vào theo thứ tự. */
function rawCall(
	queryRaw: jest.Mock,
	index = 0,
): { text: string; values: unknown[] } {
	const call = (queryRaw.mock.calls as unknown as unknown[][])[index] ?? [];
	const strings = call[0] as readonly string[];
	return {
		text: strings.join('?').replace(/\s+/g, ' '),
		values: call.slice(1),
	};
}

const WRITTEN = { id: CONVERSATION_ID, last_seq: 5, last_message_at: AT };

function buildTx(rows: unknown[] = [WRITTEN]) {
	const queryRaw = jest.fn(() => Promise.resolve(rows));
	const create = jest.fn(
		(args: { data: { seq: number; senderId: string } }) =>
			Promise.resolve(messageRow(args.data.seq, args.data.senderId)),
	);
	const tx = {
		$queryRaw: queryRaw,
		message: { create },
	} as unknown as Prisma.TransactionClient;
	return { tx, queryRaw, create };
}

describe('ChatRepository.openConversation (spec 0013 AC-1)', () => {
	const input = {
		listingId: LISTING_ID,
		tenantId: TENANT_ID,
		landlordId: LANDLORD_ID,
		body: 'Còn phòng không?',
	};

	it('một câu INSERT ... ON CONFLICT (listing_id, tenant_id) DO UPDATE khóa hàng và trả last_seq', async () => {
		const { tx, queryRaw } = buildTx();
		const repository = new ChatRepository({} as PrismaService);
		await repository.openConversation(input, tx);
		expect(queryRaw).toHaveBeenCalledTimes(1);
		const { text, values } = rawCall(queryRaw);
		expect(text).toContain('INSERT INTO conversations');
		expect(text).toContain('ON CONFLICT (listing_id, tenant_id) DO UPDATE');
		expect(text).toContain('RETURNING id, last_seq, last_message_at');
		expect(values).toEqual([LISTING_ID, TENANT_ID, LANDLORD_ID]);
	});

	it('tạo mới thì last_seq và mốc đọc của người nhắn là 1, mốc của chủ trọ là 0', async () => {
		const { tx, queryRaw } = buildTx();
		await new ChatRepository({} as PrismaService).openConversation(
			input,
			tx,
		);
		const { text } = rawCall(queryRaw);
		const insert = text.split('ON CONFLICT')[0] ?? '';
		expect(insert).toContain(
			'(listing_id, tenant_id, landlord_id, last_seq, tenant_read_seq, last_message_at)',
		);
		expect(insert).toContain('::uuid, 1, 1, clock_timestamp())');
		expect(insert).not.toContain('landlord_read_seq');
	});

	it('đã có thì tăng last_seq, dời mốc của người nhắn tới seq mới, đặt giờ, và không bao giờ đổi landlord_id hay mốc của chủ trọ', async () => {
		const { tx, queryRaw } = buildTx();
		await new ChatRepository({} as PrismaService).openConversation(
			input,
			tx,
		);
		const update = rawCall(queryRaw).text.split('DO UPDATE')[1] ?? '';
		expect(update).toContain('last_seq = conversations.last_seq + 1');
		expect(update).toContain(
			'tenant_read_seq = conversations.last_seq + 1',
		);
		expect(update).toContain('last_message_at = clock_timestamp()');
		expect(update).not.toContain('landlord_id');
		expect(update).not.toContain('landlord_read_seq');
	});

	it('ghi tin với đúng seq và giờ mà câu lệnh khóa hàng trả về, người gửi là người nhắn', async () => {
		const { tx, create } = buildTx();
		const result = await new ChatRepository(
			{} as PrismaService,
		).openConversation(input, tx);
		expect(create).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					conversationId: CONVERSATION_ID,
					seq: 5,
					senderId: TENANT_ID,
					body: 'Còn phòng không?',
					createdAt: AT,
				},
			}),
		);
		expect(result.conversationId).toBe(CONVERSATION_ID);
		expect(result.message.seq).toBe(5);
	});

	it('câu lệnh ghi không trả dòng nào thì ném lỗi chứ không ghi tin mồ côi', async () => {
		const { tx, create } = buildTx([]);
		await expect(
			new ChatRepository({} as PrismaService).openConversation(input, tx),
		).rejects.toThrow();
		expect(create).not.toHaveBeenCalled();
	});
});

describe('ChatRepository.appendMessage (spec 0013 AC-3)', () => {
	function input(side: 'tenant' | 'landlord') {
		return {
			conversationId: CONVERSATION_ID,
			senderId: side === 'tenant' ? TENANT_ID : LANDLORD_ID,
			side,
			body: 'Dạ',
		} as const;
	}

	it('người nhắn gửi: UPDATE tăng last_seq và dời đúng mốc tenant_read_seq, không đụng mốc chủ trọ', async () => {
		const { tx, queryRaw } = buildTx();
		await new ChatRepository({} as PrismaService).appendMessage(
			input('tenant'),
			tx,
		);
		const { text, values } = rawCall(queryRaw);
		expect(text).toContain('UPDATE conversations');
		expect(text).toContain('last_seq = last_seq + 1');
		expect(text).toContain('tenant_read_seq = last_seq + 1');
		expect(text).not.toContain('landlord_read_seq');
		expect(text).toContain('last_message_at = clock_timestamp()');
		expect(text).toContain('RETURNING id, last_seq, last_message_at');
		expect(values).toEqual([CONVERSATION_ID]);
	});

	it('chủ trọ gửi: dời landlord_read_seq, không đụng mốc người nhắn', async () => {
		const { tx, queryRaw } = buildTx();
		await new ChatRepository({} as PrismaService).appendMessage(
			input('landlord'),
			tx,
		);
		const { text } = rawCall(queryRaw);
		expect(text).toContain('landlord_read_seq = last_seq + 1');
		expect(text).not.toContain('tenant_read_seq');
	});

	it('chỉ một câu UPDATE cho mỗi lần gửi, rồi INSERT tin với seq và giờ vừa nhận, người gửi là người trong token', async () => {
		const { tx, queryRaw, create } = buildTx();
		const message = await new ChatRepository(
			{} as PrismaService,
		).appendMessage(input('landlord'), tx);
		expect(queryRaw).toHaveBeenCalledTimes(1);
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					conversationId: CONVERSATION_ID,
					seq: 5,
					senderId: LANDLORD_ID,
					body: 'Dạ',
					createdAt: AT,
				},
			}),
		);
		expect(message?.seq).toBe(5);
	});

	it('không có hàng nào được cập nhật thì trả null và không ghi tin', async () => {
		const { tx, create } = buildTx([]);
		await expect(
			new ChatRepository({} as PrismaService).appendMessage(
				input('tenant'),
				tx,
			),
		).resolves.toBeNull();
		expect(create).not.toHaveBeenCalled();
	});
});

describe('ChatRepository: đọc một cuộc trò chuyện', () => {
	const participant = {
		OR: [{ tenantId: LANDLORD_ID }, { landlordId: LANDLORD_ID }],
	};

	it('findForParticipant đặt điều kiện người tham gia ngay trong truy vấn và chỉ chọn id, name của hai người', async () => {
		const findFirst = jest.fn(() => Promise.resolve(conversationRow()));
		const repository = new ChatRepository({
			conversation: { findFirst },
		} as unknown as PrismaService);
		await repository.findForParticipant(CONVERSATION_ID, LANDLORD_ID);
		const args = (
			findFirst.mock.calls as unknown as [Record<string, unknown>][]
		)[0]?.[0];
		expect(args?.['where']).toEqual({
			id: CONVERSATION_ID,
			...participant,
		});
		expect(args?.['include']).toMatchObject({
			tenant: { select: { id: true, name: true } },
			landlord: { select: { id: true, name: true } },
		});
		expect(JSON.stringify(args?.['include'])).not.toMatch(/phone|email/);
	});

	it('findForSend lấy trạng thái hai tài khoản để kiểm người kia, cũng với điều kiện người tham gia', async () => {
		const findFirst = jest.fn(() => Promise.resolve(null));
		const repository = new ChatRepository({
			conversation: { findFirst },
		} as unknown as PrismaService);
		await expect(
			repository.findForSend(CONVERSATION_ID, LANDLORD_ID),
		).resolves.toBeNull();
		const args = (
			findFirst.mock.calls as unknown as [Record<string, unknown>][]
		)[0]?.[0];
		expect(args?.['where']).toEqual({
			id: CONVERSATION_ID,
			...participant,
		});
		expect(args?.['select']).toMatchObject({
			tenant: { select: { id: true, status: true, deletedAt: true } },
			landlord: { select: { id: true, status: true, deletedAt: true } },
		});
	});

	it('findParticipantLastSeq trả last_seq, hoặc null khi người gọi không phải một trong hai bên', async () => {
		const found = new ChatRepository({
			conversation: {
				findFirst: jest.fn(() => Promise.resolve({ lastSeq: 8 })),
			},
		} as unknown as PrismaService);
		await expect(
			found.findParticipantLastSeq(CONVERSATION_ID, LANDLORD_ID),
		).resolves.toBe(8);
		const missing = new ChatRepository({
			conversation: { findFirst: jest.fn(() => Promise.resolve(null)) },
		} as unknown as PrismaService);
		await expect(
			missing.findParticipantLastSeq(CONVERSATION_ID, LANDLORD_ID),
		).resolves.toBeNull();
	});
});

describe('ChatRepository.findInboxPage (spec 0013 AC-7)', () => {
	function build() {
		const findMany = jest.fn(() => Promise.resolve([conversationRow()]));
		const count = jest.fn(() => Promise.resolve(1));
		const repository = new ChatRepository({
			conversation: { findMany, count },
		} as unknown as PrismaService);
		return { repository, findMany, count };
	}

	it('chỉ cuộc trò chuyện của người gọi (một trong hai bên), mới nhất trước rồi id giảm dần, đếm cùng điều kiện', async () => {
		const { repository, findMany, count } = build();
		const result = await repository.findInboxPage(
			TENANT_ID,
			undefined,
			20,
			10,
		);
		const where = {
			OR: [{ tenantId: TENANT_ID }, { landlordId: TENANT_ID }],
		};
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where,
				orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
				skip: 20,
				take: 10,
			}),
		);
		expect(count).toHaveBeenCalledWith({ where });
		expect(result.total).toBe(1);
		expect(result.rows).toHaveLength(1);
	});

	it('listingId lọc theo một tin ở cả danh sách lẫn phép đếm', async () => {
		const { repository, findMany, count } = build();
		await repository.findInboxPage(TENANT_ID, LISTING_ID, 0, 20);
		const where = {
			OR: [{ tenantId: TENANT_ID }, { landlordId: TENANT_ID }],
			listingId: LISTING_ID,
		};
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where }),
		);
		expect(count).toHaveBeenCalledWith({ where });
	});
});

describe('ChatRepository.findLastMessages (spec 0013 AC-7)', () => {
	it('một truy vấn theo (conversation_id, seq = last_seq) cho cả trang, ghép lại theo id cuộc trò chuyện', async () => {
		const findMany = jest.fn(() =>
			Promise.resolve([
				{
					...messageRow(4, TENANT_ID),
					conversationId: CONVERSATION_ID,
				},
			]),
		);
		const repository = new ChatRepository({
			message: { findMany },
		} as unknown as PrismaService);
		const found = await repository.findLastMessages([
			{ id: CONVERSATION_ID, lastSeq: 4 },
			{ id: 'cuoc-2', lastSeq: 9 },
		]);
		expect(findMany).toHaveBeenCalledTimes(1);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					OR: [
						{ conversationId: CONVERSATION_ID, seq: 4 },
						{ conversationId: 'cuoc-2', seq: 9 },
					],
				},
			}),
		);
		expect(found.get(CONVERSATION_ID)?.seq).toBe(4);
		expect(found.has('cuoc-2')).toBe(false);
	});

	it('trang rỗng thì không truy vấn', async () => {
		const findMany = jest.fn();
		const repository = new ChatRepository({
			message: { findMany },
		} as unknown as PrismaService);
		await expect(repository.findLastMessages([])).resolves.toEqual(
			new Map(),
		);
		expect(findMany).not.toHaveBeenCalled();
	});
});

describe('ChatRepository.findMessages (spec 0013 AC-6)', () => {
	function build(dbOrder: number[]) {
		const findMany = jest.fn(() =>
			Promise.resolve(dbOrder.map((seq) => messageRow(seq, TENANT_ID))),
		);
		const repository = new ChatRepository({
			message: { findMany },
		} as unknown as PrismaService);
		return { repository, findMany };
	}

	it('latest: đọc từ seq lớn xuống, lấy limit + 1, hàng dư (cũ nhất) cho hasMore, trả theo seq tăng dần', async () => {
		const { repository, findMany } = build([9, 8, 7]);
		const result = await repository.findMessages(
			CONVERSATION_ID,
			{ kind: 'latest' },
			2,
		);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { conversationId: CONVERSATION_ID },
				orderBy: { seq: 'desc' },
				take: 3,
			}),
		);
		expect(result.hasMore).toBe(true);
		expect(result.rows.map((r) => r.seq)).toEqual([8, 9]);
	});

	it('latest: đủ limit hàng đúng thì hasMore false', async () => {
		const { repository } = build([9, 8]);
		const result = await repository.findMessages(
			CONVERSATION_ID,
			{ kind: 'latest' },
			2,
		);
		expect(result.hasMore).toBe(false);
		expect(result.rows.map((r) => r.seq)).toEqual([8, 9]);
	});

	it('after: seq > N đọc từ nhỏ lên, hàng dư (mới hơn) cho hasMore, giữ thứ tự tăng dần', async () => {
		const { repository, findMany } = build([5, 6, 7]);
		const result = await repository.findMessages(
			CONVERSATION_ID,
			{ kind: 'after', seq: 4 },
			2,
		);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { conversationId: CONVERSATION_ID, seq: { gt: 4 } },
				orderBy: { seq: 'asc' },
				take: 3,
			}),
		);
		expect(result.hasMore).toBe(true);
		expect(result.rows.map((r) => r.seq)).toEqual([5, 6]);
	});

	it('after: không còn tin mới hơn thì hasMore false', async () => {
		const { repository } = build([5]);
		const result = await repository.findMessages(
			CONVERSATION_ID,
			{ kind: 'after', seq: 4 },
			2,
		);
		expect(result).toMatchObject({ hasMore: false });
		expect(result.rows.map((r) => r.seq)).toEqual([5]);
	});

	it('before: seq < N đọc từ lớn xuống rồi đảo lại, hàng dư là tin cũ hơn', async () => {
		const { repository, findMany } = build([6, 5, 4]);
		const result = await repository.findMessages(
			CONVERSATION_ID,
			{ kind: 'before', seq: 7 },
			2,
		);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { conversationId: CONVERSATION_ID, seq: { lt: 7 } },
				orderBy: { seq: 'desc' },
				take: 3,
			}),
		);
		expect(result.hasMore).toBe(true);
		expect(result.rows.map((r) => r.seq)).toEqual([5, 6]);
	});

	it('chỉ chọn năm cột của tin nhắn, không bao giờ mốc đọc hay thông tin liên hệ', async () => {
		const { repository, findMany } = build([]);
		await repository.findMessages(CONVERSATION_ID, { kind: 'latest' }, 30);
		const args = (
			findMany.mock.calls as unknown as [Record<string, unknown>][]
		)[0]?.[0];
		expect(args?.['select']).toEqual({
			id: true,
			seq: true,
			senderId: true,
			body: true,
			createdAt: true,
		});
	});
});

describe('ChatRepository.advanceReadMarker (spec 0013 AC-11)', () => {
	/** `$executeRaw` giả trả lần lượt số hàng bị khớp của từng câu UPDATE. */
	function build(...affected: number[]) {
		const executeRaw = jest.fn();
		for (const count of affected) executeRaw.mockResolvedValueOnce(count);
		const repository = new ChatRepository({
			$executeRaw: executeRaw,
		} as unknown as PrismaService);
		return { repository, executeRaw };
	}

	it('người nhắn: một câu UPDATE tenant_read_seq kẹp bằng GREATEST và LEAST, khớp theo tenant_id, không thử bên chủ trọ', async () => {
		const { repository, executeRaw } = build(1);
		await expect(
			repository.advanceReadMarker(CONVERSATION_ID, TENANT_ID, 3),
		).resolves.toBe(true);
		expect(executeRaw).toHaveBeenCalledTimes(1);
		const { text, values } = rawCall(executeRaw);
		expect(text).toContain('UPDATE conversations');
		expect(text).toContain(
			'tenant_read_seq = GREATEST(tenant_read_seq, LEAST(?::int, last_seq))',
		);
		expect(text).toContain('WHERE id = ?::uuid AND tenant_id = ?::uuid');
		expect(text).not.toContain('landlord');
		expect(values).toEqual([3, CONVERSATION_ID, TENANT_ID]);
	});

	it('chủ trọ: câu đầu không khớp hàng nào, câu thứ hai dời landlord_read_seq khớp theo landlord_id', async () => {
		const { repository, executeRaw } = build(0, 1);
		await expect(
			repository.advanceReadMarker(CONVERSATION_ID, LANDLORD_ID, 2),
		).resolves.toBe(true);
		expect(executeRaw).toHaveBeenCalledTimes(2);
		const second = rawCall(executeRaw, 1);
		expect(second.text).toContain(
			'landlord_read_seq = GREATEST(landlord_read_seq, LEAST(?::int, last_seq))',
		);
		expect(second.text).toContain(
			'WHERE id = ?::uuid AND landlord_id = ?::uuid',
		);
		expect(second.text).not.toContain('tenant_read_seq');
		expect(second.values).toEqual([2, CONVERSATION_ID, LANDLORD_ID]);
	});

	it('người ngoài hoặc id không có: cả hai câu không khớp hàng nào thì trả false', async () => {
		const { repository, executeRaw } = build(0, 0);
		await expect(
			repository.advanceReadMarker(CONVERSATION_ID, 'nguoi-la', 1),
		).resolves.toBe(false);
		expect(executeRaw).toHaveBeenCalledTimes(2);
	});

	it('không bao giờ đụng last_seq, last_message_at hay bảng messages', async () => {
		const { repository, executeRaw } = build(0, 1);
		await repository.advanceReadMarker(CONVERSATION_ID, LANDLORD_ID, 2);
		for (const index of [0, 1]) {
			const { text } = rawCall(executeRaw, index);
			expect(text).not.toMatch(/SET[^W]*\blast_seq\s*=/);
			expect(text).not.toContain('last_message_at');
			expect(text).not.toContain('messages');
		}
	});
});

describe('ChatRepository.countUnread (spec 0013 AC-10)', () => {
	function build(rows: unknown[]) {
		const queryRaw = jest.fn(() => Promise.resolve(rows));
		const repository = new ChatRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('một truy vấn gom hai nhánh (người nhắn, chủ trọ) bằng UNION ALL, mỗi nhánh trừ mốc của chính bên đó', async () => {
		const { repository, queryRaw } = build([
			{ unreadConversations: 2n, unreadMessages: 7n },
		]);
		await repository.countUnread(TENANT_ID);
		expect(queryRaw).toHaveBeenCalledTimes(1);
		const { text, values } = rawCall(queryRaw);
		expect(text).toContain(
			'SELECT last_seq - tenant_read_seq AS unread FROM conversations WHERE tenant_id = ?::uuid',
		);
		expect(text).toContain('UNION ALL');
		expect(text).toContain(
			'SELECT last_seq - landlord_read_seq AS unread FROM conversations WHERE landlord_id = ?::uuid',
		);
		expect(text).toContain('count(*) FILTER (WHERE unread > 0)');
		expect(values).toEqual([TENANT_ID, TENANT_ID]);
	});

	it('đổi bigint của PostgreSQL sang number', async () => {
		const { repository } = build([
			{ unreadConversations: 3n, unreadMessages: 12n },
		]);
		await expect(repository.countUnread(TENANT_ID)).resolves.toEqual({
			unreadConversations: 3,
			unreadMessages: 12,
		});
	});

	it('không có dòng nào thì cả hai số là 0', async () => {
		const { repository } = build([]);
		await expect(repository.countUnread(TENANT_ID)).resolves.toEqual({
			unreadConversations: 0,
			unreadMessages: 0,
		});
	});
});

describe('ChatRepository.hasLandlordRepliedOnListing (spec 0015 AC-4)', () => {
	function build(rows: unknown[]) {
		const queryRaw = jest.fn(() => Promise.resolve(rows));
		const repository = new ChatRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('một truy vấn tồn tại theo (tin, người nhắn), chủ trọ của chính cuộc trò chuyện đó đã gửi tin, LIMIT 1', async () => {
		const { repository, queryRaw } = build([{ found: 1 }]);
		await repository.hasLandlordRepliedOnListing(TENANT_ID, LISTING_ID);
		expect(queryRaw).toHaveBeenCalledTimes(1);
		const { text, values } = rawCall(queryRaw);
		expect(text).toContain('FROM conversations c');
		expect(text).toContain(
			'JOIN messages m ON m.conversation_id = c.id AND m.sender_id = c.landlord_id',
		);
		expect(text).toContain('WHERE c.listing_id = ?::uuid');
		expect(text).toContain('AND c.tenant_id = ?::uuid');
		expect(text).toContain('LIMIT 1');
		// tin trước, người nhắn sau: đúng thứ tự của WHERE
		expect(values).toEqual([LISTING_ID, TENANT_ID]);
	});

	it('tra theo CHÍNH tin: không có điều kiện nào theo chủ trọ hay theo tin khác', async () => {
		const { repository, queryRaw } = build([]);
		await repository.hasLandlordRepliedOnListing(TENANT_ID, LISTING_ID);
		const { text } = rawCall(queryRaw);
		expect(text).not.toContain('c.landlord_id = ?');
		expect(text).not.toContain('c.listing_id <>');
	});

	it.each([
		[[{ found: 1 }], true],
		[[], false],
	])('dòng trả về %j thì kết quả %s', async (rows, expected) => {
		const { repository } = build(rows);
		await expect(
			repository.hasLandlordRepliedOnListing(TENANT_ID, LISTING_ID),
		).resolves.toBe(expected);
	});

	it('hàm hasLandlordReplied của spec 0014 vẫn tra theo chủ trọ, không theo tin', async () => {
		const findFirst = jest.fn(() => Promise.resolve({ id: 'm1' }));
		const repository = new ChatRepository({
			message: { findFirst },
		} as unknown as PrismaService);
		await repository.hasLandlordReplied(TENANT_ID, LANDLORD_ID);
		expect(findFirst).toHaveBeenCalledWith({
			where: {
				senderId: LANDLORD_ID,
				conversation: { tenantId: TENANT_ID, landlordId: LANDLORD_ID },
			},
			select: { id: true },
		});
	});
});
