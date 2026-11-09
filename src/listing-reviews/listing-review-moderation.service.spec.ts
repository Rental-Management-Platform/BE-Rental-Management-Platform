import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import type { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import { ADMIN_ID, REVIEW_ID, TENANT_ID } from '../reviews/reviews.fixtures';
import { ListingReviewModerationService } from './listing-review-moderation.service';
import {
	LISTING_ID,
	moderationListingReviewRow,
} from './listing-reviews.fixtures';
import type {
	ListingReviewsRepository,
	ModerationListingReviewRow,
} from './listing-reviews.repository';

/** Giao dịch giả: `run` chạy hàm với cái này, để test thấy Repository và log nhận đúng `tx` của Service. */
const TX = { tx: true };

interface Options {
	changed?: boolean;
	status?: string | null;
	row?: ModerationListingReviewRow | null;
	page?: { rows: ModerationListingReviewRow[]; total: number };
	reasons?: Map<string, string>;
}

function build(options: Options = {}) {
	const repository = {
		transition: jest.fn(() => Promise.resolve(options.changed ?? true)),
		findStatus: jest.fn(() =>
			Promise.resolve(
				options.status === undefined ? 'visible' : options.status,
			),
		),
		findModerationRow: jest.fn(() =>
			Promise.resolve(
				options.row === undefined
					? moderationListingReviewRow()
					: options.row,
			),
		),
		findModerationPage: jest.fn(() =>
			Promise.resolve(options.page ?? { rows: [], total: 0 }),
		),
	};
	const logs = {
		add: jest.fn(() => Promise.resolve()),
		findLatestListingReviewHideReasons: jest.fn(() =>
			Promise.resolve(options.reasons ?? new Map<string, string>()),
		),
	};
	const transactions = {
		run: jest.fn((fn: (tx: unknown) => Promise<unknown>) => fn(TX)),
	};
	const service = new ListingReviewModerationService(
		repository as unknown as ListingReviewsRepository,
		logs as unknown as ModerationLogsRepository,
		transactions as unknown as TransactionRunner,
	);
	return { service, repository, logs, transactions };
}

async function errorOf(promise: Promise<unknown>): Promise<AppException> {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(AppException);
	return error as AppException;
}

describe('ListingReviewModerationService.hide (spec 0015 AC-12)', () => {
	it('chuyển visible sang hidden_by_admin bằng một câu UPDATE trong giao dịch, kèm đúng một dòng log hide_listing_review có lý do', async () => {
		const { service, repository, logs, transactions } = build({
			row: moderationListingReviewRow({ status: 'hidden_by_admin' }),
			reasons: new Map([[REVIEW_ID, 'Nội dung xúc phạm cá nhân.']]),
		});
		const item = await service.hide(
			ADMIN_ID,
			REVIEW_ID,
			'Nội dung xúc phạm cá nhân.',
		);
		expect(transactions.run).toHaveBeenCalledTimes(1);
		expect(repository.transition).toHaveBeenCalledWith(
			REVIEW_ID,
			'visible',
			'hidden_by_admin',
			TX,
		);
		expect(logs.add).toHaveBeenCalledTimes(1);
		expect(logs.add).toHaveBeenCalledWith(
			{
				actorId: ADMIN_ID,
				targetType: 'listing_review',
				targetId: REVIEW_ID,
				action: 'hide_listing_review',
				reason: 'Nội dung xúc phạm cá nhân.',
			},
			TX,
		);
		expect(item.status).toBe('hidden_by_admin');
		expect(item.hiddenReason).toBe('Nội dung xúc phạm cá nhân.');
	});

	it('câu UPDATE không đổi dòng nào thì KHÔNG ghi log', async () => {
		const { service, logs } = build({ changed: false, status: null });
		await errorOf(service.hide(ADMIN_ID, REVIEW_ID, 'Spam'));
		expect(logs.add).not.toHaveBeenCalled();
	});

	it('không có đánh giá (hoặc người viết vừa xóa): 404 LISTING_REVIEW_NOT_FOUND', async () => {
		const { service } = build({ changed: false, status: null });
		const error = await errorOf(service.hide(ADMIN_ID, REVIEW_ID, 'Spam'));
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_NOT_FOUND);
	});

	it('đã bị ẩn: 409 LISTING_REVIEW_STATE_INVALID', async () => {
		const { service } = build({
			changed: false,
			status: 'hidden_by_admin',
		});
		const error = await errorOf(service.hide(ADMIN_ID, REVIEW_ID, 'Spam'));
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_STATE_INVALID);
	});

	it('đọc lại mục SAU giao dịch, không đọc trong giao dịch', async () => {
		const { service, repository, transactions } = build();
		await service.hide(ADMIN_ID, REVIEW_ID, 'Spam');
		const runOrder = transactions.run.mock.invocationCallOrder[0] ?? 0;
		const readOrder =
			repository.findModerationRow.mock.invocationCallOrder[0] ?? 0;
		expect(readOrder).toBeGreaterThan(runOrder);
	});

	it('đọc lại không thấy (người viết xóa ngay sau khi ẩn): 404 LISTING_REVIEW_NOT_FOUND', async () => {
		const { service } = build({ row: null });
		const error = await errorOf(service.hide(ADMIN_ID, REVIEW_ID, 'Spam'));
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_NOT_FOUND);
	});
});

