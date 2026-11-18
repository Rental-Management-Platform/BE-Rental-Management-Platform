import {
	toAccountsBlock,
	toEngagementBlock,
	toListingsBlock,
	toOverviewSeries,
	toToHandleBlock,
	toWardList,
} from './admin-overview.mapper';
import type { AccountCountRow } from './admin-overview.repository';
import { resolveStatPeriod } from './stat-period';
import type { PeriodSplit } from './statistics.mapper';

/** Giữa trưa giờ Việt Nam ngày 16/11/2026. */
const NOW = new Date('2026-11-16T05:00:00.000Z');

function split(
	value: number,
	previous: number,
	days: [string, number][] = [],
): PeriodSplit {
	return { value, previous, byDate: new Map(days) };
}

const ROWS: AccountCountRow[] = [
	{ accountType: 'admin', status: 'active', count: 2 },
	{ accountType: 'landlord', status: 'active', count: 205 },
	{ accountType: 'landlord', status: 'locked', count: 5 },
	{ accountType: 'tenant', status: 'active', count: 993 },
	{ accountType: 'tenant', status: 'locked', count: 8 },
];

describe('toAccountsBlock (spec 0018 AC-4, AC-5)', () => {
	const block = toAccountsBlock(ROWS, split(7, 5), split(38, 33));

	it('mỗi loại có total, active, locked; total luôn bằng active + locked', () => {
		expect(block.byType.admin).toEqual({ total: 2, active: 2, locked: 0 });
		expect(block.byType.landlord).toEqual({
			total: 210,
			active: 205,
			locked: 5,
		});
		expect(block.byType.tenant).toEqual({
			total: 1001,
			active: 993,
			locked: 8,
		});
	});

	it('cấp ngoài cùng là tổng của ba loại, và total = active + locked ở mọi cấp', () => {
		expect(block.total).toBe(1213);
		expect(block.active).toBe(1200);
		expect(block.locked).toBe(13);
		for (const level of [
			block,
			block.byType.admin,
			block.byType.landlord,
			block.byType.tenant,
		])
			expect(level.total).toBe(level.active + level.locked);
	});

	it('loại hay trạng thái không có dòng nào vẫn có mặt và bằng 0 (nền tảng chỉ có admin)', () => {
		const empty = toAccountsBlock(
			[{ accountType: 'admin', status: 'active', count: 1 }],
			split(0, 0),
			split(0, 0),
		);
		expect(empty.byType.landlord).toEqual({
			total: 0,
			active: 0,
			locked: 0,
		});
		expect(empty.byType.tenant).toEqual({ total: 0, active: 0, locked: 0 });
		expect(empty.total).toBe(1);
		expect(
			toAccountsBlock([], split(0, 0), split(0, 0)).byType.admin,
		).toEqual({ total: 0, active: 0, locked: 0 });
	});

	it('bỏ hàng có loại hay trạng thái lạ để total vẫn bằng active + locked', () => {
		const odd = toAccountsBlock(
			[
				...ROWS,
				{ accountType: 'ghost', status: 'active', count: 99 },
				{ accountType: 'tenant', status: 'banned', count: 99 },
			],
			split(0, 0),
			split(0, 0),
		);
		expect(odd.total).toBe(1213);
		expect(odd.total).toBe(odd.active + odd.locked);
	});

	it('registered: landlords và tenants là Metric của riêng từng loại', () => {
		expect(block.registered.landlords).toEqual({
			value: 7,
			previous: 5,
			changePercent: 40,
		});
		expect(block.registered.tenants).toEqual({
			value: 38,
			previous: 33,
			changePercent: 15.2,
		});
	});

	it('registered.total bằng landlords + tenants cả value lẫn previous, phần trăm tính trên tổng (18,4)', () => {
		expect(block.registered.total).toEqual({
			value: 45,
			previous: 38,
			changePercent: 18.4,
		});
	});

	it('registered: kỳ trước bằng 0 thì changePercent là null, không Infinity hay NaN', () => {
		const fresh = toAccountsBlock(ROWS, split(3, 0), split(0, 0));
		expect(fresh.registered.landlords.changePercent).toBeNull();
		expect(fresh.registered.tenants.changePercent).toBeNull();
		expect(fresh.registered.total.changePercent).toBeNull();
		expect(fresh.registered.total.value).toBe(3);
	});
});

