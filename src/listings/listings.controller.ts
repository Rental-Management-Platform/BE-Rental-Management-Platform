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
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import { CreateListingDto } from './dto/create-listing.dto';
import type {
	ListingDetailResponse,
	OwnerListingDetailResponse,
	OwnerListingSummaryResponse,
	PublicListingSummaryResponse,
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
		return this.listings.create(user, propertyId, dto, new Date());
	}
}

/**
 * Đọc tin công khai (khách cũng xem được) và các thao tác của chủ tin lên một tin cụ thể (spec 0002 AC-6, AC-7,
 * AC-10 đến AC-13). Quyền `listing:*` là quyền của chủ sở hữu: Service kiểm đúng chủ.
 */
@Controller('listings')
export class ListingsController {
	constructor(private readonly listings: ListingsService) {}

	/**
	 * Công khai nhưng đọc đăng nhập tùy chọn: khách, token sai hay hết hạn nhận 200 với `isFavorite: null`, không bao
	 * giờ 401. Nội dung đổi theo người xem (cờ `isFavorite`, spec 0006 AC-6) nên không cho cache dùng chung.
	 */
	@OptionalAuth()
	@RateLimited('publicRead')
	@Header('Cache-Control', 'private, no-store')
	@Get()
	list(
		@Query() query: ListListingsQueryDto,
		@OptionalUser() user: RequestUser | undefined,
	): Promise<Page<PublicListingSummaryResponse>> {
		return this.listings.listPublic(query, user?.userId, new Date());
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
		return this.listings.getPublicDetail(
			slugCode,
			{ userId: user?.userId, ip: req.ip ?? 'unknown' },
			new Date(),
		);
	}

	@Patch(':id')
	@RequirePermissions('listing:update')
	@RateLimited('listingWrite')
	update(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
		@Body() dto: UpdateListingDto,
	): Promise<OwnerListingDetailResponse> {
		return this.listings.update(user, id, dto, new Date());
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
		return this.listings.hide(user, id, new Date());
	}

	@Post(':id/show')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('listing:update')
	@RateLimited('listingWrite')
	show(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<OwnerListingDetailResponse> {
		return this.listings.show(user, id, new Date());
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
		return this.listings.listOwn(user, query, new Date());
	}

	@Get(':id')
	@RequirePermissions('listing:read')
	get(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<OwnerListingDetailResponse> {
		return this.listings.getOwn(user, id, new Date());
	}
}
