import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { MembershipsService } from './memberships.service';

/** Kỳ dùng thử và hạn mức tin của chủ trọ (spec 0003). Hàng 10 thêm gói vào đây. */
@Module({
	imports: [UsersModule, SettingsModule],
	providers: [MembershipsService],
	exports: [MembershipsService],
})
export class MembershipsModule {}
