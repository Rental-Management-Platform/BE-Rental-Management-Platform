import { Injectable } from '@nestjs/common';
import { APP_TIME_ZONE } from '../common/time/app-time-zone';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { ListingStatus } from '../listings/listing-status';

/**
 * Đếm tin của một chủ trọ theo trạng thái cùng tổng `view_count`, trong MỘT câu (spec 0017 AC-4, AC-6). Ba số đếm chỉ
 * tính tin chưa xóa mềm; tổng `view_count` tính cả tin ẩn và xóa mềm, cùng luật với
 * `ListingsRepository.sumViewCountByLandlord` nên bằng `totalViewCount` của `GET /landlords/:id`. Không `GROUP BY`
 * nên luôn đúng một dòng, kể cả chủ trọ chưa có tin (mọi số là 0).
 */
export function listingCountsQuery(landlordId: string): Prisma.Sql {
	return Prisma.sql`
		SELECT
			count(*) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'visible')::int AS "visible",
			count(*) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'hidden_by_owner')::int AS "hiddenByOwner",
			count(*) FILTER (WHERE l.deleted_at IS NULL AND l.status = 'hidden_by_admin')::int AS "hiddenByAdmin",
			COALESCE(SUM(l.view_count), 0)::bigint AS "viewCountAllTime"
		FROM listings l
		JOIN properties p ON p.id = l.property_id
		WHERE p.landlord_id = ${landlordId}::uuid`;
}

/**
 * Lượt xem theo ngày của mọi tin của chủ trọ, kể cả tin đang ẩn và đã xóa mềm (spec 0017 AC-6), cho các ngày từ `from`
 * đến `to` tính cả hai đầu. `listing_daily_views.day` đã là ngày lịch giờ Việt Nam (spec 0016) nên so thẳng với hai
 * ngày `YYYY-MM-DD`, không qua múi giờ. `to_char` cho chuỗi ngày không phụ thuộc cấu hình hiển thị ngày của phiên.
 */
export function dailyViewsQuery(
	landlordId: string,
	from: string,
	to: string,
): Prisma.Sql {
	return Prisma.sql`
		SELECT to_char(v.day, 'YYYY-MM-DD') AS "day", SUM(v.views)::bigint AS "count"
		FROM listing_daily_views v
		JOIN listings l ON l.id = v.listing_id
		JOIN properties p ON p.id = l.property_id
		WHERE p.landlord_id = ${landlordId}::uuid
			AND v.day >= ${from}::date AND v.day <= ${to}::date
		GROUP BY v.day
		ORDER BY v.day`;
}

/**
 * Top tin xem nhiều trong `[from, to]` (spec 0017 AC-7): tin CHƯA xóa mềm của chủ trọ có tổng lượt trong khoảng lớn
 * hơn 0, sắp lượt giảm dần, rồi `created_at` giảm dần, rồi `id` giảm dần. `isPublic` cùng nghĩa với `GET /me/listings`:
 * tin `visible` và hạng đăng sớm nhỏ hơn hạn mức, hạng là số tin `visible` chưa xóa của cùng chủ trọ có
 * `(created_at, id)` nhỏ hơn (cùng luật hạng của `publicListingCondition`). `GROUP BY l.id` (khóa chính) cho phép chọn
 * các cột khác của tin.
 */
export function topListingsQuery(
	landlordId: string,
	from: string,
	to: string,
	listingLimit: number,
	limit: number,
): Prisma.Sql {
	return Prisma.sql`
		SELECT l.id::text AS "id", l.code AS "code", l.title AS "title", l.status AS "status",
			l.view_count AS "viewsAllTime", SUM(v.views)::bigint AS "viewsInRange",
			(
				l.status = 'visible' AND (
					SELECT count(*) FROM listings l2
					JOIN properties p2 ON p2.id = l2.property_id
					WHERE p2.landlord_id = ${landlordId}::uuid AND l2.status = 'visible' AND l2.deleted_at IS NULL
						AND (l2.created_at, l2.id) < (l.created_at, l.id)
				) < ${listingLimit}::int
			) AS "isPublic"
		FROM listing_daily_views v
		JOIN listings l ON l.id = v.listing_id
		JOIN properties p ON p.id = l.property_id
		WHERE p.landlord_id = ${landlordId}::uuid AND l.deleted_at IS NULL
			AND v.day >= ${from}::date AND v.day <= ${to}::date
		GROUP BY l.id
		HAVING SUM(v.views) > 0
		ORDER BY "viewsInRange" DESC, l.created_at DESC, l.id DESC
		LIMIT ${limit}::int`;
}

