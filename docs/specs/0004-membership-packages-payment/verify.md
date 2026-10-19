# Verify: mua gói bằng thanh toán thử · spec 0004 · updated 2026-10-19 (thêm mốc 3)
_Steps derived from spec 0004 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Mốc 1: bảng giá và quản lý gói (AC-1, AC-2, AC-11 phần gói, AC-12, AC-13 phần `GET /plans`)

Chạy trên một database thử (tạo bằng `DATABASE_NAME=<tên> npm run db:create`), không chạy trên database đang dùng. Đăng nhập admin bằng `ADMIN_SEED_*` trong `.env`. Mốc 1 chưa có API đơn, nên các ràng buộc của `orders` và `subscriptions` thử bằng `INSERT` tay.

### Commands
- [ ] `npm run migration:deploy` trên database trống → mọi migration áp xong, không lỗi, có phần mở rộng `btree_gist` → AC-12
- [ ] Dựng database có dữ liệu cũ (áp các migration trước, chèn một chủ trọ, một tenant, một phường), rồi áp `membership_plans_orders` → áp xong, dữ liệu cũ còn nguyên, ba bảng mới có → AC-12
- [ ] `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected", exit 0 (ràng buộc loại trừ không làm Prisma báo lệch) → AC-12
- [ ] Hỏi schema thật: `plans_name_check`, `plans_price_check`, `plans_max_listings_check`, `plans_duration_days_check`; `orders_status_check`, `orders_paid_at_check`, `orders_cancelled_at_check`, `orders_user_pending_unique` (một phần, `status = 'pending'`), `orders_code_unique`; `subscriptions_period_check`, `subscriptions_user_period_excl` (GiST, `user_id WITH =`, `tstzrange(starts_at, ends_at) WITH &&`), `subscriptions_order_id_unique`; sáu khóa ngoại đều `RESTRICT` → AC-12
- [ ] `INSERT INTO plans` với `name` 1 ký tự, `price` -1 hoặc 100000001, `max_listings` 0 hoặc 1001, `duration_days` 0 hoặc 366, và tên trùng gói có sẵn → mỗi lần bị đúng ràng buộc tương ứng chặn → AC-12
- [ ] `INSERT INTO orders` với `status` lạ, đơn `paid` thiếu `paid_at`, đơn `pending` có `paid_at`, đơn `cancelled` thiếu `cancelled_at`, `plan_id` không có → bị `orders_*_check` hoặc `orders_plan_id_fk` chặn → AC-12
- [ ] Hai đơn `pending` của cùng một người dùng → đơn thứ hai bị `orders_user_pending_unique` chặn; `pending` của người khác, nhiều đơn `paid`, nhiều đơn `cancelled` của cùng người dùng → đều qua → AC-3, AC-12
- [ ] Hai kỳ của cùng một người dùng chồng nhau 1 mili giây, kỳ nằm trọn bên trong, kỳ bao trùm → `23P01` từ `subscriptions_user_period_excl`; kỳ liền nhau (`starts_at` bằng đúng `ends_at` kỳ trước), kỳ của người dùng khác cùng khoảng thời gian → qua; `ends_at` bằng hoặc trước `starts_at` → `subscriptions_period_check` chặn; một đơn hai kỳ → `subscriptions_order_id_unique` chặn → AC-6, AC-12
- [ ] Xóa cứng một gói đã có đơn, một đơn đã có kỳ, một người dùng đã có đơn → bị khóa ngoại `RESTRICT` chặn (SQLSTATE `23001`, không phải `23503`) → AC-2, AC-12
- [ ] `npm run seed` lần 1 → "Gói mua: thêm 3 gói mẫu mới"; `plans` có Cơ bản (5 tin, 99000), Nâng cao (15 tin, 199000), Chuyên nghiệp (50 tin, 399000), mỗi gói 30 ngày → AC-12
- [ ] Admin sửa giá và số tin gói Cơ bản (120000, 6 tin) rồi `npm run seed` lần 2 → "thêm 0 gói mẫu mới, 3 đã có", gói Cơ bản vẫn 120000 và 6 tin → AC-12
- [ ] Admin xóa gói Chuyên nghiệp (chưa có đơn) rồi `npm run seed` → "thêm 1 gói mẫu mới", gói quay lại (như `amenities`) → AC-12
- [ ] `npm test` → toàn bộ qua (gồm `plans.service.spec.ts`, `plan-dtos.spec.ts`, `plans.mapper.spec.ts`, `seed-plans.spec.ts`, `rate-limits.spec.ts`) → AC-1, AC-2, AC-12, AC-13

### UI / manual (gọi API, Postman folder `12 Bảng giá và quản lý gói (admin)`)
- [ ] `GET /plans` không token → 200, `{ items, total, page, pageSize }`, `items` xếp giá tăng dần, mỗi gói đúng 5 trường `id, name, price, maxListings, durationDays`, không có `isActive` → AC-1
- [ ] `GET /plans?page=2&pageSize=2` với ba gói → 1 gói (gói đắt nhất), `total` 3; `page=0` hoặc `pageSize=51` → 400 `VALIDATION_FAILED` → AC-1
- [ ] `GET /plans` kèm token chủ trọ hợp lệ → 200; kèm token sai → 200 (route công khai không bao giờ 401) → AC-1
- [ ] Admin tắt một gói (`PATCH` với `isActive` false) → `GET /plans` không còn gói đó và `total` giảm 1; admin `GET /plans/all` vẫn thấy gói đó với `isActive` false → AC-1, AC-2
- [ ] Admin `GET /plans/all` → 200, mỗi gói đúng 8 trường `id, name, price, maxListings, durationDays, isActive, createdAt, updatedAt`, gồm cả gói đã tắt → AC-2
- [ ] Admin `POST /plans` với `name`, `price`, `maxListings` → 201, `durationDays` mặc định 30, `isActive` mặc định `true` → AC-2
- [ ] `POST /plans` ở hai biên (`name` 2 và 60 ký tự, `price` 0 và 100000000, `maxListings` 1 và 1000, `durationDays` 1 và 365) → 201 → AC-2
- [ ] `POST /plans` ngoài biên (`name` 1 hoặc 61 ký tự hay chỉ khoảng trắng, `price` -1, 100000001 hay 1.5 hay chuỗi, `maxListings` 0 hoặc 1001, `durationDays` 0 hoặc 366 hoặc `null`, `isActive` là chuỗi, thiếu trường bắt buộc, trường lạ như `id`) → 400 `VALIDATION_FAILED`, `errors[].field` đúng trường, không gói nào được tạo → AC-2
- [ ] `POST /plans` trùng tên → 409 `PLAN_NAME_TAKEN`, `errors` có `field: "name"` → AC-2
- [ ] `PATCH /plans/:id` đổi giá, số tin, số ngày, tên → 200, `updatedAt` mới, `createdAt` giữ nguyên; thân rỗng → 200 không đổi gì; `price` hay `isActive` là `null` → 400 → AC-2
- [ ] `PATCH` đổi sang tên gói khác → 409 `PLAN_NAME_TAKEN`; id không có → 404 `PLAN_NOT_FOUND`; id sai dạng → 400 `INVALID_ID` → AC-2
- [ ] `DELETE /plans/:id` gói chưa có đơn → 204 không thân; lần hai → 404 `PLAN_NOT_FOUND`; `DELETE` với id sai dạng → 400 `INVALID_ID` → AC-2
- [ ] `INSERT` tay một đơn tham chiếu gói rồi admin `DELETE /plans/:id` → 409 `PLAN_IN_USE`, gói còn nguyên; `PATCH` giá gói đó → 200 và đơn giữ nguyên `price`, `plan_name` (bản chốt) → AC-2
- [ ] Chủ trọ và người tìm trọ gọi `GET /plans/all`, `POST /plans`, `PATCH /plans/:id`, `DELETE /plans/:id` → 403 `PERMISSION_DENIED`; không token → 401 `TOKEN_MISSING`; DB không đổi → AC-2, AC-11
- [ ] Đặt `users.status = 'locked'` cho admin đang có token còn hạn: `POST`, `PATCH`, `DELETE /plans` → 403 `ACCOUNT_LOCKED` (do `@FreshAuth`), còn `GET /plans/all` vẫn 200 bằng token cũ; mở khóa lại thì `POST` qua → AC-2
- [ ] Gọi `GET /plans` 300 lần trong một phút từ một IP → lần thứ 301 nhận 429 `RATE_LIMITED` kèm `Retry-After` lớn hơn 0 (khởi động lại API trước khi đếm) → AC-13
- [ ] Newman các folder 07, 08, 09, 12 chạy từ trên xuống → 74 request, 157 assertion, không lỗi; cả bộ (00 đến 05, 07 đến 12) chỉ lỗi 2 assertion đã biết của folder 02 (đặt lại mật khẩu cần token gửi qua email) → AC-1, AC-2, AC-11

### Chưa kiểm được ở mốc 1
- 409 `PLAN_INACTIVE`, `ORDER_NOT_FOUND`, `ORDER_STATE_INVALID`, nhóm `orderWrite` (30 lần mỗi giờ cho tạo, thanh toán, hủy đơn): chưa có API đơn lúc đó; đã kiểm ở mốc 2 (mục dưới).
- Thanh toán, kỳ nối tiếp: đã kiểm ở mốc 2. Hạn mức theo gói, `GET /me/membership` có `state = plan`: mốc 3.

## Mốc 2: đơn, thanh toán thử và kỳ gói (AC-3 đến AC-7, AC-11, AC-13 phần `orderWrite`)

Chạy trên một database thử, không chạy trên database đang dùng. Cần bốn tài khoản: chủ trọ A, chủ trọ B, người tìm trọ T và admin (đăng nhập bằng `ADMIN_SEED_*` trong `.env`). Gói lấy từ `GET /plans` (ba gói mẫu sau `npm run seed`). Mỗi mục "Value sourcing" của spec có một bước riêng ở dưới (ghi trong ngoặc).

### Commands
- [ ] `npm test` → toàn bộ qua, gồm `orders.service.spec.ts`, `orders.mapper.spec.ts`, `order-dtos.spec.ts` và `route-declarations.spec.ts` (thấy đủ năm route đơn, mỗi route đúng một khai báo quyền) → AC-3 đến AC-7, AC-11
- [ ] `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected" (mốc 2 không đổi schema) → AC-12
- [ ] `SELECT count(*) FROM subscriptions s JOIN orders o ON o.id = s.order_id WHERE o.status <> 'paid' OR o.user_id <> s.user_id` → 0, và `SELECT count(*) FROM orders o WHERE o.status = 'paid' AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.order_id = o.id)` → 0 (mọi kỳ thuộc một đơn `paid` của cùng chủ trọ, mọi đơn `paid` có đúng một kỳ) → AC-5
- [ ] Gọi `SubscriptionsRepository.findActive` (script nạp `dist` bằng `NestFactory.createApplicationContext`) tại đúng `starts_at` của một kỳ, 1 mili giây trước `ends_at`, đúng `ends_at` → có kỳ, vẫn kỳ đó, rồi kỳ kế tiếp (hoặc `null` nếu là kỳ cuối); `findLatestEndsAt` bằng `ends_at` lớn nhất → AC-6 (mốc 3 mới có route gọi)
- [ ] Điều khiển âm cho khóa: xóa `FOR UPDATE` trong `dist/orders/orders.repository.js` và các dòng `this.users.lockById` trong `dist/orders/orders.service.js`, chạy lại, bắn 10 `pay` đồng thời trên một đơn → có ít nhất một 500 (đã đo: 1 trong 10); sau đó `npm run build` để dựng lại `dist` → AC-5

