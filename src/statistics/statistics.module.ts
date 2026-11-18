import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { SettingsModule } from '../settings/settings.module';
import { SubscriptionsDataModule } from '../subscriptions/subscriptions-data.module';
import { AdminOverviewRepository } from './admin-overview.repository';
import { AdminOverviewService } from './admin-overview.service';
import { AdminStatisticsController } from './admin-statistics.controller';
import { StatisticsController } from './statistics.controller';
import { StatisticsRepository } from './statistics.repository';
import { StatisticsService } from './statistics.service';

/**
 * Thống kê, chỉ đọc, không ghi bảng nào: `GET /me/statistics` của chủ trọ (spec 0017) và `GET /statistics/overview` của
 * admin (spec 0018). Hai đường có controller, service và repository riêng.
 */
@Module({
	imports: [MembershipsModule, SubscriptionsDataModule, SettingsModule],
	controllers: [StatisticsController, AdminStatisticsController],
	providers: [
		StatisticsService,
		StatisticsRepository,
		AdminOverviewService,
		AdminOverviewRepository,
	],
})
export class StatisticsModule {}
