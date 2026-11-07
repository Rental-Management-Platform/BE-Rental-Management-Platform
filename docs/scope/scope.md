# Scope: Rental Management Platform (backend)

API backend NestJS và PostgreSQL cho nền tảng quản lý cho thuê. Đã làm xong: xử lý lỗi tập trung, báo lỗi nhập liệu, token đăng nhập, phân quyền theo loại tài khoản, quên và đổi mật khẩu (hàng 1 đến 6), giới hạn tần suất (hàng 7), phần nghiệp vụ của MVP gồm nhà trọ và tin đăng, dùng thử và hạn mức, mua gói thanh toán thử, theo dõi chủ trọ, lưu phòng (hàng 8 đến 12), dọn danh mục quyền (hàng 13), các phần bổ sung sau đó gồm danh sách người dùng cho admin, hồ sơ cá nhân, tin trên hồ sơ chủ trọ, đơn và doanh thu cho admin, đăng tin kèm ảnh, giới hạn tọa độ nhà trọ, chat giữa người tìm trọ và chủ trọ (hàng 14 đến 20), cùng bộ dữ liệu demo cho FE (hàng 21). Còn lại là đánh giá trọ trên hồ sơ chủ trọ (hàng 22) và đóng gói Docker cùng phát hành (hàng 23). Phạm vi MVP được chốt lại ngày 2026-10-11: bỏ duyệt tin, bỏ VNPay, hoãn các chức năng phụ (xem mục Deferred). Các phần khác sẽ được thêm khi bạn chạy lại `/scope`.

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
| 8 | Nhà trọ, đăng tin và xem tin | Release 8 | done |
| 9 | Dùng thử miễn phí và hạn mức tin | Release 9 | done |
| 10 | Mua gói (thanh toán thử) và gia hạn theo tháng | Release 10 | done |
| 11 | Theo dõi chủ trọ và số người biết đến | Release 11 | done |
| 12 | Lưu phòng yêu thích | Release 12 | done |
| 13 | Dọn danh mục quyền theo MVP | Release 13 | done |
| 14 | Admin: danh sách người dùng | Release 14 | done |
| 15 | Hồ sơ cá nhân | Release 15 | done |
| 16 | Tin đang hiện trên hồ sơ chủ trọ | Release 16 | done |
| 17 | Admin: xem đơn mua gói và doanh thu | Release 17 | done |
| 18 | Đăng tin kèm ảnh trong một lần gọi | Release 18 | done |
| 19 | Giới hạn lại tọa độ khi đăng nhà trọ | Release 19 | done |
| 20 | Chat giữa người tìm trọ và chủ trọ | Release 20 | done |
| 21 | Dữ liệu demo cho FE | Release 21 | done |
| 22 | Đánh giá trọ trên hồ sơ chủ trọ | Release 22 | done |
| 23 | Đóng gói Docker và phát hành | Release 23 | planned |

## Foundations (đã có)

### A. Cấu hình và database · existing
Biến môi trường được kiểm khi khởi động, kết nối PostgreSQL, các migration trong `prisma/migrations/` (bắt đầu từ bảng `users` và bảng `auth_sessions`, mỗi tính năng sau đó thêm migration của nó). Việc cần làm một lần: database dev `rental_management` do `postgres` sở hữu, nên chạy bằng tài khoản admin `ALTER DATABASE rental_management OWNER TO rental_app;` rồi `npm run migration:deploy`. code in `src/config/`, `src/database/`, `prisma/`

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

### 8. Nhà trọ, đăng tin và xem tin · done
Chủ trọ tạo nhà trọ (địa chỉ, phường, phí, tiện ích) rồi đăng tin phòng thuộc nhà trọ đó; tin hiện ngay khi đăng, không có nháp và không có duyệt. Chủ trọ tự ẩn và hiện lại tin của mình; admin ẩn hoặc gỡ ẩn tin của người khác kèm lý do (quyền `listing:moderate`). Người tìm trọ xem danh sách tin công khai có lọc đơn giản (từ khóa, phường, khoảng giá, sắp xếp) và xem chi tiết tin. Địa chỉ theo đơn vị hành chính hai cấp sau sáp nhập (tỉnh hoặc thành phố, rồi phường, xã hoặc đặc khu; không quận huyện), API trả sẵn `fullAddress`. Ảnh tải lên ổ đĩa, tối đa 5 ảnh mỗi tin. Đây là lát cắt để hạn mức, gói và lượt theo dõi có chỗ bám vào. Đã thiết kế đầy đủ ở spec 0002 (cột, API, mã ngắn của tin, nguồn 168 phường, quy tắc đếm lượt xem), bạn Accept ngày 2026-10-14.
**Done when:** chủ trọ tạo nhà trọ và đăng tin, tin hiện ngay trong danh sách công khai; chủ trọ ẩn và hiện lại tin của mình; admin ẩn tin của chủ trọ kèm lý do thì tin biến khỏi danh sách công khai, chủ trọ thấy lý do và không tự hiện lại được; chỉ tin đang hiện của tài khoản đang hoạt động mới hiển thị công khai; người tìm trọ lọc được danh sách và mở được chi tiết, mỗi người xem được cộng một lượt xem trong 30 phút (chủ tin không tính), khách chưa đăng nhập không thấy số điện thoại; mọi địa chỉ có `fullAddress` hai cấp; tải lên được tối đa 5 ảnh mỗi tin; admin quản lý danh mục phường và tiện ích và có danh sách tin để kiểm duyệt.
- [x] Design it (spec): `/architect property listings`
- [x] Build it: `/develop property listings`
   - [x] Mốc 1: nền dữ liệu (7 bảng, 11 mã lỗi, hàm `toSearchKey`, `toSlug`, nhận loại ảnh) và `GET /wards`, `GET /amenities` theo địa chỉ hai cấp sau sáp nhập, kèm seed 168 phường (AC-1)
   - [x] Mốc 2: nhà trọ, phí và tiện ích, xóa mềm có chặn khi còn tin, `fullAddress` (AC-3, AC-4, AC-16)
   - [x] Mốc 3: đăng tin, danh sách và chi tiết công khai, lượt xem, tin của chủ trọ, sửa, ẩn và hiện (AC-5, AC-6, AC-7, AC-10 đến AC-14, AC-16)
   - [x] Mốc 4: ảnh tin, tối đa 5 ảnh mỗi tin (AC-8); đã chạy thật trên DB thử 2026-10-19 (86 kiểm tra HTTP và SQL với tệp ảnh thật gồm đồng thời, lỗi DB giả và luật hiển thị, ba điều khiển âm, 906 bài unit, Newman 253 request và 479 assertion với hai assertion đã biết của folder 02); nhóm giới hạn `listingImage` đã thêm ở mốc này, mốc 5 không còn nhóm nào thiếu
   - [x] Mốc 5: kiểm duyệt của admin, danh mục admin, giới hạn tần suất, tài liệu và kiểm cuối (AC-2, AC-9, AC-15); đã chạy thật trên DB thử 2026-10-20 (184 kiểm tra HTTP, đua admin với chủ trọ 20/20 và hai admin cùng lúc 10/10 kèm hai điều khiển âm đều bị bắt, năm nhóm giới hạn tần suất gọi thật, 987 bài unit, Newman 329 request và 645 assertion không lỗi hai lần liên tiếp); README viết lại; phần "test e2e" của bước 12 thay bằng script gọi thật và Newman, chưa có bộ Jest e2e (`test/app.e2e-spec.ts` là bản mẫu Nest còn sót và hỏng)
Spec [0002](../specs/0002-property-listings/index.md) (16 AC, 5 mốc, đã được bạn Accept ngày 2026-10-14; trạng thái spec đi theo tính năng) · code in `src/catalog/`, `src/properties/`, `src/listings/`, `src/common/pagination/`, `src/common/auth/optional-auth.decorator.ts`, `src/common/text/`, `src/common/files/`, `src/storage/`, `src/database/seed-data.ts`, `src/database/seed-catalog.ts`, `prisma/seed-data/`, `prisma/migrations/20261014090000_property_listings/` · tài liệu in `docs/api/`

## Release 9: dùng thử và hạn mức

