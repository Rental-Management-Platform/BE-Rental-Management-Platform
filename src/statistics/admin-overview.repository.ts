import { Injectable } from '@nestjs/common';
import { APP_TIME_ZONE } from '../common/time/app-time-zone';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
	publicListingCondition,
	publicListingFrom,
} from '../listings/listings.repository';

/** Một ngày và số dòng của ngày đó (`YYYY-MM-DD`, ngày lịch giờ Việt Nam). */
export interface DailyCountRow {
	readonly day: string;
	readonly count: number;
}

interface DailyCountRaw {
	readonly day: string;
	readonly count: bigint | number;
}

/**
 * Khung chung của các phép đếm theo ngày của màn hình admin (spec 0018 AC-10, AC-12, AC-13). `source` là một câu SELECT
 * trả MỘT cột `occurred_at` (thời điểm của dòng); kết quả là các dòng `{ day, count }`, mỗi ngày giờ Việt Nam có dòng
 * trong `[start, end)` một dòng, sắp ngày tăng dần. Khác `dailyWithTotal` của spec 0017: KHÔNG kèm dòng tổng toàn
 * thời gian vì màn hình admin không có số toàn thời gian, nên không phải quét thêm mọi dòng của nguồn.
 *
 * `AT TIME ZONE` với tên múi giờ là tham số ràng buộc nên không phụ thuộc múi giờ phiên của database. `start` và `end`
 * là chuỗi ISO có `Z` (`toRangeBounds`), không bao giờ `Date` (xem `toSqlTimestamp`); `end` so chặt `<`. Ngày không có
 * dòng nào thì không có hàng (Service điền 0). Nguồn nào đếm "mọi dòng" thì không lọc gì ở `source`. Nằm trong file
 * `*.repository.ts` vì quy tắc lint chỉ cho Repository dựng `Prisma.sql`; hàng 28 dùng lại bằng cách import từ đây.
 */
export function dailyCounts(
	source: Prisma.Sql,
	start: string,
	end: string,
): Prisma.Sql {
	return Prisma.sql`
		WITH src AS (${source})
		SELECT to_char(s.occurred_at AT TIME ZONE ${APP_TIME_ZONE}::text, 'YYYY-MM-DD') AS "day",
			count(*)::bigint AS "count"
		FROM src s
		WHERE s.occurred_at >= ${start}::timestamptz AND s.occurred_at < ${end}::timestamptz
		GROUP BY 1
		ORDER BY 1`;
}

/** `count` về từ SQL là `bigint`; đổi sang `number` (an toàn: số dòng xa dưới 2^53). */
function toDailyCountRows(rows: readonly DailyCountRaw[]): DailyCountRow[] {
	return rows.map((row) => ({ day: row.day, count: Number(row.count) }));
}

/** Loại tài khoản được tính vào "đăng ký mới": `admin` do seed tạo, không tự đăng ký nên không bao giờ có ở đây (spec 0018 AC-5). */
export type RegisteredAccountType = 'landlord' | 'tenant';

/**
 * Đếm tài khoản chưa xóa mềm theo loại và trạng thái, trong MỘT câu (spec 0018 AC-4). Chỉ đọc dòng `deleted_at IS
 * NULL` nên cùng luật với `total` của `GET /users`. Mỗi tổ hợp có dòng là một hàng; tổ hợp không có dòng nào thì không
 * có hàng (mapper điền 0).
 */
export function accountCountsQuery(): Prisma.Sql {
	return Prisma.sql`
		SELECT u.account_type AS "accountType", u.status AS "status", count(*)::int AS "count"
		FROM users u
		WHERE u.deleted_at IS NULL
		GROUP BY u.account_type, u.status`;
}

/**
 * Đăng ký mới theo ngày của một loại tài khoản (spec 0018 AC-5). Đếm MỌI dòng `users` của loại đó, kể cả tài khoản sau
 * đó bị khóa hay xóa mềm (không lọc `deleted_at` hay `status`); `account_type` là tham số ràng buộc, chỉ nhận
 * `landlord` hay `tenant`.
 */
export function registrationsQuery(
	accountType: RegisteredAccountType,
	start: string,
	end: string,
): Prisma.Sql {
	return dailyCounts(
		Prisma.sql`
			SELECT u.created_at AS occurred_at
			FROM users u
			WHERE u.account_type = ${accountType}`,
		start,
		end,
	);
}

