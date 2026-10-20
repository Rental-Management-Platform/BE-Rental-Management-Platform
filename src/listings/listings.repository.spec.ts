import type { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { publicSummaryRow } from './listings.fixtures';
import {
	ListingsRepository,
	publicListingCondition,
	publicListingFrom,
} from './listings.repository';

const NOW = new Date('2026-10-19T03:00:00.000Z');

/** Chữ SQL với tham số đánh số `$1`, `$2` (kiểu PostgreSQL), gom khoảng trắng để so không phụ thuộc xuống dòng. */
function flat(sql: Prisma.Sql): string {
	return sql.text.replace(/\s+/g, ' ');
}

describe('publicListingCondition (spec 0003 AC-8, AC-9; spec 0004 AC-9)', () => {
	it('giá trị `now` và hạn mức dùng thử đi vào bằng tham số, không nối chuỗi', () => {
		const condition = publicListingCondition(NOW, 2);
		expect(condition.values).toEqual([NOW.toISOString(), 2]);
		expect(flat(condition)).not.toContain('2026');
	});

	it('`now` là chuỗi ISO có Z (không phải Date) để phép ép timestamptz không phụ thuộc múi giờ của phiên', () => {
		const [now] = publicListingCondition(
			new Date('2030-01-01T00:00:00.123Z'),
			2,
		).values;
		expect(now).toBe('2030-01-01T00:00:00.123Z');
	});

	it('hạn mức dùng thử chỉ tính khi `trial_ends_at` lớn hơn `now` chặt (đúng lúc bằng là hết), ngược lại 0', () => {
		expect(flat(publicListingCondition(NOW, 2))).toContain(
			'CASE WHEN u.trial_ends_at > $1::timestamptz THEN $2::int ELSE 0 END',
		);
	});

	it('hạn mức hiệu lực là max_listings của kỳ gói đang chạy nếu có, không thì hạn mức dùng thử còn hiệu lực', () => {
		const sql = flat(publicListingCondition(NOW, 2));
		expect(sql).toContain(
			'COALESCE( plan.max_listings, CASE WHEN u.trial_ends_at > $1::timestamptz THEN $2::int ELSE 0 END )',
		);
	});

	it('không còn vế `trial_ends_at` đứng riêng: hết dùng thử mà có gói vẫn qua được', () => {
		const sql = flat(publicListingCondition(NOW, 2));
		expect(sql).not.toMatch(/AND u\.trial_ends_at >/);
	});

	it('hạng của tin: đếm tin visible chưa xóa của cùng chủ trọ có (created_at, id) nhỏ hơn, phải nhỏ hơn hạn mức hiệu lực', () => {
		const sql = flat(publicListingCondition(NOW, 2));
		expect(sql).toContain('WHERE p2.landlord_id = u.id');
		expect(sql).toContain(
			"l2.status = 'visible' AND l2.deleted_at IS NULL",
		);
		expect(sql).toContain('(l2.created_at, l2.id) < (l.created_at, l.id)');
		expect(sql).toContain(') < COALESCE(');
	});

	it('giữ các vế hiển thị của spec 0002: tin visible, nhà trọ và chủ trọ chưa xóa, chủ trọ active', () => {
		const sql = flat(publicListingCondition(NOW, 2));
		expect(sql).toContain("l.status = 'visible' AND l.deleted_at IS NULL");
		expect(sql).toContain('p.deleted_at IS NULL');
		expect(sql).toContain("u.status = 'active' AND u.deleted_at IS NULL");
	});

	it('bọc trong ngoặc để ghép bằng AND với bộ lọc dù sau này có OR', () => {
		const sql = flat(publicListingCondition(NOW, 2)).trim();
		expect(sql.startsWith('(')).toBe(true);
		expect(sql.endsWith(')')).toBe(true);
	});
});

describe('publicListingFrom (spec 0004 AC-9)', () => {
	it('nối tin, nhà trọ, chủ trọ rồi kỳ gói đang chạy của chủ trọ (LEFT JOIN LATERAL, không kỳ thì NULL)', () => {
		const sql = flat(publicListingFrom(NOW));
		expect(sql).toContain('FROM listings l');
		expect(sql).toContain('JOIN properties p ON p.id = l.property_id');
		expect(sql).toContain('JOIN users u ON u.id = p.landlord_id');
		expect(sql).toContain('LEFT JOIN LATERAL (');
		expect(sql).toContain(
			'SELECT o.max_listings FROM subscriptions s JOIN orders o ON o.id = s.order_id',
		);
		expect(sql).toContain(') plan ON true');
	});

	it('kỳ đang chạy là khoảng nửa mở chứa `now` (starts_at tính, ends_at không tính), của đúng chủ trọ đó', () => {
		const sql = flat(publicListingFrom(NOW));
		expect(sql).toContain(
			'WHERE s.user_id = u.id AND tstzrange(s.starts_at, s.ends_at) @> $1::timestamptz',
		);
	});

	it('`now` đi vào bằng tham số là chuỗi ISO có Z (cùng lý do múi giờ với điều kiện)', () => {
		const from = publicListingFrom(new Date('2030-01-01T00:00:00.123Z'));
		expect(from.values).toEqual(['2030-01-01T00:00:00.123Z']);
		expect(flat(from)).not.toContain('2030');
	});

	it('ghép với điều kiện: alias `plan` do phép nối cấp là thứ điều kiện đọc `plan.max_listings`', () => {
		expect(flat(publicListingFrom(NOW))).toContain(') plan ON true');
		expect(flat(publicListingCondition(NOW, 2))).toContain(
			'plan.max_listings',
		);
	});
});

describe('ListingsRepository.isPubliclyVisible (spec 0002 AC-8, spec 0004 AC-9)', () => {
	function build(rows: { id: string }[]) {
		const queryRaw = jest.fn(() => Promise.resolve(rows));
		const repository = new ListingsRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('dùng đúng hai mảnh SQL công khai (phép nối kỳ gói và điều kiện hiển thị) cùng `now`, giới hạn đúng một tin', async () => {
		const { repository, queryRaw } = build([{ id: 'tin-1' }]);
		await repository.isPubliclyVisible(
			'0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03',
			{
				now: NOW,
				trialListingLimit: 2,
			},
		);
		// `$queryRaw` là thẻ mẫu: đối số đầu là các đoạn chữ tĩnh, các đối số sau là giá trị (mảnh `Prisma.Sql`, id).
		const call = (queryRaw.mock.calls as unknown as unknown[][])[0] ?? [];
		const strings = call[0] as readonly string[];
		const text = strings.join('?').replace(/\s+/g, ' ');
		expect(text).toContain('SELECT l.id');
		expect(text).toContain('WHERE l.id =');
		expect(text).toContain('::uuid');
		expect(text).toContain('LIMIT 1');
		const joined = call
			.slice(1)
			.filter((part): part is Prisma.Sql => typeof part === 'object')
			.map((part) => flat(part))
			.join(' ');
		expect(joined).toContain('LEFT JOIN LATERAL');
		expect(joined).toContain('plan.max_listings');
		expect(joined).toContain("l.status = 'visible'");
	});

	it('có dòng trả về thì true, không có thì false', async () => {
		const visibility = { now: NOW, trialListingLimit: 2 };
		await expect(
			build([{ id: 'a' }]).repository.isPubliclyVisible('x', visibility),
		).resolves.toBe(true);
		await expect(
			build([]).repository.isPubliclyVisible('x', visibility),
		).resolves.toBe(false);
	});
});

/** Đối số của một lần gọi thẻ mẫu `$queryRaw`: đoạn chữ tĩnh nối bằng `?`, rồi các giá trị chèn vào theo thứ tự. */
function rawCall(queryRaw: jest.Mock): { text: string; values: unknown[] } {
	const call = (queryRaw.mock.calls as unknown as unknown[][])[0] ?? [];
	const strings = call[0] as readonly string[];
	return {
		text: strings.join('?').replace(/\s+/g, ' '),
		values: call.slice(1),
	};
}

describe('ListingsRepository.findFavoritePage (spec 0006 AC-4, AC-5)', () => {
	const visibility = { now: NOW, trialListingLimit: 2 };
	const SAVED_AT_A = new Date('2026-10-20T03:00:00.000Z');
	const SAVED_AT_B = new Date('2026-10-20T04:00:00.000Z');

	function build(options: {
		pageRows?: { id: string; favorited_at: Date }[];
		total?: number;
		found?: ReturnType<typeof publicSummaryRow>[];
	}) {
		// Hai câu SQL chạy song song theo thứ tự gọi: trang trước, đếm sau.
		const queryRaw = jest
			.fn()
			.mockResolvedValueOnce(options.pageRows ?? [])
			.mockResolvedValueOnce([{ total: options.total ?? 0 }]);
		const findMany = jest.fn(() => Promise.resolve(options.found ?? []));
		const repository = new ListingsRepository({
			$queryRaw: queryRaw,
			listing: { findMany },
		} as unknown as PrismaService);
		return { repository, queryRaw, findMany };
	}

	function rawCallAt(queryRaw: jest.Mock, index: number) {
		const call =
			(queryRaw.mock.calls as unknown as unknown[][])[index] ?? [];
		return {
			text: (call[0] as readonly string[]).join('?').replace(/\s+/g, ' '),
			values: call.slice(1),
		};
	}

	it('câu lấy trang dùng đúng hai mảnh SQL công khai cùng `now`, nối favorites của người gọi, xếp mới lưu trước', async () => {
		const { repository, queryRaw } = build({});
		await repository.findFavoritePage('nguoi-1', visibility, 20, 10);
		const { text, values } = rawCallAt(queryRaw, 0);
		expect(text).toContain('SELECT l.id, f.created_at AS favorited_at');
		expect(text).toContain('ORDER BY f.created_at DESC, f.listing_id DESC');
		expect(text).toContain('LIMIT ? OFFSET ?');
		// Thứ tự giá trị chèn: mảnh FROM (đã nối favorites), điều kiện hiển thị, số dòng, số dòng bỏ qua.
		const [from, condition, take, skip] = values as [
			Prisma.Sql,
			Prisma.Sql,
			number,
			number,
		];
		const fromText = flat(from);
		expect(fromText).toContain('LEFT JOIN LATERAL');
		expect(fromText).toContain(
			'JOIN favorites f ON f.listing_id = l.id AND f.user_id = $2::uuid',
		);
		expect(from.values).toEqual([NOW.toISOString(), 'nguoi-1']);
		expect(flat(condition)).toContain("l.status = 'visible'");
		expect(condition.values).toEqual([NOW.toISOString(), 2]);
		expect(take).toBe(10);
		expect(skip).toBe(20);
	});

	it('câu đếm dùng cùng mảnh FROM và điều kiện nhưng không xếp thứ tự, không phân trang', async () => {
		const { repository, queryRaw } = build({ total: 3 });
		const page = await repository.findFavoritePage(
			'nguoi-1',
			visibility,
			0,
			20,
		);
		const page1 = rawCallAt(queryRaw, 0);
		const count = rawCallAt(queryRaw, 1);
		expect(count.text).toContain('SELECT count(*)::int AS total');
		expect(count.text).not.toContain('ORDER BY');
		expect(count.text).not.toContain('LIMIT');
		const [pageFrom, pageWhere] = page1.values as Prisma.Sql[];
		const [countFrom, countWhere] = count.values as Prisma.Sql[];
		expect(flat(countFrom)).toBe(flat(pageFrom));
		expect(countFrom.values).toEqual(pageFrom.values);
		expect(flat(countWhere)).toBe(flat(pageWhere));
		expect(page.total).toBe(3);
	});

	it('bước hai lấy dữ liệu tin theo id rồi xếp lại đúng thứ tự của bước một, kèm lúc lưu của từng dòng', async () => {
		const a = publicSummaryRow({ id: 'tin-a' });
		const b = publicSummaryRow({ id: 'tin-b' });
		const { repository, findMany } = build({
			pageRows: [
				{ id: 'tin-b', favorited_at: SAVED_AT_B },
				{ id: 'tin-a', favorited_at: SAVED_AT_A },
			],
			total: 2,
			// Prisma trả theo thứ tự khác với bước một: Repository phải xếp lại.
			found: [a, b],
		});
		const result = await repository.findFavoritePage(
			'nguoi-1',
			visibility,
			0,
			20,
		);
		expect(findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: { in: ['tin-b', 'tin-a'] } },
			}),
		);
		expect(result.rows).toEqual([
			{ row: b, favoritedAt: SAVED_AT_B },
			{ row: a, favoritedAt: SAVED_AT_A },
		]);
		expect(result.total).toBe(2);
	});

	it('tin bị xóa giữa hai bước thì bỏ qua, trang ngắn đi một dòng; total vẫn là số của bước một', async () => {
		const a = publicSummaryRow({ id: 'tin-a' });
		const { repository } = build({
			pageRows: [
				{ id: 'tin-b', favorited_at: SAVED_AT_B },
				{ id: 'tin-a', favorited_at: SAVED_AT_A },
			],
			total: 2,
			found: [a],
		});
		const result = await repository.findFavoritePage(
			'nguoi-1',
			visibility,
			0,
			20,
		);
		expect(result.rows).toEqual([{ row: a, favoritedAt: SAVED_AT_A }]);
		expect(result.total).toBe(2);
	});

	it('trang rỗng thì không gọi Prisma lần hai và trả total của bước một', async () => {
		const { repository, findMany } = build({ total: 5 });
		await expect(
			repository.findFavoritePage('nguoi-1', visibility, 100, 20),
		).resolves.toEqual({ rows: [], total: 5 });
		expect(findMany).not.toHaveBeenCalled();
	});
});

