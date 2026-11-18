# Verify: Thống kê cho chủ trọ · spec 0017 · updated 2026-11-18
_Steps derived from spec 0017 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Mốc 1 (AC-1 đến AC-7, AC-12 phần cột `views`, AC-13 đến AC-15) đã build và kiểm thật ngày 2026-11-18. Mốc 2 (AC-8 đến AC-11, ba cột còn lại của `series`, và rà lại AC-1 đến AC-15) đã build và kiểm thật cùng ngày, xem mục "Mốc 2" bên dưới. Các mục "Commands", "UI / manual", "Database và bộ đếm đọc", "Điều khiển âm" ngay dưới đây là của mốc 1; số kiểm tra của mốc 1 nay chạy trên phản hồi chín khối, nên bộ đầy đủ ra 110 kiểm tra thay vì 88.

Cách chạy lại: dùng database thử `rental_management_verify` (không bao giờ database dev), API chạy cổng 3055 với `ACCESS_TTL_SECONDS=900` (`.env` khai hai lần, giá trị sau là 60 giây nên token hết hạn giữa chừng), SMTP trỏ vào cổng chết để không gửi thư thật, `UPLOAD_DIR` trỏ ra thư mục riêng. Năm script nằm ở scratchpad của phiên build (sẽ bị dọn) và đã chép một bản vào thư mục memory `verify-scripts-0017/`; mô tả dưới đây đủ để viết lại:
- `setup.js`: từ chối chạy nếu `.env` hay shell trỏ vào database thử, rồi `DROP SCHEMA public CASCADE`, `prisma migrate deploy` (cả 18 migration), `node dist/database/seed.js`.
- `fixtures.js`: đăng ký bằng API sáu chủ trọ `l1` đến `l6` và một người tìm trọ `t1`, rồi chèn tin, lượt xem theo ngày, đơn và kỳ gói bằng SQL tay. `l1` dùng thử (hạn 2) với tin ở cả bốn trạng thái, hai tin xóa mềm (một trong nhà trọ đã xóa mềm) và các cặp hòa lượt; `l2` có gói hạn 3 đè dùng thử còn hạn, kèm một tin hòa lượt mà `created_at` cũ nhưng `id` mới; `l3` hết dùng thử và gói đã hết hạn (hạn 0); `l4` mới trống; `l5` để thử khóa tài khoản; `l6` có hai tin `view_count` 2 tỷ và hai dòng ngày 2 tỷ (cộng vượt `int4`).
- `check.js`: oracle độc lập (lấy dòng thô bằng `SELECT` đơn giản rồi cộng, xếp hạng, so ngày bằng JavaScript) và mọi phép kiểm bên dưới; `--quick` bỏ phần đo bộ đếm đọc của PostgreSQL (mất khoảng 35 giây).
- `controls.js`: các điều khiển âm, mỗi cái vá một chỗ trong `dist/statistics/`, chạy `check.js --quick`, rồi khôi phục file (so nội dung).

