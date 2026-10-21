import type { PrismaService } from '../database/prisma.service';
import { OrdersRepository, revenueQuery } from './orders.repository';

describe('OrdersRepository.findAdminPage (spec 0010 AC-1 đến AC-5)', () => {
	interface FindManyArgs {
		where: Record<string, unknown>;
		select: Record<string, unknown>;
		orderBy: unknown;
		skip: number;
		take: number;
	}

	function build(
		options: {
			rows?: unknown[];
			total?: number;
			aggregate?: {
				_count: { _all: number };
				_sum: { price: number | null };
			};
		} = {},
	) {
		const findMany = jest.fn(() => Promise.resolve(options.rows ?? []));
		const count = jest.fn(() => Promise.resolve(options.total ?? 0));
		const aggregate = jest.fn(() =>
			Promise.resolve(
				options.aggregate ?? {
					_count: { _all: 0 },
					_sum: { price: null },
				},
			),
		);
		const repository = new OrdersRepository({
			order: { findMany, count, aggregate },
		} as unknown as PrismaService);
		return { repository, findMany, count, aggregate };
	}

	function firstFindManyArgs(findMany: jest.Mock): FindManyArgs {
		return (
			findMany.mock.calls as unknown as unknown[][]
		)[0][0] as FindManyArgs;
	}

	function firstAggregateArgs(aggregate: jest.Mock): {
		where: { AND: unknown[] };
		_count: unknown;
		_sum: unknown;
	} {
		return (aggregate.mock.calls as unknown as unknown[][])[0][0] as {
			where: { AND: unknown[] };
			_count: unknown;
			_sum: unknown;
		};
	}

	it('không lọc gì: where rỗng (mọi chủ trọ, mọi trạng thái), mới nhất trước với khóa phụ id giảm dần', async () => {
		const { repository, findMany, count } = build();
		await repository.findAdminPage({}, 40, 20);
		const args = firstFindManyArgs(findMany);
		expect(args.where).toEqual({});
		expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
		expect(args.skip).toBe(40);
		expect(args.take).toBe(20);
		// `total` đếm bằng cùng điều kiện, không có skip hay take.
		expect(count).toHaveBeenCalledWith({ where: {} });
	});

	it('select liệt kê đúng mười một cột của đơn, kỳ gói và ba cột của chủ trọ, không có userId hay cột nào khác của users', async () => {
		const { repository, findMany } = build();
		await repository.findAdminPage({}, 0, 20);
		const { select } = firstFindManyArgs(findMany);
		expect(Object.keys(select).sort()).toEqual([
			'cancelledAt',
			'code',
			'createdAt',
			'durationDays',
			'id',
			'maxListings',
			'paidAt',
			'planId',
			'planName',
			'price',
			'status',
			'subscription',
			'user',
		]);
		expect(select.user).toEqual({
			select: { id: true, name: true, email: true },
		});
		expect(select.subscription).toEqual({
			select: { startsAt: true, endsAt: true },
		});
		expect(select).not.toHaveProperty('userId');
		expect(select).not.toHaveProperty('updatedAt');
	});

	it.each([
		['chỉ trạng thái', { status: 'paid' as const }, { status: 'paid' }],
		[
			'chỉ chủ trọ (khớp orders.user_id)',
			{ landlordId: 'u1' },
			{ userId: 'u1' },
		],
		['chỉ gói', { planId: 'p1' }, { planId: 'p1' }],
		[
			'cả ba cùng lúc',
			{ status: 'cancelled' as const, landlordId: 'u1', planId: 'p1' },
			{ status: 'cancelled', userId: 'u1', planId: 'p1' },
		],
	])(
		'bộ lọc %s nằm trong where của cả ba truy vấn',
		async (_label, filter, expected) => {
			const { repository, findMany, count, aggregate } = build();
			await repository.findAdminPage(filter, 0, 20);
			expect(firstFindManyArgs(findMany).where).toEqual(expected);
			expect(count).toHaveBeenCalledWith({ where: expected });
			expect(firstAggregateArgs(aggregate).where.AND[0]).toEqual(
				expected,
			);
		},
	);

	it('khoảng ngày tạo: cận dưới gồm (gte), cận trên không gồm (lt), cả hai trên cột createdAt', async () => {
		const { repository, findMany } = build();
		const createdFrom = new Date('2026-09-30T17:00:00.000Z');
		const createdBefore = new Date('2026-10-31T17:00:00.000Z');
		await repository.findAdminPage({ createdFrom, createdBefore }, 0, 20);
		expect(firstFindManyArgs(findMany).where).toEqual({
			createdAt: { gte: createdFrom, lt: createdBefore },
		});
	});

	it('chỉ một đầu của khoảng ngày thì chỉ có một vế', async () => {
		const only = new Date('2026-10-31T17:00:00.000Z');
		const first = build();
		await first.repository.findAdminPage({ createdFrom: only }, 0, 20);
		expect(firstFindManyArgs(first.findMany).where).toEqual({
			createdAt: { gte: only },
		});
		const second = build();
		await second.repository.findAdminPage({ createdBefore: only }, 0, 20);
		expect(firstFindManyArgs(second.findMany).where).toEqual({
			createdAt: { lt: only },
		});
	});

	it('summary thêm status = paid bằng AND, không ghi đè bộ lọc status (lọc pending vẫn cho summary bằng 0)', async () => {
		const { repository, aggregate } = build();
		await repository.findAdminPage(
			{ status: 'pending', landlordId: 'u1' },
			0,
			20,
		);
		const args = firstAggregateArgs(aggregate);
		expect(args.where).toEqual({
			AND: [{ status: 'pending', userId: 'u1' }, { status: 'paid' }],
		});
		expect(args._count).toEqual({ _all: true });
		expect(args._sum).toEqual({ price: true });
	});

	it('summary không phụ thuộc trang: aggregate không có skip hay take', async () => {
		const { repository, aggregate } = build();
		await repository.findAdminPage({}, 100, 5);
		const args = firstAggregateArgs(aggregate) as unknown as Record<
			string,
			unknown
		>;
		expect(args).not.toHaveProperty('skip');
		expect(args).not.toHaveProperty('take');
	});

	it('trả đúng hàng, total và summary từ ba truy vấn', async () => {
		const rows = [{ id: 'o1' }];
		const { repository } = build({
			rows,
			total: 57,
			aggregate: { _count: { _all: 30 }, _sum: { price: 5_970_000 } },
		});
		await expect(repository.findAdminPage({}, 0, 20)).resolves.toEqual({
			rows,
			total: 57,
			summary: { paidCount: 30, paidAmount: 5_970_000 },
		});
	});

	it('không có đơn paid: tổng là null thì paidAmount là 0', async () => {
		const { repository } = build({
			aggregate: { _count: { _all: 0 }, _sum: { price: null } },
		});
		const { summary } = await repository.findAdminPage({}, 0, 20);
		expect(summary).toEqual({ paidCount: 0, paidAmount: 0 });
	});

	it('giữ nguyên tổng vượt 2,1 tỷ (không ép về int32)', async () => {
		const { repository } = build({
			aggregate: { _count: { _all: 30 }, _sum: { price: 3_000_000_000 } },
		});
		const { summary } = await repository.findAdminPage({}, 0, 20);
		expect(summary.paidAmount).toBe(3_000_000_000);
	});
});

