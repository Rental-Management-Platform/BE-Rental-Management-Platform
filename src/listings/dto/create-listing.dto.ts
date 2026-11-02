import { IsOptional } from 'class-validator';
import { FormNumber } from '../../common/decorators/form-number.decorator';
import {
	ListingAreaM2,
	ListingAvailableFrom,
	ListingDeposit,
	ListingDescription,
	ListingPrice,
	ListingTitle,
} from './listing-fields';

/**
 * Các trường chữ của form đăng tin (spec 0011 AC-4, giữ luật của spec 0002 AC-5), gửi kèm ảnh bằng
 * `multipart/form-data`. Không có `status`, `code` hay `propertyId`: trạng thái luôn là `visible`, mã do Service
 * sinh, nhà trọ lấy từ đường dẫn. Trong multipart số đến dạng chuỗi nên ba trường số qua `FormNumber`; ba trường này
 * cố ý không mang `@Trim()`, để `" 5"` không bị cắt khoảng trắng rồi lọt qua. `deposit` và `availableFrom` tùy chọn:
 * bỏ hẳn trường nếu không có (chuỗi rỗng là sai), `null` coi như không gửi.
 */
export class CreateListingDto {
	@ListingTitle()
	title: string;

	@ListingDescription()
	description: string;

	@FormNumber()
	@ListingPrice()
	price: number;

	@FormNumber()
	@ListingAreaM2()
	areaM2: number;

	@IsOptional()
	@FormNumber()
	@ListingDeposit()
	deposit?: number | null;

	/** `YYYY-MM-DD`. */
	@IsOptional()
	@ListingAvailableFrom()
	availableFrom?: string | null;
}
