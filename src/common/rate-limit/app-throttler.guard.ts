import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';
import { RATE_LIMIT_GROUP_KEY } from './rate-limited.decorator';
import type { RateLimitGroup } from './rate-limits';

/**
 * Cổng giới hạn tần suất (spec 0002 AC-10), chạy toàn cục SAU JwtAuthGuard và PermissionsGuard để route
 * cần đăng nhập đã có `req.user` (khóa theo người dùng). Route không gắn `@RateLimited` bị bỏ qua hoàn
 * toàn. Vượt giới hạn thì trả 429 `RATE_LIMITED` cùng dạng với mọi lỗi khác, kèm header chuẩn
 * `Retry-After` (giây): thư viện chỉ đặt `Retry-After-<tên bộ đếm>` nên ta tự đặt (`setHeaders: false`).
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
	protected override shouldSkip(context: ExecutionContext): Promise<boolean> {
		const group = this.reflector.getAllAndOverride<
			RateLimitGroup | undefined
		>(RATE_LIMIT_GROUP_KEY, [context.getHandler(), context.getClass()]);
		return Promise.resolve(group === undefined);
	}

	protected override throwThrottlingException(
		context: ExecutionContext,
		detail: ThrottlerLimitDetail,
	): Promise<void> {
		const { res } = this.getRequestResponse(context);
		this.setResponseHeader(
			res,
			'Retry-After',
			Math.max(1, detail.timeToBlockExpire),
		);
		return Promise.reject(new AppException(ErrorCode.RATE_LIMITED));
	}
}