### 9. Dùng thử miễn phí và hạn mức tin · done
Chủ trọ dùng thử miễn phí `trial_days` ngày (mặc định 30) với tối đa `trial_listing_limit` tin đang hiện (mặc định 2); cả hai chỉnh bằng bảng `settings`. Một số điện thoại chỉ nhận dùng thử một lần (đã có ở đăng ký, không xác thực bằng mã gửi về). Chỉ tin đang hiện tính vào hạn mức, ẩn một tin là trả lại một chỗ. Hết kỳ dùng thử mà không có gói đang hiệu lực thì mọi tin của chủ trọ tự biến khỏi công khai (suy ra lúc đọc, không cần cron), chủ trọ vẫn xem và sửa được tin của mình; có gói thì tin hiện lại. Người tìm trọ không bị giới hạn. Đã thiết kế đầy đủ ở spec 0003 (13 AC, 4 mốc), bạn Accept ngày 2026-10-16: hạn dùng thử lưu thành cột `users.trial_ends_at` lúc đăng ký (đổi `trial_days` chỉ ảnh hưởng người đăng ký sau); hạn mức hiện hành tính ở một hàm (gói thay hạn mức dùng thử khi còn hiệu lực, hàng 10 cắm vào); hai mã lỗi 403 `MEMBERSHIP_REQUIRED` và `LISTING_QUOTA_REACHED`; khi hạn mức bị hạ thấp hơn số tin đang hiện thì chỉ các tin đăng sớm nhất còn hiện công khai; thêm `GET /me/membership`, cờ `isPublic` cho tin của chủ trọ và API admin cho `settings`.
**Done when:** tài khoản chủ trọ mới có một kỳ dùng thử và một hạn mức tin; đăng hoặc hiện thêm tin khi đã đủ hạn mức bị chặn kèm gợi ý mua gói (hết kỳ thì báo cần mua gói, còn kỳ mà đủ tin thì báo ẩn bớt hoặc nâng gói); ẩn một tin thì đăng thêm được, hai yêu cầu cùng lúc không vượt hạn mức; hết kỳ dùng thử mà chưa có gói thì tin của chủ trọ biến khỏi danh sách công khai ngay mà không cần việc nền; admin hạ hạn mức thì chỉ các tin đăng sớm nhất còn hiện và `isPublic` cho chủ trọ biết tin nào bị ẩn bớt; chủ trọ đọc được kỳ dùng thử và hạn mức ở `GET /me/membership`; một số điện thoại không nhận dùng thử lần hai; số ngày và số tin dùng thử đổi được bằng API `settings` của admin, không viết cứng trong code.
- [x] Design it (spec): `/architect free trial and listing quota`
- [x] Build it: `/develop free trial and listing quota`
   - [x] Mốc 1: nền dữ liệu và tham số: migration `users.trial_ends_at` cùng bảng `settings`, seed hai dòng mặc định, API admin `GET /settings` và `PATCH /settings/:key` (AC-2, AC-12)
   - [x] Mốc 2: kỳ dùng thử và cổng hạn mức ở phía ghi: `trial_ends_at` lúc đăng ký, hàm hạn mức, hai mã lỗi, khóa dòng `users` khi đăng và hiện tin (AC-1, AC-3, AC-4, AC-5, AC-6, AC-7)
   - [x] Mốc 3: luật hiển thị công khai theo hạng, SQL thô hai bước cho danh sách và chi tiết (AC-8, AC-9)
   - [x] Mốc 4: `GET /me/membership`, cờ `isPublic`, đo `EXPLAIN` ở 60 nghìn tin, tài liệu và kiểm cuối (AC-10, AC-11, AC-13); AC-13 đã đo nhưng chưa đạt ngân sách, bạn quyết bỏ qua vì là MVP không chạy thật (2026-10-19, số đo ở `verify.md`)
Spec [0003](../specs/0003-free-trial-listing-quota/index.md) (13 AC, 4 mốc, đã được bạn Accept ngày 2026-10-16; trạng thái spec đi theo tính năng) · code in `src/settings/`, `src/memberships/`, `src/listings/`, `src/auth/`, `src/users/`, `prisma/` · tài liệu in `docs/api/`

## Release 10: mua gói

### 10. Mua gói (thanh toán thử) và gia hạn theo tháng · done
Chủ trọ xem bảng giá gói (công khai), chọn gói, tạo đơn rồi bấm thanh toán thử; đơn thành `paid` và gói có hiệu lực 30 ngày ngay, hạn mức tin tăng theo gói; gia hạn cộng nối tiếp 30 ngày. Admin quản lý gói (tên, giá, số tin tối đa, bật hay tắt). Không có cổng thanh toán, không có tiền thật, không biến môi trường mới (VNPay đã bỏ ngày 2026-10-11). Đã thiết kế đầy đủ ở spec 0004 (13 AC, 3 mốc), bạn Accept ngày 2026-10-19: ba bảng `plans`, `orders`, `subscriptions`; đơn chốt giá, số tin, số ngày lúc tạo; mọi đơn đã trả nối tiếp thành kỳ không chồng nhau (DB chặn); mỗi chủ trọ tối đa một đơn chờ, tạo đơn mới thì đơn chờ cũ tự hủy; bấm thanh toán lần hai trả lại kết quả cũ; chỉ tài khoản chủ trọ tạo được đơn; gói đang chạy thay hạn mức dùng thử qua hàm hạn mức và mảnh SQL hiển thị của hàng 9.
**Done when:** xem được bảng giá công khai; tạo đơn mua gói và thấy trạng thái đơn; bấm thanh toán thử thì đơn thành `paid` và gói có hiệu lực ngay, bấm hai lần không tạo hai gói; gia hạn cộng nối tiếp 30 ngày; gói hết hạn thì tài khoản quay về trạng thái cần mua; xem được lịch sử đơn của mình; admin tạo, sửa và tắt gói.
- [x] Design it (spec): `/architect membership packages and payment`
- [x] Build it: `/develop membership packages and payment`
   - [x] Mốc 1: bảng giá và quản lý gói: migration ba bảng kèm ràng buộc, seed ba gói mẫu, sáu mã lỗi, nhóm giới hạn `orderWrite`, `GET /plans` công khai và API admin tạo, sửa, tắt, xóa gói (AC-1, AC-2, AC-12, AC-13); đã chạy thật trên DB thử 2026-10-19, riêng `orderWrite` mới có trong bảng giới hạn, chưa route nào dùng (đơn ở mốc 2)
   - [x] Mốc 2: đơn, thanh toán thử và kỳ gói: tạo, xem, hủy đơn, `POST /orders/:id/pay` trong một giao dịch, kỳ nối tiếp không chồng nhau, bấm đúp an toàn (AC-3 đến AC-7, AC-11, AC-13); đã chạy thật trên DB thử 2026-10-19 (97 kiểm tra HTTP và SQL, Newman 177 request và 351 assertion, có điều khiển âm cho khóa), gói **chưa đổi hạn mức tin** (mốc 3)
   - [x] Mốc 3: gói thành hạn mức: nhánh gói trong hàm hạn mức, luật hiển thị công khai theo gói, `GET /me/membership` có `state = plan` và `subscription`, tài liệu và kiểm cuối (AC-8, AC-9, AC-10 và rà lại AC-1 đến AC-13); đã chạy thật trên DB thử 2026-10-19 (94 kiểm tra từ ba script gồm oracle 72 tổ hợp và biên mili giây ở ba múi giờ, ba điều khiển âm, 814 bài unit, Newman 225 request và 426 assertion với hai assertion đã biết của folder 02); `EXPLAIN` ở 60 nghìn tin cho phép nối kỳ gói chưa đo riêng (ghi ở `verify.md`)
Spec [0004](../specs/0004-membership-packages-payment/index.md) (13 AC, 3 mốc, đã được bạn Accept ngày 2026-10-19; trạng thái spec đi theo tính năng) · code in `src/plans/`, `src/orders/`, `src/subscriptions/`, `src/memberships/`, `src/listings/`, `src/database/seed-plans.ts`, `src/common/rate-limit/`, `prisma/` · tài liệu in `docs/api/`

## Release 11: theo dõi chủ trọ

