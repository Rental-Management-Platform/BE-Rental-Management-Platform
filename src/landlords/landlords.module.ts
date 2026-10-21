import { Module } from '@nestjs/common';
import { FavoritesDataModule } from '../favorites/favorites-data.module';
import { ListingsDataModule } from '../listings/listings-data.module';
import { SettingsModule } from '../settings/settings.module';
import { LandlordsController } from './landlords.controller';
import { LandlordsRepository } from './landlords.repository';
import { LandlordsService } from './landlords.service';

/** Hồ sơ công khai, theo dõi chủ trọ (spec 0005) và danh sách tin trên hồ sơ (spec 0009). */
@Module({
	imports: [FavoritesDataModule, ListingsDataModule, SettingsModule],
	controllers: [LandlordsController],
	providers: [LandlordsService, LandlordsRepository],
})
export class LandlordsModule {}
