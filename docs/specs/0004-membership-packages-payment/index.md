# 0004. Mua gói bằng thanh toán thử và gia hạn theo tháng

**Date**: 2026-10-19
**Status**: Accepted

## Summary

Chủ trọ xem bảng giá gói, chọn một gói để tạo đơn, rồi bấm thanh toán thử: đơn thành `paid` và gói có hiệu lực ngay, không có tiền thật. Mỗi đơn mua đúng một kỳ (mặc định 30 ngày) và các kỳ nối tiếp nhau, nên mua thêm là cộng một kỳ vào cuối gói đang chạy. Khi có gói đang chạy, hạn mức tin của chủ trọ là số tin đã chốt trên đơn, thay cho hạn mức dùng thử, và đi qua đúng hàm hạn mức cùng mảnh điều kiện hiển thị của 0003. Giá, số tin và số ngày được chốt vào đơn lúc tạo, nên admin sửa gói chỉ ảnh hưởng đơn tạo sau đó.

## Requirements

**User stories**:
- Là chủ trọ hết hoặc sắp hết dùng thử, tôi muốn xem bảng giá, mua một gói bằng thanh toán thử và thấy tin của mình hiện lại ngay, để tiếp tục đăng tin.
- Là chủ trọ, tôi muốn gia hạn bằng cách mua thêm và biết gói đã trả đến ngày nào, để không bị mất tin bất ngờ.
- Là chủ trọ, tôi muốn xem lịch sử đơn và hủy một đơn chưa trả, để đổi ý chọn gói khác.
- Là admin, tôi muốn tạo, sửa, tắt và xóa gói, kể cả giá và số tin, mà không sửa code.

