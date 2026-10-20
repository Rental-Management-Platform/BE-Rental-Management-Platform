import type { PrismaService } from '../database/prisma.service';
import { LandlordsRepository } from './landlords.repository';

describe('LandlordsRepository.findActiveLandlord (spec 0005 AC-2)', () => {
	it('chủ trọ hợp lệ là landlord, active, chưa xóa mềm; chỉ chọn id, tên, ngày tham gia', async () => {
		const row = { id: 'a', name: 'Nam', createdAt: new Date() };
		const findFirst = jest.fn(() => Promise.resolve(row));
		const repository = new LandlordsRepository({
			user: { findFirst },
		} as unknown as PrismaService);
		await expect(repository.findActiveLandlord('a')).resolves.toBe(row);
		expect(findFirst).toHaveBeenCalledWith({
			where: {
				id: 'a',
				accountType: 'landlord',
				status: 'active',
				deletedAt: null,
			},
			select: { id: true, name: true, createdAt: true },
		});
	});

	it('không có dòng thì null', async () => {
		const repository = new LandlordsRepository({
			user: { findFirst: jest.fn(() => Promise.resolve(null)) },
		} as unknown as PrismaService);
		await expect(repository.findActiveLandlord('b')).resolves.toBeNull();
	});
});

describe('LandlordsRepository.countActiveFollowers (spec 0005 AC-3)', () => {
	it('đếm dòng follows của chủ trọ mà người theo dõi đang active và chưa xóa mềm', async () => {
		const count = jest.fn(() => Promise.resolve(12));
		const repository = new LandlordsRepository({
			follow: { count },
		} as unknown as PrismaService);
		await expect(repository.countActiveFollowers('chu-1')).resolves.toBe(
			12,
		);
		expect(count).toHaveBeenCalledWith({
			where: {
				landlordId: 'chu-1',
				user: { status: 'active', deletedAt: null },
			},
		});
	});
});

describe('LandlordsRepository.isFollowing (spec 0005 AC-1)', () => {
	function build(row: { userId: string } | null) {
		const findUnique = jest.fn(() => Promise.resolve(row));
		const repository = new LandlordsRepository({
			follow: { findUnique },
		} as unknown as PrismaService);
		return { repository, findUnique };
	}

	it('tra đúng cặp (người theo dõi, chủ trọ) theo khóa chính; có dòng thì true', async () => {
		const { repository, findUnique } = build({ userId: 'u1' });
		await expect(repository.isFollowing('u1', 'chu-1')).resolves.toBe(true);
		expect(findUnique).toHaveBeenCalledWith({
			where: { userId_landlordId: { userId: 'u1', landlordId: 'chu-1' } },
			select: { userId: true },
		});
	});

	it('không có dòng thì false', async () => {
		await expect(
			build(null).repository.isFollowing('u1', 'chu-1'),
		).resolves.toBe(false);
	});
});
