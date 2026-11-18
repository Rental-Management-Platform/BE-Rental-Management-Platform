import { resolveStatPeriod } from './stat-period';
import {
	splitByPeriod,
	toListingBuckets,
	toPeriodResponse,
	toRatingBlock,
	toSeries,
} from './statistics.mapper';

const NOON = new Date('2026-11-16T05:00:00.000Z');
const PERIOD = resolveStatPeriod(
	{ from: '2026-11-10', to: '2026-11-16' },
	NOON,
);
// Kỳ này 10 đến 16/11 (7 ngày), kỳ trước 3 đến 9/11.

describe('toListingBuckets (spec 0017 AC-4)', () => {
	const counts = {
		visible: 5,
		hiddenByOwner: 2,
		hiddenByAdmin: 1,
		viewCountAllTime: 0,
	};

	it('vượt hạn mức: hiddenByQuota là phần dư, public bằng hạn mức', () => {
		expect(toListingBuckets(counts, 3)).toEqual({
			total: 8,
			public: 3,
			hiddenByQuota: 2,
			hiddenByOwner: 2,
			hiddenByAdmin: 1,
		});
	});

	it('hạn mức bằng số tin visible: không tin nào bị ẩn bớt', () => {
		expect(toListingBuckets(counts, 5)).toMatchObject({
			public: 5,
			hiddenByQuota: 0,
		});
	});

	it('hạn mức lớn hơn số tin visible: hiddenByQuota không bao giờ âm', () => {
		const result = toListingBuckets(counts, 100);
		expect(result).toMatchObject({ public: 5, hiddenByQuota: 0 });
		expect(result.total).toBe(8);
	});

	it('hạn mức 0 (hết dùng thử, không gói): mọi tin visible là hiddenByQuota', () => {
		expect(toListingBuckets(counts, 0)).toEqual({
			total: 8,
			public: 0,
			hiddenByQuota: 5,
			hiddenByOwner: 2,
			hiddenByAdmin: 1,
		});
	});

	it.each([0, 1, 2, 3, 5, 6, 50])(
		'total luôn bằng tổng bốn bucket và public + hiddenByQuota bằng số tin visible (hạn mức %d)',
		(limit) => {
			const result = toListingBuckets(counts, limit);
			expect(
				result.public +
					result.hiddenByQuota +
					result.hiddenByOwner +
					result.hiddenByAdmin,
			).toBe(result.total);
			expect(result.public + result.hiddenByQuota).toBe(counts.visible);
		},
	);

	it('chủ trọ chưa có tin: mọi bucket là 0', () => {
		expect(
			toListingBuckets(
				{
					visible: 0,
					hiddenByOwner: 0,
					hiddenByAdmin: 0,
					viewCountAllTime: 0,
				},
				2,
			),
		).toEqual({
			total: 0,
			public: 0,
			hiddenByQuota: 0,
			hiddenByOwner: 0,
			hiddenByAdmin: 0,
		});
	});
});

describe('splitByPeriod (spec 0017 AC-3, AC-6, AC-12)', () => {
	it('tách đúng theo hai kỳ, hai đầu mỗi kỳ đều tính', () => {
		const split = splitByPeriod(
			[
				{ day: '2026-11-03', count: 4 }, // đầu kỳ trước
				{ day: '2026-11-09', count: 6 }, // cuối kỳ trước
				{ day: '2026-11-10', count: 1 }, // đầu kỳ này
				{ day: '2026-11-16', count: 9 }, // cuối kỳ này
			],
			PERIOD,
		);
		expect(split.previous).toBe(10);
		expect(split.value).toBe(10);
		expect([...split.byDate]).toEqual([
			['2026-11-10', 1],
			['2026-11-16', 9],
		]);
	});

	it('không có dòng nào: hai số bằng 0 và không có ngày nào', () => {
		const split = splitByPeriod([], PERIOD);
		expect(split.value).toBe(0);
		expect(split.previous).toBe(0);
		expect(split.byDate.size).toBe(0);
	});

	it('dòng ngoài cả hai kỳ bị bỏ, không lọt vào số nào', () => {
		const split = splitByPeriod(
			[
				{ day: '2026-11-02', count: 50 },
				{ day: '2026-11-17', count: 70 },
			],
			PERIOD,
		);
		expect(split.value).toBe(0);
		expect(split.previous).toBe(0);
	});
});

const NO_DAYS: ReadonlyMap<string, number> = new Map();
const columns = (views: ReadonlyMap<string, number>) => ({
	views,
	newFavorites: NO_DAYS,
	newFollowers: NO_DAYS,
	newConversations: NO_DAYS,
});

