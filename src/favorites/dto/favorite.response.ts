import type { ListingSummaryResponse } from '../../listings/dto/listing.response';

/** Kết quả của lưu và bỏ lưu (spec 0006): `isFavorite` là hằng theo hành động, `listingId` là id ở đường dẫn. */
export interface FavoriteResultResponse {
	readonly listingId: string;
	readonly isFavorite: boolean;
}

/** "Tin đã lưu" (spec 0006, "Hình dạng trả về"): tin tóm tắt công khai cộng lúc lưu; `isFavorite` luôn là `true`. */
export interface SavedListingResponse extends ListingSummaryResponse {
	/** Lúc người gọi lưu tin (`favorites.created_at`). */
	readonly favoritedAt: Date;
	readonly isFavorite: true;
}
