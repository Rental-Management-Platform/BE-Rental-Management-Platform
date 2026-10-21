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
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { OrdersController } from './orders.controller';
import { OrdersModule } from './orders.module';
import { OrdersService } from './orders.service';

const ORDER_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';

describe.each(['listAll', 'revenue'])(
	'AdminOrdersController.%s: khai báo route (spec 0010 AC-9, AC-10)',
	(name) => {
		const handler = Reflect.get(
			AdminOrdersController.prototype,
			name,
		) as () => unknown;

		it('chỉ cần quyền order:report, không phải một kiểu khai báo khác', () => {
			const access = readRouteAccess(new Reflector(), {
				getHandler: () => handler,
				getClass: () => AdminOrdersController,
			});
			expect(access.declarationCount).toBe(1);
			expect(access.declaration).toEqual({
				kind: 'permissions',
				required: ['order:report'],
			});
		});

		it('luôn @FreshAuth(): token cũ của chủ trọ mang order:manage chỉ bị chặn nhờ quyền đọc lại từ database', () => {
			const access = readRouteAccess(new Reflector(), {
				getHandler: () => handler,
				getClass: () => AdminOrdersController,
			});
			expect(access.freshAuth).toBe(true);
		});

		it('không gắn giới hạn tần suất và có Cache-Control: private, no-store', () => {
			expect(
				Reflect.getMetadata(RATE_LIMIT_GROUP_KEY, handler),
			).toBeUndefined();
			expect(Reflect.getMetadata(HEADERS_METADATA, handler)).toEqual([
				{ name: 'Cache-Control', value: 'private, no-store' },
			]);
		});
	},
);

describe('thứ tự controller trong OrdersModule (spec 0010 AC-10)', () => {
	const declared = Reflect.getMetadata(
		'controllers',
		OrdersModule,
	) as unknown[];

	it('AdminOrdersController đứng trước OrdersController', () => {
		expect(declared.indexOf(AdminOrdersController)).toBeGreaterThanOrEqual(
			0,
		);
		expect(declared.indexOf(AdminOrdersController)).toBeLessThan(
			declared.indexOf(OrdersController),
		);
	});

	interface Harness {
		app: INestApplication<App>;
		listAll: jest.Mock;
		revenue: jest.Mock;
		getOwn: jest.Mock;
	}

	async function boot(controllers: unknown[]): Promise<Harness> {
		const listAll = jest.fn(() =>
			Promise.resolve({
				items: [],
				total: 0,
				page: 1,
				pageSize: 20,
				summary: { paidCount: 0, paidAmount: 0 },
			}),
		);
		const revenue = jest.fn(() =>
			Promise.resolve({
				from: null,
				to: null,
				groupBy: 'month',
				timeZone: 'Asia/Ho_Chi_Minh',
				paidCount: 0,
				paidAmount: 0,
				byPlan: [],
				series: [],
			}),
		);
		const getOwn = jest.fn(() => Promise.resolve({ id: ORDER_ID }));
		const moduleRef = await Test.createTestingModule({
			controllers: controllers as never[],
			providers: [
				{ provide: AdminOrdersService, useValue: { listAll, revenue } },
				{ provide: OrdersService, useValue: { getOwn } },
			],
		}).compile();
		const app = moduleRef.createNestApplication<INestApplication<App>>();
		app.use(requestIdMiddleware);
		app.useGlobalFilters(new AllExceptionsFilter());
		app.useGlobalPipes(createValidationPipe());
		await app.init();
		return { app, listAll, revenue, getOwn };
	}

	it('gọi thật: GET /orders/all và GET /orders/revenue trả 200 chứ không phải 400 INVALID_ID, và GET /orders/:id của chủ sở hữu vẫn chạy', async () => {
		const { app, listAll, revenue, getOwn } = await boot(declared);
		try {
			const all = await request(app.getHttpServer()).get('/orders/all');
			expect(all.status).toBe(200);
			expect(all.headers['cache-control']).toBe('private, no-store');
			expect(listAll).toHaveBeenCalledTimes(1);

			const stats = await request(app.getHttpServer()).get(
				'/orders/revenue',
			);
			expect(stats.status).toBe(200);
			expect(stats.headers['cache-control']).toBe('private, no-store');
			expect(revenue).toHaveBeenCalledTimes(1);

			const one = await request(app.getHttpServer()).get(
				`/orders/${ORDER_ID}`,
			);
			expect(one.status).toBe(200);
			expect(getOwn).toHaveBeenCalledTimes(1);

			const bad = await request(app.getHttpServer()).get('/orders/xyz');
			expect(bad.status).toBe(400);
			expect((bad.body as { code?: string }).code).toBe('INVALID_ID');
		} finally {
			await app.close();
		}
	});

	it('đối chứng: đảo thứ tự thì cả hai route admin bị :id bắt nhầm thành 400 INVALID_ID (đây là lỗi test này canh giữ)', async () => {
		const { app, listAll, revenue } = await boot([
			OrdersController,
			AdminOrdersController,
		]);
		try {
			for (const path of ['/orders/all', '/orders/revenue']) {
				const res = await request(app.getHttpServer()).get(path);
				expect(res.status).toBe(400);
				expect((res.body as { code?: string }).code).toBe('INVALID_ID');
			}
			expect(listAll).not.toHaveBeenCalled();
			expect(revenue).not.toHaveBeenCalled();
		} finally {
			await app.close();
		}
	});

	it('tham số sai ở GET /orders/all là 400 VALIDATION_FAILED kèm tên trường', async () => {
		const { app, listAll } = await boot(declared);
		try {
			const res = await request(app.getHttpServer()).get(
				'/orders/all?from=2026-10-21&to=2026-10-20&sort=asc',
			);
			expect(res.status).toBe(400);
			const body = res.body as {
				code?: string;
				errors?: { field: string }[];
			};
			expect(body.code).toBe('VALIDATION_FAILED');
			expect(
				(body.errors ?? []).map((item) => item.field).sort(),
			).toEqual(['sort', 'to']);
			expect(listAll).not.toHaveBeenCalled();
		} finally {
			await app.close();
		}
	});

	it('tham số sai ở GET /orders/revenue là 400 VALIDATION_FAILED kèm tên trường, kể cả tham số của danh sách', async () => {
		const { app, revenue } = await boot(declared);
		try {
			const res = await request(app.getHttpServer()).get(
				'/orders/revenue?groupBy=week&status=paid&page=2',
			);
			expect(res.status).toBe(400);
			const body = res.body as {
				code?: string;
				errors?: { field: string }[];
			};
			expect(body.code).toBe('VALIDATION_FAILED');
			expect(
				(body.errors ?? []).map((item) => item.field).sort(),
			).toEqual(['groupBy', 'page', 'status']);
			expect(revenue).not.toHaveBeenCalled();
		} finally {
			await app.close();
		}
	});

	it('GET /orders/revenue không gửi tham số nào: groupBy mặc định month tới Service', async () => {
		const { app, revenue } = await boot(declared);
		try {
			await request(app.getHttpServer()).get('/orders/revenue');
			const calls = revenue.mock.calls as unknown as [
				{ groupBy: string; from?: string; to?: string },
			][];
			expect(calls[0][0].groupBy).toBe('month');
			expect(calls[0][0].from).toBeUndefined();
			expect(calls[0][0].to).toBeUndefined();
		} finally {
			await app.close();
		}
	});
});
