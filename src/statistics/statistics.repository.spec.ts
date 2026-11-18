import type { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import {
	dailyViewsQuery,
	listingCountsQuery,
	StatisticsRepository,
	topListingsQuery,
} from './statistics.repository';

const LANDLORD = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
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

	it('không có phương thức ghi nào', () => {
		const methods = Object.getOwnPropertyNames(
			StatisticsRepository.prototype,
		).filter((name) => name !== 'constructor');
		expect(methods.sort()).toEqual(
			['countListings', 'findDailyViews', 'findTopListings'].sort(),
		);
	});
});
