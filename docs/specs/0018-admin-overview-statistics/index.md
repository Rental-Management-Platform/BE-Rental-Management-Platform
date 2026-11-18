# 0018. Thống kê tổng quan cho admin

**Date**: 2026-11-18
**Status**: Accepted

## Summary

Admin mở một màn hình là thấy sức khỏe của nền tảng, do BE tính sẵn để FE chỉ hiển thị. Spec này thêm một API đọc duy nhất, `GET /statistics/overview`: tài khoản theo loại và trạng thái kèm đăng ký mới, chủ trọ đang có gói, đang dùng thử và hết kỳ, tin theo trạng thái kèm đăng mới theo phường, lượt xem, tương tác (chat, đánh giá, theo dõi, lưu) và các thứ đang bị admin ẩn. Mỗi con số theo khoảng ngày giờ Việt Nam đi kèm số của kỳ liền trước và phần trăm đổi, kèm chuỗi theo ngày để vẽ biểu đồ; khoảng ngày và phần trăm đổi dùng lại đúng hai hàm của spec 0017. Không có bảng, cột, chỉ mục hay migration mới: mọi số tính lúc đọc từ các bảng sẵn có. Quyền mới `statistic:report` chỉ admin giữ và nằm trong code (nên không cần migration), và route đọc lại admin trong database mỗi lần gọi như `GET /users`.

## Requirements

