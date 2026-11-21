import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { HealthService } from './health.service';
import type { HealthResponse } from './health.service';

/**
 * Kiểm tra sức khỏe cho Docker `HEALTHCHECK` và dịch vụ giám sát bên ngoài. Công khai (không có token) và
 * chỉ trả trạng thái, không lộ cấu hình hay phiên bản.
 */
@Controller('health')
export class HealthController {
	constructor(private readonly health: HealthService) {}

	@Public()
	@RateLimited('publicRead')
	@Get()
	check(): Promise<HealthResponse> {
		return this.health.check();
	}
}
