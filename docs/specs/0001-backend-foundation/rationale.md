# 0001. Nền móng backend NestJS và PostgreSQL, đóng gói Docker: lý giải và các phương án

Đây là hồ sơ quyết định (vì sao), `/develop` không cần đọc. Bản build nằm ở [index.md](index.md).

## Context

> ⚠️ Premise note: Bốn điểm trong hướng đi này có đánh đổi thật, mình nêu rõ để bạn giữ chúng một cách có chủ ý.
> 1. **ORM: Prisma 7.** Bạn hỏi ORM nhiều người dùng nhất với NestJS. Không có số liệu riêng cho NestJS: theo lượt tải npm chung thì Drizzle và Prisma đứng đầu. Bạn chọn Prisma 7 vì kiểu dữ liệu sinh tự động hợp chữ "tuyệt đối không any" nhất. Cái giá của Prisma: không có module Nest chính thức (viết một `PrismaService` nhỏ), không có đặt tên tự động nên phải `@map` từng cột, không có xóa mềm sẵn, `CHECK` và chỉ mục một phần phải viết SQL tay trong migration (Prisma bỏ qua chúng nên không báo lệch; riêng chỉ mục GIN phải khai báo trong schema), và Prisma 7 còn mới (đã kiểm chạy được trên NestJS dạng CommonJS).
> 2. **"Chỉ cần tải Docker" chưa đúng hẳn.** Bạn chọn bắt điền `.env` và để API không khởi động khi thiếu `MAIL_*` (kể cả App Password Gmail). Người nhận bản demo vì vậy phải được bạn gửi sẵn một file `.env` đã điền, hoặc tự tạo thông tin Gmail của họ.
> 3. **Chạy localhost không còn là link công khai.** Mục tiêu cũ "gửi link để người khác bấm vào" được thay bằng "người khác chạy trên máy của họ". Nếu giảng viên cần một đường dẫn để mở, phải chạy cùng `compose.yaml` trên một máy chủ có địa chỉ công khai (spec không cản việc này, xem 0006 phần Rollout).
> 4. **Gói Docker chỉ gồm API và Postgres.** FE là repo riêng, còn trống, nên chưa được đóng gói; người dùng chỉ thấy API và Swagger cho đến khi FE có image của nó. Hợp đồng với FE ở 0006 giữ cho việc gắn FE vào sau này không phải đổi code API.
>
> Ngoài ra, chủ đề này gồm 6 quyết định độc lập. Spec được chia thành một spec tổng và 6 spec con thay vì một file dài.

Sản phẩm là website kết nối thuê trọ cho sinh viên, làm theo hướng MVP để demo, xoay quanh vòng lặp: mọi người đăng ký miễn phí và chọn một loại tài khoản (chủ trọ hay người tìm trọ, gồm sinh viên); chủ trọ dùng thử miễn phí có thời hạn và hạn mức tin, muốn đăng thêm thì mua gói theo tháng; chủ trọ đăng tin và tin hiện ngay (không có bước duyệt, admin ẩn tin vi phạm sau khi đăng), người tìm trọ tìm, xem, lưu phòng và theo dõi chủ trọ. Số người theo dõi và lượt xem tích lũy trên tài khoản chủ trọ để họ ở lại thay vì tạo tài khoản mới lấy miễn phí. Giai đoạn này là demo cho giảng viên với khoảng 5 người dùng, thanh toán chỉ là thanh toán thử nên không thu tiền thật. Bản chức năng đầu có 27 mục; phạm vi MVP hiện hành là mục "Phạm vi MVP" của `index.md`, các mục còn lại đã hoãn (xem mục "Thu hẹp phạm vi MVP" bên dưới). FE là một repo tách riêng và hiện còn trống.

