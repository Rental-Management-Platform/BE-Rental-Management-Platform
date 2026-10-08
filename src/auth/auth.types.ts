import { isAccountType } from '../common/auth/account-type';
import type { AccountType } from '../common/auth/account-type';
import { isPermissionKey } from '../common/auth/permission-catalog';
import type { PermissionKey } from '../common/auth/permission-catalog';

/** Phần ta tự đặt khi ký access token (spec 0002 AC-3). */
export interface AccessTokenClaims {
	readonly sub: string; // id người dùng
	readonly sid: string; // id phiên đăng nhập (auth_sessions.id)
	readonly type: AccountType; // loại tài khoản, không đổi sau khi tạo
	readonly perms: readonly PermissionKey[]; // quyền của loại, đã gộp module:manage khi đủ
}

/** Payload đầy đủ sau khi ký: thư viện JWT thêm các trường chuẩn. */
export interface AccessTokenPayload extends AccessTokenClaims {
	readonly iat: number;
	readonly exp: number;
	readonly iss: string;
	readonly aud: string;
}

/**
 * Kiểm tra payload lấy từ JWT (kiểu lỏng của thư viện) có đúng phần ta cần không. Chữ ký chỉ
 * chứng minh token do ta ký, không chứng minh hình dạng khớp phiên bản code hiện tại: khóa quyền
 * không còn trong danh mục làm token bị từ chối.
 */
export function isAccessTokenClaims(
	value: unknown,
): value is AccessTokenClaims {
	if (typeof value !== 'object' || value === null) return false;
	const sub: unknown = Reflect.get(value, 'sub');
	const sid: unknown = Reflect.get(value, 'sid');
	const type: unknown = Reflect.get(value, 'type');
	const perms: unknown = Reflect.get(value, 'perms');
	return (
		typeof sub === 'string' &&
		typeof sid === 'string' &&
		isAccountType(type) &&
		Array.isArray(perms) &&
		perms.every(
			(entry: unknown) =>
				typeof entry === 'string' && isPermissionKey(entry),
		)
	);
}
