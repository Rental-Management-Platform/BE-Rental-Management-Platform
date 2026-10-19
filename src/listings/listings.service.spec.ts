import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import type { Prisma } from '../generated/prisma/client';
import type {
	Membership,
	MembershipsService,
} from '../memberships/memberships.service';
import type { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import type { PropertiesRepository } from '../properties/properties.repository';
import type { SettingsService } from '../settings/settings.service';
import type { UsersService } from '../users/users.service';
import type { CreateListingDto } from './dto/create-listing.dto';
import type {
	ListListingsQueryDto,
	MyListingsQueryDto,
} from './dto/listing-queries.dto';
import type { UpdateListingDto } from './dto/update-listing.dto';
import { ListingCodeTakenError } from './listing-code';
import {
	LANDLORD_ID,
	LISTING_ID,
	ownerDetailRow,
	ownerSummaryRow,
	PROPERTY_ID,
	publicDetailRow,
	publicSummaryRow,
	WARD,
} from './listings.fixtures';
import type { ListingsRepository } from './listings.repository';
import { ListingsService } from './listings.service';
import { ViewDeduplicator } from './view-deduplicator';

const mockGenerate = jest.fn<string, []>();
jest.mock('./listing-code', () => ({
	...jest.requireActual<typeof import('./listing-code')>('./listing-code'),
	generateListingCode: (): string => mockGenerate(),
}));

const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;

/** Đồng hồ cố định: Service nhận `now` từ controller, không tự lấy giờ. */
const NOW = new Date('2026-10-19T03:00:00.000Z');

/** Chủ trọ còn trong kỳ dùng thử với hạn mức 2 tin (mặc định của `trial_listing_limit`). */
const TRIAL: Membership = {
	state: 'trial',
	limit: 2,
	trialEndsAt: new Date('2026-11-18T03:00:00.000Z'),
};
const EXPIRED: Membership = {
	state: 'expired',
	limit: 0,
	trialEndsAt: new Date('2026-10-18T03:00:00.000Z'),
};

/** Tin đang `hidden_by_owner` của chủ trọ mặc định: điểm xuất phát hợp lệ của `show`. */
const HIDDEN_BY_OWNER = {
	id: LISTING_ID,
	propertyId: PROPERTY_ID,
	status: 'hidden_by_owner',
	property: { landlordId: LANDLORD_ID },
};

/** Các lần gọi của một mock dưới dạng mảng đối số có kiểu `unknown` (tránh `any` của jest). */
function argsOf(mock: jest.Mock): unknown[][] {
	return mock.mock.calls as unknown[][];
}

const owner = { userId: LANDLORD_ID } as RequestUser;
const stranger = {
	userId: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d99',
} as RequestUser;

type Mocks<T extends string> = Record<T, jest.Mock>;

interface Harness {
	service: ListingsService;
	repository: Mocks<
		| 'create'
		| 'findPublicPage'
		| 'findPublicByCode'
		| 'incrementViewCount'
		| 'findOwnership'
		| 'findStatus'
		| 'findOwnerDetail'
		| 'findOwnedPage'
		| 'update'
		| 'softDelete'
		| 'transition'
		| 'countVisibleByLandlord'
	>;
	properties: Mocks<'lockLiveById' | 'findAddressSource'>;
	moderation: Mocks<'findLatestListingHideReasons'>;
	transactions: { run: jest.Mock };
	views: ViewDeduplicator;
	users: Mocks<'lockById'>;
	memberships: Mocks<'resolve'>;
	settings: Mocks<'getValue'>;
}

function build(
	options: {
		ownership?: Awaited<ReturnType<ListingsRepository['findOwnership']>>;
		locked?: { landlordId: string } | null;
		reasons?: Map<string, string>;
		membership?: Membership;
		visibleCount?: number;
		trialListingLimit?: number;
	} = {},
): Harness {
	const repository = {
		create: jest.fn(() => Promise.resolve(LISTING_ID)),
		findPublicPage: jest.fn(() =>
			Promise.resolve({ rows: [publicSummaryRow()], total: 41 }),
		),
		findPublicByCode: jest.fn(() => Promise.resolve(publicDetailRow())),
		incrementViewCount: jest.fn(() => Promise.resolve(8)),
		findOwnership: jest.fn(() =>
			Promise.resolve(
				options.ownership === undefined
					? {
							id: LISTING_ID,
							propertyId: PROPERTY_ID,
							status: 'visible',
							property: { landlordId: LANDLORD_ID },
						}
					: options.ownership,
			),
		),
		findStatus: jest.fn(() => Promise.resolve<string | null>('visible')),
		findOwnerDetail: jest.fn(() => Promise.resolve(ownerDetailRow())),
		findOwnedPage: jest.fn(() =>
			Promise.resolve({ rows: [ownerSummaryRow()], total: 1 }),
		),
		update: jest.fn(() => Promise.resolve(true)),
		softDelete: jest.fn(() => Promise.resolve(true)),
		transition: jest.fn(() => Promise.resolve(true)),
		countVisibleByLandlord: jest.fn(() =>
			Promise.resolve(options.visibleCount ?? 0),
		),
	};
	const users = { lockById: jest.fn(() => Promise.resolve()) };
	const memberships = {
		resolve: jest.fn(() => Promise.resolve(options.membership ?? TRIAL)),
	};
	const settings = {
		getValue: jest.fn(() =>
			Promise.resolve(options.trialListingLimit ?? 2),
		),
	};
	const properties = {
		lockLiveById: jest.fn(() =>
			Promise.resolve(
				options.locked === undefined
					? { landlordId: LANDLORD_ID }
					: options.locked,
			),
		),
		findAddressSource: jest.fn(() =>
			Promise.resolve({
				name: 'Nhà trọ Hoa Hồng',
				addressText: '12 Lê Lợi',
				wardCode: WARD.code,
				ward: WARD,
			}),
		),
	};
	const moderation = {
		findLatestListingHideReasons: jest.fn(() =>
			Promise.resolve(options.reasons ?? new Map<string, string>()),
		),
	};
	const transactions = {
		run: jest.fn(
			<T>(fn: (client: Prisma.TransactionClient) => Promise<T>) => fn(tx),
		),
	};
	const views = new ViewDeduplicator();
	return {
		service: new ListingsService(
			repository as unknown as ListingsRepository,
			properties as unknown as PropertiesRepository,
			moderation as unknown as ModerationLogsRepository,
			transactions as unknown as TransactionRunner,
			views,
			users as unknown as UsersService,
			memberships as unknown as MembershipsService,
			settings as unknown as SettingsService,
		),
		repository,
		properties,
		moderation,
		transactions,
		views,
		users,
		memberships,
		settings,
	};
}

const createDto = (overrides: Partial<CreateListingDto> = {}) => ({
	title: 'Phòng đẹp có gác gần chợ',
	description: 'Phòng sạch sẽ, thoáng mát, giờ giấc tự do.',
	price: 3_500_000,
	areaM2: 22.5,
	...overrides,
});

const updateDto = (dto: Partial<UpdateListingDto>) => dto as UpdateListingDto;

const listQuery = (
	overrides: Partial<ListListingsQueryDto> = {},
): ListListingsQueryDto => ({
	page: 1,
	pageSize: 20,
	sort: 'newest',
	...overrides,
});

beforeEach(() => {
	mockGenerate.mockReset();
	mockGenerate.mockReturnValue('abcd2345');
});

describe('ListingsService.create (AC-5)', () => {
	it('khóa dòng nhà trọ trước khi chèn, cùng một giao dịch', async () => {
		const { service, properties, repository } = build();
		await service.create(owner, PROPERTY_ID, createDto(), NOW);
		expect(properties.lockLiveById).toHaveBeenCalledWith(PROPERTY_ID, tx);
		const lockOrder =
			properties.lockLiveById.mock.invocationCallOrder[0] ?? 0;
		const insertOrder = repository.create.mock.invocationCallOrder[0] ?? 0;
		expect(lockOrder).toBeLessThan(insertOrder);
		expect(repository.create).toHaveBeenCalledWith(expect.anything(), tx);
	});

	it('ghi mã vừa sinh, search_key theo tiêu đề cộng tên nhà trọ, địa chỉ, phường; cọc và ngày mặc định null', async () => {
		const { service, repository } = build();
		await service.create(owner, PROPERTY_ID, createDto(), NOW);
		expect(repository.create).toHaveBeenCalledWith(
			{
				propertyId: PROPERTY_ID,
				code: 'abcd2345',
				title: 'Phòng đẹp có gác gần chợ',
				description: 'Phòng sạch sẽ, thoáng mát, giờ giấc tự do.',
				price: 3_500_000,
				areaM2: 22.5,
				deposit: null,
				availableFrom: null,
				searchKey:
					'phong dep co gac gan cho nha tro hoa hong 12 le loi phuong ben thanh',
			},
			tx,
		);
	});

	it('đổi YYYY-MM-DD thành nửa đêm UTC và giữ tiền cọc', async () => {
		const { service, repository } = build();
		await service.create(
			owner,
			PROPERTY_ID,
			createDto({ deposit: 2_000_000, availableFrom: '2026-11-01' }),
			NOW,
		);
		expect(repository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				deposit: 2_000_000,
				availableFrom: new Date('2026-11-01T00:00:00.000Z'),
			}),
			tx,
		);
	});

	it('không nhận trạng thái hay lượt xem từ ai: Service không truyền chúng, cột lấy mặc định visible và 0', async () => {
		const { service, repository } = build();
		await service.create(owner, PROPERTY_ID, createDto(), NOW);
		const input = argsOf(repository.create)[0]?.[0] as Record<
			string,
			unknown
		>;
		expect(input).not.toHaveProperty('status');
		expect(input).not.toHaveProperty('viewCount');
	});

	it('đọc tin đầy đủ để trả về SAU khi giao dịch xong, không trong giao dịch', async () => {
		const { service, repository, transactions } = build();
		const response = await service.create(
			owner,
			PROPERTY_ID,
			createDto(),
			NOW,
		);
		expect(repository.findOwnerDetail).toHaveBeenCalledWith(LISTING_ID);
		expect(transactions.run).toHaveBeenCalledTimes(1);
		expect(response).toMatchObject({
			status: 'visible',
			moderationReason: null,
		});
	});

	it('nhà trọ không có hoặc đã xóa mềm thì 404 PROPERTY_NOT_FOUND, không chèn', async () => {
		const { service, repository } = build({ locked: null });
		await expect(
			service.create(owner, PROPERTY_ID, createDto(), NOW),
		).rejects.toMatchObject({ code: ErrorCode.PROPERTY_NOT_FOUND });
		expect(repository.create).not.toHaveBeenCalled();
	});

	it('đăng vào nhà trọ của người khác thì 403 NOT_RESOURCE_OWNER, không chèn', async () => {
		const { service, repository } = build();
		await expect(
			service.create(stranger, PROPERTY_ID, createDto(), NOW),
		).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });
		expect(repository.create).not.toHaveBeenCalled();
	});

	describe('trùng mã ngắn', () => {
		it('sinh mã mới và thử lại bằng giao dịch mới (vòng thử lại bọc ngoài giao dịch)', async () => {
			mockGenerate
				.mockReturnValueOnce('aaaaaaaa')
				.mockReturnValueOnce('bbbbbbbb');
			const { service, repository, transactions } = build();
			repository.create.mockRejectedValueOnce(
				new ListingCodeTakenError(),
			);
			await service.create(owner, PROPERTY_ID, createDto(), NOW);
			expect(repository.create).toHaveBeenCalledTimes(2);
			expect(
				argsOf(repository.create).map(
					(call) => (call[0] as { code: string }).code,
				),
			).toEqual(['aaaaaaaa', 'bbbbbbbb']);
			expect(transactions.run).toHaveBeenCalledTimes(2);
		});

		it('hết 5 lần thử thì 500 INTERNAL_ERROR', async () => {
			const { service, repository } = build();
			repository.create.mockRejectedValue(new ListingCodeTakenError());
			await expect(
				service.create(owner, PROPERTY_ID, createDto(), NOW),
			).rejects.toMatchObject({ code: ErrorCode.INTERNAL_ERROR });
			expect(repository.create).toHaveBeenCalledTimes(5);
		});

		it('lỗi khác trùng mã thì ném ngay, không thử lại', async () => {
			const { service, repository } = build();
			repository.create.mockRejectedValue(new Error('mất kết nối'));
			await expect(
				service.create(owner, PROPERTY_ID, createDto(), NOW),
			).rejects.toThrow('mất kết nối');
			expect(repository.create).toHaveBeenCalledTimes(1);
		});

		it('lỗi sở hữu không bị thử lại', async () => {
			const { service, transactions } = build();
			await expect(
				service.create(stranger, PROPERTY_ID, createDto(), NOW),
			).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });
			expect(transactions.run).toHaveBeenCalledTimes(1);
		});
	});
});

