import type { AccountType } from '../common/auth/account-type';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type {
	Membership,
	MembershipsService,
} from '../memberships/memberships.service';
import type { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import type { ListingCounts, TopListingRow } from './statistics.repository';
import type { StatisticsRepository } from './statistics.repository';
import { StatisticsService, TOP_LISTING_COUNT } from './statistics.service';

const LANDLORD_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
const TENANT_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';
const ADMIN_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';
/** Giữa trưa giờ Việt Nam ngày 16/11/2026. */
const NOW = new Date('2026-11-16T05:00:00.000Z');
const TRIAL_ENDS = new Date('2026-12-01T03:00:00.000Z');

function userOf(userId: string, accountType: AccountType): RequestUser {
	return { userId, sessionId: 'phien-1', accountType, permissions: [] };
}

const LANDLORD = userOf(LANDLORD_ID, 'landlord');
const TENANT = userOf(TENANT_ID, 'tenant');
const ADMIN = userOf(ADMIN_ID, 'admin');

const TRIAL: Membership = {
	state: 'trial',
	limit: 2,
	trialEndsAt: TRIAL_ENDS,
	subscription: null,
};

const PLAN: Membership = {
	state: 'plan',
	limit: 10,
	trialEndsAt: TRIAL_ENDS,
	subscription: {
		startsAt: new Date('2026-11-10T00:00:00.000Z'),
		endsAt: new Date('2026-12-10T00:00:00.000Z'),
		order: { code: 'abcd2345', planName: 'Gói 10 tin', maxListings: 10 },
	},
};

const EXPIRED: Membership = {
	state: 'expired',
	limit: 0,
	trialEndsAt: new Date('2026-10-01T00:00:00.000Z'),
	subscription: null,
};

const COUNTS: ListingCounts = {
	visible: 3,
	hiddenByOwner: 1,
	hiddenByAdmin: 1,
	viewCountAllTime: 1450,
};

const TOP: TopListingRow = {
	id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d11',
	code: 'k7m2xq9p',
	title: 'Phòng trọ gần ĐH Bách Khoa',
	status: 'visible',
	isPublic: true,
	viewsInRange: 70,
	viewsAllTime: 640,
};

interface Setup {
	membership?: Membership;
	counts?: ListingCounts;
	daily?: { day: string; count: number }[];
	top?: TopListingRow[];
	latestEndsAt?: Date | null;
}

function build(options: Setup = {}) {
	const repository = {
		countListings: jest.fn(() => Promise.resolve(options.counts ?? COUNTS)),
		// Tham số được khai báo để `mock.calls` có kiểu; chỉ `toHaveBeenCalledWith` và `calls[0]` đọc chúng.
		findDailyViews: jest.fn((userId: string, from: string, to: string) => {
			void [userId, from, to];
			return Promise.resolve(options.daily ?? []);
		}),
		findTopListings: jest.fn(
			(
				userId: string,
				from: string,
				to: string,
				listingLimit: number,
				limit: number,
			) => {
				void [userId, from, to, listingLimit, limit];
				return Promise.resolve(options.top ?? []);
			},
		),
	};
	const memberships = {
		resolve: jest.fn(() => Promise.resolve(options.membership ?? TRIAL)),
	};
	const subscriptions = {
		findLatestEndsAt: jest.fn(() =>
			Promise.resolve(options.latestEndsAt ?? null),
		),
	};
	const service = new StatisticsService(
		repository as unknown as StatisticsRepository,
		memberships as unknown as MembershipsService,
		subscriptions as unknown as SubscriptionsRepository,
	);
	return { service, repository, memberships, subscriptions };
}

async function errorOf(promise: Promise<unknown>): Promise<AppException> {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(AppException);
	return error as AppException;
}

describe('StatisticsService.get: loại tài khoản (spec 0017 AC-15)', () => {
	it.each([
		['admin', ADMIN],
		['tenant', TENANT],
	])(
		'%s bị 403 PERMISSION_DENIED trước khi đọc bất kỳ bảng dữ liệu nào, kể cả hạn mức',
		async (_name, user) => {
			const { service, repository, memberships, subscriptions } = build();
			const error = await errorOf(service.get(user, {}, NOW));
			expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
			expect(repository.countListings).not.toHaveBeenCalled();
			expect(repository.findDailyViews).not.toHaveBeenCalled();
			expect(repository.findTopListings).not.toHaveBeenCalled();
			expect(memberships.resolve).not.toHaveBeenCalled();
			expect(subscriptions.findLatestEndsAt).not.toHaveBeenCalled();
		},
	);

	it('tham số sai được kiểm TRƯỚC loại tài khoản: admin gửi from sau to nhận 400 chứ không phải 403', async () => {
		const { service, repository } = build();
		const error = await errorOf(
			service.get(ADMIN, { from: '2026-11-02', to: '2026-11-01' }, NOW),
		);
		expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
		expect(error.fieldErrors.map((item) => item.field)).toEqual(['to']);
		expect(repository.countListings).not.toHaveBeenCalled();
	});

	it('chủ trọ gửi khoảng quá 366 ngày nhận 400 ở trường to và không đọc dữ liệu', async () => {
		const { service, repository, memberships } = build();
		const error = await errorOf(
			service.get(
				LANDLORD,
				{ from: '2024-01-01', to: '2025-01-01' },
				NOW,
			),
		);
		expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
		expect(error.fieldErrors.map((item) => item.field)).toEqual(['to']);
		expect(repository.countListings).not.toHaveBeenCalled();
		expect(memberships.resolve).not.toHaveBeenCalled();
	});
});

describe('StatisticsService.get: phạm vi dữ liệu (spec 0017 AC-14)', () => {
	it('mọi truy vấn đọc theo id trong token: hạn mức, đếm tin, lượt xem theo ngày, top tin', async () => {
		const { service, repository, memberships } = build();
		await service.get(LANDLORD, {}, NOW);
		expect(memberships.resolve).toHaveBeenCalledWith(LANDLORD_ID, NOW);
		expect(repository.countListings).toHaveBeenCalledWith(LANDLORD_ID);
		expect(repository.findDailyViews.mock.calls[0]?.[0]).toBe(LANDLORD_ID);
		expect(repository.findTopListings.mock.calls[0]?.[0]).toBe(LANDLORD_ID);
	});

	it('phản hồi chỉ có đúng năm khối của mốc 1, không khối nào của mốc 2', async () => {
		const { service } = build();
		const result = await service.get(LANDLORD, {}, NOW);
		expect(Object.keys(result).sort()).toEqual(
			['listings', 'membership', 'period', 'series', 'views'].sort(),
		);
	});
});

describe('StatisticsService.get: khoảng ngày (spec 0017 AC-2, AC-3)', () => {
	it('không gửi gì: lượt xem theo ngày được hỏi cho cả hai kỳ [previousFrom, to], top chỉ cho kỳ này [from, to]', async () => {
		const { service, repository } = build();
		const result = await service.get(LANDLORD, {}, NOW);
		expect(result.period).toEqual({
			from: '2026-10-18',
			to: '2026-11-16',
			days: 30,
			previousFrom: '2026-09-18',
			previousTo: '2026-10-17',
			timeZone: 'Asia/Ho_Chi_Minh',
		});
		expect(repository.findDailyViews).toHaveBeenCalledWith(
			LANDLORD_ID,
			'2026-09-18',
			'2026-11-16',
		);
		expect(repository.findTopListings).toHaveBeenCalledWith(
			LANDLORD_ID,
			'2026-10-18',
			'2026-11-16',
			2,
			TOP_LISTING_COUNT,
		);
		expect(TOP_LISTING_COUNT).toBe(5);
	});

	it('hôm nay tính theo giờ Việt Nam: 16:59:59.999Z vẫn là ngày hôm qua, 17:00:00.000Z là ngày kế', async () => {
		const before = await build().service.get(
			LANDLORD,
			{},
			new Date('2026-10-31T16:59:59.999Z'),
		);
		const after = await build().service.get(
			LANDLORD,
			{},
			new Date('2026-10-31T17:00:00.000Z'),
		);
		expect(before.period.to).toBe('2026-10-31');
		expect(after.period.to).toBe('2026-11-01');
	});
});

describe('StatisticsService.get: tin và hạn mức (spec 0017 AC-4, AC-5)', () => {
	it('dùng thử còn hạn: bucket chia theo hạn mức, membership khớp hình dạng của /me/membership', async () => {
		const { service } = build({ membership: TRIAL });
		const result = await service.get(LANDLORD, {}, NOW);
		expect(result.listings).toEqual({
			total: 5,
			public: 2,
			hiddenByQuota: 1,
			hiddenByOwner: 1,
			hiddenByAdmin: 1,
		});
		expect(result.membership).toEqual({
			state: 'trial',
			trialEndsAt: TRIAL_ENDS,
			trialDaysLeft: 15,
			subscription: null,
			listingLimit: 2,
			visibleCount: 3,
			remaining: 0,
			overLimitCount: 1,
		});
	});

	it('membership.visibleCount bằng public + hiddenByQuota, overLimitCount bằng hiddenByQuota, listingLimit là hạn mức đã dùng', async () => {
		for (const membership of [TRIAL, PLAN, EXPIRED]) {
			const { service } = build({ membership });
			const { listings, membership: shown } = await service.get(
				LANDLORD,
				{},
				NOW,
			);
			expect(shown.visibleCount).toBe(
				listings.public + listings.hiddenByQuota,
			);
			expect(shown.overLimitCount).toBe(listings.hiddenByQuota);
			expect(shown.listingLimit).toBe(membership.limit);
		}
	});

	it('gói đang chạy: hạn mức theo gói, paidUntil lấy từ kỳ cuối cùng', async () => {
		const latest = new Date('2027-01-10T00:00:00.000Z');
		const { service, subscriptions } = build({
			membership: PLAN,
			latestEndsAt: latest,
		});
		const result = await service.get(LANDLORD, {}, NOW);
		expect(subscriptions.findLatestEndsAt).toHaveBeenCalledWith(
			LANDLORD_ID,
		);
		expect(result.listings).toMatchObject({
			public: 3,
			hiddenByQuota: 0,
		});
		expect(result.membership.state).toBe('plan');
		expect(result.membership.listingLimit).toBe(10);
		expect(result.membership.subscription).toMatchObject({
			orderCode: 'abcd2345',
			planName: 'Gói 10 tin',
			paidUntil: latest,
		});
	});

	it('không có kỳ gói đang chạy thì không tra kỳ cuối (một truy vấn ít hơn)', async () => {
		const { service, subscriptions } = build({ membership: TRIAL });
		await service.get(LANDLORD, {}, NOW);
		expect(subscriptions.findLatestEndsAt).not.toHaveBeenCalled();
	});

	it('hết dùng thử và không gói: hạn mức 0, mọi tin visible là hiddenByQuota', async () => {
		const { service, repository } = build({ membership: EXPIRED });
		const result = await service.get(LANDLORD, {}, NOW);
		expect(result.listings).toEqual({
			total: 5,
			public: 0,
			hiddenByQuota: 3,
			hiddenByOwner: 1,
			hiddenByAdmin: 1,
		});
		expect(result.membership.state).toBe('expired');
		expect(result.membership.listingLimit).toBe(0);
		expect(repository.findTopListings.mock.calls[0]?.[3]).toBe(0);
	});
});

describe('StatisticsService.get: lượt xem và chuỗi (spec 0017 AC-3, AC-6, AC-7, AC-12)', () => {
	it('inRange: value là tổng kỳ này, previous là tổng kỳ trước, changePercent tính từ hai số', async () => {
		const { service } = build({
			daily: [
				{ day: '2026-09-18', count: 40 }, // đầu kỳ trước
				{ day: '2026-10-17', count: 56 }, // cuối kỳ trước
				{ day: '2026-10-18', count: 100 }, // đầu kỳ này
				{ day: '2026-11-16', count: 28 }, // cuối kỳ này
			],
		});
		const result = await service.get(LANDLORD, {}, NOW);
		expect(result.views.inRange).toEqual({
			value: 128,
			previous: 96,
			changePercent: 33.3,
		});
	});

	it('kỳ trước bằng 0 thì changePercent là null dù value lớn hơn 0', async () => {
		const { service } = build({
			daily: [{ day: '2026-11-01', count: 5 }],
		});
		const { views } = await service.get(LANDLORD, {}, NOW);
		expect(views.inRange).toEqual({
			value: 5,
			previous: 0,
			changePercent: null,
		});
	});

	it('allTime là tổng view_count của mọi tin (không phải tổng theo ngày)', async () => {
		const { service } = build({
			daily: [{ day: '2026-11-01', count: 5 }],
			counts: { ...COUNTS, viewCountAllTime: 1450 },
		});
		const { views } = await service.get(LANDLORD, {}, NOW);
		expect(views.allTime).toBe(1450);
		expect(views.inRange.value).toBe(5);
	});

	it('series đủ 30 ngày, tăng dần, ngày không có lượt là 0, tổng cột bằng inRange.value', async () => {
		const { service } = build({
			daily: [
				{ day: '2026-10-10', count: 99 }, // kỳ trước: không vào chuỗi
				{ day: '2026-10-18', count: 3 },
				{ day: '2026-11-02', count: 4 },
				{ day: '2026-11-16', count: 8 },
			],
		});
		const result = await service.get(LANDLORD, {}, NOW);
		expect(result.series).toHaveLength(30);
		expect(result.series[0]).toEqual({ date: '2026-10-18', views: 3 });
		expect(result.series[29]).toEqual({ date: '2026-11-16', views: 8 });
		expect(result.series.find((p) => p.date === '2026-10-19')).toEqual({
			date: '2026-10-19',
			views: 0,
		});
		const sum = result.series.reduce((total, p) => total + p.views, 0);
		expect(sum).toBe(result.views.inRange.value);
		expect(sum).toBe(15);
		expect(result.views.inRange.previous).toBe(99);
	});

	it('top: giữ nguyên thứ tự của Repository (đã sắp), mỗi phần tử đủ bảy trường', async () => {
		const second: TopListingRow = {
			...TOP,
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d12',
			code: 'p3x9zq7m',
			status: 'hidden_by_owner',
			isPublic: false,
			viewsInRange: 12,
			viewsAllTime: 30,
		};
		const { service } = build({ top: [TOP, second] });
		const { views } = await service.get(LANDLORD, {}, NOW);
		expect(views.top.map((item) => item.code)).toEqual([
			'k7m2xq9p',
			'p3x9zq7m',
		]);
		expect(Object.keys(views.top[0] ?? {}).sort()).toEqual(
			[
				'id',
				'code',
				'title',
				'status',
				'isPublic',
				'viewsInRange',
				'viewsAllTime',
			].sort(),
		);
		expect(views.top[1]).toMatchObject({
			status: 'hidden_by_owner',
			isPublic: false,
		});
	});

	it('không có tin nào có lượt trong khoảng thì top là []', async () => {
		const { service } = build({ top: [] });
		const { views } = await service.get(LANDLORD, {}, NOW);
		expect(views.top).toEqual([]);
	});
});

describe('StatisticsService.get: chủ trọ mới chưa có gì (spec 0017 AC-14)', () => {
	it('200 với mọi số bằng 0, changePercent null, top rỗng, series đủ ngày toàn 0', async () => {
		const { service } = build({
			counts: {
				visible: 0,
				hiddenByOwner: 0,
				hiddenByAdmin: 0,
				viewCountAllTime: 0,
			},
		});
		const result = await service.get(LANDLORD, {}, NOW);
		expect(result.listings).toEqual({
			total: 0,
			public: 0,
			hiddenByQuota: 0,
			hiddenByOwner: 0,
			hiddenByAdmin: 0,
		});
		expect(result.views).toEqual({
			inRange: { value: 0, previous: 0, changePercent: null },
			allTime: 0,
			top: [],
		});
		expect(result.series).toHaveLength(30);
		expect(result.series.every((point) => point.views === 0)).toBe(true);
	});
});
