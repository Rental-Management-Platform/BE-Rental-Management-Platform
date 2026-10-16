import {
	amenityRow,
	BEN_THANH,
	fee,
	propertyDetail,
	propertyListRow,
} from './properties.fixtures';
import { toPropertyListItem, toPropertyResponse } from './properties.mapper';

describe('toPropertyResponse (spec 0002, "Hình dạng trả về")', () => {
	it('trả đúng các trường của "Nhà trọ của chủ trọ", không lộ landlordId hay deletedAt', () => {
		const response = toPropertyResponse(propertyDetail());
		expect(Object.keys(response).sort()).toEqual([
			'addressText',
			'amenities',
			'createdAt',
			'fees',
			'fullAddress',
			'id',
			'latitude',
			'longitude',
			'name',
			'updatedAt',
			'ward',
		]);
	});

	it('ghép fullAddress đúng thứ tự, không có quận huyện (AC-16)', () => {
		const response = toPropertyResponse(propertyDetail());
		expect(response.fullAddress).toBe(
			'12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		);
		expect(response.fullAddress).not.toMatch(/quận|huyện/i);
		expect(response.addressText).toBe('12 Lê Lợi');
	});

	it('fullAddress đổi theo tên phường hiện tại, vì ghép lúc đọc', () => {
		const response = toPropertyResponse(
			propertyDetail({ ward: { ...BEN_THANH, name: 'Phường Sài Gòn' } }),
		);
		expect(response.fullAddress).toBe(
			'12 Lê Lợi, Phường Sài Gòn, Thành phố Hồ Chí Minh',
		);
		expect(response.ward.name).toBe('Phường Sài Gòn');
	});

	it('ward có đủ bốn trường và không lộ cột nội bộ', () => {
		expect(toPropertyResponse(propertyDetail()).ward).toEqual({
			code: '26743',
			name: 'Phường Bến Thành',
			provinceCode: '79',
			provinceName: 'Thành phố Hồ Chí Minh',
		});
	});

	it('phí theo thứ tự cố định electricity, water, internet, parking, service, other', () => {
		const response = toPropertyResponse(
			propertyDetail({
				fees: [
					fee('other', 50000, 'per_month'),
					fee('water', 20000, 'per_m3'),
					fee('service', 100000, 'per_month'),
					fee('electricity', 3500, 'per_kwh', 'Giá nhà nước'),
					fee('parking', 100000, 'per_vehicle_month'),
					fee('internet', 100000, 'per_month'),
				],
			}),
		);
		expect(response.fees.map((item) => item.kind)).toEqual([
			'electricity',
			'water',
			'internet',
			'parking',
			'service',
			'other',
		]);
		expect(response.fees[0]).toEqual({
			kind: 'electricity',
			price: 3500,
			unit: 'per_kwh',
			note: 'Giá nhà nước',
		});
	});

	it('ghi chú phí vắng thì trả null, không bao giờ chuỗi rỗng', () => {
		const response = toPropertyResponse(
			propertyDetail({ fees: [fee('water', 20000, 'per_m3')] }),
		);
		expect(response.fees[0]?.note).toBeNull();
	});

	it('tiện ích xếp theo tên tiếng Việt và chỉ gồm key và name', () => {
		const response = toPropertyResponse(
			propertyDetail({
				amenities: [
					amenityRow('wifi', 'Wifi'),
					amenityRow('air_conditioner', 'Máy lạnh'),
					amenityRow('loft', 'Gác lửng'),
					amenityRow('balcony', 'Ban công'),
				],
			}),
		);
		expect(response.amenities).toEqual([
			{ key: 'balcony', name: 'Ban công' },
			{ key: 'loft', name: 'Gác lửng' },
			{ key: 'air_conditioner', name: 'Máy lạnh' },
			{ key: 'wifi', name: 'Wifi' },
		]);
	});

	it('tọa độ trả nguyên số, hoặc null khi chưa có', () => {
		expect(toPropertyResponse(propertyDetail())).toMatchObject({
			latitude: null,
			longitude: null,
		});
		expect(
			toPropertyResponse(
				propertyDetail({ latitude: 10.7721, longitude: 106.6983 }),
			),
		).toMatchObject({ latitude: 10.7721, longitude: 106.6983 });
	});

	it('không đổi thứ tự mảng gốc của Prisma (không sort tại chỗ)', () => {
		const fees = [fee('other', 1, 'per_month'), fee('water', 2, 'per_m3')];
		toPropertyResponse(propertyDetail({ fees }));
		expect(fees.map((item) => item.kind)).toEqual(['other', 'water']);
	});
});

describe('toPropertyListItem', () => {
	it('thêm listingCount từ số tin chưa xóa', () => {
		const item = toPropertyListItem(propertyListRow(3));
		expect(item.listingCount).toBe(3);
		expect(item.fullAddress).toBe(
			'12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh',
		);
	});

	it('nhà trọ chưa có tin thì listingCount là 0', () => {
		expect(toPropertyListItem(propertyListRow(0)).listingCount).toBe(0);
	});
});
