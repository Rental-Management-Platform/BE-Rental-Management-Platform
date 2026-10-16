import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ListingsDataModule } from '../listings/listings-data.module';
import { PropertiesController } from './properties.controller';
import { PropertiesRepository } from './properties.repository';
import { PropertiesService } from './properties.service';

@Module({
	imports: [CatalogModule, ListingsDataModule],
	controllers: [PropertiesController],
	providers: [PropertiesService, PropertiesRepository],
	// Module tin khóa dòng nhà trọ và đọc địa chỉ của nó khi đăng và sửa tin (spec 0002, "Key invariants").
	exports: [PropertiesRepository],
})
export class PropertiesModule {}
