import { randomUUID } from 'node:crypto';
import { APP_UTC_OFFSET_MS } from '../../common/time/app-time-zone';
import { toSearchKey } from '../../common/text/to-search-key';
import type { Prisma } from '../../generated/prisma/client';
import { generateListingCode } from '../../listings/listing-code';
import {
	DEMO_EMAIL_DOMAIN,
	DEMO_LANDLORDS,
	DEMO_LISTINGS,
	DEMO_PROPERTIES,
	DEMO_TENANTS,
	DEMO_TRIAL_DAYS,
} from './demo-data';
import type {
	DemoFee,
	DemoListing,
	DemoOrder,
	DemoProperty,
} from './demo-data';
import { createRng, seedOf } from './demo-images';
import type { Scene } from './demo-images';

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Hạt giống cố định: chạy lại cùng ngày cho cùng lượt xem, ngày lưu, tin được lưu và ảnh. */
const DEMO_SEED = 20261023;

/** Lượt xem mỗi ngày (trung bình) của tin của từng chủ trọ, để số lượt xem trên hồ sơ có chênh lệch thật. */
const POPULARITY: Readonly<Record<string, number>> = {
	khoa: 9,
	nhung: 12,
	bao: 3,
	phat: 4,
	tam: 2,
	mai: 2,
	huy: 3,
	lan: 5,
};

/** Một gói mẫu như đang nằm trong bảng `plans`, đủ để chốt vào đơn. */
export interface DemoPlan {
	readonly id: string;
	readonly name: string;
	readonly price: number;
	readonly maxListings: number;
	readonly durationDays: number;
}

export interface DemoBuildInput {
	readonly now: Date;
	/** Bản băm argon2id của mật khẩu demo, dùng chung cho mọi tài khoản demo. */
	readonly passwordHash: string;
	/** Admin dùng làm người thực hiện các dòng kiểm duyệt (khóa tài khoản, ẩn tin). */
	readonly adminId: string;
	readonly wards: ReadonlyMap<string, { readonly name: string }>;
	readonly plans: ReadonlyMap<string, DemoPlan>;
}

/** Một ảnh sẽ được vẽ và ghi ra ổ đĩa; dòng `listing_images` tương ứng nằm trong `listingImages`. */
export interface DemoImageFile {
	readonly storageKey: string;
	readonly scene: Scene;
	readonly seed: number;
}

export interface DemoRows {
	readonly users: Prisma.UserCreateManyInput[];
	readonly properties: Prisma.PropertyCreateManyInput[];
	readonly propertyFees: Prisma.PropertyFeeCreateManyInput[];
	readonly propertyAmenities: Prisma.PropertyAmenityCreateManyInput[];
	readonly listings: Prisma.ListingCreateManyInput[];
	readonly listingImages: Prisma.ListingImageCreateManyInput[];
	readonly imageFiles: DemoImageFile[];
	readonly orders: Prisma.OrderCreateManyInput[];
	readonly subscriptions: Prisma.SubscriptionCreateManyInput[];
	readonly moderationLogs: Prisma.ModerationLogCreateManyInput[];
	readonly follows: Prisma.FollowCreateManyInput[];
	readonly favorites: Prisma.FavoriteCreateManyInput[];
}

export function demoEmail(emailName: string): string {
	return `${emailName}@${DEMO_EMAIL_DOMAIN}`;
}

