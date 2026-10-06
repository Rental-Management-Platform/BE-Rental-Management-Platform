import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppException } from './app.exception';
import { ERRORS, ErrorCode } from './error-code';
import type { FieldError } from './error-code';
import { getRequestId } from './request-id.middleware';

interface ErrorBody {
	readonly status: number;
	readonly code: ErrorCode;
	readonly message: string;
	readonly errors?: readonly FieldError[];
	readonly requestId: string;
}

/** Mã chung cho lỗi 4xx do Nest hoặc thư viện sinh; status khác đi vào HTTP_ERROR. */
const STATUS_TO_CODE: ReadonlyMap<number, ErrorCode> = new Map<
	number,
	ErrorCode
>([
	[400, ErrorCode.BAD_REQUEST],
	[401, ErrorCode.UNAUTHORIZED],
	[403, ErrorCode.FORBIDDEN],
	[404, ErrorCode.NOT_FOUND],
	[413, ErrorCode.PAYLOAD_TOO_LARGE],
]);

/**
 * Status của lỗi HTTP: HttpException của Nest, hoặc lỗi 4xx của body-parser
 * (không phải HttpException nhưng có `status` và `expose: true`).
 */
function readHttpStatus(exception: unknown): number | undefined {
	if (exception instanceof HttpException) return exception.getStatus();
	if (typeof exception !== 'object' || exception === null) return undefined;
	const status: unknown = Reflect.get(exception, 'status');
	const expose: unknown = Reflect.get(exception, 'expose');
	return typeof status === 'number' && expose === true ? status : undefined;
}

function toBody(exception: unknown, requestId: string): ErrorBody {
	if (exception instanceof AppException) {
		const { code, fieldErrors } = exception;
		return {
			status: ERRORS[code].status,
			code,
			message: ERRORS[code].message,
			...(fieldErrors.length > 0 ? { errors: fieldErrors } : {}),
			requestId,
		};
	}

	const status = readHttpStatus(exception);
	if (status !== undefined && status < 500) {
		const code = STATUS_TO_CODE.get(status) ?? ErrorCode.HTTP_ERROR;
		return { status, code, message: ERRORS[code].message, requestId };
	}

	// Mọi thứ còn lại (lỗi code, lỗi DB, 5xx của Nest): 500 chung chung.
	const internal = ERRORS[ErrorCode.INTERNAL_ERROR];
	return {
		status: internal.status,
		code: ErrorCode.INTERNAL_ERROR,
		message: internal.message,
		requestId,
	};
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
	private readonly logger = new Logger(AllExceptionsFilter.name);

	catch(exception: unknown, host: ArgumentsHost): void {
		const http = host.switchToHttp();
		const req = http.getRequest<Request>();
		const res = http.getResponse<Response>();

		const body = toBody(exception, getRequestId(res));

		const summary = `${req.method} ${req.originalUrl} -> ${body.status} ${body.code} [${body.requestId}]`;
		if (body.status >= 500) {
			this.logger.error(
				summary,
				exception instanceof Error
					? exception.stack
					: String(exception),
			);
		} else {
			this.logger.warn(summary);
		}

		if (res.headersSent) return;
		res.status(body.status).json(body);
	}
}
