# 0001. Nền móng backend NestJS và PostgreSQL, đóng gói Docker, cho Rental Management Platform

**Date**: 2026-10-05
**Status**: Accepted

## Structure

Spec tổng gồm 6 spec con. Mỗi spec con đủ để build riêng và có lý giải ngắn bên trong.

- [0001 Cấu trúc dự án và chặn any](0001-project-structure-and-typing.md): cách chia module, các lớp Controller, Service, Repository, hàm `createApp`, cấu hình biên dịch và ESLint cấm `any`, kể cả các chỗ truy vấn thô dễ làm lọt `any`. Hỗ trợ quyết định "gọn gàng, best practice, tuyệt đối không any".
- [0002 Đăng nhập và token](0002-authentication-tokens.md): access token, refresh token xoay vòng bằng một câu `UPDATE` có điều kiện, phiên đăng nhập, quên mật khẩu. Hỗ trợ quyết định "xử lý token refresh và access".
- [0003 Loại tài khoản và phân quyền](0003-authorization-rbac.md): mỗi tài khoản thuộc đúng một trong ba loại (`admin`, `landlord`, `tenant`), loại và quyền của loại lưu ở bảng `account_types`, danh mục quyền theo module và hành động, guard, API để admin chỉnh quyền của từng loại. Hỗ trợ quyết định "mỗi tài khoản một loại, loại quyết định được làm gì".
- [0004 Xử lý lỗi và kiểm tra dữ liệu](0004-error-handling-and-validation.md): một dạng lỗi gọn thống nhất, bộ lọc toàn cục, ValidationPipe, dạng phản hồi. Bản rút gọn: không dịch lỗi PostgreSQL, không luật ESLint cho lỗi. Hỗ trợ quyết định "xử lý lỗi tập trung, validate dữ liệu".
- [0005 Quy ước dữ liệu PostgreSQL](0005-postgres-data-conventions.md): bản đồ bảng, kiểu cột, khóa ngoại và chỉ mục, giao dịch, tìm từ khóa tiếng Việt, tìm theo khu vực, migration, seed. Hỗ trợ quyết định "dùng PostgreSQL và Prisma 7".
- [0006 Đóng gói Docker và phát hành](0006-docker-packaging-and-release.md): Docker Compose gồm `db` và `api`, image trên GitHub Container Registry, biến môi trường, lưu ảnh, email, CI, lát cắt đầu tiên. Hỗ trợ quyết định "người dùng chỉ cần Docker và chạy localhost".

## Summary

Đây là bộ quyết định nền cho API của nền tảng thuê trọ, chốt trước khi làm từng tính năng. API viết bằng NestJS, lưu dữ liệu ở PostgreSQL 18 qua Prisma 7, và được đóng gói bằng Docker Compose gồm hai container (`api` và `db`). Người dùng chỉ cần cài Docker, tải `compose.yaml` cùng `.env.example`, điền file `.env`, chạy `docker compose up -d`, rồi mở API ở `http://localhost:3000`. Đăng nhập dùng access token 15 phút mang sẵn danh sách quyền, cộng refresh token xoay vòng (mỗi lần dùng được đổi sang token mới) nằm trong cookie httpOnly; mỗi tài khoản đăng ký miễn phí và thuộc một loại (người đăng bài, người tìm trọ hoặc admin), quyền của loại là dữ liệu trong DB nên admin chỉnh được mà không sửa code. Thu tiền gói chỉ là demo bằng VNPay sandbox. Mọi lỗi đi qua một bộ lọc toàn cục, dữ liệu vào được kiểm tra bằng class-validator, và `any` bị chặn bởi trình biên dịch, ESLint và CI. Hai điểm cần chú ý: chạy lần đầu vẫn phải điền `.env` (kể cả App Password Gmail), và Prisma 7 còn mới nhưng phần lớn điểm cần kiểm đã kiểm xong (`CHECK` và chỉ mục một phần viết bằng SQL trong migration không bị báo lệch, chỉ mục GIN thì khai báo trong schema), chi tiết ở `rationale.md` và bảng giả định của 0006.

## Decision

**Chosen option**: Option 1: NestJS, PostgreSQL 18 qua Prisma 7, đóng gói Docker Compose chạy localhost, tự xử lý token trên các thư viện chuẩn

