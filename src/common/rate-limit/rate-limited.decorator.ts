import { applyDecorators, SetMetadata } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { RATE_LIMIT_NAMES, RATE_LIMITS } from './rate-limits';
import type { RateLimitGroup } from './rate-limits';

/** Khóa metadata: AppThrottlerGuard chỉ giới hạn route nào có khóa này (route khác chạy như cũ). */
export const RATE_LIMIT_GROUP_KEY = 'rateLimitGroup';

/**
 * Gắn giới hạn tần suất của một nhóm (bảng `RATE_LIMITS`) cho route. Bộ đếm nào nhóm không dùng thì bị bỏ
 * qua riêng cho route này, nên `login` đếm theo `ip` và `email` còn `refresh` chỉ đếm theo `ip`.
 */
export function RateLimited(group: RateLimitGroup) {
	const rules = RATE_LIMITS[group];
	const throttle: Record<string, { limit: number; ttl: number }> = {};
	const skip: Record<string, boolean> = {};
	for (const name of RATE_LIMIT_NAMES) {
		const rule = rules[name];
		if (rule === undefined) {
			skip[name] = true;
		} else {
			throttle[name] = { limit: rule.limit, ttl: rule.ttlMs };
		}
	}
	return applyDecorators(
		SetMetadata(RATE_LIMIT_GROUP_KEY, group),
		Throttle(throttle),
		SkipThrottle(skip),
	);
}
