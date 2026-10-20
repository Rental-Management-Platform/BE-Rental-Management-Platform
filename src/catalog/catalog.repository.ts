import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Amenity, Ward } from '../generated/prisma/client';

/** Kết quả xóa một mục danh mục: xóa được, không có, hay còn nhà trọ dùng (khóa ngoại RESTRICT chặn). */
export type CatalogDeleteResult = 'deleted' | 'not_found' | 'in_use';

/** Mã lỗi Prisma cho: trùng khóa duy nhất, dòng không tồn tại, vi phạm khóa ngoại. */
function isKnownError(error: unknown, code: 'P2002' | 'P2025' | 'P2003') {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === code
	);
}

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

	findWardByCode(
		code: string,
		tx?: Prisma.TransactionClient,
	): Promise<Ward | null> {
		return this.client(tx).ward.findUnique({ where: { code } });
	}

	findAmenityByKey(
		key: string,
		tx?: Prisma.TransactionClient,
	): Promise<Amenity | null> {
		return this.client(tx).amenity.findUnique({ where: { key } });
	}

	// ----- ghi của admin (spec 0002 AC-2) -----

	/** Tạo phường. `null` nghĩa là mã đã có (`P2002` trên khóa chính); không kiểm trước vì vẫn đua giữa hai request. */
	async createWard(data: {
		code: string;
		name: string;
		provinceCode: string;
		provinceName: string;
	}): Promise<Ward | null> {
		try {
			return await this.prisma.ward.create({ data });
		} catch (error: unknown) {
			if (isKnownError(error, 'P2002')) return null;
			throw error;
		}
	}

	/** Sửa tên phường. `null` nghĩa là phường không còn (`P2025`). Trường vắng thì giữ nguyên. */
	async updateWard(
		code: string,
		changes: { name?: string; provinceName?: string },
		tx?: Prisma.TransactionClient,
	): Promise<Ward | null> {
		try {
			return await this.client(tx).ward.update({
				where: { code },
				data: changes,
			});
		} catch (error: unknown) {
			if (isKnownError(error, 'P2025')) return null;
			throw error;
		}
	}

	/**
	 * Xóa phường. Nguồn sự thật cho "còn nhà trọ dùng" là khóa ngoại `properties.ward_code` RESTRICT của DB (tính cả
	 * nhà trọ đã xóa mềm vì dòng vẫn còn), nên không đếm trước: hai request đua nhau vẫn ra đúng `in_use`, không 500.
	 */
	async deleteWard(code: string): Promise<CatalogDeleteResult> {
		try {
			await this.prisma.ward.delete({ where: { code } });
			return 'deleted';
		} catch (error: unknown) {
			if (isKnownError(error, 'P2025')) return 'not_found';
			if (isKnownError(error, 'P2003')) return 'in_use';
			throw error;
		}
	}

	/** Tạo tiện ích. `null` nghĩa là khóa đã có. */
	async createAmenity(data: {
		key: string;
		name: string;
	}): Promise<Amenity | null> {
		try {
			return await this.prisma.amenity.create({ data });
		} catch (error: unknown) {
			if (isKnownError(error, 'P2002')) return null;
			throw error;
		}
	}

	/** Sửa tên tiện ích. `null` nghĩa là tiện ích không còn. */
	async updateAmenity(key: string, name: string): Promise<Amenity | null> {
		try {
			return await this.prisma.amenity.update({
				where: { key },
				data: { name },
			});
		} catch (error: unknown) {
			if (isKnownError(error, 'P2025')) return null;
			throw error;
		}
	}

	/** Xóa tiện ích; còn nhà trọ dùng thì khóa ngoại `property_amenities.amenity_key` RESTRICT chặn (xem `deleteWard`). */
	async deleteAmenity(key: string): Promise<CatalogDeleteResult> {
		try {
			await this.prisma.amenity.delete({ where: { key } });
			return 'deleted';
		} catch (error: unknown) {
			if (isKnownError(error, 'P2025')) return 'not_found';
			if (isKnownError(error, 'P2003')) return 'in_use';
			throw error;
		}
	}

	/** Trong các khóa đã cho, những khóa có thật trong danh mục (đầu vào của việc tìm khóa lạ). */
	async findExistingAmenityKeys(
		keys: readonly string[],
		tx?: Prisma.TransactionClient,
	): Promise<string[]> {
		const rows = await this.client(tx).amenity.findMany({
			where: { key: { in: [...keys] } },
			select: { key: true },
		});
		return rows.map((row) => row.key);
	}
}
