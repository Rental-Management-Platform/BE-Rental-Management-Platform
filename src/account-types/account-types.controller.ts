import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { describeCatalog } from '../common/auth/permission-catalog';
import type { CatalogEntry } from '../common/auth/permission-catalog';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { AccountTypesService } from './account-types.service';
import type { AccountTypeView } from './account-types.service';
import { UpdateAccountTypePermissionsDto } from './dto/update-account-type-permissions.dto';

@Controller('account-types')
export class AccountTypesController {
	constructor(private readonly accountTypes: AccountTypesService) {}

	@Get()
	@RequirePermissions('account_type:read')
	list(): Promise<AccountTypeView[]> {
		return this.accountTypes.list();
	}

	@Patch(':key')
	@RequirePermissions('account_type:update')
	@FreshAuth()
	update(
		@Param('key') key: string,
		@Body() dto: UpdateAccountTypePermissionsDto,
	): Promise<AccountTypeView> {
		return this.accountTypes.updatePermissions(key, dto.permissions);
	}
}

/** Danh mục quyền cho màn hình chọn quyền của admin. */
@Controller('permissions')
export class PermissionsController {
	@Get()
	@RequirePermissions('account_type:read')
	catalog(): CatalogEntry[] {
		return describeCatalog();
	}
}
