# 0006. Đóng gói Docker và phát hành (spec con của 0001 nền móng backend)

**Date**: 2026-10-05

## Summary

Spec con này chốt cách đóng gói hệ thống để người dùng chỉ cần cài Docker rồi chạy trên localhost. Hệ thống gồm hai container: `db` (PostgreSQL 18) và `api` (NestJS). CI dựng image của API và đưa lên GitHub Container Registry; người dùng tải `compose.yaml` cùng `.env.example`, điền `.env`, chạy `docker compose up -d`, rồi mở API ở `http://localhost:3000`. Spec cũng chốt biến môi trường, nơi lưu ảnh, cách gửi email, và một lát cắt đầu tiên chạy trọn từ API tới DB trong Docker để kiểm chứng các giả định trước khi viết tính năng.

## Decision

Đóng gói API thành một image nhiều giai đoạn (multi stage) chạy bằng người dùng không phải root, ghép với image chính thức `postgres:18` bằng Docker Compose. Container API tự áp migration và seed rồi mới nhận request. Image được CI dựng cho `linux/amd64` và `linux/arm64` rồi đưa lên GitHub Container Registry. Mọi cấu hình nằm ở file `.env` do người dùng điền; thiếu hoặc còn giá trị mẫu thì API không khởi động.

**Implementation skills**: `docker-compose-patterns` (`docker/skills`, `.agents/skills/docker-compose-patterns/`) · `multi-stage-dockerfile` (`github/awesome-copilot`, `.agents/skills/multi-stage-dockerfile/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`): rule `conn-pooling` · `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`): rule `devops-use-config-module`, `devops-use-logging`, `micro-use-health-checks`, `security-rate-limiting`.

## Standard definition

**Canonical pattern**:

Hạ tầng:

| Layer | Choice | Reason |
|---|---|---|
| Cơ sở dữ liệu | container `db`, image `postgres:18` (ghim bản nhỏ cụ thể khi kiểm chứng ở lát cắt đầu) | Image chính thức, có sẵn `pg_trgm` và `uuidv7()` |
| API | container `api`, image `ghcr.io/rental-management-platform/rental-api:<phiên bản>` | Một image chạy mọi nơi có Docker; tên image chốt khi dựng pipeline |
| Mạng | mạng mặc định của Compose; chỉ cổng `127.0.0.1:3000` của API mở ra máy chủ, DB không mở cổng | Máy khác trong mạng không vào được; DB chỉ API nói chuyện |
| Lưu trữ | hai volume có tên: `pgdata` (dữ liệu DB) và `uploads` (ảnh) | Dữ liệu sống qua `docker compose down` và nâng cấp image |
| Ảnh | ổ đĩa trong volume `uploads`, sau `StorageService` | Chạy offline, không cần tài khoản ngoài |
| Email | Nodemailer qua Gmail SMTP, sau `MailService` | Bạn chọn giữ Gmail; người chạy tự điền thông tin Gmail |
| CI | GitHub Actions | Kiểm tra mỗi PR, dựng và phát hành image khi gắn tag |
| Log | `nestjs-pino` ra stdout, xem bằng `docker compose logs -f api` | Không thêm dịch vụ nào |

`compose.yaml` (tệp phát hành; minh họa, kiểm chứng khi build):

```yaml
name: rental

services:
  db:
    image: postgres:18
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:?Điền POSTGRES_USER trong .env}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Điền POSTGRES_PASSWORD trong .env}
      POSTGRES_DB: ${POSTGRES_DB:?Điền POSTGRES_DB trong .env}
    volumes:
      - pgdata:/var/lib/postgresql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

  api:
    image: ghcr.io/rental-management-platform/rental-api:${API_TAG:?Điền API_TAG trong .env}
    restart: unless-stopped
    env_file: .env
    environment:
      NODE_ENV: production
      DATABASE_HOST: db
      DATABASE_PORT: "5432"
      DATABASE_USER: ${POSTGRES_USER}
      DATABASE_PASSWORD: ${POSTGRES_PASSWORD}
      DATABASE_NAME: ${POSTGRES_DB}
      UPLOAD_DIR: /data/uploads
    ports:
      - "127.0.0.1:${API_PORT:-3000}:3000"
    volumes:
      - uploads:/data/uploads
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
  uploads:
```

