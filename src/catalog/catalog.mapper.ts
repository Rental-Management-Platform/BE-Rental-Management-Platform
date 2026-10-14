import type { Amenity, Ward } from '../generated/prisma/client';
import type { AmenityResponse, WardResponse } from './dto/catalog.response';

export function toWardResponse(ward: Ward): WardResponse {
	return {
		code: ward.code,
		name: ward.name,
		provinceCode: ward.provinceCode,
		provinceName: ward.provinceName,
	};
}

export function toAmenityResponse(amenity: Amenity): AmenityResponse {
	return { key: amenity.key, name: amenity.name };
}
