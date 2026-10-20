import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { toSearchKey } from '../common/text/to-search-key';
import type { Prisma } from '../generated/prisma/client';
import { ListingsRepository } from '../listings/listings.repository';
import { CatalogRepository } from './catalog.repository';
import type { CatalogDeleteResult } from './catalog.repository';
import { toAmenityResponse, toWardResponse } from './catalog.mapper';
import type { AmenityResponse, WardResponse } from './dto/catalog.response';

/**
 * Admin tạo, sửa tên và xóa phường và tiện ích (spec 0002 AC-2). Quyền `catalog:*` kiểm ở controller. Mã trùng
 * thì 409 `CATALOG_CODE_TAKEN`; xóa mục còn nhà trọ dùng (kể cả nhà trọ đã xóa mềm) thì 409 `CATALOG_IN_USE`; mục
 * không có thì 404 `NOT_FOUND`. Đổi tên phường là đường thứ ba cập nhật `search_key` của tin (spec 0002, "Key
 * invariants"): dựng lại khóa của mọi tin chưa xóa thuộc phường đó trong cùng giao dịch với việc đổi tên.
 */
@Injectable()
export class CatalogAdminService {
	constructor(
		private readonly repository: CatalogRepository,
		private readonly listings: ListingsRepository,
		private readonly transactions: TransactionRunner,
	) {}

	async createWard(input: {
		code: string;
		name: string;
		provinceCode: string;
		provinceName: string;
	}): Promise<WardResponse> {
		const created = await this.repository.createWard(input);
		if (created === null) {
			throw new AppException(ErrorCode.CATALOG_CODE_TAKEN);
		}
		return toWardResponse(created);
	}

	/**
	 * Sửa tên phường hoặc tên tỉnh. Chỉ khi `name` thật sự đổi mới dựng lại `search_key` (khóa chỉ chứa tên phường,
	 * không chứa tên tỉnh). Đọc tên cũ, ghi tên mới và dựng lại khóa nằm trong một giao dịch: nếu một bước lỗi thì
	 * tên phường và khóa tìm kiếm không bao giờ lệch nhau. Hai lần đổi tên đua nhau thì câu UPDATE thứ hai chờ khóa
	 * dòng `wards`, rồi dựng lại khóa theo tên cuối cùng.
	 */
	async updateWard(
		code: string,
		changes: { name?: string; provinceName?: string },
	): Promise<WardResponse> {
		const updated = await this.transactions.run(async (tx) => {
			const current = await this.repository.findWardByCode(code, tx);
			if (current === null) throw new AppException(ErrorCode.NOT_FOUND);
			const ward = await this.repository.updateWard(code, changes, tx);
			if (ward === null) throw new AppException(ErrorCode.NOT_FOUND);
			if (changes.name !== undefined && changes.name !== current.name) {
				await this.refreshSearchKeys(code, ward.name, tx);
			}
			return ward;
		});
		return toWardResponse(updated);
	}

	async deleteWard(code: string): Promise<void> {
		this.assertDeleted(await this.repository.deleteWard(code));
	}

	async createAmenity(input: {
		key: string;
		name: string;
	}): Promise<AmenityResponse> {
		const created = await this.repository.createAmenity(input);
		if (created === null) {
			throw new AppException(ErrorCode.CATALOG_CODE_TAKEN);
		}
		return toAmenityResponse(created);
	}

	async updateAmenity(key: string, name: string): Promise<AmenityResponse> {
		const updated = await this.repository.updateAmenity(key, name);
		if (updated === null) throw new AppException(ErrorCode.NOT_FOUND);
		return toAmenityResponse(updated);
	}

	async deleteAmenity(key: string): Promise<void> {
		this.assertDeleted(await this.repository.deleteAmenity(key));
	}

	private assertDeleted(result: CatalogDeleteResult): void {
		if (result === 'not_found') throw new AppException(ErrorCode.NOT_FOUND);
		if (result === 'in_use') {
			throw new AppException(ErrorCode.CATALOG_IN_USE);
		}
	}

	/**
	 * Dựng lại `search_key` của mọi tin chưa xóa mềm thuộc phường vừa đổi tên: `toSearchKey(tiêu đề, tên nhà trọ,
	 * địa chỉ, tên phường mới)`, đúng công thức của đăng tin và sửa nhà trọ. Lặp từng tin, chấp nhận ở quy mô demo.
	 * Một tin đang được đăng đúng lúc này có thể mang tên phường cũ trong khóa cho tới lần sửa kế tiếp (đọc tên
	 * phường không khóa dòng `wards`); lệch chỉ làm từ khóa tìm theo tên phường mới chưa khớp tin đó.
	 */
	private async refreshSearchKeys(
		wardCode: string,
		wardName: string,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const rows = await this.listings.findLiveForWard(wardCode, tx);
		for (const row of rows) {
			await this.listings.setSearchKey(
				row.id,
				toSearchKey(
					row.title,
					row.property.name,
					row.property.addressText,
					wardName,
				),
				tx,
			);
		}
	}
}
