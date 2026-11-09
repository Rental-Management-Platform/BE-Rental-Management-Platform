import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Page } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import type { ReviewStatus } from '../reviews/review-status';
import type { ModerationListingReviewResponse } from './dto/listing-review.response';
import type { ListingReviewModerationQueryDto } from './dto/listing-review-moderation-query.dto';
import { toModerationListingReview } from './listing-reviews.mapper';
import { ListingReviewsRepository } from './listing-reviews.repository';

/**
 * Admin kiểm duyệt đánh giá phòng (spec 0015 AC-11, AC-12), theo khuôn `ReviewModerationService` của 0014. Ẩn và gỡ ẩn
 * là MỘT câu `UPDATE` có điều kiện trạng thái nguồn nằm trong chính câu lệnh, kèm một dòng `moderation_logs` (loại đích
 * `listing_review`) trong cùng giao dịch và chỉ khi câu lệnh đổi đúng một dòng. Nhờ vậy không mất cập nhật nào khi đua
 * với người viết: sửa bị chặn khi đã ẩn (điều kiện `visible` nằm trong câu sửa), còn xóa thắng và lệnh ẩn nhận 404 vì
 * dòng không còn. Gỡ ẩn đưa đánh giá thẳng về `visible` (người viết không có bước tự hiện lại). Danh sách của admin
 * không kiểm tin có hiện công khai hay không: admin thấy mọi đánh giá, kể cả của tin đang ẩn hay đã xóa. Không có lý
 * do thì không đổi trạng thái (DTO chặn trước).
 */
@Injectable()
export class ListingReviewModerationService {
	constructor(
		private readonly repository: ListingReviewsRepository,
		private readonly logs: ModerationLogsRepository,
		private readonly transactions: TransactionRunner,
	) {}

	/** Mọi đánh giá phòng, mọi trạng thái, mọi người viết, mới viết trước; lọc theo trạng thái, tin, người viết. */
	async list(
		query: ListingReviewModerationQueryDto,
	): Promise<Page<ModerationListingReviewResponse>> {
		const { rows, total } = await this.repository.findModerationPage(
			{
				status: query.status,
				listingId: query.listingId,
				authorId: query.authorId,
			},
			skipOf(query),
			query.pageSize,
		);
		const reasons = await this.logs.findLatestListingReviewHideReasons(
			rows
				.filter((row) => row.status === 'hidden_by_admin')
				.map((row) => row.id),
		);
		return toPage(
			rows.map((row) =>
				toModerationListingReview(row, reasons.get(row.id) ?? null),
			),
			total,
			query,
		);
	}

	/** `visible` sang `hidden_by_admin`. Đánh giá đã bị ẩn thì 409 `LISTING_REVIEW_STATE_INVALID`. */
	hide(
		actorId: string,
		id: string,
		reason: string,
	): Promise<ModerationListingReviewResponse> {
		return this.move(actorId, id, reason, {
			from: 'visible',
			to: 'hidden_by_admin',
			action: 'hide_listing_review',
		});
	}

	/** `hidden_by_admin` sang `visible`. Đánh giá đang hiện thì 409 `LISTING_REVIEW_STATE_INVALID`. */
	unhide(
		actorId: string,
		id: string,
		reason: string,
	): Promise<ModerationListingReviewResponse> {
		return this.move(actorId, id, reason, {
			from: 'hidden_by_admin',
			to: 'visible',
			action: 'unhide_listing_review',
		});
	}

	private async move(
		actorId: string,
		id: string,
		reason: string,
		step: {
			readonly from: ReviewStatus;
			readonly to: ReviewStatus;
			readonly action: 'hide_listing_review' | 'unhide_listing_review';
		},
	): Promise<ModerationListingReviewResponse> {
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
						targetType: 'listing_review',
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
		if (status === null) {
			throw new AppException(ErrorCode.LISTING_REVIEW_NOT_FOUND);
		}
		throw new AppException(ErrorCode.LISTING_REVIEW_STATE_INVALID);
	}

	/** Đọc lại mục vừa ghi SAU giao dịch (không đọc nhiều quan hệ trong giao dịch đang mở). */
	private async readItem(
		id: string,
	): Promise<ModerationListingReviewResponse> {
		const row = await this.repository.findModerationRow(id);
		if (row === null) {
			throw new AppException(ErrorCode.LISTING_REVIEW_NOT_FOUND);
		}
		const reasons =
			row.status === 'hidden_by_admin'
				? await this.logs.findLatestListingReviewHideReasons([row.id])
				: new Map<string, string>();
		return toModerationListingReview(row, reasons.get(row.id) ?? null);
	}
}
