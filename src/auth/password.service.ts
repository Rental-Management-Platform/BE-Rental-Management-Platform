import { Injectable, Logger } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { AppConfigService } from '../config/app-config.service';
import { MailService } from '../mail/mail.service';
import { buildPasswordResetEmail } from '../mail/password-reset.email';
import { UsersService } from '../users/users.service';
import { AuthSessionsRepository } from './auth-sessions.repository';
import { PasswordHasher } from './password-hasher';
import { PasswordResetsRepository } from './password-resets.repository';
import { TokenService } from './token.service';

const MINUTE_MS = 60 * 1000;

export interface ChangePasswordInput {
	readonly userId: string;
	/** Phiên đang dùng: được giữ lại, các phiên khác bị hủy. */
	readonly sessionId: string;
	readonly currentPassword: string;
	readonly newPassword: string;
}

/**
 * Quên, đặt lại và đổi mật khẩu (spec 0002 AC-8, AC-9). Token đặt lại thô chỉ đi qua đây một lần,
 * từ lúc sinh ra đến lúc nằm trong email; DB chỉ giữ bản băm.
 */
@Injectable()
export class PasswordService {
	private readonly logger = new Logger(PasswordService.name);

	constructor(
		private readonly users: UsersService,
		private readonly resets: PasswordResetsRepository,
		private readonly sessions: AuthSessionsRepository,
		private readonly tokens: TokenService,
		private readonly hasher: PasswordHasher,
		private readonly mail: MailService,
		private readonly config: AppConfigService,
		private readonly transactions: TransactionRunner,
	) {}

	/**
	 * Không bao giờ cho người gọi biết email có tồn tại hay không: không ném lỗi và không đợi SMTP,
	 * nên cả nội dung lẫn thời gian trả lời đều không lộ gì. Tài khoản bị khóa vẫn nhận email (khóa
	 * không đổi được bằng mật khẩu, và trả lời khác đi sẽ lộ trạng thái khóa); tài khoản đã xóa mềm thì không.
	 */
	async forgotPassword(email: string): Promise<void> {
		const user = await this.users.findByEmail(email);
		if (user === null) return;

		const reset = this.tokens.generateResetToken();
		const ttlMinutes = this.config.passwordResetTtlMinutes;
		await this.transactions.run((tx) =>
			this.resets.replaceForUser(
				{
					userId: user.id,
					tokenHash: reset.hash,
					expiresAt: new Date(Date.now() + ttlMinutes * MINUTE_MS),
				},
				tx,
			),
		);
		void this.deliverResetEmail(user.id, {
			to: user.email,
			name: user.name,
			token: reset.token,
			appBaseUrl: this.config.appBaseUrl,
			ttlMinutes,
		});
	}

	/**
	 * Dùng liên kết (một lần), đổi mật khẩu và hủy mọi phiên trong một giao dịch: hoặc xong cả ba,
	 * hoặc liên kết vẫn còn nguyên. Băm mật khẩu làm trước để mọi trường hợp tốn thời gian như nhau.
	 */
	async resetPassword(token: string, newPassword: string): Promise<void> {
		const passwordHash = await this.hasher.hash(newPassword);
		const tokenHash = this.tokens.hashResetToken(token);
		await this.transactions.run(async (tx) => {
			const userId = await this.resets.consume(tokenHash, tx);
			if (userId === null) {
				throw new AppException(ErrorCode.RESET_TOKEN_INVALID);
			}
			if (!(await this.users.updatePassword(userId, passwordHash, tx))) {
				// Người dùng đã bị xóa mềm sau khi xin liên kết: coi như liên kết hỏng.
				throw new AppException(ErrorCode.RESET_TOKEN_INVALID);
			}
			await this.sessions.revokeAllByUser(
				userId,
				'password_changed',
				undefined,
				tx,
			);
		});
	}

	/** Đòi mật khẩu hiện tại, đặt mật khẩu mới, hủy mọi phiên khác và giữ phiên đang dùng. */
	async changePassword(input: ChangePasswordInput): Promise<void> {
		const user = await this.users.findByIdWithPassword(input.userId);
		// Access token còn hạn nhưng người dùng đã bị xóa hoặc khóa: cùng cách trả lời như `/auth/me`.
		if (user === null) throw new AppException(ErrorCode.TOKEN_INVALID);
		if (user.status === 'locked') {
			throw new AppException(ErrorCode.ACCOUNT_LOCKED);
		}
		if (
			!(await this.hasher.verify(
				user.passwordHash,
				input.currentPassword,
			))
		) {
			throw new AppException(ErrorCode.CURRENT_PASSWORD_WRONG);
		}

		const passwordHash = await this.hasher.hash(input.newPassword);
		await this.transactions.run(async (tx) => {
			if (!(await this.users.updatePassword(user.id, passwordHash, tx))) {
				throw new AppException(ErrorCode.TOKEN_INVALID);
			}
			await this.sessions.revokeAllByUser(
				user.id,
				'password_changed',
				input.sessionId,
				tx,
			);
		});
	}

	/** Gửi xong hay lỗi đều không ảnh hưởng người gọi; lỗi chỉ ghi log (không kèm token, liên kết, mật khẩu SMTP). */
	private async deliverResetEmail(
		userId: string,
		input: Parameters<typeof buildPasswordResetEmail>[0],
	): Promise<void> {
		try {
			await this.mail.send(buildPasswordResetEmail(input));
		} catch (error: unknown) {
			const reason =
				error instanceof Error ? error.message : 'lỗi không rõ';
			this.logger.error(
				`Không gửi được email đặt lại mật khẩu cho người dùng ${userId}: ${reason}`,
			);
		}
	}
}
