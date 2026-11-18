# 0017. Thống kê cho chủ trọ

**Date**: 2026-11-16
**Status**: In Progress

## Summary

Chủ trọ mở một màn hình là thấy mọi con số của mình, do BE tính sẵn để FE chỉ hiển thị. Spec này thêm một API đọc duy nhất, `GET /me/statistics`: tin theo trạng thái, lượt xem và top tin, mức quan tâm (lưu, theo dõi), điểm đánh giá, chat, gói và tiền đã chi. Mỗi con số theo khoảng ngày giờ Việt Nam đi kèm số của kỳ liền trước và phần trăm đổi, kèm chuỗi theo ngày để vẽ biểu đồ. Các con số của trạng thái hiện tại (tin theo trạng thái, hạn mức, điểm đánh giá) chỉ có giá trị hiện giờ, vì lịch sử trạng thái không được lưu. Không có bảng hay cột mới: mọi số tính lúc đọc từ các bảng sẵn có, và chỉ có một migration nhỏ cấp quyền `statistic:read` cho chủ trọ.

## Requirements

**User stories**:
- Là chủ trọ, tôi muốn mở một màn hình là thấy tin của mình đang ở trạng thái nào, được xem và quan tâm bao nhiêu, chat ra sao, đã chi bao nhiêu, để biết nên làm gì tiếp.
- Là chủ trọ, tôi muốn mỗi con số của kỳ này đi kèm kỳ trước và phần trăm đổi, để thấy mình đang tốt lên hay xấu đi.
- Là người làm FE, tôi muốn BE trả sẵn mọi con số, mọi phần trăm và chuỗi theo ngày đã điền đủ ngày, để FE chỉ hiển thị, không tự tính.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `GET /api/v1/me/statistics` trả 200 một object có đúng chín khóa: `period`, `listings`, `membership`, `views`, `interest`, `ratings`, `chat`, `spending`, `series`; hình dạng từng khối như ở mục Feature design, không có trường nào ngoài danh sách. Route chỉ đọc: không ghi bảng nào, không khóa dòng, không đổi `updated_at` của ai. Phản hồi 200 có `Cache-Control: private, no-store`. Dùng nhóm giới hạn tần suất `publicRead` đã có, không nhóm mới và không mã lỗi mới.
- **AC-2**: Khoảng ngày. `from` và `to` tùy chọn, dạng `YYYY-MM-DD`, là ngày có thật trên lịch, năm từ 2000 đến 2100 (cùng validator của spec 0010). Không gửi `to` thì `to` là ngày hôm nay giờ Việt Nam của `now`; không gửi `from` thì `from` là `to` lùi 29 ngày; không gửi gì cả là 30 ngày kết thúc hôm nay. `days` là số ngày lịch từ `from` đến `to` kể cả hai đầu, từ 1 đến 366. `from` sau `to` hoặc `days` lớn hơn 366 bị 400 `VALIDATION_FAILED` ở trường `to`; sai dạng, ngày không có thật hay ngoài khoảng năm bị 400 ở đúng trường đó; tham số lạ (ví dụ `groupBy`, `sort`) bị 400. `period` trả `{ from, to, days, previousFrom, previousTo, timeZone }`, `from` và `to` là hai ngày đã chốt (kể cả khi lấy mặc định), không bao giờ `null`, `timeZone` luôn là `Asia/Ho_Chi_Minh`. Ngày hôm nay được tính cả ngày dù mới qua một phần.
- **AC-3**: Kỳ trước và phần trăm đổi. Kỳ trước là `days` ngày liền sát trước `from`: `previousTo` là `from` lùi 1 ngày, `previousFrom` là `previousTo` lùi `days − 1` ngày (cùng độ dài, không chồng, không hở). Mọi con số theo kỳ có dạng `{ value, previous, changePercent }`. `changePercent` là `(value − previous) / previous × 100` làm tròn một chữ số thập phân, nửa làm tròn ra xa số 0, tính bằng số nguyên (`dấu × floor((2000 × |value − previous| + previous) / (2 × previous)) / 10`, dấu theo `value − previous`): 5 so với 3 ra `66.7`, 3 so với 5 ra `-40`, hai số bằng nhau ra `0` (không phải `-0`). `previous` bằng 0 thì `changePercent` là `null`, dù `value` bằng 0 hay lớn hơn 0; không bao giờ chia cho 0, `Infinity` hay `NaN`. Chỉ con số theo kỳ mới có kỳ trước; số của trạng thái hiện tại (khối `listings`, `membership`, các số `allTime` và `total`, điểm trung bình, số chưa đọc) là số thường, không có `previous`.
- **AC-4**: Tin theo trạng thái. `listings` là `{ total, public, hiddenByQuota, hiddenByOwner, hiddenByAdmin }`, đếm tin chưa xóa mềm của mọi nhà trọ của chủ trọ; tin đã xóa mềm không tính vào đâu. `hiddenByOwner` và `hiddenByAdmin` đếm tin có `status` tương ứng. Tin `visible` được chia thành `public` và `hiddenByQuota`: `hiddenByQuota = max(0, visible − hạn mức)`, `public = visible − hiddenByQuota`, với hạn mức hiện hành của spec 0003 và 0004 (kỳ gói đang chạy, không thì dùng thử còn hạn, không thì 0). Hết dùng thử mà không có gói thì hạn mức là 0 và mọi tin `visible` là `hiddenByQuota`. `total` luôn bằng tổng bốn số kia. Với chủ trọ còn `active`, `public` bằng `publicListingCount` của `GET /landlords/:id` và bằng số tin của chủ trọ đó mà `GET /listings` trả.
- **AC-5**: `membership` có đúng các trường và nghĩa của thân `GET /me/membership` (spec 0003 AC-10, spec 0004 AC-10) tại cùng thời điểm. `membership.visibleCount` bằng `listings.public + listings.hiddenByQuota`, `membership.overLimitCount` bằng `listings.hiddenByQuota`, `membership.listingLimit` là hạn mức đã dùng ở AC-4.
- **AC-6**: Lượt xem. `views.inRange` là `{ value, previous, changePercent }`, với `value` là tổng `views` của bảng `listing_daily_views` cho mọi tin của chủ trọ (kể cả tin đang ẩn và đã xóa mềm) có `day` trong `[from, to]`, và `previous` cùng cách cho `[previousFrom, previousTo]`. `views.allTime` là tổng `listings.view_count` của mọi tin của chủ trọ kể cả tin ẩn và xóa mềm, bằng `totalViewCount` của `GET /landlords/:id`. Lượt xem trước khi có bảng theo ngày (spec 0016) chỉ nằm trong `allTime`, không có trong `inRange`.
- **AC-7**: Top tin. `views.top` có tối đa 5 phần tử `{ id, code, title, status, isPublic, viewsInRange, viewsAllTime }`. Đó là các tin chưa xóa mềm của chủ trọ có tổng `views` trong `[from, to]` lớn hơn 0, sắp `viewsInRange` giảm dần, rồi `created_at` của tin giảm dần, rồi `id` giảm dần. `code` là mã ngắn của tin, `status` là cột `status` của tin (`visible`, `hidden_by_owner`, `hidden_by_admin`), `viewsAllTime` là `view_count`, `isPublic` cùng nghĩa với cờ `isPublic` của `GET /me/listings` (tin `visible` và hạng đăng sớm nằm trong hạn mức). Không có tin nào có lượt trong khoảng thì `top` là `[]`. Tin đã xóa mềm không bao giờ có mặt (lượt của nó vẫn nằm trong `views.inRange`).
- **AC-8**: Mức quan tâm. `interest.newFavorites` và `interest.newFollowers` là Metric (dạng ở AC-3): số dòng `favorites` trên mọi tin của chủ trọ (mọi trạng thái, kể cả xóa mềm) và số dòng `follows` của chủ trọ (chỉ người theo dõi là tài khoản `active` chưa xóa mềm, luật của spec 0005) có `created_at` trong khoảng. `interest.totalFavorites` và `interest.totalFollowers` đếm cùng điều kiện nhưng không có khoảng ngày; `totalFollowers` bằng `followerCount` của `GET /landlords/:id`. Chỉ đếm dòng đang tồn tại: bỏ lưu hay bỏ theo dõi xóa dòng, nên số của một kỳ cũ có thể giảm về sau.
- **AC-9**: Đánh giá. `ratings.landlord` và `ratings.rooms` đều có dạng `{ average, count, newInRange }`. `count` và `average` tính trên các đánh giá `visible` có người viết là tài khoản `active` chưa xóa mềm (đúng luật danh sách công khai của spec 0014 và 0015). `average` là số sao trung bình một chữ số thập phân tính bằng số nguyên như `averageStars` (`null` khi `count` bằng 0). `newInRange` là Metric đếm các đánh giá đó có `created_at` trong khoảng. `landlord` đọc bảng `reviews` của chủ trọ, nên `count` và `average` bằng `reviewCount` và `ratingAverage` của `GET /landlords/:id`. `rooms` đọc `listing_reviews` của mọi tin chưa xóa mềm của chủ trọ (kể cả tin đang ẩn), mỗi đánh giá một phiếu (không phải trung bình các trung bình của từng tin), và không cộng vào `landlord`.
- **AC-10**: Chat. Xét các cuộc trò chuyện có `landlord_id` là chủ trọ. `chat.conversationsOpened` là Metric theo `created_at` của cuộc trò chuyện. `chat.repliedConversations` là Metric cũng theo `created_at` của cuộc trò chuyện, chỉ tính cuộc mà chủ trọ đã gửi ít nhất một tin (vào bất kỳ lúc nào cho đến lúc đọc). `chat.replyRate` là `{ value, previous, changePoints }`: `value` và `previous` là `repliedConversations ÷ conversationsOpened × 100` của từng kỳ, một chữ số thập phân, nửa làm tròn lên, tính bằng số nguyên, và `null` khi kỳ đó không mở cuộc nào; `changePoints` là hiệu `value − previous` một chữ số thập phân (điểm phần trăm) và `null` khi một trong hai là `null`. `chat.totalConversations` đếm mọi cuộc của chủ trọ; `chat.unreadConversations` và `chat.unreadMessages` chỉ tính các cuộc mà chủ trọ là `landlord_id` (`last_seq − landlord_read_seq`), nên bằng hai số của `GET /me/conversations/unread-count` tại cùng thời điểm khi chủ trọ không có cuộc nào ở vai người nhắn, là trường hợp mặc định vì `landlord` không giữ `conversation:create` (spec 0013).
- **AC-11**: Gói và tiền đã chi. `spending.spent` là Metric tổng `orders.price` (giá đã chốt trên đơn, số nguyên đồng) và `spending.paidOrders` là Metric số đơn, chỉ gồm đơn `paid` của chủ trọ có `paid_at` trong khoảng (ngày giờ Việt Nam). `spending.spentAllTime` là tổng `price` của mọi đơn `paid` của chủ trọ. Đơn `pending` và `cancelled` không bao giờ tính. Gói đã hết hạn vẫn tính phần tiền đã chi. Tổng vượt 2,1 tỷ đồng vẫn đúng (không ép về `int4`). Tiền ở đây là thanh toán thử.
- **AC-12**: Chuỗi theo ngày. `series` có đúng `days` phần tử, mỗi ngày từ `from` đến `to` một phần tử, sắp ngày tăng dần, mỗi phần tử `{ date, views, newFavorites, newFollowers, newConversations }`; ngày không có gì thì mọi số bằng 0 (FE không phải điền ô trống). Tổng từng cột bằng `value` của Metric tương ứng: `views` với `views.inRange`, `newFavorites` với `interest.newFavorites`, `newFollowers` với `interest.newFollowers`, `newConversations` với `chat.conversationsOpened`; kỳ trước của mỗi Metric lấy từ cùng truy vấn nên theo cùng quy tắc. Khoảng 1 ngày ra 1 phần tử, khoảng 366 ngày ra 366 phần tử.
- **AC-13**: Ranh giới ngày giờ Việt Nam. Mọi "ngày" (lọc, kỳ trước, gom chuỗi) là ngày lịch giờ Việt Nam lấy từ `APP_TIME_ZONE`. Một lượt lưu tạo lúc `2026-10-31T16:59:59.999Z` (23:59:59.999 ngày 31/10 giờ Việt Nam) thuộc ngày `2026-10-31`; tạo lúc `2026-10-31T17:00:00.000Z` thuộc ngày `2026-11-01`. Kết quả giống nhau khi múi giờ phiên của database là `UTC`, `Asia/Ho_Chi_Minh` hay `America/Los_Angeles`. `listing_daily_views.day` đã là ngày giờ Việt Nam nên so thẳng.
- **AC-14**: Phạm vi dữ liệu và riêng tư. Chỉ dữ liệu của chính người gọi: mọi truy vấn lọc theo `sub` của token, không tham số nào mang id chủ trọ. Dòng của chủ trọ khác (tin, lưu, theo dõi, đánh giá, chat, đơn) không bao giờ vào bất kỳ con số nào. Phản hồi chỉ có số đếm cùng id, mã, tiêu đề và trạng thái của tin của chính chủ trọ; không có id, email, số điện thoại hay tên của bất kỳ người dùng nào khác (người lưu, người theo dõi, người đánh giá, người nhắn). Chủ trọ mới chưa có gì nhận 200 với mọi số bằng 0, `average`, `changePercent` và `replyRate` là `null` khi chưa tính được, `top` là `[]` và `series` đủ ngày toàn số 0.
- **AC-15**: Phân quyền. Không đăng nhập: 401 `TOKEN_MISSING`. `tenant`: 403 `PERMISSION_DENIED`, kể cả khi gửi tham số sai (quyền kiểm trước tham số). Admin giữ `statistic:read` trong code nên qua được guard; Service từ chối mọi tài khoản không phải `landlord` bằng 403 `PERMISSION_DENIED` trước khi đọc bất kỳ bảng dữ liệu nào, kể cả tenant được admin cấp quyền này. Thứ tự kiểm: 401, 403 theo quyền, 400 theo tham số, 403 theo loại tài khoản. Chủ trọ bị khóa mang token còn hạn vẫn đọc được số của chính mình (route không dùng `@FreshAuth`). Danh mục quyền có module `statistic` với hành động `read` (thuộc về chủ sở hữu, không có hành động chỉ admin) nên `GET /permissions` liệt kê nó; một migration thêm `statistic:read` vào quyền mặc định của `landlord` (không thêm cho `tenant`), chạy lại không thêm trùng; `PATCH /account-types/tenant` vẫn cấp được khóa này (nó không chỉ dành cho admin) nhưng Service vẫn từ chối. Token chủ trọ cấp trước migration chưa có khóa này nhận 403 cho đến lần refresh kế. Các route đã có (kể cả `GET /me/membership`, `GET /me/listings`, `GET /landlords/:id`, `GET /me/conversations/unread-count`) giữ nguyên hành vi.

