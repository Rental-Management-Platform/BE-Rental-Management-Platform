import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination';
import { REVIEW_STATUSES } from '../../reviews/review-status';
import type { ReviewStatus } from '../../reviews/review-status';

/**
 * Query của `GET /moderation/listing-reviews` (spec 0015 AC-11): phân trang cộng lọc theo trạng thái, tin và người
 * viết. Giá trị ngoài biên (`status` lạ, `listingId` hay `authorId` không phải UUID) và tham số lạ là 400
 * `VALIDATION_FAILED`.
 */
export class ListingReviewModerationQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsIn([...REVIEW_STATUSES])
	status?: ReviewStatus;

	@IsOptional()
	@IsUUID(undefined, { message: 'Phải là mã tin hợp lệ.' })
	listingId?: string;

	@IsOptional()
	@IsUUID(undefined, { message: 'Phải là mã người viết hợp lệ.' })
	authorId?: string;
}
