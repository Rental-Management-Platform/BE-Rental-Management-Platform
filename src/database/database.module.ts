import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigService } from '../config/app-config.service';
import { buildDataSourceOptions } from './database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        ...buildDataSourceOptions(config.database),
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
  ],
})
export class DatabaseModule {}
