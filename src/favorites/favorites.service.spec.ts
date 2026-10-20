import type { AccountType } from '../common/auth/account-type';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import { publicSummaryRow } from '../listings/listings.fixtures';
import type {
	ListingsRepository,
	SavedListingRow,
} from '../listings/listings.repository';
import type { SettingsService } from '../settings/settings.service';
import type { FavoritesRepository } from './favorites.repository';
import { FavoritesService } from './favorites.service';

const TENANT_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';
const ADMIN_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';
const LANDLORD_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
const LISTING_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d11';
const NOW = new Date('2026-10-20T03:00:00.000Z');
const SAVED_AT = new Date('2026-10-20T02:00:00.000Z');

function userOf(userId: string, accountType: AccountType): RequestUser {
	return { userId, sessionId: 'phien-1', accountType, permissions: [] };
}

const TENANT = userOf(TENANT_ID, 'tenant');
const LANDLORD = userOf(LANDLORD_ID, 'landlord');
const ADMIN = userOf(ADMIN_ID, 'admin');

function build(options: { visible?: boolean; saved?: SavedListingRow[] } = {}) {
	const repository = {
		addFavorite: jest.fn(() => Promise.resolve()),
		removeFavorite: jest.fn(() => Promise.resolve()),
	};
	const listings = {
		isPubliclyVisible: jest.fn(() =>
			Promise.resolve(options.visible ?? true),
		),
		findFavoritePage: jest.fn(() =>
			Promise.resolve({
				rows: options.saved ?? [],
				total: options.saved?.length ?? 0,
			}),
		),
	};
	const settings = { getValue: jest.fn(() => Promise.resolve(3)) };
	const service = new FavoritesService(
		repository as unknown as FavoritesRepository,
		listings as unknown as ListingsRepository,
		settings as unknown as SettingsService,
	);
	return { service, repository, listings, settings };
}

async function errorOf(promise: Promise<unknown>): Promise<AppException> {
	const error = await promise.catch((e: unknown) => e);
	expect(error).toBeInstanceOf(AppException);
	return error as AppException;
}

describe('FavoritesService.save (spec 0006 AC-1, AC-3, AC-7)', () => {
	it('tin đang hiện công khai: ghi đúng cặp (người trong token, tin ở đường dẫn) và trả kết quả hằng isFavorite true', async () => {
		const { service, repository } = build();
		await expect(service.save(TENANT, LISTING_ID, NOW)).resolves.toEqual({
			listingId: LISTING_ID,
			isFavorite: true,
		});
		expect(repository.addFavorite).toHaveBeenCalledTimes(1);
		expect(repository.addFavorite).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
		);
	});

	it('kiểm hiển thị bằng đúng `now` của request và hạn mức dùng thử đọc một lần từ settings', async () => {
		const { service, listings, settings } = build();
		await service.save(TENANT, LISTING_ID, NOW);
		expect(settings.getValue).toHaveBeenCalledTimes(1);
		expect(settings.getValue).toHaveBeenCalledWith('trial_listing_limit');
		expect(listings.isPubliclyVisible).toHaveBeenCalledWith(LISTING_ID, {
			now: NOW,
			trialListingLimit: 3,
		});
	});

	it('tin không hiện công khai (không có, đã xóa, bị ẩn, chủ trọ bị khóa hay hết gói, vượt hạn mức): 404 LISTING_NOT_FOUND và không ghi dòng nào', async () => {
		const { service, repository } = build({ visible: false });
		const error = await errorOf(service.save(TENANT, LISTING_ID, NOW));
		expect(error.code).toBe(ErrorCode.LISTING_NOT_FOUND);
		expect(repository.addFavorite).not.toHaveBeenCalled();
	});

	it('admin: 403 PERMISSION_DENIED trước mọi truy vấn, không ghi dòng nào', async () => {
		const { service, repository, listings, settings } = build();
		const error = await errorOf(service.save(ADMIN, LISTING_ID, NOW));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(settings.getValue).not.toHaveBeenCalled();
		expect(listings.isPubliclyVisible).not.toHaveBeenCalled();
		expect(repository.addFavorite).not.toHaveBeenCalled();
	});

	it('chủ trọ được admin cấp quyền thì lưu được, kể cả tin của chính mình (không luật riêng)', async () => {
		const { service, repository } = build();
		await expect(
			service.save(LANDLORD, LISTING_ID, NOW),
		).resolves.toMatchObject({ isFavorite: true });
		expect(repository.addFavorite).toHaveBeenCalledWith(
			LANDLORD_ID,
			LISTING_ID,
		);
	});

	it('lưu lặp lại vẫn thành công: Service không tự chặn, việc không thêm dòng thứ hai là của Repository', async () => {
		const { service, repository } = build();
		await service.save(TENANT, LISTING_ID, NOW);
		await service.save(TENANT, LISTING_ID, NOW);
		expect(repository.addFavorite).toHaveBeenCalledTimes(2);
	});
});

