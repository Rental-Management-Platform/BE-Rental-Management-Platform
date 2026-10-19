import type { PrismaClient } from '../generated/prisma/client';
import { SEED_PLANS, seedPlans } from './seed-plans';

describe('seedPlans (spec 0004, AC-12)', () => {
	it('có đúng ba gói mẫu, mỗi gói 30 ngày', () => {
		expect(SEED_PLANS).toEqual([
			{ name: 'Cơ bản', price: 99_000, maxListings: 5, durationDays: 30 },
			{
				name: 'Nâng cao',
				price: 199_000,
				maxListings: 15,
				durationDays: 30,
			},
			{
				name: 'Chuyên nghiệp',
				price: 399_000,
				maxListings: 50,
				durationDays: 30,
			},
		]);
	});

	it('gói mẫu nằm trong khoảng CHECK của bảng plans', () => {
		for (const plan of SEED_PLANS) {
			expect(plan.name.length).toBeGreaterThanOrEqual(2);
			expect(plan.name.length).toBeLessThanOrEqual(60);
			expect(plan.price).toBeLessThanOrEqual(100_000_000);
			expect(plan.maxListings).toBeGreaterThanOrEqual(1);
			expect(plan.maxListings).toBeLessThanOrEqual(1000);
		}
	});

	it('chỉ thêm, không ghi đè: createMany với skipDuplicates, không update hay upsert', async () => {
		const createMany = jest.fn().mockResolvedValue({ count: 0 });
		const update = jest.fn();
		const upsert = jest.fn();
		const log = jest.spyOn(console, 'log').mockImplementation();

		await seedPlans({
			plan: { createMany, update, upsert },
		} as unknown as PrismaClient);

		expect(createMany).toHaveBeenCalledWith({
			data: SEED_PLANS.map((plan) => ({ ...plan })),
			skipDuplicates: true,
		});
		expect(update).not.toHaveBeenCalled();
		expect(upsert).not.toHaveBeenCalled();
		log.mockRestore();
	});
});
