import { toSearchKey } from '../common/text/to-search-key';
import { LISTING_LIMITS } from './listing-status';

/**
 * Tách từ khóa `q` của danh sách công khai thành các từ để lọc (spec 0002 AC-10, "Biên của `GET /listings`"):
 * bỏ dấu và đổi chữ thường bằng đúng hàm đã dựng `search_key`, chỉ lấy 6 từ đầu, cắt mỗi từ còn 50 ký tự.
 * `q` vắng hoặc rỗng sau khi cắt thì không có từ nào (bỏ lọc). Mỗi từ là một điều kiện, nối bằng AND.
 */
export function toSearchWords(q: string | undefined): string[] {
	if (q === undefined) return [];
	return toSearchKey(q)
		.split(' ')
		.filter((word) => word.length > 0)
		.slice(0, LISTING_LIMITS.searchWordsMax)
		.map((word) => word.slice(0, LISTING_LIMITS.searchWordLengthMax));
}
