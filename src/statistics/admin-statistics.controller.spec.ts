import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { HEADERS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { readRouteAccess } from '../common/auth/route-access';
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter';
import { createValidationPipe } from '../common/errors/create-validation-pipe';
import { requestIdMiddleware } from '../common/errors/request-id.middleware';
import { RATE_LIMIT_GROUP_KEY } from '../common/rate-limit/rate-limited.decorator';
import { AdminOverviewService } from './admin-overview.service';
import { AdminStatisticsController } from './admin-statistics.controller';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';

const handler = Reflect.get(
	AdminStatisticsController.prototype,
	'get',
) as () => unknown;

describe('AdminStatisticsController.get: khai báo route (spec 0018 AC-1, AC-15)', () => {
	const access = readRouteAccess(new Reflector(), {
		getHandler: () => handler,
		getClass: () => AdminStatisticsController,
	});

	it('đường dẫn statistics/overview, method GET, đúng một route', () => {
		expect(Reflect.getMetadata('path', AdminStatisticsController)).toBe(
			'statistics',
		);
		expect(Reflect.getMetadata('path', handler)).toBe('overview');
		expect(Reflect.getMetadata('method', handler)).toBe(0); // RequestMethod.GET
		const handlers = Object.getOwnPropertyNames(
			AdminStatisticsController.prototype,
		).filter((name) => name !== 'constructor');
		expect(handlers).toEqual(['get']);
	});

	it('đúng một kiểu khai báo quyền: statistic:report, không phải statistic:read của chủ trọ', () => {
		expect(access.declarationCount).toBe(1);
		expect(access.declaration).toEqual({
			kind: 'permissions',
			required: ['statistic:report'],
		});
	});

	it('luôn @FreshAuth(): token cũ của chủ trọ mang statistic:manage chỉ bị chặn nhờ quyền đọc lại từ database', () => {
		expect(access.freshAuth).toBe(true);
		expect(access.optionalAuth).toBe(false);
	});

	it('không gắn giới hạn tần suất và có Cache-Control: private, no-store', () => {
		expect(
			Reflect.getMetadata(RATE_LIMIT_GROUP_KEY, handler),
		).toBeUndefined();
		expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual([
			{ name: 'Cache-Control', value: 'private, no-store' },
		]);
	});

	it('controller của chủ trọ vẫn là me/statistics và vẫn chỉ cần statistic:read, không @FreshAuth() (spec 0017 không đổi)', () => {
		const own = Reflect.get(
			StatisticsController.prototype,
			'get',
		) as () => unknown;
		const ownAccess = readRouteAccess(new Reflector(), {
			getHandler: () => own,
			getClass: () => StatisticsController,
		});
		expect(Reflect.getMetadata('path', StatisticsController)).toBe(
			'me/statistics',
		);
		expect(ownAccess.declaration).toEqual({
			kind: 'permissions',
			required: ['statistic:read'],
		});
		expect(ownAccess.freshAuth).toBe(false);
	});
});

describe('AdminStatisticsController.get: gọi Service', () => {
	it('chuyển query và một đồng hồ now cho Service', async () => {
		const get = jest.fn(() => Promise.resolve({}));
		const controller = new AdminStatisticsController({
			get,
		} as unknown as AdminOverviewService);
		const before = Date.now();
		await controller.get({ from: '2026-10-01' });
		const after = Date.now();
		expect(get).toHaveBeenCalledTimes(1);
		const [calledQuery, calledNow] = get.mock.calls[0] as unknown as [
			object,
			Date,
		];
		expect(calledQuery).toEqual({ from: '2026-10-01' });
		expect(calledNow).toBeInstanceOf(Date);
		expect(calledNow.getTime()).toBeGreaterThanOrEqual(before);
		expect(calledNow.getTime()).toBeLessThanOrEqual(after);
	});
});

describe('GET /statistics/overview qua HTTP (spec 0018 AC-1, AC-2)', () => {
	async function boot() {
		const get = jest.fn(() => Promise.resolve({ ok: true }));
		const getOwn = jest.fn(() => Promise.resolve({ own: true }));
		const moduleRef = await Test.createTestingModule({
			controllers: [StatisticsController, AdminStatisticsController],
			providers: [
				{ provide: AdminOverviewService, useValue: { get } },
				{ provide: StatisticsService, useValue: { get: getOwn } },
			],
		}).compile();
		const app = moduleRef.createNestApplication<INestApplication<App>>();
		app.use(requestIdMiddleware);
		app.useGlobalFilters(new AllExceptionsFilter());
		app.useGlobalPipes(createValidationPipe());
		await app.init();
		return { app, get, getOwn };
	}

	it('200 với Cache-Control: private, no-store, và route me/statistics không bị che', async () => {
		const { app, get } = await boot();
		try {
			const res = await request(app.getHttpServer()).get(
				'/statistics/overview',
			);
			expect(res.status).toBe(200);
			expect(res.headers['cache-control']).toBe('private, no-store');
			expect(get).toHaveBeenCalledTimes(1);
		} finally {
			await app.close();
		}
	});

	it.each([
		['from=2026-02-30', ['from']],
		['from=1999-12-31', ['from']],
		['to=21/10/2026', ['to']],
		['groupBy=day', ['groupBy']],
		['sort=asc', ['sort']],
		[
			'from=2026-02-30&to=21/10/2026&groupBy=day',
			['from', 'groupBy', 'to'],
		],
	])(
		'tham số %s là 400 VALIDATION_FAILED ở đúng trường và Service không bị gọi',
		async (query, fields) => {
			const { app, get } = await boot();
			try {
				const res = await request(app.getHttpServer()).get(
					`/statistics/overview?${query}`,
				);
				expect(res.status).toBe(400);
				const body = res.body as {
					code?: string;
					errors?: { field: string }[];
				};
				expect(body.code).toBe('VALIDATION_FAILED');
				expect(
					(body.errors ?? []).map((item) => item.field).sort(),
				).toEqual(fields);
				expect(get).not.toHaveBeenCalled();
			} finally {
				await app.close();
			}
		},
	);

	it('from và to hợp lệ được chuyển nguyên cho Service', async () => {
		const { app, get } = await boot();
		try {
			const res = await request(app.getHttpServer()).get(
				'/statistics/overview?from=2026-10-01&to=2026-10-31',
			);
			expect(res.status).toBe(200);
			const calls = get.mock.calls as unknown as [
				{ from?: string; to?: string },
				Date,
			][];
			expect(calls[0][0]).toEqual({
				from: '2026-10-01',
				to: '2026-10-31',
			});
		} finally {
			await app.close();
		}
	});
});
