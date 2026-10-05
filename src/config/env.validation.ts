import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

/** Giá trị mẫu trong `.env.example`; còn nguyên là chưa điền. */
export const PLACEHOLDER_PREFIX = 'CHANGE_ME';

/** Tên role và database: chữ thường, số, gạch dưới (an toàn khi đưa vào lệnh SQL). */
export const DB_IDENTIFIER = /^[a-z_][a-z0-9_]{0,62}$/;

const NOT_PLACEHOLDER = new RegExp(`^(?!${PLACEHOLDER_PREFIX})`);
const NOT_PLACEHOLDER_MESSAGE = `$property còn là giá trị mẫu ${PLACEHOLDER_PREFIX}, hãy điền giá trị thật trong .env`;

/** Các biến để kết nối database; dùng chung cho ứng dụng, migration và script. */
export class DatabaseEnv {
  @IsString()
  @IsNotEmpty()
  DATABASE_HOST: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  DATABASE_PORT: number = 5432;

  @Matches(DB_IDENTIFIER, {
    message:
      '$property chỉ gồm chữ thường, số và gạch dưới, bắt đầu bằng chữ hoặc gạch dưới, tối đa 63 ký tự',
  })
  DATABASE_NAME: string;

  @Matches(DB_IDENTIFIER, {
    message:
      '$property chỉ gồm chữ thường, số và gạch dưới, bắt đầu bằng chữ hoặc gạch dưới, tối đa 63 ký tự',
  })
  DATABASE_USER: string;

  @IsString()
  @MinLength(16, { message: '$property phải dài ít nhất 16 ký tự' })
  @Matches(NOT_PLACEHOLDER, { message: NOT_PLACEHOLDER_MESSAGE })
  DATABASE_PASSWORD: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  DATABASE_POOL_MAX: number = 10;
}

/** Toàn bộ biến môi trường của ứng dụng. */
export class Env extends DatabaseEnv {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsString()
  @MinLength(32, { message: '$property phải dài ít nhất 32 ký tự' })
  @Matches(NOT_PLACEHOLDER, { message: NOT_PLACEHOLDER_MESSAGE })
  JWT_SECRET: string;

  @IsString()
  @IsNotEmpty()
  JWT_EXPIRES_IN: string = '1d';
}

type EnvClass<T extends object> = new () => T;

/**
 * Kiểm tra và đổi kiểu biến môi trường. Thông báo lỗi chỉ nêu tên biến và lý do,
 * tuyệt đối không chứa giá trị (nhiều biến là bí mật).
 */
export function validateEnvAs<T extends object>(
  cls: EnvClass<T>,
  config: Record<string, unknown>,
): T {
  const instance = plainToInstance(cls, config, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });
  const errors = validateSync(instance, {
    skipMissingProperties: false,
    whitelist: false,
    validationError: { target: false, value: false },
  });
  if (errors.length > 0) {
    const lines = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}).map((reason) => `  - ${reason}`),
    );
    throw new Error(
      `Cấu hình môi trường không hợp lệ (xem .env.example):\n${lines.join('\n')}`,
    );
  }
  return instance;
}

export function validateEnv(config: Record<string, unknown>): Env {
  return validateEnvAs(Env, config);
}

export function validateDatabaseEnv(
  config: Record<string, unknown>,
): DatabaseEnv {
  return validateEnvAs(DatabaseEnv, config);
}
