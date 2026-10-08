# Scope: Rental Management Platform (backend)

API backend NestJS và PostgreSQL cho nền tảng quản lý cho thuê. Đã làm xong xử lý lỗi tập trung, báo lỗi nhập liệu và nền token đăng nhập. Phân quyền, quên và đổi mật khẩu, giới hạn tần suất, cùng mô hình miễn phí có thời hạn cho người đăng bài (hàng 8 đến 11) là các hàng `planned` bên dưới. Các phần khác sẽ được thêm khi bạn chạy lại `/scope`.

**Mô hình kinh doanh:** mọi tài khoản đăng ký miễn phí và chọn một loại lúc đăng ký: người đăng bài (chủ trọ) hoặc người tìm trọ (người thuê). Người tìm trọ dùng miễn phí mãi. Người đăng bài được dùng thử khoảng một tháng với hạn mức khoảng 1 đến 2 tin; muốn tiếp tục phải mua gói có sẵn và gia hạn theo tháng. Số người theo dõi và lượt xem tích lũy trên tài khoản chủ trọ để họ được biết đến và ở lại mua gói, thay vì bỏ tài khoản lập cái mới lấy miễn phí.

**Build approach:** Skateboard (làm bản mỏng nhất dùng được trước, rồi mới mở rộng).
**Workflow:** Prototype (chỉ `/develop`; sau đó bạn tự kiểm bằng tay và xem dữ liệu). Đây là mức mặc định của dự án. Một tính năng có thể gắn thẻ riêng, ví dụ `· GA`, khi cần kiểm kỹ hơn.
**Giới hạn khi build:** `/develop` và mọi AI chỉ làm đúng tính năng hoặc bước bạn nêu trong lệnh. Muốn chạm sang module hay tính năng khác ngoài yêu cầu (kể cả khi spec hoặc kế hoạch nối chúng với nhau) thì bắt buộc hỏi bạn trước và chỉ làm khi bạn đồng ý. Chưa được đồng ý thì không viết code cho phần đó, chỉ ghi thành một hàng `planned` trong scope. Nếu một bước bạn yêu cầu cần thứ của bước sau, dùng cách tạm nhỏ nhất đã có sẵn trong code và nói rõ trong báo cáo.

