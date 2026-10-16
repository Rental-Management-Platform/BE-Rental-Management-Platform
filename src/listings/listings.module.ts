import { Module } from '@nestjs/common';
import { ListingsRepository } from './listings.repository';

/** Mốc 2 chỉ dựng phần Repository mà nhà trọ dùng; Controller và Service của tin đến ở mốc 3. */
@Module({
	providers: [ListingsRepository],
	exports: [ListingsRepository],
})
export class ListingsModule {}
