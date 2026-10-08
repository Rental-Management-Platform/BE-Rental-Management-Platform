import type { PermissionKey } from '../../common/auth/permission-catalog';
import type { UserResponse } from '../../users/users.mapper';

export interface TokenResponse {
	readonly accessToken: string;
	/** Số giây access token còn hiệu lực. */
	readonly expiresIn: number;
}

/** Trả cho `POST /auth/forgot-password`: luôn cùng một nội dung dù email có tồn tại hay không. */
export interface MessageResponse {
	readonly message: string;
}

export interface RegisterResponse extends TokenResponse {
	readonly user: UserResponse;
}

/** Trả cho `GET /auth/me`: đọc từ DB, quyền mở rộng từng hành động để FE chỉ cần kiểm `includes`. */
export interface MeResponse {
	readonly user: UserResponse;
	readonly permissions: readonly PermissionKey[];
}
