import { Module } from '@nestjs/common';
import { ListingsDataModule } from '../listings/listings-data.module';
import { CatalogAdminService } from './catalog-admin.service';
import { AmenitiesController, WardsController } from './catalog.controller';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';

@Module({
	// Đổi tên phường dựng lại `search_key` của tin qua `ListingsRepository`; module dữ liệu của tin không import ai
	// nên không tạo vòng với `PropertiesModule` (cũng import cả hai module này).
	imports: [ListingsDataModule],
	controllers: [WardsController, AmenitiesController],
	providers: [CatalogService, CatalogAdminService, CatalogRepository],
	exports: [CatalogService],
})
export class CatalogModule {}
