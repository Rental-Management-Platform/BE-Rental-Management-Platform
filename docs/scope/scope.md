# Scope: Rental Management Platform (backend)

API backend NestJS và PostgreSQL cho nền tảng quản lý cho thuê. Đã làm xong xử lý lỗi tập trung, báo lỗi nhập liệu, token đăng nhập, phân quyền theo loại tài khoản, quên và đổi mật khẩu (hàng 1 đến 6). Còn lại là giới hạn tần suất (hàng 7) và phần nghiệp vụ của MVP: nhà trọ và tin đăng, dùng thử và hạn mức, mua gói thanh toán thử, theo dõi chủ trọ, lưu phòng (hàng 8 đến 12), cùng một việc dọn danh mục quyền (hàng 13). Phạm vi MVP được chốt lại ngày 2026-10-11: bỏ duyệt tin, bỏ VNPay, hoãn các chức năng phụ (xem mục Deferred). Các phần khác sẽ được thêm khi bạn chạy lại `/scope`.

**Mô hình kinh doanh:** mọi tài khoản đăng ký miễn phí và chọn một loại lúc đăng ký: chủ trọ (người đăng bài) hoặc người tìm trọ (gồm sinh viên). Người tìm trọ dùng miễn phí mãi. Chủ trọ đăng tin và tin hiện ngay, không có bước duyệt; admin ẩn tin vi phạm sau khi đăng, khóa và mở khóa tài khoản. Chủ trọ dùng thử khoảng một tháng với hạn mức vài tin đang hiện (mặc định 2); muốn đăng thêm, hoặc hết kỳ mà vẫn muốn tin hiện, thì mua gói theo tháng, nên hạn mức tin chính là chỗ thu tiền. Thanh toán chỉ là thanh toán thử, không có tiền thật. Số người theo dõi và lượt xem tích lũy trên tài khoản chủ trọ để họ ở lại mua gói, thay vì bỏ tài khoản lập cái mới lấy miễn phí. Bản này là MVP để demo, ưu tiên gọn; phạm vi chi tiết và lý do nằm ở `docs/specs/0001-backend-foundation/index.md`, mục Phạm vi MVP.

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
| 5 | Phân quyền theo loại tài khoản | Release 5 | done |
| 6 | Quên mật khẩu và đổi mật khẩu | Release 6 | done |
| 7 | Giới hạn tần suất | Release 7 | done |
| 8 | Nhà trọ, đăng tin và xem tin | Release 8 | in-progress |
| 9 | Dùng thử miễn phí và hạn mức tin | Release 9 | planned |
| 10 | Mua gói (thanh toán thử) và gia hạn theo tháng | Release 10 | planned |
| 11 | Theo dõi chủ trọ và số người biết đến | Release 11 | planned |
| 12 | Lưu phòng yêu thích | Release 12 | planned |
| 13 | Dọn danh mục quyền theo MVP | Release 13 | done |

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

### 5. Phân quyền theo loại tài khoản · done
Mỗi tài khoản có đúng một loại (`admin`, `landlord`, `tenant`), chọn một lần lúc đăng ký (trừ `admin` do seed tạo) và không đổi sau. Loại và quyền của loại lưu trong DB; admin chỉnh quyền của `landlord` và `tenant` bằng API, không cấp được quyền chỉ admin. Access token mang `type` và `perms`. Chủ trọ khai số điện thoại lúc đăng ký. Admin khóa, mở khóa tài khoản và thu hồi phiên.
**Done when:** mọi route khai báo rõ là công khai, chỉ cần đăng nhập hay cần quyền nào, route quên khai báo bị chặn; mỗi tài khoản tự đăng ký có đúng một loại trong hai loại tự chọn được, còn admin không bao giờ tự đăng ký được; admin chỉnh quyền của `landlord` và `tenant` mà không cấp được quyền chỉ admin; token mang `perms` và đổi quyền có hiệu lực ở lần refresh kế tiếp.
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

