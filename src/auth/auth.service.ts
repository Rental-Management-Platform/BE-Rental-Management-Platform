import { Injectable } from '@nestjs/common';
import { AccountTypesService } from '../account-types/account-types.service';
import { parseAccountType } from '../common/auth/account-type';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { AppConfigService } from '../config/app-config.service';
import type { AuthSession } from '../generated/prisma/client';
import { toUserResponse } from '../users/users.mapper';
import type { UserResponse } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import type { UserWithoutPassword } from '../users/users.repository';
import { AuthSessionsRepository } from './auth-sessions.repository';
import type { MeResponse } from './dto/auth.response';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { PasswordHasher } from './password-hasher';
import { TokenService } from './token.service';

export interface ClientInfo {
	readonly userAgent: string | null;
	readonly ip: string | null;
}

export interface IssuedSession {
	readonly accessToken: string;
	readonly expiresIn: number;
	/** Có giá trị: phải đặt hoặc đổi cookie. `undefined`: chỉ cấp lại access token (ân hạn), giữ nguyên cookie. */
	readonly refreshToken: string | undefined;
}

export interface RegisteredSession extends IssuedSession {
	readonly user: UserResponse;
}

const USER_AGENT_MAX_LENGTH = 255;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Điều phối đăng ký, đăng nhập, làm mới token (xoay vòng), đăng xuất và "tôi là ai"
 * (spec 0002). Refresh token thô chỉ đi qua đây một lần rồi ra cookie; DB chỉ giữ bản băm.
 */
@Injectable()
export class AuthService {
	constructor(
		private readonly usersService: UsersService,
		private readonly accountTypes: AccountTypesService,
		private readonly sessions: AuthSessionsRepository,
		private readonly tokens: TokenService,
		private readonly hasher: PasswordHasher,
		private readonly config: AppConfigService,
	) {}

	async register(
		dto: RegisterDto,
		client: ClientInfo,
	): Promise<RegisteredSession> {
		// Thứ tự kiểm: email trước, số điện thoại sau; cả hai tính cả tài khoản đã xóa mềm và đều
		// chạy trước khi băm. Lỗi DB không được dịch (spec 0004), nên đây là đường báo lỗi duy nhất.
		if (await this.usersService.emailExists(dto.email)) {
			throw new AppException(ErrorCode.EMAIL_TAKEN);
		}
		const phone = dto.phone ?? null;
		if (
			dto.accountType === 'landlord' &&
			phone !== null &&
			(await this.usersService.landlordPhoneExists(phone))
		) {
			throw new AppException(ErrorCode.PHONE_TAKEN);
		}
		const passwordHash = await this.hasher.hash(dto.password);
		const user = await this.usersService.create({
			email: dto.email,
			passwordHash,
			name: dto.name ?? null,
			phone,
			accountType: dto.accountType,
		});
		// Hai người đăng ký trùng email hoặc trùng số gần như cùng lúc: người chậm hơn chạm chỉ mục duy
		// nhất và nhận 500 (bộ lọc không dịch lỗi DB, spec 0004). Chấp nhận được với demo.
		const session = await this.startSession(user, client);
		return { ...session, user: toUserResponse(user) };
	}

	async login(dto: LoginDto, client: ClientInfo): Promise<IssuedSession> {
		const user = await this.usersService.findByEmailWithPassword(dto.email);
		// Luôn chạy đúng một lần băm, kể cả khi email không tồn tại (chống đo thời gian).
		const passwordOk =
			user === null
				? await this.hasher.verifyDummy(dto.password)
				: await this.hasher.verify(user.passwordHash, dto.password);
		if (user === null || !passwordOk) {
			throw new AppException(ErrorCode.INVALID_CREDENTIALS); // cùng một lỗi cho sai email và sai mật khẩu
		}
		if (user.status === 'locked') {
			throw new AppException(ErrorCode.ACCOUNT_LOCKED); // chỉ lộ khi đã biết đúng mật khẩu
		}
		return this.startSession(user, client);
	}

	async refresh(
		rawToken: string | undefined,
		isRetry = false,
	): Promise<IssuedSession> {
		if (rawToken === undefined) {
			throw new AppException(ErrorCode.REFRESH_TOKEN_MISSING);
		}
		const hash = this.tokens.hashRefreshToken(rawToken);
		const found = await this.sessions.findByTokenHash(hash);
		if (found === null) throw new AppException(ErrorCode.SESSION_REVOKED);

		const { session, matched } = found;
		if (session.revokedAt !== null) {
			throw new AppException(ErrorCode.SESSION_REVOKED);
		}
		if (session.expiresAt.getTime() <= Date.now()) {
			throw new AppException(ErrorCode.SESSION_EXPIRED);
		}
		if (matched === 'previous') return this.handleRotatedToken(session);

		const user = await this.assertUserCanContinue(session);
		const next = this.tokens.generateRefreshToken();
		const won = await this.sessions.rotate(session.id, hash, next.hash);
		if (!won) {
			// Một request khác vừa xoay cùng token. Đọc lại: lúc này token của ta là bản "cũ".
			if (isRetry) throw new AppException(ErrorCode.SESSION_REVOKED);
			return this.refresh(rawToken, true);
		}
		return this.issueAccessToken(user, session.id, next.token);
	}

