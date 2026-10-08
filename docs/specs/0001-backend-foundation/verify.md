# Verify: loại tài khoản, phân quyền và mật khẩu · spec 0001 (con 0002 và 0003) · cập nhật 2026-10-08
_Các bước suy ra từ acceptance criteria của spec 0002 (AC-1, AC-3, AC-6, AC-13) và 0003 (AC-1 đến AC-11). `/check verify` chạy lại các bước này; `/test` khóa những bước bền thành test._

Chuẩn bị một lần: `.env` có `JWT_ACCESS_SECRET`, `ALLOWED_ORIGINS`, `ADMIN_SEED_*`; làm lại DB dev bằng `npx prisma migrate reset`, rồi `npm run seed`, rồi `npm run start:dev`. Mọi đường dẫn bên dưới nằm dưới `/api/v1`.

## UI / manual
### Đăng ký (spec 0002)
- [ ] `POST /auth/register` thiếu `accountType` → 400 `VALIDATION_FAILED`, `message` tiếng Việt → AC-1
- [ ] đăng ký với `accountType: "admin"` hoặc kèm `roles` → 400 → AC-1
- [ ] đăng ký `landlord` không có `phone`, hoặc `phone: "0212345678"` → 400, lỗi ở trường `phone` → AC-13
- [ ] đăng ký `landlord` với `phone: "+84 912.345.678"` → 201, `user.phone` là `0912345678`, `user` chỉ có `id, email, name, accountType, phone, status` → AC-13
- [ ] đăng ký `landlord` thứ hai với `0912 345 678` → 409 `PHONE_TAKEN`; email trùng (kể cả khác hoa thường) → 409 `EMAIL_TAKEN` → AC-1, AC-13
- [ ] đăng ký `tenant` dùng cùng số đó → 201 (tenant không bị kiểm trùng) → AC-13
- [ ] email hoặc số của tài khoản đã xóa mềm (đặt `deleted_at` bằng SQL) → vẫn 409, không phải 500 → AC-13
### Token và quyền (spec 0003)
- [ ] giải mã access token của tenant: có `type: "tenant"`, `perms` dạng gộp (`favorite:manage`), không có `roles` → spec 0002 AC-3, spec 0003 AC-3
- [ ] `GET /auth/me` → `{ user, permissions }`, quyền mở rộng từng hành động; tài khoản bị khóa → 403 `ACCOUNT_LOCKED` → AC-3
- [ ] không token → 401 `TOKEN_MISSING`; tenant gọi `GET /account-types` → 403 `PERMISSION_DENIED`; `GET /` công khai → 200 → AC-4
- [ ] đăng nhập admin (tài khoản seed): token có `type: "admin"` và `account_type:manage` → AC-2
- [ ] `GET /account-types` → 3 loại, admin có toàn bộ quyền; `GET /permissions` → danh mục kèm `adminActions` → AC-2, AC-6
- [ ] `PATCH /account-types/tenant` gửi `["listing:manage"]`, `["profile:manage"]`, `["listing:moderate"]`, `["finance:read"]` → mỗi lần 400 `PERMISSION_ADMIN_ONLY` → AC-6, AC-11
- [ ] `PATCH` với khóa lạ → 400 `PERMISSION_UNKNOWN`; sửa `admin` → 409 `SYSTEM_TYPE_PROTECTED`; loại không có → 404 `ACCOUNT_TYPE_NOT_FOUND` → AC-1, AC-2, AC-6
- [ ] admin bỏ `favorite:create` khỏi tenant (gửi danh sách trùng, kết quả đã bỏ trùng) → token cũ của tenant chưa đổi; sau `POST /auth/refresh` token mới không còn `favorite:manage` nhưng còn `favorite:read` và `favorite:delete` → AC-10
### Khóa tài khoản (spec 0003)
- [ ] admin khóa chính mình → 409 `CANNOT_LOCK_SELF`; tenant gọi lock → 403 `PERMISSION_DENIED`; thiếu `reason` → 400; id sai → 400 `INVALID_ID`; người không có → 404 `USER_NOT_FOUND` → AC-7
- [ ] admin khóa tenant → 200; khóa lần hai → 409 `ACCOUNT_ALREADY_LOCKED`; mở khóa → 200; mở lần hai → 409 `ACCOUNT_NOT_LOCKED` → AC-7
- [ ] sau khi khóa: tenant đăng nhập đúng mật khẩu → 403 `ACCOUNT_LOCKED`, sai mật khẩu → 401 `INVALID_CREDENTIALS`, refresh không được, mọi phiên bị hủy → AC-7
- [ ] bảng `moderation_logs` có đúng 2 dòng (`lock`, `unlock`) kèm lý do; `users.locked_reason` rỗng sau khi mở khóa → AC-7
- [ ] `POST /users/:id/revoke-sessions` → 204, refresh sau đó → 401 `SESSION_REVOKED` → AC-7
- [ ] admin 2 khóa admin 1: admin 1 gọi endpoint thường vẫn 200 (token còn hạn), gọi endpoint `@FreshAuth()` (ví dụ `PATCH /account-types/tenant`) → 403 `ACCOUNT_LOCKED` ngay → AC-8
### Seed
- [ ] `npm run seed` lần đầu tạo admin; lần hai báo "Đã có 1 tài khoản admin"; email seed đã thuộc tài khoản không phải admin (kể cả viết hoa, thừa khoảng trắng, đã xóa mềm) → dừng, không đổi loại → AC-9

