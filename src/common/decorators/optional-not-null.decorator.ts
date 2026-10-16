import { ValidateIf } from 'class-validator';

/**
 * Trường tùy chọn của body sửa (PATCH) mà `null` KHÔNG hợp lệ: vắng mặt thì bỏ qua mọi luật, có mặt (kể cả
 * `null`) thì phải qua các luật còn lại. Khác `@IsOptional()`, vốn cho cả `null` đi qua và làm hỏng cột NOT NULL.
 */
export function OptionalNotNull(): PropertyDecorator {
	return ValidateIf(
		(_object: unknown, value: unknown) => value !== undefined,
	);
}
