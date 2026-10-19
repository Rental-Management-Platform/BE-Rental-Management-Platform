import type { Plan } from '../generated/prisma/client';
import type { AdminPlanResponse, PlanResponse } from './dto/plan.response';

/** Bảng giá công khai: không lộ `isActive` hay mốc thời gian (spec 0004 AC-1). */
export function toPlanResponse(plan: Plan): PlanResponse {
	return {
		id: plan.id,
		name: plan.name,
		price: plan.price,
		maxListings: plan.maxListings,
		durationDays: plan.durationDays,
	};
}

export function toAdminPlanResponse(plan: Plan): AdminPlanResponse {
	return {
		...toPlanResponse(plan),
		isActive: plan.isActive,
		createdAt: plan.createdAt,
		updatedAt: plan.updatedAt,
	};
}
