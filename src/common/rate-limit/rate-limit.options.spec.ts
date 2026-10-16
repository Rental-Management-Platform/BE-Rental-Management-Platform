import type { ExecutionContext } from '@nestjs/common';
import { RATE_LIMIT_OPTIONS } from './rate-limit.options';

function contextOf(request: Record<string, unknown>): ExecutionContext {
	return {
		switchToHttp: () => ({ getRequest: () => request }),
	} as unknown as ExecutionContext;
}

type Options = {
	throttlers: { name?: string; skipIf?: (c: ExecutionContext) => boolean }[];
};

function counter(name: string) {
	const throttlers = (RATE_LIMIT_OPTIONS as unknown as Options).throttlers;
	const found = throttlers.find((throttler) => throttler.name === name);
	if (found === undefined) throw new Error(`Không có bộ đếm ${name}`);
	return found;
}

describe('RATE_LIMIT_OPTIONS: bộ đếm user bỏ qua khách (spec 0002, "Giới hạn tần suất")', () => {
	const skipUser = counter('user').skipIf;

	it('có skipIf', () => {
		expect(skipUser).toBeDefined();
	});

	it('khách không có req.user thì bỏ qua bộ đếm user', () => {
		expect(skipUser?.(contextOf({ ip: '1.2.3.4' }))).toBe(true);
	});

	it('người đăng nhập thì không bỏ qua', () => {
		expect(
			skipUser?.(contextOf({ ip: '1.2.3.4', user: { userId: 'u-1' } })),
		).toBe(false);
	});

	it('hai bộ đếm kia không có skipIf', () => {
		expect(counter('ip').skipIf).toBeUndefined();
		expect(counter('email').skipIf).toBeUndefined();
	});
});
