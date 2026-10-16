/**
 * Thoát ba ký tự đặc biệt của `LIKE` trong PostgreSQL (`\`, `%`, `_`) bằng dấu `\` đứng trước, để từ khóa
 * của người dùng chỉ khớp đúng ký tự đó. Prisma gắn tham số nhưng KHÔNG tự thoát chúng: `contains: '_'` khớp
 * mọi dòng (đã kiểm chạy thật, spec 0002). `\` là ký tự thoát mặc định của `LIKE` nên không cần mệnh đề `ESCAPE`.
 */
export function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, '\\$&');
}