/**
 * Chủ trọ chưa xóa mềm chia ba nhóm trong MỘT câu (spec 0018 AC-6), kể cả chủ trọ đang bị khóa. Một chủ trọ là `onPlan`
 * nếu có kỳ gói chứa `now` (`starts_at` tính, `ends_at` không tính, cùng `tstzrange(...) @>` của `publicListingFrom`);
 * không thì `onTrial` nếu `trial_ends_at` lớn hơn `now` (so chặt, như `MembershipsService.resolve`; `NULL` không lớn
 * hơn gì nên rơi xuống nhóm cuối); không thì `trialExpired`. Gói thắng dùng thử. `now` vào dạng chuỗi ISO có `Z`, không
 * truyền `Date` (xem `toSqlTimestamp`).
 */
export function landlordGroupsQuery(now: Date): Prisma.Sql {
	const instant = now.toISOString();
	return Prisma.sql`
		WITH landlords AS (
			SELECT
				EXISTS (
					SELECT 1 FROM subscriptions s
					WHERE s.user_id = u.id AND tstzrange(s.starts_at, s.ends_at) @> ${instant}::timestamptz
				) AS on_plan,
				COALESCE(u.trial_ends_at > ${instant}::timestamptz, false) AS on_trial
			FROM users u
			WHERE u.account_type = 'landlord' AND u.deleted_at IS NULL
		)
		SELECT
			count(*)::int AS "total",
			count(*) FILTER (WHERE x.on_plan)::int AS "onPlan",
			count(*) FILTER (WHERE NOT x.on_plan AND x.on_trial)::int AS "onTrial",
			count(*) FILTER (WHERE NOT x.on_plan AND NOT x.on_trial)::int AS "trialExpired"
		FROM landlords x`;
}

/**
 * Tin chưa xóa mềm theo trạng thái trong MỘT câu (spec 0018 AC-7). Không `GROUP BY` nên luôn đúng một dòng, kể cả khi
 * chưa có tin nào (mọi số là 0). Tin đã xóa mềm không tính vào đâu.
 */
export function listingStatusCountsQuery(): Prisma.Sql {
	return Prisma.sql`
		SELECT
			count(*) FILTER (WHERE l.status = 'visible')::int AS "visible",
			count(*) FILTER (WHERE l.status = 'hidden_by_owner')::int AS "hiddenByOwner",
			count(*) FILTER (WHERE l.status = 'hidden_by_admin')::int AS "hiddenByAdmin"
		FROM listings l
		WHERE l.deleted_at IS NULL`;
}

/**
 * Số tin đang hiện công khai ngay lúc đọc (spec 0018 AC-8): đúng hai mảnh SQL của `GET /listings`
 * (`publicListingFrom` cộng `publicListingCondition`, cùng `now` và hạn mức dùng thử), không viết lại luật nào, nên
 * bằng `total` của `GET /listings` không lọc ở cùng thời điểm.
 */
export function publicListingCountQuery(
	now: Date,
	trialListingLimit: number,
): Prisma.Sql {
	return Prisma.sql`
		SELECT count(*)::int AS "total" ${publicListingFrom(now)}
		WHERE ${publicListingCondition(now, trialListingLimit)}`;
}

/**
 * Tin đăng mới theo ngày (spec 0018 AC-9): MỌI tin có `created_at` trong khoảng, mọi trạng thái, kể cả tin đã xóa mềm
 * (không lọc `deleted_at` hay `status`).
 */
export function createdListingsQuery(start: string, end: string): Prisma.Sql {
	return dailyCounts(
		Prisma.sql`SELECT l.created_at AS occurred_at FROM listings l`,
		start,
		end,
	);
}

/**
 * Tin đăng mới theo phường, chỉ kỳ này (spec 0018 AC-9): tin (mọi trạng thái, kể cả xóa mềm) có `created_at` trong
 * `[start, end)`, phường lấy qua nhà trọ của tin (`properties.ward_code`), tên là `wards.name` hiện tại. Mọi phường có
 * số lớn hơn 0, `count` giảm dần rồi `ward_code` tăng dần, không cắt top. Cả hai phép nối đều có khóa ngoại RESTRICT nên
 * tổng `count` luôn bằng số tin mới của kỳ.
 */
export function createdByWardQuery(start: string, end: string): Prisma.Sql {
	return Prisma.sql`
		SELECT p.ward_code AS "wardCode", w.name AS "wardName", count(*)::int AS "count"
		FROM listings l
		JOIN properties p ON p.id = l.property_id
		JOIN wards w ON w.code = p.ward_code
		WHERE l.created_at >= ${start}::timestamptz AND l.created_at < ${end}::timestamptz
		GROUP BY p.ward_code, w.name
		ORDER BY count(*) DESC, p.ward_code ASC`;
}

/**
 * Lượt xem theo ngày của MỌI tin của nền tảng, kể cả tin đang ẩn và đã xóa mềm (spec 0018 AC-10), cho các ngày từ `from`
 * đến `to` tính cả hai đầu. `listing_daily_views.day` đã là ngày lịch giờ Việt Nam (spec 0016) nên so thẳng với hai ngày
 * `YYYY-MM-DD`, không qua múi giờ (AC-13); khóa ngoại RESTRICT nên không cần nối `listings`. `to_char` cho chuỗi ngày
 * không phụ thuộc cấu hình hiển thị ngày của phiên.
 */
