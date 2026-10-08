import type { Request } from 'express';
import type { AccountType } from '../auth/account-type';
import type { PermissionKey } from '../auth/permission-catalog';

/** Người gọi, rút ra từ access token (hoặc đọc lại từ DB khi route gắn `@FreshAuth()`). */
export interface RequestUser {
	readonly userId: string;
	readonly sessionId: string;
	readonly accountType: AccountType;
	readonly permissions: readonly PermissionKey[];
}

/** Dùng khi chắc chắn đã qua guard xác thực. Trong guard, `user` có thể chưa có. */
export type AuthenticatedRequest = Request & { user: RequestUser };