describe('revenueQuery (spec 0010 AC-6 đến AC-8)', () => {
	const FROM = new Date('2026-09-30T17:00:00.000Z');
	const BEFORE = new Date('2026-10-31T17:00:00.000Z');
	const flat = (text: string): string => text.replace(/\s+/g, ' ');

	it('không có khoảng: không có điều kiện paid_at, chỉ hai tham số là múi giờ và mẫu gom', () => {
		const query = revenueQuery({}, 'month');
		expect(flat(query.text)).not.toContain('o.paid_at >=');
		expect(flat(query.text)).not.toContain('o.paid_at <');
		expect(query.values).toEqual(['Asia/Ho_Chi_Minh', 'YYYY-MM']);
	});

	it('gom theo ngày dùng mẫu YYYY-MM-DD', () => {
		expect(revenueQuery({}, 'day').values).toEqual([
			'Asia/Ho_Chi_Minh',
			'YYYY-MM-DD',
		]);
	});

	it('có khoảng: hai cận đi vào dưới dạng chuỗi ISO có Z, sau múi giờ và mẫu', () => {
		const query = revenueQuery({ from: FROM, before: BEFORE }, 'day');
		expect(query.values).toEqual([
			'Asia/Ho_Chi_Minh',
			'YYYY-MM-DD',
			'2026-09-30T17:00:00.000Z',
			'2026-10-31T17:00:00.000Z',
		]);
		expect(query.values.every((value) => typeof value === 'string')).toBe(
			true,
		);
		expect(flat(query.text)).toContain('o.paid_at >= $3::timestamptz');
		// Cận trên so chặt: ngày kế bắt đầu đúng 00:00 giờ Việt Nam thì không vào.
		expect(flat(query.text)).toContain('o.paid_at < $4::timestamptz');
		expect(flat(query.text)).not.toContain('o.paid_at <=');
	});

	it('chỉ from hoặc chỉ before thì chỉ một vế', () => {
		const onlyFrom = revenueQuery({ from: FROM }, 'month');
		expect(flat(onlyFrom.text)).toContain('o.paid_at >= $3::timestamptz');
		expect(flat(onlyFrom.text)).not.toContain('o.paid_at <');
		const onlyBefore = revenueQuery({ before: BEFORE }, 'month');
		expect(flat(onlyBefore.text)).toContain('o.paid_at < $3::timestamptz');
		expect(flat(onlyBefore.text)).not.toContain('o.paid_at >=');
	});

	it('chỉ tính đơn paid, đổi sang giờ Việt Nam bằng AT TIME ZONE, mẫu gom là tham số chứ không nằm trong câu', () => {
		const text = flat(revenueQuery({}, 'month').text);
		expect(text).toContain("o.status = 'paid'");
		expect(text).toContain('o.paid_at AT TIME ZONE $1::text');
		expect(text).toContain('$2::text');
		expect(text).not.toContain('YYYY');
		expect(text).not.toContain('Asia/Ho_Chi_Minh');
	});

	it('một câu duy nhất có CTE paid và UNION ALL của hai phép gom (theo gói nối plans, theo period)', () => {
		const text = flat(revenueQuery({}, 'month').text);
		expect(text).toContain('WITH paid AS');
		expect(text).toContain('UNION ALL');
		expect(text).toContain('JOIN plans pl ON pl.id = p.plan_id');
		expect(text).toContain('GROUP BY p.plan_id, pl.name');
		expect(text).toContain('GROUP BY period');
	});

	it('cộng SUM(price)::bigint ở cả hai phép gom và không bao giờ ép về int4', () => {
		const text = flat(revenueQuery({}, 'month').text);
		expect(text).toContain('sum(p.price)::bigint');
		expect(text).toContain('sum(price)::bigint');
		expect(text).not.toMatch(/sum\([^)]*\)::(int|int4|integer)\b/i);
	});

	it('cộng price đã chốt trên đơn, không đọc giá hiện tại của gói', () => {
		const text = flat(revenueQuery({}, 'month').text);
		expect(text).not.toContain('pl.price');
		expect(text).toContain('o.price');
	});
});