**User stories**:
- Là admin, tôi muốn mở một màn hình là thấy nền tảng đang có bao nhiêu tài khoản, tin, chủ trọ có gói, và mọi người dùng nó nhiều hay ít, để biết nền tảng đang khỏe hay yếu.
- Là admin, tôi muốn mỗi con số của kỳ này đi kèm kỳ trước và phần trăm đổi, để thấy nền tảng đang lên hay xuống.
- Là admin, tôi muốn biết có bao nhiêu tin và đánh giá đang bị ẩn do admin, để quay lại xử lý.
- Là người làm FE, tôi muốn BE trả sẵn mọi con số, mọi phần trăm và chuỗi theo ngày đã điền đủ ngày, để FE chỉ hiển thị, không tự tính.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `GET /api/v1/statistics/overview` trả 200 một object có đúng bảy khóa: `period`, `accounts`, `landlords`, `listings`, `engagement`, `toHandle`, `series`; hình dạng từng khối như ở mục Feature design, không có trường nào ngoài danh sách. Route chỉ đọc: không ghi bảng nào, không khóa dòng, không đổi `updated_at` của ai. Phản hồi 200 có `Cache-Control: private, no-store`. Không dùng `@RateLimited` (như `GET /users`), không mã lỗi mới.
- **AC-2**: Khoảng ngày, cùng quy tắc của spec 0017 AC-2 (cùng hàm `resolveStatPeriod`). `from` và `to` tùy chọn, dạng `YYYY-MM-DD`, là ngày có thật trên lịch, năm từ 2000 đến 2100. Không gửi `to` thì `to` là ngày hôm nay giờ Việt Nam; không gửi `from` thì `from` là `to` lùi 29 ngày; không gửi gì là 30 ngày kết thúc hôm nay. `days` là số ngày lịch từ `from` đến `to` kể cả hai đầu, từ 1 đến 366. `from` sau `to` hoặc `days` lớn hơn 366 bị 400 `VALIDATION_FAILED` ở trường `to`; sai dạng, ngày không có thật hay ngoài khoảng năm bị 400 ở đúng trường đó; tham số lạ (ví dụ `groupBy`, `sort`) bị 400. `period` trả `{ from, to, days, previousFrom, previousTo, timeZone }`, không bao giờ `null`, `timeZone` luôn là `Asia/Ho_Chi_Minh`. Ngày hôm nay được tính cả ngày dù mới qua một phần.
- **AC-3**: Kỳ trước và phần trăm đổi, cùng quy tắc của spec 0017 AC-3. Kỳ trước là `days` ngày liền sát trước `from` (cùng độ dài, không chồng, không hở). Mọi con số theo kỳ có dạng `{ value, previous, changePercent }`; `changePercent` là `(value − previous) / previous × 100` làm tròn một chữ số thập phân, nửa làm tròn ra xa số 0, tính bằng số nguyên (hàm `percentChange` có sẵn), `null` khi `previous` bằng 0 (không chia cho 0, không `Infinity`, không `NaN`, không `-0`). Chỉ con số theo kỳ mới có kỳ trước; số của trạng thái hiện tại (khối `accounts` trừ `registered`, khối `landlords`, các số trạng thái và `public` của `listings`, `createdByWard`, khối `toHandle`) là số thường, không có `previous`, vì lịch sử trạng thái không được lưu.
- **AC-4**: Tài khoản hiện có. `accounts` có `total`, `active`, `locked` và `byType.{admin, landlord, tenant}`, mỗi loại là `{ total, active, locked }`. Chỉ đếm tài khoản `users.deleted_at IS NULL` tại lúc đọc. Ở mọi cấp `total = active + locked`; `accounts.total`, `accounts.active`, `accounts.locked` bằng tổng của ba loại. Mỗi số bằng `total` của `GET /users` (spec 0007) với bộ lọc `accountType` và `status` tương ứng, ở cùng thời điểm, cho cả chín tổ hợp (kể cả không lọc).
- **AC-5**: Đăng ký mới. `accounts.registered` có `total`, `landlords`, `tenants`, mỗi cái là Metric (dạng ở AC-3). `landlords` và `tenants` đếm dòng `users` có `account_type` đó và `created_at` trong khoảng (ngày giờ Việt Nam), kể cả tài khoản sau đó bị khóa hay xóa mềm. Tài khoản `admin` không bao giờ được đếm (admin không tự đăng ký, do seed tạo). `registered.total.value` bằng `landlords.value + tenants.value`, và `previous` cũng vậy.
- **AC-6**: Chủ trọ theo gói. `landlords` là `{ total, onPlan, onTrial, trialExpired }` trên mọi tài khoản `landlord` chưa xóa mềm, kể cả đang bị khóa. Một chủ trọ là `onPlan` nếu có kỳ gói chứa `now` (`starts_at` tính, `ends_at` không tính, spec 0004); không thì là `onTrial` nếu `trial_ends_at` lớn hơn `now` (so chặt, như `MembershipsService.resolve`); không thì là `trialExpired`. Gói thắng dùng thử (còn gói lẫn còn dùng thử thì tính `onPlan`). `onPlan + onTrial + trialExpired = total = accounts.byType.landlord.total`. Với từng chủ trọ, nhóm của họ bằng `state` (`plan`, `trial`, `expired`) của `GET /me/membership` ở cùng thời điểm.
- **AC-7**: Tin theo trạng thái. `listings.total`, `listings.visible`, `listings.hiddenByOwner`, `listings.hiddenByAdmin` đếm tin `listings.deleted_at IS NULL` theo `status` (`visible`, `hidden_by_owner`, `hidden_by_admin`); `total` bằng tổng ba số kia; tin đã xóa mềm không tính vào đâu.
- **AC-8**: Tin đang hiện công khai. `listings.public` là số tin thỏa luật hiển thị công khai của spec 0003 và 0004, dùng đúng `publicListingFrom` cộng `publicListingCondition` của `src/listings/` với cùng `now` và `trial_listing_limit` đọc từ `settings`, nên bằng `total` của `GET /listings` không lọc ở cùng thời điểm. `listings.visibleButNotPublic = visible − public`, không bao giờ âm; đó là tin `visible` mà người tìm trọ không thấy vì chủ trọ bị khóa, hết dùng thử hay hết gói, hoặc vượt hạn mức (ba lý do này không tách ra).
- **AC-9**: Tin đăng mới và theo phường. `listings.created` là Metric đếm tin (mọi trạng thái, kể cả tin đã xóa mềm) có `created_at` trong khoảng. `listings.createdByWard` chỉ có kỳ này (không kỳ trước): danh sách `{ wardCode, wardName, count }` của mọi phường có `count` lớn hơn 0, sắp `count` giảm dần rồi `wardCode` tăng dần, không cắt top. Phường của một tin lấy qua nhà trọ của tin (`properties.ward_code`), `wardName` là `wards.name` hiện tại. Tổng `count` bằng `listings.created.value`. Không có tin mới thì là `[]`.
- **AC-10**: Tương tác. `engagement` có bảy Metric: `views` (tổng cột `views` của `listing_daily_views` cho mọi tin, kể cả tin ẩn và xóa mềm, có `day` trong khoảng), `conversations` (theo `conversations.created_at`), `messages` (`messages.created_at`), `landlordReviews` (`reviews.created_at`), `roomReviews` (`listing_reviews.created_at`), `follows` (`follows.created_at`), `favorites` (`favorites.created_at`). Mỗi dòng đang tồn tại đều tính, không áp luật công khai: đánh giá bị admin ẩn, lượt theo dõi của tài khoản bị khóa, tin nhắn của cuộc trò chuyện về tin đã xóa mềm đều vẫn tính. Bỏ lưu hay bỏ theo dõi xóa dòng, nên số của một kỳ cũ có thể giảm về sau; lượt xem chỉ có lịch sử từ lúc bảng của spec 0016 có chỗ ghi.
- **AC-11**: Việc cần xử lý. `toHandle` là `{ hiddenListings, hiddenLandlordReviews, hiddenRoomReviews }`, ba số của lúc đọc (không kỳ trước): `hiddenListings` là số tin chưa xóa mềm có `status = 'hidden_by_admin'` (bằng `listings.hiddenByAdmin`); `hiddenLandlordReviews` và `hiddenRoomReviews` là số dòng `reviews` và `listing_reviews` có `status = 'hidden_by_admin'`, bằng `total` của `GET /moderation/reviews` và `GET /moderation/listing-reviews` khi lọc đánh giá đang bị ẩn, ở cùng thời điểm.
- **AC-12**: Chuỗi theo ngày. `series` có đúng `days` phần tử, mỗi ngày từ `from` đến `to` một phần tử, sắp ngày tăng dần, mỗi phần tử `{ date, newLandlords, newTenants, newListings, views, newConversations, newMessages, newLandlordReviews, newRoomReviews, newFollows, newFavorites }`; ngày không có gì thì mọi số bằng 0 (FE không phải điền ô trống). Tổng từng cột bằng `value` của Metric tương ứng: `newLandlords` với `registered.landlords`, `newTenants` với `registered.tenants`, `newListings` với `listings.created`, `views` với `engagement.views`, `newConversations` với `engagement.conversations`, `newMessages` với `engagement.messages`, `newLandlordReviews` với `engagement.landlordReviews`, `newRoomReviews` với `engagement.roomReviews`, `newFollows` với `engagement.follows`, `newFavorites` với `engagement.favorites`; kỳ trước của mỗi Metric lấy từ cùng truy vấn nên theo cùng quy tắc. Khoảng 1 ngày ra 1 phần tử, khoảng 366 ngày ra 366 phần tử.
- **AC-13**: Ranh giới ngày giờ Việt Nam. Mọi "ngày" (lọc, kỳ trước, gom chuỗi) là ngày lịch giờ Việt Nam lấy từ `APP_TIME_ZONE`. Một dòng tạo lúc `2026-10-31T16:59:59.999Z` (23:59:59.999 ngày 31/10 giờ Việt Nam) thuộc ngày `2026-10-31`; tạo lúc `2026-10-31T17:00:00.000Z` thuộc ngày `2026-11-01`; đúng cho từng nguồn (tài khoản, tin, chat, đánh giá, theo dõi, lưu). Kết quả giống nhau khi múi giờ phiên của database là `UTC`, `Asia/Ho_Chi_Minh` hay `America/Los_Angeles`. `listing_daily_views.day` đã là ngày giờ Việt Nam nên so thẳng. Ở các số của lúc đọc, `trial_ends_at` đúng bằng `now` là đã hết (so chặt), và kỳ gói kết thúc đúng lúc `now` là đã hết.
- **AC-14**: Riêng tư và dữ liệu rỗng. Phản hồi chỉ có số đếm, ngày, mã phường và tên phường. Không có id, email, số điện thoại, tên, nhận xét, nội dung tin nhắn, tiêu đề hay mã tin của bất kỳ người hay tin nào, ở bất kỳ chỗ nào. Khoảng không có dữ liệu nhận 200 với mọi số của kỳ bằng 0, `changePercent` là `null` khi chưa tính được, `createdByWard` là `[]` và `series` đủ ngày toàn số 0.
- **AC-15**: Phân quyền. Không đăng nhập: 401 `TOKEN_MISSING`. `tenant`: 403 `PERMISSION_DENIED`, kể cả khi gửi tham số sai (quyền kiểm trước tham số). Chủ trọ: 403 `PERMISSION_DENIED`, kể cả chủ trọ mang token cấp trước thay đổi này (token đó có `statistic:manage`, mà nay `manage` bung ra cả `statistic:report`): `@FreshAuth()` đọc lại quyền từ database nên chủ trọ chỉ còn `statistic:read` và luôn bị chặn. Admin: 200. Admin vừa bị khóa mang token còn hạn bị từ chối ngay (như `GET /users`). Admin gửi tham số sai nhận 400. Thứ tự kiểm: 401, 403 theo quyền của token, kiểm lại bằng database, 400 theo tham số. Người bị từ chối không đọc bất kỳ bảng dữ liệu nào.
- **AC-16**: Danh mục quyền. Module `statistic` có thêm hành động `report` nằm trong `adminActions`, nên `GET /permissions` liệt kê nó với `adminActions: ['report']`; admin giữ `statistic:report` trong code; `PATCH /account-types/landlord` và `/tenant` không cấp được `statistic:report` hay `statistic:manage` (bị `PERMISSION_ADMIN_ONLY`). Không có migration: quyền `statistic:read` đã lưu cho `landlord` giữ nguyên, và `GET /me/statistics` của spec 0017 giữ nguyên hành vi (kể cả với token chủ trọ cũ mang `statistic:manage`).

