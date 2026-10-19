import type { Plan } from '../generated/prisma/client';
import { toAdminPlanResponse, toPlanResponse } from './plans.mapper';

const created = new Date('2026-10-19T02:00:00.000Z');
const updated = new Date('2026-10-19T03:00:00.000Z');

function plan(overrides: Partial<Plan> = {}): Plan {
	return {
		id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02',
		name: 'Nâng cao',
		price: 199_000,
		maxListings: 15,
		durationDays: 30,
		isActive: true,
		createdAt: created,
		updatedAt: updated,
		...overrides,
	};
}

describe('toPlanResponse (spec 0004 AC-1)', () => {
	it('chỉ có năm trường của bảng giá, không lộ cờ bán hay mốc thời gian', () => {
		const response = toPlanResponse(plan());
		expect(Object.keys(response).sort()).toEqual([
			'durationDays',
			'id',
			'maxListings',
			'name',
			'price',
		]);
		expect(response).toEqual({
			id: '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02',
			name: 'Nâng cao',
			price: 199_000,
			maxListings: 15,
			durationDays: 30,
		});
	});
});

describe('toAdminPlanResponse (spec 0004 AC-2)', () => {
	it('thêm isActive, createdAt, updatedAt vào năm trường của bảng giá', () => {
		const response = toAdminPlanResponse(plan({ isActive: false }));
		expect(Object.keys(response).sort()).toEqual([
			'createdAt',
			'durationDays',
			'id',
			'isActive',
			'maxListings',
			'name',
			'price',
			'updatedAt',
		]);
		expect(response.isActive).toBe(false);
		expect(response.createdAt).toBe(created);
		expect(response.updatedAt).toBe(updated);
	});
});
