import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import type { RequestUser } from '../common/http/authenticated-request';
import { UpdateSettingDto } from './dto/update-setting.dto';
import type { SettingResponse } from './dto/setting.response';
import { SettingsService } from './settings.service';

/** Tham số hệ thống cho màn hình admin (spec 0003 dùng thử, AC-2). Chỉ admin giữ quyền `setting:*`. */
@Controller('settings')
export class SettingsController {
	constructor(private readonly settings: SettingsService) {}

	@Get()
	@RequirePermissions('setting:read')
	list(): Promise<SettingResponse[]> {
		return this.settings.list();
	}

	/** Có `@FreshAuth()` vì tham số này quyết định ai thấy tin của ai: tài khoản vừa bị khóa hay mất quyền bị từ chối ngay. */
	@Patch(':key')
	@RequirePermissions('setting:update')
	@FreshAuth()
	update(
		@Param('key') key: string,
		@Body() dto: UpdateSettingDto,
		@CurrentUser() user: RequestUser,
	): Promise<SettingResponse> {
		return this.settings.update(key, dto.value, user.userId, new Date());
	}
}
