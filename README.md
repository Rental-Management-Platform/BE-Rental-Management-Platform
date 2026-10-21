# Rental Management Platform: API backend

API backend cho nền tảng cho thuê trọ. Chủ trọ tạo nhà trọ và đăng tin phòng, người tìm trọ (kể cả khách chưa đăng nhập) tìm và xem tin, admin kiểm duyệt. Đây là bản **MVP để demo**: ưu tiên gọn, thanh toán chỉ là thanh toán thử (không có tiền thật).

## Làm được gì

- **Tài khoản**: đăng ký chọn một trong hai loại (chủ trọ hoặc người tìm trọ; admin do seed tạo), đăng nhập, access token ngắn hạn cộng refresh token xoay vòng trong cookie, quên và đổi mật khẩu qua email.
- **Phân quyền**: quyền theo loại tài khoản lưu trong database, admin chỉnh được; khóa và mở khóa tài khoản.
- **Nhà trọ và tin đăng**: địa chỉ theo đơn vị hành chính hai cấp sau sáp nhập (tỉnh hoặc thành phố, rồi phường, xã hoặc đặc khu; không có quận huyện), phí, tiện ích, tối đa 5 ảnh mỗi tin. Tin hiện ngay khi đăng, chủ trọ tự ẩn và hiện lại.
- **Xem tin công khai**: danh sách có lọc (từ khóa không dấu, phường, khoảng giá, sắp xếp), chi tiết tin, lượt xem, số điện thoại chủ trọ chỉ hiện cho người đã đăng nhập.
- **Kiểm duyệt**: admin tìm tin, ẩn và gỡ ẩn kèm lý do; admin quản lý danh mục phường và tiện ích.
- **Dùng thử và hạn mức**: chủ trọ dùng thử vài chục ngày với vài tin đang hiện; hết kỳ thì tin tự biến khỏi công khai. Admin chỉnh hai con số này.
- **Mua gói (thanh toán thử)**: bảng giá, đơn, thanh toán thử, gói nối tiếp từng kỳ, gói đổi hạn mức tin.
- **Theo dõi chủ trọ và lưu tin**: hồ sơ công khai của chủ trọ (số người theo dõi, tổng lượt xem, số tin đang hiện); người tìm trọ theo dõi chủ trọ, lưu tin yêu thích và xem danh sách đã lưu.
- **Giới hạn tần suất** cho đăng nhập, mật khẩu, ghi dữ liệu và các API đọc công khai.

Chi tiết từng API nằm ở [`docs/api/api-for-frontend.md`](docs/api/api-for-frontend.md). Các phần đã hoãn khỏi bản MVP xem [`docs/scope/scope.md`](docs/scope/scope.md), mục Deferred.

## Công nghệ

NestJS 11, PostgreSQL 18, Prisma 7 (client sinh ra ở `src/generated/prisma`, git bỏ qua), JWT cho access token, argon2id để băm mật khẩu, Nodemailer (Gmail SMTP) gửi email, multer nhận ảnh tải lên, `@nestjs/throttler` giới hạn tần suất, class-validator kiểm dữ liệu. Phát triển trên Node.js 24.

Dự án dùng Prisma 7, đừng nâng lên bản 8 khi chưa có quyết định riêng.

## Cài đặt và chạy lần đầu

Cần PostgreSQL đã cài sẵn trên máy và biết mật khẩu tài khoản quản trị `postgres`.