Ghi chú cho file trên:
- Mật khẩu DB đi qua biến riêng (`DATABASE_PASSWORD`), không nhét vào một chuỗi kết nối, để ký tự đặc biệt như `@` hay `/` không làm hỏng việc đọc cấu hình.
- Volume `pgdata` gắn vào `/var/lib/postgresql`, không phải `/var/lib/postgresql/data`, theo cách bố trí thư mục của image PostgreSQL 18 mà mình biết. Đây là giả định cần kiểm chứng (bảng giả định, mục 1).
- `compose.override.yaml` (chỉ có trong repo, không nằm trong gói phát hành) dành cho máy dev: mở `127.0.0.1:5432` của `db` và cho `api` dựng từ mã nguồn (`build: .`).

Image API (`Dockerfile`, nhiều giai đoạn, ghim phiên bản):
- `deps`: `node:24-slim`, `npm ci`. `build`: `npm run build`. `runtime`: `node:24-slim`, `npm ci --omit=dev`, chép `dist` và `docker-entrypoint.sh`, đặt `NODE_ENV=production`, chạy bằng người dùng `node` (không root), thư mục `/data/uploads` thuộc người dùng đó.
- Chọn `node:24-slim` (nền glibc) thay vì Alpine để thư viện gốc như `@node-rs/argon2` và `bcrypt` có sẵn bản dựng sẵn, ít bất ngờ nhất.
- `HEALTHCHECK` dùng chính Node để gọi `http://127.0.0.1:3000/api/v1/health` (image `slim` không có `curl`). Route này gắn `@Public()` (nếu không, guard toàn cục của spec 0003 sẽ chặn nó) và chỉ trả trạng thái, không lộ thông tin cấu hình.
- `.dockerignore` loại `node_modules`, `dist`, `.git`, `.env`, `docs`.
- `docker-entrypoint.sh` (file này bắt buộc xuống dòng kiểu LF): chạy lần lượt `node dist/database/run-migrations.js`, `node dist/database/seed.js`, rồi `exec node dist/main.js` để tín hiệu `SIGTERM` của `docker stop` tới thẳng Node và `enableShutdownHooks` đóng pool kết nối. Bước nào lỗi thì thoát với mã khác 0, container không nhận request.

Cách người dùng chạy (đi vào README):
1. Cài Docker.
2. Tải `compose.yaml` và `.env.example` từ bản phát hành mới nhất trên GitHub Releases (CI đã điền sẵn `API_TAG` khớp với bản phát hành).
3. Đổi tên `.env.example` thành `.env` rồi điền các giá trị bắt buộc (bảng dưới). Chỉ cần Docker để sinh khóa: `docker run --rm node:24-slim node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
4. Chạy `docker compose up -d`. Xem trạng thái bằng `docker compose ps`, log bằng `docker compose logs -f api`.
5. Mở `http://localhost:3000/api/docs` (Swagger). Dừng bằng `docker compose down` (giữ dữ liệu). `docker compose down -v` xóa cả database và ảnh, chỉ dùng khi muốn làm lại từ đầu.

Biến môi trường (nguồn duy nhất, đọc qua `AppConfigService`; thiếu biến bắt buộc, sai định dạng, hoặc còn giá trị mẫu bắt đầu bằng `CHANGE_ME` thì API in danh sách lỗi rồi thoát trước khi kết nối DB):

