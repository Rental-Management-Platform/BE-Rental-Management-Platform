import { randomUUID } from 'node:crypto';
import { averageStars } from '../../reviews/reviews.mapper';
import { loadAmenitySeed, loadWardSeed } from '../seed-data';
import { SEED_PLANS } from '../seed-plans';
import { amenityNameMap, buildDemoRows, demoEmail } from './demo-build';
import type { DemoPlan, DemoRows } from './demo-build';
import {
	DEMO_LANDLORDS,
	DEMO_LISTINGS,
	DEMO_PROPERTIES,
	DEMO_TENANTS,
} from './demo-data';
import { DEMO_CHATS, DEMO_REVIEWS } from './demo-reviews';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-23T05:00:00.000Z');
const ADMIN_ID = randomUUID();

const plans = new Map<string, DemoPlan>(
	SEED_PLANS.map((plan) => [plan.name, { id: randomUUID(), ...plan }]),
);
const wards = new Map(loadWardSeed().map((ward) => [ward.code, ward]));
const amenityNames = amenityNameMap(loadAmenitySeed());

function build(now: Date = NOW): DemoRows {
	return buildDemoRows(
		{ now, passwordHash: 'hash', adminId: ADMIN_ID, wards, plans },
		amenityNames,
	);
}

const landlordKeys = new Set(DEMO_LANDLORDS.map((landlord) => landlord.key));
const tenantKeys = new Set(DEMO_TENANTS.map((tenant) => tenant.key));
const ownersWithListings = new Set(
	DEMO_LISTINGS.map(
		(listing) =>
			DEMO_PROPERTIES.find(
				(property) => property.key === listing.property,
			)?.landlord,
	),
);
const pairOf = (item: { tenant: string; landlord: string }): string =>
	`${item.tenant}>${item.landlord}`;

