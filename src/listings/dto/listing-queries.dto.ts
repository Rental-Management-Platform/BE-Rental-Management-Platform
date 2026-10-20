import { Type } from 'class-transformer';
import {
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	IsUUID,
	Matches,
	MaxLength,
	Max,
	Min,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { PaginationQueryDto } from '../../common/pagination/pagination';
import { WARD_CODE_PATTERN } from '../../properties/property-fee';
import {
	LISTING_LIMITS,
	LISTING_SORTS,
	LISTING_STATUSES,
} from '../listing-status';
import type { ListingSort, ListingStatus } from '../listing-status';

/**
 * Query của `GET /listings` công khai (spec 0002 AC-10): từ khóa, phường, khoảng giá, sắp xếp, phân trang.
 * Giá trị ngoài biên là 400 `VALIDATION_FAILED`. `minPrice` lớn hơn `maxPrice` được Service chặn (cần so hai trường).
 */
export class ListListingsQueryDto extends PaginationQueryDto {
	@IsOptional()
	@Trim()
	@IsString()
	@MaxLength(LISTING_LIMITS.searchTextMax)
	q?: string;

	@IsOptional()
	@Matches(WARD_CODE_PATTERN, {
		message: 'Mã phường hoặc xã phải gồm đúng 5 chữ số.',
	})
	wardCode?: string;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(LISTING_LIMITS.filterPriceMax)
	minPrice?: number;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(0)
	@Max(LISTING_LIMITS.filterPriceMax)
	maxPrice?: number;

	@IsOptional()
	@IsIn([...LISTING_SORTS])
	sort: ListingSort = 'newest';
}

/**
 * Query của `GET /moderation/listings` (spec 0002 AC-9): phân trang cộng lọc theo trạng thái, chủ trọ và từ khóa.
 * Giá trị ngoài biên (`status` lạ, `landlordId` không phải UUID) là 400 `VALIDATION_FAILED`.
 */
export class ModerationListingsQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsIn([...LISTING_STATUSES])
	status?: ListingStatus;

	@IsOptional()
	@IsUUID(undefined, { message: 'Phải là mã chủ trọ hợp lệ.' })
	landlordId?: string;

	@IsOptional()
	@Trim()
	@IsString()
	@MaxLength(LISTING_LIMITS.searchTextMax)
	q?: string;
}

/** Query của `GET /me/listings` (spec 0002 AC-14): phân trang cộng lọc theo trạng thái. */
export class MyListingsQueryDto extends PaginationQueryDto {
	@IsOptional()
	@IsIn([...LISTING_STATUSES])
	status?: ListingStatus;
}
