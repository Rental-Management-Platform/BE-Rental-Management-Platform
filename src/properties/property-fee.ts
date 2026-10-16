/** Sáu loại phí, đúng thứ tự trả về cố định (spec 0002): `fees[]` luôn xếp theo thứ tự này. */
export const FEE_KINDS = [
	'electricity',
	'water',
	'internet',
	'parking',
	'service',
	'other',
] as const;
export type FeeKind = (typeof FEE_KINDS)[number];

/** Năm đơn vị tính; không ràng buộc cặp `kind` với `unit` (spec 0002, "Phí và tọa độ nhà trọ"). */
export const FEE_UNITS = [
	'per_kwh',
	'per_m3',
	'per_month',
	'per_person_month',
	'per_vehicle_month',
] as const;
export type FeeUnit = (typeof FEE_UNITS)[number];

/** Giới hạn dữ liệu nhận vào của nhà trọ (spec 0002, "Giới hạn dữ liệu nhận vào"). */
export const PROPERTY_LIMITS = {
	nameMin: 2,
	nameMax: 100,
	addressMin: 5,
	addressMax: 200,
	feePriceMax: 100_000_000,
	feeNoteMax: 100,
	amenityKeysMax: 30,
	/** Độ dài tối đa của một khóa tiện ích, khớp `^[a-z][a-z0-9_]{1,29}$` ở bảng `amenities`. */
	amenityKeyMax: 30,
} as const;

/** Mã phường sau sáp nhập: đúng 5 chữ số (spec 0002, "Mã phường và danh mục"). */
export const WARD_CODE_PATTERN = /^[0-9]{5}$/;
