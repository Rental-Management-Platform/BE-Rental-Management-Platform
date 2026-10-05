# 0001. Nền móng backend NestJS và PostgreSQL, đóng gói Docker: lý giải và các phương án

Đây là hồ sơ quyết định (vì sao), `/develop` không cần đọc. Bản build nằm ở [index.md](index.md).

## Context

> ⚠️ Premise note: Bốn điểm trong hướng đi này có đánh đổi thật, mình nêu rõ để bạn giữ chúng một cách có chủ ý.
> 1. **TypeORM thay cho lựa chọn mình đề xuất.** Bạn hỏi ORM nhiều người dùng nhất với NestJS. Không có số liệu riêng cho NestJS: theo lượt tải npm chung thì Drizzle và Prisma đều cao hơn TypeORM, còn riêng gói tích hợp Nest `@nestjs/typeorm` có khoảng 3,3 triệu lượt mỗi tuần và là gói duy nhất có module Nest chính thức. Mình đề xuất Prisma 7 vì kiểu dữ liệu sinh tự động hợp chữ "tuyệt đối không any" nhất; bạn chọn TypeORM. Cái giá: QueryBuilder và truy vấn thô của TypeORM kiểm kiểu lỏng, nên giữ "không any" phụ thuộc vào các quy tắc và hàm bọc ở spec con 0001 và 0005. Nếu các luật đó thành gánh nặng, nên đổi ORM ngay ở lát cắt đầu, vì càng viết nhiều code thì đổi càng đắt.
> 2. **"Chỉ cần tải Docker" chưa đúng hẳn.** Bạn chọn bắt điền `.env` và để API không khởi động khi thiếu `MAIL_*` (kể cả App Password Gmail). Người nhận bản demo vì vậy phải được bạn gửi sẵn một file `.env` đã điền, hoặc tự tạo thông tin Gmail của họ.
> 3. **Chạy localhost không còn là link công khai.** Mục tiêu cũ "gửi link để người khác bấm vào" được thay bằng "người khác chạy trên máy của họ". Nếu giảng viên cần một đường dẫn để mở, phải chạy cùng `compose.yaml` trên một máy chủ có địa chỉ công khai (spec không cản việc này, xem 0006 phần Rollout).
> 4. **Gói Docker chỉ gồm API và Postgres.** FE là repo riêng, còn trống, nên chưa được đóng gói; người dùng chỉ thấy API và Swagger cho đến khi FE có image của nó. Hợp đồng với FE ở 0006 giữ cho việc gắn FE vào sau này không phải đổi code API.
>
> Ngoài ra, chủ đề này gồm 6 quyết định độc lập. Spec được chia thành một spec tổng và 6 spec con thay vì một file dài.

Sản phẩm là website kết nối thuê trọ cho sinh viên, bản MVP có 27 chức năng, ba nhóm người dùng cùng Admin, xoay quanh vòng lặp: chủ trọ đăng tin, admin duyệt, người thuê tìm và liên hệ, chủ trọ trả phí để tiếp cận nhiều hơn. Giai đoạn này là demo cho giảng viên với khoảng 5 người dùng, không thu tiền thật. FE là một repo tách riêng và hiện còn trống.

Hướng triển khai đã đổi: bạn không còn muốn deploy lên dịch vụ đám mây, mà muốn đóng gói toàn bộ hệ thống bằng Docker để người dùng chỉ cần cài Docker rồi chạy trên localhost. Bạn cũng đổi cơ sở dữ liệu từ MongoDB sang PostgreSQL và muốn dùng ORM phổ biến nhất của NestJS cho việc truy vấn. Bộ khung hiện có chỉ có đăng ký, đăng nhập và RBAC cố định, viết trên Mongoose, với nhiều khoảng trống (xem Evidence). Yêu cầu giữ nguyên: xử lý token refresh và access, xử lý lỗi tập trung, kiểm tra dữ liệu đầu vào, tuyệt đối không dùng `any`, cấu trúc NestJS gọn gàng theo best practice.

Miền dữ liệu có những đặc điểm quyết định cách làm: sổ giao dịch cần toàn vẹn và chống ghi trùng; nhiều ràng buộc duy nhất; báo cáo doanh thu, chi phí và KPI; tìm kiếm văn bản tiếng Việt có dấu; vị trí nhà trọ và nhu cầu tìm quanh một điểm (trường, nơi làm việc hay nơi bất kỳ); nhiều trạng thái suy ra từ thời điểm thay vì lưu; và quyền hạn sẽ thay đổi theo thời gian khi có vai trò mới. Người chạy hệ thống có thể dùng Windows, macOS chip Intel hoặc chip Apple, và không có công cụ nào ngoài Docker.

