import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ListingsModule } from '../listings/listings.module';
import { PropertiesController } from './properties.controller';
import { PropertiesRepository } from './properties.repository';
import { PropertiesService } from './properties.service';

@Module({
	imports: [CatalogModule, ListingsModule],
	controllers: [PropertiesController],
	providers: [PropertiesService, PropertiesRepository],
})
export class PropertiesModule {}
