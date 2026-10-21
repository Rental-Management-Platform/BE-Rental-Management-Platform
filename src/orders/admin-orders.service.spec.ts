import { AdminOrdersService } from './admin-orders.service';
import type {
	ListAllOrdersQueryDto,
	RevenueQueryDto,
} from './dto/admin-order-queries.dto';
import type { RevenueByPlan, RevenuePeriod } from './dto/revenue.response';
import { orderRow } from './orders.fixtures';
import type { AdminOrderRow, OrdersRepository } from './orders.repository';

const LANDLORD = {
	id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03',
	name: 'Nguyễn Văn Nam',
	email: 'nam@example.com',
};

function adminRow(overrides: Partial<AdminOrderRow> = {}): AdminOrderRow {
	return { ...orderRow(), user: LANDLORD, ...overrides };
}

function build(
	result: {
		rows?: AdminOrderRow[];
		total?: number;
		summary?: { paidCount: number; paidAmount: number };
	} = {},
) {
	const findAdminPage = jest.fn(() =>
		Promise.resolve({
			rows: result.rows ?? [],
			total: result.total ?? 0,
			summary: result.summary ?? { paidCount: 0, paidAmount: 0 },
		}),
	);
	const service = new AdminOrdersService({
		findAdminPage,
	} as unknown as OrdersRepository);
	return { service, findAdminPage };
}

function query(
	overrides: Partial<ListAllOrdersQueryDto> = {},
): ListAllOrdersQueryDto {
	return { page: 1, pageSize: 20, ...overrides };
}

describe('AdminOrdersService.listAll (spec 0010 AC-1 đến AC-5)', () => {
	it('không lọc: gọi repository với bộ lọc rỗng, bỏ qua (page - 1) * pageSize dòng và lấy pageSize dòng', async () => {
		const { service, findAdminPage } = build();
		await service.listAll(query({ page: 3, pageSize: 10 }));
		expect(findAdminPage).toHaveBeenCalledWith(
			{
				status: undefined,
				landlordId: undefined,
				planId: undefined,
				createdFrom: undefined,
				createdBefore: undefined,
			},
			20,
			10,
		);
	});

	it('chuyển bộ lọc sang repository đúng tên: landlordId, planId, status', async () => {
		const { service, findAdminPage } = build();
		await service.listAll(
			query({ status: 'paid', landlordId: 'u1', planId: 'p1' }),
		);
		expect(findAdminPage).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'paid',
				landlordId: 'u1',
				planId: 'p1',
			}),
			0,
			20,
		);
	});

	it('from là 00:00 giờ Việt Nam của ngày đó, cận trên của to là 00:00 giờ Việt Nam của ngày kế (AC-3)', async () => {
		const { service, findAdminPage } = build();
		await service.listAll(query({ from: '2026-10-01', to: '2026-10-31' }));
		const [filter] = (
			findAdminPage.mock.calls as unknown as [
				{ createdFrom: Date; createdBefore: Date },
			][]
		)[0];
		expect(filter.createdFrom.toISOString()).toBe(
			'2026-09-30T17:00:00.000Z',
		);
		expect(filter.createdBefore.toISOString()).toBe(
			'2026-10-31T17:00:00.000Z',
		);
	});

	it('chỉ gửi from hoặc chỉ gửi to thì chỉ một cận được truyền', async () => {
		const first = build();
		await first.service.listAll(query({ from: '2026-11-01' }));
		expect(first.findAdminPage).toHaveBeenCalledWith(
			expect.objectContaining({
				createdFrom: new Date('2026-10-31T17:00:00.000Z'),
				createdBefore: undefined,
			}),
			0,
			20,
		);
		const second = build();
		await second.service.listAll(query({ to: '2026-10-31' }));
		expect(second.findAdminPage).toHaveBeenCalledWith(
			expect.objectContaining({
				createdFrom: undefined,
				createdBefore: new Date('2026-10-31T17:00:00.000Z'),
			}),
			0,
			20,
		);
	});

	it('trả { items, total, page, pageSize, summary } với summary của đúng tập lọc', async () => {
		const { service } = build({
			rows: [adminRow()],
			total: 31,
			summary: { paidCount: 30, paidAmount: 5_970_000 },
		});
		const page = await service.listAll(query({ page: 2, pageSize: 1 }));
		expect(Object.keys(page)).toEqual([
			'items',
			'total',
			'page',
			'pageSize',
			'summary',
		]);
		expect(page).toMatchObject({
			total: 31,
			page: 2,
			pageSize: 1,
			summary: { paidCount: 30, paidAmount: 5_970_000 },
		});
		expect(page.items).toHaveLength(1);
		expect(page.items[0].landlord).toEqual(LANDLORD);
	});

	it('trang quá cuối: items rỗng nhưng total và summary vẫn nguyên', async () => {
		const { service } = build({
			rows: [],
			total: 31,
			summary: { paidCount: 30, paidAmount: 5_970_000 },
		});
		const page = await service.listAll(query({ page: 99 }));
		expect(page.items).toEqual([]);
		expect(page.total).toBe(31);
		expect(page.summary).toEqual({ paidCount: 30, paidAmount: 5_970_000 });
	});

	it('không có dòng nào: total và summary bằng 0', async () => {
		const { service } = build();
		const page = await service.listAll(query());
		expect(page).toEqual({
			items: [],
			total: 0,
			page: 1,
			pageSize: 20,
			summary: { paidCount: 0, paidAmount: 0 },
		});
	});
});

