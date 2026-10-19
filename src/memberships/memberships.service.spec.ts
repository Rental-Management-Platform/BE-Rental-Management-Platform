import type { Prisma } from '../generated/prisma/client';
import type { ListingsRepository } from '../listings/listings.repository';
import type { SettingsService } from '../settings/settings.service';
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

function build(options: {
	user?: UserWithoutPassword | null;
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
	return {
		service: new MembershipsService(
			users as unknown as UsersService,
			settings as unknown as SettingsService,
			listings as unknown as ListingsRepository,
		),
		users,
		settings,
		listings,
	};
}

describe('MembershipsService.resolve (spec 0003 AC-3)', () => {
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
		});
	});

	it('không còn người dùng (đã xóa mềm) thì coi như hết dùng thử, không ném lỗi', async () => {
		const { service } = build({ user: null });
		await expect(service.resolve(USER_ID, NOW)).resolves.toEqual({
			state: 'expired',
			limit: 0,
			trialEndsAt: null,
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
		const { service, users, settings } = build({
			user: userWith(new Date(NOW.getTime() + DAY_MS)),
		});
		await service.resolve(USER_ID, NOW, tx);
		expect(users.findById).toHaveBeenCalledWith(USER_ID, tx);
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

describe('MembershipsService.getStatus (spec 0003 AC-10)', () => {
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
