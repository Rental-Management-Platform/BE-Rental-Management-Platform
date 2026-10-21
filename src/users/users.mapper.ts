import type { AdminUserRow, UserWithoutPassword } from './users.repository';

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

/**
 * Một dòng của danh sách người dùng cho admin (spec 0007 AC-1): đúng tám trường, đủ để bấm khóa hay mở khóa ngay.
 * Khác `UserResponse` (sáu trường, là phản hồi của `lock` và `unlock`).
 */
export interface AdminUserListItem {
	readonly id: string;
	readonly email: string;
	readonly name: string | null;
	readonly phone: string | null;
	readonly accountType: string;
	readonly status: string;
	readonly lockedReason: string | null;
	readonly createdAt: Date;
}

export function toAdminUserItem(row: AdminUserRow): AdminUserListItem {
	return {
		id: row.id,
		email: row.email,
		name: row.name,
		phone: row.phone,
		accountType: row.accountType,
		status: row.status,
		lockedReason: row.lockedReason,
		createdAt: row.createdAt,
	};
}
