# Verify: admin xem đơn mua gói và doanh thu · spec 0010 · updated 2026-10-21
_Steps derived from spec 0010 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Chạy trên một database thử (đã dùng `rental_management_verify`), không chạy trên database đang dùng. Dọn schema, rồi `npx prisma migrate deploy` và `npm run seed`, khởi động lại server trước mỗi lần chạy (bộ đếm giới hạn tần suất nằm trong bộ nhớ; đăng ký tối đa 10 lần mỗi giờ theo IP; đăng nhập admin tối đa 10 lần mỗi 15 phút). Mỗi bước đối chiếu với **hàng thô** bằng SQL hoặc phép tính độc lập, không chỉ với phản hồi. Cần: ba chủ trọ có đơn ở ba trạng thái và ba gói (một bị khóa, một bị xóa mềm bằng SQL), một người tìm trọ, admin seed, và một admin thứ hai (đăng ký người tìm trọ rồi `UPDATE users SET account_type = 'admin'` rồi đăng nhập). Đơn dựng bằng SQL (có `paid_at`, `created_at` đặt tay) và một ít qua API (`POST /orders` rồi `/pay`). Cần thêm một gói giá 100.000.000 (giá tối đa) để dựng 30 đơn vượt 2,1 tỷ.

## Commands
- [ ] `npx tsc --noEmit` và `npx eslint "src/**/*.ts"` → sạch → AC-1 đến AC-10
- [ ] `npm test` → toàn bộ qua, gồm `calendar-date.spec.ts`, `app-time-zone.spec.ts`, `admin-order-queries.dto.spec.ts`, `orders.repository.spec.ts` (hình dạng `where` từng tổ hợp, `summary` có `status = 'paid'` bằng `AND`, câu SQL thống kê), `admin-orders.service.spec.ts`, `orders.mapper.spec.ts` (không trường thừa), `admin-orders.controller.spec.ts` (khai báo route, thứ tự controller, gọi HTTP thật, ca đối chứng đảo thứ tự), `permission-catalog.spec.ts` và `route-declarations.spec.ts` → AC-1 đến AC-10
- [ ] `git status --short prisma/` → rỗng: không migration, không bảng, không cột, không chỉ mục mới → Decision
- [ ] Newman với mọi folder trừ 02 và 06 của `docs/api/postman-collection.json` trên database trống mới seed, hai lượt liền (khởi động lại server giữa hai lượt; folder 22 không đăng nhập admin và không đăng ký tài khoản nào) → không request hay assertion nào lỗi → AC-1 đến AC-10

## UI / manual (gọi API, Postman folder `22 Đơn của mọi chủ trọ (admin)`)

AC-1, AC-4, AC-5, danh sách không lọc:
- [ ] Admin `GET /orders/all` → 200, đúng năm khóa `items`, `total`, `page`, `pageSize`, `summary`; trang 1 và 20 dòng; `Cache-Control: private, no-store`; mỗi phần tử đúng 14 khóa (mười ba của một đơn cộng `landlord`), `landlord` chỉ có `id`, `name`, `email` → AC-1, AC-5, AC-9
- [ ] Duyệt mọi trang (pageSize 50 và 7) → ghép lại đúng thứ tự `created_at` giảm dần rồi `id` giảm dần (ba đơn cùng `created_at` ra id giảm dần), không trùng không sót; `total` bằng `count(*)` thô → AC-1
- [ ] Từng dòng so với dòng thô (`orders` nối `users` và `subscriptions`): `code`, `planId`, `planName`, `price`, `maxListings`, `durationDays`, `status`, `paidAt`, `cancelledAt`, `createdAt`, `startsAt`, `endsAt`, `landlord`; đơn chờ và đơn hủy có `startsAt` và `endsAt` là `null` → AC-1, AC-5
- [ ] `summary` bằng phép đếm và cộng độc lập từ dòng thô; cộng tay `price` các dòng `paid` qua mọi trang ra đúng `paidAmount`; đếm tay ra đúng `paidCount`; trang quá cuối (`page=9999`) vẫn 200, `items: []`, `total` và `summary` đúng → AC-1, AC-4
- [ ] 30 đơn `paid` giá 100.000.000 (lọc `planId` và `status=paid`) → `paidAmount` 3.000.000.000, `paidCount` 30, không tràn → AC-4
- [ ] Chủ trọ bị khóa và chủ trọ bị xóa mềm vẫn hiện `name` và `email`; toàn phản hồi không chứa `phone`, `passwordHash`, `password`, `trialEndsAt`, `userId`, `updatedAt`, `accountType`, `lockedReason` hay chữ số điện thoại của ai → AC-5
- [ ] Admin `PATCH /plans/:id` đổi tên và giá gói đã có đơn → các dòng đơn của gói đó giữ tên và giá cũ → AC-5

