import type { Metric } from '../stat-metric';
import type { StatisticsPeriodResponse } from './statistics.response';

/** Tài khoản chưa xóa mềm của một loại (hay của cả nền tảng) theo trạng thái; `total` luôn bằng `active + locked` (spec 0018 AC-4). */
export interface AccountCountsResponse {
	readonly total: number;
	readonly active: number;
	readonly locked: number;
}

/** Đăng ký mới trong kỳ (spec 0018 AC-5). Chỉ `landlord` và `tenant`, `admin` không tự đăng ký nên không bao giờ được đếm. */
export interface RegisteredResponse {
	readonly total: Metric;
	readonly landlords: Metric;
	readonly tenants: Metric;
}

/** Tài khoản hiện có và đăng ký mới (spec 0018 AC-4, AC-5). Các số của lúc đọc là số thường, không có kỳ trước. */
export interface AccountsResponse extends AccountCountsResponse {
	readonly byType: {
		readonly admin: AccountCountsResponse;
		readonly landlord: AccountCountsResponse;
		readonly tenant: AccountCountsResponse;
	};
	readonly registered: RegisteredResponse;
}

/**
 * Chủ trọ chưa xóa mềm (kể cả đang bị khóa) chia làm ba nhóm tại lúc đọc (spec 0018 AC-6); `total` bằng tổng ba nhóm và
 * bằng `accounts.byType.landlord.total`.
 */
export interface LandlordGroupsResponse {
	readonly total: number;
	readonly onPlan: number;
	readonly onTrial: number;
	readonly trialExpired: number;
}

/** Số tin mới của một phường trong kỳ (spec 0018 AC-9). Chỉ mã và tên phường, không có tin hay người nào. */
export interface WardListingCountResponse {
	readonly wardCode: string;
	readonly wardName: string;
	readonly count: number;
}

/**
 * Tin theo trạng thái, tin đang hiện công khai và tin mới (spec 0018 AC-7, AC-8, AC-9). Các số trạng thái, `public`,
 * `visibleButNotPublic` và `createdByWard` là số thường không có kỳ trước; chỉ `created` là Metric.
 */
export interface ListingsOverviewResponse {
	readonly total: number;
	readonly visible: number;
	readonly hiddenByOwner: number;
	readonly hiddenByAdmin: number;
	readonly public: number;
	readonly visibleButNotPublic: number;
	readonly created: Metric;
	readonly createdByWard: WardListingCountResponse[];
}

/**
 * Tương tác của cả nền tảng: bảy Metric (spec 0018 AC-10). Mỗi số đếm MỌI dòng đang tồn tại, không áp luật công khai
 * (đánh giá bị admin ẩn, lượt theo dõi của tài khoản bị khóa, tin nhắn của tin đã xóa mềm đều tính); `views` cộng cả
 * tin ẩn và đã xóa mềm.
 */
export interface OverviewEngagementResponse {
	readonly views: Metric;
	readonly conversations: Metric;
	readonly messages: Metric;
	readonly landlordReviews: Metric;
	readonly roomReviews: Metric;
	readonly follows: Metric;
	readonly favorites: Metric;
}

/**
 * Việc cần xử lý của admin, ba số của lúc đọc, không có kỳ trước (spec 0018 AC-11): tin chưa xóa mềm đang bị admin ẩn
 * (bằng `listings.hiddenByAdmin`), và hai loại đánh giá đang bị admin ẩn (bằng `total` của hai danh sách kiểm duyệt khi
 * lọc đánh giá đang bị ẩn).
 */
export interface ToHandleResponse {
	readonly hiddenListings: number;
	readonly hiddenLandlordReviews: number;
	readonly hiddenRoomReviews: number;
}

/** Một ngày của chuỗi (spec 0018 AC-12): mười cột, ngày không có gì thì mọi số bằng 0. */
export interface OverviewSeriesPointResponse {
	readonly date: string;
	readonly newLandlords: number;
	readonly newTenants: number;
	readonly newListings: number;
	readonly views: number;
	readonly newConversations: number;
	readonly newMessages: number;
	readonly newLandlordReviews: number;
	readonly newRoomReviews: number;
	readonly newFollows: number;
	readonly newFavorites: number;
}

/**
 * Thân của `GET /statistics/overview`: đúng bảy khóa (spec 0018 AC-1). Chỉ có số đếm, ngày, mã và tên phường: không id,
 * email, số điện thoại, tên, nhận xét hay nội dung của ai (AC-14).
 */
export interface AdminOverviewResponse {
	readonly period: StatisticsPeriodResponse;
	readonly accounts: AccountsResponse;
	readonly landlords: LandlordGroupsResponse;
	readonly listings: ListingsOverviewResponse;
	readonly engagement: OverviewEngagementResponse;
	readonly toHandle: ToHandleResponse;
	readonly series: OverviewSeriesPointResponse[];
}
