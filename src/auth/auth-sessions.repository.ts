import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { AuthSession, Prisma } from '../generated/prisma/client';

/** Khớp CHECK `auth_sessions_revoked_reason_check` ở migration. */
export type SessionRevokedReason =
  | 'logout'
  | 'logout_all'
  | 'reuse_detected'
  | 'password_changed'
  | 'locked'
  | 'admin_revoked'
  | 'session_limit';

export type NewSession = Pick<
  AuthSession,
  'userId' | 'tokenHash' | 'expiresAt' | 'userAgent' | 'ip'
>;

export interface FoundSession {
  readonly session: AuthSession;
  /** Token gửi lên khớp bản hiện hành hay bản liền trước (đã bị xoay). */
  readonly matched: 'current' | 'previous';
}

/** Nơi duy nhất chạm bảng `auth_sessions` (spec 0002). */
@Injectable()
export class AuthSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private client(
    tx?: Prisma.TransactionClient,
  ): Prisma.TransactionClient | PrismaService {
    return tx ?? this.prisma;
  }

  create(
    input: NewSession,
    tx?: Prisma.TransactionClient,
  ): Promise<AuthSession> {
    return this.client(tx).authSession.create({ data: input });
  }

  async findByTokenHash(
    tokenHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<FoundSession | null> {
    const client = this.client(tx);
    const current = await client.authSession.findUnique({
      where: { tokenHash },
    });
    if (current !== null) return { session: current, matched: 'current' };
    const previous = await client.authSession.findFirst({
      where: { previousTokenHash: tokenHash },
    });
    return previous === null
      ? null
      : { session: previous, matched: 'previous' };
  }

  /**
   * Đổi token hiện hành sang token mới BẰNG MỘT CÂU UPDATE CÓ ĐIỀU KIỆN (so sánh rồi đổi trong
   * một bước, không đọc rồi ghi). Trả `true` nếu chính lần gọi này thắng; `false` nếu token đã
   * bị người khác xoay trước, phiên bị hủy hoặc đã hết hạn. Dùng `now()` của DB (một đồng hồ).
   */
  async rotate(
    sessionId: string,
    oldHash: string,
    newHash: string,
    tx?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const affected = await this.client(tx).$executeRaw`
      UPDATE auth_sessions
      SET token_hash = ${newHash},
          previous_token_hash = ${oldHash},
          rotated_at = now(),
          last_used_at = now()
      WHERE id = ${sessionId}::uuid
        AND token_hash = ${oldHash}
        AND revoked_at IS NULL
        AND expires_at > now()`;
    return affected === 1;
  }

  /** Hủy hai lần không ghi đè lý do và thời điểm hủy đầu tiên. */
  async revoke(
    sessionId: string,
    reason: SessionRevokedReason,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.client(tx).authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Hủy mọi phiên còn hiệu lực của một người, có thể trừ một phiên (đổi mật khẩu giữ phiên hiện tại). */
  async revokeAllByUser(
    userId: string,
    reason: SessionRevokedReason,
    exceptSessionId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.client(tx).authSession.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(exceptSessionId === undefined
          ? {}
          : { id: { not: exceptSessionId } }),
      },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  /** Chỉ dọn phiên hết hạn của chính người đang đăng nhập, không quét cả bảng. */
  async deleteExpiredByUser(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await this.client(tx).authSession.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });
  }

  /** Giữ tối đa `maxSessions` phiên còn hiệu lực SAU KHI thêm một phiên mới: hủy các phiên cũ nhất nếu dư. */
  async revokeOldestToFit(
    userId: string,
    maxSessions: number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = this.client(tx);
    const active = await client.authSession.findMany({
      select: { id: true },
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'asc' },
    });
    const excess = active.length - maxSessions + 1; // +1 vì sắp có thêm một phiên
    if (excess <= 0) return;
    const ids = active.slice(0, excess).map((session) => session.id);
    await client.authSession.updateMany({
      where: { id: { in: ids } },
      data: { revokedAt: new Date(), revokedReason: 'session_limit' },
    });
  }
}
