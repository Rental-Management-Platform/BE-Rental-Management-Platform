import { buildMessage, ValidateBy } from 'class-validator';
import type { ValidationOptions } from 'class-validator';

/**
 * Năm nhỏ nhất và lớn nhất của một ngày lọc (spec 0010 AC-3). PostgreSQL không có năm 0 và `Date` của JavaScript có
 * biên riêng, nên không để năm lạ tới được câu SQL.
 */
export const CALENDAR_DATE_MIN_YEAR = 2000;
export const CALENDAR_DATE_MAX_YEAR = 2100;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Đúng dạng `YYYY-MM-DD`, là ngày có thật trên lịch (30/02 bị loại) và năm trong khoảng cho phép. */
export function isCalendarDate(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const match = DATE_PATTERN.exec(value);
	if (match === null) return false;
	const [year, month, day] = [match[1], match[2], match[3]].map(Number);
	if (year < CALENDAR_DATE_MIN_YEAR || year > CALENDAR_DATE_MAX_YEAR) {
		return false;
	}
	// Dựng lại từ năm, tháng, ngày rồi so: ngày tràn tháng sẽ làm lệch tháng hoặc ngày.
	const rebuilt = new Date(Date.UTC(year, month - 1, day));
	return (
		rebuilt.getUTCFullYear() === year &&
		rebuilt.getUTCMonth() === month - 1 &&
		rebuilt.getUTCDate() === day
	);
}

export function IsCalendarDate(
	validationOptions?: ValidationOptions,
): PropertyDecorator {
	return ValidateBy(
		{
			name: 'isCalendarDate',
			validator: {
				validate: (value: unknown): boolean => isCalendarDate(value),
				defaultMessage: buildMessage(
					() =>
						`Phải là ngày có thật theo dạng YYYY-MM-DD, năm từ ${CALENDAR_DATE_MIN_YEAR} đến ${CALENDAR_DATE_MAX_YEAR}.`,
					validationOptions,
				),
			},
		},
		validationOptions,
	);
}

/**
 * Ngày của trường này không được trước ngày của trường `property` cùng đối tượng (`from` lớn hơn `to` báo ở `to`).
 * Chỉ so khi cả hai là ngày hợp lệ: nếu một bên đã sai dạng thì lỗi của bên đó đã đủ, không báo thêm.
 * So chuỗi được vì `YYYY-MM-DD` có số 0 đệm nên thứ tự chữ cái bằng thứ tự thời gian.
 */
export function IsNotBeforeDate(
	property: string,
	validationOptions?: ValidationOptions,
): PropertyDecorator {
	return ValidateBy(
		{
			name: 'isNotBeforeDate',
			constraints: [property],
			validator: {
				validate: (value: unknown, args): boolean => {
					const other = (
						args?.object as Record<string, unknown> | undefined
					)?.[property];
					if (!isCalendarDate(value) || !isCalendarDate(other))
						return true;
					return value >= other;
				},
				defaultMessage: buildMessage(
					() => `Ngày không được trước ngày của trường ${property}.`,
					validationOptions,
				),
			},
		},
		validationOptions,
	);
}
