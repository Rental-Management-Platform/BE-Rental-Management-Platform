import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import {
	emailTrackerKey,
	hasUser,
	RATE_LIMIT_DEFAULT,
	userTrackerKey,
} from './rate-limits';

/**
 * Ba bộ đếm của `ThrottlerModule` (bộ nhớ trong, đủ vì chỉ có một container API; đổi sang Redis sau này
 * chỉ cần thêm `storage`). Số giới hạn thật nằm ở `RATE_LIMITS` và được đặt theo từng route bởi
 * `@RateLimited`; số mặc định ở đây chỉ là lưới an toàn. `ip` dùng cách lấy khóa mặc định của thư viện.
 */
export const RATE_LIMIT_OPTIONS: ThrottlerModuleOptions = {
	throttlers: [
		{
			name: 'ip',
			limit: RATE_LIMIT_DEFAULT.limit,
			ttl: RATE_LIMIT_DEFAULT.ttlMs,
		},
		{
			name: 'email',
			limit: RATE_LIMIT_DEFAULT.limit,
			ttl: RATE_LIMIT_DEFAULT.ttlMs,
			getTracker: emailTrackerKey,
		},
		{
			name: 'user',
			limit: RATE_LIMIT_DEFAULT.limit,
			ttl: RATE_LIMIT_DEFAULT.ttlMs,
			getTracker: userTrackerKey,
			// Khách không có người dùng để đếm: bỏ qua bộ đếm này thay vì dồn mọi khách vào khóa theo IP với
			// giới hạn của người đăng nhập (spec 0002, "Giới hạn tần suất"). Route cần đăng nhập luôn có `req.user`.
			skipIf: (context) =>
				!hasUser(
					context
						.switchToHttp()
						.getRequest<Record<string, unknown>>(),
				),
		},
	],
	// Không để thư viện đặt X-RateLimit-* và Retry-After-<tên>; AppThrottlerGuard tự đặt Retry-After chuẩn.
	setHeaders: false,
};
