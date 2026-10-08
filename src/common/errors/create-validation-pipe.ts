import { ParseUUIDPipe, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { AppException } from './app.exception';
import { ErrorCode } from './error-code';
import type { FieldError } from './error-code';

/**
 * Tên ràng buộc của class-validator sang câu tiếng Việt, không kèm số liệu (spec 0004).
 * DTO nào cần nêu số liệu (ví dụ độ dài mật khẩu) đặt `message` riêng bằng tiếng Việt ngay trên
 * decorator; `toVietnamese` nhận ra câu đó nhờ có ký tự có dấu nên giữ nguyên, không ghi đè.
 */
export const VALIDATION_MESSAGES: Readonly<Record<string, string>> = {
	isEmail: 'Phải là địa chỉ email hợp lệ.',
	isNotEmpty: 'Không được để trống.',
	isString: 'Phải là chuỗi ký tự.',
	isIn: 'Giá trị không nằm trong danh sách cho phép.',
	matches: 'Định dạng không hợp lệ.',
	minLength: 'Giá trị quá ngắn.',
	maxLength: 'Giá trị quá dài.',
	isArray: 'Phải là một danh sách.',
	arrayMaxSize: 'Danh sách có quá nhiều phần tử.',
	isDefined: 'Không được thiếu trường này.',
	whitelistValidation: 'Trường này không được phép gửi lên.',
};

const FALLBACK_MESSAGE = 'Giá trị không hợp lệ.';

/** Một DTO đặt `message` riêng bằng tiếng Việt thì giữ nguyên; câu mặc định của thư viện (tiếng Anh) thì thay. */
function toVietnamese(code: string, original: string): string {
	const looksCustom = /\P{ASCII}/u.test(original);
	if (looksCustom) return original;
	return VALIDATION_MESSAGES[code] ?? FALLBACK_MESSAGE;
}

export function flattenValidationErrors(
	errors: readonly ValidationError[],
	parent = '',
): FieldError[] {
	return errors.flatMap((error) => {
		const field =
			parent === '' ? error.property : `${parent}.${error.property}`;
		const own = Object.entries(error.constraints ?? {}).map(
			([code, message]): FieldError => ({
				field,
				code,
				message: toVietnamese(code, message),
			}),
		);
		return [
			...own,
			...flattenValidationErrors(error.children ?? [], field),
		];
	});
}

export function createValidationPipe(): ValidationPipe {
	return new ValidationPipe({
		whitelist: true,
		forbidNonWhitelisted: true,
		transform: true,
		exceptionFactory: (errors) =>
			new AppException(
				ErrorCode.VALIDATION_FAILED,
				flattenValidationErrors(errors),
			),
	});
}

/** Mọi tham số id dùng: `@Param('id', uuidParam()) id: string`. */
export function uuidParam(): ParseUUIDPipe {
	return new ParseUUIDPipe({
		exceptionFactory: () => new AppException(ErrorCode.INVALID_ID),
	});
}
