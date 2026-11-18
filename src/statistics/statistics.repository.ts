import { Injectable } from '@nestjs/common';
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

/** Số tin theo trạng thái của một chủ trọ và tổng `view_count`. */
export interface ListingCounts {
	readonly visible: number;
	readonly hiddenByOwner: number;
	readonly hiddenByAdmin: number;
	/** Tổng `view_count` của mọi tin kể cả ẩn và xóa mềm. */
	readonly viewCountAllTime: number;
}

/** Một ngày và số đếm của ngày đó (`YYYY-MM-DD`, ngày lịch giờ Việt Nam). */
export interface DailyCount {
	readonly day: string;
	readonly count: number;
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
}
