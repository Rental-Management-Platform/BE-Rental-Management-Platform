import { toWardResponse } from '../catalog/catalog.mapper';
import { toFullAddress } from '../common/text/to-full-address';
import { toSlug } from '../common/text/to-slug';
import {
	toAmenityResponses,
	toFeeResponses,
} from '../properties/properties.mapper';
import type {
	ListingDetailResponse,
	ListingImageResponse,
	ListingSummaryResponse,
	OwnerListingDetailResponse,
	OwnerListingSummaryResponse,
} from './dto/listing.response';
import type {
	OwnerDetailRow,
	OwnerSummaryRow,
	PublicDetailRow,
	PublicSummaryRow,
} from './listings.repository';
import type { ListingStatus } from './listing-status';

/** Chuỗi rỗng hoặc chỉ khoảng trắng trả `null`: giá trị trống không bao giờ là chuỗi rỗng (spec 0002). */
function orNull(value: string | null | undefined): string | null {
	return value === null || value === undefined || value.trim() === ''
		? null
		: value;
}

/** `YYYY-MM-DD` cắt từ ISO UTC của cột `date`, không đổi múi giờ để không lệch ngày (spec 0002). */
function toDateOnly(value: Date | null): string | null {
	return value === null ? null : value.toISOString().slice(0, 10);
}

/** `url` của ảnh là đường dẫn tương đối đến route phục vụ ảnh; `storage_key` có dạng `public/<uuid>.<đuôi>`. */
function toImageUrl(storageKey: string): string {
	return `/api/v1/media/${storageKey}`;
}

function toImages(images: PublicDetailRow['images']): ListingImageResponse[] {
	return images.map((image) => ({
		id: image.id,
		position: image.position,
		url: toImageUrl(image.storageKey),
	}));
}

type SummaryFields = Omit<ListingSummaryResponse, 'landlord'>;
type SummarySource = Pick<
	PublicSummaryRow,
	| 'id'
	| 'code'
	| 'title'
	| 'price'
	| 'areaM2'
	| 'deposit'
	| 'availableFrom'
	| 'createdAt'
	| 'images'
> & {
	property: {
		addressText: string;
		ward: PublicSummaryRow['property']['ward'];
	};
};

/** Phần chung của mọi dạng tin tóm tắt. `coverImageUrl` là ảnh có `position` nhỏ nhất, `null` khi chưa có ảnh. */
function toSummaryFields(row: SummarySource): SummaryFields {
	const { property } = row;
	const cover = row.images[0];
	return {
		id: row.id,
		code: row.code,
		slug: toSlug(row.title),
		title: row.title,
		price: row.price,
		areaM2: row.areaM2,
		deposit: row.deposit,
		availableFrom: toDateOnly(row.availableFrom),
		coverImageUrl:
			cover === undefined ? null : toImageUrl(cover.storageKey),
		ward: { code: property.ward.code, name: property.ward.name },
		addressText: property.addressText,
		fullAddress: toFullAddress(property.addressText, property.ward),
		createdAt: row.createdAt,
	};
}

/** Tin tóm tắt của danh sách công khai, có tên chủ trọ nhưng không có số điện thoại. */
export function toListingSummary(
	row: PublicSummaryRow,
): ListingSummaryResponse {
	return {
		...toSummaryFields(row),
		landlord: {
			id: row.property.landlord.id,
			name: orNull(row.property.landlord.name),
		},
	};
}

/** Phần chung của mọi dạng chi tiết: tin tóm tắt cộng mô tả, lượt xem, ảnh và nhà trọ (phí, tiện ích, tọa độ). */
function toDetailFields(row: OwnerDetailRow, viewCount: number) {
	const { property } = row;
	return {
		...toSummaryFields(row),
		description: row.description,
		viewCount,
		images: toImages(row.images),
		property: {
			id: property.id,
			name: property.name,
			addressText: property.addressText,
			fullAddress: toFullAddress(property.addressText, property.ward),
			ward: toWardResponse(property.ward),
			latitude: property.latitude,
			longitude: property.longitude,
			fees: toFeeResponses(property.fees),
			amenities: toAmenityResponses(property.amenities),
		},
	};
}

/**
 * Chi tiết công khai. `viewCount` là giá trị sau khi cộng (nếu vừa tính lượt) hoặc giá trị đã đọc. Số điện
 * thoại chỉ có khi `includePhone` (request có access token hợp lệ); khách thì luôn `null` (spec 0002 AC-12).
 */
export function toListingDetail(
	row: PublicDetailRow,
	options: { readonly viewCount: number; readonly includePhone: boolean },
): ListingDetailResponse {
	const { landlord } = row.property;
	return {
		...toDetailFields(row, options.viewCount),
		landlord: {
			id: landlord.id,
			name: orNull(landlord.name),
			phone: options.includePhone ? orNull(landlord.phone) : null,
		},
	};
}

/** Dòng của `GET /me/listings`: không có `landlord`, thêm trạng thái, lý do ẩn của admin và lượt xem. */
export function toOwnerSummary(
	row: OwnerSummaryRow,
	moderationReason: string | null,
): OwnerListingSummaryResponse {
	return {
		...toSummaryFields(row),
		status: row.status as ListingStatus,
		moderationReason:
			row.status === 'hidden_by_admin' ? moderationReason : null,
		viewCount: row.viewCount,
	};
}

/** Tin của chủ trọ: chi tiết không có `landlord`, thêm `status` và `moderationReason` (chỉ khi `hidden_by_admin`). */
export function toOwnerDetail(
	row: OwnerDetailRow,
	moderationReason: string | null,
): OwnerListingDetailResponse {
	return {
		...toDetailFields(row, row.viewCount),
		status: row.status as ListingStatus,
		moderationReason:
			row.status === 'hidden_by_admin' ? moderationReason : null,
	};
}