## Decision

**Chosen option**: Option 1: Một route `GET /me/statistics` tính lúc đọc từ các bảng sẵn có, qua một `StatisticsRepository` chỉ đọc

Một lần gọi trả mọi nhóm số của chủ trọ trong một khoảng ngày giờ Việt Nam, kèm kỳ liền trước, phần trăm đổi và chuỗi theo ngày đã điền đủ. Số theo kỳ có so sánh; số trạng thái hiện tại thì không, vì lịch sử trạng thái không được lưu. Không bảng, không cột, không chỉ mục mới; một migration dữ liệu thêm quyền `statistic:read` cho `landlord`. Module mới `src/statistics/` chỉ đọc, không ghi bảng nào.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`)

## Feature design

Quy ước chung theo 0001 đến 0016: id `uuidv7()`, `timestamptz`, tiền là số nguyên đồng, `snake_case` ở DB, tiền tố `/api/v1`, mã lỗi trong `ErrorCode`, một đồng hồ `now` cho mỗi request. Ngoại lệ có chủ ý: `StatisticsRepository` đọc nhiều bảng của module khác (xem Rationale); nó không bao giờ ghi, và các Repository chủ vẫn là nơi duy nhất ghi bảng của mình.

**Data model**: không bảng mới, không cột mới, không chỉ mục mới; `schema.prisma` không đổi. Mọi số đọc từ bảng có sẵn, cho một chủ trọ (người trong token). Mô hình nguồn đã được bạn xác nhận:

| Khối | Nguồn |
|---|---|
| `listings` | `listings` chưa xóa mềm qua `properties.landlord_id`, đếm theo `status`; `hiddenByQuota` suy từ hạn mức hiện hành |
| `membership` | `MembershipsService` (`resolve`, kỳ gói, `trial_ends_at`) và `SubscriptionsRepository.findLatestEndsAt` |
| `views` | `listing_daily_views(listing_id, day, views)` cho mọi tin của chủ trọ; `listings.view_count` cho `allTime` và `top` |
| `interest` | `favorites.created_at` trên mọi tin của chủ trọ; `follows.created_at` cho người theo dõi `active` |
| `ratings` | `reviews(landlord_id, stars, status)` và `listing_reviews` qua các tin chưa xóa mềm, cùng luật `visible` và người viết `active` |
| `chat` | `conversations(landlord_id, created_at, last_seq, landlord_read_seq)` và `messages(sender_id)` |
| `spending` | `orders(user_id, status, price, paid_at)` |

Chỉ mục đã có phủ gần hết các truy vấn: `listing_daily_views` theo khóa chính (`listing_id`, `day`), `follows(landlord_id)`, `reviews(landlord_id, created_at)`, `listing_reviews(listing_id, created_at)`, `conversations(landlord_id, last_message_at)`, `orders(user_id, created_at)`. Riêng `favorites` không có chỉ mục theo `listing_id` nên phép đếm lưu quét bảng; đã chốt không thêm chỉ mục, chỉ đo một lần (xem Consequences).

**State transitions**: không có. Route chỉ đọc.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/me/statistics` | GET | query tùy chọn: `from`, `to` (`YYYY-MM-DD`) | 200 `{ period, listings, membership, views, interest, ratings, chat, spending, series }` | `statistic:read` và loại tài khoản `landlord` | 400 `VALIDATION_FAILED`, 401 `TOKEN_MISSING`, 401 `TOKEN_INVALID`, 401 `TOKEN_EXPIRED`, 403 `PERMISSION_DENIED`, 429 `RATE_LIMITED` |

