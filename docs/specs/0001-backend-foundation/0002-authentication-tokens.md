# 0002. Đăng nhập và token (spec con của 0001 nền móng backend)

**Date**: 2026-10-05

## Summary

Spec con này chốt cách đăng nhập: access token (chìa khóa ngắn hạn 15 phút, mang sẵn danh sách quyền) cùng refresh token (chìa khóa dài hạn để lấy access token mới, xoay vòng mỗi lần dùng). Refresh token nằm trong cookie httpOnly, chỉ lưu bản băm trong DB, và nếu bị dùng lại sau khi đã xoay thì cả phiên đăng nhập đó bị hủy. Nó cũng cho đăng ký miễn phí và chọn một loại tài khoản (người đăng bài hay người tìm trọ), sửa lỗi tự đăng ký Admin, kiểm số điện thoại của người đăng bài (chỉ kiểm trùng, không gửi SMS) và chặn tài khoản bị khóa đăng nhập.

## Requirements

**User stories**:
- Là người dùng, tôi muốn đăng ký, đăng nhập và ở lại đăng nhập nhiều ngày mà không phải nhập lại mật khẩu, để dùng web thuận tiện.
- Là người dùng, tôi muốn đăng xuất và đổi hoặc lấy lại mật khẩu, để giữ tài khoản an toàn.
- Là admin, tôi muốn tài khoản bị khóa không dùng được hệ thống, để chặn người vi phạm.
- Là nhóm phát triển, tôi muốn token bị đánh cắp bị phát hiện và vô hiệu, để hạn chế thiệt hại.

