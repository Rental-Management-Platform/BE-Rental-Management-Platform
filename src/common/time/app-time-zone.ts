/**
 * Múi giờ của "một ngày" ở mọi nơi trong API (spec 0010): lọc theo ngày, gom theo ngày, gom theo tháng đều dùng
 * giờ Việt Nam, từ định nghĩa duy nhất này. Tên múi giờ này cũng là thứ đi vào `AT TIME ZONE` của SQL thô.
 */
export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * UTC+7. Việt Nam không đổi giờ mùa hè nên độ lệch cố định đúng cả năm; test của file này so nó với
 * `Intl.DateTimeFormat` của chính `APP_TIME_ZONE` để hai cách biểu diễn không lệch nhau.
 */
export const APP_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Nửa đêm giờ Việt Nam của ngày `year-month-day`; `day` tràn tháng thì sang tháng sau (lịch tự xử lý năm nhuận). */
function midnightOf(date: string, dayShift: number): Date {
	const match = DATE_PATTERN.exec(date);
	if (match === null) {
		throw new RangeError(
			`Ngày phải có dạng YYYY-MM-DD, nhận được ${date}.`,
		);
	}
	const [year, month, day] = [match[1], match[2], match[3]].map(Number);
	return new Date(
		Date.UTC(year, month - 1, day + dayShift) - APP_UTC_OFFSET_MS,
	);
}

/** Thời điểm 00:00:00.000 giờ Việt Nam của ngày `YYYY-MM-DD`: cận dưới (gồm) của một ngày. */
export function startOfDay(date: string): Date {
	return midnightOf(date, 0);
}

/** 00:00:00.000 giờ Việt Nam của ngày kế tiếp: cận trên (không gồm) của một ngày, so chặt `<`. */
export function startOfNextDay(date: string): Date {
	return midnightOf(date, 1);
}

/**
 * Chuỗi ISO có `Z` cho tham số của SQL thô. Không truyền thẳng `Date`: Prisma 7 với adapter pg gửi `Date` như giờ UTC
 * không kèm múi giờ nên `${date}::timestamptz` lệch theo múi giờ phiên của database (xem `publicListingCondition`).
 */
export function toSqlTimestamp(instant: Date): string {
	return instant.toISOString();
}
