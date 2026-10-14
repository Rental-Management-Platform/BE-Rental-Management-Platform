import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/auth/public.decorator';
import { CatalogService } from './catalog.service';
import type { AmenityResponse, WardResponse } from './dto/catalog.response';

/** Danh sách phường, xã, đặc khu cho ô chọn địa chỉ. Công khai: khách chưa đăng nhập cũng lọc tin theo phường. */
@Controller('wards')
export class WardsController {
	constructor(private readonly catalog: CatalogService) {}

	@Public()
	@Get()
	list(): Promise<WardResponse[]> {
		return this.catalog.listWards();
	}
}

/** Danh sách tiện ích cho biểu mẫu nhà trọ. Công khai. */
@Controller('amenities')
export class AmenitiesController {
	constructor(private readonly catalog: CatalogService) {}

	@Public()
	@Get()
	list(): Promise<AmenityResponse[]> {
		return this.catalog.listAmenities();
	}
}