### UI / manual (gọi API, Postman folder `13 Đơn mua gói và thanh toán thử`)
**Tạo đơn (AC-3)**
- [ ] A `POST /orders` với `planId` → 201, `status` `pending`, `code` khớp `^[a-z0-9]{8}$`, đúng 13 trường, không có `userId`; `planName`, `price`, `maxListings`, `durationDays` bằng gói lúc tạo; `paidAt`, `cancelledAt`, `startsAt`, `endsAt` đều `null` → AC-3 (Value sourcing: `user_id` từ token, bốn cột bản chốt từ dòng `plans` đọc trong giao dịch, `code`)
- [ ] A tạo đơn thứ hai → đơn đầu thành `cancelled` có `cancelledAt`; `SELECT count(*) FROM orders WHERE user_id = <A> AND status = 'pending'` bằng 1 → AC-3 (Value sourcing: đơn chờ cũ bị hủy, `cancelled_at` là `now`)
- [ ] Admin tắt gói rồi A `POST /orders` bằng gói đó → 409 `PLAN_INACTIVE` và đơn `pending` cũ của A **vẫn `pending`** (không bị hủy) → AC-3
- [ ] Admin đổi giá, số tin và số ngày của gói sau khi A tạo đơn → `GET /orders/:id` vẫn trả giá, số tin, số ngày của lúc tạo → AC-3
- [ ] `POST /orders` thiếu `planId`, `planId` không phải UUID hay là số, kèm `price` → 400 `VALIDATION_FAILED` (`errors[].field` đúng trường); gói không có → 404 `PLAN_NOT_FOUND` → AC-3
- [ ] Admin `POST /orders` → 403 `PERMISSION_DENIED` và `SELECT count(*) FROM orders WHERE user_id = <admin>` bằng 0; T → 403 `PERMISSION_DENIED`; không token → 401 `TOKEN_MISSING` → AC-3, AC-11

