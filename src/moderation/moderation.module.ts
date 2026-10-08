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
})
export class ModerationModule {}