/**
 * Khung chung của các nguồn "theo ngày cộng một tổng" (spec 0017 AC-8 đến AC-11). `source` là một câu SELECT trả hai cột
 * `occurred_at` (thời điểm của dòng) và `amount` (số cộng vào tổng, `0` nếu nguồn chỉ để đếm). Kết quả MỘT câu SQL:
 * mỗi ngày giờ Việt Nam có dòng trong `[start, end)` một dòng `{ day, count, amount }`, cộng đúng MỘT dòng tổng với
 * `day` là `NULL` tính trên mọi dòng của nguồn, không giới hạn ngày. Một câu cho cả hai nên số theo ngày và số tổng của
 * một nhóm luôn đến từ cùng một ảnh chụp dữ liệu. `AT TIME ZONE` với tên múi giờ là tham số ràng buộc nên không phụ
 * thuộc múi giờ phiên của database; `start` và `end` là chuỗi ISO có `Z` (`toRangeBounds`), `end` so chặt `<`. Ngày không
 * có dòng nào thì không có hàng (Service điền 0). `SUM` ra `numeric` nên ép `bigint`: tiền không bao giờ về `int4`.
 */
function dailyWithTotal(
	source: Prisma.Sql,
	start: string,
	end: string,
): Prisma.Sql {
	return Prisma.sql`
		WITH mine AS (${source})
		SELECT to_char(m.occurred_at AT TIME ZONE ${APP_TIME_ZONE}::text, 'YYYY-MM-DD') AS "day",
			count(*)::bigint AS "count", COALESCE(SUM(m.amount), 0)::bigint AS "amount"
		FROM mine m
		WHERE m.occurred_at >= ${start}::timestamptz AND m.occurred_at < ${end}::timestamptz
		GROUP BY 1
		UNION ALL
		SELECT NULL::text AS "day", count(*)::bigint AS "count", COALESCE(SUM(m.amount), 0)::bigint AS "amount"
		FROM mine m`;
}

/**
 * Lượt lưu trên MỌI tin của chủ trọ (spec 0017 AC-8), kể cả tin đang ẩn và đã xóa mềm (dòng `favorites` giữ nguyên khi
 * tin ẩn hay xóa). `favorites` không có chỉ mục theo `listing_id` nên phép nối quét bảng; đã chốt không thêm chỉ mục.
 */
export function favoritesQuery(
	landlordId: string,
	start: string,
	end: string,
): Prisma.Sql {
	return dailyWithTotal(
		Prisma.sql`
			SELECT f.created_at AS occurred_at, 0::bigint AS amount
			FROM favorites f
			JOIN listings l ON l.id = f.listing_id
			JOIN properties p ON p.id = l.property_id
			WHERE p.landlord_id = ${landlordId}::uuid`,
		start,
		end,
	);
}

/**
 * Người theo dõi chủ trọ (spec 0017 AC-8): chỉ tính người theo dõi là tài khoản `active` chưa xóa mềm, đúng luật của
 * `LandlordsRepository` nên `totalFollowers` bằng `followerCount` của `GET /landlords/:id`.
 */
export function followersQuery(
	landlordId: string,
	start: string,
	end: string,
): Prisma.Sql {
	return dailyWithTotal(
		Prisma.sql`
			SELECT f.created_at AS occurred_at, 0::bigint AS amount
			FROM follows f
			JOIN users u ON u.id = f.user_id
			WHERE f.landlord_id = ${landlordId}::uuid
				AND u.status = 'active' AND u.deleted_at IS NULL`,
		start,
		end,
	);
}

/**
 * Đánh giá của chính chủ trọ (bảng `reviews`, spec 0017 AC-9): `visible` và người viết là tài khoản `active` chưa xóa
 * mềm, đúng luật của danh sách công khai (spec 0014) nên `count` và tổng sao khớp hồ sơ chủ trọ. `amount` là số sao.
 */