describe('OrdersRepository.findRevenue (spec 0010 AC-6, AC-7)', () => {
	function build(rows: unknown[]) {
		const $queryRaw = jest.fn(() => Promise.resolve(rows));
		const repository = new OrdersRepository({
			$queryRaw,
		} as unknown as PrismaService);
		return { repository, $queryRaw };
	}

	it('chạy đúng một câu SQL thô cho cả hai phép gom', async () => {
		const { repository, $queryRaw } = build([]);
		await repository.findRevenue({}, 'month');
		expect($queryRaw).toHaveBeenCalledTimes(1);
	});

	it('tách dòng theo loại, đổi bigint sang number, giữ tổng vượt 2,1 tỷ', async () => {
		const { repository } = build([
			{
				kind: 'plan',
				key: 'p1',
				label: 'Nâng cao',
				paidCount: 20,
				paidAmount: 3_980_000n,
			},
			{
				kind: 'plan',
				key: 'p2',
				label: 'Gói lớn',
				paidCount: 30,
				paidAmount: 3_000_000_000n,
			},
			{
				kind: 'period',
				key: '2026-10',
				label: null,
				paidCount: 50,
				paidAmount: 3_003_980_000n,
			},
		]);
		const { byPlan, series } = await repository.findRevenue({}, 'month');
		expect(byPlan).toEqual([
			{
				planId: 'p1',
				planName: 'Nâng cao',
				paidCount: 20,
				paidAmount: 3_980_000,
			},
			{
				planId: 'p2',
				planName: 'Gói lớn',
				paidCount: 30,
				paidAmount: 3_000_000_000,
			},
		]);
		expect(series).toEqual([
			{ period: '2026-10', paidCount: 50, paidAmount: 3_003_980_000 },
		]);
		expect(typeof byPlan[1].paidAmount).toBe('number');
		expect(typeof series[0].paidAmount).toBe('number');
	});

	it('nhận cả paidAmount đã là number', async () => {
		const { repository } = build([
			{
				kind: 'period',
				key: '2026-10-03',
				label: null,
				paidCount: 2,
				paidAmount: 398_000,
			},
		]);
		const { series } = await repository.findRevenue({}, 'day');
		expect(series).toEqual([
			{ period: '2026-10-03', paidCount: 2, paidAmount: 398_000 },
		]);
	});

	it('không có dòng nào: hai mảng rỗng', async () => {
		const { repository } = build([]);
		await expect(repository.findRevenue({}, 'day')).resolves.toEqual({
			byPlan: [],
			series: [],
		});
	});
});
