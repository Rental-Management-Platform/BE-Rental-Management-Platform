import type {
	ListingBucketsResponse,
	SeriesPointResponse,
	StatisticsPeriodResponse,
	TopListingResponse,
} from './dto/statistics.response';
import type {
	DailyCount,
	ListingCounts,
	TopListingRow,
} from './statistics.repository';
import type { ResolvedStatPeriod } from './stat-period';

/** Phần `period` của phản hồi: bỏ danh sách `dates` chỉ dùng để dựng chuỗi. */
export function toPeriodResponse(
	period: ResolvedStatPeriod,
): StatisticsPeriodResponse {
	return {
		from: period.from,
		to: period.to,
		days: period.days,
		previousFrom: period.previousFrom,
		previousTo: period.previousTo,
		timeZone: period.timeZone,
	};
}

/**
 * Bốn bucket của tin chưa xóa mềm (spec 0017 AC-4). Tin `visible` chia thành `public` và `hiddenByQuota`:
 * `hiddenByQuota = max(0, visible − hạn mức)`, `public = visible − hiddenByQuota`. Hạn mức 0 (hết dùng thử, không gói)
 * thì mọi tin `visible` là `hiddenByQuota`. `total` là tổng đúng bốn số trả ra nên luôn khớp.
 */
export function toListingBuckets(
	counts: ListingCounts,
	listingLimit: number,
): ListingBucketsResponse {
	const hiddenByQuota = Math.max(0, counts.visible - listingLimit);
	const publicCount = counts.visible - hiddenByQuota;
	return {
		total:
			publicCount +
			hiddenByQuota +
			counts.hiddenByOwner +
			counts.hiddenByAdmin,
		public: publicCount,
		hiddenByQuota,
		hiddenByOwner: counts.hiddenByOwner,
		hiddenByAdmin: counts.hiddenByAdmin,
	};
}

/** Số của hai kỳ, và từng ngày của kỳ này (để dựng chuỗi), tách từ MỘT tập dòng theo ngày. */
export interface PeriodSplit {
	readonly value: number;
	readonly previous: number;
	readonly byDate: ReadonlyMap<string, number>;
}

/**
 * Tách các dòng theo ngày của khoảng `[previousFrom, to]` thành số của kỳ này và kỳ trước (spec 0017 AC-3, AC-12). So
 * chuỗi `YYYY-MM-DD` được vì có số 0 đệm. Chuỗi theo ngày và `value` đến từ cùng các dòng nên tổng cột luôn bằng
 * `value`. Dòng nằm ngoài cả hai kỳ (không xảy ra với truy vấn đúng) bị bỏ.
 */
export function splitByPeriod(
	rows: readonly DailyCount[],
	period: ResolvedStatPeriod,
): PeriodSplit {
	let value = 0;
	let previous = 0;
	const byDate = new Map<string, number>();
	for (const row of rows) {
		if (row.day >= period.from && row.day <= period.to) {
			value += row.count;
			byDate.set(row.day, (byDate.get(row.day) ?? 0) + row.count);
		} else if (
			row.day >= period.previousFrom &&
			row.day <= period.previousTo
		) {
			previous += row.count;
		}
	}
	return { value, previous, byDate };
}

/** Chuỗi theo ngày đủ `days` phần tử, mỗi ngày từ `from` đến `to`, ngày không có lượt thì 0 (spec 0017 AC-12). */
export function toSeries(
	period: ResolvedStatPeriod,
	views: ReadonlyMap<string, number>,
): SeriesPointResponse[] {
	return period.dates.map((date) => ({ date, views: views.get(date) ?? 0 }));
}

export function toTopListing(row: TopListingRow): TopListingResponse {
	return {
		id: row.id,
		code: row.code,
		title: row.title,
		status: row.status,
		isPublic: row.isPublic,
		viewsInRange: row.viewsInRange,
		viewsAllTime: row.viewsAllTime,
	};
}