AC-2, bộ lọc:
- [ ] `status` từng giá trị, `landlordId` từng chủ trọ, `planId` từng gói, và các tổ hợp (`status` cộng `landlordId`, `status` cộng `planId`, `landlordId` cộng `planId`, cả ba) → tập, thứ tự, `total` và `summary` đều khớp phép tính độc lập có cùng bộ lọc → AC-2
- [ ] `status=pending` và `status=cancelled` → `summary` bằng `{ paidCount: 0, paidAmount: 0 }` (không ghi đè `status` bằng `paid`) → AC-2, AC-4
- [ ] `landlordId` và `planId` là UUID không có thật, và `landlordId` của tài khoản `tenant` hay `admin` → 200, `items: []`, `total: 0`, `summary` bằng 0 → AC-2
- [ ] `status=x`, `status=PAID`, `landlordId=abc`, `planId=123`, `sort=asc`, `q=...`, `groupBy=day`, `pageSize=51`, `pageSize=0`, `page=0`, `status` lặp hai lần → mỗi cái 400 `VALIDATION_FAILED`, `errors[].field` đúng tên trường → AC-2

AC-3, ngày theo giờ Việt Nam đúng từng mili giây (đơn tạo lúc `2026-09-30T16:59:59.999Z`, `2026-09-30T17:00:00.000Z`, `2026-10-31T16:59:59.999Z`, `2026-10-31T17:00:00.000Z`):
- [ ] `from=2026-10-01&to=2026-10-31` → đơn 16:59:59.999Z ngày 30/9 vắng, đơn 17:00:00.000Z ngày 30/9 có mặt, đơn 16:59:59.999Z ngày 31/10 có mặt, đơn 17:00:00.000Z ngày 31/10 vắng; khớp phép tính độc lập → AC-3
- [ ] Chỉ `from`, chỉ `to`, `from` bằng `to` (một ngày), khoảng không có đơn (`from=2090-01-01`), khoảng cộng bộ lọc → khớp phép tính độc lập; khoảng không có đơn ra rỗng và `summary` bằng 0 → AC-3
- [ ] `from=2026-02-30`, `to=2026-02-30`, `from=2026-10-21&to=2026-10-20` (lỗi ở `to`), `from=1999-12-31`, `to=2101-01-01`, `from=21/10/2026`, `from=2026-1-1`, `from=2026-10-01T00:00:00Z`, `from` lặp hai lần, cả hai sai cùng lúc → 400 đúng tên trường; `from=2000-01-01&to=2100-12-31` được nhận → AC-3
- [ ] Chạy lại cả bộ trên dưới ba múi giờ phiên của database (đặt `PGOPTIONS="-c timezone=America/Los_Angeles"` và `Pacific/Kiritimati` cho tiến trình server) → kết quả không đổi → AC-3

