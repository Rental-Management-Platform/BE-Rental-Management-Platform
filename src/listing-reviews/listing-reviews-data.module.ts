import { Module } from '@nestjs/common';
import { ListingReviewsRepository } from './listing-reviews.repository';

/**
 * Chỉ giữ `ListingReviewsRepository`. Tách khỏi `ListingReviewsModule` để `ListingsModule` đọc hai con số của chi tiết
 * tin mà không import vòng: `ListingReviewsModule` cần `ListingsDataModule` (tin hiện công khai, chủ trọ của tin),
 * còn `ListingsModule` cần Repository này (spec 0015), theo tiền lệ `ReviewsDataModule` và `FavoritesDataModule`.
 */
@Module({
	providers: [ListingReviewsRepository],
	exports: [ListingReviewsRepository],
})
export class ListingReviewsDataModule {}