Nếu không chốt nền móng trước, mỗi tính năng sẽ tự đặt cách báo lỗi, cách giữ phiên, cách kiểm quyền và kiểu dữ liệu riêng; `any` sẽ lan dần; và các vướng mắc khi đóng gói (đường dẫn dữ liệu, kiến trúc chip, xuống dòng của script) chỉ lộ ra ở cuối, lúc sửa tốn nhất.

## Options considered

### Option 1: NestJS, PostgreSQL 18 qua TypeORM, đóng gói Docker Compose chạy localhost

Hai container (`api`, `db`), image API đưa lên GitHub Container Registry, người dùng tải `compose.yaml` và `.env.example`, điền `.env` rồi `docker compose up`. Đăng nhập tự xử lý bằng `@nestjs/jwt` và Passport.

**Pros**:
- Miền quan hệ được DB đảm bảo (khóa ngoại, ràng buộc, nối bảng, giao dịch); bỏ hẳn dữ liệu sao chép và các test giữ khớp.
- Chạy offline, không tài khoản đám mây, không tên miền; chạy được trên bất kỳ máy nào có Docker.
- TypeORM có module Nest chính thức, hỗ trợ sẵn chỉ mục duy nhất một phần và xóa mềm.

**Cons**:
- Kiểm kiểu lỏng ở QueryBuilder và truy vấn thô; phải có luật lint và hàm bọc.
- Phải điền `.env` ở lần chạy đầu; không có link công khai.
- Phải viết lại bộ khung hiện có (Mongoose sang TypeORM).

### Option 2: Giữ MongoDB, chỉ đóng gói bằng Docker

Giữ NestJS và Mongoose, chạy MongoDB trong container (một nút nhưng bật replica set để có giao dịch), cùng cách đóng gói Compose.

**Pros**:
- Giữ nguyên bộ khung Mongoose hiện có.
- Mongo tìm theo khoảng cách bằng chỉ mục `2dsphere` sẵn.

**Cons**:
- Tính toàn vẹn nằm ở tầng ứng dụng (không có khóa ngoại); phải giữ khớp dữ liệu sao chép bằng giao dịch.
- Container Mongo một nút phải được khởi tạo replica set mới có giao dịch, thêm một bước khởi động dễ lỗi.
- Báo cáo thu chi và ràng buộc nhiều bảng khớp với SQL hơn.

### Option 3: PostgreSQL với Prisma 7 thay cho TypeORM

Mọi thứ như Option 1 nhưng ORM là Prisma.

**Pros**:
- Kiểu dữ liệu sinh tự động, hợp luật "tuyệt đối không any" nhất; lượt tải chung cao hơn TypeORM.
- Migration trong Docker chỉ là `prisma migrate deploy`.

**Cons**:
- Chỉ mục duy nhất một phần và kiểu PostGIS phải viết SQL thô trong migration.
- Không có module Nest chính thức; phải viết một `PrismaService` nhỏ theo hướng dẫn của NestJS.
- Bản 8 còn ở dạng RC, nên dùng bản 7.

### Option 4: Giữ hướng cũ, MongoDB Atlas trên Vercel serverless với Cloudinary

API chạy dạng hàm serverless trên Vercel, dữ liệu ở MongoDB Atlas, ảnh ở Cloudinary, FE chuyển tiếp `/api/*` sang API.

**Pros**:
- Có link công khai gửi được ngay; không vận hành máy chủ; miễn phí ở quy mô demo.

**Cons**:
- Bạn đã bỏ hướng deploy này.
- Khởi động nguội, kết nối DB phải cache, không có tiến trình nền, gói Hobby chỉ cho mục đích phi thương mại.
- Nhiều giả định về Vercel chưa kiểm chứng.

## Rationale

Option 1 khớp các lực quyết định: bạn muốn người dùng chỉ cần Docker, miền dữ liệu đầy quan hệ và sổ giao dịch, và nhóm nhỏ không muốn gánh phần việc giữ khớp dữ liệu sao chép. PostgreSQL bỏ hẳn lớp việc đó, và container hóa thay thế được hết các thành phần đám mây trước đây (Atlas, Vercel, Cloudinary) bằng hai container và một volume. Option 2 giữ được code cũ nhưng giữ nguyên mọi điểm yếu của Mongo với miền này mà mình đã nêu ở bản trước. Option 4 đã bị bạn bỏ. Option 3 chỉ khác Option 1 ở ORM và là chỗ lựa chọn của bạn khác đề xuất của mình, được ghi ở Premise note 1.

