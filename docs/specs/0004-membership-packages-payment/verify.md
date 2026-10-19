# Verify: mua gói bằng thanh toán thử · spec 0004 · updated 2026-10-19
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
- 409 `PLAN_INACTIVE`, `ORDER_NOT_FOUND`, `ORDER_STATE_INVALID`, nhóm `orderWrite` (30 lần mỗi giờ cho tạo, thanh toán, hủy đơn): chưa có API đơn, thuộc mốc 2.
- Thanh toán, kỳ nối tiếp, hạn mức theo gói, `GET /me/membership` có `state = plan`: mốc 2 và 3.

## Acceptance-criteria coverage
- AC-1 (bảng giá công khai) · AC-2 (admin quản lý gói) · AC-12 (migration, seed) · AC-13 phần `GET /plans` · AC-11 phần quyền gói: có bước ở mốc 1.
- AC-3 đến AC-10 và phần `orderWrite` của AC-13: chưa kiểm (mốc 2 và 3). Hai ràng buộc DB của AC-3 và AC-6 (một đơn chờ, không chồng kỳ) đã kiểm sớm bằng `INSERT` tay.
