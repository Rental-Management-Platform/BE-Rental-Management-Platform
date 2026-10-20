import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page, PaginationQueryDto } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { ListingsRepository } from '../listings/listings.repository';
import type { PublicVisibility } from '../listings/listings.repository';
import { SettingsService } from '../settings/settings.service';
import type {
	FavoriteResultResponse,
	SavedListingResponse,
} from './dto/favorite.response';
import { toSavedListing } from './favorites.mapper';
import { FavoritesRepository } from './favorites.repository';

/**
 * Lưu tin yêu thích của người tìm trọ (spec 0006). Người lưu luôn là người trong token. Mọi con số và danh sách
 * tính lúc đọc từ luật hiển thị công khai, không cờ lưu sẵn, nên tin biến khỏi danh sách đã lưu đúng lúc nó biến
 * khỏi công khai (dòng lưu vẫn còn) và quay lại đúng chỗ khi hiện lại.
 */
@Injectable()
export class FavoritesService {
	constructor(
		private readonly repository: FavoritesRepository,
		private readonly listings: ListingsRepository,
		private readonly settings: SettingsService,
	) {}

	/**
	 * Lưu một tin (spec 0006 AC-1, AC-3, AC-7). Thứ tự kiểm lỗi: admin (xem `assertNotAdmin`), rồi tin có đang hiện
	 * công khai không (không thì 404 `LISTING_NOT_FOUND`, giống chi tiết tin, để không ai dò được tin đang ẩn), rồi
	 * ghi. Chạy lặp an toàn: dòng đã có thì không làm gì. Kết quả là hằng theo hành động. Nếu tin bị ẩn đúng giữa
	 * lúc kiểm và lúc ghi thì dòng vẫn được ghi; vô hại vì tin đó đã biến khỏi danh sách đã lưu.
	 */
	async save(
		user: RequestUser,
		listingId: string,
		now: Date,
	): Promise<FavoriteResultResponse> {
		this.assertNotAdmin(user);
		const visible = await this.listings.isPubliclyVisible(
			listingId,
			await this.publicVisibility(now),
		);
		if (!visible) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		await this.repository.addFavorite(user.userId, listingId);
		return { listingId, isFavorite: true };
	}

	/**
	 * Bỏ lưu (spec 0006 AC-2, AC-7). Không tra tin: bỏ lưu được cả tin đã bị ẩn hay đã xóa, và id không có cũng 200.
	 * Chưa lưu thì không có dòng nào để xóa, vẫn 200.
	 */
	async unsave(
		user: RequestUser,
		listingId: string,
	): Promise<FavoriteResultResponse> {
		this.assertNotAdmin(user);
		await this.repository.removeFavorite(user.userId, listingId);
		return { listingId, isFavorite: false };
	}

	/**
	 * Danh sách tin đã lưu của người gọi, mới lưu trước, chỉ gồm tin đang hiện công khai ngay lúc đọc (spec 0006
	 * AC-4, AC-5, AC-7). `now` là đồng hồ ứng dụng do controller lấy một lần mỗi request.
	 */
	async list(
		user: RequestUser,
		query: PaginationQueryDto,
		now: Date,
	): Promise<Page<SavedListingResponse>> {
		this.assertNotAdmin(user);
		const { rows, total } = await this.listings.findFavoritePage(
			user.userId,
			await this.publicVisibility(now),
			skipOf(query),
			query.pageSize,
		);
		return toPage(rows.map(toSavedListing), total, query);
	}

	/**
	 * Admin không lưu tin (spec 0006 AC-7: 403 `PERMISSION_DENIED`, không ghi dòng nào). Quyền của admin tính trong
	 * code là `manage` mọi module (`ADMIN_PERMISSIONS`), nên `favorite:*` qua được guard quyền; kiểm loại tài khoản ở
	 * đây, như theo dõi chủ trọ (spec 0005) và đơn mua gói (spec 0004). Chỉ chặn `admin`: chủ trọ được admin cấp
	 * quyền thì vẫn lưu được, kể cả tin của chính mình. Chạy sau kiểm `INVALID_ID` của route, nên admin gửi id sai
	 * nhận 400 chứ không phải 403.
	 */
	private assertNotAdmin(user: RequestUser): void {
		if (user.accountType === 'admin')
			throw new AppException(ErrorCode.PERMISSION_DENIED);
	}

	/** Hạn mức dùng thử đọc một lần mỗi request cho luật hiển thị công khai, giống `GET /listings`. */
	private async publicVisibility(now: Date): Promise<PublicVisibility> {
		return {
			now,
			trialListingLimit: await this.settings.getValue(
				'trial_listing_limit',
			),
		};
	}
}
