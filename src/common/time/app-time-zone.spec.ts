import {
	APP_TIME_ZONE,
	APP_UTC_OFFSET_MS,
	startOfDay,
	startOfNextDay,
	toSqlTimestamp,
} from './app-time-zone';

/** Giờ treo tường của một thời điểm ở `APP_TIME_ZONE`, đọc từ `Intl` rồi dựng lại như giờ UTC để so. */
function wallClockMs(instant: Date): number {
	const parts = new Intl.DateTimeFormat('en-CA', {
		timeZone: APP_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23',
	}).formatToParts(instant);
	const part = (type: string): number =>
		Number(parts.find((item) => item.type === type)?.value);
	return Date.UTC(
		part('year'),
		part('month') - 1,
		part('day'),
		part('hour'),
		part('minute'),
		part('second'),
		instant.getUTCMilliseconds(),
	);
}

describe('APP_UTC_OFFSET_MS (spec 0010 AC-3, AC-8)', () => {
	it.each([
		'2000-01-01T00:00:00.000Z',
		'2026-01-15T12:34:56.789Z',
		'2026-07-01T00:00:00.000Z',
		'2026-10-31T17:30:00.000Z',
		'2099-12-31T23:59:59.999Z',
	])('khớp độ lệch của Intl cho %s (không đổi giờ mùa hè)', (iso) => {
		const instant = new Date(iso);
		expect(wallClockMs(instant) - instant.getTime()).toBe(
			APP_UTC_OFFSET_MS,
		);
	});

	it('là đúng bảy giờ', () => {
		expect(APP_UTC_OFFSET_MS).toBe(25_200_000);
	});
});

describe('startOfDay và startOfNextDay (spec 0010 AC-3)', () => {
	it('00:00 giờ Việt Nam của ngày 01/11 là 17:00Z của ngày 31/10', () => {
		expect(startOfDay('2026-11-01').toISOString()).toBe(
			'2026-10-31T17:00:00.000Z',
		);
	});

	it('cận trên của ngày 31/10 là cận dưới của ngày 01/11, nên mili giây 23:59:59.999 vào và 00:00:00.000 kế tiếp thì không', () => {
		const upper = startOfNextDay('2026-10-31');
		expect(upper.getTime()).toBe(startOfDay('2026-11-01').getTime());
		const lastMs = new Date('2026-10-31T16:59:59.999Z'); // 23:59:59.999 ngày 31/10 giờ Việt Nam
		const firstMsOfNextDay = new Date('2026-10-31T17:00:00.000Z');
		expect(lastMs.getTime()).toBeLessThan(upper.getTime());
		expect(firstMsOfNextDay.getTime()).not.toBeLessThan(upper.getTime());
	});

	it.each(['2000-01-01', '2024-02-29', '2026-10-21', '2100-12-31'])(
		'startOfDay(%s) đọc lại bằng Intl ra đúng 00:00:00.000 của ngày đó',
		(date) => {
			const midnight = startOfDay(date);
			expect(new Date(wallClockMs(midnight)).toISOString()).toBe(
				`${date}T00:00:00.000Z`,
			);
		},
	);

	it.each([
		['2024-02-28', '2024-02-28T17:00:00.000Z'], // năm nhuận: 28 sang 29 tháng 2
		['2024-02-29', '2024-02-29T17:00:00.000Z'], // 29/02 sang 01/03
		['2026-02-28', '2026-02-28T17:00:00.000Z'], // năm thường: 28/02 sang 01/03
		['2026-12-31', '2026-12-31T17:00:00.000Z'], // cuối năm sang 01/01
		['2026-04-30', '2026-04-30T17:00:00.000Z'], // tháng 30 ngày
	])('startOfNextDay(%s) là %s', (date, expected) => {
		expect(startOfNextDay(date).toISOString()).toBe(expected);
	});

	it('mỗi ngày dài đúng 24 giờ ở mọi thời điểm của năm', () => {
		for (const date of ['2026-03-08', '2026-10-25', '2026-11-01']) {
			expect(
				startOfNextDay(date).getTime() - startOfDay(date).getTime(),
			).toBe(24 * 60 * 60 * 1000);
		}
	});

	it.each(['2026-1-1', '26-10-21', '2026/10/21', '', 'hôm nay'])(
		'từ chối chuỗi sai dạng %j bằng RangeError',
		(value) => {
			expect(() => startOfDay(value)).toThrow(RangeError);
			expect(() => startOfNextDay(value)).toThrow(RangeError);
		},
	);
});

describe('toSqlTimestamp', () => {
	it('luôn có Z ở cuối dù múi giờ tiến trình là gì', () => {
		expect(toSqlTimestamp(new Date('2026-10-31T17:00:00.000Z'))).toBe(
			'2026-10-31T17:00:00.000Z',
		);
	});
});
