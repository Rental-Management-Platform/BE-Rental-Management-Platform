import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { escapeLike } from '../common/text/escape-like';
import { ListingCodeTakenError } from './listing-code';
import type { ListingSort, ListingStatus } from './listing-status';

/** Xóa mềm (spec 0005): mọi phương thức đọc `listings` đều thêm điều kiện này, trừ tên có `IncludingDeleted`. */
const notDeleted = { deletedAt: null } satisfies Prisma.ListingWhereInput;

/** Ảnh bìa của tin tóm tắt là ảnh có `position` nhỏ nhất. */
const coverImage = {
	orderBy: { position: 'asc' },
	take: 1,
} satisfies Prisma.Listing$imagesArgs;

const allImages = {
	orderBy: { position: 'asc' },
} satisfies Prisma.Listing$imagesArgs;

/** Phần nhà trọ của chi tiết: phường (kèm tỉnh), phí và tiện ích (kèm tên). */
const propertyDetail = {
	ward: true,
	fees: true,
	amenities: { include: { amenity: true } },
} satisfies Prisma.PropertyInclude;

const publicSummaryInclude = {
	property: {
		include: {
			ward: true,
			landlord: { select: { id: true, name: true } },
		},
	},
	images: coverImage,
} satisfies Prisma.ListingInclude;

const ownerSummaryInclude = {
	property: { include: { ward: true } },
	images: coverImage,
} satisfies Prisma.ListingInclude;

const publicDetailInclude = {
	property: {
		include: {
			...propertyDetail,
			landlord: { select: { id: true, name: true, phone: true } },
		},
	},
	images: allImages,
} satisfies Prisma.ListingInclude;

const ownerDetailInclude = {
	property: { include: propertyDetail },
	images: allImages,
} satisfies Prisma.ListingInclude;

export type PublicSummaryRow = Prisma.ListingGetPayload<{
	include: typeof publicSummaryInclude;
}>;
export type OwnerSummaryRow = Prisma.ListingGetPayload<{
	include: typeof ownerSummaryInclude;
}>;
export type PublicDetailRow = Prisma.ListingGetPayload<{
	include: typeof publicDetailInclude;
}>;
export type OwnerDetailRow = Prisma.ListingGetPayload<{
	include: typeof ownerDetailInclude;
}>;

/** Một tin trong danh sách đã lưu: hàng đọc của danh sách công khai cộng lúc người gọi lưu tin (spec 0006). */
export interface SavedListingRow {
	readonly row: PublicSummaryRow;
	readonly favoritedAt: Date;
}

export interface NewListing {
	readonly propertyId: string;
	readonly code: string;
	readonly title: string;
	readonly description: string;
	readonly price: number;
	readonly areaM2: number;
	readonly deposit: number | null;
	readonly availableFrom: Date | null;
	readonly searchKey: string;
}

/** Các cột của tin có thể đổi qua PATCH; cột nào vắng thì giữ nguyên. `searchKey` đi cùng `title`. */
export interface ListingChanges {
	title?: string;
	description?: string;
	price?: number;
	areaM2?: number;
	deposit?: number | null;
	availableFrom?: Date | null;
	searchKey?: string;
}

/**
 * Bộ lọc của danh sách công khai; `searchWords` đã qua `toSearchKey` và đã cắt gọn. `landlordId` chỉ do danh sách tin
 * trên hồ sơ chủ trọ đặt (spec 0009); `GET /listings` không đặt nên không đổi.
 */
export interface PublicListFilter {
	readonly searchWords: readonly string[];
	readonly landlordId?: string;
	readonly wardCode?: string;
	readonly minPrice?: number;
	readonly maxPrice?: number;
	readonly sort: ListingSort;
}

/** Bộ lọc danh sách kiểm duyệt của admin; `searchWords` đã qua `toSearchKey` và đã cắt gọn. */
export interface ModerationFilter {
	readonly status?: ListingStatus;
	readonly landlordId?: string;
	readonly searchWords: readonly string[];
}

