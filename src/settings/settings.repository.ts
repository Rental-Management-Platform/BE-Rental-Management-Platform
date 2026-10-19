import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Prisma, Setting } from '../generated/prisma/client';

/** Nơi duy nhất của module chạm bảng `settings` (spec 0003 dùng thử). */
@Injectable()
export class SettingsRepository {
	constructor(private readonly prisma: PrismaService) {}

	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	findAll(tx?: Prisma.TransactionClient): Promise<Setting[]> {
		return this.client(tx).setting.findMany({ orderBy: { key: 'asc' } });
	}

	findByKey(
		key: string,
		tx?: Prisma.TransactionClient,
	): Promise<Setting | null> {
		return this.client(tx).setting.findUnique({ where: { key } });
	}

	/** Đặt giá trị của một khóa; tạo dòng nếu chưa có (seed chưa chạy). Một câu nguyên tử nên hai admin cùng lúc không va nhau. */
	upsert(
		key: string,
		value: string,
		updatedBy: string,
		now: Date,
		tx?: Prisma.TransactionClient,
	): Promise<Setting> {
		return this.client(tx).setting.upsert({
			where: { key },
			create: { key, value, updatedAt: now, updatedBy },
			update: { value, updatedAt: now, updatedBy },
		});
	}
}
