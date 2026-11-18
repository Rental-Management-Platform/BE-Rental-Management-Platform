# Verify: thống kê tổng quan cho admin · spec 0018 · updated 2026-11-18

_Steps derived from spec 0018 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Tình trạng: **cả hai mốc đã build và đã chạy thật trên database thử (2026-11-18)**. Mốc 1 là tài khoản, chủ trọ theo gói, tin và lượt xem; mốc 2 là sáu nguồn tương tác, `toHandle`, sáu cột còn lại của chuỗi, `EXPLAIN` cỡ demo và dữ liệu `seed:demo`. Một tiêu chí chưa đạt về tốc độ được ghi thẳng ở mục `EXPLAIN` của mốc 2 (route khoảng 3,4 giây ở 60 nghìn tin), đã đo và bỏ qua có chủ đích vì dự án là MVP.

## Mốc 1

### UI / manual (gọi API bằng token admin, trừ khi ghi khác)

- [x] `GET /statistics/overview` không tham số → 200, đúng sáu khóa (`period`, `accounts`, `landlords`, `listings`, `engagement` chỉ có `views`, `series`), `Cache-Control: private, no-store`, không có header giới hạn tần suất → AC-1
- [x] Gọi nhiều lần, kể cả 400 và 403, rồi so ảnh chụp mọi bảng (số dòng cộng mã băm) trước và sau → không đổi một dòng nào → AC-1
- [x] Không gửi gì, chỉ `to`, chỉ `from`, 1 ngày, đúng 366 ngày, tháng 2 năm nhuận (kỳ trước chạm 29/02/2024), ngày 2000-01-01 → `period` đúng, `series` đủ `days` phần tử, mọi khối khớp oracle độc lập tính từ dòng thô → AC-2, AC-3, AC-12
- [x] `from` sau `to`, khoảng 367 ngày, `from=2026-02-30`, `from=1999-12-31`, `to=2101-01-01`, `to=21/10/2026`, `groupBy=day`, `sort=asc` → 400 `VALIDATION_FAILED` đúng trường → AC-2
- [x] So `accounts` với `total` của `GET /users` cho đủ 12 tổ hợp (bốn lựa chọn loại × ba lựa chọn trạng thái, kể cả không lọc) → bằng nhau → AC-4
- [x] Tài khoản bị khóa và xóa mềm ở đủ ba loại; một admin tạo trong khoảng → xóa mềm không vào `accounts` nhưng vào `registered`; admin không bao giờ vào `registered`; `registered.total` bằng `landlords + tenants` → AC-4, AC-5
- [x] Đăng nhập từng chủ trọ chưa xóa mềm (kể cả đang bị khóa, mở khóa để lấy token rồi khóa lại), gọi `GET /me/membership`, cộng theo `state` → bằng `landlords`; ba nhóm cộng lại bằng `total` và bằng `accounts.byType.landlord.total` → AC-6
- [x] Chủ trọ vừa có gói vừa còn dùng thử → tính `onPlan`; gói chưa bắt đầu và hết dùng thử → `trialExpired` → AC-6
- [x] Tin ở ba trạng thái, tin xóa mềm, tin ở nhà trọ đã xóa mềm → `total` là tổng ba trạng thái, tin xóa mềm không tính → AC-7
- [x] `listings.public` bằng `total` của `GET /listings` không lọc ở trạng thái gốc, rồi sau từng biến động: khóa một chủ trọ, hết dùng thử, hết gói, hạ `trial_listing_limit` xuống 1 và 0, nâng lên 5 (qua `PATCH /settings/trial_listing_limit`) → luôn bằng nhau và luôn khớp oracle; `visible = public + visibleButNotPublic`, không âm → AC-8
- [x] Tin mới ở hai kỳ gồm tin xóa mềm và tin ẩn; `createdByWard` có hai phường hòa `count` → đúng thứ tự (count giảm dần rồi `wardCode` tăng dần), tổng bằng `listings.created.value`, đổi tên một phường thì `wardName` đổi theo rồi đổi lại → AC-9
- [x] `engagement.views` cộng cả tin ẩn, tin xóa mềm và chủ trọ bị khóa; hai tin cùng 2 tỷ lượt trong cùng một ngày → tổng 4 tỷ không tràn → AC-10 (phần `views`)
- [x] Tổng từng cột của `series` bằng `value` của Metric tương ứng, ở mặc định, 366 ngày và kỳ cũ → AC-12 (bốn cột)
- [x] Dòng tạo lúc `23:59:59.999` giờ Việt Nam thuộc ngày đó, `00:00:00.000` thuộc ngày kế, cho đăng ký và tin; chạy lại bằng SQL của Repository với múi giờ phiên `UTC`, `Asia/Ho_Chi_Minh`, `America/Los_Angeles` → cùng kết quả → AC-13
- [x] Ba chủ trọ ranh ở đúng mili giây `2030-06-01T00:00:00.000Z`: `trial_ends_at` đúng bằng `now`, kỳ gói kết thúc đúng `now`, kỳ gói bắt đầu đúng `now`, thử ở `E-1ms`, `E`, `E+1ms` → khớp oracle; tại `E` `onTrial` giảm đúng một → AC-6, AC-13
- [x] Phản hồi (khoảng mặc định, 366 ngày, khoảng rỗng) không chứa chuỗi giống uuid, email, tên, số điện thoại; mọi chuỗi chỉ là ngày, `Asia/Ho_Chi_Minh`, mã hay tên phường → AC-14
- [x] Khoảng không có dữ liệu → 200, mọi số của kỳ bằng 0, `changePercent` là `null`, `createdByWard` là `[]`, `series` đủ ngày toàn 0, số của lúc đọc vẫn có → AC-14
- [x] Nền tảng rỗng (chỉ có admin do seed tạo) ở 1, 30 và 366 ngày → mọi số 0 trừ một admin hoạt động, `changePercent` `null`, `GET /listings` ra 0, `GET /users` ra 1 → AC-14
- [x] Khách → 401 `TOKEN_MISSING`; token rác → 401 `TOKEN_INVALID`; token hết hạn ký tay → 401 `TOKEN_EXPIRED` → AC-15
- [x] Người tìm trọ → 403 `PERMISSION_DENIED`, kể cả gửi `from=2026-02-30&groupBy=x` → AC-15
- [x] Chủ trọ với token mới → 403, kể cả tham số sai; token của họ mang `statistic:read`, không mang `statistic:manage` hay `statistic:report` → AC-15, AC-16
- [x] Chủ trọ với token cũ ký tay mang `statistic:manage` → 403 (kể cả tham số sai), còn `GET /me/statistics` của họ vẫn 200 → AC-15, AC-16
- [x] Admin → 200; admin gửi tham số sai → 400, không phải 403 → AC-15
- [x] Admin vừa bị khóa mang token còn hạn → từ chối ngay với cùng trạng thái và mã (403 `ACCOUNT_LOCKED`) như `GET /users`, mở khóa thì lại 200 → AC-15
- [x] `GET /permissions` có `statistic` với `actions: ['read','report']`, `ownerScoped: true`, `adminActions: ['report']` → AC-16
- [x] `PATCH /account-types/landlord` và `/tenant` kèm `statistic:report` hay `statistic:manage` → 400 `PERMISSION_ADMIN_ONLY`, quyền lưu trong database không đổi; chủ trọ vẫn giữ `statistic:read`; token admin mang `statistic:manage` → AC-16

