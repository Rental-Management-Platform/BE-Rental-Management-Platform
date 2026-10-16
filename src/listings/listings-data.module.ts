import { Module } from '@nestjs/common';
import { ListingsRepository } from './listings.repository';

/**
 * Chỉ giữ `ListingsRepository`. Tách khỏi `ListingsModule` để module nhà trọ dùng được Repository của tin mà
 * không import vòng: `ListingsModule` cần `PropertiesModule`, còn `PropertiesModule` cần Repository này (đếm
 * tin còn sống, làm mới `search_key`). Hai module cùng import module nhỏ này nên không có vòng.
 */
@Module({
	providers: [ListingsRepository],
	exports: [ListingsRepository],
})
export class ListingsDataModule {}
