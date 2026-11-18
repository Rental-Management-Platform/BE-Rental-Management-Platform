import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import {
	toListingsBlock,
	toAccountsBlock,
	toEngagementBlock,
	toOverviewSeries,
	toToHandleBlock,
} from './admin-overview.mapper';
import { AdminOverviewRepository } from './admin-overview.repository';
import type { AdminOverviewResponse } from './dto/admin-overview.response';
import type { StatisticsQueryDto } from './dto/statistics-query.dto';
import {
	resolveStatPeriod,
	toCurrentRangeBounds,
	toRangeBounds,
} from './stat-period';
import { splitByPeriod, toPeriodResponse } from './statistics.mapper';

/**
 * Thống kê tổng quan của cả nền tảng cho admin (spec 0018). Chỉ đọc, tính lúc đọc từ các bảng có sẵn, không lưu gì. Không
 * có tham số nào lọc theo người: số là của cả nền tảng, nên quyền `statistic:report` cộng `@FreshAuth()` ở controller
 * là rào duy nhất (không kiểm loại tài khoản ở đây, như `AdminOrdersService`). `now` là đồng hồ ứng dụng do controller
 * lấy một lần mỗi request, dùng cho ngày hôm nay, kỳ gói, hạn dùng thử và luật công khai.
 */
@Injectable()
export class AdminOverviewService {
	constructor(
		private readonly repository: AdminOverviewRepository,
		private readonly settings: SettingsService,
	) {}

	/**
	 * Thứ tự kiểm lỗi (spec 0018 AC-15): token, quyền và đọc lại admin bằng database ở guard, rồi tham số ở pipe và ở
	 * `resolveStatPeriod` (400), và tất cả trước mọi lần đọc bảng dữ liệu. Hạn mức dùng thử đọc trước vì phép đếm
	 * `public` cần nó; các truy vấn còn lại chạy song song, không giao dịch (hai nhóm có thể lệch một dòng khi đang có
	 * ghi; trong một nhóm thì luôn khớp).
	 */
	async get(
		query: StatisticsQueryDto,
		now: Date,
	): Promise<AdminOverviewResponse> {
		const period = resolveStatPeriod(query, now);
		const { start, end } = toRangeBounds(period);
		const current = toCurrentRangeBounds(period);
		const trialListingLimit = await this.settings.getValue(
			'trial_listing_limit',
		);

		const [
			accountRows,
			landlordRegistrations,
			tenantRegistrations,
			landlordGroups,
			listingCounts,
			publicCount,
			createdListings,
			createdByWard,
			dailyViews,
			conversations,
			messages,
			landlordReviews,
			roomReviews,
			follows,
			favorites,
			hiddenReviews,
		] = await Promise.all([
			this.repository.countAccounts(),
			this.repository.findRegistrations('landlord', start, end),
			this.repository.findRegistrations('tenant', start, end),
			this.repository.countLandlordGroups(now),
			this.repository.countListingsByStatus(),
			this.repository.countPublicListings(now, trialListingLimit),
			this.repository.findCreatedListings(start, end),
			this.repository.findCreatedByWard(current.start, current.end),
			this.repository.findDailyViews(period.previousFrom, period.to),
			this.repository.findEngagement('conversations', start, end),
			this.repository.findEngagement('messages', start, end),
			this.repository.findEngagement('landlordReviews', start, end),
			this.repository.findEngagement('roomReviews', start, end),
			this.repository.findEngagement('follows', start, end),
			this.repository.findEngagement('favorites', start, end),
			this.repository.countHiddenReviews(),
		]);

		// Mỗi nguồn tách MỘT lần: `value` của Metric và cột của chuỗi đến từ cùng các dòng, nên tổng cột luôn bằng `value`.
		const newLandlords = splitByPeriod(landlordRegistrations, period);
		const newTenants = splitByPeriod(tenantRegistrations, period);
		const newListings = splitByPeriod(createdListings, period);
		const splits = {
			views: splitByPeriod(dailyViews, period),
			conversations: splitByPeriod(conversations, period),
			messages: splitByPeriod(messages, period),
			landlordReviews: splitByPeriod(landlordReviews, period),
			roomReviews: splitByPeriod(roomReviews, period),
			follows: splitByPeriod(follows, period),
			favorites: splitByPeriod(favorites, period),
		};
		return {
			period: toPeriodResponse(period),
			accounts: toAccountsBlock(accountRows, newLandlords, newTenants),
			landlords: landlordGroups,
			listings: toListingsBlock(
				listingCounts,
				publicCount,
				newListings,
				createdByWard,
			),
			engagement: toEngagementBlock(splits),
			toHandle: toToHandleBlock(listingCounts, hiddenReviews),
			series: toOverviewSeries(period, {
				newLandlords: newLandlords.byDate,
				newTenants: newTenants.byDate,
				newListings: newListings.byDate,
				views: splits.views.byDate,
				newConversations: splits.conversations.byDate,
				newMessages: splits.messages.byDate,
				newLandlordReviews: splits.landlordReviews.byDate,
				newRoomReviews: splits.roomReviews.byDate,
				newFollows: splits.follows.byDate,
				newFavorites: splits.favorites.byDate,
			}),
		};
	}
}
