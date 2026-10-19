import { Module } from '@nestjs/common';
import { ListingsDataModule } from '../listings/listings-data.module';
import { SettingsModule } from '../settings/settings.module';
import { SubscriptionsDataModule } from '../subscriptions/subscriptions-data.module';
import { UsersModule } from '../users/users.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

/** Gói còn hiệu lực, kỳ dùng thử và hạn mức tin của chủ trọ (spec 0003, spec 0004). */
@Module({
	imports: [
		UsersModule,
		SettingsModule,
		ListingsDataModule,
		SubscriptionsDataModule,
	],
	controllers: [MembershipsController],
	providers: [MembershipsService],
	exports: [MembershipsService],
})
export class MembershipsModule {}
