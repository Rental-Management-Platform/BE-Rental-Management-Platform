import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { ListingsRepository } from '../listings/listings.repository';
import { SettingsService } from '../settings/settings.service';
import type { LandlordProfileResponse } from './dto/landlord-profile.response';
import { toLandlordProfile } from './landlords.mapper';
import { LandlordsRepository } from './landlords.repository';

/** Hồ sơ công khai của chủ trọ (spec 0005). Mọi con số tính lúc đọc từ dữ liệu thật, không bộ đếm lưu sẵn. */
@Injectable()
export class LandlordsService {
	constructor(
		private readonly repository: LandlordsRepository,
		private readonly listings: ListingsRepository,
		private readonly settings: SettingsService,
	) {}

	/**
	 * Hồ sơ của một chủ trọ hợp lệ, nhìn từ `viewerId` (`undefined` với khách thì `isFollowing` là `null`). Id không
	 * phải chủ trọ đang hoạt động thì 404 `LANDLORD_NOT_FOUND`. Ba số gộp và cờ theo dõi chạy song song, ngoài
	 * giao dịch, nên có thể lệch nhau vài mili giây vì không chung một ảnh chụp dữ liệu (chấp nhận, spec 0005).
	 * `now` là đồng hồ ứng dụng do controller lấy một lần mỗi request; hạn mức dùng thử đọc từ `settings` giống
	 * `GET /listings`, để `publicListingCount` không lệch với danh sách.
	 */
	async getProfile(
		landlordId: string,
		viewerId: string | undefined,
		now: Date,
	): Promise<LandlordProfileResponse> {
		const landlord = await this.repository.findActiveLandlord(landlordId);
		if (landlord === null)
			throw new AppException(ErrorCode.LANDLORD_NOT_FOUND);

		const visibility = {
			now,
			trialListingLimit: await this.settings.getValue(
				'trial_listing_limit',
			),
		};
		const [followerCount, totalViewCount, publicListingCount, isFollowing] =
			await Promise.all([
				this.repository.countActiveFollowers(landlordId),
				this.listings.sumViewCountByLandlord(landlordId),
				this.listings.countPublicByLandlord(landlordId, visibility),
				viewerId === undefined
					? Promise.resolve(null)
					: this.repository.isFollowing(viewerId, landlordId),
			]);
		return toLandlordProfile(
			landlord,
			{ followerCount, totalViewCount, publicListingCount },
			isFollowing,
		);
	}
}
