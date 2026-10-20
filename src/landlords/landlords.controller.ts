import { Controller, Get, Header, Param } from '@nestjs/common';
import { OptionalUser } from '../common/auth/current-user.decorator';
import { OptionalAuth } from '../common/auth/optional-auth.decorator';
import { uuidParam } from '../common/errors/create-validation-pipe';
import type { RequestUser } from '../common/http/authenticated-request';
import { RateLimited } from '../common/rate-limit/rate-limited.decorator';
import type { LandlordProfileResponse } from './dto/landlord-profile.response';
import { LandlordsService } from './landlords.service';

/** Hồ sơ công khai của chủ trọ (spec 0005 AC-1, AC-2). */
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
}