### 11. Theo dõi chủ trọ và số người biết đến · done
Người tìm trọ theo dõi (follow) một chủ trọ. Chủ trọ và người xem thấy số người theo dõi cùng tổng lượt xem tin của chủ trọ trên hồ sơ công khai. Số này tích lũy trên tài khoản nên bỏ tài khoản để lập cái mới sẽ mất hết, giữ chủ trọ ở lại và mua gói. Chỉ giữ một loại lượt xem: lượt xem tin đã đếm ở hàng 8 (cột `view_count` của tin), cộng dồn theo chủ trọ, không làm thêm bộ đếm lượt xem hồ sơ riêng. Giữ trong MVP (chốt 2026-10-11). Đã thiết kế đầy đủ ở spec 0005 (9 AC, 2 mốc), bạn Accept ngày 2026-10-20: một bảng `follows`, ba API (`GET /landlords/:id` công khai, `POST` và `DELETE /landlords/:id/follow`), mọi số tính lúc đọc nên không bộ đếm lưu sẵn; hồ sơ hiện tên, ngày tham gia, số người theo dõi (chỉ tài khoản đang hoạt động), tổng lượt xem (mọi tin kể cả ẩn và đã xóa mềm), số tin đang hiện và cờ đã theo dõi; chủ trọ bị khóa thì hồ sơ trả 404; theo dõi lặp lại là an toàn; không có danh sách người theo dõi hay danh sách đang theo dõi.
**Done when:** người tìm trọ đã đăng nhập theo dõi và bỏ theo dõi một chủ trọ, bấm lặp vẫn an toàn, mỗi người chỉ tính một lần, không tự theo dõi chính mình; hồ sơ công khai `GET /landlords/:id` (khách cũng xem được) hiện tên, ngày tham gia, số người theo dõi, tổng lượt xem tin, số tin đang hiện và cờ đã theo dõi; các số cập nhật đúng ngay khi có người bỏ theo dõi, người theo dõi hoặc chủ trọ bị khóa hay mở khóa, tin bị ẩn hoặc xóa, hay chủ trọ hết dùng thử; chủ trọ bị khóa thì hồ sơ biến mất (404).
- [x] Design it (spec): `/architect landlord follow and reach`
- [x] Build it: `/develop landlord follow and reach`
   - [x] Mốc 1: bảng `follows` và hồ sơ công khai `GET /landlords/:id` với các số, đọc trước (AC-1, AC-2, AC-3, AC-4, AC-5, AC-9 phần đọc); đã chạy thật trên DB thử 2026-10-20 (migration `20261020090000_landlord_follows` áp xong và hỏi schema thật, 62 phép kiểm HTTP và SQL với dòng theo dõi chèn tay, bốn điều khiển âm đều bị bắt, Newman 94 request và 184 assertion không lỗi, `EXPLAIN` ở 60 nghìn tin chậm nhất 1,5 ms); API theo dõi và bỏ theo dõi chưa có (mốc 2) nên `isFollowing` của người đăng nhập luôn là `false`
   - [x] Mốc 2: theo dõi và bỏ theo dõi, giới hạn tần suất, tài liệu và kiểm cuối (AC-6, AC-7, AC-8, AC-9 phần ghi); đã chạy thật trên DB thử 2026-10-20 (67 phép kiểm HTTP và SQL gồm 6 vòng đồng thời mỗi vòng 10 lần gọi cùng một cặp, năm điều khiển âm đều bị bắt, lần 61 là 429, 1031 bài unit, Newman 360 request và 729 assertion không lỗi); `ADMIN_PERMISSIONS` là `manage` mọi module nên admin giữ `follow:*`, Service chặn riêng admin bằng 403 để AC-8 đúng như đã Accept (ghi ở bước 6 của spec, cần `/architect` sửa mục Security model)
Spec [0005](../specs/0005-landlord-follow-reach/index.md) (9 AC, 2 mốc, đã được bạn Accept ngày 2026-10-20; trạng thái spec đi theo tính năng) · code in `src/landlords/`, `src/listings/`, `src/common/rate-limit/`, `prisma/` · tài liệu in `docs/api/`

## Release 12: lưu phòng

### 12. Lưu phòng yêu thích · done
Người tìm trọ lưu một tin vào danh sách yêu thích, bỏ lưu và xem danh sách đã lưu. Giữ trong MVP theo lựa chọn của bạn ngày 2026-10-11. Cần hàng 8 có trước. Đã thiết kế đầy đủ ở spec 0006 (8 AC, 2 mốc), bạn Accept ngày 2026-10-20: một bảng `favorites`, ba API (`POST` và `DELETE /listings/:id/favorite`, `GET /me/favorites`) cộng cờ `isFavorite` ở danh sách và chi tiết tin công khai; danh sách đã lưu dùng đúng hai mảnh SQL hiển thị công khai nên tin biến khỏi danh sách đúng lúc nó biến khỏi công khai, dòng lưu vẫn giữ và tin hiện lại thì quay về; mới lưu trước, chỉ phân trang; không giới hạn số tin; lưu và bỏ lưu lặp lại an toàn; admin bị chặn trong Service dù giữ `favorite:*`; không mã lỗi mới.
**Done when:** người tìm trọ đã đăng nhập lưu và bỏ lưu một tin, bấm lặp hay đồng thời vẫn an toàn và mỗi tin chỉ lưu một lần; chỉ lưu được tin đang hiện công khai; xem được danh sách tin đã lưu (mới lưu trước, phân trang); tin không còn hiển thị công khai (bị ẩn, chủ trọ bị khóa, hết dùng thử hoặc hết gói, vượt hạn mức) không hiện trong danh sách đã lưu và hiện lại khi tin hiện lại; danh sách và chi tiết tin công khai cho biết tin nào mình đã lưu (`isFavorite`, `null` với khách); chủ trọ và admin không dùng được các API lưu.
- [x] Design it (spec): `/architect favorites`
- [x] Build it: `/develop favorites`
   - [x] Mốc 1: bảng `favorites`, lưu và bỏ lưu, danh sách đã lưu, giới hạn tần suất, tài liệu và kiểm cuối (AC-1, AC-2, AC-3, AC-4, AC-5, AC-7, AC-8); đã chạy thật trên DB thử 2026-10-21 (migration `20261021090000_favorites` áp xong và hỏi schema thật, `migrate diff` không lệch, 245 kiểm tra HTTP và SQL gồm đồng thời và phép tính độc lập từ dòng thô, 11 kiểm tra giới hạn tần suất, bốn điều khiển âm đều bị bắt, `EXPLAIN` ở 60 048 tin: người lưu 200 tin 2,4 ms, người lưu 5 nghìn tin trang cuối 52,6 ms và phép đếm 47,6 ms, không chỉnh)
   - [x] Mốc 2: cờ `isFavorite` ở `GET /listings` và chi tiết tin công khai, tài liệu và kiểm cuối (AC-6, AC-7); đã chạy thật trên DB thử 2026-10-21 (127 kiểm tra gồm khách, token rác, token hết hạn thật, người tìm trọ, chủ trọ, admin, ba điều khiển âm đều bị bắt, 1078 bài unit, Newman 405 request và 828 assertion không lỗi hai lần liên tiếp trên cùng một DB); `GET /listings` nay đọc đăng nhập tùy chọn và trả `Cache-Control: private, no-store`
Spec [0006](../specs/0006-favorites/index.md) (8 AC, 2 mốc, đã được bạn Accept ngày 2026-10-20; trạng thái spec đi theo tính năng) · code in `src/favorites/`, `src/listings/`, `src/common/rate-limit/`, `prisma/` · tài liệu in `docs/api/`

## Release 13: dọn danh mục quyền

### 13. Dọn danh mục quyền theo MVP · done
Thu danh mục quyền trong code về đúng bảng ở spec 0003 (bỏ các module đã hoãn, đổi `product` thành `plan`, bỏ `order:refund` và `order:gift`), thêm migration gỡ khóa thừa khỏi `account_types.permissions`, sửa test và `verify.md`. Không đổi hành vi API đang chạy ngoài việc `GET /permissions` ngắn lại. Nên làm trước hàng 8 để quyền thừa không lọt vào tính năng mới.
**Done when:** `GET /permissions` chỉ liệt kê module của MVP; quyền mặc định của `landlord` và `tenant` khớp bảng ở 0003; mọi test qua; không route hay test nào còn dùng khóa đã bỏ.
- [x] Design it (spec): đã chốt trong spec 0003, cập nhật 2026-10-11
- [x] Build it: `/develop permission catalog cleanup`
Đã chạy thật trên hai DB thử (một DB có khóa thừa thêm tay, một DB dựng từ đầu): landlord 14 quyền, tenant 7, `migrate diff` không lệch, Newman 27 request không lỗi, 136 test qua. DB dev của bạn cần `npm run migration:deploy` một lần.
Spec [0003](../specs/0001-backend-foundation/0003-authorization-rbac.md) · code in `src/common/auth/permission-catalog.ts`, `prisma/migrations/20261011090000_mvp_permission_cleanup/` · tài liệu in `docs/api/`

## Release 14: danh sách người dùng cho admin

