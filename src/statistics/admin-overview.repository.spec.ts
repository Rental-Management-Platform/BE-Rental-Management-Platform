import type { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
	publicListingCondition,
	publicListingFrom,
} from '../listings/listings.repository';
import {
	accountCountsQuery,
	AdminOverviewRepository,
	createdByWardQuery,
	createdListingsQuery,
	engagementQuery,
	landlordGroupsQuery,
	hiddenReviewCountsQuery,
	listingStatusCountsQuery,
	platformDailyViewsQuery,
	publicListingCountQuery,
	registrationsQuery,
	type EngagementSource,
} from './admin-overview.repository';

/** Nửa đêm giờ Việt Nam của 18/09/2026 và của 17/11/2026 (chuỗi ISO có Z, như `toRangeBounds`). */
const START = '2026-09-17T17:00:00.000Z';
const END = '2026-11-16T17:00:00.000Z';
const NOW = new Date('2026-11-16T05:00:00.000Z');
const NOW_ISO = '2026-11-16T05:00:00.000Z';
const flat = (text: string): string => text.replace(/\s+/g, ' ');
/** Bỏ số thứ tự tham số để so một mảnh SQL đứng một mình với mảnh đó khi đã lồng vào câu khác. */
const bare = (text: string): string => flat(text).replace(/\$\d+/g, '$');

/** Mọi câu đều chỉ đọc: không câu nào ghi, khóa dòng hay đổi `updated_at` (spec 0018 AC-1). */
const WRITE_WORDS =
	/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|FOR UPDATE|FOR SHARE|updated_at)\b/i;

describe('dailyCounts: khung theo ngày dùng chung (spec 0018 AC-12, AC-13)', () => {
	// `dailyCounts` dựng bằng `Prisma.sql` nên chỉ Repository được gọi; test đi qua hai câu dùng nó.
	const query = registrationsQuery('tenant', START, END);
	const text = flat(query.text);

	it('tham số theo thứ tự: tham số của nguồn, múi giờ, hai cận; cận là chuỗi ISO có Z, múi giờ là tham số ràng buộc', () => {
		expect(query.values).toEqual([
			'tenant',
			'Asia/Ho_Chi_Minh',
			START,
			END,
		]);
		expect(text).toContain("AT TIME ZONE $2::text, 'YYYY-MM-DD'");
		expect(text).toContain('s.occurred_at >= $3::timestamptz');
		expect(text).toContain('s.occurred_at < $4::timestamptz');
	});

	it('cận trên so chặt `<`, cận dưới `>=`: dòng đúng nửa đêm ngày kế tiếp thuộc ngày kế tiếp, không thuộc khoảng', () => {
		expect(text).not.toContain('<=');
	});

	it('không hardcode múi giờ trong SQL: không có chữ Asia hay UTC ngoài tham số', () => {
		expect(text).not.toContain('Asia/Ho_Chi_Minh');
		expect(text).not.toContain("'UTC'");
	});

	it('mỗi ngày một dòng, sắp ngày tăng dần, chỉ có hai cột day và count', () => {
		expect(text).toContain('GROUP BY 1 ORDER BY 1');
		expect(text).toContain('count(*)::bigint AS "count"');
		expect(text).toContain('AS "day"');
	});

	it('KHÔNG kèm dòng tổng toàn thời gian: không UNION ALL, không đọc nguồn lần thứ hai (khác dailyWithTotal của spec 0017)', () => {
		expect(text).not.toContain('UNION');
		expect(text.match(/FROM src s/g)).toHaveLength(1);
	});

	it('nguồn nằm trong một CTE và được đưa vào nguyên văn', () => {
		expect(text).toContain(
			'WITH src AS ( SELECT u.created_at AS occurred_at FROM users u WHERE u.account_type = $1)',
		);
	});

	it('dùng chung một khung cho tin mới: cùng phần sau CTE, chỉ khác nguồn', () => {
		const listings = flat(createdListingsQuery(START, END).text);
		const tail = (sql: string): string =>
			sql.slice(sql.indexOf('SELECT to_char'));
		expect(tail(listings).replace(/\$\d+/g, '$')).toBe(
			tail(text).replace(/\$\d+/g, '$'),
		);
	});
});