1. Cài thư viện: `npm install` (tự sinh Prisma client).
2. Copy `.env.example` thành `.env` rồi điền các biến bắt buộc (bảng bên dưới). File `.env` đã bị git bỏ qua; **không đưa giá trị thật vào mã nguồn hay vào `.env.example`**. Có thể sinh chuỗi ngẫu nhiên bằng: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.
3. Tạo role ứng dụng (không phải superuser) và database UTF8: `npm run db:create`. Lệnh này đọc `DATABASE_ADMIN_USER` và `DATABASE_ADMIN_PASSWORD`, chạy lại nhiều lần vẫn an toàn, không xóa gì.
4. Kiểm tra kết nối bằng chính tài khoản ứng dụng: `npm run db:check`.
5. Tạo bảng: `npm run migration:deploy` (áp mọi migration trong `prisma/migrations`).
6. Nạp dữ liệu nền và tạo admin đầu tiên: `npm run seed`. Lệnh này build rồi chạy bản đã biên dịch. Nó **chỉ thêm dòng còn thiếu**, chạy lại nhiều lần vẫn đúng và không ghi đè gì admin đã sửa:
   - 168 phường, xã, đặc khu của Thành phố Hồ Chí Minh (nguồn và cách kiểm ở `prisma/seed-data/README.md`);
   - 13 tiện ích mẫu;
   - hai tham số dùng thử (`trial_days` mặc định 30, `trial_listing_limit` mặc định 2);
   - ba gói mua mẫu;
   - tài khoản admin đầu tiên từ `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_NAME`. Đã có admin thì không tạo thêm; seed dừng với thông báo rõ nếu email đó thuộc một tài khoản không phải admin, khi đó đổi `ADMIN_SEED_EMAIL`.
7. Chạy ứng dụng: `npm run start:dev`. API nằm ở `http://localhost:3000/api/v1` (đổi cổng bằng `PORT`).
8. Thử API: xem mục "Thử API" bên dưới.

Database phải thuộc về role ứng dụng (`db:create` làm đúng điều này). Nếu bạn tạo database bằng tay, chạy `ALTER DATABASE <tên> OWNER TO rental_app;` bằng tài khoản `postgres`, nếu không `migration:deploy` báo `permission denied for schema public`.

Thiếu biến hoặc còn giá trị `CHANGE_ME` thì ứng dụng không khởi động và in danh sách biến sai (chỉ nêu tên biến, không in giá trị).

**Nâng cấp từ bản rất cũ (có cột `users.roles`)**: migration `account_types_phone` không chuyển dữ liệu cũ và dừng nếu bảng `users` còn dòng. Làm lại database dev từ đầu bằng `npx prisma migrate reset`, rồi `npm run seed`. Nếu đã lỡ chạy `migration:deploy` trên database còn dữ liệu, Prisma đánh dấu migration lỗi (P3009): chạy `npx prisma migrate resolve --rolled-back 20261008090000_account_types_phone`, xử lý dữ liệu, rồi chạy lại.

## Biến môi trường

Danh sách đầy đủ kèm ghi chú nằm trong [`.env.example`](.env.example). Cột "Bắt buộc" nghĩa là không có giá trị mặc định nên phải điền.

| Biến | Bắt buộc | Mặc định | Ý nghĩa |
|---|---|---|---|
| `PORT` | không | `3000` | Cổng API |
| `DATABASE_HOST`, `DATABASE_NAME`, `DATABASE_USER` | có | | Kết nối PostgreSQL của ứng dụng |
| `DATABASE_PASSWORD` | có | | Mật khẩu role ứng dụng, từ 16 ký tự |
| `DATABASE_PORT` | không | `5432` | |
| `DATABASE_POOL_MAX` | không | `10` | Số kết nối tối đa |
| `DATABASE_ADMIN_USER`, `DATABASE_ADMIN_PASSWORD` | chỉ `db:create` | | Tài khoản quản trị PostgreSQL, ứng dụng không đọc |
| `JWT_ACCESS_SECRET` | có | | Khóa ký access token, từ 32 ký tự |
| `JWT_ISSUER`, `JWT_AUDIENCE` | không | `rental-api`, `rental-web` | |
| `ACCESS_TTL_SECONDS` | không | `900` | Tuổi thọ access token |
| `REFRESH_TTL_DAYS`, `REFRESH_GRACE_SECONDS` | không | `30`, `10` | Phiên đăng nhập và khoảng ân hạn dùng lại refresh token |
| `MAX_SESSIONS_PER_USER` | không | `10` | Số phiên đăng nhập đồng thời mỗi người |
| `REFRESH_COOKIE_NAME`, `COOKIE_SECURE` | không | `rt`, `false` | `COOKIE_SECURE=true` khi có HTTPS |
| `ALLOWED_ORIGINS` | có | | Địa chỉ FE được gọi API và gửi cookie, cách nhau bởi dấu phẩy, không có `/` cuối. Dùng `localhost` ở cả FE lẫn API |
| `TRUST_PROXY_HOPS` | không | `0` | Số lớp proxy tin cậy (để lấy đúng IP cho giới hạn tần suất) |
| `APP_BASE_URL` | có | | Địa chỉ FE; liên kết trong email dẫn tới `<APP_BASE_URL>/reset-password?token=...` |
| `PASSWORD_RESET_TTL_MINUTES` | không | `30` | Hạn của liên kết đặt lại mật khẩu |
| `MAIL_HOST`, `MAIL_PORT` | có | | Gmail SMTP: `smtp.gmail.com` và `465` |
| `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | có | | Địa chỉ Gmail gửi, **App Password** của Gmail (bật xác minh 2 bước rồi tạo "Mật khẩu ứng dụng"; không dùng mật khẩu đăng nhập Gmail), và địa chỉ hiện ở ô người gửi. Ứng dụng không đăng nhập SMTP lúc khởi động nên sai mật khẩu chỉ lộ ở lần gửi đầu tiên (xem log) |
| `UPLOAD_DIR` | không | `uploads` | Thư mục lưu ảnh tải lên, tính từ thư mục chạy ứng dụng; đã được `.gitignore` |
| `MAX_UPLOAD_BYTES` | không | `5242880` | Dung lượng tối đa mỗi ảnh (5 MiB), từ 1 đến 10485760 |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_NAME` | chỉ `seed` | | Tài khoản admin đầu tiên; mật khẩu từ 8 ký tự. Ứng dụng không đọc |

