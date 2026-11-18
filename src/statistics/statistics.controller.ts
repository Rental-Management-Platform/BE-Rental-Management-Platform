import { Controller, Get, Header, Query } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import type { RequestUser } from '../common/http/authenticated-request';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { StatisticsQueryDto } from './dto/statistics-query.dto';
import type { StatisticsResponse } from './dto/statistics.response';
import { StatisticsService } from './statistics.service';

/**
 * Thống kê của chính chủ trọ (spec 0017 AC-1, AC-15). Một route đọc duy nhất, theo `sub` của token nên không có tham số
 * id. Không `@FreshAuth()`: dữ liệu là của chính người gọi, như `GET /me/membership`, nên chủ trọ vừa bị khóa mang token
 * còn hạn vẫn đọc được số của mình. Dùng nhóm giới hạn tần suất `publicRead` đã có (mỗi route đếm riêng, như
 * `GET /me/favorites`). Nội dung của người gọi nên không cho cache.
 */
@Controller('me/statistics')
export class StatisticsController {
	constructor(private readonly statistics: StatisticsService) {}

	@Get()
	@RequirePermissions('statistic:read')
	@RateLimited('publicRead')
	@Header('Cache-Control', 'private, no-store')
	get(
		@CurrentUser() user: RequestUser,
		@Query() query: StatisticsQueryDto,
	): Promise<StatisticsResponse> {
		return this.statistics.get(user, query, new Date());
	}
}
