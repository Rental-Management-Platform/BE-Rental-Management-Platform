import type { AccountType } from '../common/auth/account-type';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { ListingsRepository } from '../listings/listings.repository';
import type { SettingsService } from '../settings/settings.service';
import { LandlordsService } from './landlords.service';
import type { LandlordRow, LandlordsRepository } from './landlords.repository';

const LANDLORD_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
const VIEWER_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';
const ADMIN_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';
const NOW = new Date('2026-10-20T03:00:00.000Z');
const JOINED = new Date('2026-10-05T03:00:00.000Z');

function userOf(userId: string, accountType: AccountType): RequestUser {
	return { userId, sessionId: 'phien-1', accountType, permissions: [] };
}

const TENANT = userOf(VIEWER_ID, 'tenant');
const LANDLORD = userOf(LANDLORD_ID, 'landlord');
const ADMIN = userOf(ADMIN_ID, 'admin');

function build(options: {
	landlord?: LandlordRow | null;
	following?: boolean;
}) {
	const repository = {
		findActiveLandlord: jest.fn(() =>
			Promise.resolve(
				options.landlord === undefined
					? { id: LANDLORD_ID, name: 'Anh Nam', createdAt: JOINED }
					: options.landlord,
			),
		),
		countActiveFollowers: jest.fn(() => Promise.resolve(12)),
		isFollowing: jest.fn(() => Promise.resolve(options.following ?? false)),
		addFollow: jest.fn(() => Promise.resolve()),
		removeFollow: jest.fn(() => Promise.resolve()),
	};
	const listings = {
		sumViewCountByLandlord: jest.fn(() => Promise.resolve(1840)),
		countPublicByLandlord: jest.fn(() => Promise.resolve(2)),
	};
	const settings = { getValue: jest.fn(() => Promise.resolve(3)) };
	const service = new LandlordsService(
		repository as unknown as LandlordsRepository,
		listings as unknown as ListingsRepository,
		settings as unknown as SettingsService,
	);
	return { service, repository, listings, settings };
}

describe('LandlordsService.getProfile (spec 0005 AC-1 đến AC-5)', () => {
	it('khách: đủ bảy trường, isFollowing là null và không tra bảng follows theo người xem', async () => {
		const { service, repository } = build({});
		await expect(
			service.getProfile(LANDLORD_ID, undefined, NOW),
		).resolves.toEqual({
			id: LANDLORD_ID,
			name: 'Anh Nam',
			joinedAt: JOINED,
			followerCount: 12,
			totalViewCount: 1840,
			publicListingCount: 2,
			isFollowing: null,
		});
		expect(repository.isFollowing).not.toHaveBeenCalled();
	});

	it.each([[true], [false]])(
		'người đã đăng nhập: tra đúng cặp (người xem, chủ trọ) và trả %j',
		async (following) => {
			const { service, repository } = build({ following });
			const profile = await service.getProfile(
				LANDLORD_ID,
				VIEWER_ID,
				NOW,
			);
			expect(repository.isFollowing).toHaveBeenCalledWith(
				VIEWER_ID,
				LANDLORD_ID,
			);
			expect(profile.isFollowing).toBe(following);
		},
	);

	it('số tin đang hiện dùng cùng `now` của request và hạn mức dùng thử đọc từ settings', async () => {
		const { service, listings, settings } = build({});
		await service.getProfile(LANDLORD_ID, undefined, NOW);
		expect(settings.getValue).toHaveBeenCalledWith('trial_listing_limit');
		expect(listings.countPublicByLandlord).toHaveBeenCalledWith(
			LANDLORD_ID,
			{
				now: NOW,
				trialListingLimit: 3,
			},
		);
	});

	it('ba số được tính theo đúng id chủ trọ', async () => {
		const { service, repository, listings } = build({});
		await service.getProfile(LANDLORD_ID, VIEWER_ID, NOW);
		expect(repository.countActiveFollowers).toHaveBeenCalledWith(
			LANDLORD_ID,
		);
		expect(listings.sumViewCountByLandlord).toHaveBeenCalledWith(
			LANDLORD_ID,
		);
	});

	it('id không phải chủ trọ đang hoạt động: 404 LANDLORD_NOT_FOUND và không tính số nào', async () => {
		const { service, repository, listings, settings } = build({
			landlord: null,
		});
		const error = await service
			.getProfile(LANDLORD_ID, VIEWER_ID, NOW)
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(AppException);
		expect((error as AppException).code).toBe(ErrorCode.LANDLORD_NOT_FOUND);
		expect(repository.countActiveFollowers).not.toHaveBeenCalled();
		expect(repository.isFollowing).not.toHaveBeenCalled();
		expect(listings.sumViewCountByLandlord).not.toHaveBeenCalled();
		expect(listings.countPublicByLandlord).not.toHaveBeenCalled();
		expect(settings.getValue).not.toHaveBeenCalled();
	});

	it('tên trống thì name là null', async () => {
		const { service } = build({
			landlord: { id: LANDLORD_ID, name: '  ', createdAt: JOINED },
		});
		const profile = await service.getProfile(LANDLORD_ID, undefined, NOW);
		expect(profile.name).toBeNull();
	});
});

async function errorOf(promise: Promise<unknown>): Promise<AppException> {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(AppException);
	return error as AppException;
}

