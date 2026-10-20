import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { ListingsRepository } from '../listings/listings.repository';
import type { SettingsService } from '../settings/settings.service';
import { LandlordsService } from './landlords.service';
import type { LandlordRow, LandlordsRepository } from './landlords.repository';

const LANDLORD_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
const VIEWER_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';
const NOW = new Date('2026-10-20T03:00:00.000Z');
const JOINED = new Date('2026-10-05T03:00:00.000Z');

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
