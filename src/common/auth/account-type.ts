/** Ba loại tài khoản cố định (spec 0003). Mỗi tài khoản đúng một loại, chọn lúc đăng ký và không đổi sau đó. */
export const ACCOUNT_TYPES = ['admin', 'landlord', 'tenant'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** Danh sách duy nhất các loại cho đăng ký công khai; admin chỉ được tạo bằng seed. */
export const SELF_REGISTER_TYPES = ['landlord', 'tenant'] as const;
export type SelfRegisterType = (typeof SELF_REGISTER_TYPES)[number];

export function isAccountType(value: unknown): value is AccountType {
	return ACCOUNT_TYPES.some((type) => type === value);
}

/** Đổi chuỗi đọc từ DB sang kiểu hẹp. DB có CHECK nên sai ở đây là lỗi hệ thống (500), không phải lỗi của người dùng. */
export function parseAccountType(value: string): AccountType {
	if (isAccountType(value)) return value;
	throw new Error(`Loại tài khoản không hợp lệ trong DB: ${value}`);
}
