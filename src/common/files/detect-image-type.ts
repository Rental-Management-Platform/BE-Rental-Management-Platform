export type ImageExtension = 'jpg' | 'png' | 'webp';

export interface ImageType {
	readonly extension: ImageExtension;
	readonly mime: 'image/jpeg' | 'image/png' | 'image/webp';
}

const JPEG: ImageType = { extension: 'jpg', mime: 'image/jpeg' };
const PNG: ImageType = { extension: 'png', mime: 'image/png' };
const WEBP: ImageType = { extension: 'webp', mime: 'image/webp' };

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
	return (
		bytes.length >= signature.length &&
		signature.every((value, index) => bytes[index] === value)
	);
}

/**
 * Nhận ra JPEG, PNG, WebP bằng chữ ký đầu tệp (spec 0002 AC-8), không tin tên tệp hay `Content-Type` của
 * client và không thêm thư viện. Trả `null` khi không phải ba loại này.
 * - JPEG: `FF D8 FF`
 * - PNG: `89 50 4E 47 0D 0A 1A 0A`
 * - WebP: `RIFF`, bốn byte kích thước, rồi `WEBP`
 */
export function detectImageType(bytes: Uint8Array): ImageType | null {
	if (startsWith(bytes, [0xff, 0xd8, 0xff])) return JPEG;
	if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return PNG;
	}
	if (
		startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		bytes.length >= 12 &&
		bytes[8] === 0x57 &&
		bytes[9] === 0x45 &&
		bytes[10] === 0x42 &&
		bytes[11] === 0x50
	) {
		return WEBP;
	}
	return null;
}