### 7. Giới hạn tần suất · done
Đăng nhập, đăng ký, quên mật khẩu và refresh bị giới hạn theo IP và theo email; vượt thì báo lỗi 429 cùng dạng với các lỗi khác.
**Done when:** vượt giới hạn trả 429 `RATE_LIMITED` kèm header `Retry-After`; dưới giới hạn mọi endpoint chạy như cũ.
- [x] Design it (spec): `/architect authentication tokens`
- [x] Build it: `/develop rate limiting`
Đã chạy thật trên DB thử: 24 kiểm tra giới hạn qua, Newman 31 request không lỗi, 173 test qua. Con số giới hạn do bạn chốt ngày 2026-10-12. Hai điểm ngoài danh sách AC-10 cần `/architect` ghi vào spec 0002 cho đủ: giới hạn cho `reset-password` (20 lần mỗi giờ theo IP) và cho `change-password` (10 lần mỗi 15 phút theo người dùng).
Spec [0002](../specs/0001-backend-foundation/0002-authentication-tokens.md) (AC-10) · code in `src/common/rate-limit/`, `src/auth/auth.module.ts`, `src/auth/auth.controller.ts` · tài liệu in `docs/api/`

## Release 8: nhà trọ và đăng tin

### 8. Nhà trọ, đăng tin và xem tin · in-progress · needs a decision
Chủ trọ tạo nhà trọ (địa chỉ, phường, phí, tiện ích) rồi đăng tin phòng thuộc nhà trọ đó; tin hiện ngay khi đăng, không có nháp và không có duyệt. Chủ trọ tự ẩn và hiện lại tin của mình; admin ẩn hoặc gỡ ẩn tin của người khác kèm lý do (quyền `listing:moderate`). Người tìm trọ xem danh sách tin công khai có lọc đơn giản (từ khóa, phường, khoảng giá, sắp xếp) và xem chi tiết tin. Ảnh tải lên ổ đĩa, tối đa 5 ảnh mỗi tin. Đây là lát cắt để hạn mức, gói và lượt theo dõi có chỗ bám vào. Đã chốt ngày 2026-10-11 (spec 0001, mục Phạm vi MVP); còn lại cho `/architect`: cột và API chi tiết, mã ngắn của tin, nguồn dữ liệu 168 phường, quy tắc đếm lượt xem.
**Done when:** chủ trọ tạo nhà trọ và đăng tin, tin hiện ngay trong danh sách công khai; chủ trọ ẩn và hiện lại tin của mình; admin ẩn tin của chủ trọ thì tin biến khỏi danh sách công khai và chủ trọ không tự hiện lại được; chỉ tin đang hiện của tài khoản đang hoạt động mới hiển thị công khai; người tìm trọ lọc được danh sách và mở được chi tiết, mỗi lần mở (trừ chính chủ tin) cộng một lượt xem; tải lên được tối đa 5 ảnh mỗi tin.
- [ ] Design it (spec): `/architect property listings`
- [ ] Build it: `/develop property listings`
   - [x] Mốc 1: nền dữ liệu (7 bảng, 11 mã lỗi, hàm `toSearchKey`, `toSlug`, nhận loại ảnh) và `GET /wards`, `GET /amenities` theo địa chỉ hai cấp sau sáp nhập, kèm seed 168 phường (AC-1)
   - [ ] Mốc 2: nhà trọ, phí và tiện ích, xóa mềm có chặn khi còn tin (AC-3, AC-4)
   - [ ] Mốc 3: đăng tin, danh sách và chi tiết công khai, lượt xem, tin của chủ trọ, sửa, ẩn và hiện (AC-5, AC-6, AC-7, AC-10 đến AC-14)
   - [ ] Mốc 4: ảnh tin, tối đa 5 ảnh mỗi tin (AC-8)
   - [ ] Mốc 5: kiểm duyệt của admin, danh mục admin, giới hạn tần suất, tài liệu và kiểm cuối (AC-2, AC-9, AC-15)
Spec [0002](../specs/0002-property-listings/index.md) (đang `In Progress`, chưa được `/architect` Accept; lượt build mốc 1 bắt đầu theo lệnh của bạn ngày 2026-10-14) · code in `src/catalog/`, `src/common/text/`, `src/common/files/`, `src/database/seed-data.ts`, `src/database/seed-catalog.ts`, `prisma/seed-data/`, `prisma/migrations/20261014090000_property_listings/` · tài liệu in `docs/api/`

## Release 9: dùng thử và hạn mức

