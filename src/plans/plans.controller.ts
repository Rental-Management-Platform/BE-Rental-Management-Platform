import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
} from '@nestjs/common';
import { FreshAuth } from '../common/auth/fresh-auth.decorator';
import { Public } from '../common/auth/public.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import { PaginationQueryDto } from '../common/pagination/pagination';
import type { Page } from '../common/pagination/pagination';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { CreatePlanDto } from './dto/create-plan.dto';
import type { AdminPlanResponse, PlanResponse } from './dto/plan.response';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService } from './plans.service';

/**
 * Bảng giá công khai và quản lý gói của admin (spec 0004 AC-1, AC-2). Chỉ admin giữ quyền `plan:*`. Ba lệnh ghi
 * có `@FreshAuth()` vì giá và số tin của gói quyết định ai được đăng bao nhiêu tin: admin vừa bị khóa hay mất
 * quyền bị từ chối ngay dù token còn hạn. Lệnh ghi của admin không có giới hạn tần suất thêm.
 */
@Controller('plans')
export class PlansController {
	constructor(private readonly plans: PlansService) {}

	/** Công khai: khách chưa đăng nhập cũng xem được bảng giá. */
	@Public()
	@RateLimited('publicRead')
	@Get()
	listPublic(
		@Query() query: PaginationQueryDto,
	): Promise<Page<PlanResponse>> {
		return this.plans.listPublic(query);
	}

	@Get('all')
	@RequirePermissions('plan:read')
	listAll(
		@Query() query: PaginationQueryDto,
	): Promise<Page<AdminPlanResponse>> {
		return this.plans.listAll(query);
	}

	@Post()
	@RequirePermissions('plan:create')
	@FreshAuth()
	create(@Body() dto: CreatePlanDto): Promise<AdminPlanResponse> {
		return this.plans.create(dto);
	}

	@Patch(':id')
	@RequirePermissions('plan:update')
	@FreshAuth()
	update(
		@Param('id', uuidParam()) id: string,
		@Body() dto: UpdatePlanDto,
	): Promise<AdminPlanResponse> {
		return this.plans.update(id, dto);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequirePermissions('plan:delete')
	@FreshAuth()
	remove(@Param('id', uuidParam()) id: string): Promise<void> {
		return this.plans.remove(id);
	}
}
