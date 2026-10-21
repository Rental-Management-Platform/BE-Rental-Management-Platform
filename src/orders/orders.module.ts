import { Module } from '@nestjs/common';
import { PlansModule } from '../plans/plans.module';
import { SubscriptionsDataModule } from '../subscriptions/subscriptions-data.module';
import { UsersModule } from '../users/users.module';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminOrdersService } from './admin-orders.service';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

/**
 * Đơn mua gói bằng thanh toán thử và kỳ gói nối tiếp (spec 0004 mốc 2), cùng phần đọc của admin (spec 0010).
 * `AdminOrdersController` đứng TRƯỚC `OrdersController` vì `GET /orders/:id` bắt nhầm `all` và `revenue`.
 */
@Module({
	imports: [PlansModule, SubscriptionsDataModule, UsersModule],
	controllers: [AdminOrdersController, OrdersController],
	providers: [OrdersService, AdminOrdersService, OrdersRepository],
})
export class OrdersModule {}
