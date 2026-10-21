/** Hai trạng thái của tài khoản (spec 0003): `CHECK` ở DB cũng chỉ nhận hai giá trị này. */
export const USER_STATUSES = ['active', 'locked'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** `q` của danh sách người dùng cho admin: đủ dán nguyên một email (spec 0007 AC-3). */
export const USER_SEARCH_MAX_LENGTH = 254;
