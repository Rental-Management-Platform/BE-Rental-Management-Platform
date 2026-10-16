import { toAmenityResponse, toWardResponse } from '../catalog/catalog.mapper';
import { toFullAddress } from '../common/text/to-full-address';
import type {
	PropertyListItemResponse,
	PropertyResponse,
} from './dto/property.response';
import { FEE_KINDS } from './property-fee';
import type { PropertyDetail, PropertyListRow } from './properties.repository';

/** So sánh tên theo thứ tự chữ cái tiếng Việt, không phụ thuộc collation của DB. */
const VIETNAMESE = new Intl.Collator('vi');

const FEE_ORDER: ReadonlyMap<string, number> = new Map(
	FEE_KINDS.map((kind, index) => [kind, index]),
);

/**
 * Nhà trọ trên đường truyền (spec 0002, "Hình dạng trả về"): `fees[]` theo thứ tự loại cố định, `amenities[]`
 * theo tên tiếng Việt, và `fullAddress` ghép lúc đọc bằng hàm dùng chung (AC-16).
 */
export function toPropertyResponse(property: PropertyDetail): PropertyResponse {
	return {
		id: property.id,
		name: property.name,
		addressText: property.addressText,
		fullAddress: toFullAddress(property.addressText, property.ward),
		ward: toWardResponse(property.ward),
		latitude: property.latitude,
		longitude: property.longitude,
		fees: [...property.fees]
			.sort(
				(a, b) =>
					(FEE_ORDER.get(a.kind) ?? FEE_KINDS.length) -
					(FEE_ORDER.get(b.kind) ?? FEE_KINDS.length),
			)
			.map((fee) => ({
				kind: fee.kind,
				price: fee.price,
				unit: fee.unit,
				note: fee.note,
			})),
		amenities: property.amenities
			.map((row) => toAmenityResponse(row.amenity))
			.sort(
				(a, b) =>
					VIETNAMESE.compare(a.name, b.name) ||
					a.key.localeCompare(b.key),
			),
		createdAt: property.createdAt,
		updatedAt: property.updatedAt,
	};
}

export function toPropertyListItem(
	property: PropertyListRow,
): PropertyListItemResponse {
	return {
		...toPropertyResponse(property),
		listingCount: property._count.listings,
	};
}