## Decision

**Chosen option**: Option 1: Một route `GET /statistics/overview` tính lúc đọc từ các bảng sẵn có, qua một `AdminOverviewRepository` chỉ đọc nằm trong `src/statistics/`

Một lần gọi trả mọi nhóm số của cả nền tảng trong một khoảng ngày giờ Việt Nam, kèm kỳ liền trước, phần trăm đổi và chuỗi theo ngày đã điền đủ. Số theo kỳ có so sánh; số trạng thái hiện tại thì không (như spec 0017). Không bảng, cột, chỉ mục hay migration mới. Quyền mới `statistic:report` chỉ admin giữ, route gắn `@FreshAuth()`. Đường của admin tách hẳn đường của chủ trọ: không truy vấn nào của `GET /me/statistics` được dùng lại với bộ lọc bỏ trống.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`)

## Feature design

Quy ước chung theo 0001 đến 0017: id `uuidv7()`, `timestamptz`, `snake_case` ở DB, tiền tố `/api/v1`, mã lỗi trong `ErrorCode`, một đồng hồ `now` cho mỗi request. `AdminOverviewRepository` chỉ đọc, không bao giờ ghi, và các Repository chủ vẫn là nơi duy nhất ghi bảng của mình.

**Data model**: không bảng mới, không cột mới, không chỉ mục mới, không migration; `schema.prisma` không đổi. Mô hình nguồn đã được bạn xác nhận:

| Khối | Nguồn |
|---|---|
| `accounts` (hiện có) | `users` chưa xóa mềm, nhóm theo `account_type` và `status` |
| `accounts.registered` | `users.created_at` của `landlord` và `tenant`, mọi dòng kể cả đã xóa mềm |
| `landlords` | `users` `landlord` chưa xóa mềm, `subscriptions` (kỳ chứa `now`), `users.trial_ends_at` |
| `listings` trạng thái | `listings` chưa xóa mềm, nhóm theo `status` |
| `listings.public` | `publicListingFrom` và `publicListingCondition` của `src/listings/` (nối `properties`, `users`, kỳ gói) |
| `listings.created`, `createdByWard` | `listings.created_at` mọi dòng, nối `properties.ward_code` và `wards.name` |
| `engagement.views` | `listing_daily_views(day, views)` của mọi tin |
| `engagement` còn lại | `conversations`, `messages`, `reviews`, `listing_reviews`, `follows`, `favorites` theo `created_at`, mọi dòng |
| `toHandle` | `listings`, `reviews`, `listing_reviews` có `status = 'hidden_by_admin'` |

Không có chỉ mục nào theo `created_at` của `users`, `messages`, `conversations`, `follows`, `favorites`, nên các phép đếm theo khoảng quét bảng; đã chốt không thêm chỉ mục, chỉ đo một lần (xem Consequences).

**State transitions**: không có. Route chỉ đọc.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/statistics/overview` | GET | query tùy chọn: `from`, `to` (`YYYY-MM-DD`) | 200 `{ period, accounts, landlords, listings, engagement, toHandle, series }` | `statistic:report` (chỉ admin) và `@FreshAuth()` | 400 `VALIDATION_FAILED`, 401 `TOKEN_MISSING`, 401 `TOKEN_INVALID`, 401 `TOKEN_EXPIRED`, 403 `PERMISSION_DENIED` |

Phản hồi mẫu (rút gọn: `createdByWard` và `series` chỉ có hai phần tử nên các tổng ở hai chỗ này chưa khớp với số ngoài cùng):

