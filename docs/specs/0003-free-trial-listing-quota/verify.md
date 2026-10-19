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

## Mốc 3: luật hiển thị công khai theo hạng (AC-8, AC-9)

Chạy trên một database thử, API chạy bằng `DATABASE_NAME=<tên> PORT=<cổng> node dist/main` sau `npm run build`. Mỗi lần khởi động lại API thì bộ đếm giới hạn tần suất về 0 (đăng ký chỉ 10 lần mỗi giờ theo IP). Các ô "đặt `trial_ends_at`" làm thẳng trong DB: `UPDATE users SET trial_ends_at = ... WHERE id = ...`; tin cũ hơn thì `UPDATE listings SET created_at = ... WHERE id = ...`. Danh sách công khai lấy bằng `GET /listings?pageSize=50`, thêm `q=<từ khóa riêng>` để khỏi lẫn tin khác. Admin đổi hạn mức bằng `PATCH /settings/trial_listing_limit`.

### Commands
- [ ] `npm test` → toàn bộ qua (630 test), gồm `listings.repository.spec.ts` và `listings.service.spec.ts` → AC-8, AC-9
- [ ] `npx tsc --noEmit` và `npx eslint "src/**/*.ts"` → không lỗi → AC-8, AC-9
- [ ] Newman folder 00 đến 05 và 07 đến 11 chạy liền trên DB thử đã `migration:deploy` và `seed` → 134 request, 222 assertion, chỉ hai lỗi ở folder 02 (đặt lại mật khẩu cần token dán tay từ email thật, đổi mật khẩu hỏng theo); folder 11 nay có 33 request, gồm các bước hạ hạn mức → AC-9
- [ ] `grep -rn visibleListingsQuery src` → không còn kết quả (bản cũ đã xóa, nguồn duy nhất là `publicListingCondition`) → AC-8, AC-9

### UI / manual (gọi API)
- [ ] Chủ trọ còn dùng thử có 2 tin `visible` → `GET /listings` có cả hai, `GET /listings/:slugCode` 200 → AC-8
- [ ] `UPDATE users SET trial_ends_at = now() - interval '1 second'` cho chủ trọ đó (không khởi động lại API) → hai tin biến khỏi `GET /listings`, `total` giảm 2, chi tiết 404 `LISTING_NOT_FOUND`, `listings.view_count` không tăng → AC-8
- [ ] Cùng chủ trọ hết dùng thử: `GET /me/listings` vẫn thấy cả hai tin với `status = visible`, `GET /me/listings/:id` 200, `hide` 200, `show` 403 `MEMBERSHIP_REQUIRED` → AC-8
- [ ] Đặt `trial_ends_at` về 30 ngày sau → hai tin hiện lại ngay, không chờ, không khởi động lại → AC-8
- [ ] Chủ trọ bị khóa (`users.status = 'locked'`), chủ trọ có nhà trọ xóa mềm, tin do admin sở hữu (không có `trial_ends_at`) → không tin nào trong số đó hiện công khai → AC-8
- [ ] Hạn mức 3, chủ trọ có 3 tin B1, B2, B3 theo thứ tự `created_at`; admin hạ `trial_listing_limit` = 2 → danh sách có B1 và B2, không có B3; chi tiết B3 404; `GET /me/listings/:id` của B3 vẫn `status = visible` → AC-9
- [ ] Hạ tiếp xuống 1 → chỉ B1; hạ xuống 0 → không tin nào của chủ trọ nào, `total` 0; nâng lại 3 → cả ba hiện ngay → AC-9
- [ ] Hạn mức 2: chủ trọ ẩn B1 → B3 hiện lại (B2, B3 là hai tin đang hiện sớm nhất); `show` B1 khi đang hiện đủ 2 → 403 `LISTING_QUOTA_REACHED`; xóa B1 → B2 và B3 vẫn hiện → AC-9
- [ ] Hai tin cùng `created_at` (đặt tay) mà chỉ còn một chỗ cho cặp đó → tin có `id` nhỏ hơn hiện, tin kia ẩn bớt → AC-9
- [ ] Chủ trọ khác không vượt hạn mức → tin của họ không bị ảnh hưởng khi chủ trọ B bị ẩn bớt → AC-9
- [ ] Nhiều chủ trọ, nhiều trạng thái tin (`hidden_by_owner`, `hidden_by_admin`, xóa mềm), nhiều tin cùng `created_at`: tập id và thứ tự của `GET /listings` qua mọi trang khớp một truy vấn tay độc lập (`row_number() OVER (PARTITION BY landlord ORDER BY created_at, id) <= hạn mức`, chủ trọ còn dùng thử và đang hoạt động, nhà trọ chưa xóa) ở hạn mức 0, 1, 2, 3, 5, 100, và khi kèm `sort`, `wardCode`, `minPrice`, `maxPrice`, `q` (một từ, nhiều từ, `_`, `%`) → AC-8, AC-9
- [ ] `GET /listings?page=9999` → 200, `items` rỗng, `total` giữ nguyên → AC-8
- [ ] Đặt `settings.value` của `trial_listing_limit` thành `chu`, rồi xóa hẳn dòng → `GET /listings` vẫn 200 với kết quả của hạn mức mặc định 2, log đúng một cảnh báo cho khóa này, không 500 → AC-8, AC-12
- [ ] Ranh giới: `now` đúng bằng `trial_ends_at` thì tin ẩn (so chặt), `now` sớm hơn 1 mili giây thì hiện; kết quả như nhau khi phiên DB có múi giờ UTC, `Asia/Ho_Chi_Minh` hay `America/Los_Angeles` (`listings.repository.spec.ts` kiểm `now` đi vào SQL là chuỗi ISO có `Z`, không phải `Date`) → AC-8
- [ ] Đối chứng: bỏ vế hạng khỏi bản build rồi chạy lại các bước hạ hạn mức → hỏng; bỏ vế `trial_ends_at` rồi chạy lại các bước hết dùng thử → hỏng; khôi phục bản build → qua → AC-8, AC-9
- [ ] Bước 7 của Build plan (đo `EXPLAIN ANALYZE` ở 60 nghìn tin) làm ở mốc 4, xem mục "Mốc 4" bên dưới; câu đếm tổng đã nối bằng `count(*)` với cùng mảnh điều kiện → AC-13

