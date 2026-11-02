import { HttpException } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { Observable } from 'rxjs';
import { AppException } from '../errors/app.exception';
import { ErrorCode } from '../errors/error-code';

/**
 * `AnyFilesInterceptor` (multer, cấu hình ở `MulterModule` của module chứa route) cộng đổi lỗi đọc multipart hỏng
 * thành 400 `BAD_REQUEST` (spec 0011 AC-3). Nest chỉ đổi các lỗi multer và busboy nó biết (quá dung lượng thành
 * 413, quá số tệp, thiếu ranh giới, thân bị cắt thành 400); lỗi khác của bộ đọc đi ra nguyên và thành 500. Lỗi
 * đã là `HttpException` (413, 400 của multer) đi qua nguyên.
 *
 * Chỉ bắt lỗi của bước đọc multipart, nên đây là lớp con chứ không phải một interceptor đứng ngoài `next.handle()`:
 * interceptor đứng ngoài sẽ bắt cả lỗi ném từ chính handler (lỗi database, lỗi code) và biến 500 thành 400.
 * Bước đọc xong và `next.handle()` trả về trước khi handler chạy, nên `try` này không thấy lỗi của handler.
 */
export class MultipartFilesInterceptor extends AnyFilesInterceptor() {
	override async intercept(
		context: ExecutionContext,
		next: CallHandler,
	): Promise<Observable<unknown>> {
		try {
			return await super.intercept(context, next);
		} catch (error: unknown) {
			if (error instanceof HttpException) throw error;
			throw new AppException(ErrorCode.BAD_REQUEST, [], { cause: error });
		}
	}
}
