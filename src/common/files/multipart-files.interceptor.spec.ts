import 'reflect-metadata';
import { BadRequestException, HttpStatus } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';
import { MultipartFilesInterceptor } from './multipart-files.interceptor';

/** Lớp cha là `AnyFilesInterceptor()` (multer thật); test thay đúng phương thức `intercept` của nó để dựng từng loại lỗi. */
const parent = Object.getPrototypeOf(MultipartFilesInterceptor.prototype) as {
	intercept: (...args: unknown[]) => Promise<unknown>;
};

const context = {} as ExecutionContext;
const next = { handle: () => of('handler') } as CallHandler;

function stubParent() {
	return jest.spyOn(parent, 'intercept');
}

afterEach(() => {
	jest.restoreAllMocks();
});

describe('MultipartFilesInterceptor (spec 0011 AC-3)', () => {
	it('đọc multipart thành công thì trả nguyên kết quả của lớp cha', async () => {
		const observable = of('ok');
		stubParent().mockResolvedValue(observable);
		await expect(
			new MultipartFilesInterceptor().intercept(context, next),
		).resolves.toBe(observable);
	});

	it('lỗi KHÔNG phải HttpException của bộ đọc multipart thành 400 BAD_REQUEST, giữ lỗi gốc làm cause', async () => {
		const original = new Error('Unexpected end of multipart data');
		stubParent().mockRejectedValue(original);
		const caught: unknown = await new MultipartFilesInterceptor()
			.intercept(context, next)
			.catch((error: unknown) => error);
		expect(caught).toBeInstanceOf(AppException);
		expect((caught as AppException).code).toBe(ErrorCode.BAD_REQUEST);
		expect((caught as AppException).getStatus()).toBe(
			HttpStatus.BAD_REQUEST,
		);
		expect((caught as AppException).cause).toBe(original);
	});

	it('HttpException (413 và 400 mà Nest đã đổi từ lỗi multer) đi qua nguyên, cùng một đối tượng', async () => {
		const tooLarge = new AppException(ErrorCode.PAYLOAD_TOO_LARGE);
		const badRequest = new BadRequestException('Too many files');
		const mock = stubParent();
		for (const error of [tooLarge, badRequest]) {
			mock.mockRejectedValueOnce(error);
			await expect(
				new MultipartFilesInterceptor().intercept(context, next),
			).rejects.toBe(error);
		}
	});

	it('lỗi ném từ bước đọc đồng bộ cũng được đổi thành 400', async () => {
		stubParent().mockImplementation(() => {
			throw new TypeError('đọc hỏng');
		});
		await expect(
			new MultipartFilesInterceptor().intercept(context, next),
		).rejects.toMatchObject({ code: ErrorCode.BAD_REQUEST });
	});

	it('lỗi của handler nằm trong observable trả về, không bị bắt ở đây (không đổi 500 thành 400)', async () => {
		const failing = {
			handle: () => {
				throw new Error('không bao giờ gọi trong bước đọc');
			},
		} as unknown as CallHandler;
		stubParent().mockImplementation(((
			_context: unknown,
			handler: CallHandler,
		) => Promise.resolve(handler)) as never);
		// Bước đọc chỉ trả về; `next.handle()` (chạy handler) do Nest gọi SAU đó, ngoài try của interceptor.
		await expect(
			new MultipartFilesInterceptor().intercept(context, failing),
		).resolves.toBe(failing);
	});
});
