import { SetMetadata } from '@nestjs/common';

export const FRESH_AUTH_KEY = 'auth:fresh';

/**
 * Đọc lại trạng thái và quyền của người gọi từ DB trước khi kiểm tra, để tài khoản vừa bị khóa
 * hay vừa mất quyền bị từ chối ngay dù access token còn hạn (spec 0003 AC-8).
 */
export const FreshAuth = () => SetMetadata(FRESH_AUTH_KEY, true);
