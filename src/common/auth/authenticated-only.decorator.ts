import { SetMetadata } from '@nestjs/common';

export const IS_AUTHENTICATED_ONLY_KEY = 'auth:authenticated-only';

/** Route chỉ cần đăng nhập, không đòi quyền nào (thao tác của chính người dùng, ví dụ `/auth/me`). */
export const AuthenticatedOnly = () =>
	SetMetadata(IS_AUTHENTICATED_ONLY_KEY, true);