describe('ListingsService.listPublic (AC-10, spec 0003 AC-8, AC-9)', () => {
	it('chuyển bộ lọc cho Repository, từ khóa đã tách từ và bỏ dấu', async () => {
		const { service, repository } = build();
		await service.listPublic(
			listQuery({
				q: 'Phòng Đẹp  Tân Định',
				wardCode: '26737',
				minPrice: 2_000_000,
				maxPrice: 5_000_000,
				sort: 'price_asc',
				page: 3,
				pageSize: 10,
			}),
			NOW,
		);
		expect(repository.findPublicPage).toHaveBeenCalledWith(
			{
				searchWords: ['phong', 'dep', 'tan', 'dinh'],
				wardCode: '26737',
				minPrice: 2_000_000,
				maxPrice: 5_000_000,
				sort: 'price_asc',
			},
			{ now: NOW, trialListingLimit: 2 },
			20,
			10,
		);
	});

	it('truyền cho luật hiển thị đúng `now` của request và hạn mức đọc từ settings', async () => {
		const { service, repository, settings } = build({
			trialListingLimit: 5,
		});
		await service.listPublic(listQuery(), NOW);
		expect(settings.getValue).toHaveBeenCalledTimes(1);
		expect(settings.getValue).toHaveBeenCalledWith('trial_listing_limit');
		expect(argsOf(repository.findPublicPage)[0]?.[1]).toEqual({
			now: NOW,
			trialListingLimit: 5,
		});
	});

	it('hạn mức 0 vẫn được truyền xuống (luật hiển thị loại hết, Service không tự bỏ qua)', async () => {
		const { service, repository } = build({ trialListingLimit: 0 });
		await service.listPublic(listQuery(), NOW);
		expect(argsOf(repository.findPublicPage)[0]?.[1]).toEqual({
			now: NOW,
			trialListingLimit: 0,
		});
	});

	it('trả trang { items, total, page, pageSize } với tin tóm tắt', async () => {
		const { service } = build();
		const page = await service.listPublic(
			listQuery({ page: 2, pageSize: 5 }),
			NOW,
		);
		expect(page).toMatchObject({ total: 41, page: 2, pageSize: 5 });
		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({
			code: 'abcd2345',
			fullAddress: '12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		});
	});

	it('q rỗng hoặc vắng thì không lọc từ khóa', async () => {
		const { service, repository } = build();
		await service.listPublic(listQuery({ q: '   ' }), NOW);
		await service.listPublic(listQuery(), NOW);
		for (const call of argsOf(repository.findPublicPage)) {
			expect((call[0] as { searchWords: string[] }).searchWords).toEqual(
				[],
			);
		}
	});

	it('minPrice lớn hơn maxPrice thì 400 VALIDATION_FAILED, không truy vấn', async () => {
		const { service, repository, settings } = build();
		await expect(
			service.listPublic(
				listQuery({ minPrice: 5_000_000, maxPrice: 1_000_000 }),
				NOW,
			),
		).rejects.toMatchObject({
			code: ErrorCode.VALIDATION_FAILED,
			fieldErrors: [
				expect.objectContaining({ field: 'minPrice' }) as unknown,
			],
		});
		expect(repository.findPublicPage).not.toHaveBeenCalled();
		expect(settings.getValue).not.toHaveBeenCalled();
	});

	it('minPrice bằng maxPrice là hợp lệ', async () => {
		const { service } = build();
		await expect(
			service.listPublic(
				listQuery({ minPrice: 3_000_000, maxPrice: 3_000_000 }),
				NOW,
			),
		).resolves.toBeDefined();
	});
});

describe('ListingsService.getPublicDetail (AC-11, AC-12, AC-13, spec 0003 AC-8, AC-9)', () => {
	const guest = { ip: '1.2.3.4' };

	it('slugCode không lấy được mã thì 404 LISTING_NOT_FOUND, không truy vấn', async () => {
		const { service, repository, settings } = build();
		await expect(
			service.getPublicDetail('khong-co-ma', guest, NOW),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_NOT_FOUND });
		expect(repository.findPublicByCode).not.toHaveBeenCalled();
		expect(settings.getValue).not.toHaveBeenCalled();
	});

	it('chỉ phần mã ở cuối được dùng để tra: slug sai vẫn mở được', async () => {
		const { service, repository } = build();
		await service.getPublicDetail(
			'slug-cu-da-doi-tieu-de-abcd2345',
			guest,
			NOW,
		);
		expect(repository.findPublicByCode).toHaveBeenCalledWith(
			'abcd2345',
			expect.anything(),
		);
	});

	it('truyền cho luật hiển thị đúng `now` của request và hạn mức đọc một lần từ settings', async () => {
		const { service, repository, settings } = build({
			trialListingLimit: 3,
		});
		await service.getPublicDetail('abcd2345', guest, NOW);
		expect(settings.getValue).toHaveBeenCalledTimes(1);
		expect(settings.getValue).toHaveBeenCalledWith('trial_listing_limit');
		expect(repository.findPublicByCode).toHaveBeenCalledWith('abcd2345', {
			now: NOW,
			trialListingLimit: 3,
		});
	});

	it('tin không hiển thị công khai thì 404 và không cộng lượt xem', async () => {
		const { service, repository } = build();
		repository.findPublicByCode.mockResolvedValueOnce(null);
		await expect(
			service.getPublicDetail('abcd2345', guest, NOW),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_NOT_FOUND });
		expect(repository.incrementViewCount).not.toHaveBeenCalled();
	});

	it('chủ tin hết hiển thị vì hạn mức cũng 404 với chính chủ (chủ xem tin của mình ở /me/listings)', async () => {
		const { service, repository } = build();
		repository.findPublicByCode.mockResolvedValueOnce(null);
		await expect(
			service.getPublicDetail(
				'abcd2345',
				{ userId: LANDLORD_ID, ip: '1.2.3.4' },
				NOW,
			),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_NOT_FOUND });
	});

	it('khách mở lần đầu: cộng một lượt và trả số sau khi cộng, phone là null', async () => {
		const { service, repository } = build();
		const detail = await service.getPublicDetail('abcd2345', guest, NOW);
		expect(repository.incrementViewCount).toHaveBeenCalledWith(LISTING_ID);
		expect(detail.viewCount).toBe(8);
		expect(detail.landlord.phone).toBeNull();
	});

	it('cùng IP tải lại trong 30 phút không cộng nữa, số lượt là số đã đọc', async () => {
		const { service, repository } = build();
		await service.getPublicDetail('abcd2345', guest, NOW);
		const second = await service.getPublicDetail('abcd2345', guest, NOW);
		const third = await service.getPublicDetail('abcd2345', guest, NOW);
		expect(repository.incrementViewCount).toHaveBeenCalledTimes(1);
		expect(second.viewCount).toBe(7);
		expect(third.viewCount).toBe(7);
	});

	it('hai IP khác nhau được đếm riêng', async () => {
		const { service, repository } = build();
		await service.getPublicDetail('abcd2345', { ip: '1.1.1.1' }, NOW);
		await service.getPublicDetail('abcd2345', { ip: '2.2.2.2' }, NOW);
		expect(repository.incrementViewCount).toHaveBeenCalledTimes(2);
	});

	it('người đăng nhập (không phải chủ tin): thấy phone, được đếm theo tài khoản, không theo IP', async () => {
		const { service, repository } = build();
		const viewer = { userId: stranger.userId, ip: '1.2.3.4' };
		const detail = await service.getPublicDetail('abcd2345', viewer, NOW);
		expect(detail.landlord.phone).toBe('0912345678');
		expect(repository.incrementViewCount).toHaveBeenCalledTimes(1);
		// cùng IP nhưng là khách vẫn được đếm: người xem khác nhau
		await service.getPublicDetail('abcd2345', guest, NOW);
		expect(repository.incrementViewCount).toHaveBeenCalledTimes(2);
	});

	it('chủ tin mở thì không cộng lượt xem (dù lần đầu), nhưng thấy phone', async () => {
		const { service, repository } = build();
		const detail = await service.getPublicDetail(
			'abcd2345',
			{ userId: LANDLORD_ID, ip: '1.2.3.4' },
			NOW,
		);
		expect(repository.incrementViewCount).not.toHaveBeenCalled();
		expect(detail.viewCount).toBe(7);
		expect(detail.landlord.phone).toBe('0912345678');
	});

	it('tin vừa bị ẩn giữa lúc đọc và lúc cộng (cộng trả null) thì giữ số đã đọc', async () => {
		const { service, repository } = build();
		repository.incrementViewCount.mockResolvedValueOnce(null);
		const detail = await service.getPublicDetail('abcd2345', guest, NOW);
		expect(detail.viewCount).toBe(7);
	});
});