| Biến | Dùng cho | Mặc định hoặc ví dụ | Bắt buộc | Bí mật |
|---|---|---|---|---|
| `API_TAG`, `API_PORT` | phiên bản image, cổng trên máy chủ (chỉ Compose đọc) | điền sẵn khi phát hành; `3000` | `API_TAG` có | không |
| `POSTGRES_USER`, `POSTGRES_DB` | tạo DB lần đầu (chỉ service `db`) | `rental` | có | không |
| `POSTGRES_PASSWORD` | mật khẩu DB | `CHANGE_ME` | có | **có** |
| `NODE_ENV` | chế độ chạy | `production` (Compose đặt) | có | không |
| `PORT` | cổng trong container | `3000` | không | không |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_NAME` | kết nối DB | Compose đặt `db`, `5432`; máy dev đặt `localhost` | có | không |
| `DATABASE_PASSWORD` | mật khẩu DB cho API | Compose lấy từ `POSTGRES_PASSWORD` | có | **có** |
| `DATABASE_POOL_MAX` | kích thước pool | `10` | không | không |
| `DATABASE_ADMIN_USER`, `DATABASE_ADMIN_PASSWORD` | chỉ cho `npm run db:create` trên máy dev có Postgres cài sẵn (tạo role ứng dụng và database); ứng dụng và Docker không đọc | `postgres`; `CHANGE_ME` | không | mật khẩu: **có** |
| `JWT_ACCESS_SECRET` | ký access token | `CHANGE_ME`, từ 32 ký tự | có | **có** |
| `JWT_ISSUER`, `JWT_AUDIENCE` | claim token | `rental-api`, `rental-web` | không | không |
| `ACCESS_TTL_SECONDS` | hạn access token | `900` | không | không |
| `REFRESH_TTL_DAYS`, `REFRESH_GRACE_SECONDS`, `MAX_SESSIONS_PER_USER` | refresh token | `30`, `10`, `10` | không | không |
| `REFRESH_COOKIE_NAME`, `COOKIE_SECURE` | cookie refresh | `rt`, `false` (localhost dùng http) | không | không |
| `ALLOWED_ORIGINS` | CORS và kiểm tra `Origin` | danh sách origin của FE cách nhau dấu phẩy, ví dụ `http://localhost:5173` | có | không |
| `APP_BASE_URL` | liên kết trong email | địa chỉ FE, ví dụ `http://localhost:5173` | có | không |
| `PASSWORD_RESET_TTL_MINUTES` | hạn liên kết đặt lại | `30` | không | không |
| `TRUST_PROXY_HOPS` | số lớp proxy tin cậy để đọc IP khách | `0` (không có proxy) | không | không |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_FROM` | SMTP | `smtp.gmail.com`, `465`; hai biến sau là địa chỉ Gmail | có | không |
| `MAIL_PASSWORD` | App Password của Gmail | `CHANGE_ME` | có | **có** |
| `UPLOAD_DIR`, `MAX_UPLOAD_BYTES` | thư mục ảnh, dung lượng tối đa mỗi ảnh | `/data/uploads`, `5242880` | không | không |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_NAME` | admin đầu tiên | | có | không |
| `ADMIN_SEED_PASSWORD` | mật khẩu admin đầu tiên (chỉ dùng khi seed) | `CHANGE_ME` | có | **có** |
| `LOG_LEVEL`, `SWAGGER_ENABLED` | log và tài liệu API | `info`, `true` | không | không |

Bỏ các biến cũ: `MONGODB_*`, `CLOUDINARY_*`, `CLIENT_IP_HEADER`, `JWT_SECRET`, `JWT_EXPIRES_IN`. Tham số nghiệp vụ (BR-16) không nằm ở biến môi trường mà ở bảng `settings`. `.env.example` cập nhật theo bảng, giá trị bí mật là `CHANGE_ME`; `.env` đã bị git bỏ qua.

