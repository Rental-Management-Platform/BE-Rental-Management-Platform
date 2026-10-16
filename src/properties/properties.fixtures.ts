import type { PropertyDetail, PropertyListRow } from './properties.repository';

/** Dữ liệu dựng sẵn cho test của module nhà trọ (không dùng ở mã chạy thật). */
const now = new Date('2026-10-16T03:00:00Z');

export const BEN_THANH = {
	code: '26743',
	name: 'Phường Bến Thành',
	provinceCode: '79',
	provinceName: 'Thành phố Hồ Chí Minh',
	createdAt: now,
	updatedAt: now,
};

export const OWNER_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
export const PROPERTY_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';

export function propertyDetail(
	overrides: Partial<PropertyDetail> = {},
): PropertyDetail {
	return {
		id: PROPERTY_ID,
		landlordId: OWNER_ID,
		name: 'Nhà trọ Hoa Hồng',
		addressText: '12 Lê Lợi',
		wardCode: BEN_THANH.code,
		latitude: null,
		longitude: null,
		createdAt: now,
		updatedAt: now,
		deletedAt: null,
		ward: BEN_THANH,
		fees: [],
		amenities: [],
		...overrides,
	};
}

export function propertyListRow(
	listingCount: number,
	overrides: Partial<PropertyDetail> = {},
): PropertyListRow {
	return {
		...propertyDetail(overrides),
		_count: { listings: listingCount },
	};
}

export function fee(
	kind: string,
	price: number,
	unit: string,
	note: string | null = null,
): PropertyDetail['fees'][number] {
	return {
		id: `fee-${kind}`,
		propertyId: PROPERTY_ID,
		kind,
		price,
		unit,
		note,
	};
}

export function amenityRow(
	key: string,
	name: string,
): PropertyDetail['amenities'][number] {
	return {
		propertyId: PROPERTY_ID,
		amenityKey: key,
		amenity: { key, name, createdAt: now, updatedAt: now },
	};
}
