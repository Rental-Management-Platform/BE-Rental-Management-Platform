import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { ReviewStatus } from './review-status';

/** Đánh giá của một người về một chủ trọ, đủ cho `MyReviewResponse`. `status` là chuỗi đọc từ DB (có CHECK). */
export interface OwnReviewRow {
	readonly id: string;
	readonly stars: number;
	readonly comment: string | null;
	readonly status: string;
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/** Phần sửa của `PATCH`: trường `undefined` thì giữ nguyên; `comment: null` đặt về `NULL`. */
export interface ReviewChanges {
	readonly stars?: number;
	readonly comment?: string | null;
}

/** Hai số gộp của hồ sơ (spec 0014 AC-1): số đánh giá và tổng số sao của đúng tập dòng mà danh sách công khai trả. */
export interface ReviewSummary {
	readonly count: number;
	readonly starSum: number;
}

/** Bộ lọc của danh sách admin (spec 0014 AC-11). */
export interface ReviewModerationFilter {
	readonly status?: ReviewStatus;
	readonly landlordId?: string;
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
} satisfies Prisma.ReviewSelect;

/** Người viết chỉ chọn `id` và `name`: không bao giờ đọc email hay số điện thoại. */
const moderationSelect = {
	id: true,
	status: true,
	stars: true,
	comment: true,
	createdAt: true,
	updatedAt: true,
	author: { select: { id: true, name: true } },
	landlord: { select: { id: true, name: true } },
} satisfies Prisma.ReviewSelect;

export type PublicReviewRow = Prisma.ReviewGetPayload<{
	select: typeof publicSelect;
}>;

export type ModerationReviewRow = Prisma.ReviewGetPayload<{
	select: typeof moderationSelect;
}>;

/**
 * Điều kiện của đánh giá hiện công khai, viết MỘT lần cho danh sách, `total` và hai con số của hồ sơ (spec 0014 AC-1,
 * AC-2): đánh giá của chủ trọ này, đang `visible`, mà người viết là tài khoản đang hoạt động (`status = 'active'`,
 * chưa xóa mềm). Nhờ cùng một mảnh điều kiện nên `reviewCount` luôn bằng `total` của danh sách; khóa hay xóa mềm
 * người viết làm đánh giá rời cả hai ngay mà không động đến dòng, mở khóa thì trở lại.
 */
function publicWhere(landlordId: string): Prisma.ReviewWhereInput {
	return {
		landlordId,
		status: 'visible',
		author: { status: 'active', deletedAt: null },
	};
}

/**
 * Nơi duy nhất chạm bảng `reviews` (spec 0014). Việc ghi dùng SQL thô để một câu lệnh làm trọn việc và trả luôn dòng:
 * `INSERT ... ON CONFLICT DO NOTHING RETURNING` và `UPDATE ... RETURNING` có điều kiện trạng thái nguồn nằm trong câu.
 * Điều kiện "chủ trọ đã trả lời" nằm ở `ChatRepository`, tra chủ trọ hợp lệ ở `LandlordsRepository`.
 */
@Injectable()
export class ReviewsRepository {
	constructor(private readonly prisma: PrismaService) {}

	// ----- ghi của người viết -----

	/**
	 * Ghi đánh giá bằng MỘT câu `INSERT ... ON CONFLICT (author_id, landlord_id) DO NOTHING RETURNING` (spec 0014
	 * AC-5). Trả `null` khi cặp đã có đánh giá (không ghi gì); hai lần gọi đồng thời cùng cặp ra đúng một dòng. `id`,
	 * `status` ban đầu `visible`, `created_at` và `updated_at` do DB sinh. `comment` là `null` khi không có nhận xét.
	 */
	async insertIfAbsent(
		authorId: string,
		landlordId: string,
		stars: number,
		comment: string | null,
	): Promise<OwnReviewRow | null> {
		const rows = await this.prisma.$queryRaw<OwnReviewRow[]>`
			INSERT INTO reviews (author_id, landlord_id, stars, comment)
			VALUES (${authorId}::uuid, ${landlordId}::uuid, ${stars}::smallint, ${comment}::text)
			ON CONFLICT (author_id, landlord_id) DO NOTHING
			RETURNING id, stars, comment, status,
				created_at AS "createdAt", updated_at AS "updatedAt"`;
		return rows[0] ?? null;
	}

