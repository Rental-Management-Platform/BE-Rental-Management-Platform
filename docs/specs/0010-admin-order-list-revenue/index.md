# 0010. Admin xem đơn mua gói của mọi chủ trọ và thống kê doanh thu

**Date**: 2026-10-21
**Status**: Accepted

## Summary

Admin hiện không xem được ai đã mua gói nào, vì mọi API đơn chỉ trả đơn của chính người gọi. Spec này thêm hai API chỉ đọc cho admin: `GET /orders/all` liệt kê đơn của mọi chủ trọ (lọc theo trạng thái, chủ trọ, gói, khoảng ngày tạo, kèm số đơn đã trả và tổng tiền của đúng tập đang lọc), và `GET /orders/revenue` thống kê doanh thu (tổng, chia theo gói, chia theo ngày hoặc tháng). Không có bảng, cột hay migration mới: mọi số được tính lúc đọc từ bảng `orders` có sẵn. Tiền ở đây là tiền của thanh toán thử, chưa phải tiền thật.

## Requirements

**User stories**:
- Là admin, tôi muốn xem đơn mua gói của mọi chủ trọ, lọc theo trạng thái, chủ trọ, gói và khoảng ngày, để biết ai đã mua gì và đơn nào còn chờ hay đã hủy.
- Là admin, tôi muốn thấy ngay số đơn đã trả và tổng tiền của đúng những đơn tôi đang lọc, để đối chiếu với từng dòng.
- Là admin, tôi muốn xem doanh thu theo gói và theo ngày hoặc tháng, để thấy gói nào bán tốt và doanh thu đi lên hay đi xuống.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `GET /orders/all` trả 200 `{ items, total, page, pageSize, summary }`. `items` gồm đơn của mọi chủ trọ ở mọi trạng thái. Mỗi phần tử có mười ba trường của một đơn (`id`, `code`, `planId`, `planName`, `price`, `maxListings`, `durationDays`, `status`, `paidAt`, `cancelledAt`, `startsAt`, `endsAt`, `createdAt`, đúng nghĩa như hình dạng đơn của spec 0004) cùng `landlord: { id, name, email }` (`name` có thể null). Sắp đơn mới nhất trước (`created_at` giảm dần, rồi `id` giảm dần). `page` mặc định 1, `pageSize` mặc định 20 và tối đa 50 như các danh sách khác. Trang quá cuối trả 200 với `items: []`, còn `total` và `summary` vẫn đúng. `total` đếm mọi dòng khớp bộ lọc, không phụ thuộc trang.
- **AC-2**: Ba bộ lọc tùy chọn, dùng cùng lúc thì dòng phải thỏa cả ba: `status` (`pending`, `paid`, `cancelled`), `landlordId` (UUID, khớp `orders.user_id`), `planId` (UUID, khớp `orders.plan_id`). `items`, `total` và `summary` đều theo bộ lọc. Giá trị ngoài danh sách, id không phải UUID, hay tham số lạ (ví dụ `sort`, `q`) bị 400 `VALIDATION_FAILED` kèm tên trường sai. UUID hợp lệ nhưng không có thật (kể cả `landlordId` của một tài khoản không phải chủ trọ) trả 200 với `items: []`, `total: 0` và `summary` bằng 0.
- **AC-3**: Hai bộ lọc ngày tùy chọn `from` và `to`, lọc theo `created_at`. Cả hai có dạng `YYYY-MM-DD`, là ngày có thật trên lịch (30 tháng 2 bị từ chối) và có năm từ 2000 đến 2100. Mỗi ngày là một ngày theo giờ Việt Nam (`Asia/Ho_Chi_Minh`, UTC+7): `from` tính từ 00:00:00.000 giờ Việt Nam của ngày đó, `to` tính hết ngày đó (đơn tạo lúc 23:59:59.999 của ngày `to` vẫn vào, đơn tạo lúc 00:00:00.000 của ngày kế thì không). Chỉ gửi một trong hai cũng được. `from` lớn hơn `to`, sai dạng hoặc ngoài khoảng năm bị 400 `VALIDATION_FAILED` kèm tên trường sai (`from` lớn hơn `to` báo ở trường `to`).
- **AC-4**: `summary` là `{ paidCount, paidAmount }`: số đơn `paid` và tổng `price` (số nguyên đồng) của các đơn `paid` trong đúng tập đang lọc (mọi bộ lọc của AC-2 và AC-3, không phụ thuộc trang). Cộng tay `price` của các dòng `paid` qua mọi trang ra đúng `paidAmount`. Lọc `status=pending` hoặc `cancelled` thì cả hai bằng 0. Không có dòng nào thì cả hai bằng 0. Tổng vượt 2,1 tỷ đồng vẫn đúng.
- **AC-5**: Dòng đơn đọc `planName`, `price`, `maxListings`, `durationDays` từ các cột bản chốt của đơn nên admin sửa gói về sau không đổi dòng nào. `startsAt` và `endsAt` là kỳ gói của đơn `paid`, `null` khi đơn chưa trả hoặc đã hủy. `landlord` lấy từ `users` kể cả khi chủ trọ đã bị khóa hay xóa mềm, và chỉ có ba trường `id`, `name`, `email`: không có số điện thoại, mật khẩu băm, `trialEndsAt` hay bất kỳ cột nào khác của `users` ở bất kỳ chỗ nào của phản hồi.
- **AC-6**: `GET /orders/revenue` trả 200 `{ from, to, groupBy, timeZone, paidCount, paidAmount, byPlan, series }`. Chỉ đơn `paid` có `paid_at` trong khoảng mới tính; đơn `pending` và `cancelled` không bao giờ tính. `from` và `to` có luật y hệt AC-3 nhưng lọc theo `paid_at`, đều tùy chọn (không gửi là không chặn phía đó), và được trả lại đúng như đã gửi hoặc `null`. `groupBy` là `day` hoặc `month`, mặc định `month`, giá trị khác bị 400 `VALIDATION_FAILED`; tham số lạ cũng bị 400. `timeZone` luôn là `Asia/Ho_Chi_Minh`. Không có đơn nào trong khoảng thì `paidCount: 0`, `paidAmount: 0`, `byPlan: []`, `series: []`.
- **AC-7**: `byPlan` có một phần tử `{ planId, planName, paidCount, paidAmount }` cho mỗi gói có ít nhất một đơn `paid` trong khoảng; `planName` là tên hiện tại của gói, `paidAmount` cộng `price` đã chốt trên từng đơn; sắp `paidAmount` giảm dần, rồi `planName` tăng dần, rồi `planId`. `series` có một phần tử `{ period, paidCount, paidAmount }` cho mỗi ngày (`YYYY-MM-DD`) hoặc tháng (`YYYY-MM`) theo giờ Việt Nam của `paid_at` có ít nhất một đơn `paid`; sắp `period` tăng dần; ngày hay tháng không có đơn thì không có phần tử (FE tự điền ô trống). Tổng `paidAmount` của `byPlan`, tổng của `series` và `paidAmount` ở ngoài luôn bằng nhau, tổng `paidCount` cũng vậy, kể cả khi có thanh toán đang diễn ra lúc gọi.
- **AC-8**: Ranh giới theo giờ Việt Nam. Đơn trả lúc `2026-10-31T17:30:00Z` (tức 00:30 ngày 01/11 giờ Việt Nam) thuộc `period` `2026-11-01` khi `groupBy=day` và `2026-11` khi `groupBy=month`, có mặt khi `from=2026-11-01`, và vắng mặt khi `to=2026-10-31`. Kết quả không đổi dù múi giờ phiên của database là gì.
- **AC-9**: Phân quyền và tiêu đề cho cả hai route. Không đăng nhập: 401 `TOKEN_MISSING`. `tenant` và `landlord`: 403 `PERMISSION_DENIED`, kể cả khi gửi tham số sai (quyền được kiểm trước tham số), kể cả khi mang token cấp trước thay đổi này có `order:manage`. Quyền cần là `order:report` (chỉ admin giữ). Route gắn `@FreshAuth()` (spec 0003 AC-8): admin vừa bị khóa với token còn hạn bị 403 `ACCOUNT_LOCKED`, admin đã bị xóa mềm bị 401 `TOKEN_INVALID`. Các trường hợp bị từ chối không đọc bảng `orders`. Phản hồi 200 có `Cache-Control: private, no-store`.
- **AC-10**: Danh mục quyền và định tuyến. Module `order` trong danh mục quyền có thêm hành động `report` thuộc `adminActions`, nên `GET /permissions` liệt kê nó và `PATCH /account-types/landlord` hay `tenant` cấp `order:report` bị 400 `PERMISSION_ADMIN_ONLY`. Quyền mặc định của chủ trọ vẫn là `order:create`, `order:read`, `order:cancel`; không migration. `GET /orders/all` và `GET /orders/revenue` không bị `GET /orders/:id` bắt nhầm (không có 400 `INVALID_ID`). `GET /orders` và `GET /orders/:id` của chủ sở hữu giữ nguyên hành vi, kể cả `GET /orders` của admin vẫn chỉ trả đơn của chính họ. Hai route không ghi gì vào database.

