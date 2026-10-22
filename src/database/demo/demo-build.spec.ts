import { randomUUID } from 'node:crypto';
import { toSearchKey } from '../../common/text/to-search-key';
import { isStorageKey } from '../../storage/storage.service';
import { loadAmenitySeed, loadWardSeed } from '../seed-data';
import { SEED_PLANS } from '../seed-plans';
import { amenityNameMap, buildDemoRows, demoEmail } from './demo-build';
import type { DemoPlan, DemoRows } from './demo-build';
import {
	DEMO_LANDLORDS,
	DEMO_LISTINGS,
	DEMO_PROPERTIES,
	DEMO_TENANTS,
} from './demo-data';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-23T05:00:00.000Z');
const ADMIN_ID = randomUUID();

const plans = new Map<string, DemoPlan>(
	SEED_PLANS.map((plan) => [plan.name, { id: randomUUID(), ...plan }]),
);
const wards = new Map(loadWardSeed().map((ward) => [ward.code, ward]));
const amenityNames = amenityNameMap(loadAmenitySeed());

function build(now: Date = NOW): DemoRows {
	return buildDemoRows(
		{ now, passwordHash: 'hash', adminId: ADMIN_ID, wards, plans },
		amenityNames,
	);
}

type Membership = { state: 'plan' | 'trial' | 'expired'; limit: number };

/** Bản của `MembershipsService.resolve` với mặc định `trial_listing_limit = 2`, tính trên các dòng đã dựng. */
function membershipOf(rows: DemoRows, userId: string, now: Date): Membership {
	const active = rows.subscriptions.find(
		(sub) =>
			sub.userId === userId &&
			(sub.startsAt as Date).getTime() <= now.getTime() &&
			now.getTime() < (sub.endsAt as Date).getTime(),
	);
	if (active !== undefined) {
		const order = rows.orders.find((item) => item.id === active.orderId);
		return { state: 'plan', limit: order?.maxListings ?? 0 };
	}
	const user = rows.users.find((item) => item.id === userId);
	const trialEndsAt = user?.trialEndsAt as Date | null | undefined;
	if (trialEndsAt != null && trialEndsAt.getTime() > now.getTime()) {
		return { state: 'trial', limit: 2 };
	}
	return { state: 'expired', limit: 0 };
}

