import { Injectable, Logger } from '@nestjs/common';
import { assertOwner } from '../common/auth/ownership';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import type { Prisma } from '../generated/prisma/client';
import { generateListingCode } from '../listings/listing-code';
import { PlansRepository } from '../plans/plans.repository';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import { UsersService } from '../users/users.service';
import type { CreateOrderDto } from './dto/create-order.dto';
import type { ListOrdersQueryDto } from './dto/order-queries.dto';
import type { OrderResponse } from './dto/order.response';
import { ORDER_CODE_ATTEMPTS, OrderCodeTakenError } from './order-code';
import { DAY_MS } from './order-status';
import { toOrderResponse } from './orders.mapper';
import { OrdersRepository } from './orders.repository';
import type { LockedOrder } from './orders.repository';

/**
 * Đơn mua gói bằng thanh toán thử và kỳ gói nối tiếp (spec 0004 AC-3 đến AC-7, AC-11). Chủ trọ chỉ chạm đơn của
 * chính mình, kể cả admin (`assertOwner`). Mọi lệnh ghi khóa dòng `users` của người gọi TRƯỚC, rồi mới khóa dòng
 * đơn: cùng một thứ tự ở tạo, thanh toán và hủy nên không có vòng chờ, và hai lệnh của cùng một chủ trọ chạy
 * tuần tự (nhờ đó mỗi chủ trọ tối đa một đơn chờ và các kỳ không chồng nhau).
 */
@Injectable()
export class OrdersService {
	private readonly logger = new Logger(OrdersService.name);

	constructor(
		private readonly repository: OrdersRepository,
		private readonly plans: PlansRepository,
		private readonly subscriptions: SubscriptionsRepository,
		private readonly transactions: TransactionRunner,
		private readonly users: UsersService,
	) {}

	/**
	 * Tạo đơn `pending` chốt giá, số tin và số ngày của gói tại lúc tạo; đơn chờ cũ của chủ trọ (nếu có) thành
	 * `cancelled` trong cùng giao dịch. Chỉ tài khoản `landlord`: admin có mọi quyền trong code nên qua được guard
	 * quyền, nhưng bị chặn ở đây để admin không tự mua gói rồi đăng tin. Không kiểm trùng mã trước (vẫn đua giữa
	 * hai request): chèn thẳng, gặp trùng thì sinh mã khác và thử lại tối đa 5 lần, vòng thử lại bọc NGOÀI giao
	 * dịch vì giao dịch PostgreSQL đã lỗi thì bị hủy.
	 */
	async create(
		user: RequestUser,
		dto: CreateOrderDto,
		now: Date,
	): Promise<OrderResponse> {
		if (user.accountType !== 'landlord') {
			throw new AppException(ErrorCode.PERMISSION_DENIED);
		}
		let collision: unknown;
		for (let attempt = 1; attempt <= ORDER_CODE_ATTEMPTS; attempt += 1) {
			try {
				const id = await this.insertOnce(user.userId, dto.planId, now);
				return await this.readOne(id);
			} catch (error: unknown) {
				if (!(error instanceof OrderCodeTakenError)) throw error;
				collision = error;
			}
		}
		this.logger.error(
			`Không sinh được mã đơn duy nhất sau ${ORDER_CODE_ATTEMPTS} lần thử (chủ trọ ${user.userId}).`,
		);
		throw new AppException(ErrorCode.INTERNAL_ERROR, [], {
			cause: collision,
		});
	}

	private insertOnce(
		userId: string,
		planId: string,
		now: Date,
	): Promise<string> {
		return this.transactions.run(async (tx) => {
			await this.users.lockById(userId, tx);
			const plan = await this.plans.findById(planId, tx);
			if (plan === null) throw new AppException(ErrorCode.PLAN_NOT_FOUND);
			if (!plan.isActive) throw new AppException(ErrorCode.PLAN_INACTIVE);
			await this.repository.cancelPendingOfUser(userId, now, tx);
			return this.repository.create(
				{
					code: generateListingCode(),
					userId,
					planId: plan.id,
					planName: plan.name,
					price: plan.price,
					maxListings: plan.maxListings,
					durationDays: plan.durationDays,
				},
				tx,
			);
		});
	}

	/** Đơn của chính người gọi, mới nhất trước, lọc `status` nếu có (admin gọi thì ra trang rỗng vì không có đơn). */
	async listOwn(
		user: RequestUser,
		query: ListOrdersQueryDto,
	): Promise<Page<OrderResponse>> {
		const { rows, total } = await this.repository.findOwnPage(
			user.userId,
			query.status,
			skipOf(query),
			query.pageSize,
		);
		return toPage(rows.map(toOrderResponse), total, query);
	}

