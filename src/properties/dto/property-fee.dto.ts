import {
	IsIn,
	IsInt,
	IsOptional,
	IsString,
	Max,
	MaxLength,
	Min,
} from 'class-validator';
import { Trim } from '../../common/decorators/trim.decorator';
import { FEE_KINDS, FEE_UNITS, PROPERTY_LIMITS } from '../property-fee';
import type { FeeKind, FeeUnit } from '../property-fee';

/** Một khoản phí của nhà trọ (spec 0002): tối đa một khoản cho mỗi loại. */
export class PropertyFeeDto {
	@IsIn([...FEE_KINDS])
	kind: FeeKind;

	/** Đơn giá, đồng Việt Nam, số nguyên từ 0. */
	@IsInt()
	@Min(0)
	@Max(PROPERTY_LIMITS.feePriceMax)
	price: number;

	@IsIn([...FEE_UNITS])
	unit: FeeUnit;

	@IsOptional()
	@Trim()
	@IsString()
	@MaxLength(PROPERTY_LIMITS.feeNoteMax)
	note?: string;
}