### Commands

- [x] `npm test -- src/statistics src/common/auth` → 394 bài qua; cả bộ `npm test` 2708 bài qua (113 suite) → AC-1 đến AC-16 (mức đơn vị)
- [x] `npx tsc --noEmit` và `npx eslint src/statistics src/common/auth/permission-catalog.ts src/common/auth/permission-catalog.spec.ts` → sạch
- [x] `npm run build`, `node setup.js`, `node fixtures.js`, `node check.js` (kiểm thật, có phần đọc bộ đếm của PostgreSQL) → 54 trên 54 qua → AC-1 đến AC-16
- [x] `node check.js --quick` (bỏ phần pg_stat) → 53 trên 53 qua
- [x] `node setup.js` rồi `node empty-check.js` → 4 trên 4 qua → AC-14
- [x] `node controls.js` → các điều khiển âm, kết quả ở bảng dưới

### Người bị từ chối không đọc bảng dữ liệu nào (pg_stat)

- [x] Khách, người tìm trọ (kể cả tham số sai), chủ trọ token mới, chủ trọ token cũ (kể cả tham số sai), admin gửi tham số sai (`from=x`, `from>to`, `groupBy=day`) → bộ đếm đọc của `listings`, `properties`, `listing_daily_views`, `subscriptions`, `orders`, `wards`, `settings` không đổi (đợi 11,5 giây trước mỗi lần đọc); điều khiển dương: admin gọi hợp lệ thì cả sáu bảng được đọc tăng → AC-15

