import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import { PaginationQueryDto } from '../common/pagination/pagination';
import type { Page } from '../common/pagination/pagination';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { CreatePropertyDto } from './dto/create-property.dto';
import type {
	PropertyListItemResponse,
	PropertyResponse,
} from './dto/property.response';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertiesService } from './properties.service';

/** Nhà trọ của chủ trọ (spec 0002 AC-3, AC-4). Quyền `property:*` là quyền của chủ sở hữu: Service kiểm đúng chủ. */
@Controller('properties')
export class PropertiesController {
	constructor(private readonly properties: PropertiesService) {}

	@Post()
	@RequirePermissions('property:create')
	@RateLimited('propertyWrite')
	create(
		@CurrentUser() user: RequestUser,
		@Body() dto: CreatePropertyDto,
	): Promise<PropertyResponse> {
		return this.properties.create(user, dto);
	}

	@Get()
	@RequirePermissions('property:read')
	list(
		@CurrentUser() user: RequestUser,
		@Query() query: PaginationQueryDto,
	): Promise<Page<PropertyListItemResponse>> {
		return this.properties.list(user, query);
	}

	@Get(':id')
	@RequirePermissions('property:read')
	get(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<PropertyResponse> {
		return this.properties.get(user, id);
	}

	@Patch(':id')
	@RequirePermissions('property:update')
	@RateLimited('propertyWrite')
	update(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: UpdatePropertyDto,
	): Promise<PropertyResponse> {
		return this.properties.update(user, id, dto);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequirePermissions('property:delete')
	@RateLimited('propertyWrite')
	remove(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<void> {
		return this.properties.remove(user, id);
	}
}
