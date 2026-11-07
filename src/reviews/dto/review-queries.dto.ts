import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination/pagination';
import { REVIEW_STATUSES } from '../review-status';
import type { ReviewStatus } from '../review-status';

/**
 * Query của `GET /moderation/reviews` (spec 0014 AC-11): phân trang cộng lọc theo trạng thái, chủ trọ và người viết.
 * Giá trị ngoài biên (`status` lạ, `landlordId` hay `authorId` không phải UUID) và tham số lạ là 400
 * `VALIDATION_FAILED`.
 */
export class ReviewModerationQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsIn([...REVIEW_STATUSES])
	status?: ReviewStatus;

	@IsOptional()
	@IsUUID(undefined, { message: 'Phải là mã chủ trọ hợp lệ.' })
	landlordId?: string;

	@IsOptional()
	@IsUUID(undefined, { message: 'Phải là mã người viết hợp lệ.' })
	authorId?: string;
}