### 14. Admin: danh sách người dùng · done
Admin xem, tìm và lọc danh sách tài khoản để tìm đúng người cần khóa hoặc mở khóa mà không phải biết sẵn id. Chỉ đọc: hàng này không thêm cách sửa hay xóa tài khoản.
**Done when:** admin mở được danh sách tài khoản có phân trang, lọc theo loại tài khoản và trạng thái, tìm theo email, tên hoặc số điện thoại, và mỗi dòng có id dùng được với khóa và mở khóa; người không phải admin bị từ chối; không bao giờ lộ mật khẩu hay mã băm.
- [x] Design it (spec): `/architect admin user list`
- [x] Build it: `/develop admin user list`
   - [x] Mốc 1: `GET /users` cho admin: bộ lọc loại và trạng thái, tìm theo email, tên, số điện thoại, kiểm lại admin mỗi lần gọi, tài liệu và kiểm cuối, không migration (AC-1 đến AC-8); đã chạy thật trên DB thử 2026-10-21 (108 kiểm tra HTTP và SQL đối chiếu với dòng thô, ba điều khiển âm đều bị bắt: bỏ `escapeLike`, bỏ điều kiện xóa mềm, `select` lấy mọi cột kèm mapper chép nguyên dòng; riêng đổi `select` một mình không lộ ra phản hồi vì mapper là lớp chắn thứ hai, test đơn vị của Repository bắt nó; 1145 bài unit; Newman folder 01, 03, 07, 08, 09 và 20: 105 request, 209 assertion không lỗi); `EXPLAIN` ở 50 nghìn người dùng đo một lần, không chỉnh (trang đầu 12 ms, `status=locked` 6 ms, `q` giữa email 44 ms, `q` số điện thoại 47 ms, đều quét cả bảng); DB thử có locale `English_United States.1252` mã hóa UTF8 và `ILIKE` gập đúng chữ Việt có dấu
Spec [0007](../specs/0007-admin-user-list/index.md) (8 AC, 1 mốc, đã được bạn Accept ngày 2026-10-21; trạng thái spec đi theo tính năng) · code in `src/users/` · tài liệu in `docs/api/`

## Release 15: hồ sơ cá nhân

### 15. Hồ sơ cá nhân · done
Người đã đăng nhập xem và tự sửa hồ sơ của chính mình, dùng hai quyền `profile:read` và `profile:update` đã có trong danh mục quyền từ hàng 5 nhưng chưa route nào dùng. Hiện chỉ có `GET /auth/me` cho biết mình là ai, chưa có chỗ nào để sửa tên hay số điện thoại. Luật số điện thoại của chủ trọ (bắt buộc, không trùng giữa các chủ trọ) phải còn đúng sau khi sửa. Đã thiết kế đầy đủ ở spec 0008 (9 AC, 1 mốc), bạn Accept ngày 2026-10-21: chỉ sửa tên và số điện thoại (đổi email, ảnh đại diện, xóa tài khoản để sau); hai API `GET` và `PATCH /me/profile`, không bảng hay migration; chủ trọ đổi số với đúng luật lúc đăng ký (một dòng của spec 0002 đã sửa cho khớp); admin dùng chung API cho chính mình; `PATCH` bị giới hạn 30 lần mỗi giờ theo người dùng.
**Done when:** người tìm trọ và chủ trọ xem được hồ sơ của mình và sửa được tên và số điện thoại; chủ trọ không xóa được số điện thoại và không đặt trùng số của chủ trọ khác; mỗi người chỉ xem và sửa được hồ sơ của chính mình; hồ sơ không bao giờ lộ mật khẩu hay mã băm và không đổi được loại tài khoản hay trạng thái khóa.
- [x] Design it (spec): `/architect personal profile`
- [x] Build it: `/develop personal profile`
   - [x] Mốc 1: `GET` và `PATCH /me/profile` cho tên và số điện thoại, luật số của chủ trọ, nhóm giới hạn `profileWrite`, tài liệu và kiểm cuối (AC-1 đến AC-9); đã chạy thật trên DB thử 2026-10-21 (119 kiểm tra HTTP và SQL đối chiếu với hàng thô, gồm đua hai chủ trọ cùng một số mười vòng không bao giờ có hai hàng giữ cùng số, ba điều khiển âm đều bị bắt: bỏ vế bỏ qua chính mình, bỏ chặn chủ trọ xóa số, mapper chép nguyên hàng kèm `findById` lấy cả mật khẩu băm; 1212 bài unit; Newman 478 request và 983 assertion với hai assertion đã biết của folder 02, hai lượt liền trên cùng một DB)
Spec [0008](../specs/0008-personal-profile/index.md) (9 AC, 1 mốc, đã được bạn Accept ngày 2026-10-21; trạng thái spec đi theo tính năng) · code in `src/users/`, `src/common/rate-limit/` · tài liệu in `docs/api/`

## Release 16: tin đang hiện trên hồ sơ chủ trọ

### 16. Tin đang hiện trên hồ sơ chủ trọ · done
Hồ sơ công khai của chủ trọ (`GET /landlords/:id`, hàng 11) mới chỉ có con số: `publicListingCount` cho biết có bao nhiêu tin đang hiện nhưng không cho xem đó là những tin nào. Thêm đường để người xem mở hồ sơ rồi xem danh sách tin đang hiện công khai của chủ trọ đó, dùng đúng luật hiển thị công khai của hàng 8, 9 và 10. `GET /listings` công khai hiện chưa có bộ lọc theo chủ trọ (chỉ `GET /moderation/listings` của admin có `landlordId`), nên cần thêm một đường riêng. Việc này nằm trong mục hoãn của spec 0005 (2026-10-20), nay đưa vào kế hoạch theo yêu cầu của bạn. Đã thiết kế đầy đủ ở spec 0009 (8 AC, 1 mốc), bạn Accept ngày 2026-10-21: một API đọc mới `GET /landlords/:id/listings` (công khai, đọc đăng nhập tùy chọn), chỉ phân trang, mới đăng trước, không bộ lọc hay `sort`; dùng lại đúng hai mảnh SQL hiển thị công khai nên `total` bằng `publicListingCount` của hồ sơ; phần tử giống hệt tin trong `GET /listings` kể cả `isFavorite`; chủ trọ không hợp lệ hay bị khóa trả 404 `LANDLORD_NOT_FOUND` như hồ sơ; dùng nhóm giới hạn `publicRead` có sẵn; không bảng, không migration, không mã lỗi mới, hồ sơ giữ nguyên bảy trường.
**Done when:** mở hồ sơ công khai của một chủ trọ thì xem được danh sách tin đang hiện của họ, có phân trang, mỗi phần tử cùng hình dạng với tin trong danh sách tìm trọ (kể cả cờ `isFavorite` cho người đã đăng nhập); số tin trong danh sách bằng `publicListingCount` của hồ sơ; tin bị ẩn, bị xóa, chủ trọ bị khóa, hết dùng thử hoặc vượt hạn mức không hiện; chủ trọ không có hoặc đang bị khóa thì trả cùng lỗi 404 như hồ sơ.
- [x] Design it (spec): `/architect landlord listings on profile`
- [x] Build it: `/develop landlord listings on profile`
   - [x] Mốc 1: danh sách tin đang hiện của chủ trọ: điều kiện `landlordId` ở truy vấn danh sách công khai, `LandlordsService.listListings`, route `GET /landlords/:id/listings`, kiểm thật, tài liệu và kiểm cuối (AC-1 đến AC-8); đã chạy thật trên DB thử 2026-10-21 (159 kiểm tra HTTP và SQL, gồm phép tính độc lập từ dòng thô ở các hạn mức 100, 5, 3, 1, 0 cho hai chủ trọ, so với `GET /listings` và chi tiết công khai, hết dùng thử rồi mua gói, khóa rồi mở khóa, chín loại người xem và đúng 300 lần rồi 429; ba điều khiển âm đều bị bắt: bỏ điều kiện `p.landlord_id` làm 56 kiểm tra sai, bỏ bước tra chủ trọ làm 10 sai, cờ `isFavorite` luôn false làm 5 sai; 1226 bài unit; Newman 493 request và 1037 assertion hai lượt liền với hai assertion đã biết của folder 02); `EXPLAIN` ở 60 nghìn tin đo một lần, không chỉnh (chủ trọ có 300 tin khoảng 12 ms, chủ trọ có 20 tin 0,3 ms, `GET /listings` toàn hệ thống 1038 ms để so)
Spec [0009](../specs/0009-landlord-profile-listings/index.md) (8 AC, 1 mốc, đã được bạn Accept ngày 2026-10-21; trạng thái spec đi theo tính năng) · code in `src/landlords/`, `src/listings/` · tài liệu in `docs/api/`

## Release 17: đơn mua gói và doanh thu cho admin

