import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionsDataModule } from '../subscriptions/subscriptions-data.module';
import { UsersModule } from '../users/users.module';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

/** Đơn mua gói bằng thanh toán thử và kỳ gói nối tiếp (spec 0004 mốc 2). */
@Module({
	imports: [PlansModule, SubscriptionsDataModule, UsersModule],
	controllers: [OrdersController],
	providers: [OrdersService, OrdersRepository],
})
export class OrdersModule {}
