import { Client } from 'pg';
import { validateDatabaseEnv } from '../../config/env.validation';
import { loadEnvFile } from '../load-env';

interface ConnectionInfo {
  database: string;
  user: string;
  version: string;
  encoding: string;
}

/** Kiểm tra kết nối bằng chính tài khoản mà ứng dụng sẽ dùng. Chỉ in thông tin không bí mật. */
async function main(): Promise<void> {
  loadEnvFile();
  const env = validateDatabaseEnv(process.env);

  const client = new Client({
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    database: env.DATABASE_NAME,
    user: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    connectionTimeoutMillis: 5_000,
    application_name: 'rental-db-check',
  });
  await client.connect();
  try {
    const result = await client.query<ConnectionInfo>(
      `SELECT current_database() AS database,
              current_user AS "user",
              current_setting('server_version') AS version,
              current_setting('server_encoding') AS encoding`,
    );
    const info = result.rows[0];
    if (info === undefined) {
      throw new Error('Không đọc được thông tin máy chủ.');
    }
    console.log(
      `Kết nối thành công: database "${info.database}", role "${info.user}", PostgreSQL ${info.version}, bảng mã ${info.encoding}.`,
    );
    if (info.encoding !== 'UTF8') {
      throw new Error(
        'Database không dùng UTF8, không lưu được tiếng Việt có dấu. Tạo lại bằng npm run db:create.',
      );
    }
    try {
      await client.query('SELECT uuidv7()');
    } catch {
      console.warn(
        'Cảnh báo: máy chủ không có hàm uuidv7(), cần PostgreSQL 18 trở lên (xem spec 0005).',
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    `db:check thất bại: ${error instanceof Error ? error.message : 'lỗi không xác định'}`,
  );
  process.exitCode = 1;
});