Dùng NestJS 11 với PostgreSQL 18 (qua Prisma 7; basis: kiểu sinh tự động hợp luật không any, tài liệu và skill chính thức của Prisma) làm API REST chạy trong container, đóng gói bằng Docker Compose và phát hành image lên GitHub Container Registry, tự xử lý access và refresh token bằng `@nestjs/jwt` và Passport, phân quyền theo loại tài khoản (mỗi tài khoản một loại, quyền của loại lưu trong DB), thanh toán demo bằng VNPay sandbox, và áp dụng sáu spec con như bộ quy ước bắt buộc cho mọi tính năng về sau.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `docker-compose-patterns` (`docker/skills`, `.agents/skills/docker-compose-patterns/`) · `multi-stage-dockerfile` (`github/awesome-copilot`, `.agents/skills/multi-stage-dockerfile/`) · `prisma-orm-setup` (`prisma/skills`, `.agents/skills/prisma-orm-setup/`; mặc định app mới lên Prisma 8, nhưng dự án ghim bản 7) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript 5, `strict` bật, cấm `any` | Yêu cầu "tuyệt đối không any"; xem spec con 0001 |
| Runtime | Node 24 LTS, image `node:24-slim` | Repo đang chạy Node 24; nền glibc ít rủi ro với thư viện gốc |
| Framework | NestJS 11 trên Express | Đã có sẵn trong repo (11.2.7), cấu trúc module rõ, hợp nhóm nhỏ |
| API | REST, tiền tố `/api/v1`, Swagger ở `/api/docs` (bật mặc định) | FE tách repo nên cần hợp đồng API đọc được; REST đủ cho CRUD |
| Primary DB | PostgreSQL 18, image chính thức `postgres:18` | Domain nhiều quan hệ, sổ giao dịch, ràng buộc duy nhất, báo cáo thu chi |
| ORM | Prisma 7 (`prisma`, `@prisma/client`, `@prisma/adapter-pg` cùng driver `pg`, ghim `@7`); schema một file `prisma/schema.prisma`; migration của `prisma migrate` | Bạn chọn: kiểu sinh tự động hợp luật không any |
| Auth | `@nestjs/jwt` cộng Passport JWT, argon2id, refresh token ngẫu nhiên lưu bản băm | Đúng yêu cầu token refresh và access, dùng thành phần đã được kiểm chứng |
| Authorization | Ba loại tài khoản cố định (`account_types`), mỗi tài khoản một loại, quyền của loại lưu trong DB và chọn từ danh mục có kiểu trong code, guard toàn cục | Admin chỉnh được việc mỗi loại làm mà vẫn kiểm tra kiểu lúc biên dịch |
| Validation | class-validator cộng class-transformer, `ValidationPipe` toàn cục | Chuẩn của NestJS, đã cài, tích hợp Swagger |
| Errors | Bộ lọc toàn cục, body lỗi gọn `{ status, code, message, errors?, requestId }`, mã lỗi ổn định; không dịch lỗi PostgreSQL | FE xử lý một kiểu cho mọi lỗi; demo nhỏ nên cắt phần nặng (spec 0004) |
| Rate limiting | `@nestjs/throttler` dùng bộ nhớ trong | Chỉ một container API, khỏi thêm Redis |
| Config | `@nestjs/config`, kiểm tra bằng class-validator lúc khởi động, từ chối giá trị `CHANGE_ME` | Sai cấu hình thì dừng ngay, không có dấu `!` |
| Logging, health | `nestjs-pino` ghi JSON kèm requestId ra stdout; `@nestjs/terminus` cho `/api/v1/health` | `docker compose logs` đọc được; health ping DB, dùng cho `HEALTHCHECK` của Docker |
| File storage | Ổ đĩa trong volume Docker `uploads`, sau `StorageService` | Chạy offline, không cần tài khoản ngoài |
| Email | Nodemailer qua Gmail SMTP, sau `MailService`; `MAIL_*` bắt buộc | Bạn chọn giữ Gmail; đổi nhà cung cấp chỉ sửa một file |
| Payment | VNPay sandbox qua giao diện `PaymentGateway` (demo, không có tiền thật) | Bạn chọn: thu tiền gói bằng cổng thử nghiệm; đổi nhà cung cấp chỉ sửa một file |
| Packaging | Docker Compose: `db` và `api`; cổng API mở ở `127.0.0.1:3000`, DB không mở cổng | Người dùng chỉ cần Docker; máy khác trong mạng không vào được |
| Phát hành | GitHub Actions dựng image `linux/amd64` và `linux/arm64`, đẩy lên GitHub Container Registry khi gắn tag, đính `compose.yaml` và `.env.example` vào Release | Người dùng không cần Git hay Node |
| CI | GitHub Actions kiểm tra mỗi PR: `check`, `e2e`, `image` | Chặn lỗi kiểu, lint, lệch schema và lỗi Dockerfile trước khi merge |
| Dev và test | `compose.override.yaml` mở cổng DB cho máy dev; test e2e dùng Testcontainers với `postgres:18` | Test trên DB thật, không phải giả lập |
| Background jobs | Không dùng | Trạng thái hết hạn đều suy ra khi đọc (spec chức năng mục 6), không cần cron hay hàng đợi |