Hợp đồng với FE (FE là repo khác, tự chạy ở cổng riêng trên localhost):
- Origin của FE nằm trong `ALLOWED_ORIGINS` và `APP_BASE_URL`.
- FE gọi API ở `http://localhost:3000/api/v1/...` với `credentials: 'include'`, và dùng host `localhost` cho cả hai bên, không trộn `127.0.0.1` (cookie không đi chéo giữa hai host đó). `localhost` khác cổng vẫn là cùng site, nên cookie `SameSite=Strict` của refresh token hoạt động.
- FE giữ access token trong bộ nhớ, gặp 401 `TOKEN_EXPIRED` thì gọi `POST /api/v1/auth/refresh` rồi thử lại, và có trang `/reset-password` cho liên kết quên mật khẩu.
- Sau này muốn FE cùng origin với API (ví dụ thêm một dịch vụ nginx vào Compose), không cần đổi code API: chỉ đổi `ALLOWED_ORIGINS` và cách FE gọi.

Bảo mật vận hành (đã nằm trong `createApp`): `helmet`, CORS theo `ALLOWED_ORIGINS` kèm `credentials: true`, giới hạn body JSON `100kb`, `trust proxy` theo `TRUST_PROXY_HOPS`, Swagger bật theo `SWAGGER_ENABLED`, bí mật chỉ nằm ở `.env`, log che mật khẩu và token. Container chạy bằng người dùng không root, DB không mở cổng ra ngoài, API chỉ nghe ở `127.0.0.1` của máy chủ.

Giới hạn tần suất: `@nestjs/throttler` dùng bộ nhớ trong (mặc định), đủ vì chỉ có một container API. Bộ đếm về 0 khi container khởi động lại, chấp nhận được. Giới hạn đặt bằng hằng số trong code theo nhóm endpoint (đăng nhập, đăng ký, quên mật khẩu, refresh, liên hệ, báo cáo). Nếu sau này chạy nhiều bản sao thì đổi storage sang Redis mà không đổi nơi gọi.

Email: giao diện `MailService.send(message)` với một hiện thực Nodemailer đọc `MAIL_*`. Lúc khởi động chỉ kiểm tra các biến có mặt và đúng định dạng, không thử đăng nhập SMTP (để chạy được khi mất mạng). Gửi đồng bộ trước khi trả lời (hạn chờ vài giây); lỗi gửi (sai App Password, mất mạng) không làm hỏng yêu cầu mà ghi log mức error. Đổi sang nhà cung cấp khác chỉ cần viết một hiện thực khác.

Lưu ảnh (`StorageService`, hợp đồng; endpoint tải lên do spec tính năng upload quyết định):
- Giao diện `put`, `get`, `delete` theo khóa. Khóa do server sinh dạng `public/<uuid>.<đuôi>` hoặc `private/<uuid>.<đuôi>`, kiểm bằng biểu thức chính quy trước khi chạm ổ đĩa, nên không thể đi ra ngoài `UPLOAD_DIR`.
- Ảnh công khai (ảnh tin) phục vụ ở `GET /api/v1/media/public/:key` với `Cache-Control` dài hạn (khóa không đổi). Ảnh riêng tư (giấy tờ xác minh) không có đường công khai; chỉ endpoint có quyền `verification:review` mới đọc và truyền lại luồng dữ liệu.
- Chỉ nhận JPEG, PNG, WebP, kiểm bằng nội dung tệp (magic bytes) thay vì tin `Content-Type` của client; dung lượng tối đa `MAX_UPLOAD_BYTES`; tối đa 10 ảnh mỗi tin. MVP chưa nén hay đổi kích thước ảnh.

CI/CD (GitHub Actions):
- Mỗi PR: job `check` chạy `npm ci` và `npm run check` (gồm `tsc --noEmit`, `eslint . --max-warnings 0`, `jest`, `nest build`); job `e2e` chạy test với Testcontainers và kiểm tra lệch schema (spec 0005); job `image` dựng image (không đẩy) để bắt lỗi Dockerfile.
- Khi gắn tag `v*`: dựng image đa kiến trúc `linux/amd64` và `linux/arm64` (máy Mac chip Apple dùng bản arm64), đẩy lên GitHub Container Registry, rồi đính `compose.yaml` và `.env.example` (đã điền `API_TAG`) vào GitHub Release. Gói image đặt công khai để người dùng kéo về không cần đăng nhập.
- Nhánh `main` được bảo vệ: chỉ merge khi CI xanh.

