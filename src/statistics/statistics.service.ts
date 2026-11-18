import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import { toMembershipResponse } from '../memberships/memberships.mapper';
import { MembershipsService } from '../memberships/memberships.service';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import type { StatisticsQueryDto } from './dto/statistics-query.dto';
import type { StatisticsResponse } from './dto/statistics.response';
import {
	splitByPeriod,
	toListingBuckets,
	toPeriodResponse,
	toSeries,
	toTopListing,
} from './statistics.mapper';
import { StatisticsRepository } from './statistics.repository';
import { toMetric } from './stat-metric';
import { resolveStatPeriod } from './stat-period';

/** Số tin tối đa trong `views.top` (spec 0017 AC-7). */
export const TOP_LISTING_COUNT = 5;

/**
 * Thống kê của chính chủ trọ (spec 0017). Chỉ đọc, tính lúc đọc từ các bảng có sẵn, không lưu gì. Người gọi luôn là
 * `sub` của token; không có tham số nào mang id chủ trọ. `now` là đồng hồ ứng dụng do controller lấy một lần mỗi
 * request, dùng cho ngày hôm nay, hạn mức và kỳ gói.
 */
@Injectable()
export class StatisticsService {
	constructor(
		private readonly repository: StatisticsRepository,
		private readonly memberships: MembershipsService,
		private readonly subscriptions: SubscriptionsRepository,
	) {}

	/**
	 * Thứ tự kiểm lỗi (spec 0017 AC-15): token và quyền ở guard, tham số ở pipe rồi ở `resolveStatPeriod` (400), cuối
	 * cùng loại tài khoản (403) và luôn TRƯỚC mọi lần đọc dữ liệu. Admin gửi tham số sai nhận 400, giống favorites và
	 * chat. Hạn mức đọc trước vì tin `isPublic` của top và bucket `hiddenByQuota` cùng cần nó; các truy vấn còn lại
	 * chạy song song, không giao dịch (hai nhóm có thể lệch một dòng khi đang có ghi; trong một nhóm thì luôn khớp).
	 */
	async get(
		user: RequestUser,
		query: StatisticsQueryDto,
		now: Date,
	): Promise<StatisticsResponse> {
		const period = resolveStatPeriod(query, now);
		this.assertLandlord(user);
		const userId = user.userId;

		const membership = await this.memberships.resolve(userId, now);
		const [counts, dailyViews, topRows, paidUntil] = await Promise.all([
			this.repository.countListings(userId),
			this.repository.findDailyViews(
				userId,
				period.previousFrom,
				period.to,
			),
			this.repository.findTopListings(
				userId,
				period.from,
				period.to,
				membership.limit,
				TOP_LISTING_COUNT,
			),
			membership.subscription === null
				? Promise.resolve(null)
				: this.subscriptions.findLatestEndsAt(userId),
		]);

		const views = splitByPeriod(dailyViews, period);
		const buckets = toListingBuckets(counts, membership.limit);
		return {
			period: toPeriodResponse(period),
			listings: buckets,
			// Cùng phép đếm với `listings` nên `visibleCount` luôn bằng `public + hiddenByQuota` (AC-5).
			membership: toMembershipResponse(
				membership,
				buckets.public + buckets.hiddenByQuota,
				paidUntil,
				now,
			),
			views: {
				inRange: toMetric(views.value, views.previous),
				allTime: counts.viewCountAllTime,
				top: topRows.map(toTopListing),
			},
			series: toSeries(period, views.byDate),
		};
	}

	/**
	 * Chỉ `landlord` có thống kê (spec 0017 AC-15). `ADMIN_PERMISSIONS` giữ `statistic:*` nên admin qua được guard quyền,
	 * và admin hay tenant được cấp khóa này cũng vậy; kiểm loại tài khoản ở đây, như favorites (spec 0006) và chat (spec
	 * 0013), trước mọi lần đọc bảng dữ liệu. Khác `assertNotAdmin`: ở đây chặn mọi loại ngoài `landlord`.
	 */
	private assertLandlord(user: RequestUser): void {
		if (user.accountType !== 'landlord')
			throw new AppException(ErrorCode.PERMISSION_DENIED);
	}
}
