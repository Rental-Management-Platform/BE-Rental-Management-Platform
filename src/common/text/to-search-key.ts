/**
 * Chuẩn hóa chuỗi để tìm tiếng Việt không dấu (spec 0005, spec 0002): Unicode NFD rồi bỏ dấu kết hợp,
 * đổi `đ` và `Đ` thành `d` (chữ này không tách dấu được nên không dựa vào `unaccent`), chữ thường, gộp
 * khoảng trắng. Các phần rỗng hoặc null bị bỏ qua. Dấu thanh đặt kiểu `Hoà` hay `Hòa` đều ra cùng kết quả.
 */
export function toSearchKey(
	...parts: ReadonlyArray<string | null | undefined>
): string {
	return parts
		.filter((part): part is string => typeof part === 'string')
		.join(' ')
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.replace(/[đĐ]/g, 'd')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}
