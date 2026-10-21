import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination';
import {
	IsCalendarDate,
	IsNotBeforeDate,
} from '../../common/time/calendar-date';
import { ORDER_STATUSES, REVENUE_GROUP_BYS } from '../order-status';
import type { OrderStatus, RevenueGroupBy } from '../order-status';

/**
 * Query của `GET /orders/all` cho admin (spec 0010 AC-1 đến AC-3): phân trang cộng ba bộ lọc cùng hai ngày lọc theo
 * `created_at`. Mỗi tham số một giá trị; giá trị ngoài danh sách, id không phải UUID, ngày sai hay tham số lạ (`sort`,
 * `q`) là 400 `VALIDATION_FAILED`. `from` lớn hơn `to` báo ở trường `to`.
 */
export class ListAllOrdersQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsIn([...ORDER_STATUSES])
	status?: OrderStatus;

	@IsOptional()
	@IsUUID(undefined, { message: 'Phải là mã chủ trọ hợp lệ.' })
	landlordId?: string;

	@IsOptional()
	@IsUUID(undefined, { message: 'Phải là mã gói hợp lệ.' })
	planId?: string;

	@IsOptional()
	@IsCalendarDate()
	from?: string;

	@IsOptional()
	@IsCalendarDate()
	@IsNotBeforeDate('from')
	to?: string;
}

/**
 * Query của `GET /orders/revenue` cho admin (spec 0010 AC-6): khoảng ngày TRẢ (`paid_at`, giờ Việt Nam, luật y hệt
 * ngày của danh sách) và cách gom `day` hoặc `month` (mặc định `month`). Không có phân trang hay `status`: tham số
 * lạ, kể cả những tham số của `GET /orders/all`, là 400 `VALIDATION_FAILED`.
 */
export class RevenueQueryDto {
	@IsOptional()
	@IsCalendarDate()
	from?: string;

	@IsOptional()
	@IsCalendarDate()
	@IsNotBeforeDate('from')
	to?: string;

	@IsOptional()
	@IsIn([...REVENUE_GROUP_BYS])
	groupBy: RevenueGroupBy = 'month';
}
