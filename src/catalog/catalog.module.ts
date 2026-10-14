import { Module } from '@nestjs/common';
import { AmenitiesController, WardsController } from './catalog.controller';
import { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';

@Module({
	controllers: [WardsController, AmenitiesController],
	providers: [CatalogService, CatalogRepository],
	exports: [CatalogService],
})
export class CatalogModule {}
