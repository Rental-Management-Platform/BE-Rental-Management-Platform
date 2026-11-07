import {
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	NotContains,
	ValidateIf,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { REVIEW_LIMITS } from '../review-status';

/**
 * Body sửa đánh giá (spec 0014 AC-6): `stars` và `comment` đều tùy chọn nhưng phải có ít nhất một. Trường vắng thì
 * giữ nguyên; `comment: null` xóa nhận xét; cùng luật giá trị như `CreateReviewDto`. `stars: null` không hợp lệ
 * (cột bắt buộc). Body rỗng bị chặn ngay ở đây, nên admin gửi body rỗng nhận 400 chứ không phải 403, như mọi body
 * sai khác: `stars` bị kiểm khi nó có mặt, hoặc khi `comment` cũng vắng.
 */
export class UpdateReviewDto {
	@ValidateIf(
		(dto: UpdateReviewDto, value: unknown) =>
			value !== undefined || dto.comment === undefined,
	)
	// `@IsInt` đứng cuối để chạy đầu tiên và lỗi đầu của trường là câu có ý nghĩa nhất (class-validator chạy từ dưới lên).
	@Max(REVIEW_LIMITS.starsMax)
	@Min(REVIEW_LIMITS.starsMin)
	@IsInt({
		message:
			'Phải gửi stars (số nguyên từ 1 đến 5) hoặc comment, ít nhất một trong hai.',
	})
	stars?: number;

	@IsOptional()
	@Trim()
	@IsString()
	@IsNotEmpty({ message: 'Nhận xét không được để trống.' })
	@MaxLength(REVIEW_LIMITS.commentMax, {
		message: `Nhận xét tối đa ${REVIEW_LIMITS.commentMax} ký tự.`,
	})
	@NotContains('\u0000', { message: 'Nhận xét chứa ký tự không hợp lệ.' })
	comment?: string | null;
}