/**
 * Hai giá trị mà luật hiển thị công khai cần ngoài chính các cột (spec 0003): đồng hồ ứng dụng lấy một lần mỗi
 * request, và hạn mức dùng thử đọc một lần mỗi request từ `settings`.
 */
export interface PublicVisibility {
	readonly now: Date;
	readonly trialListingLimit: number;
}

/**
 * Phép nối mà `publicListingCondition` và mọi bộ lọc công khai giả định: `l` tin, `p` nhà trọ, `u` chủ trọ và
 * `plan` là kỳ gói đang chạy của chủ trọ (spec 0004 AC-9): `starts_at` tính, `ends_at` không tính, nên đúng lúc
 * `ends_at` là hết. Ràng buộc loại trừ ở DB bảo đảm tối đa một kỳ nên `LIMIT 1` chỉ là dây an toàn; không có kỳ thì
 * `plan.max_listings` là `NULL`. Luôn đi cùng `publicListingCondition` với cùng `now`.
 */
export function publicListingFrom(now: Date): Prisma.Sql {
	return Prisma.sql`FROM listings l
	JOIN properties p ON p.id = l.property_id
	JOIN users u ON u.id = p.landlord_id
	LEFT JOIN LATERAL (
		SELECT o.max_listings FROM subscriptions s
		JOIN orders o ON o.id = s.order_id
		WHERE s.user_id = u.id AND tstzrange(s.starts_at, s.ends_at) @> ${now.toISOString()}::timestamptz
		LIMIT 1
	) plan ON true`;
}

/**
 * Điều kiện để một tin hiện ra công khai, viết đúng một lần cho mọi đường đọc công khai (spec 0003, "Điều kiện
 * hiển thị công khai"; spec 0004 AC-9 thêm gói). Tính lúc đọc từ chính các cột, không cờ sao chép, nên khóa tài
 * khoản, xóa mềm, hết gói, hết dùng thử hay hạ hạn mức có hiệu lực ngay:
 * - tin `visible` chưa xóa mềm, nhà trọ chưa xóa mềm, chủ trọ `active` chưa xóa mềm;
 * - hạn mức hiệu lực của chủ trọ: `max_listings` của kỳ gói đang chạy nếu có, không thì `trialListingLimit` khi
 *   `trial_ends_at` lớn hơn `now` (so chặt, giống `MembershipsService.resolve`), không thì 0;
 * - hạng của tin nhỏ hơn hạn mức hiệu lực: hạng = số tin `visible` chưa xóa của cùng chủ trọ có
 *   `(created_at, id)` nhỏ hơn, nên chỉ N tin đăng sớm nhất qua. Hạn mức 0 thì không tin nào qua.
 * Bọc trong ngoặc để ghép bằng `AND` với bộ lọc dù sau này có `OR`. Cần phép nối của `publicListingFrom`.
 *
 * `now` đi vào dưới dạng chuỗi ISO có `Z` rồi mới ép `timestamptz`: tham số `Date` của Prisma được gửi như giờ
 * UTC không kèm múi giờ, nên `$1::timestamptz` sẽ bị hiểu theo múi giờ của phiên và lệch (đã kiểm với phiên
 * `Asia/Ho_Chi_Minh` và `America/Los_Angeles`). Dùng chuỗi có `Z` thì kết quả không phụ thuộc cấu hình phiên.
 */
export function publicListingCondition(
	now: Date,
	trialListingLimit: number,
): Prisma.Sql {
	return Prisma.sql`(
		l.status = 'visible' AND l.deleted_at IS NULL
		AND p.deleted_at IS NULL
		AND u.status = 'active' AND u.deleted_at IS NULL
		AND (
			SELECT count(*) FROM listings l2
			JOIN properties p2 ON p2.id = l2.property_id
			WHERE p2.landlord_id = u.id AND l2.status = 'visible' AND l2.deleted_at IS NULL
				AND (l2.created_at, l2.id) < (l.created_at, l.id)
		) < COALESCE(
			plan.max_listings,
			CASE WHEN u.trial_ends_at > ${now.toISOString()}::timestamptz THEN ${trialListingLimit}::int ELSE 0 END
		)
	)`;
}