**Đọc đơn (AC-4)**
- [ ] A `GET /orders` → `{ items, total, page, pageSize }`, mới nhất trước; `?status=pending` và `?status=cancelled` lọc đúng; `?page=2&pageSize=1` trả đơn cũ hơn; `?status=refunded` hay `pageSize=51` → 400 `VALIDATION_FAILED` → AC-4 (Value sourcing: danh sách đơn của `sub`, phân trang)
- [ ] B `GET /orders` không thấy đơn của A; admin `GET /orders` → 200 với `total` 0; T → 403 `PERMISSION_DENIED`; không token → 401 → AC-4, AC-11
- [ ] `GET /orders/:id`: đơn của mình → 200; đơn của người khác (B, và cả admin) → 403 `NOT_RESOURCE_OWNER`; UUID không có → 404 `ORDER_NOT_FOUND`; `abc` → 400 `INVALID_ID` → AC-4, AC-11
- [ ] Đơn `paid` có `startsAt` và `endsAt` bằng dòng `subscriptions` có `order_id` của nó; đơn `pending` và `cancelled` để `null` → AC-4 (Value sourcing: `startsAt`, `endsAt` của danh sách và chi tiết)

**Thanh toán và kỳ gói (AC-5, AC-6)**
- [ ] B và admin `POST /orders/:id/pay` đơn của A → 403 `NOT_RESOURCE_OWNER`; đơn không có → 404 `ORDER_NOT_FOUND`; T → 403 `PERMISSION_DENIED`; sau đó vẫn chưa có dòng nào trong `subscriptions` của A → AC-5, AC-11
- [ ] Pay đơn `cancelled` → 409 `ORDER_STATE_INVALID`, không có kỳ; thứ tự báo lỗi: đơn `cancelled` của người khác trả 403 trước 409 → AC-5
- [ ] A pay đơn `pending` khi chưa có gói → 200 `paid`; `paidAt` nằm trong khoảng thời gian gọi; `startsAt` bằng `paidAt`; `endsAt - startsAt` bằng đúng `durationDays` × 86.400.000 mili giây; DB có đúng một kỳ khớp từng giá trị → AC-5, AC-6 (Value sourcing: `paid_at` là `now`, `starts_at`, `ends_at`)
- [ ] Pay lần hai cùng đơn → 200, JSON giống hệt lần trước, vẫn một kỳ → AC-5
- [ ] 10 `pay` đồng thời trên một đơn `pending` mới → tất cả 200 và cùng một JSON; `SELECT count(*) FROM subscriptions WHERE order_id = <đơn>` bằng 1 → AC-5, AC-6
- [ ] Pay một đơn mới khi đang có gói → `startsAt` bằng đúng `endsAt` lớn nhất của các kỳ trước (chính xác đến mili giây), `endsAt` cách đúng `durationDays` ngày; mua gói khác (7 ngày) cũng nối vào cuối; ba kỳ liền nhau, không chồng, không hở → AC-6 (Value sourcing: `starts_at` là lớn hơn trong `now` và `MAX(ends_at)`)
- [ ] Admin đổi `durationDays` của gói (90) sau khi A đặt đơn gói 7 ngày, rồi A pay → kỳ vẫn dài 7 ngày, đơn vẫn `durationDays` 7 → AC-6 (Value sourcing: `ends_at` lấy `orders.duration_days`, không lấy từ gói)
- [ ] Dời mọi kỳ của A về quá khứ (`UPDATE subscriptions SET starts_at = starts_at - interval '200 days', ends_at = ends_at - interval '200 days'`) rồi pay đơn mới → `startsAt` bằng `paidAt` (không lùi về quá khứ) → AC-6
- [ ] Đơn `pending` mà admin đã tắt gói rồi pay → 409 `PLAN_INACTIVE`, đơn vẫn `pending`, không có kỳ mới; admin xóa gói đó → 409 `PLAN_IN_USE` → AC-5, AC-2
- [ ] 10 vòng, mỗi vòng B tạo đơn rồi bắn song song `pay` đơn đó và `POST /orders` mới → mỗi vòng hoặc (pay 200 và đơn `paid`) hoặc (pay 409 `ORDER_STATE_INVALID` và đơn `cancelled`), không 500, tạo đơn luôn 201, cuối cùng B còn đúng một đơn `pending` và không có đơn `paid` thiếu kỳ → AC-3, AC-5
- [ ] `INSERT` tay một kỳ chồng nhau cho A → `23P01` từ `subscriptions_user_period_excl`; kỳ liền nhau (`starts_at` bằng `ends_at` kỳ trước) → qua (làm trong giao dịch rồi `ROLLBACK`) → AC-6

