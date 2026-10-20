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
import type { ModerationListingResponse } from './dto/listing.response';
import { ModerationListingsQueryDto } from './dto/listing-queries.dto';
import { ListingModerationService } from './listing-moderation.service';

/**
 * Admin tìm tin và ẩn, gỡ ẩn tin vi phạm kèm lý do (spec 0002 AC-9). Quyền `listing:moderate` chỉ admin giữ. Hai
 * route ghi gắn `@FreshAuth()` (spec 0003 AC-8): tài khoản admin vừa bị khóa hay mất quyền bị từ chối ngay, không
 * chờ token hết hạn. Không có giới hạn tần suất thêm: chỉ admin gọi.
 */
@Controller('moderation/listings')
export class ListingModerationController {
	constructor(private readonly moderation: ListingModerationService) {}

	@Get()
	@RequirePermissions('listing:moderate')
	list(
		@Query() query: ModerationListingsQueryDto,
	): Promise<Page<ModerationListingResponse>> {
		return this.moderation.list(query);
	}

	@Post(':id/hide')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('listing:moderate')
	@FreshAuth()
	hide(
		@CurrentUser() actor: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: ModerationReasonDto,
	): Promise<ModerationListingResponse> {
		return this.moderation.hide(actor.userId, id, dto.reason);
	}

	@Post(':id/unhide')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('listing:moderate')
	@FreshAuth()
	unhide(
		@CurrentUser() actor: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: ModerationReasonDto,
	): Promise<ModerationListingResponse> {
		return this.moderation.unhide(actor.userId, id, dto.reason);
	}
}