describe('ListingsService.listOwn và getOwn (AC-14)', () => {
	const query = (overrides: Partial<MyListingsQueryDto> = {}) => ({
		page: 1,
		pageSize: 20,
		...overrides,
	});

	it('chỉ hỏi tin của người gọi, truyền status và phân trang', async () => {
		const { service, repository } = build();
		await service.listOwn(
			owner,
			query({ status: 'hidden_by_owner', page: 2, pageSize: 5 }),
		);
		expect(repository.findOwnedPage).toHaveBeenCalledWith(
			LANDLORD_ID,
			'hidden_by_owner',
			5,
			5,
		);
	});

	it('chỉ tra lý do cho các tin hidden_by_admin trong trang, và gắn đúng lý do', async () => {
		const hidden = ownerSummaryRow({
			id: 'tin-bi-an',
			status: 'hidden_by_admin',
		});
		const visible = ownerSummaryRow({ id: 'tin-hien', status: 'visible' });
		const { service, repository, moderation } = build({
			reasons: new Map([['tin-bi-an', 'Nội dung sai sự thật']]),
		});
		repository.findOwnedPage.mockResolvedValueOnce({
			rows: [visible, hidden],
			total: 2,
		});
		const page = await service.listOwn(owner, query());
		expect(moderation.findLatestListingHideReasons).toHaveBeenCalledWith([
			'tin-bi-an',
		]);
		expect(page.items.map((item) => item.moderationReason)).toEqual([
			null,
			'Nội dung sai sự thật',
		]);
	});

	it('trang không có tin bị admin ẩn thì không tra nhật ký kiểm duyệt cho ai', async () => {
		const { service, moderation } = build();
		await service.listOwn(owner, query());
		expect(moderation.findLatestListingHideReasons).toHaveBeenCalledWith(
			[],
		);
	});

	it('getOwn: chủ xem được tin đang hidden_by_admin kèm lý do', async () => {
		const { service, repository } = build({
			reasons: new Map([[LISTING_ID, 'Ảnh không đúng thực tế']]),
		});
		repository.findOwnerDetail.mockResolvedValueOnce(
			ownerDetailRow({ status: 'hidden_by_admin' }),
		);
		const detail = await service.getOwn(owner, LISTING_ID);
		expect(detail).toMatchObject({
			status: 'hidden_by_admin',
			moderationReason: 'Ảnh không đúng thực tế',
		});
	});

	it('getOwn: không có hoặc đã xóa mềm thì 404 LISTING_NOT_FOUND', async () => {
		const { service, repository } = build();
		repository.findOwnerDetail.mockResolvedValueOnce(null);
		await expect(service.getOwn(owner, LISTING_ID)).rejects.toMatchObject({
			code: ErrorCode.LISTING_NOT_FOUND,
		});
	});

	it('getOwn: tin của chủ trọ khác thì 403 NOT_RESOURCE_OWNER', async () => {
		const { service } = build();
		await expect(
			service.getOwn(stranger, LISTING_ID),
		).rejects.toMatchObject({
			code: ErrorCode.NOT_RESOURCE_OWNER,
		});
	});
});

