import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import type { RequestUser } from '../common/http/authenticated-request';
import type { MembershipResponse } from './dto/membership.response';
import { MembershipsService } from './memberships.service';

/** Kỳ dùng thử và hạn mức tin của chính người gọi (spec 0003 AC-10). Đọc theo `sub` của token nên không có tham số. */
@Controller('me/membership')
export class MembershipsController {
	constructor(private readonly memberships: MembershipsService) {}

	@Get()
	@RequirePermissions('subscription:read')
	get(@CurrentUser() user: RequestUser): Promise<MembershipResponse> {
		return this.memberships.getStatus(user.userId, new Date());
	}
}