AC-6 đến AC-8, thống kê (`GET /orders/revenue`):
- [ ] Mặc định → 200, đúng tám khóa `from`, `to`, `groupBy`, `timeZone`, `paidCount`, `paidAmount`, `byPlan`, `series`; `from` và `to` là `null`, `groupBy` là `month`, `timeZone` là `Asia/Ho_Chi_Minh`; `Cache-Control: private, no-store`; không chứa `phone`, `password`, `email`, `landlord`, `userId` → AC-6, AC-9
- [ ] Mười ba tổ hợp (mặc định, `groupBy=month` và `day`, chỉ `from`, chỉ `to`, `from` và `to` ở hai cách gom, khoảng 2000 đến 2100, một ngày, tháng 10) → `paidCount`, `paidAmount`, `byPlan` và `series` khớp phép gom độc lập tính trong JavaScript từ `status = 'paid'` và `paid_at` thô (cộng 7 giờ rồi lấy ngày hoặc tháng), đúng thứ tự; `from` và `to` trả lại đúng chuỗi đã gửi hoặc `null` → AC-6, AC-7
- [ ] Đơn `pending` (hai đơn) và `cancelled` (sáu đơn 100.000.000) không đổi một đồng nào → AC-6
- [ ] Hai gói cùng số tiền (1.000) thì tên "Hòa A" đứng trước "Hòa B"; `byPlan` giảm dần theo tiền; `series` tăng dần; không có phần tử nào có `paidCount` bằng 0 (chuỗi thưa) → AC-7
- [ ] Ba tổng bằng nhau (ngoài cùng, cộng `byPlan`, cộng `series`) ở mọi tổ hợp; 30 đơn 100.000.000 ra 3.000.000.000 ở cả ba chỗ → AC-7
- [ ] Đơn trả lúc `2026-10-31T17:30:00Z` → `period` `2026-11-01` khi `groupBy=day` và `2026-11` khi `groupBy=month`; có mặt khi `from=2026-11-01`; vắng khi `to=2026-10-31`; đơn trả lúc `2026-10-31T16:59:59.999Z` thuộc ngày `2026-10-31`; đơn trả lúc `2025-12-31T17:00:00Z` thuộc tháng `2026-01` → AC-8
- [ ] Chạy lại dưới `UTC`, `America/Los_Angeles`, `Pacific/Kiritimati` → kết quả không đổi → AC-8
- [ ] Không có đơn nào trong khoảng (`from=2090-01-01&to=2090-12-31`) → `paidCount: 0`, `paidAmount: 0`, `byPlan: []`, `series: []`, `groupBy` và `timeZone` vẫn có → AC-6
- [ ] `groupBy=week`, `groupBy=DAY`, `groupBy=` rỗng, `groupBy` lặp, `status=paid`, `page=1`, `pageSize=5`, `landlordId`, `sort`, `q`, ngày sai, `from` lớn hơn `to` → 400 `VALIDATION_FAILED` đúng tên trường → AC-6
- [ ] Admin sửa tên và giá gói Nâng cao rồi đọc lại → `byPlan` ra tên mới nhưng `paidAmount` vẫn là số đơn nhân 199.000 (giá chốt), tổng ngoài cùng không đổi → AC-7
- [ ] 48 lần tạo rồi trả đơn đồng thời (bốn chủ trọ, mỗi người 12 vòng) trong lúc ba vòng lặp gọi thống kê liên tục (khoảng 190 lần) → mọi phản hồi có ba tổng bằng nhau và đều 200; sau đó phép tính độc lập khớp → AC-7

AC-9, phân quyền và tiêu đề (cho cả hai route):
- [ ] Không đăng nhập → 401 `TOKEN_MISSING` → AC-9
- [ ] `tenant` và `landlord` → 403 `PERMISSION_DENIED`, kể cả khi gửi tham số sai (quyền kiểm trước tham số) → AC-9
- [ ] Token của chủ trọ được ký lại với `perms` có `order:manage` (token cấp trước thay đổi), và token tự ghi `order:report` → vẫn 403 `PERMISSION_DENIED`; (chuẩn bị) cùng token đó vẫn qua cổng JWT với `GET /orders` → AC-9
- [ ] Admin thứ hai gọi được (200); `UPDATE users SET status = 'locked'` rồi gọi với token cũ → 403 `ACCOUNT_LOCKED`; trả `status` về `active` và `UPDATE users SET deleted_at = now()` rồi gọi → 401 `TOKEN_INVALID` → AC-9
- [ ] Các lần gọi bị từ chối (tenant, landlord với tham số sai, token giả, không token, admin đã xóa) không đọc dòng nào của bảng `orders`: so `seq_tup_read + idx_tup_fetch` của `pg_stat_user_tables` trước và sau (chờ khoảng 11,5 giây trước mỗi lần đọc vì tiến trình giữ số đếm đến 10 giây khi rảnh, và gọi `pg_stat_clear_snapshot()`); một lần admin gọi thành công làm bộ đếm tăng (đối chứng) → AC-9
- [ ] 40 lần gọi liên tiếp mỗi route không lần nào bị 429 → Decision

AC-10, danh mục quyền và định tuyến:
- [ ] Admin `GET /permissions` → `order` có `actions` là `create`, `read`, `cancel`, `report` và `adminActions` là `report`; quyền mặc định của chủ trọ (`GET /account-types`) vẫn là `order:create`, `order:read`, `order:cancel` → AC-10
- [ ] `PATCH /account-types/landlord` với `order:report`, `PATCH /account-types/tenant` với `order:report`, và `PATCH /account-types/landlord` với `order:manage` → 400 (hai ca đầu `PERMISSION_ADMIN_ONLY`), quyền của chủ trọ không đổi sau đó → AC-10
- [ ] `GET /orders/all` và `GET /orders/revenue` là 200 chứ không phải 400 `INVALID_ID`; `GET /orders/xyz` vẫn 400 `INVALID_ID`; `GET /orders` của admin vẫn rỗng; `GET /orders` và `GET /orders/:id` của chủ trọ giữ nguyên; chủ trọ khác và admin mở `GET /orders/:id` của đơn không phải của mình vẫn 403 `NOT_RESOURCE_OWNER` → AC-10
- [ ] Băm `orders`, `subscriptions`, `plans` (`md5` của các dòng sắp theo id) trước và sau một loạt lần đọc của cả hai route → bằng nhau, không ghi gì → AC-10