## Cross child contract

Các hợp đồng chung giữa spec con. Sửa một chỗ thì phải sửa spec con kia.

1. **Payload access token** (0002 và 0003): `{ sub, sid, type, perms, iat, exp, iss, aud }`, kiểu `AccessTokenPayload` khai báo một nơi ở `src/auth/auth.types.ts`. `type` là loại tài khoản (`admin`, `landlord` hoặc `tenant`), không đổi sau khi tạo nên không bao giờ cũ trong token; `perms` là mảng `PermissionKey` lấy từ danh mục quyền của 0003.
2. **Request đã xác thực** (0001, 0002, 0003): kiểu `AuthenticatedRequest` có `user: RequestUser` gồm `userId`, `sessionId`, `accountType`, `permissions`. Decorator `@CurrentUser()` trả về `RequestUser`, không ai đọc `req.user` trực tiếp.
3. **Mã lỗi** (0004 với mọi spec con): mọi `code` nằm trong một enum `ErrorCode` ở `src/common/errors`. Spec con thêm mã mới vào đó, kèm thông điệp (tiếng Việt, đồng nhất với mọi chữ người dùng thấy; riêng `code` giữ tiếng Anh) và status.
4. **Biến môi trường** (mọi spec con): một lớp `Env` có kiểu ở `src/config/env.validation.ts`, đọc qua `AppConfigService`. Bảng đầy đủ nằm ở 0006.
5. **`createApp`** (0001 và 0006): một hàm dựng app (tiền tố, phiên bản, helmet, CORS, pipe, bộ lọc, Swagger) dùng chung cho `src/main.ts` và các test e2e.
6. **Schema và migration** (0005 và 0006): mọi thay đổi schema đi qua `prisma migrate` (file SQL ở `prisma/migrations`), ứng dụng không bao giờ tự đổi schema; container API áp migration rồi seed trước khi nhận request.
7. **Giao dịch** (0001, 0002, 0003, 0005): `TransactionRunner.run(fn: (tx: Prisma.TransactionClient) => Promise<T>)`; Repository nhận `tx?: Prisma.TransactionClient`; tên ràng buộc đặt theo `<bảng>_<cột>_unique` (0004 bản rút gọn chưa dịch lỗi trùng giá trị; tên này để sẵn cho khi mở lại).
8. **IP khách** (0002, 0004, 0006): lấy từ `req.ip` của Express; `TRUST_PROXY_HOPS` mặc định 0 vì không có proxy phía trước. Giới hạn tần suất, phiên đăng nhập và log đều dùng giá trị đó.
9. **Hợp đồng với FE** (0002 và 0006): FE chạy ở origin riêng trên `localhost`, nằm trong `ALLOWED_ORIGINS`, gọi `http://localhost:3000/api/v1` với `credentials: 'include'`, và dùng host `localhost` cho cả hai bên để cookie refresh (`Path=/api/v1/auth`) đi đúng.
10. **Loại tài khoản và số điện thoại** (0002, 0003, 0005): `users.account_type` (khóa ngoại tới `account_types.key`) đặt lúc đăng ký và không đổi; `users.phone` đã chuẩn hóa theo AC-13 của 0002, duy nhất một phần cho `landlord`, và `CHECK` bắt `landlord` phải có số; hằng số `SELF_REGISTER_TYPES` ở 0003 là danh sách duy nhất các loại cho đăng ký công khai.

