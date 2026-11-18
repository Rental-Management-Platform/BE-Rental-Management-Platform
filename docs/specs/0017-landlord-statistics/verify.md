# Verify: Thống kê cho chủ trọ · spec 0017 · updated 2026-11-18
_Steps derived from spec 0017 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Mốc 1 (AC-1 đến AC-7, AC-12 phần cột `views`, AC-13 đến AC-15) đã build và kiểm thật ngày 2026-11-18. Mốc 2 (AC-8 đến AC-11 và ba cột còn lại của `series`) chưa làm; các dòng của nó được thêm vào file này ở lần `/develop` sau.

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
- Điều khiển "thay múi giờ bằng `UTC` khi gom ngày" và "ép `SUM` tiền về `int4`" của spec thuộc mốc 2 (mốc 1 so thẳng `listing_daily_views.day` đã là ngày giờ Việt Nam, và chưa có tiền); chúng được làm ở mốc 2.

## Chưa kiểm ở mốc 1 (ghi rõ để không hiểu nhầm)
- [ ] 429 `RATE_LIMITED` trên API thật: chỉ có test đơn vị của Controller khai nhóm `publicRead`; không thử bắn 300 request   → AC-1
- [ ] `EXPLAIN` cỡ demo (khoảng 60 nghìn tin) cho từng truy vấn và cả route: thuộc bước 8 của mốc 2, ghi số rồi bỏ qua như các ngân sách quy mô khác   → AC-1
- [ ] Ngày mặc định ngay quanh nửa đêm giờ Việt Nam: lần chạy diễn ra lúc khoảng 10 giờ 40 sáng; ranh `16:59:59.999Z` và `17:00:00.000Z` cho `now` chỉ có test đơn vị của `resolveStatPeriod`   → AC-2, AC-13

## Acceptance-criteria coverage
- AC-1 … hình dạng năm khối, header, chỉ đọc (chụp `md5` mọi bảng), `EXPLAIN` và 429 chưa làm · AC-2 … bảy lỗi tham số, mặc định, khoảng 1 và 366 ngày, năm nhuận · AC-3 … kỳ trước qua 29/02/2024, `changePercent` 1490.7 tính tay, điều khiển lệch một ngày · AC-4 … bốn bucket cho sáu chủ trọ và ba trạng thái hạn mức, đối chiếu route công khai · AC-5 … `membership` bằng `GET /me/membership` · AC-6 … `inRange`, `allTime` 4 tỷ, bằng `totalViewCount`, ba múi giờ phiên · AC-7 … top, hòa lượt, cắt 5, tin xóa mềm, `isPublic` bằng `GET /me/listings` · AC-8 đến AC-11 … thuộc mốc 2, chưa làm · AC-12 … cột `views` (tổng bằng `inRange.value`), ba cột còn lại thuộc mốc 2 · AC-13 … ba múi giờ phiên, ngày liền kề ranh · AC-14 … cô lập giữa chủ trọ, chủ trọ trống, không lộ danh tính · AC-15 … 401, 403 theo quyền và theo loại tài khoản, thứ tự kiểm, khóa tài khoản, migration hai lần, token trước migration, bộ đếm đọc
