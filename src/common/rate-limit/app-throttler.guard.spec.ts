import { Controller, Get, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AllExceptionsFilter } from '../errors/all-exceptions.filter';
import { requestIdMiddleware } from '../errors/request-id.middleware';
import { AppThrottlerGuard } from './app-throttler.guard';
import { RATE_LIMIT_OPTIONS } from './rate-limit.options';
import { RateLimited } from './rate-limited.decorator';

/** Controller thử, dùng đúng các nhóm giới hạn thật nhưng không cần database hay token. */
@Controller('thu')
class ThuController {
	@Post('quen-mat-khau')
	@RateLimited('forgotPassword')
	quenMatKhau(): { ok: boolean } {
		return { ok: true };
	}

	@Post('lam-moi')
	@RateLimited('refresh')
	lamMoi(): { ok: boolean } {
		return { ok: true };
	}

	@Post('doi-mat-khau')
	@RateLimited('changePassword')
	doiMatKhau(): { ok: boolean } {
		return { ok: true };
	}

	@Get('tu-do')
	tuDo(): { ok: boolean } {
		return { ok: true };
	}
}

interface ErrorBody {
	status?: number;
	code?: string;
	message?: string;
	requestId?: string;
}

describe('AppThrottlerGuard (giới hạn tần suất, spec 0002 AC-10)', () => {
	let app: INestApplication<App>;

	beforeEach(async () => {
		const moduleRef = await Test.createTestingModule({
			imports: [ThrottlerModule.forRoot(RATE_LIMIT_OPTIONS)],
			controllers: [ThuController],
			providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
		}).compile();
		app = moduleRef.createNestApplication();
		app.use(requestIdMiddleware);
		// Giả lập JwtAuthGuard: gắn người dùng từ header thử, trước khi guard giới hạn chạy.
		app.use((req: Request, _res: Response, next: NextFunction) => {
			const userId = req.header('x-test-user');
			if (userId !== undefined) Object.assign(req, { user: { userId } });
			next();
		});
		app.useGlobalFilters(new AllExceptionsFilter());
		await app.init();
	});

	afterEach(async () => {
		await app.close();
	});

	function post(path: string, headers: Record<string, string> = {}) {
		const call = request(app.getHttpServer()).post(path);
		for (const [name, value] of Object.entries(headers))
			call.set(name, value);
		return call;
	}

	function forgot(email: string) {
		return post('/thu/quen-mat-khau').send({ email });
	}

	it('dưới giới hạn thì chạy như cũ', async () => {
		const res = await forgot('an@example.com');
		expect(res.status).toBe(201);
		expect(res.headers['retry-after']).toBeUndefined();
	});

	it('vượt giới hạn theo email: 429 RATE_LIMITED cùng dạng lỗi, kèm Retry-After', async () => {
		for (let i = 0; i < 3; i++) {
			expect((await forgot('an@example.com')).status).toBe(201);
		}
		const res = await forgot('an@example.com');
		const body = res.body as ErrorBody;

		expect(res.status).toBe(429);
		expect(body.status).toBe(429);
		expect(body.code).toBe('RATE_LIMITED');
		expect(body.message).toBe(
			'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
		);
		expect(body.requestId).toBe(res.headers['x-request-id']);

		const retryAfter = Number(res.headers['retry-after']);
		expect(Number.isInteger(retryAfter)).toBe(true);
		expect(retryAfter).toBeGreaterThanOrEqual(1);
		expect(retryAfter).toBeLessThanOrEqual(3600); // cửa sổ forgot-password theo email là một giờ
	});

	it('không đặt header X-RateLimit hay Retry-After có hậu tố tên bộ đếm', async () => {
		for (let i = 0; i < 3; i++) await forgot('an@example.com');
		const res = await forgot('an@example.com');
		const names = Object.keys(res.headers);
		expect(names.filter((name) => name.startsWith('x-ratelimit'))).toEqual(
			[],
		);
		expect(names.filter((name) => name.startsWith('retry-after-'))).toEqual(
			[],
		);
	});

	it('email khác có bộ đếm riêng', async () => {
		for (let i = 0; i < 3; i++) await forgot('an@example.com');
		expect((await forgot('an@example.com')).status).toBe(429);
		expect((await forgot('binh@example.com')).status).toBe(201);
	});

	it('cùng một email viết hoa, thừa khoảng trắng vẫn tính chung một bộ đếm', async () => {
		await forgot('an@example.com');
		await forgot('AN@Example.com');
		await forgot('  an@example.com  ');
		expect((await forgot('An@EXAMPLE.com')).status).toBe(429);
	});

	it('bộ đếm theo IP đếm chung mọi email: đổi email không né được', async () => {
		// 3 email x 3 lần = 9, rồi 1 lần ở email thứ tư = 10 (đủ giới hạn IP là 10 mỗi giờ)
		for (const email of ['a@x.vn', 'b@x.vn', 'c@x.vn']) {
			for (let i = 0; i < 3; i++) await forgot(email);
		}
		expect((await forgot('d@x.vn')).status).toBe(201);
		const res = await forgot('d@x.vn'); // lần thứ 11 của IP, email d mới 2 lần
		expect(res.status).toBe(429);
		expect((res.body as ErrorBody).code).toBe('RATE_LIMITED');
	});

	it('body lạ không làm sập guard: rơi về khóa IP của bộ đếm email nên không né được giới hạn', async () => {
		// thiếu email, email là mảng, email là số: đều dùng chung khóa `ip:<IP>` trong bộ đếm email (3 lần mỗi giờ)
		for (const body of [{}, { email: ['a@b.c'] }, { email: 42 }]) {
			const res = await post('/thu/quen-mat-khau').send(body);
			expect(res.status).toBe(201);
		}
		const res = await post('/thu/quen-mat-khau').send({ email: 42 });
		expect(res.status).toBe(429);
		expect((res.body as ErrorBody).code).toBe('RATE_LIMITED');
	});

	it('route chỉ đếm theo IP (refresh): 60 lần qua, lần 61 bị chặn', async () => {
		for (let i = 0; i < 60; i++) {
			expect((await post('/thu/lam-moi')).status).toBe(201);
		}
		const res = await post('/thu/lam-moi');
		expect(res.status).toBe(429);
		expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(60);
	});

	it('route đổi mật khẩu đếm theo người dùng: người khác không bị ảnh hưởng', async () => {
		for (let i = 0; i < 10; i++) {
			expect(
				(await post('/thu/doi-mat-khau', { 'x-test-user': 'user-a' }))
					.status,
			).toBe(201);
		}
		expect(
			(await post('/thu/doi-mat-khau', { 'x-test-user': 'user-a' }))
				.status,
		).toBe(429);
		expect(
			(await post('/thu/doi-mat-khau', { 'x-test-user': 'user-b' }))
				.status,
		).toBe(201);
	});

	it('route không gắn @RateLimited không bao giờ bị giới hạn', async () => {
		// mặc định của bộ đếm là 100 mỗi phút; 120 lần vẫn qua nghĩa là guard bỏ qua hẳn route này
		for (let i = 0; i < 120; i++) {
			const res = await request(app.getHttpServer()).get('/thu/tu-do');
			expect(res.status).toBe(200);
		}
	});

	it('bộ đếm của các route độc lập với nhau', async () => {
		for (let i = 0; i < 3; i++) await forgot('an@example.com');
		expect((await forgot('an@example.com')).status).toBe(429);
		expect((await post('/thu/lam-moi')).status).toBe(201);
	});
});