## Lệnh npm

| Lệnh | Việc làm |
|---|---|
| `npm run start:dev` | Chạy ở chế độ theo dõi thay đổi |
| `npm run start`, `npm run start:prod` | Chạy một lần, hoặc chạy bản đã build (`node dist/main`) |
| `npm run build` | Biên dịch ra `dist/` |
| `npm test` | Chạy test đơn vị. Dùng đúng lệnh này, **đừng chạy `npx jest`**: script đã gắn cờ `--experimental-vm-modules` mà một số gói cần |
| `npm run lint` | ESLint kèm prettier, **tự sửa** file |
| `npm run db:create`, `npm run db:check` | Tạo role và database; kiểm tra kết nối |
| `npm run migration:deploy` | Áp mọi migration |
| `npm run migration:dev -- --name TenMigration` | Tạo migration mới sau khi sửa `prisma/schema.prisma` (thêm `--create-only` nếu cần sửa SQL tay, ví dụ `CHECK` hoặc chỉ mục một phần). Cần một database phụ tên `<DATABASE_NAME>_shadow`: tạo bằng `DATABASE_NAME=<tên>_shadow npm run db:create` |
| `npm run migration:status` | Xem migration nào đã áp |
| `npm run seed` | Nạp dữ liệu nền và tạo admin đầu tiên |
| `npm run db:generate`, `npm run db:studio` | Sinh lại Prisma client; mở giao diện xem dữ liệu |

## Cấu trúc thư mục

```
src/
  main.ts, app.module.ts, app.factory.ts   Khởi động và lắp ghép
  config/                                  Biến môi trường được kiểm khi khởi động
  database/                                Kết nối, seed, script tạo database
  common/                                  Lỗi chung, phân quyền, giới hạn tần suất, phân trang, văn bản
  auth/  users/  account-types/            Tài khoản, đăng nhập, quyền theo loại
  moderation/                              Khóa tài khoản và lịch sử kiểm duyệt
  catalog/                                 Phường, xã, đặc khu và tiện ích (đọc công khai, ghi do admin)
  properties/  listings/  storage/         Nhà trọ, tin đăng (kèm kiểm duyệt tin), ảnh
  settings/  memberships/                  Tham số hệ thống, dùng thử và hạn mức
  plans/  orders/  subscriptions/          Gói, đơn mua, kỳ gói
  landlords/  favorites/                   Hồ sơ, theo dõi và tin đang hiện của chủ trọ, tin yêu thích
  mail/                                    Gửi email
prisma/
  schema.prisma, migrations/               Mô hình dữ liệu và migration
  seed-data/                               Danh sách phường và tiện ích mẫu
docs/
  api/                                     Tài liệu cho FE và bộ request Postman
  scope/, specs/                           Phạm vi và các bản thiết kế
uploads/                                   Ảnh tải lên (git bỏ qua)
```

