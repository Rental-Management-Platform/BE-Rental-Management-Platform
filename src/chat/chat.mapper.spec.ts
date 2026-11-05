import { toConversationItem, toMessage } from './chat.mapper';
import {
	COVER_KEY,
	LANDLORD_ID,
	TENANT_ID,
	conversationRow,
	messageRow,
} from './chat.fixtures';

describe('toMessage (spec 0013 AC-3, AC-6)', () => {
	it('đúng sáu trường và không lộ gì khác', () => {
		const row = messageRow(2, TENANT_ID, 'Dạ còn phòng không anh?');
		expect(toMessage(row, TENANT_ID)).toEqual({
			id: row.id,
			seq: 2,
			senderId: TENANT_ID,
			isMine: true,
			body: 'Dạ còn phòng không anh?',
			createdAt: row.createdAt,
		});
	});

	it('isMine chỉ đúng khi người gửi là người gọi', () => {
		const row = messageRow(2, TENANT_ID);
		expect(toMessage(row, TENANT_ID).isMine).toBe(true);
		expect(toMessage(row, LANDLORD_ID).isMine).toBe(false);
	});
});

describe('toConversationItem (spec 0013 AC-7)', () => {
	const last = messageRow(4, TENANT_ID, 'Dạ phòng còn trống không anh?');

	it('người nhắn thấy myRole tenant và người kia là chủ trọ', () => {
		const item = toConversationItem(
			conversationRow(),
			last,
			TENANT_ID,
			true,
		);
		expect(item.myRole).toBe('tenant');
		expect(item.otherUser).toEqual({ id: LANDLORD_ID, name: 'Chú Tám' });
		expect(item.lastMessage.isMine).toBe(true);
	});

	it('chủ trọ thấy myRole landlord và người kia là người nhắn', () => {
		const item = toConversationItem(
			conversationRow(),
			last,
			LANDLORD_ID,
			true,
		);
		expect(item.myRole).toBe('landlord');
		expect(item.otherUser).toEqual({ id: TENANT_ID, name: 'Bạn Lan' });
		expect(item.lastMessage.isMine).toBe(false);
	});

	it('tin hiện công khai: slug từ tiêu đề, ảnh bìa là đường dẫn media, isPublic true', () => {
		const item = toConversationItem(
			conversationRow(),
			last,
			TENANT_ID,
			true,
		);
		expect(item.listing).toEqual({
			id: conversationRow().listing.id,
			code: 'k3m9x2ab',
			slug: 'phong-tro-gan-dai-hoc',
			title: 'Phòng trọ gần đại học',
			price: 3_000_000,
			coverImageUrl: `/api/v1/media/${COVER_KEY}`,
			isPublic: true,
		});
	});

	it('tin không còn công khai: vẫn giữ tiêu đề, mã, giá nhưng ảnh bìa là null (AC-7, AC-9)', () => {
		const item = toConversationItem(
			conversationRow(),
			last,
			TENANT_ID,
			false,
		);
		expect(item.listing.isPublic).toBe(false);
		expect(item.listing.coverImageUrl).toBeNull();
		expect(item.listing.title).toBe('Phòng trọ gần đại học');
		expect(item.listing.code).toBe('k3m9x2ab');
		expect(item.listing.price).toBe(3_000_000);
	});

	it('tin chưa có ảnh: ảnh bìa null dù đang công khai', () => {
		const row = conversationRow();
		const item = toConversationItem(
			{ ...row, listing: { ...row.listing, images: [] } },
			last,
			TENANT_ID,
			true,
		);
		expect(item.listing.coverImageUrl).toBeNull();
	});

	it('tên trống hay chỉ khoảng trắng là null, không bao giờ chuỗi rỗng', () => {
		const row = conversationRow({
			landlord: { id: LANDLORD_ID, name: '   ' },
		});
		expect(
			toConversationItem(row, last, TENANT_ID, true).otherUser.name,
		).toBeNull();
		const unnamed = conversationRow({
			tenant: { id: TENANT_ID, name: null },
		});
		expect(
			toConversationItem(unnamed, last, LANDLORD_ID, true).otherUser.name,
		).toBeNull();
	});

	it('không lộ mốc đã đọc, số điện thoại, email hay id người nhắn/chủ trọ ngoài otherUser (AC-8)', () => {
		const item = toConversationItem(
			conversationRow(),
			last,
			TENANT_ID,
			true,
		);
		expect(Object.keys(item).sort()).toEqual([
			'createdAt',
			'id',
			'lastMessage',
			'lastMessageAt',
			'listing',
			'myRole',
			'otherUser',
			'unreadCount',
		]);
		const text = JSON.stringify(item);
		expect(text).not.toContain('ReadSeq');
		expect(text).not.toContain('read_seq');
		expect(text).not.toContain('phone');
		expect(text).not.toContain('email');
	});

	it('lastMessage không có id, lastMessageAt và createdAt lấy từ hàng cuộc trò chuyện', () => {
		const row = conversationRow();
		const item = toConversationItem(row, last, TENANT_ID, true);
		expect(Object.keys(item.lastMessage).sort()).toEqual([
			'body',
			'createdAt',
			'isMine',
			'senderId',
			'seq',
		]);
		expect(item.lastMessageAt).toBe(row.lastMessageAt);
		expect(item.createdAt).toBe(row.createdAt);
	});
});

describe('toConversationItem: unreadCount (spec 0013 AC-10)', () => {
	const last = messageRow(9, LANDLORD_ID);

	it('người nhắn: last_seq trừ tenant_read_seq; chủ trọ: last_seq trừ landlord_read_seq', () => {
		const row = conversationRow({
			lastSeq: 9,
			tenantReadSeq: 6,
			landlordReadSeq: 9,
		});
		expect(toConversationItem(row, last, TENANT_ID, true).unreadCount).toBe(
			3,
		);
		expect(
			toConversationItem(row, last, LANDLORD_ID, true).unreadCount,
		).toBe(0);
	});

	it('mốc bằng last_seq thì 0, mốc 0 thì cả last_seq', () => {
		const caughtUp = conversationRow({
			lastSeq: 5,
			tenantReadSeq: 5,
			landlordReadSeq: 0,
		});
		expect(
			toConversationItem(caughtUp, last, TENANT_ID, true).unreadCount,
		).toBe(0);
		expect(
			toConversationItem(caughtUp, last, LANDLORD_ID, true).unreadCount,
		).toBe(5);
	});

	it('chỉ hiệu số ra khỏi phản hồi: hai giá trị mốc không bao giờ xuất hiện dưới tên nào', () => {
		// Mốc 6 và 3 là số khác nhau và khác last_seq 9, nên nếu lọt vào JSON thì chuỗi này bắt được.
		const row = conversationRow({
			lastSeq: 9,
			tenantReadSeq: 6,
			landlordReadSeq: 3,
		});
		const item = toConversationItem(row, last, TENANT_ID, true);
		expect(item.unreadCount).toBe(3);
		expect(JSON.stringify(item)).not.toMatch(/[Rr]ead_?[Ss]eq/);
		expect(Object.keys(item)).not.toContain('tenantReadSeq');
		expect(Object.keys(item)).not.toContain('landlordReadSeq');
	});
});
