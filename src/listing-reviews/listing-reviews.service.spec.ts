import type { ChatRepository } from '../chat/chat.repository';
import type { AccountType } from '../common/auth/account-type';
import type { PermissionKey } from '../common/auth/permission-catalog';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { ListingsRepository } from '../listings/listings.repository';
import type { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import type { CreateReviewDto } from '../reviews/dto/create-review.dto';
import type { UpdateReviewDto } from '../reviews/dto/update-review.dto';
import {
	ADMIN_ID,
	LANDLORD_ID,
	OTHER_ID,
	REVIEW_ID,
	TENANT_ID,
	ownReviewRow,
	publicReviewRow,
} from '../reviews/reviews.fixtures';
import type { OwnReviewRow } from '../reviews/reviews.repository';
import type { SettingsService } from '../settings/settings.service';
import type {
	ListingReviewsRepository,
	PublicListingReviewRow,
} from './listing-reviews.repository';
import { ListingReviewsService } from './listing-reviews.service';

const LISTING_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d09';

/** Đồng hồ cố định: Service nhận `now` từ controller, không tự lấy giờ. */
const NOW = new Date('2026-11-09T03:00:00.000Z');

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
	visible?: boolean;
	/** `undefined` là chủ trọ mặc định; `null` là tin biến mất đúng giữa hai câu. */
	landlordId?: string | null;
	replied?: boolean;
	inserted?: OwnReviewRow | null;
	updated?: Array<OwnReviewRow | null>;
	own?: OwnReviewRow | null;
	deleted?: boolean;
	page?: { rows: PublicListingReviewRow[]; total: number };
	reasons?: Map<string, string>;
	trialListingLimit?: number;
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
	const listings = {
		isPubliclyVisible: jest.fn(() =>
			Promise.resolve(options.visible ?? true),
		),
		findLandlordIdOf: jest.fn(() =>
			Promise.resolve(
				options.landlordId === undefined
					? LANDLORD_ID
					: options.landlordId,
			),
		),
	};
	const chat = {
		hasLandlordRepliedOnListing: jest.fn(() =>
			Promise.resolve(options.replied ?? true),
		),
	};
	const logs = {
		findLatestListingReviewHideReasons: jest.fn(() =>
			Promise.resolve(options.reasons ?? new Map<string, string>()),
		),
	};
	const settings = {
		getValue: jest.fn(() =>
			Promise.resolve(options.trialListingLimit ?? 2),
		),
	};
	const service = new ListingReviewsService(
		repository as unknown as ListingReviewsRepository,
		listings as unknown as ListingsRepository,
		chat as unknown as ChatRepository,
		logs as unknown as ModerationLogsRepository,
		settings as unknown as SettingsService,
	);
	return { service, repository, listings, chat, logs, settings };
}

async function errorOf(promise: Promise<unknown>): Promise<AppException> {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(AppException);
	return error as AppException;
}

const CREATE: CreateReviewDto = { stars: 5, comment: 'Rất tốt' };

