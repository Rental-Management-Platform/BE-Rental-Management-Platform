import { Module } from '@nestjs/common';
import { MembershipsModule } from '../memberships/memberships.module';
import { ModerationModule } from '../moderation/moderation.module';
import { PropertiesModule } from '../properties/properties.module';
import { SettingsModule } from '../settings/settings.module';
import { UsersModule } from '../users/users.module';
import { ListingsDataModule } from './listings-data.module';
import {
	ListingsController,
	MyListingsController,
	PropertyListingsController,
} from './listings.controller';
import { ListingsService } from './listings.service';
import { ViewDeduplicator } from './view-deduplicator';

/** Tin đăng của chủ trọ và đọc công khai (spec 0002 mốc 3). */
@Module({
	imports: [
		ListingsDataModule,
		PropertiesModule,
		ModerationModule,
		MembershipsModule,
		SettingsModule,
		UsersModule,
	],
	controllers: [
		PropertyListingsController,
		ListingsController,
		MyListingsController,
	],
	providers: [ListingsService, ViewDeduplicator],
})
export class ListingsModule {}
