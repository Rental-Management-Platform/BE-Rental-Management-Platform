import type { ChatRepository } from '../chat/chat.repository';
import type { AccountType } from '../common/auth/account-type';
import type { PermissionKey } from '../common/auth/permission-catalog';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type {
	LandlordRow,
	LandlordsRepository,
} from '../landlords/landlords.repository';
import type { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import type { CreateReviewDto } from './dto/create-review.dto';
import type { UpdateReviewDto } from './dto/update-review.dto';
import {
	ADMIN_ID,
	CREATED,
	LANDLORD_ID,
	OTHER_ID,
	REVIEW_ID,
	TENANT_ID,
	ownReviewRow,
	publicReviewRow,
} from './reviews.fixtures';
import type { OwnReviewRow, PublicReviewRow } from './reviews.repository';
import type { ReviewsRepository } from './reviews.repository';
import { ReviewsService } from './reviews.service';

function userOf(
	userId: string,
	accountType: AccountType,
	permissions: PermissionKey[] = [],
): RequestUser {
	return { userId, sessionId: 'phien-1', accountType, permissions };
}

const TENANT = userOf(TENANT_ID, 'tenant', [
	'review:read',
	'review:create',
	'review:update',
	'review:delete',
]);
const ADMIN = userOf(ADMIN_ID, 'admin', ['review:manage']);

interface Options {
	landlord?: LandlordRow | null;
	replied?: boolean;
	inserted?: OwnReviewRow | null;
	updated?: Array<OwnReviewRow | null>;
	own?: OwnReviewRow | null;
	deleted?: boolean;
	page?: { rows: PublicReviewRow[]; total: number };
	reasons?: Map<string, string>;
}

function build(options: Options = {}) {
	// Mỗi lần gọi `updateOwnVisible` lấy một phần tử; phần tử cuối được lặp lại cho các lần gọi sau.
	const updates: Array<OwnReviewRow | null> = [
		...(options.updated ?? [ownReviewRow()]),
	];
	const nextUpdate = (): OwnReviewRow | null =>
		(updates.length > 1 ? updates.shift() : updates[0]) ?? null;
	const repository = {
		insertIfAbsent: jest.fn(() =>
			Promise.resolve(
				options.inserted === undefined
					? ownReviewRow()
					: options.inserted,
			),
		),
		updateOwnVisible: jest.fn(() => Promise.resolve(nextUpdate())),
		deleteOwn: jest.fn(() => Promise.resolve(options.deleted ?? true)),
		findOwn: jest.fn(() =>
			Promise.resolve(options.own === undefined ? null : options.own),
		),
		findPublicPage: jest.fn(() =>
			Promise.resolve(options.page ?? { rows: [], total: 0 }),
		),
	};
	const landlords = {
		findActiveLandlord: jest.fn(() =>
			Promise.resolve(
				options.landlord === undefined
					? { id: LANDLORD_ID, name: 'Anh Minh', createdAt: CREATED }
					: options.landlord,
			),
		),
	};
	const chat = {
		hasLandlordReplied: jest.fn(() =>
			Promise.resolve(options.replied ?? true),
		),
	};
	const logs = {
		findLatestReviewHideReasons: jest.fn(() =>
			Promise.resolve(options.reasons ?? new Map<string, string>()),
		),
	};
	const service = new ReviewsService(
		repository as unknown as ReviewsRepository,
		landlords as unknown as LandlordsRepository,
		chat as unknown as ChatRepository,
		logs as unknown as ModerationLogsRepository,
	);
	return { service, repository, landlords, chat, logs };
}

async function errorOf(promise: Promise<unknown>): Promise<AppException> {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(AppException);
	return error as AppException;
}

const CREATE: CreateReviewDto = { stars: 5, comment: 'Rất tốt' };

describe('ReviewsService.list (spec 0014 AC-2)', () => {
	it('chủ trọ không hợp lệ: 404 LANDLORD_NOT_FOUND và không đọc trang nào', async () => {
		const { service, repository } = build({ landlord: null });
		const error = await errorOf(
			service.list(LANDLORD_ID, { page: 1, pageSize: 20 }, undefined),
		);
		expect(error.code).toBe(ErrorCode.LANDLORD_NOT_FOUND);
		expect(repository.findPublicPage).not.toHaveBeenCalled();
	});

	it('trang 3 cỡ 10 bỏ qua 20 dòng, trả đúng total, page, pageSize', async () => {
		const { service, repository } = build({
			page: { rows: [publicReviewRow()], total: 23 },
		});
		const page = await service.list(
			LANDLORD_ID,
			{ page: 3, pageSize: 10 },
			TENANT_ID,
		);
		expect(repository.findPublicPage).toHaveBeenCalledWith(
			LANDLORD_ID,
			20,
			10,
		);
		expect(page.total).toBe(23);
		expect(page.page).toBe(3);
		expect(page.pageSize).toBe(10);
		expect(page.items).toHaveLength(1);
	});

	it('isMine: null với khách, đúng theo người xem với người đăng nhập', async () => {
		const rows = [
			publicReviewRow({ id: 'a', authorId: TENANT_ID }),
			publicReviewRow({ id: 'b', authorId: OTHER_ID }),
		];
		const { service } = build({ page: { rows, total: 2 } });
		const guest = await service.list(
			LANDLORD_ID,
			{ page: 1, pageSize: 20 },
			undefined,
		);
		expect(guest.items.map((item) => item.isMine)).toEqual([null, null]);
		const viewer = await service.list(
			LANDLORD_ID,
			{ page: 1, pageSize: 20 },
			TENANT_ID,
		);
		expect(viewer.items.map((item) => item.isMine)).toEqual([true, false]);
	});
});

describe('ReviewsService.getMine (spec 0014 AC-8)', () => {
	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn', async () => {
		const { service, landlords } = build();
		const error = await errorOf(service.getMine(ADMIN, LANDLORD_ID));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(landlords.findActiveLandlord).not.toHaveBeenCalled();
	});

	it('chủ trọ không hợp lệ: 404 LANDLORD_NOT_FOUND', async () => {
		const { service } = build({ landlord: null });
		const error = await errorOf(service.getMine(TENANT, LANDLORD_ID));
		expect(error.code).toBe(ErrorCode.LANDLORD_NOT_FOUND);
	});

	it('chưa viết và đủ điều kiện: review null, canReview true', async () => {
		const { service, repository, chat } = build({ replied: true });
		await expect(service.getMine(TENANT, LANDLORD_ID)).resolves.toEqual({
			review: null,
			canReview: true,
		});
		expect(repository.findOwn).toHaveBeenCalledWith(TENANT_ID, LANDLORD_ID);
		expect(chat.hasLandlordReplied).toHaveBeenCalledWith(
			TENANT_ID,
			LANDLORD_ID,
		);
	});

	it('chưa viết nhưng chủ trọ chưa trả lời: canReview false', async () => {
		const { service } = build({ replied: false });
		const state = await service.getMine(TENANT, LANDLORD_ID);
		expect(state).toEqual({ review: null, canReview: false });
	});

	it('đã viết: trả đánh giá của mình, canReview false và không tra chat', async () => {
		const { service, chat } = build({ own: ownReviewRow() });
		const state = await service.getMine(TENANT, LANDLORD_ID);
		expect(state.canReview).toBe(false);
		expect(state.review).toMatchObject({
			id: REVIEW_ID,
			status: 'visible',
			hiddenReason: null,
		});
		expect(chat.hasLandlordReplied).not.toHaveBeenCalled();
	});

	it('đang bị ẩn: kèm lý do ẩn gần nhất từ moderation_logs, một truy vấn cho id đó', async () => {
		const { service, logs } = build({
			own: ownReviewRow({ status: 'hidden_by_admin' }),
			reasons: new Map([[REVIEW_ID, 'Nội dung xúc phạm cá nhân.']]),
		});
		const state = await service.getMine(TENANT, LANDLORD_ID);
		expect(logs.findLatestReviewHideReasons).toHaveBeenCalledWith([
			REVIEW_ID,
		]);
		expect(state.review?.status).toBe('hidden_by_admin');
		expect(state.review?.hiddenReason).toBe('Nội dung xúc phạm cá nhân.');
	});

	it('đang hiện thì không tra lý do ẩn', async () => {
		const { service, logs } = build({ own: ownReviewRow() });
		await service.getMine(TENANT, LANDLORD_ID);
		expect(logs.findLatestReviewHideReasons).not.toHaveBeenCalled();
	});

	it('thiếu review:create trong token thì canReview false và không tra chat', async () => {
		const { service, chat } = build({ replied: true });
		const readOnly = userOf(TENANT_ID, 'tenant', ['review:read']);
		const state = await service.getMine(readOnly, LANDLORD_ID);
		expect(state.canReview).toBe(false);
		expect(chat.hasLandlordReplied).not.toHaveBeenCalled();
	});

	it('review:manage trong token cũng tính là có review:create', async () => {
		const { service } = build({ replied: true });
		const manager = userOf(TENANT_ID, 'tenant', ['review:manage']);
		expect((await service.getMine(manager, LANDLORD_ID)).canReview).toBe(
			true,
		);
	});

	it('là chính chủ trọ đó (được cấp quyền): canReview false và không tra chat', async () => {
		const { service, chat } = build({ replied: true });
		const self = userOf(LANDLORD_ID, 'landlord', ['review:create']);
		const state = await service.getMine(self, LANDLORD_ID);
		expect(state.canReview).toBe(false);
		expect(chat.hasLandlordReplied).not.toHaveBeenCalled();
	});
});

