import { Module } from '@nestjs/common';
import { ChatDataModule } from '../chat/chat-data.module';
import { LandlordsModule } from '../landlords/landlords.module';
import { ModerationModule } from '../moderation/moderation.module';
import { ReviewModerationController } from './review-moderation.controller';
import { ReviewModerationService } from './review-moderation.service';
import { LandlordReviewsController } from './reviews.controller';
import { ReviewsDataModule } from './reviews-data.module';
import { ReviewsService } from './reviews.service';

/** Đánh giá chủ trọ trên hồ sơ công khai (spec 0014): người viết ở mốc 1, kiểm duyệt của admin ở mốc 2. */
@Module({
	imports: [
		ReviewsDataModule,
		LandlordsModule,
		ChatDataModule,
		ModerationModule,
	],
	controllers: [LandlordReviewsController, ReviewModerationController],
	providers: [ReviewsService, ReviewModerationService],
})
export class ReviewsModule {}
