import type { PrismaClient } from '../generated/prisma/client';
import {
	SETTING_DEFINITIONS,
	SETTING_KEYS,
} from '../settings/setting-definitions';

/**
 * Seed tham số hệ thống (spec 0003 dùng thử, AC-12). Chạy lại nhiều lần vẫn đúng: chỉ thêm dòng mặc định còn
 * thiếu (`skipDuplicates` là `ON CONFLICT DO NOTHING`), không bao giờ ghi đè dòng admin đã sửa.
 */
export async function seedSettings(prisma: PrismaClient): Promise<void> {
	const rows = SETTING_KEYS.map((key) => ({
		key,
		value: String(SETTING_DEFINITIONS[key].defaultValue),
	}));

	const added = await prisma.setting.createMany({
		data: rows,
		skipDuplicates: true,
	});

	console.log(
		`Tham số hệ thống: thêm ${added.count} dòng mặc định mới, ${rows.length - added.count} đã có.`,
	);
}
