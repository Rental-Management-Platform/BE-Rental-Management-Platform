import { APP_UTC_OFFSET_MS } from '../../common/time/app-time-zone';
import type { Prisma } from '../../generated/prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Trọng số mỗi ngày là số nguyên từ 1 đến 20, để mọi phép chia và phần dư bên dưới đều là số nguyên chính xác. */
const MAX_WEIGHT = 20;

/** Một tin demo như `buildDemoRows` đã dựng, đủ để chia lượt xem ra từng ngày. */
export interface DailyViewSource {
	readonly id: string;
	readonly createdAt: Date;
	readonly viewCount: number;
}

/**
 * Ngày lịch giờ Việt Nam (`APP_TIME_ZONE`) của một thời điểm, dưới dạng nửa đêm UTC của ngày đó: đúng giá trị mà cột
 * `date` của Postgres lưu. Việt Nam không đổi giờ mùa hè nên độ lệch cố định `APP_UTC_OFFSET_MS` đúng cả năm.
 */
export function vietnamDayOf(instant: Date): Date {
	const shifted = instant.getTime() + APP_UTC_OFFSET_MS;
	return new Date(Math.floor(shifted / DAY_MS) * DAY_MS);
}

/**
 * Chia `total` lượt xem cho `dayCount` ngày theo trọng số lấy từ `rng`, làm tròn theo phần dư lớn nhất để tổng đúng bằng
 * `total` (spec 0016 AC-8). Mọi phép tính là số nguyên: phần nguyên là `total * trọng số / tổng trọng số`, phần dư là số
 * dư của phép chia đó; số lượt còn thiếu được cộng 1 cho các ngày có phần dư lớn nhất, bằng nhau thì ngày sớm hơn trước.
 * Một ngày có thể ra 0 khi `total` nhỏ hơn số ngày; người gọi bỏ các ngày đó, vì một dòng chỉ tồn tại khi ngày có lượt.
 */
export function splitViews(
	total: number,
	dayCount: number,
	rng: () => number,
): number[] {
	if (!Number.isInteger(total) || total < 0) {
		throw new RangeError(
			`Số lượt xem phải là số nguyên không âm: ${total}.`,
		);
	}
	if (!Number.isInteger(dayCount) || dayCount < 1) {
		throw new RangeError(`Số ngày phải là số nguyên từ 1: ${dayCount}.`);
	}
	const weights = Array.from(
		{ length: dayCount },
		() => 1 + Math.floor(rng() * MAX_WEIGHT),
	);
	const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
	const shares = weights.map((weight) => total * weight);
	const remainders = shares.map((share) => share % weightSum);
	const parts = shares.map(
		(share, index) => (share - remainders[index]) / weightSum,
	);
	const leftover = total - parts.reduce((sum, part) => sum + part, 0);
	const byRemainder = parts
		.map((_, index) => index)
		.sort((a, b) => remainders[b] - remainders[a] || a - b);
	for (let rank = 0; rank < leftover; rank += 1) {
		parts[byRemainder[rank]] += 1;
	}
	return parts;
}

/**
 * Dòng `listing_daily_views` cho các tin demo (spec 0016 AC-8): với mỗi tin có `viewCount` lớn hơn 0, chia `viewCount`
 * ra các ngày giờ Việt Nam từ ngày tạo tin đến ngày của `now` (cùng gồm), chỉ giữ ngày có ít nhất một lượt, nên tổng
 * `views` của tin đúng bằng `viewCount` của nó. Tin có `viewCount` bằng 0 không có dòng nào. `rng` phải là bộ sinh số
 * riêng của bước này, không phải bộ dùng chung của `buildDemoRows`, để không đổi số nào của các hàng khác.
 */
export function buildDailyViewRows(
	listings: readonly DailyViewSource[],
	now: Date,
	rng: () => number,
): Prisma.ListingDailyViewCreateManyInput[] {
	const today = vietnamDayOf(now).getTime();
	const result: Prisma.ListingDailyViewCreateManyInput[] = [];
	for (const listing of listings) {
		if (listing.viewCount === 0) continue;
		const first = vietnamDayOf(listing.createdAt).getTime();
		const dayCount = Math.round((today - first) / DAY_MS) + 1;
		if (dayCount < 1) {
			throw new RangeError(
				`Tin ${listing.id} được tạo sau thời điểm chạy, không có ngày nào để chia lượt xem.`,
			);
		}
		splitViews(listing.viewCount, dayCount, rng).forEach(
			(views, offset) => {
				if (views > 0) {
					result.push({
						listingId: listing.id,
						day: new Date(first + offset * DAY_MS),
						views,
					});
				}
			},
		);
	}
	return result;
}