Value sourcing (mỗi hàng của bảng nguồn giá trị trong spec):
- [ ] Người gọi có phải admin ← `order:report` đọc lại từ database: token chủ trọ giả có `order:manage` bị 403, admin bị khóa hoặc xóa mất đường đọc ngay (xem AC-9)
- [ ] Ranh giới một "ngày" ← `APP_TIME_ZONE` và `APP_UTC_OFFSET_MS`: bốn đơn sát hai cận (danh sách) và cặp 17:00Z, 17:30Z (thống kê) ở ba múi giờ phiên
- [ ] Header `Cache-Control` ← hằng `private, no-store`: có ở 200 của cả hai route
- [ ] Những đơn nào có mặt, thứ tự, mười một trường, `startsAt` và `endsAt`, `landlord`, `total`, `summary`, `page` và `pageSize` của danh sách ← cột của `orders`, `subscriptions`, `users` và `count`, `sum` có cùng `where`: so từng dòng và từng con số với SQL thô (xem AC-1 đến AC-5)
- [ ] Tập đơn tính doanh thu, `byPlan[].planName`, `paidAmount` các cấp, `series[].period`, `paidCount` và `paidAmount` ngoài cùng, `groupBy`, `from`, `to`, `timeZone` của thống kê ← `status = 'paid'` và `paid_at`, `plans.name` hiện tại, `SUM(orders.price)` đã chốt, `AT TIME ZONE` giờ Việt Nam, cộng các dòng `byPlan`, query và hằng `APP_TIME_ZONE`: so với phép gom độc lập (xem AC-6 đến AC-8)

Điều khiển âm (sửa bản build trong `dist/` sau `npm run seed`, chạy lại các bước trên, mỗi lần phải có kiểm tra tương ứng sai; dựng lại bằng `npx nest build` sau đó):
- [ ] Bỏ `AND status = 'paid'` của `summary` → các kiểm tra `summary` (đơn chờ, đơn hủy, mọi tổ hợp) sai → AC-4
- [ ] Đổi cận trên của `to` từ `<` thành `<=` → các kiểm tra ranh giới 17:00:00.000Z sai → AC-3
- [ ] Thay múi giờ bằng `UTC` (danh sách: `APP_UTC_OFFSET_MS` bằng 0; thống kê: `AT TIME ZONE 'UTC'`) → các kiểm tra ranh giới và 17:30Z sai → AC-3, AC-8
- [ ] Bỏ vế `status = 'paid'` của câu SQL thống kê → đơn chờ và đơn hủy bị tính, nhiều kiểm tra sai → AC-6
- [ ] Ép `SUM` về `int4` → 500 ngay lần gọi đầu khi có tổng 3.000.000.000 → AC-7
- [ ] Bỏ `@FreshAuth()` ở từng route → chủ trọ mang token có `order:manage` đọc được cả danh sách lẫn thống kê (200 thay vì 403), admin bị khóa và bị xóa vẫn đọc được → AC-9

## Acceptance-criteria coverage
- AC-1 … Commands (`npm test`, Newman), UI / manual "danh sách không lọc" và "phân trang", Value sourcing · AC-2 … "bộ lọc" · AC-3 … "ngày theo giờ Việt Nam", điều khiển âm cận trên và múi giờ · AC-4 … "danh sách không lọc", "bộ lọc", điều khiển âm `summary` · AC-5 … "danh sách không lọc" (từng dòng, chủ trọ bị khóa và xóa, sửa gói, không lộ trường) · AC-6 … "thống kê" (hình dạng, tổ hợp, rỗng, lỗi tham số) · AC-7 … "thống kê" (thứ tự, ba tổng, sửa gói, thanh toán đồng thời, 3 tỷ) · AC-8 … "thống kê" (17:30Z, ba múi giờ), điều khiển âm múi giờ · AC-9 … "phân quyền và tiêu đề", điều khiển âm `@FreshAuth()` · AC-10 … "danh mục quyền và định tuyến"

