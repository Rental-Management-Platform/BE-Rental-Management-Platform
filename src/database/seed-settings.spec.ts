import type { PrismaClient } from '../generated/prisma/client';
import { seedSettings } from './seed-settings';

describe('seedSettings (spec 0003 dùng thử, AC-12)', () => {
	it('thêm đúng hai dòng mặc định, trial_days = 30 và trial_listing_limit = 2', async () => {
		const createMany = jest.fn().mockResolvedValue({ count: 2 });
		const log = jest.spyOn(console, 'log').mockImplementation();

		await seedSettings({
			setting: { createMany },
		} as unknown as PrismaClient);

		expect(createMany).toHaveBeenCalledWith({
			data: [
				{ key: 'trial_days', value: '30' },
				{ key: 'trial_listing_limit', value: '2' },
			],
			skipDuplicates: true,
		});
		log.mockRestore();
	});

	it('chỉ thêm, không ghi đè: dùng createMany với skipDuplicates, không update hay upsert', async () => {
		const createMany = jest.fn().mockResolvedValue({ count: 0 });
		const update = jest.fn();
		const upsert = jest.fn();
		const log = jest.spyOn(console, 'log').mockImplementation();

		await seedSettings({
			setting: { createMany, update, upsert },
		} as unknown as PrismaClient);

		expect(update).not.toHaveBeenCalled();
		expect(upsert).not.toHaveBeenCalled();
		expect(createMany).toHaveBeenCalledWith(
			expect.objectContaining({ skipDuplicates: true }),
		);
		log.mockRestore();
	});
});
