import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { SettingsService } from '../settings/settings.service';
import type {
	AccountCountRow,
	AdminOverviewRepository,
	DailyCountRow,
	EngagementSource,
	HiddenReviewCounts,
	LandlordGroupCounts,
	ListingStatusCounts,
	RegisteredAccountType,
	WardCountRow,
} from './admin-overview.repository';
import { AdminOverviewService } from './admin-overview.service';
import type { OverviewSeriesPointResponse } from './dto/admin-overview.response';

/** Giữa trưa giờ Việt Nam ngày 16/11/2026: mặc định 30 ngày là 2026-10-18 đến 2026-11-16, kỳ trước 2026-09-18 đến 2026-10-17. */
const NOW = new Date('2026-11-16T05:00:00.000Z');

const ACCOUNTS: AccountCountRow[] = [
	{ accountType: 'admin', status: 'active', count: 2 },
	{ accountType: 'landlord', status: 'active', count: 3 },
	{ accountType: 'landlord', status: 'locked', count: 1 },
	{ accountType: 'tenant', status: 'active', count: 10 },
	{ accountType: 'tenant', status: 'locked', count: 2 },
];

interface Setup {
	accounts?: AccountCountRow[];
	landlordRegistrations?: DailyCountRow[];
	tenantRegistrations?: DailyCountRow[];
	landlordGroups?: LandlordGroupCounts;
	listingCounts?: ListingStatusCounts;
	publicCount?: number;
	created?: DailyCountRow[];
	byWard?: WardCountRow[];
	views?: DailyCountRow[];
	engagement?: Partial<Record<EngagementSource, DailyCountRow[]>>;
	hiddenReviews?: HiddenReviewCounts;
	trialListingLimit?: number;
}

function build(options: Setup = {}) {
	const repository = {
		countAccounts: jest.fn(() =>
			Promise.resolve(options.accounts ?? ACCOUNTS),
		),
		// Tham số được khai báo để `mock.calls` có kiểu; chỉ `toHaveBeenCalledWith` và `calls[0]` đọc chúng.
		findRegistrations: jest.fn(
			(type: RegisteredAccountType, start: string, end: string) => {
				void [start, end];
				return Promise.resolve(
					(type === 'landlord'
						? options.landlordRegistrations
						: options.tenantRegistrations) ?? [],
				);
			},
		),
		countLandlordGroups: jest.fn((now: Date) => {
			void now;
			return Promise.resolve(
				options.landlordGroups ?? {
					total: 4,
					onPlan: 1,
					onTrial: 2,
					trialExpired: 1,
				},
			);
		}),
		countListingsByStatus: jest.fn(() =>
			Promise.resolve(
				options.listingCounts ?? {
					visible: 6,
					hiddenByOwner: 2,
					hiddenByAdmin: 1,
				},
			),
		),
		countPublicListings: jest.fn((now: Date, limit: number) => {
			void [now, limit];
			return Promise.resolve(options.publicCount ?? 4);
		}),
		findCreatedListings: jest.fn((start: string, end: string) => {
			void [start, end];
			return Promise.resolve(options.created ?? []);
		}),
		findCreatedByWard: jest.fn((start: string, end: string) => {
			void [start, end];
			return Promise.resolve(options.byWard ?? []);
		}),
		findDailyViews: jest.fn((from: string, to: string) => {
			void [from, to];
			return Promise.resolve(options.views ?? []);
		}),
		findEngagement: jest.fn(
			(source: EngagementSource, start: string, end: string) => {
				void [start, end];
				return Promise.resolve(options.engagement?.[source] ?? []);
			},
		),
		countHiddenReviews: jest.fn(() =>
			Promise.resolve(
				options.hiddenReviews ?? {
					hiddenLandlordReviews: 0,
					hiddenRoomReviews: 0,
				},
			),
		),
	};
	const settings = {
		getValue: jest.fn(() =>
			Promise.resolve(options.trialListingLimit ?? 2),
		),
	};
	const service = new AdminOverviewService(
		repository as unknown as AdminOverviewRepository,
		settings as unknown as SettingsService,
	);
	return { service, repository, settings };
}

async function errorOf(promise: Promise<unknown>): Promise<AppException> {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(AppException);
	return error as AppException;
}

function expectNothingRead(
	repository: ReturnType<typeof build>['repository'],
	settings: ReturnType<typeof build>['settings'],
): void {
	for (const mock of Object.values(repository))
		expect(mock).not.toHaveBeenCalled();
	expect(settings.getValue).not.toHaveBeenCalled();
}

