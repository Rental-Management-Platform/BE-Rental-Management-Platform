import type {
	OwnerDetailRow,
	OwnerSummaryRow,
	PublicDetailRow,
	PublicSummaryRow,
} from './listings.repository';

/** Dữ liệu dựng sẵn cho test của module tin (không dùng ở mã chạy thật). */
const now = new Date('2026-10-16T03:00:00Z');

export const WARD = {
	code: '26743',
	name: 'Phường Bến Thành',
	provinceCode: '79',
	provinceName: 'Thành phố Hồ Chí Minh',
	createdAt: now,
	updatedAt: now,
};

export const LANDLORD_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01';
export const PROPERTY_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02';
export const LISTING_ID = '0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03';

const listing = {
	id: LISTING_ID,
	propertyId: PROPERTY_ID,
	code: 'abcd2345',
	title: 'Phòng đẹp có gác gần chợ Bến Thành',
	description: 'Phòng sạch sẽ, thoáng mát, có gác lửng, giờ giấc tự do.',
	price: 3_500_000,
	areaM2: 22.5,
	deposit: 3_500_000 as number | null,
	availableFrom: new Date('2026-11-01T00:00:00Z') as Date | null,
	status: 'visible',
	viewCount: 7,
	searchKey: 'phong dep co gac',
	createdAt: now,
	updatedAt: now,
	deletedAt: null as Date | null,
};

const property = {
	id: PROPERTY_ID,
	landlordId: LANDLORD_ID,
	name: 'Nhà trọ Hoa Hồng',
	addressText: '12 Lê Lợi',
	wardCode: WARD.code,
	latitude: 10.7721 as number | null,
	longitude: 106.6983 as number | null,
	createdAt: now,
	updatedAt: now,
	deletedAt: null as Date | null,
	ward: WARD,
};

export function imageRow(position: number, uuid: string, extension = 'jpg') {
	return {
		id: `image-${position}`,
		listingId: LISTING_ID,
		position,
		storageKey: `public/${uuid}.${extension}`,
		createdAt: now,
	};
}

export function publicSummaryRow(
	overrides: Partial<PublicSummaryRow> = {},
): PublicSummaryRow {
	return {
		...listing,
		property: {
			...property,
			landlord: { id: LANDLORD_ID, name: 'Anh Nam' },
		},
		images: [],
		...overrides,
	};
}

export function ownerSummaryRow(
	overrides: Partial<OwnerSummaryRow> = {},
): OwnerSummaryRow {
	return {
		...listing,
		property,
		images: [],
		...overrides,
	};
}

export function publicDetailRow(
	overrides: Partial<PublicDetailRow> = {},
): PublicDetailRow {
	return {
		...listing,
		property: {
			...property,
			fees: [],
			amenities: [],
			landlord: {
				id: LANDLORD_ID,
				name: 'Anh Nam',
				phone: '0912345678',
			},
		},
		images: [],
		...overrides,
	};
}

export function ownerDetailRow(
	overrides: Partial<OwnerDetailRow> = {},
): OwnerDetailRow {
	return {
		...listing,
		property: { ...property, fees: [], amenities: [] },
		images: [],
		...overrides,
	};
}
