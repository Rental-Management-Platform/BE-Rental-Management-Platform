/** Ba trạng thái của tin (spec 0002): `CHECK` ở DB cũng chỉ nhận ba giá trị này. */
export const LISTING_STATUSES = [
	'visible',
	'hidden_by_owner',
	'hidden_by_admin',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** Ba kiểu sắp xếp của danh sách công khai (spec 0002 AC-10). */
export const LISTING_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

/** Giới hạn dữ liệu nhận vào của tin (spec 0002, "Giới hạn dữ liệu nhận vào" và "Biên của `GET /listings`"). */
export const LISTING_LIMITS = {
	titleMin: 5,
	titleMax: 120,
	descriptionMin: 10,
	descriptionMax: 5000,
	priceMin: 100_000,
	priceMax: 100_000_000,
	areaMin: 1,
	areaMax: 1000,
	depositMax: 1_000_000_000,
	/** `minPrice` và `maxPrice` của bộ lọc: số nguyên từ 0 đến 100.000.000. */
	filterPriceMax: 100_000_000,
	/** `q`: tối đa 6 từ (thừa thì bỏ), mỗi từ tối đa 50 ký tự (dài hơn thì cắt). */
	searchWordsMax: 6,
	searchWordLengthMax: 50,
	/** Chặn chuỗi `q` khổng lồ trước khi tách từ; đủ rộng cho 6 từ dài nhất cộng khoảng trắng. */
	searchTextMax: 500,
} as const;

/** Ngày không giờ, `YYYY-MM-DD`, năm 1000 đến 9999 (năm 0000 làm PostgreSQL báo lỗi ngày không hợp lệ). */
export const DATE_ONLY_PATTERN = /^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/;
