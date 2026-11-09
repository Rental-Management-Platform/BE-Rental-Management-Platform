import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export interface NewModerationLog {
	readonly actorId: string;
	readonly targetType: 'user' | 'listing' | 'review' | 'listing_review';
	readonly targetId: string;
	/**
	 * `lock` và `unlock` cho tài khoản; `hide_listing` và `unhide_listing` cho tin (spec 0002 AC-9);
	 * `hide_review` và `unhide_review` cho đánh giá chủ trọ (spec 0014 AC-12);
	 * `hide_listing_review` và `unhide_listing_review` cho đánh giá phòng (spec 0015 AC-12).
	 */
	readonly action:
		| 'lock'
		| 'unlock'
		| 'hide_listing'
		| 'unhide_listing'
		| 'hide_review'
		| 'unhide_review'
		| 'hide_listing_review'
		| 'unhide_listing_review';
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
	findLatestListingHideReasons(
		listingIds: readonly string[],
	): Promise<Map<string, string>> {
		return this.findLatestReasons('listing', 'hide_listing', listingIds);
	}

	/**
	 * Lý do ẩn gần nhất của từng đánh giá trong danh sách (dòng `hide_review` mới nhất), để người viết và admin
	 * biết vì sao đánh giá bị ẩn (spec 0014 AC-8, AC-11). Đánh giá không có dòng nào thì vắng trong kết quả. Một câu
	 * truy vấn cho cả trang, cùng chỉ mục và cùng khuôn với `findLatestListingHideReasons`.
	 */
	findLatestReviewHideReasons(
		reviewIds: readonly string[],
	): Promise<Map<string, string>> {
		return this.findLatestReasons('review', 'hide_review', reviewIds);
	}

	/**
	 * Lý do ẩn gần nhất của từng đánh giá phòng (dòng `hide_listing_review` mới nhất, loại đích `listing_review`), để
	 * người viết và admin biết vì sao đánh giá bị ẩn (spec 0015 AC-8, AC-11). Cùng khuôn với
	 * `findLatestReviewHideReasons`; không lẫn với đánh giá chủ trọ vì loại đích và hành động khác nhau.
	 */
	findLatestListingReviewHideReasons(
		listingReviewIds: readonly string[],
	): Promise<Map<string, string>> {
		return this.findLatestReasons(
			'listing_review',
			'hide_listing_review',
			listingReviewIds,
		);
	}

	private async findLatestReasons(
		targetType: NewModerationLog['targetType'],
		action: NewModerationLog['action'],
		targetIds: readonly string[],
	): Promise<Map<string, string>> {
		const reasons = new Map<string, string>();
		if (targetIds.length === 0) return reasons;
		const rows = await this.prisma.moderationLog.findMany({
			where: { targetType, targetId: { in: [...targetIds] }, action },
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
