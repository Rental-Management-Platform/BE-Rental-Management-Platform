import { Module } from '@nestjs/common';
import { FavoritesDataModule } from '../favorites/favorites-data.module';
import { ListingsDataModule } from '../listings/listings-data.module';
import { ReviewsDataModule } from '../reviews/reviews-data.module';
import { SettingsModule } from '../settings/settings.module';
import { LandlordsController } from './landlords.controller';
import { LandlordsRepository } from './landlords.repository';
import { LandlordsService } from './landlords.service';

/**
 * Hồ sơ công khai, theo dõi chủ trọ (spec 0005), danh sách tin trên hồ sơ (spec 0009) và hai con số đánh giá (spec
 * 0014). Xuất `LandlordsRepository` để `ReviewsModule` tra chủ trọ hợp lệ bằng đúng hàm của hồ sơ.
 */
@Module({
	imports: [
		FavoritesDataModule,
		ListingsDataModule,
		ReviewsDataModule,
		SettingsModule,
	],
	controllers: [LandlordsController],
	providers: [LandlordsService, LandlordsRepository],
	exports: [LandlordsRepository],
})
export class LandlordsModule {}