export function landlordReviewsQuery(
	landlordId: string,
	start: string,
	end: string,
): Prisma.Sql {
	return dailyWithTotal(
		Prisma.sql`
			SELECT r.created_at AS occurred_at, r.stars::bigint AS amount
			FROM reviews r
			JOIN users u ON u.id = r.author_id
			WHERE r.landlord_id = ${landlordId}::uuid AND r.status = 'visible'
				AND u.status = 'active' AND u.deleted_at IS NULL`,
		start,
		end,
	);
}

/**
 * Đánh giá phòng trên mọi tin chưa xóa mềm của chủ trọ (bảng `listing_reviews`, spec 0017 AC-9), kể cả tin đang ẩn: mỗi
 * đánh giá một phiếu (không phải trung bình các trung bình của từng tin), cùng luật `visible` và người viết `active`
 * của spec 0015. Không cộng vào điểm của chủ trọ.
 */
export function roomReviewsQuery(
	landlordId: string,
	start: string,
	end: string,
): Prisma.Sql {
	return dailyWithTotal(
		Prisma.sql`
			SELECT lr.created_at AS occurred_at, lr.stars::bigint AS amount
			FROM listing_reviews lr
			JOIN listings l ON l.id = lr.listing_id
			JOIN properties p ON p.id = l.property_id
			JOIN users u ON u.id = lr.author_id
			WHERE p.landlord_id = ${landlordId}::uuid AND l.deleted_at IS NULL
				AND lr.status = 'visible' AND u.status = 'active' AND u.deleted_at IS NULL`,
		start,
		end,
	);
}

/**
 * Đơn đã trả của chủ trọ theo `paid_at` (spec 0017 AC-11): chỉ `paid`, không bao giờ `pending` hay `cancelled`; `amount`
 * là `price` đã chốt trên đơn (số nguyên đồng). Gói đã hết hạn vẫn tính phần tiền đã chi.
 */
export function paidOrdersQuery(
	landlordId: string,
	start: string,
	end: string,
): Prisma.Sql {
	return dailyWithTotal(
		Prisma.sql`
			SELECT o.paid_at AS occurred_at, o.price::bigint AS amount
			FROM orders o
			WHERE o.user_id = ${landlordId}::uuid AND o.status = 'paid'`,
		start,
		end,
	);
}

/**
 * Chat theo vai chủ trọ (spec 0017 AC-10): các cuộc trò chuyện có `landlord_id` là chủ trọ. Mỗi ngày giờ Việt Nam của
 * `created_at` trong `[start, end)` một dòng `{ day, opened, replied }`, `replied` chỉ tính cuộc mà chủ trọ đã gửi ít
 * nhất một tin vào bất kỳ lúc nào cho đến lúc đọc. Cộng MỘT dòng tổng với `day` là `NULL`: `opened` là số mọi cuộc,
 * hai số chưa đọc là `last_seq − landlord_read_seq` (cùng công thức của `ChatRepository.countUnread` ở vai chủ trọ).
 */
export function chatQuery(
	landlordId: string,
	start: string,
	end: string,
): Prisma.Sql {
	return Prisma.sql`
		WITH mine AS (
			SELECT c.id, c.created_at, c.last_seq - c.landlord_read_seq AS unread
			FROM conversations c
			WHERE c.landlord_id = ${landlordId}::uuid
		)
		SELECT to_char(m.created_at AT TIME ZONE ${APP_TIME_ZONE}::text, 'YYYY-MM-DD') AS "day",
			count(*)::bigint AS "opened",
			count(*) FILTER (WHERE EXISTS (
				SELECT 1 FROM messages g
				WHERE g.conversation_id = m.id AND g.sender_id = ${landlordId}::uuid
			))::bigint AS "replied",
			0::bigint AS "unreadConversations", 0::bigint AS "unreadMessages"
		FROM mine m
		WHERE m.created_at >= ${start}::timestamptz AND m.created_at < ${end}::timestamptz
		GROUP BY 1
		UNION ALL
		SELECT NULL::text AS "day", count(*)::bigint AS "opened", 0::bigint AS "replied",
			count(*) FILTER (WHERE m.unread > 0)::bigint AS "unreadConversations",
			COALESCE(SUM(m.unread), 0)::bigint AS "unreadMessages"
		FROM mine m`;
}

/** Số tin theo trạng thái của một chủ trọ và tổng `view_count`. */
export interface ListingCounts {
	readonly visible: number;
	readonly hiddenByOwner: number;
	readonly hiddenByAdmin: number;
	/** Tổng `view_count` của mọi tin kể cả ẩn và xóa mềm. */
	readonly viewCountAllTime: number;
}

