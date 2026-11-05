/** Một khung chữ nhật theo vĩ độ và kinh độ (độ). Đúng biên tính là nằm trong. */
export interface GeoBox {
	readonly minLatitude: number;
	readonly maxLatitude: number;
	readonly minLongitude: number;
	readonly maxLongitude: number;
}

/**
 * Hai khung bao quanh Thành phố Hồ Chí Minh mới (spec 0012, lớp 1): đất liền và Côn Đảo. Là cực trị thật của
 * 168 phường làm tròn ra ngoài đến 0.1 độ rồi cộng thêm 0.1 độ (khoảng 11 km), nên chỉ chặn điểm sai rõ ràng
 * (Hà Nội, nước ngoài, giữa biển), không chặn điểm sát ranh giới. Đổi khung là sửa code, không phải cấu hình.
 */
export const CITY_BOXES: readonly GeoBox[] = [
	{
		minLatitude: 10.2,
		maxLatitude: 11.7,
		minLongitude: 106.2,
		maxLongitude: 107.7,
	},
	{
		minLatitude: 8.4,
		maxLatitude: 8.9,
		minLongitude: 105.9,
		maxLongitude: 106.9,
	},
];

function isInsideBox(
	latitude: number,
	longitude: number,
	box: GeoBox,
): boolean {
	return (
		latitude >= box.minLatitude &&
		latitude <= box.maxLatitude &&
		longitude >= box.minLongitude &&
		longitude <= box.maxLongitude
	);
}

/**
 * Điểm có nằm trong một trong hai khung thành phố không (đúng biên là trong). Hàm thuần: không truy vấn,
 * không ném lỗi. Số không phải số hữu hạn (`NaN`) so sánh luôn sai nên cho kết quả ngoài khung.
 */
export function isInsideCity(latitude: number, longitude: number): boolean {
	return CITY_BOXES.some((box) => isInsideBox(latitude, longitude, box));
}

/**
 * Lề nới quanh hộp phường (spec 0012, lớp 2), tính bằng độ, cộng vào cả vĩ độ lẫn kinh độ: khoảng 500 m (1 độ vĩ
 * độ gần 111.3 km; kinh độ ở 10.8 độ Bắc ngắn hơn khoảng 2%, bỏ qua). Cùng một lề cho mọi phường.
 */
export const COORDINATE_MARGIN_DEGREES = 0.0045;

/** Bốn cột hộp của một dòng `wards`: cả bốn có giá trị, hoặc cả bốn rỗng (`CHECK wards_bounds_check`). */
export interface WardBoundsColumns {
	readonly minLatitude: number | null;
	readonly maxLatitude: number | null;
	readonly minLongitude: number | null;
	readonly maxLongitude: number | null;
}

/**
 * Hộp bao thô của phường, hoặc `null` nếu phường không có hộp (admin thêm qua API, hay seed chưa chạy). Một trong
 * bốn cột rỗng cũng coi là không có hộp, dù `CHECK` đã bảo đảm bốn cột cùng rỗng hoặc cùng có.
 */
export function toWardBounds(ward: WardBoundsColumns): GeoBox | null {
	const { minLatitude, maxLatitude, minLongitude, maxLongitude } = ward;
	if (
		minLatitude === null ||
		maxLatitude === null ||
		minLongitude === null ||
		maxLongitude === null
	) {
		return null;
	}
	return { minLatitude, maxLatitude, minLongitude, maxLongitude };
}

/**
 * Điểm có nằm trong hộp phường nới `COORDINATE_MARGIN_DEGREES` mỗi phía không (đúng biên là trong). Hàm thuần:
 * không truy vấn, không ném lỗi. Số không hữu hạn (`NaN`) so sánh luôn sai nên cho kết quả ngoài hộp.
 */
export function isNearWard(
	latitude: number,
	longitude: number,
	bounds: GeoBox,
): boolean {
	return isInsideBox(latitude, longitude, {
		minLatitude: bounds.minLatitude - COORDINATE_MARGIN_DEGREES,
		maxLatitude: bounds.maxLatitude + COORDINATE_MARGIN_DEGREES,
		minLongitude: bounds.minLongitude - COORDINATE_MARGIN_DEGREES,
		maxLongitude: bounds.maxLongitude + COORDINATE_MARGIN_DEGREES,
	});
}
