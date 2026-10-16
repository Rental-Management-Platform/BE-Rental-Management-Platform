import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;
/** Chặn `page` khổng lồ làm `OFFSET` vượt biên của PostgreSQL thành lỗi 500. */
export const MAX_PAGE = 1_000_000;

/** Trang trả về của mọi danh sách (spec 0002): `{ items, total, page, pageSize }`. */
export interface Page<T> {
	readonly items: readonly T[];
	readonly total: number;
	readonly page: number;
	readonly pageSize: number;
}

/** Query phân trang dùng chung: `page` từ 1, `pageSize` từ 1 đến 50, mặc định trang 1 và 20 dòng. */
export class PaginationQueryDto {
	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(MAX_PAGE)
	page: number = 1;

	@IsOptional()
	@Type(() => Number)
	@IsInt()
	@Min(1)
	@Max(MAX_PAGE_SIZE)
	pageSize: number = DEFAULT_PAGE_SIZE;
}

/** Số dòng cần bỏ qua (`skip`) cho Prisma. */
export function skipOf(
	query: Pick<PaginationQueryDto, 'page' | 'pageSize'>,
): number {
	return (query.page - 1) * query.pageSize;
}

export function toPage<T>(
	items: readonly T[],
	total: number,
	query: Pick<PaginationQueryDto, 'page' | 'pageSize'>,
): Page<T> {
	return { items, total, page: query.page, pageSize: query.pageSize };
}
