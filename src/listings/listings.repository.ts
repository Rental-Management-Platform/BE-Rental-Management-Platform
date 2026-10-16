import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { escapeLike } from '../common/text/escape-like';
import { ListingCodeTakenError } from './listing-code';
import type { ListingSort, ListingStatus } from './listing-status';

/** Xóa mềm (spec 0005): mọi phương thức đọc `listings` đều thêm điều kiện này, trừ tên có `IncludingDeleted`. */
const notDeleted = { deletedAt: null } satisfies Prisma.ListingWhereInput;

/** Ảnh bìa của tin tóm tắt là ảnh có `position` nhỏ nhất. */
const coverImage = {
	orderBy: { position: 'asc' },
	take: 1,
} satisfies Prisma.Listing$imagesArgs;

const allImages = {
	orderBy: { position: 'asc' },
} satisfies Prisma.Listing$imagesArgs;

/** Phần nhà trọ của chi tiết: phường (kèm tỉnh), phí và tiện ích (kèm tên). */
const propertyDetail = {
	ward: true,
	fees: true,
	amenities: { include: { amenity: true } },
} satisfies Prisma.PropertyInclude;

const publicSummaryInclude = {
	property: {
		include: {
			ward: true,
			landlord: { select: { id: true, name: true } },
		},
	},
	images: coverImage,
} satisfies Prisma.ListingInclude;

const ownerSummaryInclude = {
	property: { include: { ward: true } },
	images: coverImage,
} satisfies Prisma.ListingInclude;

const publicDetailInclude = {
	property: {
		include: {
			...propertyDetail,
			landlord: { select: { id: true, name: true, phone: true } },
		},
	},
	images: allImages,
} satisfies Prisma.ListingInclude;

const ownerDetailInclude = {
	property: { include: propertyDetail },
	images: allImages,
} satisfies Prisma.ListingInclude;

export type PublicSummaryRow = Prisma.ListingGetPayload<{
	include: typeof publicSummaryInclude;
}>;
export type OwnerSummaryRow = Prisma.ListingGetPayload<{
	include: typeof ownerSummaryInclude;
}>;
export type PublicDetailRow = Prisma.ListingGetPayload<{
	include: typeof publicDetailInclude;
}>;
export type OwnerDetailRow = Prisma.ListingGetPayload<{
	include: typeof ownerDetailInclude;
}>;

export interface NewListing {
	readonly propertyId: string;
	readonly code: string;
	readonly title: string;
	readonly description: string;
	readonly price: number;
	readonly areaM2: number;
	readonly deposit: number | null;
	readonly availableFrom: Date | null;
	readonly searchKey: string;
}

/** Các cột của tin có thể đổi qua PATCH; cột nào vắng thì giữ nguyên. `searchKey` đi cùng `title`. */
export interface ListingChanges {
	title?: string;
	description?: string;
	price?: number;
	areaM2?: number;
	deposit?: number | null;
	availableFrom?: Date | null;
	searchKey?: string;
}

/** Bộ lọc của danh sách công khai; `searchWords` đã qua `toSearchKey` và đã cắt gọn. */
export interface PublicListFilter {
	readonly searchWords: readonly string[];
	readonly wardCode?: string;
	readonly minPrice?: number;
	readonly maxPrice?: number;
	readonly sort: ListingSort;
}

const ORDER_BY: Record<ListingSort, Prisma.ListingOrderByWithRelationInput[]> =
	{
		newest: [{ createdAt: 'desc' }, { id: 'desc' }],
		// Khóa phụ của hai kiểu giá chỉ là `id` (không phải `created_at`) để khớp đúng chỉ mục một phần (price, id).
		price_asc: [{ price: 'asc' }, { id: 'asc' }],
		price_desc: [{ price: 'desc' }, { id: 'desc' }],
	};

/**
 * Nơi duy nhất của module tin chạm bảng `listings` (spec 0002, spec 0005). Điều kiện hiển thị công khai
 * viết đúng một lần ở `visibleListingsQuery`; mọi truy vấn công khai đều đi qua nó.
 */
@Injectable()
export class ListingsRepository {
	constructor(private readonly prisma: PrismaService) {}

	private client(
		tx?: Prisma.TransactionClient,
	): Prisma.TransactionClient | PrismaService {
		return tx ?? this.prisma;
	}