describe('accountCountsQuery (spec 0018 AC-4)', () => {
	const query = accountCountsQuery();
	const text = flat(query.text);

	it('chỉ đếm tài khoản chưa xóa mềm, nhóm theo loại và trạng thái, không tham số nào', () => {
		expect(query.values).toEqual([]);
		expect(text).toContain('FROM users u WHERE u.deleted_at IS NULL');
		expect(text).toContain('GROUP BY u.account_type, u.status');
	});

	it('không lọc theo người nào: đây là số của cả nền tảng', () => {
		expect(text).not.toContain('id =');
		expect(text).not.toContain('landlord_id');
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('registrationsQuery (spec 0018 AC-5, AC-13)', () => {
	const query = registrationsQuery('landlord', START, END);
	const text = flat(query.text);

	it('loại tài khoản là tham số ràng buộc đầu tiên, rồi múi giờ và hai cận ISO có Z', () => {
		expect(query.values).toEqual([
			'landlord',
			'Asia/Ho_Chi_Minh',
			START,
			END,
		]);
		expect(text).toContain('WHERE u.account_type = $1');
	});

	it('đếm MỌI dòng của loại đó, kể cả tài khoản bị khóa hay xóa mềm: không lọc deleted_at hay status', () => {
		expect(text).not.toContain('deleted_at');
		expect(text).not.toContain('status');
	});

	it('tính theo created_at, qua múi giờ giờ Việt Nam của tham số', () => {
		expect(text).toContain('u.created_at AS occurred_at');
		expect(text).toContain('AT TIME ZONE $2::text');
	});

	it('tenant dùng đúng câu đó với tham số khác; admin không có đường vào (kiểu chỉ nhận landlord hay tenant)', () => {
		const tenant = registrationsQuery('tenant', START, END);
		expect(flat(tenant.text)).toBe(text);
		expect(tenant.values[0]).toBe('tenant');
		expect(text).not.toContain("'admin'");
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('landlordGroupsQuery (spec 0018 AC-6, AC-13)', () => {
	const query = landlordGroupsQuery(NOW);
	const text = flat(query.text);

	it('now vào hai chỗ dưới dạng chuỗi ISO có Z, không bao giờ Date', () => {
		expect(query.values).toEqual([NOW_ISO, NOW_ISO]);
		expect(text).toContain('@> $1::timestamptz');
		expect(text).toContain('u.trial_ends_at > $2::timestamptz');
	});

	it('mọi chủ trọ chưa xóa mềm, kể cả đang bị khóa: không lọc status', () => {
		expect(text).toContain(
			"WHERE u.account_type = 'landlord' AND u.deleted_at IS NULL",
		);
		expect(text).not.toContain('u.status');
	});

	it('kỳ gói chứa now với starts_at tính và ends_at không tính (tstzrange nửa mở), cùng biểu thức với luật công khai', () => {
		const planRange = 'tstzrange(s.starts_at, s.ends_at) @> $::timestamptz';
		expect(bare(text)).toContain(planRange);
		expect(bare(publicListingFrom(NOW).text)).toContain(planRange);
		expect(text).not.toContain("'[]'");
		expect(text).not.toContain("'(]'");
	});

	it('dùng thử so chặt `>`, không `>=`: đúng lúc trial_ends_at là đã hết; NULL rơi vào nhóm hết kỳ', () => {
		expect(text).toContain(
			'COALESCE(u.trial_ends_at > $2::timestamptz, false)',
		);
		expect(text).not.toContain('>=');
	});

	it('gói thắng dùng thử: onTrial và trialExpired đều đòi NOT on_plan', () => {
		expect(text).toContain(
			'count(*) FILTER (WHERE x.on_plan)::int AS "onPlan"',
		);
		expect(text).toContain(
			'count(*) FILTER (WHERE NOT x.on_plan AND x.on_trial)::int AS "onTrial"',
		);
		expect(text).toContain(
			'count(*) FILTER (WHERE NOT x.on_plan AND NOT x.on_trial)::int AS "trialExpired"',
		);
		expect(text).toContain('count(*)::int AS "total"');
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('listingStatusCountsQuery (spec 0018 AC-7)', () => {
	const query = listingStatusCountsQuery();
	const text = flat(query.text);

	it('chỉ tin chưa xóa mềm, mỗi số một trạng thái, một dòng duy nhất (không GROUP BY)', () => {
		expect(query.values).toEqual([]);
		expect(text).toContain('FROM listings l WHERE l.deleted_at IS NULL');
		expect(text).toContain(
			`count(*) FILTER (WHERE l.status = 'visible')::int AS "visible"`,
		);
		expect(text).toContain(
			`count(*) FILTER (WHERE l.status = 'hidden_by_owner')::int AS "hiddenByOwner"`,
		);
		expect(text).toContain(
			`count(*) FILTER (WHERE l.status = 'hidden_by_admin')::int AS "hiddenByAdmin"`,
		);
		expect(text).not.toContain('GROUP BY');
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('publicListingCountQuery (spec 0018 AC-8)', () => {
	const query = publicListingCountQuery(NOW, 2);
	const text = bare(query.text);

	it('dùng đúng hai mảnh publicListingFrom và publicListingCondition của src/listings/, không viết lại luật', () => {
		expect(text).toContain(bare(publicListingFrom(NOW).text));
		expect(text).toContain(bare(publicListingCondition(NOW, 2).text));
		expect(text).toContain(
			'SELECT count(*)::int AS "total" FROM listings l',
		);
	});

	it('now (hai lần, một cho kỳ gói một cho dùng thử) vào dạng chuỗi ISO có Z, hạn mức dùng thử là tham số cuối', () => {
		expect(query.values).toEqual([NOW_ISO, NOW_ISO, 2]);
	});

	it('không thêm điều kiện nào ngoài luật công khai (không lọc theo chủ trọ, không lọc ngày): câu là đúng ba mảnh nối nhau', () => {
		expect(text.trim()).toBe(
			`SELECT count(*)::int AS "total" ${bare(publicListingFrom(NOW).text)} WHERE ${bare(
				publicListingCondition(NOW, 2).text,
			)}`,
		);
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('createdListingsQuery (spec 0018 AC-9, AC-13)', () => {
	const query = createdListingsQuery(START, END);
	const text = flat(query.text);

	it('đếm MỌI tin theo created_at, kể cả tin xóa mềm và tin ẩn: không lọc deleted_at hay status', () => {
		expect(text).toContain('l.created_at AS occurred_at FROM listings l');
		expect(text).not.toContain('deleted_at');
		expect(text).not.toContain('status');
		expect(query.values).toEqual(['Asia/Ho_Chi_Minh', START, END]);
	});
});

describe('createdByWardQuery (spec 0018 AC-9)', () => {
	const query = createdByWardQuery(START, END);
	const text = flat(query.text);

	it('hai cận là ISO có Z; phường lấy qua nhà trọ của tin, tên là wards.name hiện tại', () => {
		expect(query.values).toEqual([START, END]);
		expect(text).toContain('JOIN properties p ON p.id = l.property_id');
		expect(text).toContain('JOIN wards w ON w.code = p.ward_code');
		expect(text).toContain('w.name AS "wardName"');
		expect(text).toContain(
			'l.created_at >= $1::timestamptz AND l.created_at < $2::timestamptz',
		);
	});

	it('mọi tin kể cả xóa mềm, nên tổng count bằng số tin mới của kỳ: không lọc deleted_at hay status', () => {
		expect(text).not.toContain('deleted_at');
		expect(text).not.toContain('status');
	});

	it('count giảm dần rồi ward_code tăng dần (khóa phụ), không cắt top', () => {
		expect(text).toContain('ORDER BY count(*) DESC, p.ward_code ASC');
		expect(text).not.toContain('LIMIT');
	});

	it('chỉ có mã phường, tên phường và số đếm: không cột nào của tin hay người', () => {
		expect(text).toContain('p.ward_code AS "wardCode"');
		expect(text).not.toContain('l.title');
		expect(text).not.toContain('l.code');
		expect(text).not.toContain('l.id');
		expect(text).not.toContain('email');
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('platformDailyViewsQuery (spec 0018 AC-10, AC-13)', () => {
	const query = platformDailyViewsQuery('2026-09-18', '2026-11-16');
	const text = flat(query.text);

	it('hai tham số: ngày đầu và ngày cuối là chuỗi YYYY-MM-DD ép date', () => {
		expect(query.values).toEqual(['2026-09-18', '2026-11-16']);
		expect(text).toContain('v.day >= $1::date');
		expect(text).toContain('v.day <= $2::date');
	});

	it('so thẳng cột day với ngày, không đổi múi giờ (day đã là ngày giờ Việt Nam)', () => {
		expect(text).not.toContain('AT TIME ZONE');
		expect(text).not.toContain('timestamptz');
	});

	it('cộng mọi tin của nền tảng kể cả tin ẩn và xóa mềm: không nối listings, không lọc status hay deleted_at', () => {
		expect(text).toContain('FROM listing_daily_views v WHERE');
		expect(text).not.toContain('JOIN');
		expect(text).not.toContain('status');
		expect(text).not.toContain('deleted_at');
		expect(text).toContain('SUM(v.views)::bigint AS "count"');
	});

	it('mỗi ngày một dòng, sắp ngày tăng dần, ngày dạng chữ qua to_char (không phụ thuộc cấu hình ngày của phiên)', () => {
		expect(text).toContain('to_char(v.day, \'YYYY-MM-DD\') AS "day"');
		expect(text).toContain('GROUP BY v.day ORDER BY v.day');
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('engagementQuery: sáu nguồn tương tác (spec 0018 AC-10, AC-12, AC-13)', () => {
	const SOURCES: [EngagementSource, string][] = [
		[
			'conversations',
			'SELECT c.created_at AS occurred_at FROM conversations c',
		],
		['messages', 'SELECT m.created_at AS occurred_at FROM messages m'],
		[
			'landlordReviews',
			'SELECT r.created_at AS occurred_at FROM reviews r',
		],
		[
			'roomReviews',
			'SELECT lr.created_at AS occurred_at FROM listing_reviews lr',
		],
		['follows', 'SELECT f.created_at AS occurred_at FROM follows f'],
		['favorites', 'SELECT fv.created_at AS occurred_at FROM favorites fv'],
	];
	const tail = (sql: string): string =>
		sql.slice(sql.indexOf('SELECT to_char')).replace(/\$\d+/g, '$');

	it.each(SOURCES)(
		'%s: nguồn là MỌI dòng của đúng một bảng theo created_at, đưa nguyên văn vào CTE',
		(source, fragment) => {
			const text = flat(engagementQuery(source, START, END).text);
			expect(text).toContain(`WITH src AS (${fragment})`);
		},
	);

	it.each(SOURCES)(
		'%s: không lọc gì và không nối bảng nào: không status, deleted_at, JOIN, WHERE trong nguồn (đếm mọi dòng đang tồn tại)',
		(source) => {
			const text = flat(engagementQuery(source, START, END).text);
			const inner = text.slice(0, text.indexOf('SELECT to_char'));
			expect(inner).not.toMatch(
				/status|deleted_at|JOIN|WHERE|users|listings/,
			);
		},
	);

	it.each(SOURCES)(
		'%s: tham số là múi giờ rồi hai cận ISO có Z, không tham số nào của người hay tin',
		(source) => {
			const query = engagementQuery(source, START, END);
			expect(query.values).toEqual(['Asia/Ho_Chi_Minh', START, END]);
		},
	);

	it.each(SOURCES)(
		'%s: dùng đúng khung dailyCounts của đăng ký và tin mới, chỉ khác nguồn; cận trên so chặt',
		(source) => {
			const text = flat(engagementQuery(source, START, END).text);
			expect(tail(text)).toBe(
				tail(flat(createdListingsQuery(START, END).text)),
			);
			expect(text).not.toContain('<=');
			expect(text).not.toContain('UNION');
		},
	);

	it('sáu nguồn là sáu câu khác nhau (không hai khóa nào dùng chung một nguồn)', () => {
		const texts = SOURCES.map(([source]) =>
			flat(engagementQuery(source, START, END).text),
		);
		expect(new Set(texts).size).toBe(6);
	});

	it('chỉ đọc', () => {
		for (const [source] of SOURCES)
			expect(engagementQuery(source, START, END).text).not.toMatch(
				WRITE_WORDS,
			);
	});
});

describe('hiddenReviewCountsQuery (spec 0018 AC-11)', () => {
	const query = hiddenReviewCountsQuery();
	const text = flat(query.text);

	it('không tham số; hai số, mỗi số đếm đúng status hidden_by_admin của đúng một bảng đánh giá', () => {
		expect(query.values).toEqual([]);
		expect(text).toContain(
			`(SELECT count(*)::int FROM reviews r WHERE r.status = 'hidden_by_admin') AS "hiddenLandlordReviews"`,
		);
		expect(text).toContain(
			`(SELECT count(*)::int FROM listing_reviews lr WHERE lr.status = 'hidden_by_admin') AS "hiddenRoomReviews"`,
		);
	});

	it('khớp danh sách kiểm duyệt: chỉ lọc status, không xóa mềm, không nối người viết hay tin, không luật công khai', () => {
		expect(text).not.toContain('deleted_at');
		expect(text).not.toContain('JOIN');
		expect(text).not.toContain('users');
		expect(text).not.toContain("'visible'");
		expect(text.match(/hidden_by_admin/g)).toHaveLength(2);
	});

	it('không đếm tin bị ẩn ở đây (số đó lấy từ hiddenByAdmin của đếm theo trạng thái để luôn bằng listings.hiddenByAdmin)', () => {
		expect(text).not.toContain('FROM listings');
	});

	it('chỉ đọc', () => {
		expect(text).not.toMatch(WRITE_WORDS);
	});
});

describe('AdminOverviewRepository', () => {
	function build(rows: unknown[]) {
		const queryRaw = jest.fn((query: Prisma.Sql) => {
			void query;
			return Promise.resolve(rows);
		});
		const repository = new AdminOverviewRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('countAccounts: trả nguyên các ô loại, trạng thái, số', async () => {
		const rows = [
			{ accountType: 'tenant', status: 'active', count: 5 },
			{ accountType: 'tenant', status: 'locked', count: 1 },
		];
		const { repository, queryRaw } = build(rows);
		await expect(repository.countAccounts()).resolves.toEqual(rows);
		expect(queryRaw).toHaveBeenCalledTimes(1);
	});

	it('findRegistrations: đổi bigint sang number, truyền loại tài khoản và hai cận vào câu SQL', async () => {
		const { repository, queryRaw } = build([
			{ day: '2026-11-15', count: 3n },
			{ day: '2026-11-16', count: 7n },
		]);
		await expect(
			repository.findRegistrations('tenant', START, END),
		).resolves.toEqual([
			{ day: '2026-11-15', count: 3 },
			{ day: '2026-11-16', count: 7 },
		]);
		expect(queryRaw.mock.calls[0]?.[0]?.values).toEqual([
			'tenant',
			'Asia/Ho_Chi_Minh',
			START,
			END,
		]);
	});

	it('countLandlordGroups: trả bốn số; không có dòng nào thì mọi số là 0', async () => {
		const group = { total: 4, onPlan: 1, onTrial: 2, trialExpired: 1 };
		await expect(
			build([group]).repository.countLandlordGroups(NOW),
		).resolves.toEqual(group);
		await expect(
			build([]).repository.countLandlordGroups(NOW),
		).resolves.toEqual({
			total: 0,
			onPlan: 0,
			onTrial: 0,
			trialExpired: 0,
		});
	});

	it('countListingsByStatus: trả ba số; không có dòng nào thì mọi số là 0', async () => {
		const counts = { visible: 3, hiddenByOwner: 1, hiddenByAdmin: 2 };
		await expect(
			build([counts]).repository.countListingsByStatus(),
		).resolves.toEqual(counts);
		await expect(
			build([]).repository.countListingsByStatus(),
		).resolves.toEqual({
			visible: 0,
			hiddenByOwner: 0,
			hiddenByAdmin: 0,
		});
	});

	it('countPublicListings: trả total; không có dòng nào thì 0; truyền now ISO và hạn mức', async () => {
		const { repository, queryRaw } = build([{ total: 9 }]);
		await expect(repository.countPublicListings(NOW, 3)).resolves.toBe(9);
		expect(queryRaw.mock.calls[0]?.[0]?.values).toEqual([
			NOW_ISO,
			NOW_ISO,
			3,
		]);
		await expect(
			build([]).repository.countPublicListings(NOW, 3),
		).resolves.toBe(0);
	});

	it('findCreatedListings: đổi bigint sang number', async () => {
		const { repository } = build([{ day: '2026-11-16', count: 4n }]);
		await expect(
			repository.findCreatedListings(START, END),
		).resolves.toEqual([{ day: '2026-11-16', count: 4 }]);
	});

	it('findCreatedByWard: trả nguyên các dòng theo thứ tự truy vấn, truyền hai cận của riêng kỳ này', async () => {
		const rows = [
			{ wardCode: '26734', wardName: 'Phường Bến Thành', count: 12 },
			{ wardCode: '26737', wardName: 'Phường Võ Thị Sáu', count: 9 },
		];
		const { repository, queryRaw } = build(rows);
		await expect(repository.findCreatedByWard(START, END)).resolves.toEqual(
			rows,
		);
		expect(queryRaw.mock.calls[0]?.[0]?.values).toEqual([START, END]);
	});

	it('findDailyViews: đổi bigint sang number, giữ nguyên chuỗi ngày, truyền hai ngày vào câu SQL', async () => {
		const { repository, queryRaw } = build([
			{ day: '2026-11-15', count: 3n },
			{ day: '2026-11-16', count: 7n },
		]);
		await expect(
			repository.findDailyViews('2026-11-01', '2026-11-16'),
		).resolves.toEqual([
			{ day: '2026-11-15', count: 3 },
			{ day: '2026-11-16', count: 7 },
		]);
		expect(queryRaw.mock.calls[0]?.[0]?.values).toEqual([
			'2026-11-01',
			'2026-11-16',
		]);
	});

	it('findEngagement: đổi bigint sang number, truyền múi giờ và hai cận vào câu của đúng nguồn', async () => {
		const { repository, queryRaw } = build([
			{ day: '2026-11-15', count: 2n },
			{ day: '2026-11-16', count: 9n },
		]);
		await expect(
			repository.findEngagement('messages', START, END),
		).resolves.toEqual([
			{ day: '2026-11-15', count: 2 },
			{ day: '2026-11-16', count: 9 },
		]);
		const sent = queryRaw.mock.calls[0]?.[0];
		expect(sent?.values).toEqual(['Asia/Ho_Chi_Minh', START, END]);
		expect(flat(sent?.text ?? '')).toContain('FROM messages m');
	});

	it('countHiddenReviews: trả hai số; không có dòng nào (chỉ xảy ra với mock) thì cả hai là 0', async () => {
		const counts = { hiddenLandlordReviews: 3, hiddenRoomReviews: 7 };
		await expect(
			build([counts]).repository.countHiddenReviews(),
		).resolves.toEqual(counts);
		await expect(
			build([]).repository.countHiddenReviews(),
		).resolves.toEqual({ hiddenLandlordReviews: 0, hiddenRoomReviews: 0 });
	});

	it('không có phương thức ghi nào: chỉ countAccounts, find* và count*', () => {
		const names = Object.getOwnPropertyNames(
			AdminOverviewRepository.prototype,
		).filter((name) => name !== 'constructor');
		for (const name of names) expect(name).toMatch(/^(count|find)[A-Z]/);
	});
});
