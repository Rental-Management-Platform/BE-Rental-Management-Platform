import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { User } from '../generated/prisma/client';

/** Phần của dòng `users` mà hồ sơ công khai cần: không email, không số điện thoại. */
export type LandlordRow = Pick<User, 'id' | 'name' | 'createdAt'>;

/**
 * Nơi duy nhất của module chủ trọ chạm bảng `follows`, và tra chủ trọ hợp lệ trong `users` (spec 0005). Hai số
 * còn lại của hồ sơ (tổng lượt xem, số tin đang hiện) nằm ở `ListingsRepository` vì chúng đọc bảng `listings`.
 */
@Injectable()
export class LandlordsRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Chủ trọ hợp lệ theo id, hoặc `null`: dòng `users` có `account_type = 'landlord'`, `status = 'active'` và chưa
	 * xóa mềm. Không có, là `tenant` hay `admin`, bị khóa hay đã xóa mềm đều là `null`.
	 */
	findActiveLandlord(id: string): Promise<LandlordRow | null> {
		return this.prisma.user.findFirst({
			where: {
				id,
				accountType: 'landlord',
				status: 'active',
				deletedAt: null,
			},
			select: { id: true, name: true, createdAt: true },
		});
	}

	/**
	 * Số người theo dõi một chủ trọ, chỉ tính tài khoản đang hoạt động (`status = 'active'`, chưa xóa mềm); mỗi
	 * người một lần nhờ khóa chính (spec 0005 AC-3). Khóa hay xóa mềm người theo dõi làm số giảm ngay mà không động
	 * đến dòng `follows`, mở khóa thì số quay lại.
	 */
	countActiveFollowers(landlordId: string): Promise<number> {
		return this.prisma.follow.count({
			where: { landlordId, user: { status: 'active', deletedAt: null } },
		});
	}

	/** Người này có đang theo dõi chủ trọ không: có dòng `follows` cho cặp (userId, landlordId). */
	async isFollowing(userId: string, landlordId: string): Promise<boolean> {
		const row = await this.prisma.follow.findUnique({
			where: { userId_landlordId: { userId, landlordId } },
			select: { userId: true },
		});
		return row !== null;
	}

	/**
	 * Ghi dòng theo dõi bằng một câu `INSERT ... ON CONFLICT DO NOTHING` (`createMany` với `skipDuplicates`): cặp đã
	 * có thì không làm gì và không lỗi, nên bấm lặp hay hai lần gọi đồng thời vẫn ra đúng một dòng (spec 0005 AC-6).
	 */
	async addFollow(userId: string, landlordId: string): Promise<void> {
		await this.prisma.follow.createMany({
			data: [{ userId, landlordId }],
			skipDuplicates: true,
		});
	}

	/** Xóa dòng theo dõi của đúng cặp; không có dòng nào thì không làm gì và không lỗi (spec 0005 AC-7). */
	async removeFollow(userId: string, landlordId: string): Promise<void> {
		await this.prisma.follow.deleteMany({ where: { userId, landlordId } });
	}
}