## Value sourcing (mốc 3)
- [ ] `now`: một giá trị mỗi request, controller lấy `new Date()` rồi truyền xuống Service, Repository và SQL (chuỗi ISO có `Z`) → `listings.service.spec.ts` kiểm `now` truyền xuống nguyên vẹn; không trộn với `now()` của DB trong cùng một quyết định → AC-8
- [ ] `trialListingLimit`: `settings.trial_listing_limit` đọc một lần mỗi request qua `SettingsService.getValue` → đổi bằng `PATCH /settings/trial_listing_limit` rồi gọi lại: có hiệu lực ngay, không đệm → AC-9
- [ ] Hạng của tin: `(created_at, id)` của các tin `visible` chưa xóa cùng chủ trọ, nhỏ hơn thì xếp trước → thử tin `hidden_by_owner`, `hidden_by_admin` và đã xóa mềm, không loại nào tính vào hạng → AC-9
- [ ] Còn dùng thử: `users.trial_ends_at` lớn hơn `now` (so chặt); tài khoản không có `trial_ends_at` thì không qua → AC-8

## Mốc 4: `GET /me/membership`, cờ `isPublic`, đo `EXPLAIN` (AC-10, AC-11, AC-13)

Chạy trên một database thử, API chạy bằng `DATABASE_NAME=<tên> PORT=<cổng> node dist/main` sau `npm run build`. Mỗi lần khởi động lại API thì bộ đếm giới hạn tần suất về 0 (đăng ký chỉ 10 lần mỗi giờ theo IP, đăng nhập 10 lần mỗi 15 phút theo email). Các ô "đặt `trial_ends_at`" làm thẳng trong DB: `UPDATE users SET trial_ends_at = ... WHERE id = ...`. Admin đổi hạn mức bằng `PATCH /settings/trial_listing_limit`. Mỗi lần chạy lại phải dùng từ khóa `q` riêng cho tin mới, để tin của lần chạy trước không lẫn vào.