## Lớp truy cập dữ liệu: Prisma 7

Quy ước cho mọi code truy cập dữ liệu. Chi tiết nằm ở 0001 con (các lớp), 0004 (lỗi), 0005 (dữ liệu) và 0006 (đóng gói, giả định cần kiểm). Giao dịch (`TransactionRunner`) và chạy `prisma migrate deploy` trong container do 0005 và 0006 quy định.

**Quyết định kèm theo**:
- Giữ lớp Repository: Service không gọi Prisma, chỉ được `import type`. (Bạn chọn.)
- Tên: `@@map` và `@map` ghi rõ cho từng model và từng cột. (Bạn chọn.)
- Xóa mềm: lọc rõ trong Repository bằng hàm dùng chung `notDeleted`, không dùng client extension. (Bạn chọn.)
- Generator `prisma-client` với `output = "../src/generated/prisma"` và `moduleFormat = "cjs"` (dự án là CommonJS); thư mục sinh bị git bỏ qua, `prisma generate` chạy ở `postinstall` và `prebuild`. Runner up: để ngoài `src`, bỏ vì `nest build` không biên dịch nó. (Mình chọn.)
- Ghim `@7` cho `prisma`, `@prisma/client`, `@prisma/adapter-pg`. Skill `prisma-orm-setup` mặc định app mới lên bản 8, nên ai dùng agent phải nhắc giữ bản 7. (Mình chọn theo yêu cầu của bạn.)
- Biến kết nối là năm biến `DATABASE_*`; một hàm dùng chung `buildDatabaseUrl(settings)` dựng URL (mật khẩu qua `encodeURIComponent`) cho cả `PrismaService` và `prisma.config.ts`, và `prisma.config.ts` gọi `loadEnvFile()` trước khi đọc biến. Runner up: một biến `DATABASE_URL`, bỏ vì `.env` của bạn đã có năm biến riêng. (Mình chọn.)
- `prisma` nằm ở `dependencies` để image chạy `prisma migrate deploy` trước khi nhận request. Runner up: một service Compose chạy một lần, bỏ vì thêm một thành phần. (Mình chọn; kiểm chứng ở 0006.)

### Requirements

**User stories**:
- Là người viết code, tôi muốn truy vấn có kiểu chính xác sinh từ schema để "tuyệt đối không any" được ORM giữ cho tôi, không chỉ dựa vào luật lint.

**Acceptance criteria**:
- **AC-1**: `prisma/schema.prisma` mô tả bảng `users` (tên `snake_case` bằng `@map`, id mặc định `uuidv7()`, `timestamptz`, `users_email_unique`, `users_status_check`, `roles text[]` tạm thời, `deleted_at`). Một migration `init` áp được lên DB trống; chạy `prisma migrate dev` lần hai và `prisma migrate diff --exit-code` không báo lệch.
- **AC-2**: Chỉ `*.repository.ts`, `src/database/**` và `src/common/persistence/**` được `import` Prisma ở dạng giá trị; Service chỉ `import type`; ESLint chặn vi phạm. Không có `any`; truy vấn thô là tagged template có kiểu hàng cụ thể, không có `$queryRawUnsafe` hay `$executeRawUnsafe`.
- **AC-3**: Không truy vấn nào trả `passwordHash` trừ phương thức tìm theo email dành cho đăng nhập; mọi phương thức khác dùng `omit`.
- **AC-4**: Mọi phương thức đọc `users` loại bản ghi đã xóa mềm qua một hàm `notDeleted`.
- **AC-5**: `.env` có năm biến `DATABASE_*` (`DATABASE_POOL_MAX` là cỡ pool); `npm run db:create` và `npm run db:check` chạy được; có các script `db:generate`, `migration:dev`, `migration:deploy`, `migration:status` và `db:studio`.
- **AC-6**: `CHECK` và chỉ mục duy nhất một phần viết bằng SQL trong migration; chỉ mục GIN trigram khai báo trong `schema.prisma`. Cả ba áp được, và `prisma migrate dev` cùng `prisma migrate diff --exit-code` không đòi xóa chúng; nếu một đối tượng viết tay bị đòi xóa thì dùng cách dự phòng ở 0005 (mục Migration và seed).

