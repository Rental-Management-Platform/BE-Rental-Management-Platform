import { Module } from '@nestjs/common';
import { ReviewsRepository } from './reviews.repository';

/**
 * Chỉ giữ `ReviewsRepository`. Tách khỏi `ReviewsModule` để `LandlordsModule` đọc hai con số của hồ sơ mà không import
 * vòng: `ReviewsModule` cần `LandlordsModule` (tra chủ trọ hợp lệ), còn `LandlordsModule` cần Repository này (spec
 * 0014), theo tiền lệ `FavoritesDataModule` và `ListingsDataModule`.
 */
@Module({
	providers: [ReviewsRepository],
	exports: [ReviewsRepository],
})
export class ReviewsDataModule {}