export function platformDailyViewsQuery(from: string, to: string): Prisma.Sql {
	return Prisma.sql`
		SELECT to_char(v.day, 'YYYY-MM-DD') AS "day", SUM(v.views)::bigint AS "count"
		FROM listing_daily_views v
		WHERE v.day >= ${from}::date AND v.day <= ${to}::date
		GROUP BY v.day
		ORDER BY v.day`;
}

/**
 * Sáu nguồn tương tác của cả nền tảng (spec 0018 AC-10). Tên khóa cũng là tên khóa của Metric trong `engagement` (trừ
 * `views`, đọc từ `listing_daily_views`), nên Service ghép khóa với Metric không cần bảng dịch.
 */
export type EngagementSource =
	| 'conversations'
	| 'messages'
	| 'landlordReviews'
	| 'roomReviews'
	| 'follows'
	| 'favorites';

/**
 * Mỗi nguồn là MỌI dòng đang tồn tại của bảng, không lọc gì (spec 0018 AC-10): đánh giá bị admin ẩn, lượt theo dõi của
 * tài khoản bị khóa, tin nhắn của cuộc trò chuyện về tin đã xóa mềm đều vẫn tính; không nối bảng nào nên không có luật
 * công khai nào lọt vào. Đây là chỗ KHÁC màn hình chủ trọ (spec 0017 chỉ đếm người theo dõi `active` và đánh giá
 * `visible`). Tên bảng nằm cứng ở đây chứ không phải tham số: chỉ khóa của kiểu `EngagementSource` chọn được câu.
 */
const ENGAGEMENT_SOURCES: Record<EngagementSource, Prisma.Sql> = {
	conversations: Prisma.sql`SELECT c.created_at AS occurred_at FROM conversations c`,
	messages: Prisma.sql`SELECT m.created_at AS occurred_at FROM messages m`,
	landlordReviews: Prisma.sql`SELECT r.created_at AS occurred_at FROM reviews r`,
	roomReviews: Prisma.sql`SELECT lr.created_at AS occurred_at FROM listing_reviews lr`,
	follows: Prisma.sql`SELECT f.created_at AS occurred_at FROM follows f`,
	favorites: Prisma.sql`SELECT fv.created_at AS occurred_at FROM favorites fv`,
};

/** Một nguồn tương tác theo ngày cho `[start, end)` (spec 0018 AC-10, AC-12, AC-13), cùng khung `dailyCounts` với đăng ký và tin mới. */
export function engagementQuery(
	source: EngagementSource,
	start: string,
	end: string,
): Prisma.Sql {
	return dailyCounts(ENGAGEMENT_SOURCES[source], start, end);
}

/**
 * Hai đánh giá đang bị admin ẩn tại lúc đọc, trong MỘT câu (spec 0018 AC-11). Không lọc gì ngoài `status`, nên mỗi số
 * bằng `total` của `GET /moderation/reviews` và `GET /moderation/listing-reviews` khi lọc `status=hidden_by_admin` (hai
 * danh sách đó cũng không áp luật công khai). Số tin đang bị admin ẩn KHÔNG đếm ở đây: lấy từ `hiddenByAdmin` của
 * `listingStatusCountsQuery` để `toHandle.hiddenListings` luôn bằng `listings.hiddenByAdmin`, cùng một lần đọc.
 */
export function hiddenReviewCountsQuery(): Prisma.Sql {
	return Prisma.sql`
		SELECT
			(SELECT count(*)::int FROM reviews r WHERE r.status = 'hidden_by_admin') AS "hiddenLandlordReviews",
			(SELECT count(*)::int FROM listing_reviews lr WHERE lr.status = 'hidden_by_admin') AS "hiddenRoomReviews"`;
}

/** Một ô của bảng đếm tài khoản: loại, trạng thái và số tài khoản chưa xóa mềm. */
export interface AccountCountRow {
	readonly accountType: string;
	readonly status: string;
	readonly count: number;
}

/** Ba nhóm chủ trọ tại lúc đọc (spec 0018 AC-6). */
export interface LandlordGroupCounts {
	readonly total: number;
	readonly onPlan: number;
	readonly onTrial: number;
	readonly trialExpired: number;
}

/** Tin chưa xóa mềm theo ba trạng thái (spec 0018 AC-7). */
export interface ListingStatusCounts {
	readonly visible: number;
	readonly hiddenByOwner: number;
	readonly hiddenByAdmin: number;
}