describe('ListingReviewModerationService.unhide (spec 0015 AC-12)', () => {
	it('chuyển hidden_by_admin thẳng về visible (không qua trạng thái trung gian), kèm một dòng log unhide_listing_review', async () => {
		const { service, repository, logs } = build({
			row: moderationListingReviewRow({ status: 'visible' }),
			reasons: new Map([[REVIEW_ID, 'Lý do ẩn cũ']]),
		});
		const item = await service.unhide(ADMIN_ID, REVIEW_ID, 'Ẩn nhầm');
		expect(repository.transition).toHaveBeenCalledWith(
			REVIEW_ID,
			'hidden_by_admin',
			'visible',
			TX,
		);
		expect(logs.add).toHaveBeenCalledWith(
			{
				actorId: ADMIN_ID,
				targetType: 'listing_review',
				targetId: REVIEW_ID,
				action: 'unhide_listing_review',
				reason: 'Ẩn nhầm',
			},
			TX,
		);
		expect(item.status).toBe('visible');
		expect(item.hiddenReason).toBeNull();
	});

	it('đang hiện: 409 LISTING_REVIEW_STATE_INVALID và không ghi log', async () => {
		const { service, logs } = build({ changed: false, status: 'visible' });
		const error = await errorOf(
			service.unhide(ADMIN_ID, REVIEW_ID, 'Ẩn nhầm'),
		);
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_STATE_INVALID);
		expect(logs.add).not.toHaveBeenCalled();
	});

	it('không có đánh giá: 404 LISTING_REVIEW_NOT_FOUND', async () => {
		const { service } = build({ changed: false, status: null });
		const error = await errorOf(
			service.unhide(ADMIN_ID, REVIEW_ID, 'Ẩn nhầm'),
		);
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_NOT_FOUND);
	});
});

describe('ListingReviewModerationService.list (spec 0015 AC-11)', () => {
	it('chuyển bộ lọc và trang xuống Repository đúng như nhận (trang 2 cỡ 10 bỏ qua 10 dòng)', async () => {
		const { service, repository } = build();
		await service.list({
			page: 2,
			pageSize: 10,
			status: 'hidden_by_admin',
			listingId: LISTING_ID,
			authorId: TENANT_ID,
		});
		expect(repository.findModerationPage).toHaveBeenCalledWith(
			{
				status: 'hidden_by_admin',
				listingId: LISTING_ID,
				authorId: TENANT_ID,
			},
			10,
			10,
		);
	});

	it('không lọc: bộ lọc rỗng, mọi trạng thái', async () => {
		const { service, repository } = build();
		await service.list({ page: 1, pageSize: 20 });
		expect(repository.findModerationPage).toHaveBeenCalledWith(
			{ status: undefined, listingId: undefined, authorId: undefined },
			0,
			20,
		);
	});

	it('một truy vấn lý do cho cả trang, chỉ cho các đánh giá đang bị ẩn, đúng loại đích đánh giá phòng', async () => {
		const hiddenId = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8e22';
		const { service, logs } = build({
			page: {
				rows: [
					moderationListingReviewRow({
						id: REVIEW_ID,
						status: 'visible',
					}),
					moderationListingReviewRow({
						id: hiddenId,
						status: 'hidden_by_admin',
					}),
				],
				total: 2,
			},
			reasons: new Map([[hiddenId, 'Spam']]),
		});
		const page = await service.list({ page: 1, pageSize: 20 });
		expect(logs.findLatestListingReviewHideReasons).toHaveBeenCalledTimes(
			1,
		);
		expect(logs.findLatestListingReviewHideReasons).toHaveBeenCalledWith([
			hiddenId,
		]);
		expect(page.total).toBe(2);
		expect(page.items.map((item) => item.hiddenReason)).toEqual([
			null,
			'Spam',
		]);
	});

	it('trang chỉ có đánh giá đang hiện thì vẫn gọi tra lý do với danh sách rỗng (Repository trả ngay, không truy vấn)', async () => {
		const { service, logs } = build({
			page: { rows: [moderationListingReviewRow()], total: 1 },
		});
		await service.list({ page: 1, pageSize: 20 });
		expect(logs.findLatestListingReviewHideReasons).toHaveBeenCalledWith(
			[],
		);
	});

	it('mỗi phần tử có tin { id, code, title } và người viết { id, name }', async () => {
		const { service } = build({
			page: { rows: [moderationListingReviewRow()], total: 1 },
		});
		const page = await service.list({ page: 1, pageSize: 20 });
		expect(page.items[0]?.listing).toEqual({
			id: LISTING_ID,
			code: 'k7m2xq9a',
			title: 'Phòng 20m² gần ĐH Bách Khoa',
		});
		expect(page.items[0]?.author).toEqual({
			id: TENANT_ID,
			name: 'Bạn Lan',
		});
	});
});