describe('toListingsBlock (spec 0018 AC-7, AC-8, AC-9)', () => {
	const wards = [
		{ wardCode: '26734', wardName: 'Phường Bến Thành', count: 12 },
		{ wardCode: '26737', wardName: 'Phường Võ Thị Sáu', count: 9 },
	];

	it('total là tổng ba trạng thái; visible = public + visibleButNotPublic', () => {
		const block = toListingsBlock(
			{ visible: 600, hiddenByOwner: 150, hiddenByAdmin: 50 },
			520,
			split(21, 15),
			wards,
		);
		expect(block.total).toBe(800);
		expect(block.visible).toBe(600);
		expect(block.hiddenByOwner).toBe(150);
		expect(block.hiddenByAdmin).toBe(50);
		expect(block.public).toBe(520);
		expect(block.visibleButNotPublic).toBe(80);
		expect(block.visible).toBe(block.public + block.visibleButNotPublic);
	});

	it('visibleButNotPublic không bao giờ âm, kể cả khi hai truy vấn lệch nhau lúc đang có ghi', () => {
		const block = toListingsBlock(
			{ visible: 5, hiddenByOwner: 0, hiddenByAdmin: 0 },
			7,
			split(0, 0),
			[],
		);
		expect(block.visibleButNotPublic).toBe(0);
		expect(block.public).toBe(7);
	});

	it('created là Metric; createdByWard giữ nguyên thứ tự truy vấn và chỉ có ba trường', () => {
		const block = toListingsBlock(
			{ visible: 0, hiddenByOwner: 0, hiddenByAdmin: 0 },
			0,
			split(21, 15),
			wards,
		);
		expect(block.created).toEqual({
			value: 21,
			previous: 15,
			changePercent: 40,
		});
		expect(block.createdByWard).toEqual(wards);
		for (const ward of block.createdByWard)
			expect(Object.keys(ward).sort()).toEqual([
				'count',
				'wardCode',
				'wardName',
			]);
	});

	it('không có tin nào: mọi số 0, createdByWard là [], created.changePercent là null', () => {
		const block = toListingsBlock(
			{ visible: 0, hiddenByOwner: 0, hiddenByAdmin: 0 },
			0,
			split(0, 0),
			[],
		);
		expect(block).toEqual({
			total: 0,
			visible: 0,
			hiddenByOwner: 0,
			hiddenByAdmin: 0,
			public: 0,
			visibleButNotPublic: 0,
			created: { value: 0, previous: 0, changePercent: null },
			createdByWard: [],
		});
	});
});

describe('toWardList', () => {
	it('không sắp xếp lại: thứ tự là của câu SQL', () => {
		const rows = [
			{ wardCode: '2', wardName: 'B', count: 1 },
			{ wardCode: '1', wardName: 'A', count: 5 },
		];
		expect(toWardList(rows).map((row) => row.wardCode)).toEqual(['2', '1']);
	});
});

const KEYS = [
	'newLandlords',
	'newTenants',
	'newListings',
	'views',
	'newConversations',
	'newMessages',
	'newLandlordReviews',
	'newRoomReviews',
	'newFollows',
	'newFavorites',
] as const;

/** Mọi cột đều rỗng; test ghi đè từng cột cần thử. */
function emptyColumns(): Record<(typeof KEYS)[number], Map<string, number>> {
	return {
		newLandlords: new Map(),
		newTenants: new Map(),
		newListings: new Map(),
		views: new Map(),
		newConversations: new Map(),
		newMessages: new Map(),
		newLandlordReviews: new Map(),
		newRoomReviews: new Map(),
		newFollows: new Map(),
		newFavorites: new Map(),
	};
}

describe('toOverviewSeries (spec 0018 AC-12)', () => {
	const period = resolveStatPeriod(
		{ from: '2026-11-14', to: '2026-11-16' },
		NOW,
	);

	it('đủ days phần tử, mỗi ngày một phần tử, ngày tăng dần, ngày không có gì thì cả mười cột bằng 0', () => {
		const series = toOverviewSeries(period, emptyColumns());
		expect(series).toHaveLength(3);
		expect(series.map((point) => point.date)).toEqual([
			'2026-11-14',
			'2026-11-15',
			'2026-11-16',
		]);
		for (const point of series)
			for (const key of KEYS) expect(point[key]).toBe(0);
	});

	it('mỗi phần tử có đúng mười một khóa: date và mười cột, theo thứ tự của spec', () => {
		const point = toOverviewSeries(period, emptyColumns())[0];
		expect(Object.keys(point ?? {})).toEqual(['date', ...KEYS]);
	});

	it('mỗi cột lấy đúng ngày của nó, không cột nào lấy nhầm số của cột khác', () => {
		// Mỗi cột một số khác nhau ở một ngày khác nhau: lấy nhầm cột là lệch ngay một ô.
		const columns = emptyColumns();
		columns.newLandlords.set('2026-11-15', 1);
		columns.newTenants.set('2026-11-14', 2);
		columns.newListings.set('2026-11-16', 3);
		columns.views.set('2026-11-14', 40);
		columns.views.set('2026-11-16', 5);
		columns.newConversations.set('2026-11-15', 6);
		columns.newMessages.set('2026-11-14', 7);
		columns.newLandlordReviews.set('2026-11-16', 8);
		columns.newRoomReviews.set('2026-11-15', 9);
		columns.newFollows.set('2026-11-14', 10);
		columns.newFavorites.set('2026-11-16', 11);
		const series = toOverviewSeries(period, columns);
		expect(series[0]).toEqual({
			date: '2026-11-14',
			newLandlords: 0,
			newTenants: 2,
			newListings: 0,
			views: 40,
			newConversations: 0,
			newMessages: 7,
			newLandlordReviews: 0,
			newRoomReviews: 0,
			newFollows: 10,
			newFavorites: 0,
		});
		expect(series[1]).toEqual({
			date: '2026-11-15',
			newLandlords: 1,
			newTenants: 0,
			newListings: 0,
			views: 0,
			newConversations: 6,
			newMessages: 0,
			newLandlordReviews: 0,
			newRoomReviews: 9,
			newFollows: 0,
			newFavorites: 0,
		});
		expect(series[2]).toEqual({
			date: '2026-11-16',
			newLandlords: 0,
			newTenants: 0,
			newListings: 3,
			views: 5,
			newConversations: 0,
			newMessages: 0,
			newLandlordReviews: 8,
			newRoomReviews: 0,
			newFollows: 0,
			newFavorites: 11,
		});
	});

	it('khoảng 1 ngày ra 1 phần tử, khoảng 366 ngày ra 366 phần tử', () => {
		expect(
			toOverviewSeries(
				resolveStatPeriod(
					{ from: '2026-11-16', to: '2026-11-16' },
					NOW,
				),
				emptyColumns(),
			),
		).toHaveLength(1);
		expect(
			toOverviewSeries(
				resolveStatPeriod(
					{ from: '2025-11-16', to: '2026-11-16' },
					NOW,
				),
				emptyColumns(),
			),
		).toHaveLength(366);
	});
});