describe('AdminOrdersService.revenue (spec 0010 AC-6 đến AC-8)', () => {
	function buildRevenue(
		result: {
			byPlan?: RevenueByPlan[];
			series?: RevenuePeriod[];
		} = {},
	) {
		const findRevenue = jest.fn(() =>
			Promise.resolve({
				byPlan: result.byPlan ?? [],
				series: result.series ?? [],
			}),
		);
		const service = new AdminOrdersService({
			findRevenue,
		} as unknown as OrdersRepository);
		return { service, findRevenue };
	}

	function revenueQuery(
		overrides: Partial<RevenueQueryDto> = {},
	): RevenueQueryDto {
		return { groupBy: 'month', ...overrides };
	}

	const plan = (
		planId: string,
		planName: string,
		paidCount: number,
		paidAmount: number,
	): RevenueByPlan => ({ planId, planName, paidCount, paidAmount });
	const period = (
		key: string,
		paidCount: number,
		paidAmount: number,
	): RevenuePeriod => ({ period: key, paidCount, paidAmount });

	it('không có đơn nào: mọi số bằng 0, hai mảng rỗng, from và to là null, timeZone cố định', async () => {
		const { service } = buildRevenue();
		await expect(service.revenue(revenueQuery())).resolves.toEqual({
			from: null,
			to: null,
			groupBy: 'month',
			timeZone: 'Asia/Ho_Chi_Minh',
			paidCount: 0,
			paidAmount: 0,
			byPlan: [],
			series: [],
		});
	});

	it('phản hồi có đúng chín khóa theo thứ tự của spec', async () => {
		const { service } = buildRevenue();
		const response = await service.revenue(revenueQuery());
		expect(Object.keys(response)).toEqual([
			'from',
			'to',
			'groupBy',
			'timeZone',
			'paidCount',
			'paidAmount',
			'byPlan',
			'series',
		]);
	});

	it('không gửi ngày: không chặn phía nào (cả hai cận undefined), groupBy được chuyển nguyên', async () => {
		const { service, findRevenue } = buildRevenue();
		await service.revenue(revenueQuery({ groupBy: 'day' }));
		expect(findRevenue).toHaveBeenCalledWith(
			{ from: undefined, before: undefined },
			'day',
		);
	});

	it('from là 00:00 giờ Việt Nam của ngày đó, cận trên của to là 00:00 giờ Việt Nam của ngày kế, trả lại from và to đúng như đã gửi', async () => {
		const { service, findRevenue } = buildRevenue();
		const response = await service.revenue(
			revenueQuery({ from: '2026-10-01', to: '2026-10-31' }),
		);
		expect(findRevenue).toHaveBeenCalledWith(
			{
				from: new Date('2026-09-30T17:00:00.000Z'),
				before: new Date('2026-10-31T17:00:00.000Z'),
			},
			'month',
		);
		expect(response.from).toBe('2026-10-01');
		expect(response.to).toBe('2026-10-31');
	});

	it('sắp byPlan: paidAmount giảm dần, rồi planName tăng dần, rồi planId tăng dần', async () => {
		const { service } = buildRevenue({
			byPlan: [
				plan('p3', 'Cơ bản', 1, 100),
				plan('p1', 'Nâng cao', 2, 500),
				plan('p4', 'Cơ bản', 1, 100),
				plan('p2', 'Chuyên nghiệp', 1, 100),
				plan('p0', 'Gói lớn', 3, 900),
			],
		});
		const { byPlan } = await service.revenue(revenueQuery());
		expect(byPlan.map((row) => row.planId)).toEqual([
			'p0',
			'p1',
			'p2', // cùng 100, 'Chuyên nghiệp' đứng trước 'Cơ bản' theo thứ tự ký tự
			'p3',
			'p4', // cùng tên và cùng tiền: planId tăng dần
		]);
	});

	it('sắp series theo period tăng dần', async () => {
		const { service } = buildRevenue({
			series: [
				period('2026-11-01', 1, 10),
				period('2026-10-03', 2, 20),
				period('2026-10-31', 1, 30),
			],
		});
		const { series } = await service.revenue(
			revenueQuery({ groupBy: 'day' }),
		);
		expect(series.map((row) => row.period)).toEqual([
			'2026-10-03',
			'2026-10-31',
			'2026-11-01',
		]);
	});

	it('paidCount và paidAmount ngoài cùng là tổng các dòng byPlan', async () => {
		const { service } = buildRevenue({
			byPlan: [
				plan('p1', 'A', 20, 3_980_000),
				plan('p2', 'B', 10, 1_990_000),
			],
			series: [period('2026-10', 30, 5_970_000)],
		});
		const response = await service.revenue(revenueQuery());
		expect(response.paidCount).toBe(30);
		expect(response.paidAmount).toBe(5_970_000);
	});

	it('ba tổng (ngoài cùng, byPlan, series) bằng nhau khi dữ liệu từ một câu SQL', async () => {
		const { service } = buildRevenue({
			byPlan: [
				plan('p1', 'A', 20, 3_980_000),
				plan('p2', 'B', 10, 1_990_000),
			],
			series: [
				period('2026-09', 12, 2_388_000),
				period('2026-10', 18, 3_582_000),
			],
		});
		const response = await service.revenue(revenueQuery());
		const sum = (
			rows: readonly { paidCount: number; paidAmount: number }[],
		) =>
			rows.reduce(
				(total, row) => ({
					paidCount: total.paidCount + row.paidCount,
					paidAmount: total.paidAmount + row.paidAmount,
				}),
				{ paidCount: 0, paidAmount: 0 },
			);
		expect(sum(response.byPlan)).toEqual({
			paidCount: response.paidCount,
			paidAmount: response.paidAmount,
		});
		expect(sum(response.series)).toEqual({
			paidCount: response.paidCount,
			paidAmount: response.paidAmount,
		});
	});

	it('tổng vượt 2,1 tỷ cộng đúng (không tràn int32)', async () => {
		const { service } = buildRevenue({
			byPlan: [plan('p1', 'Gói lớn', 30, 3_000_000_000)],
			series: [period('2026-08', 30, 3_000_000_000)],
		});
		expect((await service.revenue(revenueQuery())).paidAmount).toBe(
			3_000_000_000,
		);
	});

	it('không đổi mảng của repository (sắp trên bản sao)', async () => {
		const byPlan = [plan('p2', 'B', 1, 1), plan('p1', 'A', 1, 5)];
		const { service } = buildRevenue({ byPlan });
		await service.revenue(revenueQuery());
		expect(byPlan.map((row) => row.planId)).toEqual(['p2', 'p1']);
	});
});
