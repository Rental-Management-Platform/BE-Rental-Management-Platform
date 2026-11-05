import type { PrismaClient } from '../generated/prisma/client';
import { loadAmenitySeed, loadWardBoundsSeed, loadWardSeed } from './seed-data';

/**
 * Seed danh mục phường và tiện ích (spec 0002 AC-1). Chạy lại nhiều lần vẫn đúng: chỉ thêm dòng còn thiếu
 * (`skipDuplicates` là `ON CONFLICT DO NOTHING`), không bao giờ ghi đè dòng admin đã sửa tên. Hệ quả đã
 * chấp nhận: mục mẫu admin đã xóa sẽ quay lại ở lần seed sau.
 *
 * Hộp bao của phường (spec 0012 AC-6) là ngoại lệ có chủ đích của quy ước "chỉ thêm dòng": dòng đã có mà ô hộp
 * còn rỗng thì được điền (phường seed từ trước khi có cột hộp). Ô đã có giá trị thì không bao giờ bị ghi đè, và
 * phường admin thêm (không có trong `ward-bounds.json`) giữ rỗng.
 */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
	const wards = loadWardSeed();
	const bounds = loadWardBoundsSeed();
	const amenities = loadAmenitySeed();

	const addedWards = await prisma.ward.createMany({
		data: wards,
		skipDuplicates: true,
	});
	let filledBounds = 0;
	for (const { code, ...box } of bounds) {
		// `CHECK wards_bounds_check` bắt bốn cột cùng rỗng hoặc cùng có, nên một cột rỗng nghĩa là cả bốn rỗng.
		const filled = await prisma.ward.updateMany({
			where: { code, minLatitude: null },
			data: box,
		});
		filledBounds += filled.count;
	}
	const addedAmenities = await prisma.amenity.createMany({
		data: amenities,
		skipDuplicates: true,
	});

	console.log(
		`Phường, xã: thêm ${addedWards.count} dòng mới, ${wards.length - addedWards.count} đã có (bộ dữ liệu có ${wards.length} dòng).`,
	);
	console.log(
		`Hộp phường: điền ${filledBounds} phường còn rỗng (bộ dữ liệu có ${bounds.length} hộp).`,
	);
	console.log(
		`Tiện ích: thêm ${addedAmenities.count} dòng mới, ${amenities.length - addedAmenities.count} đã có (bộ dữ liệu có ${amenities.length} dòng).`,
	);
}