describe('AdminOverviewService.get: tham số (spec 0018 AC-2, AC-15)', () => {
	it.each([
		['from sau to', { from: '2026-11-02', to: '2026-11-01' }],
		['khoảng 367 ngày', { from: '2025-11-15', to: '2026-11-16' }],
	])(
		'%s bị 400 VALIDATION_FAILED ở trường to và không đọc bảng dữ liệu nào, kể cả hạn mức dùng thử',
		async (_name, query) => {
			const { service, repository, settings } = build();
			const error = await errorOf(service.get(query, NOW));
			expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
			expect(error.fieldErrors.map((item) => item.field)).toEqual(['to']);
			expectNothingRead(repository, settings);
		},
	);

	it('khoảng 366 ngày là hợp lệ', async () => {
		const { service } = build();
		const result = await service.get(
			{ from: '2025-11-16', to: '2026-11-16' },
			NOW,
		);
		expect(result.period.days).toBe(366);
		expect(result.series).toHaveLength(366);
	});
});

describe('AdminOverviewService.get: khoảng ngày và cận truy vấn (spec 0018 AC-2, AC-3, AC-13)', () => {
	it('mặc định 30 ngày kết thúc hôm nay giờ Việt Nam; period đủ sáu trường, timeZone là Asia/Ho_Chi_Minh', async () => {
		const { service } = build();
		const result = await service.get({}, NOW);
		expect(result.period).toEqual({
			from: '2026-10-18',
			to: '2026-11-16',
			days: 30,
			previousFrom: '2026-09-18',
			previousTo: '2026-10-17',
			timeZone: 'Asia/Ho_Chi_Minh',
		});
	});

	it('các nguồn theo thời điểm nhận cả hai kỳ [previousFrom, ngày sau to), chuỗi ISO có Z', async () => {
		const { service, repository } = build();
		await service.get({}, NOW);
		const start = '2026-09-17T17:00:00.000Z';
		const end = '2026-11-16T17:00:00.000Z';
		expect(repository.findRegistrations).toHaveBeenCalledWith(
			'landlord',
			start,
			end,
		);
		expect(repository.findRegistrations).toHaveBeenCalledWith(
			'tenant',
			start,
			end,
		);
		expect(repository.findCreatedListings).toHaveBeenCalledWith(start, end);
	});

	it.each([
		'conversations',
		'messages',
		'landlordReviews',
		'roomReviews',
		'follows',
		'favorites',
	] as const)(
		'nguồn tương tác %s nhận cả hai kỳ [previousFrom, ngày sau to), chuỗi ISO có Z, đúng một lần',
		async (source) => {
			const { service, repository } = build();
			await service.get({}, NOW);
			const calls = repository.findEngagement.mock.calls.filter(
				([name]) => name === source,
			);
			expect(calls).toEqual([
				[
					source,
					'2026-09-17T17:00:00.000Z',
					'2026-11-16T17:00:00.000Z',
				],
			]);
		},
	);

	it('tin mới theo phường chỉ nhận cận của riêng kỳ này, không có kỳ trước', async () => {
		const { service, repository } = build();
		await service.get({}, NOW);
		expect(repository.findCreatedByWard).toHaveBeenCalledWith(
			'2026-10-17T17:00:00.000Z',
			'2026-11-16T17:00:00.000Z',
		);
	});

	it('lượt xem theo ngày nhận hai ngày YYYY-MM-DD: previousFrom và to', async () => {
		const { service, repository } = build();
		await service.get({}, NOW);
		expect(repository.findDailyViews).toHaveBeenCalledWith(
			'2026-09-18',
			'2026-11-16',
		);
	});

	it('một đồng hồ now cho mọi số của lúc đọc: nhóm chủ trọ và đếm công khai cùng nhận đúng now của request', async () => {
		const { service, repository } = build();
		await service.get({}, NOW);
		expect(repository.countLandlordGroups).toHaveBeenCalledWith(NOW);
		expect(repository.countPublicListings.mock.calls[0]?.[0]).toBe(NOW);
	});

	it('hạn mức dùng thử đọc từ settings đúng một lần và truyền cho đếm công khai', async () => {
		const { service, repository, settings } = build({
			trialListingLimit: 5,
		});
		await service.get({}, NOW);
		expect(settings.getValue).toHaveBeenCalledTimes(1);
		expect(settings.getValue).toHaveBeenCalledWith('trial_listing_limit');
		expect(repository.countPublicListings).toHaveBeenCalledWith(NOW, 5);
	});
});