**Acceptance criteria**:
- **AC-1**: Đăng ký công khai miễn phí, bắt buộc chọn `accountType` là `tenant` (người tìm trọ) hoặc `landlord` (người đăng bài), không có giá trị mặc định; loại không đổi được sau đó (spec 0003). Chọn loại khác (kể cả `admin`), body có `roles` hoặc trường lạ bị từ chối 400 `VALIDATION_FAILED`. Email trùng, kể cả với tài khoản đã xóa mềm, bị 409 `EMAIL_TAKEN`.
- **AC-2**: Đăng nhập đúng trả 200 với `{ accessToken, expiresIn }` và đặt cookie refresh. Sai email hoặc sai mật khẩu đều trả 401 `INVALID_CREDENTIALS` cùng một nội dung, và thời gian xử lý tương đương (không lộ email nào có tồn tại). Tài khoản `locked` bị 403 `ACCOUNT_LOCKED`, và chỉ sau khi mật khẩu đã đúng (kiểm mật khẩu trước, để người ngoài không dò được tài khoản nào bị khóa).
- **AC-3**: Access token là JWT HS256, hạn `ACCESS_TTL_SECONDS` (mặc định 900), payload `{ sub, sid, type, perms, iat, exp, iss, aud }` (`type` là loại tài khoản, không đổi sau khi tạo). Gọi endpoint cần đăng nhập mà thiếu token, token sai chữ ký, hoặc hết hạn trả 401 với `code` lần lượt `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`.
- **AC-4**: `POST /auth/refresh` với cookie hợp lệ trả access token mới và đặt cookie refresh mới; token cũ sau đó không còn dùng được, trừ khoảng ân hạn `REFRESH_GRACE_SECONDS` (mặc định 10 giây) để hai tab cùng refresh không làm hỏng nhau.
- **AC-5**: Dùng lại một refresh token đã được xoay, ngoài khoảng ân hạn, hủy cả phiên đăng nhập đó và trả 401 `SESSION_REVOKED`. Refresh với phiên hết hạn trả 401 `SESSION_EXPIRED`; thiếu cookie trả 401 `REFRESH_TOKEN_MISSING`.
- **AC-6**: Mỗi lần refresh đọc lại người dùng và quyền của loại tài khoản từ DB. Sau khi admin đổi quyền của một loại, lần refresh kế tiếp của tài khoản thuộc loại đó trả access token có `perms` mới. Người dùng bị khóa thì refresh trả 403 `ACCOUNT_LOCKED` và các phiên của họ bị hủy; người dùng đã xóa mềm hoặc không còn thì phiên bị hủy và refresh trả 401 `SESSION_REVOKED`.
- **AC-7**: `POST /auth/logout` hủy phiên hiện tại và xóa cookie; `POST /auth/logout-all` (cần đăng nhập) hủy mọi phiên của người dùng.
- **AC-8**: `POST /auth/forgot-password` luôn trả 202 cùng một nội dung dù email có tồn tại hay không. Nếu tồn tại thì gửi email chứa liên kết dùng một lần, hết hạn sau `PASSWORD_RESET_TTL_MINUTES` (mặc định 30). `POST /auth/reset-password` đặt mật khẩu mới, đánh dấu liên kết đã dùng và hủy mọi phiên; liên kết sai, hết hạn hoặc đã dùng trả 400 `RESET_TOKEN_INVALID`.
- **AC-9**: `POST /auth/change-password` (cần đăng nhập) đòi mật khẩu hiện tại (sai thì 400 `CURRENT_PASSWORD_WRONG`), đặt mật khẩu mới và hủy mọi phiên khác, giữ phiên hiện tại.
- **AC-10**: Đăng nhập, đăng ký, quên mật khẩu và refresh bị giới hạn tần suất theo IP và theo email (nếu có); vượt quá trả 429 `RATE_LIMITED` kèm header `Retry-After`.
- **AC-11**: Cookie refresh có `HttpOnly`, `Secure` (theo `COOKIE_SECURE`, mặc định `false` vì localhost dùng http), `SameSite=Strict`, `Path=/api/v1/auth`, `Max-Age` bằng thời hạn refresh. `POST /auth/refresh` và `POST /auth/logout` kiểm tra header `Origin`: có mà không nằm trong `ALLOWED_ORIGINS` thì bị 403 `ORIGIN_NOT_ALLOWED`.
- **AC-12**: Mật khẩu được băm bằng argon2id, dài 8 đến 128 ký tự, không bao giờ xuất hiện trong response hay log. Refresh token và token đặt lại mật khẩu chỉ lưu bản băm SHA-256.
- **AC-13**: Tài khoản `landlord` bắt buộc có `phone` lúc đăng ký, kiểm ở DTO và ở DB bằng `CHECK` `users_landlord_phone_check` (`account_type <> 'landlord' OR phone IS NOT NULL`). Số được chuẩn hóa trước khi kiểm: bỏ dấu cách, dấu chấm, dấu gạch; đầu `+84` hoặc `84` đổi thành `0`; kết quả phải khớp `^0(3|5|7|8|9)\d{8}$`, sai thì 400 `VALIDATION_FAILED`. Thứ tự kiểm khi đăng ký: email trước, số điện thoại sau; số đã gắn với một tài khoản `landlord` khác, kể cả tài khoản đã xóa mềm, bị 409 `PHONE_TAKEN`. Hai người đăng ký trùng email hoặc trùng số gần như cùng lúc thì người chậm hơn nhận 500 (lỗi DB không được dịch, spec 0004). Cả hai bước kiểm trùng (email, số điện thoại) dùng phương thức `...IncludingDeleted` của Repository (spec 0005), vì chỉ mục duy nhất là chốt chặn cuối chứ không phải đường báo lỗi. Chỉ kiểm định dạng và trùng, không gửi SMS hay mã xác thực (bản demo). `tenant` có thể không khai báo `phone`; nếu có thì cũng chuẩn hóa và kiểm định dạng như trên nhưng không bị kiểm trùng. `landlord` không tự đổi `phone` sau khi đăng ký.

## Decision