**Acceptance criteria** (hợp đồng build, mỗi điều kiện kiểm được riêng):
- **AC-1**: `GET /plans` (công khai, không cần đăng nhập) trả các gói đang bán (`is_active = true`), xếp theo giá tăng dần rồi theo tên, có phân trang. Mỗi gói chỉ có `id`, `name`, `price`, `maxListings`, `durationDays`. Gói đã tắt không xuất hiện.
- **AC-2**: Admin quản lý gói. `GET /plans/all` (quyền `plan:read`) liệt kê cả gói đã tắt, kèm `isActive`, `createdAt`, `updatedAt`. `POST /plans` (`plan:create`), `PATCH /plans/:id` (`plan:update`), `DELETE /plans/:id` (`plan:delete`); ba lệnh ghi đều có `@FreshAuth()`. Giá trị ngoài khoảng (`name` dài 2 đến 60 ký tự, `price` từ 0 đến 100.000.000, `maxListings` từ 1 đến 1000, `durationDays` từ 1 đến 365, mặc định 30) bị 400 `VALIDATION_FAILED`. Tên trùng bị 409 `PLAN_NAME_TAKEN`. Gói không có bị 404 `PLAN_NOT_FOUND`. `DELETE` chỉ xóa được gói chưa có đơn nào tham chiếu, ngược lại 409 `PLAN_IN_USE` (muốn ngừng bán thì `PATCH` `isActive` thành `false`). Chủ trọ và người tìm trọ gọi các lệnh này bị 403 `PERMISSION_DENIED`.
- **AC-3**: `POST /orders` với `{ "planId" }` (quyền `order:create`, và **chỉ tài khoản loại `landlord`**: admin có mọi quyền trong code nên qua được kiểm quyền, nhưng bị Service từ chối 403 `PERMISSION_DENIED` để mỗi loại tài khoản giữ một vai). Gói không có thì 404 `PLAN_NOT_FOUND`, gói đã tắt thì 409 `PLAN_INACTIVE`; còn lại 201 trả một đơn `pending` có `code` 8 ký tự duy nhất, và `planName`, `price`, `maxListings`, `durationDays` **chốt từ gói tại lúc tạo**. Nếu chủ trọ đang có một đơn `pending`, đơn đó thành `cancelled` trong cùng giao dịch, nên sau mỗi lần tạo mỗi chủ trọ có tối đa một đơn `pending` (DB chặn bằng chỉ mục duy nhất một phần).
- **AC-4**: `GET /orders` (quyền `order:read`) trả đơn của chính người gọi, mới nhất trước, có phân trang, lọc `status` tùy chọn. `GET /orders/:id` trả một đơn: không có thì 404 `ORDER_NOT_FOUND`, của chủ trọ khác thì 403 `NOT_RESOURCE_OWNER`. Đơn `paid` có `startsAt` và `endsAt` của kỳ gói, đơn khác để `null`.
- **AC-5**: `POST /orders/:id/pay` (quyền `order:create`). Thứ tự báo lỗi: 404 `ORDER_NOT_FOUND` hoặc 403 `NOT_RESOURCE_OWNER`, rồi trạng thái đơn, rồi gói. Đơn `pending` thì trong **một giao dịch** đơn thành `paid` (`paid_at` là `now`) và một kỳ gói được tạo, trả 200 đơn kèm kỳ; lỗi giữa chừng không để lại đơn `paid` thiếu kỳ hay kỳ thiếu đơn. Gói của đơn đã tắt thì 409 `PLAN_INACTIVE` và đơn vẫn `pending`. Đơn `cancelled` thì 409 `ORDER_STATE_INVALID`. Đơn đã `paid` thì 200 trả đúng kết quả lần trước, không tạo kỳ mới. Bấm đồng thời nhiều lần trên cùng một đơn chỉ tạo đúng một kỳ.
- **AC-6**: Kỳ gói nối tiếp, không chồng nhau. Kỳ mới bắt đầu ở thời điểm lớn hơn trong hai giá trị: `now`, và `ends_at` lớn nhất trong các kỳ của chủ trọ; kết thúc sau đó đúng `durationDays` ngày đã chốt trên đơn, chính xác đến mili giây. Mua khi chưa có kỳ nào đang chạy thì kỳ bắt đầu đúng `now`. Mua khi đang có gói thì kỳ mới nối vào cuối, kể cả khi là gói khác. Hai kỳ của cùng một chủ trọ không bao giờ chồng thời gian (DB chặn bằng ràng buộc loại trừ). Mỗi đơn có tối đa một kỳ.
- **AC-7**: `POST /orders/:id/cancel` (quyền `order:cancel`). Đơn `pending` của chính mình thành `cancelled` (`cancelled_at` là `now`), trả 200; đơn đã `cancelled` thì 200 trả đúng kết quả cũ; đơn `paid` thì 409 `ORDER_STATE_INVALID` (hoàn tiền đã hoãn khỏi MVP). Lỗi sở hữu như AC-4. Hủy đơn không đổi hạn mức.
- **AC-8**: Hạn mức theo gói. `MembershipsService.resolve` (spec 0003 AC-3) thêm nhánh đầu: chủ trọ có kỳ đang chạy (`starts_at <= now < ends_at`, so chặt: đúng lúc `ends_at` là hết) thì `state = 'plan'` và hạn mức là `maxListings` đã chốt trên đơn của kỳ đó; không thì giữ như cũ (dùng thử, rồi 0). Mua gói không đổi `trial_ends_at`. Cổng đăng và hiện tin (0003 AC-4, AC-5) dùng hạn mức này: có gói thì đủ số tin của gói là 403 `LISTING_QUOTA_REACHED`, và không còn `MEMBERSHIP_REQUIRED`. Thanh toán xong chủ trọ hết dùng thử đăng được ngay.
- **AC-9**: Hiển thị công khai theo gói. Mảnh điều kiện hiển thị của 0003 (AC-8, AC-9) tính hạn mức hiệu lực của từng chủ trọ là `maxListings` của kỳ đang chạy nếu có, không thì hạn mức dùng thử còn hiệu lực, không thì 0; tin qua khi hạng của nó nhỏ hơn hạn mức đó. Vì vậy chủ trọ vừa mua gói có tin hiện lại ngay mà không cần `trial_ends_at` còn hạn; gói hết hạn và dùng thử đã hết thì mọi tin biến ngay, không cần việc nền; gói hết mà dùng thử còn thì quay lại hạn mức dùng thử. Hạn mức của gói thấp hơn số tin đang hiện thì chỉ các tin đăng sớm nhất còn hiện (cùng luật hạng của 0003, không luật mới). Các vế `status`, xóa mềm, chủ trọ `active` giữ nguyên.
- **AC-10**: `GET /me/membership` (0003 AC-10) thêm: `state` có thêm giá trị `plan`; thêm trường `subscription` là `null` khi không có kỳ đang chạy, ngược lại `{ orderCode, planName, startsAt, endsAt, daysLeft, paidUntil }` (`daysLeft` làm tròn lên, `paidUntil` là `ends_at` lớn nhất trong các kỳ của chủ trọ, tức đã trả đến đâu). `listingLimit`, `remaining`, `overLimitCount` tính theo hạn mức gói khi `state = 'plan'`. `trialDaysLeft` chỉ phụ thuộc `trialEndsAt` và `now`, không phụ thuộc `state`: còn dùng thử thì làm tròn lên số ngày, đã hết thì 0, không có `trialEndsAt` thì `null`. Cờ `isPublic` (0003 AC-11) tính theo hạn mức mới mà không cần sửa thêm.
- **AC-11**: Phân quyền. Chủ trọ có sẵn `order:create`, `order:read`, `order:cancel`, `subscription:read` (không cần migration quyền). Người tìm trọ gọi bất kỳ API đơn nào bị 403 `PERMISSION_DENIED`. Admin giữ mọi quyền trong code nhưng quy tắc chủ sở hữu cố định (0001 con 0003 AC-5) áp cho cả admin: `GET /orders` chỉ trả đơn của chính họ (không có), `GET`, `pay`, `cancel` đơn của người khác bị 403 `NOT_RESOURCE_OWNER`, và admin không tạo được đơn (AC-3). Admin quản lý gói qua `plan:*`. Chưa đăng nhập thì 401. Mọi thao tác trên đơn chỉ với đơn của chính người gọi.
- **AC-12**: Một migration thêm ba bảng `plans`, `orders`, `subscriptions` cùng mọi ràng buộc và phần mở rộng `btree_gist`; áp được lên DB trống lẫn DB có dữ liệu; `prisma migrate diff` không báo lệch (hoặc, nếu ràng buộc loại trừ làm Prisma báo lệch, xử lý theo 0005, mục Migration và seed). Seed thêm ba gói mẫu còn thiếu theo `name` (Cơ bản 5 tin 99.000 đ, Nâng cao 15 tin 199.000 đ, Chuyên nghiệp 50 tin 399.000 đ, mỗi gói 30 ngày), chạy lại không ghi đè gói admin đã sửa hay đã xóa (gói mẫu đã xóa sẽ quay lại ở lần seed sau, như `amenities`).
- **AC-13**: Giới hạn tần suất. `POST /orders`, `POST /orders/:id/pay`, `POST /orders/:id/cancel` cùng nhóm `orderWrite`: 30 lần mỗi giờ theo người dùng (mỗi route đếm riêng, như `listingWrite`); `GET /plans` dùng `publicRead` (300 lần mỗi phút theo IP). Quá hạn thì 429 `RATE_LIMITED`. Lệnh ghi gói của admin không có giới hạn thêm.

## Decision

**Chosen option**: Option 1: Ba bảng `plans`, `orders`, `subscriptions`; đơn chốt giá và số tin lúc tạo; mỗi đơn đã trả sinh một kỳ gói nối tiếp, DB chặn chồng kỳ; thanh toán trong một giao dịch khóa dòng `users` rồi dòng đơn; hạn mức gói cắm vào hàm `resolve` và mảnh SQL hiển thị của 0003.

Hạn mức hiện hành lấy từ kỳ đang chạy (suy ra lúc đọc, không cờ lưu thêm). Không có cổng thanh toán, không bảng `payments`, không biến môi trường mới.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Feature design