**Hủy đơn (AC-7)**
- [ ] A hủy đơn `pending` → 200 `cancelled` có `cancelledAt` và không có kỳ; hủy lần hai → 200, JSON giống hệt → AC-7
- [ ] A hủy đơn `paid` → 409 `ORDER_STATE_INVALID`, đơn không đổi → AC-7
- [ ] B và admin hủy đơn của A → 403 `NOT_RESOURCE_OWNER` (kiểm chủ đứng trước kiểm trạng thái, kể cả với đơn đã `cancelled`); đơn không có → 404; T → 403 `PERMISSION_DENIED` → AC-7, AC-11

**Giới hạn tần suất (AC-13)**
- [ ] Một chủ trọ `POST /orders` 31 lần trong một giờ → 30 lần đầu 201, lần 31 → 429 `RATE_LIMITED` kèm `Retry-After` lớn hơn 0; ngay sau đó `POST /orders/:id/pay` của cùng người vẫn qua (mỗi route đếm riêng); đọc đơn không bị giới hạn (khởi động lại API trước khi đếm) → AC-13
- [ ] Newman các folder 07, 08, 09, 12, 13 chạy từ trên xuống → 119 request, 253 assertion, không lỗi; chuỗi 07 đến 13 (có 10 và 11) → 177 request, 351 assertion, không lỗi → AC-3 đến AC-7, AC-11

