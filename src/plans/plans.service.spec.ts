import { HttpStatus } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Plan } from '../generated/prisma/client';
import { PlanInUseError, PlanNameTakenError } from './plan-errors';
import { PlansRepository } from './plans.repository';
import { PlansService } from './plans.service';

const created = new Date('2026-10-19T02:00:00.000Z');
const planId = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';

function plan(overrides: Partial<Plan> = {}): Plan {
	return {
		id: planId,
		name: 'Nâng cao',
		price: 199_000,
		maxListings: 15,
		durationDays: 30,
		isActive: true,
		createdAt: created,
		updatedAt: created,
		...overrides,
	};
}

type Repo = {
	[
		K in 'findActivePage' | 'findAllPage' | 'create' | 'update' | 'remove'
	]: jest.Mock;
};

function serviceWith(overrides: Partial<Repo> = {}): {
	service: PlansService;
	repo: Repo;
} {
	const repo: Repo = {
		findActivePage: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
		findAllPage: jest.fn().mockResolvedValue({ rows: [], total: 0 }),
		create: jest.fn().mockResolvedValue(plan()),
		update: jest.fn().mockResolvedValue(plan()),
		remove: jest.fn().mockResolvedValue(true),
		...overrides,
	};
	return {
		service: new PlansService(repo as unknown as PlansRepository),
		repo,
	};
}

async function failure(promise: Promise<unknown>): Promise<AppException> {
	try {
		await promise;
	} catch (error: unknown) {
		if (error instanceof AppException) return error;
		throw error;
	}
	throw new Error('Đáng lẽ phải ném AppException');
}

describe('PlansService.listPublic (AC-1)', () => {
	it('trả trang gói đang bán với năm trường, đổi trang thành skip và take', async () => {
		const { service, repo } = serviceWith({
			findActivePage: jest.fn().mockResolvedValue({
				rows: [plan({ isActive: true })],
				total: 41,
			}),
		});
		const page = await service.listPublic({ page: 3, pageSize: 20 });
		expect(repo.findActivePage).toHaveBeenCalledWith(40, 20);
		expect(page).toEqual({
			items: [
				{
					id: planId,
					name: 'Nâng cao',
					price: 199_000,
					maxListings: 15,
					durationDays: 30,
				},
			],
			total: 41,
			page: 3,
			pageSize: 20,
		});
	});

	it('không gọi đường đọc của admin', async () => {
		const { service, repo } = serviceWith();
		await service.listPublic({ page: 1, pageSize: 20 });
		expect(repo.findAllPage).not.toHaveBeenCalled();
	});
});

describe('PlansService.listAll (AC-2)', () => {
	it('trả cả gói đã tắt kèm isActive và mốc thời gian', async () => {
		const { service, repo } = serviceWith({
			findAllPage: jest.fn().mockResolvedValue({
				rows: [plan(), plan({ isActive: false, name: 'Cũ' })],
				total: 2,
			}),
		});
		const page = await service.listAll({ page: 1, pageSize: 50 });
		expect(repo.findAllPage).toHaveBeenCalledWith(0, 50);
		expect(page.items.map((item) => item.isActive)).toEqual([true, false]);
		expect(page.items[0]).toMatchObject({
			createdAt: created,
			updatedAt: created,
		});
		expect(repo.findActivePage).not.toHaveBeenCalled();
	});
});

describe('PlansService.create (AC-2)', () => {
	it('tạo gói và trả dạng của admin', async () => {
		const { service, repo } = serviceWith();
		const result = await service.create({
			name: 'Nâng cao',
			price: 199_000,
			maxListings: 15,
		});
		expect(repo.create).toHaveBeenCalledWith({
			name: 'Nâng cao',
			price: 199_000,
			maxListings: 15,
			durationDays: undefined,
			isActive: undefined,
		});
		expect(result.isActive).toBe(true);
		expect(result.createdAt).toBe(created);
	});

	it('trùng tên thì 409 PLAN_NAME_TAKEN, lỗi nằm ở trường name', async () => {
		const { service } = serviceWith({
			create: jest.fn().mockRejectedValue(new PlanNameTakenError()),
		});
		const error = await failure(
			service.create({ name: 'Nâng cao', price: 1, maxListings: 1 }),
		);
		expect(error.code).toBe(ErrorCode.PLAN_NAME_TAKEN);
		expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
		expect(error.fieldErrors.map((item) => item.field)).toEqual(['name']);
	});

	it('lỗi lạ của Repository đi tiếp nguyên vẹn, không bị nuốt', async () => {
		const boom = new Error('mất kết nối');
		const { service } = serviceWith({
			create: jest.fn().mockRejectedValue(boom),
		});
		await expect(
			service.create({ name: 'Gói', price: 1, maxListings: 1 }),
		).rejects.toBe(boom);
	});
});

describe('PlansService.update (AC-2)', () => {
	it('chỉ đẩy xuống các cột có gửi, cột vắng giữ nguyên', async () => {
		const { service, repo } = serviceWith();
		await service.update(planId, { price: 249_000, isActive: false });
		expect(repo.update).toHaveBeenCalledWith(planId, {
			price: 249_000,
			isActive: false,
		});
	});

	it('giữ giá trị falsy như price 0 và isActive false (không bị bỏ nhầm)', async () => {
		const { service, repo } = serviceWith();
		await service.update(planId, { price: 0, isActive: false });
		expect(repo.update).toHaveBeenCalledWith(planId, {
			price: 0,
			isActive: false,
		});
	});

	it('thân rỗng thì không có cột nào đổi', async () => {
		const { service, repo } = serviceWith();
		await service.update(planId, {});
		expect(repo.update).toHaveBeenCalledWith(planId, {});
	});

	it('không có gói thì 404 PLAN_NOT_FOUND', async () => {
		const { service } = serviceWith({
			update: jest.fn().mockResolvedValue(null),
		});
		const error = await failure(service.update(planId, { price: 1 }));
		expect(error.code).toBe(ErrorCode.PLAN_NOT_FOUND);
		expect(error.getStatus()).toBe(HttpStatus.NOT_FOUND);
	});

	it('đổi sang tên đã có thì 409 PLAN_NAME_TAKEN', async () => {
		const { service } = serviceWith({
			update: jest.fn().mockRejectedValue(new PlanNameTakenError()),
		});
		const error = await failure(service.update(planId, { name: 'Cơ bản' }));
		expect(error.code).toBe(ErrorCode.PLAN_NAME_TAKEN);
	});
});

describe('PlansService.remove (AC-2)', () => {
	it('xóa được gói chưa có đơn', async () => {
		const { service, repo } = serviceWith();
		await expect(service.remove(planId)).resolves.toBeUndefined();
		expect(repo.remove).toHaveBeenCalledWith(planId);
	});

	it('không có gói thì 404 PLAN_NOT_FOUND', async () => {
		const { service } = serviceWith({
			remove: jest.fn().mockResolvedValue(false),
		});
		const error = await failure(service.remove(planId));
		expect(error.code).toBe(ErrorCode.PLAN_NOT_FOUND);
	});

	it('gói đã có đơn thì 409 PLAN_IN_USE', async () => {
		const { service } = serviceWith({
			remove: jest.fn().mockRejectedValue(new PlanInUseError()),
		});
		const error = await failure(service.remove(planId));
		expect(error.code).toBe(ErrorCode.PLAN_IN_USE);
		expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
	});
});
