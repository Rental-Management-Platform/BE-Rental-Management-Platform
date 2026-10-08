import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { readRouteAccess } from '../../common/auth/route-access';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';

function toAuthException(info: unknown): AppException {
	if (info instanceof Error) {
		if (info.name === 'TokenExpiredError') {
			return new AppException(ErrorCode.TOKEN_EXPIRED);
		}
		if (info.message === 'No auth token') {
			return new AppException(ErrorCode.TOKEN_MISSING);
		}
	}
	return new AppException(ErrorCode.TOKEN_INVALID); // sai chữ ký, token hỏng, JsonWebTokenError...
}

/**
 * Cổng thứ nhất: "bạn là ai?" Chạy toàn cục. Route không gắn `@Public()` đòi access token hợp lệ;
 * thiếu, sai hay hết hạn trả đúng ba mã lỗi để FE quyết định hành động (spec 0003 AC-4).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	constructor(private readonly reflector: Reflector) {
		super();
	}

	override canActivate(
		context: ExecutionContext,
	): boolean | Promise<boolean> | Observable<boolean> {
		const { declaration } = readRouteAccess(this.reflector, context);
		if (declaration?.kind === 'public') return true;
		return super.canActivate(context);
	}

	override handleRequest<TUser>(
		err: unknown,
		user: TUser | false | null | undefined,
		info: unknown,
	): TUser {
		if (err !== null && err !== undefined) {
			// lỗi ném từ JwtStrategy.validate
			throw err instanceof Error
				? err
				: new AppException(ErrorCode.TOKEN_INVALID);
		}
		if (user === false || user === null || user === undefined) {
			throw toAuthException(info);
		}
		return user;
	}
}
