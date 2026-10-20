import type { PrismaService } from '../database/prisma.service';
import { FavoritesRepository } from './favorites.repository';

describe('FavoritesRepository.addFavorite (spec 0006 AC-1)', () => {
	it('ghi một dòng bằng createMany với skipDuplicates: cặp đã có thì không lỗi và không thêm dòng', async () => {
		const createMany = jest.fn(() => Promise.resolve({ count: 0 }));
		const repository = new FavoritesRepository({
			favorite: { createMany },
		} as unknown as PrismaService);
		await expect(
			repository.addFavorite('u1', 'tin-1'),
		).resolves.toBeUndefined();
		expect(createMany).toHaveBeenCalledWith({
			data: [{ userId: 'u1', listingId: 'tin-1' }],
			skipDuplicates: true,
		});
	});
});

describe('FavoritesRepository.removeFavorite (spec 0006 AC-2)', () => {
	it('xóa đúng cặp bằng deleteMany: không có dòng nào cũng không lỗi', async () => {
		const deleteMany = jest.fn(() => Promise.resolve({ count: 0 }));
		const repository = new FavoritesRepository({
			favorite: { deleteMany },
		} as unknown as PrismaService);
		await expect(
			repository.removeFavorite('u1', 'tin-1'),
		).resolves.toBeUndefined();
		expect(deleteMany).toHaveBeenCalledWith({
			where: { userId: 'u1', listingId: 'tin-1' },
		});
	});
});

describe('FavoritesRepository.findSavedIds (spec 0006 AC-6)', () => {
	function build(rows: { listingId: string }[]) {
		const findMany = jest.fn(() => Promise.resolve(rows));
		const repository = new FavoritesRepository({
			favorite: { findMany },
		} as unknown as PrismaService);
		return { repository, findMany };
	}

	it('một truy vấn theo (người xem, các tin của trang), chỉ chọn listingId', async () => {
		const { repository, findMany } = build([{ listingId: 'tin-b' }]);
		await repository.findSavedIds('u1', ['tin-a', 'tin-b', 'tin-c']);
		expect(findMany).toHaveBeenCalledTimes(1);
		expect(findMany).toHaveBeenCalledWith({
			where: {
				userId: 'u1',
				listingId: { in: ['tin-a', 'tin-b', 'tin-c'] },
			},
			select: { listingId: true },
		});
	});

	it('trả tập id đã lưu; không lưu tin nào thì tập rỗng', async () => {
		const saved = await build([
			{ listingId: 'tin-b' },
			{ listingId: 'tin-c' },
		]).repository.findSavedIds('u1', ['tin-a', 'tin-b', 'tin-c']);
		expect([...saved].sort()).toEqual(['tin-b', 'tin-c']);
		expect(
			(await build([]).repository.findSavedIds('u1', ['x'])).size,
		).toBe(0);
	});
});

describe('FavoritesRepository.isFavorite (spec 0006 AC-6)', () => {
	function build(row: { userId: string } | null) {
		const findUnique = jest.fn(() => Promise.resolve(row));
		const repository = new FavoritesRepository({
			favorite: { findUnique },
		} as unknown as PrismaService);
		return { repository, findUnique };
	}

	it('tra đúng cặp (người xem, tin) theo khóa chính; có dòng thì true', async () => {
		const { repository, findUnique } = build({ userId: 'u1' });
		await expect(repository.isFavorite('u1', 'tin-1')).resolves.toBe(true);
		expect(findUnique).toHaveBeenCalledWith({
			where: { userId_listingId: { userId: 'u1', listingId: 'tin-1' } },
			select: { userId: true },
		});
	});

	it('không có dòng thì false', async () => {
		await expect(
			build(null).repository.isFavorite('u1', 'tin-1'),
		).resolves.toBe(false);
	});
});
