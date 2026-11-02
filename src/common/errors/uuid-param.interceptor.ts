import { Injectable, mixin } from '@nestjs/common';
import type {
	CallHandler,
	ExecutionContext,
	NestInterceptor,
	Type,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Observable } from 'rxjs';
import { AppException } from './app.exception';
import { ErrorCode } from './error-code';

/**
 * Báo 400 `INVALID_ID` cho tham số đường dẫn `name` không phải UUID, TRƯỚC khi pipe của handler chạy. Chỉ cần ở route
 * có thân cũng bị validator kiểm (spec 0011 AC-5): Nest giải các tham số của handler song song bằng `Promise.all`
 * chứ không theo thứ tự khai báo, nên `@Param('id', uuidParam())` đứng trước `@Body()` không bảo đảm `INVALID_ID`
 * đến trước `VALIDATION_FAILED`; lỗi nào xong trước thì thắng. Interceptor chạy trước mọi pipe nên thứ tự cố định.
 * Đặt SAU interceptor đọc multipart để lỗi quá dung lượng (413) và lỗi multer (400) vẫn đến trước. Giữ nguyên
 * `uuidParam()` trên tham số để kiểu và lớp chắn thứ hai không mất.
 */
export function RejectInvalidUuidParam(name: string): Type<NestInterceptor> {
	@Injectable()
	class UuidParamInterceptor implements NestInterceptor {
		intercept(
			context: ExecutionContext,
			next: CallHandler,
		): Observable<unknown> {
			const { params } = context
				.switchToHttp()
				.getRequest<{ params: Record<string, unknown> }>();
			const value = params[name];
			if (typeof value !== 'string' || !isUUID(value)) {
				throw new AppException(ErrorCode.INVALID_ID);
			}
			return next.handle();
		}
	}
	return mixin(UuidParamInterceptor);
}