## Commands
- [ ] `npm test` → toàn bộ test qua (gồm test duyệt mọi route khai báo đúng một kiểu quyền) → AC-1, AC-4, AC-5, AC-9, AC-11
- [ ] `npx tsc --noEmit` và `npx eslint "src/**/*.ts"` → sạch
- [ ] `DATABASE_NAME=<db> npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected" → AC-2, AC-3
- [ ] truy vấn DB: `account_types` có 3 dòng; `users_landlord_phone_check` và `users_landlord_phone_unique` tồn tại; ghi thẳng một `landlord` không có `phone` bị `CHECK` chặn → AC-2, AC-3

## Acceptance-criteria coverage
- spec 0003: AC-1 danh mục + `PERMISSION_UNKNOWN` · AC-2 ba loại, admin bảo vệ · AC-3 một loại mỗi tài khoản · AC-4 khai báo mọi route · AC-5 `assertOwner` (test đơn vị; chưa có route dùng, kiểm lại khi có tính năng đầu tiên theo chủ sở hữu) · AC-6 sửa quyền loại · AC-7 khóa, mở khóa, thu hồi · AC-8 `@FreshAuth()` · AC-9 seed · AC-10 quyền đổi sau refresh · AC-11 báo cáo tài chính chỉ admin
- spec 0002: AC-1 đăng ký chọn loại · AC-3 payload có `type` và `perms` · AC-6 refresh đọc lại quyền của loại · AC-13 số điện thoại

## Value sourcing (mỗi nguồn giá trị một bước)
- [ ] `perms` trong token lấy từ quyền của loại trong DB (admin: toàn bộ trong code): đổi quyền loại rồi refresh, token đổi theo → spec 0003 AC-10
- [ ] `type` trong token lấy từ `users.account_type`: đăng ký landlord thì token `landlord`, seed admin thì token `admin`
- [ ] `/me` đọc quyền từ DB, không từ token: đổi quyền loại rồi gọi `/me` ngay (chưa refresh) → thấy quyền mới
- [ ] `locked_reason`, người thực hiện, thời điểm lấy từ `reason`, `sub` của token, giờ hệ thống: kiểm `moderation_logs.actor_id` đúng admin gọi
- [ ] `phone` đã chuẩn hóa: gõ nhiều kiểu cho cùng một số, DB chỉ lưu `0xxxxxxxxx`

---

## Hàng 6: quên mật khẩu và đổi mật khẩu (spec 0002 AC-8, AC-9, AC-12)
_Bước thử bằng Postman folder `02 Quên và đổi mật khẩu`. Cần `.env` có `APP_BASE_URL` và `MAIL_*` (thiếu thì API không khởi động); muốn nhận email thật, `MAIL_PASSWORD` là App Password của Gmail do bạn tự điền._

### UI / manual
- [ ] `POST /auth/forgot-password` với email không có tài khoản và với email có thật → cùng 202 và cùng nội dung; chỉ email thật nhận thư → AC-8
- [ ] thư nhận được có tiêu đề `Đặt lại mật khẩu của bạn`, viết tiếng Việt, chào đúng tên, có liên kết `<APP_BASE_URL>/reset-password?token=...` và nêu hạn 30 phút → AC-8
- [ ] bấm quên mật khẩu hai lần liên tiếp → liên kết của lần đầu `POST /auth/reset-password` bị 400 `RESET_TOKEN_INVALID`, liên kết của lần hai dùng được; bảng `password_resets` chỉ còn một dòng chưa dùng của người đó → AC-8 (quyết định: chỉ liên kết mới nhất)
- [ ] reset với `newPassword` ngắn hơn 8 ký tự → 400 `VALIDATION_FAILED` ở trường `newPassword` và liên kết chưa bị dùng; reset đúng → 204, mật khẩu cũ đăng nhập 401, mật khẩu mới đăng nhập 200 → AC-8
- [ ] sau reset, `POST /auth/refresh` bằng cookie của mọi thiết bị đang đăng nhập → 401 `SESSION_REVOKED`; `auth_sessions.revoked_reason` là `password_changed` → AC-8
- [ ] dùng lại chính liên kết đó lần hai → 400 `RESET_TOKEN_INVALID`, mật khẩu không đổi → AC-8
- [ ] liên kết quá hạn (đặt `PASSWORD_RESET_TTL_MINUTES=1` rồi đợi, hoặc sửa `expires_at` trong DB) → 400 `RESET_TOKEN_INVALID` dù dòng còn trong bảng → AC-8
- [ ] tài khoản bị khóa vẫn nhận thư và reset được mật khẩu, nhưng đăng nhập vẫn 403 `ACCOUNT_LOCKED`; tài khoản đã xóa mềm không nhận thư → AC-8 (quyết định mặc định, chưa nằm trong spec)
- [ ] gửi email thật qua Gmail (cổng 465) tới hộp thư của bạn → thư tới, liên kết mở được trang FE `/reset-password` → AC-8 (chưa thử, cần bạn điền Gmail)
- [ ] ngắt mạng hoặc cố ý sai `MAIL_PASSWORD` → quên mật khẩu vẫn trả 202 ngay; log có dòng `Không gửi được email đặt lại mật khẩu` và không chứa token hay mật khẩu SMTP → AC-8
- [ ] `POST /auth/change-password` với `currentPassword` sai → 400 `CURRENT_PASSWORD_WRONG`, mật khẩu và các phiên không đổi → AC-9
- [ ] đăng nhập ba thiết bị A, B, C rồi đổi mật khẩu từ A → 204; refresh A vẫn 200, refresh B và C đều 401 `SESSION_REVOKED` → AC-9
- [ ] đổi sang chính mật khẩu hiện tại → 204 (quyết định: không thêm luật) → AC-9
- [ ] đổi mật khẩu không kèm token → 401 `TOKEN_MISSING`; thiếu `currentPassword` hoặc `newPassword` ngắn → 400 `VALIDATION_FAILED` → AC-9

### Commands
- [ ] `npm test` → toàn bộ qua, gồm `password.service.spec.ts`, `password-reset.email.spec.ts`, `password-dtos.spec.ts` và các biến mới trong `env.validation.spec.ts` → AC-8, AC-9, AC-12
- [ ] `DATABASE_NAME=<db> npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected" → AC-8
- [ ] truy vấn DB: `password_resets` có chỉ mục duy nhất `password_resets_token_hash_unique` và khóa ngoại `ON DELETE CASCADE`; `token_hash` là SHA-256 của token trong thư, không dòng nào chứa token thô → AC-8, AC-12
- [ ] `newman run docs/api/postman-collection.json` (bỏ request `Đặt lại mật khẩu` vì cần token trong thư) → không lỗi → bộ Postman còn đúng với API

### Acceptance-criteria coverage
- spec 0002: AC-8 quên và đặt lại mật khẩu · AC-9 đổi mật khẩu · AC-12 token đặt lại chỉ lưu bản băm

### Value sourcing
- [ ] liên kết trong thư lấy từ `APP_BASE_URL` cộng đường dẫn cố định `/reset-password?token=`: đổi `APP_BASE_URL` rồi xin lại → liên kết đổi theo → AC-8
- [ ] hạn dùng lấy từ `PASSWORD_RESET_TTL_MINUTES`: đặt `5`, xin liên kết → thư nêu 5 phút và `expires_at` cách `created_at` đúng 5 phút → AC-8
- [ ] người gửi lấy từ `MAIL_FROM`, máy chủ và đăng nhập SMTP từ `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` (`secure` chỉ khi cổng 465) → AC-8
- [ ] lời chào lấy từ `users.name` (tên có `<` hoặc `&` được thoát trong bản HTML); không có tên thì chào chung → AC-8
- [ ] `users.password_changed_at` được ghi lúc đặt lại hoặc đổi mật khẩu thành công → AC-8, AC-9