Quy ước chung theo bộ spec nền 0001 (các con 0001 đến 0006), nhà trọ 0002 và dùng thử 0003: Repository bọc Prisma (chỉ `*.repository.ts` import giá trị từ Prisma), id `uuidv7()`, `timestamptz`, tiền là số nguyên đồng, tên bảng và cột `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`, giao dịch qua `TransactionRunner`, mã lỗi trong `ErrorCode` với câu tiếng Việt, API có tiền tố `/api/v1`, `now` lấy một lần mỗi request ở controller rồi truyền xuống.

**Data model sketch** (một migration, tên dạng `<ngày>_membership_plans_orders`; mọi bảng có `id`, `created_at`, `updated_at`):

| Bảng | Cột | Ràng buộc và chỉ mục |
|---|---|---|
| `plans` (mới) | `name` (text), `price` (integer, đồng), `max_listings` (integer), `duration_days` (integer, mặc định 30), `is_active` (boolean, mặc định `true`) | `plans_name_unique`; `CHECK` `name` dài 2 đến 60, `price` từ 0 đến 100000000, `max_listings` từ 1 đến 1000, `duration_days` từ 1 đến 365 |
| `orders` (mới) | `code` (text, 8 ký tự), `user_id` (uuid), `plan_id` (uuid), **bản chốt** `plan_name`, `price`, `max_listings`, `duration_days`, `status` (text), `paid_at` và `cancelled_at` (`timestamptz`, rỗng được) | `orders_code_unique`; `CHECK` `status` chỉ `pending`, `paid`, `cancelled`; `CHECK` `paid_at` có khi và chỉ khi `status = 'paid'`, `cancelled_at` có khi và chỉ khi `status = 'cancelled'`; chỉ mục duy nhất một phần `orders_user_pending_unique` trên `(user_id)` khi `status = 'pending'`; chỉ mục `(user_id, created_at DESC, id DESC)` cho lịch sử đơn và chỉ mục `(plan_id)`; khóa ngoại `user_id` tới `users` và `plan_id` tới `plans`, đều `RESTRICT` |
| `subscriptions` (mới) | `user_id` (uuid), `order_id` (uuid), `starts_at`, `ends_at` (`timestamptz`) | `subscriptions_order_id_unique` (một đơn một kỳ); `CHECK` `ends_at > starts_at`; ràng buộc loại trừ `subscriptions_user_period_excl`: `EXCLUDE USING gist (user_id WITH =, tstzrange(starts_at, ends_at) WITH &&)` (cần `CREATE EXTENSION IF NOT EXISTS btree_gist` trong migration); chỉ mục `(user_id, ends_at DESC)` để lấy `ends_at` lớn nhất; khóa ngoại tới `users` và `orders`, `RESTRICT` |

Quan hệ: `users` 1 nhiều `orders`; `plans` 1 nhiều `orders`; `orders` 1 với 0 hoặc 1 `subscriptions`; `users` 1 nhiều `subscriptions`. Không đổi gì ở `users`, `listings`, `settings`. Kỳ gói không lưu tên gói hay số tin: đọc từ đơn đã chốt qua `order_id`. Cột bản chốt trên `orders` là hồ sơ lịch sử của lúc mua, không phải bản sao phải giữ khớp, nên không vi phạm quy ước "không sao chép dữ liệu" của 0005; các cột đó không bao giờ được cập nhật sau khi tạo đơn. `CHECK` và ràng buộc loại trừ viết bằng SQL trong migration (Prisma không diễn đạt được; ghi chú xử lý lệch ở AC-12).

**State transitions**:
- Đơn: `pending` → `paid` (thanh toán) hoặc `pending` → `cancelled` (chủ trọ hủy, hoặc bị thay khi tạo đơn mới). `paid` và `cancelled` là trạng thái cuối. Thanh toán lại đơn `paid` và hủy lại đơn `cancelled` là thao tác an toàn trả kết quả cũ (200); thanh toán đơn `cancelled` và hủy đơn `paid` là 409 `ORDER_STATE_INVALID`.
- Kỳ gói: không có trạng thái lưu. "Sắp tới", "đang chạy", "đã hết" suy ra từ `starts_at`, `ends_at` và `now`.

**Hạn mức hiện hành** (`MembershipsService.resolve(userId, now, tx?)`, vẫn một nơi duy nhất; thêm nhánh đầu cho 0003):
1. Có kỳ đang chạy: `state = 'plan'`, hạn mức là `orders.max_listings` của đơn của kỳ đó. Truy vấn: kỳ của `userId` có `tstzrange(starts_at, ends_at) @> $now` (khoảng nửa mở: `starts_at` tính, `ends_at` không tính), nối `orders` qua `order_id`. Ràng buộc loại trừ bảo đảm có tối đa một kỳ như vậy.
2. Còn lại như 0003: `trial_ends_at` lớn hơn `now` thì `state = 'trial'` với `trial_listing_limit`; không thì `expired` với hạn mức 0.

**Điều kiện hiển thị công khai** (sửa `publicListingCondition` của 0003, vẫn viết đúng một lần): hạn mức hiệu lực của chủ trọ là

```sql
-- u = users; plan = kỳ đang chạy nối đơn (có thể không có); $now và $trialLimit do ứng dụng truyền vào
COALESCE(plan.max_listings,
         CASE WHEN u.trial_ends_at > $now THEN $trialLimit ELSE 0 END)
```

