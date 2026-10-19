import { Module } from '@nestjs/common';
import { ListingsDataModule } from '../listings/listings-data.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

/** Kỳ dùng thử và hạn mức tin của chủ trọ (spec 0003). Hàng 10 thêm gói vào đây. */
@Module({
	imports: [UsersModule, SettingsModule, ListingsDataModule],
	controllers: [MembershipsController],
	providers: [MembershipsService],
	exports: [MembershipsService],
})
export class MembershipsModule {}