/**
 * Bộ lọc `q`, `wardCode`, `minPrice`, `maxPrice` của spec 0002 dưới dạng mảnh SQL (cùng nghĩa với bản Prisma cũ),
 * cộng điều kiện chủ trọ của spec 0009 khi có.
 */
function filterConditions(filter: PublicListFilter): Prisma.Sql[] {
	const conditions = filter.searchWords.map(
		(word) => Prisma.sql`l.search_key LIKE ${`%${escapeLike(word)}%`}`,
	);
	if (filter.landlordId !== undefined) {
		conditions.push(Prisma.sql`p.landlord_id = ${filter.landlordId}::uuid`);
	}
	if (filter.wardCode !== undefined) {
		conditions.push(Prisma.sql`p.ward_code = ${filter.wardCode}`);
	}
	if (filter.minPrice !== undefined) {
		conditions.push(Prisma.sql`l.price >= ${filter.minPrice}`);
	}
	if (filter.maxPrice !== undefined) {
		conditions.push(Prisma.sql`l.price <= ${filter.maxPrice}`);
	}
	return conditions;
}

const ORDER_BY: Record<ListingSort, Prisma.Sql> = {
	newest: Prisma.sql`l.created_at DESC, l.id DESC`,
	// Khóa phụ của hai kiểu giá chỉ là `id` (không phải `created_at`) để khớp đúng chỉ mục một phần (price, id).
	price_asc: Prisma.sql`l.price ASC, l.id ASC`,
	price_desc: Prisma.sql`l.price DESC, l.id DESC`,
};

/**
 * Nơi duy nhất của module tin chạm bảng `listings` (spec 0002, spec 0005). Điều kiện hiển thị công khai
 * viết đúng một lần ở `publicListingCondition`; mọi truy vấn công khai đều đi qua nó.
 */