### Mỗi dòng của bảng Value sourcing (mốc 1) có một bước đổi nguồn

| Giá trị | Bước đã chạy |
|---|---|
| `period.*` | mọi tổ hợp khoảng ở trên, ngày dựng lại độc lập bằng JavaScript |
| `now` | một đồng hồ cho cả request: nhóm chủ trọ và `public` cùng khớp `GET /me/membership` và `GET /listings` ở cùng thời điểm |
| Ranh một ngày | dòng ở `16:59:59.999Z` và `17:00:00.000Z`, ba múi giờ phiên |
| `accounts.*` | 12 tổ hợp với `GET /users`, tài khoản khóa và xóa mềm |
| `accounts.registered.*` | admin tạo trong khoảng không được đếm, tài khoản khóa và xóa mềm được đếm |
| `landlords.*` | đủ ba nhóm, chủ trọ khóa, gói thắng dùng thử, gói chưa bắt đầu, ba chủ trọ ranh ở đúng mili giây |
| `listings.total`, `visible`, `hiddenByOwner`, `hiddenByAdmin` | tin xóa mềm và tin ở nhà trọ xóa mềm |
| `listings.public` | khóa chủ trọ, hết dùng thử, hết gói, đổi `trial_listing_limit` 0, 1, 5 |
| `trial_listing_limit` | `PATCH /settings/trial_listing_limit`, đọc lại ngay ở request kế |
| `listings.visibleButNotPublic` | luôn bằng `visible − public`, không âm |
| `listings.created.*` | tin xóa mềm, tin ẩn, tin đúng nửa đêm sau hôm nay |
| `listings.createdByWard[]` | hai phường hòa `count`, đổi tên phường |
| `engagement.views.*` | tin ẩn, tin xóa mềm, chủ trọ khóa, hai tin 2 tỷ cùng một ngày |
| `changePercent` | cặp (5, 3), (3, 5), (4, 4), (0, 0), (7, 0) ở test đơn vị; kỳ trước bằng 0 ở kiểm thật |
| `series[]` | tổng cột bằng `value`, ngày trống bằng 0, 1 ngày và 366 ngày |
| Header `Cache-Control` | `private, no-store` |

### Điều khiển âm (mỗi điều khiển vá một chỗ trong `dist`, chạy `check.js --quick`, rồi khôi phục byte cho byte)

27 điều khiển: **24 bị bắt**, 2 trung lập có chủ đích, 1 ghi nhận.

