import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { TransactionRunner } from '../common/persistence/transaction-runner';
import { toSearchKey } from '../common/text/to-search-key';
import type { Amenity, Prisma, Ward } from '../generated/prisma/client';
import type { ListingsRepository } from '../listings/listings.repository';
import { CatalogAdminService } from './catalog-admin.service';
import type {
	CatalogDeleteResult,
	CatalogRepository,
} from './catalog.repository';

const now = new Date('2026-10-20T00:00:00Z');
const tx = { marker: 'tx' } as unknown as Prisma.TransactionClient;

function ward(overrides: Partial<Ward> = {}): Ward {
	return {
		code: '26743',
		name: 'Phường Bến Thành',
		provinceCode: '79',
		provinceName: 'Thành phố Hồ Chí Minh',
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function amenity(overrides: Partial<Amenity> = {}): Amenity {
	return {
		key: 'wifi',
		name: 'Wifi',
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function argsOf(mock: jest.Mock): unknown[][] {
	return mock.mock.calls as unknown[][];
}

async function codeOf(promise: Promise<unknown>): Promise<ErrorCode> {
	try {
		await promise;
	} catch (error: unknown) {
		if (error instanceof AppException) return error.code;
		throw error;
	}
	throw new Error('Mong đợi một AppException nhưng không có lỗi nào');
}

interface Harness {
	service: CatalogAdminService;
	repository: Record<
		| 'createWard'
		| 'updateWard'
		| 'findWardByCode'
		| 'deleteWard'
		| 'createAmenity'
		| 'updateAmenity'
		| 'deleteAmenity',
		jest.Mock
	>;
	listings: Record<'findLiveForWard' | 'setSearchKey', jest.Mock>;
	transactions: { run: jest.Mock };
}

function build(
	options: {
		current?: Ward | null;
		updated?: Ward | null;
		created?: Ward | null;
		createdAmenity?: Amenity | null;
		updatedAmenity?: Amenity | null;
		deleted?: CatalogDeleteResult;
		live?: {
			id: string;
			title: string;
			property: { name: string; addressText: string };
		}[];
	} = {},
): Harness {
	const repository = {
		createWard: jest.fn(() =>
			Promise.resolve(
				options.created === undefined ? ward() : options.created,
			),
		),
		updateWard: jest.fn(() =>
			Promise.resolve(
				options.updated === undefined ? ward() : options.updated,
			),
		),
		findWardByCode: jest.fn(() =>
			Promise.resolve(
				options.current === undefined ? ward() : options.current,
			),
		),
		deleteWard: jest.fn(() =>
			Promise.resolve(options.deleted ?? 'deleted'),
		),
		createAmenity: jest.fn(() =>
			Promise.resolve(
				options.createdAmenity === undefined
					? amenity()
					: options.createdAmenity,
			),
		),
		updateAmenity: jest.fn(() =>
			Promise.resolve(
				options.updatedAmenity === undefined
					? amenity()
					: options.updatedAmenity,
			),
		),
		deleteAmenity: jest.fn(() =>
			Promise.resolve(options.deleted ?? 'deleted'),
		),
	};
	const listings = {
		findLiveForWard: jest.fn(() => Promise.resolve(options.live ?? [])),
		setSearchKey: jest.fn(() => Promise.resolve()),
	};
	const transactions = {
		run: jest.fn((fn: (client: Prisma.TransactionClient) => unknown) =>
			Promise.resolve(fn(tx)),
		),
	};
	const service = new CatalogAdminService(
		repository as unknown as CatalogRepository,
		listings as unknown as ListingsRepository,
		transactions as unknown as TransactionRunner,
	);
	return { service, repository, listings, transactions };
}

describe('CatalogAdminService phường (spec 0002 AC-2)', () => {
	describe('createWard', () => {
		const input = {
			code: '26743',
			name: 'Phường Bến Thành',
			provinceCode: '79',
			provinceName: 'Thành phố Hồ Chí Minh',
		};

		it('tạo và trả đúng bốn trường, không lộ cột nội bộ', async () => {
			const h = build();
			expect(await h.service.createWard(input)).toEqual(input);
			expect(argsOf(h.repository.createWard)).toEqual([[input]]);
		});

		it('trùng mã thì 409 CATALOG_CODE_TAKEN', async () => {
			const h = build({ created: null });
			expect(await codeOf(h.service.createWard(input))).toBe(
				ErrorCode.CATALOG_CODE_TAKEN,
			);
		});
	});

	describe('updateWard', () => {
		it('phường không có thì 404 NOT_FOUND và không ghi gì', async () => {
			const h = build({ current: null });
			expect(
				await codeOf(h.service.updateWard('99999', { name: 'x y' })),
			).toBe(ErrorCode.NOT_FOUND);
			expect(h.repository.updateWard).not.toHaveBeenCalled();
		});

		it('phường biến mất giữa lúc đọc và lúc ghi thì 404 NOT_FOUND', async () => {
			const h = build({ updated: null });
			expect(
				await codeOf(
					h.service.updateWard('26743', { name: 'Phường Mới' }),
				),
			).toBe(ErrorCode.NOT_FOUND);
			expect(h.listings.setSearchKey).not.toHaveBeenCalled();
		});

		it('đổi tên thì ghi tên và dựng lại search_key của từng tin sống bằng tên phường MỚI, cùng giao dịch', async () => {
			const h = build({
				updated: ward({ name: 'Phường Sài Gòn' }),
				live: [
					{
						id: 'l1',
						title: 'Phòng đẹp có gác',
						property: {
							name: 'Nhà trọ Hoa Hồng',
							addressText: '12 Lê Lợi',
						},
					},
					{
						id: 'l2',
						title: 'Phòng giá rẻ',
						property: {
							name: 'Nhà trọ Hoa Hồng',
							addressText: '12 Lê Lợi',
						},
					},
				],
			});
			const result = await h.service.updateWard('26743', {
				name: 'Phường Sài Gòn',
			});
			expect(result.name).toBe('Phường Sài Gòn');
			expect(argsOf(h.repository.updateWard)).toEqual([
				['26743', { name: 'Phường Sài Gòn' }, tx],
			]);
			expect(argsOf(h.listings.findLiveForWard)).toEqual([['26743', tx]]);
			expect(argsOf(h.listings.setSearchKey)).toEqual([
				[
					'l1',
					toSearchKey(
						'Phòng đẹp có gác',
						'Nhà trọ Hoa Hồng',
						'12 Lê Lợi',
						'Phường Sài Gòn',
					),
					tx,
				],
				[
					'l2',
					toSearchKey(
						'Phòng giá rẻ',
						'Nhà trọ Hoa Hồng',
						'12 Lê Lợi',
						'Phường Sài Gòn',
					),
					tx,
				],
			]);
			expect(h.transactions.run).toHaveBeenCalledTimes(1);
		});

		it('khóa mới chứa tên phường mới (tìm "sai gon" ra) và không còn tên cũ', async () => {
			const h = build({
				updated: ward({ name: 'Phường Sài Gòn' }),
				live: [
					{
						id: 'l1',
						title: 'Phòng đẹp',
						property: {
							name: 'Nhà trọ A',
							addressText: '12 Lê Lợi',
						},
					},
				],
			});
			await h.service.updateWard('26743', { name: 'Phường Sài Gòn' });
			const key = argsOf(h.listings.setSearchKey)[0][1] as string;
			expect(key).toContain('sai gon');
			expect(key).not.toContain('ben thanh');
		});

		it('gửi lại đúng tên cũ thì không dựng lại khóa (không có gì đổi)', async () => {
			const h = build();
			await h.service.updateWard('26743', { name: 'Phường Bến Thành' });
			expect(h.listings.findLiveForWard).not.toHaveBeenCalled();
		});

		it('chỉ đổi tên tỉnh thì không dựng lại khóa (khóa chỉ chứa tên phường)', async () => {
			const h = build({ updated: ward({ provinceName: 'Tên mới' }) });
			await h.service.updateWard('26743', { provinceName: 'Tên mới' });
			expect(h.listings.findLiveForWard).not.toHaveBeenCalled();
			expect(h.listings.setSearchKey).not.toHaveBeenCalled();
		});

		it('một bước dựng khóa lỗi thì lỗi nổi lên để giao dịch hủy cả việc đổi tên', async () => {
			const h = build({
				updated: ward({ name: 'Phường Sài Gòn' }),
				live: [
					{
						id: 'l1',
						title: 'Phòng đẹp',
						property: { name: 'A', addressText: '12 Lê Lợi' },
					},
				],
			});
			h.listings.setSearchKey.mockRejectedValueOnce(new Error('db down'));
			await expect(
				h.service.updateWard('26743', { name: 'Phường Sài Gòn' }),
			).rejects.toThrow('db down');
		});
	});

	describe('deleteWard', () => {
		it('xóa được thì không trả gì', async () => {
			const h = build();
			await expect(
				h.service.deleteWard('26743'),
			).resolves.toBeUndefined();
		});

		it('còn nhà trọ dùng (kể cả đã xóa mềm) thì 409 CATALOG_IN_USE', async () => {
			const h = build({ deleted: 'in_use' });
			expect(await codeOf(h.service.deleteWard('26743'))).toBe(
				ErrorCode.CATALOG_IN_USE,
			);
		});

		it('không có phường thì 404 NOT_FOUND', async () => {
			const h = build({ deleted: 'not_found' });
			expect(await codeOf(h.service.deleteWard('99999'))).toBe(
				ErrorCode.NOT_FOUND,
			);
		});
	});
});

describe('CatalogAdminService tiện ích (spec 0002 AC-2)', () => {
	it('tạo và trả { key, name }', async () => {
		const h = build();
		expect(
			await h.service.createAmenity({ key: 'wifi', name: 'Wifi' }),
		).toEqual({ key: 'wifi', name: 'Wifi' });
	});

	it('trùng khóa thì 409 CATALOG_CODE_TAKEN', async () => {
		const h = build({ createdAmenity: null });
		expect(
			await codeOf(
				h.service.createAmenity({ key: 'wifi', name: 'Wifi' }),
			),
		).toBe(ErrorCode.CATALOG_CODE_TAKEN);
	});

	it('sửa tên trả mục mới; không có thì 404 NOT_FOUND', async () => {
		const ok = build({
			updatedAmenity: amenity({ name: 'Wifi tốc độ cao' }),
		});
		expect(
			await ok.service.updateAmenity('wifi', 'Wifi tốc độ cao'),
		).toEqual({
			key: 'wifi',
			name: 'Wifi tốc độ cao',
		});
		const missing = build({ updatedAmenity: null });
		expect(await codeOf(missing.service.updateAmenity('lo', 'Gác'))).toBe(
			ErrorCode.NOT_FOUND,
		);
	});

	it('xóa: được thì thôi, còn nhà trọ dùng thì 409 CATALOG_IN_USE, không có thì 404', async () => {
		await expect(
			build().service.deleteAmenity('wifi'),
		).resolves.toBeUndefined();
		expect(
			await codeOf(
				build({ deleted: 'in_use' }).service.deleteAmenity('wifi'),
			),
		).toBe(ErrorCode.CATALOG_IN_USE);
		expect(
			await codeOf(
				build({ deleted: 'not_found' }).service.deleteAmenity('khong'),
			),
		).toBe(ErrorCode.NOT_FOUND);
	});
});
