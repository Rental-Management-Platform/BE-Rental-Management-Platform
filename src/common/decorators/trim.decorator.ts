import { Transform } from 'class-transformer';

/** Cắt khoảng trắng đầu và cuối của chuỗi người dùng nhập, trước khi validator chạy. */
export function Trim(): PropertyDecorator {
	return Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? value.trim() : value,
	);
}
