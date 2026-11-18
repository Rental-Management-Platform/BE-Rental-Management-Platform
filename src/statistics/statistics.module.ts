import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { SubscriptionsDataModule } from '../subscriptions/subscriptions-data.module';
import { StatisticsController } from './statistics.controller';
import { StatisticsRepository } from './statistics.repository';
import { StatisticsService } from './statistics.service';

/** Thống kê của chủ trọ (spec 0017): một route đọc `GET /me/statistics`, không ghi bảng nào. */
@Module({
	imports: [MembershipsModule, SubscriptionsDataModule],
	controllers: [StatisticsController],
	providers: [StatisticsService, StatisticsRepository],
})
export class StatisticsModule {}
