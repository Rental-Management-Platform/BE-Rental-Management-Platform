import { Module } from '@nestjs/common';
import { SubscriptionsRepository } from './subscriptions.repository';

/**
 * Chỉ giữ `SubscriptionsRepository`, để module đơn (ghi kỳ lúc thanh toán) và module hạn mức (đọc kỳ đang chạy,
 * mốc 3) cùng dùng mà không import vòng, giống `ListingsDataModule`.
 */
@Module({
	providers: [SubscriptionsRepository],
	exports: [SubscriptionsRepository],
})
export class SubscriptionsDataModule {}
