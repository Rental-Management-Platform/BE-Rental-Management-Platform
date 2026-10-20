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
} from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogService } from './catalog.service';
import { CreateAmenityDto, UpdateAmenityDto } from './dto/amenity.dto';
import type { AmenityResponse, WardResponse } from './dto/catalog.response';
import { CreateWardDto, UpdateWardDto } from './dto/ward.dto';

/**
 * Danh sách phường, xã, đặc khu cho ô chọn địa chỉ. Đọc công khai: khách chưa đăng nhập cũng lọc tin theo phường.
 * Ghi (tạo, sửa tên, xóa) chỉ admin giữ quyền `catalog:*` (spec 0002 AC-2).
 */
@Controller('wards')
export class WardsController {
	constructor(
		private readonly catalog: CatalogService,
		private readonly admin: CatalogAdminService,
	) {}

	@Public()
	@Get()
	list(): Promise<WardResponse[]> {
		return this.catalog.listWards();
	}

	@Post()
	@RequirePermissions('catalog:create')
	create(@Body() dto: CreateWardDto): Promise<WardResponse> {
		return this.admin.createWard(dto);
	}

	@Patch(':code')
	@RequirePermissions('catalog:update')
	update(
		@Param('code') code: string,
		@Body() dto: UpdateWardDto,
	): Promise<WardResponse> {
		return this.admin.updateWard(code, dto);
	}

	@Delete(':code')
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequirePermissions('catalog:delete')
	remove(@Param('code') code: string): Promise<void> {
		return this.admin.deleteWard(code);
	}
}

/** Danh sách tiện ích cho biểu mẫu nhà trọ. Đọc công khai; ghi chỉ admin giữ quyền `catalog:*` (spec 0002 AC-2). */
@Controller('amenities')
export class AmenitiesController {
	constructor(
		private readonly catalog: CatalogService,
		private readonly admin: CatalogAdminService,
	) {}

	@Public()
	@Get()
	list(): Promise<AmenityResponse[]> {
		return this.catalog.listAmenities();
	}

	@Post()
	@RequirePermissions('catalog:create')
	create(@Body() dto: CreateAmenityDto): Promise<AmenityResponse> {
		return this.admin.createAmenity(dto);
	}

	@Patch(':key')
	@RequirePermissions('catalog:update')
	update(
		@Param('key') key: string,
		@Body() dto: UpdateAmenityDto,
	): Promise<AmenityResponse> {
		return this.admin.updateAmenity(key, dto.name);
	}

	@Delete(':key')
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequirePermissions('catalog:delete')
	remove(@Param('key') key: string): Promise<void> {
		return this.admin.deleteAmenity(key);
	}
}
