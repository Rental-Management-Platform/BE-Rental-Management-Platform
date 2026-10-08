import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';
import type { AccessTokenClaims } from './auth.types';

export interface SignedAccessToken {
	readonly accessToken: string;
	/** Số giây còn hiệu lực, để FE biết khi nào cần refresh. */
	readonly expiresIn: number;
}

export interface GeneratedRefreshToken {
	/** Giá trị thô: chỉ gửi cho client (cookie), KHÔNG lưu, KHÔNG log. */
	readonly token: string;
	/** SHA-256 hex: thứ duy nhất được lưu ở DB. */
	readonly hash: string;
}

/**
 * Cấp token. Access token là JWT HS256 ngắn hạn; refresh token là chuỗi ngẫu nhiên 256 bit
 * (không phải JWT) chỉ lưu bản băm, nên SHA-256 là đủ (spec 0002). Việc xác minh access
 * token do JwtStrategy làm, không nằm ở đây.
 */
@Injectable()
export class TokenService {
	constructor(
		private readonly jwtService: JwtService,
		private readonly config: AppConfigService,
	) {}

	signAccessToken(claims: AccessTokenClaims): SignedAccessToken {
		// iss, aud, exp, alg do cấu hình JwtModule thêm (auth.module.ts).
		const accessToken = this.jwtService.sign({ ...claims });
		return { accessToken, expiresIn: this.config.auth.accessTtlSeconds };
	}

	generateRefreshToken(): GeneratedRefreshToken {
		return this.generateOpaqueToken();
	}

	hashRefreshToken(token: string): string {
		return this.sha256(token);
	}

	/** Token trong liên kết đặt lại mật khẩu: cùng cách làm với refresh token, chỉ lưu bản băm (spec 0002 AC-12). */
	generateResetToken(): GeneratedRefreshToken {
		return this.generateOpaqueToken();
	}

	hashResetToken(token: string): string {
		return this.sha256(token);
	}

	private generateOpaqueToken(): GeneratedRefreshToken {
		const token = randomBytes(32).toString('base64url');
		return { token, hash: this.sha256(token) };
	}

	private sha256(value: string): string {
		return createHash('sha256').update(value).digest('hex');
	}
}
