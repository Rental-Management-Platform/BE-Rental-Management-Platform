import { toWardBounds } from '../properties/coordinate-area';
import type { Amenity, Ward } from '../generated/prisma/client';
import type {
	AmenityResponse,
	WardCatalogResponse,
	WardResponse,
} from './dto/catalog.response';

/** Phường lồng trong nhà trọ và tin: không có `bounds` (spec 0012 AC-7). */
export function toWardResponse(ward: Ward): WardResponse {
	return {
		code: ward.code,
		name: ward.name,
		provinceCode: ward.provinceCode,
		provinceName: ward.provinceName,
	};
}

/** Phường trong danh mục: thêm `bounds`, hộp thô chưa nới lề, hoặc `null` khi phường chưa có hộp (spec 0012 AC-7). */
export function toWardCatalogResponse(ward: Ward): WardCatalogResponse {
	return { ...toWardResponse(ward), bounds: toWardBounds(ward) };
}

export function toAmenityResponse(amenity: Amenity): AmenityResponse {
	return { key: amenity.key, name: amenity.name };
}
