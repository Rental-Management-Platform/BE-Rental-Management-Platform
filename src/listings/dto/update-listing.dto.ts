import { IsOptional } from 'class-validator';
import { OptionalNotNull } from '../../common/decorators/optional-not-null.decorator';
import {
	ListingAreaM2,
	ListingAvailableFrom,
	ListingDeposit,
	ListingDescription,
	ListingPrice,
	ListingTitle,
} from './listing-fields';

/**
 * Body sửa tin (spec 0002 AC-7): mọi trường tùy chọn; không trường nào đổi được nhà trọ, trạng thái hay mã.
 * `title`, `description`, `price`, `areaM2` không nhận `null`. `deposit` và `availableFrom` nhận `null` để xóa giá trị.
 */
export class UpdateListingDto {
	@OptionalNotNull()
	@ListingTitle()
	title?: string;

	@OptionalNotNull()
	@ListingDescription()
	description?: string;

	@OptionalNotNull()
	@ListingPrice()
	price?: number;

	@OptionalNotNull()
	@ListingAreaM2()
	areaM2?: number;

	@IsOptional()
	@ListingDeposit()
	deposit?: number | null;

	@IsOptional()
	@ListingAvailableFrom()
	availableFrom?: string | null;
}