### Đã kiểm khi build (2026-10-19)
- Script HTTP và SQL 97 kiểm tra trên database thử (đăng ký ba chủ trọ, một người tìm trọ, đăng nhập admin): mọi bước ở trên trừ Newman. Log của API không có cảnh báo `client.query() when the client is already executing a query` và không có dòng ERROR.
- Điều khiển âm: bỏ khóa dòng `users` và `FOR UPDATE` của đơn trong `dist` thì 1 trong 10 lần bấm `pay` đồng thời trả 500 (kỳ thứ hai vẫn bị `subscriptions_order_id_unique` chặn). Kịch bản đua `pay` cùng lúc `create` (10 vòng) vẫn đúng khi bỏ khóa, vì câu `UPDATE ... WHERE status = 'pending'` của `markPaid` và của lần hủy đơn chờ cũ vẫn xếp hàng theo khóa dòng và đánh giá lại điều kiện, nên kịch bản đó không chứng minh được khóa `users`.
- `npm test` 783 bài qua; `migrate diff` không lệch; database thử đã xóa.

### Chưa kiểm được ở mốc 2
- Hạn mức theo gói, hiển thị công khai theo gói, `GET /me/membership` có `state = plan` và `subscription` (AC-8 đến AC-10): mốc 3. Sau khi trả, hạn mức đăng tin vẫn theo kỳ dùng thử, chủ trọ hết dùng thử vẫn bị 403 `MEMBERSHIP_REQUIRED`.

