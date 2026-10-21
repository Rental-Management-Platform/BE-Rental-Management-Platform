# Verify: hồ sơ cá nhân · spec 0008 · updated 2026-10-21
_Steps derived from spec 0008 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Chạy trên một database thử (đã dùng `rental_management_verify`), không chạy trên database đang dùng. Dọn schema, rồi `npx prisma migrate deploy` và `npm run seed`, khởi động lại server trước mỗi lần chạy (bộ đếm giới hạn tần suất nằm trong bộ nhớ; đăng ký tối đa 10 lần mỗi giờ theo IP, mỗi người `PATCH` tối đa 30 lần mỗi giờ). Mỗi bước đối chiếu với **hàng thô** trong `users` bằng SQL, không chỉ với phản hồi. Cần chín tài khoản: bốn chủ trọ (một bị xóa mềm bằng SQL), năm người tìm trọ (một bị khóa bằng API admin), và admin seed.

## Commands
- [ ] `npx tsc --noEmit` và `npx eslint "src/users/**/*.ts" "src/common/rate-limit/**/*.ts"` → sạch → AC-1 đến AC-9
- [ ] `npm test` → toàn bộ qua, gồm `update-profile.dto.spec.ts`, `users.service.spec.ts`, `users.repository.spec.ts`, `users.mapper.spec.ts`, `rate-limits.spec.ts` và `route-declarations.spec.ts` (hai route mới khai báo đúng một kiểu quyền) → AC-1 đến AC-9
- [ ] `git status --short prisma/` → rỗng: không migration, không bảng, không cột, không chỉ mục mới → Decision
- [ ] Newman với folder 01, 03, 07, 08, 09, 20 rồi 21 của `docs/api/postman-collection.json` trên database trống mới seed (folder 21 dùng `adminToken` của folder 20, không đăng nhập lại vì mỗi email chỉ đăng nhập 10 lần mỗi 15 phút) → không request hay assertion nào lỗi → AC-1 đến AC-8

## UI / manual (gọi API, Postman folder `21 Hồ sơ cá nhân`)

AC-1, đọc hồ sơ:
- [ ] Người tìm trọ, chủ trọ và admin `GET /me/profile` → 200, đúng bảy khóa (`accountType`, `createdAt`, `email`, `id`, `name`, `phone`, `status`), mỗi giá trị khớp hàng thô (`createdAt` là `created_at` dạng ISO), có `Cache-Control: private, no-store` → AC-1
- [ ] Văn bản JSON không chứa `password`, `argon`, `hash`, `trial`, `locked`, `deleted`, `session`, `token` → AC-1

AC-2 và AC-3, sửa tên và số của người tìm trọ và admin:
- [ ] `PATCH` `{ "name": "  Lan  ", "phone": "+84 912.345.678" }` → 200, `name` là `Lan`, `phone` là `0912345678`, bảy trường và header như `GET`, hàng thô khớp, `updated_at` đã tăng; `GET` ngay sau trả đúng nội dung `PATCH` → AC-2, AC-3
- [ ] `PATCH` `{}` → 200 hồ sơ hiện tại, `updated_at` không đổi → AC-2
- [ ] `{ "name": null }`, `{ "name": "   " }`, `{ "name": "" }` → `name` thành null, số giữ nguyên → AC-2
- [ ] `name` đúng 100 ký tự → 200; 101 ký tự → 400 `VALIDATION_FAILED` trường `name`, tên cũ giữ nguyên → AC-2
- [ ] `{ "phone": null }` → số thành null; `{ "phone": "" }`, `"12345"`, `"0212345678"` → mỗi cái 400 trường `phone` với câu "Số điện thoại không hợp lệ.", số vẫn null → AC-3
- [ ] Người tìm trọ đặt số trùng số của một chủ trọ → 200 (số người tìm trọ không cần duy nhất); admin sửa tên, đặt số và xóa số của chính mình → 200 → AC-3, AC-7