Hướng triển khai đã đổi: bạn không còn muốn deploy lên dịch vụ đám mây, mà muốn đóng gói toàn bộ hệ thống bằng Docker để người dùng chỉ cần cài Docker rồi chạy trên localhost. Bạn cũng đổi cơ sở dữ liệu từ MongoDB sang PostgreSQL và muốn dùng ORM phổ biến nhất của NestJS cho việc truy vấn. Bộ khung hiện có chỉ có đăng ký, đăng nhập và RBAC cố định, viết trên Mongoose, với nhiều khoảng trống (xem Evidence). Yêu cầu giữ nguyên: xử lý token refresh và access, xử lý lỗi tập trung, kiểm tra dữ liệu đầu vào, tuyệt đối không dùng `any`, cấu trúc NestJS gọn gàng theo best practice.

Miền dữ liệu có những đặc điểm quyết định cách làm: sổ giao dịch cần toàn vẹn và chống ghi trùng; nhiều ràng buộc duy nhất; báo cáo doanh thu, chi phí và KPI; tìm kiếm văn bản tiếng Việt có dấu; vị trí nhà trọ và nhu cầu tìm quanh một điểm (trường, nơi làm việc hay nơi bất kỳ); nhiều trạng thái suy ra từ thời điểm thay vì lưu; và việc mỗi loại tài khoản được làm sẽ thay đổi theo thời gian. Người chạy hệ thống có thể dùng Windows, macOS chip Intel hoặc chip Apple, và không có công cụ nào ngoài Docker.

Nếu không chốt nền móng trước, mỗi tính năng sẽ tự đặt cách báo lỗi, cách giữ phiên, cách kiểm quyền và kiểu dữ liệu riêng; `any` sẽ lan dần; và các vướng mắc khi đóng gói (đường dẫn dữ liệu, kiến trúc chip, xuống dòng của script) chỉ lộ ra ở cuối, lúc sửa tốn nhất.

## Options considered

### Option 1: NestJS, PostgreSQL 18 qua Prisma 7, đóng gói Docker Compose chạy localhost

Hai container (`api`, `db`), image API đưa lên GitHub Container Registry, người dùng tải `compose.yaml` và `.env.example`, điền `.env` rồi `docker compose up`. Đăng nhập tự xử lý bằng `@nestjs/jwt` và Passport.

**Pros**:
- Miền quan hệ được DB đảm bảo (khóa ngoại, ràng buộc, nối bảng, giao dịch); bỏ hẳn dữ liệu sao chép và các test giữ khớp.
- Chạy offline, không tài khoản đám mây, không tên miền; chạy được trên bất kỳ máy nào có Docker.
- Prisma sinh kiểu chặt cho truy vấn thường, hợp luật "tuyệt đối không any" nhất; có `prisma migrate`, Prisma Studio để xem dữ liệu bằng tay, và skill chính thức cho agent (`prisma/skills`).

**Cons**:
- Không có module Nest chính thức (viết `PrismaService`); không có đặt tên tự động (phải `@map` từng cột) và không có xóa mềm sẵn.
- `CHECK` và chỉ mục duy nhất một phần phải viết SQL tay trong migration (Prisma bỏ qua chúng); chỉ mục GIN phải khai báo trong `schema.prisma`.
- Phải điền `.env` ở lần chạy đầu; không có link công khai.
- Prisma 7 còn mới (đã kiểm chạy được trên NestJS dạng CommonJS).

### Option 2: Giữ MongoDB, chỉ đóng gói bằng Docker

Giữ NestJS và Mongoose, chạy MongoDB trong container (một nút nhưng bật replica set để có giao dịch), cùng cách đóng gói Compose.

**Pros**:
- Giữ nguyên bộ khung Mongoose hiện có.
- Mongo tìm theo khoảng cách bằng chỉ mục `2dsphere` sẵn.

**Cons**:
- Tính toàn vẹn nằm ở tầng ứng dụng (không có khóa ngoại); phải giữ khớp dữ liệu sao chép bằng giao dịch.
- Container Mongo một nút phải được khởi tạo replica set mới có giao dịch, thêm một bước khởi động dễ lỗi.
- Báo cáo thu chi và ràng buộc nhiều bảng khớp với SQL hơn.

### Option 3: Giữ hướng cũ, MongoDB Atlas trên Vercel serverless với Cloudinary