## Decision

**Chosen option**: Option 1: Hai route đọc riêng cho admin trên bảng `orders` có sẵn, danh sách lọc theo ngày tạo kèm `summary`, thống kê tính theo ngày trả bằng một câu SQL

`GET /orders/all` là một truy vấn đọc có bộ lọc và phân trang kèm một phép cộng các đơn `paid` của đúng tập lọc. `GET /orders/revenue` chạy một câu SQL duy nhất gom đơn `paid` theo gói và theo ngày hoặc tháng (giờ Việt Nam), nên ba con số tổng luôn khớp nhau. Quyền là một hành động chỉ admin mới `order:report`. Không migration, không mã lỗi mới, không biến môi trường mới.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`)

## Feature design

Quy ước chung theo 0001 đến 0009: Repository bọc Prisma (đọc thô bằng `$queryRaw` chỉ nằm trong `*.repository.ts`), id `uuidv7()`, `timestamptz`, tiền là số nguyên đồng, `snake_case` ở DB, tiền tố `/api/v1`, mã lỗi trong `ErrorCode`. Admin dùng chung `OrdersRepository` (nơi duy nhất chạm bảng `orders`), nhưng có Service và Controller riêng để `OrdersService` giữ nguyên là phần của chủ sở hữu.

**Data model**: không bảng mới, không cột mới, không chỉ mục mới, không migration; `schema.prisma` không đổi. Hai API đọc `orders` nối `users` (lấy `id`, `name`, `email`), `subscriptions` (kỳ gói) và `plans` (tên hiện tại, chỉ ở thống kê). Mô hình đã được bạn xác nhận:

| Phản hồi | Trường | Nguồn |
|---|---|---|
| `GET /orders/all` mỗi dòng | `id`, `code`, `planId`, `planName`, `price`, `maxListings`, `durationDays`, `status`, `paidAt`, `cancelledAt`, `createdAt` | cột cùng tên của `orders` |
| | `startsAt`, `endsAt` | `subscriptions.starts_at`, `ends_at` qua `order_id`; `null` khi chưa có |
| | `landlord.id`, `landlord.name`, `landlord.email` | `users.id`, `name`, `email` qua `orders.user_id` |
| `GET /orders/all` ngoài `items` | `summary.paidCount`, `summary.paidAmount` | `count` và `sum(price)` của đơn `status = 'paid'` trong tập lọc |
| `GET /orders/revenue` | `paidCount`, `paidAmount` | đơn `status = 'paid'` có `paid_at` trong khoảng |
| | `byPlan[]` | gom theo `orders.plan_id`, tên từ `plans.name` hiện tại |
| | `series[]` | gom theo ngày hoặc tháng của `paid_at` theo giờ Việt Nam |

Quan hệ có sẵn: `orders` N:1 `users`, `orders` N:1 `plans`, `orders` 1:0..1 `subscriptions`. Bảng `orders` hiện có ba chỉ mục (`(user_id, created_at DESC, id DESC)`, `(plan_id)`, duy nhất `code`); danh sách toàn hệ thống và thống kê theo khoảng ngày chưa có chỉ mục riêng, xem Consequences.

**State transitions**: không có. Spec này chỉ đọc.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/orders/all` | GET | query tùy chọn: `page`, `pageSize`, `status`, `landlordId`, `planId`, `from`, `to` | 200 `{ items, total, page, pageSize, summary }` | `order:report` (chỉ admin) và `@FreshAuth()` | 400 `VALIDATION_FAILED`, 401 `TOKEN_MISSING`, 401 `TOKEN_INVALID`, 403 `PERMISSION_DENIED`, 403 `ACCOUNT_LOCKED` |
| `/orders/revenue` | GET | query tùy chọn: `from`, `to`, `groupBy` (`day` hoặc `month`, mặc định `month`) | 200 `{ from, to, groupBy, timeZone, paidCount, paidAmount, byPlan, series }` | `order:report` (chỉ admin) và `@FreshAuth()` | như trên |

