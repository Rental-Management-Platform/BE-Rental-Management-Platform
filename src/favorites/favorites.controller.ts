import {
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { PaginationQueryDto } from '../common/pagination/pagination';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import type {
	FavoriteResultResponse,
	SavedListingResponse,
} from './dto/favorite.response';
import { FavoritesService } from './favorites.service';

/**
 * Lưu và bỏ lưu một tin (spec 0006 AC-1, AC-2). Không body: người lưu luôn là người trong token. Trả 200 (không phải
 * 201) vì gọi lại không tạo thêm gì. Mỗi API đếm giới hạn riêng (AC-8). Nội dung của người gọi nên không cho cache.
 */
@Controller('listings/:id/favorite')
export class ListingFavoritesController {
	constructor(private readonly favorites: FavoritesService) {}

	@Post()
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('favorite:create')
	@RateLimited('favoriteWrite')
	@Header('Cache-Control', 'private, no-store')
	save(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<FavoriteResultResponse> {
		return this.favorites.save(user, id, new Date());
	}

	@Delete()
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('favorite:delete')
	@RateLimited('favoriteWrite')
	@Header('Cache-Control', 'private, no-store')
	unsave(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<FavoriteResultResponse> {
		return this.favorites.unsave(user, id);
	}
}

/** Danh sách tin đã lưu của chính người gọi (spec 0006 AC-4). Dùng nhóm giới hạn công khai theo IP (AC-8). */
@Controller('me/favorites')
export class FavoritesController {
	constructor(private readonly favorites: FavoritesService) {}

	@Get()
	@RequirePermissions('favorite:read')
	@RateLimited('publicRead')
	@Header('Cache-Control', 'private, no-store')
	list(
		@CurrentUser() user: RequestUser,
		@Query() query: PaginationQueryDto,
	): Promise<Page<SavedListingResponse>> {
		return this.favorites.list(user, query, new Date());
	}
}
