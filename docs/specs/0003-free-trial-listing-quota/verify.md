# Verify: dùng thử miễn phí và hạn mức tin · spec 0003 · updated 2026-10-19
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

## Mốc 2: kỳ dùng thử lúc đăng ký và cổng hạn mức ở phía ghi (AC-1, AC-3 đến AC-7)

Chạy trên một database thử, API chạy bằng `DATABASE_NAME=<tên> PORT=<cổng> node dist/main` sau `npm run build`. Mỗi lần khởi động lại API thì bộ đếm giới hạn tần suất về 0 (đăng ký chỉ 10 lần mỗi giờ theo IP). Các ô "đặt `trial_ends_at` về quá khứ" làm thẳng trong DB: `UPDATE users SET trial_ends_at = now() - interval '1 second' WHERE id = ...`.

### Commands
- [ ] `npm test` → toàn bộ qua, gồm `memberships.service.spec.ts`, `auth.service.spec.ts`, `listings.service.spec.ts` → AC-1, AC-3 đến AC-7
- [ ] `npx tsc --noEmit` và `npx eslint "src/**/*.ts"` → không lỗi → AC-1, AC-3 đến AC-7
- [ ] Newman folder `07` rồi `11 Dùng thử và hạn mức tin` trên DB thử đã `migration:deploy` và `seed` → 30 request, 43 assertion, 0 lỗi → AC-1, AC-3 đến AC-6
- [ ] Newman các folder 00 đến 05 và 07 đến 11 chạy liền → chỉ hai lỗi ở folder 02 (`Đặt lại mật khẩu` cần token dán tay từ email thật, `Đổi mật khẩu` hỏng theo), mọi folder khác qua, gồm folder 01, 08, 09 hỏng từ mốc 1 nay chạy lại → AC-1

### UI / manual (gọi API)
- [ ] Đăng ký landlord → 201, `user` đúng 6 trường, DB `users.trial_ends_at` ≈ `created_at` cộng 30 ngày (lệch dưới 3 giây), có phần mili giây (không tròn ngày) → AC-1
- [ ] Đăng ký tenant → 201, `trial_ends_at` rỗng; admin do seed cũng rỗng → AC-1
- [ ] Đăng ký landlord trùng số điện thoại → 409 `PHONE_TAKEN`, không có tài khoản mới, email mới không được tạo → AC-1
- [ ] Admin đặt `trial_days` = 7, đăng ký landlord mới → `trial_ends_at` ≈ +7 ngày; landlord đăng ký trước đó không đổi → AC-1
- [ ] Admin đặt `trial_days` = 0, đăng ký landlord mới → 201, kỳ dùng thử hết ngay (`trial_ends_at` không sau `created_at`); tạo nhà trọ được, đăng tin 403 `MEMBERSHIP_REQUIRED` → AC-1, AC-4
- [ ] Đặt `settings.value` của `trial_days` thành `abc`, rồi xóa hẳn dòng, mỗi lần đăng ký landlord mới → 201 với 30 ngày, log có cảnh báo, không 500 → AC-12
- [ ] Landlord còn dùng thử (hạn mức 2): đăng tin thứ 1 và 2 → 201; tin thứ 3 → 403 `LISTING_QUOTA_REACHED`, DB vẫn đúng 2 tin → AC-4
- [ ] Ẩn một tin (`hide`) → 200; đăng tin thứ 3 → 201 ngay (ẩn trả lại một chỗ) → AC-4, AC-6
- [ ] Hiện lại (`show`) tin đang `hidden_by_owner` khi đang hiện đủ 2 → 403 `LISTING_QUOTA_REACHED`, tin vẫn `hidden_by_owner`; ẩn bớt một tin rồi `show` lại → 200 `visible` → AC-5, AC-6
- [ ] `show` tin đang `visible` → 409 `LISTING_STATE_INVALID`; `show` tin `hidden_by_admin` → 403 `LISTING_HIDDEN_BY_ADMIN`; cả hai đến trước `MEMBERSHIP_REQUIRED` và `LISTING_QUOTA_REACHED` → AC-5
- [ ] Admin hạ `trial_listing_limit` xuống 1 khi chủ trọ đang hiện 2 tin → đăng bị 403 `LISTING_QUOTA_REACHED`; vẫn bị chặn khi đang hiện đúng 1; chỉ đăng được khi đang hiện 0; nâng lên 3 thì đăng thêm được tới khi đủ 3 → AC-3, AC-4
- [ ] Đặt `trial_ends_at` của landlord về quá khứ → đăng tin và `show` đều 403 `MEMBERSHIP_REQUIRED`, đến trước `LISTING_QUOTA_REACHED` dù đang hiện nhiều tin → AC-4, AC-5
- [ ] Cùng chủ trọ hết dùng thử: `hide` → 200, `PATCH /listings/:id` → 200, `DELETE /listings/:id` → 204, `POST/PATCH/DELETE /properties` → 201, 200, 204 → AC-6
- [ ] Hết dùng thử + đăng vào nhà trọ không có → 404 `PROPERTY_NOT_FOUND`; vào nhà trọ của chủ trọ khác → 403 `NOT_RESOURCE_OWNER`; cả hai đến trước `MEMBERSHIP_REQUIRED` → AC-4
- [ ] Đặt lại `trial_ends_at` về 30 ngày sau → đăng được lại (hạn mức đọc lại mỗi lần, không lưu) → AC-3
- [ ] Admin tạo nhà trọ rồi đăng tin → 403 `MEMBERSHIP_REQUIRED` (không có `trial_ends_at` thì hạn mức 0) → AC-3
- [ ] Đua, còn đúng một chỗ, 12 vòng: một `POST .../listings` song song một `POST /listings/:id/show` → mỗi vòng đúng một thành công, một `LISTING_QUOTA_REACHED`; số tin đang hiện không bao giờ quá hạn mức → AC-7
- [ ] Đua, còn đúng một chỗ, 10 vòng: hai `POST` đăng vào **hai nhà trọ khác nhau** của cùng chủ trọ → mỗi vòng đúng một thành công (đây là ca chỉ khóa `users` mới chặn được) → AC-7
- [ ] 15 `POST` đăng song song (hơn pool 10) khi đang hiện 0, hạn mức 2 → đúng 2 thành công, 13 `LISTING_QUOTA_REACHED`, không lỗi khác, không bế tắc → AC-7
- [ ] Đối chứng: bỏ `FOR UPDATE` trong `UsersRepository.lockById` (sửa tạm bản build) → hai ca đua ở trên hỏng; khôi phục rồi build lại → qua; hai yêu cầu đăng vào cùng một nhà trọ vẫn qua dù bỏ khóa vì khóa dòng nhà trọ đã xếp hàng chúng → AC-7