describe('ListingsService.update (AC-7)', () => {
	it('tin không có thì 404, tin người khác thì 403, đều không ghi', async () => {
		const missing = build({ ownership: null });
		await expect(
			missing.service.update(
				owner,
				LISTING_ID,
				updateDto({ price: 4_000_000 }),
			),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_NOT_FOUND });
		expect(missing.repository.update).not.toHaveBeenCalled();

		const other = build();
		await expect(
			other.service.update(
				stranger,
				LISTING_ID,
				updateDto({ price: 4_000_000 }),
			),
		).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });
		expect(other.repository.update).not.toHaveBeenCalled();
	});

	it('khóa dòng nhà trọ trước khi ghi', async () => {
		const { service, properties, repository } = build();
		await service.update(
			owner,
			LISTING_ID,
			updateDto({ price: 4_000_000 }),
		);
		expect(properties.lockLiveById).toHaveBeenCalledWith(PROPERTY_ID, tx);
		expect(
			properties.lockLiveById.mock.invocationCallOrder[0] ?? 0,
		).toBeLessThan(repository.update.mock.invocationCallOrder[0] ?? 0);
	});

	it('đổi tiêu đề thì dựng lại search_key bằng tên, địa chỉ, phường hiện tại của nhà trọ', async () => {
		const { service, repository } = build();
		await service.update(
			owner,
			LISTING_ID,
			updateDto({ title: 'Tiêu đề mới đủ dài' }),
		);
		expect(repository.update).toHaveBeenCalledWith(
			LISTING_ID,
			{
				title: 'Tiêu đề mới đủ dài',
				searchKey:
					'tieu de moi du dai nha tro hoa hong 12 le loi phuong ben thanh',
			},
			tx,
		);
	});

	it('không đổi tiêu đề thì không đụng search_key và không đọc địa chỉ nhà trọ', async () => {
		const { service, repository, properties } = build();
		await service.update(
			owner,
			LISTING_ID,
			updateDto({ price: 4_000_000 }),
		);
		expect(repository.update).toHaveBeenCalledWith(
			LISTING_ID,
			{ price: 4_000_000 },
			tx,
		);
		expect(properties.findAddressSource).not.toHaveBeenCalled();
	});

	it('deposit và availableFrom nhận null để xóa, ngày chuỗi đổi thành nửa đêm UTC', async () => {
		const { service, repository } = build();
		await service.update(
			owner,
			LISTING_ID,
			updateDto({ deposit: null, availableFrom: null }),
		);
		expect(repository.update).toHaveBeenLastCalledWith(
			LISTING_ID,
			{ deposit: null, availableFrom: null },
			tx,
		);
		await service.update(
			owner,
			LISTING_ID,
			updateDto({
				availableFrom: '2026-12-01',
				areaM2: 30,
				description: 'Mô tả mới.',
			}),
		);
		expect(repository.update).toHaveBeenLastCalledWith(
			LISTING_ID,
			{
				availableFrom: new Date('2026-12-01T00:00:00.000Z'),
				areaM2: 30,
				description: 'Mô tả mới.',
			},
			tx,
		);
	});

	it('thân rỗng vẫn gọi update (đặt lại updated_at) và giữ nguyên dữ liệu', async () => {
		const { service, repository } = build();
		await service.update(owner, LISTING_ID, updateDto({}));
		expect(repository.update).toHaveBeenCalledWith(LISTING_ID, {}, tx);
	});

	it('sửa được tin đang hidden_by_admin (không kiểm trạng thái)', async () => {
		const { service, repository } = build({
			ownership: {
				id: LISTING_ID,
				propertyId: PROPERTY_ID,
				status: 'hidden_by_admin',
				property: { landlordId: LANDLORD_ID },
			},
		});
		await service.update(
			owner,
			LISTING_ID,
			updateDto({ price: 3_000_000 }),
		);
		expect(repository.update).toHaveBeenCalled();
	});

	it('tin bị xóa mềm ngay giữa chừng (update trả false) thì 404', async () => {
		const { service, repository } = build();
		repository.update.mockResolvedValueOnce(false);
		await expect(
			service.update(owner, LISTING_ID, updateDto({ price: 3_000_000 })),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_NOT_FOUND });
	});

	it('nhà trọ biến mất (khóa trả null) thì 404 LISTING_NOT_FOUND, không ghi', async () => {
		const { service, repository } = build({ locked: null });
		await expect(
			service.update(owner, LISTING_ID, updateDto({ price: 3_000_000 })),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_NOT_FOUND });
		expect(repository.update).not.toHaveBeenCalled();
	});

	it('trả tin đọc lại sau giao dịch', async () => {
		const { service, repository } = build();
		repository.findOwnerDetail.mockResolvedValueOnce(
			ownerDetailRow({ price: 4_000_000 }),
		);
		const response = await service.update(
			owner,
			LISTING_ID,
			updateDto({ price: 4_000_000 }),
		);
		expect(response.price).toBe(4_000_000);
	});
});

