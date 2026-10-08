import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, User } from '../generated/prisma/client';

export type NewUser = Pick<
	User,
	'email' | 'passwordHash' | 'name' | 'phone' | 'accountType'
>;
export type UserWithoutPassword = Omit<User, 'passwordHash'>;

/** Xóa mềm (spec 0005): mọi phương thức đọc `users` đều thêm điều kiện này, trừ tên có `IncludingDeleted`. */
const notDeleted = { deletedAt: null } satisfies Prisma.UserWhereInput;

/** `passwordHash` mặc định không được trả; chỉ đăng nhập mới cần đọc nó. */
const withoutPassword = { passwordHash: true } satisfies Prisma.UserOmit;

/** Nơi duy nhất của module users chạm vào Prisma (spec 0001 con). */
@Injectable()
export class UsersRepository {
	constructor(private readonly prisma: PrismaService) {}

	/** Có `tx` thì chạy trong giao dịch đó, không thì dùng kết nối thường. */
	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	create(
		input: NewUser,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithoutPassword> {
		return this.client(tx).user.create({
			data: input,
			omit: withoutPassword,
		});
	}

	findByEmailWithPassword(
		email: string,
		tx?: Prisma.TransactionClient,
	): Promise<User | null> {
		return this.client(tx).user.findFirst({
			where: { email, ...notDeleted },
		});
	}

	/** Tìm theo email, không lấy `passwordHash`: dùng khi chỉ cần biết người đó là ai (quên mật khẩu). */
	findByEmail(
		email: string,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithoutPassword | null> {
		return this.client(tx).user.findFirst({
			where: { email, ...notDeleted },
			omit: withoutPassword,
		});
	}

	findByIdWithPassword(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<User | null> {
		return this.client(tx).user.findFirst({
			where: { id, ...notDeleted },
		});
	}

	/** Đặt mật khẩu mới và ghi lại thời điểm đổi. Trả `false` nếu không còn người dùng (đã xóa mềm). */
	async updatePassword(
		id: string,
		passwordHash: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).user.updateMany({
			where: { id, ...notDeleted },
			data: { passwordHash, passwordChangedAt: new Date() },
		});
		return result.count === 1;
	}

	/** Kiểm email trùng lúc đăng ký: tính cả tài khoản đã xóa mềm vì chỉ mục duy nhất tính cả chúng. */
	async emailExistsIncludingDeleted(
		email: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const found = await this.client(tx).user.findFirst({
			where: { email },
			select: { id: true },
		});
		return found !== null;
	}

	/** Kiểm số điện thoại trùng giữa các tài khoản landlord, tính cả tài khoản đã xóa mềm (spec 0002 AC-13). */
	async landlordPhoneExistsIncludingDeleted(
		phone: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const found = await this.client(tx).user.findFirst({
			where: { phone, accountType: 'landlord' },
			select: { id: true },
		});
		return found !== null;
	}

	findById(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithoutPassword | null> {
		return this.client(tx).user.findFirst({
			where: { id, ...notDeleted },
			omit: withoutPassword,
		});
	}

	/** Khóa bằng một câu cập nhật có điều kiện: hai người khóa cùng lúc thì chỉ một người thắng. */
	async lockActive(
		id: string,
		reason: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).user.updateMany({
			where: { id, status: 'active', ...notDeleted },
			data: { status: 'locked', lockedReason: reason },
		});
		return result.count === 1;
	}

	/** Mở khóa đặt `lockedReason` về rỗng; lý do mở chỉ nằm ở moderation_logs. */
	async unlockLocked(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).user.updateMany({
			where: { id, status: 'locked', ...notDeleted },
			data: { status: 'active', lockedReason: null },
		});
		return result.count === 1;
	}
}