_Đây là các khuyến nghị để việc làm gọn gàng, không phải yêu cầu bắt buộc. Bước nào không hợp thì bỏ qua. Bạn quyết định khi nào một tính năng là `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| A | Cấu hình và database | Foundation | existing |
| B | Người dùng | Foundation | existing |
| C | Đăng nhập một token (bản cũ) | Foundation | dropped |
| 1 | Bộ xử lý lỗi chung | Release 1 | done |
| 2 | Lỗi nhập liệu cùng một dạng | Release 2 | done |
| 3 | Lỗi token và đăng nhập cùng một dạng | Release 3 | done |
| 4 | Nền token đăng nhập | Release 4 | done |
| 5 | Phân quyền theo vai trò và quyền | Release 5 | done |
| 6 | Quên mật khẩu và đổi mật khẩu | Release 6 | done |
| 7 | Giới hạn tần suất | Release 7 | planned |
| 8 | Nhà trọ, đăng tin và xem tin | Release 8 | planned |
| 9 | Dùng thử miễn phí và hạn mức tin | Release 9 | planned |
| 10 | Mua gói và gia hạn theo tháng | Release 10 | planned |
| 11 | Theo dõi chủ trọ và số người biết đến | Release 11 | planned |

## Foundations (đã có)

### A. Cấu hình và database · existing
Biến môi trường được kiểm khi khởi động, kết nối PostgreSQL, hai migration (bảng `users`, bảng `auth_sessions`). Việc cần làm một lần: database dev `rental_management` do `postgres` sở hữu, nên chạy bằng tài khoản admin `ALTER DATABASE rental_management OWNER TO rental_app;` rồi `npm run migration:deploy`. code in `src/config/`, `src/database/`, `prisma/`

### B. Người dùng · existing
Tạo và tìm người dùng trên bảng `users`. code in `src/users/`

### C. Đăng nhập một token (bản cũ) · dropped
Đã được thay bằng hàng 4. Code cũ (một access token sống một ngày, đăng ký nhận `roles` từ client) không còn.

## Release 1: lỗi từ API

### 1. Bộ xử lý lỗi chung · done
Mọi chỗ trong code chỉ cần `throw new AppException(ErrorCode.X)` (hoặc `next(err)` trong middleware Express). Một bộ lọc toàn cục đổi mọi lỗi, kể cả lỗi lạ và route không tồn tại, thành cùng một body gọn `{ status, code, message, errors?, requestId }`. Không dịch lỗi PostgreSQL, không có luật ESLint; lỗi gốc của Nest vẫn được nhận và đổi sang cùng dạng. Đã làm: bảng mã lỗi, `AppException`, `requestId`, bộ lọc, nối vào `AppModule` và `main.ts` (qua `app.factory.ts`).
**Done when:** ném `AppException` ở controller hoặc service trả đúng `status`, `code`, `message`, và `requestId` trùng header `X-Request-Id`; lỗi không lường trước trả 500 `INTERNAL_ERROR` không lộ stack; route không tồn tại và lỗi `next(err)` từ middleware ra cùng dạng.
- [x] Design it (spec): `/architect central error handling`
- [x] Build it: `/develop central error handling`
Spec [0004](../specs/0001-backend-foundation/0004-error-handling-and-validation.md) · code in `src/common/errors/`

## Release 2: lỗi nhập liệu

### 2. Lỗi nhập liệu cùng một dạng · done
`ValidationPipe` toàn cục đổi lỗi của class-validator thành `AppException(VALIDATION_FAILED)` kèm danh sách trường sai, và từ chối trường lạ (việc này chặn gửi `roles` lúc đăng ký).
**Done when:** body thiếu trường, sai kiểu hoặc có trường lạ trả 400 `VALIDATION_FAILED` với `errors` liệt kê từng trường, cùng dạng với mọi lỗi khác.
- [x] Build it: `/develop validation errors`
Spec [0004](../specs/0001-backend-foundation/0004-error-handling-and-validation.md) · code in `src/common/errors/create-validation-pipe.ts`, `src/common/decorators/trim.decorator.ts`

## Release 3: lỗi token và đăng nhập

### 3. Lỗi token và đăng nhập cùng một dạng · done
Guard hiện có đổi lý do từ chối của Passport thành `TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`. Đăng ký và đăng nhập dùng `AppException` thay cho lỗi gốc của Nest (`EMAIL_TAKEN`, `INVALID_CREDENTIALS`).
**Done when:** route cần đăng nhập không kèm token trả 401 `TOKEN_MISSING`, token rác trả 401 `TOKEN_INVALID`, token hết hạn trả 401 `TOKEN_EXPIRED`; sai email và sai mật khẩu cùng trả 401 `INVALID_CREDENTIALS`; đăng ký email đã có trả 409 `EMAIL_TAKEN`. Nền token (hàng 4) giữ đúng ánh xạ này.
- [x] Build it: `/develop token and login errors`
Spec [0004](../specs/0001-backend-foundation/0004-error-handling-and-validation.md) · code in `src/common/guards/jwt-auth.guard.ts`, `src/auth/auth.service.ts`

## Release 4: nền token đăng nhập

### 4. Nền token đăng nhập · done
Đăng ký, đăng nhập, access token ngắn hạn và refresh token xoay vòng nằm trong cookie, lưu theo từng phiên đăng nhập. Đăng ký không còn nhận `roles` từ client (luôn là `tenant`). Access token tạm thời mang `roles` lấy từ cột `users.roles` có sẵn, chưa phải `perms`; hàng 5 sẽ đổi. Đã kiểm bằng một script chạy thật trên database thử, không có test tự động.
**Done when:** đăng ký trả 201 và đặt cookie refresh; đăng nhập đúng trả 200 `{ accessToken, expiresIn }`; refresh đổi cookie và token cũ chỉ dùng lại được trong khoảng ân hạn; dùng lại token cũ ngoài ân hạn hủy cả phiên (401 `SESSION_REVOKED`); logout và logout all hủy phiên; `Origin` lạ bị 403 ở refresh và logout; mật khẩu băm bằng argon2id và không lộ trong response hay log.
- [x] Design it (spec): `/architect authentication tokens`
- [x] Build it: `/develop authentication tokens`
   - [x] Cấu hình token, bảng phiên đăng nhập, băm mật khẩu và ký access token (AC-3, AC-12)
   - [x] Đăng ký, đăng nhập, cookie refresh và kiểm `Origin` (AC-1, AC-2, AC-11)
   - [x] Refresh xoay vòng bằng một câu UPDATE có điều kiện, ân hạn, phát hiện dùng lại, logout (AC-4, AC-5, AC-7)
Spec [0002](../specs/0001-backend-foundation/0002-authentication-tokens.md) · code in `src/auth/`, `src/config/`, `prisma/`

## Release 5: phân quyền

### 5. Phân quyền theo vai trò và quyền · done
Vai trò là dữ liệu trong DB, mỗi vai trò chọn quyền theo module và hành động. Khi xong, access token mang `perms` thay cho `roles`, đăng ký miễn phí và chọn một trong hai loại tài khoản (người đăng bài hoặc người tìm trọ, chọn một lần lúc đăng ký, không đổi sau), cột `users.roles` và `RolesGuard` cũ được thay. Các file `.guide.md` còn lại trong `src/` là hướng dẫn cho phần này, cần viết lại theo cách làm hiện tại trước khi theo.
**Done when:** mọi route khai báo rõ là công khai, chỉ cần đăng nhập hay cần quyền nào, route quên khai báo bị chặn; mỗi tài khoản tự đăng ký có đúng một loại trong hai loại tự chọn được, còn admin không bao giờ tự đăng ký được; admin tạo vai trò và gán cho tài khoản mà không nâng quyền vượt mức của mình; token mang `perms` và đổi quyền có hiệu lực ở lần refresh kế tiếp; hệ thống không bao giờ mất admin cuối cùng.
- [x] Design it (spec): `/architect authorization`
- [x] Build it: `/develop authorization`
   - [x] Danh mục quyền có kiểu, kèm các hành động chỉ admin giữ (AC-1, AC-11)
   - [x] Bảng loại tài khoản kèm ba dòng và quyền mặc định, cột `users.account_type` thay cột `roles` cũ, seed admin đầu tiên (AC-2, AC-3, AC-9)
   - [x] Guard toàn cục, decorator khai báo route, token mang `type` và `perms` (AC-4, AC-8, AC-10)
   - [x] API chỉnh quyền của loại, khóa và mở khóa tài khoản, kiểm tra chủ sở hữu (AC-5, AC-6, AC-7)
   - [x] Đăng ký chọn loại tài khoản và kiểm số điện thoại, cùng thông báo lỗi chuyển sang tiếng Việt (0002 AC-1, AC-13; 0004)
Đã chạy thật trên database thử: 70 kiểm tra qua. Cần bạn làm một lần trên DB dev: điền `.env`, `npx prisma migrate reset`, `npm run seed` (xem README).
Spec [0003](../specs/0001-backend-foundation/0003-authorization-rbac.md) · code in `src/account-types/`, `src/moderation/`, `src/common/auth/`, `src/auth/`, `src/database/seed.ts`, `prisma/migrations/20261008090000_account_types_phone/`

## Release 6: mật khẩu

### 6. Quên mật khẩu và đổi mật khẩu · done
Gửi email chứa liên kết dùng một lần để đặt lại mật khẩu, và đổi mật khẩu khi đang đăng nhập (hủy các phiên khác, giữ phiên hiện tại). Cần cấu hình gửi email.
**Done when:** quên mật khẩu luôn trả 202 cùng một nội dung dù email có tồn tại hay không; liên kết hết hạn sau 30 phút và chỉ dùng một lần, đặt lại xong hủy mọi phiên; đổi mật khẩu đòi mật khẩu hiện tại.
- [x] Design it (spec): `/architect authentication tokens`
- [x] Build it: `/develop forgot and change password`
   - [x] Gửi email qua Nodemailer (Gmail SMTP), bảng liên kết đặt lại, quên mật khẩu và đặt lại, mỗi liên kết dùng một lần và chỉ liên kết mới nhất dùng được (AC-8)
   - [x] Đổi mật khẩu, hủy các phiên khác và giữ phiên hiện tại (AC-9)
   - [x] Hai file tài liệu cập nhật liên tục: bộ request Postman và tài liệu API cho FE (yêu cầu thêm của bạn)
Đã chạy thật trên database thử, kèm máy chủ SMTP giả: khoảng 55 kiểm tra qua, và 31 request Postman chạy qua Newman không lỗi. Chưa thử gửi email thật qua Gmail: cần bạn điền `MAIL_USER`, `MAIL_PASSWORD` (App Password), `MAIL_FROM`, `APP_BASE_URL` trong `.env` (thiếu thì API không khởi động).
Spec [0002](../specs/0001-backend-foundation/0002-authentication-tokens.md) (AC-8, AC-9) · code in `src/auth/password.service.ts`, `src/auth/password-resets.repository.ts`, `src/mail/`, `prisma/migrations/20261009090000_password_resets/` · tài liệu in `docs/api/`

## Release 7: giới hạn tần suất

### 7. Giới hạn tần suất · planned
Đăng nhập, đăng ký, quên mật khẩu và refresh bị giới hạn theo IP và theo email; vượt thì báo lỗi 429 cùng dạng với các lỗi khác.
**Done when:** vượt giới hạn trả 429 `RATE_LIMITED` kèm header `Retry-After`; dưới giới hạn mọi endpoint chạy như cũ.
- [x] Design it (spec): `/architect authentication tokens`
- [ ] Build it: `/develop rate limiting`
Spec [0002](../specs/0001-backend-foundation/0002-authentication-tokens.md) (AC-10)

## Release 8: nhà trọ và đăng tin

### 8. Nhà trọ, đăng tin và xem tin · planned · needs a decision
Người đăng bài tạo nhà trọ và đăng tin phòng, admin duyệt trước khi hiển thị, người tìm trọ xem được chi tiết tin đã duyệt. Đây là lát cắt mỏng nhất để hạn mức, gói và lượt theo dõi có chỗ bám vào. Tìm kiếm, bộ lọc, lưu phòng và liên hệ chủ trọ là các hàng riêng, thêm sau bằng `/scope`.
**Done when:** người đăng bài lưu nháp rồi gửi duyệt một tin; admin duyệt hoặc từ chối kèm lý do; chỉ tin đã duyệt của tài khoản đang hoạt động mới hiển thị công khai; người tìm trọ mở được trang chi tiết tin và mỗi lần mở được đếm một lượt xem.
- [ ] Design it (spec): `/architect property listings`

## Release 9: dùng thử và hạn mức

### 9. Dùng thử miễn phí và hạn mức tin · planned · needs a decision
Người đăng bài dùng thử miễn phí khoảng một tháng, với khoảng 1 đến 2 tin hiển thị cùng lúc. Hết thời gian hoặc vượt hạn mức thì cần gói đang hiệu lực mới được đăng và hiển thị thêm. Một số điện thoại chỉ nhận dùng thử một lần, để không tạo tài khoản mới liên tục lấy miễn phí. Người tìm trọ không bị giới hạn. Tin đang hiển thị ra sao khi hết kỳ, và số điện thoại có cần xác thực bằng mã gửi về hay không, do spec chốt.
**Done when:** tài khoản đăng bài mới có một kỳ dùng thử và một hạn mức tin; đăng thêm khi vượt hạn mức hoặc hết kỳ bị chặn kèm gợi ý mua gói; một số điện thoại không nhận dùng thử lần hai; thời gian dùng thử và hạn mức đổi được bằng cấu hình, không viết cứng trong code.
- [ ] Design it (spec): `/architect free trial and listing quota`

## Release 10: mua gói

### 10. Mua gói và gia hạn theo tháng · planned · needs a decision
Có sẵn vài gói thành viên theo tháng; người đăng bài chọn gói và thanh toán, gói có hiệu lực 30 ngày và gia hạn nối tiếp theo tháng, hạn mức tin tăng theo gói. Admin quản lý bảng giá và xác nhận thanh toán. Cách thu tiền (tiền thật hay chỉ demo) do spec chốt.
**Done when:** xem được bảng giá công khai; tạo đơn mua gói và thấy trạng thái đơn; khi thanh toán được ghi nhận thì gói có hiệu lực ngay và hạn mức mới áp dụng; gia hạn cộng nối tiếp 30 ngày; gói hết hạn thì tài khoản quay về trạng thái cần mua; xem được lịch sử giao dịch.
- [ ] Design it (spec): `/architect membership packages and payment`

## Release 11: theo dõi chủ trọ

### 11. Theo dõi chủ trọ và số người biết đến · planned · needs a decision
Người tìm trọ theo dõi (follow) một chủ trọ. Chủ trọ và người xem thấy số người theo dõi cùng tổng lượt xem tin của chủ trọ trên hồ sơ công khai. Số này tích lũy trên tài khoản nên bỏ tài khoản để lập cái mới sẽ mất hết, giữ chủ trọ ở lại và mua gói. Chỉ giữ một loại lượt xem: lượt xem tin đã đếm ở hàng 8, cộng dồn theo chủ trọ, không làm thêm bộ đếm lượt xem hồ sơ riêng.
**Done when:** người tìm trọ đã đăng nhập theo dõi và bỏ theo dõi một chủ trọ, mỗi người chỉ tính một lần, không tự theo dõi chính mình; hồ sơ chủ trọ hiện số người theo dõi và tổng lượt xem tin; số cập nhật đúng khi có người bỏ theo dõi hoặc tài khoản bị khóa.
- [ ] Design it (spec): `/architect landlord follow and reach`

## Deferred
Ngoài phạm vi bản này, giữ lại để kế hoạch trung thực.
- **Dịch lỗi PostgreSQL**: trùng giá trị khi đăng ký đồng thời, khóa ngoại, id sai, mất kết nối thành lỗi dễ hiểu · needs a decision
- **Body lỗi đầy đủ theo RFC 9457**: `application/problem+json`, `title`, `timestamp`, `path` · needs a decision
- **Luật ESLint** chặn import lỗi gốc của Nest ngoài thư mục errors
- **Decorator Swagger cho lỗi** (`@ApiProblemResponses`)
- **Kiểm hai điều của spec 0002** trước khi đóng gói: băm mật khẩu chạy được trong image Docker (amd64 và arm64), và cookie `SameSite=Strict` đi đúng giữa hai cổng localhost trên Chrome, Firefox, Safari. Spec còn ghi phương án lùi về `bcrypt`, nhưng gói này đã được gỡ khỏi dự án.
- **Giao dịch nhiều bước và chạy migration trong container**: làm cùng tính năng cần chúng (hàng 5 khi gán vai trò lúc đăng ký, và spec 0006).
- **Tìm kiếm và bộ lọc tin, lưu phòng, liên hệ chủ trọ, tin nổi bật và đẩy tin, báo cáo tin, thống kê cho chủ trọ**: thêm bằng `/scope` khi tới lượt, sau hàng 8 · needs a decision

## Legend

**The decision box.** Mỗi tính năng có đúng một ô quyết định, nhãn kết thúc bằng `(spec)`. Mọi ô khác là ô thực thi.

- **Next step** là ô đầu tiên chưa tick, luôn là một lệnh.
- **needs a decision** nghĩa là chạy `/architect` trước; không thì đi thẳng `/develop`. Thẻ này mất đi khi spec được ghi.
- **Status** đi theo `planned`, `in-progress`, `done`, cùng `existing` (có trước quy trình) và `dropped` (bỏ khỏi scope hoặc đã được thay, giữ lịch sử).
- **Workflow** là mức mặc định của dự án. Prototype nghĩa là sau `/develop` không còn bước nào khác, bạn tự kiểm.
