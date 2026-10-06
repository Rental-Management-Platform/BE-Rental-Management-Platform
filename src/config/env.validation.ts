import 'reflect-metadata';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
	IsBoolean,
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
	@MinLength(6, { message: '$property phải dài ít nhất 16 ký tự' })
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

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(65535)
	PORT: number = 3000;

	// ---------- Token (spec 0002) ----------
	@IsString()
	@MinLength(32, { message: '$property phải dài ít nhất 32 ký tự' })
	@Matches(NOT_PLACEHOLDER, { message: NOT_PLACEHOLDER_MESSAGE })
	JWT_ACCESS_SECRET: string;

	@IsString()
	@IsNotEmpty()
	JWT_ISSUER: string = 'rental-api';

	@IsString()
	@IsNotEmpty()
	JWT_AUDIENCE: string = 'rental-web';

	@Type(() => Number)
	@IsInt()
	@Min(60)
	@Max(3600)
	ACCESS_TTL_SECONDS: number = 900;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(90)
	REFRESH_TTL_DAYS: number = 30;

	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(60)
	REFRESH_GRACE_SECONDS: number = 10;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(50)
	MAX_SESSIONS_PER_USER: number = 10;

	@Matches(/^[A-Za-z0-9_]{1,32}$/, {
		message: '$property chỉ gồm chữ, số, gạch dưới (tối đa 32 ký tự)',
	})
	REFRESH_COOKIE_NAME: string = 'rt';

	/** Biến môi trường luôn là chuỗi: so với 'true' thay vì ép kiểu Boolean (chuỗi 'false' sẽ thành true). */
	@Transform(
		({ value }: { value: unknown }) => value === true || value === 'true',
	)
	@IsBoolean()
	COOKIE_SECURE: boolean = false;

	@Matches(/^https?:\/\/[^\s,/]+(,\s*https?:\/\/[^\s,/]+)*$/, {
		message:
			'$property là danh sách origin dạng http://host:cổng, cách nhau bởi dấu phẩy, không có dấu / cuối',
	})
	ALLOWED_ORIGINS: string;

	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(10)
	TRUST_PROXY_HOPS: number = 0;
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
			Object.values(error.constraints ?? {}).map(
				(reason) => `  - ${reason}`,
			),
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
