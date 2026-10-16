import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { firstValueFrom, isObservable } from 'rxjs';
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
 * thiếu, sai hay hết hạn trả đúng ba mã lỗi để FE quyết định hành động (spec 0003 AC-4). Route
 * `@OptionalAuth()` là route công khai nhưng vẫn thử đọc token nếu có (spec 0002).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
	constructor(private readonly reflector: Reflector) {
		super();
	}

	override canActivate(
		context: ExecutionContext,
	): boolean | Promise<boolean> | Observable<boolean> {
		const { declaration, optionalAuth } = readRouteAccess(
			this.reflector,
			context,
		);
		if (declaration?.kind === 'public') {
			return optionalAuth ? this.authenticateIfPresent(context) : true;
		}
		return super.canActivate(context);
	}

	/**
	 * Có header `Authorization` thì thử xác thực để gắn `req.user`; mọi lỗi (sai chữ ký, hết hạn, token hỏng)
	 * bị nuốt và người gọi được coi là khách. Không có header thì đi tiếp ngay, không tốn công xác thực.
	 */
	private async authenticateIfPresent(
		context: ExecutionContext,
	): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		if (request.headers.authorization === undefined) return true;
		try {
			const result = super.canActivate(context);
			await (isObservable(result) ? firstValueFrom(result) : result);
		} catch {
			// token sai hoặc hết hạn: coi như khách, `req.user` vẫn trống
		}
		return true;
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
