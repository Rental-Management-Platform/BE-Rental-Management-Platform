import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import type { Prisma } from '../generated/prisma/client';
import type { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import type { ModerationListingsQueryDto } from './dto/listing-queries.dto';
import { ListingModerationService } from './listing-moderation.service';
import { LANDLORD_ID, LISTING_ID, publicSummaryRow } from './listings.fixtures';
import type { ListingsRepository } from './listings.repository';

const ADMIN_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8daa';
const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;

/** Các lần gọi của một mock dưới dạng mảng đối số có kiểu `unknown` (tránh `any` của jest). */
function argsOf(mock: jest.Mock): unknown[][] {
	return mock.mock.calls as unknown[][];
}

interface Harness {
	service: ListingModerationService;
	repository: Record<
		| 'transition'
		| 'findStatus'
		| 'findModerationRow'
		| 'findModerationPage',
		jest.Mock
	>;
	logs: Record<'add' | 'findLatestListingHideReasons', jest.Mock>;
	transactions: { run: jest.Mock };
}

function build(
	options: {
		moved?: boolean;
		status?: string | null;
		row?: ReturnType<typeof publicSummaryRow> | null;
		reasons?: Map<string, string>;
		page?: { rows: ReturnType<typeof publicSummaryRow>[]; total: number };
	} = {},
): Harness {
	const repository = {
		transition: jest.fn(() => Promise.resolve(options.moved ?? true)),
		findStatus: jest.fn(() =>
			Promise.resolve(
				options.status === undefined ? 'visible' : options.status,
			),
		),
		findModerationRow: jest.fn(() =>
			Promise.resolve(
				options.row === undefined ? publicSummaryRow() : options.row,
			),
		),
		findModerationPage: jest.fn(() =>
			Promise.resolve(options.page ?? { rows: [], total: 0 }),
		),
	};
	const logs = {
		add: jest.fn(() => Promise.resolve()),
		findLatestListingHideReasons: jest.fn(() =>
			Promise.resolve(options.reasons ?? new Map<string, string>()),
		),
	};
	const transactions = {
		run: jest.fn((fn: (client: Prisma.TransactionClient) => unknown) =>
			Promise.resolve(fn(tx)),
		),
	};
	const service = new ListingModerationService(
		repository as unknown as ListingsRepository,
		logs as unknown as ModerationLogsRepository,
		transactions as unknown as TransactionRunner,
	);
	return { service, repository, logs, transactions };
}

async function codeOf(promise: Promise<unknown>): Promise<ErrorCode> {
	try {
		await promise;
	} catch (error: unknown) {
		if (error instanceof AppException) return error.code;
		throw error;
	}
	throw new Error('Mong đợi một AppException nhưng không có lỗi nào');
}

describe('ListingModerationService.hide (spec 0002 AC-9)', () => {
	it('chuyển visible hoặc hidden_by_owner sang hidden_by_admin bằng MỘT câu có điều kiện nguồn, trong giao dịch', async () => {
		const h = build({
			row: publicSummaryRow({ status: 'hidden_by_admin' }),
			reasons: new Map([[LISTING_ID, 'Ảnh không đúng thực tế']]),
		});
		await h.service.hide(ADMIN_ID, LISTING_ID, 'Ảnh không đúng thực tế');
		expect(argsOf(h.repository.transition)).toEqual([
			[LISTING_ID, ['visible', 'hidden_by_owner'], 'hidden_by_admin', tx],
		]);
		expect(h.transactions.run).toHaveBeenCalledTimes(1);
	});

	it('ghi đúng một dòng lịch sử cùng giao dịch: người ẩn, tin, hành động và lý do', async () => {
		const h = build();
		await h.service.hide(ADMIN_ID, LISTING_ID, 'Spam');
		expect(argsOf(h.logs.add)).toEqual([
			[
				{
					actorId: ADMIN_ID,
					targetType: 'listing',
					targetId: LISTING_ID,
					action: 'hide_listing',
					reason: 'Spam',
				},
				tx,
			],
		]);
	});

	it('trả mục kiểm duyệt có trạng thái mới và lý do vừa ghi', async () => {
		const h = build({
			row: publicSummaryRow({ status: 'hidden_by_admin' }),
			reasons: new Map([[LISTING_ID, 'Spam']]),
		});
		const item = await h.service.hide(ADMIN_ID, LISTING_ID, 'Spam');
		expect(item.status).toBe('hidden_by_admin');
		expect(item.moderationReason).toBe('Spam');
		expect(item.landlord).toEqual({ id: LANDLORD_ID, name: 'Anh Nam' });
		expect(item.viewCount).toBe(7);
	});

	it('câu lệnh không đổi dòng nào (đã bị admin ẩn) thì KHÔNG ghi lịch sử và báo 409 LISTING_STATE_INVALID', async () => {
		const h = build({ moved: false, status: 'hidden_by_admin' });
		expect(await codeOf(h.service.hide(ADMIN_ID, LISTING_ID, 'x'))).toBe(
			ErrorCode.LISTING_STATE_INVALID,
		);
		expect(h.logs.add).not.toHaveBeenCalled();
		expect(h.repository.findModerationRow).not.toHaveBeenCalled();
	});

	it('tin không có hoặc đã xóa mềm thì 404 LISTING_NOT_FOUND và không ghi lịch sử', async () => {
		const h = build({ moved: false, status: null });
		expect(await codeOf(h.service.hide(ADMIN_ID, LISTING_ID, 'x'))).toBe(
			ErrorCode.LISTING_NOT_FOUND,
		);
		expect(h.logs.add).not.toHaveBeenCalled();
	});

	it('ghi lịch sử lỗi thì lỗi nổi lên (giao dịch hủy), không đọc lại mục', async () => {
		const h = build();
		h.logs.add.mockRejectedValueOnce(new Error('db down'));
		await expect(h.service.hide(ADMIN_ID, LISTING_ID, 'x')).rejects.toThrow(
			'db down',
		);
		expect(h.repository.findModerationRow).not.toHaveBeenCalled();
	});
});

describe('ListingModerationService.unhide (spec 0002 AC-9)', () => {
	it('chuyển hidden_by_admin về hidden_by_owner (không về visible) trong giao dịch', async () => {
		const h = build({
			row: publicSummaryRow({ status: 'hidden_by_owner' }),
		});
		await h.service.unhide(ADMIN_ID, LISTING_ID, 'Đã sửa lại tin');
		expect(argsOf(h.repository.transition)).toEqual([
			[LISTING_ID, ['hidden_by_admin'], 'hidden_by_owner', tx],
		]);
	});

	it('ghi một dòng unhide_listing kèm lý do', async () => {
		const h = build({
			row: publicSummaryRow({ status: 'hidden_by_owner' }),
		});
		await h.service.unhide(ADMIN_ID, LISTING_ID, 'Đã sửa lại tin');
		expect(argsOf(h.logs.add)).toEqual([
			[
				{
					actorId: ADMIN_ID,
					targetType: 'listing',
					targetId: LISTING_ID,
					action: 'unhide_listing',
					reason: 'Đã sửa lại tin',
				},
				tx,
			],
		]);
	});

	it('mục trả về không còn lý do ẩn và không tra lịch sử khi tin đã hidden_by_owner', async () => {
		const h = build({
			row: publicSummaryRow({ status: 'hidden_by_owner' }),
		});
		const item = await h.service.unhide(ADMIN_ID, LISTING_ID, 'ok');
		expect(item.status).toBe('hidden_by_owner');
		expect(item.moderationReason).toBeNull();
		expect(h.logs.findLatestListingHideReasons).not.toHaveBeenCalled();
	});

	it('tin không ở hidden_by_admin thì 409 LISTING_STATE_INVALID, không ghi lịch sử', async () => {
		const h = build({ moved: false, status: 'visible' });
		expect(await codeOf(h.service.unhide(ADMIN_ID, LISTING_ID, 'x'))).toBe(
			ErrorCode.LISTING_STATE_INVALID,
		);
		expect(h.logs.add).not.toHaveBeenCalled();
	});

	it('tin không có thì 404 LISTING_NOT_FOUND', async () => {
		const h = build({ moved: false, status: null });
		expect(await codeOf(h.service.unhide(ADMIN_ID, LISTING_ID, 'x'))).toBe(
			ErrorCode.LISTING_NOT_FOUND,
		);
	});
});

describe('ListingModerationService.list (spec 0002 AC-9)', () => {
	function query(
		overrides: Partial<ModerationListingsQueryDto> = {},
	): ModerationListingsQueryDto {
		return { page: 2, pageSize: 10, ...overrides };
	}

	it('chuyển bộ lọc xuống Repository: trạng thái, chủ trọ, từ khóa bỏ dấu cắt từ, cùng skip và take', async () => {
		const h = build();
		await h.service.list(
			query({
				status: 'hidden_by_admin',
				landlordId: LANDLORD_ID,
				q: 'Phòng ĐẸP Bến Thành',
			}),
		);
		expect(argsOf(h.repository.findModerationPage)).toEqual([
			[
				{
					status: 'hidden_by_admin',
					landlordId: LANDLORD_ID,
					searchWords: ['phong', 'dep', 'ben', 'thanh'],
				},
				10,
				10,
			],
		]);
	});

	it('không có bộ lọc thì không từ khóa nào', async () => {
		const h = build();
		await h.service.list(query({ page: 1 }));
		const [filter] = argsOf(h.repository.findModerationPage)[0];
		expect(filter).toEqual({
			status: undefined,
			landlordId: undefined,
			searchWords: [],
		});
	});

	it('trả { items, total, page, pageSize } và chỉ tra lý do ẩn cho tin hidden_by_admin của trang', async () => {
		const hidden = publicSummaryRow({
			id: 'listing-hidden',
			status: 'hidden_by_admin',
		});
		const visible = publicSummaryRow({ id: 'listing-visible' });
		const h = build({
			page: { rows: [hidden, visible], total: 42 },
			reasons: new Map([['listing-hidden', 'Lừa đảo']]),
		});
		const result = await h.service.list(query());
		expect(argsOf(h.logs.findLatestListingHideReasons)).toEqual([
			[['listing-hidden']],
		]);
		expect(result.total).toBe(42);
		expect(result.page).toBe(2);
		expect(result.pageSize).toBe(10);
		expect(
			result.items.map((i) => [i.id, i.status, i.moderationReason]),
		).toEqual([
			['listing-hidden', 'hidden_by_admin', 'Lừa đảo'],
			['listing-visible', 'visible', null],
		]);
	});

	it('lý do ẩn cũ không dính vào tin đã được gỡ ẩn', async () => {
		const h = build({
			page: {
				rows: [publicSummaryRow({ status: 'hidden_by_owner' })],
				total: 1,
			},
			reasons: new Map([[LISTING_ID, 'Lý do cũ']]),
		});
		const result = await h.service.list(query());
		expect(result.items[0].moderationReason).toBeNull();
	});
});