describe('toEngagementBlock (spec 0018 AC-10)', () => {
	const splits = {
		views: split(1280, 1024),
		conversations: split(64, 80),
		messages: split(512, 400),
		landlordReviews: split(9, 0),
		roomReviews: split(14, 11),
		follows: split(33, 33),
		favorites: split(120, 90),
	};
	const block = toEngagementBlock(splits);

	it('đúng bảy Metric theo thứ tự của spec, mỗi khóa lấy đúng lần tách của nó', () => {
		expect(Object.keys(block)).toEqual([
			'views',
			'conversations',
			'messages',
			'landlordReviews',
			'roomReviews',
			'follows',
			'favorites',
		]);
		expect(block.views).toEqual({
			value: 1280,
			previous: 1024,
			changePercent: 25,
		});
		expect(block.conversations).toEqual({
			value: 64,
			previous: 80,
			changePercent: -20,
		});
		expect(block.messages).toEqual({
			value: 512,
			previous: 400,
			changePercent: 28,
		});
		expect(block.roomReviews).toEqual({
			value: 14,
			previous: 11,
			changePercent: 27.3,
		});
		expect(block.favorites).toEqual({
			value: 120,
			previous: 90,
			changePercent: 33.3,
		});
	});

	it('kỳ trước bằng 0 thì changePercent là null; hai kỳ bằng nhau thì 0', () => {
		expect(block.landlordReviews).toEqual({
			value: 9,
			previous: 0,
			changePercent: null,
		});
		expect(block.follows).toEqual({
			value: 33,
			previous: 33,
			changePercent: 0,
		});
	});

	it('cả hai kỳ bằng 0 thì mọi Metric là { 0, 0, null }, không NaN, không Infinity', () => {
		const empty = toEngagementBlock({
			views: split(0, 0),
			conversations: split(0, 0),
			messages: split(0, 0),
			landlordReviews: split(0, 0),
			roomReviews: split(0, 0),
			follows: split(0, 0),
			favorites: split(0, 0),
		});
		for (const metric of Object.values(empty))
			expect(metric).toEqual({
				value: 0,
				previous: 0,
				changePercent: null,
			});
	});
});

describe('toToHandleBlock (spec 0018 AC-11)', () => {
	it('hiddenListings là hiddenByAdmin của khối tin (một lần đọc, nên luôn bằng nhau); hai số đánh giá giữ nguyên', () => {
		const counts = { visible: 10, hiddenByOwner: 3, hiddenByAdmin: 4 };
		const block = toToHandleBlock(counts, {
			hiddenLandlordReviews: 3,
			hiddenRoomReviews: 7,
		});
		expect(block).toEqual({
			hiddenListings: 4,
			hiddenLandlordReviews: 3,
			hiddenRoomReviews: 7,
		});
		expect(block.hiddenListings).toBe(
			toListingsBlock(counts, 0, split(0, 0), []).hiddenByAdmin,
		);
	});

	it('hiddenByOwner không tính vào việc cần xử lý; chỉ có đúng ba khóa, đều là số thường (không Metric, không kỳ trước)', () => {
		const block = toToHandleBlock(
			{ visible: 0, hiddenByOwner: 9, hiddenByAdmin: 0 },
			{ hiddenLandlordReviews: 0, hiddenRoomReviews: 0 },
		);
		expect(block.hiddenListings).toBe(0);
		expect(Object.keys(block)).toEqual([
			'hiddenListings',
			'hiddenLandlordReviews',
			'hiddenRoomReviews',
		]);
		for (const value of Object.values(block))
			expect(typeof value).toBe('number');
	});
});
