/** Phường, xã, đặc khu theo địa chỉ hai cấp sau sáp nhập: không có quận huyện (spec 0002). */
export interface WardResponse {
	readonly code: string;
	/** Tên đầy đủ kèm loại đơn vị, ví dụ "Phường Bến Thành", "Xã Bình Chánh", "Đặc khu Côn Đảo". */
	readonly name: string;
	readonly provinceCode: string;
	/** Tỉnh hoặc thành phố, ví dụ "Thành phố Hồ Chí Minh". */
	readonly provinceName: string;
}

export interface AmenityResponse {
	readonly key: string;
	readonly name: string;
}
