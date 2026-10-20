import { Module } from '@nestjs/common';
import { ListingsDataModule } from '../listings/listings-data.module';
import { SettingsModule } from '../settings/settings.module';
import { LandlordsController } from './landlords.controller';
import { LandlordsRepository } from './landlords.repository';
import { LandlordsService } from './landlords.service';

/** Hồ sơ công khai và theo dõi chủ trọ (spec 0005). */
@Module({
	imports: [ListingsDataModule, SettingsModule],
	controllers: [LandlordsController],
	providers: [LandlordsService, LandlordsRepository],
})
export class LandlordsModule {}
