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
});
