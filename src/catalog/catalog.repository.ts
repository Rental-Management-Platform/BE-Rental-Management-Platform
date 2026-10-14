import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import type { Amenity, Prisma, Ward } from '../generated/prisma/client';

/** Nơi duy nhất của module chạm các bảng `wards` và `amenities` (spec 0002, spec 0005). */
@Injectable()
export class CatalogRepository {
	constructor(private readonly prisma: PrismaService) {}

	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	/** Sắp theo mã cho ổn định; thứ tự theo tên tiếng Việt do Service làm (collation của DB không đáng tin cho dấu). */
	findAllWards(tx?: Prisma.TransactionClient): Promise<Ward[]> {
		return this.client(tx).ward.findMany({ orderBy: { code: 'asc' } });
	}

	findAllAmenities(tx?: Prisma.TransactionClient): Promise<Amenity[]> {
		return this.client(tx).amenity.findMany({ orderBy: { key: 'asc' } });
	}
}
