import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import {
	addDays,
	DEFAULT_STAT_DAYS,
	localDateOf,
	MAX_STAT_DAYS,
	resolveStatPeriod,
} from './stat-period';

/** Giữa trưa giờ Việt Nam ngày 16/11/2026 (05:00 UTC). */
const NOON = new Date('2026-11-16T05:00:00.000Z');

function failure(run: () => unknown): AppException {
	try {
		run();
	} catch (error: unknown) {
		if (error instanceof AppException) return error;
		throw error;
	}
	throw new Error('Đáng lẽ phải ném AppException.');
}

describe('localDateOf (spec 0017 AC-13)', () => {
	it('ngày giờ Việt Nam, đúng ở đúng mili giây ranh giới', () => {
		expect(localDateOf(new Date('2026-10-31T16:59:59.999Z'))).toBe(
			'2026-10-31',
		);
		expect(localDateOf(new Date('2026-10-31T17:00:00.000Z'))).toBe(
			'2026-11-01',
		);
	});

	it('qua ranh năm và tháng 2 năm nhuận', () => {
		expect(localDateOf(new Date('2026-12-31T17:00:00.000Z'))).toBe(
			'2027-01-01',
		);
		expect(localDateOf(new Date('2024-02-28T17:00:00.000Z'))).toBe(
			'2024-02-29',
		);
		expect(localDateOf(new Date('2024-02-29T17:00:00.000Z'))).toBe(
			'2024-03-01',
		);
	});
});

describe('addDays', () => {
	it.each([
		['2026-11-16', 0, '2026-11-16'],
		['2026-11-16', -29, '2026-10-18'],
		['2026-11-16', 1, '2026-11-17'],
		['2026-03-01', -1, '2026-02-28'],
		['2024-03-01', -1, '2024-02-29'],
		['2026-12-31', 1, '2027-01-01'],
		['2027-01-01', -1, '2026-12-31'],
		['2026-10-31', 1, '2026-11-01'],
	])('%s cộng %d ra %s', (date, days, expected) => {
		expect(addDays(date, days)).toBe(expected);
	});
});

describe('resolveStatPeriod: mặc định (spec 0017 AC-2)', () => {
	it('không gửi gì: 30 ngày kết thúc hôm nay giờ Việt Nam, kỳ trước 30 ngày liền sát trước', () => {
		const period = resolveStatPeriod({}, NOON);
		expect(period).toMatchObject({
			from: '2026-10-18',
			to: '2026-11-16',
			days: 30,
			previousFrom: '2026-09-18',
			previousTo: '2026-10-17',
			timeZone: 'Asia/Ho_Chi_Minh',
		});
		expect(DEFAULT_STAT_DAYS).toBe(30);
	});

	it('hôm nay tính theo giờ Việt Nam: một mili giây trước nửa đêm vẫn là hôm qua, đúng nửa đêm là hôm nay', () => {
		expect(
			resolveStatPeriod({}, new Date('2026-10-31T16:59:59.999Z')).to,
		).toBe('2026-10-31');
		expect(
			resolveStatPeriod({}, new Date('2026-10-31T17:00:00.000Z')).to,
		).toBe('2026-11-01');
	});

	it('chỉ gửi from: to là hôm nay', () => {
		const period = resolveStatPeriod({ from: '2026-11-01' }, NOON);
		expect(period).toMatchObject({
			from: '2026-11-01',
			to: '2026-11-16',
			days: 16,
			previousTo: '2026-10-31',
			previousFrom: '2026-10-16',
		});
	});

	it('chỉ gửi to: from là to lùi 29 ngày, không phụ thuộc hôm nay', () => {
		const period = resolveStatPeriod({ to: '2026-05-31' }, NOON);
		expect(period).toMatchObject({
			from: '2026-05-02',
			to: '2026-05-31',
			days: 30,
			previousFrom: '2026-04-02',
			previousTo: '2026-05-01',
		});
	});

	it('gửi cả hai: dùng đúng hai ngày đó, không phụ thuộc now', () => {
		const period = resolveStatPeriod(
			{ from: '2026-01-01', to: '2026-01-31' },
			NOON,
		);
		expect(period).toMatchObject({
			from: '2026-01-01',
			to: '2026-01-31',
			days: 31,
			previousFrom: '2025-12-01',
			previousTo: '2025-12-31',
		});
	});
});