describe('ListingsService.remove (AC-7)', () => {
	it('xóa mềm tin của mình ở mọi trạng thái', async () => {
		const { service, repository } = build();
		await service.remove(owner, LISTING_ID);
		expect(repository.softDelete).toHaveBeenCalledWith(LISTING_ID);
	});

	it('tin không có thì 404, của người khác thì 403, đều không xóa', async () => {
		const missing = build({ ownership: null });
		await expect(
			missing.service.remove(owner, LISTING_ID),
		).rejects.toMatchObject({
			code: ErrorCode.LISTING_NOT_FOUND,
		});
		const other = build();
		await expect(
			other.service.remove(stranger, LISTING_ID),
		).rejects.toMatchObject({
			code: ErrorCode.NOT_RESOURCE_OWNER,
		});
		expect(missing.repository.softDelete).not.toHaveBeenCalled();
		expect(other.repository.softDelete).not.toHaveBeenCalled();
	});

	it('xóa lần hai (softDelete trả false) thì 404', async () => {
		const { service, repository } = build();
		repository.softDelete.mockResolvedValueOnce(false);
		await expect(service.remove(owner, LISTING_ID)).rejects.toMatchObject({
			code: ErrorCode.LISTING_NOT_FOUND,
		});
	});
});

describe('ListingsService.hide và show (AC-6)', () => {
	describe('hide', () => {
		it('chuyển visible sang hidden_by_owner bằng một câu có điều kiện trạng thái nguồn', async () => {
			const { service, repository } = build();
			await service.hide(owner, LISTING_ID);
			expect(repository.transition).toHaveBeenCalledWith(
				LISTING_ID,
				['visible'],
				'hidden_by_owner',
			);
		});

		it.each(['hidden_by_owner', 'hidden_by_admin'])(
			'tin đang %s thì 409 LISTING_STATE_INVALID',
			async (status) => {
				const { service, repository } = build();
				repository.transition.mockResolvedValueOnce(false);
				repository.findStatus.mockResolvedValueOnce(status);
				await expect(
					service.hide(owner, LISTING_ID),
				).rejects.toMatchObject({
					code: ErrorCode.LISTING_STATE_INVALID,
				});
			},
		);

		it('tin biến mất giữa chừng thì 404', async () => {
			const { service, repository } = build();
			repository.transition.mockResolvedValueOnce(false);
			repository.findStatus.mockResolvedValueOnce(null);
			await expect(service.hide(owner, LISTING_ID)).rejects.toMatchObject(
				{
					code: ErrorCode.LISTING_NOT_FOUND,
				},
			);
		});

		it('của chủ trọ khác thì 403 và không chuyển', async () => {
			const { service, repository } = build();
			await expect(
				service.hide(stranger, LISTING_ID),
			).rejects.toMatchObject({
				code: ErrorCode.NOT_RESOURCE_OWNER,
			});
			expect(repository.transition).not.toHaveBeenCalled();
		});

		it('trả tin của chủ trọ đọc lại sau khi chuyển', async () => {
			const { service, repository } = build();
			repository.findOwnerDetail.mockResolvedValueOnce(
				ownerDetailRow({ status: 'hidden_by_owner' }),
			);
			expect(await service.hide(owner, LISTING_ID)).toMatchObject({
				status: 'hidden_by_owner',
				moderationReason: null,
			});
		});
	});

	describe('show', () => {
		it('chuyển hidden_by_owner sang visible bằng một câu có điều kiện trạng thái nguồn, trong giao dịch', async () => {
			const { service, repository } = build({
				ownership: HIDDEN_BY_OWNER,
			});
			await service.show(owner, LISTING_ID, NOW);
			expect(repository.transition).toHaveBeenCalledWith(
				LISTING_ID,
				['hidden_by_owner'],
				'visible',
				tx,
			);
		});

		it('tin đang hidden_by_admin thì 403 LISTING_HIDDEN_BY_ADMIN (chủ trọ không tự gỡ lệnh của admin), trước mọi kiểm hạn mức', async () => {
			const { service, repository, users, memberships } = build({
				ownership: { ...HIDDEN_BY_OWNER, status: 'hidden_by_admin' },
				membership: EXPIRED,
			});
			await expect(
				service.show(owner, LISTING_ID, NOW),
			).rejects.toMatchObject({
				code: ErrorCode.LISTING_HIDDEN_BY_ADMIN,
			});
			expect(users.lockById).not.toHaveBeenCalled();
			expect(memberships.resolve).not.toHaveBeenCalled();
			expect(repository.transition).not.toHaveBeenCalled();
		});

		it('tin đã visible thì 409 LISTING_STATE_INVALID, trước mọi kiểm hạn mức', async () => {
			const { service, repository, users } = build({
				membership: EXPIRED,
			});
			await expect(
				service.show(owner, LISTING_ID, NOW),
			).rejects.toMatchObject({
				code: ErrorCode.LISTING_STATE_INVALID,
			});
			expect(users.lockById).not.toHaveBeenCalled();
			expect(repository.transition).not.toHaveBeenCalled();
		});

		it('admin ẩn đúng giữa chừng: câu chuyển trạng thái không khớp, đọc lại thấy hidden_by_admin nên 403', async () => {
			// chủ trọ bấm hiện, nhưng admin đã đổi trạng thái sau lần kiểm quyền: điều kiện nguồn nằm trong câu UPDATE
			// nên không ghi đè, và kết quả cuối vẫn là hidden_by_admin
			const { service, repository } = build({
				ownership: HIDDEN_BY_OWNER,
			});
			repository.transition.mockResolvedValueOnce(false);
			repository.findStatus.mockResolvedValueOnce('hidden_by_admin');
			await expect(
				service.show(owner, LISTING_ID, NOW),
			).rejects.toMatchObject({
				code: ErrorCode.LISTING_HIDDEN_BY_ADMIN,
			});
			expect(repository.transition).toHaveBeenCalledTimes(1);
		});

		it('của chủ trọ khác thì 403 NOT_RESOURCE_OWNER và không chuyển', async () => {
			const { service, repository } = build();
			await expect(
				service.show(stranger, LISTING_ID, NOW),
			).rejects.toMatchObject({
				code: ErrorCode.NOT_RESOURCE_OWNER,
			});
			expect(repository.transition).not.toHaveBeenCalled();
		});
	});

	it('lỗi trạng thái là AppException cùng dạng với mọi lỗi khác', async () => {
		const { service, repository } = build();
		repository.transition.mockResolvedValueOnce(false);
		repository.findStatus.mockResolvedValueOnce('visible');
		await expect(
			service.show(owner, LISTING_ID, NOW),
		).rejects.toBeInstanceOf(AppException);
	});
});