## Commands
- [x] `npx tsc --noEmit`, `npx eslint` (không `--fix`) trên `src/statistics/**`, `permission-catalog.ts`, `permission-catalog.spec.ts`, `app.module.ts` → sạch, exit 0   → AC-1 đến AC-7, AC-15
- [x] `npm test` → 2511 test đạt, 109 suite (không test nào lỗi)   → AC-1 đến AC-7, AC-15
- [x] `npx prisma migrate deploy` trên database trống (18 migration, gồm `20261116100000_landlord_statistic_permission`) rồi `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected" (mốc này không đổi schema, đúng spec)   → AC-15
- [x] `node check.js` (bản đầy đủ) trên database dựng lại từ trống → 88 trên 88 qua; `node check.js --quick` → 86 trên 86 qua   → AC-1 đến AC-7, AC-12, AC-13 đến AC-15

## UI / manual (kiểm bằng API thật, chưa có màn hình)
Mỗi dòng dưới đây là một nhóm phép kiểm trong `check.js`, đã chạy và qua.
- [x] Với `l1` đến `l6`, `GET /me/statistics` mặc định, `to` hôm nay, `from` hôm nay lùi 29 ngày, và bảy khoảng khác (chỉ `to`, chỉ `from`, một ngày sát ranh, kỳ cũ, đúng 366 ngày, tháng 2 năm nhuận, 2000-01-01) → body bằng oracle ở `period`, `listings`, `views` (kể cả `top`), `series`; đúng năm khóa `period, listings, membership, views, series`; tổng cột `views` của `series` bằng `views.inRange.value`   → AC-1, AC-4, AC-6, AC-7, AC-12
- [x] `l1` mặc định ra đúng số tính tay trước khi chạy: tổng 6, `public` 2, `hiddenByQuota` 2, `hiddenByOwner` 1, `hiddenByAdmin` 1; `inRange` 2052, `previous` 129, `changePercent` 1490.7, `allTime` 3190; `top` là `l1.a2`, `l1.a1` (hòa 50, tin mới hơn trước), `l1.a3`, `l1.a5`, `l1.a6` với `isPublic` `true, true, false, false, false`; tin hạng sáu `l1.a4` bị cắt; tin xóa mềm lượt 999 nằm trong `inRange` nhưng không có trong `top` và không làm lệch hạng   → AC-4, AC-6, AC-7
- [x] `l2` (gói hạn 3, dùng thử còn hạn hạn 2): `public` 3, `hiddenByQuota` 2, `hiddenByOwner` 2, state `plan`; `l2.v1` đứng trước `l2.old` dù hòa 66 lượt (khóa phụ `created_at DESC` thắng `id DESC`)   → AC-4, AC-5, AC-7
- [x] `l3` (hết dùng thử và gói đã hết hạn): `public` 0, `hiddenByQuota` 3, `hiddenByAdmin` 1, state `expired`, `listingLimit` 0, `subscription` null   → AC-4, AC-5
- [x] `l6`: `views.allTime` 4000000000 và `inRange.value` 4000000000, không tràn `int4`   → AC-6
- [x] Với cả sáu chủ trọ, `membership` trong thống kê bằng đúng thân `GET /me/membership`; `visibleCount` bằng `public + hiddenByQuota`, `overLimitCount` bằng `hiddenByQuota`   → AC-5
- [x] Với cả sáu chủ trọ, `listings.public` bằng `publicListingCount` của `GET /landlords/:id`, bằng số tin của chủ trọ đó trong `GET /listings`, bằng số phần tử và trường `total` của `GET /landlords/:id/listings`; `views.allTime` bằng `totalViewCount`   → AC-4, AC-6
- [x] `l1` và `l2`: `isPublic` và `status` của từng dòng `top` bằng cờ cùng tên của `GET /me/listings`   → AC-7
- [x] Bảy lỗi tham số (`from` sau `to`, 367 ngày, `from=2026-02-30`, `from=1999-12-31`, `to=2101-01-01`, `to=21/10/2026`, `groupBy`, `sort`) → 400 `VALIDATION_FAILED` ở đúng trường (`to`, `to`, `from`, `from`, `to`, `to`, `groupBy`, `sort`); `to=2100-12-31` vẫn 200   → AC-2
- [x] `period` mặc định: `to` bằng ngày hôm nay giờ Việt Nam lấy độc lập bằng `Intl.DateTimeFormat`, `from` lùi 29 ngày, `days` 30, `timeZone` `Asia/Ho_Chi_Minh`; kỳ trước của 2024-03-01 đến 2024-03-10 là 2024-02-20 đến 2024-02-29 và của 2025-03-01 một ngày là 2025-02-28   → AC-2, AC-3
- [x] Phản hồi 200 có `Cache-Control: private, no-store`   → AC-1
- [x] Gọi route cho cả sáu chủ trọ (366 ngày) và ba lần nữa cho `l1`, chụp số dòng và `md5` nội dung của mọi bảng trước và sau → giống từng byte   → AC-1
- [x] `l4` mới trống: mọi số 0, `changePercent` null, `top` là `[]`, `series` đủ 30 ngày toàn 0   → AC-14
- [x] Với cả sáu chủ trọ, văn bản phản hồi không có `@verify.test`, số điện thoại, id của người dùng khác hay tên dạng `Verify lN`; mọi `id` trong `top` thuộc tin của chính chủ trọ   → AC-14
- [x] Không token → 401 `TOKEN_MISSING`; token rác → 401 `TOKEN_INVALID`; tenant → 403 `PERMISSION_DENIED` kể cả khi gửi tham số sai; admin → 403 `PERMISSION_DENIED`; admin gửi `from=2026-02-30` → 400   → AC-15
- [x] Token chủ trọ mang `statistic:manage`, token tenant không mang khóa `statistic:*`; `GET /permissions` có module `statistic` với hành động `read`   → AC-15
- [x] Chủ trọ `l5` bị đặt `status = 'locked'` trong database mà token còn hạn → vẫn 200, số tin và `allTime` bằng lúc trước; mở lại sau khi thử   → AC-15
- [x] Migration chạy hai lần liên tiếp → `statistic:read` đúng một lần trong quyền `landlord`, mảng quyền `tenant` và `admin` không đổi, `tenant` không có khóa này   → AC-15
- [x] Gỡ `statistic:read` khỏi `landlord`, đăng nhập `l2` (token thiếu `statistic`) → 403; áp migration → token cũ vẫn 403; `POST /auth/refresh` bằng cookie → token mới gọi route được 200   → AC-15

## Database và bộ đếm đọc
- [x] Ba truy vấn của Repository (`listingCountsQuery`, `dailyViewsQuery`, `topListingsQuery`, lấy từ `dist` và chạy bằng `pg`) với múi giờ phiên đặt `UTC`, `Asia/Ho_Chi_Minh`, `America/Los_Angeles` (xác nhận bằng `SHOW timezone`) cho `l1`, `l2`, `l6`, kể cả khoảng một ngày sát ranh → kết quả giống nhau từng dòng giữa ba múi giờ   → AC-13, AC-6
- [x] Admin cấp `statistic:read` cho `tenant` bằng `PATCH /account-types/tenant`, đăng nhập lại `t1` (token mang khóa) → vẫn 403; rồi ghi bộ đếm `seq_scan + idx_scan` của `listings`, `properties`, `listing_daily_views`, `orders`, `subscriptions` (đợi 11,5 giây cho PostgreSQL ghi bộ đếm), gọi route bằng tenant được cấp, tenant thường và admin (kể cả một lần tham số sai), đợi lại → bộ đếm không đổi; điều khiển dương: một lần gọi của `l1` làm bộ đếm `listings` và `listing_daily_views` tăng, nên cách đo thấy được việc đọc; quyền `tenant` được khôi phục về đúng danh sách cũ   → AC-15

## Điều khiển âm (kiểm có bắt được lỗi thật không)
Mỗi điều khiển sửa thẳng một file trong `dist/statistics/`, chạy lại `check.js --quick`, mong đúng kiểm tra tương ứng đỏ, rồi khôi phục file (so nội dung). Đã chạy 17 điều khiển, cả 17 bị bắt.
- [x] Cận trên của ngày đổi `<=` thành `<` → 20 phép kiểm đỏ (so oracle, ngày sát ranh)   → AC-6, AC-13
- [x] Bộ đếm trạng thái tính cả tin xóa mềm (bỏ `deleted_at IS NULL` khỏi ba `FILTER`) → 19 đỏ   → AC-4
- [x] Bỏ lọc theo chủ trọ ở truy vấn lượt xem theo ngày → 31 đỏ (số của `l6` lọt vào chủ trọ khác)   → AC-14
- [x] Bỏ `assertLandlord` trong Service → 1 đỏ: admin nhận 200 thay vì 403   → AC-15
- [x] `SUM(view_count)` ép `::int` → 9 đỏ (`l6` tràn)   → AC-6
- [x] `isPublic` bỏ điều kiện `status = 'visible'` → 3 đỏ (kể cả so với `GET /me/listings`)   → AC-7
- [x] Hạng tính cả tin xóa mềm → 7 đỏ   → AC-4, AC-7
- [x] Bỏ khóa phụ `created_at DESC` của top → 3 đỏ (nhờ cặp `l2.v1` và `l2.old`)   → AC-7
- [x] Top 6 tin thay vì 5 → 3 đỏ   → AC-7
- [x] `hiddenByQuota` bỏ `Math.max(0, ...)` → 6 đỏ (chủ trọ mới có hạn 2, 0 tin)   → AC-4
- [x] `previousFrom` lùi `days` thay vì `days - 1` → 39 đỏ   → AC-3
- [x] Chỉ lấy lượt xem từ `from`, bỏ kỳ trước → 12 đỏ   → AC-3, AC-6
- [x] `Cache-Control` đổi thành `no-store` → 1 đỏ   → AC-1
- [x] Quyền yêu cầu đổi thành `listing:read` (tenant không có quyền này) → 1 đỏ, ở ca token cấp trước migration; tenant không lộ vì vẫn bị 403   → AC-15
- [x] Quyền yêu cầu đổi thành `profile:read` (tenant có quyền này) → 2 đỏ, gồm ca "tenant 403 kể cả tham số sai"   → AC-15
- [x] Migration bỏ vế `WHERE k <> ALL (...)` → 1 đỏ (`statistic:read` xuất hiện 3 lần sau ba lần chạy)   → AC-15
- [x] Migration cấp cho cả `tenant` (`WHERE "key" IN ('landlord','tenant')`) → 1 đỏ   → AC-15
- Điều khiển "thay múi giờ bằng `UTC` khi gom ngày" và "ép `SUM` tiền về `int4`" của spec thuộc mốc 2 (mốc 1 so thẳng `listing_daily_views.day` đã là ngày giờ Việt Nam, và chưa có tiền); chúng được làm ở mốc 2, xem bên dưới. Cả 15 điều khiển của mốc 1 được chạy lại trên code mốc 2 và vẫn bị bắt đủ (15 trên 15).

## Chưa kiểm (ghi rõ để không hiểu nhầm, áp dụng cho cả hai mốc)
- [ ] 429 `RATE_LIMITED` trên API thật: chỉ có test đơn vị của Controller khai nhóm `publicRead`; không thử bắn 300 request   → AC-1
- [ ] Ngày mặc định ngay quanh nửa đêm giờ Việt Nam: các lần chạy diễn ra ban ngày (khoảng 10 đến 12 giờ trưa); ranh `16:59:59.999Z` và `17:00:00.000Z` cho `now` chỉ có test đơn vị của `resolveStatPeriod` và `toRangeBounds`   → AC-2, AC-13
- [ ] Giá trị `chat` và `ratings` khi hai kỳ có hàng chục nghìn dòng của cùng một chủ trọ: số đo ở mục "Mốc 2" có một chủ trọ khoảng 1.000 tin, 7 nghìn lượt lưu, 810 cuộc trò chuyện; chưa thử chủ trọ lớn hơn nhiều   → AC-1

## Mốc 2: quan tâm, đánh giá, chat, chi tiêu (đã kiểm ngày 2026-11-18)

Cách chạy lại như ở đầu file. `fixtures.js` nay thêm 26 người tìm trọ bằng SQL (24 bình thường, một bị khóa `sl`, một xóa mềm `sd`) và dữ liệu mốc 2 cho `l1`, `l2`, `l5`, `l6` đặt đúng trên các ranh ngày giờ Việt Nam của khoảng mặc định: `i0` là 00:00:00.000 của hôm nay trừ 29, `i1` là 23:59:59.999 của hôm nay trừ 30, `i3` là 00:00:00.000 của hôm nay trừ 59, `i4` là 23:59:59.999 của hôm nay trừ 60, `i5` là đúng nửa đêm sau hôm nay, `i6` là 23:59:59.999 của hôm nay. Thêm ba script: `mig-variants.js` (tạo hai bản migration bị sửa), `scale.js` (nạp dữ liệu cỡ demo rồi `EXPLAIN ANALYZE` từng truy vấn và đo cả route) và `demo-check.js` (gọi route với từng chủ trọ của `seed:demo`).

### Commands
- [x] `npx tsc --noEmit`, `npx eslint "src/statistics/**/*.ts"` → sạch; `npm test` → 2607 test đạt, 109 suite (thêm 96 test so với trước mốc 2)   → AC-8 đến AC-12
- [x] `node check.js` (đầy đủ, có đo bộ đếm đọc) trên database dựng lại từ trống → 110 trên 110 qua; `node check.js --quick` → 108 trên 108 qua   → AC-1 đến AC-15

### UI / manual (kiểm bằng API thật)
- [x] Với `l1` đến `l6`, mặc định, 366 ngày và các khoảng khác (chỉ `to`, chỉ `from`, một ngày sát ranh, kỳ cũ, tháng 2 năm nhuận, 2000-01-01, ngày kế hôm nay): phản hồi đúng chín khóa theo thứ tự `period, listings, membership, views, interest, ratings, chat, spending, series`; `interest`, `ratings`, `chat`, `spending` và bốn cột của `series` bằng oracle (dòng thô lấy bằng `SELECT` đơn giản, mọi luật lọc và việc gán ngày giờ Việt Nam bằng `Intl.DateTimeFormat` viết lại bằng JavaScript); tổng từng cột bằng `value` của Metric tương ứng   → AC-1, AC-8 đến AC-12
- [x] `l1` ra đúng số tính tay trước khi chạy. Quan tâm: lưu 4 so với 2 (+100), theo dõi 3 so với 2 (+50), tổng 8 và 7. Đánh giá: chủ trọ 4.2 trên 6, phòng 3.8 trên 6, mới 3 so với 2 (+50) ở cả hai. Chat: mở 5 so với 2 (+150), trả lời 3 so với 1 (+200), `replyRate` 60 so với 50 đổi +10 điểm, tổng 9, chưa đọc 5 cuộc 7 tin. Chi tiêu: 598000 so với 149000 (+301.3), 3 đơn so với 2 (+50), mọi thời 748000; đơn chờ 500000 và hai đơn hủy không tính   → AC-8, AC-9, AC-10, AC-11
- [x] Luật lọc bằng dữ liệu cố ý gài: lưu trên tin xóa mềm và tin đang ẩn vẫn tính; người theo dõi bị khóa và xóa mềm không tính; đánh giá bị admin ẩn, người viết bị khóa hoặc xóa mềm không tính; đánh giá phòng của tin đang ẩn tính còn của tin xóa mềm không tính; cuộc trò chuyện trên tin xóa mềm vẫn tính; cuộc do `l5` (một chủ trọ khác, ở vai người nhắn) mở trên tin của `l1` tính cho `l1` mà không tính cho `l5`; dòng của `l2` rải ở mọi bảng không lọt vào `l1`   → AC-8 đến AC-10, AC-14
- [x] `l6` có 30 đơn 100 triệu: `spending.spent.value` và `spentAllTime` đều 3000000000, vượt `int4`, `paidOrders` 30   → AC-11
- [x] `l4` mới trống: `interest`, `ratings`, `chat`, `spending` toàn 0, `average` và `replyRate` là `null`, `changePercent` null, ba cột mới của `series` toàn 0   → AC-14
- [x] Ranh ngày đúng mili giây bằng các khoảng một ngày: `i0` (00:00:00.000 hôm nay trừ 29) vào đúng ngày đó, `i1` (23:59:59.999 hôm nay trừ 30) là kỳ trước của nó, `i6` (23:59:59.999 hôm nay) thuộc hôm nay, `i5` (00:00:00.000 ngày kế) thuộc ngày kế chứ không thuộc hôm nay, `i3` và `i4` đúng ngày của chúng. Số tính tay chạm cả sáu ranh với lượt lưu, ranh hôm nay trừ 29 và hôm nay với chat và đơn; mọi nguồn khác (theo dõi, hai loại đánh giá) được phủ ở các khoảng một ngày bằng oracle (hôm nay trừ 29, 30, 31, 35, 45, 59, 60, 61 và ngày kế)   → AC-13
- [x] Đối chiếu route công khai cho cả sáu chủ trọ: `interest.totalFollowers` bằng `followerCount`, `ratings.landlord.count` và `average` bằng `reviewCount` và `ratingAverage` của `GET /landlords/:id`; `chat.unreadConversations` và `unreadMessages` bằng `GET /me/conversations/unread-count` với `l1`, `l2`, `l3`, `l4`, `l6`   → AC-8, AC-9, AC-10
- [x] `l5` là người nhắn ở một cuộc: `chat` của `l5` toàn 0 (không là chủ trọ của cuộc nào) trong khi `unread-count` của `l5` ra 1 cuộc 1 tin; đúng như spec ghi (số chưa đọc ở đây nhỏ hơn khi chủ trọ có cuộc ở vai người nhắn)   → AC-10
- [x] Phản hồi của cả sáu chủ trọ (366 ngày) không chứa email, tên (`Verify sNN`), id của người tìm trọ nào, và không có số điện thoại   → AC-14
- [x] Chụp số dòng và `md5` mọi bảng trước và sau khi gọi route nhiều lần (nay có cả `favorites`, `follows`, `reviews`, `listing_reviews`, `conversations`, `messages`, `orders`) → giống từng byte   → AC-1
- [x] Sáu câu SQL mới (`favoritesQuery`, `followersQuery`, `landlordReviewsQuery`, `roomReviewsQuery`, `chatQuery`, `paidOrdersQuery`, lấy từ `dist` và cận lấy từ `toRangeBounds`) chạy với múi giờ phiên `UTC`, `Asia/Ho_Chi_Minh`, `America/Los_Angeles` cho `l1`, `l2`, `l6` → kết quả giống nhau từng dòng   → AC-13
- [x] Bộ đếm đọc của PostgreSQL vẫn không đổi với admin, tenant và tenant được cấp quyền (các câu SQL mới cũng không bị chạm), và điều khiển dương vẫn thấy bộ đếm tăng khi chủ trọ gọi   → AC-15

### Điều khiển âm của mốc 2
Mỗi điều khiển sửa một chỗ trong `dist/statistics/`, chạy lại `check.js --quick`, rồi khôi phục file. Cả 17: 16 bị bắt, 1 trung lập có chủ đích.
- [x] Chi tiêu bỏ vế `status = 'paid'` → 20 đỏ   → AC-11
- [x] Cận dưới của ngày đổi `>=` thành `>` (mất 00:00:00.000 của ngày đầu kỳ trước) → 4 đỏ, gồm cả ba bài số tính tay   → AC-13
- [x] **Trung lập**: cận trên đổi `<` thành `<=` → 0 đỏ (108 trên 108 vẫn qua). Không phải lỗ hổng của bộ kiểm: dòng ở đúng nửa đêm sau cận trên mang nhãn ngày kế (bên ngoài cả hai kỳ) và Service bỏ mọi dòng ngoài hai kỳ, nên hành vi không đổi; cận `<` được giữ vì đúng ngữ nghĩa   → AC-13
- [x] Thay múi giờ Việt Nam bằng `UTC` khi gom ngày → 13 đỏ (các dòng ở 00:00:00.000 bị nhãn sang ngày hôm trước)   → AC-13
- [x] Bỏ điều kiện người theo dõi `active` chưa xóa mềm → 21 đỏ   → AC-8
- [x] Đánh giá chủ trọ bỏ `status = 'visible'` → 21 đỏ   → AC-9
- [x] Đánh giá phòng bỏ `status = 'visible'` → 20 đỏ   → AC-9
- [x] Đánh giá phòng tính cả tin xóa mềm → 20 đỏ   → AC-9
- [x] Mọi tin nhắn (không riêng của chủ trọ) tính là đã trả lời → 17 đỏ   → AC-10
- [x] Chưa đọc tính theo mốc đọc của người nhắn → 21 đỏ   → AC-10
- [x] `SUM` ép về `int4` → 12 đỏ (3 tỷ của `l6` tràn, route lỗi)   → AC-11
- [x] Lưu bỏ qua tin xóa mềm → 20 đỏ   → AC-8
- [x] Bỏ lọc theo chủ trọ ở truy vấn đơn → 42 đỏ   → AC-14
- [x] Bỏ lọc theo chủ trọ ở truy vấn theo dõi → 47 đỏ   → AC-14
- [x] `replyRate` đảo tử và mẫu → 16 đỏ   → AC-10
- [x] Cột `newConversations` lấy số cuộc đã trả lời → 13 đỏ   → AC-12
- [x] Kỳ không có mẫu số ra 0% thay vì `null` → 33 đỏ   → AC-10, AC-14
- [x] Chạy lại 15 điều khiển của mốc 1 trên code mốc 2 → 15 trên 15 bị bắt; hai điều khiển migration → 2 trên 2 bị bắt   → AC-15

### Đo quy mô cỡ demo (một lần, không chỉnh)
Database thử nạp thêm: 60.023 tin, 419.594 lượt lưu, 31.280 lượt theo dõi, 1.510 đánh giá chủ trọ, 40.011 đánh giá phòng, 50.010 cuộc trò chuyện, 150.018 tin nhắn, 20.041 đơn đã trả, 400.027 dòng lượt xem theo ngày. Chủ trọ đo là `l1`, được gán 1.008 tin, 6.994 lượt lưu, 810 cuộc trò chuyện, 1.500 người theo dõi, 1.500 đánh giá chủ trọ, 2.000 đơn đã trả. Số liệu là trung vị của 5 lần `EXPLAIN (ANALYZE)` mỗi truy vấn.
- [x] 30 ngày: `listingCounts` 0.9 ms · `dailyViews` 9.5 ms · `topListings` 23.7 ms · `favorites` 67.2 ms (quét tuần tự `favorites`) · `followers` 1.3 ms · `landlordReviews` 4.0 ms · `roomReviews` 15.0 ms · `chat` 5.3 ms · `paidOrders` 1.3 ms   → AC-1
- [x] 366 ngày: `listingCounts` 0.5 ms · `dailyViews` 16.0 ms · `topListings` 26.8 ms · `favorites` 65.5 ms (quét tuần tự `favorites`) · `followers` 8.2 ms · `landlordReviews` 7.4 ms · `roomReviews` 15.8 ms · `chat` 30.7 ms (quét tuần tự `messages`) · `paidOrders` 10.0 ms   → AC-1
- [x] Cả route (15 lần mỗi kiểu, tính cả đọc và JSON qua HTTP): 30 ngày trung vị 84.4 ms (nhỏ nhất 51.3, lớn nhất 252), phản hồi 4.864 byte; 366 ngày trung vị 94.1 ms (nhỏ nhất 71.1, lớn nhất 216.9), phản hồi 34.439 byte   → AC-1
- Không chỉnh gì vì đây là bản demo (đúng như spec ghi): phép đếm lưu chậm nhất vì `favorites` không có chỉ mục theo `listing_id`; mốc đo là 67 ms ở 420 nghìn dòng. Quét tuần tự `messages` ở khoảng 366 ngày là kế hoạch tự chọn của PostgreSQL cho hơn 800 cuộc trò chuyện.

### Chạy với dữ liệu `seed:demo`
- [x] Database dựng lại từ trống rồi `node dist/database/seed-demo.js` (19 tài khoản, 9 chủ trọ, 53 tin), gọi `GET /me/statistics` mặc định và 366 ngày với từng chủ trọ demo → 8 chủ trọ trả 200 với số có ý nghĩa (ví dụ Khoa: 30 ngày xem 3943 so với 3604 (+9.4%), lưu 5 so với 6, chat mở 10 so với 8 và trả lời 10, chi 798000 so với 399000; Mai (hết dùng thử): `public` 0 và `hiddenByQuota` 3; Hà (mới đăng ký): toàn 0); chủ trọ bị khóa (Lan) đăng nhập nhận 403 `ACCOUNT_LOCKED` đúng kịch bản. Mỗi lần gọi đều qua các bất biến: chín khóa, tổng cột bằng `value`, `followerCount`, `reviewCount`, `ratingAverage`, `totalViewCount`, `publicListingCount`, hai số chưa đọc đều khớp các route công khai   → AC-1 đến AC-15

## Acceptance-criteria coverage
- AC-1 … chín khối đúng thứ tự, header, chỉ đọc (chụp `md5` mọi bảng), `EXPLAIN` cỡ demo; 429 chưa làm · AC-2 … bảy lỗi tham số, mặc định, khoảng 1 và 366 ngày, năm nhuận · AC-3 … kỳ trước qua 29/02/2024, `changePercent` tính tay (1490.7, 301.3), điều khiển lệch một ngày · AC-4 … bốn bucket cho sáu chủ trọ và ba trạng thái hạn mức, đối chiếu route công khai · AC-5 … `membership` bằng `GET /me/membership` · AC-6 … `inRange`, `allTime` 4 tỷ, bằng `totalViewCount`, ba múi giờ phiên · AC-7 … top, hòa lượt, cắt 5, tin xóa mềm, `isPublic` bằng `GET /me/listings` · AC-8 … lưu và theo dõi (tin ẩn, tin xóa mềm, người bị khóa và xóa mềm), bằng `followerCount` · AC-9 … hai điểm đánh giá tách bạch, bằng `reviewCount` và `ratingAverage`, tin ẩn và tin xóa mềm · AC-10 … mở, trả lời, `replyRate` kèm điểm đổi, chưa đọc bằng `unread-count`, vai chủ trọ, ca `l5` · AC-11 … chỉ đơn `paid`, theo `paid_at`, 3 tỷ không tràn · AC-12 … bốn cột, tổng bằng `value`, đủ ngày · AC-13 … ba múi giờ phiên cho cả sáu câu SQL mới, ranh đúng mili giây cho từng nguồn, điều khiển múi giờ `UTC` · AC-14 … cô lập giữa chủ trọ, chủ trọ trống, không lộ danh tính người tìm trọ · AC-15 … 401, 403 theo quyền và theo loại tài khoản, thứ tự kiểm, khóa tài khoản, migration hai lần, token trước migration, bộ đếm đọc
