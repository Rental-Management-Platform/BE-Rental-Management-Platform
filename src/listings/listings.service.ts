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
import { ListingReviewsRepository } from '../listing-reviews/listing-reviews.repository';
import { MembershipsService } from '../memberships/memberships.service';
import { ModerationLogsRepository } from '../moderation/moderation-logs.repository';
import { PropertiesRepository } from '../properties/properties.repository';
import { SettingsService } from '../settings/settings.service';
import { StorageService } from '../storage/storage.service';
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
import { ListingImagesRepository } from './listing-images.repository';
import type { UploadedImage } from './listing-images.service';
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
import { prepareListingImages } from './new-listing-images';
import type { NewListingImageFile } from './new-listing-images';
import { toSearchWords } from './search-words';
import { ViewDeduplicator } from './view-deduplicator';

/** Người xem một tin công khai: tài khoản nếu có access token hợp lệ, không thì IP (spec 0002 AC-13). */
export interface Viewer {
	readonly userId?: string;
	readonly ip: string;
}

/**
 * Giao dịch đăng tin giữ khóa dòng `users` và `properties` trong lúc ghi tệp, nên nới thời hạn: mặc định 5 giây chạy
 * và 2 giây chờ kết nối không đủ khi phải chờ khóa và ghi tối đa 5 tệp (spec 0011, "Cách chạy" 3).
 */
const CREATE_TRANSACTION = { timeout: 15_000, maxWait: 5_000 } as const;

