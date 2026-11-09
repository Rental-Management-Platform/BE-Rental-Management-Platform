import { Injectable } from '@nestjs/common';
import { hasPermissions } from '../common/auth/permission-catalog';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page, PaginationQueryDto } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { ChatRepository } from '../chat/chat.repository';
import { ListingsRepository } from '../listings/listings.repository';
import type { PublicVisibility } from '../listings/listings.repository';
import { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import type { CreateReviewDto } from '../reviews/dto/create-review.dto';
import type {
	MyReviewResponse,
	MyReviewStateResponse,
	PublicReviewResponse,
} from '../reviews/dto/review.response';
import type { UpdateReviewDto } from '../reviews/dto/update-review.dto';
import { toMyReview, toPublicReview } from '../reviews/reviews.mapper';
import type {
	OwnReviewRow,
	ReviewChanges,
} from '../reviews/reviews.repository';
import { SettingsService } from '../settings/settings.service';
import { ListingReviewsRepository } from './listing-reviews.repository';

/**
 * Đánh giá từng phòng trên tin đăng của người tìm trọ (spec 0015, bốn route người viết và danh sách công khai). Thứ tự
 * kiểm lỗi trong Service, sau guard và pipe: loại tài khoản admin (403) trước; rồi tin đang hiện công khai (404
 * `LISTING_NOT_FOUND`, một lần `isPubliclyVisible`, cùng cách `favorites` và chat); với `POST` rồi tự đánh giá (409,
 * chủ trọ của tin so với người gọi); với `POST` rồi đủ điều kiện (403, chủ trọ đã trả lời đúng tin này); rồi ghi.
 * Người viết luôn là người trong token, tin luôn là `:id`, không bao giờ từ body. `now` là đồng hồ ứng dụng do
 * controller lấy một lần mỗi request, dùng cho luật hiển thị công khai.
 */
@Injectable()
export class ListingReviewsService {
	constructor(
		private readonly repository: ListingReviewsRepository,
		private readonly listings: ListingsRepository,
		private readonly chat: ChatRepository,
		private readonly logs: ModerationLogsRepository,
		private readonly settings: SettingsService,
	) {}

	/**
	 * Danh sách đánh giá hiện công khai của một tin đang hiện công khai, mới viết trước (spec 0015 AC-2). Tin không hiện
	 * thì 404 `LISTING_NOT_FOUND` và không đọc thêm gì. Trang và `total` dùng chung một mảnh điều kiện với hai con số
	 * của chi tiết tin. `isMine` là `null` với khách.
	 */
	async list(
		listingId: string,
		query: PaginationQueryDto,
		viewerId: string | undefined,
		now: Date,
	): Promise<Page<PublicReviewResponse>> {
		await this.assertPubliclyVisible(listingId, now);
		const { rows, total } = await this.repository.findPublicPage(
			listingId,
			skipOf(query),
			query.pageSize,
		);
		return toPage(
			rows.map((row) => toPublicReview(row, viewerId)),
			total,
			query,
		);
	}

	/**
	 * Đánh giá của chính người gọi về phòng này và cờ `canReview` (spec 0015 AC-8). `canReview` đúng khi chưa có đánh
	 * giá, người gọi giữ `review:create` trong token, không phải chủ trọ của tin và đã đủ điều kiện (chủ trọ đã trả lời
	 * đúng tin này trong chat); các điều kiện rẻ chạy trước nên truy vấn chat chỉ chạy khi cần. `POST` vẫn là nơi quyết
	 * định cuối.
	 */
	async getMine(
		user: RequestUser,
		listingId: string,
		now: Date,
	): Promise<MyReviewStateResponse> {
		this.assertNotAdmin(user);
		await this.assertPubliclyVisible(listingId, now);
		const row = await this.repository.findOwn(user.userId, listingId);
		if (row !== null) {
			return { review: await this.present(row), canReview: false };
		}
		const canReview =
			hasPermissions(user.permissions, ['review:create']) &&
			!(await this.isOwnListing(user.userId, listingId)) &&
			(await this.chat.hasLandlordRepliedOnListing(
				user.userId,
				listingId,
			));
		return { review: null, canReview };
	}

	/**
	 * Viết đánh giá (spec 0015 AC-3 đến AC-5). Chủ trọ của tin đánh giá phòng của mình thì 409 `CANNOT_REVIEW_SELF`
	 * (sau khi tin hợp lệ, trước điều kiện chat). Chưa đủ điều kiện (chưa nhắn về tin này, hoặc chủ trọ chưa trả lời,
	 * hoặc chỉ nhắn về tin khác) thì 403 `LISTING_REVIEW_NOT_ELIGIBLE`. Một câu `INSERT ... ON CONFLICT DO NOTHING
	 * RETURNING`: không trả dòng nào nghĩa là cặp đã có, thành 409 `LISTING_REVIEW_ALREADY_EXISTS`. Không cần giao
	 * dịch: đủ điều kiện không bao giờ mất đi (chat bất biến) nên giữa kiểm và ghi không có cửa sổ đua; hai lần gọi
	 * đồng thời cùng cặp chỉ một lần thắng nhờ khóa duy nhất. Nếu tin bị ẩn đúng giữa lúc kiểm và lúc ghi thì dòng vẫn
	 * được ghi; vô hại vì nó biến khỏi mọi đường đọc cùng tin.
	 */
	async create(
		user: RequestUser,
		listingId: string,
		dto: CreateReviewDto,
		now: Date,
	): Promise<MyReviewResponse> {
		this.assertNotAdmin(user);
		await this.assertPubliclyVisible(listingId, now);
		if (await this.isOwnListing(user.userId, listingId))
			throw new AppException(ErrorCode.CANNOT_REVIEW_SELF);
		if (
			!(await this.chat.hasLandlordRepliedOnListing(
				user.userId,
				listingId,
			))
		)
			throw new AppException(ErrorCode.LISTING_REVIEW_NOT_ELIGIBLE);
		const row = await this.repository.insertIfAbsent(
			user.userId,
			listingId,
			dto.stars,
			dto.comment ?? null,
		);
		if (row === null)
			throw new AppException(ErrorCode.LISTING_REVIEW_ALREADY_EXISTS);
		return toMyReview(row, null);
	}

	/**
	 * Sửa đánh giá của chính mình (spec 0015 AC-6). Không kiểm điều kiện chat lại. Một câu `UPDATE` chỉ khớp dòng
	 * `visible`; không dòng nào đổi thì tra thêm một câu: không có dòng là 404 `LISTING_REVIEW_NOT_FOUND`, dòng đang
	 * `hidden_by_admin` là 409 `LISTING_REVIEW_HIDDEN`. Nếu lúc tra dòng đã được gỡ ẩn (admin gỡ ngay giữa hai câu) thì
	 * thử sửa lại một lần thay vì báo sai là đang ẩn.
	 */
	async update(
		user: RequestUser,
		listingId: string,
		dto: UpdateReviewDto,
		now: Date,
	): Promise<MyReviewResponse> {
		this.assertNotAdmin(user);
		await this.assertPubliclyVisible(listingId, now);
		const changes: ReviewChanges = {
			stars: dto.stars,
			comment: dto.comment,
		};
		let row = await this.repository.updateOwnVisible(
			user.userId,
			listingId,
			changes,
		);
		if (row === null) {
			const current = await this.repository.findOwn(
				user.userId,
				listingId,
			);
			if (current === null)
				throw new AppException(ErrorCode.LISTING_REVIEW_NOT_FOUND);
			if (current.status === 'visible') {
				row = await this.repository.updateOwnVisible(
					user.userId,
					listingId,
					changes,
				);
			}
			if (row === null)
				throw new AppException(ErrorCode.LISTING_REVIEW_HIDDEN);
		}
		return toMyReview(row, null);
	}

	/**
	 * Xóa hẳn đánh giá của chính mình, kể cả đang bị ẩn (spec 0015 AC-7). Tin phải đang hiện công khai (không thì 404
	 * `LISTING_NOT_FOUND`, kể cả với người viết). Chưa có đánh giá thì 404 `LISTING_REVIEW_NOT_FOUND`. Sau khi xóa,
	 * hai con số của chi tiết tin đổi ngay và người viết viết lại được nếu còn đủ điều kiện.
	 */
	async remove(
		user: RequestUser,
		listingId: string,
		now: Date,
	): Promise<void> {
		this.assertNotAdmin(user);
		await this.assertPubliclyVisible(listingId, now);
		const deleted = await this.repository.deleteOwn(user.userId, listingId);
		if (!deleted)
			throw new AppException(ErrorCode.LISTING_REVIEW_NOT_FOUND);
	}

	/** Đánh giá của người gọi kèm lý do ẩn khi đang bị ẩn (một truy vấn log, chỉ khi cần). */
	private async present(row: OwnReviewRow): Promise<MyReviewResponse> {
		const reasons =
			row.status === 'hidden_by_admin'
				? await this.logs.findLatestListingReviewHideReasons([row.id])
				: new Map<string, string>();
		return toMyReview(row, reasons.get(row.id) ?? null);
	}

	/**
	 * Admin không viết, sửa, xóa hay xem đánh giá "của tôi" (spec 0015 AC-9: 403 `PERMISSION_DENIED`, không ghi dòng
	 * nào). Quyền của admin tính trong code là `manage` mọi module (`ADMIN_PERMISSIONS`), nên `review:read`, `create`,
	 * `update`, `delete` qua được guard quyền; kiểm loại tài khoản ở đây, như đánh giá chủ trọ, `follow`, `favorites` và
	 * chat. Admin chỉ đọc và ẩn bằng ba route kiểm duyệt. Chạy sau kiểm `INVALID_ID` và `VALIDATION_FAILED` của pipe,
	 * nên admin gửi id hay body sai nhận 400 chứ không phải 403.
	 */
	private assertNotAdmin(user: RequestUser): void {
		if (user.accountType === 'admin')
			throw new AppException(ErrorCode.PERMISSION_DENIED);
	}

	/**
	 * Tin có đang hiện công khai không, đúng điều kiện của chi tiết công khai (`isPubliclyVisible`, cùng `now` và hạn mức
	 * dùng thử): không thì 404 `LISTING_NOT_FOUND` như chi tiết tin, để không ai dò được tin đang ẩn hay đã xóa.
	 */
	private async assertPubliclyVisible(
		listingId: string,
		now: Date,
	): Promise<void> {
		const visibility: PublicVisibility = {
			now,
			trialListingLimit: await this.settings.getValue(
				'trial_listing_limit',
			),
		};
		const visible = await this.listings.isPubliclyVisible(
			listingId,
			visibility,
		);
		if (!visible) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
	}

	/**
	 * Người gọi có phải chủ trọ của tin không (chủ của nhà trọ chứa tin). Tin đã được kiểm hiện công khai ngay trước
	 * đó; nếu tin biến mất đúng giữa hai câu thì không còn chủ để so, thành 404 như tin không hiện.
	 */
	private async isOwnListing(
		userId: string,
		listingId: string,
	): Promise<boolean> {
		const landlordId = await this.listings.findLandlordIdOf(listingId);
		if (landlordId === null)
			throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		return landlordId === userId;
	}
}