API chạy dạng hàm serverless trên Vercel, dữ liệu ở MongoDB Atlas, ảnh ở Cloudinary, FE chuyển tiếp `/api/*` sang API.

**Pros**:
- Có link công khai gửi được ngay; không vận hành máy chủ; miễn phí ở quy mô demo.

**Cons**:
- Bạn đã bỏ hướng deploy này.
- Khởi động nguội, kết nối DB phải cache, không có tiến trình nền, gói Hobby chỉ cho mục đích phi thương mại.
- Nhiều giả định về Vercel chưa kiểm chứng.

## Rationale

Option 1 khớp các lực quyết định: bạn muốn người dùng chỉ cần Docker, miền dữ liệu đầy quan hệ và sổ giao dịch, và nhóm nhỏ không muốn gánh phần việc giữ khớp dữ liệu sao chép. PostgreSQL bỏ hẳn lớp việc đó, và container hóa thay thế được hết các thành phần đám mây trước đây (Atlas, Vercel, Cloudinary) bằng hai container và một volume. Option 2 giữ được code cũ nhưng giữ nguyên mọi điểm yếu của Mongo với miền này mà mình đã nêu ở bản trước. Option 3 đã bị bạn bỏ.

Có bốn chỗ lựa chọn của bạn khác với đề xuất của mình, và mình giữ đúng lựa chọn của bạn: email giữ Gmail SMTP (mình đề xuất Mailpit), bắt điền `.env` (mình đề xuất giá trị demo có sẵn trong Compose), API từ chối khởi động khi thiếu `MAIL_*` (mình đề xuất vẫn chạy và ghi cảnh báo), và quyền của từng loại tài khoản lưu trong DB để admin chỉnh (mình đề xuất cố định hẳn trong code cho gọn hơn). Cái giá của từng chỗ nằm ở Premise note và ở Consequences của spec tổng và 0006. Các lựa chọn bạn đã chọn đúng theo đề xuất: image `postgres:18` thuần, gói Docker chỉ gồm API và Postgres, đẩy image lên registry công khai, ảnh lưu ổ đĩa trong volume. Thiết kế tìm theo khu vực dựa trên bảng `landmarks` với tâm tìm kiếm là `landmark_id` hoặc `lat` và `lng`, theo ý bạn rằng đó có thể là trường học, nơi làm việc hay nơi mong muốn; phần này đã hoãn khỏi MVP ngày 2026-10-11 và thiết kế được giữ lại ở 0005.

Các quyết định còn lại là mình tự đưa ra thay bạn, bạn xem lại ở bước duyệt spec và đổi nếu muốn: chỉ mở cổng API ở `127.0.0.1` và không mở cổng DB; image `node:24-slim` thay vì Alpine; GitHub Container Registry làm nơi phát hành (theo địa chỉ repo); tự áp migration và seed khi container khởi động; giới hạn tần suất bằng bộ nhớ trong; bỏ sao chép dữ liệu và dùng phép nối; UUID v7 làm khóa chính; `text` kèm `CHECK` thay cho kiểu `enum`; tiền là `integer` đồng Việt Nam; bảng con thay cho mảng nhúng; `search_key` cùng chỉ mục trigram cho tìm tiếng Việt; Testcontainers cho test e2e; dọn token hết hạn lúc ghi thay vì dùng lịch chạy nền; số điện thoại chỉ kiểm trùng giữa các tài khoản đăng bài (kể cả xóa mềm) và người đăng bài không tự đổi số; `compose.override.yaml` cho máy dev. (Hai quyết định về VNPay ở bản trước, cấu hình không bắt buộc và xác nhận qua địa chỉ quay về, đã bỏ cùng VNPay ngày 2026-10-11.)

## Lịch sử quyết định

