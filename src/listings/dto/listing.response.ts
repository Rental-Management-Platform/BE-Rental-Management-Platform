import type { WardResponse } from '../../catalog/dto/catalog.response';
import type { PropertyResponse } from '../../properties/dto/property.response';
import type { ListingStatus } from '../listing-status';

export interface ListingImageResponse {
	readonly id: string;
	readonly position: number;
	/** Đường dẫn tương đối `/api/v1/media/public/<uuid>.<đuôi>`; FE tự nối với địa chỉ API. */
	readonly url: string;
}

/** Tin tóm tắt của danh sách công khai (spec 0002, "Hình dạng trả về"). */
export interface ListingSummaryResponse {
	readonly id: string;
	readonly code: string;
	/** Tính lúc đọc từ tiêu đề; chỉ để làm đẹp đường dẫn, phần mã mới dùng để tra. */
	readonly slug: string;
	readonly title: string;
	readonly price: number;
	readonly areaM2: number;
	readonly deposit: number | null;
	/** `YYYY-MM-DD` hoặc `null`. */
	readonly availableFrom: string | null;
	readonly coverImageUrl: string | null;
	readonly ward: Pick<WardResponse, 'code' | 'name'>;
	readonly addressText: string;
	readonly fullAddress: string;
	readonly landlord: { readonly id: string; readonly name: string | null };
	readonly createdAt: Date;
}

/**
 * Tin tóm tắt của `GET /listings` (spec 0006 AC-6): tin tóm tắt cộng `isFavorite`. Danh sách kiểm duyệt, danh sách của
 * chủ trọ và danh sách đã lưu dựng từ `ListingSummaryResponse` chứ không từ kiểu này.
 */
export interface PublicListingSummaryResponse extends ListingSummaryResponse {
	/** `null` với khách, token sai hoặc hết hạn; `true` hoặc `false` theo dòng lưu của chính người đăng nhập. */
	readonly isFavorite: boolean | null;
}

/** Chi tiết công khai: tin tóm tắt cộng mô tả, lượt xem, ảnh, nhà trọ, và chủ trọ kèm số điện thoại (chỉ khi đăng nhập). */
export interface ListingDetailResponse extends Omit<
	ListingSummaryResponse,
	'landlord'
> {
	/** `null` với khách, token sai hoặc hết hạn; `true` hoặc `false` theo dòng lưu của chính người đăng nhập (spec 0006 AC-6). */
	readonly isFavorite: boolean | null;
	readonly description: string;
	readonly viewCount: number;
	readonly images: readonly ListingImageResponse[];
	readonly property: Pick<
		PropertyResponse,
		| 'id'
		| 'name'
		| 'addressText'
		| 'fullAddress'
		| 'ward'
		| 'latitude'
		| 'longitude'
		| 'fees'
		| 'amenities'
	>;
	readonly landlord: {
		readonly id: string;
		readonly name: string | null;
		/** `null` với khách, token sai hoặc hết hạn, và khi chủ trọ chưa có số. */
		readonly phone: string | null;
	};
}

/** Dòng của `GET /me/listings`: tin tóm tắt bỏ `landlord`, cộng trạng thái, lý do bị admin ẩn, lượt xem và `isPublic`. */
export interface OwnerListingSummaryResponse extends Omit<
	ListingSummaryResponse,
	'landlord'
> {
	readonly status: ListingStatus;
	/** Có giá trị khi `status` là `hidden_by_admin`: lý do ẩn gần nhất; ngược lại `null`. */
	readonly moderationReason: string | null;
	readonly viewCount: number;
	/** `true` khi `status` là `visible` và tin nằm trong hạn mức hiện hành (spec 0003 AC-11). */
	readonly isPublic: boolean;
}

/**
 * "Mục kiểm duyệt" (spec 0002, "Hình dạng trả về"): dòng của `GET /moderation/listings` và kết quả hai route ẩn, gỡ ẩn
 * của admin. Tin tóm tắt (có `landlord { id, name }`) cộng trạng thái, lý do ẩn gần nhất và lượt xem. Không có
 * `isPublic`: cờ đó là của chủ trọ (spec 0003 AC-11).
 */
export interface ModerationListingResponse extends ListingSummaryResponse {
	readonly status: ListingStatus;
	/** Có giá trị khi `status` là `hidden_by_admin`: lý do ẩn gần nhất; ngược lại `null`. */
	readonly moderationReason: string | null;
	readonly viewCount: number;
}

/** Tin của chủ trọ (`/me/listings/:id` và kết quả mọi route ghi): chi tiết bỏ `landlord`, cộng `status`, `moderationReason` và `isPublic`. */
export interface OwnerListingDetailResponse extends Omit<
	ListingDetailResponse,
	'landlord' | 'isFavorite'
> {
	readonly status: ListingStatus;
	readonly moderationReason: string | null;
	/** `true` khi `status` là `visible` và tin nằm trong hạn mức hiện hành (spec 0003 AC-11). */
	readonly isPublic: boolean;
}
