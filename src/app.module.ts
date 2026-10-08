import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AccountTypesModule } from './account-types/account-types.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { PersistenceModule } from './common/persistence/persistence.module';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './database/prisma.module';
import { ModerationModule } from './moderation/moderation.module';
import { UsersModule } from './users/users.module';

@Module({
	imports: [
		AppConfigModule,
		PrismaModule,
		PersistenceModule,
		UsersModule,
		AccountTypesModule,
		AuthModule,
		ModerationModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{ provide: APP_FILTER, useClass: AllExceptionsFilter },
	],
})
export class AppModule {}