**Lát cắt đầu tiên (slice 0), làm trước mọi tính năng** theo Tracer Bullet:
1. `createApp`, `src/main.ts`, cấu hình có kiểu và kiểm tra biến môi trường, `nestjs-pino`, `GET /api/v1/health` có ping DB.
2. `DataSource` của TypeORM, lớp đặt tên, migration đầu tiên (bật `pg_trgm`), `TransactionRunner`, bộ chạy migration và seed.
3. `Dockerfile`, `.dockerignore`, `docker-entrypoint.sh`, `compose.yaml`, `compose.override.yaml`, `.env.example`, `.gitattributes` (giữ `*.sh` xuống dòng LF).
4. Chạy `docker compose up --build` trên máy sạch, gọi health và Swagger, chạy bảng giả định ở dưới và ghi kết quả vào spec này.
5. GitHub Actions xanh (`check`, `e2e`, `image`), bật bảo vệ nhánh `main`.
6. Gắn tag đầu tiên, kiểm tra image kéo về được không cần đăng nhập và chạy được trên máy khác.

**Giả định cần kiểm chứng ở slice 0** (phần lớn là hiểu biết của mình, chưa chạy thử):

| # | Giả định | Cách kiểm | Nếu sai thì |
|---|---|---|---|
| 1 | Image `postgres:18` đòi volume dữ liệu ở `/var/lib/postgresql` | `up`, ghi dữ liệu, `down`, `up`, dữ liệu còn | đổi đường dẫn mount theo tài liệu image |
| 2 | `uuidv7()` làm mặc định khóa chính và TypeORM đọc lại id sau khi chèn | chèn một dòng, đọc id từ entity | sinh UUID v7 ở ứng dụng (gói `uuid`) |
| 3 | `@node-rs/argon2` chạy trong `node:24-slim` trên amd64 và arm64, băm đủ nhanh | gọi hàm băm thử, đo thời gian | quay về `bcrypt` cost 12 |
| 4 | Cookie `Path=/api/v1/auth`, `SameSite=Strict`, `Secure=false` đi đúng giữa `localhost:5173` và `localhost:3000` với `credentials: 'include'` | thử trên Chrome, Firefox, Safari | đổi `SameSite` hoặc đặt FE cùng origin qua nginx |
| 5 | TypeORM 1.x và `@nestjs/typeorm` tương thích NestJS 11.2.x và qua được `strictTypeChecked` với mẫu Repository | cài, dựng một entity và một repository | ghim phiên bản khác, hoặc nới luật cho đúng file bọc |
| 6 | `migration:generate` bỏ qua chỉ mục đánh dấu `synchronize: false` và có cờ kiểm tra lệch | chạy lệnh trên DB đã migrate | dựng kiểm tra lệch bằng cách so `pg_dump --schema-only` |
| 7 | Chỉ mục GIN trigram được dùng cho `LIKE '%từ%'` | `EXPLAIN` trên dữ liệu mẫu vài nghìn tin | dùng `ILIKE` kèm chỉ mục biểu thức, hoặc `tsvector` |
| 8 | Dựng đa kiến trúc trong Actions đủ nhanh, máy chip Apple kéo được bản arm64 | chạy workflow, kéo thử | chỉ phát hành amd64 và dựng arm64 khi cần |
| 9 | Gói GHCR đặt công khai cho phép `docker pull` ẩn danh | kéo từ máy chưa đăng nhập | chuyển sang Docker Hub |
| 10 | Migration lỗi làm container thoát rõ ràng, và API đợi DB khỏe rồi mới chạy | làm hỏng một migration, xem log và mã thoát | chỉnh `docker-entrypoint.sh` |
| 11 | Gmail SMTP cổng 465 gửi được từ container trên Docker Desktop | gửi thử một email | dùng cổng 587 hoặc nhà cung cấp khác |
| 12 | `docker stop` đóng pool kết nối gọn trong 10 giây | dừng khi đang có request | tăng `stop_grace_period` |
| 13 | `docker-entrypoint.sh` chạy được khi repo clone trên Windows | clone trên Windows, dựng image | thêm `.gitattributes` ép LF, hoặc bỏ file script, gọi lệnh trực tiếp trong `CMD` |