Phản hồi mẫu (rút gọn `series` còn hai phần tử):

```json
{
  "period": { "from": "2026-10-18", "to": "2026-11-16", "days": 30, "previousFrom": "2026-09-18", "previousTo": "2026-10-17", "timeZone": "Asia/Ho_Chi_Minh" },
  "listings": { "total": 5, "public": 2, "hiddenByQuota": 1, "hiddenByOwner": 1, "hiddenByAdmin": 1 },
  "membership": { "state": "trial", "trialEndsAt": "2026-12-01T03:00:00.000Z", "trialDaysLeft": 15, "subscription": null, "listingLimit": 2, "visibleCount": 3, "remaining": 0, "overLimitCount": 1 },
  "views": {
    "inRange": { "value": 128, "previous": 96, "changePercent": 33.3 },
    "allTime": 1450,
    "top": [
      { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d11", "code": "k7m2xq9p", "title": "Phòng trọ gần ĐH Bách Khoa", "status": "visible", "isPublic": true, "viewsInRange": 70, "viewsAllTime": 640 }
    ]
  },
  "interest": {
    "newFavorites": { "value": 9, "previous": 6, "changePercent": 50 },
    "newFollowers": { "value": 4, "previous": 4, "changePercent": 0 },
    "totalFavorites": 31,
    "totalFollowers": 17
  },
  "ratings": {
    "landlord": { "average": 4.6, "count": 12, "newInRange": { "value": 3, "previous": 0, "changePercent": null } },
    "rooms": { "average": 4.2, "count": 20, "newInRange": { "value": 5, "previous": 4, "changePercent": 25 } }
  },
  "chat": {
    "conversationsOpened": { "value": 8, "previous": 5, "changePercent": 60 },
    "repliedConversations": { "value": 6, "previous": 4, "changePercent": 50 },
    "replyRate": { "value": 75, "previous": 80, "changePoints": -5 },
    "totalConversations": 41,
    "unreadConversations": 2,
    "unreadMessages": 5
  },
  "spending": {
    "spent": { "value": 199000, "previous": 0, "changePercent": null },
    "paidOrders": { "value": 1, "previous": 0, "changePercent": null },
    "spentAllTime": 398000
  },
  "series": [
    { "date": "2026-10-18", "views": 3, "newFavorites": 0, "newFollowers": 1, "newConversations": 0 },
    { "date": "2026-10-19", "views": 0, "newFavorites": 0, "newFollowers": 0, "newConversations": 0 }
  ]
}
```