Tự xử lý token trên các thành phần chuẩn: `@nestjs/jwt` cho access token, chuỗi ngẫu nhiên 256 bit (không phải JWT) cho refresh token, argon2id qua `@node-rs/argon2` để băm mật khẩu. Một phiên đăng nhập là một dòng trong bảng `auth_sessions`, token được xoay tại chỗ bằng một câu `UPDATE` có điều kiện.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`): rule `security-auth-jwt`, `security-use-guards`, `security-rate-limiting`. Khác với ví dụ trong rule đó: refresh token ngẫu nhiên 256 bit nên chỉ cần băm SHA-256 (không cần bcrypt), và mật khẩu dùng argon2id.

## Feature design

**Data model sketch** (cột dùng `snake_case` trong DB, quy ước ở spec 0005):

`users` (phần liên quan đăng nhập; các cột hồ sơ do spec F02 quyết định sau):
- `id`: uuid (UUID v7), khóa chính
- `email`: text, bắt buộc, chữ thường, cắt khoảng trắng, **duy nhất** (`users_email_unique`)
- `password_hash`: text, bắt buộc, Repository loại mặc định bằng `omit` của Prisma (chỉ phương thức đăng nhập mới đọc)
- `status`: text với `CHECK` `'active' | 'locked'`, mặc định `active`; `locked_reason`: text cho phép rỗng
- `account_type`: text, bắt buộc, khóa ngoại tới `account_types.key` (spec 0003), chọn lúc đăng ký và không đổi sau
- `phone`: text cho phép rỗng, đã chuẩn hóa; bắt buộc với `landlord`; chỉ mục duy nhất một phần `users_landlord_phone_unique` trên `phone` khi `account_type = 'landlord'`, tính cả dòng xóa mềm, và `CHECK` `users_landlord_phone_check` bắt `landlord` phải có `phone` (spec 0005)
- `password_changed_at`: timestamptz cho phép rỗng
- `created_at`, `updated_at`, `deleted_at`

`auth_sessions` (một dòng mỗi lần đăng nhập, mỗi thiết bị một phiên):
- `id`: uuid, khóa chính, chính là `sid` trong access token
- `user_id`: uuid, khóa ngoại tới `users` (`ON DELETE CASCADE`), có chỉ mục
- `token_hash`: text, SHA-256 hex của refresh token hiện tại, **duy nhất**
- `previous_token_hash`: text cho phép rỗng; `rotated_at`: timestamptz cho phép rỗng (dùng cho ân hạn và phát hiện dùng lại)
- `expires_at`: timestamptz, tuyệt đối `REFRESH_TTL_DAYS` ngày kể từ lúc đăng nhập
- `revoked_at`: timestamptz cho phép rỗng; `revoked_reason`: text với `CHECK` `'logout' | 'logout_all' | 'reuse_detected' | 'password_changed' | 'locked' | 'admin_revoked'`
- `user_agent`: text (cắt 255 ký tự); `ip`: text; `created_at`, `last_used_at`
- chỉ mục (`user_id`, `revoked_at`) để đếm và hủy phiên của một người

`password_resets`: `id`, `user_id` (khóa ngoại, `ON DELETE CASCADE`, có chỉ mục), `token_hash` (SHA-256, **duy nhất**), `expires_at`, `used_at` cho phép rỗng, `created_at`.

PostgreSQL không có chỉ mục tự xóa theo hạn (TTL) như MongoDB, nên: mọi lần đọc đều kiểm `expires_at > now()` (đây là phần quyết định đúng sai); còn dọn dẹp thì làm lúc ghi: khi tạo phiên mới, xóa các phiên của chính người đó đã hết hạn; khi tạo token đặt lại mật khẩu, xóa các token hết hạn của chính người đó. Không dùng lịch chạy nền.

**State transitions** (một phiên `auth_sessions`):

```
active (token_hash = h1)
  | refresh với h1            -> active (token_hash = h2, previous_token_hash = h1, rotated_at = now)
  | refresh với h1 trong ân hạn   -> active (chỉ cấp access token, không đổi cookie)
  | refresh với h1 ngoài ân hạn   -> revoked (reuse_detected)
  | logout / logout_all / đổi hoặc đặt lại mật khẩu / khóa tài khoản / admin thu hồi -> revoked
  | qua expires_at            -> hết hạn (kiểm khi đọc, dòng được dọn lúc tạo phiên mới)