với `plan` là `LEFT JOIN LATERAL (SELECT o.max_listings FROM subscriptions s JOIN orders o ON o.id = s.order_id WHERE s.user_id = u.id AND tstzrange(s.starts_at, s.ends_at) @> $now::timestamptz LIMIT 1) plan ON true`. Vế `u.trial_ends_at > $now` riêng lẻ của 0003 được thay bằng biểu thức trên: tin qua khi hạng của nó (số tin `visible` chưa xóa cùng chủ trọ đăng trước) nhỏ hơn hạn mức hiệu lực. Hạn mức 0 thì không tin nào qua. `$now` vào SQL dưới dạng chuỗi ISO có `Z` như 0003 (bài học múi giờ). Các vế `status = 'visible'`, xóa mềm, `u.status = 'active'` giữ nguyên.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/plans` | GET | `page`, `pageSize` | trang gói đang bán `{ id, name, price, maxListings, durationDays }` | công khai, `publicRead` | 400 `VALIDATION_FAILED`, 429 |
| `/plans/all` | GET | `page`, `pageSize` | trang mọi gói, thêm `isActive`, `createdAt`, `updatedAt` | `plan:read` | 403 |
| `/plans` | POST | `name`, `price`, `maxListings` (bắt buộc); `durationDays`, `isActive` (tùy chọn) | 201 gói | `plan:create`, `@FreshAuth()` | 400, 409 `PLAN_NAME_TAKEN`, 403 |
| `/plans/:id` | PATCH | một hay nhiều trường như trên | gói sau khi sửa | `plan:update`, `@FreshAuth()` | 400, 404 `PLAN_NOT_FOUND`, 409 `PLAN_NAME_TAKEN`, 403 |
| `/plans/:id` | DELETE | không | 204 | `plan:delete`, `@FreshAuth()` | 404 `PLAN_NOT_FOUND`, 409 `PLAN_IN_USE`, 403 |
| `/orders` | POST | `planId` (uuid, bắt buộc) | 201 đơn | `order:create` và loại `landlord`, `orderWrite` | 400, 403 `PERMISSION_DENIED` (admin), 404 `PLAN_NOT_FOUND`, 409 `PLAN_INACTIVE`, 429 |
| `/orders` | GET | `status`, `page`, `pageSize` | trang đơn của tôi | `order:read` | 400 |
| `/orders/:id` | GET | không | đơn | `order:read` | 400 `INVALID_ID`, 404 `ORDER_NOT_FOUND`, 403 `NOT_RESOURCE_OWNER` |
| `/orders/:id/pay` | POST | không | 200 đơn `paid` kèm `startsAt`, `endsAt` | `order:create`, `orderWrite` | 404, 403, 409 `ORDER_STATE_INVALID`, 409 `PLAN_INACTIVE`, 429 |
| `/orders/:id/cancel` | POST | không | 200 đơn `cancelled` | `order:cancel`, `orderWrite` | 404, 403, 409 `ORDER_STATE_INVALID`, 429 |
| `/me/membership` | GET | không | thêm `state = 'plan'` và `subscription` | `subscription:read` | như 0003 |

Hình dạng một đơn (dùng chung cho mọi API đơn):

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
  "createdAt": "2026-10-19T02:59:30.000Z"
}
```

`startsAt` và `endsAt` là `null` khi đơn chưa `paid`. Hình dạng `subscription` của `/me/membership`: `{ "orderCode": "k7m2xq9p", "planName": "Nâng cao", "startsAt": "...", "endsAt": "...", "daysLeft": 30, "paidUntil": "..." }`.

Mã lỗi mới (thêm vào `ErrorCode`, câu tiếng Việt):

| Mã | Status | Khi nào | Câu |
|---|---|---|---|
| `PLAN_NOT_FOUND` | 404 | Gói không có (đặt đơn, sửa, xóa) | "Không tìm thấy gói." |
| `PLAN_NAME_TAKEN` | 409 | Tạo hoặc sửa gói trùng tên | "Tên gói này đã có. Hãy chọn tên khác." |
| `PLAN_IN_USE` | 409 | Xóa gói đã có đơn | "Gói này đã có đơn đặt nên không xóa được. Hãy tắt gói thay vì xóa." |
| `PLAN_INACTIVE` | 409 | Đặt đơn hoặc thanh toán gói đã tắt | "Gói này đã ngừng bán. Hãy chọn gói khác." |
| `ORDER_NOT_FOUND` | 404 | Đơn không có | "Không tìm thấy đơn." |
| `ORDER_STATE_INVALID` | 409 | Thanh toán đơn đã hủy, hủy đơn đã trả | "Đơn không còn ở trạng thái phù hợp cho thao tác này." |

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Mọi nơi cần "bây giờ" | `now` | đồng hồ ứng dụng, controller lấy một lần mỗi request rồi truyền xuống Service, Repository và SQL (chuỗi ISO có `Z`) |
| Tạo đơn | `user_id` | `sub` của token; `accountType` của token phải là `landlord` |
| Tạo đơn | `plan_name`, `price`, `max_listings`, `duration_days` | dòng `plans` đọc trong chính giao dịch tạo đơn; không bao giờ cập nhật về sau |
| Tạo đơn | `code` | sinh ngẫu nhiên 8 ký tự cùng bảng chữ với mã tin (`generateListingCode`), trùng thì (Prisma `P2002`) sinh mã khác và thử lại tối đa 5 lần bên ngoài giao dịch, như 0002 |
| Tạo đơn | đơn chờ cũ bị hủy | đơn `pending` của `sub`, đọc sau khi khóa dòng `users`; `cancelled_at` là `now` |
| Thanh toán | đơn cần xử lý | `:id` trên đường dẫn, khóa dòng đơn `FOR UPDATE` sau khi khóa dòng `users` của `sub`; chủ đơn phải bằng `sub` |
| Thanh toán | `paid_at` | `now` |
| Thanh toán | `starts_at` | lớn hơn trong `now` và `MAX(ends_at)` của các kỳ của `sub`, đọc sau khi khóa `users` |
| Thanh toán | `ends_at` | `starts_at` cộng `orders.duration_days` nhân 86400000 mili giây |
| Danh sách và chi tiết đơn | `startsAt`, `endsAt` | kỳ có `order_id` bằng đơn; `null` khi chưa có |
| Hạn mức hiện hành | `state`, `limit` | kỳ đang chạy (`orders.max_listings`), nếu không thì `users.trial_ends_at` với `settings.trial_listing_limit` như 0003 |
| `/me/membership` | `subscription.*` | kỳ đang chạy nối đơn của nó; `daysLeft` là `ceil((ends_at - now) / 86400000)`; `paidUntil` là `MAX(ends_at)` của các kỳ của `sub` |
| `/me/membership` | `trialDaysLeft` | `ceil((trialEndsAt - now) / 86400000)` khi `trialEndsAt` lớn hơn `now`; `0` khi đã qua; `null` khi `trialEndsAt` rỗng (không còn phụ thuộc `state`) |
| `GET /plans` | danh sách | `plans` có `is_active`, xếp `price` tăng dần rồi `name` |
| Sửa gói | `updated_at` | cột `updated_at` (`@updatedAt`) |

