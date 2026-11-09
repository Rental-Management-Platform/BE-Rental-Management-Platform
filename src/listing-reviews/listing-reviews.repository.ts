import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type {
	OwnReviewRow,
	ReviewChanges,
	ReviewSummary,
} from '../reviews/reviews.repository';
import type { ReviewStatus } from '../reviews/review-status';

/** Bộ lọc của danh sách admin (spec 0015 AC-11). */
export interface ListingReviewModerationFilter {
	readonly status?: ReviewStatus;
	readonly listingId?: string;
	readonly authorId?: string;
}

const publicSelect = {
	id: true,
	stars: true,
	comment: true,
	authorId: true,
	createdAt: true,
	updatedAt: true,
	author: { select: { name: true } },
} satisfies Prisma.ListingReviewSelect;

/** Người viết chỉ chọn `id` và `name`, tin chỉ `id`, `code`, `title`: không bao giờ đọc email hay số điện thoại. */
const moderationSelect = {
	id: true,
	status: true,
	stars: true,
	comment: true,
	createdAt: true,
	updatedAt: true,
	author: { select: { id: true, name: true } },
	listing: { select: { id: true, code: true, title: true } },
} satisfies Prisma.ListingReviewSelect;

/** Cùng hình dạng với `PublicReviewRow` của đánh giá chủ trọ, nên dùng chung hàm ánh xạ `toPublicReview`. */
export type PublicListingReviewRow = Prisma.ListingReviewGetPayload<{
	select: typeof publicSelect;
}>;

export type ModerationListingReviewRow = Prisma.ListingReviewGetPayload<{
	select: typeof moderationSelect;
}>;

/**
 * Điều kiện của đánh giá phòng hiện công khai, viết MỘT lần cho danh sách, `total` và hai con số của chi tiết tin
 * (spec 0015 AC-1, AC-2): đánh giá của tin này, đang `visible`, mà người viết là tài khoản đang hoạt động (`status =
 * 'active'`, chưa xóa mềm). Nhờ cùng một mảnh điều kiện nên `reviewCount` luôn bằng `total` của danh sách; khóa hay xóa
 * mềm người viết làm đánh giá rời cả hai ngay mà không động đến dòng, mở khóa thì trở lại.
 */
function publicWhere(listingId: string): Prisma.ListingReviewWhereInput {
	return {
		listingId,
		status: 'visible',
		author: { status: 'active', deletedAt: null },
	};
}

/**
 * Nơi duy nhất chạm bảng `listing_reviews` (spec 0015). Việc ghi dùng SQL thô để một câu lệnh làm trọn việc và trả luôn
 * dòng: `INSERT ... ON CONFLICT DO NOTHING RETURNING` và `UPDATE ... RETURNING` có điều kiện trạng thái nguồn nằm trong
 * câu. Điều kiện "chủ trọ đã trả lời" nằm ở `ChatRepository`, tin có hiện công khai và chủ trọ của tin ở
 * `ListingsRepository`. Bảng `reviews` của đánh giá chủ trọ không bao giờ bị đọc hay đếm ở đây.
 */
@Injectable()
export class ListingReviewsRepository {
	constructor(private readonly prisma: PrismaService) {}

	// ----- ghi của người viết -----

	/**
	 * Ghi đánh giá bằng MỘT câu `INSERT ... ON CONFLICT (author_id, listing_id) DO NOTHING RETURNING` (spec 0015 AC-5).
	 * Trả `null` khi cặp đã có đánh giá (không ghi gì); hai lần gọi đồng thời cùng cặp ra đúng một dòng. `id`, `status`
	 * ban đầu `visible`, `created_at` và `updated_at` do DB sinh. `comment` là `null` khi không có nhận xét.
	 */
	async insertIfAbsent(
		authorId: string,
		listingId: string,
		stars: number,
		comment: string | null,
	): Promise<OwnReviewRow | null> {
		const rows = await this.prisma.$queryRaw<OwnReviewRow[]>`
			INSERT INTO listing_reviews (author_id, listing_id, stars, comment)
			VALUES (${authorId}::uuid, ${listingId}::uuid, ${stars}::smallint, ${comment}::text)
			ON CONFLICT (author_id, listing_id) DO NOTHING
			RETURNING id, stars, comment, status,
				created_at AS "createdAt", updated_at AS "updatedAt"`;
		return rows[0] ?? null;
	}

	/**
	 * Sửa đánh giá `visible` của chính người gọi bằng MỘT câu `UPDATE ... WHERE author_id AND listing_id AND status =
	 * 'visible' RETURNING` (spec 0015 AC-6): điều kiện `visible` nằm trong câu nên đánh giá bị ẩn ngay giữa chừng không
	 * bao giờ bị sửa. Chỉ đặt cột có trong `changes`; luôn đặt `updated_at` về giờ hiện tại, kể cả khi gửi lại giá trị
	 * cũ. Trả `null` khi không dòng nào đổi (chưa có đánh giá, hoặc đang bị ẩn): người gọi phân biệt bằng `findOwn`.
	 */
	async updateOwnVisible(
		authorId: string,
		listingId: string,
		changes: ReviewChanges,
	): Promise<OwnReviewRow | null> {
		const assignments = [Prisma.sql`updated_at = clock_timestamp()`];
		if (changes.stars !== undefined) {
			assignments.push(Prisma.sql`stars = ${changes.stars}::smallint`);
		}
		if (changes.comment !== undefined) {
			assignments.push(Prisma.sql`comment = ${changes.comment}::text`);
		}
		const rows = await this.prisma.$queryRaw<OwnReviewRow[]>`
			UPDATE listing_reviews
			SET ${Prisma.join(assignments)}
			WHERE author_id = ${authorId}::uuid
				AND listing_id = ${listingId}::uuid
				AND status = 'visible'
			RETURNING id, stars, comment, status,
				created_at AS "createdAt", updated_at AS "updatedAt"`;
		return rows[0] ?? null;
	}

