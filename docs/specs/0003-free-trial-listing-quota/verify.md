# Verify: dùng thử miễn phí và hạn mức tin · spec 0003 · updated 2026-10-16
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Mốc 1: nền dữ liệu, tham số, API admin (AC-2, AC-12)

Chạy trên một database thử (tạo bằng `DATABASE_NAME=<tên> npm run db:create`), không chạy trên database đang dùng. Đăng nhập admin bằng `ADMIN_SEED_*` trong `.env`.

### Commands
- [ ] `npm run migration:deploy` trên database trống → mọi migration áp xong, không lỗi → AC-12
- [ ] Áp migration `free_trial_settings` lên database đã có sẵn chủ trọ (cả tài khoản bị khóa và đã xóa mềm), tenant và admin → mọi dòng landlord có `trial_ends_at` bằng lúc chạy migration cộng 30 ngày, tenant và admin để rỗng → AC-12
- [ ] `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected", exit 0 → AC-12
- [ ] Hỏi schema thật: cột `users.trial_ends_at` (`timestamptz`, cho phép rỗng), bảng `settings` (`key`, `value`, `updated_at`, `updated_by`), ràng buộc `users_landlord_trial_check`, `settings_key_check`, `settings_updated_by_fk` (ON DELETE SET NULL) đều có → AC-12
- [ ] `INSERT` một landlord không có `trial_ends_at` → bị `users_landlord_trial_check` chặn; `INSERT` tenant không có `trial_ends_at` → được → AC-12
- [ ] `INSERT INTO settings (key, value) VALUES ('Sai Khoa', '1')` → bị `settings_key_check` chặn → AC-12
- [ ] Xóa cứng một admin vừa sửa tham số → `settings.updated_by` của dòng đó về NULL → AC-12
- [ ] `npm run seed` lần 1 → "thêm 2 dòng mặc định mới"; `settings` có `trial_days` = `30` và `trial_listing_limit` = `2` → AC-12
- [ ] Đổi `trial_days` thành 14 bằng API, rồi `npm run seed` lần 2 → "thêm 0 dòng", `trial_days` vẫn là `14` (seed không ghi đè) → AC-12
- [ ] `npm test` → toàn bộ qua (gồm `settings.service.spec.ts`, `update-setting.dto.spec.ts`, `seed-settings.spec.ts`, `route-declarations.spec.ts`) → AC-2, AC-12

### UI / manual (gọi API, Postman folder `10 Tham số hệ thống (admin)`)
- [ ] Admin `GET /settings` → 200, mảng đúng hai phần tử theo thứ tự `trial_days`, `trial_listing_limit`; mỗi phần tử đúng 6 trường `key, value, min, max, updatedAt, updatedBy`; giá trị 30 và 2, khoảng 0..365 và 0..100 → AC-2
- [ ] Xóa hai dòng trong `settings` rồi admin `GET /settings` → vẫn 200, giá trị 30 và 2, `updatedAt` và `updatedBy` là `null`, log có đúng một cảnh báo cho mỗi khóa dù gọi nhiều lần → AC-2, AC-12
- [ ] Đặt `settings.value` của `trial_days` thành `chu` rồi `GET /settings` → 200 với 30, có log cảnh báo, không 500 → AC-12
- [ ] Admin `PATCH /settings/trial_days` với `{ "value": 14 }` → 200, trả phần tử `value: 14`, `updatedBy` là id admin, `updatedAt` vừa ghi; DB lưu chữ `14` → AC-2
- [ ] `PATCH` ở hai biên: `trial_days` 0 và 365, `trial_listing_limit` 0 và 100 → 200 → AC-2
- [ ] `PATCH` giá trị ngoài khoảng (`trial_days` 366 hoặc -1, `trial_listing_limit` 101) → 400 `VALIDATION_FAILED`, `errors[0].field` là `value`, DB không đổi → AC-2
- [ ] `PATCH` giá trị không phải số nguyên (`1.5`, `"abc"`, `"5"` là chuỗi, `null`, thiếu `value`, thêm trường lạ) → 400 `VALIDATION_FAILED` → AC-2
- [ ] `PATCH /settings/khoa_la` (và `TRIAL_DAYS`, `constructor`) → 404 `NOT_FOUND`, không tạo dòng mới → AC-2
- [ ] Chủ trọ hoặc người tìm trọ `GET /settings` và `PATCH /settings/trial_days` → 403 `PERMISSION_DENIED`, DB không đổi → AC-2
- [ ] Không có token `GET /settings` và `PATCH` → 401 `TOKEN_MISSING` → AC-2
- [ ] Khóa tài khoản admin trong DB khi token của admin còn hạn, rồi `PATCH /settings/trial_days` → 403 `ACCOUNT_LOCKED`, DB không đổi (`@FreshAuth`); `GET /settings` không có `@FreshAuth` nên theo token → AC-2
- [ ] Xóa dòng `trial_listing_limit` rồi `PATCH /settings/trial_listing_limit` `{ "value": 3 }` → 200, dòng được tạo lại (upsert) → AC-2

## Value sourcing (mốc 1)
- [ ] `GET /settings` `value`, `min`, `max`: `value` từ dòng `settings` ép số nguyên (thiếu hoặc hỏng thì mặc định 30 và 2), `min` và `max` từ `SETTING_DEFINITIONS`, không từ DB → thử đổi `value` trong DB thành chữ và thành `999`, `min` và `max` không đổi, `value` về mặc định → AC-2
- [ ] `GET /settings` `updatedAt`, `updatedBy`: cột cùng tên, `null` khi chưa có dòng → AC-2
- [ ] `PATCH` `updated_by`, `updated_at`: `sub` của token (đọc lại từ DB do `@FreshAuth`) và đồng hồ ứng dụng → đăng nhập hai admin khác nhau, mỗi người `PATCH` một lần, `updatedBy` đúng người cuối → AC-2
- [ ] `PATCH` khoảng hợp lệ: `SETTING_DEFINITIONS[key].min` và `.max` → thử biên mỗi khóa (khoảng của hai khóa khác nhau) → AC-2

## Ghi chú cho mốc 2
- [ ] Sau mốc 2: `POST /auth/register` landlord trả 201 và `trial_ends_at` bằng lúc đăng ký cộng `trial_days` ngày (hiện trả 500 vì `CHECK` đã có) → AC-1

## Acceptance-criteria coverage (mốc 1)
- AC-2 … covered by các bước `GET /settings`, `PATCH /settings/:key`, quyền, `@FreshAuth`, Value sourcing · AC-12 … covered by các bước migration, `CHECK`, `prisma migrate diff`, seed, giá trị hỏng hoặc thiếu
- Chưa phủ (mốc sau): AC-1, AC-3 đến AC-11, AC-13