describe('ReviewsService.create (spec 0014 AC-3 đến AC-5)', () => {
	it('ghi đúng (người trong token, chủ trọ ở đường dẫn, sao, nhận xét) và trả đánh giá với lý do ẩn null', async () => {
		const { service, repository } = build();
		const created = await service.create(TENANT, LANDLORD_ID, CREATE);
		expect(repository.insertIfAbsent).toHaveBeenCalledWith(
			TENANT_ID,
			LANDLORD_ID,
			5,
			'Rất tốt',
		);
		expect(created).toMatchObject({
			id: REVIEW_ID,
			status: 'visible',
			hiddenReason: null,
		});
	});

	it.each([
		['vắng', undefined],
		['null', null],
	])(
		'nhận xét %s thì ghi null (không có nhận xét)',
		async (_name, comment) => {
			const { service, repository } = build();
			await service.create(TENANT, LANDLORD_ID, { stars: 3, comment });
			expect(repository.insertIfAbsent).toHaveBeenCalledWith(
				TENANT_ID,
				LANDLORD_ID,
				3,
				null,
			);
		},
	);

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn và không ghi dòng nào', async () => {
		const { service, repository, landlords, chat } = build();
		const error = await errorOf(service.create(ADMIN, LANDLORD_ID, CREATE));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(landlords.findActiveLandlord).not.toHaveBeenCalled();
		expect(chat.hasLandlordReplied).not.toHaveBeenCalled();
		expect(repository.insertIfAbsent).not.toHaveBeenCalled();
	});

	it('tự đánh giá chính mình: 409 CANNOT_REVIEW_SELF, kiểm bằng so id trước khi tra DB', async () => {
		const { service, repository, landlords, chat } = build();
		const self = userOf(LANDLORD_ID, 'landlord', ['review:create']);
		const error = await errorOf(service.create(self, LANDLORD_ID, CREATE));
		expect(error.code).toBe(ErrorCode.CANNOT_REVIEW_SELF);
		expect(landlords.findActiveLandlord).not.toHaveBeenCalled();
		expect(chat.hasLandlordReplied).not.toHaveBeenCalled();
		expect(repository.insertIfAbsent).not.toHaveBeenCalled();
	});

	it('chủ trọ không hợp lệ: 404 LANDLORD_NOT_FOUND, không tra chat, không ghi', async () => {
		const { service, repository, chat } = build({ landlord: null });
		const error = await errorOf(
			service.create(TENANT, LANDLORD_ID, CREATE),
		);
		expect(error.code).toBe(ErrorCode.LANDLORD_NOT_FOUND);
		expect(chat.hasLandlordReplied).not.toHaveBeenCalled();
		expect(repository.insertIfAbsent).not.toHaveBeenCalled();
	});

	it('chưa đủ điều kiện (chủ trọ chưa trả lời): 403 REVIEW_NOT_ELIGIBLE và không ghi dòng nào', async () => {
		const { service, repository, chat } = build({ replied: false });
		const error = await errorOf(
			service.create(TENANT, LANDLORD_ID, CREATE),
		);
		expect(error.code).toBe(ErrorCode.REVIEW_NOT_ELIGIBLE);
		expect(chat.hasLandlordReplied).toHaveBeenCalledWith(
			TENANT_ID,
			LANDLORD_ID,
		);
		expect(repository.insertIfAbsent).not.toHaveBeenCalled();
	});

	it('cặp đã có đánh giá (INSERT không trả dòng): 409 REVIEW_ALREADY_EXISTS', async () => {
		const { service } = build({ inserted: null });
		const error = await errorOf(
			service.create(TENANT, LANDLORD_ID, CREATE),
		);
		expect(error.code).toBe(ErrorCode.REVIEW_ALREADY_EXISTS);
	});

	it('thứ tự kiểm lỗi: admin, tự đánh giá, chủ trọ hợp lệ, đủ điều kiện, trùng', async () => {
		// Vừa tự đánh giá vừa chưa đủ điều kiện: tự đánh giá thắng.
		const self = userOf(LANDLORD_ID, 'landlord', ['review:create']);
		const a = build({ replied: false, landlord: null });
		expect(
			(await errorOf(a.service.create(self, LANDLORD_ID, CREATE))).code,
		).toBe(ErrorCode.CANNOT_REVIEW_SELF);
		// Chủ trọ không hợp lệ thắng việc chưa đủ điều kiện.
		const b = build({ replied: false, landlord: null });
		expect(
			(await errorOf(b.service.create(TENANT, LANDLORD_ID, CREATE))).code,
		).toBe(ErrorCode.LANDLORD_NOT_FOUND);
		// Chưa đủ điều kiện thắng trùng cặp.
		const c = build({ replied: false, inserted: null });
		expect(
			(await errorOf(c.service.create(TENANT, LANDLORD_ID, CREATE))).code,
		).toBe(ErrorCode.REVIEW_NOT_ELIGIBLE);
	});
});

