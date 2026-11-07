/**
 * Nội dung tĩnh của đánh giá chủ trọ trong bộ dữ liệu demo (spec 0014). Chỉ là dữ liệu mô tả, như `demo-data.ts`:
 * `demo-build.ts` đổi nó thành các dòng bảng `reviews`, `conversations` và `messages` theo thời điểm chạy. Khóa của
 * người tìm trọ và chủ trọ là `key` trong `DEMO_TENANTS` và `DEMO_LANDLORDS`.
 */

/**
 * Một đánh giá mẫu của người tìm trọ về chủ trọ. Mỗi cặp (`tenant`, `landlord`) chỉ có một dòng. Đánh giá chỉ tồn tại
 * khi có bằng chứng chat (chủ trọ đã trả lời), nên `demo-build.ts` dựng thêm một cuộc trò chuyện hai tin cho từng
 * đánh giá, xảy ra trước lúc viết.
 */
export interface DemoReview {
	/** Khóa của người tìm trọ viết đánh giá. */
	readonly tenant: string;
	/** Khóa của chủ trọ được đánh giá. */
	readonly landlord: string;
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

/**
 * 30 đánh giá mẫu, rải đủ các cảnh FE phải xử lý: chủ trọ có nhiều đánh giá (Khoa 8 đang hiện, trung bình 4,5), điểm
 * lẻ làm tròn nửa lên (Bảo 3,25 thành 3,3), chỉ một đánh giá (Tâm), chưa có đánh giá nào (Mai, Hà), đánh giá chỉ có
 * sao, nhận xét nhiều dòng, đánh giá đã sửa, một đánh giá bị admin ẩn (Quân về Nhung), đánh giá của người viết bị khóa
 * (Sơn về Khoa, không hiện công khai) và đánh giá về chủ trọ bị khóa (Lan, hồ sơ trả 404).
 */
export const DEMO_REVIEWS: readonly DemoReview[] = [
	// ----- Trần Minh Khoa: 8 đang hiện (4,5), 1 của người viết bị khóa -----
	{
		tenant: 'lananh',
		landlord: 'khoa',
		stars: 5,
		comment:
			'Anh Khoa trả lời tin nhắn rất nhanh, phòng đúng như ảnh và sạch sẽ. Mình ở hơn ba tháng rồi, không có gì để chê.',
		daysAgo: 9,
	},
	{
		tenant: 'viet',
		landlord: 'khoa',
		stars: 5,
		comment:
			'Giá minh bạch, tiền điện nước tính đúng như đã báo từ đầu. Hợp đồng rõ ràng, đặt cọc xong có biên nhận.',
		daysAgo: 14,
	},
	{
		tenant: 'yen',
		landlord: 'khoa',
		stars: 4,
		comment: 'Phòng ổn, thoáng. Chỗ gửi xe hơi chật vào giờ cao điểm.',
		daysAgo: 21,
	},
	{ tenant: 'thinh', landlord: 'khoa', stars: 5, comment: null, daysAgo: 27 },
	{
		tenant: 'diep',
		landlord: 'khoa',
		stars: 4,
		comment:
			'Chủ trọ dễ tính, báo hỏng điện là có người sửa trong ngày.\nChỉ tiếc là wifi tầng 3 hơi yếu.',
		daysAgo: 33,
	},
	{
		tenant: 'quan',
		landlord: 'khoa',
		stars: 3,
		comment: 'Bình thường, giá hơi cao so với mặt bằng khu này.',
		daysAgo: 38,
		editedDaysAgo: 30,
	},
	{
		tenant: 'truc',
		landlord: 'khoa',
		stars: 5,
		comment:
			'Đi bộ năm phút là tới trường, xung quanh có nhiều quán ăn rẻ.',
		daysAgo: 22,
	},
	{
		tenant: 'tuan',
		landlord: 'khoa',
		stars: 5,
		comment:
			'Mới dọn vào tuần trước, anh Khoa hướng dẫn tận tình từ cách đóng tiền đến chỗ phơi đồ.',
		daysAgo: 6,
	},
	{
		tenant: 'son',
		landlord: 'khoa',
		stars: 2,
		comment: 'Mình trả phòng sau hai tháng vì khu nhà hơi ồn vào buổi tối.',
		daysAgo: 35,
	},

	// ----- Lê Thị Hồng Nhung: 7 đang hiện (4,3), 1 bị admin ẩn -----
	{
		tenant: 'lananh',
		landlord: 'nhung',
		stars: 5,
		comment: 'Chị Nhung rất nhiệt tình, còn giúp mình tìm thêm bạn ở ghép.',
		daysAgo: 12,
	},
	{
		tenant: 'viet',
		landlord: 'nhung',
		stars: 4,
		comment: 'Phòng có cửa sổ lớn, giờ giấc tự do. Nhà vệ sinh hơi nhỏ.',
		daysAgo: 18,
	},
	{
		tenant: 'yen',
		landlord: 'nhung',
		stars: 5,
		comment: 'Đi làm về khuya vẫn được hỗ trợ mở cổng, ở rất yên tâm.',
		daysAgo: 25,
	},
	{
		tenant: 'thinh',
		landlord: 'nhung',
		stars: 4,
		comment: null,
		daysAgo: 30,
	},
	{
		tenant: 'diep',
		landlord: 'nhung',
		stars: 5,
		comment:
			'Phòng mới sơn lại, sạch sẽ, chủ trọ giữ đúng cam kết trong hợp đồng.',
		daysAgo: 42,
	},
	{
		tenant: 'quan',
		landlord: 'nhung',
		stars: 1,
		comment: 'Chủ trọ nói chuyện thiếu tôn trọng, đừng thuê chỗ này!!!',
		daysAgo: 16,
		hidden: { reason: 'Nội dung xúc phạm cá nhân.', daysAgo: 14 },
	},
	{
		tenant: 'tuan',
		landlord: 'nhung',
		stars: 4,
		comment: 'Chủ trọ phản hồi nhanh, hợp đồng ghi rõ giá điện.',
		daysAgo: 5,
	},
	{
		tenant: 'truc',
		landlord: 'nhung',
		stars: 3,
		comment:
			'Phòng ổn nhưng đường trước nhà hay ngập khi mưa lớn, mình phải kê đồ lên cao.',
		daysAgo: 24,
	},

	// ----- Phạm Quốc Bảo: 4 đánh giá, trung bình 3,25 làm tròn thành 3,3 -----
	{
		tenant: 'lananh',
		landlord: 'bao',
		stars: 4,
		comment: 'Phòng đúng như tả, chủ trọ hỗ trợ nhiệt tình lúc chuyển đồ.',
		daysAgo: 20,
	},
	{
		tenant: 'viet',
		landlord: 'bao',
		stars: 3,
		comment:
			'Phòng tạm được. Tiền nước tăng giữa chừng mà báo hơi muộn, mong chủ trọ báo sớm hơn.',
		daysAgo: 26,
	},
	{
		tenant: 'yen',
		landlord: 'bao',
		stars: 2,
		comment: 'Hay mất nước vào buổi sáng, báo nhiều lần mới có người sửa.',
		daysAgo: 31,
		editedDaysAgo: 28,
	},
	{
		tenant: 'diep',
		landlord: 'bao',
		stars: 4,
		comment: 'Giá hợp lý trong khu này, gần chợ.',
		daysAgo: 40,
	},

	// ----- Nguyễn Hữu Phát: 3 đánh giá (4,7) -----
	{
		tenant: 'thinh',
		landlord: 'phat',
		stars: 5,
		comment:
			'Phòng mới xây, thoáng, chủ trọ dễ chịu và trả lời tin nhắn ngay.',
		daysAgo: 8,
	},
	{ tenant: 'quan', landlord: 'phat', stars: 5, comment: null, daysAgo: 12 },
	{
		tenant: 'truc',
		landlord: 'phat',
		stars: 4,
		comment: 'Ổn, chỉ có điều bãi xe hơi nhỏ.',
		daysAgo: 15,
	},

	// ----- Hoàng Gia Huy: 2 đánh giá (4,5), tin đã biến khỏi công khai nhưng hồ sơ vẫn xem được -----
	{
		tenant: 'lananh',
		landlord: 'huy',
		stars: 4,
		comment: 'Phòng ổn, anh Huy cho xem nhà tận nơi.',
		daysAgo: 60,
	},
	{
		tenant: 'viet',
		landlord: 'huy',
		stars: 5,
		comment: 'Chủ trọ uy tín, trả cọc đầy đủ khi mình chuyển đi.',
		daysAgo: 45,
	},

	// ----- Võ Thanh Tâm: đúng một đánh giá -----
	{
		tenant: 'thinh',
		landlord: 'tam',
		stars: 5,
		comment: 'Chủ trọ mới nhưng rất nhiệt tình, phòng sạch.',
		daysAgo: 4,
	},

	// ----- Bùi Ngọc Lan (bị khóa): đánh giá còn nguyên nhưng hồ sơ trả 404 nên không ai thấy -----
	{
		tenant: 'lananh',
		landlord: 'lan',
		stars: 5,
		comment: 'Chị Lan hỗ trợ nhiệt tình.',
		daysAgo: 50,
	},
	{ tenant: 'yen', landlord: 'lan', stars: 4, comment: null, daysAgo: 44 },
	{
		tenant: 'diep',
		landlord: 'lan',
		stars: 5,
		comment: 'Phòng đẹp, chủ trọ thân thiện.',
		daysAgo: 36,
	},
];

/**
 * Cuộc trò chuyện mẫu không kèm đánh giá, dựng hai cảnh của điều kiện được đánh giá (spec 0014 AC-4): chủ trọ đã trả
 * lời nhưng người tìm trọ chưa viết (`canReview` là `true`, để thử viết đánh giá), và chủ trọ chưa trả lời (`canReview`
 * là `false`, viết bị 403). Mỗi cặp (`tenant`, `landlord`) không trùng với `DEMO_REVIEWS`.
 */
export interface DemoChat {
	readonly tenant: string;
	readonly landlord: string;
	readonly replied: boolean;
	/** Số ngày trước hôm nay lúc người tìm trọ nhắn tin đầu. */
	readonly daysAgo: number;
	/** Người tìm trọ chưa đọc tin trả lời (cảnh chấm "chưa đọc"). */
	readonly tenantUnread?: boolean;
}

export const DEMO_CHATS: readonly DemoChat[] = [
	{ tenant: 'lananh', landlord: 'phat', replied: true, daysAgo: 3 },
	{ tenant: 'viet', landlord: 'phat', replied: true, daysAgo: 2 },
	{ tenant: 'yen', landlord: 'tam', replied: true, daysAgo: 4 },
	{
		tenant: 'linh',
		landlord: 'nhung',
		replied: true,
		daysAgo: 1,
		tenantUnread: true,
	},
	{ tenant: 'tuan', landlord: 'bao', replied: false, daysAgo: 2 },
];

/** Lời nhắn đầu của người tìm trọ và lời trả lời của chủ trọ trong các cuộc trò chuyện mẫu; chọn theo hạt giống. */
export const DEMO_CHAT_ASKS: readonly string[] = [
	'Chào anh chị, phòng này còn trống không ạ?',
	'Cho mình hỏi phòng còn không và có cho nấu ăn trong phòng không ạ?',
	'Mình muốn xem phòng vào cuối tuần, anh chị sắp xếp được không ạ?',
	'Giá phòng đã gồm tiền rác và wifi chưa ạ?',
];

export const DEMO_CHAT_REPLIES: readonly string[] = [
	'Dạ còn bạn nhé, bạn ghé xem phòng lúc nào tiện cũng được.',
	'Phòng còn, có chỗ nấu ăn riêng. Bạn qua xem trực tiếp cho dễ hình dung nhé.',
	'Được bạn, cuối tuần mình có mặt cả ngày, bạn nhắn trước một tiếng nhé.',
	'Giá chưa gồm điện nước, wifi và rác tính riêng như trong tin đăng bạn nhé.',
];
