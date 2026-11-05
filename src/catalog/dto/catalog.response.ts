/** Phường, xã, đặc khu theo địa chỉ hai cấp sau sáp nhập: không có quận huyện (spec 0002). */
export interface WardResponse {
	readonly code: string;
	/** Tên đầy đủ kèm loại đơn vị, ví dụ "Phường Bến Thành", "Xã Bình Chánh", "Đặc khu Côn Đảo". */
	readonly name: string;
	readonly provinceCode: string;
	/** Tỉnh hoặc thành phố, ví dụ "Thành phố Hồ Chí Minh". */
	readonly provinceName: string;
}

/**
 * Hộp bao thô của một phường theo vĩ độ và kinh độ (độ), chưa nới lề 0.0045 độ (spec 0012 AC-7). FE ghim trong
 * hộp thô này thì backend luôn nhận, vì backend còn nới thêm khoảng 500 m mỗi phía.
 */
export interface WardBoundsResponse {
	readonly minLatitude: number;
	readonly maxLatitude: number;
	readonly minLongitude: number;
	readonly maxLongitude: number;
}

/**
 * Phường trong danh mục (`GET /wards`, `POST /wards`, `PATCH /wards/:code`) kèm `bounds`; `null` khi phường chưa
 * có hộp (admin thêm qua API, hay seed chưa chạy). Phường lồng trong nhà trọ và tin vẫn là `WardResponse`, không
 * có `bounds` (spec 0012 AC-7).
 */
export interface WardCatalogResponse extends WardResponse {
	readonly bounds: WardBoundsResponse | null;
}

export interface AmenityResponse {
	readonly key: string;
	readonly name: string;
}