### 9. Dùng thử miễn phí và hạn mức tin · planned · needs a decision
Chủ trọ dùng thử miễn phí `trial_days` ngày (mặc định 30) với tối đa `trial_listing_limit` tin đang hiện (mặc định 2); cả hai chỉnh bằng bảng `settings`. Một số điện thoại chỉ nhận dùng thử một lần (đã có ở đăng ký, không xác thực bằng mã gửi về). Chỉ tin đang hiện tính vào hạn mức, ẩn một tin là trả lại một chỗ. Hết kỳ dùng thử mà không có gói đang hiệu lực thì mọi tin của chủ trọ tự biến khỏi công khai (suy ra lúc đọc, không cần cron), chủ trọ vẫn xem và sửa được tin của mình; có gói thì tin hiện lại. Người tìm trọ không bị giới hạn. Đã chốt ngày 2026-10-11; còn lại cho `/architect`: cột lưu hạn dùng thử, mã lỗi và thông báo khi chạm hạn mức, cách tính hạn mức hiện hành khi có gói.
**Done when:** tài khoản chủ trọ mới có một kỳ dùng thử và một hạn mức tin; đăng hoặc hiện thêm tin khi đã đủ hạn mức bị chặn kèm gợi ý mua gói; ẩn một tin thì đăng thêm được; hết kỳ dùng thử mà chưa có gói thì tin của chủ trọ biến khỏi danh sách công khai; một số điện thoại không nhận dùng thử lần hai; số ngày và số tin dùng thử đổi được bằng `settings`, không viết cứng trong code.
- [ ] Design it (spec): `/architect free trial and listing quota`

## Release 10: mua gói

### 10. Mua gói (thanh toán thử) và gia hạn theo tháng · planned · needs a decision
Chủ trọ xem bảng giá gói (công khai), chọn gói, tạo đơn rồi bấm thanh toán thử; đơn thành `paid` và gói có hiệu lực 30 ngày ngay, hạn mức tin tăng theo gói; gia hạn cộng nối tiếp 30 ngày. Admin quản lý gói (tên, giá, số tin tối đa, bật hay tắt). Không có cổng thanh toán, không có tiền thật, không biến môi trường mới (VNPay đã bỏ ngày 2026-10-11). Đã chốt; còn lại cho `/architect`: cột và mã lỗi, ai được hủy đơn, xử lý khi hạn mức của gói mới thấp hơn số tin đang hiện.
**Done when:** xem được bảng giá công khai; tạo đơn mua gói và thấy trạng thái đơn; bấm thanh toán thử thì đơn thành `paid` và gói có hiệu lực ngay, bấm hai lần không tạo hai gói; gia hạn cộng nối tiếp 30 ngày; gói hết hạn thì tài khoản quay về trạng thái cần mua; xem được lịch sử đơn của mình; admin tạo, sửa và tắt gói.
- [ ] Design it (spec): `/architect membership packages and payment`

## Release 11: theo dõi chủ trọ

### 11. Theo dõi chủ trọ và số người biết đến · planned · needs a decision
Người tìm trọ theo dõi (follow) một chủ trọ. Chủ trọ và người xem thấy số người theo dõi cùng tổng lượt xem tin của chủ trọ trên hồ sơ công khai. Số này tích lũy trên tài khoản nên bỏ tài khoản để lập cái mới sẽ mất hết, giữ chủ trọ ở lại và mua gói. Chỉ giữ một loại lượt xem: lượt xem tin đã đếm ở hàng 8 (cột `view_count` của tin), cộng dồn theo chủ trọ, không làm thêm bộ đếm lượt xem hồ sơ riêng. Giữ trong MVP (chốt 2026-10-11).
**Done when:** người tìm trọ đã đăng nhập theo dõi và bỏ theo dõi một chủ trọ, mỗi người chỉ tính một lần, không tự theo dõi chính mình; hồ sơ chủ trọ hiện số người theo dõi và tổng lượt xem tin; số cập nhật đúng khi có người bỏ theo dõi hoặc tài khoản bị khóa.
- [ ] Design it (spec): `/architect landlord follow and reach`

## Release 12: lưu phòng

### 12. Lưu phòng yêu thích · planned · needs a decision
Người tìm trọ lưu một tin vào danh sách yêu thích, bỏ lưu và xem danh sách đã lưu. Giữ trong MVP theo lựa chọn của bạn ngày 2026-10-11. Cần hàng 8 có trước.
**Done when:** người tìm trọ đã đăng nhập lưu và bỏ lưu một tin, mỗi tin chỉ lưu một lần; xem được danh sách tin đã lưu; tin không còn hiển thị công khai (bị ẩn, chủ trọ bị khóa hoặc hết kỳ dùng thử) không hiện trong danh sách đã lưu.
- [ ] Design it (spec): `/architect favorites`

