import {
	Controller,
	Delete,
	Get,
	Header,
	HttpCode,
	HttpStatus,
	Param,
	Post,
} from '@nestjs/common';
import {
	CurrentUser,
	OptionalUser,
} from '../common/auth/current-user.decorator';
import { OptionalAuth } from '../common/auth/optional-auth.decorator';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import type { LandlordProfileResponse } from './dto/landlord-profile.response';
import { LandlordsService } from './landlords.service';

/** Hồ sơ công khai của chủ trọ và theo dõi, bỏ theo dõi (spec 0005). */
@Controller('landlords')
export class LandlordsController {
	constructor(private readonly landlords: LandlordsService) {}

	/**
	 * Công khai nhưng đọc đăng nhập tùy chọn: khách, token sai hay hết hạn đều nhận 200 với `isFollowing: null`,
	 * không bao giờ 401. Nội dung đổi theo người xem nên không cho cache dùng chung.
	 */
	@OptionalAuth()
	@RateLimited('publicRead')
	@Header('Cache-Control', 'private, no-store')
	@Get(':id')
	get(
		@Param('id', uuidParam()) id: string,
		@OptionalUser() user: RequestUser | undefined,
	): Promise<LandlordProfileResponse> {
		return this.landlords.getProfile(id, user?.userId, new Date());
	}

	/**
	 * Theo dõi: không body, người theo dõi luôn là người trong token. Trả 200 (không phải 201) vì gọi lại không tạo
	 * thêm gì, kèm hồ sơ mới để FE cập nhật nút trong một lần gọi. Mỗi API đếm giới hạn riêng (spec 0005 AC-9).
	 */
	@Post(':id/follow')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('follow:create')
	@RateLimited('followWrite')
	@Header('Cache-Control', 'private, no-store')
	follow(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<LandlordProfileResponse> {
		return this.landlords.follow(user, id, new Date());
	}

	/** Bỏ theo dõi: cùng hình dạng trả về, chưa theo dõi cũng 200. */
	@Delete(':id/follow')
	@HttpCode(HttpStatus.OK)
	@RequirePermissions('follow:delete')
	@RateLimited('followWrite')
	@Header('Cache-Control', 'private, no-store')
	unfollow(
		@CurrentUser() user: RequestUser,
		@Param('id', uuidParam()) id: string,
	): Promise<LandlordProfileResponse> {
		return this.landlords.unfollow(user, id, new Date());
	}
}
