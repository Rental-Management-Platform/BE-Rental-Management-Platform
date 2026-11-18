import { Controller, Get, Header, Query } from '@nestjs/common';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { AdminOverviewService } from './admin-overview.service';
import type { AdminOverviewResponse } from './dto/admin-overview.response';
import { StatisticsQueryDto } from './dto/statistics-query.dto';

/**
 * Thống kê tổng quan của cả nền tảng cho admin (spec 0018 AC-1, AC-15). Quyền `statistic:report` chỉ admin giữ.
 * `@FreshAuth()` là BẮT BUỘC, không được bỏ: token chủ trọ cấp trước thay đổi này mang `statistic:manage`, và
 * `statistic:manage` giờ bung ra cả `statistic:report`, nên chỉ quyền đọc lại từ database (chủ trọ chỉ có khóa lẻ
 * `statistic:read`) giữ route này ở 403; nó cũng làm admin vừa bị khóa bị từ chối ngay. Phản hồi là số của cả nền tảng nên
 * không cho cache. Không `@RateLimited` (như `GET /users` và `GET /orders/all`).
 *
 * Controller riêng, không phải thêm vào `StatisticsController` của chủ trọ (`me/statistics`): hai đường không chung một
 * truy vấn nào, nên màn hình chủ trọ không có đường để vô tình thành số của cả nền tảng.
 */
@Controller('statistics')
export class AdminStatisticsController {
	constructor(private readonly overview: AdminOverviewService) {}

	@Get('overview')
	@RequirePermissions('statistic:report')
	@FreshAuth()
	@Header('Cache-Control', 'private, no-store')
	get(@Query() query: StatisticsQueryDto): Promise<AdminOverviewResponse> {
		return this.overview.get(query, new Date());
	}
}
