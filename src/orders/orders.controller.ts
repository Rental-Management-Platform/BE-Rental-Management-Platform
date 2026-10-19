import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/order-queries.dto';
import type { OrderResponse } from './dto/order.response';
import { OrdersService } from './orders.service';

/**
 * Đơn mua gói của chính người gọi (spec 0004 AC-3 đến AC-7, AC-11, AC-13). Quyền `order:*` là quyền của chủ sở
 * hữu: Service kiểm đúng chủ, kể cả với admin. Ba lệnh ghi cùng nhóm giới hạn `orderWrite`, mỗi route đếm riêng.
 */
@Controller('orders')
export class OrdersController {
	constructor(private readonly orders: OrdersService) {}

	@Post()
	@RequirePermissions('order:create')
	@RateLimited('orderWrite')
	create(
		@CurrentUser() user: RequestUser,
		@Body() dto: CreateOrderDto,
	): Promise<OrderResponse> {
		return this.orders.create(user, dto, new Date());
	}

	@Get()
	@RequirePermissions('order:read')
	list(
		@CurrentUser() user: RequestUser,
		@Query() query: ListOrdersQueryDto,
	): Promise<Page<OrderResponse>> {
		return this.orders.listOwn(user, query);
	}

	@Get(':id')
	@RequirePermissions('order:read')
	detail(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<OrderResponse> {
		return this.orders.getOwn(user, id);
	}

	/** Thanh toán thử: đơn thành `paid` và có kỳ gói ngay. Gọi lại trên đơn đã trả vẫn 200, cùng kết quả. */
	@Post(':id/pay')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('order:create')
	@RateLimited('orderWrite')
	pay(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<OrderResponse> {
		return this.orders.pay(user, id, new Date());
	}

	@Post(':id/cancel')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('order:cancel')
	@RateLimited('orderWrite')
	cancel(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<OrderResponse> {
		return this.orders.cancel(user, id, new Date());
	}
}
