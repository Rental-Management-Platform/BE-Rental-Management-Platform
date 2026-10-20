/**
 * Giới hạn dữ liệu nhận vào của API admin cho danh mục (spec 0002 AC-2). Mã phường (5 chữ số) dùng chung
 * `WARD_CODE_PATTERN` của module nhà trọ; ở đây là phần còn lại. Độ dài tên là lựa chọn của người build vì spec chỉ
 * chốt dạng của mã: đủ rộng cho tên đầy đủ kèm loại đơn vị ("Phường Bình Hưng Hòa B").
 */

/** Mã tỉnh hoặc thành phố: đúng 2 chữ số, ví dụ `79` (spec 0002, "Mã phường và danh mục"). */
export const PROVINCE_CODE_PATTERN = /^[0-9]{2}$/;

/** Khóa tiện ích: chữ thường, số, gạch dưới, bắt đầu bằng chữ; khớp `CHECK` của bảng `amenities`. */
export const AMENITY_KEY_PATTERN = /^[a-z][a-z0-9_]{1,29}$/;

export const CATALOG_LIMITS = {
	wardNameMin: 2,
	wardNameMax: 100,
	provinceNameMin: 2,
	provinceNameMax: 100,
	amenityNameMin: 2,
	amenityNameMax: 50,
} as const;
