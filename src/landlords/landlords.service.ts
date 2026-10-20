import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
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

	/**
	 * Theo dõi một chủ trọ (spec 0005 AC-6, AC-8). Thứ tự kiểm lỗi: admin (xem `assertNotAdmin`), tự theo dõi (so id
	 * với người gọi, chưa tra DB), rồi chủ trọ hợp lệ, rồi ghi. Chạy lặp an toàn: dòng đã có thì không làm gì. Trả hồ sơ đọc lại sau khi ghi, bằng
	 * đúng hàm của `GET`, với người gọi là người xem, nên `isFollowing` và `followerCount` phản ánh dòng vừa ghi.
	 */
	async follow(
		user: RequestUser,
		landlordId: string,
		now: Date,
	): Promise<LandlordProfileResponse> {
		this.assertNotAdmin(user);
		if (landlordId === user.userId)
			throw new AppException(ErrorCode.CANNOT_FOLLOW_SELF);
		await this.assertActiveLandlord(landlordId);
		await this.repository.addFollow(user.userId, landlordId);
		return this.getProfile(landlordId, user.userId, now);
	}

	/**
	 * Bỏ theo dõi (spec 0005 AC-7, AC-8). Cùng cách kiểm chủ trọ như `follow` nhưng không có bước tự theo dõi: id là
	 * chính người gọi thì rơi vào 404, hoặc (chủ trọ được cấp quyền) không có dòng nào để xóa và vẫn 200. Chưa theo
	 * dõi cũng 200. Trả hồ sơ đọc lại sau khi xóa.
	 */
	async unfollow(
		user: RequestUser,
		landlordId: string,
		now: Date,
	): Promise<LandlordProfileResponse> {
		this.assertNotAdmin(user);
		await this.assertActiveLandlord(landlordId);
		await this.repository.removeFollow(user.userId, landlordId);
		return this.getProfile(landlordId, user.userId, now);
	}

	/**
	 * Admin không theo dõi ai (spec 0005 AC-8: 403 `PERMISSION_DENIED`, không ghi dòng nào). Quyền của admin tính trong
	 * code là `manage` mọi module (`ADMIN_PERMISSIONS`), nên `follow:create` và `follow:delete` qua được guard quyền;
	 * kiểm loại tài khoản ở đây, như đơn mua gói (spec 0004). Chỉ chặn `admin`: chủ trọ được admin cấp quyền thì vẫn
	 * theo dõi được chủ trọ khác. Chạy sau kiểm `INVALID_ID` của route, nên admin gửi id sai nhận 400 chứ không phải 403.
	 */
	private assertNotAdmin(user: RequestUser): void {
		if (user.accountType === 'admin')
			throw new AppException(ErrorCode.PERMISSION_DENIED);
	}

	private async assertActiveLandlord(landlordId: string): Promise<void> {
		const landlord = await this.repository.findActiveLandlord(landlordId);
		if (landlord === null)
			throw new AppException(ErrorCode.LANDLORD_NOT_FOUND);
	}
}
