import { Role } from '../common/enums/role.enum';

/** Phần ta tự đặt khi ký access token. */
export interface AccessTokenClaims {
  readonly sub: string; // id người dùng
  readonly sid: string; // id phiên đăng nhập (auth_sessions.id)
  /** Tạm thời, theo cột `users.roles`; spec 0003 sẽ thay bằng `perms`. */
  readonly roles: readonly Role[];
}

/** Payload đầy đủ sau khi ký: thư viện JWT thêm các trường chuẩn. */
export interface AccessTokenPayload extends AccessTokenClaims {
  readonly iat: number;
  readonly exp: number;
  readonly iss: string;
  readonly aud: string;
}

function isRole(value: unknown): value is Role {
  return Object.values<unknown>(Role).includes(value);
}

/** Cột `users.roles` là chuỗi tự do ở tầng DB; chỉ giữ những giá trị còn là vai trò hợp lệ. */
export function toRoles(values: readonly string[]): Role[] {
  return values.filter(isRole);
}

/**
 * Kiểm tra payload lấy từ JWT (kiểu lỏng của thư viện) có đúng phần ta cần không. Chữ ký chỉ
 * chứng minh token do ta ký, không chứng minh hình dạng khớp phiên bản code hiện tại.
 */
export function isAccessTokenClaims(
  value: unknown,
): value is AccessTokenClaims {
  if (typeof value !== 'object' || value === null) return false;
  const sub: unknown = Reflect.get(value, 'sub');
  const sid: unknown = Reflect.get(value, 'sid');
  const roles: unknown = Reflect.get(value, 'roles');
  return (
    typeof sub === 'string' &&
    typeof sid === 'string' &&
    Array.isArray(roles) &&
    roles.every(isRole)
  );
}