Có bốn chỗ lựa chọn của bạn khác với đề xuất của mình, và mình giữ đúng lựa chọn của bạn: ORM là TypeORM (mình đề xuất Prisma 7), email giữ Gmail SMTP (mình đề xuất Mailpit), bắt điền `.env` (mình đề xuất giá trị demo có sẵn trong Compose), và API từ chối khởi động khi thiếu `MAIL_*` (mình đề xuất vẫn chạy và ghi cảnh báo). Cái giá của từng chỗ nằm ở Premise note và ở Consequences của spec tổng và 0006. Các lựa chọn bạn đã chọn đúng theo đề xuất: image `postgres:18` thuần, gói Docker chỉ gồm API và Postgres, đẩy image lên registry công khai, ảnh lưu ổ đĩa trong volume. Thiết kế tìm theo khu vực dựa trên bảng `landmarks` với tâm tìm kiếm là `landmark_id` hoặc `lat` và `lng`, theo ý bạn rằng đó có thể là trường học, nơi làm việc hay nơi mong muốn, và làm hay không tùy tiến độ.

Các quyết định còn lại là mình tự đưa ra thay bạn, bạn xem lại ở bước duyệt spec và đổi nếu muốn: chỉ mở cổng API ở `127.0.0.1` và không mở cổng DB; image `node:24-slim` thay vì Alpine; GitHub Container Registry làm nơi phát hành (theo địa chỉ repo); tự áp migration và seed khi container khởi động; giới hạn tần suất bằng bộ nhớ trong; bỏ sao chép dữ liệu và dùng phép nối; UUID v7 làm khóa chính; `text` kèm `CHECK` thay cho kiểu `enum`; tiền là `integer` đồng Việt Nam; bảng con thay cho mảng nhúng; `search_key` cùng chỉ mục trigram cho tìm tiếng Việt; Testcontainers cho test e2e; dọn token hết hạn lúc ghi thay vì dùng lịch chạy nền; `compose.override.yaml` cho máy dev.

## Lịch sử quyết định

Trước ngày 2026-10-05, bản đầu của spec này chọn: MongoDB Atlas M0 (Singapore) qua Mongoose 9, API chạy serverless trên Vercel (`api/index.ts`, `vercel.json`), FE chuyển tiếp `/api/*` để cookie refresh cùng origin, ảnh ở Cloudinary, email qua Gmail SMTP, bộ đếm giới hạn tần suất lưu trong MongoDB, token hết hạn bằng chỉ mục TTL, và dữ liệu sao chép lên tin đăng (`location`, `wardCode`, `addressText`, `landlordId`, `landlordActive`) cùng test bất biến. Bản đó cũng bỏ F08 và bảng `schools` khỏi MVP. Cùng ngày, bạn đổi ý định deploy: spec được sửa tại chỗ.

Đã bỏ: MongoDB và Mongoose, Atlas, Vercel và mọi giả định về nó (bảng 12 điểm cũ), Cloudinary, hợp đồng chuyển tiếp `/api/*` ở FE, bộ đếm tần suất lưu trong DB, chỉ mục TTL, replica set cho dev và test, và toàn bộ hợp đồng sao chép dữ liệu. Giữ nguyên: quyết định về đăng nhập (0002), phân quyền động (0003), xử lý lỗi (0004) ở mức ý tưởng, chỉ đổi phần chạm DB. Đảo lại một phần: F08 không còn bị bỏ khỏi thiết kế; ý tưởng tìm theo khu vực được giữ với bảng `landmarks` trung tính, làm hay không tùy tiến độ. Bản MongoDB và Vercel chưa từng được commit vào git, nên lịch sử này là bản ghi duy nhất của nó.

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
| 7 | Kết nối DB và người dùng viết trên Mongoose (`MongooseModule`, `user.schema.ts`) | `src/app.module.ts`, `src/users/schemas/user.schema.ts` | Phải thay bằng TypeORM; `package.json` đang chứa `@nestjs/mongoose` và `mongoose` |

### Kiểm tra bối cảnh công nghệ (2026-10-05, subagent chạy model nhỏ, số liệu chưa được mình kiểm lại)