/** Một ngày và số của ngày đó (số đếm hay tổng tiền; `YYYY-MM-DD`, ngày lịch giờ Việt Nam). */
export interface DailyCount {
	readonly day: string;
	readonly count: number;
}

/**
 * Kết quả của một nguồn "theo ngày cộng một tổng" (`dailyWithTotal`): `counts` là số dòng và `amounts` là tổng `amount`
 * của từng ngày có dòng trong khoảng (cả hai kỳ), `total` và `amountTotal` tính trên mọi dòng của nguồn.
 */
export interface DailyAggregate {
	readonly counts: DailyCount[];
	readonly amounts: DailyCount[];
	readonly total: number;
	readonly amountTotal: number;
}

/** Kết quả của `chatQuery`: số cuộc mở và số cuộc đã trả lời theo ngày, cộng bốn số của hiện tại. */
export interface ChatAggregate {
	readonly opened: DailyCount[];
	readonly replied: DailyCount[];
	readonly total: number;
	readonly unreadConversations: number;
	readonly unreadMessages: number;
}

interface AggregateRaw {
	/** `null` ở đúng một dòng tổng. */
	readonly day: string | null;
	readonly count: bigint | number;
	readonly amount: bigint | number;
}

interface ChatRaw {
	readonly day: string | null;
	readonly opened: bigint | number;
	readonly replied: bigint | number;
	readonly unreadConversations: bigint | number;
	readonly unreadMessages: bigint | number;
}

/** Tách dòng tổng (`day` là `NULL`) khỏi các dòng theo ngày; `bigint` đổi sang `number` bằng `Number()`. */
function toAggregate(rows: readonly AggregateRaw[]): DailyAggregate {
	const counts: DailyCount[] = [];
	const amounts: DailyCount[] = [];
	let total = 0;
	let amountTotal = 0;
	for (const row of rows) {
		if (row.day === null) {
			total = Number(row.count);
			amountTotal = Number(row.amount);
		} else {
			counts.push({ day: row.day, count: Number(row.count) });
			amounts.push({ day: row.day, count: Number(row.amount) });
		}
	}
	return { counts, amounts, total, amountTotal };
}

function toChatAggregate(rows: readonly ChatRaw[]): ChatAggregate {
	const opened: DailyCount[] = [];
	const replied: DailyCount[] = [];
	let total = 0;
	let unreadConversations = 0;
	let unreadMessages = 0;
	for (const row of rows) {
		if (row.day === null) {
			total = Number(row.opened);
			unreadConversations = Number(row.unreadConversations);
			unreadMessages = Number(row.unreadMessages);
		} else {
			opened.push({ day: row.day, count: Number(row.opened) });
			replied.push({ day: row.day, count: Number(row.replied) });
		}
	}
	return { opened, replied, total, unreadConversations, unreadMessages };
}

export interface TopListingRow {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly status: ListingStatus;
	readonly isPublic: boolean;
	readonly viewsInRange: number;
	readonly viewsAllTime: number;
}

interface ListingCountsRaw {
	readonly visible: number;
	readonly hiddenByOwner: number;
	readonly hiddenByAdmin: number;
	readonly viewCountAllTime: bigint | number;
}

interface DailyCountRaw {
	readonly day: string;
	readonly count: bigint | number;
}

interface TopListingRaw {
	readonly id: string;
	readonly code: string;
	readonly title: string;
	readonly status: ListingStatus;
	readonly isPublic: boolean;
	readonly viewsInRange: bigint | number;
	readonly viewsAllTime: number;
}

/**
 * Chỉ ĐỌC, cho màn hình thống kê của chủ trọ (spec 0017). Ngoại lệ có chủ ý của quy ước "mỗi bảng một Repository":
 * Repository này đọc bảng của nhiều module (tin, lượt xem theo ngày, và ở mốc 2 lưu, theo dõi, đánh giá, chat, đơn) vì
 * một màn hình cần mọi số cùng lúc; nó không bao giờ ghi, không khóa dòng, không đổi `updated_at`. Mọi truy vấn lọc theo
 * `landlordId` lấy từ `sub` của token, không có đường nào để thấy số của chủ trọ khác. `SUM` trả `bigint`, đổi sang
 * `number` bằng `Number()` ở đây (an toàn: tổng của một chủ trọ xa dưới 2^53).
 */
