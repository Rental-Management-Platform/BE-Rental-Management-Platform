import { applyDecorators } from '@nestjs/common';
import {
	IsBoolean,
	IsInt,
	IsString,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { PLAN_LIMITS } from '../plan-limits';

/**
 * Luật của từng trường gói, viết một lần để body tạo và body sửa dùng chung (không để hai DTO lệch nhau).
 * Body sửa thêm `@OptionalNotNull()` ở trên cùng của mỗi trường.
 */

export const PlanName = (): PropertyDecorator =>
	applyDecorators(
		Trim(),
		IsString(),
		MinLength(PLAN_LIMITS.nameMin),
		MaxLength(PLAN_LIMITS.nameMax),
	);

export const PlanPrice = (): PropertyDecorator =>
	applyDecorators(
		IsInt(),
		Min(PLAN_LIMITS.priceMin),
		Max(PLAN_LIMITS.priceMax),
	);

export const PlanMaxListings = (): PropertyDecorator =>
	applyDecorators(
		IsInt(),
		Min(PLAN_LIMITS.maxListingsMin),
		Max(PLAN_LIMITS.maxListingsMax),
	);

export const PlanDurationDays = (): PropertyDecorator =>
	applyDecorators(
		IsInt(),
		Min(PLAN_LIMITS.durationDaysMin),
		Max(PLAN_LIMITS.durationDaysMax),
	);

export const PlanIsActive = (): PropertyDecorator =>
	applyDecorators(IsBoolean());