**Tiến độ slice 0 (2026-10-05, trên máy dev dùng PostgreSQL 18.1 cài sẵn, thử trên một cụm tạm đã xóa):**
- Đã làm (một phần của mục 1 và 2): kiểm tra biến môi trường bằng lớp `Env` (từ chối giá trị thiếu hoặc còn `CHANGE_ME`, không in giá trị bí mật), `AppConfigService`, `DatabaseModule` và `data-source.ts` của TypeORM, `SnakeNamingStrategy`, migration đầu tiên (bảng `users`), script `db:create` và `db:check`, chuyển `users` và `auth` từ Mongoose sang TypeORM ở mức tối thiểu (cột `roles` tạm), bỏ `@nestjs/mongoose` và `mongoose`. `.env.example` đã cập nhật.
- Chưa làm: `createApp`, pino, health check, `TransactionRunner`, toàn bộ Docker (`Dockerfile`, `compose.yaml`, mục 3), CI (mục 5), phát hành (mục 6).
- Giả định 2 đã kiểm chứng: `uuidv7()` làm mặc định khóa chính chạy, TypeORM đọc lại id sau khi chèn, id là UUID v7.
- Giả định 5 kiểm chứng một phần: TypeORM 1.1.1 và `@nestjs/typeorm` 12.0.2 chạy với NestJS 11.2.7 (build, khởi động, đăng ký, đăng nhập, trùng email trả 409). Chưa thử với `strictTypeChecked` vì ESLint chưa chuyển sang bộ luật chặt.
- Giả định 6 kiểm chứng một phần: `migration:generate --check` hoạt động và phát hiện lệch (đã bắt được lỗi mặc định kiểu mảng). Phần chỉ mục `synchronize: false` chưa thử vì chưa có chỉ mục tùy biến.
- Phát hiện mới (đã ghi ở 0005): TypeORM đọc sai mặc định kiểu mảng; cụm Postgres cài trên Windows mặc định WIN1252 nên database phải tạo riêng bằng UTF8.

**Replaces**:
- Toàn bộ hướng triển khai cũ: `api/index.ts`, `vercel.json`, hàm serverless, hợp đồng chuyển tiếp `/api/*` ở FE, MongoDB Atlas, Cloudinary, bộ đếm tần suất lưu trong DB, các giả định về Vercel (bảng cũ 12 điểm).
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `MONGODB_URI` trong `.env.example`.

**Enforcement**: CI chạy `check`, `e2e`, `image` mỗi PR; `.env` bị `.gitignore`; lớp `Env` từ chối giá trị thiếu hoặc còn `CHANGE_ME`; `compose.yaml` dùng cú pháp `${BIẾN:?thông báo}` nên thiếu biến thì Compose dừng với thông báo rõ.

**Rollout**: slice 0 trước, sau đó mỗi tính năng theo Tracer Bullet mỏng. Muốn đưa lên một máy chủ có địa chỉ công khai sau này: chạy cùng `compose.yaml` ở đó, đặt `COOKIE_SECURE=true` sau lớp HTTPS, cập nhật `ALLOWED_ORIGINS`; code tính năng không đổi.

**Exceptions**: Không có. Nếu giả định 4 sai thì quay lại `/architect` trước khi viết tiếp phần đăng nhập.

## Rationale (ngắn)

