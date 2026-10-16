import type {
	AmenityResponse,
	WardResponse,
} from '../../catalog/dto/catalog.response';

export interface PropertyFeeResponse {
	/** electricity, water, internet, parking, service hoặc other. */
	readonly kind: string;
	/** Đơn giá, đồng Việt Nam. */
	readonly price: number;
	/** per_kwh, per_m3, per_month, per_person_month hoặc per_vehicle_month. */
	readonly unit: string;
	readonly note: string | null;
}

/** Nhà trọ của chủ trọ (spec 0002, "Hình dạng trả về"): chi tiết, và kết quả của tạo và sửa. */
export interface PropertyResponse {
	readonly id: string;
	readonly name: string;
	/** Chỉ số nhà và tên đường. */
	readonly addressText: string;
	/** `addressText`, tên phường hoặc xã, tên tỉnh hoặc thành phố; FE hiển thị thẳng, không tự ghép. */
	readonly fullAddress: string;
	/** Phường hoặc xã kèm tỉnh hoặc thành phố đi theo (địa chỉ hai cấp, không có quận huyện). */
	readonly ward: WardResponse;
	readonly latitude: number | null;
	readonly longitude: number | null;
	/** Theo thứ tự cố định: electricity, water, internet, parking, service, other. */
	readonly fees: readonly PropertyFeeResponse[];
	/** Theo tên tiếng Việt. */
	readonly amenities: readonly AmenityResponse[];
	readonly createdAt: Date;
	readonly updatedAt: Date;
}

/** Một dòng của danh sách nhà trọ: như chi tiết, cộng số tin chưa xóa. */
export interface PropertyListItemResponse extends PropertyResponse {
	readonly listingCount: number;
}
