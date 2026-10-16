import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { ModerationController } from './moderation.controller';
import { ModerationLogsRepository } from './moderation-logs.repository';
import { ModerationService } from './moderation.service';

@Module({
	imports: [UsersModule, AuthModule],
	controllers: [ModerationController],
	providers: [ModerationService, ModerationLogsRepository],
	// Module tin đọc lý do admin ẩn tin từ lịch sử kiểm duyệt (spec 0002 AC-14).
	exports: [ModerationLogsRepository],
})
export class ModerationModule {}