Bạn muốn người dùng chỉ cần Docker và chạy trên localhost, nên hạ tầng được thu về đúng hai container, không dịch vụ đám mây nào, không tên miền. Image đưa lên registry công khai để người dùng không cần Git, Node hay mã nguồn; họ chỉ cầm hai tệp. Cổng chỉ mở ở `127.0.0.1` và DB không mở cổng, vì bản này chạy trên máy cá nhân và mật khẩu do chính người dùng đặt. Ảnh lưu trong volume và hộp thư giữ Gmail là hai lựa chọn của bạn; cái giá nằm ở Consequences. Spec chọn `node:24-slim` vì ít rủi ro với thư viện gốc hơn Alpine, và để API tự áp migration khi khởi động vì người dùng không có công cụ nào khác ngoài Docker. Slice 0 đứng trước mọi tính năng vì các điểm rủi ro nhất (đường dẫn volume của Postgres 18, cookie giữa hai cổng, argon2 trong container, chạy trên Windows và chip Apple) chỉ lộ khi chạy thật. Phương án thay thế: dựng image tại máy người dùng bằng `docker compose up --build` (cần Git và chờ vài phút), hoặc gói file nén kèm image xuất sẵn (chạy offline nhưng nặng và làm tay).

## Consequences

**Positive**:
- Người dùng chỉ cần Docker; hệ thống chạy offline (trừ việc gửi email), không tài khoản đám mây, không tên miền.
- Cấu hình một nơi (`.env`), sai thì dừng ngay với thông báo rõ.
- CI chặn lỗi kiểu, lint, schema lệch và lỗi Dockerfile trước khi merge.
- Muốn đưa lên máy chủ công khai sau này chỉ cần chạy cùng `compose.yaml`.

**Negative / tradeoffs**:
- Chạy lần đầu vẫn cần điền `.env`, kể cả App Password của Gmail, nên "chỉ cần tải Docker" chưa đúng hẳn: người nhận bản demo phải được bạn gửi sẵn một file `.env` đã điền, hoặc tự tạo App Password của họ.
- Thiếu `MAIL_*` thì API không khởi động, nên không thể xem thử API khi chưa có thông tin Gmail. Đây là lựa chọn của bạn.
- Không còn link công khai để gửi cho người khác bấm vào; mỗi người phải tự chạy trên máy mình.
- Dữ liệu và ảnh nằm trong volume Docker: không tự sao lưu, `down -v` xóa sạch.
- Ảnh lưu ổ đĩa chưa được nén hay đổi kích thước; API tự lo kiểm tra loại ảnh, dung lượng và quyền đọc ảnh giấy tờ.
- Giới hạn tần suất dùng bộ nhớ trong, không chia sẻ giữa nhiều bản sao.
- Dựng đa kiến trúc làm CI chậm hơn; image mới phải qua đủ job mới phát hành được.
- Cookie phụ thuộc việc FE và API cùng dùng host `localhost`; trộn `127.0.0.1` làm refresh im lặng hỏng.

**Neutral**:
- Gói phát hành gồm đúng hai tệp: `compose.yaml` và `.env.example`; README hướng dẫn năm bước.
- Cần `.gitattributes` để `docker-entrypoint.sh` giữ xuống dòng LF khi clone trên Windows.

## Follow-up

- [ ] Làm slice 0 và điền kết quả cho 13 giả định ở trên; nếu giả định 4 sai thì quay lại `/architect`.
- [ ] Chốt tên image và tên tổ chức GitHub chính xác (`ghcr.io/rental-management-platform/rental-api` là giả định theo địa chỉ repo hiện tại).
- [ ] Viết README cho người dùng (năm bước chạy, sao lưu, phục hồi, cảnh báo `down -v`).
- [ ] Spec tính năng upload ảnh quyết định endpoint tải lên, giới hạn và cách đọc ảnh riêng tư; nén ảnh (ví dụ thư viện `sharp`) làm sau nếu cần.
- [ ] Khi muốn FE cùng origin với API, thêm dịch vụ nginx vào Compose (cần quyết định cách FE đóng thành image).
- [ ] NestJS đang cài là 11.2.7; báo cáo tra web nói đã có bản chính 12. Nâng cấp là một quyết định riêng, kiểm tra tương thích trước.
- [ ] Gói phát hành hiện cần điền thông tin Gmail; nếu muốn người nhận chạy ngay không cần Gmail thì quay lại quyết định về email và về việc bắt buộc `MAIL_*`.