```json
{
  "period": { "from": "2026-10-20", "to": "2026-11-18", "days": 30, "previousFrom": "2026-09-20", "previousTo": "2026-10-19", "timeZone": "Asia/Ho_Chi_Minh" },
  "accounts": {
    "total": 1213, "active": 1200, "locked": 13,
    "byType": {
      "admin": { "total": 2, "active": 2, "locked": 0 },
      "landlord": { "total": 210, "active": 205, "locked": 5 },
      "tenant": { "total": 1001, "active": 993, "locked": 8 }
    },
    "registered": {
      "total": { "value": 45, "previous": 38, "changePercent": 18.4 },
      "landlords": { "value": 7, "previous": 5, "changePercent": 40 },
      "tenants": { "value": 38, "previous": 33, "changePercent": 15.2 }
    }
  },
  "landlords": { "total": 210, "onPlan": 40, "onTrial": 120, "trialExpired": 50 },
  "listings": {
    "total": 800, "visible": 600, "hiddenByOwner": 150, "hiddenByAdmin": 50,
    "public": 520, "visibleButNotPublic": 80,
    "created": { "value": 21, "previous": 15, "changePercent": 40 },
    "createdByWard": [
      { "wardCode": "26734", "wardName": "Phường Bến Thành", "count": 12 },
      { "wardCode": "26737", "wardName": "Phường Võ Thị Sáu", "count": 9 }
    ]
  },
  "engagement": {
    "views": { "value": 1280, "previous": 1024, "changePercent": 25 },
    "conversations": { "value": 64, "previous": 80, "changePercent": -20 },
    "messages": { "value": 512, "previous": 400, "changePercent": 28 },
    "landlordReviews": { "value": 9, "previous": 0, "changePercent": null },
    "roomReviews": { "value": 14, "previous": 11, "changePercent": 27.3 },
    "follows": { "value": 33, "previous": 33, "changePercent": 0 },
    "favorites": { "value": 120, "previous": 90, "changePercent": 33.3 }
  },
  "toHandle": { "hiddenListings": 50, "hiddenLandlordReviews": 3, "hiddenRoomReviews": 7 },
  "series": [
    { "date": "2026-10-20", "newLandlords": 0, "newTenants": 2, "newListings": 1, "views": 40, "newConversations": 3, "newMessages": 17, "newLandlordReviews": 0, "newRoomReviews": 1, "newFollows": 1, "newFavorites": 4 },
    { "date": "2026-10-21", "newLandlords": 1, "newTenants": 0, "newListings": 0, "views": 0, "newConversations": 0, "newMessages": 0, "newLandlordReviews": 0, "newRoomReviews": 0, "newFollows": 0, "newFavorites": 0 }
  ]
}
```