| Điều khiển | Kết quả |
|---|---|
| A1 bỏ `@FreshAuth()` | bắt được (token cũ của chủ trọ, admin bị khóa) |
| A2 `trial_ends_at >` thành `>=` | bắt được (chủ trọ ranh) |
| A3 kỳ gói thành đóng hai đầu | bắt được (chủ trọ ranh) |
| A4 đăng ký mới đếm cả admin | bắt được |
| A5 bỏ `deleted_at IS NULL` ở `accounts` | bắt được |
| A6 múi giờ UTC thay Việt Nam khi gom ngày | bắt được |
| A7 `createdByWard` cận trên `<` thành `<=` | bắt được |
| A8 `dailyCounts` cận trên `<` thành `<=` | **trung lập đúng dự kiến**: dòng đúng nửa đêm mang nhãn ngày kế và Service bỏ ngày ngoài hai kỳ |
| A9 khóa phụ `wardCode` đảo ASC thành DESC | bắt được |
| A9b bỏ hẳn khóa phụ của `createdByWard` | **không bắt được, ghi nhận**: PostgreSQL vẫn trả theo `wardCode` vì kế hoạch truy vấn gom theo cột đó; A9 chứng minh thứ tự có được kiểm |
| A10 tin xóa mềm vào bộ đếm trạng thái | bắt được |
| A11 `publicListingCondition` thay bằng `status = 'visible'` | bắt được |
| A12 `visibleButNotPublic` bỏ `Math.max` | **trung lập đúng dự kiến** với dữ liệu tĩnh (công khai luôn là tập con của `visible`); test đơn vị của mapper giữ ca lệch hai truy vấn |
| A13 lượt xem bỏ kỳ trước | bắt được |
| A14 nhóm chủ trọ chỉ lấy tài khoản active | bắt được |
| A15 `onPlan` loại chủ trọ còn dùng thử | bắt được |
| A16 `registered.total` chỉ cộng chủ trọ | bắt được |
| A17 `statistic:report` không còn chỉ admin | bắt được (`GET /permissions` và `PATCH /account-types`) |
| A18 `Cache-Control` thành `no-store` | bắt được |
| A19 quyền yêu cầu thành `profile:read` | bắt được (người tìm trọ và chủ trọ) |
| A20 quyền yêu cầu thành `statistic:read` | bắt được (chủ trọ token mới và token cũ) |
| A21 cột `views` của chuỗi lấy số tin mới | bắt được |
| A22 `previousFrom` lùi `days` thay vì `days − 1` | bắt được |
| A23 `listings.created` bỏ tin xóa mềm | bắt được |
| A24 ép `SUM` lượt xem về `int4` | bắt được **sau khi sửa dữ liệu mẫu**: lần đầu lọt vì hai dòng 2 tỷ nằm ở hai ngày khác nhau nên mỗi ngày vẫn vừa `int4`; nay hai tin cùng 2 tỷ trong cùng một ngày nên tổng ngày là 4 tỷ và bị tràn |
| A25 `createdByWard` bỏ tin xóa mềm | bắt được |
| A26 `wardName` lấy từ mã phường | bắt được |

Sau khi sửa dữ liệu mẫu đã chạy lại bộ kiểm đầy đủ (54 trên 54) và ba điều khiển liên quan đến lượt xem (A13, A21, A24), cả ba bị bắt.

### Acceptance-criteria coverage (mốc 1)

- AC-1 … bước "sáu khóa, `Cache-Control`" và "ảnh chụp mọi bảng" · AC-2 … các khoảng ngày và tám ca lỗi tham số · AC-3 … oracle trên mọi khoảng, kỳ trước chạm tháng 2 năm nhuận · AC-4 … 12 tổ hợp với `GET /users` · AC-5 … admin không đếm, khóa và xóa mềm có đếm · AC-6 … `GET /me/membership` từng chủ trọ cộng ba chủ trọ ranh · AC-7 … ba trạng thái và tin xóa mềm · AC-8 … `GET /listings` qua sáu biến động · AC-9 … thứ tự, hòa count, đổi tên phường · AC-10 … **chỉ phần `views`** (sáu Metric còn lại ở mốc 2) · AC-11 … **mốc 2** · AC-12 … **bốn cột** (sáu cột còn lại ở mốc 2) · AC-13 … ranh mili giây và ba múi giờ phiên · AC-14 … riêng tư, khoảng rỗng, nền tảng rỗng · AC-15 … ma trận quyền và pg_stat · AC-16 … `GET /permissions`, `PATCH /account-types`, token cũ

## Mốc 2

Chạy thật trên database thử ngày 2026-11-18, với dữ liệu tay dựng ở đúng các mili giây ranh (`i0` đến `i6`) và cả dữ liệu `seed:demo`.

### UI / manual (gọi API bằng token admin, trừ khi ghi khác)

