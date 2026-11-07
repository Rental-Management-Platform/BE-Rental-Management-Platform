/** Hai trạng thái của đánh giá (spec 0014): `reviews_status_check` ở DB chỉ cho đúng hai giá trị này. */
export const REVIEW_STATUSES = ['visible', 'hidden_by_admin'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Đổi chuỗi đọc từ DB sang kiểu hẹp. DB có CHECK nên sai ở đây là lỗi hệ thống (500), không phải lỗi của người dùng. */
export function parseReviewStatus(value: string): ReviewStatus {
	const found = REVIEW_STATUSES.find((status) => status === value);
	if (found !== undefined) return found;
	throw new Error(`Trạng thái đánh giá không hợp lệ trong DB: ${value}`);
}

/** Các con số của đánh giá (spec 0014 AC-3, AC-14); `CHECK` ở migration giữ cùng khoảng. */
export const REVIEW_LIMITS = {
	starsMin: 1,
	starsMax: 5,
	/** Tính theo ký tự Unicode như `MaxLength` của class-validator và `char_length` của PostgreSQL. */
	commentMax: 1000,
} as const;