## Consequences

**Positive**:
- Mọi tính năng sau dùng chung một cách xử lý lỗi, token, quyền, kiểu dữ liệu nên code đồng nhất, dễ review.
- `any` bị chặn ở ba lớp (trình biên dịch, ESLint, CI), kể cả `any` chui vào từ thư viện hoặc truy vấn thô.
- Sửa được lỗi tự đăng ký Admin và khoảng trống đăng nhập hiện có từ tính năng đầu tiên.
- Toàn vẹn dữ liệu do PostgreSQL đảm bảo (khóa ngoại, duy nhất, `CHECK`); không còn dữ liệu sao chép giữa bảng.
- Người dùng chỉ cần Docker; hệ thống chạy offline (trừ gửi email), không tài khoản đám mây, không tên miền.
- Admin chỉnh được việc mỗi loại tài khoản làm bằng API mà không cần sửa code kiểm tra quyền (chỉ cần quyền đó đã có trong danh mục).

**Negative / tradeoffs**:
- Chạy lần đầu vẫn cần điền `.env` kể cả App Password Gmail, và thiếu `MAIL_*` thì API không khởi động; "chỉ cần tải Docker" chưa đúng hẳn.
- Không còn link công khai để gửi người khác; mỗi người phải tự chạy trên máy mình.
- Prisma kiểm kiểu chặt cho truy vấn thường, nhưng truy vấn thô (`$queryRaw`) vẫn kiểm kiểu lỏng, nên giữ "không any" còn phụ thuộc vào luật lint và hàm bọc cho phần đó (spec con 0001 và 0005).
- Prisma 7 còn mới: `CHECK` và chỉ mục duy nhất một phần phải viết SQL tay trong migration (Prisma bỏ qua chúng nên không báo lệch), chỉ mục GIN phải khai báo trong schema; không có đặt tên tự động (phải `@map` từng cột), không có xóa mềm sẵn, không có module Nest chính thức (viết một `PrismaService` nhỏ).
- Quyền nằm trong access token nên đổi quyền hoặc khóa tài khoản chỉ có hiệu lực tối đa 15 phút với thao tác thường (thao tác nhạy cảm kiểm tra lại DB).
- Dữ liệu và ảnh nằm trong volume Docker: không tự sao lưu, `docker compose down -v` xóa sạch.
- Ảnh lưu ổ đĩa chưa được nén; API tự lo kiểm tra loại ảnh, dung lượng và quyền đọc ảnh giấy tờ.
- Giới hạn tần suất dùng bộ nhớ trong, không chia sẻ giữa nhiều bản sao API.
- Quy ước chặt (strictTypeChecked, repository bắt buộc) làm chậm lúc viết ban đầu và buộc sửa vài file hiện có.
- Mỗi tài khoản một loại: người vừa thuê vừa cho thuê phải dùng hai tài khoản; logic nghiệp vụ dựa vào quyền và chủ sở hữu dữ liệu, không dựa tên loại (trừ quy tắc dùng thử và hạn mức của người đăng bài).
- Thanh toán chỉ là VNPay sandbox, không có tiền thật; số điện thoại chỉ kiểm trùng, không xác thực bằng mã, nên người khác có thể nhập số của mình để chặn mình đăng ký tài khoản đăng bài và người đổi SIM vẫn lấy thêm một lần dùng thử; `409 PHONE_TAKEN` cũng cho biết một số đã đăng ký làm người đăng bài, giảm nhẹ bằng giới hạn tần suất đăng ký theo IP (chấp nhận cho demo).

**Neutral**:
- Cần cập nhật `dactachucnang.md`: F08 vẫn giữ ưu tiên P1 nhưng làm hay không tùy tiến độ; "trường" và "cơ sở" ở F02, F07, F08, mục 8 và 9 đổi thành "địa điểm mốc" (`landmarks`, gồm trường, nơi làm việc, nơi khác); mục 8 thêm bảng `landmarks` và bỏ `provinces`, `schools`, `campuses` riêng.
- Bản chức năng cũ `dactachucnang.md` không còn trong thư mục làm việc (còn ở commit đầu). Hai phần của nó sai với mô hình mới: gói Miễn phí vĩnh viễn 5 tin (F21, F23, BR-22) thành dùng thử có thời hạn, và thu tiền chuyển khoản xác nhận thủ công (F22) thành VNPay sandbox.
- Chi tiết từng tính năng (nhà trọ, tin đăng, tìm kiếm, thanh toán, gói) làm bằng `/architect` riêng, theo quy ước ở đây.
- Muốn có địa chỉ công khai sau này chỉ cần chạy cùng `compose.yaml` trên một máy chủ, đặt `COOKIE_SECURE=true` sau lớp HTTPS.

