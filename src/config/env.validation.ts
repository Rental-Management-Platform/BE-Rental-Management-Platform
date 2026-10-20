import 'reflect-metadata';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
	IsBoolean,
	IsEmail,
	IsIn,
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Matches,
	Max,
	MaxLength,
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

	// ---------- Quên mật khẩu và email (spec 0002 AC-8, spec 0006) ----------
	@Matches(/^https?:\/\/[^\s,/]+$/, {
		message:
			'$property là địa chỉ FE dạng http://host:cổng, không có dấu / cuối',
	})
	APP_BASE_URL: string;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(1440)
	PASSWORD_RESET_TTL_MINUTES: number = 30;

	@IsString()
	@IsNotEmpty()
	MAIL_HOST: string;

	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(65535)
	MAIL_PORT: number;

	@IsString()
	@IsNotEmpty()
	@Matches(NOT_PLACEHOLDER, { message: NOT_PLACEHOLDER_MESSAGE })
	MAIL_USER: string;

	/** Với Gmail là App Password (không phải mật khẩu đăng nhập Gmail). */
	@IsString()
	@IsNotEmpty()
	@Matches(NOT_PLACEHOLDER, { message: NOT_PLACEHOLDER_MESSAGE })
	MAIL_PASSWORD: string;

	/** Địa chỉ người gửi: `a@b.com` hoặc `Tên hiển thị <a@b.com>`. Cấm xuống dòng để không chèn được header. */
	@Matches(/^(?:[^<>\r\n@]+<[^<>\s@]+@[^<>\s@]+>|[^<>\s@]+@[^<>\s@]+)$/, {
		message:
			'$property là địa chỉ email, hoặc dạng Tên hiển thị <địa chỉ email>',
	})
	MAIL_FROM: string;

	// ---------- Ảnh tin (spec 0002 AC-8, spec 0006) ----------
	/** Thư mục lưu ảnh; đường dẫn tương đối tính từ thư mục chạy ứng dụng. Docker Compose đặt `/data/uploads`. */
	@IsString()
	@IsNotEmpty()
	UPLOAD_DIR: string = 'uploads';

	/** Dung lượng tối đa mỗi ảnh, tính bằng byte: từ 1 đến 10 MiB, mặc định 5 MiB. */
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(10485760)
	MAX_UPLOAD_BYTES: number = 5242880;
}

/** Chỉ dùng cho `npm run seed` (ứng dụng không đọc), tách riêng khỏi `Env` (spec 0003 AC-9). */
export class SeedEnv {
	@Transform(({ value }: { value: unknown }) =>
		typeof value === 'string' ? value.trim() : value,
	)
	@IsEmail({}, { message: '$property phải là địa chỉ email hợp lệ' })
	ADMIN_SEED_EMAIL: string;

	@IsString()
	@MinLength(8, { message: '$property phải dài ít nhất 8 ký tự' })
	@MaxLength(128)
	@Matches(NOT_PLACEHOLDER, { message: NOT_PLACEHOLDER_MESSAGE })
	ADMIN_SEED_PASSWORD: string;

	@IsString()
	@IsNotEmpty()
	@MaxLength(100)
	ADMIN_SEED_NAME: string;
}

/** Câu tiếng Việt cho từng ràng buộc; chỉ nêu tên biến, tuyệt đối không nêu giá trị (nhiều biến là bí mật). */
const ENV_MESSAGES: Readonly<Record<string, (property: string) => string>> = {
	isNotEmpty: (property) => `${property} không được để trống`,
	isString: (property) => `${property} phải là chuỗi ký tự`,
	isInt: (property) => `${property} phải là số nguyên`,
	min: (property) => `${property} nhỏ hơn mức cho phép`,
	max: (property) => `${property} lớn hơn mức cho phép`,
	isIn: (property) => `${property} không nằm trong danh sách cho phép`,
	isBoolean: (property) => `${property} phải là true hoặc false`,
	isEmail: (property) => `${property} phải là địa chỉ email hợp lệ`,
	matches: (property) => `${property} sai định dạng`,
	minLength: (property) => `${property} quá ngắn`,
	maxLength: (property) => `${property} quá dài`,
};

/** Câu đã viết tiếng Việt ngay trên decorator thì giữ nguyên; câu mặc định (tiếng Anh) của thư viện thì thay. */
function toVietnamese(property: string, name: string, reason: string): string {
	if (/\P{ASCII}/u.test(reason)) return reason;
	return ENV_MESSAGES[name]?.(property) ?? `${property} không hợp lệ`;
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
			Object.entries(error.constraints ?? {}).map(
				([name, reason]) =>
					`  - ${toVietnamese(error.property, name, reason)}`,
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

export function validateSeedEnv(config: Record<string, unknown>): SeedEnv {
	return validateEnvAs(SeedEnv, config);
}