describe('AdminOverviewService.get: các khối (spec 0018 AC-1, AC-4 đến AC-10)', () => {
	it('trả đúng bảy khóa (AC-1): period, accounts, landlords, listings, engagement, toHandle, series', async () => {
		const { service } = build();
		const result = await service.get({}, NOW);
		expect(Object.keys(result)).toEqual([
			'period',
			'accounts',
			'landlords',
			'listings',
			'engagement',
			'toHandle',
			'series',
		]);
		expect(Object.keys(result.engagement)).toEqual([
			'views',
			'conversations',
			'messages',
			'landlordReviews',
			'roomReviews',
			'follows',
			'favorites',
		]);
		expect(Object.keys(result.toHandle)).toEqual([
			'hiddenListings',
			'hiddenLandlordReviews',
			'hiddenRoomReviews',
		]);
		expect(Object.keys(result.series[0] ?? {})).toEqual([
			'date',
			'newLandlords',
			'newTenants',
			'newListings',
			'views',
			'newConversations',
			'newMessages',
			'newLandlordReviews',
			'newRoomReviews',
			'newFollows',
			'newFavorites',
		]);
	});

	it('engagement: mỗi nguồn là Metric của đúng bảng của nó, kỳ này và kỳ trước tách theo ngày (AC-10)', async () => {
		const { service } = build({
			engagement: {
				conversations: [
					{ day: '2026-11-10', count: 4 },
					{ day: '2026-09-20', count: 5 },
				],
				messages: [
					{ day: '2026-11-10', count: 30 },
					{ day: '2026-11-11', count: 20 },
					{ day: '2026-10-01', count: 25 },
				],
				landlordReviews: [{ day: '2026-11-10', count: 2 }],
				roomReviews: [
					{ day: '2026-11-12', count: 3 },
					{ day: '2026-10-05', count: 6 },
				],
				follows: [{ day: '2026-10-05', count: 4 }],
				favorites: [
					{ day: '2026-11-01', count: 7 },
					{ day: '2026-11-02', count: 1 },
					{ day: '2026-09-18', count: 4 },
				],
			},
		});
		const { engagement } = await service.get({}, NOW);
		expect(engagement.conversations).toEqual({
			value: 4,
			previous: 5,
			changePercent: -20,
		});
		expect(engagement.messages).toEqual({
			value: 50,
			previous: 25,
			changePercent: 100,
		});
		expect(engagement.landlordReviews).toEqual({
			value: 2,
			previous: 0,
			changePercent: null,
		});
		expect(engagement.roomReviews).toEqual({
			value: 3,
			previous: 6,
			changePercent: -50,
		});
		expect(engagement.follows).toEqual({
			value: 0,
			previous: 4,
			changePercent: -100,
		});
		expect(engagement.favorites).toEqual({
			value: 8,
			previous: 4,
			changePercent: 100,
		});
	});

	it('toHandle: hai số đánh giá là của Repository, hiddenListings luôn bằng listings.hiddenByAdmin; tin bị chủ trọ ẩn không tính (AC-11)', async () => {
		const { service } = build({
			listingCounts: { visible: 5, hiddenByOwner: 9, hiddenByAdmin: 4 },
			hiddenReviews: { hiddenLandlordReviews: 3, hiddenRoomReviews: 7 },
		});
		const { toHandle, listings } = await service.get({}, NOW);
		expect(toHandle).toEqual({
			hiddenListings: 4,
			hiddenLandlordReviews: 3,
			hiddenRoomReviews: 7,
		});
		expect(toHandle.hiddenListings).toBe(listings.hiddenByAdmin);
	});

	it('toHandle không đọc Repository thêm cho tin: hiddenListings lấy từ cùng lần đếm theo trạng thái', async () => {
		const { service, repository } = build();
		await service.get({}, NOW);
		expect(repository.countListingsByStatus).toHaveBeenCalledTimes(1);
		expect(repository.countHiddenReviews).toHaveBeenCalledTimes(1);
	});

	it('accounts: các nhóm cộng đúng và đăng ký mới chỉ tính landlord và tenant (total là tổng hai loại)', async () => {
		const { service } = build({
			landlordRegistrations: [
				{ day: '2026-11-10', count: 2 },
				{ day: '2026-09-20', count: 1 },
			],
			tenantRegistrations: [
				{ day: '2026-11-10', count: 5 },
				{ day: '2026-10-01', count: 4 },
			],
		});
		const { accounts } = await service.get({}, NOW);
		expect(accounts.total).toBe(18);
		expect(accounts.total).toBe(accounts.active + accounts.locked);
		expect(accounts.registered.landlords).toEqual({
			value: 2,
			previous: 1,
			changePercent: 100,
		});
		expect(accounts.registered.tenants).toEqual({
			value: 5,
			previous: 4,
			changePercent: 25,
		});
		expect(accounts.registered.total).toEqual({
			value: 7,
			previous: 5,
			changePercent: 40,
		});
	});

	it('landlords là ba nhóm của repository, đúng nguyên số', async () => {
		const { service } = build({
			landlordGroups: {
				total: 9,
				onPlan: 3,
				onTrial: 4,
				trialExpired: 2,
			},
		});
		const { landlords } = await service.get({}, NOW);
		expect(landlords).toEqual({
			total: 9,
			onPlan: 3,
			onTrial: 4,
			trialExpired: 2,
		});
		expect(landlords.total).toBe(
			landlords.onPlan + landlords.onTrial + landlords.trialExpired,
		);
	});

	it('listings: total là tổng ba trạng thái, visibleButNotPublic = visible − public, không âm', async () => {
		const { service } = build({
			listingCounts: { visible: 10, hiddenByOwner: 3, hiddenByAdmin: 2 },
			publicCount: 7,
		});
		const { listings } = await service.get({}, NOW);
		expect(listings.total).toBe(15);
		expect(listings.public).toBe(7);
		expect(listings.visibleButNotPublic).toBe(3);
		const skewed = await build({
			listingCounts: { visible: 2, hiddenByOwner: 0, hiddenByAdmin: 0 },
			publicCount: 9,
		}).service.get({}, NOW);
		expect(skewed.listings.visibleButNotPublic).toBe(0);
	});

	it('listings.created có kỳ trước; createdByWard giữ nguyên thứ tự truy vấn và không có kỳ trước', async () => {
		const byWard: WardCountRow[] = [
			{ wardCode: '26734', wardName: 'Phường Bến Thành', count: 2 },
			{ wardCode: '26737', wardName: 'Phường Võ Thị Sáu', count: 1 },
		];
		const { service } = build({
			created: [
				{ day: '2026-11-01', count: 2 },
				{ day: '2026-11-02', count: 1 },
				{ day: '2026-09-30', count: 6 },
			],
			byWard,
		});
		const { listings } = await service.get({}, NOW);
		expect(listings.created).toEqual({
			value: 3,
			previous: 6,
			changePercent: -50,
		});
		expect(listings.createdByWard).toEqual(byWard);
		expect(
			listings.createdByWard.reduce((sum, ward) => sum + ward.count, 0),
		).toBe(listings.created.value);
	});

	it('engagement.views là Metric từ các dòng theo ngày của hai kỳ', async () => {
		const { service } = build({
			views: [
				{ day: '2026-10-20', count: 40 },
				{ day: '2026-11-16', count: 60 },
				{ day: '2026-10-01', count: 50 },
			],
		});
		const { engagement } = await service.get({}, NOW);
		expect(engagement.views).toEqual({
			value: 100,
			previous: 50,
			changePercent: 100,
		});
	});
});

