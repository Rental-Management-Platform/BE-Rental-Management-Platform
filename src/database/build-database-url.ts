import type { DatabaseSettings } from '../config/app-config.service';

export type DatabaseUrlSettings = Pick<
	DatabaseSettings,
	'host' | 'port' | 'database' | 'username' | 'password'
>;

/**
 * Dựng URL kết nối PostgreSQL từ các biến DATABASE_*, dùng chung cho ứng dụng và
 * `prisma.config.ts`. Tên người dùng, mật khẩu và tên database được mã hóa nên ký tự đặc
 * biệt (như @ hay /) không làm hỏng URL. Giá trị không bao giờ được ghi vào mã nguồn.
 */
export function buildDatabaseUrl(settings: DatabaseUrlSettings): string {
	const user = encodeURIComponent(settings.username);
	const password = encodeURIComponent(settings.password);
	const database = encodeURIComponent(settings.database);
	return `postgresql://${user}:${password}@${settings.host}:${settings.port}/${database}`;
}
