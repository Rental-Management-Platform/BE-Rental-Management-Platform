/**
 * Nạp file .env cho script và CLI (ứng dụng NestJS đã tự nạp qua ConfigModule).
 * Biến đã có sẵn trong môi trường được ưu tiên hơn file; thiếu file .env thì bỏ qua
 * (ví dụ trong container, nơi biến môi trường được truyền vào trực tiếp).
 */
export function loadEnvFile(path = '.env'): void {
	try {
		process.loadEnvFile(path);
	} catch (error: unknown) {
		const isMissingFile =
			error instanceof Error &&
			'code' in error &&
			error.code === 'ENOENT';
		if (!isMissingFile) {
			throw error;
		}
	}
}
