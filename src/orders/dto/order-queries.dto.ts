import { IsIn, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination';
import { ORDER_STATUSES } from '../order-status';
import type { OrderStatus } from '../order-status';

/** Query của `GET /orders` (spec 0004 AC-4): phân trang cộng lọc theo trạng thái. */
export class ListOrdersQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsIn([...ORDER_STATUSES])
	status?: OrderStatus;
}
