import type { PrismaClient } from '../generated/prisma/client';

/** Ba gói mẫu của bảng giá (spec 0004 AC-12): Cơ bản 5 tin 99.000 đ, Nâng cao 15 tin 199.000 đ, Chuyên nghiệp 50 tin 399.000 đ. */
export const SEED_PLANS = [
	{ name: 'Cơ bản', price: 99_000, maxListings: 5, durationDays: 30 },
	{ name: 'Nâng cao', price: 199_000, maxListings: 15, durationDays: 30 },
	{
		name: 'Chuyên nghiệp',
		price: 399_000,
		maxListings: 50,
		durationDays: 30,
	},
] as const;

/**
 * Seed gói mẫu (spec 0004 AC-12). Chạy lại nhiều lần vẫn đúng: chỉ thêm gói còn thiếu theo `name` (`skipDuplicates`
 * là `ON CONFLICT DO NOTHING` trên `plans_name_unique`), không bao giờ ghi đè gói admin đã sửa giá hay số tin.
 * Hệ quả đã chấp nhận: gói mẫu admin đã xóa sẽ quay lại ở lần seed sau (như `amenities`).
 */
export async function seedPlans(prisma: PrismaClient): Promise<void> {
	const added = await prisma.plan.createMany({
		data: SEED_PLANS.map((plan) => ({ ...plan })),
		skipDuplicates: true,
	});

	console.log(
		`Gói mua: thêm ${added.count} gói mẫu mới, ${SEED_PLANS.length - added.count} đã có.`,
	);
}
