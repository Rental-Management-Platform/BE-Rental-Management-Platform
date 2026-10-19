import { OptionalNotNull } from '../../common/decorators/optional-not-null.decorator';
import {
	PlanDurationDays,
	PlanIsActive,
	PlanMaxListings,
	PlanName,
	PlanPrice,
} from './plan-fields';

/**
 * Body tạo gói (spec 0004 AC-2). `durationDays` mặc định 30 và `isActive` mặc định `true` khi không gửi;
 * `null` không hợp lệ cho hai trường tùy chọn.
 */
export class CreatePlanDto {
	@PlanName()
	name: string;

	/** Đồng Việt Nam, từ 0 đến 100.000.000. */
	@PlanPrice()
	price: number;

	@PlanMaxListings()
	maxListings: number;

	@OptionalNotNull()
	@PlanDurationDays()
	durationDays?: number;

	@OptionalNotNull()
	@PlanIsActive()
	isActive?: boolean;
}
