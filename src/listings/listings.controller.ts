import {
	Body,
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Patch,
	Post,
	Query,
	Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
	CurrentUser,
	OptionalUser,
} from '../common/auth/current-user.decorator';
import { OptionalAuth } from '../common/auth/optional-auth.decorator';
import { Public } from '../common/auth/public.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { CreateListingDto } from './dto/create-listing.dto';
import type {
	ListingDetailResponse,
	ListingSummaryResponse,
	OwnerListingDetailResponse,
	OwnerListingSummaryResponse,
} from './dto/listing.response';
import {
	ListListingsQueryDto,
	MyListingsQueryDto,
} from './dto/listing-queries.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingsService } from './listings.service';

/** Đăng tin vào nhà trọ của mình (spec 0002 AC-5). Tin hiện ngay, không nháp, không duyệt. */
@Controller('properties/:propertyId/listings')
export class PropertyListingsController {
	constructor(private readonly listings: ListingsService) {}

	@Post()
	@RequirePermissions('listing:create')
	@RateLimited('listingWrite')
	create(
		@CurrentUser() user: RequestUser,
		@Param('propertyId', uuidParam()) propertyId: string,
		@Body() dto: CreateListingDto,
	): Promise<OwnerListingDetailResponse> {
		return this.listings.create(user, propertyId, dto);
	}
}

/**
 * Đọc tin công khai (khách cũng xem được) và các thao tác của chủ tin lên một tin cụ thể (spec 0002 AC-6, AC-7,
 * AC-10 đến AC-13). Quyền `listing:*` là quyền của chủ sở hữu: Service kiểm đúng chủ.
 */
@Controller('listings')
export class ListingsController {
	constructor(private readonly listings: ListingsService) {}

	@Public()
	@RateLimited('publicRead')
	@Get()
	list(
		@Query() query: ListListingsQueryDto,
	): Promise<Page<ListingSummaryResponse>> {
		return this.listings.listPublic(query);
	}

	/**
	 * Công khai nhưng đọc đăng nhập tùy chọn: có access token hợp lệ thì thấy số điện thoại, khách hay token sai
	 * thì `phone: null` và vẫn 200. Nội dung đổi theo người xem nên không cho cache dùng chung.
	 */
	@OptionalAuth()
	@RateLimited('publicDetail')
	@Header('Cache-Control', 'private, no-store')
	@Get(':slugCode')
	detail(
		@Param('slugCode') slugCode: string,
		@OptionalUser() user: RequestUser | undefined,
		@Req() req: Request,
	): Promise<ListingDetailResponse> {
		return this.listings.getPublicDetail(slugCode, {
			userId: user?.userId,
			ip: req.ip ?? 'unknown',
		});
	}

	@Patch(':id')
	@RequirePermissions('listing:update')
	@RateLimited('listingWrite')
	update(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: UpdateListingDto,
	): Promise<OwnerListingDetailResponse> {
		return this.listings.update(user, id, dto);
	}

	@Delete(':id')
	@HttpCode(HttpStatus.NO_CONTENT)
	@RequirePermissions('listing:delete')
	@RateLimited('listingWrite')
	remove(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<void> {
		return this.listings.remove(user, id);
	}

	@Post(':id/hide')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('listing:update')
	@RateLimited('listingWrite')
	hide(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<OwnerListingDetailResponse> {
		return this.listings.hide(user, id);
	}

	@Post(':id/show')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('listing:update')
	@RateLimited('listingWrite')
	show(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<OwnerListingDetailResponse> {
		return this.listings.show(user, id);
	}
}

/** Tin của chính chủ trọ ở mọi trạng thái, kể cả đang ẩn (spec 0002 AC-14). */
@Controller('me/listings')
export class MyListingsController {
	constructor(private readonly listings: ListingsService) {}

	@Get()
	@RequirePermissions('listing:read')
	list(
		@CurrentUser() user: RequestUser,
		@Query() query: MyListingsQueryDto,
	): Promise<Page<OwnerListingSummaryResponse>> {
		return this.listings.listOwn(user, query);
	}

	@Get(':id')
	@RequirePermissions('listing:read')
	get(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<OwnerListingDetailResponse> {
		return this.listings.getOwn(user, id);
	}
}