Trước ngày 2026-10-05, bản đầu của spec này chọn: MongoDB Atlas M0 (Singapore) qua Mongoose 9, API chạy serverless trên Vercel (`api/index.ts`, `vercel.json`), FE chuyển tiếp `/api/*` để cookie refresh cùng origin, ảnh ở Cloudinary, email qua Gmail SMTP, bộ đếm giới hạn tần suất lưu trong MongoDB, token hết hạn bằng chỉ mục TTL, và dữ liệu sao chép lên tin đăng (`location`, `wardCode`, `addressText`, `landlordId`, `landlordActive`) cùng test bất biến. Bản đó cũng bỏ F08 và bảng `schools` khỏi MVP. Cùng ngày, bạn đổi ý định deploy: spec được sửa tại chỗ.

Đã bỏ: MongoDB và Mongoose, Atlas, Vercel và mọi giả định về nó (bảng 12 điểm cũ), Cloudinary, hợp đồng chuyển tiếp `/api/*` ở FE, bộ đếm tần suất lưu trong DB, chỉ mục TTL, replica set cho dev và test, và toàn bộ hợp đồng sao chép dữ liệu. Giữ nguyên: quyết định về đăng nhập (0002), phân quyền động (0003), xử lý lỗi (0004) ở mức ý tưởng, chỉ đổi phần chạm DB. Đảo lại một phần: F08 không còn bị bỏ khỏi thiết kế; ý tưởng tìm theo khu vực được giữ với bảng `landmarks` trung tính, làm hay không tùy tiến độ. Bản MongoDB và Vercel chưa từng được commit vào git, nên lịch sử này là bản ghi duy nhất của nó.

## Thu hẹp phạm vi MVP (2026-10-11)

**Bối cảnh.** Bạn yêu cầu bỏ tính năng duyệt tin và giữ hệ thống ở mức MVP, ưu tiên demo được trước, và sửa mọi file ghi sai phạm vi. Spec cũ còn mang phạm vi của bản chức năng 27 mục (duyệt tin, đẩy tin, quảng cáo, thu chi, xác minh, kiểm tra tại chỗ, VNPay). Mục này ghi các câu hỏi đã hỏi bạn và câu trả lời, để người đọc sau không phải hỏi lại. Kết quả nằm ở mục "Phạm vi MVP" của [index.md](index.md).

| # | Quyết định | Bạn chọn | Phương án còn lại (vì sao không chọn) |
|---|---|---|---|
| 1 | Chủ trọ đăng miễn phí đến đâu | Giữ dùng thử 1 tháng (khác đề xuất của mình là hạn mức miễn phí cố định) | Hạn mức miễn phí cố định không hết hạn: gọn hơn, nhưng bỏ luật một số điện thoại một lần dùng thử đã làm xong. Không có phần miễn phí: tài khoản mới chưa đăng được gì để demo |
| 2 | Cách mua gói trong demo | Thanh toán thử tự ghi nhận (đúng đề xuất) | VNPay sandbox: giống thật hơn nhưng cần tài khoản sandbox, địa chỉ quay về, biến `VNPAY_*` và mạng. Admin gán gói bằng tay: ít việc nhất nhưng không thấy luồng thu tiền |
| 3 | Trạng thái tin sau khi bỏ duyệt | Đăng là hiện ngay như đăng Facebook; admin ẩn được tin của người khác, khóa và mở khóa tài khoản (câu trả lời tự viết của bạn) | Có nháp rồi bấm đăng: thêm một bước và một lần kiểm hạn mức. Chỉ có xóa: bất tiện |
| 4 | Số tầng của tin | Hai tầng, nhà trọ rồi tin phòng, như 0005 (khác đề xuất một tầng của mình) | Một tầng: ít API và bảng hơn nhưng chủ trọ nhập lại địa chỉ cho mỗi tin |
| 5 | Phần ngoài lõi | Thêm lưu phòng yêu thích và theo dõi chủ trọ (khác đề xuất chỉ lõi của mình) | Chỉ lõi: gọn nhất. Thêm báo cáo doanh thu cho admin: bạn không chọn |
| 6 | Chủ trọ tự ẩn và hiện lại tin | Có, tin ẩn không tính hạn mức (đúng đề xuất) | Chỉ xóa mềm: ít trạng thái hơn nhưng muốn lấy lại chỗ phải xóa tin |
| 7 | Hết kỳ dùng thử mà chưa mua gói | Tin tự ẩn khỏi công khai, mua gói là hiện lại (đúng đề xuất) | Giữ hiện, chỉ chặn đăng thêm: yếu về thu tiền vì chủ trọ không có lý do mua để giữ tin |
| 8 | Tìm tin và ảnh | Lọc đơn giản và ảnh tải lên, tối đa 5 ảnh (đúng đề xuất) | Ảnh dán đường dẫn: ít việc hơn nhưng demo giả. Chỉ danh sách mới nhất: mỏng nhất |

