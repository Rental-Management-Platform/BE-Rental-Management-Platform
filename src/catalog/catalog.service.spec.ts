import type { Amenity, Ward } from '../generated/prisma/client';
import type { CatalogRepository } from './catalog.repository';
import { CatalogService } from './catalog.service';

const now = new Date('2026-10-14T00:00:00Z');

function ward(code: string, name: string): Ward {
	return {
		code,
		name,
		provinceCode: '79',
		provinceName: 'Thành phố Hồ Chí Minh',
		createdAt: now,
		updatedAt: now,
	};
}

function amenity(key: string, name: string): Amenity {
	return { key, name, createdAt: now, updatedAt: now };
}

function serviceWith(wards: Ward[], amenities: Amenity[] = []): CatalogService {
	const repository = {
		findAllWards: () => Promise.resolve(wards),
		findAllAmenities: () => Promise.resolve(amenities),
		findWardByCode: (code: string) =>
			Promise.resolve(wards.find((item) => item.code === code) ?? null),
		findExistingAmenityKeys: (keys: readonly string[]) =>
			Promise.resolve(
				amenities
					.map((item) => item.key)
					.filter((key) => keys.includes(key)),
			),
	} as unknown as CatalogRepository;
	return new CatalogService(repository);
}

describe('CatalogService', () => {
	describe('listWards', () => {
		it('trả đúng bốn trường, không lộ cột nội bộ', async () => {
			const [first] = await serviceWith([
				ward('26734', 'Phường Sài Gòn'),
			]).listWards();
			expect(first).toEqual({
				code: '26734',
				name: 'Phường Sài Gòn',
				provinceCode: '79',
				provinceName: 'Thành phố Hồ Chí Minh',
			});
		});

		it('xếp theo tên đầy đủ theo thứ tự chữ cái tiếng Việt', async () => {
			const names = (
				await serviceWith([
					ward('3', 'Xã Bình Chánh'),
					ward('2', 'Phường Tân Định'),
					ward('5', 'Đặc khu Côn Đảo'),
					ward('1', 'Phường Bến Thành'),
					ward('4', 'Phường An Lạc'),
				]).listWards()
			).map((item) => item.name);

			expect(names).toEqual([
				'Đặc khu Côn Đảo',
				'Phường An Lạc',
				'Phường Bến Thành',
				'Phường Tân Định',
				'Xã Bình Chánh',
			]);
		});

		it('trong cùng tên thì theo mã, kết quả ổn định', async () => {
			const result = await serviceWith([
				ward('20', 'Phường Hoà Hưng'),
				ward('10', 'Phường Hoà Hưng'),
			]).listWards();
			expect(result.map((item) => item.code)).toEqual(['10', '20']);
		});

		it('danh mục rỗng thì trả mảng rỗng', async () => {
			expect(await serviceWith([]).listWards()).toEqual([]);
		});
	});

	describe('listAmenities', () => {
		it('trả key và name, xếp theo tên tiếng Việt', async () => {
			const result = await serviceWith(
				[],
				[
					amenity('wifi', 'Wifi'),
					amenity('air_conditioner', 'Máy lạnh'),
					amenity('balcony', 'Ban công'),
					amenity('loft', 'Gác lửng'),
				],
			).listAmenities();
			expect(result).toEqual([
				{ key: 'balcony', name: 'Ban công' },
				{ key: 'loft', name: 'Gác lửng' },
				{ key: 'air_conditioner', name: 'Máy lạnh' },
				{ key: 'wifi', name: 'Wifi' },
			]);
		});
	});

	describe('findWard', () => {
		it('trả phường có trong danh mục và null cho mã lạ', async () => {
			const service = serviceWith([ward('26734', 'Phường Sài Gòn')]);
			expect((await service.findWard('26734'))?.name).toBe(
				'Phường Sài Gòn',
			);
			expect(await service.findWard('00000')).toBeNull();
		});
	});

	describe('findUnknownAmenityKeys', () => {
		const service = serviceWith(
			[],
			[amenity('wifi', 'Wifi'), amenity('loft', 'Gác lửng')],
		);

		it('mọi khóa đều có thì trả mảng rỗng', async () => {
			expect(
				await service.findUnknownAmenityKeys(['wifi', 'loft']),
			).toEqual([]);
		});

		it('trả đúng các khóa lạ, giữ thứ tự đã gửi', async () => {
			expect(
				await service.findUnknownAmenityKeys(['pool', 'wifi', 'sauna']),
			).toEqual(['pool', 'sauna']);
		});

		it('danh sách rỗng thì không cần hỏi DB', async () => {
			expect(await service.findUnknownAmenityKeys([])).toEqual([]);
		});
	});
});