### 17. Admin: xem đơn mua gói và doanh thu · done
Hiện `GET /orders` chỉ trả đơn của chính người gọi và Service chặn cả admin xem đơn người khác (`assertOwner`), nên admin không biết ai đã mua gói nào, đơn nào đã trả, và không cộng được doanh thu. Thêm đường chỉ đọc cho admin xem đơn của mọi chủ trọ, lọc được, kèm tổng tiền các đơn đã trả để kiểm tra doanh thu. Đây là tiền của thanh toán thử, không phải tiền thật. Việc này nằm trong mục hoãn của spec 0004 (2026-10-19), nay đưa vào kế hoạch theo yêu cầu của bạn. Đã thiết kế đầy đủ ở spec 0010 (10 AC, 2 mốc), bạn Accept ngày 2026-10-21: hai API chỉ đọc cho admin, `GET /orders/all` (lọc trạng thái, chủ trọ, gói, khoảng ngày tạo, kèm `summary` số đơn đã trả và tổng tiền của đúng tập lọc) và `GET /orders/revenue` (tổng, chia theo gói, chia theo ngày hoặc tháng của ngày trả, chuỗi thưa để FE điền ô trống); ranh giới ngày theo giờ Việt Nam (hằng `Asia/Ho_Chi_Minh`); quyền mới chỉ admin `order:report` cùng `@FreshAuth()` (bắt buộc, vì token cũ của chủ trọ mang `order:manage`); không bảng, không migration, không mã lỗi mới, không giới hạn tần suất.
**Done when:** admin mở được danh sách đơn của mọi chủ trọ có phân trang, lọc theo trạng thái, chủ trọ, gói và khoảng ngày tạo; mỗi dòng có mã đơn, tên gói, giá đã chốt, trạng thái, thời điểm tạo và trả, cùng tên và email chủ trọ; có số đơn và tổng tiền các đơn đã trả theo đúng bộ lọc đang chọn, và con số này khớp với tổng cộng tay các dòng; admin xem được thống kê doanh thu theo khoảng ngày trả (tổng, theo gói, theo ngày hoặc tháng giờ Việt Nam) mà ba tổng luôn bằng nhau; người không phải admin bị từ chối (kể cả chủ trọ mang token cũ); không bao giờ lộ mật khẩu hay mã băm.
- [x] Design it (spec): `/architect admin order list and revenue`
- [x] Build it: `/develop admin order list and revenue`
   - [x] Mốc 1: quyền `order:report`, hằng múi giờ và kiểm ngày, `GET /orders/all` kèm `summary`, tài liệu và kiểm cuối (AC-1 đến AC-5, AC-9, AC-10); đã chạy thật trên DB thử 2026-10-21 (182 kiểm tra HTTP và SQL với phép tính độc lập từ dòng thô, ranh giới đúng từng mili giây, tổng 3.000.000.000, token chủ trọ giả mang `order:manage`, admin bị khóa và bị xóa mềm; chạy lại dưới hai múi giờ phiên; bốn điều khiển âm đều bị bắt; 1334 bài unit; Newman 522 request và 1118 assertion, 0 lỗi); `EXPLAIN` ở 50 nghìn đơn đo một lần, không chỉnh (trang đầu khoảng 30 ms)
   - [x] Mốc 2: `GET /orders/revenue` (tổng, theo gói, theo ngày hoặc tháng), tài liệu và kiểm cuối (AC-6 đến AC-9); đã chạy thật trên DB thử 2026-10-21 (139 kiểm tra HTTP và SQL với phép tính độc lập từ dòng thô, ranh giới 17:30Z, tổng 3.000.000.000, 48 lần trả đồng thời trong lúc gọi thống kê 198 lần mà ba tổng luôn bằng nhau; chạy lại dưới ba múi giờ phiên; bốn điều khiển âm đều bị bắt; 1380 bài unit; Newman 535 request và 1160 assertion, 0 lỗi, hai lượt liền); `EXPLAIN` ở 50 nghìn đơn đo một lần, không chỉnh (toàn bộ theo tháng khoảng 47 ms)
Spec [0010](../specs/0010-admin-order-list-revenue/index.md) (10 AC, 2 mốc, đã được bạn Accept ngày 2026-10-21; trạng thái spec đi theo tính năng) · code in `src/orders/`, `src/common/auth/permission-catalog.ts`, `src/common/time/` · tài liệu in `docs/api/`

## Release 18: đăng tin kèm ảnh

### 18. Đăng tin kèm ảnh trong một lần gọi · done · Tracer Bullet
Hiện đăng tin và thêm ảnh là hai bước riêng: `POST /properties/:propertyId/listings` chỉ nhận JSON và tạo tin ngay, rồi `POST /listings/:id/images` nhận từng ảnh một (mục 6.28 và mục 7 bước 8 của tài liệu FE). Chủ trọ phải đăng xong rồi vào sửa mới có ảnh, và nếu bước ảnh hỏng thì tin đã hiện mà chưa có ảnh. Đã kiểm ngày 2026-11-02: tài liệu FE mô tả đúng API, không thiếu gì; chính API chưa có đường đăng tin kèm ảnh. Hàng này thêm một lần gọi nhận cả các trường của tin lẫn ảnh (`multipart/form-data`), tạo tin và lưu ảnh cùng lúc. Bạn chốt ngày 2026-11-02: một ảnh lỗi thì hủy cả bài, không tạo tin nào; bắt buộc ít nhất 1 ảnh khi đăng. Đã thiết kế đầy đủ ở spec 0011 (9 AC, 2 mốc), bạn Accept ngày 2026-11-02: đổi chính `POST /properties/:propertyId/listings` sang `multipart/form-data` kèm từ 1 đến 5 ảnh ở trường `images` (ảnh đầu là ảnh bìa) và bỏ hẳn đường JSON; tin, dòng ảnh và tệp ghi trong một giao dịch, lỗi ở đâu cũng dọn sạch; lỗi ảnh nói rõ ảnh nào sai (`images.N`); chặn xóa ảnh cuối cùng của một tin (mã mới 409 `LISTING_IMAGE_REQUIRED`); tin cũ chưa có ảnh (như tin của `bao.pham` trong dữ liệu demo) giữ nguyên; không bảng, không migration, không biến môi trường mới. Đây là thay đổi phá vỡ nên FE, bộ Postman và tài liệu FE đổi cùng đợt.
**Done when:** chủ trọ đăng tin kèm từ 1 đến 5 ảnh trong một lần gọi và nhận lại tin đã có `images` và `coverImageUrl`; thiếu ảnh, quá 5 ảnh, hoặc một ảnh sai định dạng hay quá dung lượng thì không tạo tin nào và không để lại tệp ảnh nào trên ổ đĩa; các luật đăng tin cũ vẫn đúng (đủ quyền, đúng chủ nhà trọ, hạn dùng thử và hạn mức tin, tin hiện ngay); xóa ảnh cuối cùng của một tin bị chặn bằng lỗi 409 và hai lần xóa đồng thời không để tin còn 0 ảnh; tài liệu FE và bộ Postman nói đúng cách gọi mới.
- [x] Design it (spec): `/architect listing with images in one request`
- [x] Build it: `/develop listing with images in one request`
   - [x] Mốc 1: đăng tin kèm ảnh trong một lần gọi: đường đăng tin sang `multipart/form-data`, kiểm hình dạng ảnh, một giao dịch có dọn tệp, interceptor đổi multipart hỏng thành 400, bộ Postman và tài liệu FE đổi theo (AC-1 đến AC-6, AC-8, AC-9); đã chạy thật trên DB thử 2026-11-02 (114 kiểm tra HTTP và database có so thư mục ảnh trước và sau, 25 kiểm tra gây lỗi thật ở Service: ghi tệp thứ ba lỗi, commit lỗi tin không lưu, commit báo lỗi mà tin đã lưu, đọc lại lỗi sau commit, trùng mã tin, giao dịch hết hạn; 6 yêu cầu đồng thời khi còn một chỗ ra đúng một 201; ba điều khiển âm đều bị bắt; 1522 bài unit; Newman 573 request và 1222 assertion, 0 lỗi, hai lượt liền, cộng folder demo 38 request); hai điểm lệch spec đã xử lý: Nest giải tham số song song nên `INVALID_ID` trước `VALIDATION_FAILED` phải bảo đảm bằng `RejectInvalidUuidParam`, và `MultipartFilesInterceptor` là lớp con của `AnyFilesInterceptor` thay vì interceptor đứng ngoài (xem báo cáo `/develop`)
   - [x] Mốc 2: chặn xóa ảnh cuối cùng của tin: mã lỗi `LISTING_IMAGE_REQUIRED`, xóa ảnh trong giao dịch có khóa dòng tin, kiểm cuối (AC-7, AC-9); đã chạy thật trên DB thử 2026-11-02 (46 kiểm tra HTTP và database: xóa tuần tự từ 3 ảnh xuống 1 rồi bị chặn có so tệp và dòng, thay ảnh duy nhất, 12 vòng mỗi ca đồng thời: hai ảnh của tin có 2 ảnh ra đúng một 204 một 409, cùng một ảnh hai lần ra một 204 một 404, ba ảnh cùng lúc ra hai 204 một 409, thứ tự lỗi, tin cũ 0 ảnh; điều khiển âm bỏ khóa dòng tin: 25 trên 30 vòng để tin còn 0 ảnh, bị bắt; 1529 bài unit; Newman 583 request và 1241 assertion, 0 lỗi, hai lượt liền, cộng folder demo 38 request); bộ Postman thêm 10 request vào folder 15, tài liệu FE cập nhật