	/** Xóa hẳn đánh giá của đúng cặp, kể cả đang bị ẩn (spec 0015 AC-7). `false` khi không có dòng nào để xóa. */
	async deleteOwn(authorId: string, listingId: string): Promise<boolean> {
		const result = await this.prisma.listingReview.deleteMany({
			where: { authorId, listingId },
		});
		return result.count === 1;
	}

	// ----- đọc của người viết -----

	/** Đánh giá của người này về tin này, mọi trạng thái, hoặc `null`. Tra theo khóa duy nhất (author_id, listing_id). */
	findOwn(authorId: string, listingId: string): Promise<OwnReviewRow | null> {
		return this.prisma.listingReview.findUnique({
			where: { authorId_listingId: { authorId, listingId } },
			select: {
				id: true,
				stars: true,
				comment: true,
				status: true,
				createdAt: true,
				updatedAt: true,
			},
		});
	}

	// ----- đọc công khai -----

	/**
	 * Một trang đánh giá hiện công khai của một tin, mới viết trước (`created_at` giảm dần, rồi `id` giảm dần), kèm
	 * tổng số (spec 0015 AC-2). Dùng đúng `publicWhere` của hai con số, theo chỉ mục (`listing_id`, `created_at` giảm
	 * dần, `id` giảm dần).
	 */
	async findPublicPage(
		listingId: string,
		skip: number,
		take: number,
	): Promise<{ rows: PublicListingReviewRow[]; total: number }> {
		const where = publicWhere(listingId);
		const [rows, total] = await Promise.all([
			this.prisma.listingReview.findMany({
				where,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
				select: publicSelect,
			}),
			this.prisma.listingReview.count({ where }),
		]);
		return { rows, total };
	}

	/**
	 * Số đánh giá và tổng số sao của tin (spec 0015 AC-1): một truy vấn gộp trên đúng tập dòng của `publicWhere`.
	 * Trung bình không tính ở đây mà ở `averageStars` của `src/reviews/`, bằng số nguyên, để khỏi lệch ở các nửa.
	 */
	async summarize(listingId: string): Promise<ReviewSummary> {
		const result = await this.prisma.listingReview.aggregate({
			where: publicWhere(listingId),
			_count: { _all: true },
			_sum: { stars: true },
		});
		return { count: result._count._all, starSum: result._sum.stars ?? 0 };
	}

	// ----- kiểm duyệt của admin -----

	/**
	 * Một trang đánh giá phòng cho admin (spec 0015 AC-11): mọi trạng thái, mọi người viết (kể cả bị khóa), kể cả của tin
	 * đang ẩn hay đã xóa, mới nhất trước. Lọc theo `status`, `listingId`, `authorId` khi có. Không áp `publicWhere`: admin
	 * phải thấy cả đánh giá đang ẩn. Dùng chung khuôn sắp xếp với danh sách công khai nên theo cùng chỉ mục khi lọc theo tin.
	 */
	async findModerationPage(
		filter: ListingReviewModerationFilter,
		skip: number,
		take: number,
	): Promise<{ rows: ModerationListingReviewRow[]; total: number }> {
		const where: Prisma.ListingReviewWhereInput = {
			...(filter.status === undefined ? {} : { status: filter.status }),
			...(filter.listingId === undefined
				? {}
				: { listingId: filter.listingId }),
			...(filter.authorId === undefined
				? {}
				: { authorId: filter.authorId }),
		};
		const [rows, total] = await Promise.all([
			this.prisma.listingReview.findMany({
				where,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
				select: moderationSelect,
			}),
			this.prisma.listingReview.count({ where }),
		]);
		return { rows, total };
	}

	/** Một mục kiểm duyệt, hoặc `null`. Đọc sau khi giao dịch ẩn hay gỡ ẩn đã xong. */
	findModerationRow(id: string): Promise<ModerationListingReviewRow | null> {
		return this.prisma.listingReview.findUnique({
			where: { id },
			select: moderationSelect,
		});
	}

	/** Trạng thái hiện tại của đánh giá phòng, hoặc `null` nếu không có. */
	async findStatus(id: string): Promise<string | null> {
		const row = await this.prisma.listingReview.findUnique({
			where: { id },
			select: { status: true },
		});
		return row?.status ?? null;
	}

	/**
	 * Chuyển trạng thái bằng MỘT câu `UPDATE` có điều kiện trạng thái nguồn nằm ngay trong câu (spec 0015 AC-12), không
	 * đọc trạng thái ra trước rồi mới ghi. `false` nghĩa là trạng thái không còn như dự định, hoặc đánh giá đã bị xóa:
	 * người gọi phân biệt bằng `findStatus`. Cố ý không đụng `updated_at`: cột đó là lần cuối người viết đổi nội dung,
	 * nên việc ẩn hay gỡ ẩn không làm đánh giá trông như vừa được sửa.
	 */
	async transition(
		id: string,
		from: ReviewStatus,
		to: ReviewStatus,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const changed = await (tx ?? this.prisma).$executeRaw`
			UPDATE listing_reviews SET status = ${to}
			WHERE id = ${id}::uuid AND status = ${from}`;
		return changed === 1;
	}
}
