import { randomInt } from 'node:crypto';

/** Bỏ các chữ dễ nhầm (i, l, o) và số 0, 1: 31 ký tự, tám ký tự cho khoảng 8,5 nghìn tỷ mã (spec 0002). */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const LISTING_CODE_LENGTH = 8;
export const LISTING_CODE_ATTEMPTS = 5;

/** Mã vừa sinh đã có tin khác dùng (chỉ mục duy nhất `listings_code_unique`): sinh mã mới rồi thử lại. */
export class ListingCodeTakenError extends Error {
	constructor(options?: { cause?: unknown }) {
		super('Mã tin đã tồn tại.', options);
		this.name = 'ListingCodeTakenError';
	}
}

/** Mã ngắn của tin, dùng ở cuối đường dẫn công khai `slug-mã`. Dùng `crypto.randomInt`, không đoán được. */
export function generateListingCode(): string {
	let code = '';
	for (let i = 0; i < LISTING_CODE_LENGTH; i += 1) {
		code += ALPHABET.charAt(randomInt(ALPHABET.length));
	}
	return code;
}

const CODE_PATTERN = /^[a-z0-9]{8}$/;

/**
 * Lấy mã từ `slugCode` của đường dẫn: phần sau dấu `-` cuối cùng (hoặc cả chuỗi khi không có dấu `-`), phải
 * khớp `^[a-z0-9]{8}$`. Không khớp thì `null` (route trả 404, không 400). Phần slug phía trước không được dùng
 * để tra nên đổi tiêu đề vẫn mở được link cũ (spec 0002 AC-11).
 */
export function extractListingCode(slugCode: string): string | null {
	const code = slugCode.slice(slugCode.lastIndexOf('-') + 1);
	return CODE_PATTERN.test(code) ? code : null;
}
