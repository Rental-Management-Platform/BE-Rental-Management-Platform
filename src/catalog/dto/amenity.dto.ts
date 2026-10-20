import { IsString, Length, Matches } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { AMENITY_KEY_PATTERN, CATALOG_LIMITS } from '../catalog-limits';

/** Body tạo tiện ích (spec 0002 AC-2): khóa chữ thường, số, gạch dưới và tên hiển thị. */
export class CreateAmenityDto {
	@Matches(AMENITY_KEY_PATTERN, {
		message:
			'Khóa tiện ích gồm chữ thường, số, gạch dưới, bắt đầu bằng chữ, dài 2 đến 30 ký tự.',
	})
	key: string;

	@Trim()
	@IsString()
	@Length(CATALOG_LIMITS.amenityNameMin, CATALOG_LIMITS.amenityNameMax, {
		message: `Tên phải từ ${CATALOG_LIMITS.amenityNameMin} đến ${CATALOG_LIMITS.amenityNameMax} ký tự.`,
	})
	name: string;
}

/** Body sửa tiện ích: chỉ đổi tên hiển thị (khóa không đổi). Tên bắt buộc vì không còn gì khác để sửa. */
export class UpdateAmenityDto {
	@Trim()
	@IsString()
	@Length(CATALOG_LIMITS.amenityNameMin, CATALOG_LIMITS.amenityNameMax, {
		message: `Tên phải từ ${CATALOG_LIMITS.amenityNameMin} đến ${CATALOG_LIMITS.amenityNameMax} ký tự.`,
	})
	name: string;
}
