import type { ConversationRow, MessageRow } from './chat.repository';

/** Dữ liệu dựng sẵn cho test của module chat (không dùng ở mã chạy thật). */
export const LANDLORD_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
export const TENANT_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';
export const ADMIN_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';
export const OUTSIDER_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d04';
export const LISTING_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d11';
export const CONVERSATION_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d51';
export const COVER_KEY = 'public/0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d21.jpg';

export const NOW = new Date('2026-11-05T03:00:00.000Z');
export const AT = new Date('2026-11-05T02:50:00.000Z');

export function messageRow(
	seq: number,
	senderId: string,
	body = `Tin số ${seq}`,
): MessageRow {
	return {
		id: `0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8e${String(seq).padStart(2, '0')}`,
		seq,
		senderId,
		body,
		createdAt: new Date(AT.getTime() + seq * 60_000),
	};
}

export function conversationRow(
	overrides: Partial<ConversationRow> = {},
): ConversationRow {
	return {
		id: CONVERSATION_ID,
		listingId: LISTING_ID,
		tenantId: TENANT_ID,
		landlordId: LANDLORD_ID,
		lastSeq: 4,
		tenantReadSeq: 4,
		landlordReadSeq: 2,
		lastMessageAt: new Date('2026-11-05T03:10:00.000Z'),
		createdAt: AT,
		listing: {
			id: LISTING_ID,
			code: 'k3m9x2ab',
			title: 'Phòng trọ gần đại học',
			price: 3_000_000,
			images: [{ storageKey: COVER_KEY }],
		},
		tenant: { id: TENANT_ID, name: 'Bạn Lan' },
		landlord: { id: LANDLORD_ID, name: 'Chú Tám' },
		...overrides,
	};
}