describe('DEMO_REVIEWS và DEMO_CHATS: nội dung tĩnh (spec 0014)', () => {
	it('có đúng 30 đánh giá và 5 cuộc trò chuyện thêm', () => {
		expect(DEMO_REVIEWS).toHaveLength(30);
		expect(DEMO_CHATS).toHaveLength(5);
	});

	it('mọi khóa trỏ tới người tìm trọ và chủ trọ có thật, và chủ trọ có ít nhất một tin để mở cuộc trò chuyện', () => {
		for (const item of [...DEMO_REVIEWS, ...DEMO_CHATS]) {
			expect(tenantKeys.has(item.tenant)).toBe(true);
			expect(landlordKeys.has(item.landlord)).toBe(true);
			expect(ownersWithListings.has(item.landlord)).toBe(true);
		}
	});

	it('mỗi cặp (người tìm trọ, chủ trọ) chỉ một lần, và cuộc trò chuyện thêm không trùng đánh giá', () => {
		const reviewPairs = DEMO_REVIEWS.map(pairOf);
		expect(new Set(reviewPairs).size).toBe(reviewPairs.length);
		const chatPairs = DEMO_CHATS.map(pairOf);
		expect(new Set(chatPairs).size).toBe(chatPairs.length);
		for (const pair of chatPairs) expect(reviewPairs).not.toContain(pair);
	});

	it('số sao từ 1 đến 5; nhận xét vắng hoặc 1 đến 1000 ký tự đã cắt khoảng trắng, không có NUL', () => {
		for (const review of DEMO_REVIEWS) {
			expect(Number.isInteger(review.stars)).toBe(true);
			expect(review.stars).toBeGreaterThanOrEqual(1);
			expect(review.stars).toBeLessThanOrEqual(5);
			if (review.comment === null) continue;
			expect(review.comment).toBe(review.comment.trim());
			expect(review.comment.length).toBeGreaterThanOrEqual(1);
			expect(review.comment.length).toBeLessThanOrEqual(1000);
			expect(review.comment).not.toContain('\u0000');
		}
	});

	it('mốc sửa và mốc ẩn đều nằm sau lúc viết', () => {
		for (const review of DEMO_REVIEWS) {
			expect(review.daysAgo).toBeGreaterThan(0);
			if (review.editedDaysAgo !== undefined) {
				expect(review.editedDaysAgo).toBeLessThan(review.daysAgo);
			}
			if (review.hidden !== undefined) {
				expect(review.hidden.daysAgo).toBeLessThan(review.daysAgo);
				expect(review.hidden.reason.length).toBeGreaterThan(0);
				expect(review.hidden.reason.length).toBeLessThanOrEqual(500);
			}
		}
	});

	it('có đủ các cảnh FE cần: chỉ sao, nhiều dòng, đã sửa, bị ẩn, người viết bị khóa, chủ trọ bị khóa', () => {
		expect(DEMO_REVIEWS.some((review) => review.comment === null)).toBe(
			true,
		);
		expect(
			DEMO_REVIEWS.some((review) => review.comment?.includes('\n')),
		).toBe(true);
		expect(
			DEMO_REVIEWS.some((review) => review.editedDaysAgo !== undefined),
		).toBe(true);
		expect(
			DEMO_REVIEWS.filter((review) => review.hidden !== undefined),
		).toHaveLength(1);
		const lockedTenants = DEMO_TENANTS.filter((tenant) => tenant.lock);
		const lockedLandlords = DEMO_LANDLORDS.filter(
			(landlord) => landlord.lock,
		);
		expect(
			DEMO_REVIEWS.some((review) =>
				lockedTenants.some((tenant) => tenant.key === review.tenant),
			),
		).toBe(true);
		expect(
			DEMO_REVIEWS.some((review) =>
				lockedLandlords.some(
					(landlord) => landlord.key === review.landlord,
				),
			),
		).toBe(true);
	});

	it('Mai và Hà (chủ trọ chưa có đánh giá nào) không có đánh giá', () => {
		for (const key of ['mai', 'ha']) {
			expect(
				DEMO_REVIEWS.filter((review) => review.landlord === key),
			).toEqual([]);
		}
	});

	it('có cả cảnh đã được trả lời mà chưa đánh giá, và cảnh chưa được trả lời', () => {
		expect(DEMO_CHATS.some((chat) => chat.replied)).toBe(true);
		expect(DEMO_CHATS.some((chat) => !chat.replied)).toBe(true);
		expect(DEMO_CHATS.some((chat) => chat.tenantUnread === true)).toBe(
			true,
		);
	});
});