describe('resolveStatPeriod: độ dài và kỳ trước (spec 0017 AC-2, AC-3)', () => {
	it('1 ngày: from bằng to, days bằng 1, kỳ trước là đúng ngày hôm trước, dates có một phần tử', () => {
		const period = resolveStatPeriod(
			{ from: '2026-11-10', to: '2026-11-10' },
			NOON,
		);
		expect(period).toMatchObject({
			from: '2026-11-10',
			to: '2026-11-10',
			days: 1,
			previousFrom: '2026-11-09',
			previousTo: '2026-11-09',
		});
		expect(period.dates).toEqual(['2026-11-10']);
	});

	it('đúng 366 ngày được nhận (năm nhuận 2024), dates đủ 366 phần tử tăng dần', () => {
		const period = resolveStatPeriod(
			{ from: '2024-01-01', to: '2024-12-31' },
			NOON,
		);
		expect(MAX_STAT_DAYS).toBe(366);
		expect(period.days).toBe(366);
		expect(period.dates).toHaveLength(366);
		expect(period.dates[0]).toBe('2024-01-01');
		expect(period.dates[365]).toBe('2024-12-31');
		expect(period.dates).toContain('2024-02-29');
		expect([...period.dates].sort()).toEqual([...period.dates]);
		expect(new Set(period.dates).size).toBe(366);
		// Kỳ trước cũng 366 ngày nên lùi tới 31/12/2022 (năm 2023 chỉ có 365 ngày).
		expect(period.previousTo).toBe('2023-12-31');
		expect(period.previousFrom).toBe('2022-12-31');
	});

	it('367 ngày bị 400 VALIDATION_FAILED ở trường to', () => {
		const error = failure(() =>
			resolveStatPeriod({ from: '2024-01-01', to: '2025-01-01' }, NOON),
		);
		expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
		expect(error.fieldErrors.map((item) => item.field)).toEqual(['to']);
	});

	it('from sau to bị 400 VALIDATION_FAILED ở trường to', () => {
		const error = failure(() =>
			resolveStatPeriod({ from: '2026-11-02', to: '2026-11-01' }, NOON),
		);
		expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
		expect(error.fieldErrors.map((item) => item.field)).toEqual(['to']);
	});

	it('chỉ gửi from ở tương lai (sau hôm nay) cũng là from sau to', () => {
		const error = failure(() =>
			resolveStatPeriod({ from: '2026-11-17' }, NOON),
		);
		expect(error.fieldErrors.map((item) => item.field)).toEqual(['to']);
	});

	it('chỉ gửi from quá xa nên vượt 366 ngày cũng bị 400 ở trường to', () => {
		const error = failure(() =>
			resolveStatPeriod({ from: '2025-01-01' }, NOON),
		);
		expect(error.fieldErrors.map((item) => item.field)).toEqual(['to']);
	});

	it('kỳ trước chạm tháng 2 năm nhuận: cùng độ dài, không chồng, không hở', () => {
		const period = resolveStatPeriod(
			{ from: '2024-03-01', to: '2024-03-31' },
			NOON,
		);
		expect(period.days).toBe(31);
		expect(period.previousTo).toBe('2024-02-29');
		expect(period.previousFrom).toBe('2024-01-30');
	});

	it('kỳ trước chạm tháng 2 năm thường', () => {
		const period = resolveStatPeriod(
			{ from: '2026-03-01', to: '2026-03-31' },
			NOON,
		);
		expect(period.previousTo).toBe('2026-02-28');
		expect(period.previousFrom).toBe('2026-01-29');
	});

	it.each([
		[{ from: '2026-10-18', to: '2026-11-16' }],
		[{ from: '2024-03-01', to: '2024-03-31' }],
		[{ from: '2026-12-25', to: '2027-01-05' }],
		[{ from: '2026-11-10', to: '2026-11-10' }],
	])('kỳ trước liền sát trước from và cùng độ dài (%j)', (query) => {
		const period = resolveStatPeriod(query, NOON);
		expect(addDays(period.previousTo, 1)).toBe(period.from);
		expect(period.previousTo < period.from).toBe(true);
		const previousLength =
			Math.round(
				(Date.parse(`${period.previousTo}T00:00:00Z`) -
					Date.parse(`${period.previousFrom}T00:00:00Z`)) /
					86_400_000,
			) + 1;
		expect(previousLength).toBe(period.days);
		expect(period.dates).toHaveLength(period.days);
		expect(period.dates[0]).toBe(period.from);
		expect(period.dates[period.days - 1]).toBe(period.to);
	});

	it('là hàm thuần: gọi lại với cùng đầu vào ra cùng kết quả', () => {
		expect(resolveStatPeriod({}, NOON)).toEqual(
			resolveStatPeriod({}, NOON),
		);
	});
});
