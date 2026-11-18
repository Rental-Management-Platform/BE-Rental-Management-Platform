import type { MembershipResponse } from '../../memberships/dto/membership.response';
import type { ListingStatus } from '../../listings/listing-status';
import type { Metric } from '../stat-metric';

/** Khoảng ngày đã chốt (spec 0017 AC-2, AC-3): ngày lịch giờ Việt Nam `YYYY-MM-DD`, không bao giờ `null`. */
export interface StatisticsPeriodResponse {
	readonly from: string;
	readonly to: string;
	readonly days: number;
	readonly previousFrom: string;
	readonly previousTo: string;
	readonly timeZone: string;
}

/** Tin chưa xóa mềm của chủ trọ theo trạng thái (spec 0017 AC-4); `total` luôn bằng tổng bốn số còn lại. */
export interface ListingBucketsResponse {
	readonly total: number;
	readonly public: number;
	readonly hiddenByQuota: number;
	readonly hiddenByOwner: number;
	readonly hiddenByAdmin: number;
}

/** Một tin trong top xem nhiều (spec 0017 AC-7). Chỉ có thông tin của chính tin, không có danh tính ai khác. */
export interface TopListingResponse {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly status: ListingStatus;
	readonly isPublic: boolean;
	readonly viewsInRange: number;
	readonly viewsAllTime: number;
}

export interface ViewsResponse {
	readonly inRange: Metric;
	/** Tổng `view_count` của mọi tin kể cả tin ẩn và đã xóa mềm; bằng `totalViewCount` của `GET /landlords/:id`. */
	readonly allTime: number;
	readonly top: TopListingResponse[];
}

/** Một ngày của chuỗi (spec 0017 AC-12). Mốc 1 có cột `views`; ba cột còn lại thêm ở mốc 2. */
export interface SeriesPointResponse {
	readonly date: string;
	readonly views: number;
}

/** Thân của `GET /me/statistics` (spec 0017 AC-1). Khối chưa làm ở mốc này thì chưa có mặt. */
export interface StatisticsResponse {
	readonly period: StatisticsPeriodResponse;
	readonly listings: ListingBucketsResponse;
	readonly membership: MembershipResponse;
	readonly views: ViewsResponse;
	readonly series: SeriesPointResponse[];
}
