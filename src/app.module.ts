import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AccountTypesModule } from './account-types/account-types.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';
import { FavoritesModule } from './favorites/favorites.module';
import { LandlordsModule } from './landlords/landlords.module';
import { ListingsModule } from './listings/listings.module';
import { PersistenceModule } from './common/persistence/persistence.module';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './database/prisma.module';
import { MembershipsModule } from './memberships/memberships.module';
import { ModerationModule } from './moderation/moderation.module';
import { OrdersModule } from './orders/orders.module';
import { PlansModule } from './plans/plans.module';
import { PropertiesModule } from './properties/properties.module';
import { SettingsModule } from './settings/settings.module';
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
		CatalogModule,
		PropertiesModule,
		ListingsModule,
		SettingsModule,
		MembershipsModule,
		PlansModule,
		OrdersModule,
		LandlordsModule,
		FavoritesModule,
	],
	controllers: [AppController],
	providers: [
		AppService,
		{ provide: APP_FILTER, useClass: AllExceptionsFilter },
	],
})
export class AppModule {}