describe('ListingReviewsService.list (spec 0015 AC-2, AC-10)', () => {
	it('tin không hiện công khai: 404 LISTING_NOT_FOUND và không đọc trang nào', async () => {
		const { service, repository } = build({ visible: false });
		const error = await errorOf(
			service.list(LISTING_ID, { page: 1, pageSize: 20 }, undefined, NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_NOT_FOUND);
		expect(repository.findPublicPage).not.toHaveBeenCalled();
	});

	it('luật hiển thị nhận đúng `now` của request và hạn mức dùng thử đọc một lần từ settings', async () => {
		const { service, listings, settings } = build({ trialListingLimit: 3 });
		await service.list(
			LISTING_ID,
			{ page: 1, pageSize: 20 },
			undefined,
			NOW,
		);
		expect(settings.getValue).toHaveBeenCalledTimes(1);
		expect(settings.getValue).toHaveBeenCalledWith('trial_listing_limit');
		expect(listings.isPubliclyVisible).toHaveBeenCalledTimes(1);
		expect(listings.isPubliclyVisible).toHaveBeenCalledWith(LISTING_ID, {
			now: NOW,
			trialListingLimit: 3,
		});
	});

	it('trang 3 cỡ 10 bỏ qua 20 dòng, đúng tin, trả đúng total, page, pageSize', async () => {
		const { service, repository } = build({
			page: { rows: [publicReviewRow()], total: 23 },
		});
		const page = await service.list(
			LISTING_ID,
			{ page: 3, pageSize: 10 },
			TENANT_ID,
			NOW,
		);
		expect(repository.findPublicPage).toHaveBeenCalledWith(
			LISTING_ID,
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
		const query = { page: 1, pageSize: 20 };
		const guest = await service.list(LISTING_ID, query, undefined, NOW);
		expect(guest.items.map((item) => item.isMine)).toEqual([null, null]);
		const viewer = await service.list(LISTING_ID, query, TENANT_ID, NOW);
		expect(viewer.items.map((item) => item.isMine)).toEqual([true, false]);
	});

	it('phần tử không có id người viết, trạng thái, email hay số điện thoại', async () => {
		const { service } = build({
			page: { rows: [publicReviewRow()], total: 1 },
		});
		const page = await service.list(
			LISTING_ID,
			{ page: 1, pageSize: 20 },
			TENANT_ID,
			NOW,
		);
		expect(Object.keys(page.items[0] ?? {}).sort()).toEqual([
			'author',
			'comment',
			'createdAt',
			'id',
			'isMine',
			'stars',
			'updatedAt',
		]);
		expect(Object.keys(page.items[0]?.author ?? {})).toEqual(['name']);
	});
});

describe('ListingReviewsService.getMine (spec 0015 AC-8)', () => {
	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn', async () => {
		const { service, listings, repository } = build();
		const error = await errorOf(service.getMine(ADMIN, LISTING_ID, NOW));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(listings.isPubliclyVisible).not.toHaveBeenCalled();
		expect(repository.findOwn).not.toHaveBeenCalled();
	});

	it('tin không hiện công khai: 404 LISTING_NOT_FOUND và không đọc đánh giá', async () => {
		const { service, repository } = build({ visible: false });
		const error = await errorOf(service.getMine(TENANT, LISTING_ID, NOW));
		expect(error.code).toBe(ErrorCode.LISTING_NOT_FOUND);
		expect(repository.findOwn).not.toHaveBeenCalled();
	});

	it('chưa viết và đủ điều kiện: review null, canReview true, chat tra đúng cặp (người gọi, tin)', async () => {
		const { service, chat, repository } = build({ replied: true });
		await expect(service.getMine(TENANT, LISTING_ID, NOW)).resolves.toEqual(
			{
				review: null,
				canReview: true,
			},
		);
		expect(repository.findOwn).toHaveBeenCalledWith(TENANT_ID, LISTING_ID);
		expect(chat.hasLandlordRepliedOnListing).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
		);
	});

	it('chưa viết nhưng chủ trọ chưa trả lời về tin này: canReview false', async () => {
		const { service } = build({ replied: false });
		await expect(service.getMine(TENANT, LISTING_ID, NOW)).resolves.toEqual(
			{
				review: null,
				canReview: false,
			},
		);
	});

	it('đã viết: trả đánh giá của mình, canReview false, không tra chat và không tra chủ trọ', async () => {
		const own = ownReviewRow();
		const { service, chat, listings } = build({ own });
		const state = await service.getMine(TENANT, LISTING_ID, NOW);
		expect(state.canReview).toBe(false);
		expect(state.review).toMatchObject({
			id: REVIEW_ID,
			stars: own.stars,
			status: 'visible',
			hiddenReason: null,
		});
		expect(chat.hasLandlordRepliedOnListing).not.toHaveBeenCalled();
		expect(listings.findLandlordIdOf).not.toHaveBeenCalled();
	});

	it('đang bị ẩn: kèm lý do ẩn gần nhất của đánh giá phòng, một truy vấn cho id đó', async () => {
		const own = ownReviewRow({ status: 'hidden_by_admin' });
		const { service, logs } = build({
			own,
			reasons: new Map([[REVIEW_ID, 'Nội dung xúc phạm.']]),
		});
		const state = await service.getMine(TENANT, LISTING_ID, NOW);
		expect(logs.findLatestListingReviewHideReasons).toHaveBeenCalledWith([
			REVIEW_ID,
		]);
		expect(state.review).toMatchObject({
			status: 'hidden_by_admin',
			hiddenReason: 'Nội dung xúc phạm.',
		});
		expect(state.canReview).toBe(false);
	});

	it('đang hiện thì không tra lý do ẩn', async () => {
		const { service, logs } = build({ own: ownReviewRow() });
		await service.getMine(TENANT, LISTING_ID, NOW);
		expect(logs.findLatestListingReviewHideReasons).not.toHaveBeenCalled();
	});

	it('thiếu review:create trong token thì canReview false, không tra chủ trọ và không tra chat', async () => {
		const reader = userOf(TENANT_ID, 'tenant', ['review:read']);
		const { service, chat, listings } = build();
		await expect(service.getMine(reader, LISTING_ID, NOW)).resolves.toEqual(
			{
				review: null,
				canReview: false,
			},
		);
		expect(listings.findLandlordIdOf).not.toHaveBeenCalled();
		expect(chat.hasLandlordRepliedOnListing).not.toHaveBeenCalled();
	});

	it('review:manage trong token cũng tính là có review:create', async () => {
		const manager = userOf(TENANT_ID, 'tenant', [
			'review:read',
			'review:manage',
		]);
		const { service } = build();
		await expect(
			service.getMine(manager, LISTING_ID, NOW),
		).resolves.toEqual({
			review: null,
			canReview: true,
		});
	});

	it('là chủ trọ của tin (được cấp quyền): canReview false và không tra chat', async () => {
		const landlord = userOf(LANDLORD_ID, 'landlord', [
			'review:read',
			'review:create',
		]);
		const { service, chat } = build();
		await expect(
			service.getMine(landlord, LISTING_ID, NOW),
		).resolves.toEqual({ review: null, canReview: false });
		expect(chat.hasLandlordRepliedOnListing).not.toHaveBeenCalled();
	});
});

