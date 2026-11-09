import type {
	ModerationReviewResponse,
	MyReviewResponse,
	PublicReviewResponse,
} from './dto/review.response';
import { parseReviewStatus } from './review-status';
import type {
	ModerationReviewRow,
	OwnReviewRow,
	PublicReviewRow,
} from './reviews.repository';

/**
 * Chuỗi rỗng hoặc chỉ khoảng trắng trả `null`: cùng ánh xạ tên của hồ sơ chủ trọ (spec 0014 AC-2). Xuất ra để phần
 * tử admin của đánh giá phòng (spec 0015 AC-11) dùng đúng một ánh xạ tên.
 */
export function orNull(value: string | null): string | null {
	return value === null || value.trim() === '' ? null : value;
}

/**
 * Số sao trung bình làm tròn một chữ số thập phân, hoặc `null` khi chưa có đánh giá nào (spec 0014 AC-1). Tính
 * bằng số nguyên theo đúng công thức của spec, `round(tổng * 10 / số lượng) / 10` với làm tròn nửa lên, viết thành
 * `floor((20 * tổng + số lượng) / (2 * số lượng))`: kết quả không phụ thuộc cách số thực biểu diễn các nửa như 4,35
 * (87 sao trên 20 đánh giá ra 4,4) và không dùng `avg` kiểu số thực của database.
 */
export function averageStars(count: number, starSum: number): number | null {
	if (count === 0) return null;
	return Math.floor((20 * starSum + count) / (2 * count)) / 10;
}

/**
 * Phần tử danh sách công khai (spec 0014 AC-2). Chọn từng trường một nên email, số điện thoại, id người viết hay
 * trạng thái không thể lọt ra ngoài. `isMine` là `null` với khách (`viewerId` là `undefined`).
 */
export function toPublicReview(
	row: PublicReviewRow,
	viewerId: string | undefined,
): PublicReviewResponse {
	return {
		id: row.id,
		stars: row.stars,
		comment: row.comment,
		author: { name: orNull(row.author.name) },
		isMine: viewerId === undefined ? null : row.authorId === viewerId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/**
 * Đánh giá của chính người gọi (spec 0014 AC-8). `hiddenReason` chỉ có khi đang `hidden_by_admin` (và có dòng log);
 * còn lại luôn `null`, kể cả khi `hiddenReason` truyền vào là chữ của một lần ẩn cũ.
 */
export function toMyReview(
	row: OwnReviewRow,
	hiddenReason: string | null,
): MyReviewResponse {
	const status = parseReviewStatus(row.status);
	return {
		id: row.id,
		stars: row.stars,
		comment: row.comment,
		status,
		hiddenReason: status === 'hidden_by_admin' ? hiddenReason : null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/** Phần tử của admin (spec 0014 AC-11): id và tên hai bên, không email hay số điện thoại. */
export function toModerationReview(
	row: ModerationReviewRow,
	hiddenReason: string | null,
): ModerationReviewResponse {
	const status = parseReviewStatus(row.status);
	return {
		id: row.id,
		status,
		stars: row.stars,
		comment: row.comment,
		hiddenReason: status === 'hidden_by_admin' ? hiddenReason : null,
		author: { id: row.author.id, name: orNull(row.author.name) },
		landlord: { id: row.landlord.id, name: orNull(row.landlord.name) },
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}
