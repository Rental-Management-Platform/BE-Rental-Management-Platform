import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export interface NewModerationLog {
	readonly actorId: string;
	readonly targetType: 'user' | 'listing';
	readonly targetId: string;
	/** `lock` và `unlock` cho tài khoản; `hide_listing` và `unhide_listing` cho tin (spec 0002 AC-9). */
	readonly action: 'lock' | 'unlock' | 'hide_listing' | 'unhide_listing';
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

	/**
	 * Lý do ẩn gần nhất của từng tin trong danh sách (dòng `hide_listing` mới nhất), để chủ trọ biết vì sao tin
	 * bị admin ẩn (spec 0002 AC-9, AC-14). Tin không có dòng nào thì vắng trong kết quả. Một câu truy vấn cho cả
	 * trang, dùng chỉ mục `(target_type, target_id, created_at)`.
	 */
	async findLatestListingHideReasons(
		listingIds: readonly string[],
	): Promise<Map<string, string>> {
		const reasons = new Map<string, string>();
		if (listingIds.length === 0) return reasons;
		const rows = await this.prisma.moderationLog.findMany({
			where: {
				targetType: 'listing',
				targetId: { in: [...listingIds] },
				action: 'hide_listing',
			},
			orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
			select: { targetId: true, reason: true },
		});
		for (const row of rows) {
			if (!reasons.has(row.targetId))
				reasons.set(row.targetId, row.reason);
		}
		return reasons;
	}
}