AC-4, số điện thoại của chủ trọ:
- [ ] Đổi sang số tự do → 200, hàng thô khớp, và số cũ không còn chủ trọ nào giữ → AC-4
- [ ] Gửi lại đúng số của mình, viết `+84 ...` và viết chuẩn → 200, không phải `PHONE_TAKEN` → AC-4
- [ ] Gửi số của chủ trọ khác kèm `name` mới → 409 `PHONE_TAKEN`; `name`, `phone`, `updated_at` giữ nguyên từng cột → AC-4
- [ ] Gửi số của chủ trọ đã xóa mềm (bằng SQL) → 409 `PHONE_TAKEN`, số giữ nguyên → AC-4
- [ ] `{ "phone": null, "name": "..." }` → 400 trường `phone`, mã `isDefined`, câu "Người đăng bài phải có số điện thoại.", không ghi gì kể cả tên; `{ "phone": "" }` → 400 trường `phone` → AC-4
- [ ] Chỉ đổi tên → 200, số giữ nguyên → AC-4
- [ ] Ghi thẳng bằng SQL số của chủ trọ khác vào hàng chủ trọ → `users_landlord_phone_unique` từ chối (23505): chốt chặn cuối còn nguyên → AC-4
- [ ] Hai chủ trọ cùng `PATCH` một số tự do, lặp mười vòng (đặt lại số riêng của hai người bằng SQL trước mỗi vòng) → mỗi vòng đúng một hàng giữ số, một người 200, người kia 409 hoặc 500, người giữ số đúng là người 200 → AC-4

AC-5, trường không được sửa (dùng một tài khoản riêng, 12 lần `PATCH`):
- [ ] Gửi từng trường `email`, `accountType`, `status`, `id`, `roles`, `password`, `passwordHash`, `lockedReason`, `createdAt`, `trialEndsAt`, `unknownField` → mỗi cái 400 `VALIDATION_FAILED` đúng một tên trường; `name` hợp lệ kèm `accountType` vẫn 400 → AC-5
- [ ] Sau cả loạt, hàng thô của tài khoản đó không đổi một cột nào, và `account_type` vẫn là `tenant` → AC-5

AC-6, chỉ chạm hồ sơ của chính mình:
- [ ] `PATCH` của tài khoản A đổi tên của A; gửi `id` của B trong body → 400 trường `id`; hàng thô của B giữ nguyên từng cột (so cả dòng trước và sau); `GET` của B trả hồ sơ của B → AC-6

AC-7, quyền và trạng thái:
- [ ] `GET` và `PATCH` không token → 401 `TOKEN_MISSING`; token `abc.def.ghi` → 401 `TOKEN_INVALID` → AC-7
- [ ] Admin `PATCH /account-types/tenant` gỡ `profile:update`, người tìm trọ đăng nhập lại: `PATCH` → 403 `PERMISSION_DENIED` và không ghi, `GET` vẫn 200; trả quyền về như cũ (so như tập hợp vì API lưu theo thứ tự đã sắp), đăng nhập lại thì `PATCH` được → AC-7
- [ ] Admin khóa một tài khoản, token của nó còn hạn: `GET` và `PATCH` đều 403 `ACCOUNT_LOCKED`, và `PATCH` không đổi `name`, `updated_at` → AC-7
- [ ] Tài khoản bị xóa mềm bằng SQL, token còn hạn: `GET` và `PATCH` đều 401 `TOKEN_INVALID`, không ghi → AC-7

AC-8, hiệu lực ở nơi khác:
- [ ] Chủ trọ có một nhà trọ và một tin; đổi tên và số cùng lúc → `GET /auth/me`, `GET /landlords/:id` (tên) và chi tiết tin khi đã đăng nhập (tên và số) hiện giá trị mới; khách vẫn thấy `phone: null` → AC-8
- [ ] Access token cũ vẫn gọi được `GET /me/profile`; `POST /auth/refresh` bằng cookie cũ (có `Origin`) → 200 → AC-8
- [ ] `trial_ends_at`, `GET /me/membership` và `GET /me/listings` (số tin, `isPublic`) giống hệt trước khi đổi → AC-8

AC-9, giới hạn tần suất:
- [ ] Một người tìm trọ `PATCH` 30 lần đầu → 200; lần 31 → 429 `RATE_LIMITED` kèm `Retry-After` từ 1 giây, và không ghi (tên giữ như lần 30); sau đó `GET` 100 lần liền đều 200 → AC-9

