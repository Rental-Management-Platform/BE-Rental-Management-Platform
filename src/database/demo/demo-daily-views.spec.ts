import { APP_TIME_ZONE } from '../../common/time/app-time-zone';
import {
	buildDailyViewRows,
	splitViews,
	vietnamDayOf,
} from './demo-daily-views';
import { createRng } from './demo-images';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-23T05:00:00.000Z'); // 12:00 ngày 23/10 giờ Việt Nam

/** Bộ sinh số trả lần lượt các giá trị đã cho (quay vòng), để dựng trọng số biết trước. */
function sequence(...values: number[]): () => number {
	let index = 0;
	return () => values[index++ % values.length];
}

const sum = (values: readonly number[]): number =>
	values.reduce((total, value) => total + value, 0);

describe('vietnamDayOf: ngày lịch giờ Việt Nam, dạng nửa đêm UTC của cột date', () => {
	it.each([
		['2026-10-22T16:59:59.999Z', '2026-10-22'],
		['2026-10-22T17:00:00.000Z', '2026-10-23'],
		['2026-10-23T00:00:00.000Z', '2026-10-23'],
		['2026-10-23T16:59:59.999Z', '2026-10-23'],
		['2026-12-31T16:59:59.999Z', '2026-12-31'],
		['2026-12-31T17:00:00.000Z', '2027-01-01'],
		['2028-02-28T17:00:00.000Z', '2028-02-29'],
		['2028-02-29T17:00:00.000Z', '2028-03-01'],
	])('%s ra ngày %s', (instant, expected) => {
		const day = vietnamDayOf(new Date(instant));
		expect(day.toISOString()).toBe(`${expected}T00:00:00.000Z`);
	});

	it('khớp Intl.DateTimeFormat của APP_TIME_ZONE trên 400 thời điểm rải đều hai năm', () => {
		const format = new Intl.DateTimeFormat('en-CA', {
			timeZone: APP_TIME_ZONE,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		});
		const start = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
		for (let step = 0; step < 400; step += 1) {
			const instant = new Date(start + step * 1_823_456_789);
			expect(vietnamDayOf(instant).toISOString().slice(0, 10)).toBe(
				format.format(instant),
			);
		}
	});
});

describe('splitViews: chia lượt xem theo trọng số, làm tròn theo phần dư lớn nhất', () => {
	it('trọng số bằng nhau: phần dư dồn cho ngày sớm hơn trước', () => {
		expect(splitViews(10, 3, () => 0)).toEqual([4, 3, 3]);
	});

	it('trọng số khác nhau: ngày có phần dư lớn nhất nhận lượt còn thiếu', () => {
		// Trọng số 1 và 11, tổng 12: phần nguyên 0 và 6, phần dư 7 và 5, còn thiếu 1 lượt cho ngày có phần dư 7.
		expect(splitViews(7, 2, sequence(0, 0.5))).toEqual([1, 6]);
	});

	it('ít lượt hơn số ngày thì một số ngày ra 0', () => {
		expect(splitViews(2, 3, () => 0)).toEqual([1, 1, 0]);
	});

	it('không có lượt nào thì mọi ngày ra 0', () => {
		expect(splitViews(0, 5, createRng(1))).toEqual([0, 0, 0, 0, 0]);
	});

	it('tổng luôn đúng bằng số lượt, mỗi phần là số nguyên không âm, đủ số ngày', () => {
		for (const total of [0, 1, 2, 3, 7, 50, 999, 1500]) {
			for (const days of [1, 2, 5, 31, 184]) {
				for (const seed of [1, 2, 3, 20261116]) {
					const parts = splitViews(total, days, createRng(seed));
					expect(parts).toHaveLength(days);
					expect(sum(parts)).toBe(total);
					for (const part of parts) {
						expect(Number.isInteger(part)).toBe(true);
						expect(part).toBeGreaterThanOrEqual(0);
					}
				}
			}
		}
	});

	it('mỗi ngày lệch khỏi phần chia đúng dưới 1 lượt (không dồn phần dư vào một ngày)', () => {
		const total = 1234;
		const days = 60;
		const parts = splitViews(total, days, createRng(7));
		// Dựng lại đúng trọng số: cùng hạt giống, cùng công thức 1 + floor(r * 20).
		const replay = createRng(7);
		const weights = Array.from(
			{ length: days },
			() => 1 + Math.floor(replay() * 20),
		);
		const weightSum = sum(weights);
		parts.forEach((part, index) => {
			const exact = (total * weights[index]) / weightSum;
			expect(Math.abs(part - exact)).toBeLessThan(1);
		});
	});

	it('cùng hạt giống cho cùng kết quả, hạt giống khác cho cách chia khác', () => {
		const first = splitViews(1000, 30, createRng(5));
		expect(splitViews(1000, 30, createRng(5))).toEqual(first);
		expect(splitViews(1000, 30, createRng(6))).not.toEqual(first);
	});

	it('từ chối số lượt hay số ngày không hợp lệ', () => {
		expect(() => splitViews(-1, 3, () => 0)).toThrow(RangeError);
		expect(() => splitViews(1.5, 3, () => 0)).toThrow(RangeError);
		expect(() => splitViews(10, 0, () => 0)).toThrow(RangeError);
		expect(() => splitViews(10, 2.5, () => 0)).toThrow(RangeError);
	});
});

