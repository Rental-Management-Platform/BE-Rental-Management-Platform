import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export interface NewModerationLog {
	readonly actorId: string;
	readonly targetType: 'user';
	readonly targetId: string;
	/** `lock` hoặc `unlock`; các tính năng sau thêm hành động duyệt của mình. */
	readonly action: 'lock' | 'unlock';
	readonly reason: string;
}

/** Lịch sử kiểm duyệt chỉ thêm, không sửa, không xóa (BR-13, spec 0003 AC-7). */
@Injectable()
export class ModerationLogsRepository {
	constructor(private readonly prisma: PrismaService) {}

	async add(
		input: NewModerationLog,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		await (tx ?? this.prisma).moderationLog.create({ data: input });
	}
}