describe('LandlordsService.follow (spec 0005 AC-6, AC-8)', () => {
	it('ghi đúng cặp (người trong token, chủ trọ ở đường dẫn) rồi trả hồ sơ đọc lại với người gọi là người xem', async () => {
		const { service, repository } = build({ following: true });
		const profile = await service.follow(TENANT, LANDLORD_ID, NOW);
		expect(repository.addFollow).toHaveBeenCalledWith(
			VIEWER_ID,
			LANDLORD_ID,
		);
		expect(repository.isFollowing).toHaveBeenCalledWith(
			VIEWER_ID,
			LANDLORD_ID,
		);
		expect(profile.isFollowing).toBe(true);
		expect(profile.followerCount).toBe(12);
	});

	it('hồ sơ chỉ được đọc SAU khi ghi xong', async () => {
		const { service, repository } = build({});
		await service.follow(TENANT, LANDLORD_ID, NOW);
		const writeOrder = repository.addFollow.mock.invocationCallOrder[0];
		const readOrder =
			repository.countActiveFollowers.mock.invocationCallOrder[0];
		expect(writeOrder).toBeLessThan(readOrder);
	});

	it('gọi lại khi đã theo dõi vẫn thành công: Service không tự kiểm dòng cũ, DB lo bằng ON CONFLICT DO NOTHING', async () => {
		const { service, repository } = build({ following: true });
		await service.follow(TENANT, LANDLORD_ID, NOW);
		await service.follow(TENANT, LANDLORD_ID, NOW);
		expect(repository.addFollow).toHaveBeenCalledTimes(2);
	});

	it('tự theo dõi chính mình: 409 CANNOT_FOLLOW_SELF, kiểm TRƯỚC khi tra chủ trọ và không ghi gì', async () => {
		const { service, repository } = build({});
		const error = await errorOf(service.follow(LANDLORD, LANDLORD_ID, NOW));
		expect(error.code).toBe(ErrorCode.CANNOT_FOLLOW_SELF);
		expect(repository.findActiveLandlord).not.toHaveBeenCalled();
		expect(repository.addFollow).not.toHaveBeenCalled();
	});

	it('admin: 403 PERMISSION_DENIED dù giữ follow:create, kiểm TRƯỚC mọi việc khác và không ghi gì', async () => {
		const { service, repository } = build({});
		const error = await errorOf(service.follow(ADMIN, LANDLORD_ID, NOW));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.findActiveLandlord).not.toHaveBeenCalled();
		expect(repository.addFollow).not.toHaveBeenCalled();
	});

	it('chủ trọ được admin cấp quyền theo dõi được chủ trọ KHÁC: chỉ admin bị chặn', async () => {
		const { service, repository } = build({});
		await service.follow(LANDLORD, VIEWER_ID, NOW);
		expect(repository.addFollow).toHaveBeenCalledWith(
			LANDLORD_ID,
			VIEWER_ID,
		);
	});

	it('id không phải chủ trọ đang hoạt động: 404 LANDLORD_NOT_FOUND và không ghi gì', async () => {
		const { service, repository } = build({ landlord: null });
		const error = await errorOf(service.follow(TENANT, LANDLORD_ID, NOW));
		expect(error.code).toBe(ErrorCode.LANDLORD_NOT_FOUND);
		expect(repository.addFollow).not.toHaveBeenCalled();
	});
});

describe('LandlordsService.unfollow (spec 0005 AC-7, AC-8)', () => {
	it('xóa đúng cặp rồi trả hồ sơ đọc lại với isFollowing false', async () => {
		const { service, repository } = build({ following: false });
		const profile = await service.unfollow(TENANT, LANDLORD_ID, NOW);
		expect(repository.removeFollow).toHaveBeenCalledWith(
			VIEWER_ID,
			LANDLORD_ID,
		);
		expect(profile.isFollowing).toBe(false);
	});

	it('hồ sơ chỉ được đọc SAU khi xóa xong', async () => {
		const { service, repository } = build({});
		await service.unfollow(TENANT, LANDLORD_ID, NOW);
		const writeOrder = repository.removeFollow.mock.invocationCallOrder[0];
		const readOrder =
			repository.countActiveFollowers.mock.invocationCallOrder[0];
		expect(writeOrder).toBeLessThan(readOrder);
	});

	it('id là chính người gọi (chủ trọ được cấp quyền): không có bước tự theo dõi, đi tiếp như id khác và vẫn trả hồ sơ', async () => {
		const { service, repository } = build({});
		const profile = await service.unfollow(LANDLORD, LANDLORD_ID, NOW);
		expect(repository.removeFollow).toHaveBeenCalledWith(
			LANDLORD_ID,
			LANDLORD_ID,
		);
		expect(profile.id).toBe(LANDLORD_ID);
	});

	it('admin: 403 PERMISSION_DENIED dù giữ follow:delete và không xóa gì', async () => {
		const { service, repository } = build({});
		const error = await errorOf(service.unfollow(ADMIN, LANDLORD_ID, NOW));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.findActiveLandlord).not.toHaveBeenCalled();
		expect(repository.removeFollow).not.toHaveBeenCalled();
	});

	it('id không phải chủ trọ đang hoạt động: 404 LANDLORD_NOT_FOUND và không xóa gì', async () => {
		const { service, repository } = build({ landlord: null });
		const error = await errorOf(service.unfollow(TENANT, LANDLORD_ID, NOW));
		expect(error.code).toBe(ErrorCode.LANDLORD_NOT_FOUND);
		expect(repository.removeFollow).not.toHaveBeenCalled();
	});
});
