import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Param,
	Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import type { UserResponse } from '../users/users.mapper';
import { ModerationReasonDto } from './dto/moderation-reason.dto';
import { ModerationService } from './moderation.service';

/** Thao tác của admin lên tài khoản người khác (spec 0003 AC-7). Mọi thao tác ghi đều `@FreshAuth()` (AC-8). */
@Controller('users')
export class ModerationController {
	constructor(private readonly moderation: ModerationService) {}

	@Post(':id/lock')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('user:lock')
	@FreshAuth()
	lock(
		@CurrentUser() actor: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: ModerationReasonDto,
	): Promise<UserResponse> {
		return this.moderation.lock(actor.userId, id, dto.reason);
	}

	@Post(':id/unlock')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('user:lock')
	@FreshAuth()
	unlock(
		@CurrentUser() actor: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: ModerationReasonDto,
	): Promise<UserResponse> {
		return this.moderation.unlock(actor.userId, id, dto.reason);
	}

	@Post(':id/revoke-sessions')
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequirePermissions('user:revoke')
	@FreshAuth()
	revokeSessions(@Param('id', uuidParam()) id: string): Promise<void> {
		return this.moderation.revokeSessions(id);
	}
}
