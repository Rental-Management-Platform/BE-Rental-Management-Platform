import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.validation';

/** Thông tin kết nối database, đọc từ biến môi trường (không có giá trị mặc định cho mật khẩu). */
export interface DatabaseSettings {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly poolMax: number;
}

/** Nơi duy nhất đọc biến môi trường; code khác không gọi `ConfigService.get` trực tiếp. */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get database(): DatabaseSettings {
    return {
      host: this.config.get('DATABASE_HOST', { infer: true }),
      port: this.config.get('DATABASE_PORT', { infer: true }),
      database: this.config.get('DATABASE_NAME', { infer: true }),
      username: this.config.get('DATABASE_USER', { infer: true }),
      password: this.config.get('DATABASE_PASSWORD', { infer: true }),
      poolMax: this.config.get('DATABASE_POOL_MAX', { infer: true }),
    };
  }
}