revoked: không bao giờ quay lại active
```

Xoay token là một câu `UPDATE auth_sessions SET token_hash = $mới, previous_token_hash = $cũ, rotated_at = now() WHERE id = $sid AND token_hash = $cũ AND revoked_at IS NULL AND expires_at > now() RETURNING ...`. Không có dòng nào trả về thì xét tiếp: khớp `previous_token_hash` trong ân hạn thì cấp lại access token, ngoài ân hạn thì hủy phiên. Hai refresh đồng thời nhờ thế không đạp lên nhau.

**API surface** (tất cả dưới `/api/v1/auth`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/register` | POST | `email`, `password`, `name?`, `accountType` (`tenant` hoặc `landlord`, bắt buộc), `phone` (bắt buộc với `landlord`) | 201 `{ accessToken, expiresIn, user }` và cookie refresh | công khai | 400 `VALIDATION_FAILED`, 409 `EMAIL_TAKEN`, 409 `PHONE_TAKEN`, 429 |
| `/login` | POST | `email`, `password` | 200 `{ accessToken, expiresIn }` và cookie refresh | công khai | 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_LOCKED`, 429 |
| `/refresh` | POST | cookie refresh | 200 `{ accessToken, expiresIn }`, cookie mới (trừ trường hợp ân hạn) | công khai (cookie) | 401 `REFRESH_TOKEN_MISSING`, `SESSION_REVOKED`, `SESSION_EXPIRED`; 403 `ACCOUNT_LOCKED`, `ORIGIN_NOT_ALLOWED`; 429 |
| `/logout` | POST | cookie refresh | 204, xóa cookie | công khai (cookie) | 403 `ORIGIN_NOT_ALLOWED` |
| `/logout-all` | POST | không | 204 | bearer | 401 |
| `/forgot-password` | POST | `email` | 202 | công khai | 429 |
| `/reset-password` | POST | `token`, `newPassword` | 204 | công khai | 400 `RESET_TOKEN_INVALID`, `VALIDATION_FAILED`; 429 |
| `/change-password` | POST | `currentPassword`, `newPassword` | 204 | bearer | 400 `CURRENT_PASSWORD_WRONG`, 401 |
| `/me` | GET | không | 200 `{ user, permissions }` | bearer | 401 |

`user` trong mọi phản hồi (register, `/me`) có dạng `{ id, email, name, accountType, phone, status }`, không bao giờ có `password_hash`. Login và refresh chỉ trả token; FE gọi `/me` sau khi đăng nhập để biết loại tài khoản, không tự giải mã JWT. `/me` đọc người dùng từ DB mỗi lần gọi (không lấy từ token) và trả `permissions` đã mở rộng thành từng hành động (không gộp `module:manage`), để FE chỉ cần kiểm `includes`; tài khoản bị khóa nhận 403 `ACCOUNT_LOCKED`, tài khoản đã xóa mềm hoặc không còn nhận 401 `TOKEN_INVALID`.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| login, register, refresh | `perms` trong access token | quyền của loại tài khoản của người dùng, đọc từ `account_types` lúc cấp token (spec 0003; của `admin` là toàn bộ), đã gộp thành `module:manage` khi đủ mọi hành động |
| `/me` | `permissions` | quyền của loại của người dùng đọc từ `account_types` (của `admin`: toàn bộ), mở rộng `module:manage` thành từng hành động (spec 0003) |
| login, register, refresh | `type` trong access token | `users.account_type` của người dùng (spec 0003) |
| login, refresh | `sid` | `auth_sessions.id` |
| login, refresh | `expiresIn` | `ACCESS_TTL_SECONDS` |
| login, register | giá trị refresh token | `crypto.randomBytes(32)` mã hóa base64url; bản băm SHA-256 lưu ở `token_hash` |
| login, refresh | cookie `Max-Age`, `Secure`, tên cookie | `REFRESH_TTL_DAYS`, `COOKIE_SECURE`, `REFRESH_COOKIE_NAME` (mặc định `rt`) |
| login, refresh | `Path` của cookie, `SameSite` | hằng số `/api/v1/auth` và `Strict` trong code (FE phải gọi đúng đường dẫn này, xem 0006) |
| mọi endpoint giới hạn tần suất, tạo phiên | IP khách | `req.ip` của Express; `trust proxy` đặt theo `TRUST_PROXY_HOPS` (mặc định 0, vì không có proxy phía trước) |
| tạo phiên | `user_agent` | header `user-agent`, cắt 255 ký tự |
| forgot-password | liên kết đặt lại | `APP_BASE_URL` cộng đường dẫn FE `/reset-password?token=...` (đường dẫn là hằng số, FE phải có trang này) |
| forgot-password | nội dung email | tiếng Việt, mẫu cố định trong `MailService` (tiêu đề, lời chào, liên kết, hạn dùng `PASSWORD_RESET_TTL_MINUTES` phút), không dùng công cụ tạo mẫu |
| forgot-password | người gửi, máy chủ SMTP | `MAIL_FROM`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` |
| register | các loại cho tự chọn | hằng số `SELF_REGISTER_TYPES = ['landlord', 'tenant']` trong code (spec 0003) |
| register | `phone` đã chuẩn hóa, kết quả kiểm trùng | input `phone`; chuẩn hóa và kiểm định dạng trong code theo AC-13; trùng khi có tài khoản `landlord` khác (kể cả xóa mềm) giữ cùng số, kiểm trước bằng truy vấn tính cả dòng xóa mềm, chỉ mục duy nhất một phần (spec 0005) là chốt chặn cuối |
| login (email không tồn tại) | băm giả để cân bằng thời gian | một hằng số băm argon2id tạo sẵn lúc khởi động |
| mọi endpoint xác thực | `iss`, `aud`, khóa ký | `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_ACCESS_SECRET` |
| refresh, đếm phiên | số phiên tối đa mỗi người | `MAX_SESSIONS_PER_USER` (mặc định 10); vượt thì hủy phiên cũ nhất |
| băm mật khẩu | tham số argon2id | hằng số trong code: bộ nhớ 19456 KiB, 2 vòng, song song 1 (mức tối thiểu OWASP), đo lại thời gian ở lát cắt đầu |

