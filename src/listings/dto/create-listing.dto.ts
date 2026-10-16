import { IsOptional } from 'class-validator';
import {
	ListingAreaM2,
	ListingAvailableFrom,
	ListingDeposit,
	ListingDescription,
	ListingPrice,
	ListingTitle,
} from './listing-fields';

/**
 * Body đăng tin (spec 0002 AC-5). Không có `status`, `code` hay `propertyId`: trạng thái luôn là `visible`,
 * mã do Service sinh, nhà trọ lấy từ đường dẫn. `deposit` và `availableFrom` tùy chọn (`null` coi như không gửi).
 */
export class CreateListingDto {
	@ListingTitle()
	title: string;

	@ListingDescription()
	description: string;

	@ListingPrice()
	price: number;

	@ListingAreaM2()
	areaM2: number;

	@IsOptional()
	@ListingDeposit()
	deposit?: number | null;

	/** `YYYY-MM-DD`. */
	@IsOptional()
	@ListingAvailableFrom()
	availableFrom?: string | null;
}
