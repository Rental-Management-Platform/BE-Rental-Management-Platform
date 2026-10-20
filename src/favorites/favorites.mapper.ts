import { toListingSummary } from '../listings/listings.mapper';
import type { SavedListingRow } from '../listings/listings.repository';
import type { SavedListingResponse } from './dto/favorite.response';

/**
 * Phần tử của `GET /me/favorites`: đúng các trường của tin tóm tắt công khai (cùng hàm ánh xạ với `GET /listings`,
 * nên `slug`, `fullAddress`, `coverImageUrl` giống hệt) cộng `favoritedAt` và `isFavorite: true`.
 */
export function toSavedListing(saved: SavedListingRow): SavedListingResponse {
	return {
		...toListingSummary(saved.row),
		favoritedAt: saved.favoritedAt,
		isFavorite: true,
	};
}