describe('AdminOverviewService.get: chuỗi theo ngày (spec 0018 AC-12, AC-13, AC-14)', () => {
	it('tổng mỗi cột bằng value của Metric tương ứng, kỳ trước không lọt vào chuỗi, ngày không có gì là 0', async () => {
		const { service } = build({
			landlordRegistrations: [
				{ day: '2026-10-18', count: 1 },
				{ day: '2026-11-16', count: 2 },
				{ day: '2026-10-17', count: 9 },
			],
			tenantRegistrations: [{ day: '2026-11-01', count: 4 }],
			created: [
				{ day: '2026-11-01', count: 3 },
				{ day: '2026-09-18', count: 7 },
			],
			views: [
				{ day: '2026-11-01', count: 10 },
				{ day: '2026-11-02', count: 20 },
				{ day: '2026-09-18', count: 99 },
			],
			engagement: {
				conversations: [
					{ day: '2026-11-03', count: 2 },
					{ day: '2026-09-19', count: 8 },
				],
				messages: [
					{ day: '2026-11-03', count: 11 },
					{ day: '2026-11-04', count: 12 },
				],
				landlordReviews: [{ day: '2026-10-20', count: 1 }],
				roomReviews: [
					{ day: '2026-10-21', count: 2 },
					{ day: '2026-10-17', count: 5 },
				],
				follows: [
					{ day: '2026-11-16', count: 3 },
					{ day: '2026-10-18', count: 1 },
				],
				favorites: [
					{ day: '2026-11-01', count: 6 },
					{ day: '2026-11-15', count: 2 },
				],
			},
		});
		const result = await service.get({}, NOW);
		const sum = (
			key: Exclude<keyof OverviewSeriesPointResponse, 'date'>,
		): number =>
			result.series.reduce((total, point) => total + point[key], 0);
		expect(result.series).toHaveLength(30);
		expect(sum('newLandlords')).toBe(
			result.accounts.registered.landlords.value,
		);
		expect(sum('newTenants')).toBe(
			result.accounts.registered.tenants.value,
		);
		expect(sum('newListings')).toBe(result.listings.created.value);
		expect(sum('views')).toBe(result.engagement.views.value);
		expect(sum('newConversations')).toBe(
			result.engagement.conversations.value,
		);
		expect(sum('newMessages')).toBe(result.engagement.messages.value);
		expect(sum('newLandlordReviews')).toBe(
			result.engagement.landlordReviews.value,
		);
		expect(sum('newRoomReviews')).toBe(result.engagement.roomReviews.value);
		expect(sum('newFollows')).toBe(result.engagement.follows.value);
		expect(sum('newFavorites')).toBe(result.engagement.favorites.value);
		// Cột không mang số của kỳ trước: số 8 của hội thoại ngày 2026-09-19 chỉ nằm ở `previous`.
		expect(result.engagement.conversations.previous).toBe(8);
		expect(result.series[0]?.date).toBe('2026-10-18');
		expect(result.series[29]?.date).toBe('2026-11-16');
		expect(result.series[1]).toEqual({
			date: '2026-10-19',
			newLandlords: 0,
			newTenants: 0,
			newListings: 0,
			views: 0,
			newConversations: 0,
			newMessages: 0,
			newLandlordReviews: 0,
			newRoomReviews: 0,
			newFollows: 0,
			newFavorites: 0,
		});
		expect(result.series[0]).toMatchObject({
			newFollows: 1,
			newLandlordReviews: 0,
		});
		expect(result.series[29]).toMatchObject({ newFollows: 3 });
	});

	it('khoảng không có dữ liệu: mọi số của kỳ bằng 0, changePercent là null, createdByWard là [], series đủ ngày toàn 0', async () => {
		const { service } = build({
			accounts: [{ accountType: 'admin', status: 'active', count: 1 }],
			landlordGroups: {
				total: 0,
				onPlan: 0,
				onTrial: 0,
				trialExpired: 0,
			},
			listingCounts: { visible: 0, hiddenByOwner: 0, hiddenByAdmin: 0 },
			publicCount: 0,
		});
		const result = await service.get(
			{ from: '2026-11-10', to: '2026-11-16' },
			NOW,
		);
		const zero = { value: 0, previous: 0, changePercent: null };
		expect(result.accounts.registered).toEqual({
			total: zero,
			landlords: zero,
			tenants: zero,
		});
		expect(result.listings.created).toEqual(zero);
		expect(result.listings.createdByWard).toEqual([]);
		for (const metric of Object.values(result.engagement))
			expect(metric).toEqual(zero);
		expect(result.toHandle).toEqual({
			hiddenListings: 0,
			hiddenLandlordReviews: 0,
			hiddenRoomReviews: 0,
		});
		expect(result.series).toHaveLength(7);
		for (const point of result.series)
			for (const [key, value] of Object.entries(point))
				if (key !== 'date') expect(value).toBe(0);
	});

	it('phản hồi chỉ có số đếm, ngày, mã và tên phường: không có trường nào là chuỗi ngoài ngày, múi giờ và tên phường', async () => {
		const { service } = build({
			byWard: [
				{ wardCode: '26734', wardName: 'Phường Bến Thành', count: 1 },
			],
		});
		const result = await service.get({}, NOW);
		const strings: string[] = [];
		(function walk(value: unknown): void {
			if (typeof value === 'string') strings.push(value);
			else if (Array.isArray(value)) value.forEach(walk);
			else if (value !== null && typeof value === 'object')
				Object.values(value).forEach(walk);
		})(result);
		for (const text of strings)
			expect(text).toMatch(
				/^(\d{4}-\d{2}-\d{2}|Asia\/Ho_Chi_Minh|26734|Phường Bến Thành)$/,
			);
	});
});

describe('AdminOverviewService: chỉ đọc (spec 0018 AC-1)', () => {
	it('mọi phương thức Repository được gọi đều là count* hay find*: không có đường ghi', async () => {
		const { service, repository } = build();
		await service.get({}, NOW);
		for (const name of Object.keys(repository))
			expect(name).toMatch(/^(count|find)[A-Z]/);
	});
});
