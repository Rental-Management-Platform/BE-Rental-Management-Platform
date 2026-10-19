import type { Prisma } from '../generated/prisma/client';
import type { ListingsRepository } from '../listings/listings.repository';
import type { SettingsService } from '../settings/settings.service';
import type {
	ActiveSubscription,
	SubscriptionsRepository,
} from '../subscriptions/subscriptions.repository';
import type { UsersService } from '../users/users.service';
import type { UserWithoutPassword } from '../users/users.repository';
import { MembershipsService } from './memberships.service';

const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;
const USER_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
const NOW = new Date('2026-10-19T03:00:00.000Z');
const DAY_MS = 86_400_000;

function userWith(trialEndsAt: Date | null): UserWithoutPassword {
	return { id: USER_ID, trialEndsAt } as UserWithoutPassword;
}

function activePlan(
	endsAt: Date,
	maxListings = 15,
	planName = 'Nâng cao',
): ActiveSubscription {
	return {
		startsAt: new Date(endsAt.getTime() - 30 * DAY_MS),
		endsAt,
		order: { code: 'k7m2xq9p', planName, maxListings },
	};
}

function build(options: {
	user?: UserWithoutPassword | null;
	subscription?: ActiveSubscription | null;
	paidUntil?: Date | null;
	trialDays?: number;
	trialListingLimit?: number;
	visibleCount?: number;
}) {
	const users = {
		findById: jest.fn(() =>
			Promise.resolve(options.user === undefined ? null : options.user),
		),
	};
	const settings = {
		getValue: jest.fn((key: string) =>
			Promise.resolve(
				key === 'trial_days'
					? (options.trialDays ?? 30)
					: (options.trialListingLimit ?? 2),
			),
		),
	};
	const listings = {
		countVisibleByLandlord: jest.fn(() =>
			Promise.resolve(options.visibleCount ?? 0),
		),
	};
	const subscriptions = {
		findActive: jest.fn(() =>
			Promise.resolve(options.subscription ?? null),
		),
		findLatestEndsAt: jest.fn(() =>
			Promise.resolve(options.paidUntil ?? null),
		),
	};
	return {
		service: new MembershipsService(
			users as unknown as UsersService,
			settings as unknown as SettingsService,
			listings as unknown as ListingsRepository,
			subscriptions as unknown as SubscriptionsRepository,
		),
		users,
		settings,
		listings,
		subscriptions,
	};
}

