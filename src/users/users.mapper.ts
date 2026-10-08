import type { UserWithoutPassword } from './users.repository';

/** Hình dạng người dùng trên đường truyền: danh sách trắng, không bao giờ có `passwordHash` (spec 0002). */
export interface UserResponse {
	readonly id: string;
	readonly email: string;
	readonly name: string | null;
	readonly accountType: string;
	readonly phone: string | null;
	readonly status: string;
}

export function toUserResponse(user: UserWithoutPassword): UserResponse {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		accountType: user.accountType,
		phone: user.phone,
		status: user.status,
	};
}