describe('ListingsService.create: cửa hạn mức (spec 0003 AC-4, AC-6, AC-7)', () => {
	it('khóa dòng users TRƯỚC dòng nhà trọ, kiểm hạn mức, rồi mới chèn, cùng một giao dịch', async () => {
		const { service, users, properties, memberships, repository } = build();
		await service.create(owner, PROPERTY_ID, createDto(), NOW);
		expect(users.lockById).toHaveBeenCalledWith(LANDLORD_ID, tx);
		expect(memberships.resolve).toHaveBeenCalledWith(LANDLORD_ID, NOW, tx);
		expect(repository.countVisibleByLandlord).toHaveBeenCalledWith(
			LANDLORD_ID,
			tx,
		);
		const order = (mock: jest.Mock): number =>
			mock.mock.invocationCallOrder[0] ?? 0;
		expect(order(users.lockById)).toBeLessThan(
			order(properties.lockLiveById),
		);
		expect(order(properties.lockLiveById)).toBeLessThan(
			order(memberships.resolve),
		);
		expect(order(memberships.resolve)).toBeLessThan(
			order(repository.countVisibleByLandlord),
		);
		expect(order(repository.countVisibleByLandlord)).toBeLessThan(
			order(repository.create),
		);
	});

	it('còn chỗ (1 tin đang hiện, hạn mức 2) thì chèn', async () => {
		const { service, repository } = build({ visibleCount: 1 });
		await service.create(owner, PROPERTY_ID, createDto(), NOW);
		expect(repository.create).toHaveBeenCalledTimes(1);
	});

	it.each([2, 3])(
		'đang hiện %i tin trên hạn mức 2 (bằng hoặc vượt) thì 403 LISTING_QUOTA_REACHED, không chèn',
		async (visibleCount) => {
			const { service, repository } = build({ visibleCount });
			await expect(
				service.create(owner, PROPERTY_ID, createDto(), NOW),
			).rejects.toMatchObject({ code: ErrorCode.LISTING_QUOTA_REACHED });
			expect(repository.create).not.toHaveBeenCalled();
		},
	);

	it('còn trong kỳ dùng thử nhưng hạn mức bị đặt 0 thì LISTING_QUOTA_REACHED (không phải MEMBERSHIP_REQUIRED)', async () => {
		const { service } = build({ membership: { ...TRIAL, limit: 0 } });
		await expect(
			service.create(owner, PROPERTY_ID, createDto(), NOW),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_QUOTA_REACHED });
	});

	it('hết dùng thử thì 403 MEMBERSHIP_REQUIRED, không đếm tin và không chèn', async () => {
		const { service, repository } = build({
			membership: EXPIRED,
			visibleCount: 99,
		});
		await expect(
			service.create(owner, PROPERTY_ID, createDto(), NOW),
		).rejects.toMatchObject({ code: ErrorCode.MEMBERSHIP_REQUIRED });
		expect(repository.countVisibleByLandlord).not.toHaveBeenCalled();
		expect(repository.create).not.toHaveBeenCalled();
	});

	it('nhà trọ không có (404) và nhà trọ của người khác (403) được báo trước hai lỗi hạn mức', async () => {
		const missing = build({ locked: null, membership: EXPIRED });
		await expect(
			missing.service.create(owner, PROPERTY_ID, createDto(), NOW),
		).rejects.toMatchObject({ code: ErrorCode.PROPERTY_NOT_FOUND });
		expect(missing.memberships.resolve).not.toHaveBeenCalled();

		const foreign = build({ membership: EXPIRED, visibleCount: 99 });
		await expect(
			foreign.service.create(stranger, PROPERTY_ID, createDto(), NOW),
		).rejects.toMatchObject({ code: ErrorCode.NOT_RESOURCE_OWNER });
		expect(foreign.memberships.resolve).not.toHaveBeenCalled();
	});

	it('lỗi hạn mức không bị thử lại như lỗi trùng mã', async () => {
		const { service, transactions } = build({ visibleCount: 2 });
		await expect(
			service.create(owner, PROPERTY_ID, createDto(), NOW),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_QUOTA_REACHED });
		expect(transactions.run).toHaveBeenCalledTimes(1);
	});

	it('thử lại vì trùng mã thì giao dịch mới khóa và kiểm hạn mức lại từ đầu', async () => {
		const { service, repository, users, memberships } = build();
		repository.create.mockRejectedValueOnce(new ListingCodeTakenError());
		await service.create(owner, PROPERTY_ID, createDto(), NOW);
		expect(users.lockById).toHaveBeenCalledTimes(2);
		expect(memberships.resolve).toHaveBeenCalledTimes(2);
	});
});

