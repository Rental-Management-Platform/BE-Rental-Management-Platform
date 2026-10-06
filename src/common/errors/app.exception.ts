import { HttpException } from '@nestjs/common';
import { ERRORS } from './error-code';
import type { ErrorCode, FieldError } from './error-code';

export class AppException extends HttpException {
	constructor(
		readonly code: ErrorCode,
		readonly fieldErrors: readonly FieldError[] = [],
		options?: { cause?: unknown },
	) {
		super({ code }, ERRORS[code].status, options);
	}
}
