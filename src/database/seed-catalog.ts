import type { PrismaClient } from '../generated/prisma/client';
import { loadAmenitySeed, loadWardSeed } from './seed-data';

/**
 * Seed danh mục phường và tiện ích (spec 0002 AC-1). Chạy lại nhiều lần vẫn đúng: chỉ thêm dòng còn thiếu
 * (`skipDuplicates` là `ON CONFLICT DO NOTHING`), không bao giờ ghi đè dòng admin đã sửa tên. Hệ quả đã
 * chấp nhận: mục mẫu admin đã xóa sẽ quay lại ở lần seed sau.
 */
export async function seedCatalog(prisma: PrismaClient): Promise<void> {
	const wards = loadWardSeed();
	const amenities = loadAmenitySeed();

	const addedWards = await prisma.ward.createMany({
		data: wards,
		skipDuplicates: true,
	});
	const addedAmenities = await prisma.amenity.createMany({
		data: amenities,
		skipDuplicates: true,
	});

	console.log(
		`Phường, xã: thêm ${addedWards.count} dòng mới, ${wards.length - addedWards.count} đã có (bộ dữ liệu có ${wards.length} dòng).`,
	);
	console.log(
		`Tiện ích: thêm ${addedAmenities.count} dòng mới, ${amenities.length - addedAmenities.count} đã có (bộ dữ liệu có ${amenities.length} dòng).`,
	);
}