**Key invariants**:
- Mỗi chủ trọ có tối đa một đơn `pending` (chỉ mục duy nhất một phần), tối đa một kỳ tại mọi thời điểm (ràng buộc loại trừ), và mỗi đơn tối đa một kỳ (`order_id` duy nhất).
- Đơn `paid` có đúng một kỳ và kỳ nào cũng thuộc một đơn `paid`: hai thay đổi này luôn nằm trong cùng một giao dịch (DB không có cách ràng buộc thẳng).
- Các cột bản chốt của đơn (`plan_name`, `price`, `max_listings`, `duration_days`) không đổi sau khi tạo; sửa hay tắt gói không đụng đơn hay kỳ đã có.
- Thứ tự khóa: dòng `users` của người gọi trước, rồi dòng đơn. Đường đăng và hiện tin khóa `users`, rồi `properties`, rồi `listings` (0003); đường thanh toán không đụng `properties` và `listings`, nên không có vòng chờ.
- Hạn mức hiện hành chỉ đến từ `resolve` và hạn mức hiệu lực chỉ từ mảnh SQL hiển thị: không đường kiểm quyền thứ ba.
- Tin có công khai hay không vẫn suy ra từ một mảnh SQL duy nhất; không cờ lưu, không việc nền, gói hết hạn có hiệu lực đúng lúc `ends_at`.

**Security model**:
- Mọi API đơn chỉ chạm đơn của `sub`: đơn của người khác bị 403 `NOT_RESOURCE_OWNER`, kể cả với admin (quy tắc chủ sở hữu của 0001 con 0003). Người tìm trọ không có quyền đơn. Admin có mọi quyền trong code (`ADMIN_PERMISSIONS`) nên qua được guard quyền, vì thế `OrdersService.create` kiểm thêm `accountType` của token phải là `landlord`; nếu không, admin có thể tự mua gói và đăng tin, phá luật "admin không có kỳ dùng thử" của 0003.
- Thanh toán thử là chủ trọ tự xác nhận đơn của chính mình bằng quyền `order:create`; không có quyền xác nhận thay, hoàn tiền hay tặng gói (spec 0001 con 0003).
- Lệnh ghi gói (`POST`, `PATCH`, `DELETE`) có `@FreshAuth()` vì giá và hạn mức của gói quyết định ai được đăng bao nhiêu tin: admin vừa bị khóa hay mất quyền bị từ chối ngay dù token còn hạn.
- Không có dữ liệu thẻ hay dữ liệu cá nhân mới; không có quy định tuân thủ riêng. `paid` ở bản này **không chứng minh đã thu tiền**.
- Chống lạm dụng: nhóm `orderWrite` cho ba lệnh ghi đơn; khóa dòng `users` và chỉ mục duy nhất một phần chặn đơn chờ nhân bản.

**Configuration required**: không có biến môi trường hay bí mật mới. Migration chạy `CREATE EXTENSION IF NOT EXISTS btree_gist` (phần mở rộng "tin cậy" có sẵn trong image `postgres:18`, kiểm trên Postgres 18.1: role chủ database tạo được, như `pg_trgm`).

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: chủ trọ hết dùng thử thấy tin biến, xem `GET /plans`, `POST /orders`, `POST /orders/:id/pay`: đơn `paid`, `GET /me/membership` ra `state = 'plan'` với hạn mức của gói, `GET /listings` có lại tin của họ, đăng thêm tin tới đúng hạn mức của gói, verifies **AC-1**, **AC-3**, **AC-5**, **AC-8**, **AC-9**, **AC-10**
- Happy path: có gói đang chạy, mua thêm cùng gói: kỳ mới bắt đầu đúng `ends_at` của kỳ trước và kéo dài đúng `durationDays`; `paidUntil` dời tới cuối kỳ mới; mua gói khác khi đang có gói: cũng nối vào cuối, hạn mức vẫn là của gói đang chạy cho tới khi kỳ đó hết, verifies **AC-6**, **AC-10**
- Failure case: bấm `pay` đồng thời 10 lần trên cùng một đơn: đúng một kỳ, mọi lần trả 200 cùng kết quả; hai đơn của cùng chủ trọ không thể cùng `pending`, verifies **AC-3**, **AC-5**, **AC-6**
- Failure case: gói hết hạn (đặt `ends_at` về quá khứ, dùng thử đã hết) thì mọi tin biến ngay, đăng bị `MEMBERSHIP_REQUIRED`; gói hết nhưng dùng thử còn thì quay lại hạn mức dùng thử; hạn mức gói thấp hơn số tin đang hiện thì chỉ các tin đăng sớm nhất còn hiện, `isPublic` đúng, verifies **AC-8**, **AC-9**, **AC-10**
- Failure case: admin tắt gói khi chủ trọ có đơn `pending`: `pay` trả `PLAN_INACTIVE` và đơn vẫn `pending`; admin sửa giá và số tin sau khi tạo đơn: đơn và kỳ đã có không đổi; `DELETE` gói đã có đơn: `PLAN_IN_USE`, gói chưa có đơn: 204, verifies **AC-2**, **AC-3**, **AC-5**
- Failure case: tạo đơn thứ hai khi còn đơn `pending`: đơn cũ thành `cancelled`, chỉ còn một `pending`; hủy đơn `paid`: `ORDER_STATE_INVALID`; hủy lại đơn đã hủy: 200, verifies **AC-3**, **AC-7**
- Failure case: `INSERT` tay hai kỳ chồng nhau của cùng chủ trọ bị ràng buộc loại trừ chặn; hai kỳ liền nhau (`ends_at` của kỳ trước bằng `starts_at` của kỳ sau) được, verifies **AC-6**
- Auth/permission: người tìm trọ gọi API đơn: 403 `PERMISSION_DENIED`; admin gọi `POST /orders`: 403 `PERMISSION_DENIED`, `GET /orders` của admin trả rỗng; chủ trọ và người tìm trọ gọi lệnh ghi gói: 403; admin vừa bị khóa gọi `POST /plans` với token còn hạn: bị từ chối do `@FreshAuth()`; chủ trọ A xem hay thanh toán hay hủy đơn của B: 403 `NOT_RESOURCE_OWNER`, verifies **AC-2**, **AC-3**, **AC-4**, **AC-11**
- Failure case: seed chạy hai lần: lần hai thêm 0 gói, gói admin đã sửa giá không bị ghi đè; `migrate diff` không lệch, verifies **AC-12**
- Failure case: gọi `POST /orders` 31 lần trong một giờ: lần thứ 31 nhận 429; `GET /plans` quá 300 lần mỗi phút theo IP nhận 429, verifies **AC-13**

