import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PHONE_PATTERN } from '../../common/phone';
import { LISTING_LIMITS } from '../../listings/listing-status';
import { FEE_KINDS, PROPERTY_LIMITS } from '../../properties/property-fee';
import { loadAmenitySeed, loadWardSeed } from '../seed-data';
import { SEED_PLANS } from '../seed-plans';
import { demoEmail } from './demo-build';
import {
	DEMO_EMAIL_DOMAIN,
	DEMO_LANDLORDS,
	DEMO_LISTINGS,
	DEMO_PROPERTIES,
	DEMO_TENANTS,
	DEMO_TRIAL_DAYS,
} from './demo-data';

/**
 * Nội dung tĩnh của bộ demo phải vừa các giới hạn mà API và schema đang áp (độ dài, khoảng giá, mã phường, khóa
 * tiện ích...), nếu không `npm run seed:demo` sẽ ghi vào những dòng mà chính API sẽ từ chối khi sửa lại. Các con
 * số của từng kịch bản ở đây cũng là lời hứa với tài liệu FE: đổi dữ liệu thì phải đổi cả hai.
 */
describe('demo-data: vừa giới hạn của schema và API', () => {
	const wardCodes = new Set(loadWardSeed().map((ward) => ward.code));
	const amenityKeys = new Set(
		loadAmenitySeed().map((amenity) => amenity.key),
	);
	const landlordKeys = new Set(
		DEMO_LANDLORDS.map((landlord) => landlord.key),
	);
	const propertyKeys = new Set(
		DEMO_PROPERTIES.map((property) => property.key),
	);
	const planNames = new Set<string>(SEED_PLANS.map((plan) => plan.name));

	it('khóa, email và số điện thoại của tài khoản là duy nhất và đúng dạng', () => {
		const people = [...DEMO_LANDLORDS, ...DEMO_TENANTS];
		for (const list of [
			people.map((person) => person.key),
			people.map((person) => demoEmail(person.emailName)),
			DEMO_LANDLORDS.map((landlord) => landlord.phone),
		]) {
			expect(new Set(list).size).toBe(list.length);
		}
		for (const person of people) {
			expect(demoEmail(person.emailName)).toMatch(
				new RegExp(
					`^[a-z][a-z0-9.]*@${DEMO_EMAIL_DOMAIN.replace(/\./g, '\\.')}$`,
				),
			);
		}
		for (const landlord of DEMO_LANDLORDS) {
			expect(landlord.phone).toMatch(PHONE_PATTERN);
		}
		for (const tenant of DEMO_TENANTS) {
			if (tenant.phone !== undefined) {
				expect(tenant.phone).toMatch(PHONE_PATTERN);
			}
		}
	});

	it('nhà trọ: chủ trọ tồn tại, phường và tiện ích có trong danh mục, phí hợp lệ', () => {
		expect(propertyKeys.size).toBe(DEMO_PROPERTIES.length);
		for (const property of DEMO_PROPERTIES) {
			expect(landlordKeys.has(property.landlord)).toBe(true);
			expect(wardCodes.has(property.wardCode)).toBe(true);
			expect(property.name.length).toBeGreaterThanOrEqual(
				PROPERTY_LIMITS.nameMin,
			);
			expect(property.name.length).toBeLessThanOrEqual(
				PROPERTY_LIMITS.nameMax,
			);
			expect(property.addressText.length).toBeGreaterThanOrEqual(
				PROPERTY_LIMITS.addressMin,
			);
			expect(property.addressText.length).toBeLessThanOrEqual(
				PROPERTY_LIMITS.addressMax,
			);
			expect(property.latitude).toBeGreaterThanOrEqual(-90);
			expect(property.latitude).toBeLessThanOrEqual(90);
			expect(property.longitude).toBeGreaterThanOrEqual(-180);
			expect(property.longitude).toBeLessThanOrEqual(180);
			expect(new Set(property.amenities).size).toBe(
				property.amenities.length,
			);
			for (const key of property.amenities)
				expect(amenityKeys.has(key)).toBe(true);
			const kinds = property.fees.map((fee) => fee.kind);
			expect(new Set(kinds).size).toBe(kinds.length);
			expect(kinds.length).toBeLessThanOrEqual(FEE_KINDS.length);
			for (const fee of property.fees) {
				expect(fee.price).toBeGreaterThanOrEqual(0);
				expect(fee.price).toBeLessThanOrEqual(
					PROPERTY_LIMITS.feePriceMax,
				);
				expect((fee.note ?? '').length).toBeLessThanOrEqual(
					PROPERTY_LIMITS.feeNoteMax,
				);
			}
		}
	});

	it('tin: nhà trọ tồn tại, tiêu đề, giá, diện tích, cọc, ảnh nằm trong giới hạn', () => {
		for (const listing of DEMO_LISTINGS) {
			expect(propertyKeys.has(listing.property)).toBe(true);
			expect(listing.title.length).toBeGreaterThanOrEqual(
				LISTING_LIMITS.titleMin,
			);
			expect(listing.title.length).toBeLessThanOrEqual(
				LISTING_LIMITS.titleMax,
			);
			expect(listing.title).toBe(listing.title.trim());
			expect(listing.about.length).toBeGreaterThanOrEqual(
				LISTING_LIMITS.descriptionMin,
			);
			expect(listing.price).toBeGreaterThanOrEqual(
				LISTING_LIMITS.priceMin,
			);
			expect(listing.price).toBeLessThanOrEqual(LISTING_LIMITS.priceMax);
			expect(Number.isInteger(listing.price)).toBe(true);
			expect(listing.areaM2).toBeGreaterThanOrEqual(
				LISTING_LIMITS.areaMin,
			);
			expect(listing.areaM2).toBeLessThanOrEqual(LISTING_LIMITS.areaMax);
			expect(Math.round(listing.areaM2 * 10)).toBeCloseTo(
				listing.areaM2 * 10,
				6,
			);
			if (listing.deposit !== null) {
				expect(listing.deposit).toBeGreaterThanOrEqual(0);
				expect(listing.deposit).toBeLessThanOrEqual(
					LISTING_LIMITS.depositMax,
				);
			}
			if (listing.images !== undefined) {
				expect(listing.images).toBeGreaterThanOrEqual(0);
				expect(listing.images).toBeLessThanOrEqual(5);
			}
		}
		const titles = DEMO_LISTINGS.map((listing) => listing.title);
		expect(new Set(titles).size).toBe(titles.length);
	});

	it('thời gian hợp lý: đăng ký rồi mới có nhà trọ, nhà trọ rồi mới có tin, đơn sau lúc đăng ký', () => {
		for (const landlord of DEMO_LANDLORDS) {
			for (const order of landlord.orders) {
				expect(order.daysAgo).toBeLessThan(landlord.registeredDaysAgo);
				expect(planNames.has(order.plan)).toBe(true);
			}
			const pending = landlord.orders.filter(
				(order) => order.status === 'pending',
			);
			expect(pending.length).toBeLessThanOrEqual(1); // chỉ mục duy nhất một phần: một đơn chờ mỗi chủ trọ
			if (landlord.lock !== undefined) {
				expect(landlord.lock.daysAgo).toBeLessThan(
					landlord.registeredDaysAgo,
				);
			}
		}
		for (const property of DEMO_PROPERTIES) {
			const landlord = DEMO_LANDLORDS.find(
				(item) => item.key === property.landlord,
			);
			expect(property.ageDays).toBeLessThanOrEqual(
				landlord?.registeredDaysAgo ?? 0,
			);
			for (const listing of DEMO_LISTINGS.filter(
				(item) => item.property === property.key,
			)) {
				expect(listing.ageDays).toBeLessThanOrEqual(property.ageDays);
			}
		}
		for (const tenant of DEMO_TENANTS) {
			if (tenant.lock !== undefined) {
				expect(tenant.lock.daysAgo).toBeLessThan(
					tenant.registeredDaysAgo,
				);
			}
		}
	});

	it('tin bị admin ẩn có lý do và lúc ẩn; tin khác không có', () => {
		for (const listing of DEMO_LISTINGS) {
			if (listing.status === 'hidden_by_admin') {
				expect((listing.hiddenReason ?? '').length).toBeGreaterThan(0);
				expect((listing.hiddenReason ?? '').length).toBeLessThanOrEqual(
					500,
				);
				expect(listing.hiddenDaysAgo).toBeDefined();
				expect(listing.hiddenDaysAgo as number).toBeLessThanOrEqual(
					listing.ageDays,
				);
			} else {
				expect(listing.hiddenReason).toBeUndefined();
				expect(listing.hiddenDaysAgo).toBeUndefined();
			}
		}
	});

	it('người tìm trọ: theo dõi đúng chủ trọ có thật, nhà trọ ghim tồn tại, số tin lưu đủ chỗ cho phần ghim', () => {
		for (const tenant of DEMO_TENANTS) {
			for (const key of tenant.follows)
				expect(landlordKeys.has(key)).toBe(true);
			expect(new Set(tenant.follows).size).toBe(tenant.follows.length);
			for (const key of tenant.savedFrom ?? [])
				expect(propertyKeys.has(key)).toBe(true);
			expect(tenant.favorites).toBeGreaterThanOrEqual(
				(tenant.savedFrom ?? []).length,
			);
			expect(tenant.favorites).toBeLessThanOrEqual(DEMO_LISTINGS.length);
		}
	});

	it('số tin của từng kịch bản đúng như tài liệu FE hứa', () => {
		const countOf = (landlordKey: string, status?: string): number =>
			DEMO_LISTINGS.filter((listing) => {
				const property = DEMO_PROPERTIES.find(
					(item) => item.key === listing.property,
				);
				return (
					property?.landlord === landlordKey &&
					(status === undefined || listing.status === status)
				);
			}).length;
		expect(countOf('khoa', 'visible')).toBe(16);
		expect(countOf('khoa', 'hidden_by_owner')).toBe(1);
		expect(countOf('nhung', 'visible')).toBe(10);
		expect(countOf('nhung', 'hidden_by_admin')).toBe(1);
		expect(countOf('nhung', 'hidden_by_owner')).toBe(1);
		expect(countOf('bao', 'visible')).toBe(7);
		expect(countOf('phat', 'visible')).toBe(4);
		expect(countOf('tam', 'visible')).toBe(2);
		expect(countOf('tam', 'hidden_by_owner')).toBe(1);
		expect(countOf('mai', 'visible')).toBe(3);
		expect(countOf('huy', 'visible')).toBe(4);
		expect(countOf('lan', 'visible')).toBe(3);
		expect(countOf('ha')).toBe(0);
		expect(
			DEMO_PROPERTIES.filter((property) => property.landlord === 'khoa'),
		).toHaveLength(3);
		expect(
			DEMO_PROPERTIES.filter((property) => property.landlord === 'nhung'),
		).toHaveLength(3);
		expect(DEMO_TRIAL_DAYS).toBe(30);
	});

	it('tài liệu FE liệt kê mọi tài khoản demo (để FE biết đăng nhập bằng gì)', () => {
		const file = join(
			__dirname,
			'..',
			'..',
			'..',
			'docs',
			'api',
			'api-for-frontend.md',
		);
		if (!existsSync(file)) return; // bản sao không kèm docs thì bỏ qua
		const guide = readFileSync(file, 'utf8');
		for (const person of [...DEMO_LANDLORDS, ...DEMO_TENANTS]) {
			expect(guide).toContain(demoEmail(person.emailName));
		}
	});
});
