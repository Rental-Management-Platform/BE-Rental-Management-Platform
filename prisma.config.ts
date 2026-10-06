import { defineConfig } from 'prisma/config';
import { buildDatabaseUrl } from './src/database/build-database-url';
import { loadEnvFile } from './src/database/load-env';

// Prisma 7 không tự nạp .env; dùng đúng bộ nạp của dự án (biến có sẵn trong môi trường
// được ưu tiên hơn file). Không import env.validation vì file đó dùng decorator.
loadEnvFile();

/**
 * Thiếu biến thì dùng giá trị giữ chỗ để `prisma generate` (chạy ở postinstall, lúc chưa có
 * .env) vẫn chạy được. Lệnh cần DB (migrate...) sẽ lỗi kết nối với tên `env_not_set`.
 */
function fromEnv(name: string, fallback: string): string {
	const value = process.env[name];
	return value === undefined || value === '' ? fallback : value;
}

const settings = {
	host: fromEnv('DATABASE_HOST', 'localhost'),
	port: Number(fromEnv('DATABASE_PORT', '5432')),
	database: fromEnv('DATABASE_NAME', 'env_not_set'),
	username: fromEnv('DATABASE_USER', 'env_not_set'),
	password: fromEnv('DATABASE_PASSWORD', 'env_not_set'),
};

export default defineConfig({
	schema: 'prisma/schema.prisma',
	migrations: { path: 'prisma/migrations' },
	datasource: {
		url: buildDatabaseUrl(settings),
		// `prisma migrate dev` cần một database phụ để so sánh; role ứng dụng không có quyền
		// tạo database nên tạo sẵn bằng `npm run db:create` với DATABASE_NAME=<tên>_shadow.
		shadowDatabaseUrl: buildDatabaseUrl({
			...settings,
			database: `${settings.database}_shadow`,
		}),
	},
});