describe('MembershipsService.resolve (spec 0003 AC-3, spec 0004 AC-8)', () => {
	it('có kỳ gói đang chạy: state plan, hạn mức là max_listings đã chốt trên đơn, giữ nguyên trialEndsAt', async () => {
		const trialEndsAt = new Date(NOW.getTime() - DAY_MS);
		const subscription = activePlan(new Date(NOW.getTime() + DAY_MS), 15);
		const { service, subscriptions, settings } = build({
			user: userWith(trialEndsAt),
			subscription,
			trialListingLimit: 99,
		});
		await expect(service.resolve(USER_ID, NOW)).resolves.toEqual({
			state: 'plan',
			limit: 15,
			trialEndsAt,
			subscription,
		});
		expect(subscriptions.findActive).toHaveBeenCalledWith(
			USER_ID,
			NOW,
			undefined,
		);
		expect(settings.getValue).not.toHaveBeenCalled();
	});

	it('gói thay hạn mức dùng thử khi cả hai còn hiệu lực, kể cả khi gói nhỏ hơn dùng thử', async () => {
		const { service } = build({
			user: userWith(new Date(NOW.getTime() + 20 * DAY_MS)),
			subscription: activePlan(new Date(NOW.getTime() + DAY_MS), 1),
			trialListingLimit: 2,
		});
		await expect(service.resolve(USER_ID, NOW)).resolves.toMatchObject({
			state: 'plan',
			limit: 1,
		});
	});

	it('không có kỳ đang chạy thì rơi về dùng thử rồi hết hạn như trước, subscription null', async () => {
		const trialing = build({
			user: userWith(new Date(NOW.getTime() + DAY_MS)),
			subscription: null,
		});
		await expect(
			trialing.service.resolve(USER_ID, NOW),
		).resolves.toMatchObject({ state: 'trial', subscription: null });
		const lapsed = build({
			user: userWith(new Date(NOW.getTime() - DAY_MS)),
			subscription: null,
		});
		await expect(
			lapsed.service.resolve(USER_ID, NOW),
		).resolves.toMatchObject({
			state: 'expired',
			limit: 0,
			subscription: null,
		});
	});

	it('người dùng không còn trong DB nhưng vẫn có kỳ gói: gói vẫn là nhánh đầu, trialEndsAt null', async () => {
		const { service } = build({
			user: null,
			subscription: activePlan(new Date(NOW.getTime() + DAY_MS), 5),
		});
		await expect(service.resolve(USER_ID, NOW)).resolves.toMatchObject({
			state: 'plan',
			limit: 5,
			trialEndsAt: null,
		});
	});

	it('còn trong kỳ dùng thử: state trial, hạn mức là trial_listing_limit', async () => {
		const trialEndsAt = new Date(NOW.getTime() + DAY_MS);
		const { service, settings } = build({
			user: userWith(trialEndsAt),
			trialListingLimit: 5,
		});
		await expect(service.resolve(USER_ID, NOW)).resolves.toEqual({
			state: 'trial',
			limit: 5,
			trialEndsAt,
			subscription: null,
		});
		expect(settings.getValue).toHaveBeenCalledWith(
			'trial_listing_limit',
			undefined,
		);
	});

	it('một mili giây trước hạn vẫn là trial', async () => {
		const { service } = build({
			user: userWith(new Date(NOW.getTime() + 1)),
		});
		await expect(service.resolve(USER_ID, NOW)).resolves.toMatchObject({
			state: 'trial',
			limit: 2,
		});
	});

	it('so sánh chặt: đúng lúc trial_ends_at là hết, hạn mức 0 và không đọc settings', async () => {
		const trialEndsAt = new Date(NOW.getTime());
		const { service, settings } = build({ user: userWith(trialEndsAt) });
		await expect(service.resolve(USER_ID, NOW)).resolves.toEqual({
			state: 'expired',
			limit: 0,
			trialEndsAt,
			subscription: null,
		});
		expect(settings.getValue).not.toHaveBeenCalled();
	});

	it('quá hạn: state expired, hạn mức 0', async () => {
		const { service } = build({
			user: userWith(new Date(NOW.getTime() - DAY_MS)),
		});
		await expect(service.resolve(USER_ID, NOW)).resolves.toMatchObject({
			state: 'expired',
			limit: 0,
		});
	});

	it('tài khoản không có trial_ends_at (admin, người tìm trọ) có hạn mức 0 và trialEndsAt null', async () => {
		const { service } = build({ user: userWith(null) });
		await expect(service.resolve(USER_ID, NOW)).resolves.toEqual({
			state: 'expired',
			limit: 0,
			trialEndsAt: null,
			subscription: null,
		});
	});

	it('không còn người dùng (đã xóa mềm) thì coi như hết dùng thử, không ném lỗi', async () => {
		const { service } = build({ user: null });
		await expect(service.resolve(USER_ID, NOW)).resolves.toEqual({
			state: 'expired',
			limit: 0,
			trialEndsAt: null,
			subscription: null,
		});
	});

	it('hạn mức 0 trong kỳ dùng thử vẫn là state trial', async () => {
		const { service } = build({
			user: userWith(new Date(NOW.getTime() + DAY_MS)),
			trialListingLimit: 0,
		});
		await expect(service.resolve(USER_ID, NOW)).resolves.toMatchObject({
			state: 'trial',
			limit: 0,
		});
	});

	it('có tx thì đọc người dùng và tham số bằng chính giao dịch đó (không mượn thêm kết nối)', async () => {
		const { service, users, settings, subscriptions } = build({
			user: userWith(new Date(NOW.getTime() + DAY_MS)),
		});
		await service.resolve(USER_ID, NOW, tx);
		expect(users.findById).toHaveBeenCalledWith(USER_ID, tx);
		expect(subscriptions.findActive).toHaveBeenCalledWith(USER_ID, NOW, tx);
		expect(settings.getValue).toHaveBeenCalledWith(
			'trial_listing_limit',
			tx,
		);
	});

	it('dùng đúng `now` được truyền vào, không tự lấy giờ', async () => {
		const trialEndsAt = new Date('2026-10-19T03:00:00.500Z');
		const { service } = build({ user: userWith(trialEndsAt) });
		const before = new Date('2026-10-19T03:00:00.499Z');
		const after = new Date('2026-10-19T03:00:00.500Z');
		await expect(service.resolve(USER_ID, before)).resolves.toMatchObject({
			state: 'trial',
		});
		await expect(service.resolve(USER_ID, after)).resolves.toMatchObject({
			state: 'expired',
		});
	});
});