Một phần tử của `items`:

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01",
  "code": "k7m2xq9p",
  "planId": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02",
  "planName": "Nâng cao",
  "price": 199000,
  "maxListings": 15,
  "durationDays": 30,
  "status": "paid",
  "paidAt": "2026-10-19T03:00:00.000Z",
  "cancelledAt": null,
  "startsAt": "2026-10-19T03:00:00.000Z",
  "endsAt": "2026-11-18T03:00:00.000Z",
  "createdAt": "2026-10-19T02:59:30.000Z",
  "landlord": { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03", "name": "Nguyễn Văn Nam", "email": "nam@example.com" }
}
```

`summary` đứng ngang hàng `items`: `{ "paidCount": 30, "paidAmount": 5970000 }`. Phản hồi của `GET /orders/revenue`:

```json
{
  "from": "2026-10-01",
  "to": "2026-10-31",
  "groupBy": "day",
  "timeZone": "Asia/Ho_Chi_Minh",
  "paidCount": 30,
  "paidAmount": 5970000,
  "byPlan": [
    { "planId": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02", "planName": "Nâng cao", "paidCount": 20, "paidAmount": 3980000 }
  ],
  "series": [
    { "period": "2026-10-03", "paidCount": 2, "paidAmount": 398000 }
  ]
}
```

Không có mã lỗi mới: dùng `VALIDATION_FAILED`, `TOKEN_MISSING`, `TOKEN_INVALID`, `PERMISSION_DENIED`, `ACCOUNT_LOCKED` đã có.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi** (như 0007): token (401) → `@FreshAuth` đọc lại admin trong database (403 `ACCOUNT_LOCKED` hoặc 401 `TOKEN_INVALID`) → quyền `order:report` (403 `PERMISSION_DENIED`) → tham số (400).
- **Định tuyến**: `GET /orders/:id` có `uuidParam()` nên sẽ bắt chữ `all` và `revenue` thành 400 `INVALID_ID` nếu nó được đăng ký trước. `AdminOrdersController` (`@Controller('orders')`, chỉ có hai `GET`) phải đứng trước `OrdersController` trong `controllers` của `OrdersModule`; một test gọi thật cả hai route và giữ thứ tự đó.
- **Múi giờ**: một hằng `APP_TIME_ZONE = 'Asia/Ho_Chi_Minh'` và `APP_UTC_OFFSET_MS` (UTC+7) trong `src/common/time/app-time-zone.ts`. Việt Nam không đổi giờ mùa hè nên độ lệch cố định đúng với cả năm; một test so độ lệch đó với `Intl.DateTimeFormat` của chính múi giờ để hai cách biểu diễn không lệch nhau. Hàm `startOfDay('YYYY-MM-DD')` trả thời điểm 00:00 giờ Việt Nam của ngày đó; cận trên của `to` là `startOfDay` của ngày kế (so chặt `<`). Cả hai đổi sang chuỗi ISO có `Z` trước khi vào SQL thô (bài học múi giờ của tham số `Date`, xem `publicListingCondition`).
- **Kiểm ngày**: DTO kiểm đúng dạng `YYYY-MM-DD`, ngày có thật (dựng lại từ năm, tháng, ngày rồi so), năm từ 2000 đến 2100 (PostgreSQL không có năm 0 và `Date` của JavaScript có biên riêng, nên không để năm lạ tới được câu SQL). `from` lớn hơn `to` bị từ chối ở DTO.
- **Danh sách**: một `findMany` (kèm `subscription` và `user` chọn đúng ba cột), một `count` và một `aggregate` cho `summary` cùng `where` (`summary` thêm `status = 'paid'` bằng `AND`), chạy song song như `findOwnPage`. Thứ tự dùng lại `NEWEST_FIRST`.
- **Thống kê**: một câu `$queryRaw` có CTE `paid` (đơn `paid` trong khoảng, kèm `period = to_char(paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD' hoặc 'YYYY-MM')`), rồi `UNION ALL` hai phép gom: theo `plan_id` (nối `plans` lấy tên) và theo `period`. `paidCount` và `paidAmount` ngoài cùng do Service cộng từ các dòng `byPlan` của chính câu đó. Mẫu định dạng `period` đến từ danh sách trắng `day`/`month`, không từ chuỗi người dùng. Tổng tiền là `SUM(price)::bigint` (không ép `int4`), Repository đổi sang `number` bằng `Number()`.
- **Giới hạn tần suất**: không gắn `@RateLimited`, như 0007 và `GET /moderation/listings`.
- **Không cache**: `@Header('Cache-Control', 'private, no-store')` như 0007.

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Cả hai route | người gọi có phải admin | `order:report` trong quyền đọc lại từ database nhờ `@FreshAuth` (admin giữ mọi quyền tính trong code) |
| Cả hai route | ranh giới của một "ngày" | hằng `APP_TIME_ZONE` / `APP_UTC_OFFSET_MS`; `from` là 00:00 giờ Việt Nam của ngày gửi, cận trên của `to` là 00:00 giờ Việt Nam của ngày kế |
| Cả hai route | header `Cache-Control` | hằng `private, no-store` |
| `GET /orders/all` | những đơn nào có mặt | bảng `orders`, mọi trạng thái, lọc bằng `status`, `user_id` (query `landlordId`), `plan_id` (query `planId`), `created_at` (query `from`, `to`) |
| `GET /orders/all` | thứ tự | `created_at` giảm dần, rồi `id` giảm dần |
| `GET /orders/all` | mười một trường đơn | cột cùng tên của `orders` (bốn cột bản chốt không bao giờ đổi) |
| `GET /orders/all` | `startsAt`, `endsAt` | `subscriptions` có `order_id` bằng đơn; `null` khi chưa có |
| `GET /orders/all` | `landlord.id`, `name`, `email` | `users.id`, `name`, `email` qua `orders.user_id` |
| `GET /orders/all` | `total` | `count` với đúng `where` của trang |
| `GET /orders/all` | `summary.paidCount`, `paidAmount` | `count` và `sum(price)` của `where` AND `status = 'paid'` |
| `GET /orders/all` | `page`, `pageSize` | query, `PaginationQueryDto` |
| `GET /orders/revenue` | tập đơn tính doanh thu | `orders` có `status = 'paid'` và `paid_at` trong `[from, cận trên của to)` |
| `GET /orders/revenue` | `byPlan[].planName` | `plans.name` hiện tại qua `orders.plan_id` (gói có đơn không xóa được nên phép nối luôn tìm thấy) |
| `GET /orders/revenue` | `paidAmount` các cấp | `SUM(orders.price)` bản chốt |
| `GET /orders/revenue` | `series[].period` | `to_char(paid_at AT TIME ZONE APP_TIME_ZONE, mẫu theo groupBy)` |
| `GET /orders/revenue` | `paidCount`, `paidAmount` ngoài cùng | cộng các dòng `byPlan` của cùng một câu SQL |
| `GET /orders/revenue` | `groupBy` | query, mặc định `month` |
| `GET /orders/revenue` | `from`, `to`, `timeZone` trả lại | query (hoặc `null`), hằng `APP_TIME_ZONE` |

**Key invariants**:
- Hai route chỉ đọc: không ghi, không khóa dòng, không đổi `updated_at` của ai.
- Doanh thu chỉ tính đơn `paid`, theo `price` đã chốt trên đơn; admin sửa giá gói về sau không làm số cũ đổi.
- Một "ngày" ở mọi nơi (lọc, gom ngày, gom tháng) là ngày theo giờ Việt Nam, từ một định nghĩa duy nhất.
- Ba con số tổng của thống kê (`paidAmount` ngoài cùng, tổng `byPlan`, tổng `series`) đến từ một câu SQL nên cùng một ảnh chụp dữ liệu và luôn bằng nhau; tổng tiền không bao giờ ép về `int4`.
- Phản hồi chỉ chứa các trường đã liệt kê; từ `users` chỉ có `id`, `name`, `email`, nhờ `select` liệt kê đúng cột ở Repository và mapper chọn từng trường.
- Hai route luôn đòi `@FreshAuth()`: quyền lấy từ database chứ không từ token, vì token cấp trước thay đổi này của chủ trọ mang `order:manage`, và `order:manage` giờ bung ra cả `order:report`.

**Security model**:
- Cần quyền `order:report`, một hành động chỉ admin mới thêm vào module `order` (`adminActions: ['report']`, cùng kiểu `listing:moderate`). Admin giữ nó vì `ADMIN_PERMISSIONS` tính trong code; chủ trọ và người tìm trọ không cấp được qua API (spec 0003 AC-6), nên không cần migration quyền.
- Hệ quả của việc module `order` nay có hành động chỉ admin: chủ trọ không còn giữ đủ mọi hành động của module nên `compressPermissions` không gộp được nữa, và token mới của chủ trọ mang ba khóa lẻ `order:create`, `order:read`, `order:cancel` thay vì `order:manage`. Token cũ mang `order:manage` vẫn dùng được cho các route chủ sở hữu, nhưng `order:manage` đó nay bung ra cả `order:report`, nên chính `@FreshAuth()` (quyền đọc lại từ database, nơi chủ trọ chỉ có ba khóa lẻ) là thứ giữ hai route admin này ở 403 cho tới khi token cũ hết hạn. `PATCH /account-types/:key` vốn đã từ chối mọi khóa `module:manage`, nên không có đường nào cấp `order:manage` hay `order:report` cho chủ trọ trong DB.
- `@FreshAuth()` còn vì lý do thứ hai như 0007: phản hồi gom tên và email của chủ trọ cùng số tiền họ trả. Admin vừa bị khóa hay bị hạ quyền mất đường đọc ngay.
- Dữ liệu cá nhân: tên và email chủ trọ (admin đã xem được cả hai ở `GET /users`). Không có số điện thoại. Dự án chưa khai phạm vi tuân thủ riêng; không có nhật ký đọc (xem Consequences).
- `paid` ở bản này không chứng minh đã thu tiền (spec 0004): `paidAmount` là tổng tiền của thanh toán thử. Tài liệu cho FE ghi rõ để màn hình không gọi nó là doanh thu thật.

**Configuration required**: không có biến môi trường, dịch vụ ngoài, seed hay migration. Múi giờ là hằng trong code. Cần Postgres biết tên múi giờ `Asia/Ho_Chi_Minh` (mọi bản Postgres có sẵn dữ liệu múi giờ); bước kiểm thật xác nhận trên database thử.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: chèn bằng tay đơn của ba chủ trọ ở ba trạng thái và hai gói; `GET /orders/all` ra đúng tập đơn, đúng thứ tự, `landlord` đúng, `total` và `summary` khớp một phép đếm và cộng độc lập tính từ dòng thô; cộng tay `price` các dòng `paid` qua mọi trang ra `paidAmount`, verifies **AC-1**, **AC-4**, **AC-5**
- Happy path: từng bộ lọc `status`, `landlordId`, `planId` và các tổ hợp của chúng; `status=pending` cho `summary` bằng 0; trang quá cuối còn `total` và `summary`, verifies **AC-1**, **AC-2**, **AC-4**
- Failure case: `landlordId` và `planId` là UUID không có thật hoặc là id của tài khoản `tenant` cho trang rỗng; `status=x`, `landlordId=abc`, `sort=asc`, `pageSize=51` mỗi cái bị 400 `VALIDATION_FAILED` đúng tên trường, verifies **AC-2**
- Failure case: ranh giới ngày của danh sách ở đúng mili giây: đơn tạo lúc 2026-10-31T16:59:59.999Z (23:59:59.999 giờ Việt Nam) vào khi `to=2026-10-31`; đơn tạo lúc 2026-10-31T17:00:00.000Z không vào; đơn tạo lúc 2026-09-30T17:00:00.000Z vào khi `from=2026-10-01`; `from=2026-02-30`, `from=2026-10-21&to=2026-10-20`, `from=1999-12-31`, `from=21/10/2026` bị 400, verifies **AC-3**
- Failure case: đổi tổng vượt 2,1 tỷ (chèn tay 30 đơn giá 100.000.000 đồng, giá tối đa của một gói): `summary.paidAmount` và `revenue.paidAmount` ra 3.000.000.000, không tràn, verifies **AC-4**, **AC-7**
- Happy path: admin sửa giá và tên gói sau khi có đơn: dòng đơn giữ giá và tên cũ; `byPlan` ra tên mới nhưng số tiền cộng theo giá cũ từng đơn; chủ trọ bị khóa hay xóa mềm vẫn hiện tên và email; phản hồi không có `phone`, `passwordHash`, `trialEndsAt` ở bất kỳ chỗ nào, verifies **AC-5**, **AC-7**
- Happy path: `GET /orders/revenue` mặc định `groupBy=month`, rồi `groupBy=day`; `byPlan` và `series` đúng thứ tự và đúng số từ phép gom độc lập tính từ dòng thô; tổng ba nơi bằng nhau; không có đơn nào cho `0`, `0`, `[]`, `[]`; đơn `pending` và `cancelled` không vào, verifies **AC-6**, **AC-7**
- Failure case: đơn trả lúc 2026-10-31T17:30:00Z: `period` là `2026-11-01` và `2026-11`, có khi `from=2026-11-01`, vắng khi `to=2026-10-31`; chạy lại với múi giờ phiên của database đặt thành `UTC` và `America/Los_Angeles` ra cùng kết quả, verifies **AC-8**
- Failure case: bấm thanh toán đồng thời nhiều đơn trong lúc gọi `GET /orders/revenue` lặp lại: mỗi phản hồi có tổng `byPlan` bằng tổng `series` bằng `paidAmount`, verifies **AC-7**
- Auth/permission: khách 401; `tenant` và `landlord` 403 (cả khi gửi tham số sai); chủ trọ mang token có `order:manage` (dựng tay) vẫn 403 nhờ `@FreshAuth`; admin vừa bị khóa với token còn hạn 403 `ACCOUNT_LOCKED`; admin đã xóa mềm 401 `TOKEN_INVALID`; cấp `order:report` cho `landlord` qua `PATCH /account-types/landlord` bị 400 `PERMISSION_ADMIN_ONLY`; phản hồi 200 có `Cache-Control: private, no-store`, verifies **AC-9**, **AC-10**
- Happy path: `GET /permissions` ra `order` có `adminActions: ['report']`; `GET /orders/all` ra 200 chứ không phải 400 `INVALID_ID`; `GET /orders` của admin vẫn rỗng, `GET /orders/:id` của chủ sở hữu giữ nguyên; kiểm bảng `orders` trước và sau thấy không đổi dòng nào, verifies **AC-10**
- Điều khiển âm (bước kiểm thật, không phải test tự động): bỏ vế `status = 'paid'` của `summary`, đổi cận trên của `to` từ `<` thành `<=`, thay múi giờ bằng `UTC`, ép `SUM` về `int4`, bỏ `@FreshAuth()`; mỗi thay đổi phải bị đúng kiểm tra tương ứng bắt, verifies **AC-3**, **AC-4**, **AC-7**, **AC-8**, **AC-9**
- Kiểm bằng `EXPLAIN` (không phải test tự động): khoảng 50 nghìn đơn trên database thử; đo trang đầu không lọc, lọc `status=paid` kèm khoảng ngày, và `GET /orders/revenue` toàn bộ thời gian; đo một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-1**, **AC-6**

## Build plan

Theo Skateboard (bản mỏng nhất dùng được trước, rồi mới mở rộng): Mốc 1 cho admin xem được mọi đơn kèm tổng tiền (đủ để kiểm doanh thu bằng mắt), Mốc 2 mở rộng thành thống kê theo gói và theo thời gian. Mỗi mốc là một lần `/develop` rồi dừng cho bạn review. Quy tắc tài liệu sống: cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong từng mốc.

**Mốc 1: danh sách đơn của mọi chủ trọ**
1. Quyền: thêm hành động `report` vào module `order` của `PERMISSION_CATALOG` với `adminActions: ['report']`; sửa `permission-catalog.spec.ts` (dòng `isAdminOnly('order:manage')` nay là `true`, và token của chủ trọ mang ba khóa lẻ); rà các test khác dựa vào `order:manage` hay danh sách quyền. Không migration, satisfies **AC-10**. **Xong 2026-10-21**: `order.actions` có `report`, `adminActions: ['report']`; spec của danh mục quyền sửa `order:manage` thành chỉ admin và thêm hai ca mới (token chủ trọ mang ba khóa lẻ, `GET /permissions`); không test nào khác dựa vào `order:manage`.
2. Múi giờ và ngày: `src/common/time/app-time-zone.ts` (`APP_TIME_ZONE`, `APP_UTC_OFFSET_MS`, `startOfDay`, `startOfNextDay`, hàm đổi sang chuỗi ISO có `Z`) kèm test đơn vị (độ lệch khớp `Intl`, ranh giới mili giây, tháng 2 năm nhuận); một validator ngày `YYYY-MM-DD` dùng chung (dạng, ngày có thật, năm 2000 đến 2100) kèm test, satisfies **AC-3**, **AC-8**. **Xong 2026-10-21**: `src/common/time/app-time-zone.ts` (`APP_TIME_ZONE`, `APP_UTC_OFFSET_MS`, `startOfDay`, `startOfNextDay`, `toSqlTimestamp`) và `src/common/time/calendar-date.ts` (`isCalendarDate`, hai decorator `@IsCalendarDate()` và `@IsNotBeforeDate('from')`), mỗi file một spec. `@IsNotBeforeDate` chỉ so khi cả hai ngày hợp lệ nên một ngày sai dạng chỉ báo một lỗi ở đúng trường của nó.
3. `ListAllOrdersQueryDto` (kế thừa `PaginationQueryDto`; `status` bằng `ORDER_STATUSES`, `landlordId` và `planId` là UUID, `from`, `to` bằng validator ở bước 2, `from` không lớn hơn `to`), `OrdersRepository.findAdminPage(filter, skip, take)` (`findMany` chọn đúng cột kèm `subscription` và `user` chỉ `id`, `name`, `email`, cộng `count` và `aggregate` cho `summary`, chạy song song), `AdminOrdersService.listAll`, `AdminOrderResponse` và mapper `toAdminOrderResponse` (dùng lại `toOrderResponse`), kèm test đơn vị cho DTO, Repository (hình dạng `where` từng tổ hợp, `summary` có `status = 'paid'`), Service và mapper (không có trường thừa), satisfies **AC-1** đến **AC-5**. **Xong 2026-10-21**: `ListAllOrdersQueryDto` ở `src/orders/dto/admin-order-queries.dto.ts`, `OrdersRepository.findAdminPage` (`select` liệt kê cột, ba truy vấn song song), `AdminOrdersService.listAll`, `toAdminOrderResponse` và kiểu `AdminOrderPage`. Hai quyết định nhỏ của build: `toOrderResponse` nhận kiểu hẹp `OrderRowShape` (không cần `userId` và `updatedAt`) để dùng chung cho dòng `select`, và `summary` dùng `AND: [where, { status: 'paid' }]` chứ không ghi đè `status`.
4. `AdminOrdersController` (`GET /orders/all`: `@RequirePermissions('order:report')`, `@FreshAuth()`, `@Header('Cache-Control', 'private, no-store')`, không `@RateLimited`) đứng trước `OrdersController` trong `OrdersModule`, `AdminOrdersService` vào `providers`; test duyệt route khai báo quyền chạy lại và test thứ tự controller, satisfies **AC-9**, **AC-10**. **Xong 2026-10-21**: `AdminOrdersController` đứng trước `OrdersController` trong `OrdersModule`; `admin-orders.controller.spec.ts` đọc khai báo route (quyền, `@FreshAuth`, không `@RateLimited`, header), kiểm thứ tự thật từ metadata của `OrdersModule`, gọi HTTP thật qua supertest, và có một ca đối chứng đảo thứ tự cho ra 400 `INVALID_ID`.
5. Kiểm thật trên database thử (xem Critical test scenarios của mốc này: chèn tay đơn nhiều chủ trọ, oracle độc lập từ dòng thô, ranh giới mili giây, tổng vượt 2,1 tỷ, token có `order:manage`, các điều khiển âm liên quan) và `EXPLAIN` một lần ở khoảng 50 nghìn đơn (ghi số, không chỉnh); `verify.md`, satisfies **AC-1** đến **AC-5**, **AC-9**, **AC-10**. **Xong 2026-10-21** trên database thử `rental_management_verify`: 182 kiểm tra HTTP và SQL (oracle độc lập từ dòng thô, ranh giới đúng từng mili giây, 30 đơn 100.000.000 ra 3.000.000.000, token chủ trọ giả mang `order:manage`, admin bị khóa và bị xóa mềm, bộ đếm đọc của PostgreSQL cho ca bị từ chối), chạy lại 180 kiểm tra dưới hai múi giờ phiên (`America/Los_Angeles`, `Pacific/Kiritimati`), bốn điều khiển âm đều bị bắt (bỏ `status = 'paid'` làm 18 kiểm tra sai, `<` thành `<=` làm 13 sai, múi giờ UTC làm 11 sai, bỏ `@FreshAuth()` làm 4 sai); `EXPLAIN` ở 50 000 đơn đo một lần, không chỉnh (HTTP trung vị: trang đầu 30 ms, trang sâu 56 ms, lọc dưới 20 ms; câu SQL chậm nhất 28 ms).
6. Tài liệu: Postman folder 22 `Đơn của mọi chủ trọ (admin)` (request cho mọi AC của mốc, dùng lại token admin của các folder trước, không đăng nhập admin lần nữa vì giới hạn 10 lần mỗi 15 phút); `api-for-frontend.md` thêm mục 6.37 `Đơn của mọi chủ trọ (admin)`, sửa dòng "Admin chưa xem được đơn của mọi người" ở mục giới hạn đã biết và dòng admin ở mục 6.27, sửa bảng quyền ở mục 5, thêm một mục nhật ký, satisfies **AC-1** đến **AC-5**, **AC-9**, **AC-10**. **Xong 2026-10-21**: Postman folder `22 Đơn của mọi chủ trọ (admin)` (34 request, dùng lại `adminToken`, không đăng nhập admin và không đăng ký tài khoản), FE guide mục 6.37, dòng ở mục 1, mục 5 (bảng quyền), 6.27, 7, 8, 9 và nhật ký. Newman folder 00, 01, 03, 04, 05, 07 đến 22: 522 request và 1118 assertion, 0 lỗi trên database mới.

**Mốc 2: thống kê doanh thu**
7. `RevenueQueryDto` (`from`, `to` bằng validator ở bước 2, `groupBy` bằng danh sách trắng `day`, `month`), `OrdersRepository.findRevenue(range, groupBy)` bằng một câu `$queryRaw` có CTE `paid` và `UNION ALL` hai phép gom (theo gói, nối `plans` lấy tên; theo `period`), `SUM(price)::bigint` đổi sang `number`, cận ngày truyền bằng chuỗi ISO có `Z`; `AdminOrdersService.revenue` (cộng `paidCount`, `paidAmount` từ các dòng `byPlan`, sắp `byPlan` và `series`), mapper, `GET /orders/revenue` cùng bộ decorator như bước 4; kèm test đơn vị cho DTO, Repository (tham số truyền đúng, đổi `bigint`), Service (sắp xếp, tổng khớp, rỗng) và test duyệt route, satisfies **AC-6** đến **AC-9**. **Xong 2026-10-21**: `RevenueQueryDto` (cùng file với `ListAllOrdersQueryDto`), `revenueQuery` và `OrdersRepository.findRevenue` (một câu `$queryRaw` dựng bằng `Prisma.sql`: CTE `paid`, `UNION ALL`, múi giờ và mẫu gom là tham số ràng buộc, cận ngày là chuỗi ISO có `Z`), `AdminOrdersService.revenue`, `GET /orders/revenue` cùng bộ decorator như `GET /orders/all`, kiểu `RevenueGroupBy` ở `order-status.ts`. Hai quyết định nhỏ của build: không tách mapper riêng (repository trả thẳng hình dạng của phản hồi), và `byPlan` so tên theo thứ tự ký tự (không theo bảng chữ cái tiếng Việt) để thứ tự không phụ thuộc cấu hình ngôn ngữ của máy chủ. 1380 bài unit.
8. Kiểm thật trên database thử (oracle độc lập từ dòng thô, ranh giới 17:30Z với ba múi giờ phiên, tổng vượt 2,1 tỷ, thanh toán đồng thời trong lúc đọc, các điều khiển âm còn lại) và `EXPLAIN` thống kê một lần, cập nhật `verify.md`; tài liệu: thêm request thống kê vào Postman folder 22, `api-for-frontend.md` thêm mục 6.38 `Doanh thu (admin)` (kèm lưu ý chuỗi thưa cần FE điền ô trống, hai cột ngày khác nhau của hai API, và `paid` là thanh toán thử), sửa mục 10 và nhật ký, satisfies **AC-6** đến **AC-9**. **Xong 2026-10-21** trên database thử: 139 kiểm tra HTTP và SQL (oracle độc lập tính bằng JavaScript từ dòng thô ở mười ba tổ hợp tham số, cặp ranh giới quanh 17:30Z, 30 đơn 100.000.000 ra 3.000.000.000 ở cả ba tổng, sửa tên và giá gói rồi đọc lại, 48 lần tạo và trả đơn đồng thời trong lúc gọi thống kê 198 lần mà mọi phản hồi đều có ba tổng bằng nhau, bộ đếm đọc của PostgreSQL cho ca bị từ chối); chạy lại 137 kiểm tra dưới ba múi giờ phiên (`UTC`, `America/Los_Angeles`, `Pacific/Kiritimati`); bốn điều khiển âm đều bị bắt (bỏ `status = 'paid'` làm 21 kiểm tra sai, múi giờ `UTC` làm 15 sai, ép `SUM` về `int4` làm lỗi 500 ngay lần gọi đầu, bỏ `@FreshAuth()` làm 4 sai). Không có điều khiển âm cho "ba tổng bằng nhau": mâu thuẫn chỉ xảy ra khi tách thành nhiều câu SQL mà thiết kế cố ý dùng một câu, nên lượt chạy đồng thời chỉ chứng minh nó đúng, không chứng minh kiểm tra bắt được lỗi. `EXPLAIN` ở 50 000 đơn đo một lần, không chỉnh (HTTP trung vị: toàn bộ theo tháng 47 ms, theo ngày 53 ms, một khoảng ngày 31 ms; câu SQL toàn bộ theo tháng 42 đến 90 ms giữa hai lần đo). Tài liệu: Postman folder 22 thêm 13 request (nay 47), FE guide mục 6.38 cùng mục 1, 5, 6.37, 7, 8, 9, 10 và nhật ký; Newman 535 request và 1160 assertion, 0 lỗi, hai lượt liền trên cùng một database.

## Consequences

**Positive**:
- Admin trả lời được "ai mua gói nào, đơn nào còn chờ, doanh thu bao nhiêu và gói nào bán tốt" mà không cần mở database; số liệu luôn là trạng thái ngay lúc gọi, không bảng tổng hợp phải giữ đồng bộ.
- Không bảng, không migration, không biến môi trường, không mã lỗi mới: gọn đúng tinh thần MVP, và tái dùng gần hết thứ có sẵn (`PaginationQueryDto`, `Page`, `NEWEST_FIRST`, `ORDER_STATUSES`, `@FreshAuth`, `@Header`).
- Một câu SQL cho cả ba con số tổng nên thống kê không bao giờ tự mâu thuẫn; tổng của danh sách đối chiếu được bằng cách cộng tay các dòng.
- Giữ nguyên `OrdersService` và các quyền chủ sở hữu; không đụng đường mua và thanh toán.

**Negative / tradeoffs**:
- Hai API dùng hai cột ngày khác nhau (danh sách theo `created_at`, doanh thu theo `paid_at`). Cùng một khoảng ngày có thể cho `summary.paidAmount` khác `revenue.paidAmount`, nhất là khi đơn tạo cuối tháng và trả đầu tháng sau (đơn chờ không tự hết hạn nên khoảng cách này có thể dài). Tài liệu FE phải nói rõ để không hiểu nhầm.
- `paid` chỉ là chủ trọ tự bấm, không thu tiền: mọi số "doanh thu" ở đây là tiền của thanh toán thử.
- Không có chỉ mục cho `created_at` hay `paid_at` toàn hệ thống, nên danh sách không lọc và thống kê theo khoảng ngày quét bảng `orders`. Ổn ở vài nghìn đơn; ở khoảng 50 nghìn sẽ đo một lần rồi giữ nguyên (đơn ít hơn nhiều so với tin). Nếu sau này chậm, thêm chỉ mục `(created_at, id)` và chỉ mục một phần theo `paid_at` khi `status = 'paid'`.
- Chuỗi `series` thưa: FE phải tự điền ngày hay tháng không có đơn bằng 0 nếu muốn vẽ biểu đồ liền.
- `byPlan` dùng tên hiện tại của gói; một gói đổi tên thì mọi đơn cũ của nó hiện dưới tên mới, trong khi từng dòng đơn ở `GET /orders/all` giữ tên lúc bán.
- `items`, `total` và `summary` của danh sách là ba câu truy vấn riêng nên khi có thanh toán đang diễn ra chúng có thể lệch nhau một đơn trong khoảnh khắc đó (giống mọi danh sách khác của dự án); thống kê thì không lệch vì một câu.
- Không có giới hạn tần suất và không có nhật ký đọc: token admin bị đánh cắp có thể lật hết các trang và chép tên, email chủ trọ cùng số tiền họ trả. Giảm nhẹ bằng `@FreshAuth`, access token ngắn hạn, và chỉ admin gọi được (cùng lựa chọn của 0007).
- Mỗi lần gọi đọc thêm một dòng `users` để kiểm lại admin (`@FreshAuth`); chỉ admin gọi nên chấp nhận.
- Token mới của chủ trọ dài hơn một chút (ba khóa lẻ thay một khóa gộp `order:manage`), và `isAdminOnly('order:manage')` đổi từ `false` sang `true`; test của danh mục quyền phải sửa theo. Token cũ còn hạn mang `order:manage` chỉ bị chặn ở hai route admin nhờ `@FreshAuth()`, nên hai route này không được bỏ decorator đó.
- Phụ thuộc Postgres nhận tên múi giờ `Asia/Ho_Chi_Minh` trong `AT TIME ZONE`; database dùng khi đóng gói phải có dữ liệu múi giờ (image `postgres` chính thức có sẵn).

**Neutral**:
- Thêm `AdminOrdersController`, `AdminOrdersService`, hai hàm đọc của `OrdersRepository`, hai DTO, một mapper, và `src/common/time/app-time-zone.ts` (mã dùng chung đầu tiên về múi giờ của dự án).
- Quyền `order:report` không cần migration vì admin tính quyền trong code.
- Số `0010` không trùng spec nào. Spec này đóng hạng mục "admin xem đơn của mọi người và số liệu doanh thu" mà 0004 đã hoãn, và đưa một phần "dashboard doanh thu" (mục hoãn khỏi MVP) vào kế hoạch ở dạng API, chưa có biểu đồ hay xuất file.

## Follow-up

- [ ] Hoãn, thêm lại bằng `/scope` khi cần: tìm đơn theo mã hay theo email chủ trọ, chuỗi doanh thu điền đủ ô trống, đếm đơn `pending` và `cancelled` trong thống kê, doanh thu theo từng chủ trọ, so sánh với kỳ trước, xuất CSV, tham số `sort`, chỉ mục cho `created_at` và `paid_at`, giới hạn tần suất và nhật ký đọc cho hai route, múi giờ chọn được, hoàn tiền (cần cổng thanh toán thật).
- [ ] Spec 0003 AC-8 liệt kê route bắt buộc `@FreshAuth()` chỉ gồm thao tác ghi cộng `GET /users` của 0007; cần `/architect` thêm `GET /orders/all` và `GET /orders/revenue`. AC-11 của 0003 nói báo cáo doanh thu "khi làm lại thì cũng là module chỉ admin": nay là một hành động chỉ admin `order:report` trong module `order`, cần sửa câu cho khớp. Bảng quyền của 0003 thêm dòng `order:report`.
- [ ] Sau khi build, `/sync` ghi vào spec 0004 rằng admin đã xem được đơn qua `GET /orders/all` (mục Negative và Follow-up của 0004 đang nói chưa có), và vào 0005 nếu mô tả quyền `order` cần cập nhật; scope hàng 17 chuyển sang `done` theo `/develop`.
- [ ] Khi đóng gói (spec `0001/0006-docker-packaging-and-release.md`), xác nhận image Postgres có dữ liệu múi giờ để `AT TIME ZONE 'Asia/Ho_Chi_Minh'` chạy.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