## Build plan

Theo Skateboard (bản mỏng nhất dùng được trước): sau bước 4 vòng "đơn rồi trả rồi có kỳ" đã chạy trọn ở phía ghi; các bước sau cắm kỳ vào hạn mức và phía đọc. Chia mốc cho scope: Mốc 1 gồm bước 1 và 2; Mốc 2 gồm bước 3 và 4; Mốc 3 gồm bước 5 đến 8.

1. Migration `<ngày>_membership_plans_orders`: ba bảng và mọi `CHECK`, chỉ mục, khóa ngoại ở trên, `CREATE EXTENSION IF NOT EXISTS btree_gist`, ràng buộc loại trừ; cập nhật `schema.prisma`; áp lên DB và xác nhận schema đã có thật; chạy `prisma migrate diff` (nếu ràng buộc loại trừ làm Prisma báo lệch hoặc đòi xóa chỉ mục, xử lý theo 0005: so `pg_dump --schema-only`, hoặc khai báo chỉ mục `gist` trong `schema.prisma` nếu Prisma nhận; nếu vẫn không giải được thì dừng và quay lại `/architect`, không âm thầm bỏ ràng buộc); seed ba gói mẫu theo `name` (`INSERT ... ON CONFLICT DO NOTHING`); sáu mã lỗi mới trong `ErrorCode`; nhóm `orderWrite` trong `rate-limits.ts`, satisfies **AC-12**, **AC-13** (đã build ở mốc 1, 2026-10-19: migration `20261019090000_membership_plans_orders` áp lên DB trống và DB có dữ liệu, `migrate diff` không báo lệch nên ràng buộc loại trừ không làm Prisma báo lệch và không cần phương án dự phòng; đã hỏi DB thật: phần mở rộng `btree_gist`, ba bảng, mọi `CHECK`, chỉ mục duy nhất một phần và ràng buộc loại trừ đều có; seed `src/database/seed-plans.ts` bằng `createMany` với `skipDuplicates`, chạy lần hai thêm 0 gói và không ghi đè gói đã sửa giá; sáu mã lỗi và nhóm `orderWrite` 30 lần mỗi giờ theo người dùng đã có, chưa route nào dùng nhóm này. Lưu ý khi viết test DB: khóa ngoại `RESTRICT` báo SQLSTATE `23001`, không phải `23503`)
2. Module `plans`: Repository, Service, DTO có kiểm khoảng, mapper; `GET /plans` công khai (`publicRead`), `GET /plans/all`, `POST`, `PATCH`, `DELETE` (quyền `plan:*`, `@FreshAuth()` cho ba lệnh ghi); `P2002` trên `plans_name_unique` thành `PLAN_NAME_TAKEN` ở Repository; xóa chỉ khi chưa có đơn (đếm đơn trong Repository, khóa ngoại `RESTRICT` là chốt cuối), satisfies **AC-1**, **AC-2**, **AC-11** (đã build ở mốc 1, 2026-10-19, `src/plans/`: Repository bắt `P2002` thành `PlanNameTakenError`, `P2025` thành "không có gói", `P2003` thành `PlanInUseError`. Lựa chọn nhỏ của người build: xóa gói là **một câu `DELETE` rồi để khóa ngoại `RESTRICT` quyết định** (không đếm đơn trước), cùng kết quả `PLAN_IN_USE` nhưng không có khe hở giữa đếm và xóa khi mốc 2 cho phép tạo đơn cùng lúc; `PATCH` là một câu `UPDATE` nguyên tử, `updated_at` do `@updatedAt` của Prisma đặt; `GET /plans/all` cùng thứ tự với bảng giá; thân `PATCH` rỗng trả 200 không đổi gì)
3. Module `orders`: Repository, Service, mapper; `POST /orders` (kiểm `accountType` là `landlord`, khóa `users`, đọc gói, hủy đơn chờ cũ, chèn đơn, sinh `code` với vòng thử lại ngoài giao dịch), `GET /orders`, `GET /orders/:id`, `POST /orders/:id/cancel`; `startsAt` và `endsAt` nối từ `subscriptions`, satisfies **AC-3**, **AC-4**, **AC-7**, **AC-11**, **AC-13** (đã build ở mốc 2, 2026-10-19, `src/orders/`: Repository, Service, mapper, controller, DTO, module. Lựa chọn nhỏ của người build: cả ba lệnh ghi (tạo, thanh toán, hủy) khóa dòng `users` rồi mới khóa dòng đơn, cùng một thứ tự; `GET /orders/:id` đọc không khóa rồi kiểm chủ bằng `assertOwner`; `PlansRepository` có thêm `findById(id, tx?)` và `PlansModule` export nó để đọc gói ngay trong giao dịch của đơn; mã đơn dùng `generateListingCode` và vòng thử lại 5 lần bên ngoài giao dịch như tin; đơn kèm kỳ gói được đọc lại bằng kết nối thường sau khi giao dịch xong; kiểm `accountType` là `landlord` nằm ở đầu `OrdersService.create`, trước khi mở giao dịch, nên admin và người tìm trọ bị 403 `PERMISSION_DENIED` mà không khóa hay ghi gì)
4. Thanh toán và kỳ gói: `POST /orders/:id/pay` trong một giao dịch (khóa `users` của `sub`, khóa đơn `FOR UPDATE` bằng `$queryRaw` có kiểu, kiểm trạng thái và gói còn bán, chèn kỳ với `starts_at` từ `MAX(ends_at)` và `now`, đổi đơn thành `paid`); `SubscriptionsRepository` có `findActive`, `findLatestEndsAt`, `create`; đơn đã `paid` trả kết quả cũ không tạo kỳ mới, satisfies **AC-5**, **AC-6** (đã build ở mốc 2, 2026-10-19: `OrdersService.pay` chạy trong một giao dịch theo đúng thứ tự trên, `ends_at` lớn nhất đọc bằng `aggregate` của Prisma (không SQL thô nên không dính bài học múi giờ của tham số `Date`). `SubscriptionsRepository` nằm ở `src/subscriptions/` cùng một module nhỏ `SubscriptionsDataModule` (giống `ListingsDataModule`) để mốc 3 dùng lại mà không import vòng; có `findLatestEndsAt`, `findActive` và `create`. `findActive` đã thử ở đúng `starts_at`, 1 mili giây trước `ends_at` và đúng `ends_at` nhưng chưa route nào gọi, mốc 3 mới dùng. Đã thử có điều khiển âm: bỏ khóa dòng `users` và `FOR UPDATE` của đơn trong bản `dist` thì 1 trong 10 lần bấm `pay` đồng thời trả 500, chứng tỏ khóa là thứ cho ra "tất cả 200, cùng kết quả"; riêng khóa ngoại và `subscriptions_order_id_unique` vẫn ngăn được kỳ thứ hai)
5. Hạn mức theo gói: thêm nhánh `plan` vào `MembershipsService.resolve` (kiểu `MembershipState` thêm `plan`, `Membership` thêm thông tin kỳ), đọc qua `tx` khi được truyền để lúc đang giữ khóa không mượn thêm kết nối; cổng đăng và hiện tin của 0003 không đổi code ngoài việc dùng `resolve` đã có, satisfies **AC-8** (đã build ở mốc 3, 2026-10-19: `MembershipState` thêm `plan`, `Membership` thêm `subscription` (kiểu `ActiveSubscription` của `SubscriptionsRepository`); `resolve` đọc người dùng, rồi `findActive`, rồi mới tới `settings`, tuần tự để chạy được trong `tx` mà không mượn thêm kết nối; `MembershipsModule` import `SubscriptionsDataModule`. `assertRoomForOneMore` và `withinQuotaIds` không đổi dòng nào vì chỉ đọc `state` và `limit`. Đã thử 6 lần đăng đồng thời qua hai nhà trọ và 15 lần đăng song song: bỏ khóa `users` thì lọt tin vượt gói, có khóa thì đúng một tin qua)
6. Phía đọc công khai: sửa `publicListingCondition` và phép nối `PUBLIC_FROM` của 0003 theo mục "Điều kiện hiển thị công khai" (hạn mức hiệu lực bằng `COALESCE`), giữ nguyên bộ lọc, `escapeLike`, đọc hai bước; viết thêm test so khớp với truy vấn tay độc lập ở các tổ hợp có gói, không gói, gói hết, dùng thử còn, satisfies **AC-9** (đã build ở mốc 3, 2026-10-19: hằng `PUBLIC_FROM` thành hàm `publicListingFrom(now)` có phép nối `LEFT JOIN LATERAL` với `tstzrange(s.starts_at, s.ends_at) @> $now::timestamptz` (giữ đúng dạng `@>` của spec); `publicListingCondition(now, trialLimit)` giữ chữ ký, vế `u.trial_ends_at > now` đứng riêng được thay bằng `< COALESCE(plan.max_listings, CASE WHEN u.trial_ends_at > now THEN trialLimit::int ELSE 0 END)`; `findPublicPage` và `findPublicByCode` ghép cả hai mảnh với cùng `now`. Hàng 8 mốc 4 (ảnh) phải dùng cả hai mảnh. Kiểm bằng oracle `row_number()` độc lập ở 72 tổ hợp và ranh giới mili giây ở ba múi giờ phiên, chạy trên chính mảnh SQL đã build)
7. `GET /me/membership` thêm `state = 'plan'`, trường `subscription`, `paidUntil`, và sửa `trialDaysLeft` theo `trialEndsAt` thay vì `state`; `isPublic` đi theo hạn mức mới, satisfies **AC-10** (đã build ở mốc 3, 2026-10-19: `toMembershipResponse(membership, visibleCount, paidUntil, now)`; `getStatus` chỉ tra `findLatestEndsAt` khi có kỳ đang chạy và rơi về `ends_at` của kỳ đó nếu không thấy; `trialDaysLeft` chỉ theo `trialEndsAt` và `now`, đúng lúc bằng thì là 0; `isPublic` đi theo `resolve` nên không sửa thêm)
8. Tài liệu sống và kiểm cuối: cập nhật `docs/api/postman-collection.json` (folder mới cho gói và đơn, luồng mua rồi tin hiện lại) và `docs/api/api-for-frontend.md` (API mới, sáu mã lỗi, `state = 'plan'`, `subscription`, nhóm `orderWrite`, nhật ký); script kiểm thật trên DB thử cho đồng thời bấm `pay`, nối kỳ, hết gói, gói hết dùng thử còn, hạ hạn mức theo gói, ràng buộc loại trừ; `verify.md`, satisfies **AC-1** đến **AC-13** (đã build ở mốc 3, 2026-10-19: Postman folder `14 Gói thành hạn mức tin` (16 request, không đăng ký thêm tài khoản, chạy sau folder 11) và sửa assertion tám trường ở folder 11; `docs/api/api-for-frontend.md` mục 6.25 đến 6.27, 7, 8, 9, 10 và nhật ký; ba script kiểm thật trên database thử (46 kiểm tra HTTP và SQL, 36 kiểm tra mảnh SQL với oracle, 12 kiểm tra đồng thời và ràng buộc loại trừ) cùng ba điều khiển âm; Newman folders 00 đến 05 và 07 đến 14: 225 request, 426 assertion, chỉ hai assertion đã biết của folder 02 hỏng; `verify.md` mục "Mốc 3". Chưa đo `EXPLAIN` riêng cho phép nối kỳ gói, ghi ở `verify.md`)