	/** Một đơn: không có thì 404 `ORDER_NOT_FOUND`, của người khác thì 403 `NOT_RESOURCE_OWNER`. */
	async getOwn(user: RequestUser, id: string): Promise<OrderResponse> {
		const order = await this.repository.findById(id);
		if (order === null) throw new AppException(ErrorCode.ORDER_NOT_FOUND);
		assertOwner(user, order.userId);
		return toOrderResponse(order);
	}

	/**
	 * Thanh toán thử. Trong MỘT giao dịch: đơn `pending` thành `paid` và một kỳ gói được tạo, nên lỗi giữa chừng
	 * không để lại đơn `paid` thiếu kỳ hay kỳ thiếu đơn. Thứ tự báo lỗi: 404 hoặc 403 sở hữu, rồi trạng thái đơn
	 * (`cancelled` thì 409 `ORDER_STATE_INVALID`), rồi gói (đã tắt thì 409 `PLAN_INACTIVE`, đơn vẫn `pending`).
	 * Đơn đã `paid` thì trả đúng kết quả lần trước, không tạo kỳ mới: bấm đúp và bấm đồng thời an toàn.
	 *
	 * Kỳ mới bắt đầu ở thời điểm lớn hơn trong `now` và `ends_at` lớn nhất của các kỳ của chủ trọ (mua khi đang
	 * có gói thì nối vào cuối, kể cả gói khác), và dài đúng `durationDays` đã chốt trên đơn, chính xác đến mili giây.
	 */
	async pay(
		user: RequestUser,
		id: string,
		now: Date,
	): Promise<OrderResponse> {
		await this.transactions.run(async (tx) => {
			await this.users.lockById(user.userId, tx);
			const order = await this.lockOwned(user, id, tx);
			if (order.status === 'paid') return;
			if (order.status !== 'pending') {
				throw new AppException(ErrorCode.ORDER_STATE_INVALID);
			}
			const plan = await this.plans.findById(order.planId, tx);
			if (plan === null) throw new AppException(ErrorCode.PLAN_NOT_FOUND);
			if (!plan.isActive) throw new AppException(ErrorCode.PLAN_INACTIVE);

			const latestEnd = await this.subscriptions.findLatestEndsAt(
				user.userId,
				tx,
			);
			const startsAt =
				latestEnd !== null && latestEnd.getTime() > now.getTime()
					? latestEnd
					: now;
			await this.subscriptions.create(
				{
					userId: user.userId,
					orderId: order.id,
					startsAt,
					endsAt: new Date(
						startsAt.getTime() + order.durationDays * DAY_MS,
					),
				},
				tx,
			);
			if (!(await this.repository.markPaid(order.id, now, tx))) {
				throw new AppException(ErrorCode.ORDER_STATE_INVALID);
			}
		});
		return this.readOne(id);
	}

	/**
	 * Hủy đơn chưa trả. Đơn đã `cancelled` thì 200 trả đúng kết quả cũ; đơn `paid` thì 409 `ORDER_STATE_INVALID`
	 * (hoàn tiền đã hoãn khỏi MVP). Hủy đơn không đổi hạn mức: đơn `pending` chưa có kỳ.
	 */
	async cancel(
		user: RequestUser,
		id: string,
		now: Date,
	): Promise<OrderResponse> {
		await this.transactions.run(async (tx) => {
			await this.users.lockById(user.userId, tx);
			const order = await this.lockOwned(user, id, tx);
			if (order.status === 'cancelled') return;
			if (order.status !== 'pending') {
				throw new AppException(ErrorCode.ORDER_STATE_INVALID);
			}
			if (!(await this.repository.markCancelled(order.id, now, tx))) {
				throw new AppException(ErrorCode.ORDER_STATE_INVALID);
			}
		});
		return this.readOne(id);
	}

	/** Khóa dòng đơn rồi kiểm chủ sở hữu: 404 `ORDER_NOT_FOUND`, rồi 403 `NOT_RESOURCE_OWNER`. Gọi sau khóa `users`. */
	private async lockOwned(
		user: RequestUser,
		id: string,
		tx: Prisma.TransactionClient,
	): Promise<LockedOrder> {
		const order = await this.repository.lockById(id, tx);
		if (order === null) throw new AppException(ErrorCode.ORDER_NOT_FOUND);
		assertOwner(user, order.userId);
		return order;
	}

	/** Đọc đơn kèm kỳ gói bằng kết nối thường, SAU khi giao dịch ghi đã xong (không đọc nhiều quan hệ trong giao dịch). */
	private async readOne(id: string): Promise<OrderResponse> {
		const order = await this.repository.findById(id);
		if (order === null) throw new AppException(ErrorCode.ORDER_NOT_FOUND);
		return toOrderResponse(order);
	}
}