Spec [0011](../specs/0011-listing-with-images-in-one-request/index.md) (9 AC, 2 mốc, đã được bạn Accept ngày 2026-11-02; trạng thái spec đi theo tính năng) · code in `src/listings/`, `src/common/files/`, `src/common/errors/uuid-param.interceptor.ts`, `src/common/decorators/form-number.decorator.ts`, `src/common/persistence/` · tài liệu in `docs/api/`

## Release 19: giới hạn tọa độ nhà trọ

### 19. Giới hạn lại tọa độ khi đăng nhà trọ · done
Hiện tọa độ của nhà trọ là tùy chọn và backend chỉ kiểm vĩ độ trong [-90, 90], kinh độ trong [-180, 180], nên một điểm ở nước ngoài hay giữa biển vẫn được nhận. Theo yêu cầu của bạn ngày 2026-11-03, giới hạn hai lớp: tọa độ phải nằm trong một khung bao quanh TP.HCM mới (gồm Bình Dương và Bà Rịa Vũng Tàu cũ, nên khung rộng, chỉ chặn điểm sai rõ ràng), và phải nằm gần phường chủ trọ đã chọn. Bạn cũng muốn khi chủ trọ nhập địa chỉ thì tự xác định và ghim tọa độ, giao cho FE nếu FE làm tốt hơn, không thì backend làm. `/scope` khuyến nghị để FE làm (FE vốn cần bản đồ để chủ trọ kéo ghim và xem lại, còn backend gọi dịch vụ bản đồ thì thêm khóa bí mật, hạn mức gọi và chi phí), backend chỉ kiểm lại điểm FE gửi lên. Tọa độ vẫn tùy chọn, chưa bắt buộc. Đã thiết kế đầy đủ ở spec 0012 (9 AC, 2 mốc), bạn Accept ngày 2026-11-03: FE tự ghim tọa độ từ địa chỉ, backend không gọi dịch vụ bản đồ và chỉ kiểm lại; lớp 1 là hai khung bao quanh TP.HCM (đất liền vĩ độ 10.2 đến 11.7, kinh độ 106.2 đến 107.7; Côn Đảo vĩ độ 8.4 đến 8.9, kinh độ 105.9 đến 106.9); lớp 2 là hộp bao của phường đã chọn nới 500 m, hộp của 168 phường (bốn số mỗi phường, đã đối chiếu trùng 168 trên 168 mã với `wards.json`) lấy từ GeoJSON của kho `thanglequoc/vietnamese-provinces-database` tag `v5.2.0`, lưu thành bốn cột mới của `wards`, điền bằng seed và trả cho FE ở `bounds` của `GET /wards`; hai mã lỗi 400 mới `COORDINATE_OUT_OF_AREA` và `COORDINATE_FAR_FROM_WARD`; đổi phường mà không gửi tọa độ thì kiểm tọa độ đang lưu; nhà trọ cũ đã lưu tọa độ ngoài vùng giữ nguyên, chỉ kiểm khi ghi; phường admin thêm không có hộp thì chỉ bị lớp 1; hai tọa độ demo phải dời.
**Done when:** tạo hoặc sửa nhà trọ với tọa độ ngoài khung TP.HCM hoặc quá xa phường đã chọn bị từ chối bằng lỗi 400 nói rõ lỗi nằm ở tọa độ; tọa độ hợp lệ vẫn lưu và trả như cũ, cặp tọa độ vẫn gửi cùng nhau hoặc không gửi; ai là người tự xác định tọa độ từ địa chỉ (FE hay backend) được ghi trong spec; tài liệu FE nói đúng luật mới.
- [x] Design it (spec): `/architect coordinate limits for properties`
- [x] Build it: `/develop coordinate limits for properties`
   - [x] Mốc 1: khung thành phố (lớp 1): `coordinate-area.ts` với hai khung và `isInsideCity`, mã lỗi `COORDINATE_OUT_OF_AREA`, kiểm ở tạo và sửa nhà trọ, test dữ liệu demo, bộ Postman và tài liệu FE (AC-1, AC-3 một phần, AC-4, AC-5 a và c, AC-8, AC-9); đã chạy thật trên DB thử 2026-11-05 (105 kiểm tra HTTP và SQL, một điều khiển âm bắt được 51 kiểm tra, 1562 bài unit, Newman 589 request và 1254 assertion hai lượt liền, folder 23 38 request và 75 assertion, `seed:demo` chạy hai lần), chưa commit
   - [x] Mốc 2: hộp phường (lớp 2): bốn cột và `CHECK` trên `wards` (migration `20261103090000_ward_bounds`), `ward-bounds.json` cùng script dựng `build-ward-bounds.ts`, seed điền ô rỗng, `bounds` cho FE, mã lỗi `COORDINATE_FAR_FROM_WARD`, luật đổi phường, dời hai tọa độ demo, bộ Postman và tài liệu FE (AC-2 đến AC-9); đã chạy thật trên DB thử 2026-11-05 (30 kiểm tra dữ liệu: migration áp lên DB có sẵn 168 phường, `CHECK` từ chối năm ca, seed điền 168 hộp, chạy lại không đổi, hộp sửa tay không bị ghi đè, không lệch schema; 89 kiểm tra HTTP và SQL gồm điểm biên nới ở bốn cạnh, ba cỡ phường, phường admin không hộp, đổi phường, nhà trọ cũ chèn bằng SQL, 24 lượt đua hai PATCH; bốn điều khiển âm đều bắt được: bỏ lề 9 kiểm tra hỏng, bỏ kiểm tọa độ đang lưu khi đổi phường bị bắt, bỏ khóa dòng 23 trên 24 lượt đua cho cả hai PATCH thành công, coi mọi phường là có hộp 7 kiểm tra hỏng; 1644 bài unit, Newman 592 request và 1271 assertion hai lượt liền, folder 23 38 request và 75 assertion, `seed:demo` chạy hai lần), chưa commit
Spec [0012](../specs/0012-property-coordinate-limits/index.md) (9 AC, 2 mốc, đã được bạn Accept ngày 2026-11-03; trạng thái spec đi theo tính năng) · code in `src/properties/`, `src/catalog/`, `src/database/`, `prisma/` · tài liệu in `docs/api/`

## Release 20: chat giữa người tìm trọ và chủ trọ