Mã phường trong mẫu chỉ để minh họa; mã thật lấy từ bảng `wards`. Không có mã lỗi mới: dùng `VALIDATION_FAILED`, `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `PERMISSION_DENIED` đã có.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi**: token (401) → quyền `statistic:report` (403) → kiểm lại admin và quyền bằng database (`@FreshAuth()`) → tham số (400, pipe) → `resolveStatPeriod` (400). Admin gửi tham số sai nhận 400; tenant gửi tham số sai nhận 403.
- **Quyền**: sửa mục `statistic` của `PERMISSION_CATALOG` thành `actions: ['read', 'report']`, `ownerScoped: true`, `adminActions: ['report']` (cùng mẫu `order:report` của spec 0010). Controller dùng `@RequirePermissions('statistic:report')` và `@FreshAuth()`. `@FreshAuth()` là BẮT BUỘC, không được bỏ: token chủ trọ cấp trước thay đổi này mang `statistic:manage`, mà `manage` giờ bung ra cả `report`, nên chỉ lần đọc lại quyền từ database (chủ trọ chỉ có khóa lẻ `statistic:read`) giữ route này ở 403. Không thêm kiểm loại tài khoản ở Service (như 0010): quyền chỉ admin không cấp được cho loại khác, và `@FreshAuth()` đã đọc lại tài khoản.
- **Tham số**: dùng lại `StatisticsQueryDto` (`from`, `to` tùy chọn, `@IsCalendarDate()`) và `resolveStatPeriod(query, now)` của `src/statistics/stat-period.ts`; `toRangeBounds` cho hai cận của truy vấn. Không thêm tham số nào khác.
- **Metric**: dùng lại `toMetric` của `src/statistics/stat-metric.ts` và `splitByPeriod` của `statistics.mapper.ts`. Không có số nào cần `toRateMetric` (không có tỉ lệ).
- **Cách truy vấn** (gợi ý; `/develop` được chia khác miễn các bất biến giữ): Service lấy `now` một lần, đọc `trial_listing_limit` từ `SettingsService`, rồi chạy các truy vấn của `AdminOverviewRepository` song song bằng `Promise.all`, không giao dịch. Các truy vấn: đếm tài khoản theo loại và trạng thái (một câu); đăng ký theo ngày cho `landlord` và cho `tenant` (hai lần gọi cùng một khung); đếm chủ trọ theo ba nhóm (một câu có `FILTER`, kỳ gói dùng `tstzrange(starts_at, ends_at) @> now`); đếm tin theo trạng thái (một câu); đếm `public` (một câu dùng `publicListingFrom` và `publicListingCondition`); tin mới theo ngày và tin mới theo phường (kỳ này); lượt xem theo ngày; sáu truy vấn tương tác theo ngày. Mỗi truy vấn theo ngày dùng khung mới `dailyCounts(source, start, end)` trả các dòng `{ day, count }` của `[start, end)` theo ngày giờ Việt Nam (`to_char(... AT TIME ZONE ${APP_TIME_ZONE}::text ...)`, múi giờ là tham số ràng buộc, cận là chuỗi ISO có `Z`), KHÔNG kèm dòng tổng toàn thời gian (khối này không có số toàn thời gian); Service tách dòng bằng `splitByPeriod` ra `value`, `previous` và cột chuỗi từ cùng các dòng. `dailyWithTotal` riêng của spec 0017 giữ nguyên, không đụng.
- **`public` không viết lại luật**: `AdminOverviewRepository` import trực tiếp `publicListingFrom` và `publicListingCondition` (đã `export` ở `src/listings/listings.repository.ts`), không sửa gì trong `src/listings/`.
- **`createdByWard`**: một câu `GROUP BY p.ward_code` trên tin có `created_at` trong `[from, to]`, nối `wards` lấy tên, sắp `count DESC, ward_code ASC`.
- **Không cache, không giới hạn tần suất**: `@Header('Cache-Control', 'private, no-store')`; không `@RateLimited` (như `GET /users`, `GET /orders/all`).
- **Định tuyến**: `GET /statistics/overview` không đụng route nào đang có (`me/statistics` là controller riêng). Controller mới nằm trong `StatisticsModule`, module nhập thêm `SettingsModule`.

**Value sourcing** (mọi giá trị route tạo ra hoặc hiển thị đều có nguồn):

| Giá trị | Nguồn |
|---|---|
| Người gọi | `sub` và quyền trong access token, đọc lại bằng `@FreshAuth()`; dữ liệu là của cả nền tảng nên không có tham số nào lọc theo người |
| `period.*`, `previousFrom`, `previousTo`, `days` | query hoặc mặc định theo `now`, qua `resolveStatPeriod` (spec 0017) |
| `now` | đồng hồ ứng dụng, lấy một lần mỗi request |
| Ranh giới một ngày | `APP_TIME_ZONE`, `toRangeBounds`, `toSqlTimestamp` |
| `accounts.total`, `active`, `locked`, `byType.*` | `users` có `deleted_at IS NULL` nhóm theo `account_type`, `status` |
| `accounts.registered.*` | `users.created_at` của `landlord` và `tenant`, mọi dòng |
| `landlords.*` | `users` `landlord` chưa xóa mềm; `subscriptions.starts_at`, `ends_at` so với `now`; `users.trial_ends_at` so với `now` |
| `listings.total`, `visible`, `hiddenByOwner`, `hiddenByAdmin` | `listings` có `deleted_at IS NULL` nhóm theo `status` |
| `listings.public` | `publicListingFrom(now)` cộng `publicListingCondition(now, trial_listing_limit)` |
| `trial_listing_limit` | `SettingsService.getValue('trial_listing_limit')`, một lần mỗi request |
| `listings.visibleButNotPublic` | `visible − public` |
| `listings.created.*` | `listings.created_at` mọi dòng kể cả xóa mềm |
| `listings.createdByWard[]` | `listings` nối `properties.ward_code`, `wards.name` hiện tại |
| `engagement.views.*` | `listing_daily_views.views` của mọi tin, theo `day` |
| `engagement.conversations`, `messages`, `landlordReviews`, `roomReviews`, `follows`, `favorites` | `created_at` của từng bảng, mọi dòng |
| `toHandle.*` | `status = 'hidden_by_admin'` ở `listings` (chưa xóa mềm), `reviews`, `listing_reviews` |
| `changePercent` | `percentChange(value, previous)`, `null` khi `previous` bằng 0 |
| `series[]` | cùng các dòng theo ngày của các nguồn trên, điền ngày trống bằng 0 |
| Header `Cache-Control` | hằng `private, no-store` |

**Key invariants**:
- Route chỉ đọc: không ghi, không khóa dòng, không đổi `updated_at`.
- Chỉ admin đọc được, và được đọc lại từ database mỗi lần gọi; không đường nào để chủ trọ hay người tìm trọ thấy số của nền tảng.
- Trong một nhóm các phần luôn cộng lại: `accounts.total` bằng tổng ba loại và bằng `active + locked`; `landlords.total` bằng ba nhóm và bằng `accounts.byType.landlord.total`; `listings.total` bằng ba trạng thái; `visible = public + visibleButNotPublic`; `registered.total` bằng `landlords + tenants`; tổng `createdByWard` bằng `listings.created.value`; tổng mỗi cột của `series` bằng `value` của Metric tương ứng; `toHandle.hiddenListings` bằng `listings.hiddenByAdmin`.
- Một "ngày" ở mọi nơi là ngày lịch giờ Việt Nam từ một định nghĩa duy nhất; phần trăm tính bằng số nguyên, không bao giờ chia cho 0.
- Số công khai khớp số công khai: `accounts` khớp `GET /users`, `listings.public` khớp `GET /listings`, `landlords` khớp `GET /me/membership`, hai số đánh giá của `toHandle` khớp danh sách kiểm duyệt.
- Phản hồi chỉ chứa số đếm, ngày, mã và tên phường; không có danh tính hay nội dung của ai.

**Security model**:
- Cần quyền `statistic:report` (chỉ admin giữ, không cấp được cho `landlord` hay `tenant`) và `@FreshAuth()`: admin vừa bị khóa hay mất quyền bị từ chối ngay, và chủ trọ mang token cũ có `statistic:manage` vẫn bị chặn vì quyền đọc lại từ database.
- Dữ liệu cá nhân: không có. Phản hồi không chứa id, email, số điện thoại, tên, nhận xét hay nội dung tin nhắn; chỉ có số đếm. Dự án chưa khai phạm vi tuân thủ riêng.
- Không thêm nhật ký đọc của admin (giữ như `GET /users` và `GET /orders/all`).

**Configuration required**: không có biến môi trường, dịch vụ ngoài, migration hay seed mới. Cần Postgres biết múi giờ `Asia/Ho_Chi_Minh` (đã dùng từ spec 0010). Token của admin cấp trước đây đã mang `statistic:manage` nên không cần đăng nhập lại.

**Critical test scenarios** (mỗi dòng ứng với một hay nhiều AC):
- Happy path: dựng bằng tay tài khoản đủ ba loại và hai trạng thái (kèm một tài khoản xóa mềm mỗi loại), mọi con số của `accounts` khớp một phép đếm độc lập tính bằng JavaScript từ dòng thô và khớp `total` của `GET /users` cho chín tổ hợp bộ lọc, verifies **AC-4**
- Happy path: đăng ký mới của `landlord` và `tenant` ở hai kỳ, kể cả tài khoản sau đó bị khóa hay xóa mềm; một tài khoản `admin` tạo trong khoảng không được đếm; `total` bằng tổng hai loại, verifies **AC-5**
- Happy path: chủ trọ có gói đang chạy, có gói và còn dùng thử, chỉ còn dùng thử, hết dùng thử không gói, và một chủ trọ bị khóa ở mỗi nhóm; ba nhóm cộng lại bằng tổng; nhóm từng chủ trọ bằng `state` của `GET /me/membership`; biên mili giây của `ends_at` và `trial_ends_at` (đúng `now` là đã hết), verifies **AC-6**, **AC-13**
- Happy path: tin ở cả ba trạng thái và có tin xóa mềm; `total`, `visible`, hai số ẩn đúng; `public` bằng `total` của `GET /listings` không lọc, thử khi chủ trọ bị khóa, hết dùng thử, hết gói và vượt hạn mức; `visibleButNotPublic` không âm, verifies **AC-7**, **AC-8**
- Happy path: tin mới ở hai kỳ gồm tin xóa mềm và tin ẩn; `createdByWard` đúng thứ tự (có hai phường cùng `count` để thử khóa phụ `wardCode`), tổng bằng `created.value`, tên phường là tên hiện tại sau khi admin đổi tên, verifies **AC-9**
- Happy path: mỗi nguồn tương tác ở hai kỳ gồm một đánh giá bị ẩn, một lượt theo dõi của tài khoản bị khóa, một tin nhắn trong cuộc trò chuyện về tin đã xóa mềm, một lượt xem của tin đang ẩn; mọi Metric khớp phép đếm độc lập, verifies **AC-10**
- Happy path: `toHandle` có tin, đánh giá chủ trọ và đánh giá phòng đang bị ẩn cùng những dòng bị chủ trọ ẩn (không tính) và tin xóa mềm (không tính tin); hai số đánh giá bằng danh sách kiểm duyệt đã lọc, verifies **AC-11**
- Happy path: mặc định 30 ngày, chỉ `from`, chỉ `to`, 1 ngày, đúng 366 ngày; `period` đúng; `series` đủ `days` phần tử, tổng từng cột bằng Metric tương ứng và kỳ trước đúng cả khi kỳ trước chạm tháng 2 năm nhuận; `changePercent` cho các cặp (5, 3), (3, 5), (4, 4), (0, 0), (7, 0), verifies **AC-2**, **AC-3**, **AC-12**
- Failure case: `from` sau `to`, 367 ngày, `from=2026-02-30`, `from=1999-12-31`, `to=21/10/2026`, `groupBy=day`, `sort=asc` đều bị 400 `VALIDATION_FAILED` đúng trường, không đọc bảng dữ liệu nào, verifies **AC-2**
- Failure case: ranh giới ngày ở đúng mili giây (`16:59:59.999Z` và `17:00:00.000Z`) cho đăng ký, tin, chat, đánh giá, theo dõi và lưu, chạy lại với múi giờ phiên `UTC` và `America/Los_Angeles` ra cùng kết quả; lượt xem theo ngày ghi tay ở hai ngày sát ranh, verifies **AC-13**
- Failure case: nền tảng rỗng (không tin, không tương tác, chỉ có admin) và khoảng không có dữ liệu: mọi số 0, `changePercent` `null`, `createdByWard` rỗng, `series` toàn 0; phản hồi không chứa email, số điện thoại, tên, id hay nội dung của ai ở bất kỳ chỗ nào, verifies **AC-14**
- Auth/permission: khách 401; tenant 403 (cả khi gửi tham số sai); chủ trọ 403, kể cả token ký tay mang `statistic:manage`; admin vừa bị khóa mang token còn hạn bị từ chối; admin gửi tham số sai nhận 400; admin 200 với `Cache-Control: private, no-store`; người bị từ chối không đọc bảng dữ liệu nào (đo bằng bộ đếm đọc của PostgreSQL), verifies **AC-15**
- Auth/permission: `GET /permissions` có `statistic` với `adminActions: ['report']`; `PATCH /account-types/landlord` và `/tenant` với `statistic:report` hay `statistic:manage` bị `PERMISSION_ADMIN_ONLY`; `GET /me/statistics` của chủ trọ vẫn 200, cả với token cũ, verifies **AC-16**
- Happy path: lần gọi không đổi một dòng nào của mọi bảng (so ảnh chụp trước và sau), verifies **AC-1**
- Điều khiển âm (bước kiểm thật, không phải test tự động): bỏ `@FreshAuth()`, đổi `trial_ends_at >` thành `>=`, cho `ends_at` của kỳ gói thành chặn đóng, đếm cả `admin` ở `registered`, bỏ `deleted_at IS NULL` ở `accounts`, thay múi giờ bằng `UTC` khi gom ngày, đổi cận trên từ `<` thành `<=`, bỏ `status = 'hidden_by_admin'` ở `toHandle`, tính tin xóa mềm vào `listings.total`, thay `publicListingCondition` bằng `status = 'visible'`, đổi thứ tự `createdByWard` bỏ khóa phụ; mỗi thay đổi phải bị đúng kiểm tra tương ứng bắt, verifies **AC-4** đến **AC-15**
- Kiểm bằng `EXPLAIN` (không phải test tự động): dữ liệu cỡ demo (khoảng 60 nghìn tin trên database thử, nhiều tin nhắn và lượt lưu) đo từng truy vấn và cả route một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-1**

## Build plan

Theo Skateboard (làm bản mỏng nhất dùng được trước, rồi mới mở rộng): Mốc 1 cho admin một màn hình dùng được ngay với tài khoản, chủ trọ theo gói, tin, lượt xem và bốn cột đầu của chuỗi; Mốc 2 thêm năm nguồn tương tác còn lại, việc cần xử lý và các cột còn lại. Mỗi mốc là một lần `/develop` rồi dừng cho bạn review. Quy tắc tài liệu sống: cập nhật `docs/api/api-for-frontend.md` trong từng mốc.

**Mốc 1: đường chạy thông, tài khoản, chủ trọ, tin và lượt xem**
1. Quyền: sửa mục `statistic` của `PERMISSION_CATALOG` thêm `report` (`adminActions: ['report']`), sửa chú thích cho đúng, sửa `permission-catalog.spec.ts` và mọi test đang giả định `statistic` chỉ có `read` hay token chủ trọ mang `statistic:manage`. Không migration. Satisfies **AC-15**, **AC-16**.
2. Khung theo ngày và kiểu trả về: `dailyCounts(source, start, end)` trong một file mới của `src/statistics/` (không kèm dòng tổng), kiểu phản hồi của route (`dto/admin-overview.response.ts`) và hàm dựng chuỗi theo ngày cho cột của admin; dùng lại `StatisticsQueryDto`, `resolveStatPeriod`, `toRangeBounds`, `toMetric`, `splitByPeriod`; kèm test đơn vị (hình dạng SQL, tham số ISO có `Z`, tổng cột bằng `value`). Satisfies **AC-2**, **AC-3**, **AC-12** (bốn cột của mốc), **AC-13**.
3. Module: `AdminOverviewRepository` (đếm tài khoản, đăng ký theo ngày cho `landlord` và `tenant`, ba nhóm chủ trọ, đếm tin theo trạng thái, đếm `public` bằng `publicListingFrom` và `publicListingCondition`, tin mới theo ngày, tin mới theo phường, lượt xem theo ngày), `AdminOverviewService` (lấy `now`, đọc `trial_listing_limit`, `Promise.all`, dựng các khối `period`, `accounts`, `landlords`, `listings`, `engagement.views`, `series` với bốn cột `newLandlords`, `newTenants`, `newListings`, `views`), `AdminStatisticsController` (`GET /statistics/overview` với `@RequirePermissions('statistic:report')`, `@FreshAuth()`, `@Header`), nhập `SettingsModule` vào `StatisticsModule`; các khối chưa làm ở mốc này (`toHandle`, sáu Metric còn lại của `engagement`, sáu cột còn lại của chuỗi) không có mặt trong phản hồi; kèm test đơn vị cho Repository, Service (các nhóm cộng đúng, kỳ trước, `visibleButNotPublic` không âm) và Controller (khai báo route, thứ tự lỗi, `@FreshAuth()` còn đó). Satisfies **AC-1**, **AC-4** đến **AC-9**, **AC-10** (phần `views`), **AC-12** (bốn cột), **AC-14**, **AC-15**.
4. Kiểm thật trên database thử: dựng dữ liệu tay, oracle độc lập từ dòng thô cho tài khoản, chủ trọ theo gói, tin, `public`, tin mới theo phường và lượt xem; đối chiếu với `GET /users`, `GET /listings`, `GET /me/membership`; ranh giới ngày với ba múi giờ phiên; token chủ trọ ký tay mang `statistic:manage`; các điều khiển âm của mốc này; `verify.md`. Tài liệu: `api-for-frontend.md` thêm mục "Thống kê tổng quan cho admin" (ghi rõ số trạng thái không có kỳ trước, quy tắc đếm mọi dòng khác với màn hình chủ trọ, và các khối chưa có ở mốc 1), thêm khóa quyền vào bảng quyền và nhật ký. Satisfies **AC-1** đến **AC-9**, **AC-13** đến **AC-16**.

**Mốc 2: tương tác, việc cần xử lý, chuỗi đầy đủ**
5. Tương tác: sáu truy vấn theo ngày (`conversations`, `messages`, `reviews`, `listing_reviews`, `follows`, `favorites`) qua `dailyCounts`, đủ bảy Metric của `engagement`, sáu cột còn lại của chuỗi (`newConversations`, `newMessages`, `newLandlordReviews`, `newRoomReviews`, `newFollows`, `newFavorites`), kèm test đơn vị. Satisfies **AC-10**, **AC-12**.
6. Việc cần xử lý: ba phép đếm `hidden_by_admin` và khối `toHandle`, kèm test đơn vị. Satisfies **AC-11**.
7. Kiểm thật trên database thử: oracle độc lập cho mọi khối, đối chiếu hai số đánh giá của `toHandle` với hai danh sách kiểm duyệt, ranh giới ngày ở đúng mili giây cho từng nguồn, tổng cột của `series` bằng Metric, không lộ danh tính, ma trận quyền (khách, tenant, chủ trọ, chủ trọ token cũ, admin bị khóa, admin), `GET /permissions` và `PATCH /account-types`, mọi điều khiển âm còn lại, `EXPLAIN` cỡ demo một lần, chạy `seed:demo` rồi gọi route để xem số có ý nghĩa; cập nhật `verify.md`. Tài liệu: `api-for-frontend.md` bổ sung các khối của mốc 2. Satisfies **AC-1** đến **AC-16**.

## Consequences

**Positive**:
- Một lần gọi đủ cho cả màn hình admin: FE không tính gì, không điền ô trống, không ghép số từ nhiều route.
- Không bảng, cột, chỉ mục, biến môi trường, migration hay mã lỗi mới; tái dùng gần hết thứ sẵn có (khoảng ngày và Metric của 0017, `publicListingFrom` và `publicListingCondition`, `StatisticsQueryDto`, nhóm quyền chỉ admin kiểu `order:report`).
- Số công khai không được viết lại: `public` dùng thẳng luật của `src/listings/`, nên không có thêm bản sao luật nào để lệch. Các số còn lại đếm mọi dòng nên không có luật nào phải theo.
- Tổng của chuỗi và `value` khớp nhau theo cách xây (cùng các dòng), và các số được đối chiếu với `GET /users`, `GET /listings`, `GET /me/membership` và hai danh sách kiểm duyệt nên lệch luật sẽ lộ ra khi kiểm.
- Đường admin tách khỏi đường chủ trọ: không truy vấn nào của `GET /me/statistics` bị bỏ lọc, nên không có đường nào để màn hình chủ trọ vô tình thành số của cả nền tảng.

**Negative / tradeoffs**:
- Khoảng mười lăm truy vấn mỗi lần gọi, không giao dịch, nên khi có ghi đang diễn ra hai nhóm có thể lệch nhau một dòng trong khoảnh khắc đó; trong một nhóm thì luôn khớp.
- Không có chỉ mục theo `created_at` của `users`, `messages`, `conversations`, `follows`, `favorites` nên các phép đếm theo khoảng quét bảng; phép đếm `public` chạy một phép đếm hạng cho mỗi tin (như `GET /listings`). Ổn ở demo, chỉ đo một lần ở cỡ 60 nghìn tin rồi giữ nguyên.
- Số của trạng thái hiện tại (tài khoản, nhóm chủ trọ, tin theo trạng thái, `public`, `toHandle`) không có kỳ trước, trái một nửa chữ của hàng 27 ("mỗi con số kèm số kỳ trước"), vì lịch sử trạng thái không được lưu; làm đúng cần một bảng chụp theo ngày chạy bằng việc nền, ngoài MVP (cùng quyết định của 0017).
- Hai màn hình dùng hai quy tắc đếm khác nhau cho cùng một chữ: màn hình chủ trọ đếm người theo dõi `active` và đánh giá `visible`, màn hình admin đếm mọi dòng. Cộng số của mọi chủ trọ sẽ không bằng số của admin; tài liệu FE phải nói rõ.
- Số "đăng ký mới" và "tin mới" đếm cả dòng sau đó bị xóa mềm, còn số hiện có thì không, nên hai thứ có thể không khớp với độ tăng của tổng. Lượt lưu và lượt theo dõi của kỳ cũ có thể giảm khi người dùng bỏ lưu hay bỏ theo dõi. Lượt xem chỉ có lịch sử từ spec 0016.
- `visibleButNotPublic` gộp ba lý do (chủ trọ bị khóa, hết dùng thử hay hết gói, vượt hạn mức); muốn tách phải làm thêm.
- `statistic:manage` trong token chủ trọ cũ bung ra cả `statistic:report`; chỉ `@FreshAuth()` chặn được. Ai bỏ nó đi sẽ mở số của cả nền tảng cho chủ trọ mang token cũ (cùng bẫy với `order:report` ở 0010).
- Ngày hôm nay được tính khi mới qua một phần, nên kỳ này nhìn có vẻ thấp hơn kỳ trước đã đủ ngày. Chuỗi đã điền đủ ngày nên dài tới 366 phần tử, mỗi phần tử 11 số.
- `createdByWard` không có kỳ trước và không cắt top; tối đa số phường có tin mới (khoảng 168 trong dữ liệu seed).

**Neutral**:
- Thêm vào `src/statistics/` một controller, một service, một repository, một khung `dailyCounts` và kiểu phản hồi; `statistic` trong danh mục quyền có thêm hành động `report` (`GET /permissions` đổi một dòng); mục mới trong `docs/api/api-for-frontend.md`.
- Không đổi hành vi của route nào đang có, không thêm việc nền hay bảng tổng hợp, không sửa gì trong `src/listings/`.
- Số `0018` không trùng spec nào.

## Follow-up

- [ ] Spec 0017: AC-15 và bảng quyền nói module `statistic` chỉ có `read` và không có hành động chỉ admin; nay có thêm `report`. `/architect` sửa khi tiện (không chặn build).
- [ ] Spec 0003: bảng quyền thêm dòng `statistic:report`; AC-8 liệt kê route bắt buộc `@FreshAuth()` cần thêm `GET /statistics/overview` (cùng việc còn treo của `GET /orders/all` và `GET /orders/revenue` ở 0010).
- [ ] Hoãn, thêm lại bằng `/scope` khi cần: xếp hạng chủ trọ hay tin nhiều lượt xem nhất cả nền tảng, số toàn thời gian cho từng số tương tác, tin theo phường ở trạng thái hiện có, kỳ trước cho từng phường, tách lý do của `visibleButNotPublic`, đếm tin bị chủ trọ ẩn thành việc cần xử lý, xuất CSV, bộ nhớ đệm, chỉ mục `created_at`, bảng chụp theo ngày để so sánh cả số trạng thái hiện tại.
- [ ] Hàng 28 (doanh thu theo chủ trọ) dùng lại `stat-period.ts`, `stat-metric.ts` và có thể dùng lại `dailyCounts`. Hai file trợ giúp vẫn nằm ở `src/statistics/` nên ghi chú "chuyển sang `src/common/`" của spec 0017 chỉ còn đúng nếu hàng 28 đặt code ngoài thư mục này.
- [ ] Sau khi build, `/sync`: thêm phần admin vào `src/statistics/AGENTS.md` (route, quy tắc đếm mọi dòng khác màn hình chủ trọ, `dailyCounts`, `@FreshAuth()` không được bỏ), và cập nhật ghi chú "hàng 27 và 28 dùng lại" trong đó.
- [ ] Trước khi chạy API mới trên database dev: không có migration. Nên chạy `npm run seed:demo -- --reset` để có số liệu xem thử.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