**Các quyết định mình tự đưa ra thay bạn** (bạn xem lại và đổi nếu muốn):
- Giữ khóa `tenant` (gọi là "sinh viên" hay "người thuê" là việc của FE), để khỏi đổi khóa trong DB, token và code đã làm.
- Khi admin gỡ ẩn một tin, tin về `hidden_by_owner` thay vì tự hiện, để hạn mức luôn được kiểm lúc chủ trọ bấm hiện. Tin đang bị admin ẩn không tính vào hạn mức và chủ trọ không tự hiện lại được.
- Lượt xem là cột đếm `listings.view_count`, không dùng bảng thống kê theo ngày. Tổng lượt xem của chủ trọ là tổng cột này trên tin của họ.
- Thanh toán thử dùng quyền `order:create` của chủ trọ, không có quyền xác nhận riêng của admin.
- Số ngày và số tin dùng thử là hai khóa trong `settings`: `trial_days` mặc định 30, `trial_listing_limit` mặc định 2 (con số 2 theo scope cũ, "khoảng 1 đến 2 tin"). Admin đổi được, không viết cứng trong code.
- Danh sách công khai có lọc đơn giản (từ khóa, phường, khoảng giá, sắp xếp) làm cùng tính năng đăng tin (hàng 8), không tách hàng riêng.
- Bảng, quyền và biến môi trường của phần hoãn không tạo; thiết kế `landmarks` và tìm theo khu vực giữ lại trong 0005 cho khi cần.

**Cái giá bạn nhận.**
- Thanh toán thử nghĩa là chưa thu được tiền thật. Ý "hạn mức là chỗ thu tiền" chỉ thể hiện được bằng đơn và gói, chưa bằng dòng tiền; ai bấm xác nhận cũng được gói.
- Giữ hai tầng nhà trọ và tin nghĩa là còn khoảng 5 API nhà trọ cùng 3 bảng con, nặng hơn một tầng.
- Giữ dùng thử nghĩa là cần ngày hết hạn dùng thử, luật tin tự ẩn khi hết kỳ, cùng luật một số điện thoại một lần dùng thử đã làm (số điện thoại vẫn chưa xác thực bằng mã, xem 0002).
- Không duyệt trước thì tin vi phạm hiện cho tới khi admin ẩn. Báo cáo tin xấu từ người dùng đã hoãn, nên admin chỉ biết khi tự xem; biện pháp duy nhất là ẩn tin và khóa tài khoản.
- Tài liệu đã sửa nhưng code còn lệch một chỗ: danh mục quyền và quyền mặc định trong migration vẫn chứa các module đã hoãn (xem "Phần code còn lệch" trong `index.md`). Hậu quả chỉ là `GET /permissions` hiện quyền thừa cho tới khi dọn.

## Evidence

### Kiểm tra code hiện có (2026-10-05)