describe('MembershipsService.getStatus (spec 0003 AC-10, spec 0004 AC-10)', () => {
	it('đang có gói: state plan, hạn mức của gói, subscription có paidUntil là ends_at lớn nhất của các kỳ', async () => {
		const trialEndsAt = new Date(NOW.getTime() - DAY_MS);
		const endsAt = new Date(NOW.getTime() + 10 * DAY_MS + 1);
		const paidUntil = new Date(NOW.getTime() + 40 * DAY_MS + 1);
		const subscription = activePlan(endsAt, 15);
		const { service, subscriptions, listings } = build({
			user: userWith(trialEndsAt),
			subscription,
			paidUntil,
			visibleCount: 4,
		});
		await expect(service.getStatus(USER_ID, NOW)).resolves.toEqual({
			state: 'plan',
			trialEndsAt,
			trialDaysLeft: 0,
			subscription: {
				orderCode: 'k7m2xq9p',
				planName: 'Nâng cao',
				startsAt: subscription.startsAt,
				endsAt,
				daysLeft: 11,
				paidUntil,
			},
			listingLimit: 15,
			visibleCount: 4,
			remaining: 11,
			overLimitCount: 0,
		});
		expect(subscriptions.findLatestEndsAt).toHaveBeenCalledWith(USER_ID);
		expect(listings.countVisibleByLandlord).toHaveBeenCalledWith(USER_ID);
	});

	it('đang có gói mà dùng thử còn: trialDaysLeft vẫn đếm theo trialEndsAt, không theo state', async () => {
		const { service } = build({
			user: userWith(new Date(NOW.getTime() + 2 * DAY_MS)),
			subscription: activePlan(new Date(NOW.getTime() + DAY_MS), 5),
			paidUntil: new Date(NOW.getTime() + DAY_MS),
		});
		await expect(service.getStatus(USER_ID, NOW)).resolves.toMatchObject({
			state: 'plan',
			trialDaysLeft: 2,
		});
	});

	it('gói có hạn mức thấp hơn số tin đang hiện: remaining 0, overLimitCount là phần vượt', async () => {
		const { service } = build({
			user: userWith(null),
			subscription: activePlan(new Date(NOW.getTime() + DAY_MS), 5),
			visibleCount: 8,
		});
		await expect(service.getStatus(USER_ID, NOW)).resolves.toMatchObject({
			state: 'plan',
			listingLimit: 5,
			remaining: 0,
			overLimitCount: 3,
		});
	});

	it('không có kỳ đang chạy thì không tra paidUntil và subscription là null', async () => {
		const { service, subscriptions } = build({
			user: userWith(new Date(NOW.getTime() + DAY_MS)),
		});
		await expect(service.getStatus(USER_ID, NOW)).resolves.toMatchObject({
			subscription: null,
		});
		expect(subscriptions.findLatestEndsAt).not.toHaveBeenCalled();
	});

	it('findLatestEndsAt trả null (hiếm) thì paidUntil rơi về ends_at của kỳ đang chạy', async () => {
		const endsAt = new Date(NOW.getTime() + 3 * DAY_MS);
		const { service } = build({
			user: userWith(null),
			subscription: activePlan(endsAt),
			paidUntil: null,
		});
		const status = await service.getStatus(USER_ID, NOW);
		expect(status.subscription?.paidUntil).toEqual(endsAt);
	});

	it('đang dùng thử: ghép hạn mức của resolve với số tin đang hiện của chính người gọi', async () => {
		const trialEndsAt = new Date(NOW.getTime() + 29 * DAY_MS + 1);
		const { service, listings } = build({
			user: userWith(trialEndsAt),
			trialListingLimit: 2,
			visibleCount: 1,
		});
		await expect(service.getStatus(USER_ID, NOW)).resolves.toEqual({
			state: 'trial',
			trialEndsAt,
			trialDaysLeft: 30,
			subscription: null,
			listingLimit: 2,
			visibleCount: 1,
			remaining: 1,
			overLimitCount: 0,
		});
		expect(listings.countVisibleByLandlord).toHaveBeenCalledWith(USER_ID);
	});

	it('số tin đang hiện vượt hạn mức (admin hạ hạn mức): remaining 0, overLimitCount là phần vượt', async () => {
		const { service } = build({
			user: userWith(new Date(NOW.getTime() + DAY_MS)),
			trialListingLimit: 1,
			visibleCount: 3,
		});
		await expect(service.getStatus(USER_ID, NOW)).resolves.toMatchObject({
			state: 'trial',
			listingLimit: 1,
			visibleCount: 3,
			remaining: 0,
			overLimitCount: 2,
		});
	});

	it('hết dùng thử: state expired, hạn mức 0, mọi tin đang hiện đều là phần vượt', async () => {
		const trialEndsAt = new Date(NOW.getTime() - DAY_MS);
		const { service } = build({
			user: userWith(trialEndsAt),
			visibleCount: 2,
		});
		await expect(service.getStatus(USER_ID, NOW)).resolves.toEqual({
			state: 'expired',
			trialEndsAt,
			trialDaysLeft: 0,
			subscription: null,
			listingLimit: 0,
			visibleCount: 2,
			remaining: 0,
			overLimitCount: 2,
		});
	});

	it('tài khoản không có hạn dùng thử (admin): expired, trialEndsAt và trialDaysLeft null', async () => {
		const { service } = build({ user: userWith(null) });
		await expect(service.getStatus(USER_ID, NOW)).resolves.toEqual({
			state: 'expired',
			trialEndsAt: null,
			trialDaysLeft: null,
			subscription: null,
			listingLimit: 0,
			visibleCount: 0,
			remaining: 0,
			overLimitCount: 0,
		});
	});

	it('dùng đúng `now` truyền vào cho ranh giới hết hạn', async () => {
		const trialEndsAt = new Date('2026-10-19T03:00:00.500Z');
		const { service } = build({ user: userWith(trialEndsAt) });
		await expect(
			service.getStatus(USER_ID, new Date('2026-10-19T03:00:00.499Z')),
		).resolves.toMatchObject({ state: 'trial', trialDaysLeft: 1 });
		await expect(
			service.getStatus(USER_ID, new Date('2026-10-19T03:00:00.500Z')),
		).resolves.toMatchObject({ state: 'expired', trialDaysLeft: 0 });
	});
});