/** `3500000` thành `3.500.000`. */
function formatMoney(value: number): string {
	return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const FEE_LABELS: Readonly<Record<DemoFee['kind'], string>> = {
	electricity: 'Điện',
	water: 'Nước',
	internet: 'Internet',
	parking: 'Gửi xe',
	service: 'Phí dịch vụ',
	other: 'Phí khác',
};

const FEE_UNIT_LABELS: Readonly<Record<DemoFee['unit'], string>> = {
	per_kwh: 'kWh',
	per_m3: 'm³',
	per_month: 'tháng',
	per_person_month: 'người/tháng',
	per_vehicle_month: 'xe/tháng',
};

function describeFee(fee: DemoFee): string {
	const label = FEE_LABELS[fee.kind];
	if (fee.price === 0) {
		return `${label}: ${fee.note === undefined ? 'miễn phí' : fee.note.toLowerCase()}`;
	}
	const note = fee.note === undefined ? '' : ` (${fee.note.toLowerCase()})`;
	return `${label}: ${formatMoney(fee.price)}đ/${FEE_UNIT_LABELS[fee.unit]}${note}`;
}

/** Mô tả đầy đủ của tin: đoạn riêng, rồi tiện ích, chi phí và vị trí lấy từ nhà trọ (chủ trọ thật cũng hay dán lại như vậy). */
function describeListing(
	listing: DemoListing,
	property: DemoProperty,
	amenityNames: ReadonlyMap<string, string>,
): string {
	const amenities = property.amenities
		.map((key) => amenityNames.get(key) ?? key)
		.join(', ');
	return [
		listing.about,
		`Tiện ích của nhà trọ: ${amenities}.`,
		`Chi phí hàng tháng: ${property.fees.map(describeFee).join('; ')}.`,
		`Vị trí: ${property.nearby}`,
	].join('\n\n');
}

/** Tên tiện ích như trong `prisma/seed-data/amenities.json`, dùng để viết mô tả. */
export function amenityNameMap(
	amenities: readonly { key: string; name: string }[],
): Map<string, string> {
	return new Map(amenities.map((amenity) => [amenity.key, amenity.name]));
}

/** Các cảnh của một tin theo thứ tự vị trí ảnh: ảnh bìa là phòng, rồi nhà vệ sinh, bếp hoặc cảnh ngoài ban công, mặt tiền. */
function scenesOf(
	look: DemoListing['look'],
	amenities: readonly string[],
): Scene[] {
	const has = (key: string): boolean => amenities.includes(key);
	const third: Scene = has('kitchen')
		? 'kitchen'
		: has('balcony')
			? 'view'
			: 'room';
	return [
		look === 'loft' ? 'loft' : 'room',
		has('private_bathroom') ? 'bathroom' : 'room',
		third,
		has('balcony') && third !== 'view' ? 'view' : 'room',
		'building',
	];
}

/**
 * Dựng toàn bộ dòng bảng của bộ demo từ nội dung tĩnh. Hàm thuần: không đọc cơ sở dữ liệu hay ổ đĩa, cùng đầu vào
 * (kể cả `now`) cho cùng kết quả ngoài các mã ngẫu nhiên (`id`, mã tin, mã đơn, khóa ảnh). Các ràng buộc của
 * schema (kỳ gói không chồng nhau, một đơn chờ mỗi chủ trọ, `trial_ends_at` của chủ trọ) được giữ ngay từ cách dựng.
 */
export function buildDemoRows(
	input: DemoBuildInput,
	amenityNames: ReadonlyMap<string, string>,
): DemoRows {
	const { now } = input;
	const rng = createRng(DEMO_SEED);
	const at = (daysAgo: number): Date =>
		new Date(
			now.getTime() - daysAgo * DAY_MS - Math.floor(rng() * 0.9 * DAY_MS),
		);

	const rows: DemoRows = {
		users: [],
		properties: [],
		propertyFees: [],
		propertyAmenities: [],
		listings: [],
		listingImages: [],
		imageFiles: [],
		orders: [],
		subscriptions: [],
		moderationLogs: [],
		follows: [],
		favorites: [],
	};

	const usedCodes = new Set<string>();
	const newCode = (): string => {
		let code = generateListingCode();
		while (usedCodes.has(code)) code = generateListingCode();
		usedCodes.add(code);
		return code;
	};

	// ----- tài khoản -----
	const landlordIds = new Map<string, string>();
	const landlordCreated = new Map<string, Date>();
	for (const landlord of DEMO_LANDLORDS) {
		const id = randomUUID();
		const createdAt = at(landlord.registeredDaysAgo);
		landlordIds.set(landlord.key, id);
		landlordCreated.set(landlord.key, createdAt);
		const lockedAt =
			landlord.lock === undefined ? null : at(landlord.lock.daysAgo);
		rows.users.push({
			id,
			email: demoEmail(landlord.emailName),
			passwordHash: input.passwordHash,
			name: landlord.name,
			phone: landlord.phone,
			accountType: 'landlord',
			status: lockedAt === null ? 'active' : 'locked',
			lockedReason: landlord.lock?.reason ?? null,
			trialEndsAt: new Date(
				createdAt.getTime() + DEMO_TRIAL_DAYS * DAY_MS,
			),
			createdAt,
			updatedAt: lockedAt ?? createdAt,
		});
		if (lockedAt !== null && landlord.lock !== undefined) {
			rows.moderationLogs.push({
				actorId: input.adminId,
				targetType: 'user',
				targetId: id,
				action: 'lock',
				reason: landlord.lock.reason,
				createdAt: lockedAt,
			});
		}
	}

	const tenantIds = new Map<string, string>();
	const tenantCreated = new Map<string, Date>();
	for (const tenant of DEMO_TENANTS) {
		const id = randomUUID();
		const createdAt = at(tenant.registeredDaysAgo);
		tenantIds.set(tenant.key, id);
		tenantCreated.set(tenant.key, createdAt);
		const lockedAt =
			tenant.lock === undefined ? null : at(tenant.lock.daysAgo);
		rows.users.push({
			id,
			email: demoEmail(tenant.emailName),
			passwordHash: input.passwordHash,
			name: tenant.name,
			phone: tenant.phone ?? null,
			accountType: 'tenant',
			status: lockedAt === null ? 'active' : 'locked',
			lockedReason: tenant.lock?.reason ?? null,
			trialEndsAt: null,
			createdAt,
			updatedAt: lockedAt ?? createdAt,
		});
		if (lockedAt !== null && tenant.lock !== undefined) {
			rows.moderationLogs.push({
				actorId: input.adminId,
				targetType: 'user',
				targetId: id,
				action: 'lock',
				reason: tenant.lock.reason,
				createdAt: lockedAt,
			});
		}
	}

	// ----- nhà trọ, phí, tiện ích -----
	const propertyIds = new Map<string, string>();
	for (const property of DEMO_PROPERTIES) {
		const landlordId = landlordIds.get(property.landlord);
		const ward = input.wards.get(property.wardCode);
		if (landlordId === undefined) {
			throw new Error(
				`Nhà trọ ${property.key}: không có chủ trọ "${property.landlord}".`,
			);
		}
		if (ward === undefined) {
			throw new Error(
				`Nhà trọ ${property.key}: không có phường mã ${property.wardCode}. Hãy chạy npm run seed trước.`,
			);
		}
		const id = randomUUID();
		propertyIds.set(property.key, id);
		const createdAt = at(property.ageDays);
		rows.properties.push({
			id,
			landlordId,
			name: property.name,
			addressText: property.addressText,
			wardCode: property.wardCode,
			latitude: property.latitude,
			longitude: property.longitude,
			createdAt,
			updatedAt: createdAt,
		});
		for (const fee of property.fees) {
			rows.propertyFees.push({
				id: randomUUID(),
				propertyId: id,
				kind: fee.kind,
				price: fee.price,
				unit: fee.unit,
				note: fee.note ?? null,
			});
		}
		for (const amenityKey of property.amenities) {
			rows.propertyAmenities.push({ propertyId: id, amenityKey });
		}
	}

	// ----- tin và ảnh -----
	// Ngày vào ở là ngày theo giờ Việt Nam, lưu ở cột `date` (nửa đêm UTC của ngày đó).
	const vietnamToday = new Date(now.getTime() + APP_UTC_OFFSET_MS);
	const dateOnly = (shiftDays: number): Date =>
		new Date(
			Date.UTC(
				vietnamToday.getUTCFullYear(),
				vietnamToday.getUTCMonth(),
				vietnamToday.getUTCDate() + shiftDays,
			),
		);

	const listingIds: string[] = [];
	const listingCreated: Date[] = [];
	const listingProperty: string[] = [];
	for (const listing of DEMO_LISTINGS) {
		const property = DEMO_PROPERTIES.find(
			(item) => item.key === listing.property,
		);
		const propertyId = propertyIds.get(listing.property);
		if (property === undefined || propertyId === undefined) {
			throw new Error(
				`Tin "${listing.title}": không có nhà trọ "${listing.property}".`,
			);
		}
		const ward = input.wards.get(property.wardCode);
		if (ward === undefined) {
			throw new Error(
				`Tin "${listing.title}": không có phường mã ${property.wardCode}.`,
			);
		}
		const id = randomUUID();
		const code = newCode();
		const createdAt = at(listing.ageDays);
		const hiddenAt =
			listing.status === 'hidden_by_admin' &&
			listing.hiddenDaysAgo !== undefined
				? at(listing.hiddenDaysAgo)
				: null;
		const popularity = POPULARITY[property.landlord] ?? 3;
		const base = Math.round(
			listing.ageDays * popularity * (0.4 + rng() * 1.2),
		);
		rows.listings.push({
			id,
			propertyId,
			code,
			title: listing.title,
			description: describeListing(listing, property, amenityNames),
			price: listing.price,
			areaM2: listing.areaM2,
			deposit: listing.deposit,
			availableFrom:
				listing.availableInDays === null
					? null
					: dateOnly(listing.availableInDays),
			status: listing.status,
			viewCount: Math.min(
				1500,
				listing.status === 'visible' ? base : Math.round(base / 4),
			),
			searchKey: toSearchKey(
				listing.title,
				property.name,
				property.addressText,
				ward.name,
			),
			createdAt,
			updatedAt: hiddenAt ?? createdAt,
		});
		listingIds.push(id);
		listingCreated.push(createdAt);
		listingProperty.push(listing.property);

		if (hiddenAt !== null && listing.hiddenReason !== undefined) {
			rows.moderationLogs.push({
				actorId: input.adminId,
				targetType: 'listing',
				targetId: id,
				action: 'hide_listing',
				reason: listing.hiddenReason,
				createdAt: hiddenAt,
			});
		}

		const imageCount = listing.images ?? 3 + Math.floor(rng() * 3);
		const scenes = scenesOf(listing.look, property.amenities);
		for (let position = 0; position < imageCount; position += 1) {
			const storageKey = `public/${randomUUID()}.png`;
			rows.listingImages.push({
				id: randomUUID(),
				listingId: id,
				position,
				storageKey,
				createdAt: new Date(
					createdAt.getTime() + (position + 1) * MINUTE_MS,
				),
			});
			rows.imageFiles.push({
				storageKey,
				scene: scenes[position] ?? 'room',
				seed: seedOf(`${code}:${position}`),
			});
		}
	}

	// ----- đơn và kỳ gói -----
	for (const landlord of DEMO_LANDLORDS) {
		const userId = landlordIds.get(landlord.key) as string;
		const paid: { id: string; order: DemoOrder; paidAt: Date }[] = [];
		for (const order of landlord.orders) {
			const plan = input.plans.get(order.plan);
			if (plan === undefined) {
				throw new Error(
					`Thiếu gói mẫu "${order.plan}". Hãy chạy npm run seed trước, và đừng xóa hay đổi tên gói mẫu.`,
				);
			}
			const when = at(order.daysAgo);
			const id = randomUUID();
			const row = {
				id,
				code: newCode(),
				userId,
				planId: plan.id,
				planName: plan.name,
				price: plan.price,
				maxListings: plan.maxListings,
				durationDays: plan.durationDays,
			};
			if (order.status === 'paid') {
				const createdAt = new Date(
					when.getTime() - (2 + Math.floor(rng() * 6)) * MINUTE_MS,
				);
				rows.orders.push({
					...row,
					status: 'paid',
					paidAt: when,
					createdAt,
					updatedAt: when,
				});
				paid.push({ id, order, paidAt: when });
			} else if (order.status === 'cancelled') {
				const cancelledAt = new Date(
					when.getTime() + (5 + Math.floor(rng() * 20)) * MINUTE_MS,
				);
				rows.orders.push({
					...row,
					status: 'cancelled',
					cancelledAt,
					createdAt: when,
					updatedAt: cancelledAt,
				});
			} else {
				rows.orders.push({
					...row,
					status: 'pending',
					createdAt: when,
					updatedAt: when,
				});
			}
		}

		// Kỳ gói nối tiếp đúng như `OrdersService.pay`: bắt đầu ở lúc thanh toán, hoặc ở cuối kỳ trước nếu kỳ trước
		// còn chạy; dài đúng `durationDays` đã chốt trên đơn.
		paid.sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());
		let previousEnd: Date | null = null;
		for (const { id, order, paidAt } of paid) {
			const plan = input.plans.get(order.plan) as DemoPlan;
			const startsAt: Date =
				previousEnd !== null && previousEnd.getTime() > paidAt.getTime()
					? previousEnd
					: paidAt;
			const endsAt = new Date(
				startsAt.getTime() + plan.durationDays * DAY_MS,
			);
			rows.subscriptions.push({
				id: randomUUID(),
				userId,
				orderId: id,
				startsAt,
				endsAt,
				createdAt: paidAt,
				updatedAt: paidAt,
			});
			previousEnd = endsAt;
		}
	}

	// ----- theo dõi và lưu yêu thích -----
	const between = (from: Date, to: Date): Date =>
		new Date(
			from.getTime() +
				Math.floor(rng() * Math.max(0, to.getTime() - from.getTime())),
		);
	const latest = (...dates: Date[]): Date =>
		new Date(Math.max(...dates.map((date) => date.getTime())));
	const settled = new Date(now.getTime() - 6 * 60 * MINUTE_MS);

	for (const tenant of DEMO_TENANTS) {
		const userId = tenantIds.get(tenant.key) as string;
		const joined = tenantCreated.get(tenant.key) as Date;
		for (const key of tenant.follows) {
			const landlordId = landlordIds.get(key);
			const landlordJoined = landlordCreated.get(key);
			if (landlordId === undefined || landlordJoined === undefined) {
				throw new Error(
					`Người tìm trọ ${tenant.key}: không có chủ trọ "${key}".`,
				);
			}
			rows.follows.push({
				userId,
				landlordId,
				createdAt: between(latest(joined, landlordJoined), settled),
			});
		}

		const chosen = new Set<number>();
		for (const propertyKey of tenant.savedFrom ?? []) {
			const candidates = listingProperty
				.map((key, index) => (key === propertyKey ? index : -1))
				.filter((index) => index >= 0);
			if (candidates.length === 0) {
				throw new Error(
					`Người tìm trọ ${tenant.key}: nhà trọ "${propertyKey}" chưa có tin nào.`,
				);
			}
			chosen.add(candidates[Math.floor(rng() * candidates.length)]);
		}
		// Xáo trộn Fisher Yates có hạt giống rồi lấy dần cho đủ số tin cần lưu.
		const order = listingIds.map((_, index) => index);
		for (let i = order.length - 1; i > 0; i -= 1) {
			const j = Math.floor(rng() * (i + 1));
			[order[i], order[j]] = [order[j], order[i]];
		}
		for (const index of order) {
			if (chosen.size >= tenant.favorites) break;
			chosen.add(index);
		}
		for (const index of chosen) {
			rows.favorites.push({
				userId,
				listingId: listingIds[index],
				createdAt: between(
					latest(joined, listingCreated[index]),
					settled,
				),
			});
		}
	}

	return rows;
}