| # | Phát hiện | Vị trí | Vì sao quan trọng |
|---|---|---|---|
| 1 | `POST /auth/register` nhận `roles` từ client, enum có `admin` | `src/users/dto/create-user.dto.ts`, `src/users/users.service.ts` | Ai cũng tự đăng ký thành Admin được; trái BR-01 |
| 2 | Chỉ một access token, `JWT_EXPIRES_IN` mặc định 1 ngày, không refresh, đăng xuất, thu hồi | `src/auth/auth.service.ts`, `src/auth/auth.module.ts` | Token lộ thì dùng được cả ngày |
| 3 | `login` và `JwtStrategy` không kiểm tra `isActive` | `src/auth/auth.service.ts`, `src/auth/strategies/jwt.strategy.ts` | Tài khoản bị khóa vẫn đăng nhập được; trái F01 và BR-12 |
| 4 | `strict` chưa bật, `noImplicitAny: false`; ESLint `no-explicit-any: off`, `no-unsafe-argument: warn` | `tsconfig.json`, `eslint.config.mjs` | Chưa có gì chặn `any` (hiện code chưa có `any`, chỉ có một dấu `!` ở `jwt.strategy.ts`) |
| 5 | Chưa có bộ lọc lỗi toàn cục; biến môi trường không kiểm tra lúc khởi động | `src/main.ts`, `src/app.module.ts` | Sai cấu hình chỉ lộ khi chạy; lỗi không thống nhất |
| 6 | Chưa có helmet, CORS, giới hạn tần suất, health check, Swagger, Dockerfile, CI | toàn repo | Thiếu phần cần cho một bản chạy được trong Docker; mục 10 của spec chức năng yêu cầu giới hạn tần suất |
| 7 | Kết nối DB và người dùng viết trên Mongoose (`MongooseModule`, `user.schema.ts`) | `src/app.module.ts`, `src/users/schemas/user.schema.ts` | Phải thay bằng Prisma; `package.json` đang chứa `@nestjs/mongoose` và `mongoose` |

### Kiểm tra bối cảnh công nghệ (2026-10-05, subagent chạy model nhỏ, số liệu chưa được mình kiểm lại)

| Mục | Kết quả theo báo cáo | Lưu ý |
|---|---|---|
| Lượt tải npm mỗi tuần | Drizzle ORM khoảng 26,0 triệu; Prisma CLI khoảng 19,7 triệu; `@prisma/client` khoảng 18,6 triệu | Lượt tải chung, không tách riêng NestJS |
| Tích hợp trong tài liệu NestJS | liệt kê Drizzle, Prisma, MikroORM, Sequelize và một số ORM khác | Mình chưa tự đọc trang này; Prisma không có gói tích hợp Nest chính thức nên viết một `PrismaService` nhỏ |
| Prisma | bản 7 ổn định; bản `8.0.0-rc.12` ngày 2026-09-24 còn là RC; bỏ engine Rust từ bản 7; không hỗ trợ sẵn chỉ mục duy nhất một phần và kiểu PostGIS | Số phiên bản lấy từ báo cáo |
| PostgreSQL | 18 là bản ổn định mới nhất (ra tháng 9 năm 2025); các tag `postgres:18`, `postgres:18-alpine`, `postgres:18-slim` tồn tại; có sẵn `uuidv7()`; bản 19 mới ở dạng beta | |
| Node.js | 24 là LTS đang hoạt động; tag `node:24-alpine`, `node:24-slim` tồn tại | Repo đang chạy Node 24.18 |
| NestJS | `@nestjs/core` mới nhất theo báo cáo là 12.1.2; repo đang cài 11.2.7 | Nâng cấp là quyết định riêng |

Báo cáo có kèm lưu ý rằng số liệu có thể đã cũ và không trả về đường dẫn cụ thể cho từng mục, nên phần References không ghi liên kết cho chúng.

### Kiểm tra Prisma 7 (2026-10-06, subagent chạy model nhỏ cộng skill chính thức của Prisma)