## Kết quả đã chạy 2026-10-21
- **Mốc 1** (`GET /orders/all`): 182 kiểm tra HTTP và SQL, 0 sai. Chạy lại 180 kiểm tra (bỏ phần bộ đếm đọc) dưới `America/Los_Angeles` và `Pacific/Kiritimati`, 0 sai. Bốn điều khiển âm đều bị bắt: bỏ `status = 'paid'` làm 18 sai, `<` thành `<=` làm 13 sai, múi giờ `UTC` làm 11 sai, bỏ `@FreshAuth()` làm 4 sai (token chủ trọ giả mang `order:manage` đọc được danh sách đầy đủ với mã 200).
- **Mốc 2** (`GET /orders/revenue`): 139 kiểm tra HTTP và SQL, 0 sai, gồm 198 lần gọi thống kê trong lúc 48 đơn được trả đồng thời, mọi phản hồi có ba tổng bằng nhau. Chạy lại 137 kiểm tra dưới `UTC`, `America/Los_Angeles`, `Pacific/Kiritimati`, 0 sai (kết nối kiểm tra ở lần đầu là `Asia/Bangkok`, cùng UTC+7 với Việt Nam nên chưa đủ để chứng minh: ba múi giờ sau mới là bằng chứng). Bốn điều khiển âm đều bị bắt: bỏ `status = 'paid'` làm 21 sai, `AT TIME ZONE 'UTC'` làm 15 sai, `SUM(...)::int` làm 500 ngay lần gọi đầu, bỏ `@FreshAuth()` ở route `revenue` làm 4 sai (token chủ trọ giả đọc được thống kê, `paidAmount` 3.011.346.000).
- **Không có điều khiển âm cho "ba tổng bằng nhau"**: mâu thuẫn chỉ xảy ra khi tách thành nhiều câu SQL, mà thiết kế cố ý dùng một câu; lượt chạy đồng thời chỉ cho thấy nó đúng.
- Unit: 1380 bài (trước thay đổi: 1226), `tsc` và `eslint` sạch. Newman folder 00, 01, 03, 04, 05, 07 đến 22 (bỏ 02 và 06): 535 request, 1160 assertion, 0 lỗi, hai lượt liền trên cùng một database; log server 0 lỗi 500.
- **`EXPLAIN` ở 50 000 đơn đã đo một lần, không chỉnh** (bản demo, không chạy thật). HTTP trung vị (7 lần mỗi mục, đo phía gọi): `GET /orders/all` trang đầu khoảng 30 ms, trang 1000 với 50 dòng khoảng 52 đến 56 ms, `status=paid` kèm khoảng ngày 16 đến 17 ms, lọc theo chủ trọ 15 đến 17 ms; `GET /orders/revenue` toàn bộ theo tháng 47 ms, theo ngày 53 ms, một khoảng ngày 31 ms. `EXPLAIN ANALYZE` các câu SQL tương ứng: trang đầu 9 ms, trang sâu 28 đến 43 ms, `count(*)` 4 ms, `summary` 6 ms, doanh thu theo gói 8 đến 23 ms, doanh thu theo tháng toàn thời gian 42 đến 90 ms (hai lần đo cho hai số khác nhau). Không có chỉ mục cho `created_at` hay `paid_at`; thêm khi cần (xem Consequences của spec).

## Ghi chú
- Các script kiểm nằm ở thư mục tạm của phiên làm việc (không có trong repo): oracle độc lập, dựng đơn bằng SQL, đọc bộ đếm `pg_stat_user_tables`, sửa `dist/` cho điều khiển âm. Làm lại theo các bước trên khi cần.
- Bộ đếm `pg_stat_user_tables` chỉ đáng tin sau khi chờ khoảng 11,5 giây (tiến trình của pool giữ số đếm đến 10 giây khi rảnh); chờ ngắn hơn cho ra kết quả dương giả.
- Đơn chờ có chỉ mục duy nhất một phần (một đơn chờ mỗi chủ trọ), nên dựng đơn bằng SQL không được tạo hai đơn `pending` cho cùng một chủ trọ.
- Spec còn việc cho `/architect` và `/sync` (xem Follow-up của spec): thêm hai route vào danh sách `@FreshAuth()` của spec 0003 AC-8, sửa câu "dashboard doanh thu" của AC-11, thêm dòng `order:report` vào bảng quyền; ghi vào spec 0004 rằng admin đã xem được đơn.