**Key invariants**:
- Refresh token dạng thô không bao giờ được lưu hay ghi log; chỉ có bản băm SHA-256, và tìm phiên bằng bản băm.
- Một phiên chỉ có một `token_hash` hiện hành; `token_hash` duy nhất toàn bảng.
- Phiên đã `revoked` không bao giờ hoạt động lại.
- Không response nào chứa `password_hash` (vừa `select: false` vừa qua mapper).
- Người dùng `locked` không đăng nhập, không refresh được, và mọi phiên của họ bị hủy lúc khóa.
- Đặt lại mật khẩu hủy mọi phiên; đổi mật khẩu hủy mọi phiên khác.
- Đăng ký công khai không bao giờ tạo tài khoản `admin`; loại chỉ nhận `tenant` hoặc `landlord`.
- Một số điện thoại chỉ thuộc về một tài khoản `landlord`, kể cả khi tài khoản đó bị xóa mềm; `landlord` không tự đổi số.
- Xác minh access token không đọc DB, trừ endpoint gắn `@FreshAuth()` (spec 0003).
- Login luôn chạy một lần argon2 verify, kể cả khi email không tồn tại.
- Một phiên hết hạn không bao giờ được chấp nhận, dù dòng của nó chưa bị dọn.

**Security model**:
- Endpoint công khai: register, login, refresh (qua cookie), logout (qua cookie), forgot-password, reset-password. Các endpoint còn lại cần access token.
- Chống CSRF (gửi yêu cầu giả từ trang khác): cookie `SameSite=Strict`, endpoint cookie chỉ nhận POST JSON, và kiểm tra `Origin`. Trên localhost, FE và API ở hai cổng khác nhau vẫn là cùng site nên cookie đi được; phần bảo vệ còn lại do kiểm tra `Origin`.
- Dữ liệu cá nhân: email, số điện thoại, mật khẩu băm; không thuộc chuẩn tuân thủ đặc biệt. Số điện thoại chỉ được kiểm định dạng và trùng, không xác thực bằng mã, nên người dùng có thể nhập số không phải của mình. Hệ quả đã biết và được chấp nhận cho bản demo: ai đó có thể đăng ký tài khoản đăng bài bằng số của người khác và chặn người đó đăng ký sau (chưa có đường gỡ ngoài sửa số trực tiếp trong DB), và người dùng đổi SIM vẫn lấy thêm một lần dùng thử. Không ghi mật khẩu, token, cookie vào log (nestjs-pino che các trường này).
- Tồn tại email chỉ lộ qua `409 EMAIL_TAKEN` ở đăng ký (đánh đổi về trải nghiệm, được giới hạn tần suất). Số điện thoại đã đăng ký làm người đăng bài cũng lộ tương tự qua `409 PHONE_TAKEN`: hệ quả được chấp nhận cho bản demo, giảm nhẹ bằng giới hạn tần suất đăng ký theo IP ở AC-10.
- Hạn chế đã biết: access token bị đánh cắp dùng được tối đa 15 phút, và token cấp trước khi đổi mật khẩu cũng còn hiệu lực tối đa 15 phút (không đọc DB mỗi request); thao tác nhạy cảm kiểm tra lại DB.

