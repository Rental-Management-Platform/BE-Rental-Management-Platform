import { Module } from '@nestjs/common';
import { ChatDataModule } from '../chat/chat-data.module';
import { ListingsDataModule } from '../listings/listings-data.module';
import { ModerationModule } from '../moderation/moderation.module';
import { SettingsModule } from '../settings/settings.module';
import { ListingReviewModerationController } from './listing-review-moderation.controller';
import { ListingReviewModerationService } from './listing-review-moderation.service';
import { ListingReviewsController } from './listing-reviews.controller';
import { ListingReviewsDataModule } from './listing-reviews-data.module';
import { ListingReviewsService } from './listing-reviews.service';

/** Đánh giá từng phòng trên tin đăng (spec 0015): người viết và đọc công khai ở mốc 1, kiểm duyệt của admin ở mốc 2. */
@Module({
	imports: [
		ListingReviewsDataModule,
		ListingsDataModule,
		ChatDataModule,
		SettingsModule,
		ModerationModule,
	],
	controllers: [ListingReviewsController, ListingReviewModerationController],
	providers: [ListingReviewsService, ListingReviewModerationService],
})
export class ListingReviewsModule {}
