import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { assertOwner } from '../common/auth/ownership';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import { detectImageType } from '../common/files/detect-image-type';
import type { ImageType } from '../common/files/detect-image-type';
import type { RequestUser } from '../common/http/authenticated-request';
import { TransactionRunner } from '../common/persistence/transaction-runner';
import { SettingsService } from '../settings/settings.service';
import { isStorageKey, StorageService } from '../storage/storage.service';
import type { StoredFile } from '../storage/storage.service';
import type { ListingImageResponse } from './dto/listing.response';
import { ListingImagesRepository } from './listing-images.repository';
import { toListingImage } from './listings.mapper';
import { ListingsRepository } from './listings.repository';
import type { PublicVisibility } from './listings.repository';

/** Tối đa 5 ảnh mỗi tin: `position` từ 0 đến 4 (`CHECK` ở DB). */
export const MAX_IMAGES_PER_LISTING = 5;

/** Phần của tệp multer mà Service cần; khai báo riêng để test không phải dựng tệp Express đầy đủ. */
export interface UploadedImage {
	readonly fieldname: string;
	readonly buffer: Uint8Array;
}

/** Ảnh phục vụ công khai: dòng đọc, dung lượng và `Content-Type` suy từ đuôi tệp. */
export interface PublicImageFile extends StoredFile {
	readonly mime: ImageType['mime'];
}

const MIME_BY_EXTENSION: Readonly<Record<string, ImageType['mime']>> = {
	jpg: 'image/jpeg',
	png: 'image/png',
	webp: 'image/webp',
};

/** `position` nhỏ nhất còn trống trong 0 đến 4, hoặc `null` nếu đã đủ 5 ảnh. */
export function nextFreePosition(taken: readonly number[]): number | null {
	for (let position = 0; position < MAX_IMAGES_PER_LISTING; position += 1) {
		if (!taken.includes(position)) return position;
	}
	return null;
}

/**
 * Ảnh của tin (spec 0002 AC-8). Tải lên: kiểm chủ sở hữu, kiểm tệp bằng nội dung, rồi trong MỘT giao dịch khóa
 * dòng tin, chọn vị trí trống nhỏ nhất, ghi tệp và chèn dòng ảnh. Lỗi ở bất kỳ bước nào sau khi bắt đầu ghi tệp
 * (kể cả lúc commit) thì xóa tệp. Ghi tệp và ghi DB không nguyên tử: nếu tiến trình chết đúng giữa hai việc
 * thì có thể còn tệp mồ côi (chấp nhận ở bản demo).
 */
@Injectable()
export class ListingImagesService {
	private readonly logger = new Logger(ListingImagesService.name);

	constructor(
		private readonly listings: ListingsRepository,
		private readonly images: ListingImagesRepository,
		private readonly storage: StorageService,
		private readonly transactions: TransactionRunner,
		private readonly settings: SettingsService,
	) {}

	/**
	 * Thứ tự báo lỗi (spec 0002, "Tải ảnh, thứ tự kiểm lỗi"): 413 do multer ở Controller đến trước; rồi 404
	 * `LISTING_NOT_FOUND` hoặc 403 `NOT_RESOURCE_OWNER`; rồi 400 `IMAGE_INVALID` (thiếu tệp, sai tên trường,
	 * gửi nhiều tệp, sai loại); rồi 409 `LISTING_IMAGE_LIMIT`. Tải được ở mọi trạng thái của tin, kể cả
	 * `hidden_by_admin`.
	 */
	async upload(
		user: RequestUser,
		listingId: string,
		files: readonly UploadedImage[] | undefined,
	): Promise<ListingImageResponse> {
		const owned = await this.listings.findOwnership(listingId);
		if (owned === null) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		assertOwner(user, owned.property.landlordId);

		const file = files?.length === 1 ? files[0] : undefined;
		if (file === undefined || file.fieldname !== 'file') {
			throw new AppException(ErrorCode.IMAGE_INVALID);
		}
		const type = detectImageType(file.buffer);
		if (type === null) throw new AppException(ErrorCode.IMAGE_INVALID);

		// Khóa do server sinh từ loại ảnh nhận ra bằng nội dung, không bao giờ từ tên tệp hay dữ liệu người dùng.
		const key = `public/${randomUUID()}.${type.extension}`;
		// Một đối tượng thay vì biến rời: cờ được đặt bên trong hàm gọi lại của giao dịch, và `catch` cần đọc nó.
		const progress = { startedWriting: false };
		try {
			const row = await this.transactions.run(async (tx) => {
				if (!(await this.images.lockListing(listingId, tx))) {
					throw new AppException(ErrorCode.LISTING_NOT_FOUND);
				}
				const position = nextFreePosition(
					await this.images.findPositions(listingId, tx),
				);
				if (position === null) {
					throw new AppException(ErrorCode.LISTING_IMAGE_LIMIT);
				}
				progress.startedWriting = true;
				await this.storage.put(key, file.buffer);
				return this.images.create(
					{ listingId, position, storageKey: key },
					tx,
				);
			});
			return toListingImage(row);
		} catch (error: unknown) {
			if (progress.startedWriting) await this.discardFile(key);
			throw error;
		}
	}

	/**
	 * Xóa ảnh: xóa dòng trước, tệp sau (lỗi xóa tệp chỉ ghi log, ảnh đã biến khỏi tin). Ảnh không thuộc tin
	 * thì 404 `NOT_FOUND` chung.
	 */
	async remove(
		user: RequestUser,
		listingId: string,
		imageId: string,
	): Promise<void> {
		const owned = await this.listings.findOwnership(listingId);
		if (owned === null) throw new AppException(ErrorCode.LISTING_NOT_FOUND);
		assertOwner(user, owned.property.landlordId);

		const image = await this.images.findInListing(listingId, imageId);
		if (image === null) throw new AppException(ErrorCode.NOT_FOUND);
		if (!(await this.images.delete(listingId, imageId))) {
			throw new AppException(ErrorCode.NOT_FOUND);
		}
		await this.discardFile(image.storageKey);
	}

	/**
	 * Ảnh cho route `GET /media/public/:file` (spec 0002, "Ảnh của tin không hiển thị"): chỉ khi dòng ảnh tồn tại
	 * và tin của nó đang hiện công khai theo đúng điều kiện của danh sách và chi tiết (`publicListingCondition`),
	 * ngược lại `null`. `file` là phần sau `public/` của khóa, đến thẳng từ đường dẫn nên phải kiểm dạng trước.
	 */
	async findPublicFile(
		file: string,
		now: Date,
	): Promise<PublicImageFile | null> {
		const key = `public/${file}`;
		if (!isStorageKey(key)) return null;
		const image = await this.images.findByStorageKey(key);
		if (image === null) return null;
		const visibility: PublicVisibility = {
			now,
			trialListingLimit: await this.settings.getValue(
				'trial_listing_limit',
			),
		};
		if (
			!(await this.listings.isPubliclyVisible(
				image.listingId,
				visibility,
			))
		) {
			return null;
		}
		const stored = await this.storage.get(key);
		if (stored === null) return null;
		const mime = MIME_BY_EXTENSION[key.slice(key.lastIndexOf('.') + 1)];
		if (mime === undefined) {
			stored.stream.destroy();
			return null;
		}
		return { ...stored, mime };
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
}