| Mục | Kết quả | Mức tin |
|---|---|---|
| Phiên bản và yêu cầu | Báo cáo ghi bản 7 mới nhất là 7.10.0 (tháng 8 năm 2026); cần Node `^20.19.0`, `^22.12.0` hoặc `^24.0.0` và TypeScript 5.4 trở lên; bản 8.0 chưa ổn định. Skill `prisma-orm-setup` lại mặc định bản 8 cho app mới | Số phiên bản và tình trạng bản 8 chưa kiểm lại, kiểm khi cài |
| CommonJS | Dùng generator `prisma-client` (không dùng `prisma-client-js`), `output` bắt buộc, tùy chọn `moduleFormat` hỗ trợ cả ESM và CommonJS | Tài liệu và skill `prisma-cli`; đã chạy trong repo |
| Adapter và cấu hình | `@prisma/adapter-pg`; `new PrismaClient({ adapter: new PrismaPg({ connectionString }) })`; `prisma.config.ts` đặt `datasource.url`; mọi ví dụ chính thức đều `import 'dotenv/config'` (Prisma không tự nạp `.env`) | Skill `prisma-orm-setup`; cỡ pool, hạn kết nối, múi giờ phiên đã kiểm chứng trong repo |
| Schema | `@default(dbgenerated("uuidv7()")) @db.Uuid`, `@db.Timestamptz`, `String[]` thành `text[]` dùng được | Báo cáo; đã chạy thử, đúng (cột mảng sinh ra cho phép rỗng, thêm `NOT NULL` bằng tay) |
| Giao dịch và mã lỗi | `$transaction(async (tx) => ...)` với `isolationLevel` (`ReadUncommitted`, `ReadCommitted`, `RepeatableRead`, `Serializable`); `P2034` xung đột ghi hoặc deadlock, `P2025` không thấy, `P2002` trùng giá trị | Trang giao dịch; skill `prisma-client-api` |
| Truy vấn | `omit` loại cột; `$queryRaw<T>` tagged template có kiểu; `$executeRaw` trả số dòng; có cả `$queryRawUnsafe` (nên cấm); `updateMany` trả `count` | Skill `prisma-client-api` |
| Migration | `migrate deploy` chạy được trong `CMD` của image (`npx prisma migrate deploy && node ...`) nên CLI phải có trong image; kiểm lệch bằng `migrate diff --from-config-datasource --to-schema ... --exit-code` | Skill `prisma-cli` |
| Xóa mềm | Không có sẵn; chỉ qua client extension | Báo cáo |
| Đã kiểm chứng trong repo (2026-10-06) | `CHECK` và chỉ mục duy nhất một phần viết tay không bị `migrate diff` báo lệch; chỉ mục GIN không khai báo trong schema bị đòi xóa, khai báo thì sạch; adapter nhận `max`, hạn kết nối, hạn rảnh và `options` đặt múi giờ UTC; không có đặt tên snake_case tự động | Chạy thật trên PostgreSQL 18.1 |
| Chưa kiểm chứng | Chạy `migrate deploy` trong `node:24-slim`, cột `@db.Date`, chỉ mục trigram có được dùng khi tìm, bộ luật ESLint `strictTypeChecked` | Bảng giả định của 0006, dòng 5, 7, 15, 16 |

Số liệu lấy từ báo cáo của subagent chạy model nhỏ; các dòng ghi chưa kiểm chứng là chỗ báo cáo trả `UNVERIFIED` hoặc skill không nói tới. Các dòng "Đã kiểm chứng trong repo" do chạy thật, không lấy từ báo cáo. Việc còn phải kiểm chứng đều nằm trong bảng giả định của 0006 để làm ở lát cắt đầu.

### Công cụ gợi ý đã tìm (Agent Skills và MCP)