describe('MembershipsService.trialEndsAtForNewLandlord (spec 0003 AC-1)', () => {
	it('now cộng trial_days ngày, chính xác đến mili giây (không làm tròn theo ngày)', async () => {
		const now = new Date('2026-10-19T03:04:05.678Z');
		const { service } = build({ trialDays: 30 });
		const ends = await service.trialEndsAtForNewLandlord(now);
		expect(ends.getTime()).toBe(now.getTime() + 30 * DAY_MS);
		expect(ends.toISOString()).toBe('2026-11-18T03:04:05.678Z');
	});

	it('trial_days là 0 thì hết dùng thử ngay lúc đăng ký (resolve cho expired)', async () => {
		const { service } = build({ trialDays: 0 });
		const ends = await service.trialEndsAtForNewLandlord(NOW);
		expect(ends.getTime()).toBe(NOW.getTime());
	});

	it('đọc trial_days từ settings (giá trị admin đã đổi)', async () => {
		const { service, settings } = build({ trialDays: 7 });
		const ends = await service.trialEndsAtForNewLandlord(NOW);
		expect(settings.getValue).toHaveBeenCalledWith('trial_days');
		expect(ends.getTime()).toBe(NOW.getTime() + 7 * DAY_MS);
	});

	it('không sửa đối tượng now của người gọi', async () => {
		const now = new Date(NOW.getTime());
		const { service } = build({});
		await service.trialEndsAtForNewLandlord(now);
		expect(now.getTime()).toBe(NOW.getTime());
	});
});
