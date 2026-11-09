/**
 * Nội dung tĩnh của đánh giá từng phòng trong bộ dữ liệu demo (spec 0015). Chỉ là dữ liệu mô tả, như `demo-reviews.ts`:
 * `demo-build.ts` đổi nó thành các dòng bảng `listing_reviews`, `conversations` và `messages` theo thời điểm chạy.
 * Khóa của người tìm trọ là `key` trong `DEMO_TENANTS`; tin đăng được nhận ra bằng tiêu đề đúng từng chữ trong
 * `DEMO_LISTINGS` (tiêu đề không trùng nhau, và `demo-reviews.spec.ts` kiểm điều đó).
 */

/**
 * Một đánh giá phòng mẫu của người tìm trọ về một tin. Mỗi cặp (`tenant`, `listing`) chỉ có một dòng. Đánh giá chỉ tồn
 * tại khi chủ trọ của tin đã trả lời trong cuộc trò chuyện về CHÍNH tin đó, nên `demo-build.ts` dựng một cuộc trò chuyện
 * hai tin trên đúng tin được đánh giá, xảy ra trước lúc viết (dùng lại cuộc trò chuyện sẵn có nếu cặp đó đã có).
 */
export interface DemoRoomReview {
	/** Khóa của người tìm trọ viết đánh giá. */
	readonly tenant: string;
	/** Tiêu đề của tin được đánh giá, đúng từng chữ như trong `DEMO_LISTINGS`. */
	readonly listing: string;
	readonly stars: number;
	/** `null` là chỉ chấm sao, không nhận xét. */
	readonly comment: string | null;
	/** Số ngày trước hôm nay lúc viết; `demo-build.ts` dời sau lúc các bên đã tồn tại nếu cần. */
	readonly daysAgo: number;
	/** Số ngày trước hôm nay lúc người viết sửa lần cuối (nhỏ hơn `daysAgo`); vắng là chưa sửa. */
	readonly editedDaysAgo?: number;
	/** Admin đã ẩn: lý do và số ngày trước hôm nay lúc ẩn (nhỏ hơn `daysAgo`). */
	readonly hidden?: { readonly reason: string; readonly daysAgo: number };
}

const WIFI_ROOM = 'Phòng trọ 18m² mới xây, wifi tốc độ cao';
const STUDIO_VO_VAN_NGAN =
	'Studio ban công riêng, view thoáng, đường Võ Văn Ngân';
const STUDIO_PASTEUR = 'Studio Pasteur cửa sổ lớn, dọn phòng hai lần mỗi tuần';
const ROOM_AIRPORT = 'Phòng trọ 20m² sạch sẽ, gần sân bay Tân Sơn Nhất';
const ROOM_RENTED_OUT = 'Phòng tầng 2 đã cho thuê, tạm ẩn tin';
const ROOM_AEON = 'Phòng 20m² có gác, gần Aeon Mall Bình Tân';

/**
 * 16 đánh giá phòng mẫu trên 6 tin, rải đủ các cảnh FE phải xử lý:
 * - tin có nhiều đánh giá với điểm lẻ làm tròn nửa lên: phòng 18m² của Khoa có 4 đánh giá tính (5, 4, 4, 4), trung bình
 *   4,25 thành 4,3; trong đó có đánh giá chỉ có sao (Yến), nhận xét nhiều dòng (Việt) và đánh giá đã sửa (Diệp);
 * - đánh giá bị admin ẩn kèm lý do (Quân), và đánh giá của người viết bị khóa (Sơn): cả hai nằm trong bảng nhưng không
 *   tính vào danh sách công khai hay hai con số của phòng 18m²;
 * - tin chỉ một đánh giá (studio Pasteur của Nhung, 5,0), điểm nguyên (phòng gần sân bay, 3 đánh giá trung bình 3,0 thành 3);
 * - đánh giá của tin đang bị chủ trọ ẩn ("Phòng tầng 2 đã cho thuê"): dòng còn nguyên, chi tiết tin trả 404;
 * - tin chưa có đánh giá nào là mọi tin còn lại (ví dụ phòng có gác đầu tiên của Khoa).
 */
