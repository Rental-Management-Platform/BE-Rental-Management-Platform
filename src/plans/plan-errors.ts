/**
 * Lỗi nghiệp vụ của Repository `plans`. Chỉ `*.repository.ts` được import giá trị từ Prisma nên Repository bắt
 * lỗi của Prisma và ném các lớp này; Service đổi chúng thành `AppException`.
 */

/** Tên gói đã có gói khác dùng (chỉ mục duy nhất `plans_name_unique`, Prisma `P2002`). */
export class PlanNameTakenError extends Error {
	constructor(options?: { cause?: unknown }) {
		super('Tên gói đã tồn tại.', options);
		this.name = 'PlanNameTakenError';
	}
}

/** Gói đã có đơn tham chiếu (khóa ngoại `orders_plan_id_fk` là `RESTRICT`, Prisma `P2003`). */
export class PlanInUseError extends Error {
	constructor(options?: { cause?: unknown }) {
		super('Gói đã có đơn tham chiếu.', options);
		this.name = 'PlanInUseError';
	}
}
