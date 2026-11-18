import type { MembershipResponse } from '../../memberships/dto/membership.response';
import type { ListingStatus } from '../../listings/listing-status';
import type { Metric, RateMetric } from '../stat-metric';

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

/**
 * Mức quan tâm (spec 0017 AC-8). Hai số mới trong kỳ có kỳ trước; hai tổng là số của hiện tại, đếm cùng điều kiện nhưng
 * không có khoảng ngày. Chỉ đếm dòng đang tồn tại nên số của một kỳ cũ có thể giảm về sau.
 */
export interface InterestResponse {
	readonly newFavorites: Metric;
	readonly newFollowers: Metric;
	readonly totalFavorites: number;
	readonly totalFollowers: number;
}

/** Điểm một đối tượng được đánh giá (spec 0017 AC-9): `average` là `null` khi `count` bằng 0. */
export interface RatingBlockResponse {
	readonly average: number | null;
	readonly count: number;
	readonly newInRange: Metric;
}

/** Điểm của chủ trọ (bảng `reviews`) và điểm các phòng (bảng `listing_reviews`), không bao giờ cộng vào nhau. */
export interface RatingsResponse {
	readonly landlord: RatingBlockResponse;
	readonly rooms: RatingBlockResponse;
}

/** Chat theo vai chủ trọ (spec 0017 AC-10). Chỉ số lượng, không có tên người nhắn hay nội dung tin. */
export interface ChatResponse {
	readonly conversationsOpened: Metric;
	readonly repliedConversations: Metric;
	readonly replyRate: RateMetric;
	readonly totalConversations: number;
	readonly unreadConversations: number;
	readonly unreadMessages: number;
}

/** Gói và tiền đã chi (spec 0017 AC-11), đồng Việt Nam, chỉ đơn `paid`; tiền ở đây là thanh toán thử. */
export interface SpendingResponse {
	readonly spent: Metric;
	readonly paidOrders: Metric;
	readonly spentAllTime: number;
}

/** Một ngày của chuỗi (spec 0017 AC-12): bốn cột, ngày không có gì thì mọi số bằng 0. */
export interface SeriesPointResponse {
	readonly date: string;
	readonly views: number;
	readonly newFavorites: number;
	readonly newFollowers: number;
	readonly newConversations: number;
}

/** Thân của `GET /me/statistics` (spec 0017 AC-1): đúng chín khóa. */
export interface StatisticsResponse {
	readonly period: StatisticsPeriodResponse;
	readonly listings: ListingBucketsResponse;
	readonly membership: MembershipResponse;
	readonly views: ViewsResponse;
	readonly interest: InterestResponse;
	readonly ratings: RatingsResponse;
	readonly chat: ChatResponse;
	readonly spending: SpendingResponse;
	readonly series: SeriesPointResponse[];
}