/** Trạng thái chia sẻ giữa vòng thử lại, hàm gọi lại của giao dịch và bước dọn tệp của một lần đăng (spec 0011). */
interface CreateProgress {
	/** Đặt ngay trước tệp đầu tiên; còn `false` thì chưa có tệp nào để dọn. */
	startedWriting: boolean;
	/** `id` tin mà hàm gọi lại đã trả về (mọi việc trong giao dịch xong, chỉ còn COMMIT); chưa có thì `undefined`. */
	insertedId?: string;
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
 * chủ trọ, kiểm hạn mức, rồi ghi, tất cả trong một giao dịch. `hide`, `update`, `remove` không bị chặn. `create`
 * ghi cả dòng ảnh và tệp ảnh trong giao dịch đó (spec 0011).
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
		private readonly storage: StorageService,
		private readonly imageRows: ListingImagesRepository,
		private readonly listingReviews: ListingReviewsRepository,
	) {}

	// ----- đăng và sửa -----

	/**
	 * Đăng tin kèm 1 đến 5 ảnh trong một lần (spec 0011): trạng thái `visible`, `view_count` 0, mã ngắn duy nhất.
	 * Kiểm hình dạng ảnh TRƯỚC khi chạm database (AC-5: `IMAGE_INVALID` đến trước 404 và 403), rồi tin, dòng ảnh và
	 * tệp ghi trong một giao dịch, tất cả hoặc không gì cả. Không kiểm trùng mã trước (vẫn đua giữa hai request):
	 * chèn thẳng, gặp trùng thì sinh mã mới và thử lại tối đa 5 lần. Vòng thử lại bọc NGOÀI cả giao dịch vì giao
	 * dịch PostgreSQL đã lỗi thì bị hủy, không chèn tiếp được. Đọc lại tin để trả về nằm NGOÀI phạm vi dọn tệp: lỗi
	 * đọc sau commit không được xóa ảnh của tin đã lưu. `now` là đồng hồ ứng dụng do controller lấy một lần mỗi request.
	 */
	async create(
		user: RequestUser,
		propertyId: string,
		dto: CreateListingDto,
		files: readonly UploadedImage[] | undefined,
		now: Date,
	): Promise<OwnerListingDetailResponse> {
		const images = prepareListingImages(files);
		const id = await this.insertWithImages(
			user,
			propertyId,
			dto,
			images,
			now,
		);
		return this.readOwner(id, now);
	}

	/**
	 * Vòng thử lại trùng mã, bọc trong dọn tệp (spec 0011, "Cách chạy" 3 và 4). Tệp chỉ được ghi sau khi mọi cửa
	 * đã qua và tin đã chèn, nên lỗi từ chối, trùng mã và lỗi chèn xảy ra trước mọi lần ghi và không cần dọn. Lỗi
	 * sau khi đã bắt đầu ghi, kể cả lúc COMMIT, thì xóa mọi tệp của lần đăng.
	 */
	private async insertWithImages(
		user: RequestUser,
		propertyId: string,
		dto: CreateListingDto,
		images: readonly NewListingImageFile[],
		now: Date,
	): Promise<string> {
		const progress: CreateProgress = { startedWriting: false };
		try {
			let collision: unknown;
			for (
				let attempt = 1;
				attempt <= LISTING_CODE_ATTEMPTS;
				attempt += 1
			) {
				try {
					return await this.insertOnce(
						user,
						propertyId,
						dto,
						images,
						now,
						progress,
					);
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
		} catch (error: unknown) {
			if (!progress.startedWriting) throw error;
			return this.settleFailedCreate(images, progress, error);
		}
	}

	/**
	 * Thứ tự khóa của spec 0003: dòng `users` của người gọi trước, rồi dòng nhà trọ. Kiểm sở hữu nằm trước kiểm
	 * hạn mức nên nhà trọ không có (404) hay của người khác (403) luôn được báo trước hai lỗi hạn mức (AC-4). Tệp
	 * ghi CUỐI CÙNG, sau khi tin và dòng ảnh đã chèn, nên yêu cầu bị từ chối không ghi tệp nào.
	 */
	private insertOnce(
		user: RequestUser,
		propertyId: string,
		dto: CreateListingDto,
		images: readonly NewListingImageFile[],
		now: Date,
		progress: CreateProgress,
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
			const id = await this.repository.create(
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
			await this.imageRows.createMany(id, images, tx);
			await this.writeFiles(images, progress);
			// Từ đây hàm gọi lại đã xong; nếu giao dịch vẫn ném lỗi thì đó là lỗi ở bước COMMIT.
			progress.insertedId = id;
			return id;
		}, CREATE_TRANSACTION);
	}

	/**
	 * Ghi từng tệp một theo thứ tự và chờ xong mới ghi tệp kế, không song song: khi một tệp lỗi và đến bước dọn thì
	 * không còn tệp nào đang ghi dở rồi hoàn tất sau. Giao dịch hết hạn (15 giây) trong lúc ghi cũng vậy: Prisma
	 * chờ hàm gọi lại chạy xong rồi mới báo lỗi lúc commit (đã kiểm thật), nên bước dọn luôn thấy đủ các tệp.
	 */
	private async writeFiles(
		images: readonly NewListingImageFile[],
		progress: CreateProgress,
	): Promise<void> {
		progress.startedWriting = true;
		for (const image of images) {
			await this.storage.put(image.storageKey, image.data);
		}
	}

	/**
	 * Lỗi sau khi đã bắt đầu ghi tệp. Ngoại lệ cho lỗi ở bước COMMIT (hàm gọi lại đã xong và trả `id`, nhưng
	 * `$transaction` vẫn ném, ví dụ mất kết nối đúng lúc COMMIT): hỏi lại bằng một truy vấn mới ngoài giao dịch xem
	 * tin có thật sự đã lưu; đã lưu thì giữ tin và tệp, coi như thành công. Mọi trường hợp khác xóa mọi tệp của lần
	 * đăng rồi ném lại lỗi gốc. Hỏi lại cũng lỗi thì không biết tin đã lưu chưa: giữ tệp (tệp mồ côi vô hại, còn xóa
	 * nhầm ảnh của tin đã lưu thì tin hiện ra với ảnh hỏng) và ghi log khóa các tệp để dọn tay.
	 */
	private async settleFailedCreate(
		images: readonly NewListingImageFile[],
		progress: CreateProgress,
		error: unknown,
	): Promise<string> {
		const { insertedId } = progress;
		if (insertedId !== undefined) {
			let saved: boolean;
			try {
				saved = (await this.repository.findStatus(insertedId)) !== null;
			} catch (checkError: unknown) {
				this.logger.error(
					`Lỗi lúc commit tin ${insertedId} và không kiểm lại được; giữ nguyên các tệp ${images.map((image) => image.storageKey).join(', ')}: ${checkError instanceof Error ? checkError.message : String(checkError)}`,
				);
				throw error;
			}
			if (saved) return insertedId;
		}
		await Promise.all(
			images.map((image) => this.discardFile(image.storageKey)),
		);
		throw error;
	}

	/** Xóa tệp, nuốt lỗi và ghi log: không để lỗi dọn dẹp che mất kết quả thật của yêu cầu. */
	private async discardFile(key: string): Promise<void> {
		try {
			await this.storage.delete(key);
		} catch (error: unknown) {
			this.logger.warn(
				`Không xóa được tệp ảnh ${key}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
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
		// Hai việc đọc độc lập, ngoài giao dịch, chạy song song (spec 0015 AC-1): cờ yêu thích của người xem và hai số
		// gộp của đánh giá phòng. Có thể lệch vài mili giây so với các số khác của chi tiết (chấp nhận, như 0005 và 0014).
		const [isFavorite, reviews] = await Promise.all([
			viewer.userId === undefined
				? Promise.resolve(null)
				: this.favorites.isFavorite(viewer.userId, row.id),
			this.listingReviews.summarize(row.id),
		]);
		return toListingDetail(row, {
			viewCount,
			includePhone: viewer.userId !== undefined,
			isFavorite,
			reviews,
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
