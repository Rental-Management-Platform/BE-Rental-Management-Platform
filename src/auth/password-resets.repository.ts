import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export interface NewPasswordReset {
	readonly userId: string;
	readonly tokenHash: string;
	readonly expiresAt: Date;
}

/** Nơi duy nhất chạm bảng `password_resets` (spec 0002 AC-8). */
@Injectable()
export class PasswordResetsRepository {
	constructor(private readonly prisma: PrismaService) {}

	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	/**
	 * Tạo liên kết mới và bỏ các liên kết cũ của chính người đó: chỉ liên kết mới nhất dùng được.
	 * Xóa luôn các dòng đã hết hạn (dọn khi ghi, không cần cron). Liên kết đã dùng còn hạn được giữ
	 * đến khi hết hạn. Chạy trong giao dịch của người gọi để lỗi giữa chừng không làm mất liên kết cũ.
	 */
	async replaceForUser(
		input: NewPasswordReset,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		const client = this.client(tx);
		await client.passwordReset.deleteMany({
			where: {
				userId: input.userId,
				OR: [{ usedAt: null }, { expiresAt: { lt: new Date() } }],
			},
		});
		await client.passwordReset.create({ data: input });
	}

	/**
	 * Đánh dấu đã dùng BẰNG MỘT CÂU UPDATE CÓ ĐIỀU KIỆN (so sánh rồi đổi trong một bước): hai người
	 * dùng cùng một liên kết thì chỉ một người thắng. Trả id người dùng, hoặc `null` nếu liên kết
	 * không có, đã dùng, đã bị thay hoặc đã hết hạn. Dùng `now()` của DB (một đồng hồ).
	 */
	async consume(
		tokenHash: string,
		tx?: Prisma.TransactionClient,
	): Promise<string | null> {
		const rows = await this.client(tx).$queryRaw<{ user_id: string }[]>`
      UPDATE password_resets
      SET used_at = now()
      WHERE token_hash = ${tokenHash}
        AND used_at IS NULL
        AND expires_at > now()
      RETURNING user_id`;
		return rows[0]?.user_id ?? null;
	}
}
