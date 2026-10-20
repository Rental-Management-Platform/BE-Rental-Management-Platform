import { Injectable, Logger } from '@nestjs/common';
import { assertOwner } from '../common/auth/ownership';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { RequestUser } from '../common/http/authenticated-request';
import type { Page } from '../common/pagination/pagination';
import { skipOf, toPage } from '../common/pagination/pagination';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { toSearchKey } from '../common/text/to-search-key';
import { FavoritesRepository } from '../favorites/favorites.repository';
import type { Prisma } from '../generated/prisma/client';
import { MembershipsService } from '../memberships/memberships.service';
import { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import { PropertiesRepository } from '../properties/properties.repository';
import { SettingsService } from '../settings/settings.service';
import { UsersService } from '../users/users.service';
import type { CreateListingDto } from './dto/create-listing.dto';
import type {
	ListingDetailResponse,
	OwnerListingDetailResponse,
	OwnerListingSummaryResponse,
	PublicListingSummaryResponse,
} from './dto/listing.response';
import type {
	ListListingsQueryDto,
	MyListingsQueryDto,
} from './dto/listing-queries.dto';
import type { UpdateListingDto } from './dto/update-listing.dto';
import {
	extractListingCode,
	generateListingCode,
	LISTING_CODE_ATTEMPTS,
	ListingCodeTakenError,
} from './listing-code';
import {
	toListingDetail,
	toOwnerDetail,
	toOwnerSummary,
	toPublicSummary,
} from './listings.mapper';
import { ListingsRepository } from './listings.repository';
import type {
	ListingChanges,
	OwnerDetailRow,
	PublicVisibility,
} from './listings.repository';
import { toSearchWords } from './search-words';
import { ViewDeduplicator } from './view-deduplicator';

/** Người xem một tin công khai: tài khoản nếu có access token hợp lệ, không thì IP (spec 0002 AC-13). */
export interface Viewer {
	readonly userId?: string;
	readonly ip: string;
}

/** `YYYY-MM-DD` đã qua DTO thành `Date` lúc nửa đêm UTC, đúng cột `date`; `null` hoặc vắng thì `null`. */
function toDateOnly(value: string | null | undefined): Date | null {
	return value === null || value === undefined
		? null
		: new Date(`${value}T00:00:00.000Z`);
}

/**
 * Tin đăng của chủ trọ và đọc công khai (spec 0002 AC-5 đến AC-7, AC-10 đến AC-14, AC-16). Chủ của tin là chủ
 * nhà trọ của nó; mọi thao tác ghi lên tin cụ thể kiểm chủ sở hữu bằng `assertOwner`. Đăng tin và sửa tiêu đề
 * khóa dòng nhà trọ giống sửa và xóa nhà trọ, nên `search_key` luôn dựng từ tên và địa chỉ mới nhất. Chuyển
 * trạng thái là một câu `updateMany` có điều kiện trạng thái nguồn nên admin ẩn đua với chủ trọ thì admin thắng.
 *
 * Chỉ `create` và `show` (đưa tin về `visible`) có cửa hạn mức (spec 0003 AC-4 đến AC-7): khóa dòng `users` của
 * chủ trọ, kiểm hạn mức, rồi ghi, tất cả trong một giao dịch. `hide`, `update`, `remove` không bị chặn.
 */
@Injectable()
export class ListingsService {
	private readonly logger = new Logger(ListingsService.name);

	constructor(
		private readonly repository: ListingsRepository,
		private readonly properties: PropertiesRepository,
		private readonly moderationLogs: ModerationLogsRepository,
		private readonly transactions: TransactionRunner,
		private readonly views: ViewDeduplicator,
		private readonly users: UsersService,
		private readonly memberships: MembershipsService,
		private readonly settings: SettingsService,
		private readonly favorites: FavoritesRepository,
	) {}

	// ----- đăng và sửa -----

	/**
	 * Đăng tin vào nhà trọ của mình: trạng thái `visible`, `view_count` 0, mã ngắn duy nhất. Không kiểm trùng mã
	 * trước (vẫn đua giữa hai request): chèn thẳng, gặp trùng thì sinh mã mới và thử lại tối đa 5 lần. Vòng thử lại
	 * bọc NGOÀI cả giao dịch vì giao dịch PostgreSQL đã lỗi thì bị hủy, không chèn tiếp được. `now` là đồng hồ
	 * ứng dụng do controller lấy một lần mỗi request.
	 */
	async create(
		user: RequestUser,
		propertyId: string,
		dto: CreateListingDto,
		now: Date,
	): Promise<OwnerListingDetailResponse> {
		let collision: unknown;
		for (let attempt = 1; attempt <= LISTING_CODE_ATTEMPTS; attempt += 1) {
			try {
				const id = await this.insertOnce(user, propertyId, dto, now);
				return await this.readOwner(id, now);
			} catch (error: unknown) {
				if (!(error instanceof ListingCodeTakenError)) throw error;
				collision = error;
			}
		}
		this.logger.error(
			`Không sinh được mã tin duy nhất sau ${LISTING_CODE_ATTEMPTS} lần thử (nhà trọ ${propertyId}).`,
		);
		throw new AppException(ErrorCode.INTERNAL_ERROR, [], {
			cause: collision,
		});
	}

	/**
	 * Thứ tự khóa của spec 0003: dòng `users` của người gọi trước, rồi dòng nhà trọ. Kiểm sở hữu nằm trước kiểm
	 * hạn mức nên nhà trọ không có (404) hay của người khác (403) luôn được báo trước hai lỗi hạn mức (AC-4).
	 */
	private insertOnce(
		user: RequestUser,
		propertyId: string,
		dto: CreateListingDto,
		now: Date,
	): Promise<string> {
		return this.transactions.run(async (tx) => {
			await this.users.lockById(user.userId, tx);
			const locked = await this.properties.lockLiveById(propertyId, tx);
			if (locked === null) {
				throw new AppException(ErrorCode.PROPERTY_NOT_FOUND);
			}
			assertOwner(user, locked.landlordId);
			await this.assertRoomForOneMore(user.userId, now, tx);
			const source = await this.properties.findAddressSource(
				propertyId,
				tx,
			);
			return this.repository.create(
				{
					propertyId,
					code: generateListingCode(),
					title: dto.title,
					description: dto.description,
					price: dto.price,
					areaM2: dto.areaM2,
					deposit: dto.deposit ?? null,
					availableFrom: toDateOnly(dto.availableFrom),
					searchKey: toSearchKey(
						dto.title,
						source.name,
						source.addressText,
						source.ward.name,
					),
				},
				tx,
			);
		});
	}

	/** Sửa tin của mình ở mọi trạng thái (kể cả `hidden_by_admin`); không đổi được nhà trọ, trạng thái hay mã. */
	async update(
		user: RequestUser,
		id: string,
		dto: UpdateListingDto,
		now: Date,
	): Promise<OwnerListingDetailResponse> {
		const owned = await this.requireOwned(user, id);
		await this.transactions.run(async (tx) => {
			const locked = await this.properties.lockLiveById(
				owned.propertyId,
				tx,
			);
			if (locked === null) {
				throw new AppException(ErrorCode.LISTING_NOT_FOUND);
			}
			const changes: ListingChanges = {};
			if (dto.title !== undefined) {
				const source = await this.properties.findAddressSource(
					owned.propertyId,
					tx,
				);
				changes.title = dto.title;
				changes.searchKey = toSearchKey(
					dto.title,
					source.name,
					source.addressText,
					source.ward.name,
				);
			}
			if (dto.description !== undefined)
				changes.description = dto.description;
			if (dto.price !== undefined) changes.price = dto.price;
			if (dto.areaM2 !== undefined) changes.areaM2 = dto.areaM2;
			if (dto.deposit !== undefined) changes.deposit = dto.deposit;
			if (dto.availableFrom !== undefined) {
				changes.availableFrom = toDateOnly(dto.availableFrom);
			}
			if (!(await this.repository.update(id, changes, tx))) {
				throw new AppException(ErrorCode.LISTING_NOT_FOUND);
			}
		});
		return this.readOwner(id, now);
	}

	/** Xóa mềm tin của mình ở mọi trạng thái. */
	async remove(user: RequestUser, id: string): Promise<void> {
		await this.requireOwned(user, id);
		if (!(await this.repository.softDelete(id))) {
			throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		}
	}

	/** `visible` sang `hidden_by_owner`. Tin không `visible` thì 409 `LISTING_STATE_INVALID`. */
	async hide(
		user: RequestUser,
		id: string,
		now: Date,
	): Promise<OwnerListingDetailResponse> {
		await this.requireOwned(user, id);
		const moved = await this.repository.transition(
			id,
			['visible'],
			'hidden_by_owner',
		);
		if (!moved) {
			await this.explainRefusal(id, 'hide');
		}
		return this.readOwner(id, now);
	}

	/**
	 * `hidden_by_owner` sang `visible`. Thứ tự báo lỗi (spec 0003 AC-5): 404 hoặc 403 sở hữu, rồi tin đang
	 * `hidden_by_admin` thì 403 `LISTING_HIDDEN_BY_ADMIN` (chủ trọ không tự gỡ lệnh ẩn của admin) hoặc trạng thái
	 * khác thì 409 `LISTING_STATE_INVALID`, rồi `MEMBERSHIP_REQUIRED`, rồi `LISTING_QUOTA_REACHED`. Hiện tin là
	 * thêm một tin đang hiện nên đi qua cùng cửa hạn mức với `create`, trong giao dịch đã khóa dòng `users`.
	 */
	async show(
		user: RequestUser,
		id: string,
		now: Date,
	): Promise<OwnerListingDetailResponse> {
		const owned = await this.requireOwned(user, id);
		if (owned.status === 'hidden_by_admin') {
			throw new AppException(ErrorCode.LISTING_HIDDEN_BY_ADMIN);
		}
		if (owned.status !== 'hidden_by_owner') {
			throw new AppException(ErrorCode.LISTING_STATE_INVALID);
		}
		const moved = await this.transactions.run(async (tx) => {
			await this.users.lockById(user.userId, tx);
			await this.assertRoomForOneMore(user.userId, now, tx);
			return this.repository.transition(
				id,
				['hidden_by_owner'],
				'visible',
				tx,
			);
		});
		// Trạng thái đã đổi giữa lần kiểm trên và giao dịch (admin ẩn, hoặc tin bị xóa): câu UPDATE có điều kiện
		// nguồn không ghi đè, đọc lại để báo đúng lỗi.
		if (!moved) {
			await this.explainRefusal(id, 'show');
		}
		return this.readOwner(id, now);
	}

	/**
	 * Cửa hạn mức (spec 0003 AC-3, AC-4, AC-6): phải gọi trong giao dịch đã khóa dòng `users` của chủ trọ. Hết
	 * dùng thử và chưa có gói thì 403 `MEMBERSHIP_REQUIRED`; còn hiệu lực mà số tin đang hiện đã bằng hoặc vượt
	 * hạn mức thì 403 `LISTING_QUOTA_REACHED`; còn chỗ thì qua.
	 */
	private async assertRoomForOneMore(
		landlordId: string,
		now: Date,
		tx: Prisma.TransactionClient,
	): Promise<void> {
		const membership = await this.memberships.resolve(landlordId, now, tx);
		if (membership.state === 'expired') {
			throw new AppException(ErrorCode.MEMBERSHIP_REQUIRED);
		}
		const visible = await this.repository.countVisibleByLandlord(
			landlordId,
			tx,
		);
		if (visible >= membership.limit) {
			throw new AppException(ErrorCode.LISTING_QUOTA_REACHED);
		}
	}

	/**
	 * Giải thích vì sao một lần chuyển trạng thái không xảy ra (spec 0002 AC-6): tin biến mất thì 404. Chỉ riêng
	 * `show` lên tin đang `hidden_by_admin` là 403 `LISTING_HIDDEN_BY_ADMIN`; mọi chuyển trạng thái sai khác (kể cả
	 * `hide` lên tin đang bị admin ẩn) là 409 `LISTING_STATE_INVALID`.
	 */
	private async explainRefusal(
		id: string,
		action: 'hide' | 'show',
	): Promise<never> {
		const status = await this.repository.findStatus(id);
		if (status === null)
			throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		if (action === 'show' && status === 'hidden_by_admin') {
			throw new AppException(ErrorCode.LISTING_HIDDEN_BY_ADMIN);
		}
		throw new AppException(ErrorCode.LISTING_STATE_INVALID);
	}

	// ----- đọc của chủ trọ -----

	/**
	 * Tin của chính người gọi, mọi trạng thái, mới nhất trước; `status` lọc nếu có. Mỗi dòng có `isPublic`
	 * (spec 0003 AC-11): hạn mức và tập tin trong hạn mức chỉ tra một lần cho cả trang, và bỏ qua khi trang
	 * không có tin `visible` nào.
	 */
	async listOwn(
		user: RequestUser,
		query: MyListingsQueryDto,
		now: Date,
	): Promise<Page<OwnerListingSummaryResponse>> {
		const { rows, total } = await this.repository.findOwnedPage(
			user.userId,
			query.status,
			skipOf(query),
			query.pageSize,
		);
		const [reasons, withinQuota] = await Promise.all([
			this.moderationLogs.findLatestListingHideReasons(
				rows
					.filter((row) => row.status === 'hidden_by_admin')
					.map((row) => row.id),
			),
			rows.some((row) => row.status === 'visible')
				? this.withinQuotaIds(user.userId, now)
				: Promise.resolve<ReadonlySet<string>>(new Set()),
		]);
		return toPage(
			rows.map((row) =>
				toOwnerSummary(
					row,
					reasons.get(row.id) ?? null,
					row.status === 'visible' && withinQuota.has(row.id),
				),
			),
			total,
			query,
		);
	}

	async getOwn(
		user: RequestUser,
		id: string,
		now: Date,
	): Promise<OwnerListingDetailResponse> {
		const row = await this.repository.findOwnerDetail(id);
		if (row === null) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		assertOwner(user, row.property.landlordId);
		return this.toOwnerResponse(row, now);
	}

	// ----- đọc công khai -----

	/**
	 * Danh sách công khai có lọc, sắp xếp và phân trang. Chỉ tin thỏa `publicListingCondition` (spec 0003 AC-8,
	 * AC-9). `now` là đồng hồ ứng dụng do controller lấy một lần mỗi request. `viewerId` là người đăng nhập (đọc
	 * đăng nhập tùy chọn): khách thì `undefined` và `isFavorite` là `null`, còn người đăng nhập nhận `true` hoặc
	 * `false` theo dòng lưu của chính họ, đọc bằng một truy vấn cho cả trang (spec 0006 AC-6).
	 */
	async listPublic(
		query: ListListingsQueryDto,
		viewerId: string | undefined,
		now: Date,
	): Promise<Page<PublicListingSummaryResponse>> {
		if (
			query.minPrice !== undefined &&
			query.maxPrice !== undefined &&
			query.minPrice > query.maxPrice
		) {
			throw new AppException(ErrorCode.VALIDATION_FAILED, [
				{
					field: 'minPrice',
					code: 'minPriceAboveMax',
					message: 'Giá thấp nhất không được lớn hơn giá cao nhất.',
				},
			]);
		}
		const { rows, total } = await this.repository.findPublicPage(
			{
				searchWords: toSearchWords(query.q),
				wardCode: query.wardCode,
				minPrice: query.minPrice,
				maxPrice: query.maxPrice,
				sort: query.sort,
			},
			await this.publicVisibility(now),
			skipOf(query),
			query.pageSize,
		);
		const saved =
			viewerId === undefined || rows.length === 0
				? undefined
				: await this.favorites.findSavedIds(
						viewerId,
						rows.map((row) => row.id),
					);
		return toPage(
			rows.map((row) =>
				toPublicSummary(
					row,
					viewerId === undefined
						? null
						: (saved?.has(row.id) ?? false),
				),
			),
			total,
			query,
		);
	}

	/**
	 * Chi tiết công khai theo `slug-mã`. Chỉ phần mã được dùng để tra. Tin hết hiển thị công khai (chủ trọ hết
	 * dùng thử, hoặc tin bị ẩn bớt vì vượt hạn mức) thì 404 như tin không tồn tại. Mỗi người xem được cộng một
	 * lượt trong 30 phút (chủ tin không tính); số điện thoại chỉ có khi người gọi đã đăng nhập.
	 */
	async getPublicDetail(
		slugCode: string,
		viewer: Viewer,
		now: Date,
	): Promise<ListingDetailResponse> {
		const code = extractListingCode(slugCode);
		if (code === null) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		const row = await this.repository.findPublicByCode(
			code,
			await this.publicVisibility(now),
		);
		if (row === null) throw new AppException(ErrorCode.LISTING_NOT_FOUND);

		let viewCount = row.viewCount;
		const isOwner = viewer.userId === row.property.landlordId;
		const viewerKey =
			viewer.userId === undefined
				? `ip:${viewer.ip}`
				: `user:${viewer.userId}`;
		if (!isOwner && this.views.shouldCount(viewerKey, row.id)) {
			const counted = await this.repository.incrementViewCount(row.id);
			if (counted !== null) viewCount = counted;
		}
		return toListingDetail(row, {
			viewCount,
			includePhone: viewer.userId !== undefined,
			isFavorite:
				viewer.userId === undefined
					? null
					: await this.favorites.isFavorite(viewer.userId, row.id),
		});
	}

	// ----- dùng chung -----

	/** Hạn mức dùng thử đọc một lần mỗi request cho luật hiển thị công khai (spec 0003, "Value sourcing"). */
	private async publicVisibility(now: Date): Promise<PublicVisibility> {
		return {
			now,
			trialListingLimit: await this.settings.getValue(
				'trial_listing_limit',
			),
		};
	}

	/** Tin chưa xóa của người gọi: 404 nếu không có, 403 nếu của chủ trọ khác. */
	private async requireOwned(user: RequestUser, id: string) {
		const owned = await this.repository.findOwnership(id);
		if (owned === null) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		assertOwner(user, owned.property.landlordId);
		return owned;
	}

	/**
	 * Đọc tin vừa ghi để trả về, SAU khi giao dịch đã xong (đọc nhiều quan hệ trong giao dịch đang mở làm Prisma
	 * chạy song song trên một kết nối, xem `PropertiesRepository.create`).
	 */
	private async readOwner(
		id: string,
		now: Date,
	): Promise<OwnerListingDetailResponse> {
		const row = await this.repository.findOwnerDetail(id);
		if (row === null) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		return this.toOwnerResponse(row, now);
	}

	/** Thêm lý do ẩn của admin (chỉ khi `hidden_by_admin`) và `isPublic` (chỉ tra hạn mức khi tin đang `visible`). */
	private async toOwnerResponse(
		row: OwnerDetailRow,
		now: Date,
	): Promise<OwnerListingDetailResponse> {
		const [reasons, withinQuota] = await Promise.all([
			row.status === 'hidden_by_admin'
				? this.moderationLogs.findLatestListingHideReasons([row.id])
				: Promise.resolve(new Map<string, string>()),
			row.status === 'visible'
				? this.withinQuotaIds(row.property.landlordId, now)
				: Promise.resolve<ReadonlySet<string>>(new Set()),
		]);
		return toOwnerDetail(
			row,
			reasons.get(row.id) ?? null,
			withinQuota.has(row.id),
		);
	}

	/**
	 * Id các tin của chủ trọ đang nằm trong hạn mức hiện hành (spec 0003 AC-11): N tin `visible` đăng sớm nhất với
	 * N là hạn mức của `MembershipsService.resolve`, cùng luật xếp hạng với mảnh SQL hiển thị công khai. Hạn mức 0
	 * (hết dùng thử, hoặc admin đặt 0) thì rỗng và không tra thêm. Theo AC-11, `isPublic` chỉ xét trạng thái tin
	 * và hạn mức, không xét tài khoản đã bị khóa hay nhà trọ đã xóa mềm như mảnh SQL công khai.
	 */
	private async withinQuotaIds(
		landlordId: string,
		now: Date,
	): Promise<ReadonlySet<string>> {
		const { limit } = await this.memberships.resolve(landlordId, now);
		if (limit <= 0) return new Set();
		return new Set(
			await this.repository.findEarliestVisibleIds(landlordId, limit),
		);
	}
}
