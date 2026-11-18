import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import {
	APP_TIME_ZONE,
	APP_UTC_OFFSET_MS,
	startOfDay,
} from '../common/time/app-time-zone';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Số ngày của khoảng mặc định, kết thúc hôm nay (spec 0017 AC-2). */
export const DEFAULT_STAT_DAYS = 30;

/** Khoảng dài nhất được hỏi, tính cả hai đầu (spec 0017 AC-2). */
export const MAX_STAT_DAYS = 366;

/** Hai ngày lọc của query, đã qua kiểm từng trường ở DTO. */
export interface StatPeriodQuery {
	readonly from?: string;
	readonly to?: string;
}

/**
 * Khoảng ngày đã chốt (spec 0017 AC-2, AC-3): mọi ngày là ngày lịch giờ Việt Nam, `YYYY-MM-DD`. `from`, `to`, `days`,
 * `previousFrom`, `previousTo` và `timeZone` là phần `period` của phản hồi; `dates` là từng ngày từ `from` đến `to`
 * (đúng `days` phần tử, tăng dần) để điền chuỗi theo ngày, không có trong phản hồi.
 */
export interface ResolvedStatPeriod {
	readonly from: string;
	readonly to: string;
	readonly days: number;
	readonly previousFrom: string;
	readonly previousTo: string;
	readonly timeZone: string;
	readonly dates: readonly string[];
}

/** Ngày lịch giờ Việt Nam của một thời điểm. UTC+7 cố định (không đổi giờ mùa hè) nên cộng độ lệch rồi đọc ngày UTC. */
export function localDateOf(instant: Date): string {
	return new Date(instant.getTime() + APP_UTC_OFFSET_MS)
		.toISOString()
		.slice(0, 10);
}

/** Ngày cách `date` đúng `days` ngày lịch (âm là lùi), qua nửa đêm giờ Việt Nam; lịch tự xử lý tháng và năm nhuận. */
export function addDays(date: string, days: number): string {
	return localDateOf(new Date(startOfDay(date).getTime() + days * DAY_MS));
}

/** Số ngày lịch từ `from` đến `to` tính cả hai đầu; âm hay 0 khi `to` trước `from`. */
function countDays(from: string, to: string): number {
	return (
		Math.round(
			(startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS,
		) + 1
	);
}

function invalidTo(code: string, message: string): AppException {
	return new AppException(ErrorCode.VALIDATION_FAILED, [
		{ field: 'to', code, message },
	]);
}

/**
 * Chốt khoảng ngày của `GET /me/statistics` (spec 0017 AC-2, AC-3, AC-13). Không gửi `to` thì `to` là ngày hôm nay giờ
 * Việt Nam của `now` (cả ngày dù mới qua một phần); không gửi `from` thì `from` là `to` lùi 29 ngày. `from` sau `to`
 * hay quá 366 ngày là 400 `VALIDATION_FAILED` ở trường `to`. Kỳ trước là `days` ngày liền sát trước `from`: cùng độ
 * dài, không chồng, không hở. Hàm thuần: `now` do nơi gọi truyền xuống, một đồng hồ mỗi request.
 */
export function resolveStatPeriod(
	query: StatPeriodQuery,
	now: Date,
): ResolvedStatPeriod {
	const to = query.to ?? localDateOf(now);
	const from = query.from ?? addDays(to, -(DEFAULT_STAT_DAYS - 1));
	const days = countDays(from, to);
	if (days < 1) {
		throw invalidTo(
			'toBeforeFrom',
			'Ngày kết thúc không được trước ngày bắt đầu.',
		);
	}
	if (days > MAX_STAT_DAYS) {
		throw invalidTo(
			'rangeTooLong',
			`Khoảng ngày không được dài quá ${MAX_STAT_DAYS} ngày.`,
		);
	}
	const previousTo = addDays(from, -1);
	return {
		from,
		to,
		days,
		previousFrom: addDays(previousTo, -(days - 1)),
		previousTo,
		timeZone: APP_TIME_ZONE,
		dates: Array.from({ length: days }, (_, index) => addDays(from, index)),
	};
}
