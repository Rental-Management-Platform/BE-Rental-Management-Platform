import {
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { ModerationReasonDto } from '../moderation/dto/moderation-reason.dto';
import type { ModerationReviewResponse } from './dto/review.response';
import { ReviewModerationQueryDto } from './dto/review-queries.dto';
import { ReviewModerationService } from './review-moderation.service';

/**
 * Admin tìm và ẩn, gỡ ẩn đánh giá vi phạm kèm lý do (spec 0014 AC-11, AC-12). Quyền `review:moderate` chỉ admin giữ.
 * Hai route ghi gắn `@FreshAuth()`: tài khoản admin vừa bị khóa hay mất quyền bị từ chối ngay, không chờ token hết
 * hạn. Không có giới hạn tần suất thêm: chỉ admin gọi, như kiểm duyệt tin.
 */
@Controller('moderation/reviews')
export class ReviewModerationController {
	constructor(private readonly moderation: ReviewModerationService) {}

	@Get()
	@RequirePermissions('review:moderate')
	list(
		@Query() query: ReviewModerationQueryDto,
	): Promise<Page<ModerationReviewResponse>> {
		return this.moderation.list(query);
	}

	@Post(':id/hide')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('review:moderate')
	@FreshAuth()
	hide(
		@CurrentUser() actor: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: ModerationReasonDto,
	): Promise<ModerationReviewResponse> {
		return this.moderation.hide(actor.userId, id, dto.reason);
	}

	@Post(':id/unhide')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('review:moderate')
	@FreshAuth()
	unhide(
		@CurrentUser() actor: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: ModerationReasonDto,
	): Promise<ModerationReviewResponse> {
		return this.moderation.unhide(actor.userId, id, dto.reason);
	}
}
