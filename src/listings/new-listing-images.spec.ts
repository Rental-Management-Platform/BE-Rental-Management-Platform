import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-code';
import type { FieldError } from '../common/errors/error-code';
import { STORAGE_KEY_PATTERN } from '../storage/storage.service';
import type { UploadedImage } from './listing-images.service';
import { prepareListingImages } from './new-listing-images';

const PNG = Uint8Array.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Uint8Array.from([
	0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50,
]);
const TEXT = new TextEncoder().encode('đây là văn bản, không phải ảnh');

const image = (buffer: Uint8Array, fieldname = 'images'): UploadedImage => ({
	fieldname,
	buffer,
});

function errorsOf(files: readonly UploadedImage[] | undefined): FieldError[] {
	try {
		prepareListingImages(files);
	} catch (error: unknown) {
		if (error instanceof AppException) {
			expect(error.code).toBe(ErrorCode.IMAGE_INVALID);
			return [...error.fieldErrors];
		}
		throw error;
	}
	throw new Error('Đáng lẽ phải ném IMAGE_INVALID.');
}

const summary = (errors: readonly FieldError[]) =>
	errors.map(({ field, code }) => `${field}:${code}`);

describe('prepareListingImages (spec 0011 AC-3)', () => {
	describe('ảnh hợp lệ', () => {
		it('một ảnh: position 0, khóa do server sinh khớp mẫu, giữ nguyên byte', () => {
			const [only, ...rest] = prepareListingImages([image(PNG)]);
			expect(rest).toEqual([]);
			expect(only?.position).toBe(0);
			expect(only?.storageKey).toMatch(STORAGE_KEY_PATTERN);
			expect(only?.storageKey.endsWith('.png')).toBe(true);
			expect(only?.data).toBe(PNG);
		});

		it('năm ảnh trộn JPEG, PNG, WebP: position theo thứ tự gửi, đuôi theo nội dung, năm khóa khác nhau', () => {
			const prepared = prepareListingImages([
				image(JPEG),
				image(PNG),
				image(WEBP),
				image(PNG),
				image(JPEG),
			]);
			expect(prepared.map((item) => item.position)).toEqual([
				0, 1, 2, 3, 4,
			]);
			expect(
				prepared.map((item) => item.storageKey.split('.').pop()),
			).toEqual(['jpg', 'png', 'webp', 'png', 'jpg']);
			expect(new Set(prepared.map((item) => item.storageKey)).size).toBe(
				5,
			);
			for (const item of prepared) {
				expect(item.storageKey).toMatch(STORAGE_KEY_PATTERN);
			}
		});

		it('mỗi lần gọi sinh khóa mới (khóa không đoán trước được)', () => {
			const first = prepareListingImages([image(PNG)]);
			const second = prepareListingImages([image(PNG)]);
			expect(first[0]?.storageKey).not.toBe(second[0]?.storageKey);
		});
	});

	describe('không có tệp nào', () => {
		it.each([
			['mảng rỗng', []],
			['undefined', undefined],
		])('%s: một lỗi ở trường images, mã imagesRequired', (_name, files) => {
			const errors = errorsOf(files);
			expect(summary(errors)).toEqual(['images:imagesRequired']);
			expect(errors[0]?.message).toBe(
				'Cần gửi từ 1 đến 5 ảnh ở trường images.',
			);
		});
	});

	describe('tệp sai loại', () => {
		it('bốn ảnh tốt cộng một văn bản mang tên .png: lỗi đúng images.4, không dựa vào tên tệp', () => {
			const files = [
				image(PNG),
				image(JPEG),
				image(WEBP),
				image(PNG),
				image(TEXT),
			];
			const errors = errorsOf(files);
			expect(summary(errors)).toEqual(['images.4:notImage']);
			expect(errors[0]?.message).toBe(
				'Chỉ nhận ảnh JPEG, PNG hoặc WebP.',
			);
		});

		it('liệt kê MỌI ảnh sai, không dừng ở ảnh đầu', () => {
			const errors = errorsOf([
				image(TEXT),
				image(PNG),
				image(new Uint8Array(0)),
				image(Uint8Array.from([0x47, 0x49, 0x46, 0x38])),
			]);
			expect(summary(errors)).toEqual([
				'images.0:notImage',
				'images.2:notImage',
				'images.3:notImage',
			]);
		});

		it('RIFF không phải WebP và PNG bị cắt cụt đều bị từ chối', () => {
			const riffWave = Uint8Array.from([
				0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45,
			]);
			const truncatedPng = PNG.slice(0, 7);
			expect(
				summary(errorsOf([image(riffWave), image(truncatedPng)])),
			).toEqual(['images.0:notImage', 'images.1:notImage']);
		});
	});

	describe('sai tên trường', () => {
		it.each(['images[]', 'image', 'file', 'Images', ''])(
			'tệp ở trường %p: images.0:wrongField, không có mục images riêng',
			(fieldname) => {
				const errors = errorsOf([image(PNG, fieldname)]);
				expect(summary(errors)).toEqual(['images.0:wrongField']);
				expect(errors[0]?.message).toBe(
					'Ảnh phải gửi ở trường images.',
				);
			},
		);

		it('có tệp mà không tệp nào đúng tên: mỗi tệp một lỗi images.N', () => {
			const errors = errorsOf([
				image(PNG, 'file'),
				image(JPEG, 'image'),
				image(WEBP, 'images[]'),
			]);
			expect(summary(errors)).toEqual([
				'images.0:wrongField',
				'images.1:wrongField',
				'images.2:wrongField',
			]);
		});

		it('N đếm mọi tệp từ 0 theo thứ tự yêu cầu, kể cả tệp đúng tên đứng giữa', () => {
			const errors = errorsOf([
				image(PNG),
				image(JPEG, 'file'),
				image(TEXT),
				image(WEBP),
			]);
			expect(summary(errors)).toEqual([
				'images.1:wrongField',
				'images.2:notImage',
			]);
		});

		it('tệp sai tên trường không được xét loại: chỉ báo sai tên', () => {
			expect(summary(errorsOf([image(TEXT, 'file')]))).toEqual([
				'images.0:wrongField',
			]);
		});
	});

	describe('quá năm tệp (multer thường chặn trước; đây là lớp phòng thủ thứ hai)', () => {
		it('sáu ảnh tốt: tooManyImages ở trường images', () => {
			const errors = errorsOf(
				Array.from({ length: 6 }, () => image(PNG)),
			);
			expect(summary(errors)).toEqual(['images:tooManyImages']);
			expect(errors[0]?.message).toBe('Chỉ được gửi tối đa 5 ảnh.');
		});

		it('sáu tệp trong đó có một tệp sai: báo cả hai', () => {
			const files = [
				...Array.from({ length: 5 }, () => image(PNG)),
				image(TEXT),
			];
			expect(summary(errorsOf(files))).toEqual([
				'images:tooManyImages',
				'images.5:notImage',
			]);
		});
	});
});
