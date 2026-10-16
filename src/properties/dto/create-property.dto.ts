import { OptionalNotNull } from '../../common/decorators/optional-not-null.decorator';
import { IsCoordinate } from './is-coordinate.decorator';
import {
	PropertyAddressText,
	PropertyAmenityKeys,
	PropertyFees,
	PropertyName,
	PropertyWardCode,
} from './property-fields';
import { PropertyFeeDto } from './property-fee.dto';

/**
 * Body tạo nhà trọ (spec 0002 AC-3). Không có `landlordId`: chủ nhà trọ là người đang đăng nhập, lấy từ
 * token. Phường và tiện ích phải có trong danh mục (Service kiểm, trả `WARD_UNKNOWN` hoặc `AMENITY_UNKNOWN`).
 */
export class CreatePropertyDto {
	@PropertyName()
	name: string;

	/** Chỉ số nhà và tên đường, không gồm phường, xã, tỉnh. */
	@PropertyAddressText()
	addressText: string;

	@PropertyWardCode()
	wardCode: string;

	/** Vĩ độ và kinh độ gửi cùng nhau hoặc không gửi. */
	@IsCoordinate('latitude')
	latitude?: number | null;

	@IsCoordinate('longitude')
	longitude?: number | null;

	@OptionalNotNull()
	@PropertyFees()
	fees?: PropertyFeeDto[];

	@OptionalNotNull()
	@PropertyAmenityKeys()
	amenityKeys?: string[];
}
