import { toSearchKey } from './to-search-key';

const MAX_SLUG_LENGTH = 60;
const EMPTY_SLUG = 'tin';

/**
 * Phần chữ của đường dẫn tin `slug-mã` (spec 0002): bỏ dấu, `đ` thành `d`, chữ thường, mọi ký tự khác chữ
 * và số thành `-`, tối đa 60 ký tự, rỗng thì dùng `tin`. Tính lúc đọc, không lưu, nên đổi tiêu đề không làm
 * hỏng đường dẫn cũ (chỉ phần mã ở cuối được dùng để tra).
 */
export function toSlug(title: string): string {
	const slug = toSearchKey(title)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_SLUG_LENGTH)
		.replace(/-+$/g, '');
	return slug.length > 0 ? slug : EMPTY_SLUG;
}