	/** Luôn "thành công" từ góc nhìn người dùng: không ném lỗi khi cookie thiếu hoặc token lạ. */
	async logout(rawToken: string | undefined): Promise<void> {
		if (rawToken === undefined) return;
		const found = await this.sessions.findByTokenHash(
			this.tokens.hashRefreshToken(rawToken),
		);
		if (found !== null)
			await this.sessions.revoke(found.session.id, 'logout');
	}

	logoutAll(userId: string): Promise<void> {
		return this.sessions.revokeAllByUser(userId, 'logout_all');
	}

	/**
	 * "Tôi là ai": đọc người dùng và quyền từ DB, không từ token, nên luôn mới nhất (spec 0002).
	 * Bị khóa thì 403; đã xóa mềm hoặc không còn thì 401 TOKEN_INVALID.
	 */
	async getMe(userId: string): Promise<MeResponse> {
		const user = await this.usersService.findById(userId);
		if (user === null) throw new AppException(ErrorCode.TOKEN_INVALID);
		if (user.status === 'locked') {
			throw new AppException(ErrorCode.ACCOUNT_LOCKED);
		}
		const permissions = await this.accountTypes.getEffectivePermissions(
			parseAccountType(user.accountType),
		);
		return { user: toUserResponse(user), permissions };
	}

	// ---------- nội bộ ----------

	private async startSession(
		user: Pick<UserWithoutPassword, 'id' | 'accountType'>,
		client: ClientInfo,
	): Promise<IssuedSession> {
		const auth = this.config.auth;
		await this.sessions.deleteExpiredByUser(user.id); // dọn khi ghi, không cần cron
		await this.sessions.revokeOldestToFit(user.id, auth.maxSessionsPerUser);
		const refresh = this.tokens.generateRefreshToken();
		const session = await this.sessions.create({
			userId: user.id,
			tokenHash: refresh.hash,
			expiresAt: new Date(Date.now() + auth.refreshTtlDays * DAY_MS),
			userAgent:
				client.userAgent?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
			ip: client.ip,
		});
		return this.issueAccessToken(user, session.id, refresh.token);
	}

	/** Token là bản liền trước (đã bị xoay): trong ân hạn thì hợp lệ, ngoài ân hạn thì là dấu hiệu bị đánh cắp. */
	private async handleRotatedToken(
		session: AuthSession,
	): Promise<IssuedSession> {
		const graceMs = this.config.auth.refreshGraceSeconds * 1000;
		const rotatedAt = session.rotatedAt;
		if (rotatedAt !== null && Date.now() - rotatedAt.getTime() <= graceMs) {
			const user = await this.assertUserCanContinue(session);
			return this.issueAccessToken(user, session.id, undefined);
		}
		await this.sessions.revoke(session.id, 'reuse_detected');
		throw new AppException(ErrorCode.SESSION_REVOKED);
	}

	/** Đọc lại người dùng từ DB mỗi lần refresh: khóa hoặc xóa có hiệu lực tại đây. */
	private async assertUserCanContinue(
		session: AuthSession,
	): Promise<UserWithoutPassword> {
		const user = await this.usersService.findById(session.userId);
		if (user === null) {
			await this.sessions.revoke(session.id, 'admin_revoked');
			throw new AppException(ErrorCode.SESSION_REVOKED);
		}
		if (user.status === 'locked') {
			await this.sessions.revokeAllByUser(user.id, 'locked');
			throw new AppException(ErrorCode.ACCOUNT_LOCKED);
		}
		return user;
	}

	/**
	 * Quyền lấy từ loại của người dùng vừa đọc ở DB: admin đổi quyền của một loại thì token cấp từ
	 * lần refresh kế tiếp có quyền mới (spec 0003 AC-10).
	 */
	private async issueAccessToken(
		user: Pick<UserWithoutPassword, 'id' | 'accountType'>,
		sessionId: string,
		refreshToken: string | undefined,
	): Promise<IssuedSession> {
		const type = parseAccountType(user.accountType);
		const perms = await this.accountTypes.getTokenPermissions(type);
		const { accessToken, expiresIn } = this.tokens.signAccessToken({
			sub: user.id,
			sid: sessionId,
			type,
			perms,
		});
		return { accessToken, expiresIn, refreshToken };
	}
}