@Injectable()
export class StatisticsRepository {
	constructor(private readonly prisma: PrismaService) {}

	async countListings(landlordId: string): Promise<ListingCounts> {
		const rows = await this.prisma.$queryRaw<ListingCountsRaw[]>(
			listingCountsQuery(landlordId),
		);
		const row = rows[0];
		return {
			visible: row?.visible ?? 0,
			hiddenByOwner: row?.hiddenByOwner ?? 0,
			hiddenByAdmin: row?.hiddenByAdmin ?? 0,
			viewCountAllTime: Number(row?.viewCountAllTime ?? 0),
		};
	}

	/** Lượt xem theo ngày cho `[from, to]`; ngày không có lượt nào không có dòng (Service điền 0). */
	async findDailyViews(
		landlordId: string,
		from: string,
		to: string,
	): Promise<DailyCount[]> {
		const rows = await this.prisma.$queryRaw<DailyCountRaw[]>(
			dailyViewsQuery(landlordId, from, to),
		);
		return rows.map((row) => ({ day: row.day, count: Number(row.count) }));
	}

	async findTopListings(
		landlordId: string,
		from: string,
		to: string,
		listingLimit: number,
		limit: number,
	): Promise<TopListingRow[]> {
		const rows = await this.prisma.$queryRaw<TopListingRaw[]>(
			topListingsQuery(landlordId, from, to, listingLimit, limit),
		);
		return rows.map((row) => ({
			id: row.id,
			code: row.code,
			title: row.title,
			status: row.status,
			isPublic: row.isPublic,
			viewsInRange: Number(row.viewsInRange),
			viewsAllTime: row.viewsAllTime,
		}));
	}

	/** Lượt lưu trên mọi tin của chủ trọ: theo ngày (cả hai kỳ) cộng tổng (spec 0017 AC-8). */
	async findFavorites(
		landlordId: string,
		start: string,
		end: string,
	): Promise<DailyAggregate> {
		return toAggregate(
			await this.prisma.$queryRaw<AggregateRaw[]>(
				favoritesQuery(landlordId, start, end),
			),
		);
	}

	/** Người theo dõi `active` của chủ trọ: theo ngày cộng tổng (spec 0017 AC-8). */
	async findFollowers(
		landlordId: string,
		start: string,
		end: string,
	): Promise<DailyAggregate> {
		return toAggregate(
			await this.prisma.$queryRaw<AggregateRaw[]>(
				followersQuery(landlordId, start, end),
			),
		);
	}

	/** Đánh giá của chủ trọ: `counts` theo ngày, `total` và `amountTotal` (tổng sao) hiện tại (spec 0017 AC-9). */
	async findLandlordReviews(
		landlordId: string,
		start: string,
		end: string,
	): Promise<DailyAggregate> {
		return toAggregate(
			await this.prisma.$queryRaw<AggregateRaw[]>(
				landlordReviewsQuery(landlordId, start, end),
			),
		);
	}

	/** Đánh giá phòng trên mọi tin chưa xóa mềm của chủ trọ, cùng hình dạng (spec 0017 AC-9). */
	async findRoomReviews(
		landlordId: string,
		start: string,
		end: string,
	): Promise<DailyAggregate> {
		return toAggregate(
			await this.prisma.$queryRaw<AggregateRaw[]>(
				roomReviewsQuery(landlordId, start, end),
			),
		);
	}

	/** Đơn đã trả: `counts` là số đơn, `amounts` là tiền theo ngày `paid_at`, `amountTotal` là tiền mọi thời (spec 0017 AC-11). */
	async findPaidOrders(
		landlordId: string,
		start: string,
		end: string,
	): Promise<DailyAggregate> {
		return toAggregate(
			await this.prisma.$queryRaw<AggregateRaw[]>(
				paidOrdersQuery(landlordId, start, end),
			),
		);
	}

	/** Chat theo vai chủ trọ: mở và đã trả lời theo ngày, cộng tổng và số chưa đọc (spec 0017 AC-10). */
	async findChat(
		landlordId: string,
		start: string,
		end: string,
	): Promise<ChatAggregate> {
		return toChatAggregate(
			await this.prisma.$queryRaw<ChatRaw[]>(
				chatQuery(landlordId, start, end),
			),
		);
	}
}
