import { ACCOUNT_TYPES } from '../common/auth/account-type';
import type { AccountType } from '../common/auth/account-type';
import type {
	AccountCountsResponse,
	AccountsResponse,
	ListingsOverviewResponse,
	OverviewEngagementResponse,
	OverviewSeriesPointResponse,
	ToHandleResponse,
	WardListingCountResponse,
} from './dto/admin-overview.response';
import type {
	AccountCountRow,
	HiddenReviewCounts,
	ListingStatusCounts,
	WardCountRow,
} from './admin-overview.repository';
import type { PeriodSplit } from './statistics.mapper';
import { toMetric } from './stat-metric';
import type { ResolvedStatPeriod } from './stat-period';

/**
 * Khối `accounts` (spec 0018 AC-4, AC-5). Ba loại luôn có mặt (loại không có dòng nào là `0, 0, 0`). Chỉ hai trạng thái
 * `active` và `locked` được cộng, nên `total = active + locked` ở mọi cấp; cấp ngoài cùng là tổng của ba loại. Hàng có
 * loại hay trạng thái lạ bị bỏ (không xảy ra: `users.status` có CHECK, `users.account_type` có khóa ngoại).
 * `registered.total` là tổng hai loại cả `value` lẫn `previous`, rồi mới tính phần trăm đổi.
 */
export function toAccountsBlock(
	rows: readonly AccountCountRow[],
	landlords: PeriodSplit,
	tenants: PeriodSplit,
): AccountsResponse {
	const cells = new Map<AccountType, { active: number; locked: number }>(
		ACCOUNT_TYPES.map((type) => [type, { active: 0, locked: 0 }]),
	);
	for (const row of rows) {
		const cell = cells.get(row.accountType as AccountType);
		if (cell === undefined) continue;
		if (row.status === 'active') cell.active += row.count;
		else if (row.status === 'locked') cell.locked += row.count;
	}
	const byType = (type: AccountType): AccountCountsResponse => {
		const cell = cells.get(type) ?? { active: 0, locked: 0 };
		return {
			total: cell.active + cell.locked,
			active: cell.active,
			locked: cell.locked,
		};
	};
	const admin = byType('admin');
	const landlord = byType('landlord');
	const tenant = byType('tenant');
	return {
		total: admin.total + landlord.total + tenant.total,
		active: admin.active + landlord.active + tenant.active,
		locked: admin.locked + landlord.locked + tenant.locked,
		byType: { admin, landlord, tenant },
		registered: {
			total: toMetric(
				landlords.value + tenants.value,
				landlords.previous + tenants.previous,
			),
			landlords: toMetric(landlords.value, landlords.previous),
			tenants: toMetric(tenants.value, tenants.previous),
		},
	};
}

/** Phường có tin mới, giữ nguyên thứ tự của truy vấn (`count` giảm dần rồi `wardCode` tăng dần). */
export function toWardList(
	rows: readonly WardCountRow[],
): WardListingCountResponse[] {
	return rows.map((row) => ({
		wardCode: row.wardCode,
		wardName: row.wardName,
		count: row.count,
	}));
}

/**
 * Khối `listings` (spec 0018 AC-7, AC-8, AC-9). `total` là tổng đúng ba số trạng thái trả ra nên luôn khớp.
 * `visibleButNotPublic = max(0, visible − public)`: về nguyên tắc tin công khai là tập con của tin `visible`, nên số
 * này không âm; phép `max` chỉ chặn hai truy vấn lệch nhau khi đang có ghi (không giao dịch).
 */
export function toListingsBlock(
	counts: ListingStatusCounts,
	publicCount: number,
	created: PeriodSplit,
	byWard: readonly WardCountRow[],
): ListingsOverviewResponse {
	return {
		total: counts.visible + counts.hiddenByOwner + counts.hiddenByAdmin,
		visible: counts.visible,
		hiddenByOwner: counts.hiddenByOwner,
		hiddenByAdmin: counts.hiddenByAdmin,
		public: publicCount,
		visibleButNotPublic: Math.max(0, counts.visible - publicCount),
		created: toMetric(created.value, created.previous),
		createdByWard: toWardList(byWard),
	};
}

