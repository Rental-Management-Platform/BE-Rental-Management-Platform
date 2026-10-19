export interface SettingDefinition {
	/** Giá trị nhỏ nhất được phép (số nguyên). */
	readonly min: number;
	/** Giá trị lớn nhất được phép (số nguyên). */
	readonly max: number;
	/** Dùng khi dòng thiếu hoặc hỏng, và là giá trị seed thêm vào. */
	readonly defaultValue: number;
}

/**
 * Danh mục tham số hệ thống (spec 0003 dùng thử). Khóa nằm trong code vì mỗi khóa phải có đoạn code đọc nó;
 * bảng `settings` chỉ giữ giá trị. Thêm tham số mới: thêm một dòng ở đây, seed tự thêm dòng mặc định.
 */
export const SETTING_DEFINITIONS = {
	/** Số ngày dùng thử của chủ trọ đăng ký SAU khi đổi. `0` là hết dùng thử ngay lúc đăng ký (dựng cảnh demo). */
	trial_days: { min: 0, max: 365, defaultValue: 30 },
	/** Số tin đang hiện tối đa trong kỳ dùng thử, áp ngay cho mọi chủ trọ còn trong kỳ. */
	trial_listing_limit: { min: 0, max: 100, defaultValue: 2 },
} as const satisfies Record<string, SettingDefinition>;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

/** Thứ tự khai báo ở trên cũng là thứ tự liệt kê của `GET /settings`. */
export const SETTING_KEYS: readonly SettingKey[] = [
	'trial_days',
	'trial_listing_limit',
];

export function isSettingKey(value: string): value is SettingKey {
	return (SETTING_KEYS as readonly string[]).includes(value);
}
