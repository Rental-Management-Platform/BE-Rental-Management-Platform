import { Body, Controller, Get, Header, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import type { RequestUser } from '../common/http/authenticated-request';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { ProfileResponse } from './users.mapper';
import { UsersService } from './users.service';

/**
 * Hồ sơ của chính người gọi (spec 0008). Không có tham số id: hàng nào được đọc hay sửa luôn là người trong token,
 * nên quyền `profile:*` (chỉ của chính mình) đúng theo cấu trúc. Không `@FreshAuth()`; Service tự đọc hàng của người
 * gọi nên khóa hay xóa mềm có hiệu lực ngay. Không cho cache: có email và số điện thoại. Chỉ `PATCH` bị giới hạn tần suất.
 */
@Controller('me/profile')
export class ProfileController {
	constructor(private readonly users: UsersService) {}

	@Get()
	@RequirePermissions('profile:read')
	@Header('Cache-Control', 'private, no-store')
	get(@CurrentUser() user: RequestUser): Promise<ProfileResponse> {
		return this.users.getProfile(user.userId);
	}

	@Patch()
	@RequirePermissions('profile:update')
	@RateLimited('profileWrite')
	@Header('Cache-Control', 'private, no-store')
	update(
		@CurrentUser() user: RequestUser,
		@Body() dto: UpdateProfileDto,
	): Promise<ProfileResponse> {
		return this.users.updateProfile(user.userId, dto);
	}
}