### 20. Chat giữa người tìm trọ và chủ trọ · done
Hiện người xem tin chỉ thấy tên chủ trọ, muốn hỏi thì phải gọi điện ngoài hệ thống. Theo yêu cầu của bạn ngày 2026-11-05: khi người dùng lướt thấy một tin trọ thì có phần chat để nhắn thẳng cho chủ trọ của tin đó, và bắt buộc phải đăng nhập mới chat được. Chủ trọ nhận và trả lời, cả hai bên xem lại được các cuộc trò chuyện của mình. Đã thiết kế đầy đủ ở spec 0013 (13 AC, 2 mốc), bạn Accept ngày 2026-11-05: hai bảng `conversations` và `messages`; mỗi cặp (tin, người nhắn) một cuộc trò chuyện, chủ trọ chép từ tin lúc tạo; tin nhắn lưu trong DB và FE hỏi lại bằng REST (chưa có kênh đẩy, không email); chỉ người tìm trọ mở được cuộc trò chuyện, chủ trọ trả lời, admin bị chặn mọi route chat; chỉ chữ 1 đến 1000 ký tự, không sửa không xóa; `seq` theo cuộc trò chuyện cho thứ tự, hỏi "có gì mới sau N" và đếm chưa đọc bằng phép trừ; bảy route (mở, gửi, đọc tin, chi tiết, hộp thư, `unread-count`, đánh dấu đã đọc); cuộc trò chuyện sống tiếp khi tin biến khỏi công khai, người kia bị khóa thì đọc được nhưng không gửi được; giới hạn tần suất 20 cuộc trò chuyện mới mỗi giờ, 30 tin mỗi phút, 120 lần đọc mỗi phút; bốn khóa quyền mới (`conversation:read`, `create`, `update`, `message:create`).
**Done when:** người đã đăng nhập mở một tin công khai và gửi được tin nhắn cho chủ trọ của tin đó; chủ trọ thấy cuộc trò chuyện và trả lời được; mỗi bên chỉ đọc được cuộc trò chuyện của chính mình; người chưa đăng nhập không gửi và không đọc được tin nhắn nào; mỗi cuộc trò chuyện cho biết còn bao nhiêu tin chưa đọc và người dùng đánh dấu đã đọc được; cuộc trò chuyện vẫn dùng được khi tin bị ẩn, và không ai kể cả admin đọc được cuộc trò chuyện của người khác.
- [x] Design it (spec): `/architect chat between tenants and landlords`
- [x] Build it: `/develop chat between tenants and landlords`
   - [x] Mốc 1: nhắn qua lại, hộp thư và cách ly: migration hai bảng kèm ràng buộc và khóa quyền mặc định, bốn khóa quyền trong danh mục, ba mã lỗi, ba nhóm giới hạn tần suất, mở cuộc trò chuyện, gửi tin, đọc tin theo con trỏ `seq`, chi tiết và hộp thư, Postman folder 25 và tài liệu FE (AC-1 đến AC-9, AC-12, AC-13); đã chạy thật trên DB thử 2026-11-05 (migration áp lên DB sạch, 44 kiểm tra schema và `migrate diff` không lệch, 433 kiểm tra HTTP và SQL gồm 20 lần mở và 20 lần gửi đồng thời, lặp lại dưới ba múi giờ của database, chín điều khiển âm đều bắt được, 1800 bài unit, Newman 652 request và 1404 assertion hai lượt, folder 25 60 request và 133 dòng kiểm tra; sửa thêm `seed:demo --reset` để xóa cả cuộc trò chuyện và folder 03 để không làm mất khóa chat của tenant)
   - [x] Mốc 2: chưa đọc và đánh dấu đã đọc: `unreadCount` ở mọi phần tử cuộc trò chuyện, `GET /me/conversations/unread-count`, `POST /conversations/:id/read` (mốc kẹp bằng `GREATEST` và `LEAST`, trả 200), `EXPLAIN` một lần, bộ Postman folder 25 (79 request) và tài liệu FE (AC-10, AC-11, AC-12); không có migration mới; đã chạy thật trên DB thử 2026-11-05 (219 kiểm tra HTTP và SQL, `unreadCount` đối chiếu bằng cách đếm lại từ dòng thô, gồm đua giữa gửi và đánh dấu, quyền, khóa, tin đổi trạng thái và 429; chín điều khiển âm đều bắt được; 1846 bài unit; Newman 671 request và 1455 assertion hai lượt; `EXPLAIN` một lần đều dưới 1,3 ms ở 5 nghìn cuộc và 50 nghìn tin, không chỉnh)
Spec [0013](../specs/0013-chat-tenant-landlord/index.md) (13 AC, 2 mốc, đã được bạn Accept ngày 2026-11-05; trạng thái spec đi theo tính năng) · code in `src/chat/`, `src/listings/`, `src/common/`, `prisma/` · tài liệu in `docs/api/`

## Release 21: dữ liệu demo cho FE

### 21. Dữ liệu demo cho FE · done
Để FE có dữ liệu sẵn mà dựng và xem giao diện, lệnh `npm run seed:demo` tạo tài khoản chủ trọ và người tìm trọ giả, nhà trọ, tin kèm ảnh vẽ sẵn, đơn và gói, lượt theo dõi, tin đã lưu, cùng các kịch bản (còn dùng thử, hết dùng thử, gói hết hạn, vượt hạn mức, bị khóa). Thêm `-- --reset` để xóa dữ liệu demo cũ rồi tạo lại. Hàng này được ghi vào scope ngày 2026-11-07, sau khi đã làm xong, vì lúc build chưa có hàng nào cho nó.
**Done when:** chạy `npm run seed:demo` trên database đã có `npm run seed` thì có đủ tài khoản và tin demo cho FE; chạy lại thì dừng, trừ khi thêm `--reset`; `--reset` chỉ xóa dữ liệu của tài khoản có email đuôi `@demo.example.com` và các dòng của người thật trỏ vào đó.
- [x] Build it: `/develop demo seed`
Code in `src/database/seed-demo.ts`, `src/database/demo/`

## Release 22: đánh giá trọ trên hồ sơ chủ trọ

### 22. Đánh giá trọ trên hồ sơ chủ trọ · done
Hiện hồ sơ chủ trọ (`GET /landlords/:id`) chỉ có các con số: người theo dõi, tổng lượt xem, số tin đang hiện. Theo câu hỏi của bạn ngày 2026-11-07, người xem muốn thấy cả các bài đánh giá trọ ngay trên hồ sơ, cạnh các tin và nút theo dõi. Chưa có bảng, API hay quyền nào cho việc này. Đã thiết kế đầy đủ ở spec 0014 (14 AC, 2 mốc), bạn Accept ngày 2026-11-07: một bảng `reviews`, mỗi cặp (người viết, chủ trọ) một đánh giá gồm 1 đến 5 sao và nhận xét tùy chọn; chỉ người tìm trọ đã có cuộc trò chuyện mà chủ trọ đã trả lời mới viết được; hồ sơ thêm `ratingAverage` và `reviewCount`, danh sách đánh giá có route riêng `GET /landlords/:id/reviews`; người viết sửa và xóa của mình, admin ẩn và gỡ ẩn kèm lý do; chủ trọ chưa trả lời đánh giá; mọi số tính lúc đọc, không bộ đếm lưu sẵn.
**Done when:** người đủ điều kiện (người tìm trọ đã nhắn với chủ trọ và được họ trả lời) viết được một đánh giá về trọ của chủ trọ; hồ sơ chủ trọ hiện các đánh giá đó; mỗi người không đánh giá trùng và chủ trọ không tự đánh giá mình; có cách xử lý đánh giá vi phạm (admin ẩn và gỡ ẩn kèm lý do); người chưa đủ điều kiện bị từ chối bằng lỗi rõ ràng.
- [x] Design it (spec): `/architect landlord reviews`
- [x] Build it: `/develop landlord reviews`
   - [x] Mốc 1: viết, sửa, xóa, đọc đánh giá và hai con số trên hồ sơ: bảng `reviews` với ràng buộc và khóa quyền mặc định của `tenant`, sáu mã lỗi, nhóm giới hạn `reviewWrite`, điều kiện chat hai chiều (`ChatRepository.hasLandlordReplied`), năm route `/landlords/:id/review` và `/landlords/:id/reviews`, `ratingAverage` và `reviewCount` ở hồ sơ, bước xóa đánh giá trong `seed:demo --reset`, Postman folder 26 và tài liệu FE (AC-1 đến AC-10, AC-13, AC-14)
   - [x] Mốc 2: kiểm duyệt của admin: `GET /moderation/reviews` có bộ lọc, ẩn và gỡ ẩn kèm lý do và dòng `moderation_logs`, tài liệu và kiểm cuối (AC-11, AC-12)
Spec [0014](../specs/0014-landlord-reviews/index.md) (14 AC, 2 mốc, đã được bạn Accept ngày 2026-11-07; trạng thái spec đi theo tính năng) · code in `src/reviews/`, `src/landlords/`, `src/chat/`, `src/moderation/`, `src/common/`, `src/database/`, `prisma/` · tài liệu in `docs/api/`

## Release 23: đóng gói Docker và phát hành

### 23. Đóng gói Docker và phát hành · needs a decision
Chưa có `Dockerfile`, compose, quy trình CI hay route kiểm tra sức khỏe (`/health`), dù spec nền móng 0001 (con `0006-docker-packaging-and-release.md`) đã mô tả cách đóng gói, và các spec 0007 và 0010 đã ghi việc cần làm khi đóng gói (database locale UTF-8, dữ liệu múi giờ trong image Postgres). Hàng này được thêm ngày 2026-11-07 để kế hoạch khớp thực tế; nó không ảnh hưởng tới các tính năng đã xong.
**Done when:** dựng được image từ mã nguồn, chạy cùng PostgreSQL bằng một lệnh, áp migration và seed trong container, và biết server còn sống qua route kiểm tra sức khỏe; hai điều kiểm trước khi đóng gói đang nằm ở mục Deferred cũng được kiểm xong.
- [ ] Design it (spec): `/architect docker packaging and release`

