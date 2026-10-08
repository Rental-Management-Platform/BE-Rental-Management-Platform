import { Module } from '@nestjs/common';
import {
	AccountTypesController,
	PermissionsController,
} from './account-types.controller';
import { AccountTypesRepository } from './account-types.repository';
import { AccountTypesService } from './account-types.service';

@Module({
	controllers: [AccountTypesController, PermissionsController],
	providers: [AccountTypesService, AccountTypesRepository],
	exports: [AccountTypesService],
})
export class AccountTypesModule {}
