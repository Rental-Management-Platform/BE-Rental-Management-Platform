import { Injectable } from '@nestjs/common';
import type { Prisma, Ward } from '../generated/prisma/client';
import { CatalogRepository } from './catalog.repository';
import { toAmenityResponse, toWardResponse } from './catalog.mapper';
import type { AmenityResponse, WardResponse } from './dto/catalog.response';

/** So sánh tên theo thứ tự chữ cái tiếng Việt (a, ă, â, b ... d, đ ...), không phụ thuộc collation của DB. */
const VIETNAMESE = new Intl.Collator('vi');

/**
 * Danh mục phường và tiện ích cho biểu mẫu (spec 0002 AC-1). Mới có phần đọc; phần admin tạo, sửa, xóa
 * thuộc cột mốc sau của cùng tính năng.
 */
@Injectable()
export class CatalogService {
	constructor(private readonly repository: CatalogRepository) {}

	/** Phường, xã, đặc khu xếp theo tên đầy đủ (kèm loại đơn vị), tên trùng thì theo mã. */
	async listWards(): Promise<WardResponse[]> {
		const rows = await this.repository.findAllWards();
		return rows
			.map(toWardResponse)
			.sort(
				(a, b) =>
					VIETNAMESE.compare(a.name, b.name) ||
					a.code.localeCompare(b.code),
			);
	}

	async listAmenities(): Promise<AmenityResponse[]> {
		const rows = await this.repository.findAllAmenities();
		return rows
			.map(toAmenityResponse)
			.sort(
				(a, b) =>
					VIETNAMESE.compare(a.name, b.name) ||
					a.key.localeCompare(b.key),
			);
	}

	/** Phường, xã, đặc khu theo mã, hoặc `null` nếu mã không có trong danh mục (nhà trọ kiểm trước khi lưu). */
	findWard(
		code: string,
		tx?: Prisma.TransactionClient,
	): Promise<Ward | null> {
		return this.repository.findWardByCode(code, tx);
	}

	/** Các khóa tiện ích không có trong danh mục, giữ nguyên thứ tự đã gửi; rỗng nghĩa là mọi khóa đều hợp lệ. */
	async findUnknownAmenityKeys(
		keys: readonly string[],
		tx?: Prisma.TransactionClient,
	): Promise<string[]> {
		if (keys.length === 0) return [];
		const known = new Set(
			await this.repository.findExistingAmenityKeys(keys, tx),
		);
		return keys.filter((key) => !known.has(key));
	}
}
