import { randomUUID } from 'node:crypto';
import { averageStars } from '../../reviews/reviews.mapper';
import { loadAmenitySeed, loadWardSeed } from '../seed-data';
import { SEED_PLANS } from '../seed-plans';
import { amenityNameMap, buildDemoRows, demoEmail } from './demo-build';
import type { DemoPlan, DemoRows } from './demo-build';
import { DEMO_LANDLORDS, DEMO_LISTINGS, DEMO_TENANTS } from './demo-data';
import { DEMO_ROOM_REVIEWS } from './demo-room-reviews';

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

const tenantKeys = new Set(DEMO_TENANTS.map((tenant) => tenant.key));
const listingTitles = DEMO_LISTINGS.map((listing) => listing.title);
const pairOf = (item: { tenant: string; listing: string }): string =>
	`${item.tenant}>${item.listing}`;
const titlesWithReviews = (): Set<string> =>
	new Set(DEMO_ROOM_REVIEWS.map((review) => review.listing));

describe('DEMO_ROOM_REVIEWS: nội dung tĩnh (spec 0015 AC-16)', () => {
	it('có đúng 16 đánh giá phòng', () => {
		expect(DEMO_ROOM_REVIEWS).toHaveLength(16);
	});

	it('tiêu đề tin trong DEMO_LISTINGS không trùng nhau (đánh giá nhận ra tin bằng tiêu đề)', () => {
		expect(new Set(listingTitles).size).toBe(listingTitles.length);
	});

	it('mọi khóa người tìm trọ và mọi tiêu đề tin trỏ tới dữ liệu có thật', () => {
		for (const review of DEMO_ROOM_REVIEWS) {
			expect(tenantKeys.has(review.tenant)).toBe(true);
			expect(listingTitles).toContain(review.listing);
		}
	});

	it('mỗi cặp (người tìm trọ, tin) chỉ một lần', () => {
		const pairs = DEMO_ROOM_REVIEWS.map(pairOf);
		expect(new Set(pairs).size).toBe(pairs.length);
	});

	it('số sao từ 1 đến 5; nhận xét vắng hoặc 1 đến 1000 ký tự đã cắt khoảng trắng, không có NUL', () => {
		for (const review of DEMO_ROOM_REVIEWS) {
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
		for (const review of DEMO_ROOM_REVIEWS) {
			if (review.editedDaysAgo !== undefined) {
				expect(review.editedDaysAgo).toBeLessThan(review.daysAgo);
			}
			if (review.hidden !== undefined) {
				expect(review.hidden.daysAgo).toBeLessThan(review.daysAgo);
				expect(review.hidden.reason.trim().length).toBeGreaterThan(0);
			}
		}
	});

	it('có đủ các cảnh FE cần: chỉ sao, nhiều dòng, đã sửa, bị admin ẩn, người viết bị khóa, tin đang ẩn, tin chưa có đánh giá', () => {
		expect(
			DEMO_ROOM_REVIEWS.some((review) => review.comment === null),
		).toBe(true);
		expect(
			DEMO_ROOM_REVIEWS.some((review) => review.comment?.includes('\n')),
		).toBe(true);
		expect(
			DEMO_ROOM_REVIEWS.some(
				(review) => review.editedDaysAgo !== undefined,
			),
		).toBe(true);
		expect(
			DEMO_ROOM_REVIEWS.filter((review) => review.hidden !== undefined),
		).toHaveLength(1);
		const locked = DEMO_TENANTS.filter(
			(tenant) => tenant.lock !== undefined,
		).map((tenant) => tenant.key);
		expect(
			DEMO_ROOM_REVIEWS.some((review) => locked.includes(review.tenant)),
		).toBe(true);
		const hiddenListings = new Set(
			DEMO_LISTINGS.filter((listing) => listing.status !== 'visible').map(
				(listing) => listing.title,
			),
		);
		expect(
			DEMO_ROOM_REVIEWS.some((review) =>
				hiddenListings.has(review.listing),
			),
		).toBe(true);
		expect(titlesWithReviews().size).toBeLessThan(DEMO_LISTINGS.length);
	});

	it('người viết bị khóa không viết sau lúc bị khóa', () => {
		for (const tenant of DEMO_TENANTS) {
			if (tenant.lock === undefined) continue;
			for (const review of DEMO_ROOM_REVIEWS) {
				if (review.tenant !== tenant.key) continue;
				expect(review.daysAgo).toBeGreaterThan(tenant.lock.daysAgo);
			}
		}
	});
});

describe('demo-build: đánh giá phòng, cuộc trò chuyện và nhật ký (spec 0015 AC-16)', () => {
	const rows = build();
	const time = (value: unknown): number => (value as Date).getTime();
	const userId = (key: string): string => {
		const tenant = DEMO_TENANTS.find((item) => item.key === key);
		const landlord = DEMO_LANDLORDS.find((item) => item.key === key);
		const email = demoEmail((tenant ?? landlord)?.emailName as string);
		return rows.users.find((user) => user.email === email)?.id as string;
	};
	const listingId = (title: string): string =>
		rows.listings.find((listing) => listing.title === title)?.id as string;
	const landlordOfListing = (id: string): string => {
		const listing = rows.listings.find((item) => item.id === id);
		return rows.properties.find((item) => item.id === listing?.propertyId)
			?.landlordId as string;
	};

	it('số dòng: 16 đánh giá phòng, mọi id duy nhất, đánh giá chủ trọ vẫn 30', () => {
		expect(rows.listingReviews).toHaveLength(16);
		expect(rows.reviews).toHaveLength(30);
		const ids = rows.listingReviews.map((row) => row.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('người viết là tài khoản người tìm trọ, tin có thật, mỗi cặp (người viết, tin) một dòng', () => {
		const typeOf = new Map(
			rows.users.map((user) => [user.id, user.accountType]),
		);
		const listingSet = new Set(rows.listings.map((listing) => listing.id));
		const pairs = new Set<string>();
		for (const review of rows.listingReviews) {
			expect(typeOf.get(review.authorId)).toBe('tenant');
			expect(listingSet.has(review.listingId)).toBe(true);
			pairs.add(`${review.authorId}>${review.listingId}`);
		}
		expect(pairs.size).toBe(rows.listingReviews.length);
	});

	it('đánh giá thỏa các CHECK của DB: sao 1 đến 5, nhận xét null hoặc 1 đến 1000 ký tự, hai trạng thái', () => {
		for (const review of rows.listingReviews) {
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

	it('điều kiện được đánh giá (AC-4): mỗi đánh giá có cuộc trò chuyện của chính người viết VỀ ĐÚNG TIN ĐÓ, chủ trọ của tin đã trả lời TRƯỚC lúc viết', () => {
		for (const review of rows.listingReviews) {
			const landlordId = landlordOfListing(review.listingId);
			const conversation = rows.conversations.find(
				(item) =>
					item.listingId === review.listingId &&
					item.tenantId === review.authorId,
			);
			expect(conversation).toBeDefined();
			expect(conversation?.landlordId).toBe(landlordId);
			const reply = rows.messages.find(
				(message) =>
					message.conversationId === conversation?.id &&
					message.senderId === landlordId,
			);
			expect(reply).toBeDefined();
			expect(time(reply?.createdAt)).toBeLessThan(time(review.createdAt));
		}
	});

	it('mỗi (tin, người nhắn) vẫn đúng một cuộc trò chuyện sau khi thêm chat của đánh giá phòng', () => {
		const pairs = rows.conversations.map(
			(item) => `${item.listingId}>${item.tenantId}`,
		);
		expect(new Set(pairs).size).toBe(pairs.length);
		expect(rows.conversations).toHaveLength(35 + 16);
	});

	it('cuộc trò chuyện của đánh giá phòng không xảy ra trước khi hai bên và tin tồn tại, và không ở tương lai', () => {
		const created = new Map<string, number>();
		for (const table of [rows.users, rows.listings]) {
			for (const row of table)
				created.set(row.id as string, time(row.createdAt));
		}
		for (const review of rows.listingReviews) {
			const conversation = rows.conversations.find(
				(item) =>
					item.listingId === review.listingId &&
					item.tenantId === review.authorId,
			);
			const start = time(conversation?.createdAt);
			expect(start).toBeGreaterThan(
				created.get(review.authorId) as number,
			);
			expect(start).toBeGreaterThan(
				created.get(review.listingId) as number,
			);
			expect(time(conversation?.lastMessageAt)).toBeLessThan(
				NOW.getTime(),
			);
		}
	});

	it('đánh giá không xảy ra trước khi người viết và tin tồn tại, không ở tương lai, updated_at không trước created_at', () => {
		const created = new Map<string, number>();
		for (const table of [rows.users, rows.listings]) {
			for (const row of table)
				created.set(row.id as string, time(row.createdAt));
		}
		for (const review of rows.listingReviews) {
			expect(time(review.createdAt)).toBeGreaterThan(
				created.get(review.authorId) as number,
			);
			expect(time(review.createdAt)).toBeGreaterThan(
				created.get(review.listingId) as number,
			);
			expect(time(review.createdAt)).toBeLessThan(NOW.getTime());
			expect(time(review.updatedAt)).toBeGreaterThanOrEqual(
				time(review.createdAt),
			);
			expect(time(review.updatedAt)).toBeLessThan(NOW.getTime());
		}
	});

	it('đúng một đánh giá phòng bị ẩn, có đúng một dòng nhật ký hide_listing_review của admin kèm lý do, sau lúc viết; đánh giá đang hiện không có dòng nào', () => {
		const hidden = rows.listingReviews.filter(
			(review) => review.status === 'hidden_by_admin',
		);
		expect(hidden).toHaveLength(1);
		const logs = rows.moderationLogs.filter(
			(log) => log.targetType === 'listing_review',
		);
		expect(logs).toHaveLength(1);
		expect(logs[0]).toMatchObject({
			actorId: ADMIN_ID,
			targetId: hidden[0]?.id,
			action: 'hide_listing_review',
			reason: 'Nội dung xúc phạm cá nhân.',
		});
		expect(time(logs[0]?.createdAt)).toBeGreaterThan(
			time(hidden[0]?.createdAt),
		);
		expect(time(logs[0]?.createdAt)).toBeLessThan(NOW.getTime());
		expect(hidden[0]?.authorId).toBe(userId('quan'));
		expect(hidden[0]?.listingId).toBe(
			listingId('Phòng trọ 18m² mới xây, wifi tốc độ cao'),
		);
	});

	it('nhật ký của đánh giá chủ trọ không đổi: vẫn đúng một dòng hide_review', () => {
		const logs = rows.moderationLogs.filter(
			(log) => log.targetType === 'review',
		);
		expect(logs).toHaveLength(1);
		expect(logs[0]?.action).toBe('hide_review');
	});

	it('có đánh giá đã sửa (updated_at khác created_at) và đánh giá chưa sửa (hai mốc bằng nhau)', () => {
		const edited = rows.listingReviews.filter(
			(review) => time(review.updatedAt) > time(review.createdAt),
		);
		expect(edited).toHaveLength(
			DEMO_ROOM_REVIEWS.filter(
				(review) => review.editedDaysAgo !== undefined,
			).length,
		);
		expect(
			rows.listingReviews.some(
				(review) => time(review.updatedAt) === time(review.createdAt),
			),
		).toBe(true);
	});

	/**
	 * Hai con số của chi tiết tin theo luật của API (spec 0015 AC-1), tính độc lập với code lưu: đánh giá `visible` của
	 * người viết đang hoạt động. Luật hiển thị công khai của tin là việc riêng (chi tiết tin 404), không nằm ở đây.
	 */
	function publicNumbers(title: string) {
		const active = new Set(
			rows.users
				.filter((user) => user.status === 'active')
				.map((user) => user.id),
		);
		const counted = rows.listingReviews.filter(
			(review) =>
				review.listingId === listingId(title) &&
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
		['Phòng trọ 18m² mới xây, wifi tốc độ cao', 4, 4.3],
		['Studio ban công riêng, view thoáng, đường Võ Văn Ngân', 3, 4.7],
		['Studio Pasteur cửa sổ lớn, dọn phòng hai lần mỗi tuần', 1, 5],
		['Phòng trọ 20m² sạch sẽ, gần sân bay Tân Sơn Nhất', 3, 3],
		['Phòng 20m² có gác, gần Aeon Mall Bình Tân', 2, 4.5],
		['Phòng tầng 2 đã cho thuê, tạm ẩn tin', 1, 3],
	])('tin "%s": %i đánh giá tính, trung bình %f', (title, count, average) => {
		expect(publicNumbers(title)).toEqual({ count, average });
	});

	it('điểm lẻ làm tròn nửa lên: 4 đánh giá (5, 4, 4, 4) là 4,25 thành 4,3, không phải 4,2', () => {
		const title = 'Phòng trọ 18m² mới xây, wifi tốc độ cao';
		const counted = rows.listingReviews.filter(
			(review) =>
				review.listingId === listingId(title) &&
				review.status === 'visible' &&
				review.authorId !== userId('son'),
		);
		expect(counted.map((review) => review.stars).sort()).toEqual([
			4, 4, 4, 5,
		]);
		expect(publicNumbers(title).average).toBe(4.3);
	});

	it('phòng 18m² của Khoa có 6 dòng nhưng chỉ 4 tính: một bị admin ẩn, một của người viết bị khóa (Sơn)', () => {
		const title = 'Phòng trọ 18m² mới xây, wifi tốc độ cao';
		const all = rows.listingReviews.filter(
			(review) => review.listingId === listingId(title),
		);
		expect(all).toHaveLength(6);
		expect(
			all.find((review) => review.authorId === userId('son')),
		).toBeDefined();
		const sonUser = rows.users.find((user) => user.id === userId('son'));
		expect(sonUser?.status).not.toBe('active');
		expect(publicNumbers(title).count).toBe(4);
	});

	it('có tin chưa có đánh giá nào (trung bình null), ví dụ phòng có gác đầu tiên của Khoa', () => {
		expect(
			publicNumbers(
				'Phòng trọ sinh viên gần ĐH Công nghiệp, có gác, giờ giấc tự do',
			),
		).toEqual({ count: 0, average: null });
	});

	it('đánh giá của tin đang bị chủ trọ ẩn còn nguyên trong bảng', () => {
		const title = 'Phòng tầng 2 đã cho thuê, tạm ẩn tin';
		const listing = rows.listings.find((item) => item.title === title);
		expect(listing?.status).toBe('hidden_by_owner');
		expect(
			rows.listingReviews.filter(
				(review) => review.listingId === listing?.id,
			),
		).toHaveLength(1);
	});

	it('đánh giá chủ trọ và đánh giá phòng không lẫn nhau: số dòng và điểm hồ sơ chủ trọ như cũ', () => {
		const khoa = userId('khoa');
		expect(
			rows.reviews.filter((review) => review.landlordId === khoa),
		).toHaveLength(9);
		for (const review of rows.listingReviews) {
			expect(rows.reviews.map((item) => item.id)).not.toContain(
				review.id,
			);
		}
	});

	it('cảnh canReview: Lan Anh đã được Phát trả lời mà chưa đánh giá phòng đó (viết được); Tuấn nhắn Bảo chưa được trả lời (viết bị 403)', () => {
		const chat = rows.conversations.find(
			(item) =>
				item.tenantId === userId('lananh') &&
				item.landlordId === userId('phat'),
		);
		expect(chat?.lastSeq).toBe(2);
		expect(landlordOfListing(chat?.listingId as string)).toBe(
			userId('phat'),
		);
		expect(
			rows.listingReviews.some(
				(review) =>
					review.authorId === userId('lananh') &&
					review.listingId === chat?.listingId,
			),
		).toBe(false);
		const unanswered = rows.conversations.find(
			(item) =>
				item.tenantId === userId('tuan') &&
				item.landlordId === userId('bao'),
		);
		expect(unanswered?.lastSeq).toBe(1);
		expect(
			rows.listingReviews.some(
				(review) =>
					review.authorId === userId('tuan') &&
					review.listingId === unanswered?.listingId,
			),
		).toBe(false);
	});

	it('cảnh "chat về tin khác của cùng chủ trọ": Linh được Nhung trả lời ở tin cũ nhất của Nhung, nên chưa đủ điều kiện đánh giá các tin khác của Nhung', () => {
		const chats = rows.conversations.filter(
			(item) =>
				item.tenantId === userId('linh') &&
				item.landlordId === userId('nhung'),
		);
		expect(chats).toHaveLength(1);
		const nhungListings = rows.listings.filter(
			(listing) =>
				landlordOfListing(listing.id as string) === userId('nhung'),
		);
		expect(nhungListings.length).toBeGreaterThan(1);
		expect(
			nhungListings.filter(
				(listing) => listing.id !== chats[0]?.listingId,
			).length,
		).toBeGreaterThan(0);
	});

	it('chạy lại cùng đầu vào thì nội dung và mốc thời gian giống hệt (chỉ id ngẫu nhiên khác)', () => {
		const again = build();
		expect(
			again.listingReviews.map((row) => [
				row.stars,
				row.comment,
				row.status,
			]),
		).toEqual(
			rows.listingReviews.map((row) => [
				row.stars,
				row.comment,
				row.status,
			]),
		);
		expect(again.listingReviews.map((row) => time(row.createdAt))).toEqual(
			rows.listingReviews.map((row) => time(row.createdAt)),
		);
	});

	it('dựng ở một thời điểm muộn hơn 10 ngày vẫn hợp lệ và mọi mốc dời theo', () => {
		const later = build(new Date(NOW.getTime() + 10 * DAY_MS));
		expect(later.listingReviews).toHaveLength(16);
		expect(
			time(later.listingReviews[0]?.createdAt) -
				time(rows.listingReviews[0]?.createdAt),
		).toBe(10 * DAY_MS);
	});
});
