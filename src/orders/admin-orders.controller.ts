import { Controller, Get, Header, Query } from '@nestjs/common';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { AdminOrdersService } from './admin-orders.service';
import type { AdminOrderPage } from './dto/admin-order.response';
import {
	ListAllOrdersQueryDto,
	RevenueQueryDto,
} from './dto/admin-order-queries.dto';
import type { RevenueResponse } from './dto/revenue.response';

/**
 * Đơn mua gói của mọi chủ trọ và thống kê doanh thu cho admin (spec 0010). Quyền `order:report` chỉ admin giữ.
 * `@FreshAuth()` là BẮT BUỘC, không được bỏ: token chủ trọ cấp trước thay đổi này mang `order:manage`, và
 * `order:manage` giờ bung ra cả `order:report`, nên chỉ quyền đọc lại từ database (chủ trọ chỉ có ba khóa lẻ) giữ hai
 * route này ở 403. Phản hồi gom tên và email chủ trọ cùng số tiền họ trả nên không cho cache. Không `@RateLimited`
 * (như `GET /users`).
 *
 * Controller này phải đứng TRƯỚC `OrdersController` trong `OrdersModule`: `GET /orders/:id` có `uuidParam()` nên sẽ
 * bắt chữ `all` và `revenue` thành 400 `INVALID_ID` nếu nó được đăng ký trước.
 */
@Controller('orders')
export class AdminOrdersController {
	constructor(private readonly adminOrders: AdminOrdersService) {}

	@Get('all')
	@RequirePermissions('order:report')
	@FreshAuth()
	@Header('Cache-Control', 'private, no-store')
	listAll(@Query() query: ListAllOrdersQueryDto): Promise<AdminOrderPage> {
		return this.adminOrders.listAll(query);
	}

	@Get('revenue')
	@RequirePermissions('order:report')
	@FreshAuth()
	@Header('Cache-Control', 'private, no-store')
	revenue(@Query() query: RevenueQueryDto): Promise<RevenueResponse> {
		return this.adminOrders.revenue(query);
	}
}
