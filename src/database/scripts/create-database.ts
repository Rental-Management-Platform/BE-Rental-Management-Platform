import { Client } from 'pg';
import { validateDatabaseEnv } from '../../config/env.validation';
import { loadEnvFile } from '../load-env';
import { readAdminSettings } from './admin-settings';

/**
 * Chạy một câu SQL có tên đối tượng và giá trị. Việc trích dẫn (%I cho tên, %L cho chuỗi)
 * do chính Postgres làm bằng hàm format(), nên không có nối chuỗi và không có SQL injection.
 */
async function runFormatted(
	client: Client,
	template: string,
	...args: string[]
): Promise<void> {
	const result = await client.query<{ sql: string }>(
		'SELECT format($1::text, VARIADIC $2::text[]) AS sql',
		[template, args],
	);
	const statement = result.rows[0]?.sql;
	if (statement === undefined) {
		throw new Error('Không dựng được câu lệnh SQL.');
	}
	await client.query(statement);
}

async function ensureRole(
	client: Client,
	role: string,
	password: string,
): Promise<'created' | 'exists'> {
	const found = await client.query(
		'SELECT 1 FROM pg_roles WHERE rolname = $1',
		[role],
	);
	if (found.rowCount !== 0) {
		return 'exists';
	}
	await runFormatted(
		client,
		'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L',
		role,
		password,
	);
	return 'created';
}

async function ensureDatabase(
	client: Client,
	database: string,
	owner: string,
): Promise<{ status: 'created' | 'exists'; owner: string }> {
	const found = await client.query<{ owner: string }>(
		'SELECT pg_catalog.pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname = $1',
		[database],
	);
	const existing = found.rows[0];
	if (existing !== undefined) {
		return { status: 'exists', owner: existing.owner };
	}
	// UTF8 là bắt buộc cho tiếng Việt; template0 cho phép chọn bảng mã khác với mặc định của cụm.
	await runFormatted(
		client,
		"CREATE DATABASE %I OWNER %I ENCODING 'UTF8' TEMPLATE template0",
		database,
		owner,
	);
	return { status: 'created', owner };
}

async function main(): Promise<void> {
	loadEnvFile();
	const app = validateDatabaseEnv(process.env);
	const admin = readAdminSettings(process.env);

	const client = new Client({
		host: app.DATABASE_HOST,
		port: app.DATABASE_PORT,
		user: admin.user,
		password: admin.password,
		database: 'postgres',
		connectionTimeoutMillis: 5_000,
		application_name: 'rental-db-create',
	});
	await client.connect();
	try {
		const role = await ensureRole(
			client,
			app.DATABASE_USER,
			app.DATABASE_PASSWORD,
		);
		const database = await ensureDatabase(
			client,
			app.DATABASE_NAME,
			app.DATABASE_USER,
		);
		// Chỉ role ứng dụng (và quản trị viên) được kết nối vào database này.
		await runFormatted(
			client,
			'REVOKE CONNECT ON DATABASE %I FROM PUBLIC',
			app.DATABASE_NAME,
		);

		console.log(
			role === 'created'
				? `Đã tạo role "${app.DATABASE_USER}" (không phải superuser).`
				: `Role "${app.DATABASE_USER}" đã có sẵn, giữ nguyên (mật khẩu không bị đổi).`,
		);
		console.log(
			database.status === 'created'
				? `Đã tạo database "${app.DATABASE_NAME}" (UTF8), chủ sở hữu "${database.owner}".`
				: `Database "${app.DATABASE_NAME}" đã có sẵn, chủ sở hữu "${database.owner}", giữ nguyên.`,
		);
		if (database.owner !== app.DATABASE_USER) {
			console.warn(
				`Cảnh báo: database này không thuộc role "${app.DATABASE_USER}", ứng dụng có thể thiếu quyền tạo bảng.`,
			);
		}
		console.log(
			'Bước tiếp theo: npm run db:check, rồi npm run migration:deploy',
		);
	} finally {
		await client.end();
	}
}

main().catch((error: unknown) => {
	// Chỉ in thông điệp lỗi, không in đối tượng lỗi hay cấu hình (có thể chứa bí mật).
	console.error(
		`db:create thất bại: ${error instanceof Error ? error.message : 'lỗi không xác định'}`,
	);
	process.exitCode = 1;
});
