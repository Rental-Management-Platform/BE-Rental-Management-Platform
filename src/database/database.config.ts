import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { DatabaseSettings } from '../config/app-config.service';
import { SnakeNamingStrategy } from './snake-naming.strategy';

/** Chạy bằng ts-node thì nạp file .ts, chạy từ thư mục dist thì nạp file .js. */
const SOURCE_EXTENSION = __filename.endsWith('.ts') ? 'ts' : 'js';

/** TypeORM dùng glob, nên đường dẫn phải dùng dấu gạch chéo xuôi (kể cả trên Windows). */
function glob(...parts: string[]): string {
  return join(...parts).replace(/\\/g, '/');
}

/**
 * Cấu hình kết nối duy nhất, dùng chung cho ứng dụng NestJS, CLI migration và các script.
 * Mật khẩu chỉ đi qua đối tượng `settings`, không bao giờ nằm trong mã nguồn.
 */
export function buildDataSourceOptions(
  settings: DatabaseSettings,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: settings.host,
    port: settings.port,
    database: settings.database,
    username: settings.username,
    password: settings.password,
    applicationName: 'rental-api',
    namingStrategy: new SnakeNamingStrategy(),
    entities: [glob(__dirname, '..', '**', `*.entity.${SOURCE_EXTENSION}`)],
    migrations: [glob(__dirname, 'migrations', `*.${SOURCE_EXTENSION}`)],
    // Schema chỉ đổi bằng migration; ứng dụng không bao giờ tự sửa schema.
    synchronize: false,
    migrationsRun: false,
    extra: {
      max: settings.poolMax,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      options: '-c timezone=UTC',
    },
  };
}