### Commands
- [ ] `npm test` → toàn bộ qua (665 test), gồm `memberships.mapper.spec.ts`, `memberships.service.spec.ts`, `listings.service.spec.ts`, `listings.mapper.spec.ts`, `listings.repository.spec.ts` → AC-10, AC-11
- [ ] `npx tsc --noEmit` và `npx eslint "src/**/*.ts"` → không lỗi → AC-10, AC-11
- [ ] Newman folder 07, 08, 09, 11 chạy liền trên DB thử đã `migration:deploy` và `seed` → 95 request, 181 assertion, 0 lỗi; folder 11 nay có 42 request, gồm chín request `GET /me/membership` và `isPublic` mới → AC-10, AC-11
- [ ] Newman các folder 00 đến 05 và 07 đến 11 chạy liền → 143 request, 248 assertion, chỉ hai lỗi cũ ở folder 02 (đặt lại mật khẩu cần token dán tay từ email thật, đổi mật khẩu hỏng theo) → AC-10, AC-11
- [ ] Đo `EXPLAIN (ANALYZE, BUFFERS)` bằng mảnh `publicListingCondition` lấy từ bản build, trên 60.030 tin giả lập, ba lần mỗi câu lấy lần nhanh nhất (kết quả ở mục "Kết quả đo AC-13" bên dưới) → AC-13

### UI / manual (gọi API)
- [ ] Không token `GET /me/membership` → 401; người tìm trọ → 403 `PERMISSION_DENIED`; admin → 200 với `state` = `expired`, `trialEndsAt` và `trialDaysLeft` = `null`, `listingLimit` 0 → AC-10
- [ ] Chủ trọ vừa đăng ký → 200, đúng bảy trường `state, trialEndsAt, trialDaysLeft, listingLimit, visibleCount, remaining, overLimitCount`; `state` = `trial`, `trialDaysLeft` = 30, `listingLimit` 2, `visibleCount` 0, `remaining` 2, `overLimitCount` 0; `trialEndsAt` bằng cột `users.trial_ends_at` đến mili giây → AC-10
- [ ] Đăng tin A rồi tin B → mỗi lần 201 và `isPublic` = `true`; membership sau A: `visibleCount` 1, `remaining` 1; sau B: `visibleCount` 2, `remaining` 0; đăng tin C → 403 `LISTING_QUOTA_REACHED` → AC-10, AC-11
- [ ] `GET /me/listings` và `GET /me/listings/:id` → cả hai tin `isPublic` = `true` → AC-11
- [ ] Admin hạ `trial_listing_limit` xuống 1 khi chủ trọ có A (sớm) và B → `GET /me/listings`: A `isPublic` = `true`, B `isPublic` = `false` mà `status` vẫn `visible`; membership: `listingLimit` 1, `visibleCount` 2, `remaining` 0, `overLimitCount` 1; `GET /listings` chỉ có A (khớp `isPublic`) → AC-10, AC-11, AC-9
- [ ] Cùng lúc đó `PATCH /listings/:idB` → 200, `isPublic` = `false`, `status` = `visible`; `hide` B → `isPublic` = `false`, `hidden_by_owner`; membership: `visibleCount` 1, `overLimitCount` 0 → AC-11
- [ ] `show` B khi đang hiện đủ hạn mức 1 → 403 `LISTING_QUOTA_REACHED`; nâng hạn mức lên 2 rồi `show` B → 200, `isPublic` = `true`; `GET /listings` có cả A và B → AC-11, AC-5
- [ ] Đặt tay `status` = `hidden_by_admin` cho A → `GET /me/listings`: A `isPublic` = `false`, B `isPublic` = `true` → AC-11
- [ ] Đặt `trial_ends_at` về quá khứ → membership: `state` = `expired`, `trialDaysLeft` 0, `listingLimit` 0, `visibleCount` 2, `remaining` 0, `overLimitCount` 2, `trialEndsAt` vẫn có; `GET /me/listings` và `GET /me/listings/:id`: mọi tin `isPublic` = `false`, `status` vẫn `visible`; `GET /listings` không còn tin nào của chủ trọ → AC-10, AC-11, AC-8
- [ ] Làm tròn số ngày: `trial_ends_at` = now + 1 giờ → `trialDaysLeft` 1; now + 25 giờ → 2; now + 29 ngày 1 giây → 30; now + 30 ngày → 30 → AC-10
- [ ] Đối chiếu độc lập: chủ trọ có hai nhà trọ, 6 tin `visible` đăng xen kẽ, 1 tin `hidden_by_owner`, 1 tin xóa mềm; ở hạn mức 0, 1, 2, 3, 5, 6, 7, 100: tập id có `isPublic` = `true` ở `GET /me/listings` bằng tập id của `GET /listings` (đúng chủ trọ đó) và bằng một truy vấn tay độc lập (tin `visible` chưa xóa của chủ trọ xếp `created_at, id` lấy N đầu), đúng `min(hạn mức, 6)` tin, không có tin ẩn hay tin xóa; membership khớp (`remaining`, `overLimitCount`) → AC-9, AC-10, AC-11
- [ ] Như bước trên sau khi đặt cùng một `created_at` cho mọi tin của chủ trọ (hạn mức 0, 1, 2, 3, 4, 6, 7) → ba tập vẫn khớp nhau, tin có `id` nhỏ hơn được xếp trước → AC-9, AC-11
- [ ] Đối chứng: đổi `orderBy` của `findEarliestVisibleIds` trong bản build từ `createdAt: 'asc'` sang `'desc'` rồi chạy lại các bước hạ hạn mức và đối chiếu → hỏng đúng chỗ: bước hạ hạn mức đảo A và B (`isPublic` của B thành `true`, của A thành `false`) và đối chiếu lệch truy vấn tay ở các hạn mức nhỏ (22 kiểm tra hỏng); khôi phục bản build → qua hết (108 kiểm tra) → AC-11
- [ ] Hide, update, delete khi hết dùng thử vẫn chạy (test đơn vị): các thao tác này không đi qua cửa hạn mức (không giao dịch `resolve`), chỉ phần đọc `isPublic` sau khi ghi gọi `resolve` ngoài giao dịch → AC-6, AC-11

