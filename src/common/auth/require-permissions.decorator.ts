import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from './permission-catalog';

export const REQUIRED_PERMISSIONS_KEY = 'auth:required-permissions';

/** Route đòi đủ mọi quyền liệt kê (hoặc `module:manage` tương ứng). */
export const RequirePermissions = (...permissions: PermissionKey[]) =>
	SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
