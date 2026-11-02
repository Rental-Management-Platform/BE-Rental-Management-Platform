import { randomUUID } from 'node:crypto';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { FieldError } from '../common/errors/error-code';
import { detectImageType } from '../common/files/detect-image-type';
import { MAX_IMAGES_PER_LISTING } from './listing-images.service';
import type { UploadedImage } from './listing-images.service';

/** Tên trường tệp của form đăng tin. `images[]`, `image` hay `file` đều là sai tên (spec 0011 AC-3). */
export const LISTING_IMAGES_FIELD = 'images';

/** Một ảnh đã qua kiểm hình dạng, sẵn sàng để ghi: khóa do server sinh, vị trí theo thứ tự gửi. */
export interface NewListingImageFile {
	readonly storageKey: string;
	readonly position: number;
	readonly data: Uint8Array;
}

const IMAGES_REQUIRED: FieldError = {
	field: LISTING_IMAGES_FIELD,
	code: 'imagesRequired',
	message: 'Cần gửi từ 1 đến 5 ảnh ở trường images.',
};

const TOO_MANY_IMAGES: FieldError = {
	field: LISTING_IMAGES_FIELD,
	code: 'tooManyImages',
	message: 'Chỉ được gửi tối đa 5 ảnh.',
};

function wrongField(index: number): FieldError {
	return {
		field: `${LISTING_IMAGES_FIELD}.${index}`,
		code: 'wrongField',
		message: 'Ảnh phải gửi ở trường images.',
	};
}

function notImage(index: number): FieldError {
	return {
		field: `${LISTING_IMAGES_FIELD}.${index}`,
		code: 'notImage',
		message: 'Chỉ nhận ảnh JPEG, PNG hoặc WebP.',
	};
}

/**
 * Kiểm hình dạng ảnh của yêu cầu đăng tin và sinh khóa lưu trữ, chưa chạm database hay ổ đĩa (spec 0011 AC-3).
 * Gom lỗi của MỌI ảnh vào một `IMAGE_INVALID`: `images` khi yêu cầu không có tệp nào (hoặc hơn 5), `images.N` cho
 * từng tệp sai tên trường hay sai loại, với N đếm từ 0 theo thứ tự tệp trong yêu cầu. Loại ảnh nhận ra bằng nội
 * dung tệp, không tin tên tệp hay `Content-Type`. Khóa lưu trữ do server sinh từ loại ảnh đã nhận ra, không bao
 * giờ từ dữ liệu người dùng. Vì mọi tệp đều ở trường `images` (nếu không đã bị từ chối), `position` chính là chỉ số
 * của tệp: tin mới chưa có ảnh nào nên không cần tìm chỗ trống.
 */
export function prepareListingImages(
	files: readonly UploadedImage[] | undefined,
): NewListingImageFile[] {
	const received = files ?? [];
	if (received.length === 0) {
		throw new AppException(ErrorCode.IMAGE_INVALID, [IMAGES_REQUIRED]);
	}

	const errors: FieldError[] =
		received.length > MAX_IMAGES_PER_LISTING ? [TOO_MANY_IMAGES] : [];
	const prepared: NewListingImageFile[] = [];
	received.forEach((file, index) => {
		if (file.fieldname !== LISTING_IMAGES_FIELD) {
			errors.push(wrongField(index));
			return;
		}
		const type = detectImageType(file.buffer);
		if (type === null) {
			errors.push(notImage(index));
			return;
		}
		prepared.push({
			storageKey: `public/${randomUUID()}.${type.extension}`,
			position: index,
			data: file.buffer,
		});
	});

	if (errors.length > 0) {
		throw new AppException(ErrorCode.IMAGE_INVALID, errors);
	}
	return prepared;
}
