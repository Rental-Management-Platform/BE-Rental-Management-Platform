import { Module } from '@nestjs/common';
import { ListingsDataModule } from '../listings/listings-data.module';
import { SettingsModule } from '../settings/settings.module';
import { FavoritesDataModule } from './favorites-data.module';
import {
	FavoritesController,
	ListingFavoritesController,
} from './favorites.controller';
import { FavoritesService } from './favorites.service';

/** Lưu tin yêu thích của người tìm trọ (spec 0006). */
@Module({
	imports: [FavoritesDataModule, ListingsDataModule, SettingsModule],
	controllers: [ListingFavoritesController, FavoritesController],
	providers: [FavoritesService],
})
export class FavoritesModule {}