- [x] `GET /statistics/overview` trả đúng bảy khóa theo thứ tự `period`, `accounts`, `landlords`, `listings`, `engagement`, `toHandle`, `series`; `engagement` đủ bảy Metric, `toHandle` ba số, mỗi phần tử của `series` mười một khóa → AC-1, AC-10, AC-11, AC-12
- [x] Sáu Metric tương tác khớp oracle độc lập (dòng thô bằng SELECT đơn giản, luật áp bằng JavaScript, ngày gán bằng `Intl.DateTimeFormat`) ở 14 khoảng: mặc định, chỉ `to`, chỉ `from`, 1 ngày ở từng ranh, kỳ cũ, đúng 366 ngày, tháng 2 năm nhuận, năm nhuận, ngày 2000-01-01 → AC-10
- [x] Mỗi nguồn đếm MỌI dòng đang tồn tại: đánh giá chủ trọ và đánh giá phòng đang bị admin ẩn, theo dõi của tài khoản bị khóa hay xóa mềm, lượt lưu của người bị khóa, của tin xóa mềm và của tin bị chủ trọ ẩn, tin nhắn và cuộc trò chuyện về tin xóa mềm. Dữ liệu có từng loại trong kỳ, số trả về bằng phép đếm không lọc và lớn hơn phép đếm có lọc → AC-10
- [x] Sáu số kỳ này khác nhau và sáu số kỳ trước khác nhau (nhầm nguồn hay nhầm kỳ giữa hai Metric sẽ lộ ra) → AC-10
- [x] `toHandle`: `hiddenLandlordReviews` và `hiddenRoomReviews` bằng `total` của `GET /moderation/reviews?status=hidden_by_admin` và `GET /moderation/listing-reviews?status=hidden_by_admin` (3 và 4, trong đó có một đánh giá phòng bị ẩn của tin đã xóa mềm); `hiddenListings` bằng `listings.hiddenByAdmin` (2: tin đã xóa mềm đang bị admin ẩn và tin bị chủ trọ ẩn không tính) → AC-11
- [x] Ẩn thêm một tin và một đánh giá chủ trọ, gỡ ẩn một đánh giá phòng trực tiếp trong database → `toHandle` đổi đúng (+1, +1, −1), khôi phục thì về lại như cũ; ba khoảng ngày khác nhau cho cùng ba số → AC-11
- [x] Tổng từng cột trong mười cột của `series` bằng `value` của Metric tương ứng ở mặc định, 366 ngày và kỳ cũ → AC-12
- [x] Ranh đúng mili giây cho sáu nguồn tương tác: bốn cặp cửa sổ hai ngày quanh đầu kỳ này, đầu kỳ trước, hôm nay và ngày mai đều khớp phép đếm theo ngày giờ Việt Nam; mỗi nguồn có dòng đúng ở `i0`, `i1`, `i3`, `i5`, `i6` → AC-13
- [x] Chạy lại SQL của Repository (sáu nguồn tương tác và hai số đánh giá bị ẩn, cùng các câu của mốc 1) với múi giờ phiên `UTC`, `Asia/Ho_Chi_Minh`, `America/Los_Angeles` → cùng kết quả → AC-13
- [x] Phản hồi không chứa chuỗi giống uuid, email, tên, số điện thoại, nội dung tin nhắn hay nhận xét (dữ liệu gắn dấu `BIMAT` vào mọi tin nhắn và nhận xét); mọi chuỗi chỉ là ngày, `Asia/Ho_Chi_Minh`, mã hay tên phường → AC-14
- [x] Khoảng không có dữ liệu → 200, cả bảy Metric của `engagement` bằng 0 với `changePercent` là `null`, `series` toàn 0, nhưng `toHandle` và các số của lúc đọc vẫn có → AC-14
- [x] Nền tảng rỗng (chỉ admin do seed tạo) ở 1, 30 và 366 ngày → bảy Metric toàn 0, `toHandle` toàn 0, mỗi phần tử `series` mười số 0 → AC-14
- [x] Ma trận quyền của mốc 1 chạy lại trên route đủ bảy khối: khách 401, người tìm trọ 403 kể cả tham số sai, chủ trọ token mới và token cũ ký tay 403, admin vừa bị khóa bị từ chối, admin 200 và 400 → AC-15
- [x] Khách, người tìm trọ, chủ trọ (token mới và cũ) và admin gửi tham số sai không đọc bảng dữ liệu nào, nay gồm cả `conversations`, `messages`, `reviews`, `listing_reviews`, `follows`, `favorites` (bộ đếm đọc của PostgreSQL, đợi 11,5 giây); điều khiển dương: admin gọi hợp lệ thì cả mười hai bảng theo dõi đều tăng → AC-15
- [x] Ảnh chụp mọi bảng trước và sau nhiều lần gọi (kể cả 400, 403, 401) không đổi một dòng nào → AC-1
- [x] `GET /permissions`, `PATCH /account-types`, `GET /me/statistics` với token cũ: chạy lại, kết quả như mốc 1 → AC-16