## Follow-up

- [ ] Chạy `/architect` cho từng tính năng theo thứ tự spec chức năng: nhà trọ và tin đăng (F04, F05, F12), duyệt tin (F06), tìm kiếm (F07), liên hệ và lưu (F11, F13), dùng thử và hạn mức tin, mua gói bằng VNPay sandbox, theo dõi chủ trọ (thay cho F21 đến F23), đẩy tin và nổi bật (F24), báo cáo tài chính (F27), rồi các mục còn lại.
- [ ] Cập nhật `dactachucnang.md` theo mục Neutral ở trên (spec chức năng là tài liệu của bạn, `/architect` không sửa). File này hiện không còn trong thư mục làm việc, nên chỉ cần làm nếu bạn còn giữ một bản.
- [ ] Chưa có `AGENTS.md` cho dự án. Nên có một file ghi stack và các quy ước ở đây để mọi skill sau đọc được (`/audit` sở hữu việc ghi file này). Mục `## Agent skills` nên ghi bốn skill đã cài: `nestjs-best-practices`, `supabase-postgres-best-practices`, `docker-compose-patterns`, `multi-stage-dockerfile`. Mục Declined nên ghi các skill tìm thấy nhưng chưa cài vì bạn chọn chỉ bản của nhà lớn: Neon Postgres, PostgreSQL Table Design, GitHub PostgreSQL Optimization và Code Review, các skill Docker cộng đồng, bảy skill còn lại của `prisma/skills` và ba skill Prisma cộng đồng; chưa tìm được MCP server đáng tin cho PostgreSQL, Docker, Testcontainers. Prisma MCP server chính thức (`github.com/prisma/mcp`) đã được đề xuất và bạn chọn bỏ qua lúc này. Mục `## Agent skills` còn nên ghi thêm ba skill đã cài: `prisma-orm-setup`, `prisma-client-api`, `prisma-cli`.
- [ ] Chưa có `docs/scope/`. Nếu muốn theo dõi các tính năng, chạy `/scope`; khi tính năng có dòng scope trỏ tới spec này thì trạng thái spec sẽ đi theo vòng đời tính năng.
- [ ] Viết lại các file hướng dẫn `*.guide.md` còn lại (model, migration, repository, `TransactionRunner`, seed...) cho khớp phần "Lớp truy cập dữ liệu" ở trên. Chạy `/develop` hoặc nhờ viết lại hướng dẫn khi bạn muốn bắt đầu.
- [ ] Chốt Prisma 8: báo cáo web ghi bản 8 chưa ổn định, nhưng skill `prisma-orm-setup` mặc định bản 8 cho app mới. Dự án ghim bản 7; chuyển sang 8 là quyết định riêng.
- [ ] Lát cắt đầu tiên phải kiểm chứng các giả định còn lại về Docker và PostgreSQL 18 (danh sách ở 0006, mục "Giả định cần kiểm chứng"; phần Prisma 7 đã kiểm xong, trừ `@db.Date`, `strictTypeChecked` và chỉ mục trigram) trước khi viết tính năng.
- [ ] Chốt tên image và tổ chức GitHub chính xác cho GitHub Container Registry (xem 0006).
- [ ] NestJS đang cài là 11.2.7, báo cáo tra web nói đã có bản chính 12; nâng cấp là quyết định riêng.
- [ ] Nguồn dữ liệu 168 phường/xã của TP.HCM cho bước seed chưa được chốt; bạn cần chọn nguồn (file JSON trong repo) trước khi làm F03.
- [ ] Quyết định làm F08 (tìm quanh một địa điểm mốc hoặc một điểm bất kỳ) hay chưa theo tiến độ; khi làm thì viết spec riêng.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
