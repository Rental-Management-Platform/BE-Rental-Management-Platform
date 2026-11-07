import type { LandlordProfileResponse } from './dto/landlord-profile.response';
import type { LandlordRow } from './landlords.repository';

/**
 * Các số tính lúc đọc của hồ sơ: ba số của spec 0005 (AC-3 đến AC-5) và hai số đánh giá của spec 0014 (AC-1); không
 * số nào được lưu ở đâu cả.
 */
export interface LandlordCounts {
	readonly followerCount: number;
	readonly totalViewCount: number;
	readonly publicListingCount: number;
	readonly reviewCount: number;
	/** `null` khi `reviewCount` là 0. */
	readonly ratingAverage: number | null;
}

/** Chuỗi rỗng hoặc chỉ khoảng trắng trả `null`: tên trống không bao giờ là chuỗi rỗng (spec 0005 AC-1). */
function orNull(value: string | null): string | null {
	return value === null || value.trim() === '' ? null : value;
}

/**
 * Hồ sơ công khai từ dòng chủ trọ, các số đã tính và cờ theo dõi. Chọn từng trường một nên email, số điện thoại hay
 * bất cứ cột nào khác của `users` không thể lọt ra ngoài. `isFollowing` là `null` với khách (spec 0005 AC-1).
 */
export function toLandlordProfile(
	landlord: LandlordRow,
	counts: LandlordCounts,
	isFollowing: boolean | null,
): LandlordProfileResponse {
	return {
		id: landlord.id,
		name: orNull(landlord.name),
		joinedAt: landlord.createdAt,
		followerCount: counts.followerCount,
		totalViewCount: counts.totalViewCount,
		publicListingCount: counts.publicListingCount,
		reviewCount: counts.reviewCount,
		ratingAverage: counts.ratingAverage,
		isFollowing,
	};
}