### Commands

- [x] `npm test` → 2755 bài qua (113 suite); `npm test -- src/statistics` → 379 bài qua → AC-1 đến AC-16 (mức đơn vị)
- [x] `npx tsc --noEmit` và `npx eslint src/statistics src/common/auth/permission-catalog.ts src/common/auth/permission-catalog.spec.ts` → sạch
- [x] `npm run build`, `node setup.js`, `node fixtures.js`, `node check.js` → 59 trên 59 qua; `node check.js --quick` → 58 trên 58 qua → AC-1 đến AC-16
- [x] `node setup.js` rồi `node empty-check.js` → 4 trên 4 qua → AC-14
- [x] `node controls.js` → 43 điều khiển, bảng dưới
- [x] `node setup.js`, `node dist/database/seed-demo.js --reset` (môi trường thử), `node demo-check.js` → mọi bất biến qua trên dữ liệu demo → AC-1, AC-4, AC-8, AC-11, AC-12
- [x] `node setup.js`, `node fixtures.js`, `node scale.js` → số đo ở bảng `EXPLAIN` dưới → AC-1

### Mỗi dòng của bảng Value sourcing (mốc 2) có một bước đổi nguồn

| Giá trị | Bước đã chạy |
|---|---|
| `engagement.conversations`, `messages`, `landlordReviews`, `roomReviews`, `follows`, `favorites` | dòng ở đủ các ranh và ở cả hai kỳ, dòng của tài khoản bị khóa hay xóa mềm, của tin xóa mềm, của đánh giá bị ẩn; điều khiển B1 đến B7 đổi bảng hay thêm luật công khai |
| `toHandle.hiddenLandlordReviews`, `hiddenRoomReviews` | so với `total` của hai danh sách kiểm duyệt; ẩn và gỡ ẩn trực tiếp rồi đọc lại; điều khiển B8 đến B10 |
| `toHandle.hiddenListings` | bằng `listings.hiddenByAdmin`, tin xóa mềm và tin chủ trọ ẩn không tính; điều khiển B11 |
| `series[]` sáu cột mới | tổng cột bằng `value` ở ba khoảng; điều khiển B12 và B13 đổi cột |
| `previous` của từng Metric tương tác | sáu số kỳ trước khác nhau; điều khiển B14 và B16 |
| Ranh một ngày của sáu nguồn | dòng ở `16:59:59.999Z` và `17:00:00.000Z`, ba múi giờ phiên, điều khiển B15 (cận dưới) |

### Điều khiển âm của mốc 2 (vá một chỗ trong `dist`, chạy `check.js --quick`, rồi khôi phục byte cho byte)

16 điều khiển mới, **16 bị bắt**. Cả 27 điều khiển của mốc 1 chạy lại trên dữ liệu mốc 2 với kết quả cũ (24 bị bắt, 2 trung lập có chủ đích, 1 ghi nhận). Tổng: 43 điều khiển, **40 bị bắt**, 2 trung lập có chủ đích, 1 ghi nhận.