- Đã cài trước đó: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`).
- Đã cài lần này theo lựa chọn "chỉ bản của nhà lớn": `supabase-postgres-best-practices` (`supabase/agent-skills`), `multi-stage-dockerfile` (`github/awesome-copilot`), `docker-compose-patterns` (`docker/skills`). Cả ba nằm ở `.agents/skills/` và được liên kết vào `.claude/skills/`.
- Tìm thấy nhưng chưa cài: Neon Postgres, PostgreSQL Table Design, GitHub PostgreSQL Optimization, GitHub PostgreSQL Code Review, các skill Docker cộng đồng (Docker Patterns, Docker Compose Orchestration, Docker Containerization). Chưa có skill đáng tin cho Testcontainers Node.js.
- MCP: lần tìm này không trả về server nào đủ tin cậy cho PostgreSQL, Docker hay Testcontainers.
- Prisma (2026-10-06): repo `prisma/skills` có 10 skill (xác nhận bằng `npx skills add prisma/skills --list`). Đã cài theo lựa chọn của bạn: `prisma-cli`, `prisma-client-api`, `prisma-orm-setup` (ở `.agents/skills/`, nối vào Claude Code). Chưa cài: `prisma-compute`, `prisma-driver-adapter-implementation`, `prisma-mongodb-upgrade`, `prisma-database-setup` (tên cũ đã bị bỏ), cùng các skill Prisma cộng đồng báo cáo tìm được (`prisma-orm-v7-skills`, `prisma-patterns`, `prisma-expert`). Prisma MCP server chính thức (`github.com/prisma/mcp`) được đề xuất, bạn chọn bỏ qua lúc này; con số lượt cài trong báo cáo tìm skill không đáng tin nên không ghi.

## References

**Project sources** (verifiable, in this repo):
- `dactachucnang.md` (spec chức năng): mục 8 về đối tượng dữ liệu, F08, ghi chú về bounding box và PostGIS
- Các spec con 0001 đến 0006 của chính bộ spec này
- Skill đã cài: `nestjs-best-practices`, `supabase-postgres-best-practices` (rule về khóa chính, kiểu dữ liệu, chỉ mục khóa ngoại, chỉ mục một phần), `docker-compose-patterns` (tên `compose.yaml`, healthcheck, `depends_on`, volume có tên, cảnh báo `down -v`), `multi-stage-dockerfile` (giai đoạn dựng và chạy, người dùng không root, `HEALTHCHECK`)
- Bộ khung hiện có ở `src/` và `package.json`
- Skill đã cài ngày 2026-10-06: `prisma-orm-setup`, `prisma-client-api`, `prisma-cli` (`.agents/skills/`), dùng để đối chiếu các điểm của Prisma 7

**Practices & standards**:
- Toàn vẹn quan hệ bằng khóa ngoại thay cho dữ liệu sao chép
- UUID v7 sắp theo thời gian cho khóa chính lộ ra ngoài
- So sánh rồi đổi trong một câu `UPDATE` (compare and swap) cho xoay refresh token
- Ghim phiên bản image, người dùng không root, dựng nhiều giai đoạn
- Migration không phá vỡ theo hai bước (thêm cột cho phép rỗng, chuyển dữ liệu, thêm ràng buộc)
- OWASP: băm mật khẩu bằng argon2id, chống CSRF bằng `SameSite` cộng kiểm tra `Origin`
- RFC 9457 cho dạng lỗi HTTP (spec 0004 chỉ lấy tinh thần; bản rút gọn không theo đủ các trường)

**Links** (web verified only, `sources+links` level only):
- Supabase Postgres Best Practices: https://skills.sh/supabase/agent-skills/supabase-postgres-best-practices (do công cụ tìm kiếm của registry trả về)
- Multi Stage Dockerfile (GitHub): https://skills.sh/github/awesome-copilot/multi-stage-dockerfile (do công cụ tìm kiếm của registry trả về)
- Docker Compose Patterns (Docker): https://skills.sh/docker/skills/docker-compose-patterns (do công cụ tìm kiếm của registry trả về)
- Prisma ORM 7, yêu cầu hệ thống: https://www.prisma.io/docs/orm/v7/reference/system-requirements (subagent báo đã mở; mình chưa tự mở lại)
- Prisma ORM 7, generator `prisma-client` (`output`, `moduleFormat`): https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators (subagent báo đã mở; mình chưa tự mở lại)
- Prisma Client, giao dịch: https://www.prisma.io/docs/orm/prisma-client/queries/transactions (subagent báo đã mở; mình chưa tự mở lại)
- Công thức NestJS với Prisma (`docs.nestjs.com/recipes/prisma`) được nêu tên nhưng chưa ai mở: none verified.
- Các nguồn của phần kiểm tra bối cảnh công nghệ (trang tài liệu NestJS về cơ sở dữ liệu, API lượt tải của npm, ghi chú phát hành PostgreSQL, Docker Hub, lịch phát hành Node.js) được nêu tên nhưng chưa có liên kết nào được ghi lại: none verified.
