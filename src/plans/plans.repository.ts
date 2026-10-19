import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import type { Plan } from '../generated/prisma/client';
import { PlanInUseError, PlanNameTakenError } from './plan-errors';

/** Bảng giá và danh sách admin cùng một thứ tự: giá tăng dần, rồi tên (tên duy nhất nên thứ tự luôn xác định). */
const PLAN_ORDER = [
	{ price: 'asc' },
	{ name: 'asc' },
] satisfies Prisma.PlanOrderByWithRelationInput[];

export interface NewPlan {
	readonly name: string;
	readonly price: number;
	readonly maxListings: number;
	/** Vắng thì cột lấy mặc định 30. */
	readonly durationDays?: number;
	/** Vắng thì cột lấy mặc định `true`. */
	readonly isActive?: boolean;
}

/** Các cột của gói có thể đổi qua PATCH; cột nào vắng thì giữ nguyên. `updated_at` do Prisma (`@updatedAt`) đặt. */
export interface PlanChanges {
	name?: string;
	price?: number;
	maxListings?: number;
	durationDays?: number;
	isActive?: boolean;
}

function isPrismaError(error: unknown, code: string): boolean {
	return (
		error instanceof Prisma.PrismaClientKnownRequestError &&
		error.code === code
	);
}

/** Nơi duy nhất của module gói chạm bảng `plans` (spec 0004, spec 0005). */
@Injectable()
export class PlansRepository {
	constructor(private readonly prisma: PrismaService) {}

	/**
	 * Một gói theo id, hoặc `null` khi không có. Có `tx` thì đọc trong giao dịch đó (tạo đơn và thanh toán đọc
	 * gói trong chính giao dịch của mình, spec 0004 "Value sourcing").
	 */
	findById(id: string, tx?: Prisma.TransactionClient): Promise<Plan | null> {
		return (tx ?? this.prisma).plan.findUnique({ where: { id } });
	}

	/** Gói đang bán, kèm tổng số. Hai câu chạy song song nên dùng kết nối thường (mỗi câu một kết nối). */
	findActivePage(
		skip: number,
		take: number,
	): Promise<{ rows: Plan[]; total: number }> {
		return this.findPage({ isActive: true }, skip, take);
	}

	/** Mọi gói kể cả đã tắt, kèm tổng số. */
	findAllPage(
		skip: number,
		take: number,
	): Promise<{ rows: Plan[]; total: number }> {
		return this.findPage({}, skip, take);
	}

	private async findPage(
		where: Prisma.PlanWhereInput,
		skip: number,
		take: number,
	): Promise<{ rows: Plan[]; total: number }> {
		const [rows, total] = await Promise.all([
			this.prisma.plan.findMany({
				where,
				orderBy: PLAN_ORDER,
				skip,
				take,
			}),
			this.prisma.plan.count({ where }),
		]);
		return { rows, total };
	}

	/** Trùng `name` thì ném `PlanNameTakenError` (Prisma `P2002`; `name` là cột duy nhất admin đặt). */
	async create(input: NewPlan): Promise<Plan> {
		try {
			return await this.prisma.plan.create({ data: { ...input } });
		} catch (error: unknown) {
			if (isPrismaError(error, 'P2002')) {
				throw new PlanNameTakenError({ cause: error });
			}
			throw error;
		}
	}

	/**
	 * Một câu `UPDATE` nguyên tử, trả gói sau khi sửa hoặc `null` khi không có gói (Prisma `P2025`). Trùng tên
	 * thì ném `PlanNameTakenError`.
	 */
	async update(id: string, changes: PlanChanges): Promise<Plan | null> {
		try {
			return await this.prisma.plan.update({
				where: { id },
				data: changes,
			});
		} catch (error: unknown) {
			if (isPrismaError(error, 'P2025')) return null;
			if (isPrismaError(error, 'P2002')) {
				throw new PlanNameTakenError({ cause: error });
			}
			throw error;
		}
	}

	/**
	 * Xóa gói. Trả `true` khi đã xóa, `false` khi không có gói. Gói đã có đơn thì khóa ngoại `RESTRICT` chặn
	 * (Prisma `P2003`) và ném `PlanInUseError`: để DB quyết định nên không có khe hở giữa việc đếm đơn và xóa.
	 */
	async remove(id: string): Promise<boolean> {
		try {
			await this.prisma.plan.delete({ where: { id } });
			return true;
		} catch (error: unknown) {
			if (isPrismaError(error, 'P2025')) return false;
			if (isPrismaError(error, 'P2003')) {
				throw new PlanInUseError({ cause: error });
			}
			throw error;
		}
	}
}