## Mốc 3: gói thành hạn mức tin (AC-8, AC-9, AC-10 và rà lại AC-1 đến AC-13)

Chuẩn bị: database thử đã `migration:deploy` và `seed`. Chủ trọ L1 (đăng ký mới, rồi đặt `trial_ends_at` về quá khứ bằng SQL), L2 (đang dùng thử), người tìm trọ T, admin. Quy ước "dời kỳ" là `UPDATE subscriptions` cộng hoặc trừ số ngày cho cả `starts_at` và `ends_at` của chủ trọ.

### Commands
- [ ] `npm test` → 814 bài qua; `npx tsc --noEmit` và `npx eslint src` sạch → AC-8, AC-9, AC-10
- [ ] `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → không lệch (mốc 3 không có migration) → AC-12
- [ ] Newman các folder 00 đến 05 và 07 đến 14 từ trên xuống trên database thử mới → 225 request, 426 assertion, chỉ hai assertion đã biết của folder 02 hỏng (cần token từ email) → AC-1 đến AC-13

### UI / manual (gọi API, Postman folder `14 Gói thành hạn mức tin`)

**Hạn mức theo gói (AC-8)**
- [ ] L1 hết dùng thử, chưa có gói: đăng tin → 403 `MEMBERSHIP_REQUIRED`; `GET /me/membership` ra `expired`, `listingLimit` 0, `subscription` null, `trialDaysLeft` 0 → AC-8, AC-10
- [ ] L1 tạo đơn gói Cơ bản (5 tin) rồi `pay` → 200; `GET /me/membership` ra `plan`, `listingLimit` 5, `subscription` đủ sáu trường, `daysLeft` 30, `paidUntil` bằng `endsAt` bằng `endsAt` của đơn; `users.trial_ends_at` không đổi so với trước khi mua → AC-8, AC-10
- [ ] L1 đăng được đến đúng 5 tin; tin thứ sáu → 403 `LISTING_QUOTA_REACHED` (không còn `MEMBERSHIP_REQUIRED`) → AC-8
- [ ] L2 đang dùng thử (hạn mức 2, đang hiện 2 tin) mua gói 1 tin: `state` `plan`, `listingLimit` 1, `overLimitCount` 1, `trialDaysLeft` vẫn 30; đăng thêm → `LISTING_QUOTA_REACHED` (gói thay dùng thử kể cả khi nhỏ hơn) → AC-8, AC-10
- [ ] Dời kỳ của L2 về quá khứ khi dùng thử còn: `state` về `trial`, `listingLimit` 2, `subscription` null → AC-8
- [ ] L1 mua ba lần (Cơ bản, Cơ bản, Nâng cao 15 tin): kỳ ghi trong DB liền nhau; `subscription.endsAt` là của kỳ đầu, `paidUntil` là cuối kỳ thứ ba, hạn mức vẫn 5; dời 31 ngày thì kỳ hai đang chạy (`daysLeft` 29, hạn mức 5); dời thêm 30 ngày thì kỳ ba đang chạy (`planName` Nâng cao, hạn mức 15, đăng thêm được) → AC-6, AC-8, AC-10
- [ ] Đã có 4 tin trong gói 5 tin: bắn song song 6 `POST` đăng tin qua hai nhà trọ của cùng chủ trọ → đúng một 201 và năm 403 `LISTING_QUOTA_REACHED`, DB có đúng 5 tin `visible` → AC-8
- [ ] Gói 50 tin: 15 `POST` đăng tin song song (cỡ pool 10) → đều 201, không treo, log API không có cảnh báo `client.query() when the client is already executing a query` → AC-8

**Hiển thị công khai theo gói (AC-9)**
- [ ] L1 vừa mua gói: cả hai tin cũ hiện lại ngay trong `GET /listings?q=...` và chi tiết `GET /listings/:slugCode` trả 200; `GET /me/listings` cho `isPublic` true → AC-9, AC-10
- [ ] Dời mọi kỳ của L1 về quá khứ khi dùng thử đã hết: `GET /listings` không còn tin nào của L1, chi tiết 404, `isPublic` false, đăng → `MEMBERSHIP_REQUIRED`, `GET /me/membership` ra `expired` với `overLimitCount` bằng số tin đang hiện → AC-9, AC-10
- [ ] L2 với gói 1 tin và 2 tin đang hiện: `GET /listings` chỉ còn tin đăng sớm nhất; `isPublic` true cho tin sớm nhất, false cho tin sau; dời kỳ về quá khứ thì cả hai tin hiện lại → AC-9
- [ ] Mảnh SQL đã build (`publicListingFrom` cộng `publicListingCondition`) với 72 tổ hợp chủ trọ (dùng thử hết, còn, hoặc không có hạn như admin) nhân (không gói, gói 1, 3, 6 tin đang chạy, gói đã hết, gói chưa tới) nhân (0, 1, 2, 4 tin, có cặp tin cùng `created_at`) so với oracle `row_number() OVER (ORDER BY created_at, id)` độc lập → khớp cả 72 → AC-9
- [ ] Ranh giới mili giây của kỳ gói chạy bằng mảnh SQL đã build ở ba múi giờ phiên (`UTC`, `Asia/Ho_Chi_Minh`, `America/Los_Angeles`): một ms trước `starts_at` ẩn, đúng `starts_at` hiện, một ms trước `ends_at` hiện, đúng `ends_at` ẩn, sau `ends_at` ẩn → AC-8, AC-9
- [ ] Hạn mức dùng thử truyền qua tham số (0, 1, 3, 4, 100) đúng khi không có gói, và không ảnh hưởng khi có gói 3 tin → AC-9
- [ ] Chủ trọ bị khóa, nhà trọ xóa mềm, tin `hidden_by_owner` vẫn thắng gói (rank tính lại sau khi ẩn một tin) → AC-9

**`GET /me/membership` (AC-10)**
- [ ] Đúng tám trường (`listingLimit`, `overLimitCount`, `remaining`, `state`, `subscription`, `trialDaysLeft`, `trialEndsAt`, `visibleCount`); `subscription` đúng sáu trường, không lộ id hay `maxListings` → AC-10
- [ ] Mua nối tiếp khi đang có gói: `subscription.endsAt` giữ nguyên, `paidUntil` dời tới cuối kỳ mới; `trialDaysLeft` tính theo `trialEndsAt` dù `state` là `plan` (30 với L2 có gói, 0 với L1) → AC-6, AC-10
- [ ] Admin → 200 `expired`, `subscription`, `trialEndsAt`, `trialDaysLeft` đều null; T → 403 `PERMISSION_DENIED`; chưa đăng nhập → 401 → AC-10, AC-11

**Nguồn giá trị (Value sourcing) và rà lại các mốc trước**
- [ ] `now` đi vào SQL dưới dạng chuỗi ISO có `Z`: kết quả ranh giới giống nhau ở ba múi giờ phiên ở trên → AC-8, AC-9
- [ ] `daysLeft` là `ceil((ends_at - now) / 1 ngày)` và `paidUntil` là `MAX(ends_at)` của mọi kỳ của người gọi (không phải kỳ đang chạy), xem bước mua nối tiếp ở trên → AC-10
- [ ] Chạy lại nhóm đơn giản của mốc 1 và 2 (bảng giá, tạo/hủy/trả đơn, bấm `pay` đồng thời, ràng buộc loại trừ `23P01`): 10 `pay` đồng thời → 10 lần 200 giống nhau, đúng một kỳ; `INSERT` tay kỳ chồng → `23P01`, kỳ liền nhau qua → AC-1 đến AC-7, AC-12

### Điều khiển âm (đã làm khi build, 2026-10-19)
- Thay `plan.max_listings` bằng `NULL::int` trong `dist`: script mảnh SQL hỏng 15 trên 36 kiểm tra (22 tổ hợp lệch oracle, kỳ gói không còn thay hạn mức, ranh giới kỳ sai). Khôi phục bằng `nest build` thì qua 36 trên 36.
- Tắt nhánh gói trong `MembershipsService.resolve` (`if (false)`): `GET /me/membership` ra `expired` sau khi trả và kịch bản dừng ở bước `subscription` null. Khôi phục thì qua 46 trên 46.
- Bỏ `FOR UPDATE` của `users.lockById` trong `dist`: sáu lần đăng đồng thời qua hai nhà trọ làm lọt hai tin (6 tin trên gói 5) ở cả ba lần thử. Khi chỉ dùng một nhà trọ thì khóa dòng nhà trọ che mất lỗi nên bài thử phải đi qua hai nhà trọ. Khôi phục thì qua 12 trên 12, ba lần liên tiếp.

### Đã kiểm khi build (2026-10-19)
- Script HTTP và SQL 46 kiểm tra (năm kịch bản S1 đến S5), script mảnh SQL 36 kiểm tra (O1 đến O4), script đồng thời và ràng buộc 12 kiểm tra (C1 đến C4) trên database thử `rental_verify_r10m3`; Newman 225 request và 426 assertion với hai assertion đã biết của folder 02. Log API không có cảnh báo pg và không có dòng ERROR bất thường.
- `npm test` 814 bài qua; `tsc` và `eslint` sạch; database thử đã xóa.

### Chưa kiểm được ở mốc 3
- Phép nối `LEFT JOIN LATERAL` của kỳ gói chưa được đo `EXPLAIN` ở 60 nghìn tin (spec ghi là chưa đo riêng). Chi phí đọc công khai ở quy mô đó đã vượt ngân sách từ AC-13 của 0003 (đã đo, bỏ qua có chủ đích vì là MVP không chạy thật); không có số đo mới cho phần cộng thêm này.
- Chưa có kiểm cuối do `/check verify` chạy trên bản độc lập; các bước ở trên do người build chạy.

## Acceptance-criteria coverage
- AC-1 (bảng giá công khai) · AC-2 (admin quản lý gói) · AC-12 (migration, seed) · AC-13 phần `GET /plans` · AC-11 phần quyền gói: có bước ở mốc 1.
- AC-3 đến AC-7, phần đơn của AC-11 và phần `orderWrite` của AC-13: có bước ở mốc 2.
- AC-8 đến AC-10 (hạn mức theo gói, hiển thị công khai theo gói, `/me/membership`): có bước ở mốc 3; rà lại AC-1 đến AC-13 bằng Newman ở mốc 3. Hai ràng buộc DB của AC-3 và AC-6 (một đơn chờ, không chồng kỳ) đã kiểm sớm bằng `INSERT` tay ở mốc 1 và bằng API ở mốc 2.
