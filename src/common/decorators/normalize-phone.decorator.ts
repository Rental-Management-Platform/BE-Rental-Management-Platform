import { Transform } from 'class-transformer';
import { normalizePhone } from '../phone';

/** Chuẩn hóa số điện thoại trước khi validator chạy, để mọi nơi sau đó chỉ thấy một dạng. */
export function NormalizePhone(): PropertyDecorator {
	return Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? normalizePhone(value) : value,
	);
}
