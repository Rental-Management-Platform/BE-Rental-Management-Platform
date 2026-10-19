import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { Page, PaginationQueryDto } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import type { CreatePlanDto } from './dto/create-plan.dto';
import type { AdminPlanResponse, PlanResponse } from './dto/plan.response';
import type { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanInUseError, PlanNameTakenError } from './plan-errors';
import { toAdminPlanResponse, toPlanResponse } from './plans.mapper';
import { PlansRepository } from './plans.repository';
import type { PlanChanges } from './plans.repository';

/** Chỉ các cột gửi lên; cột nào không gửi thì không có trong kết quả (giữ nguyên ở DB). */
function changesOf(dto: UpdatePlanDto): PlanChanges {
	const changes: PlanChanges = {};
	if (dto.name !== undefined) changes.name = dto.name;
	if (dto.price !== undefined) changes.price = dto.price;
	if (dto.maxListings !== undefined) changes.maxListings = dto.maxListings;
	if (dto.durationDays !== undefined) changes.durationDays = dto.durationDays;
	if (dto.isActive !== undefined) changes.isActive = dto.isActive;
	return changes;
}

/**
 * Gói do admin quản lý và bảng giá công khai (spec 0004 AC-1, AC-2). Sửa hay tắt gói không đụng đơn đã có
 * (đơn giữ bản chốt của lúc tạo); xóa chỉ khi chưa có đơn nào tham chiếu.
 */
@Injectable()
export class PlansService {
	constructor(private readonly repository: PlansRepository) {}

	/** Bảng giá công khai: chỉ gói đang bán, giá tăng dần rồi theo tên. */
	async listPublic(query: PaginationQueryDto): Promise<Page<PlanResponse>> {
		const { rows, total } = await this.repository.findActivePage(
			skipOf(query),
			query.pageSize,
		);
		return toPage(rows.map(toPlanResponse), total, query);
	}

	/** Cho admin: cả gói đã tắt, cùng thứ tự với bảng giá. */
	async listAll(query: PaginationQueryDto): Promise<Page<AdminPlanResponse>> {
		const { rows, total } = await this.repository.findAllPage(
			skipOf(query),
			query.pageSize,
		);
		return toPage(rows.map(toAdminPlanResponse), total, query);
	}

	async create(dto: CreatePlanDto): Promise<AdminPlanResponse> {
		try {
			const plan = await this.repository.create({
				name: dto.name,
				price: dto.price,
				maxListings: dto.maxListings,
				durationDays: dto.durationDays,
				isActive: dto.isActive,
			});
			return toAdminPlanResponse(plan);
		} catch (error: unknown) {
			throw this.translate(error);
		}
	}

	async update(id: string, dto: UpdatePlanDto): Promise<AdminPlanResponse> {
		try {
			const plan = await this.repository.update(id, changesOf(dto));
			if (plan === null) throw new AppException(ErrorCode.PLAN_NOT_FOUND);
			return toAdminPlanResponse(plan);
		} catch (error: unknown) {
			throw this.translate(error);
		}
	}

	async remove(id: string): Promise<void> {
		try {
			if (!(await this.repository.remove(id))) {
				throw new AppException(ErrorCode.PLAN_NOT_FOUND);
			}
		} catch (error: unknown) {
			throw this.translate(error);
		}
	}

	/** Lỗi của Repository thành mã lỗi API; lỗi khác (kể cả `AppException` đã sẵn) đi tiếp nguyên vẹn. */
	private translate(error: unknown): unknown {
		if (error instanceof PlanNameTakenError) {
			return new AppException(ErrorCode.PLAN_NAME_TAKEN, [
				{
					field: 'name',
					code: ErrorCode.PLAN_NAME_TAKEN,
					message: 'Tên gói này đã có. Hãy chọn tên khác.',
				},
			]);
		}
		if (error instanceof PlanInUseError) {
			return new AppException(ErrorCode.PLAN_IN_USE);
		}
		return error;
	}
}