describe('ListingsService.show: cửa hạn mức (spec 0003 AC-5, AC-7)', () => {
	it('khóa dòng users, kiểm hạn mức, rồi mới chuyển trạng thái, cùng một giao dịch', async () => {
		const { service, users, memberships, repository } = build({
			ownership: HIDDEN_BY_OWNER,
		});
		await service.show(owner, LISTING_ID, NOW);
		expect(users.lockById).toHaveBeenCalledWith(LANDLORD_ID, tx);
		expect(memberships.resolve).toHaveBeenCalledWith(LANDLORD_ID, NOW, tx);
		const order = (mock: jest.Mock): number =>
			mock.mock.invocationCallOrder[0] ?? 0;
		expect(order(users.lockById)).toBeLessThan(order(memberships.resolve));
		expect(order(memberships.resolve)).toBeLessThan(
			order(repository.countVisibleByLandlord),
		);
		expect(order(repository.countVisibleByLandlord)).toBeLessThan(
			order(repository.transition),
		);
	});

	it('còn chỗ thì hiện lại và trả tin đọc lại sau giao dịch', async () => {
		const { service, repository } = build({
			ownership: HIDDEN_BY_OWNER,
			visibleCount: 1,
		});
		await service.show(owner, LISTING_ID, NOW);
		expect(repository.transition).toHaveBeenCalledTimes(1);
		expect(repository.findOwnerDetail).toHaveBeenCalledWith(LISTING_ID);
	});

	it('đủ hạn mức thì 403 LISTING_QUOTA_REACHED, không chuyển trạng thái', async () => {
		const { service, repository } = build({
			ownership: HIDDEN_BY_OWNER,
			visibleCount: 2,
		});
		await expect(
			service.show(owner, LISTING_ID, NOW),
		).rejects.toMatchObject({ code: ErrorCode.LISTING_QUOTA_REACHED });
		expect(repository.transition).not.toHaveBeenCalled();
	});

	it('hết dùng thử thì 403 MEMBERSHIP_REQUIRED, báo trước LISTING_QUOTA_REACHED, không chuyển', async () => {
		const { service, repository } = build({
			ownership: HIDDEN_BY_OWNER,
			membership: EXPIRED,
			visibleCount: 99,
		});
		await expect(
			service.show(owner, LISTING_ID, NOW),
		).rejects.toMatchObject({ code: ErrorCode.MEMBERSHIP_REQUIRED });
		expect(repository.countVisibleByLandlord).not.toHaveBeenCalled();
		expect(repository.transition).not.toHaveBeenCalled();
	});
});

describe('hết dùng thử không chặn hide, sửa, xóa tin (spec 0003 AC-6)', () => {
	it('hide, update và remove chạy bình thường khi hết dùng thử và không đụng cửa hạn mức', async () => {
		const { service, repository, users, memberships } = build({
			membership: EXPIRED,
			visibleCount: 99,
		});
		await service.hide(owner, LISTING_ID);
		await service.update(
			owner,
			LISTING_ID,
			updateDto({ price: 4_000_000 }),
		);
		await service.remove(owner, LISTING_ID);
		expect(repository.transition).toHaveBeenCalledTimes(1);
		expect(repository.update).toHaveBeenCalledTimes(1);
		expect(repository.softDelete).toHaveBeenCalledTimes(1);
		expect(memberships.resolve).not.toHaveBeenCalled();
		expect(users.lockById).not.toHaveBeenCalled();
		expect(repository.countVisibleByLandlord).not.toHaveBeenCalled();
	});
});