## Thử API

1. **Postman**: import [`docs/api/postman-collection.json`](docs/api/postman-collection.json), điền `adminEmail` và `adminPassword` trong biến của collection (đúng giá trị `ADMIN_SEED_*`). Chạy các folder từ trên xuống; mỗi folder có phần mô tả điều kiện chạy.
2. **Newman** (chạy cả bộ từ dòng lệnh), ví dụ trên một database thử:

   ```bash
   npx newman run docs/api/postman-collection.json \
     --working-dir docs/api \
     --env-var baseUrl=http://localhost:3000/api/v1 \
     --env-var adminEmail=<ADMIN_SEED_EMAIL> --env-var adminPassword=<ADMIN_SEED_PASSWORD> \
     --folder "00 Kiểm tra máy chủ" --folder "01 Đăng ký và đăng nhập"
   ```

   Lặp cờ `--folder "<tên folder>"` cho từng folder cần chạy. Bộ chạy tự động đầy đủ là các folder 00, 01, 03, 04, 05 rồi 07 đến 17, theo đúng thứ tự trong collection. Lưu ý khi chạy:
   - `--working-dir docs/api` là bắt buộc vì folder "15 Ảnh tin" tải tệp mẫu `sample-listing.png` và `sample-not-image.txt` nằm cạnh collection.
   - Folder "02 Quên và đổi mật khẩu" cần liên kết thật trong email nên bỏ qua khi chạy tự động. Folder "06 Giới hạn tần suất" chạy riêng.
   - Bộ đếm giới hạn tần suất nằm trong bộ nhớ API (ví dụ đăng ký tối đa 10 lần mỗi giờ theo IP): chạy lại cả bộ liên tiếp thì **khởi động lại API trước mỗi lần**.
   - Mỗi lần chạy tạo thêm dữ liệu thử (tài khoản, gói, ảnh). Chạy trên database thử, không chạy trên database đang dùng. Tạo database thử bằng `DATABASE_NAME=<tên khác> npm run db:create`, rồi `migration:deploy` và `seed` với cùng `DATABASE_NAME` đó.
3. **Tài liệu cho FE**: [`docs/api/api-for-frontend.md`](docs/api/api-for-frontend.md). **Hai file `docs/api/` (tài liệu FE và bộ Postman) phải được cập nhật cùng mỗi thay đổi API.**

## Ảnh tải lên

Ảnh của tin lưu trên ổ đĩa trong `UPLOAD_DIR`, phục vụ công khai ở `GET /api/v1/media/public/<tên tệp>` và **chỉ cho ảnh của tin đang hiện công khai**. Chỉ nhận JPEG, PNG, WebP (kiểm bằng nội dung tệp), tối đa 5 ảnh mỗi tin và `MAX_UPLOAD_BYTES` mỗi ảnh. Ảnh không được nén hay xóa dữ liệu EXIF, và xóa mềm tin giữ nguyên ảnh nên thư mục chỉ lớn dần; không có API dọn tệp. Chạy nhiều bản API thì các bản phải dùng chung một thư mục ảnh.

## Giới hạn của bản demo

- Thanh toán là **thanh toán thử**: bấm xác nhận là có gói, không thu tiền, không hoàn tiền.
- Giới hạn tần suất và bộ đếm lượt xem nằm trong bộ nhớ của một bản API: khởi động lại là về 0, nhiều bản API thì mỗi bản đếm riêng.
- Email quên mật khẩu gửi qua Gmail SMTP; gửi lỗi không báo cho người gọi API (xem log).
- Danh sách công khai đếm `total` bằng một phép đếm riêng nên chậm dần khi có hàng chục nghìn tin; đã đo và chấp nhận ở bản demo (xem mục "Giới hạn đã biết" của tài liệu FE).
- Danh sách các phần cố ý hoãn nằm ở mục "Deferred" của [`docs/scope/scope.md`](docs/scope/scope.md).
