import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Page } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import type { ModerationReviewResponse } from './dto/review.response';
import type { ReviewModerationQueryDto } from './dto/review-queries.dto';
import { toModerationReview } from './reviews.mapper';
import { ReviewsRepository } from './reviews.repository';
import type { ReviewStatus } from './review-status';

/**
 * Admin kiểm duyệt đánh giá (spec 0014 AC-11, AC-12), theo khuôn `ListingModerationService`. Ẩn và gỡ ẩn là MỘT câu
 * `UPDATE` có điều kiện trạng thái nguồn nằm trong chính câu lệnh, kèm một dòng `moderation_logs` trong cùng giao dịch
 * và chỉ khi câu lệnh đổi đúng một dòng. Nhờ vậy không mất cập nhật nào khi đua với người viết: sửa bị chặn khi đã
 * ẩn (điều kiện `visible` nằm trong câu sửa), còn xóa thắng và lệnh ẩn nhận 404 vì dòng không còn. Khác tin đăng:
 * gỡ ẩn đưa đánh giá thẳng về `visible` (người viết không có bước tự hiện lại). Không có lý do thì không đổi
 * trạng thái (DTO chặn trước).
 */
@Injectable()
export class ReviewModerationService {
	constructor(
		private readonly repository: ReviewsRepository,
		private readonly logs: ModerationLogsRepository,
		private readonly transactions: TransactionRunner,
	) {}

	/** Mọi đánh giá, mọi trạng thái, mọi người viết, mới viết trước; lọc theo trạng thái, chủ trọ, người viết. */
	async list(
		query: ReviewModerationQueryDto,
	): Promise<Page<ModerationReviewResponse>> {
		const { rows, total } = await this.repository.findModerationPage(
			{
				status: query.status,
				landlordId: query.landlordId,
				authorId: query.authorId,
			},
			skipOf(query),
			query.pageSize,
		);
		const reasons = await this.logs.findLatestReviewHideReasons(
			rows
				.filter((row) => row.status === 'hidden_by_admin')
				.map((row) => row.id),
		);
		return toPage(
			rows.map((row) =>
				toModerationReview(row, reasons.get(row.id) ?? null),
			),
			total,
			query,
		);
	}

	/** `visible` sang `hidden_by_admin`. Đánh giá đã bị ẩn thì 409 `REVIEW_STATE_INVALID`. */
	hide(
		actorId: string,
		id: string,
		reason: string,
	): Promise<ModerationReviewResponse> {
		return this.move(actorId, id, reason, {
			from: 'visible',
			to: 'hidden_by_admin',
			action: 'hide_review',
		});
	}

	/** `hidden_by_admin` sang `visible`. Đánh giá đang hiện thì 409 `REVIEW_STATE_INVALID`. */
	unhide(
		actorId: string,
		id: string,
		reason: string,
	): Promise<ModerationReviewResponse> {
		return this.move(actorId, id, reason, {
			from: 'hidden_by_admin',
			to: 'visible',
			action: 'unhide_review',
		});
	}

	private async move(
		actorId: string,
		id: string,
		reason: string,
		step: {
			readonly from: ReviewStatus;
			readonly to: ReviewStatus;
			readonly action: 'hide_review' | 'unhide_review';
		},
	): Promise<ModerationReviewResponse> {
		const moved = await this.transactions.run(async (tx) => {
			const changed = await this.repository.transition(
				id,
				step.from,
				step.to,
				tx,
			);
			if (changed) {
				await this.logs.add(
					{
						actorId,
						targetType: 'review',
						targetId: id,
						action: step.action,
						reason,
					},
					tx,
				);
			}
			return changed;
		});
		if (!moved) await this.explainRefusal(id);
		return this.readItem(id);
	}

	/** Câu `UPDATE` không đổi dòng nào: không có đánh giá (kể cả vừa bị người viết xóa) thì 404, còn lại là sai trạng thái nguồn thì 409. */
	private async explainRefusal(id: string): Promise<never> {
		const status = await this.repository.findStatus(id);
		if (status === null) throw new AppException(ErrorCode.REVIEW_NOT_FOUND);
		throw new AppException(ErrorCode.REVIEW_STATE_INVALID);
	}

	/** Đọc lại mục vừa ghi SAU giao dịch (không đọc nhiều quan hệ trong giao dịch đang mở). */
	private async readItem(id: string): Promise<ModerationReviewResponse> {
		const row = await this.repository.findModerationRow(id);
		if (row === null) throw new AppException(ErrorCode.REVIEW_NOT_FOUND);
		const reasons =
			row.status === 'hidden_by_admin'
				? await this.logs.findLatestReviewHideReasons([row.id])
				: new Map<string, string>();
		return toModerationReview(row, reasons.get(row.id) ?? null);
	}
}