describe('FavoritesService.unsave (spec 0006 AC-2, AC-7)', () => {
	it('xóa đúng cặp và trả kết quả hằng isFavorite false', async () => {
		const { service, repository } = build();
		await expect(service.unsave(TENANT, LISTING_ID)).resolves.toEqual({
			listingId: LISTING_ID,
			isFavorite: false,
		});
		expect(repository.removeFavorite).toHaveBeenCalledWith(
			TENANT_ID,
			LISTING_ID,
		);
	});

	it('không tra tin và không đọc settings: bỏ lưu được cả tin đã ẩn, đã xóa hay id không có', async () => {
		const { service, listings, settings } = build({ visible: false });
		await expect(service.unsave(TENANT, LISTING_ID)).resolves.toMatchObject(
			{ isFavorite: false },
		);
		expect(listings.isPubliclyVisible).not.toHaveBeenCalled();
		expect(settings.getValue).not.toHaveBeenCalled();
	});

	it('admin: 403 PERMISSION_DENIED và không xóa dòng nào', async () => {
		const { service, repository } = build();
		const error = await errorOf(service.unsave(ADMIN, LISTING_ID));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(repository.removeFavorite).not.toHaveBeenCalled();
	});
});

describe('FavoritesService.list (spec 0006 AC-4, AC-5, AC-7)', () => {
	const query = { page: 3, pageSize: 10 };

	it('đọc đúng trang của người trong token với `now` và hạn mức dùng thử, bỏ qua (page - 1) * pageSize dòng', async () => {
		const { service, listings, settings } = build();
		await service.list(TENANT, query, NOW);
		expect(settings.getValue).toHaveBeenCalledWith('trial_listing_limit');
		expect(listings.findFavoritePage).toHaveBeenCalledWith(
			TENANT_ID,
			{ now: NOW, trialListingLimit: 3 },
			20,
			10,
		);
	});

	it('trả { items, total, page, pageSize }, mỗi phần tử là tin tóm tắt cộng favoritedAt và isFavorite true', async () => {
		const { service } = build({
			saved: [{ row: publicSummaryRow(), favoritedAt: SAVED_AT }],
		});
		const page = await service.list(TENANT, query, NOW);
		expect(page).toMatchObject({ total: 1, page: 3, pageSize: 10 });
		expect(page.items).toHaveLength(1);
		expect(page.items[0]).toMatchObject({
			code: 'abcd2345',
			favoritedAt: SAVED_AT,
			isFavorite: true,
		});
	});

	it('chưa lưu gì thì trang rỗng, total 0', async () => {
		const { service } = build();
		await expect(service.list(TENANT, query, NOW)).resolves.toEqual({
			items: [],
			total: 0,
			page: 3,
			pageSize: 10,
		});
	});

	it('admin: 403 PERMISSION_DENIED và không truy vấn', async () => {
		const { service, listings, settings } = build();
		const error = await errorOf(service.list(ADMIN, query, NOW));
		expect(error.code).toBe(ErrorCode.PERMISSION_DENIED);
		expect(settings.getValue).not.toHaveBeenCalled();
		expect(listings.findFavoritePage).not.toHaveBeenCalled();
	});
});