| Điều khiển | Kết quả |
|---|---|
| B1 nguồn `conversations` đọc nhầm bảng `messages` | bắt được |
| B2 đánh giá chủ trọ chỉ đếm dòng `visible` | bắt được |
| B3 theo dõi chỉ đếm người theo dõi đang hoạt động | bắt được |
| B4 tin nhắn bỏ cuộc trò chuyện về tin xóa mềm | bắt được |
| B5 lượt lưu bỏ tin xóa mềm | bắt được |
| B6 đánh giá phòng chỉ đếm dòng `visible` | bắt được |
| B7 cuộc trò chuyện bỏ tin xóa mềm | bắt được |
| B8 `toHandle` đánh giá chủ trọ bỏ điều kiện `hidden_by_admin` | bắt được |
| B9 `toHandle` đánh giá phòng đếm `visible` thay vì `hidden_by_admin` | bắt được |
| B10 `toHandle` hai số đánh giá đổi chỗ ở Mapper | bắt được |
| B11 `hiddenListings` cộng cả tin chủ trọ ẩn | bắt được |
| B12 cột `newMessages` lấy số cuộc trò chuyện | bắt được |
| B13 cột `newFavorites` lấy số theo dõi | bắt được |
| B14 lượt lưu chỉ lấy kỳ này, bỏ kỳ trước | bắt được |
| B15 `dailyCounts` cận dưới `>=` đổi thành `>` | bắt được |
| B16 Metric lượt lưu lấy kỳ trước của theo dõi | bắt được **sau khi sửa dữ liệu mẫu**: lần đầu lọt vì theo dõi và lượt lưu cùng có 3 dòng ở kỳ trước nên đổi kỳ trước giữa hai nguồn không đổi gì; nay sáu số kỳ trước là 2, 3, 4, 5, 6, 7 và bài kiểm đòi chúng khác nhau |

Hai điều cần ghi trung thực:
- Lần chạy đầu của bộ điều khiển mốc 2 báo sai ("lọt") vì script tìm `check.js` ở thư mục sai nên không có kiểm tra nào chạy thật. Script đã được sửa (dùng đường dẫn của chính nó, và báo lỗi hạ tầng riêng thay vì coi là "lọt"); mọi kết quả ở trên là của các lần chạy sau khi sửa, và `dist` được so với bản sao lưu sau mỗi đợt, giống nhau byte cho byte.
- Điều khiển "ép số đếm của `dailyCounts` về `smallint`" đã bị bỏ vì không thể bắt được ở dữ liệu thử (số dòng mỗi ngày không bao giờ quá 32 nghìn); không có số nào vượt `int4` ngoài lượt xem, đã có điều khiển A24 từ mốc 1.

### Số liệu trên dữ liệu `seed:demo` (khoảng 30 ngày và 366 ngày)

Mọi bất biến qua: tổng cột `series` bằng `value`, nhóm chủ trọ cộng bằng tổng, `accounts` bằng `GET /users`, `listings.public` bằng `GET /listings`, hai số đánh giá bị ẩn bằng hai danh sách kiểm duyệt, `hiddenListings` bằng `listings.hiddenByAdmin`.

| | 30 ngày | 366 ngày |
|---|---|---|
| Tài khoản | 20 (admin 1, chủ trọ 9, người tìm trọ 10, khóa 2) | như 30 ngày |
| Đăng ký mới | 4 so với 5 (−20%) | 19 so với 0 |
| Chủ trọ | 5 có gói, 2 dùng thử, 2 hết kỳ | như 30 ngày |
| Tin | 53 (49 hiện, 37 công khai, 3 chủ trọ ẩn, 1 admin ẩn); tin mới 16 so với 15 | tin mới 53 so với 0; 12 phường có tin mới |
| Lượt xem | 9137 so với 6643 (+37,5%) | 22698 |
| Cuộc trò chuyện, tin nhắn | 33 so với 17, 65 so với 34 | 51, 101 |
| Đánh giá chủ trọ, đánh giá phòng | 18 so với 11, 12 so với 4 | 30, 16 |
| Theo dõi, lượt lưu | 7 so với 6, 29 so với 11 | 16, 45 |
| Cần xử lý (không đổi theo khoảng) | 1 tin, 1 đánh giá chủ trọ, 1 đánh giá phòng | như 30 ngày |