## Deferred
Ngoài phạm vi bản này, giữ lại để kế hoạch trung thực.
- **Dịch lỗi PostgreSQL**: trùng giá trị khi đăng ký đồng thời, khóa ngoại, id sai, mất kết nối thành lỗi dễ hiểu · needs a decision
- **Body lỗi đầy đủ theo RFC 9457**: `application/problem+json`, `title`, `timestamp`, `path` · needs a decision
- **Luật ESLint** chặn import lỗi gốc của Nest ngoài thư mục errors
- **Decorator Swagger cho lỗi** (`@ApiProblemResponses`)
- **Kiểm hai điều của spec 0002** trước khi đóng gói: băm mật khẩu chạy được trong image Docker (amd64 và arm64), và cookie `SameSite=Strict` đi đúng giữa hai cổng localhost trên Chrome, Firefox, Safari. Spec còn ghi phương án lùi về `bcrypt`, nhưng gói này đã được gỡ khỏi dự án.
- **Giao dịch nhiều bước và chạy migration trong container**: làm cùng tính năng cần chúng (hàng 5 khi gán vai trò lúc đăng ký, và spec 0006).
- **Duyệt tin trước khi hiển thị**: đã bỏ hẳn ngày 2026-10-11, thay bằng admin ẩn tin sau khi đăng (hàng 8). Không làm lại trừ khi bạn đổi ý.
- **Hoãn khỏi MVP (chốt 2026-10-11)**: xác thực chủ trọ và ảnh giấy tờ, báo cáo tin xấu, liên hệ chủ trọ có giới hạn mỗi ngày (đã được chat ở hàng 20 thay thế, chỉ còn giới hạn theo giờ), đẩy tin và tin nổi bật, kiểm tra tại chỗ, quảng cáo, thu chi và dashboard doanh thu, thống kê cho chủ trọ, tìm quanh địa điểm mốc, lịch sử giá tin, cổng thanh toán thật (VNPay), hoàn tiền và tặng gói, đổi loại tài khoản. Thêm lại bằng `/scope` khi tới lượt · needs a decision
- **Hoãn từ spec 0004 (2026-10-19)**: email biên nhận và email nhắc sắp hết gói (cần việc nền), đổi sang gói khác có hiệu lực ngay (cắt gói cũ), mua nhiều kỳ trong một đơn, mô tả và thứ tự do admin đặt cho gói, tự hủy đơn chờ quá hạn; cổng thanh toán thật, hoàn tiền và tặng gói đã nằm ở mục hoãn khỏi MVP phía trên · needs a decision
- **Hoãn từ spec 0003 (2026-10-16)**: email nhắc sắp hết dùng thử (cần việc nền), admin gia hạn dùng thử cho một chủ trọ cụ thể, API công khai cho FE hiện "dùng thử N ngày, M tin" trước khi đăng ký · needs a decision
- **Hoãn từ spec 0005 (2026-10-20)**: danh sách "đang theo dõi" của người tìm trọ, danh sách tên người theo dõi cho chủ trọ, thông báo khi chủ trọ đăng tin mới (cần việc nền), số người theo dõi trong chi tiết tin, bảng hồ sơ chủ trọ riêng (tên hiển thị, Zalo), chống tăng ảo số người theo dõi · needs a decision
- **Hoãn từ spec 0007 (2026-10-21)**: chi tiết một tài khoản (`GET /users/:id`), tham số `sort`, thời điểm đăng nhập gần nhất, người khóa và lúc khóa, thông tin chủ trọ trên mỗi dòng (hạn dùng thử, số tin, gói), tìm tên không phân biệt dấu (cột `users.search_key`), giới hạn tần suất cho danh sách, nhật ký đọc của admin, đếm theo loại và trạng thái, xuất danh sách · needs a decision
- **Hoãn từ spec 0008 (2026-10-21)**: đổi email (cần xác thực email mới), ảnh đại diện, xóa tài khoản của chính mình, giới hạn đổi số điện thoại (ví dụ một lần mỗi 30 ngày), đòi mật khẩu hiện tại khi đổi số, giữ lịch sử số cũ để chặn quay vòng dùng thử, trả 409 thay vì 500 khi hai chủ trọ đổi cùng một số cùng lúc, nhật ký thay đổi hồ sơ, luật cho tên hiển thị · needs a decision
- **Hoãn từ spec 0006 (2026-10-20)**: số lượt lưu cho chủ trọ, ghi chú riêng cho tin đã lưu, thông báo khi tin đã lưu đổi giá hoặc biến mất (cần việc nền), bộ lọc hoặc kiểu sắp xếp cho danh sách đã lưu, báo số tin đã lưu đang bị ẩn, giới hạn số tin được lưu, API riêng trả danh sách id đã lưu · needs a decision
- **Hoãn từ spec 0009 (2026-10-21)**: bộ lọc hoặc kiểu sắp xếp cho danh sách tin của chủ trọ (giá, phường), lọc theo nhà trọ, nhúng trang đầu vào chính hồ sơ để FE gọi một lần, danh sách rút gọn không có `landlord` · needs a decision
- **Hoãn từ spec 0010 (2026-10-21)**: tìm đơn theo mã hay email chủ trọ, chuỗi doanh thu điền đủ ô trống, đếm đơn chờ và đơn hủy trong thống kê, doanh thu theo từng chủ trọ, so sánh với kỳ trước, xuất CSV, tham số `sort`, chỉ mục cho `created_at` và `paid_at`, giới hạn tần suất và nhật ký đọc cho hai route, múi giờ chọn được, hoàn tiền (cần cổng thanh toán thật) · needs a decision
- **Hoãn từ spec 0011 (2026-11-02)**: sửa tin kèm ảnh trong một lần (PATCH multipart), đổi thứ tự ảnh hoặc chọn ảnh bìa, nén hoặc đổi kích thước hoặc xóa EXIF của ảnh, khóa chống trùng khi đăng tin, giới hạn số trường chữ trong multipart, dọn tệp mồ côi bằng việc nền · needs a decision
- **Hoãn từ spec 0012 (2026-11-03)**: kiểm tọa độ theo đường ranh phường chính xác (PostGIS), cho `POST /wards` và `PATCH /wards/:code` nhận hộp phường, dọn tọa độ cũ ngoài vùng, endpoint geocode phía backend · needs a decision
- **Hoãn từ spec 0013 (2026-11-05)**: thông báo khi có tin mới (email hoặc đẩy trình duyệt, cần việc nền), kênh đẩy thời gian thực (SSE hoặc WebSocket), trạng thái đang gõ và trực tuyến, ảnh và tệp trong tin nhắn, sửa hoặc xóa tin nhắn của mình, báo cáo hoặc chặn một người, góc nhìn kiểm duyệt cho admin kèm nhật ký, chống gửi trùng (`clientMessageId`), ghim hoặc tắt tiếng hoặc lưu trữ cuộc trò chuyện, tìm trong tin nhắn, chính sách giữ và xóa tin nhắn, chủ trọ chủ động mở cuộc trò chuyện, mở cuộc trò chuyện từ hồ sơ chủ trọ khi chưa chọn tin, hạn mức mở cuộc trò chuyện theo ngày lưu trong DB · needs a decision
- **Hoãn từ spec 0014 (2026-11-07)**: chủ trọ trả lời đánh giá, phân bố số sao, lọc hoặc sắp theo sao, nút báo cáo đánh giá, ảnh trong đánh giá, bình chọn "hữu ích", đánh giá riêng cho từng nhà trọ, chống đánh giá giả (tuổi tài khoản hay số tin nhắn tối thiểu), tìm theo chữ trong nhận xét cho admin, giữ lại nội dung đã xóa, thông báo khi có đánh giá mới hoặc khi bị ẩn (cần việc nền), số đánh giá tối thiểu trước khi hiện điểm, dòng đánh giá mẫu trong `seed:demo` · needs a decision

## Legend

**The decision box.** Mỗi tính năng có đúng một ô quyết định, nhãn kết thúc bằng `(spec)`. Mọi ô khác là ô thực thi.

- **Next step** là ô đầu tiên chưa tick, luôn là một lệnh.
- **needs a decision** nghĩa là chạy `/architect` trước; không thì đi thẳng `/develop`. Thẻ này mất đi khi spec được ghi.
- **Status** đi theo `planned`, `in-progress`, `done`, cùng `existing` (có trước quy trình) và `dropped` (bỏ khỏi scope hoặc đã được thay, giữ lịch sử).
- **Workflow** là mức mặc định của dự án. Prototype nghĩa là sau `/develop` không còn bước nào khác, bạn tự kiểm.