	/**
	 * Sửa đánh giá `visible` của chính người gọi bằng MỘT câu `UPDATE ... WHERE author_id AND landlord_id AND status =
	 * 'visible' RETURNING` (spec 0014 AC-6): điều kiện `visible` nằm trong câu nên đánh giá bị ẩn ngay giữa chừng
	 * không bao giờ bị sửa. Chỉ đặt cột có trong `changes`; luôn đặt `updated_at` về giờ hiện tại, kể cả khi gửi lại giá
	 * trị cũ. Trả `null` khi không dòng nào đổi (chưa có đánh giá, hoặc đang bị ẩn): người gọi phân biệt bằng `findOwn`.
	 */
	async updateOwnVisible(
		authorId: string,
		landlordId: string,
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
			UPDATE reviews
			SET ${Prisma.join(assignments)}
			WHERE author_id = ${authorId}::uuid
				AND landlord_id = ${landlordId}::uuid
				AND status = 'visible'
			RETURNING id, stars, comment, status,
				created_at AS "createdAt", updated_at AS "updatedAt"`;
		return rows[0] ?? null;
	}

	/** Xóa hẳn đánh giá của đúng cặp, kể cả đang bị ẩn (spec 0014 AC-7). `false` khi không có dòng nào để xóa. */
	async deleteOwn(authorId: string, landlordId: string): Promise<boolean> {
		const result = await this.prisma.review.deleteMany({
			where: { authorId, landlordId },
		});
		return result.count === 1;
	}

	// ----- đọc của người viết -----

	/** Đánh giá của người này về chủ trọ này, mọi trạng thái, hoặc `null`. Tra theo khóa duy nhất (author_id, landlord_id). */
	findOwn(
		authorId: string,
		landlordId: string,
	): Promise<OwnReviewRow | null> {
		return this.prisma.review.findUnique({
			where: { authorId_landlordId: { authorId, landlordId } },
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
	 * Một trang đánh giá hiện công khai của một chủ trọ, mới viết trước (`created_at` giảm dần, rồi `id` giảm dần),
	 * kèm tổng số (spec 0014 AC-2). Dùng đúng `publicWhere` của hai con số, theo chỉ mục
	 * (`landlord_id`, `created_at` giảm dần, `id` giảm dần).
	 */
	async findPublicPage(
		landlordId: string,
		skip: number,
		take: number,
	): Promise<{ rows: PublicReviewRow[]; total: number }> {
		const where = publicWhere(landlordId);
		const [rows, total] = await Promise.all([
			this.prisma.review.findMany({
				where,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
				select: publicSelect,
			}),
			this.prisma.review.count({ where }),
		]);
		return { rows, total };
	}

	/**
	 * Số đánh giá và tổng số sao của hồ sơ (spec 0014 AC-1): một truy vấn gộp trên đúng tập dòng của `publicWhere`.
	 * Trung bình không tính ở đây mà ở mapper, bằng số nguyên, để khỏi lệch ở các nửa như 4,35.
	 */
	async summarize(landlordId: string): Promise<ReviewSummary> {
		const result = await this.prisma.review.aggregate({
			where: publicWhere(landlordId),
			_count: { _all: true },
			_sum: { stars: true },
		});
		return { count: result._count._all, starSum: result._sum.stars ?? 0 };
	}

	// ----- kiểm duyệt của admin -----

	/**
	 * Một trang đánh giá cho admin (spec 0014 AC-11): mọi trạng thái, mọi người viết (kể cả bị khóa), mới nhất trước.
	 * Lọc theo `status`, `landlordId`, `authorId` khi có. Không áp `publicWhere`: admin phải thấy cả đánh giá đang ẩn.
	 */
	async findModerationPage(
		filter: ReviewModerationFilter,
		skip: number,
		take: number,
	): Promise<{ rows: ModerationReviewRow[]; total: number }> {
		const where: Prisma.ReviewWhereInput = {
			...(filter.status === undefined ? {} : { status: filter.status }),
			...(filter.landlordId === undefined
				? {}
				: { landlordId: filter.landlordId }),
			...(filter.authorId === undefined
				? {}
				: { authorId: filter.authorId }),
		};
		const [rows, total] = await Promise.all([
			this.prisma.review.findMany({
				where,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
				select: moderationSelect,
			}),
			this.prisma.review.count({ where }),
		]);
		return { rows, total };
	}

	/** Một mục kiểm duyệt, hoặc `null`. Đọc sau khi giao dịch ẩn hay gỡ ẩn đã xong. */
	findModerationRow(id: string): Promise<ModerationReviewRow | null> {
		return this.prisma.review.findUnique({
			where: { id },
			select: moderationSelect,
		});
	}

	/** Trạng thái hiện tại của đánh giá, hoặc `null` nếu không có. */
	async findStatus(id: string): Promise<string | null> {
		const row = await this.prisma.review.findUnique({
			where: { id },
			select: { status: true },
		});
		return row?.status ?? null;
	}

	/**
	 * Chuyển trạng thái bằng MỘT câu `UPDATE` có điều kiện trạng thái nguồn nằm ngay trong câu (spec 0014 AC-12), không
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
			UPDATE reviews SET status = ${to}
			WHERE id = ${id}::uuid AND status = ${from}`;
		return changed === 1;
	}
}