describe('ReviewsService.update (spec 0014 AC-6)', () => {
	it('sửa đúng cặp (người trong token, chủ trọ ở đường dẫn) và trả đánh giá mới', async () => {
		const updated = ownReviewRow({ stars: 2 });
		const { service, repository, chat } = build({ updated: [updated] });
		const dto: UpdateReviewDto = { stars: 2 };
		await expect(
			service.update(TENANT, LANDLORD_ID, dto),
		).resolves.toMatchObject({
			id: REVIEW_ID,
			stars: 2,
			status: 'visible',
		});
		expect(repository.updateOwnVisible).toHaveBeenCalledWith(
			TENANT_ID,
			LANDLORD_ID,
			{ stars: 2, comment: undefined },
		);
		// Điều kiện chat chỉ kiểm lúc tạo, không kiểm lại khi sửa.
		expect(chat.hasLandlordReplied).not.toHaveBeenCalled();
	});

	it('comment null được chuyển nguyên xuống Repository (xóa nhận xét), khác với vắng (giữ nguyên)', async () => {
		const { service, repository } = build();
		await service.update(TENANT, LANDLORD_ID, { comment: null });
		expect(repository.updateOwnVisible).toHaveBeenCalledWith(
			TENANT_ID,
			LANDLORD_ID,
			{ stars: undefined, comment: null },
		);
	});

	it('admin: 403 PERMISSION_DENIED và không sửa dòng nào', async () => {
		const { service, repository } = build();
		const error = await errorOf(
			service.update(ADMIN, LANDLORD_ID, { stars: 1 }),
		);
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.updateOwnVisible).not.toHaveBeenCalled();
	});

	it('chủ trọ không hợp lệ: 404 LANDLORD_NOT_FOUND và không sửa', async () => {
		const { service, repository } = build({ landlord: null });
		const error = await errorOf(
			service.update(TENANT, LANDLORD_ID, { stars: 1 }),
		);
		expect(error.code).toBe(ErrorCode.LANDLORD_NOT_FOUND);
		expect(repository.updateOwnVisible).not.toHaveBeenCalled();
	});

	it('chưa có đánh giá (UPDATE không đổi dòng, tra không thấy): 404 REVIEW_NOT_FOUND', async () => {
		const { service, repository } = build({ updated: [null], own: null });
		const error = await errorOf(
			service.update(TENANT, LANDLORD_ID, { stars: 1 }),
		);
		expect(error.code).toBe(ErrorCode.REVIEW_NOT_FOUND);
		expect(repository.findOwn).toHaveBeenCalledWith(TENANT_ID, LANDLORD_ID);
	});

	it('đang bị admin ẩn: 409 REVIEW_HIDDEN', async () => {
		const { service } = build({
			updated: [null],
			own: ownReviewRow({ status: 'hidden_by_admin' }),
		});
		const error = await errorOf(
			service.update(TENANT, LANDLORD_ID, { stars: 1 }),
		);
		expect(error.code).toBe(ErrorCode.REVIEW_HIDDEN);
	});

	it('admin gỡ ẩn ngay giữa câu UPDATE và câu tra: thử sửa lại một lần thay vì báo sai là đang ẩn', async () => {
		const retried = ownReviewRow({ stars: 1 });
		const { service, repository } = build({
			updated: [null, retried],
			own: ownReviewRow({ status: 'visible' }),
		});
		await expect(
			service.update(TENANT, LANDLORD_ID, { stars: 1 }),
		).resolves.toMatchObject({ stars: 1 });
		expect(repository.updateOwnVisible).toHaveBeenCalledTimes(2);
	});

	it('thử lại vẫn không đổi dòng nào (bị ẩn lại ngay): 409 REVIEW_HIDDEN, không thử lần ba', async () => {
		const { service, repository } = build({
			updated: [null, null],
			own: ownReviewRow({ status: 'visible' }),
		});
		const error = await errorOf(
			service.update(TENANT, LANDLORD_ID, { stars: 1 }),
		);
		expect(error.code).toBe(ErrorCode.REVIEW_HIDDEN);
		expect(repository.updateOwnVisible).toHaveBeenCalledTimes(2);
	});
});

