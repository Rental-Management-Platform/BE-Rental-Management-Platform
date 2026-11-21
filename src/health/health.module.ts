import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthRepository } from './health.repository';
import { HealthService } from './health.service';

/** `GET /health`: tiến trình còn trả lời và database còn kết nối được. */
@Module({
	controllers: [HealthController],
	providers: [HealthService, HealthRepository],
})
export class HealthModule {}