## Release 13: dọn danh mục quyền

### 13. Dọn danh mục quyền theo MVP · done
Thu danh mục quyền trong code về đúng bảng ở spec 0003 (bỏ các module đã hoãn, đổi `product` thành `plan`, bỏ `order:refund` và `order:gift`), thêm migration gỡ khóa thừa khỏi `account_types.permissions`, sửa test và `verify.md`. Không đổi hành vi API đang chạy ngoài việc `GET /permissions` ngắn lại. Nên làm trước hàng 8 để quyền thừa không lọt vào tính năng mới.
**Done when:** `GET /permissions` chỉ liệt kê module của MVP; quyền mặc định của `landlord` và `tenant` khớp bảng ở 0003; mọi test qua; không route hay test nào còn dùng khóa đã bỏ.
- [x] Design it (spec): đã chốt trong spec 0003, cập nhật 2026-10-11
- [x] Build it: `/develop permission catalog cleanup`
Đã chạy thật trên hai DB thử (một DB có khóa thừa thêm tay, một DB dựng từ đầu): landlord 14 quyền, tenant 7, `migrate diff` không lệch, Newman 27 request không lỗi, 136 test qua. DB dev của bạn cần `npm run migration:deploy` một lần.
Spec [0003](../specs/0001-backend-foundation/0003-authorization-rbac.md) · code in `src/common/auth/permission-catalog.ts`, `prisma/migrations/20261011090000_mvp_permission_cleanup/` · tài liệu in `docs/api/`

## Deferred
Ngoài phạm vi bản này, giữ lại để kế hoạch trung thực.
- **Dịch lỗi PostgreSQL**: trùng giá trị khi đăng ký đồng thời, khóa ngoại, id sai, mất kết nối thành lỗi dễ hiểu · needs a decision
- **Body lỗi đầy đủ theo RFC 9457**: `application/problem+json`, `title`, `timestamp`, `path` · needs a decision
- **Luật ESLint** chặn import lỗi gốc của Nest ngoài thư mục errors
- **Decorator Swagger cho lỗi** (`@ApiProblemResponses`)
- **Kiểm hai điều của spec 0002** trước khi đóng gói: băm mật khẩu chạy được trong image Docker (amd64 và arm64), và cookie `SameSite=Strict` đi đúng giữa hai cổng localhost trên Chrome, Firefox, Safari. Spec còn ghi phương án lùi về `bcrypt`, nhưng gói này đã được gỡ khỏi dự án.
- **Giao dịch nhiều bước và chạy migration trong container**: làm cùng tính năng cần chúng (hàng 5 khi gán vai trò lúc đăng ký, và spec 0006).
- **Duyệt tin trước khi hiển thị**: đã bỏ hẳn ngày 2026-10-11, thay bằng admin ẩn tin sau khi đăng (hàng 8). Không làm lại trừ khi bạn đổi ý.
- **Hoãn khỏi MVP (chốt 2026-10-11)**: xác thực chủ trọ và ảnh giấy tờ, báo cáo tin xấu, liên hệ chủ trọ có giới hạn mỗi ngày, đẩy tin và tin nổi bật, kiểm tra tại chỗ, quảng cáo, thu chi và dashboard doanh thu, thống kê cho chủ trọ, tìm quanh địa điểm mốc, lịch sử giá tin, cổng thanh toán thật (VNPay), hoàn tiền và tặng gói, đổi loại tài khoản. Thêm lại bằng `/scope` khi tới lượt · needs a decision

## Legend

**The decision box.** Mỗi tính năng có đúng một ô quyết định, nhãn kết thúc bằng `(spec)`. Mọi ô khác là ô thực thi.

- **Next step** là ô đầu tiên chưa tick, luôn là một lệnh.
- **needs a decision** nghĩa là chạy `/architect` trước; không thì đi thẳng `/develop`. Thẻ này mất đi khi spec được ghi.
- **Status** đi theo `planned`, `in-progress`, `done`, cùng `existing` (có trước quy trình) và `dropped` (bỏ khỏi scope hoặc đã được thay, giữ lịch sử).
- **Workflow** là mức mặc định của dự án. Prototype nghĩa là sau `/develop` không còn bước nào khác, bạn tự kiểm.
