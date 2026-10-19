import { Module } from '@nestjs/common';
import { PlansController } from './plans.controller';
import { PlansRepository } from './plans.repository';
import { PlansService } from './plans.service';

@Module({
	controllers: [PlansController],
	providers: [PlansService, PlansRepository],
	// Module đơn đọc gói (giá, số tin, còn bán) khi tạo đơn và thanh toán (spec 0004 mốc 2).
	exports: [PlansRepository],
})
export class PlansModule {}