## Consequences

**Positive**:
- Gói cắm vào đúng hai chỗ 0003 đã chừa (hàm hạn mức và mảnh SQL hiển thị), không đường kiểm quyền thứ ba; hàng 11 và 12 dùng lại cùng mảnh điều kiện nên tự đúng với tin của chủ trọ có gói.
- DB giữ những điều quan trọng nhất của tiền và thời gian: một đơn chờ, một kỳ mỗi đơn, không chồng kỳ; code sai hay bỏ sót khóa cũng không tạo được hai gói cùng lúc.
- Đơn chốt giá và số tin nên lịch sử đơn luôn đúng với lúc mua và admin sửa bảng giá thoải mái.
- Thanh toán an toàn khi thử lại (bấm đúp, mạng chậm) mà không cần khóa idempotency riêng; không biến môi trường, không phụ thuộc mạng, demo gọn.
- Muốn thu tiền thật sau này chỉ thêm cổng ở hai bước tạo và xác nhận đơn, mô hình đơn và kỳ không đổi.

**Negative / tradeoffs**:
- `paid` chỉ là chủ trọ tự bấm: hệ thống chưa thu được tiền và không có số liệu doanh thu; admin không xem được đơn của ai (quy tắc chủ sở hữu áp cả cho admin, và chưa có API đơn riêng cho admin).
- Nối tiếp mọi đơn nghĩa là nâng lên gói lớn hơn khi đang có gói phải chờ gói cũ hết mới có hạn mức mới; không đổi gói ngay, không cắt gói cũ, không hoàn tiền.
- Thêm một phép nối `LEFT JOIN LATERAL` (kỳ đang chạy) vào mỗi tin ứng viên ở đường đọc công khai, cộng vào chi phí đã vượt ngân sách ở 60 nghìn tin (AC-13 của 0003 đã đo, chưa đạt, bỏ qua có chủ đích vì là MVP); chưa đo riêng phần này.
- Phụ thuộc phần mở rộng `btree_gist` và một ràng buộc loại trừ mà Prisma không diễn đạt được: có rủi ro `migrate diff` báo lệch, phải xử lý bằng quy tắc của 0005 hoặc quay lại `/architect`.
- Đơn chờ không tự hết hạn (không việc nền): một đơn `pending` bỏ dở nằm đó cho tới khi chủ trọ hủy hoặc tạo đơn mới.
- Chủ trọ mua gói rẻ hơn hạn mức dùng thử (gói 1 tin trong lúc dùng thử 2 tin) sẽ bị giảm hạn mức vì gói thay dùng thử khi còn hiệu lực; seed mặc định (5, 15, 50 tin) không gặp ca này nhưng admin có thể tạo gói như vậy.