export const DEMO_ROOM_REVIEWS: readonly DemoRoomReview[] = [
	// ----- Khoa, phòng 18m² mới xây: 4 đánh giá tính (4,3), 1 bị admin ẩn, 1 của người viết bị khóa -----
	{
		tenant: 'lananh',
		listing: WIFI_ROOM,
		stars: 5,
		comment:
			'Phòng đúng như ảnh, wifi nhanh nên mình học online không bị giật. Chủ trọ trả lời tin nhắn rất sớm.',
		daysAgo: 18,
	},
	{
		tenant: 'viet',
		listing: WIFI_ROOM,
		stars: 4,
		comment:
			'Phòng sạch, mới sơn.\nCửa sổ hơi nhỏ nên buổi trưa khá nóng, nên lắp thêm quạt thông gió.',
		daysAgo: 24,
	},
	{ tenant: 'yen', listing: WIFI_ROOM, stars: 4, comment: null, daysAgo: 29 },
	{
		tenant: 'diep',
		listing: WIFI_ROOM,
		stars: 4,
		comment:
			'Phòng ổn, đúng giá. Sau khi mình báo thì chủ trọ đã lắp thêm quạt thông gió.',
		daysAgo: 41,
		editedDaysAgo: 33,
	},
	{
		tenant: 'quan',
		listing: WIFI_ROOM,
		stars: 1,
		comment: 'Phòng tệ, chủ trọ lừa đảo, đừng tin!!!',
		daysAgo: 15,
		hidden: { reason: 'Nội dung xúc phạm cá nhân.', daysAgo: 13 },
	},
	{
		tenant: 'son',
		listing: WIFI_ROOM,
		stars: 2,
		comment: 'Phòng hơi ồn về đêm, cách âm kém nên mình đã trả phòng.',
		daysAgo: 30,
	},

	// ----- Khoa, studio Võ Văn Ngân: 3 đánh giá (14 trên 3, trung bình 4,7) -----
	{
		tenant: 'thinh',
		listing: STUDIO_VO_VAN_NGAN,
		stars: 5,
		comment: 'Ban công rộng, view thoáng, chiều xuống ngồi rất mát.',
		daysAgo: 20,
	},
	{
		tenant: 'truc',
		listing: STUDIO_VO_VAN_NGAN,
		stars: 4,
		comment:
			'Studio gọn, đủ đồ dùng. Hơi xa chợ nhưng có siêu thị mini ở đầu đường.',
		daysAgo: 25,
	},
	{
		tenant: 'diep',
		listing: STUDIO_VO_VAN_NGAN,
		stars: 5,
		comment: null,
		daysAgo: 35,
	},

	// ----- Nhung, studio Pasteur: đúng một đánh giá (5,0) -----
	{
		tenant: 'thinh',
		listing: STUDIO_PASTEUR,
		stars: 5,
		comment:
			'Dọn phòng đúng lịch, cửa sổ lớn nên rất sáng. Từ đây đi bộ được tới chợ Bến Thành.',
		daysAgo: 11,
	},

	// ----- Nhung, phòng gần sân bay: 3 đánh giá (9 trên 3, trung bình đúng 3) -----
	{
		tenant: 'lananh',
		listing: ROOM_AIRPORT,
		stars: 4,
		comment: 'Phòng sạch, chủ trọ dễ tính.',
		daysAgo: 14,
	},
	{
		tenant: 'viet',
		listing: ROOM_AIRPORT,
		stars: 2,
		comment: 'Máy bay bay qua khá ồn, ban đêm khó ngủ.',
		daysAgo: 19,
	},
	{
		tenant: 'yen',
		listing: ROOM_AIRPORT,
		stars: 3,
		comment: null,
		daysAgo: 23,
	},

	// ----- Nhung, phòng đang bị chủ trọ ẩn: đánh giá còn nguyên nhưng chi tiết tin trả 404 -----
	{
		tenant: 'truc',
		listing: ROOM_RENTED_OUT,
		stars: 3,
		comment: 'Phòng ổn so với giá, nhưng cầu thang hơi dốc.',
		daysAgo: 22,
	},

	// ----- Bảo, phòng gần Aeon Mall: 2 đánh giá (4,5) -----
	{
		tenant: 'diep',
		listing: ROOM_AEON,
		stars: 4,
		comment: 'Gác rộng, có chỗ phơi đồ. Gần Aeon nên đi chơi cũng tiện.',
		daysAgo: 22,
	},
	{
		tenant: 'quan',
		listing: ROOM_AEON,
		stars: 5,
		comment: null,
		daysAgo: 33,
	},
];