Điều khiển âm (bước kiểm thật, không phải test tự động; sửa file build trong `dist`, không đụng mã nguồn):
- [ ] Bỏ vế bỏ qua hàng của chính người gọi (`exceptUserId === undefined` thành `true`) → gửi lại số của mình bị 409: hai kiểm tra phải sai → AC-4
- [ ] Bỏ chặn `phone === null` của chủ trọ trong `assertPhoneAllowed` → `phone: null` thành 500 thay vì 400: một kiểm tra phải sai → AC-4
- [ ] `findById` lấy cả mật khẩu băm và `toProfileResponse` chép nguyên hàng → `passwordHash` lộ ra phản hồi: ba kiểm tra phải sai → AC-1, AC-2

## Acceptance-criteria coverage
- AC-1 … đọc hồ sơ, bảy trường, khớp hàng thô, không bí mật, header, điều khiển mapper · AC-2 … sửa tên, cắt khoảng trắng, xóa tên, 100 và 101 ký tự, body rỗng không ghi · AC-3 … số của người tìm trọ và admin, chuẩn hóa, xóa bằng null, chuỗi rỗng 400, không cần duy nhất · AC-4 … số của chủ trọ, tự do, của mình, của người khác, của người xóa mềm, null, đua, chỉ mục DB, hai điều khiển âm · AC-5 … mười một trường không được sửa · AC-6 … hai tài khoản A và B, so hàng thô · AC-7 … không token, token rác, gỡ quyền, khóa, xóa mềm · AC-8 … `/auth/me`, hồ sơ công khai, chi tiết tin, phiên, kỳ dùng thử · AC-9 … ba mươi lần rồi 429, `GET` không giới hạn

## Kết quả đã chạy 2026-10-21
- Kiểm thật bằng script gọi API và SQL: **119 kiểm tra, 0 sai**, trên database thử sạch đã migrate và seed, mỗi lần khởi động lại server. Số lần `PATCH` mỗi người: người tìm trọ nhiều nhất 18 (ngoài tài khoản thử giới hạn: 31), chủ trọ nhiều nhất 10.
- Đua hai chủ trọ cùng một số, mười vòng: **không có vòng nào có hai hàng giữ cùng số**; người thua nhận 409 và 500 xen kẽ (5 lần mỗi loại). 409 khi truy vấn kiểm trùng đã thấy hàng của người thắng, 500 khi cả hai kiểm trùng cùng qua rồi chỉ mục duy nhất chặn người đến sau. Đúng như spec đã chấp nhận.
- Điều khiển âm, cả ba đều bị bắt: bỏ vế bỏ qua chính mình → 2 kiểm tra sai (gửi lại số của mình bị 409 ở hai dạng); bỏ chặn `phone: null` của chủ trọ → 1 kiểm tra sai (500 thay vì 400); mapper chép nguyên hàng cùng `findById` lấy mật khẩu băm → 3 kiểm tra sai (bảy trường ở `GET` và `PATCH`, và `passwordHash`/`argon2id` lộ trong JSON).
- `npx tsc --noEmit` và ESLint sạch; `npm test`: 65 suite, 1212 bài qua.
- Newman folder 00 đến 05 và 07 đến 21 (mọi folder trừ 06): **478 request, 983 assertion, hai lượt liền** (khởi động lại server giữa hai lượt vì bộ đếm đăng nhập admin nằm trong bộ nhớ); chỉ hai assertion đã biết của folder 02 (`Đặt lại mật khẩu`, `Đổi mật khẩu`, cần email thật) sai ở cả hai lượt. Folder 21 không đăng nhập admin lại: lần đầu có request đăng nhập thì bị 429 vì đây là lần đăng nhập thứ 11 trong 15 phút (giới hạn 10 mỗi email).

## Ghi chú
- Ca "quyền bị gỡ", "tài khoản xóa mềm", đua hai chủ trọ và giới hạn tần suất cần nhiều tài khoản hoặc SQL nên chỉ có ở script kiểm này, không có trong Postman folder 21.
- Postman folder 21 đổi tên và số của chủ trọ thử rồi **khôi phục ở request cuối**, và khóa rồi mở khóa tài khoản đó ở giữa; chạy nó mà bỏ dở giữa chừng thì tài khoản có thể còn bị khóa (mở khóa bằng folder 04 hoặc `POST /users/:id/unlock`).
- `ErrorCode` không đổi: ca chủ trọ xóa số dùng `VALIDATION_FAILED` với `code: 'isDefined'` ở `errors[0]`, cùng mã và câu với `RegisterDto`.