describe('demo-build: cuộc trò chuyện và đánh giá chủ trọ (spec 0013 và 0014)', () => {
	const rows = build();
	const userId = (key: string): string => {
		const landlord = DEMO_LANDLORDS.find((item) => item.key === key);
		const tenant = DEMO_TENANTS.find((item) => item.key === key);
		const email = demoEmail((landlord ?? tenant)?.emailName as string);
		return rows.users.find((user) => user.email === email)?.id as string;
	};
	const time = (value: unknown): number => (value as Date).getTime();

	it('số dòng: 30 đánh giá, 51 cuộc trò chuyện, 101 tin nhắn, mọi id duy nhất', () => {
		expect(rows.reviews).toHaveLength(30);
		// 35 cuộc (30 bằng chứng chat của đánh giá chủ trọ cộng 5 cảnh chat) và 69 tin nhắn từ spec 0013 và 0014, cộng 16
		// cuộc hai tin (32 tin nhắn) làm bằng chứng chat của 16 đánh giá phòng (spec 0015, `demo-room-reviews.spec.ts`).
		expect(rows.conversations).toHaveLength(35 + 16);
		expect(rows.messages).toHaveLength(69 + 2 * 16);
		for (const table of [rows.reviews, rows.conversations, rows.messages]) {
			const ids = (table as readonly { id?: string }[]).map(
				(row) => row.id,
			);
			expect(new Set(ids).size).toBe(ids.length);
		}
	});

	it('đánh giá: người viết là tài khoản người tìm trọ, chủ trọ là tài khoản chủ trọ, khác nhau, mỗi cặp một dòng', () => {
		const typeOf = new Map(
			rows.users.map((user) => [user.id, user.accountType]),
		);
		const pairs = new Set<string>();
		for (const review of rows.reviews) {
			expect(typeOf.get(review.authorId)).toBe('tenant');
			expect(typeOf.get(review.landlordId)).toBe('landlord');
			expect(review.authorId).not.toBe(review.landlordId);
			pairs.add(`${review.authorId}>${review.landlordId}`);
		}
		expect(pairs.size).toBe(rows.reviews.length);
	});

	it('đánh giá thỏa các CHECK của DB: sao 1 đến 5, nhận xét null hoặc 1 đến 1000 ký tự, hai trạng thái', () => {
		for (const review of rows.reviews) {
			expect(review.stars).toBeGreaterThanOrEqual(1);
			expect(review.stars).toBeLessThanOrEqual(5);
			const comment = review.comment ?? null;
			if (comment !== null) {
				expect(comment.length).toBeGreaterThanOrEqual(1);
				expect(comment.length).toBeLessThanOrEqual(1000);
			}
			expect(['visible', 'hidden_by_admin']).toContain(review.status);
		}
	});

	it('cuộc trò chuyện thỏa các CHECK của DB và khóa ngoại: tin thuộc đúng chủ trọ, mốc đọc trong 0 đến last_seq, mỗi (tin, người nhắn) một dòng', () => {
		const listingOwner = new Map<string, string>();
		for (const listing of rows.listings) {
			const property = rows.properties.find(
				(item) => item.id === listing.propertyId,
			);
			listingOwner.set(
				listing.id as string,
				property?.landlordId as string,
			);
		}
		const keys = new Set<string>();
		for (const conversation of rows.conversations) {
			expect(listingOwner.get(conversation.listingId)).toBe(
				conversation.landlordId,
			);
			expect(conversation.tenantId).not.toBe(conversation.landlordId);
			const lastSeq = conversation.lastSeq as number;
			expect(lastSeq).toBeGreaterThanOrEqual(1);
			for (const marker of [
				conversation.tenantReadSeq as number,
				conversation.landlordReadSeq as number,
			]) {
				expect(marker).toBeGreaterThanOrEqual(0);
				expect(marker).toBeLessThanOrEqual(lastSeq);
			}
			keys.add(`${conversation.listingId}>${conversation.tenantId}`);
		}
		expect(keys.size).toBe(rows.conversations.length);
	});

	it('tin nhắn: seq liên tiếp từ 1, tin 1 của người tìm trọ, tin 2 của chủ trọ, giờ tăng, last_seq và giờ tin cuối khớp', () => {
		for (const conversation of rows.conversations) {
			const messages = rows.messages
				.filter((message) => message.conversationId === conversation.id)
				.sort((a, b) => a.seq - b.seq);
			expect(messages.map((message) => message.seq)).toEqual(
				messages.map((_, index) => index + 1),
			);
			expect(messages).toHaveLength(conversation.lastSeq as number);
			expect(messages[0]?.senderId).toBe(conversation.tenantId);
			if (messages.length === 2) {
				expect(messages[1]?.senderId).toBe(conversation.landlordId);
				expect(time(messages[1]?.createdAt)).toBeGreaterThan(
					time(messages[0]?.createdAt),
				);
			}
			expect(time(conversation.lastMessageAt)).toBe(
				time(messages[messages.length - 1]?.createdAt),
			);
			expect(time(conversation.createdAt)).toBe(
				time(messages[0]?.createdAt),
			);
			for (const message of messages) {
				expect(message.body.length).toBeGreaterThanOrEqual(1);
				expect(message.body.length).toBeLessThanOrEqual(1000);
			}
		}
	});

	it('điều kiện được đánh giá (AC-4): mỗi đánh giá có một cuộc trò chuyện cùng cặp mà chủ trọ đã trả lời TRƯỚC lúc viết', () => {
		for (const review of rows.reviews) {
			const conversation = rows.conversations.find(
				(item) =>
					item.tenantId === review.authorId &&
					item.landlordId === review.landlordId,
			);
			expect(conversation).toBeDefined();
			const reply = rows.messages.find(
				(message) =>
					message.conversationId === conversation?.id &&
					message.senderId === review.landlordId,
			);
			expect(reply).toBeDefined();
			expect(time(reply?.createdAt)).toBeLessThan(time(review.createdAt));
		}
	});

	it('cuộc trò chuyện không xảy ra trước khi người tìm trọ, chủ trọ hay tin tồn tại, và không ở tương lai', () => {
		const created = new Map<string, number>();
		for (const table of [rows.users, rows.listings]) {
			for (const row of table)
				created.set(row.id as string, time(row.createdAt));
		}
		for (const conversation of rows.conversations) {
			const start = time(conversation.createdAt);
			for (const id of [
				conversation.tenantId,
				conversation.landlordId,
				conversation.listingId,
			]) {
				expect(start).toBeGreaterThan(created.get(id) as number);
			}
			expect(time(conversation.lastMessageAt)).toBeLessThan(
				NOW.getTime(),
			);
		}
	});

	it('đánh giá không xảy ra trước khi hai bên tồn tại, không ở tương lai, updated_at không trước created_at', () => {
		const created = new Map(
			rows.users.map((user) => [user.id, time(user.createdAt)]),
		);
		for (const review of rows.reviews) {
			expect(time(review.createdAt)).toBeGreaterThan(
				created.get(review.authorId) as number,
			);
			expect(time(review.createdAt)).toBeGreaterThan(
				created.get(review.landlordId) as number,
			);
			expect(time(review.createdAt)).toBeLessThan(NOW.getTime());
			expect(time(review.updatedAt)).toBeGreaterThanOrEqual(
				time(review.createdAt),
			);
			expect(time(review.updatedAt)).toBeLessThan(NOW.getTime());
		}
	});

	it('đúng một đánh giá bị ẩn, có đúng một dòng nhật ký hide_review của admin kèm lý do, sau lúc viết; đánh giá đang hiện không có dòng nào', () => {
		const hidden = rows.reviews.filter(
			(review) => review.status === 'hidden_by_admin',
		);
		expect(hidden).toHaveLength(1);
		const logs = rows.moderationLogs.filter(
			(log) => log.targetType === 'review',
		);
		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({
			actorId: ADMIN_ID,
			targetId: hidden[0]?.id,
			action: 'hide_review',
			reason: 'Nội dung xúc phạm cá nhân.',
		});
		expect(time(logs[0]?.createdAt)).toBeGreaterThan(
			time(hidden[0]?.createdAt),
		);
		expect(time(logs[0]?.createdAt)).toBeLessThan(NOW.getTime());
		expect(hidden[0]?.authorId).toBe(userId('quan'));
		expect(hidden[0]?.landlordId).toBe(userId('nhung'));
	});

	it('có đánh giá đã sửa (updated_at khác created_at) và đánh giá chưa sửa (hai mốc bằng nhau)', () => {
		const edited = rows.reviews.filter(
			(review) => time(review.updatedAt) > time(review.createdAt),
		);
		expect(edited).toHaveLength(
			DEMO_REVIEWS.filter((review) => review.editedDaysAgo !== undefined)
				.length,
		);
		expect(
			rows.reviews.some(
				(review) => time(review.updatedAt) === time(review.createdAt),
			),
		).toBe(true);
	});

	/** Hai con số của hồ sơ theo luật của API: đánh giá đang hiện của người viết đang hoạt động, chủ trọ đang hoạt động. */
	function publicNumbers(key: string) {
		const landlord = rows.users.find((user) => user.id === userId(key));
		if (landlord?.status !== 'active') return null;
		const active = new Set(
			rows.users
				.filter((user) => user.status === 'active')
				.map((user) => user.id),
		);
		const counted = rows.reviews.filter(
			(review) =>
				review.landlordId === landlord.id &&
				review.status === 'visible' &&
				active.has(review.authorId),
		);
		return {
			count: counted.length,
			average: averageStars(
				counted.length,
				counted.reduce((sum, review) => sum + review.stars, 0),
			),
		};
	}

	it.each([
		['khoa', 8, 4.5],
		['nhung', 7, 4.3],
		['bao', 4, 3.3],
		['phat', 3, 4.7],
		['huy', 2, 4.5],
		['tam', 1, 5],
	])(
		'hồ sơ %s: %i đánh giá hiện công khai, trung bình %f',
		(key, count, average) => {
			expect(publicNumbers(key)).toEqual({ count, average });
		},
	);

	it('Mai và Hà chưa có đánh giá (trung bình null); Lan bị khóa nên hồ sơ 404 dù còn 3 đánh giá', () => {
		expect(publicNumbers('mai')).toEqual({ count: 0, average: null });
		expect(publicNumbers('ha')).toEqual({ count: 0, average: null });
		expect(publicNumbers('lan')).toBeNull();
		expect(
			rows.reviews.filter(
				(review) => review.landlordId === userId('lan'),
			),
		).toHaveLength(3);
	});

	it('đánh giá của người viết bị khóa (Sơn về Khoa) còn trong bảng nhưng không tính vào hồ sơ của Khoa', () => {
		const son = userId('son');
		expect(
			rows.reviews.filter((review) => review.authorId === son),
		).toHaveLength(1);
		// Khoa có 9 dòng, hồ sơ chỉ tính 8.
		expect(
			rows.reviews.filter(
				(review) => review.landlordId === userId('khoa'),
			),
		).toHaveLength(9);
		expect(publicNumbers('khoa')?.count).toBe(8);
	});

	it('các cảnh chat thêm: Lan Anh và Việt đã được Phát trả lời mà chưa đánh giá, Tuấn nhắn Bảo chưa được trả lời, Linh chưa đọc tin trả lời', () => {
		const find = (tenant: string, landlord: string) =>
			rows.conversations.find(
				(item) =>
					item.tenantId === userId(tenant) &&
					item.landlordId === userId(landlord),
			);
		const reviewed = (tenant: string, landlord: string): boolean =>
			rows.reviews.some(
				(review) =>
					review.authorId === userId(tenant) &&
					review.landlordId === userId(landlord),
			);
		for (const [tenant, landlord] of [
			['lananh', 'phat'],
			['viet', 'phat'],
			['yen', 'tam'],
		]) {
			expect(find(tenant, landlord)?.lastSeq).toBe(2);
			expect(reviewed(tenant, landlord)).toBe(false);
		}
		const unanswered = find('tuan', 'bao');
		expect(unanswered?.lastSeq).toBe(1);
		expect(unanswered?.landlordReadSeq).toBe(0);
		const unread = find('linh', 'nhung');
		expect(unread?.lastSeq).toBe(2);
		expect(unread?.tenantReadSeq).toBe(1);
	});

	it('chạy lại cùng đầu vào thì nội dung và mốc thời gian giống hệt (chỉ id ngẫu nhiên khác)', () => {
		const again = build();
		expect(
			again.reviews.map((row) => [row.stars, row.comment, row.status]),
		).toEqual(
			rows.reviews.map((row) => [row.stars, row.comment, row.status]),
		);
		expect(again.reviews.map((row) => time(row.createdAt))).toEqual(
			rows.reviews.map((row) => time(row.createdAt)),
		);
		expect(again.messages.map((row) => row.body)).toEqual(
			rows.messages.map((row) => row.body),
		);
	});

	it('dựng ở một thời điểm muộn hơn 10 ngày vẫn hợp lệ và mọi mốc dời theo', () => {
		const later = build(new Date(NOW.getTime() + 10 * DAY_MS));
		expect(later.reviews).toHaveLength(30);
		expect(
			time(later.reviews[0]?.createdAt) -
				time(rows.reviews[0]?.createdAt),
		).toBe(10 * DAY_MS);
	});
});
