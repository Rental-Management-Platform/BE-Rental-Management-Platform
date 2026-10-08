import { Injectable } from '@nestjs/common';
import { AuthSessionsRepository } from '../auth/auth-sessions.repository';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { toUserResponse } from '../users/users.mapper';
import type { UserResponse } from '../users/users.mapper';
import { UsersService } from '../users/users.service';
import { ModerationLogsRepository } from './moderation-logs.repository';

/**
 * Khóa, mở khóa và thu hồi phiên của tài khoản (spec 0003 AC-7). Khóa hoặc mở khóa kèm hủy phiên
 * và ghi lịch sử nằm trong một giao dịch: hoặc xong cả ba, hoặc không gì cả.
 */
@Injectable()
export class ModerationService {
	constructor(
		private readonly users: UsersService,
		private readonly sessions: AuthSessionsRepository,
		private readonly logs: ModerationLogsRepository,
		private readonly transactions: TransactionRunner,
	) {}

	async lock(
		actorId: string,
		targetId: string,
		reason: string,
	): Promise<UserResponse> {
		if (actorId === targetId) {
			throw new AppException(ErrorCode.CANNOT_LOCK_SELF);
		}
		await this.transactions.run(async (tx) => {
			await this.users.lock(targetId, reason, tx);
			await this.sessions.revokeAllByUser(
				targetId,
				'locked',
				undefined,
				tx,
			);
			await this.logs.add(
				{
					actorId,
					targetType: 'user',
					targetId,
					action: 'lock',
					reason,
				},
				tx,
			);
		});
		return this.currentUser(targetId);
	}

	async unlock(
		actorId: string,
		targetId: string,
		reason: string,
	): Promise<UserResponse> {
		await this.transactions.run(async (tx) => {
			await this.users.unlock(targetId, tx);
			await this.logs.add(
				{
					actorId,
					targetType: 'user',
					targetId,
					action: 'unlock',
					reason,
				},
				tx,
			);
		});
		return this.currentUser(targetId);
	}

	/** Buộc đăng nhập lại: hủy mọi phiên, không đổi trạng thái tài khoản. */
	async revokeSessions(targetId: string): Promise<void> {
		await this.currentUser(targetId); // 404 nếu không có người dùng
		await this.sessions.revokeAllByUser(targetId, 'admin_revoked');
	}

	private async currentUser(id: string): Promise<UserResponse> {
		const user = await this.users.findById(id);
		if (user === null) throw new AppException(ErrorCode.USER_NOT_FOUND);
		return toUserResponse(user);
	}
}
