import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-code';
import { OptionalAuth } from '../../common/auth/optional-auth.decorator';
import { Public } from '../../common/auth/public.decorator';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

class Routes {
	@Public()
	open(): void {}

	@OptionalAuth()
	optional(): void {}

	@RequirePermissions('property:read')
	closed(): void {}
}

function contextFor(
	handler: keyof Routes,
	headers: Record<string, string> = {},
): ExecutionContext {
	const request = { headers, user: undefined };
	return {
		getHandler: () => Reflect.get(Routes.prototype, handler),
		getClass: () => Routes,
		switchToHttp: () => ({ getRequest: () => request }),
	} as unknown as ExecutionContext;
}

/** `JwtAuthGuard` kế thừa lớp của passport; thay đúng phương thức `canActivate` của lớp cha để không cần chiến lược thật. */
function mockPassport(outcome: 'accept' | 'reject' | 'throw-sync') {
	const parent = Object.getPrototypeOf(JwtAuthGuard.prototype) as {
		canActivate: (context: ExecutionContext) => unknown;
	};
	return jest
		.spyOn(parent, 'canActivate')
		.mockImplementation((context: ExecutionContext) => {
			if (outcome === 'throw-sync') {
				throw new AppException(ErrorCode.TOKEN_INVALID);
			}
			if (outcome === 'reject') {
				return Promise.reject(
					new AppException(ErrorCode.TOKEN_EXPIRED),
				);
			}
			const request = context
				.switchToHttp()
				.getRequest<{ user?: { userId: string } }>();
			request.user = { userId: 'u-1' };
			return Promise.resolve(true);
		});
}

describe('JwtAuthGuard', () => {
	const guard = new JwtAuthGuard(new Reflector());

	afterEach(() => jest.restoreAllMocks());

	it('route @Public() đi tiếp mà không đọc token', () => {
		const spy = mockPassport('accept');
		expect(
			guard.canActivate(
				contextFor('open', { authorization: 'Bearer x' }),
			),
		).toBe(true);
		expect(spy).not.toHaveBeenCalled();
	});

	it('route đóng đi qua passport', async () => {
		const spy = mockPassport('accept');
		await expect(guard.canActivate(contextFor('closed'))).resolves.toBe(
			true,
		);
		expect(spy).toHaveBeenCalledTimes(1);
	});

	describe('route @OptionalAuth() (spec 0002 AC-12)', () => {
		it('không có header Authorization: đi tiếp, không gọi passport', async () => {
			const spy = mockPassport('accept');
			await expect(
				guard.canActivate(contextFor('optional')),
			).resolves.toBe(true);
			expect(spy).not.toHaveBeenCalled();
		});

		it('token hợp lệ: gắn req.user', async () => {
			mockPassport('accept');
			const context = contextFor('optional', {
				authorization: 'Bearer tot',
			});
			await expect(guard.canActivate(context)).resolves.toBe(true);
			const request = context
				.switchToHttp()
				.getRequest<{ user?: { userId: string } }>();
			expect(request.user).toEqual({ userId: 'u-1' });
		});

		it('token hết hạn hoặc sai: vẫn đi tiếp như khách, không ném lỗi', async () => {
			mockPassport('reject');
			const context = contextFor('optional', {
				authorization: 'Bearer het-han',
			});
			await expect(guard.canActivate(context)).resolves.toBe(true);
			expect(
				context.switchToHttp().getRequest<{ user?: unknown }>().user,
			).toBeUndefined();
		});

		it('passport ném lỗi đồng bộ: vẫn đi tiếp như khách', async () => {
			mockPassport('throw-sync');
			await expect(
				guard.canActivate(
					contextFor('optional', { authorization: 'Bearer hong' }),
				),
			).resolves.toBe(true);
		});
	});

	it('handleRequest vẫn đổi lỗi thành ba mã token như cũ', () => {
		expect(() =>
			guard.handleRequest(null, false, new Error('No auth token')),
		).toThrow(
			expect.objectContaining({ code: ErrorCode.TOKEN_MISSING }) as Error,
		);
		const expired = new Error('jwt expired');
		expired.name = 'TokenExpiredError';
		expect(() => guard.handleRequest(null, false, expired)).toThrow(
			expect.objectContaining({ code: ErrorCode.TOKEN_EXPIRED }) as Error,
		);
		expect(() =>
			guard.handleRequest(null, false, new Error('bad')),
		).toThrow(
			expect.objectContaining({ code: ErrorCode.TOKEN_INVALID }) as Error,
		);
	});
});
