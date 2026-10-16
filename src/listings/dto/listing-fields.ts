import { applyDecorators } from '@nestjs/common';
import {
	IsInt,
	IsISO8601,
	IsNumber,
	IsString,
	Matches,
	Max,
	MaxLength,
	Min,
	MinLength,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { DATE_ONLY_PATTERN, LISTING_LIMITS } from '../listing-status';

/**
 * Luật của từng trường tin, viết một lần để body đăng và body sửa dùng chung (không để hai DTO lệch nhau).
 * Body sửa thêm `@OptionalNotNull()` (hoặc `@IsOptional()` cho `deposit` và `availableFrom`, nhận `null`).
 */

export const ListingTitle = (): PropertyDecorator =>
	applyDecorators(
		Trim(),
		IsString(),
		MinLength(LISTING_LIMITS.titleMin),
		MaxLength(LISTING_LIMITS.titleMax),
	);

export const ListingDescription = (): PropertyDecorator =>
	applyDecorators(
		Trim(),
		IsString(),
		MinLength(LISTING_LIMITS.descriptionMin),
		MaxLength(LISTING_LIMITS.descriptionMax),
	);

/** Giá thuê mỗi tháng, đồng, số nguyên từ 100.000 đến 100.000.000. */
export const ListingPrice = (): PropertyDecorator =>
	applyDecorators(
		IsInt(),
		Min(LISTING_LIMITS.priceMin),
		Max(LISTING_LIMITS.priceMax),
	);

/** Diện tích, mét vuông, từ 1 đến 1000, tối đa một chữ số thập phân. */
export const ListingAreaM2 = (): PropertyDecorator =>
	applyDecorators(
		IsNumber(
			{ allowNaN: false, allowInfinity: false, maxDecimalPlaces: 1 },
			{ message: 'Diện tích phải là số, tối đa một chữ số thập phân.' },
		),
		Min(LISTING_LIMITS.areaMin),
		Max(LISTING_LIMITS.areaMax),
	);

/** Tiền cọc, đồng, số nguyên từ 0 đến 1 tỷ. */
export const ListingDeposit = (): PropertyDecorator =>
	applyDecorators(IsInt(), Min(0), Max(LISTING_LIMITS.depositMax));

const DATE_MESSAGE = 'Ngày phải đúng dạng YYYY-MM-DD và là ngày có thật.';

/** Ngày vào ở, chuỗi `YYYY-MM-DD` là ngày có thật. Nhận cả ngày đã qua (spec 0002: không kiểm cận dưới). */
export const ListingAvailableFrom = (): PropertyDecorator =>
	applyDecorators(
		IsString({ message: DATE_MESSAGE }),
		Matches(DATE_ONLY_PATTERN, { message: DATE_MESSAGE }),
		IsISO8601(
			{ strict: true, strictSeparator: true },
			{ message: DATE_MESSAGE },
		),
	);
