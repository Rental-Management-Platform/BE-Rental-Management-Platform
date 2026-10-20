import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Page } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import type { ModerationListingResponse } from './dto/listing.response';
import type { ModerationListingsQueryDto } from './dto/listing-queries.dto';
import { toModerationItem } from './listings.mapper';
import { ListingsRepository } from './listings.repository';
import { toSearchWords } from './search-words';

/**
 * Admin kiểm duyệt tin (spec 0002 AC-9). Ẩn và gỡ ẩn là MỘT câu `updateMany` có điều kiện trạng thái nguồn nằm
 * trong chính câu lệnh, kèm một dòng `moderation_logs` trong cùng giao dịch và chỉ khi câu lệnh đổi đúng một dòng.
 * Nhờ vậy admin ẩn đua với chủ trọ ẩn hay hiện thì admin luôn thắng: chủ trọ đổi trạng thái trước thì lệnh ẩn vẫn
 * khớp (`visible` hoặc `hidden_by_owner`), chủ trọ đổi sau thì câu `hide` của họ không khớp nữa. Không có lý do
 * thì không đổi trạng thái (DTO chặn trước).
 */
@Injectable()
export class ListingModerationService {
	constructor(
		private readonly repository: ListingsRepository,
		private readonly logs: ModerationLogsRepository,
		private readonly transactions: TransactionRunner,
	) {}

	/** Tin của mọi chủ trọ, mọi trạng thái trừ đã xóa mềm, mới nhất trước; lọc theo trạng thái, chủ trọ, từ khóa. */
	async list(
		query: ModerationListingsQueryDto,
	): Promise<Page<ModerationListingResponse>> {
		const { rows, total } = await this.repository.findModerationPage(
			{
				status: query.status,
				landlordId: query.landlordId,
				searchWords: toSearchWords(query.q),
			},
			skipOf(query),
			query.pageSize,
		);
		const reasons = await this.logs.findLatestListingHideReasons(
			rows
				.filter((row) => row.status === 'hidden_by_admin')
				.map((row) => row.id),
		);
		return toPage(
			rows.map((row) =>
				toModerationItem(row, reasons.get(row.id) ?? null),
			),
			total,
			query,
		);
	}

	/** `visible` hoặc `hidden_by_owner` sang `hidden_by_admin`. Tin đã bị admin ẩn thì 409 `LISTING_STATE_INVALID`. */
	async hide(
		actorId: string,
		id: string,
		reason: string,
	): Promise<ModerationListingResponse> {
		const moved = await this.transactions.run(async (tx) => {
			const changed = await this.repository.transition(
				id,
				['visible', 'hidden_by_owner'],
				'hidden_by_admin',
				tx,
			);
			if (changed) {
				await this.logs.add(
					{
						actorId,
						targetType: 'listing',
						targetId: id,
						action: 'hide_listing',
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

	/**
	 * `hidden_by_admin` sang `hidden_by_owner` (không về `visible`: chủ trọ tự quyết hiện lại, và việc hiện lại
	 * đi qua cửa hạn mức). Tin đang ở trạng thái khác thì 409 `LISTING_STATE_INVALID`.
	 */
	async unhide(
		actorId: string,
		id: string,
		reason: string,
	): Promise<ModerationListingResponse> {
		const moved = await this.transactions.run(async (tx) => {
			const changed = await this.repository.transition(
				id,
				['hidden_by_admin'],
				'hidden_by_owner',
				tx,
			);
			if (changed) {
				await this.logs.add(
					{
						actorId,
						targetType: 'listing',
						targetId: id,
						action: 'unhide_listing',
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

	/** Câu `updateMany` không đổi dòng nào: tin không có hoặc đã xóa mềm thì 404, còn lại là sai trạng thái nguồn thì 409. */
	private async explainRefusal(id: string): Promise<never> {
		const status = await this.repository.findStatus(id);
		if (status === null)
			throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		throw new AppException(ErrorCode.LISTING_STATE_INVALID);
	}

	/** Đọc lại mục vừa ghi SAU giao dịch (đọc nhiều quan hệ trong giao dịch đang mở làm Prisma chạy song song trên một kết nối). */
	private async readItem(id: string): Promise<ModerationListingResponse> {
		const row = await this.repository.findModerationRow(id);
		if (row === null) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		const reasons =
			row.status === 'hidden_by_admin'
				? await this.logs.findLatestListingHideReasons([row.id])
				: new Map<string, string>();
		return toModerationItem(row, reasons.get(row.id) ?? null);
	}
}