**Neutral**:
- `trial_ends_at` không đổi khi mua gói; gói hết mà dùng thử còn (khi admin đặt `trial_days` dài) thì chủ trọ quay lại hạn mức dùng thử. Với mặc định 30 ngày thì dùng thử thường đã hết trước khi gói đầu tiên hết.
- Hàm `trialDaysLeft` của 0003 đổi cách tính (theo `trialEndsAt`, không theo `state`) vì `state` nay có thêm `plan`; hợp đồng bảy trường của `/me/membership` giữ nguyên.
- Quyền `plan`, `order`, `subscription` đã có trong danh mục và quyền mặc định, nên không cần migration quyền; `GET /permissions` không đổi.
- Spec này sửa mảnh điều kiện của 0003 (thay một vế) và thêm dòng bảng cho 0005; cần đồng bộ sau khi build (xem Follow-up).

## Follow-up

- [ ] Sau khi build, đồng bộ các spec khác (`/sync` hoặc `/architect`): 0003 (nhánh `plan` của `resolve` và vế hạn mức hiệu lực của mảnh SQL; `trialDaysLeft` theo `trialEndsAt`; hợp đồng `/me/membership` có `state = 'plan'` và `subscription`); 0005 (cột chi tiết của `plans`, `orders`, `subscriptions`, chỉ mục duy nhất một phần của đơn chờ, ràng buộc loại trừ và `btree_gist`, thứ tự khóa `users` rồi dòng đơn); `docs/scope` hàng 10 và các hàng 11, 12 nếu mô tả cần cập nhật.
- [ ] Hoãn, thêm lại bằng `/scope` khi cần: cổng thanh toán thật (VNPay) kèm webhook có chữ ký và khóa chống trùng; hoàn tiền và tặng gói; admin xem đơn của mọi người và số liệu doanh thu; email biên nhận và email nhắc sắp hết gói (cần việc nền); đổi sang gói khác có hiệu lực ngay (cắt gói cũ); mua nhiều kỳ trong một đơn; mô tả và thứ tự do admin đặt cho gói; tự hủy đơn chờ quá hạn.
- [ ] Nếu bước 1 gặp ràng buộc loại trừ làm Prisma báo lệch và không xử lý được theo 0005: quay lại `/architect` để cân nhắc phương án chỉ khóa `users` ở ứng dụng, không có ràng buộc ở DB (Option 1 biến thể ở `rationale.md`).

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