### Kết quả đo AC-13 (60.030 tin, hạn mức 2, trang 20 tin, lần nhanh nhất trong ba lần)

Máy dev, PostgreSQL 18, mỗi dạng dữ liệu nạp lại từ đầu rồi `ANALYZE`. Một lần đo lại cùng câu có thể lệch đến 2,5 lần. Ngân sách của AC-13: trang dưới 100 ms, đếm tổng dưới 300 ms.

| Dạng dữ liệu | Trang 1 | Trang 50 | Đếm tổng |
|---|---|---|---|
| R: mỗi chủ trọ có 2 tin hiện và 1 tin ẩn (đúng điều cổng ghi cho phép) | 0,2 ms | 230 đến 440 ms | 210 đến 520 ms |
| A: 3.000 chủ trọ, 20 tin hiện mỗi người | 210 đến 850 ms | 1,1 s | 1,1 s |
| B: 12.000 chủ trọ, 5 tin hiện mỗi người | 10 ms | 690 ms | 690 ms |
| C: 300 chủ trọ, 200 tin hiện mỗi người | 6,0 đến 6,7 s | 6,0 s | 6,2 s |

Chi tiết một tin theo mã: 0 ms (đã đo ở dạng R và A). Trang 1 sắp theo giá, lọc phường, lọc giá: từ 0,2 ms đến 1,3 s tùy dạng (lọc giá ở dạng C 1,3 s; lọc phường ở dạng B và R khoảng 150 ms).

- Dự phòng (a), chỉ mục một phần `(property_id, created_at, id)`: gần như không đổi (dạng R đếm 488 ms; dạng A trang 1 còn tệ hơn, 939 ms; dạng C đếm 2,8 s). Đã bỏ, không giữ chỉ mục.
- Dự phòng (b), CTE đếm tin hiện theo chủ trọ một lần rồi chỉ xếp hạng chủ trọ vượt hạn mức: không cứu dạng A và C (mọi chủ trọ đều vượt), dạng B tệ hơn (đếm 799 ms). Đã bỏ.
- Thử thêm, **không áp dụng**: viết lại vế hạng bằng một hàm cửa sổ `row_number()` tính một lần cho mọi tin. Đếm tổng 40 đến 240 ms ở cả bốn dạng, trang 40 đến 270 ms, nhưng chi tiết một tin chậm hơn (0 ms lên 20 đến 75 ms). Vẫn chưa đạt trọn ngân sách trang.
- **Quyết định của bạn (2026-10-19): bỏ qua ngân sách này.** Dự án là bản MVP không chạy thật, nên giữ nguyên luật và mảnh SQL đang chạy; AC-13 ghi nhận là **đã đo, chưa đạt ở 60 nghìn tin, bỏ qua có chủ đích**. Ở quy mô demo (vài nghìn tin trở xuống) các câu này vẫn nhanh. Nếu sau này cần chạy thật, hướng đã thử nằm ở dòng "thử thêm" ở trên và bước 7c của Build plan (quay lại `/architect`).