**Configuration required**:
- `JWT_ACCESS_SECRET` (bí mật, từ 32 ký tự, bắt buộc), `JWT_ISSUER`, `JWT_AUDIENCE`, `ACCESS_TTL_SECONDS` (900)
- `REFRESH_TTL_DAYS` (30), `REFRESH_GRACE_SECONDS` (10), `MAX_SESSIONS_PER_USER` (10), `REFRESH_COOKIE_NAME` (`rt`), `COOKIE_SECURE` (`false` trên localhost)
- `ALLOWED_ORIGINS`, `APP_BASE_URL` (đều bắt buộc), `PASSWORD_RESET_TTL_MINUTES` (30), `TRUST_PROXY_HOPS` (0)
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD` (bí mật), `MAIL_FROM` (đều bắt buộc; thiếu thì API không khởi động, xem 0006)
- Bỏ `JWT_SECRET`, `JWT_EXPIRES_IN` cũ và `CLIENT_IP_HEADER`. Bảng đầy đủ nằm ở 0006.

**Critical test scenarios**:
- Happy path: đăng ký, đăng nhập, gọi `/me`, refresh, đăng xuất, verifies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-7**
- Failure case: dùng lại refresh token cũ ngoài ân hạn thì phiên bị hủy và token mới cũng chết, verifies **AC-5**
- Failure case: hai refresh đồng thời với cùng một cookie đều thành công (ân hạn) và không làm hỏng phiên, chạy trên Postgres thật, verifies **AC-4**
- Failure case: phiên đã quá `expires_at` bị từ chối dù dòng còn trong bảng, verifies **AC-5**
- Failure case: email không tồn tại và mật khẩu sai trả cùng một phản hồi, verifies **AC-2**
- Failure case: liên kết đặt lại mật khẩu dùng lần hai bị từ chối, và mọi phiên bị hủy, verifies **AC-8**
- Auth/permission: đăng ký với `accountType: 'admin'` hoặc kèm `roles` bị từ chối, verifies **AC-1**
- Failure case: đăng ký `landlord` với số điện thoại đã có (kể cả của tài khoản đã xóa mềm) bị 409 `PHONE_TAKEN`; thiếu `phone` hoặc số sai định dạng bị 400; `tenant` không có `phone` đăng ký được, verifies **AC-13**
- Failure case: đăng ký `landlord` với `+84 912.345.678` lưu thành `0912345678`; đăng ký lần hai với `0912345678` bị 409 `PHONE_TAKEN`; ghi thẳng một `landlord` không có `phone` vào DB bị `CHECK` chặn, verifies **AC-13**
- Auth/permission: tài khoản bị khóa không đăng nhập hay refresh được, verifies **AC-2**, **AC-6**
- Auth/permission: `Origin` lạ bị chặn ở refresh và logout, verifies **AC-11**
- Failure case: vượt giới hạn đăng nhập trả 429 kèm `Retry-After`, verifies **AC-10**

## Build plan

Thứ tự theo Tracer Bullet: dựng một đường mỏng chạy trọn từ đăng ký đến refresh, rồi mới thêm quên mật khẩu và giới hạn tần suất. Yêu cầu đã có từ trước: cấu hình có kiểu, `createApp`, `TransactionRunner` và kết nối DB (slice 0 của spec 0006), mã lỗi (0004). Thứ tự làm với 0003: nhiệm vụ 1 đến 4 và 6 của spec này đã có, chạy trên cột `roles` tạm; rồi 0003 nhiệm vụ 1 và 2 (loại tài khoản, danh mục quyền); rồi nhiệm vụ 5 của spec này (đăng ký có `accountType` và `phone`); rồi các nhiệm vụ còn lại của 0003.

1. Cấu hình có kiểu: lớp `Env` và `AppConfigService` cho các biến JWT, refresh, cookie, mail; bỏ `JWT_SECRET` cũ, satisfies **AC-3**, **AC-11**
2. Dữ liệu: model Prisma và migration cho `users` (`password_hash`, `status`), `auth_sessions`, `password_resets` cùng khóa ngoại, chỉ mục và ràng buộc duy nhất; repository tương ứng, satisfies **AC-2**, **AC-4**, **AC-5**, **AC-8**
3. `PasswordHasher` (argon2id, băm giả cân bằng thời gian) và kiểm tra mật khẩu 8 đến 128 ký tự, satisfies **AC-2**, **AC-12**
4. `TokenService`: ký và xác minh access token với payload có kiểu `AccessTokenPayload`, sinh và băm refresh token, satisfies **AC-3**, **AC-4**, **AC-12**
5. Register và login, cookie helper, `OriginGuard`, DTO đăng ký có `accountType` và `phone` (không còn `roles`), chuẩn hóa, kiểm định dạng và kiểm trùng số điện thoại (email trước, số sau), satisfies **AC-1**, **AC-2**, **AC-11**, **AC-13**
6. Refresh có xoay vòng bằng `UPDATE` có điều kiện, ân hạn, phát hiện dùng lại và đọc lại quyền của loại từ DB; logout và logout-all; giới hạn số phiên; dọn phiên hết hạn lúc tạo phiên mới, satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**
7. `MailService` (Nodemailer, Gmail SMTP, nội dung tiếng Việt), forgot, reset, change password, satisfies **AC-8**, **AC-9**
8. Giới hạn tần suất cho 4 nhóm endpoint dùng `@nestjs/throttler` với bộ nhớ trong (xem 0006), satisfies **AC-10**
9. Xóa đường cũ (một access token 1 ngày, `roles` trong DTO đăng ký; cột `users.roles` do spec 0003 nhiệm vụ 2 bỏ), thêm test đơn vị và e2e trên Postgres thật qua Testcontainers, satisfies **AC-1** đến **AC-13**

## Rationale (ngắn)

Refresh token là chuỗi ngẫu nhiên chứ không phải JWT vì cần thu hồi được và không cần mang thông tin; lưu bản băm để lộ DB không lộ token, và vì token có 256 bit ngẫu nhiên nên SHA-256 là đủ, không cần bcrypt. Xoay vòng cùng phát hiện dùng lại làm cho token bị đánh cắp tự lộ ra ngay khi người thật hoặc kẻ trộm dùng lần kế tiếp; ân hạn 10 giây tránh báo động giả khi hai tab refresh cùng lúc. Một phiên là một dòng xoay tại chỗ bằng một câu `UPDATE` có điều kiện (so sánh rồi đổi trong một bước, không đọc rồi ghi) để hai refresh đồng thời không đạp lên nhau và việc hủy phiên là một cập nhật. Cookie `SameSite=Strict` cùng đường dẫn `/api/v1/auth` dùng được vì trên localhost các cổng khác nhau vẫn là cùng site; `Origin` được kiểm thêm làm lớp chống CSRF thứ hai. Quyền nằm trong access token theo yêu cầu của bạn; phần thiệt hại là độ trễ tối đa 15 phút khi đổi quyền, được bù ở AC-6 và `@FreshAuth()`. Hết hạn kiểm khi đọc thay vì dựa vào chỉ mục TTL vì Postgres không có TTL. Phương án thay thế đã cân nhắc: refresh token dạng JWT có `jti` (nặng hơn mà không có lợi ích), lưu refresh ở localStorage (dễ bị XSS đọc), dùng lịch chạy nền để dọn bảng (thêm một thành phần chỉ để dọn vài dòng ở quy mô này).

## Consequences

**Positive**:
- Token bị đánh cắp bị phát hiện và hủy; mật khẩu và token không lộ khi lộ DB.
- Khóa tài khoản và đổi quyền có đường hiệu lực rõ ràng.
- Sửa lỗi Admin tự đăng ký và khoảng trống trạng thái khóa.

**Negative / tradeoffs**:
- Quyền và trạng thái khóa trong access token có thể cũ tối đa 15 phút với thao tác thường.
- Mỗi lần refresh đọc DB và ghi một lần (xoay token); mỗi refresh tốn thêm vài mili giây.
- Cookie phụ thuộc việc FE và API cùng dùng host `localhost`; trộn `127.0.0.1` thì refresh im lặng hỏng.
- argon2 là thư viện gốc: cần kiểm chứng chạy được trong image `node:24-slim` trên cả amd64 và arm64, nếu không đổi sang `bcrypt` cost 12.
- Số điện thoại chưa xác thực bằng mã nên quy tắc một số một lần dùng thử lách được bằng đổi SIM, và có thể bị lợi dụng để chặn người khác đăng ký tài khoản đăng bài.
- Bảng `auth_sessions` và `password_resets` chỉ được dọn khi có người tạo phiên hoặc token mới; người không quay lại để lại vài dòng hết hạn (không ảnh hưởng đúng sai, chỉ tốn chỗ).

**Neutral**:
- FE cần giữ access token trong bộ nhớ và gọi `/auth/refresh` khi gặp 401 `TOKEN_EXPIRED`.
- FE cần trang `/reset-password`.

## Follow-up

- [ ] Kiểm chứng argon2 (`@node-rs/argon2`) chạy trong `node:24-slim` trên amd64 và arm64 và đo thời gian băm; nếu không đạt thì quay về `bcrypt` cost 12 (gói đã gỡ khỏi dự án, cài lại khi cần).
- [ ] Kiểm chứng cookie `Path=/api/v1/auth` với `SameSite=Strict` đi đúng giữa hai cổng localhost trên Chrome, Firefox, Safari (giả định 4 của spec 0006).
- [ ] Xác minh email khi đăng ký chưa có trong MVP (spec chức năng để OTP ở giai đoạn sau); cân nhắc lại nếu có người đăng ký bằng email của người khác.
- [ ] Số điện thoại chưa xác thực bằng mã (bản demo), nên quy tắc một số một lần dùng thử lách được bằng đổi SIM và có thể bị lợi dụng để chặn người khác. Nếu thu tiền thật hoặc bị lạm dụng, thêm xác thực qua tin nhắn và cho admin một cách gỡ số.