`membership` trả đúng hình dạng của `GET /me/membership` (hai ví dụ `state` khác: `plan` có `subscription`, `expired` có `listingLimit` 0). Không có mã lỗi mới: dùng `VALIDATION_FAILED`, `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `PERMISSION_DENIED`, `RATE_LIMITED` đã có.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi**: token (401) → quyền `statistic:read` (403) → tham số (400, pipe) → loại tài khoản `landlord` (403, Service, trước mọi lần đọc dữ liệu). Admin gửi tham số sai nhận 400, giống cách favorites và chat làm.
- **Quyền**: thêm module `statistic` vào `PERMISSION_CATALOG` với `actions: ['read']`, `ownerScoped: true`, `adminActions: []`. Token của chủ trọ mang `statistic:manage` (một hành động, nên `compressPermissions` gộp thành `manage`). Controller dùng `@RequirePermissions('statistic:read')`, không `@FreshAuth()` (dữ liệu của chính người gọi, như `GET /me/membership`).
- **Tham số**: `StatisticsQueryDto` chỉ kiểm từng trường (`from`, `to` tùy chọn, `@IsCalendarDate()` của 0010). Việc điền mặc định, kiểm `from` không sau `to` và `days` không quá 366 nằm ở hàm thuần `resolveStatPeriod(query, now)` trong `src/statistics/stat-period.ts` (vì mặc định cần `now`); lỗi ném `AppException(ErrorCode.VALIDATION_FAILED, [{ field: 'to', message }])`. Ngày kế và độ dài dùng `startOfDay`, `startOfNextDay` của `src/common/time/app-time-zone.ts`; hàm cũng trả `previousFrom`, `previousTo`, danh sách `days` ngày của chuỗi.
- **Metric**: `src/statistics/stat-metric.ts` có `toMetric(value, previous)`, `percentChange(value, previous)` và `ratePercent(part, whole)`, toàn bằng số nguyên (công thức ở AC-3 và AC-10), kèm test đơn vị. Hai file `stat-period.ts` và `stat-metric.ts` viết để hàng 27 và 28 dùng lại.
- **Cách truy vấn** (gợi ý; `/develop` được chia khác miễn các bất biến giữ): Service dựng hạn mức trước (`MembershipsService.resolve`, đọc ngắn), rồi chạy các truy vấn của `StatisticsRepository` song song bằng `Promise.all`. Mỗi truy vấn theo kỳ phủ `[previousFrom, to]` và trả các dòng theo ngày giờ Việt Nam (`(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`, múi giờ là tham số ràng buộc, cận ngày là chuỗi ISO có `Z`); Service tách dòng theo `from`, cộng ra `value` và `previous`, rồi điền ngày trống cho `series`. Nhờ đó tổng của chuỗi và `value` đến từ cùng các dòng. Các truy vấn: đếm tin theo trạng thái cùng tổng `view_count` (một câu); lượt xem theo ngày; top tin (kèm hạng so với hạn mức để ra `isPublic`); lưu theo ngày cùng tổng; theo dõi theo ngày cùng tổng; đánh giá chủ trọ theo ngày cùng tổng và tổng sao; đánh giá phòng như vậy; chat (mở theo ngày, đã trả lời theo ngày, tổng, chưa đọc); đơn đã trả theo ngày cùng tổng. Tổng tiền là `SUM(price)::bigint` đổi sang `number` bằng `Number()`.
- **`isPublic` của top**: tính trong SQL của truy vấn top: `status = 'visible'` và số tin `visible` chưa xóa của cùng chủ trọ có `(created_at, id)` nhỏ hơn thì nhỏ hơn hạn mức (cùng luật hạng của `publicListingCondition`).
- **Số chưa đọc**: cùng công thức của `ChatRepository.countUnread` ở phía chủ trọ (`last_seq − landlord_read_seq` của các cuộc có `landlord_id` là chủ trọ).
- **Không cache, giới hạn tần suất**: `@Header('Cache-Control', 'private, no-store')` và `@RateLimited('publicRead')` (300 mỗi phút theo IP, mỗi route đếm riêng), như `GET /me/favorites`.
- **Định tuyến**: `GET /me/statistics` không đụng route nào đang có (`me/membership`, `me/favorites`, `me/listings`, `me/profile`, `me/conversations` đều là controller riêng, không có route `me/:id`).

**Value sourcing** (mọi giá trị route tạo ra hoặc hiển thị đều có nguồn):

| Giá trị | Nguồn |
|---|---|
| Người gọi, phạm vi dữ liệu | `sub` của access token; không có tham số nào mang id chủ trọ |
| Có phải chủ trọ | `accountType` của token (Service) cộng quyền `statistic:read` trong token (guard) |
| `period.from`, `period.to` | query, hoặc mặc định: `to` là ngày giờ Việt Nam của `now`, `from` là `to` lùi 29 ngày |
| `now` | đồng hồ ứng dụng, lấy một lần mỗi request |
| `period.days`, `previousFrom`, `previousTo` | suy từ `from` và `to` (`days` kể cả hai đầu; kỳ trước liền sát trước `from`, cùng độ dài) |
| Ranh giới một ngày | `APP_TIME_ZONE`, `startOfDay`, `startOfNextDay`, `toSqlTimestamp` |
| `listings.*` | `listings` chưa xóa mềm của chủ trọ nhóm theo `status`; `hiddenByQuota = max(0, visible − listingLimit)` |
| `membership.*`, `listingLimit` | `MembershipsService.resolve` cộng `findLatestEndsAt`, đổi bằng `toMembershipResponse`; `visibleCount` lấy từ cùng phép đếm với `listings` |
| `views.inRange` | `listing_daily_views.views` của mọi tin của chủ trọ có `day` trong khoảng |
| `views.allTime` | tổng `listings.view_count` của mọi tin của chủ trọ kể cả xóa mềm |
| `views.top[]` | tin chưa xóa mềm có tổng `views` trong khoảng lớn hơn 0; `code`, `title`, `status`, `view_count` là cột của `listings`; `isPublic` từ `status` và hạng so với `listingLimit` |
| `interest.newFavorites`, `totalFavorites` | `favorites` nối `listings` của chủ trọ; `created_at` đổi sang ngày giờ Việt Nam |
| `interest.newFollowers`, `totalFollowers` | `follows.landlord_id` là chủ trọ, người theo dõi `status = 'active'` và `deleted_at IS NULL` |
| `ratings.landlord.*` | `reviews` của chủ trọ, `status = 'visible'`, người viết `active` chưa xóa mềm; `average` bằng `averageStars(count, tổng sao)` |
| `ratings.rooms.*` | `listing_reviews` qua tin chưa xóa mềm của chủ trọ, cùng luật |
| `chat.conversationsOpened`, `repliedConversations` | `conversations.landlord_id` là chủ trọ theo `created_at`; đã trả lời nếu có dòng `messages` có `sender_id` bằng `landlord_id` của cuộc đó |
| `chat.replyRate` | `ratePercent(replied, opened)` mỗi kỳ; `changePoints` là hiệu hai số đã làm tròn |
| `chat.totalConversations`, `unread*` | `conversations` của chủ trọ; chưa đọc là `last_seq − landlord_read_seq` |
| `spending.*` | `orders.user_id` là chủ trọ, `status = 'paid'`; `price` đã chốt trên đơn, kỳ theo `paid_at` |
| `changePercent` | `percentChange(value, previous)`, `null` khi `previous` bằng 0 |
| `series[]` | cùng các dòng theo ngày của bốn nguồn trên, điền ngày trống bằng 0 |
| Header `Cache-Control` | hằng `private, no-store` |

**Key invariants**:
- Route chỉ đọc: không ghi, không khóa dòng, không đổi `updated_at`.
- Mọi truy vấn lọc theo `sub` của token; không đường nào để một chủ trọ thấy số của người khác.
- Trong một nhóm các phần luôn cộng lại: `listings.total` bằng tổng bốn bucket; `listings.public + hiddenByQuota` bằng `membership.visibleCount`; tổng mỗi cột của `series` bằng `value` của Metric tương ứng.
- Một "ngày" ở mọi nơi là ngày lịch giờ Việt Nam, từ một định nghĩa duy nhất.
- Phần trăm và tỉ lệ tính bằng số nguyên, không bao giờ chia cho 0; tiền không bao giờ ép về `int4`.
- Số công khai khớp số công khai: `public`, `allTime` của lượt xem, `totalFollowers`, `ratings.landlord` bằng các trường tương ứng của `GET /landlords/:id`; số chưa đọc bằng `GET /me/conversations/unread-count`.
- Phản hồi chỉ chứa số đếm và thông tin tin của chính chủ trọ; không có danh tính của người dùng khác.

**Security model**:
- Cần quyền `statistic:read` (mặc định chỉ `landlord` giữ, admin giữ qua code) và loại tài khoản `landlord`: tenant không có quyền, admin và tenant được cấp quyền bị Service từ chối. Chủ trọ chỉ thấy dữ liệu của chính mình, lấy theo `sub` của token.
- Không dùng `@FreshAuth()`: dữ liệu là của chính người gọi và đã lộ ở các route `/me/*` khác; chủ trọ vừa bị khóa với token còn hạn xem được số của mình đến khi token hết hạn.
- Dữ liệu cá nhân: không có. Phản hồi không chứa id, email, số điện thoại hay tên của người dùng khác; chỉ có số đếm và tin của chính chủ trọ. Dự án chưa khai phạm vi tuân thủ riêng. Tiền ở `spending` là thanh toán thử (spec 0004).

**Configuration required**: không có biến môi trường, dịch vụ ngoài hay seed mới. Một migration dữ liệu thêm khóa quyền (cùng kiểu migration của chat và đánh giá). Cần Postgres biết múi giờ `Asia/Ho_Chi_Minh` (đã dùng từ spec 0010).

**Critical test scenarios** (mỗi dòng ứng với một hay nhiều AC):
- Happy path: dựng bằng tay một chủ trọ có tin ở cả bốn trạng thái (một tin xóa mềm), lượt xem theo ngày, lưu, theo dõi (một người bị khóa), đánh giá chủ trọ và phòng (một đánh giá ẩn, một người viết bị khóa), chat có và chưa trả lời, đơn `paid`, `pending`, `cancelled`; mọi con số trong phản hồi khớp một phép đếm độc lập tính bằng JavaScript từ dòng thô, verifies **AC-1**, **AC-4**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**, **AC-11**
- Happy path: cùng dữ liệu với gói hết hạn, rồi với dùng thử còn hạn, rồi với gói đang chạy: `hiddenByQuota`, `public`, `membership` đổi đúng; hết dùng thử và không gói thì mọi tin `visible` là `hiddenByQuota`; so với `GET /me/membership`, `GET /landlords/:id` và `GET /listings` cho cùng chủ trọ, verifies **AC-4**, **AC-5**
- Happy path: so với các route công khai: `followerCount`, `totalViewCount`, `reviewCount`, `ratingAverage`, `publicListingCount` của `GET /landlords/:id` và hai số của `GET /me/conversations/unread-count` bằng các trường tương ứng, verifies **AC-4**, **AC-6**, **AC-8**, **AC-9**, **AC-10**
- Happy path: `changePercent` ở các cặp (5, 3), (3, 5), (4, 4), (0, 0), (7, 0), (1, 3), một cặp có nửa làm tròn ra xa số 0 cả hai dấu; `replyRate` với 0 cuộc, 1 trên 3, 2 trên 3; `changePoints` có `null`, verifies **AC-3**, **AC-10**
- Happy path: mặc định 30 ngày, chỉ `from`, chỉ `to`, 1 ngày, đúng 366 ngày; `period` đúng; `series` đủ `days` phần tử, tổng từng cột bằng Metric tương ứng và kỳ trước đúng cả khi kỳ trước chạm tháng 2 năm nhuận, verifies **AC-2**, **AC-3**, **AC-12**
- Failure case: `from` sau `to`, 367 ngày, `from=2026-02-30`, `from=1999-12-31`, `to=21/10/2026`, `groupBy=day`, `sort=asc` đều bị 400 `VALIDATION_FAILED` đúng trường, không đọc bảng dữ liệu nào, verifies **AC-2**
- Failure case: ranh giới ngày ở đúng mili giây cho lưu, theo dõi, chat, đánh giá và đơn (`16:59:59.999Z` và `17:00:00.000Z`), chạy lại với múi giờ phiên `UTC` và `America/Los_Angeles` ra cùng kết quả; lượt xem theo ngày ghi tay ở hai ngày sát ranh, verifies **AC-13**, **AC-6**
- Failure case: tổng tiền 30 đơn giá 100.000.000 đồng ra 3.000.000.000, không tràn, verifies **AC-11**
- Failure case: chủ trọ mới chưa có gì: mọi số 0, `average` và `replyRate` là `null`, `top` rỗng, `series` toàn 0; chủ trọ khác có dữ liệu không làm đổi số nào của chủ trọ này; phản hồi không chứa email, số điện thoại, tên hay id của người dùng khác ở bất kỳ chỗ nào, verifies **AC-14**
- Auth/permission: khách 401; tenant 403 (cả khi gửi tham số sai); admin 403 và tenant được cấp `statistic:read` qua `PATCH /account-types/tenant` vẫn 403, cả hai không đọc bảng dữ liệu nào (đo bằng bộ đếm đọc của PostgreSQL); admin gửi tham số sai nhận 400; chủ trọ 200 với `Cache-Control: private, no-store`; chủ trọ bị khóa mang token còn hạn vẫn 200; token cấp trước migration 403 rồi 200 sau refresh; `GET /permissions` có `statistic`; migration chạy hai lần không thêm trùng và không đụng `tenant`, verifies **AC-15**
- Happy path: lần gọi `GET /me/statistics` không đổi một dòng nào của mọi bảng (so ảnh chụp trước và sau); các route đã có giữ nguyên, verifies **AC-1**, **AC-15**
- Điều khiển âm (bước kiểm thật, không phải test tự động): bỏ vế `status = 'paid'` của chi tiêu, đổi cận trên của một ngày từ `<` thành `<=`, thay múi giờ bằng `UTC` khi gom ngày, bỏ điều kiện người theo dõi `active`, tính tin xóa mềm vào `total`, bỏ lọc theo `sub` ở một truy vấn, bỏ điều kiện `status = 'visible'` của đánh giá, tính mọi tin nhắn (không riêng của chủ trọ) là đã trả lời, ép `SUM` về `int4`, bỏ kiểm loại tài khoản trong Service; mỗi thay đổi phải bị đúng kiểm tra tương ứng bắt, verifies **AC-4** đến **AC-15**
- Kiểm bằng `EXPLAIN` (không phải test tự động): dữ liệu cỡ demo (khoảng 60 nghìn tin trên database thử, nhiều lượt lưu) đo từng truy vấn và cả route một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-1**

## Build plan

Theo Skateboard (làm bản mỏng nhất dùng được trước, rồi mới mở rộng): Mốc 1 cho chủ trọ một màn hình dùng được ngay với các số quan trọng nhất (tin, hạn mức, lượt xem, top tin, chuỗi lượt xem), Mốc 2 thêm quan tâm, đánh giá, chat, chi tiêu và ba cột còn lại của chuỗi. Mỗi mốc là một lần `/develop` rồi dừng cho bạn review. Quy tắc tài liệu sống: cập nhật `docs/api/api-for-frontend.md` trong từng mốc (bạn đã bỏ bộ Postman ngày 2026-11-16).

**Mốc 1: đường chạy thông và số liệu cốt lõi**
1. Quyền: thêm module `statistic` (`read`, `ownerScoped: true`, không hành động chỉ admin) vào `PERMISSION_CATALOG`, migration dữ liệu thêm `statistic:read` vào quyền mặc định của `landlord` (cùng mẫu `UPDATE ... || ARRAY(... WHERE k <> ALL(...))` của migration chat), sửa `permission-catalog.spec.ts` và các test dựa vào danh sách quyền, satisfies **AC-15**.
2. Khoảng ngày và Metric: `StatisticsQueryDto`, `src/statistics/stat-period.ts` (`resolveStatPeriod`, kỳ trước, danh sách ngày) và `src/statistics/stat-metric.ts` (`toMetric`, `percentChange`, `ratePercent`) kèm test đơn vị cho từng cặp số ở Critical test scenarios và các biên của khoảng (1 ngày, 366 ngày, 367 ngày, `from` sau `to`, tháng 2 năm nhuận), satisfies **AC-2**, **AC-3**, **AC-13**.
3. Module `src/statistics/`: `StatisticsRepository` (đếm tin theo trạng thái cùng tổng `view_count`, lượt xem theo ngày, top tin có `isPublic`), `StatisticsService` (kiểm loại tài khoản trước mọi lần đọc, hạn mức từ `MembershipsService`, khối `membership` bằng `toMembershipResponse`, buckets, `views`, `top`, `series` với cột `views`), `StatisticsController` (`GET /me/statistics` với `@RequirePermissions('statistic:read')`, `@RateLimited('publicRead')`, `@Header`), nối vào `AppModule`; các khối chưa làm ở mốc này không có mặt trong phản hồi, kèm test đơn vị cho Repository (hình dạng SQL, tham số ISO có `Z`), Service (buckets cộng đúng, kỳ trước, hạn mức 0) và Controller (khai báo route, thứ tự lỗi), satisfies **AC-1**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-12** (cột `views`), **AC-14**, **AC-15**.
4. Kiểm thật trên database thử: dựng dữ liệu tay, oracle độc lập từ dòng thô cho tin, hạn mức, lượt xem và top, so với `GET /me/membership`, `GET /landlords/:id` và `GET /listings`, ranh giới ngày với ba múi giờ phiên, token chủ trọ cấp trước migration, các điều khiển âm của mốc này, `verify.md`; tài liệu: `api-for-frontend.md` thêm mục "Thống kê cho chủ trọ" (ghi rõ lượt xem theo ngày chỉ từ lúc có bảng, số trạng thái không có kỳ trước, và khối chưa có ở mốc 1), thêm khóa quyền vào bảng quyền và nhật ký, satisfies **AC-1** đến **AC-7**, **AC-13** đến **AC-15**.

**Mốc 2: quan tâm, đánh giá, chat, chi tiêu**
5. Quan tâm: truy vấn lưu và theo dõi theo ngày cùng tổng, khối `interest`, cột `newFavorites` và `newFollowers` của `series`, kèm test đơn vị, satisfies **AC-8**, **AC-12**.
6. Đánh giá và chat: truy vấn đánh giá chủ trọ và phòng (theo ngày, tổng, tổng sao), khối `ratings` dùng `averageStars` của `src/reviews/`; truy vấn chat (mở, đã trả lời, tổng, chưa đọc), khối `chat` với `replyRate`, cột `newConversations`, kèm test đơn vị, satisfies **AC-9**, **AC-10**, **AC-12**.
7. Chi tiêu: truy vấn đơn đã trả theo ngày cùng tổng, khối `spending`, kèm test đơn vị (tổng vượt 2,1 tỷ), satisfies **AC-11**.
8. Kiểm thật trên database thử: oracle độc lập cho mọi khối, đối chiếu với `GET /landlords/:id`, `GET /me/conversations/unread-count` và `GET /me/membership`, ranh giới ngày ở đúng mili giây cho từng nguồn, tổng cột của `series` bằng Metric, cô lập giữa hai chủ trọ, không lộ danh tính, mọi điều khiển âm còn lại, `EXPLAIN` cỡ demo một lần, chạy `seed:demo` rồi gọi route với một chủ trọ demo để xem số có ý nghĩa; cập nhật `verify.md`; tài liệu: `api-for-frontend.md` bổ sung các khối của mốc 2 (ghi rõ rằng số lưu và số theo dõi của một kỳ cũ có thể giảm, và `replyRate` đổi theo điểm phần trăm), satisfies **AC-1** đến **AC-15**.

## Consequences

**Positive**:
- Một lần gọi đủ cho cả màn hình: FE không tính gì, không điền ô trống, không ghép số từ nhiều route.
- Không bảng, cột, chỉ mục, biến môi trường hay mã lỗi mới; tái dùng gần hết thứ sẵn có (hạn mức của `MembershipsService`, `averageStars`, validator ngày và hằng múi giờ của 0010, nhóm `publicRead`).
- Tổng của chuỗi, tổng của bucket và các `value` khớp nhau theo cách xây (cùng các dòng), và các số công khai được đối chiếu với route công khai nên lệch luật sẽ lộ ra khi kiểm.
- Hai file `stat-period.ts` và `stat-metric.ts` cho hàng 27 và 28 dùng lại để cùng một quy tắc kỳ trước và phần trăm đổi.

**Negative / tradeoffs**:
- Các nhóm số đến từ khoảng mười truy vấn riêng không dùng giao dịch, nên khi có ghi đang diễn ra hai nhóm khác nhau có thể lệch nhau một dòng trong khoảnh khắc đó; trong một nhóm thì luôn khớp. Chấp nhận vì màn hình không thể thấy lệch một dòng.
- Lịch sử của lưu và theo dõi không được giữ: bỏ lưu hay bỏ theo dõi xóa dòng, nên số "mới trong kỳ" của một kỳ cũ có thể giảm về sau; đánh giá bị admin ẩn cũng biến khỏi các kỳ cũ. Tài liệu FE ghi rõ.
- Số của trạng thái hiện tại (tin theo trạng thái, hạn mức, điểm) không có kỳ trước, trái một nửa chữ của hàng 26 ("mỗi con số kèm số kỳ trước"), vì lịch sử trạng thái không lưu; làm đúng cần một bảng chụp theo ngày chạy bằng việc nền, ngoài MVP.
- Lượt xem theo ngày chỉ bắt đầu từ lúc có bảng (spec 0016): với chủ trọ có từ trước, `views.inRange` nhỏ hơn nhiều so với `allTime`. Dữ liệu demo do `seed:demo` rải nên không phản ánh điều này.
- Luật đánh giá công khai (`visible`, người viết `active`) và luật người theo dõi `active` được viết lại lần thứ hai trong SQL của `StatisticsRepository`; nếu sau này một luật đổi ở module chủ mà quên đổi ở đây, hai số sẽ lệch. Giảm nhẹ bằng các AC so với `GET /landlords/:id`, nhưng không có gì ép tự động ngoài lúc kiểm.
- `favorites` không có chỉ mục theo `listing_id` nên đếm lưu quét bảng; ổn ở demo, chưa đo ở quy mô lớn (đo một lần rồi giữ nguyên). Mỗi lần gọi chạy khoảng mười truy vấn, chấp nhận vì chỉ chủ trọ xem màn hình thống kê của chính họ và có giới hạn tần suất theo IP.
- Token chủ trọ cấp trước migration chưa có `statistic:read` nên nhận 403 cho đến lần refresh kế (token truy cập sống ngắn); FE nên refresh rồi gọi lại khi gặp 403 này.
- `hiddenByQuota` dùng chung cho hai nguyên nhân (vượt hạn mức và hết dùng thử hay hết gói, hạn mức 0); FE đọc `membership.state` để nói đúng lý do.
- Ngày hôm nay được tính khi mới qua một phần, nên kỳ này nhìn có vẻ thấp hơn kỳ trước đã đủ ngày.
- Chuỗi đã điền đủ ngày nên dài tới 366 phần tử mỗi lần gọi.
- Mọi số chat chỉ tính vai chủ trọ. Nếu admin cấp `conversation:create` cho `landlord` và một chủ trọ nhắn tin về tin của người khác, các cuộc đó không vào thống kê, và số chưa đọc ở đây sẽ nhỏ hơn số của `GET /me/conversations/unread-count`.

**Neutral**:
- Thêm module `src/statistics/` (controller, service, repository, DTO, hai file trợ giúp), một module trong danh mục quyền (`GET /permissions` dài thêm một mục), một migration dữ liệu, và mục mới trong `docs/api/api-for-frontend.md`. Bảng quyền của spec 0003 cần thêm dòng `statistic:read`.
- Không đổi hành vi của route nào đang có; không thêm việc nền hay bảng tổng hợp.
- Số `0017` không trùng spec nào.

## Follow-up

- [ ] Hoãn, thêm lại bằng `/scope` khi cần: thống kê riêng cho từng tin hay từng nhà trọ, lượt xem theo giờ hay theo nguồn, danh sách tên người lưu hay theo dõi, thời gian trả lời chat, tỉ lệ từ xem đến nhắn tin, xuất CSV, bảng chụp theo ngày để so sánh được cả số trạng thái hiện tại, bảng sự kiện để giữ lịch sử lưu và theo dõi chính xác, bộ nhớ đệm, chỉ mục `favorites(listing_id)`, xếp hạng giữa các chủ trọ.
- [ ] Spec 0003: bảng quyền thêm dòng `statistic:read` và câu nói rằng thống kê của chủ trọ nằm ở module này; `/architect` sửa khi tiện (không chặn build).
- [ ] Trước khi chạy API mới trên database dev: `npm run migration:deploy`; chủ trọ đang đăng nhập cần refresh token một lần để có quyền mới. Nên chạy `npm run seed:demo -- --reset` để có số liệu xem thử.
- [ ] Sau khi build, `/sync`: thêm `src/statistics/AGENTS.md` (nhắc rằng Repository này chỉ đọc và luật công khai được viết lại ở đây), dòng ở `src/listings/` và `src/database/demo/` nếu cần, và đóng ghi chú "hàng 26 sẽ đọc" trong `schema.prisma` của `ListingDailyView`.
- [ ] Hàng 27 và 28 (thống kê của admin) dùng lại `stat-period.ts` và `stat-metric.ts`; nếu hai hàng đó cần nằm ngoài `src/statistics/`, chuyển hai file sang `src/common/` cùng lúc.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
