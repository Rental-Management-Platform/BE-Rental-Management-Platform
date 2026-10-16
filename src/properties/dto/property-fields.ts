import { applyDecorators } from '@nestjs/common';
import { Type } from 'class-transformer';
import {
	ArrayMaxSize,
	ArrayUnique,
	IsArray,
	IsString,
	Matches,
	MaxLength,
	MinLength,
	ValidateNested,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { FEE_KINDS, PROPERTY_LIMITS, WARD_CODE_PATTERN } from '../property-fee';
import { PropertyFeeDto } from './property-fee.dto';

/**
 * Luật của từng trường nhà trọ, viết một lần để body tạo và body sửa dùng chung (không để hai DTO lệch
 * nhau). Body sửa thêm `@OptionalNotNull()` ở trên cùng của mỗi trường.
 */

export const PropertyName = (): PropertyDecorator =>
	applyDecorators(
		Trim(),
		IsString(),
		MinLength(PROPERTY_LIMITS.nameMin),
		MaxLength(PROPERTY_LIMITS.nameMax),
	);

/** Chỉ số nhà và tên đường: phường, xã, tỉnh đã nằm ở `wardCode` (spec 0002 AC-16). */
export const PropertyAddressText = (): PropertyDecorator =>
	applyDecorators(
		Trim(),
		IsString(),
		MinLength(PROPERTY_LIMITS.addressMin),
		MaxLength(PROPERTY_LIMITS.addressMax),
	);

export const PropertyWardCode = (): PropertyDecorator =>
	applyDecorators(
		Trim(),
		IsString(),
		Matches(WARD_CODE_PATTERN, {
			message: 'Mã phường hoặc xã phải gồm đúng 5 chữ số.',
		}),
	);

/** Tối đa 6 khoản, mỗi loại phí một khoản. */
export const PropertyFees = (): PropertyDecorator =>
	applyDecorators(
		IsArray(),
		ArrayMaxSize(FEE_KINDS.length),
		ArrayUnique((fee: PropertyFeeDto) => fee.kind, {
			message: 'Mỗi loại phí chỉ được khai một khoản.',
		}),
		ValidateNested({ each: true }),
		Type(() => PropertyFeeDto),
	);

export const PropertyAmenityKeys = (): PropertyDecorator =>
	applyDecorators(
		IsArray(),
		ArrayMaxSize(PROPERTY_LIMITS.amenityKeysMax),
		ArrayUnique({ message: 'Tiện ích bị gửi trùng.' }),
		IsString({ each: true }),
		MaxLength(PROPERTY_LIMITS.amenityKeyMax, { each: true }),
	);