describe('ListingReviewsService.create (spec 0015 AC-3 đến AC-5)', () => {
	it('ghi đúng (người trong token, tin ở đường dẫn, sao, nhận xét) và trả đánh giá với lý do ẩn null', async () => {
		const { service, repository } = build();
		const created = await service.create(TENANT, LISTING_ID, CREATE, NOW);
		expect(repository.insertIfAbsent).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
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
		[{ stars: 3 }, null],
		[{ stars: 3, comment: null }, null],
		[{ stars: 3, comment: 'Ổn' }, 'Ổn'],
	])('body %j: nhận xét xuống Repository là %j', async (dto, comment) => {
		const { service, repository } = build();
		await service.create(TENANT, LISTING_ID, dto, NOW);
		expect(repository.insertIfAbsent).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
			3,
			comment,
		);
	});

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn và không ghi dòng nào', async () => {
		const { service, repository, listings, chat } = build();
		const error = await errorOf(
			service.create(ADMIN, LISTING_ID, CREATE, NOW),
		);
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(listings.isPubliclyVisible).not.toHaveBeenCalled();
		expect(chat.hasLandlordRepliedOnListing).not.toHaveBeenCalled();
		expect(repository.insertIfAbsent).not.toHaveBeenCalled();
	});

	it('tin không hiện công khai: 404 LISTING_NOT_FOUND, không tra chủ trọ, không tra chat, không ghi', async () => {
		const { service, repository, listings, chat } = build({
			visible: false,
		});
		const error = await errorOf(
			service.create(TENANT, LISTING_ID, CREATE, NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_NOT_FOUND);
		expect(listings.findLandlordIdOf).not.toHaveBeenCalled();
		expect(chat.hasLandlordRepliedOnListing).not.toHaveBeenCalled();
		expect(repository.insertIfAbsent).not.toHaveBeenCalled();
	});

	it('chủ trọ của tin đánh giá phòng của mình: 409 CANNOT_REVIEW_SELF, trước điều kiện chat và không ghi', async () => {
		const landlord = userOf(LANDLORD_ID, 'landlord', ['review:create']);
		const { service, repository, chat } = build();
		const error = await errorOf(
			service.create(landlord, LISTING_ID, CREATE, NOW),
		);
		expect(error.code).toBe(ErrorCode.CANNOT_REVIEW_SELF);
		expect(chat.hasLandlordRepliedOnListing).not.toHaveBeenCalled();
		expect(repository.insertIfAbsent).not.toHaveBeenCalled();
	});

	it('tin biến mất đúng giữa hai câu (không còn chủ trọ để so): 404 LISTING_NOT_FOUND, không ghi', async () => {
		const { service, repository } = build({ landlordId: null });
		const error = await errorOf(
			service.create(TENANT, LISTING_ID, CREATE, NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_NOT_FOUND);
		expect(repository.insertIfAbsent).not.toHaveBeenCalled();
	});

	it('chưa đủ điều kiện (chủ trọ chưa trả lời về CHÍNH tin này): 403 LISTING_REVIEW_NOT_ELIGIBLE và không ghi dòng nào', async () => {
		const { service, repository, chat } = build({ replied: false });
		const error = await errorOf(
			service.create(TENANT, LISTING_ID, CREATE, NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_NOT_ELIGIBLE);
		expect(chat.hasLandlordRepliedOnListing).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
		);
		expect(repository.insertIfAbsent).not.toHaveBeenCalled();
	});

	it('cặp đã có đánh giá (INSERT không trả dòng): 409 LISTING_REVIEW_ALREADY_EXISTS', async () => {
		const { service } = build({ inserted: null });
		const error = await errorOf(
			service.create(TENANT, LISTING_ID, CREATE, NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_ALREADY_EXISTS);
	});

	it('thứ tự kiểm lỗi: admin, tin hiện công khai, tự đánh giá, đủ điều kiện, trùng', async () => {
		// Mỗi lần bỏ một cửa ở đầu thì lỗi của cửa kế tiếp lộ ra.
		const landlord = userOf(LANDLORD_ID, 'landlord', ['review:create']);
		const all = build({ visible: false, replied: false, inserted: null });
		expect(
			(await errorOf(all.service.create(ADMIN, LISTING_ID, CREATE, NOW)))
				.code,
		).toBe(ErrorCode.PERMISSION_DENIED);
		expect(
			(
				await errorOf(
					all.service.create(landlord, LISTING_ID, CREATE, NOW),
				)
			).code,
		).toBe(ErrorCode.LISTING_NOT_FOUND);

		const visible = build({ replied: false, inserted: null });
		expect(
			(
				await errorOf(
					visible.service.create(landlord, LISTING_ID, CREATE, NOW),
				)
			).code,
		).toBe(ErrorCode.CANNOT_REVIEW_SELF);
		expect(
			(
				await errorOf(
					visible.service.create(TENANT, LISTING_ID, CREATE, NOW),
				)
			).code,
		).toBe(ErrorCode.LISTING_REVIEW_NOT_ELIGIBLE);

		const eligible = build({ inserted: null });
		expect(
			(
				await errorOf(
					eligible.service.create(TENANT, LISTING_ID, CREATE, NOW),
				)
			).code,
		).toBe(ErrorCode.LISTING_REVIEW_ALREADY_EXISTS);
	});
});

describe('ListingReviewsService.update (spec 0015 AC-6)', () => {
	const PATCH: UpdateReviewDto = { stars: 2 };

	it('sửa đúng cặp (người trong token, tin ở đường dẫn) và trả đánh giá mới', async () => {
		const updated = ownReviewRow({ stars: 2 });
		const { service, repository } = build({ updated: [updated] });
		const result = await service.update(TENANT, LISTING_ID, PATCH, NOW);
		expect(repository.updateOwnVisible).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
			{ stars: 2, comment: undefined },
		);
		expect(result).toMatchObject({ stars: 2, status: 'visible' });
	});

	it('comment null được chuyển nguyên xuống Repository (xóa nhận xét), khác với vắng (giữ nguyên)', async () => {
		const { service, repository } = build();
		await service.update(TENANT, LISTING_ID, { comment: null }, NOW);
		expect(repository.updateOwnVisible).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
			{ stars: undefined, comment: null },
		);
	});

	it('admin: 403 PERMISSION_DENIED và không sửa dòng nào', async () => {
		const { service, repository } = build();
		const error = await errorOf(
			service.update(ADMIN, LISTING_ID, PATCH, NOW),
		);
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.updateOwnVisible).not.toHaveBeenCalled();
	});

	it('tin không hiện công khai: 404 LISTING_NOT_FOUND và không sửa', async () => {
		const { service, repository } = build({ visible: false });
		const error = await errorOf(
			service.update(TENANT, LISTING_ID, PATCH, NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_NOT_FOUND);
		expect(repository.updateOwnVisible).not.toHaveBeenCalled();
	});

	it('không kiểm điều kiện chat lại khi sửa', async () => {
		const { service, chat } = build({ replied: false });
		await service.update(TENANT, LISTING_ID, PATCH, NOW);
		expect(chat.hasLandlordRepliedOnListing).not.toHaveBeenCalled();
	});

	it('chưa có đánh giá (UPDATE không đổi dòng, tra không thấy): 404 LISTING_REVIEW_NOT_FOUND', async () => {
		const { service } = build({ updated: [null], own: null });
		const error = await errorOf(
			service.update(TENANT, LISTING_ID, PATCH, NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_NOT_FOUND);
	});

	it('đang bị admin ẩn: 409 LISTING_REVIEW_HIDDEN', async () => {
		const { service, repository } = build({
			updated: [null],
			own: ownReviewRow({ status: 'hidden_by_admin' }),
		});
		const error = await errorOf(
			service.update(TENANT, LISTING_ID, PATCH, NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_HIDDEN);
		expect(repository.updateOwnVisible).toHaveBeenCalledTimes(1);
	});

	it('admin gỡ ẩn ngay giữa câu UPDATE và câu tra: thử sửa lại một lần thay vì báo sai là đang ẩn', async () => {
		const updated = ownReviewRow({ stars: 2 });
		const { service, repository } = build({
			updated: [null, updated],
			own: ownReviewRow({ status: 'visible' }),
		});
		const result = await service.update(TENANT, LISTING_ID, PATCH, NOW);
		expect(repository.updateOwnVisible).toHaveBeenCalledTimes(2);
		expect(result.stars).toBe(2);
	});

	it('thử lại vẫn không đổi dòng nào (bị ẩn lại ngay): 409 LISTING_REVIEW_HIDDEN, không thử lần ba', async () => {
		const { service, repository } = build({
			updated: [null],
			own: ownReviewRow({ status: 'visible' }),
		});
		const error = await errorOf(
			service.update(TENANT, LISTING_ID, PATCH, NOW),
		);
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_HIDDEN);
		expect(repository.updateOwnVisible).toHaveBeenCalledTimes(2);
	});
});