describe('ReviewsService.remove (spec 0014 AC-7)', () => {
	it('xóa đúng cặp của người trong token', async () => {
		const { service, repository } = build();
		await expect(
			service.remove(TENANT, LANDLORD_ID),
		).resolves.toBeUndefined();
		expect(repository.deleteOwn).toHaveBeenCalledWith(
			TENANT_ID,
			LANDLORD_ID,
		);
	});

	it('chưa có đánh giá: 404 REVIEW_NOT_FOUND', async () => {
		const { service } = build({ deleted: false });
		const error = await errorOf(service.remove(TENANT, LANDLORD_ID));
		expect(error.code).toBe(ErrorCode.REVIEW_NOT_FOUND);
	});

	it('admin: 403 PERMISSION_DENIED và không xóa dòng nào', async () => {
		const { service, repository } = build();
		const error = await errorOf(service.remove(ADMIN, LANDLORD_ID));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.deleteOwn).not.toHaveBeenCalled();
	});

	it('chủ trọ không hợp lệ: 404 LANDLORD_NOT_FOUND và không xóa', async () => {
		const { service, repository } = build({ landlord: null });
		const error = await errorOf(service.remove(TENANT, LANDLORD_ID));
		expect(error.code).toBe(ErrorCode.LANDLORD_NOT_FOUND);
		expect(repository.deleteOwn).not.toHaveBeenCalled();
	});
});
