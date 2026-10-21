import { Injectable } from '@nestjs/common';
import { skipOf, toPage } from '../common/pagination/pagination';
import {
	APP_TIME_ZONE,
	startOfDay,
	startOfNextDay,
} from '../common/time/app-time-zone';
import type { AdminOrderPage } from './dto/admin-order.response';
import type {
	ListAllOrdersQueryDto,
	RevenueQueryDto,
} from './dto/admin-order-queries.dto';
import type {
	RevenueByPlan,
	RevenuePeriod,
	RevenueResponse,
} from './dto/revenue.response';
import { toAdminOrderResponse } from './orders.mapper';
import { OrdersRepository } from './orders.repository';

/** Thứ tự ký tự (không theo bảng chữ cái tiếng Việt), để thứ tự không đổi theo cấu hình ngôn ngữ của máy chủ. */
function compareText(a: string, b: string): number {
	if (a < b) return -1;
	return a > b ? 1 : 0;
}

/** `paidAmount` giảm dần, rồi `planName` tăng dần, rồi `planId` (spec 0010 AC-7). */
function compareByPlan(a: RevenueByPlan, b: RevenueByPlan): number {
	return (
		b.paidAmount - a.paidAmount ||
		compareText(a.planName, b.planName) ||
		compareText(a.planId, b.planId)
	);
}

function sumOf(rows: readonly { paidCount: number; paidAmount: number }[]): {
	paidCount: number;
	paidAmount: number;
} {
	return rows.reduce(
		(total, row) => ({
			paidCount: total.paidCount + row.paidCount,
			paidAmount: total.paidAmount + row.paidAmount,
		}),
		{ paidCount: 0, paidAmount: 0 },
	);
}

/**
 * Phần đọc của admin trên đơn mua gói (spec 0010). Tách khỏi `OrdersService` để service đó giữ nguyên là phần của chủ
 * sở hữu (`assertOwner`); cả hai dùng chung `OrdersRepository`, nơi duy nhất chạm bảng `orders`. Chỉ đọc: không
 * ghi, không khóa dòng.
 */
@Injectable()
export class AdminOrdersService {
	constructor(private readonly repository: OrdersRepository) {}

	/**
	 * Đơn của mọi chủ trọ ở mọi trạng thái kèm `summary` của đúng tập lọc (AC-1 đến AC-5). `from` và `to` là ngày theo giờ
	 * Việt Nam (AC-3): `created_at` phải từ 00:00 của `from` và trước 00:00 của ngày sau `to`.
	 */
	async listAll(query: ListAllOrdersQueryDto): Promise<AdminOrderPage> {
		const { rows, total, summary } = await this.repository.findAdminPage(
			{
				status: query.status,
				landlordId: query.landlordId,
				planId: query.planId,
				createdFrom:
					query.from === undefined
						? undefined
						: startOfDay(query.from),
				createdBefore:
					query.to === undefined
						? undefined
						: startOfNextDay(query.to),
			},
			skipOf(query),
			query.pageSize,
		);
		return {
			...toPage(rows.map(toAdminOrderResponse), total, query),
			summary,
		};
	}

	/**
	 * Thống kê doanh thu theo NGÀY TRẢ của các đơn `paid` (spec 0010 AC-6 đến AC-8). `from` và `to` là ngày theo giờ
	 * Việt Nam, cùng luật với danh sách nhưng lọc `paid_at`. `paidCount` và `paidAmount` ngoài cùng cộng từ các dòng
	 * `byPlan` của chính câu SQL đó (cùng ảnh chụp dữ liệu với `series`), nên ba tổng luôn bằng nhau. Không có đơn nào
	 * thì mọi số bằng 0 và hai mảng rỗng.
	 */
	async revenue(query: RevenueQueryDto): Promise<RevenueResponse> {
		const { byPlan, series } = await this.repository.findRevenue(
			{
				from:
					query.from === undefined
						? undefined
						: startOfDay(query.from),
				before:
					query.to === undefined
						? undefined
						: startOfNextDay(query.to),
			},
			query.groupBy,
		);
		const sortedByPlan: RevenueByPlan[] = [...byPlan].sort(compareByPlan);
		const sortedSeries: RevenuePeriod[] = [...series].sort((a, b) =>
			compareText(a.period, b.period),
		);
		return {
			from: query.from ?? null,
			to: query.to ?? null,
			groupBy: query.groupBy,
			timeZone: APP_TIME_ZONE,
			...sumOf(sortedByPlan),
			byPlan: sortedByPlan,
			series: sortedSeries,
		};
	}
}
