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

/** Cấu hình đăng nhập và token (spec 0002). Không bao giờ log đối tượng này: có `accessSecret`. */
export interface AuthSettings {
	readonly accessSecret: string;
	readonly issuer: string;
	readonly audience: string;
	readonly accessTtlSeconds: number;
	readonly refreshTtlDays: number;
	readonly refreshGraceSeconds: number;
	readonly maxSessionsPerUser: number;
	readonly refreshCookieName: string;
	readonly cookieSecure: boolean;
}

/** Cấu hình gửi email qua SMTP (spec 0002 AC-8). Không bao giờ log đối tượng này: có `password`. */
export interface MailSettings {
	readonly host: string;
	readonly port: number;
	readonly user: string;
	readonly password: string;
	readonly from: string;
}

/** Nơi duy nhất đọc biến môi trường; code khác không gọi `ConfigService.get` trực tiếp. */
@Injectable()
export class AppConfigService {
	/** Tách một lần ở đây vì OriginGuard đọc nó mỗi lần refresh hoặc logout. */
	readonly allowedOrigins: readonly string[];

	constructor(private readonly config: ConfigService<Env, true>) {
		this.allowedOrigins = this.config
			.get('ALLOWED_ORIGINS', { infer: true })
			.split(',')
			.map((origin) => origin.trim())
			.filter((origin) => origin !== '');
	}

	get port(): number {
		return this.config.get('PORT', { infer: true });
	}

	get trustProxyHops(): number {
		return this.config.get('TRUST_PROXY_HOPS', { infer: true });
	}

	/** Địa chỉ FE, không có dấu `/` cuối; ghép với đường dẫn trang đặt lại mật khẩu. */
	get appBaseUrl(): string {
		return this.config.get('APP_BASE_URL', { infer: true });
	}

	get passwordResetTtlMinutes(): number {
		return this.config.get('PASSWORD_RESET_TTL_MINUTES', { infer: true });
	}

	get mail(): MailSettings {
		return {
			host: this.config.get('MAIL_HOST', { infer: true }),
			port: this.config.get('MAIL_PORT', { infer: true }),
			user: this.config.get('MAIL_USER', { infer: true }),
			password: this.config.get('MAIL_PASSWORD', { infer: true }),
			from: this.config.get('MAIL_FROM', { infer: true }),
		};
	}

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

	get auth(): AuthSettings {
		return {
			accessSecret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
			issuer: this.config.get('JWT_ISSUER', { infer: true }),
			audience: this.config.get('JWT_AUDIENCE', { infer: true }),
			accessTtlSeconds: this.config.get('ACCESS_TTL_SECONDS', {
				infer: true,
			}),
			refreshTtlDays: this.config.get('REFRESH_TTL_DAYS', {
				infer: true,
			}),
			refreshGraceSeconds: this.config.get('REFRESH_GRACE_SECONDS', {
				infer: true,
			}),
			maxSessionsPerUser: this.config.get('MAX_SESSIONS_PER_USER', {
				infer: true,
			}),
			refreshCookieName: this.config.get('REFRESH_COOKIE_NAME', {
				infer: true,
			}),
			cookieSecure: this.config.get('COOKIE_SECURE', { infer: true }),
		};
	}
}
