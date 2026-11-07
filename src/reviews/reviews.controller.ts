import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
} from '@nestjs/common';
import {
	CurrentUser,
	OptionalUser,
} from '../common/auth/current-user.decorator';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { OptionalAuth } from '../common/auth/optional-auth.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { PaginationQueryDto } from '../common/pagination/pagination';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { CreateReviewDto } from './dto/create-review.dto';
import type {
	MyReviewResponse,
	MyReviewStateResponse,
	PublicReviewResponse,
} from './dto/review.response';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

/**
 * Đánh giá chủ trọ ngay dưới hồ sơ công khai (spec 0014): một danh sách công khai và bốn route của người viết. Người
 * viết luôn là người trong token và chủ trọ luôn là `:id`; không route nào nhận id của đánh giá, nên một người không
 * bao giờ đọc hay đổi được đánh giá của người khác. Mọi route trả `Cache-Control: private, no-store` vì nội dung đổi
 * theo người xem. Ba route ghi gắn `@FreshAuth()` (tài khoản vừa bị khóa dừng ngay) và mỗi route đếm giới hạn riêng.
 */
@Controller('landlords')
export class LandlordReviewsController {
	constructor(private readonly reviews: ReviewsService) {}

	/**
	 * Công khai nhưng đọc đăng nhập tùy chọn: khách, token sai hay hết hạn đều nhận 200 với `isMine: null`, không bao
	 * giờ 401. Chỉ nhận `page` và `pageSize`: tham số khác bị 400.
	 */
	@OptionalAuth()
	@RateLimited('publicRead')
	@Header('Cache-Control', 'private, no-store')
	@Get(':id/reviews')
	list(
		@Param('id', uuidParam()) id: string,
		@Query() query: PaginationQueryDto,
		@OptionalUser() user: RequestUser | undefined,
	): Promise<Page<PublicReviewResponse>> {
		return this.reviews.list(id, query, user?.userId);
	}

	/** Đánh giá của chính người gọi và cờ `canReview` (AC-8). Cần đăng nhập, đếm giới hạn theo IP như hai route đọc. */
	@Get(':id/review')
	@RequirePermissions('review:read')
	@RateLimited('publicRead')
	@Header('Cache-Control', 'private, no-store')
	mine(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<MyReviewStateResponse> {
		return this.reviews.getMine(user, id);
	}

	/** Viết đánh giá (AC-3 đến AC-5): 201 kèm đánh giá vừa ghi. */
	@Post(':id/review')
	@RequirePermissions('review:create')
	@FreshAuth()
	@RateLimited('reviewWrite')
	@Header('Cache-Control', 'private, no-store')
	create(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: CreateReviewDto,
	): Promise<MyReviewResponse> {
		return this.reviews.create(user, id, dto);
	}

	/** Sửa đánh giá của mình (AC-6): 200 kèm đánh giá mới. */
	@Patch(':id/review')
	@RequirePermissions('review:update')
	@FreshAuth()
	@RateLimited('reviewWrite')
	@Header('Cache-Control', 'private, no-store')
	update(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: UpdateReviewDto,
	): Promise<MyReviewResponse> {
		return this.reviews.update(user, id, dto);
	}

	/** Xóa đánh giá của mình (AC-7): 204, không body. */
	@Delete(':id/review')
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequirePermissions('review:delete')
	@FreshAuth()
	@RateLimited('reviewWrite')
	@Header('Cache-Control', 'private, no-store')
	remove(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<void> {
		return this.reviews.remove(user, id);
	}
}