/**
 * Khối `engagement` (spec 0018 AC-10): bảy Metric từ bảy lần tách kỳ. Mỗi khóa lấy đúng một `PeriodSplit` nên `value`
 * khớp tổng cột tương ứng của chuỗi, vì cả hai đến từ cùng các dòng.
 */
export function toEngagementBlock(
	splits: Readonly<Record<keyof OverviewEngagementResponse, PeriodSplit>>,
): OverviewEngagementResponse {
	return {
		views: toMetric(splits.views.value, splits.views.previous),
		conversations: toMetric(
			splits.conversations.value,
			splits.conversations.previous,
		),
		messages: toMetric(splits.messages.value, splits.messages.previous),
		landlordReviews: toMetric(
			splits.landlordReviews.value,
			splits.landlordReviews.previous,
		),
		roomReviews: toMetric(
			splits.roomReviews.value,
			splits.roomReviews.previous,
		),
		follows: toMetric(splits.follows.value, splits.follows.previous),
		favorites: toMetric(splits.favorites.value, splits.favorites.previous),
	};
}

/**
 * Khối `toHandle` (spec 0018 AC-11). `hiddenListings` lấy từ chính số `hiddenByAdmin` của khối tin (một lần đọc, cùng
 * điều kiện: tin chưa xóa mềm có `status = 'hidden_by_admin'`) nên luôn bằng `listings.hiddenByAdmin`, kể cả khi đang
 * có ghi giữa hai truy vấn.
 */
export function toToHandleBlock(
	listingCounts: ListingStatusCounts,
	hiddenReviews: HiddenReviewCounts,
): ToHandleResponse {
	return {
		hiddenListings: listingCounts.hiddenByAdmin,
		hiddenLandlordReviews: hiddenReviews.hiddenLandlordReviews,
		hiddenRoomReviews: hiddenReviews.hiddenRoomReviews,
	};
}

/** Các cột của chuỗi admin, mỗi cột là các số theo ngày của kỳ này (`PeriodSplit.byDate`). */
export interface OverviewSeriesColumns {
	readonly newLandlords: ReadonlyMap<string, number>;
	readonly newTenants: ReadonlyMap<string, number>;
	readonly newListings: ReadonlyMap<string, number>;
	readonly views: ReadonlyMap<string, number>;
	readonly newConversations: ReadonlyMap<string, number>;
	readonly newMessages: ReadonlyMap<string, number>;
	readonly newLandlordReviews: ReadonlyMap<string, number>;
	readonly newRoomReviews: ReadonlyMap<string, number>;
	readonly newFollows: ReadonlyMap<string, number>;
	readonly newFavorites: ReadonlyMap<string, number>;
}

/**
 * Chuỗi theo ngày đủ `days` phần tử, mỗi ngày từ `from` đến `to`, ngày không có gì thì mọi số bằng 0 (spec 0018 AC-12).
 * Mỗi cột lấy từ `byDate` của cùng lần tách kỳ đã cho `value` của Metric tương ứng, nên tổng cột luôn bằng `value`.
 */
export function toOverviewSeries(
	period: ResolvedStatPeriod,
	columns: OverviewSeriesColumns,
): OverviewSeriesPointResponse[] {
	return period.dates.map((date) => ({
		date,
		newLandlords: columns.newLandlords.get(date) ?? 0,
		newTenants: columns.newTenants.get(date) ?? 0,
		newListings: columns.newListings.get(date) ?? 0,
		views: columns.views.get(date) ?? 0,
		newConversations: columns.newConversations.get(date) ?? 0,
		newMessages: columns.newMessages.get(date) ?? 0,
		newLandlordReviews: columns.newLandlordReviews.get(date) ?? 0,
		newRoomReviews: columns.newRoomReviews.get(date) ?? 0,
		newFollows: columns.newFollows.get(date) ?? 0,
		newFavorites: columns.newFavorites.get(date) ?? 0,
	}));
}
