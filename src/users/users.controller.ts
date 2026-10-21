import { Controller, Get, Header, Query } from '@nestjs/common';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import type { Page } from '../common/pagination/pagination';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { AdminUserListItem } from './users.mapper';
import { UsersService } from './users.service';

/**
 * Danh sách tài khoản cho admin (spec 0007). Quyền `user:read` chỉ admin giữ. `@FreshAuth()` đọc lại admin trong
 * database vì danh sách gom email và số điện thoại của mọi người (mở rộng spec 0003 AC-8 sang một thao tác đọc). Không
 * `@RateLimited` (bạn chọn ngày 2026-10-21, như `GET /moderation/listings`). Không cho cache: có dữ liệu cá nhân.
 * `ModerationController` cùng tiền tố `users` chỉ có `POST :id/...` nên không trùng route.
 */
@Controller('users')
export class UsersController {
	constructor(private readonly users: UsersService) {}

	@Get()
	@RequirePermissions('user:read')
	@FreshAuth()
	@Header('Cache-Control', 'private, no-store')
	list(@Query() query: ListUsersQueryDto): Promise<Page<AdminUserListItem>> {
		return this.users.listForAdmin(query);
	}
}
