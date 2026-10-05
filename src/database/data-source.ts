import { DataSource } from 'typeorm';
import { validateDatabaseEnv } from '../config/env.validation';
import { buildDataSourceOptions } from './database.config';
import { loadEnvFile } from './load-env';

/**
 * DataSource cho CLI của TypeORM (migration:generate, migration:run, ...).
 * Thông tin kết nối lấy từ .env hoặc biến môi trường, không có giá trị nào trong mã nguồn.
 */
loadEnvFile();
const env = validateDatabaseEnv(process.env);

export default new DataSource(
  buildDataSourceOptions({
    host: env.DATABASE_HOST,
    port: env.DATABASE_PORT,
    database: env.DATABASE_NAME,
    username: env.DATABASE_USER,
    password: env.DATABASE_PASSWORD,
    poolMax: env.DATABASE_POOL_MAX,
  }),
);
