import 'reflect-metadata';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { readRouteAccess } from '../common/auth/route-access';
import type { RequestUser } from '../common/http/authenticated-request';
import { RATE_LIMIT_GROUP_KEY } from '../common/rate-limit/rate-limited.decorator';
import { StatisticsController } from './statistics.controller';
import type { StatisticsService } from './statistics.service';

const handler = Reflect.get(
	StatisticsController.prototype,
	'get',
) as () => unknown;

describe('StatisticsController.get: khai báo route (spec 0017 AC-1, AC-15)', () => {
	const access = readRouteAccess(new Reflector(), {
		getHandler: () => handler,
		getClass: () => StatisticsController,
	});

	it('đường dẫn me/statistics, method GET, đúng một route', () => {
		expect(Reflect.getMetadata('path', StatisticsController)).toBe(
			'me/statistics',
		);
		expect(Reflect.getMetadata('path', handler)).toBe('/');
		expect(Reflect.getMetadata('method', handler)).toBe(0); // RequestMethod.GET
		const handlers = Object.getOwnPropertyNames(
			StatisticsController.prototype,
		).filter((name) => name !== 'constructor');
		expect(handlers).toEqual(['get']);
	});

	it('đúng một kiểu khai báo quyền: statistic:read', () => {
		expect(access.declarationCount).toBe(1);
		expect(access.declaration).toEqual({
			kind: 'permissions',
			required: ['statistic:read'],
		});
	});

	it('không @FreshAuth() (chủ trọ vừa bị khóa mang token còn hạn vẫn đọc được) và không @OptionalAuth()', () => {
		expect(access.freshAuth).toBe(false);
		expect(access.optionalAuth).toBe(false);
	});

	it('dùng nhóm giới hạn tần suất publicRead đã có', () => {
		expect(Reflect.getMetadata(RATE_LIMIT_GROUP_KEY, handler)).toBe(
			'publicRead',
		);
	});

	it('trả Cache-Control: private, no-store', () => {
		expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual([
			{ name: 'Cache-Control', value: 'private, no-store' },
		]);
	});
});

describe('StatisticsController.get: gọi Service', () => {
	it('chuyển người trong token, query và một đồng hồ now cho Service', async () => {
		const get = jest.fn(() => Promise.resolve({}));
		const controller = new StatisticsController({
			get,
		} as unknown as StatisticsService);
		const user: RequestUser = {
			userId: 'u1',
			sessionId: 's1',
			accountType: 'landlord',
			permissions: ['statistic:manage'],
		};
		const before = Date.now();
		await controller.get(user, { from: '2026-10-01' });
		const after = Date.now();
		expect(get).toHaveBeenCalledTimes(1);
		const [calledUser, calledQuery, calledNow] = get.mock
			.calls[0] as unknown as [RequestUser, object, Date];
		expect(calledUser).toBe(user);
		expect(calledQuery).toEqual({ from: '2026-10-01' });
		expect(calledNow).toBeInstanceOf(Date);
		expect(calledNow.getTime()).toBeGreaterThanOrEqual(before);
		expect(calledNow.getTime()).toBeLessThanOrEqual(after);
	});
});
