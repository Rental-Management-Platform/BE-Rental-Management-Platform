import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type {
	AccountType as AccountTypeRow,
	Prisma,
} from '../generated/prisma/client';

/** Nơi duy nhất của module chạm bảng `account_types` (spec 0003). */
@Injectable()
export class AccountTypesRepository {
	constructor(private readonly prisma: PrismaService) {}

	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	findAll(tx?: Prisma.TransactionClient): Promise<AccountTypeRow[]> {
		return this.client(tx).accountType.findMany({
			orderBy: { key: 'asc' },
		});
	}

	findByKey(
		key: string,
		tx?: Prisma.TransactionClient,
	): Promise<AccountTypeRow | null> {
		return this.client(tx).accountType.findUnique({ where: { key } });
	}

	/** Thay toàn bộ danh sách quyền; trả `null` nếu không có loại đó. */
	async updatePermissions(
		key: string,
		permissions: readonly string[],
		tx?: Prisma.TransactionClient,
	): Promise<AccountTypeRow | null> {
		const client = this.client(tx);
		const result = await client.accountType.updateMany({
			where: { key },
			data: { permissions: [...permissions] },
		});
		if (result.count === 0) return null;
		return client.accountType.findUnique({ where: { key } });
	}
}