## Value sourcing (mốc 2)
- [ ] `users.trial_ends_at` lúc đăng ký: `now` của request cộng `settings.trial_days` ngày (thiếu hoặc hỏng thì 30); tenant và admin rỗng → đổi `trial_days`, đổi loại tài khoản, xóa dòng settings, kiểm DB mỗi lần → AC-1
- [ ] `state` và `limit`: `users.trial_ends_at` so chặt với `now` (đúng lúc bằng là hết), cộng `settings.trial_listing_limit` → đặt `trial_ends_at` bằng đúng `now` ở test đơn vị (`memberships.service.spec.ts`), và đổi `trial_listing_limit` rồi gọi đăng tin → AC-3
- [ ] Số tin đang hiện: đếm tin `visible`, chưa xóa mềm, qua `properties.landlord_id` của `sub` trong token, đọc trong giao dịch đã khóa dòng `users` → thử tin `hidden_by_owner`, `hidden_by_admin` và đã xóa mềm đều không tính; tin của chủ trọ khác không tính → AC-4, AC-6
- [ ] Lỗi nào: `state = 'expired'` thì `MEMBERSHIP_REQUIRED`; còn hiệu lực mà đang hiện không nhỏ hơn hạn mức thì `LISTING_QUOTA_REACHED` → hạn mức 0 trong kỳ dùng thử cho `LISTING_QUOTA_REACHED`, không phải `MEMBERSHIP_REQUIRED` → AC-3, AC-4
- [ ] `now`: một giá trị mỗi request do controller lấy rồi truyền xuống Service, Repository và `resolve` → test đơn vị truyền `now` cố định và kiểm biên mili giây → AC-1, AC-3

## Acceptance-criteria coverage
- Mốc 1: AC-2 … covered by các bước `GET /settings`, `PATCH /settings/:key`, quyền, `@FreshAuth`, Value sourcing · AC-12 … covered by các bước migration, `CHECK`, `prisma migrate diff`, seed, giá trị hỏng hoặc thiếu
- Mốc 2: AC-1 … covered by các bước đăng ký (landlord, tenant, admin, trùng số, đổi `trial_days`) · AC-3 … covered by hạn mức đổi có hiệu lực ngay, hết dùng thử, admin hạn mức 0 · AC-4 … covered by đăng tin đủ hạn mức, hết dùng thử, thứ tự lỗi · AC-5 … covered by `show` đủ hạn mức, hết dùng thử, thứ tự lỗi · AC-6 … covered by ẩn trả lại chỗ, hết dùng thử không chặn hide, sửa, xóa · AC-7 … covered by ba kịch bản đua và ca đối chứng
- Chưa phủ (mốc sau): AC-8 đến AC-11, AC-13