describe('ListingsRepository.sumViewCountByLandlord (spec 0005 AC-4)', () => {
	function build(rows: { total: bigint }[]) {
		const queryRaw = jest.fn(() => Promise.resolve(rows));
		const repository = new ListingsRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('cộng view_count của mọi tin qua nhà trọ của chủ trọ, KHÔNG lọc trạng thái hay xóa mềm', async () => {
		const { repository, queryRaw } = build([{ total: 3n }]);
		await repository.sumViewCountByLandlord('chu-tro-1');
		const { text, values } = rawCall(queryRaw);
		expect(text).toContain('SUM(l.view_count)');
		expect(text).toContain('JOIN properties p ON p.id = l.property_id');
		expect(text).toContain('WHERE p.landlord_id = ?::uuid');
		expect(text).not.toContain('status');
		expect(text).not.toContain('deleted_at');
		expect(values).toEqual(['chu-tro-1']);
	});

	it('đổi bigint của PostgreSQL sang số của JavaScript; không có dòng hay tổng 0 thì 0', async () => {
		await expect(
			build([{ total: 1840n }]).repository.sumViewCountByLandlord('x'),
		).resolves.toBe(1840);
		await expect(
			build([{ total: 0n }]).repository.sumViewCountByLandlord('x'),
		).resolves.toBe(0);
		await expect(
			build([]).repository.sumViewCountByLandlord('x'),
		).resolves.toBe(0);
	});
});

describe('ListingsRepository.countPublicByLandlord (spec 0005 AC-5)', () => {
	function build(rows: { total: number }[]) {
		const queryRaw = jest.fn(() => Promise.resolve(rows));
		const repository = new ListingsRepository({
			$queryRaw: queryRaw,
		} as unknown as PrismaService);
		return { repository, queryRaw };
	}

	it('dùng đúng hai mảnh SQL công khai cùng `now` và hạn mức, chỉ thêm điều kiện chủ trọ', async () => {
		const { repository, queryRaw } = build([{ total: 2 }]);
		await repository.countPublicByLandlord('chu-tro-1', {
			now: NOW,
			trialListingLimit: 2,
		});
		const { text, values } = rawCall(queryRaw);
		expect(text).toContain('SELECT count(*)::int AS total');
		expect(text).toContain('WHERE p.landlord_id = ?::uuid AND ?');
		// Thứ tự giá trị chèn: phép nối kỳ gói, id chủ trọ, điều kiện hiển thị.
		const [from, landlordId, condition] = values as [
			Prisma.Sql,
			string,
			Prisma.Sql,
		];
		expect(flat(from)).toContain('LEFT JOIN LATERAL');
		expect(from.values).toEqual([NOW.toISOString()]);
		expect(landlordId).toBe('chu-tro-1');
		expect(flat(condition)).toContain("l.status = 'visible'");
		expect(condition.values).toEqual([NOW.toISOString(), 2]);
	});

	it('trả số đếm; không có dòng thì 0', async () => {
		const visibility = { now: NOW, trialListingLimit: 2 };
		await expect(
			build([{ total: 7 }]).repository.countPublicByLandlord(
				'x',
				visibility,
			),
		).resolves.toBe(7);
		await expect(
			build([]).repository.countPublicByLandlord('x', visibility),
		).resolves.toBe(0);
	});
});

describe('ListingsRepository.findEarliestVisibleIds (spec 0003 AC-9, AC-11)', () => {
	it('hỏi N tin visible chưa xóa của chủ trọ, đăng sớm nhất trước, khóa phụ id (cùng thứ tự với luật hạng)', async () => {
		const findMany = jest.fn(() =>
			Promise.resolve([{ id: 'tin-a' }, { id: 'tin-b' }]),
		);
		const repository = new ListingsRepository({
			listing: { findMany },
		} as unknown as PrismaService);
		await expect(
			repository.findEarliestVisibleIds('chu-tro-1', 2),
		).resolves.toEqual(['tin-a', 'tin-b']);
		expect(findMany).toHaveBeenCalledTimes(1);
		expect(findMany).toHaveBeenCalledWith({
			where: {
				status: 'visible',
				deletedAt: null,
				property: { landlordId: 'chu-tro-1' },
			},
			orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
			take: 2,
			select: { id: true },
		});
	});
});

describe('ListingsRepository.findModerationPage (spec 0002 AC-9)', () => {
	function build() {
		const findMany = jest.fn(() => Promise.resolve([]));
		const count = jest.fn(() => Promise.resolve(0));
		const repository = new ListingsRepository({
			listing: { findMany, count },
		} as unknown as PrismaService);
		return { repository, findMany, count };
	}

	it('không lọc gì: mọi trạng thái, chỉ bỏ tin đã xóa mềm, mới nhất trước với khóa phụ id', async () => {
		const { repository, findMany, count } = build();
		await repository.findModerationPage({ searchWords: [] }, 20, 10);
		const args = (findMany.mock.calls as unknown as unknown[][])[0][0] as {
			where: object;
			orderBy: unknown;
			skip: number;
			take: number;
		};
		expect(args.where).toEqual({ deletedAt: null, AND: [] });
		expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
		expect(args.skip).toBe(20);
		expect(args.take).toBe(10);
		// `total` đếm bằng cùng điều kiện.
		expect(count).toHaveBeenCalledWith({
			where: { deletedAt: null, AND: [] },
		});
	});

	it('lọc theo trạng thái và chủ trọ (qua nhà trọ)', async () => {
		const { repository, findMany } = build();
		await repository.findModerationPage(
			{ status: 'hidden_by_admin', landlordId: 'chu-1', searchWords: [] },
			0,
			20,
		);
		const { where } = (
			findMany.mock.calls as unknown as unknown[][]
		)[0][0] as { where: object };
		expect(where).toEqual({
			deletedAt: null,
			status: 'hidden_by_admin',
			property: { landlordId: 'chu-1' },
			AND: [],
		});
	});

	it('mỗi từ khóa là một điều kiện contains nối bằng AND và đã thoát %, _ và gạch chéo ngược', async () => {
		const { repository, findMany } = build();
		await repository.findModerationPage(
			{ searchWords: ['phong', '100%', 'a_b', 'c\\d'] },
			0,
			20,
		);
		const { where } = (
			findMany.mock.calls as unknown as unknown[][]
		)[0][0] as { where: { AND: unknown } };
		expect(where.AND).toEqual([
			{ searchKey: { contains: 'phong' } },
			{ searchKey: { contains: '100\\%' } },
			{ searchKey: { contains: 'a\\_b' } },
			{ searchKey: { contains: 'c\\\\d' } },
		]);
	});

	it('không áp luật hiển thị công khai: admin thấy cả tin đang ẩn và tin của chủ trọ hết gói', async () => {
		const { repository, findMany } = build();
		await repository.findModerationPage({ searchWords: [] }, 0, 20);
		const { where } = (
			findMany.mock.calls as unknown as unknown[][]
		)[0][0] as { where: Record<string, unknown> };
		expect(where).not.toHaveProperty('status');
		expect(where).not.toHaveProperty('property');
	});
});