## Value sourcing (mốc 4)
- [ ] `now`: một giá trị mỗi request, controller lấy `new Date()` rồi truyền xuống Service (`getStatus`, `listOwn`, `getOwn`, `update`, `hide`, `show`) và `resolve` → test đơn vị truyền `now` cố định và kiểm biên mili giây (`memberships.service.spec.ts`, `listings.service.spec.ts`) → AC-10, AC-11
- [ ] `state`, `listingLimit`, `trialEndsAt` của `/me/membership`: cùng hàm `MembershipsService.resolve` với cổng đăng và hiện tin (không tính lần thứ hai) → đổi `trial_listing_limit` rồi gọi lại: `listingLimit` đổi ngay → AC-10
- [ ] `visibleCount`: `countVisibleByLandlord` của `sub` trong token, cùng hàm cổng đăng tin dùng (tin `hidden_by_owner`, `hidden_by_admin`, đã xóa mềm và tin của chủ trọ khác không tính; tin bị ẩn bớt vì vượt hạn mức vẫn tính) → AC-10
- [ ] `trialDaysLeft` = `ceil((trialEndsAt - now) / 86400000)` khi `trial`, 0 khi `expired` có `trialEndsAt`, `null` khi không có `trialEndsAt` → bốn mốc làm tròn ở trên và admin → AC-10
- [ ] `remaining` = `max(0, listingLimit - visibleCount)`, `overLimitCount` = `max(0, visibleCount - listingLimit)` → ba ca: dưới, bằng, vượt hạn mức → AC-10
- [ ] `isPublic` = `status` là `visible` và `id` nằm trong N tin `visible` chưa xóa đăng sớm nhất của chủ trọ (`created_at` rồi `id`, N là `listingLimit` của `resolve`); một truy vấn `LIMIT N` cho mỗi request, bỏ qua khi N = 0 hoặc khi không tin nào đang `visible` → `listings.service.spec.ts` kiểm số lần gọi `findEarliestVisibleIds`, đối chiếu độc lập ở trên kiểm kết quả → AC-11

## Acceptance-criteria coverage
- Mốc 1: AC-2 … covered by các bước `GET /settings`, `PATCH /settings/:key`, quyền, `@FreshAuth`, Value sourcing · AC-12 … covered by các bước migration, `CHECK`, `prisma migrate diff`, seed, giá trị hỏng hoặc thiếu
- Mốc 2: AC-1 … covered by các bước đăng ký (landlord, tenant, admin, trùng số, đổi `trial_days`) · AC-3 … covered by hạn mức đổi có hiệu lực ngay, hết dùng thử, admin hạn mức 0 · AC-4 … covered by đăng tin đủ hạn mức, hết dùng thử, thứ tự lỗi · AC-5 … covered by `show` đủ hạn mức, hết dùng thử, thứ tự lỗi · AC-6 … covered by ẩn trả lại chỗ, hết dùng thử không chặn hide, sửa, xóa · AC-7 … covered by ba kịch bản đua và ca đối chứng
- Mốc 3: AC-8 … covered by các bước hết dùng thử (biến khỏi danh sách và chi tiết, vẫn thấy ở /me/listings, gia hạn hiện lại), chủ trọ khóa, nhà trọ xóa mềm, tin admin, so khớp truy vấn tay, trang vượt cuối, ranh giới mili giây · AC-9 … covered by các bước hạ hạn mức (3, 2, 1, 0, nâng lại), ẩn và xóa tin sớm nhất, cùng `created_at`, chủ trọ khác không bị ảnh hưởng, ca đối chứng
- Mốc 4: AC-10 … covered by các bước `GET /me/membership` (quyền, bảy trường, đủ hạn mức, hạ hạn mức, hết dùng thử, admin, làm tròn số ngày) · AC-11 … covered by `isPublic` ở mọi phản hồi tin của chủ trọ, ca bị ẩn bớt, ca hết dùng thử, đối chiếu độc lập ba cách và ca đối chứng · AC-13 … đã đo và ghi ở "Kết quả đo AC-13": **chưa đạt, bỏ qua có chủ đích theo quyết định của bạn ngày 2026-10-19**
- Còn lại: không (mọi AC của spec đã có bước kiểm; AC-13 là ngoại lệ ghi ở trên)
