import { Injectable } from '@nestjs/common';
import { hasPermissions } from '../common/auth/permission-catalog';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page, PaginationQueryDto } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { ChatRepository } from '../chat/chat.repository';
import { LandlordsRepository } from '../landlords/landlords.repository';
import { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import type { CreateReviewDto } from './dto/create-review.dto';
import type {
	MyReviewResponse,
	MyReviewStateResponse,
	PublicReviewResponse,
} from './dto/review.response';
import type { UpdateReviewDto } from './dto/update-review.dto';
import { toMyReview, toPublicReview } from './reviews.mapper';
import { ReviewsRepository } from './reviews.repository';
import type { OwnReviewRow, ReviewChanges } from './reviews.repository';

/**
 * Đánh giá chủ trọ của người tìm trọ (spec 0014, bốn route người viết và danh sách công khai). Thứ tự kiểm lỗi trong
 * Service, sau guard và pipe: loại tài khoản admin (403) trước; với `POST` rồi tự đánh giá (409, so id, chưa tra DB);
 * rồi chủ trọ hợp lệ (404, đúng hàm của hồ sơ); với `POST` rồi đủ điều kiện (403); rồi ghi. Người viết luôn là người
 * trong token, chủ trọ luôn là `:id`, không bao giờ từ body.
 */
@Injectable()
export class ReviewsService {
	constructor(
		private readonly repository: ReviewsRepository,
		private readonly landlords: LandlordsRepository,
		private readonly chat: ChatRepository,
		private readonly logs: ModerationLogsRepository,
	) {}

	/**
	 * Danh sách đánh giá hiện công khai của một chủ trọ hợp lệ, mới viết trước (spec 0014 AC-2). Chủ trọ không hợp lệ
	 * thì 404 `LANDLORD_NOT_FOUND` và không đọc thêm gì. Trang và `total` dùng chung một mảnh điều kiện với hai con số
	 * của hồ sơ. `isMine` là `null` với khách.
	 */
	async list(
		landlordId: string,
		query: PaginationQueryDto,
		viewerId: string | undefined,
	): Promise<Page<PublicReviewResponse>> {
		await this.assertActiveLandlord(landlordId);
		const { rows, total } = await this.repository.findPublicPage(
			landlordId,
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
	 * Đánh giá của chính người gọi về chủ trọ này và cờ `canReview` (spec 0014 AC-8). `canReview` đúng khi chưa có
	 * đánh giá, người gọi giữ `review:create` trong token, không phải chính chủ trọ đó và đã đủ điều kiện (chủ trọ đã
	 * trả lời trong chat); các điều kiện rẻ chạy trước nên truy vấn chat chỉ chạy khi cần. `POST` vẫn là nơi quyết
	 * định cuối.
	 */
	async getMine(
		user: RequestUser,
		landlordId: string,
	): Promise<MyReviewStateResponse> {
		this.assertNotAdmin(user);
		await this.assertActiveLandlord(landlordId);
		const row = await this.repository.findOwn(user.userId, landlordId);
		if (row !== null) {
			return { review: await this.present(row), canReview: false };
		}
		const canReview =
			hasPermissions(user.permissions, ['review:create']) &&
			user.userId !== landlordId &&
			(await this.chat.hasLandlordReplied(user.userId, landlordId));
		return { review: null, canReview };
	}

	/**
	 * Viết đánh giá (spec 0014 AC-3 đến AC-5). Tự đánh giá thì 409 `CANNOT_REVIEW_SELF` (so id, trước mọi truy vấn).
	 * Chưa đủ điều kiện (chưa nhắn, hoặc chủ trọ chưa trả lời, hoặc chỉ nhắn với người khác) thì 403
	 * `REVIEW_NOT_ELIGIBLE`. Một câu `INSERT ... ON CONFLICT DO NOTHING RETURNING`: không trả dòng nào nghĩa là cặp đã
	 * có, thành 409 `REVIEW_ALREADY_EXISTS`. Không cần giao dịch: đủ điều kiện không bao giờ mất đi (chat bất biến)
	 * nên giữa kiểm và ghi không có cửa sổ đua; hai lần gọi đồng thời cùng cặp chỉ một lần thắng nhờ khóa duy nhất.
	 */
	async create(
		user: RequestUser,
		landlordId: string,
		dto: CreateReviewDto,
	): Promise<MyReviewResponse> {
		this.assertNotAdmin(user);
		if (landlordId === user.userId)
			throw new AppException(ErrorCode.CANNOT_REVIEW_SELF);
		await this.assertActiveLandlord(landlordId);
		if (!(await this.chat.hasLandlordReplied(user.userId, landlordId)))
			throw new AppException(ErrorCode.REVIEW_NOT_ELIGIBLE);
		const row = await this.repository.insertIfAbsent(
			user.userId,
			landlordId,
			dto.stars,
			dto.comment ?? null,
		);
		if (row === null)
			throw new AppException(ErrorCode.REVIEW_ALREADY_EXISTS);
		return toMyReview(row, null);
	}

	/**
	 * Sửa đánh giá của chính mình (spec 0014 AC-6). Không kiểm điều kiện chat lại. Một câu `UPDATE` chỉ khớp dòng
	 * `visible`; không dòng nào đổi thì tra thêm một câu: không có dòng là 404 `REVIEW_NOT_FOUND`, dòng đang
	 * `hidden_by_admin` là 409 `REVIEW_HIDDEN`. Nếu lúc tra dòng đã được gỡ ẩn (admin gỡ ngay giữa hai câu) thì thử sửa
	 * lại một lần thay vì báo sai là đang ẩn.
	 */
	async update(
		user: RequestUser,
		landlordId: string,
		dto: UpdateReviewDto,
	): Promise<MyReviewResponse> {
		this.assertNotAdmin(user);
		await this.assertActiveLandlord(landlordId);
		const changes: ReviewChanges = {
			stars: dto.stars,
			comment: dto.comment,
		};
		let row = await this.repository.updateOwnVisible(
			user.userId,
			landlordId,
			changes,
		);
		if (row === null) {
			const current = await this.repository.findOwn(
				user.userId,
				landlordId,
			);
			if (current === null)
				throw new AppException(ErrorCode.REVIEW_NOT_FOUND);
			if (current.status === 'visible') {
				row = await this.repository.updateOwnVisible(
					user.userId,
					landlordId,
					changes,
				);
			}
			if (row === null) throw new AppException(ErrorCode.REVIEW_HIDDEN);
		}
		return toMyReview(row, null);
	}

	/**
	 * Xóa hẳn đánh giá của chính mình, kể cả đang bị ẩn (spec 0014 AC-7). Chưa có đánh giá thì 404 `REVIEW_NOT_FOUND`.
	 * Sau khi xóa, hai con số của hồ sơ đổi ngay và người viết viết lại được nếu còn đủ điều kiện.
	 */
	async remove(user: RequestUser, landlordId: string): Promise<void> {
		this.assertNotAdmin(user);
		await this.assertActiveLandlord(landlordId);
		const deleted = await this.repository.deleteOwn(
			user.userId,
			landlordId,
		);
		if (!deleted) throw new AppException(ErrorCode.REVIEW_NOT_FOUND);
	}

	/** Đánh giá của người gọi kèm lý do ẩn khi đang bị ẩn (một truy vấn log, chỉ khi cần). */
	private async present(row: OwnReviewRow): Promise<MyReviewResponse> {
		const reasons =
			row.status === 'hidden_by_admin'
				? await this.logs.findLatestReviewHideReasons([row.id])
				: new Map<string, string>();
		return toMyReview(row, reasons.get(row.id) ?? null);
	}

	/**
	 * Admin không viết, sửa, xóa hay xem đánh giá "của tôi" (spec 0014 AC-9: 403 `PERMISSION_DENIED`, không ghi dòng
	 * nào). Quyền của admin tính trong code là `manage` mọi module (`ADMIN_PERMISSIONS`), nên `review:read`, `create`,
	 * `update`, `delete` qua được guard quyền; kiểm loại tài khoản ở đây, như `follow`, `favorites` và chat. Admin chỉ
	 * đọc và ẩn bằng ba route kiểm duyệt. Chạy sau kiểm `INVALID_ID` và `VALIDATION_FAILED` của pipe, nên admin gửi
	 * id hay body sai nhận 400 chứ không phải 403.
	 */
	private assertNotAdmin(user: RequestUser): void {
		if (user.accountType === 'admin')
			throw new AppException(ErrorCode.PERMISSION_DENIED);
	}

	private async assertActiveLandlord(landlordId: string): Promise<void> {
		const landlord = await this.landlords.findActiveLandlord(landlordId);
		if (landlord === null)
			throw new AppException(ErrorCode.LANDLORD_NOT_FOUND);
	}
}