describe('buildDailyViewRows: dòng lượt xem theo ngày của tin demo (spec 0016 AC-8)', () => {
	const listing = (id: string, createdAt: string, viewCount: number) => ({
		id,
		createdAt: new Date(createdAt),
		viewCount,
	});

	it('tổng mỗi tin bằng view_count, ngày chạy từ ngày tạo tin đến hôm nay giờ Việt Nam, mỗi dòng views lớn hơn 0', () => {
		const rows = buildDailyViewRows(
			[listing('a', '2026-10-20T10:00:00.000Z', 100)],
			NOW,
			createRng(3),
		);
		expect(sum(rows.map((row) => row.views))).toBe(100);
		const days = rows.map((row) => (row.day as Date).getTime());
		const first = Date.UTC(2026, 9, 20);
		const last = Date.UTC(2026, 9, 23);
		for (const day of days) {
			expect(day).toBeGreaterThanOrEqual(first);
			expect(day).toBeLessThanOrEqual(last);
			expect((day - first) % DAY_MS).toBe(0);
		}
		for (const row of rows) expect(row.views).toBeGreaterThan(0);
		// 100 lượt trên 4 ngày: cả bốn ngày đều có dòng.
		expect(new Set(days).size).toBe(4);
	});

	it('tin có view_count bằng 0 không có dòng nào', () => {
		expect(
			buildDailyViewRows(
				[listing('zero', '2026-10-01T00:00:00.000Z', 0)],
				NOW,
				createRng(3),
			),
		).toEqual([]);
	});

	it('tin tạo trong chính ngày hôm nay: một dòng duy nhất mang cả view_count', () => {
		const rows = buildDailyViewRows(
			[listing('today', NOW.toISOString(), 5)],
			NOW,
			createRng(3),
		);
		expect(rows).toEqual([
			{
				listingId: 'today',
				day: new Date('2026-10-23T00:00:00.000Z'),
				views: 5,
			},
		]);
	});

	it('ngày tạo tính theo giờ Việt Nam: 16:59:59.999Z còn thuộc ngày trước, 17:00:00.000Z sang ngày sau', () => {
		const before = buildDailyViewRows(
			[listing('before', '2026-10-22T16:59:59.999Z', 40)],
			NOW,
			createRng(3),
		);
		const after = buildDailyViewRows(
			[listing('after', '2026-10-22T17:00:00.000Z', 40)],
			NOW,
			createRng(3),
		);
		const earliest = (rows: typeof before): number =>
			Math.min(...rows.map((row) => (row.day as Date).getTime()));
		expect(earliest(before)).toBe(Date.UTC(2026, 9, 22));
		expect(earliest(after)).toBe(Date.UTC(2026, 9, 23));
		expect(sum(before.map((row) => row.views))).toBe(40);
		expect(sum(after.map((row) => row.views))).toBe(40);
	});

	it('ít lượt hơn số ngày: ngày không có lượt không có dòng, tổng vẫn đúng', () => {
		const rows = buildDailyViewRows(
			[listing('thin', '2026-09-23T05:00:00.000Z', 2)], // 31 ngày
			NOW,
			createRng(3),
		);
		expect(sum(rows.map((row) => row.views))).toBe(2);
		expect(rows.length).toBeLessThanOrEqual(2);
		for (const row of rows) expect(row.views).toBeGreaterThan(0);
	});

	it('nhiều tin: mỗi cặp (tin, ngày) một dòng, mỗi tin đúng tổng của nó', () => {
		const listings = [
			listing('a', '2026-08-01T03:00:00.000Z', 300),
			listing('b', '2026-10-10T03:00:00.000Z', 0),
			listing('c', '2026-07-15T21:00:00.000Z', 1500),
			listing('d', '2026-10-23T01:00:00.000Z', 9),
		];
		const rows = buildDailyViewRows(listings, NOW, createRng(11));
		const pairs = rows.map(
			(row) => `${row.listingId}|${(row.day as Date).toISOString()}`,
		);
		expect(new Set(pairs).size).toBe(pairs.length);
		for (const item of listings) {
			expect(
				sum(
					rows
						.filter((row) => row.listingId === item.id)
						.map((row) => row.views),
				),
			).toBe(item.viewCount);
		}
	});

	it('tin tạo sau thời điểm chạy thì báo lỗi rõ, không dựng nửa chừng', () => {
		expect(() =>
			buildDailyViewRows(
				[listing('future', '2026-10-25T00:00:00.000Z', 3)],
				NOW,
				createRng(3),
			),
		).toThrow(/sau thời điểm chạy/);
	});
});