/** Số tin mới của một phường trong kỳ (spec 0018 AC-9). */
export interface WardCountRow {
	readonly wardCode: string;
	readonly wardName: string;
	readonly count: number;
}

/** Hai đánh giá đang bị admin ẩn tại lúc đọc (spec 0018 AC-11). */
export interface HiddenReviewCounts {
	readonly hiddenLandlordReviews: number;
	readonly hiddenRoomReviews: number;
}

/**
 * Chỉ ĐỌC, cho màn hình thống kê tổng quan của admin (spec 0018). Như `StatisticsRepository` (spec 0017), đây là ngoại lệ
 * có chủ ý của quy ước "mỗi bảng một Repository": một màn hình cần số của nhiều bảng cùng lúc. Không bao giờ ghi, không
 * khóa dòng, không đổi `updated_at`. Khác Repository của chủ trọ ở chỗ KHÔNG lọc theo người: đây là số của cả nền tảng,
 * nên chỉ được gọi từ route chỉ admin có `@FreshAuth()`. Không truy vấn nào của `StatisticsRepository` được dùng lại với
 * bộ lọc bỏ trống.
 */
@Injectable()
export class AdminOverviewRepository {
	constructor(private readonly prisma: PrismaService) {}

	async countAccounts(): Promise<AccountCountRow[]> {
		return this.prisma.$queryRaw<AccountCountRow[]>(accountCountsQuery());
	}

	/** Đăng ký mới theo ngày cho `[start, end)` của một loại tài khoản (cả hai kỳ). */
	async findRegistrations(
		accountType: RegisteredAccountType,
		start: string,
		end: string,
	): Promise<DailyCountRow[]> {
		return toDailyCountRows(
			await this.prisma.$queryRaw<{ day: string; count: bigint }[]>(
				registrationsQuery(accountType, start, end),
			),
		);
	}

	async countLandlordGroups(now: Date): Promise<LandlordGroupCounts> {
		const rows = await this.prisma.$queryRaw<LandlordGroupCounts[]>(
			landlordGroupsQuery(now),
		);
		return rows[0] ?? { total: 0, onPlan: 0, onTrial: 0, trialExpired: 0 };
	}

	async countListingsByStatus(): Promise<ListingStatusCounts> {
		const rows = await this.prisma.$queryRaw<ListingStatusCounts[]>(
			listingStatusCountsQuery(),
		);
		return rows[0] ?? { visible: 0, hiddenByOwner: 0, hiddenByAdmin: 0 };
	}

	async countPublicListings(
		now: Date,
		trialListingLimit: number,
	): Promise<number> {
		const rows = await this.prisma.$queryRaw<{ total: number }[]>(
			publicListingCountQuery(now, trialListingLimit),
		);
		return rows[0]?.total ?? 0;
	}

	/** Tin đăng mới theo ngày cho `[start, end)` (cả hai kỳ). */
	async findCreatedListings(
		start: string,
		end: string,
	): Promise<DailyCountRow[]> {
		return toDailyCountRows(
			await this.prisma.$queryRaw<{ day: string; count: bigint }[]>(
				createdListingsQuery(start, end),
			),
		);
	}

	/** Tin đăng mới theo phường, chỉ kỳ này: `start` và `end` là hai cận của riêng kỳ này. */
	async findCreatedByWard(
		start: string,
		end: string,
	): Promise<WardCountRow[]> {
		return this.prisma.$queryRaw<WardCountRow[]>(
			createdByWardQuery(start, end),
		);
	}

	/** Lượt xem theo ngày của mọi tin cho `[from, to]`; ngày không có lượt nào không có dòng (Service điền 0). */
	async findDailyViews(from: string, to: string): Promise<DailyCountRow[]> {
		return toDailyCountRows(
			await this.prisma.$queryRaw<{ day: string; count: bigint }[]>(
				platformDailyViewsQuery(from, to),
			),
		);
	}

	/** Một nguồn tương tác theo ngày cho `[start, end)` (cả hai kỳ); ngày không có dòng nào không có hàng. */
	async findEngagement(
		source: EngagementSource,
		start: string,
		end: string,
	): Promise<DailyCountRow[]> {
		return toDailyCountRows(
			await this.prisma.$queryRaw<{ day: string; count: bigint }[]>(
				engagementQuery(source, start, end),
			),
		);
	}

	/** Hai đánh giá đang bị admin ẩn; luôn đúng một dòng nên không có dòng nào chỉ xảy ra với mock. */
	async countHiddenReviews(): Promise<HiddenReviewCounts> {
		const rows = await this.prisma.$queryRaw<HiddenReviewCounts[]>(
			hiddenReviewCountsQuery(),
		);
		return rows[0] ?? { hiddenLandlordReviews: 0, hiddenRoomReviews: 0 };
	}
}