describe('toSeries (spec 0017 AC-12)', () => {
	it('đủ days phần tử, ngày tăng dần, ngày không có lượt thì 0', () => {
		const series = toSeries(PERIOD, columns(new Map([['2026-11-12', 5]])));
		expect(series).toHaveLength(7);
		expect(series.map((point) => point.date)).toEqual([
			'2026-11-10',
			'2026-11-11',
			'2026-11-12',
			'2026-11-13',
			'2026-11-14',
			'2026-11-15',
			'2026-11-16',
		]);
		expect(series.map((point) => point.views)).toEqual([
			0, 0, 5, 0, 0, 0, 0,
		]);
	});

	it('tổng cột views bằng value của kỳ này vì cùng một tập dòng', () => {
		const split = splitByPeriod(
			[
				{ day: '2026-11-09', count: 8 },
				{ day: '2026-11-10', count: 2 },
				{ day: '2026-11-14', count: 3 },
			],
			PERIOD,
		);
		const total = toSeries(PERIOD, columns(split.byDate)).reduce(
			(sum, point) => sum + point.views,
			0,
		);
		expect(total).toBe(split.value);
		expect(total).toBe(5);
	});

	it('khoảng 1 ngày ra 1 phần tử, đủ năm khóa và mọi số bằng 0', () => {
		const one = resolveStatPeriod(
			{ from: '2026-11-16', to: '2026-11-16' },
			NOON,
		);
		expect(toSeries(one, columns(NO_DAYS))).toEqual([
			{
				date: '2026-11-16',
				views: 0,
				newFavorites: 0,
				newFollowers: 0,
				newConversations: 0,
			},
		]);
	});

	it('bốn cột độc lập: mỗi cột lấy đúng bản đồ ngày của nó, ngày thiếu ở cột nào thì cột đó là 0 (spec 0017 AC-12)', () => {
		const series = toSeries(PERIOD, {
			views: new Map([['2026-11-10', 4]]),
			newFavorites: new Map([['2026-11-11', 2]]),
			newFollowers: new Map([['2026-11-12', 7]]),
			newConversations: new Map([['2026-11-10', 1]]),
		});
		expect(series[0]).toEqual({
			date: '2026-11-10',
			views: 4,
			newFavorites: 0,
			newFollowers: 0,
			newConversations: 1,
		});
		expect(series[1]).toMatchObject({ newFavorites: 2, views: 0 });
		expect(series[2]).toMatchObject({ newFollowers: 7, views: 0 });
		expect(Object.keys(series[0] ?? {})).toEqual([
			'date',
			'views',
			'newFavorites',
			'newFollowers',
			'newConversations',
		]);
	});

	it('tổng của từng cột bằng value của lần tách kỳ cùng nguồn, kể cả khi kỳ trước có dòng (spec 0017 AC-12)', () => {
		const rows = (counts: [string, number][]) =>
			splitByPeriod(
				counts.map(([day, count]) => ({ day, count })),
				PERIOD,
			);
		const favorites = rows([
			['2026-11-05', 9], // kỳ trước: không vào chuỗi
			['2026-11-10', 1],
			['2026-11-16', 2],
		]);
		const conversations = rows([
			['2026-11-12', 3],
			['2026-11-13', 4],
		]);
		const series = toSeries(PERIOD, {
			views: NO_DAYS,
			newFavorites: favorites.byDate,
			newFollowers: NO_DAYS,
			newConversations: conversations.byDate,
		});
		const sum = (key: 'newFavorites' | 'newConversations') =>
			series.reduce((total, point) => total + point[key], 0);
		expect(sum('newFavorites')).toBe(favorites.value);
		expect(sum('newFavorites')).toBe(3);
		expect(favorites.previous).toBe(9);
		expect(sum('newConversations')).toBe(conversations.value);
		expect(sum('newConversations')).toBe(7);
	});
});

describe('toRatingBlock (spec 0017 AC-9)', () => {
	const none = splitByPeriod([], PERIOD);

	it('chưa có đánh giá nào: average là null, count 0, newInRange toàn 0 và changePercent null', () => {
		expect(toRatingBlock({ count: 0, starSum: 0 }, none)).toEqual({
			average: null,
			count: 0,
			newInRange: { value: 0, previous: 0, changePercent: null },
		});
	});

	it('average dùng averageStars bằng số nguyên: 87 sao trên 20 đánh giá ra 4.4 (nửa làm tròn lên, không phải 4.3)', () => {
		expect(toRatingBlock({ count: 20, starSum: 87 }, none).average).toBe(
			4.4,
		);
		expect(toRatingBlock({ count: 12, starSum: 55 }, none).average).toBe(
			4.6,
		);
		expect(toRatingBlock({ count: 1, starSum: 5 }, none).average).toBe(5);
	});

	it('newInRange là Metric của đánh giá mới trong kỳ so với kỳ trước, độc lập với count và average', () => {
		const split = splitByPeriod(
			[
				{ day: '2026-11-04', count: 4 },
				{ day: '2026-11-11', count: 5 },
			],
			PERIOD,
		);
		expect(toRatingBlock({ count: 20, starSum: 84 }, split)).toEqual({
			average: 4.2,
			count: 20,
			newInRange: { value: 5, previous: 4, changePercent: 25 },
		});
	});
});

describe('toPeriodResponse (spec 0017 AC-2)', () => {
	it('trả đúng sáu trường của period và không lộ danh sách dates', () => {
		expect(toPeriodResponse(PERIOD)).toEqual({
			from: '2026-11-10',
			to: '2026-11-16',
			days: 7,
			previousFrom: '2026-11-03',
			previousTo: '2026-11-09',
			timeZone: 'Asia/Ho_Chi_Minh',
		});
	});
});