@Injectable()
export class ListingsRepository {
	constructor(private readonly prisma: PrismaService) {}

	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	/**
	 * Chèn tin mới (trạng thái `visible`, `view_count` 0 theo mặc định của cột). Trùng `code` thì ném
	 * `ListingCodeTakenError` (Prisma `P2002`; `code` là cột duy nhất người dùng không đặt, nên đây chỉ có thể là
	 * trùng mã) để Service sinh mã khác và thử lại bằng một giao dịch mới.
	 */
	async create(
		input: NewListing,
		tx: Prisma.TransactionClient,
	): Promise<string> {
		try {
			const { id } = await tx.listing.create({
				data: { ...input },
				select: { id: true },
			});
			return id;
		} catch (error: unknown) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				throw new ListingCodeTakenError({ cause: error });
			}
			throw error;
		}
	}

	// ----- đọc công khai -----

	/**
	 * Một trang tin công khai thỏa bộ lọc, kèm tổng số cùng điều kiện (spec 0003, đọc hai bước vì Prisma không
	 * diễn đạt được phép xếp hạng). Bước một: hai câu SQL thô chạy song song (không giao dịch), lấy `id` của trang
	 * theo đúng thứ tự và đếm tổng bằng cùng mảnh điều kiện. Bước hai: Prisma lấy dữ liệu theo `id` rồi xếp lại
	 * đúng thứ tự của bước một.
	 */
	async findPublicPage(
		filter: PublicListFilter,
		visibility: PublicVisibility,
		skip: number,
		take: number,
	): Promise<{ rows: PublicSummaryRow[]; total: number }> {
		const where = Prisma.join(
			[
				publicListingCondition(
					visibility.now,
					visibility.trialListingLimit,
				),
				...filterConditions(filter),
			],
			' AND ',
		);
		const from = publicListingFrom(visibility.now);
		const [pageRows, countRows] = await Promise.all([
			this.prisma.$queryRaw<{ id: string }[]>`
				SELECT l.id ${from}
				WHERE ${where}
				ORDER BY ${ORDER_BY[filter.sort]}
				LIMIT ${take} OFFSET ${skip}`,
			this.prisma.$queryRaw<{ total: number }[]>`
				SELECT count(*)::int AS total ${from}
				WHERE ${where}`,
		]);
		const total = countRows[0]?.total ?? 0;
		const ids = pageRows.map((row) => row.id);
		if (ids.length === 0) return { rows: [], total };

		const found = await this.prisma.listing.findMany({
			where: { id: { in: ids } },
			include: publicSummaryInclude,
		});
		const byId = new Map(found.map((row) => [row.id, row]));
		// Tin bị xóa giữa hai bước thì không còn trong `byId`: bỏ qua, trang ngắn hơn một dòng là chấp nhận được.
		return { rows: ids.flatMap((id) => byId.get(id) ?? []), total };
	}

	/**
	 * Tin công khai theo mã ngắn, hoặc `null` nếu không có hay không hiển thị công khai (vì bất cứ lý do gì,
	 * kể cả chủ trọ hết dùng thử hay tin bị ẩn bớt vì vượt hạn mức). Cũng đọc hai bước như `findPublicPage`.
	 */
	async findPublicByCode(
		code: string,
		visibility: PublicVisibility,
	): Promise<PublicDetailRow | null> {
		const matched = await this.prisma.$queryRaw<{ id: string }[]>`
			SELECT l.id ${publicListingFrom(visibility.now)}
			WHERE l.code = ${code}
				AND ${publicListingCondition(visibility.now, visibility.trialListingLimit)}
			LIMIT 1`;
		const id = matched[0]?.id;
		if (id === undefined) return null;
		return this.prisma.listing.findFirst({
			where: { id, ...notDeleted },
			include: publicDetailInclude,
		});
	}

	/**
	 * Tin có đang hiện công khai không, theo đúng điều kiện của danh sách và chi tiết (`publicListingFrom` cộng
	 * `publicListingCondition`, cùng `now` và hạn mức dùng thử). Route phục vụ ảnh dùng nó để ảnh của tin bị ẩn,
	 * bị khóa hay hết hạn mức cũng biến khỏi công khai (spec 0002 AC-8, "Ảnh của tin không hiển thị").
	 */
	async isPubliclyVisible(
		id: string,
		visibility: PublicVisibility,
	): Promise<boolean> {
		const rows = await this.prisma.$queryRaw<{ id: string }[]>`
			SELECT l.id ${publicListingFrom(visibility.now)}
			WHERE l.id = ${id}::uuid
				AND ${publicListingCondition(visibility.now, visibility.trialListingLimit)}
			LIMIT 1`;
		return rows.length === 1;
	}

	/**
	 * Một trang tin đã lưu của `userId`, mới lưu trước, kèm tổng số (spec 0006 AC-4, AC-5). Đọc hai bước như
	 * `findPublicPage`. Bước một: hai câu SQL thô chạy song song, dùng đúng `publicListingFrom` và
	 * `publicListingCondition` (cùng `now` và hạn mức dùng thử) rồi nối thêm `favorites` của người gọi, nên một tin
	 * nằm trong kết quả khi và chỉ khi khách mở được nó ở chi tiết công khai; tin không còn hiện biến khỏi trang và
	 * `total` mà dòng `favorites` vẫn nguyên. Thứ tự `favorites.created_at` giảm dần, rồi `listing_id` giảm dần (khớp
	 * chỉ mục `favorites_user_id_created_at_idx`). Bước hai: Prisma lấy dữ liệu tin theo `id` rồi xếp lại thứ tự.
	 */
	async findFavoritePage(
		userId: string,
		visibility: PublicVisibility,
		skip: number,
		take: number,
	): Promise<{ rows: SavedListingRow[]; total: number }> {
		const from = Prisma.sql`${publicListingFrom(visibility.now)}
			JOIN favorites f ON f.listing_id = l.id AND f.user_id = ${userId}::uuid`;
		const where = publicListingCondition(
			visibility.now,
			visibility.trialListingLimit,
		);
		const [pageRows, countRows] = await Promise.all([
			this.prisma.$queryRaw<{ id: string; favorited_at: Date }[]>`
				SELECT l.id, f.created_at AS favorited_at ${from}
				WHERE ${where}
				ORDER BY f.created_at DESC, f.listing_id DESC
				LIMIT ${take} OFFSET ${skip}`,
			this.prisma.$queryRaw<{ total: number }[]>`
				SELECT count(*)::int AS total ${from}
				WHERE ${where}`,
		]);
		const total = countRows[0]?.total ?? 0;
		if (pageRows.length === 0) return { rows: [], total };

		const found = await this.prisma.listing.findMany({
			where: { id: { in: pageRows.map((row) => row.id) } },
			include: publicSummaryInclude,
		});
		const byId = new Map(found.map((row) => [row.id, row]));
		// Tin bị xóa giữa hai bước thì không còn trong `byId`: bỏ qua, trang ngắn hơn một dòng là chấp nhận được.
		return {
			rows: pageRows.flatMap((page) => {
				const row = byId.get(page.id);
				return row === undefined
					? []
					: [{ row, favoritedAt: page.favorited_at }];
			}),
			total,
		};
	}

	// ----- số liệu theo chủ trọ (hồ sơ công khai, spec 0005) -----

	/**
	 * Tổng `view_count` của mọi tin thuộc mọi nhà trọ của chủ trọ, KHÔNG lọc trạng thái hay xóa mềm (spec 0005
	 * AC-4): ẩn hay xóa tin không làm số này giảm. `SUM` của cột int trả `bigint`, đổi sang số của JavaScript ở đây;
	 * chủ trọ chưa có tin thì 0.
	 */
	async sumViewCountByLandlord(landlordId: string): Promise<number> {
		const rows = await this.prisma.$queryRaw<{ total: bigint }[]>`
			SELECT COALESCE(SUM(l.view_count), 0)::bigint AS total
			FROM listings l
			JOIN properties p ON p.id = l.property_id
			WHERE p.landlord_id = ${landlordId}::uuid`;
		return Number(rows[0]?.total ?? 0);
	}

	/**
	 * Số tin của chủ trọ đang hiện công khai ngay lúc đọc (spec 0005 AC-5): đúng hai mảnh SQL của danh sách và chi
	 * tiết (`publicListingFrom` cộng `publicListingCondition`, cùng `now` và hạn mức dùng thử), nên luôn bằng số tin
	 * của chủ trọ đó mà `GET /listings` trả cộng mọi trang. Chủ trọ hết dùng thử và hết gói thì 0.
	 */
	async countPublicByLandlord(
		landlordId: string,
		visibility: PublicVisibility,
	): Promise<number> {
		const rows = await this.prisma.$queryRaw<{ total: number }[]>`
			SELECT count(*)::int AS total ${publicListingFrom(visibility.now)}
			WHERE p.landlord_id = ${landlordId}::uuid
				AND ${publicListingCondition(visibility.now, visibility.trialListingLimit)}`;
		return rows[0]?.total ?? 0;
	}

	/**
	 * Cộng một lượt xem bằng một câu `UPDATE` nguyên tử (spec 0002 AC-13) và trả số lượt sau khi cộng, hoặc
	 * `null` nếu tin không còn `visible` (đã bị ẩn hay xóa ngay giữa lúc đọc và lúc cộng: không cộng).
	 */
	async incrementViewCount(id: string): Promise<number | null> {
		const rows = await this.prisma.$queryRaw<{ view_count: number }[]>`
      UPDATE listings
      SET view_count = view_count + 1
      WHERE id = ${id}::uuid AND status = 'visible' AND deleted_at IS NULL
      RETURNING view_count`;
		return rows[0]?.view_count ?? null;
	}

	// ----- đọc của chủ trọ -----

	/** Chủ của tin chưa xóa mềm (qua nhà trọ) và trạng thái hiện tại: đủ để kiểm chủ sở hữu trước khi ghi. */
	findOwnership(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<{
		id: string;
		propertyId: string;
		status: string;
		property: { landlordId: string };
	} | null> {
		return this.client(tx).listing.findFirst({
			where: { id, ...notDeleted },
			select: {
				id: true,
				propertyId: true,
				status: true,
				property: { select: { landlordId: true } },
			},
		});
	}

	/** Trạng thái hiện tại của tin chưa xóa mềm, hoặc `null` nếu không có hay đã xóa. */
	async findStatus(id: string): Promise<string | null> {
		const row = await this.prisma.listing.findFirst({
			where: { id, ...notDeleted },
			select: { status: true },
		});
		return row?.status ?? null;
	}

	/** Chi tiết tin chưa xóa mềm cho chủ trọ, mọi trạng thái. Đọc ngoài giao dịch (nhiều quan hệ). */
	findOwnerDetail(id: string): Promise<OwnerDetailRow | null> {
		return this.prisma.listing.findFirst({
			where: { id, ...notDeleted },
			include: ownerDetailInclude,
		});
	}

	/** Tin chưa xóa mềm của một chủ trọ, mọi trạng thái, mới nhất trước; `status` lọc nếu có. */
	async findOwnedPage(
		landlordId: string,
		status: ListingStatus | undefined,
		skip: number,
		take: number,
	): Promise<{ rows: OwnerSummaryRow[]; total: number }> {
		const where: Prisma.ListingWhereInput = {
			...notDeleted,
			property: { landlordId },
			...(status === undefined ? {} : { status }),
		};
		const [rows, total] = await Promise.all([
			this.prisma.listing.findMany({
				where,
				include: ownerSummaryInclude,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
			}),
			this.prisma.listing.count({ where }),
		]);
		return { rows, total };
	}

	// ----- đọc của admin (kiểm duyệt) -----

	/**
	 * Một trang tin cho admin tìm và kiểm duyệt (spec 0002 AC-9): mọi trạng thái, kể cả tin đang ẩn, bỏ tin đã xóa
	 * mềm, mới nhất trước. Từ khóa là các điều kiện `contains` nối bằng AND, mỗi từ đã tự thoát `%`, `_`, `\` bằng
	 * `escapeLike` (Prisma không tự thoát). Không áp luật hiển thị công khai: admin phải thấy cả tin bị ẩn vì hết gói.
	 */
	async findModerationPage(
		filter: ModerationFilter,
		skip: number,
		take: number,
	): Promise<{ rows: PublicSummaryRow[]; total: number }> {
		const where: Prisma.ListingWhereInput = {
			...notDeleted,
			...(filter.status === undefined ? {} : { status: filter.status }),
			...(filter.landlordId === undefined
				? {}
				: { property: { landlordId: filter.landlordId } }),
			AND: filter.searchWords.map((word) => ({
				searchKey: { contains: escapeLike(word) },
			})),
		};
		const [rows, total] = await Promise.all([
			this.prisma.listing.findMany({
				where,
				include: publicSummaryInclude,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
			}),
			this.prisma.listing.count({ where }),
		]);
		return { rows, total };
	}

	/** Một mục kiểm duyệt (tin chưa xóa mềm, mọi trạng thái), hoặc `null`. Đọc sau khi giao dịch ẩn hay gỡ ẩn đã xong. */
	findModerationRow(id: string): Promise<PublicSummaryRow | null> {
		return this.prisma.listing.findFirst({
			where: { id, ...notDeleted },
			include: publicSummaryInclude,
		});
	}

	// ----- ghi của chủ trọ -----

	/** Sửa cột của tin chưa xóa mềm. Trả `false` nếu tin không còn (đã xóa mềm ngay giữa chừng). */
	async update(
		id: string,
		changes: ListingChanges,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).listing.updateMany({
			where: { id, ...notDeleted },
			data: { ...changes, updatedAt: new Date() },
		});
		return result.count === 1;
	}

	/** Xóa mềm tin chưa xóa. Trả `false` nếu tin không còn. Ảnh giữ nguyên. */
	async softDelete(id: string): Promise<boolean> {
		const result = await this.prisma.listing.updateMany({
			where: { id, ...notDeleted },
			data: { deletedAt: new Date() },
		});
		return result.count === 1;
	}

	/**
	 * Chuyển trạng thái bằng MỘT câu `updateMany` có điều kiện trạng thái nguồn nằm ngay trong câu lệnh (spec
	 * 0002, "State transitions"), không đọc trạng thái ra trước rồi mới ghi. `false` nghĩa là trạng thái không
	 * còn như dự định (hoặc tin đã xóa): người gọi phân biệt bằng `findStatus`.
	 */
	async transition(
		id: string,
		from: readonly ListingStatus[],
		to: ListingStatus,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).listing.updateMany({
			where: { id, status: { in: [...from] }, ...notDeleted },
			data: { status: to, updatedAt: new Date() },
		});
		return result.count === 1;
	}

	/**
	 * Số tin đang hiện của một chủ trọ (spec 0003 AC-6): `status = 'visible'` và chưa xóa mềm, qua nhà trọ của
	 * họ. Tin đang bị ẩn bớt khỏi công khai vì vượt hạn mức vẫn là `visible` nên vẫn được đếm. Gọi trong giao
	 * dịch đã khóa dòng `users` của chủ trọ để con số này không đổi trước khi người gọi ghi.
	 */
	countVisibleByLandlord(
		landlordId: string,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		return this.client(tx).listing.count({
			where: {
				status: 'visible',
				...notDeleted,
				property: { landlordId },
			},
		});
	}

	/**
	 * Id của N tin `visible` chưa xóa mềm đăng sớm nhất của một chủ trọ, xếp theo `(created_at, id)` tăng dần:
	 * đúng tập mà luật hạng của `publicListingCondition` cho qua khi hạn mức là N (spec 0003 AC-9, AC-11). Một
	 * truy vấn `LIMIT N` cho cả trang `/me/listings`, không phải một truy vấn cho mỗi tin.
	 */
	async findEarliestVisibleIds(
		landlordId: string,
		limit: number,
	): Promise<string[]> {
		const rows = await this.prisma.listing.findMany({
			where: {
				status: 'visible',
				...notDeleted,
				property: { landlordId },
			},
			orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
			take: limit,
			select: { id: true },
		});
		return rows.map((row) => row.id);
	}

	// ----- dùng bởi module nhà trọ (mốc 2) -----

	/** Số tin chưa xóa mềm của một nhà trọ, mọi trạng thái (kể cả đang ẩn). */
	countLiveByProperty(
		propertyId: string,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		return this.client(tx).listing.count({
			where: { propertyId, ...notDeleted },
		});
	}

	/** Id và tiêu đề của mọi tin chưa xóa mềm thuộc nhà trọ: đủ để dựng lại `search_key` của từng tin. */
	findLiveTitlesByProperty(
		propertyId: string,
		tx?: Prisma.TransactionClient,
	): Promise<{ id: string; title: string }[]> {
		return this.client(tx).listing.findMany({
			where: { propertyId, ...notDeleted },
			select: { id: true, title: true },
			orderBy: { id: 'asc' },
		});
	}

	/**
	 * Mọi tin chưa xóa mềm của các nhà trọ thuộc một phường, kèm tên và địa chỉ nhà trọ: đủ để dựng lại `search_key`
	 * khi admin đổi tên phường (spec 0002 AC-2). Tên phường mới do người gọi truyền vào, không đọc lại từ bảng.
	 */
	findLiveForWard(
		wardCode: string,
		tx?: Prisma.TransactionClient,
	): Promise<
		{
			id: string;
			title: string;
			property: { name: string; addressText: string };
		}[]
	> {
		return this.client(tx).listing.findMany({
			where: { ...notDeleted, property: { wardCode } },
			select: {
				id: true,
				title: true,
				property: { select: { name: true, addressText: true } },
			},
			orderBy: { id: 'asc' },
		});
	}

	async setSearchKey(
		id: string,
		searchKey: string,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		await this.client(tx).listing.update({
			where: { id },
			data: { searchKey },
		});
	}
}