describe('demo-build: dựng dòng bảng từ nội dung tĩnh', () => {
	const rows = build();
	const userOf = (key: string): string => {
		const landlord = DEMO_LANDLORDS.find((item) => item.key === key);
		const tenant = DEMO_TENANTS.find((item) => item.key === key);
		const email = demoEmail((landlord ?? tenant)?.emailName as string);
		return rows.users.find((user) => user.email === email)?.id as string;
	};

	it('số dòng khớp nội dung tĩnh và mọi id là duy nhất', () => {
		expect(rows.users).toHaveLength(
			DEMO_LANDLORDS.length + DEMO_TENANTS.length,
		);
		expect(rows.properties).toHaveLength(DEMO_PROPERTIES.length);
		expect(rows.listings).toHaveLength(DEMO_LISTINGS.length);
		for (const table of [
			rows.users,
			rows.properties,
			rows.listings,
			rows.orders,
			rows.subscriptions,
		]) {
			const ids = (table as readonly { id?: string }[]).map(
				(row) => row.id,
			);
			expect(new Set(ids).size).toBe(ids.length);
		}
		const codes = [
			...rows.listings.map((row) => row.code),
			...rows.orders.map((row) => row.code),
		];
		expect(new Set(codes).size).toBe(codes.length);
		for (const code of codes) expect(code).toMatch(/^[a-z0-9]{8}$/);
	});

	it('khóa ngoại khép kín: tin trỏ vào nhà trọ, nhà trọ vào chủ trọ, đơn vào gói và người dùng', () => {
		const userIds = new Set(rows.users.map((row) => row.id));
		const propertyIds = new Set(rows.properties.map((row) => row.id));
		const listingIds = new Set(rows.listings.map((row) => row.id));
		const orderIds = new Set(rows.orders.map((row) => row.id));
		const planIds = new Set([...plans.values()].map((plan) => plan.id));
		for (const row of rows.properties)
			expect(userIds.has(row.landlordId)).toBe(true);
		for (const row of rows.propertyFees)
			expect(propertyIds.has(row.propertyId)).toBe(true);
		for (const row of rows.propertyAmenities)
			expect(propertyIds.has(row.propertyId)).toBe(true);
		for (const row of rows.listings)
			expect(propertyIds.has(row.propertyId)).toBe(true);
		for (const row of rows.listingImages)
			expect(listingIds.has(row.listingId)).toBe(true);
		for (const row of rows.orders) {
			expect(userIds.has(row.userId)).toBe(true);
			expect(planIds.has(row.planId)).toBe(true);
		}
		for (const row of rows.subscriptions) {
			expect(userIds.has(row.userId)).toBe(true);
			expect(orderIds.has(row.orderId)).toBe(true);
		}
		for (const row of [...rows.follows, ...rows.favorites])
			expect(userIds.has(row.userId)).toBe(true);
		for (const row of rows.follows)
			expect(userIds.has(row.landlordId)).toBe(true);
		for (const row of rows.favorites)
			expect(listingIds.has(row.listingId)).toBe(true);
	});

	it('tài khoản: chủ trọ luôn có số điện thoại và hạn dùng thử, người tìm trọ thì không; khóa kèm lý do', () => {
		for (const user of rows.users) {
			if (user.accountType === 'landlord') {
				expect(user.phone).toBeTruthy();
				expect(user.trialEndsAt).toBeInstanceOf(Date);
			} else {
				expect(user.trialEndsAt).toBeNull();
			}
			expect(user.status === 'locked').toBe(user.lockedReason !== null);
			expect(user.email).toBe(user.email.toLowerCase());
		}
		const locked = rows.users
			.filter((user) => user.status === 'locked')
			.map((user) => user.email);
		expect(locked.sort()).toEqual(
			[demoEmail('lan.bui'), demoEmail('son.duong')].sort(),
		);
	});

	it('ảnh: vị trí 0 đến 4 không trùng trong một tin, khóa ảnh đúng dạng và duy nhất, mỗi ảnh có tệp để ghi', () => {
		const byListing = new Map<string, number[]>();
		for (const image of rows.listingImages) {
			byListing.set(image.listingId, [
				...(byListing.get(image.listingId) ?? []),
				image.position,
			]);
			expect(isStorageKey(image.storageKey)).toBe(true);
		}
		for (const positions of byListing.values()) {
			expect(positions.length).toBeLessThanOrEqual(5);
			expect([...positions].sort()).toEqual(
				positions.map((_, index) => index),
			);
		}
		const keys = rows.listingImages.map((image) => image.storageKey);
		expect(new Set(keys).size).toBe(keys.length);
		expect(rows.imageFiles.map((file) => file.storageKey).sort()).toEqual(
			[...keys].sort(),
		);
		const noImage = rows.listings.filter(
			(listing) => !byListing.has(listing.id as string),
		);
		expect(noImage).toHaveLength(1);
	});

	it('đơn: trạng thái khớp mốc thời gian (CHECK của DB) và tối đa một đơn chờ mỗi chủ trọ', () => {
		for (const order of rows.orders) {
			expect(order.status === 'paid').toBe(order.paidAt != null);
			expect(order.status === 'cancelled').toBe(
				order.cancelledAt != null,
			);
			const plan = [...plans.values()].find(
				(item) => item.id === order.planId,
			);
			expect([
				order.planName,
				order.price,
				order.maxListings,
				order.durationDays,
			]).toEqual([
				plan?.name,
				plan?.price,
				plan?.maxListings,
				plan?.durationDays,
			]);
		}
		const pendingPerUser = new Map<string, number>();
		for (const order of rows.orders.filter(
			(item) => item.status === 'pending',
		)) {
			pendingPerUser.set(
				order.userId,
				(pendingPerUser.get(order.userId) ?? 0) + 1,
			);
		}
		for (const count of pendingPerUser.values()) expect(count).toBe(1);
		expect(
			rows.orders.filter((order) => order.status === 'paid'),
		).toHaveLength(16);
		expect(rows.subscriptions).toHaveLength(16);
	});

	it('kỳ gói: một kỳ cho mỗi đơn đã trả, dài đúng số ngày đã chốt, không chồng nhau (ràng buộc loại trừ của DB)', () => {
		for (const sub of rows.subscriptions) {
			const order = rows.orders.find((item) => item.id === sub.orderId);
			expect(order?.status).toBe('paid');
			expect(
				(sub.endsAt as Date).getTime() -
					(sub.startsAt as Date).getTime(),
			).toBe((order?.durationDays as number) * DAY_MS);
			expect((sub.startsAt as Date).getTime()).toBeGreaterThanOrEqual(
				(order?.paidAt as Date).getTime(),
			);
		}
		const perUser = new Map<string, { startsAt: Date; endsAt: Date }[]>();
		for (const sub of rows.subscriptions) {
			perUser.set(sub.userId, [
				...(perUser.get(sub.userId) ?? []),
				{ startsAt: sub.startsAt as Date, endsAt: sub.endsAt as Date },
			]);
		}
		for (const periods of perUser.values()) {
			periods.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
			for (let i = 1; i < periods.length; i += 1) {
				expect(
					(periods[i - 1] as { endsAt: Date }).endsAt.getTime(),
				).toBeLessThanOrEqual(
					(periods[i] as { startsAt: Date }).startsAt.getTime(),
				);
			}
		}
	});

	it('trạng thái hạn mức của từng chủ trọ đúng kịch bản đã mô tả', () => {
		const expected: Record<string, Membership> = {
			khoa: { state: 'plan', limit: 50 },
			nhung: { state: 'plan', limit: 15 },
			bao: { state: 'plan', limit: 5 },
			phat: { state: 'plan', limit: 5 },
			tam: { state: 'trial', limit: 2 },
			mai: { state: 'expired', limit: 0 },
			huy: { state: 'expired', limit: 0 },
			lan: { state: 'plan', limit: 15 },
			ha: { state: 'trial', limit: 2 },
		};
		for (const [key, membership] of Object.entries(expected)) {
			expect({ key, ...membershipOf(rows, userOf(key), NOW) }).toEqual({
				key,
				...membership,
			});
		}
	});

	it('Khoa đã gia hạn trước: có một kỳ gói bắt đầu ở tương lai nối sau kỳ đang chạy', () => {
		const userId = userOf('khoa');
		const periods = rows.subscriptions
			.filter((sub) => sub.userId === userId)
			.map((sub) => ({
				startsAt: sub.startsAt as Date,
				endsAt: sub.endsAt as Date,
			}))
			.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
		const last = periods[periods.length - 1];
		const before = periods[periods.length - 2];
		expect(last.startsAt.getTime()).toBeGreaterThan(NOW.getTime());
		expect(last.startsAt.getTime()).toBe(before.endsAt.getTime());
	});

	it('tin công khai theo luật hạn mức: chỉ N tin đăng sớm nhất của chủ trọ còn quyền và không bị khóa, tổng 37', () => {
		const propertyOwner = new Map(
			rows.properties.map((row) => [row.id as string, row.landlordId]),
		);
		const publicByLandlord = new Map<string, number>();
		for (const landlord of DEMO_LANDLORDS) {
			const userId = userOf(landlord.key);
			const user = rows.users.find((row) => row.id === userId);
			const { limit } = membershipOf(rows, userId, NOW);
			const visible = rows.listings
				.filter(
					(listing) =>
						propertyOwner.get(listing.propertyId) === userId &&
						listing.status === 'visible',
				)
				.sort(
					(a, b) =>
						(a.createdAt as Date).getTime() -
						(b.createdAt as Date).getTime(),
				);
			publicByLandlord.set(
				landlord.key,
				user?.status === 'active' ? Math.min(limit, visible.length) : 0,
			);
		}
		expect(Object.fromEntries(publicByLandlord)).toEqual({
			khoa: 16,
			nhung: 10,
			bao: 5,
			phat: 4,
			tam: 2,
			mai: 0,
			huy: 0,
			lan: 0,
			ha: 0,
		});
		expect(
			[...publicByLandlord.values()].reduce(
				(sum, count) => sum + count,
				0,
			),
		).toBe(37);
	});

	it('hai tin đăng sau cùng của Bảo là hai tin vượt hạn mức, và tin cuối không có ảnh', () => {
		const userId = userOf('bao');
		const propertyIds = new Set(
			rows.properties
				.filter((row) => row.landlordId === userId)
				.map((row) => row.id),
		);
		const ordered = rows.listings
			.filter((listing) => propertyIds.has(listing.propertyId))
			.sort(
				(a, b) =>
					(a.createdAt as Date).getTime() -
					(b.createdAt as Date).getTime(),
			);
		expect(ordered).toHaveLength(7);
		const newest = ordered[6] as { id?: string };
		expect(
			rows.listingImages.some((image) => image.listingId === newest.id),
		).toBe(false);
	});

	it('mô tả đủ ba phần phụ, không lộ số điện thoại (khách chưa đăng nhập không được thấy), search_key dựng đúng', () => {
		const phones = DEMO_LANDLORDS.map((landlord) => landlord.phone);
		for (const listing of rows.listings) {
			expect(listing.description).toContain('Tiện ích của nhà trọ:');
			expect(listing.description).toContain('Chi phí hàng tháng:');
			expect(listing.description).toContain('Vị trí:');
			expect(listing.description.length).toBeLessThanOrEqual(5000);
			for (const phone of phones)
				expect(listing.description).not.toContain(phone);
			const property = rows.properties.find(
				(row) => row.id === listing.propertyId,
			);
			const ward = wards.get(property?.wardCode as string);
			expect(listing.searchKey).toBe(
				toSearchKey(
					listing.title,
					property?.name,
					property?.addressText,
					ward?.name,
				),
			);
		}
	});

	it('kiểm duyệt: người thực hiện là admin; khóa và ẩn tin đều có dòng lịch sử cùng lý do', () => {
		for (const log of rows.moderationLogs)
			expect(log.actorId).toBe(ADMIN_ID);
		const lockLogs = rows.moderationLogs.filter(
			(log) => log.action === 'lock',
		);
		expect(lockLogs.map((log) => log.targetId).sort()).toEqual(
			[userOf('lan'), userOf('son')].sort(),
		);
		const hideLogs = rows.moderationLogs.filter(
			(log) => log.action === 'hide_listing',
		);
		const hidden = rows.listings.filter(
			(listing) => listing.status === 'hidden_by_admin',
		);
		expect(hideLogs.map((log) => log.targetId)).toEqual(
			hidden.map((listing) => listing.id),
		);
		expect(hideLogs[0]?.reason.length).toBeGreaterThan(0);
	});

	it('theo dõi và lưu yêu thích: đúng số lượng, không trùng cặp, không có dòng xảy ra trước khi tin hay tài khoản tồn tại', () => {
		for (const tenant of DEMO_TENANTS) {
			const userId = userOf(tenant.key);
			expect(
				rows.follows.filter((row) => row.userId === userId),
			).toHaveLength(tenant.follows.length);
			expect(
				rows.favorites.filter((row) => row.userId === userId),
			).toHaveLength(tenant.favorites);
		}
		const pairs = rows.favorites.map(
			(row) => `${row.userId}:${row.listingId}`,
		);
		expect(new Set(pairs).size).toBe(pairs.length);
		const followPairs = rows.follows.map(
			(row) => `${row.userId}:${row.landlordId}`,
		);
		expect(new Set(followPairs).size).toBe(followPairs.length);
		for (const row of rows.follows)
			expect(row.userId).not.toBe(row.landlordId);

		const created = new Map(
			rows.users.map((row) => [row.id as string, row.createdAt as Date]),
		);
		const listingCreated = new Map(
			rows.listings.map((row) => [
				row.id as string,
				row.createdAt as Date,
			]),
		);
		for (const row of rows.follows) {
			expect((row.createdAt as Date).getTime()).toBeGreaterThanOrEqual(
				(created.get(row.userId) as Date).getTime(),
			);
			expect((row.createdAt as Date).getTime()).toBeGreaterThanOrEqual(
				(created.get(row.landlordId) as Date).getTime(),
			);
		}
		for (const row of rows.favorites) {
			expect((row.createdAt as Date).getTime()).toBeGreaterThanOrEqual(
				(created.get(row.userId) as Date).getTime(),
			);
			expect((row.createdAt as Date).getTime()).toBeGreaterThanOrEqual(
				(listingCreated.get(row.listingId) as Date).getTime(),
			);
			expect((row.createdAt as Date).getTime()).toBeLessThan(
				NOW.getTime(),
			);
		}
	});

	it('Lan Anh chắc chắn có tin đã lưu thuộc chủ trọ hết dùng thử, gói hết hạn và bị khóa', () => {
		const userId = userOf('lananh');
		const saved = new Set(
			rows.favorites
				.filter((row) => row.userId === userId)
				.map((row) => row.listingId),
		);
		for (const propertyKey of [
			'mai-lai-thieu',
			'huy-vung-tau',
			'lan-phu-nhuan',
		]) {
			const property = DEMO_PROPERTIES.find(
				(item) => item.key === propertyKey,
			);
			const rowIndex = DEMO_PROPERTIES.indexOf(
				property as (typeof DEMO_PROPERTIES)[number],
			);
			const propertyId = rows.properties[rowIndex]?.id;
			const ids = rows.listings
				.filter((listing) => listing.propertyId === propertyId)
				.map((listing) => listing.id);
			expect(ids.some((id) => saved.has(id as string))).toBe(true);
		}
	});

	it('mốc thời gian đều tính từ now: không có dòng nào ở tương lai ngoài kỳ gói gia hạn trước và hạn dùng thử', () => {
		for (const table of [
			rows.users,
			rows.properties,
			rows.listings,
			rows.orders,
		]) {
			for (const row of table) {
				expect((row.createdAt as Date).getTime()).toBeLessThanOrEqual(
					NOW.getTime(),
				);
			}
		}
		const later = build(new Date(NOW.getTime() + 10 * DAY_MS));
		const first = later.users[0]?.createdAt as Date;
		expect(
			first.getTime() - (rows.users[0]?.createdAt as Date).getTime(),
		).toBe(10 * DAY_MS);
	});

	it('cùng đầu vào thì lượt xem và kết quả chọn giống nhau (chỉ mã ngẫu nhiên khác)', () => {
		const again = build();
		expect(again.listings.map((row) => row.viewCount)).toEqual(
			rows.listings.map((row) => row.viewCount),
		);
		expect(again.listings.map((row) => row.createdAt)).toEqual(
			rows.listings.map((row) => row.createdAt),
		);
		expect(again.favorites.map((row) => row.createdAt)).toEqual(
			rows.favorites.map((row) => row.createdAt),
		);
	});

	it('báo lỗi rõ khi thiếu phường, gói mẫu hoặc admin không cần (không dựng nửa chừng)', () => {
		const emptyWards = new Map<string, { name: string }>();
		expect(() =>
			buildDemoRows(
				{
					now: NOW,
					passwordHash: 'x',
					adminId: ADMIN_ID,
					wards: emptyWards,
					plans,
				},
				amenityNames,
			),
		).toThrow(/phường mã/);
		expect(() =>
			buildDemoRows(
				{
					now: NOW,
					passwordHash: 'x',
					adminId: ADMIN_ID,
					wards,
					plans: new Map(),
				},
				amenityNames,
			),
		).toThrow(/Thiếu gói mẫu/);
	});
});
