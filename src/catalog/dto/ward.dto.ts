import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { WARD_CODE_PATTERN } from '../../properties/property-fee';
import { CATALOG_LIMITS, PROVINCE_CODE_PATTERN } from '../catalog-limits';

/**
 * Body tạo phường, xã hoặc đặc khu (spec 0002 AC-2). `provinceCode` và `provinceName` vẫn nhận từ body để mở thêm
 * tỉnh sau này mà không đổi API.
 */
export class CreateWardDto {
	@Matches(WARD_CODE_PATTERN, {
		message: 'Mã phường hoặc xã phải gồm đúng 5 chữ số.',
	})
	code: string;

	@Trim()
	@IsString()
	@Length(CATALOG_LIMITS.wardNameMin, CATALOG_LIMITS.wardNameMax, {
		message: `Tên phải từ ${CATALOG_LIMITS.wardNameMin} đến ${CATALOG_LIMITS.wardNameMax} ký tự.`,
	})
	name: string;

	@Matches(PROVINCE_CODE_PATTERN, {
		message: 'Mã tỉnh hoặc thành phố phải gồm đúng 2 chữ số.',
	})
	provinceCode: string;

	@Trim()
	@IsString()
	@Length(CATALOG_LIMITS.provinceNameMin, CATALOG_LIMITS.provinceNameMax, {
		message: `Tên tỉnh hoặc thành phố phải từ ${CATALOG_LIMITS.provinceNameMin} đến ${CATALOG_LIMITS.provinceNameMax} ký tự.`,
	})
	provinceName: string;
}

/** Body sửa phường: chỉ đổi tên (mã và mã tỉnh là khóa, không đổi). Trường nào vắng thì giữ nguyên. */
export class UpdateWardDto {
	@IsOptional()
	@Trim()
	@IsString()
	@Length(CATALOG_LIMITS.wardNameMin, CATALOG_LIMITS.wardNameMax, {
		message: `Tên phải từ ${CATALOG_LIMITS.wardNameMin} đến ${CATALOG_LIMITS.wardNameMax} ký tự.`,
	})
	name?: string;

	@IsOptional()
	@Trim()
	@IsString()
	@Length(CATALOG_LIMITS.provinceNameMin, CATALOG_LIMITS.provinceNameMax, {
		message: `Tên tỉnh hoặc thành phố phải từ ${CATALOG_LIMITS.provinceNameMin} đến ${CATALOG_LIMITS.provinceNameMax} ký tự.`,
	})
	provinceName?: string;
}
