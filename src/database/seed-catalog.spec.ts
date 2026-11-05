import type { PrismaClient } from '../generated/prisma/client';
import { seedCatalog } from './seed-catalog';
import { loadWardBoundsSeed } from './seed-data';

interface UpdateManyArgs {
	where: { code: string; minLatitude: null };
	data: Record<string, number>;
}

/** Prisma giả: `updateMany` đếm 1 cho phường được phép điền, 0 cho phường đã có hộp. */
function fakePrisma(alreadyFilled: ReadonlySet<string> = new Set()) {
	const updateMany = jest.fn(({ where }: UpdateManyArgs) =>
		Promise.resolve({ count: alreadyFilled.has(where.code) ? 0 : 1 }),
	);
	const wardCreateMany = jest.fn().mockResolvedValue({ count: 0 });
	const amenityCreateMany = jest.fn().mockResolvedValue({ count: 0 });
	const upsert = jest.fn();
	const prisma = {
		ward: { createMany: wardCreateMany, updateMany, upsert },
		amenity: { createMany: amenityCreateMany },
	} as unknown as PrismaClient;
	return { prisma, updateMany, wardCreateMany, upsert };
}

describe('seedCatalog: hộp phường (spec 0012 AC-6)', () => {
	let log: jest.SpyInstance;

	beforeEach(() => {
		log = jest.spyOn(console, 'log').mockImplementation();
	});

	afterEach(() => {
		log.mockRestore();
	});

	it('điền hộp cho từng phường trong ward-bounds.json, chỉ vào ô còn rỗng', async () => {
		const { prisma, updateMany } = fakePrisma();
		await seedCatalog(prisma);

		const bounds = loadWardBoundsSeed();
		expect(updateMany).toHaveBeenCalledTimes(bounds.length);
		for (const { code, ...box } of bounds) {
			expect(updateMany).toHaveBeenCalledWith({
				where: { code, minLatitude: null },
				data: box,
			});
		}
	});

	it('không ghi đè: điều kiện luôn có minLatitude là null, nên ô đã có giá trị không bị chạm', async () => {
		const { prisma, updateMany } = fakePrisma();
		await seedCatalog(prisma);

		for (const [args] of updateMany.mock.calls) {
			expect(args.where.minLatitude).toBeNull();
		}
	});

	it('chạy lại khi mọi hộp đã có: không đổi gì và báo điền 0 phường', async () => {
		const bounds = loadWardBoundsSeed();
		const { prisma } = fakePrisma(new Set(bounds.map((item) => item.code)));
		await seedCatalog(prisma);

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining('điền 0 phường còn rỗng'),
		);
	});

	it('báo đúng số phường vừa điền', async () => {
		const { prisma } = fakePrisma();
		await seedCatalog(prisma);

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining(
				`điền ${loadWardBoundsSeed().length} phường còn rỗng`,
			),
		);
	});

	it('vẫn chỉ thêm dòng còn thiếu cho phường (createMany skipDuplicates), không upsert', async () => {
		const { prisma, wardCreateMany, upsert } = fakePrisma();
		await seedCatalog(prisma);

		expect(wardCreateMany).toHaveBeenCalledWith(
			expect.objectContaining({ skipDuplicates: true }),
		);
		expect(upsert).not.toHaveBeenCalled();
	});
});
