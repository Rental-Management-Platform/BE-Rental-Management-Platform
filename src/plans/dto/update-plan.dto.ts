import { OptionalNotNull } from '../../common/decorators/optional-not-null.decorator';
import {
	PlanDurationDays,
	PlanIsActive,
	PlanMaxListings,
	PlanName,
	PlanPrice,
} from './plan-fields';

/**
 * Body sửa gói (spec 0004 AC-2): mọi trường tùy chọn và không nhận `null`; trường nào không gửi thì giữ nguyên.
 * Đổi giá, số tin hay số ngày chỉ ảnh hưởng đơn tạo sau đó (đơn đã có giữ bản chốt).
 */
export class UpdatePlanDto {
	@OptionalNotNull()
	@PlanName()
	name?: string;

	@OptionalNotNull()
	@PlanPrice()
	price?: number;

	@OptionalNotNull()
	@PlanMaxListings()
	maxListings?: number;

	@OptionalNotNull()
	@PlanDurationDays()
	durationDays?: number;

	/** Tắt (`false`) để ngừng bán thay vì xóa. */
	@OptionalNotNull()
	@PlanIsActive()
	isActive?: boolean;
}