Các số này khớp phần mô tả bộ demo trong `docs/api/api-for-frontend.md` (30 đánh giá chủ trọ và 16 đánh giá phòng, mỗi loại đúng một dòng bị admin ẩn).

### `EXPLAIN` cỡ demo (đo một lần, không chỉnh, ghi số đúng như đo: đã đo, chưa đạt thành tiêu chí tốc độ, bỏ qua có chủ đích vì dự án là MVP)

Database thử: 60.026 tin (600 chủ trọ, mỗi người khoảng 100 tin), 3.636 tài khoản, 419.593 lượt lưu, 29.800 theo dõi, 29.776 đánh giá chủ trọ, 40.011 đánh giá phòng, 50.010 cuộc trò chuyện, 150.017 tin nhắn, 400.017 dòng lượt xem theo ngày. Trung vị của 5 lần `EXPLAIN (ANALYZE)`, mili giây.

| Truy vấn | 30 ngày | 366 ngày |
|---|---|---|
| đếm tài khoản | 1,6 | 1,1 |
| đăng ký chủ trọ / người tìm trọ | 0,7 / 0,7 | 1,8 / 6,1 |
| ba nhóm chủ trọ | 0,2 | 0,6 |
| tin theo trạng thái | 29,8 | 29,3 |
| **`listings.public`** | **4418,5** | **4352,6** |
| tin mới theo ngày | 39,3 | 161,1 |
| tin mới theo phường | 18,2 | 93,4 |
| lượt xem theo ngày | 68,1 | 68,8 |
| cuộc trò chuyện | 27,1 | 136,0 |
| tin nhắn | 78,4 | 100,0 |
| đánh giá chủ trọ | 14,6 | 79,9 |
| đánh giá phòng | 20,7 | 106,9 |
| theo dõi | 15,2 | 78,3 |
| lượt lưu | 214,3 | 142,9 |
| hai số đánh giá bị ẩn | 9,5 | 12,2 |

Cả route (15 lần): **trung vị 3363 ms cho 30 ngày (nhỏ nhất 950, lớn nhất 3585; 7.803 byte) và 3483 ms cho 366 ngày (nhỏ nhất 3266, lớn nhất 3624; 76.288 byte)**.

Gần hết thời gian là phép đếm `listings.public`: kế hoạch cho thấy một truy vấn con tương quan chạy một phép đếm hạng cho mỗi tin trong 58 nghìn tin `visible`, đúng luật hiển thị công khai của `src/listings/` (nên cùng chi phí với `total` của `GET /listings` không lọc ở cỡ này). Mọi truy vấn còn lại dưới 215 ms và đều quét cả bảng vì không có chỉ mục theo `created_at`. Spec 0018 và quyết định MVP của bạn nói chỉ đo và ghi số; không có chỉnh sửa nào được làm. Ở dữ liệu demo thật (vài chục tin) route không chậm.

### Acceptance-criteria coverage (mốc 2 và cả hai mốc)

- AC-1 … bảy khóa, ảnh chụp mọi bảng, `Cache-Control`, `EXPLAIN` · AC-2, AC-3 … 14 khoảng ngày và oracle trên cả bảy Metric · AC-4 đến AC-9 … như mốc 1, chạy lại trên route đủ bảy khối với dữ liệu mốc 2 · **AC-10 … đủ bảy Metric: sáu nguồn tương tác đếm mọi dòng, sáu số kỳ này và sáu số kỳ trước khác nhau, điều khiển B1 đến B7, B14, B16** · **AC-11 … `toHandle`: hai danh sách kiểm duyệt, ẩn và gỡ ẩn trực tiếp, điều khiển B8 đến B11** · **AC-12 … đủ mười cột, tổng cột bằng `value` ở ba khoảng, điều khiển B12 và B13** · AC-13 … ranh mili giây của sáu nguồn, ba múi giờ phiên, điều khiển B15 · AC-14 … riêng tư có dấu `BIMAT`, khoảng rỗng, nền tảng rỗng · AC-15 … ma trận quyền, pg_stat với mười hai bảng · AC-16 … như mốc 1
