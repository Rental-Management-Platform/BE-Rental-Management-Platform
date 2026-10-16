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
 * Body sửa nhà trọ (spec 0002 AC-3): mọi trường tùy chọn và không nhận `null`, trừ cặp tọa độ. `fees` và
 * `amenityKeys` nếu gửi thì thay cả danh sách (mảng rỗng là xóa hết); không gửi thì giữ nguyên. Xóa tọa độ
 * bằng `latitude: null` cùng `longitude: null`.
 */
export class UpdatePropertyDto {
	@OptionalNotNull()
	@PropertyName()
	name?: string;

	@OptionalNotNull()
	@PropertyAddressText()
	addressText?: string;

	@OptionalNotNull()
	@PropertyWardCode()
	wardCode?: string;

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