	/**
	 * Điều kiện để một tin hiện ra công khai (spec 0002, "Điều kiện hiển thị công khai"): tin `visible` và chưa
	 * xóa mềm, nhà trọ chưa xóa mềm, chủ trọ đang hoạt động và chưa xóa mềm. Tính lúc đọc từ chính các cột đó,
	 * không có cờ sao chép, nên khóa tài khoản hay xóa mềm có hiệu lực ngay. Hàng 9 sẽ thêm vế "còn dùng thử
	 * hoặc có gói đang hiệu lực" đúng ở đây.
	 */
	visibleListingsQuery(): Prisma.ListingWhereInput {
		return {
			status: 'visible',
			...notDeleted,
			property: {
				deletedAt: null,
				landlord: { status: 'active', deletedAt: null },
			},
		};
	}

	/**
	 * Chèn tin mới (trạng thái `visible`, `view_count` 0 theo mặc định của cột). Trùng `code` thì ném
	 * `ListingCodeTakenError` (Prisma `P2002`; `code` là cột duy nhất người dùng không đặt, nên đây chỉ có thể là
	 * trùng mã) để Service sinh mã khác và thử lại bằng một giao dịch mới.
	 */
	async create(
		input: NewListing,
		tx: Prisma.TransactionClient,
	): Promise<string> {
		try {
			const { id } = await tx.listing.create({
				data: { ...input },
				select: { id: true },
			});
			return id;
		} catch (error: unknown) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === 'P2002'
			) {
				throw new ListingCodeTakenError({ cause: error });
			}
			throw error;
		}
	}

	// ----- đọc công khai -----

	/** Một trang tin công khai thỏa bộ lọc, kèm tổng số cùng điều kiện (hai câu chạy song song, không giao dịch). */
	async findPublicPage(
		filter: PublicListFilter,
		skip: number,
		take: number,
	): Promise<{ rows: PublicSummaryRow[]; total: number }> {
		const conditions: Prisma.ListingWhereInput[] = [
			this.visibleListingsQuery(),
			...filter.searchWords.map((word): Prisma.ListingWhereInput => ({
				searchKey: { contains: escapeLike(word) },
			})),
		];
		if (filter.wardCode !== undefined) {
			conditions.push({ property: { wardCode: filter.wardCode } });
		}
		if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
			conditions.push({
				price: { gte: filter.minPrice, lte: filter.maxPrice },
			});
		}
		const where: Prisma.ListingWhereInput = { AND: conditions };
		const [rows, total] = await Promise.all([
			this.prisma.listing.findMany({
				where,
				include: publicSummaryInclude,
				orderBy: ORDER_BY[filter.sort],
				skip,
				take,
			}),
			this.prisma.listing.count({ where }),
		]);
		return { rows, total };
	}

	/** Tin công khai theo mã ngắn, hoặc `null` nếu không có hay không hiển thị công khai (vì bất cứ lý do gì). */
	findPublicByCode(code: string): Promise<PublicDetailRow | null> {
		return this.prisma.listing.findFirst({
			where: { code, ...this.visibleListingsQuery() },
			include: publicDetailInclude,
		});
	}

	/**
	 * Cộng một lượt xem bằng một câu `UPDATE` nguyên tử (spec 0002 AC-13) và trả số lượt sau khi cộng, hoặc
	 * `null` nếu tin không còn `visible` (đã bị ẩn hay xóa ngay giữa lúc đọc và lúc cộng: không cộng).
	 */
	async incrementViewCount(id: string): Promise<number | null> {
		const rows = await this.prisma.$queryRaw<{ view_count: number }[]>`
      UPDATE listings
      SET view_count = view_count + 1
      WHERE id = ${id}::uuid AND status = 'visible' AND deleted_at IS NULL
      RETURNING view_count`;
		return rows[0]?.view_count ?? null;
	}

	// ----- đọc của chủ trọ -----

	/** Chủ của tin chưa xóa mềm (qua nhà trọ) và trạng thái hiện tại: đủ để kiểm chủ sở hữu trước khi ghi. */
	findOwnership(
		id: string,
		tx?: Prisma.TransactionClient,
	): Promise<{
		id: string;
		propertyId: string;
		status: string;
		property: { landlordId: string };
	} | null> {
		return this.client(tx).listing.findFirst({
			where: { id, ...notDeleted },
			select: {
				id: true,
				propertyId: true,
				status: true,
				property: { select: { landlordId: true } },
			},
		});
	}

	/** Trạng thái hiện tại của tin chưa xóa mềm, hoặc `null` nếu không có hay đã xóa. */
	async findStatus(id: string): Promise<string | null> {
		const row = await this.prisma.listing.findFirst({
			where: { id, ...notDeleted },
			select: { status: true },
		});
		return row?.status ?? null;
	}

	/** Chi tiết tin chưa xóa mềm cho chủ trọ, mọi trạng thái. Đọc ngoài giao dịch (nhiều quan hệ). */
	findOwnerDetail(id: string): Promise<OwnerDetailRow | null> {
		return this.prisma.listing.findFirst({
			where: { id, ...notDeleted },
			include: ownerDetailInclude,
		});
	}

	/** Tin chưa xóa mềm của một chủ trọ, mọi trạng thái, mới nhất trước; `status` lọc nếu có. */
	async findOwnedPage(
		landlordId: string,
		status: ListingStatus | undefined,
		skip: number,
		take: number,
	): Promise<{ rows: OwnerSummaryRow[]; total: number }> {
		const where: Prisma.ListingWhereInput = {
			...notDeleted,
			property: { landlordId },
			...(status === undefined ? {} : { status }),
		};
		const [rows, total] = await Promise.all([
			this.prisma.listing.findMany({
				where,
				include: ownerSummaryInclude,
				orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
				skip,
				take,
			}),
			this.prisma.listing.count({ where }),
		]);
		return { rows, total };
	}

	// ----- ghi của chủ trọ -----

	/** Sửa cột của tin chưa xóa mềm. Trả `false` nếu tin không còn (đã xóa mềm ngay giữa chừng). */
	async update(
		id: string,
		changes: ListingChanges,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).listing.updateMany({
			where: { id, ...notDeleted },
			data: { ...changes, updatedAt: new Date() },
		});
		return result.count === 1;
	}

	/** Xóa mềm tin chưa xóa. Trả `false` nếu tin không còn. Ảnh giữ nguyên. */
	async softDelete(id: string): Promise<boolean> {
		const result = await this.prisma.listing.updateMany({
			where: { id, ...notDeleted },
			data: { deletedAt: new Date() },
		});
		return result.count === 1;
	}

	/**
	 * Chuyển trạng thái bằng MỘT câu `updateMany` có điều kiện trạng thái nguồn nằm ngay trong câu lệnh (spec
	 * 0002, "State transitions"), không đọc trạng thái ra trước rồi mới ghi. `false` nghĩa là trạng thái không
	 * còn như dự định (hoặc tin đã xóa): người gọi phân biệt bằng `findStatus`.
	 */
	async transition(
		id: string,
		from: readonly ListingStatus[],
		to: ListingStatus,
		tx?: Prisma.TransactionClient,
	): Promise<boolean> {
		const result = await this.client(tx).listing.updateMany({
			where: { id, status: { in: [...from] }, ...notDeleted },
			data: { status: to, updatedAt: new Date() },
		});
		return result.count === 1;
	}

	// ----- dùng bởi module nhà trọ (mốc 2) -----

	/** Số tin chưa xóa mềm của một nhà trọ, mọi trạng thái (kể cả đang ẩn). */
	countLiveByProperty(
		propertyId: string,
		tx?: Prisma.TransactionClient,
	): Promise<number> {
		return this.client(tx).listing.count({
			where: { propertyId, ...notDeleted },
		});
	}

	/** Id và tiêu đề của mọi tin chưa xóa mềm thuộc nhà trọ: đủ để dựng lại `search_key` của từng tin. */
	findLiveTitlesByProperty(
		propertyId: string,
		tx?: Prisma.TransactionClient,
	): Promise<{ id: string; title: string }[]> {
		return this.client(tx).listing.findMany({
			where: { propertyId, ...notDeleted },
			select: { id: true, title: true },
			orderBy: { id: 'asc' },
		});
	}

	async setSearchKey(
		id: string,
		searchKey: string,
		tx?: Prisma.TransactionClient,
	): Promise<void> {
		await this.client(tx).listing.update({
			where: { id },
			data: { searchKey },
		});
	}
}