| Mục | Kết quả theo báo cáo | Lưu ý |
|---|---|---|
| Lượt tải npm mỗi tuần | Drizzle ORM khoảng 26,0 triệu; Prisma CLI khoảng 19,7 triệu; `@prisma/client` khoảng 18,6 triệu; TypeORM khoảng 6,6 triệu; `@nestjs/typeorm` khoảng 3,3 triệu | Lượt tải chung, không tách riêng NestJS |
| Tích hợp trong tài liệu NestJS | liệt kê TypeORM, Drizzle, Prisma, MikroORM, Sequelize | Mình chưa tự đọc trang này; chỉ có `@nestjs/typeorm` là gói tích hợp chắc chắn tồn tại |
| Prisma | bản 7 ổn định; bản `8.0.0-rc.12` ngày 2026-09-24 còn là RC; bỏ engine Rust từ bản 7; không hỗ trợ sẵn chỉ mục duy nhất một phần và kiểu PostGIS | Số phiên bản lấy từ báo cáo |
| TypeORM | bản `1.1.1`; bản 1.0 đầu tiên ra tháng 6 năm 2026; `@nestjs/typeorm` `12.0.2`; hoạt động bảo trì tốt (575 PR gộp năm 2025) | Số phiên bản lấy từ báo cáo; kiểm lại khi cài |
| PostgreSQL | 18 là bản ổn định mới nhất (ra tháng 9 năm 2025); các tag `postgres:18`, `postgres:18-alpine`, `postgres:18-slim` tồn tại; có sẵn `uuidv7()`; bản 19 mới ở dạng beta | |
| Node.js | 24 là LTS đang hoạt động; tag `node:24-alpine`, `node:24-slim` tồn tại | Repo đang chạy Node 24.18 |
| NestJS | `@nestjs/core` mới nhất theo báo cáo là 12.1.2; repo đang cài 11.2.7 | Nâng cấp là quyết định riêng |

Báo cáo có kèm lưu ý rằng số liệu có thể đã cũ và không trả về đường dẫn cụ thể cho từng mục, nên phần References không ghi liên kết cho chúng.

### Công cụ gợi ý đã tìm (Agent Skills và MCP)

- Đã cài trước đó: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`).
- Đã cài lần này theo lựa chọn "chỉ bản của nhà lớn": `supabase-postgres-best-practices` (`supabase/agent-skills`), `multi-stage-dockerfile` (`github/awesome-copilot`), `docker-compose-patterns` (`docker/skills`). Cả ba nằm ở `.agents/skills/` và được liên kết vào `.claude/skills/`.
- Tìm thấy nhưng chưa cài: Neon Postgres, PostgreSQL Table Design, GitHub PostgreSQL Optimization, GitHub PostgreSQL Code Review, ba skill TypeORM cộng đồng (mindrally, vong3432, jeremylongshore), các skill Docker cộng đồng (Docker Patterns, Docker Compose Orchestration, Docker Containerization). Chưa có skill đáng tin cho Testcontainers Node.js.
- MCP: lần tìm này không trả về server nào đủ tin cậy cho PostgreSQL, TypeORM, Docker hay Testcontainers.

## References

**Project sources** (verifiable, in this repo):
- `dactachucnang.md` (spec chức năng): mục 8 về đối tượng dữ liệu, F08, ghi chú về bounding box và PostGIS
- Các spec con 0001 đến 0006 của chính bộ spec này
- Skill đã cài: `nestjs-best-practices`, `supabase-postgres-best-practices` (rule về khóa chính, kiểu dữ liệu, chỉ mục khóa ngoại, chỉ mục một phần), `docker-compose-patterns` (tên `compose.yaml`, healthcheck, `depends_on`, volume có tên, cảnh báo `down -v`), `multi-stage-dockerfile` (giai đoạn dựng và chạy, người dùng không root, `HEALTHCHECK`)
- Bộ khung hiện có ở `src/` và `package.json`

**Practices & standards**:
- Toàn vẹn quan hệ bằng khóa ngoại thay cho dữ liệu sao chép
- UUID v7 sắp theo thời gian cho khóa chính lộ ra ngoài
- So sánh rồi đổi trong một câu `UPDATE` (compare and swap) cho xoay refresh token
- Ghim phiên bản image, người dùng không root, dựng nhiều giai đoạn
- Migration không phá vỡ theo hai bước (thêm cột cho phép rỗng, chuyển dữ liệu, thêm ràng buộc)
- OWASP: băm mật khẩu bằng argon2id, chống CSRF bằng `SameSite` cộng kiểm tra `Origin`
- RFC 9457 cho dạng lỗi HTTP

**Links** (web verified only, `sources+links` level only):
- Supabase Postgres Best Practices: https://skills.sh/supabase/agent-skills/supabase-postgres-best-practices (do công cụ tìm kiếm của registry trả về)
- Multi Stage Dockerfile (GitHub): https://skills.sh/github/awesome-copilot/multi-stage-dockerfile (do công cụ tìm kiếm của registry trả về)
- Docker Compose Patterns (Docker): https://skills.sh/docker/skills/docker-compose-patterns (do công cụ tìm kiếm của registry trả về)
- Các nguồn của phần kiểm tra bối cảnh công nghệ (trang tài liệu NestJS về cơ sở dữ liệu, API lượt tải của npm, ghi chú phát hành PostgreSQL, Docker Hub, lịch phát hành Node.js) được nêu tên nhưng chưa có liên kết nào được ghi lại: none verified.
