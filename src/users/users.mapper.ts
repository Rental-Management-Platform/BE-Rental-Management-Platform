import type { UserWithoutPassword } from './users.repository';

/** Hình dạng người dùng trên đường truyền: danh sách trắng, không bao giờ có `passwordHash`. */
export interface UserResponse {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  readonly roles: readonly string[];
  readonly status: string;
  readonly createdAt: string;
}

export function toUserResponse(user: UserWithoutPassword): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}
