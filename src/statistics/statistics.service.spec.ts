import type { AccountType } from '../common/auth/account-type';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type {
	Membership,
	MembershipsService,
} from '../memberships/memberships.service';
import type { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import type {
	ChatAggregate,
	DailyAggregate,
	DailyCount,
	ListingCounts,
	TopListingRow,
} from './statistics.repository';
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

const EMPTY_AGGREGATE: DailyAggregate = {
	counts: [],
	amounts: [],
	total: 0,
	amountTotal: 0,
};

const EMPTY_CHAT: ChatAggregate = {
	opened: [],
	replied: [],
	total: 0,
	unreadConversations: 0,
	unreadMessages: 0,
};

/** Một nguồn "theo ngày cộng tổng": `days` là cặp [ngày, số đếm], `amounts` là cặp [ngày, tổng] (mặc định rỗng). */
function aggregate(
	days: [string, number][],
	total: number,
	more: { amounts?: [string, number][]; amountTotal?: number } = {},
): DailyAggregate {
	const toDays = (pairs: [string, number][]): DailyCount[] =>
		pairs.map(([day, count]) => ({ day, count }));
	return {
		counts: toDays(days),
		amounts: toDays(more.amounts ?? []),
		total,
		amountTotal: more.amountTotal ?? 0,
	};
}

interface Setup {
	membership?: Membership;
	counts?: ListingCounts;
	daily?: { day: string; count: number }[];
	top?: TopListingRow[];
	latestEndsAt?: Date | null;
	favorites?: DailyAggregate;
	followers?: DailyAggregate;
	landlordReviews?: DailyAggregate;
	roomReviews?: DailyAggregate;
	chat?: ChatAggregate;
	orders?: DailyAggregate;
}

function build(options: Setup = {}) {
	// Tham số được khai báo để `mock.calls` có kiểu; chỉ `toHaveBeenCalledWith` và `calls[0]` đọc chúng.
	const ranged =
		<T>(result: T | undefined, fallback: T) =>
		(userId: string, start: string, end: string) => {
			void [userId, start, end];
			return Promise.resolve(result ?? fallback);
		};
	const repository = {
		findFavorites: jest.fn(ranged(options.favorites, EMPTY_AGGREGATE)),
		findFollowers: jest.fn(ranged(options.followers, EMPTY_AGGREGATE)),
		findLandlordReviews: jest.fn(
			ranged(options.landlordReviews, EMPTY_AGGREGATE),
		),
		findRoomReviews: jest.fn(ranged(options.roomReviews, EMPTY_AGGREGATE)),
		findChat: jest.fn(ranged(options.chat, EMPTY_CHAT)),
		findPaidOrders: jest.fn(ranged(options.orders, EMPTY_AGGREGATE)),
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
			expect(repository.findFavorites).not.toHaveBeenCalled();
			expect(repository.findFollowers).not.toHaveBeenCalled();
			expect(repository.findLandlordReviews).not.toHaveBeenCalled();
			expect(repository.findRoomReviews).not.toHaveBeenCalled();
			expect(repository.findChat).not.toHaveBeenCalled();
			expect(repository.findPaidOrders).not.toHaveBeenCalled();
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

	it('sáu truy vấn của mốc 2 cũng chỉ nhận id trong token, cùng hai cận đã đổi sang chuỗi ISO có Z', async () => {
		const { service, repository } = build();
		await service.get(LANDLORD, {}, NOW);
		// Khoảng mặc định 18/10 đến 16/11, kỳ trước từ 18/09: nửa đêm giờ Việt Nam là 17:00 UTC ngày hôm trước.
		const start = '2026-09-17T17:00:00.000Z';
		const end = '2026-11-16T17:00:00.000Z';
		for (const query of [
			repository.findFavorites,
			repository.findFollowers,
			repository.findLandlordReviews,
			repository.findRoomReviews,
			repository.findChat,
			repository.findPaidOrders,
		]) {
			expect(query).toHaveBeenCalledTimes(1);
			expect(query).toHaveBeenCalledWith(LANDLORD_ID, start, end);
		}
	});

	it('phản hồi có đúng chín khóa theo thứ tự của spec (spec 0017 AC-1)', async () => {
		const { service } = build();
		const result = await service.get(LANDLORD, {}, NOW);
		expect(Object.keys(result)).toEqual([
			'period',
			'listings',
			'membership',
			'views',
			'interest',
			'ratings',
			'chat',
			'spending',
			'series',
		]);
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
		const emptyColumns = {
			newFavorites: 0,
			newFollowers: 0,
			newConversations: 0,
		};
		expect(result.series[0]).toEqual({
			date: '2026-10-18',
			views: 3,
			...emptyColumns,
		});
		expect(result.series[29]).toEqual({
			date: '2026-11-16',
			views: 8,
			...emptyColumns,
		});
		expect(result.series.find((p) => p.date === '2026-10-19')).toEqual({
			date: '2026-10-19',
			views: 0,
			...emptyColumns,
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

	it('bốn khối của mốc 2 cũng toàn 0 và null: không có dòng nào, không chia cho 0', async () => {
		const { service } = build();
		const result = await service.get(LANDLORD, {}, NOW);
		const zero = { value: 0, previous: 0, changePercent: null };
		expect(result.interest).toEqual({
			newFavorites: zero,
			newFollowers: zero,
			totalFavorites: 0,
			totalFollowers: 0,
		});
		expect(result.ratings).toEqual({
			landlord: { average: null, count: 0, newInRange: zero },
			rooms: { average: null, count: 0, newInRange: zero },
		});
		expect(result.chat).toEqual({
			conversationsOpened: zero,
			repliedConversations: zero,
			replyRate: { value: null, previous: null, changePoints: null },
			totalConversations: 0,
			unreadConversations: 0,
			unreadMessages: 0,
		});
		expect(result.spending).toEqual({
			spent: zero,
			paidOrders: zero,
			spentAllTime: 0,
		});
		expect(
			result.series.every(
				(p) =>
					p.newFavorites === 0 &&
					p.newFollowers === 0 &&
					p.newConversations === 0,
			),
		).toBe(true);
	});
});

describe('StatisticsService.get: mức quan tâm (spec 0017 AC-8)', () => {
	it('lưu và theo dõi mới: value kỳ này, previous kỳ trước, changePercent; tổng là số hiện tại không có kỳ trước', async () => {
		const { service } = build({
			favorites: aggregate(
				[
					['2026-09-20', 6], // kỳ trước
					['2026-10-20', 4],
					['2026-11-16', 5],
				],
				31,
			),
			followers: aggregate(
				[
					['2026-10-01', 4], // kỳ trước
					['2026-11-01', 4],
				],
				17,
			),
		});
		const { interest } = await service.get(LANDLORD, {}, NOW);
		expect(interest).toEqual({
			newFavorites: { value: 9, previous: 6, changePercent: 50 },
			newFollowers: { value: 4, previous: 4, changePercent: 0 },
			totalFavorites: 31,
			totalFollowers: 17,
		});
	});

	it('hai nguồn không lẫn nhau: số lưu không đổi số theo dõi', async () => {
		const { service } = build({
			favorites: aggregate([['2026-11-01', 7]], 7),
		});
		const { interest } = await service.get(LANDLORD, {}, NOW);
		expect(interest.newFavorites.value).toBe(7);
		expect(interest.newFollowers.value).toBe(0);
		expect(interest.totalFollowers).toBe(0);
	});
});

describe('StatisticsService.get: đánh giá (spec 0017 AC-9)', () => {
	it('chủ trọ và phòng là hai khối riêng, mỗi khối có average, count và newInRange của nguồn của nó', async () => {
		const { service } = build({
			landlordReviews: aggregate([['2026-11-05', 3]], 12, {
				amountTotal: 55,
			}),
			roomReviews: aggregate(
				[
					['2026-10-01', 4], // kỳ trước
					['2026-11-05', 5],
				],
				20,
				{ amountTotal: 84 },
			),
		});
		const { ratings } = await service.get(LANDLORD, {}, NOW);
		expect(ratings.landlord).toEqual({
			average: 4.6,
			count: 12,
			newInRange: { value: 3, previous: 0, changePercent: null },
		});
		expect(ratings.rooms).toEqual({
			average: 4.2,
			count: 20,
			newInRange: { value: 5, previous: 4, changePercent: 25 },
		});
	});

	it('điểm phòng không cộng vào điểm chủ trọ: chủ trọ chưa có đánh giá nào thì average của họ vẫn null dù phòng đã có', async () => {
		const { service } = build({
			roomReviews: aggregate([['2026-11-05', 2]], 2, { amountTotal: 10 }),
		});
		const { ratings } = await service.get(LANDLORD, {}, NOW);
		expect(ratings.landlord.average).toBeNull();
		expect(ratings.landlord.count).toBe(0);
		expect(ratings.rooms.average).toBe(5);
		expect(ratings.rooms.count).toBe(2);
	});

	it('average làm tròn nửa lên bằng số nguyên: 87 sao trên 20 đánh giá ra 4.4', async () => {
		const { service } = build({
			landlordReviews: aggregate([], 20, { amountTotal: 87 }),
		});
		const { ratings } = await service.get(LANDLORD, {}, NOW);
		expect(ratings.landlord.average).toBe(4.4);
	});
});

describe('StatisticsService.get: chat (spec 0017 AC-10)', () => {
	const CHAT: ChatAggregate = {
		opened: [
			{ day: '2026-09-25', count: 5 }, // kỳ trước
			{ day: '2026-11-02', count: 5 },
			{ day: '2026-11-10', count: 3 },
		],
		replied: [
			{ day: '2026-09-25', count: 4 },
			{ day: '2026-11-02', count: 4 },
			{ day: '2026-11-10', count: 2 },
		],
		total: 41,
		unreadConversations: 2,
		unreadMessages: 5,
	};

	it('mở, đã trả lời, tỉ lệ trả lời và điểm đổi: 6 trên 8 so với 4 trên 5 là 75 so với 80, đổi -5 điểm', async () => {
		const { service } = build({ chat: CHAT });
		const { chat } = await service.get(LANDLORD, {}, NOW);
		expect(chat).toEqual({
			conversationsOpened: { value: 8, previous: 5, changePercent: 60 },
			repliedConversations: { value: 6, previous: 4, changePercent: 50 },
			replyRate: { value: 75, previous: 80, changePoints: -5 },
			totalConversations: 41,
			unreadConversations: 2,
			unreadMessages: 5,
		});
	});

	it('kỳ này không mở cuộc nào thì replyRate.value là null và changePoints là null, dù kỳ trước có tỉ lệ', async () => {
		const { service } = build({
			chat: {
				...CHAT,
				opened: [{ day: '2026-09-25', count: 5 }],
				replied: [{ day: '2026-09-25', count: 4 }],
			},
		});
		const { chat } = await service.get(LANDLORD, {}, NOW);
		expect(chat.replyRate).toEqual({
			value: null,
			previous: 80,
			changePoints: null,
		});
		expect(chat.conversationsOpened.value).toBe(0);
	});

	it('cột newConversations của chuỗi đếm đúng các cuộc mở và tổng bằng conversationsOpened.value', async () => {
		const { service } = build({ chat: CHAT });
		const result = await service.get(LANDLORD, {}, NOW);
		const sum = result.series.reduce((t, p) => t + p.newConversations, 0);
		expect(sum).toBe(result.chat.conversationsOpened.value);
		expect(sum).toBe(8);
		expect(
			result.series.find((p) => p.date === '2026-11-02')
				?.newConversations,
		).toBe(5);
		expect(
			result.series.find((p) => p.date === '2026-11-10')
				?.newConversations,
		).toBe(3);
	});
});

describe('StatisticsService.get: gói và tiền đã chi (spec 0017 AC-11)', () => {
	it('spent và paidOrders là Metric theo kỳ; spentAllTime là tổng mọi đơn đã trả, không có kỳ trước', async () => {
		const { service } = build({
			orders: aggregate([['2026-11-10', 1]], 2, {
				amounts: [['2026-11-10', 199_000]],
				amountTotal: 398_000,
			}),
		});
		const { spending } = await service.get(LANDLORD, {}, NOW);
		expect(spending).toEqual({
			spent: { value: 199_000, previous: 0, changePercent: null },
			paidOrders: { value: 1, previous: 0, changePercent: null },
			spentAllTime: 398_000,
		});
	});

	it('so với kỳ trước: 199.000 trên 99.000 ra +101 phần trăm (làm tròn một chữ số), số đơn 2 trên 1 ra +100', async () => {
		const { service } = build({
			orders: aggregate(
				[
					['2026-10-01', 1], // kỳ trước
					['2026-11-01', 2],
				],
				3,
				{
					amounts: [
						['2026-10-01', 99_000],
						['2026-11-01', 199_000],
					],
					amountTotal: 298_000,
				},
			),
		});
		const { spending } = await service.get(LANDLORD, {}, NOW);
		expect(spending.spent).toEqual({
			value: 199_000,
			previous: 99_000,
			changePercent: 101,
		});
		expect(spending.paidOrders).toEqual({
			value: 2,
			previous: 1,
			changePercent: 100,
		});
	});

	it('tổng vượt 2,1 tỷ đồng vẫn đúng, không ép về int4', async () => {
		const { service } = build({
			orders: aggregate([['2026-11-10', 30]], 30, {
				amounts: [['2026-11-10', 3_000_000_000]],
				amountTotal: 3_000_000_000,
			}),
		});
		const { spending } = await service.get(LANDLORD, {}, NOW);
		expect(spending.spent.value).toBe(3_000_000_000);
		expect(spending.spentAllTime).toBe(3_000_000_000);
		expect(spending.paidOrders.value).toBe(30);
	});
});

describe('StatisticsService.get: chuỗi bốn cột (spec 0017 AC-12)', () => {
	it('mỗi cột lấy đúng nguồn của nó và tổng từng cột bằng value của Metric tương ứng', async () => {
		const { service } = build({
			daily: [
				{ day: '2026-10-18', count: 3 },
				{ day: '2026-11-16', count: 8 },
			],
			favorites: aggregate(
				[
					['2026-10-20', 4],
					['2026-11-16', 5],
				],
				31,
			),
			followers: aggregate([['2026-11-01', 4]], 17),
			chat: {
				...EMPTY_CHAT,
				opened: [{ day: '2026-11-10', count: 3 }],
			},
		});
		const result = await service.get(LANDLORD, {}, NOW);
		expect(result.series).toHaveLength(30);
		const column = (
			key: 'views' | 'newFavorites' | 'newFollowers' | 'newConversations',
		) => result.series.reduce((total, point) => total + point[key], 0);
		expect(column('views')).toBe(result.views.inRange.value);
		expect(column('newFavorites')).toBe(result.interest.newFavorites.value);
		expect(column('newFollowers')).toBe(result.interest.newFollowers.value);
		expect(column('newConversations')).toBe(
			result.chat.conversationsOpened.value,
		);
		expect(result.series.find((p) => p.date === '2026-11-16')).toEqual({
			date: '2026-11-16',
			views: 8,
			newFavorites: 5,
			newFollowers: 0,
			newConversations: 0,
		});
	});

	it('dòng của kỳ trước không lọt vào chuỗi nhưng vẫn vào previous của Metric', async () => {
		const { service } = build({
			favorites: aggregate([['2026-09-20', 6]], 6),
		});
		const result = await service.get(LANDLORD, {}, NOW);
		expect(result.interest.newFavorites).toEqual({
			value: 0,
			previous: 6,
			changePercent: -100,
		});
		expect(result.series.every((p) => p.newFavorites === 0)).toBe(true);
	});
});
