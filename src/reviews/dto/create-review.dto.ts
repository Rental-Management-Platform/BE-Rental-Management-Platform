import {
	IsInt,
	IsNotEmpty,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
	NotContains,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { REVIEW_LIMITS } from '../review-status';

/**
 * Body viết đánh giá (spec 0014 AC-3): `stars` là số nguyên từ 1 đến 5 (chuỗi `"5"` hay `4.5` bị từ chối, vì
 * không bật chuyển kiểu ngầm). `comment` vắng hoặc `null` là không có nhận xét; đã là chuỗi thì bỏ khoảng trắng hai
 * đầu, dài 1 đến 1000 ký tự sau khi bỏ, không chứa NUL, nên chuỗi rỗng hay toàn khoảng trắng bị từ chối. Xuống
 * dòng ở giữa được giữ nguyên. NUL phải bị chặn ở đây vì PostgreSQL không lưu được `\u0000` trong `text`. Người
 * viết và chủ trọ không có trong body: một từ lạ như `authorId` bị `forbidNonWhitelisted` chặn bằng 400.
 */
export class CreateReviewDto {
	// `@IsInt` đứng cuối để chạy đầu tiên (class-validator chạy từ dưới lên): sao thiếu hay sai kiểu báo "phải là số nguyên".
	@Max(REVIEW_LIMITS.starsMax)
	@Min(REVIEW_LIMITS.starsMin)
	@IsInt()
	stars: number;

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
