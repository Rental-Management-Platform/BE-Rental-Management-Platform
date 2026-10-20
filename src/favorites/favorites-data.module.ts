import { Module } from '@nestjs/common';
import { FavoritesRepository } from './favorites.repository';

/**
 * Chỉ giữ `FavoritesRepository`. Tách khỏi `FavoritesModule` để `ListingsModule` đọc được cờ `isFavorite` mà không
 * import vòng: `FavoritesModule` cần `ListingsDataModule`, còn `ListingsModule` cần Repository này (spec 0006).
 */
@Module({
	providers: [FavoritesRepository],
	exports: [FavoritesRepository],
})
export class FavoritesDataModule {}
