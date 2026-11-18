import type { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
	chatQuery,
	dailyViewsQuery,
	favoritesQuery,
	followersQuery,
	landlordReviewsQuery,
	listingCountsQuery,
	paidOrdersQuery,
	roomReviewsQuery,
	StatisticsRepository,
	topListingsQuery,
} from './statistics.repository';

const LANDLORD = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
/** Nửa đêm giờ Việt Nam của 18/09/2026 và của 17/11/2026 (chuỗi ISO có Z, như `toRangeBounds`). */
const START = '2026-09-17T17:00:00.000Z';
const END = '2026-11-16T17:00:00.000Z';
const flat = (text: string): string => text.replace(/\s+/g, ' ');

/** Ba câu SQL đều chỉ đọc: không câu nào ghi, khóa dòng hay đổi `updated_at` (spec 0017 AC-1). */
const WRITE_WORDS =
	/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|FOR UPDATE|FOR SHARE|updated_at)\b/i;

describe('listingCountsQuery (spec 0017 AC-4, AC-6)', () => {
	const query = listingCountsQuery(LANDLORD);
	const text = flat(query.text);

	it('chỉ có một tham số là id chủ trọ, ép uuid; không có tham số nào khác', () => {
		expect(query.values).toEqual([LANDLORD]);
		expect(text).toContain('p.landlord_id = $1::uuid');
	});

	it('ba số đếm đều chỉ tính tin chưa xóa mềm, mỗi số một trạng thái', () => {
		expect(text).toContain(
			`count(*) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'visible')::int AS "visible"`,
		);
		expect(text).toContain(
			`count(*) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'hidden_by_owner')::int AS "hiddenByOwner"`,
		);
		expect(text).toContain(
			`count(*) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'hidden_by_admin')::int AS "hiddenByAdmin"`,
		);
	});

	it('tổng view_count tính cả tin ẩn và xóa mềm (không lọc deleted_at ở WHERE), SUM đổi sang bigint', () => {
		expect(text).toContain(
			'COALESCE(SUM(l.view_count), 0)::bigint AS "viewCountAllTime"',
		);
		// Phần sau FROM (phép nối và WHERE thật) không nhắc tới deleted_at; chỉ ba FILTER ở SELECT mới có.
		const afterFrom = text.split('FROM listings l')[1] ?? '';
		expect(afterFrom).not.toContain('deleted_at');
		expect(text).not.toContain('GROUP BY');
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('dailyViewsQuery (spec 0017 AC-6, AC-13)', () => {
	const query = dailyViewsQuery(LANDLORD, '2026-09-18', '2026-11-16');
	const text = flat(query.text);

	it('ba tham số theo thứ tự: chủ trọ, ngày đầu, ngày cuối; hai ngày là chuỗi YYYY-MM-DD ép date', () => {
		expect(query.values).toEqual([LANDLORD, '2026-09-18', '2026-11-16']);
		expect(text).toContain('p.landlord_id = $1::uuid');
		expect(text).toContain('v.day >= $2::date');
		expect(text).toContain('v.day <= $3::date');
	});

	it('so thẳng cột day với ngày, không đổi múi giờ (day đã là ngày giờ Việt Nam)', () => {
		expect(text).not.toContain('AT TIME ZONE');
		expect(text).not.toContain('timestamptz');
	});

	it('cộng mọi tin của chủ trọ kể cả tin ẩn và xóa mềm: không lọc status hay deleted_at', () => {
		expect(text).not.toContain('l.status');
		expect(text).not.toContain('deleted_at');
	});

	it('gom theo ngày, sắp ngày tăng dần, ngày trả về là chuỗi to_char, tổng đổi sang bigint', () => {
		expect(text).toContain(`to_char(v.day, 'YYYY-MM-DD') AS "day"`);
		expect(text).toContain('SUM(v.views)::bigint AS "count"');
		expect(text).toContain('GROUP BY v.day ORDER BY v.day');
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('topListingsQuery (spec 0017 AC-7)', () => {
	const query = topListingsQuery(LANDLORD, '2026-10-18', '2026-11-16', 3, 5);
	const text = flat(query.text);

	it('tham số: chủ trọ (hai chỗ), hạn mức, hai ngày, số dòng; id chủ trọ chỉ là một giá trị', () => {
		expect(query.values).toEqual([
			LANDLORD,
			3,
			LANDLORD,
			'2026-10-18',
			'2026-11-16',
			5,
		]);
		expect(text).toContain('p2.landlord_id = $1::uuid');
		expect(text).toContain('< $2::int');
		expect(text).toContain('p.landlord_id = $3::uuid');
		expect(text).toContain('v.day >= $4::date');
		expect(text).toContain('v.day <= $5::date');
		expect(text).toContain('LIMIT $6::int');
	});

	it('chỉ tin chưa xóa mềm, và chỉ tin có tổng lượt lớn hơn 0 trong khoảng', () => {
		expect(text).toContain('AND l.deleted_at IS NULL AND v.day');
		expect(text).toContain('GROUP BY l.id HAVING SUM(v.views) > 0');
	});

	it('sắp lượt trong khoảng giảm dần, rồi created_at giảm dần, rồi id giảm dần', () => {
		expect(text).toContain(
			'ORDER BY "viewsInRange" DESC, l.created_at DESC, l.id DESC',
		);
	});

	it('isPublic: tin visible và hạng (số tin visible chưa xóa của cùng chủ trọ đăng sớm hơn) nhỏ hơn hạn mức', () => {
		expect(text).toContain(`l.status = 'visible' AND ( SELECT count(*)`);
		expect(text).toContain(
			`l2.status = 'visible' AND l2.deleted_at IS NULL`,
		);
		expect(text).toContain('(l2.created_at, l2.id) < (l.created_at, l.id)');
		expect(text).toContain(') AS "isPublic"');
	});

	it('lượt trong khoảng là bigint, lượt từ trước đến nay là view_count của tin', () => {
		expect(text).toContain('SUM(v.views)::bigint AS "viewsInRange"');
		expect(text).toContain('l.view_count AS "viewsAllTime"');
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

/** Năm nguồn dùng chung khung "theo ngày cộng một tổng" (`dailyWithTotal`). */
const AGGREGATE_QUERIES = [
	['favoritesQuery', favoritesQuery],
	['followersQuery', followersQuery],
	['landlordReviewsQuery', landlordReviewsQuery],
	['roomReviewsQuery', roomReviewsQuery],
	['paidOrdersQuery', paidOrdersQuery],
] as const;

describe.each(AGGREGATE_QUERIES)(
	'%s: khung theo ngày cộng tổng (spec 0017 AC-8 đến AC-13)',
	(_name, build) => {
		const query = build(LANDLORD, START, END);
		const text = flat(query.text);

		it('bốn tham số theo thứ tự: chủ trọ, múi giờ, hai cận; id chủ trọ chỉ là một giá trị ràng buộc', () => {
			expect(query.values).toEqual([
				LANDLORD,
				'Asia/Ho_Chi_Minh',
				START,
				END,
			]);
			expect(text).toContain('$1::uuid');
		});

		it('ngày giờ Việt Nam: AT TIME ZONE với múi giờ là tham số, không phụ thuộc múi giờ phiên của database', () => {
			expect(text).toContain(
				`to_char(m.occurred_at AT TIME ZONE $2::text, 'YYYY-MM-DD') AS "day"`,
			);
			expect(text).not.toContain('Asia/Ho_Chi_Minh');
		});

		it('cận dưới gồm, cận trên so chặt `<`, cả hai là chuỗi ISO ép timestamptz', () => {
			expect(text).toContain(
				'm.occurred_at >= $3::timestamptz AND m.occurred_at < $4::timestamptz',
			);
			expect(text).not.toContain('<= $4');
		});

		it('một câu cho cả hai: các dòng theo ngày cộng đúng một dòng tổng có day là NULL, trên mọi dòng của nguồn', () => {
			expect(text).toContain('GROUP BY 1 UNION ALL');
			expect(text).toContain(`SELECT NULL::text AS "day"`);
			// Dòng tổng đọc lại nguồn `mine` không có điều kiện ngày.
			const totalRow = text.split('UNION ALL')[1] ?? '';
			expect(totalRow).not.toContain('occurred_at >=');
			expect(totalRow).toContain('FROM mine m');
		});

		it('đếm và tổng đều ép bigint (SUM ra numeric nên ép về bigint, không bao giờ int4)', () => {
			expect(text).toContain('count(*)::bigint AS "count"');
			expect(text).toContain(
				'COALESCE(SUM(m.amount), 0)::bigint AS "amount"',
			);
			expect(text).not.toContain('::int ');
		});

		it('chỉ đọc', () => {
			expect(text).not.toMatch(WRITE_WORDS);
		});
	},
);

describe('favoritesQuery (spec 0017 AC-8)', () => {
	const text = flat(favoritesQuery(LANDLORD, START, END).text);

	it('lưu trên mọi tin của chủ trọ qua nhà trọ, kể cả tin ẩn và xóa mềm: không lọc status hay deleted_at', () => {
		expect(text).toContain(
			'FROM favorites f JOIN listings l ON l.id = f.listing_id JOIN properties p ON p.id = l.property_id WHERE p.landlord_id = $1::uuid',
		);
		expect(text).not.toContain('deleted_at');
		expect(text).not.toContain('status');
	});

	it('chỉ đếm, không cộng số nào (amount là 0)', () => {
		expect(text).toContain('0::bigint AS amount');
	});
});

describe('followersQuery (spec 0017 AC-8)', () => {
	const text = flat(followersQuery(LANDLORD, START, END).text);

	it('theo dõi của chủ trọ này, chỉ người theo dõi là tài khoản active chưa xóa mềm (luật của hồ sơ chủ trọ)', () => {
		expect(text).toContain(
			"FROM follows f JOIN users u ON u.id = f.user_id WHERE f.landlord_id = $1::uuid AND u.status = 'active' AND u.deleted_at IS NULL",
		);
	});
});

describe('landlordReviewsQuery (spec 0017 AC-9)', () => {
	const text = flat(landlordReviewsQuery(LANDLORD, START, END).text);

	it('đánh giá của chính chủ trọ: bảng reviews, visible, người viết active chưa xóa mềm; amount là số sao', () => {
		expect(text).toContain(
			'FROM reviews r JOIN users u ON u.id = r.author_id',
		);
		expect(text).toContain(
			`r.landlord_id = $1::uuid AND r.status = 'visible' AND u.status = 'active' AND u.deleted_at IS NULL`,
		);
		expect(text).toContain('r.stars::bigint AS amount');
	});

	it('không chạm bảng đánh giá phòng (hai điểm không bao giờ lẫn nhau)', () => {
		expect(text).not.toContain('listing_reviews');
	});
});

describe('roomReviewsQuery (spec 0017 AC-9)', () => {
	const text = flat(roomReviewsQuery(LANDLORD, START, END).text);

	it('đánh giá phòng qua mọi tin chưa xóa mềm của chủ trọ (kể cả tin ẩn): chỉ lọc deleted_at, không lọc status của tin', () => {
		expect(text).toContain(
			'FROM listing_reviews lr JOIN listings l ON l.id = lr.listing_id JOIN properties p ON p.id = l.property_id JOIN users u ON u.id = lr.author_id',
		);
		expect(text).toContain(
			'p.landlord_id = $1::uuid AND l.deleted_at IS NULL',
		);
		expect(text).not.toContain('l.status');
	});

	it('cùng luật công khai: visible và người viết active chưa xóa mềm; amount là số sao của từng phiếu', () => {
		expect(text).toContain(
			`lr.status = 'visible' AND u.status = 'active' AND u.deleted_at IS NULL`,
		);
		expect(text).toContain('lr.stars::bigint AS amount');
	});

	it('không chạm bảng đánh giá chủ trọ', () => {
		expect(text).not.toContain('FROM reviews');
	});
});

describe('paidOrdersQuery (spec 0017 AC-11)', () => {
	const text = flat(paidOrdersQuery(LANDLORD, START, END).text);

	it('chỉ đơn paid của chủ trọ này, theo paid_at; pending và cancelled không bao giờ vào', () => {
		expect(text).toContain(
			`FROM orders o WHERE o.user_id = $1::uuid AND o.status = 'paid'`,
		);
		expect(text).toContain('o.paid_at AS occurred_at');
		expect(text).not.toContain('created_at');
		expect(text).not.toContain('cancelled');
	});

	it('amount là price đã chốt trên đơn, ép bigint trước khi cộng', () => {
		expect(text).toContain('o.price::bigint AS amount');
		expect(text).not.toContain('plans');
	});
});

describe('chatQuery (spec 0017 AC-10, AC-13)', () => {
	const query = chatQuery(LANDLORD, START, END);
	const text = flat(query.text);

	it('năm tham số: chủ trọ của cuộc, múi giờ, chủ trọ của tin nhắn, hai cận', () => {
		expect(query.values).toEqual([
			LANDLORD,
			'Asia/Ho_Chi_Minh',
			LANDLORD,
			START,
			END,
		]);
		expect(text).toContain('c.landlord_id = $1::uuid');
		expect(text).toContain('AT TIME ZONE $2::text');
		expect(text).toContain('g.sender_id = $3::uuid');
		expect(text).toContain(
			'm.created_at >= $4::timestamptz AND m.created_at < $5::timestamptz',
		);
	});

	it('chỉ các cuộc có landlord_id là chủ trọ, theo created_at của cuộc trò chuyện', () => {
		expect(text).toContain(
			'FROM conversations c WHERE c.landlord_id = $1::uuid',
		);
		expect(text).not.toContain('tenant_id');
		expect(text).not.toContain('tenant_read_seq');
	});

	it('đã trả lời là có tin do CHÍNH chủ trọ gửi trong cuộc đó (sender_id), không phải bất kỳ tin nào', () => {
		expect(text).toContain(
			'g.conversation_id = m.id AND g.sender_id = $3::uuid',
		);
		expect(text).toContain('FROM messages g');
	});

	it('chưa đọc là last_seq trừ mốc đọc của chủ trọ, cùng công thức của countUnread', () => {
		expect(text).toContain('c.last_seq - c.landlord_read_seq AS unread');
		expect(text).toContain(
			'count(*) FILTER (WHERE m.unread > 0)::bigint AS "unreadConversations"',
		);
		expect(text).toContain(
			'COALESCE(SUM(m.unread), 0)::bigint AS "unreadMessages"',
		);
	});

	it('một câu cho cả hai: các dòng theo ngày cộng một dòng tổng NULL không giới hạn ngày; chỉ đọc', () => {
		expect(text).toContain('GROUP BY 1 UNION ALL');
		expect(text).toContain(`SELECT NULL::text AS "day"`);
		expect(text.split('UNION ALL')[1]).not.toContain('created_at >=');
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('StatisticsRepository', () => {
	function build(rows: unknown[]) {
		const queryRaw = jest.fn((query: Prisma.Sql) => {
			void query;
			return Promise.resolve(rows);
		});
		const repository = new StatisticsRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('countListings: đổi bigint sang number và trả đủ bốn số', async () => {
		const { repository, queryRaw } = build([
			{
				visible: 3,
				hiddenByOwner: 1,
				hiddenByAdmin: 2,
				viewCountAllTime: 1450n,
			},
		]);
		await expect(repository.countListings(LANDLORD)).resolves.toEqual({
			visible: 3,
			hiddenByOwner: 1,
			hiddenByAdmin: 2,
			viewCountAllTime: 1450,
		});
		expect(queryRaw).toHaveBeenCalledTimes(1);
		expect(queryRaw.mock.calls[0]?.[0]?.values).toEqual([LANDLORD]);
	});

	it('countListings: không có dòng nào thì mọi số là 0', async () => {
		const { repository } = build([]);
		await expect(repository.countListings(LANDLORD)).resolves.toEqual({
			visible: 0,
			hiddenByOwner: 0,
			hiddenByAdmin: 0,
			viewCountAllTime: 0,
		});
	});

	it('findDailyViews: đổi bigint sang number, giữ nguyên chuỗi ngày, truyền hai ngày vào câu SQL', async () => {
		const { repository, queryRaw } = build([
			{ day: '2026-11-15', count: 3n },
			{ day: '2026-11-16', count: 7n },
		]);
		await expect(
			repository.findDailyViews(LANDLORD, '2026-11-01', '2026-11-16'),
		).resolves.toEqual([
			{ day: '2026-11-15', count: 3 },
			{ day: '2026-11-16', count: 7 },
		]);
		expect(queryRaw.mock.calls[0]?.[0]?.values).toEqual([
			LANDLORD,
			'2026-11-01',
			'2026-11-16',
		]);
	});

	it('findTopListings: đổi lượt trong khoảng sang number, giữ cờ isPublic và lượt từ trước đến nay', async () => {
		const { repository } = build([
			{
				id: 'tin-1',
				code: 'k7m2xq9p',
				title: 'Phòng trọ gần ĐH Bách Khoa',
				status: 'visible',
				isPublic: true,
				viewsInRange: 70n,
				viewsAllTime: 640,
			},
		]);
		await expect(
			repository.findTopListings(
				LANDLORD,
				'2026-10-18',
				'2026-11-16',
				2,
				5,
			),
		).resolves.toEqual([
			{
				id: 'tin-1',
				code: 'k7m2xq9p',
				title: 'Phòng trọ gần ĐH Bách Khoa',
				status: 'visible',
				isPublic: true,
				viewsInRange: 70,
				viewsAllTime: 640,
			},
		]);
	});

	it.each([
		['findFavorites', favoritesQuery],
		['findFollowers', followersQuery],
		['findLandlordReviews', landlordReviewsQuery],
		['findRoomReviews', roomReviewsQuery],
		['findPaidOrders', paidOrdersQuery],
	] as const)(
		'%s: tách dòng tổng (day NULL) khỏi các dòng theo ngày, đổi bigint sang number, truyền đúng tham số',
		async (method, queryOf) => {
			const { repository, queryRaw } = build([
				{ day: '2026-11-14', count: 2n, amount: 8n },
				{ day: '2026-11-15', count: 1n, amount: 5n },
				{ day: null, count: 31n, amount: 130n },
			]);
			await expect(
				repository[method](LANDLORD, START, END),
			).resolves.toEqual({
				counts: [
					{ day: '2026-11-14', count: 2 },
					{ day: '2026-11-15', count: 1 },
				],
				amounts: [
					{ day: '2026-11-14', count: 8 },
					{ day: '2026-11-15', count: 5 },
				],
				total: 31,
				amountTotal: 130,
			});
			expect(queryRaw).toHaveBeenCalledTimes(1);
			expect(queryRaw.mock.calls[0]?.[0]?.values).toEqual(
				queryOf(LANDLORD, START, END).values,
			);
		},
	);

	it.each([
		'findFavorites',
		'findFollowers',
		'findLandlordReviews',
		'findRoomReviews',
		'findPaidOrders',
	] as const)(
		'%s: không có dòng nào (chủ trọ mới) thì không có ngày nào và hai tổng là 0',
		async (method) => {
			const { repository } = build([]);
			await expect(
				repository[method](LANDLORD, START, END),
			).resolves.toEqual({
				counts: [],
				amounts: [],
				total: 0,
				amountTotal: 0,
			});
		},
	);

	it('findPaidOrders: tổng tiền vượt 2,1 tỷ đồng vẫn đúng, không ép về int4 (spec 0017 AC-11)', async () => {
		const { repository } = build([
			{ day: '2026-11-10', count: 30n, amount: 3_000_000_000n },
			{ day: null, count: 30n, amount: 3_000_000_000n },
		]);
		const result = await repository.findPaidOrders(LANDLORD, START, END);
		expect(result.amounts).toEqual([
			{ day: '2026-11-10', count: 3_000_000_000 },
		]);
		expect(result.amountTotal).toBe(3_000_000_000);
		expect(result.amountTotal > 2 ** 31 - 1).toBe(true);
	});

	it('findChat: số cuộc mở và số cuộc đã trả lời theo ngày, dòng tổng cho tổng và hai số chưa đọc (spec 0017 AC-10)', async () => {
		const { repository, queryRaw } = build([
			{
				day: '2026-11-14',
				opened: 3n,
				replied: 2n,
				unreadConversations: 0n,
				unreadMessages: 0n,
			},
			{
				day: '2026-11-16',
				opened: 1n,
				replied: 0n,
				unreadConversations: 0n,
				unreadMessages: 0n,
			},
			{
				day: null,
				opened: 41n,
				replied: 0n,
				unreadConversations: 2n,
				unreadMessages: 5n,
			},
		]);
		await expect(
			repository.findChat(LANDLORD, START, END),
		).resolves.toEqual({
			opened: [
				{ day: '2026-11-14', count: 3 },
				{ day: '2026-11-16', count: 1 },
			],
			replied: [
				{ day: '2026-11-14', count: 2 },
				{ day: '2026-11-16', count: 0 },
			],
			total: 41,
			unreadConversations: 2,
			unreadMessages: 5,
		});
		expect(queryRaw.mock.calls[0]?.[0]?.values).toEqual(
			chatQuery(LANDLORD, START, END).values,
		);
	});

	it('findChat: chủ trọ chưa có cuộc trò chuyện nào thì mọi số là 0', async () => {
		const { repository } = build([]);
		await expect(
			repository.findChat(LANDLORD, START, END),
		).resolves.toEqual({
			opened: [],
			replied: [],
			total: 0,
			unreadConversations: 0,
			unreadMessages: 0,
		});
	});

	it('không có phương thức ghi nào', () => {
		const methods = Object.getOwnPropertyNames(
			StatisticsRepository.prototype,
		).filter((name) => name !== 'constructor');
		expect(methods.sort()).toEqual(
			[
				'countListings',
				'findDailyViews',
				'findTopListings',
				'findFavorites',
				'findFollowers',
				'findLandlordReviews',
				'findRoomReviews',
				'findPaidOrders',
				'findChat',
			].sort(),
		);
		// Mọi phương thức đều là find hoặc count: đọc, không bao giờ ghi.
		expect(methods.every((name) => /^(find|count)/.test(name))).toBe(true);
	});
});