describe('ListingReviewsService.remove (spec 0015 AC-7, AC-10)', () => {
	it('xóa đúng cặp của người trong token', async () => {
		const { service, repository } = build();
		await expect(
			service.remove(TENANT, LISTING_ID, NOW),
		).resolves.toBeUndefined();
		expect(repository.deleteOwn).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
		);
	});

	it('chưa có đánh giá: 404 LISTING_REVIEW_NOT_FOUND', async () => {
		const { service } = build({ deleted: false });
		const error = await errorOf(service.remove(TENANT, LISTING_ID, NOW));
		expect(error.code).toBe(ErrorCode.LISTING_REVIEW_NOT_FOUND);
	});

	it('admin: 403 PERMISSION_DENIED và không xóa dòng nào', async () => {
		const { service, repository } = build();
		const error = await errorOf(service.remove(ADMIN, LISTING_ID, NOW));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.deleteOwn).not.toHaveBeenCalled();
	});

	it('tin không hiện công khai: 404 LISTING_NOT_FOUND kể cả với chính người viết, không xóa', async () => {
		const { service, repository } = build({ visible: false });
		const error = await errorOf(service.remove(TENANT, LISTING_ID, NOW));
		expect(error.code).toBe(ErrorCode.LISTING_NOT_FOUND);
		expect(repository.deleteOwn).not.toHaveBeenCalled();
	});
});
