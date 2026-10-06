import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, User } from '../generated/prisma/client';

export type NewUser = Pick<User, 'email' | 'passwordHash' | 'name' | 'roles'>;
export type UserWithoutPassword = Omit<User, 'passwordHash'>;

/** Xóa mềm (spec 0005): mọi phương thức đọc `users` đều thêm điều kiện này. */
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

	findById(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<UserWithoutPassword | null> {
		return this.client(tx).user.findFirst({
			where: { id, ...notDeleted },
			omit: withoutPassword,
		});
	}
}
