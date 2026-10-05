# 0001. Nền móng backend NestJS và PostgreSQL, đóng gói Docker, cho Rental Management Platform

**Date**: 2026-10-05
**Status**: Accepted

## Structure

Spec tổng gồm 6 spec con. Mỗi spec con đủ để build riêng và có lý giải ngắn bên trong.

- [0001 Cấu trúc dự án và chặn any](0001-project-structure-and-typing.md): cách chia module, các lớp Controller, Service, Repository, hàm `createApp`, cấu hình biên dịch và ESLint cấm `any`, kể cả các chỗ TypeORM dễ làm lọt `any`. Hỗ trợ quyết định "gọn gàng, best practice, tuyệt đối không any".
- [0002 Đăng nhập và token](0002-authentication-tokens.md): access token, refresh token xoay vòng bằng một câu `UPDATE` có điều kiện, phiên đăng nhập, quên mật khẩu. Hỗ trợ quyết định "xử lý token refresh và access".
- [0003 Phân quyền động](0003-authorization-rbac.md): vai trò lưu trong DB (bảng `roles` và `user_roles`), danh mục quyền theo module và hành động, guard, API quản lý vai trò. Hỗ trợ quyết định "tạo vai trò mới và tự chọn quyền".
- [0004 Xử lý lỗi và kiểm tra dữ liệu](0004-error-handling-and-validation.md): một dạng lỗi thống nhất, bộ lọc toàn cục (kể cả đổi mã lỗi của PostgreSQL), ValidationPipe, dạng phản hồi. Hỗ trợ quyết định "xử lý lỗi tập trung, validate dữ liệu".
- [0005 Quy ước dữ liệu PostgreSQL](0005-postgres-data-conventions.md): bản đồ bảng, kiểu cột, khóa ngoại và chỉ mục, giao dịch, tìm từ khóa tiếng Việt, tìm theo khu vực, migration, seed. Hỗ trợ quyết định "dùng PostgreSQL và TypeORM".
- [0006 Đóng gói Docker và phát hành](0006-docker-packaging-and-release.md): Docker Compose gồm `db` và `api`, image trên GitHub Container Registry, biến môi trường, lưu ảnh, email, CI, lát cắt đầu tiên. Hỗ trợ quyết định "người dùng chỉ cần Docker và chạy localhost".

## Summary

Đây là bộ quyết định nền cho API của nền tảng thuê trọ, chốt trước khi làm từng tính năng. API viết bằng NestJS, lưu dữ liệu ở PostgreSQL 18 qua TypeORM, và được đóng gói bằng Docker Compose gồm hai container (`api` và `db`). Người dùng chỉ cần cài Docker, tải `compose.yaml` cùng `.env.example`, điền file `.env`, chạy `docker compose up -d`, rồi mở API ở `http://localhost:3000`. Đăng nhập dùng access token 15 phút mang sẵn danh sách quyền, cộng refresh token xoay vòng (mỗi lần dùng được đổi sang token mới) nằm trong cookie httpOnly; quyền là dữ liệu trong DB nên sau này tạo vai trò mới được. Mọi lỗi đi qua một bộ lọc toàn cục, dữ liệu vào được kiểm tra bằng class-validator, và `any` bị chặn bởi trình biên dịch, ESLint và CI. Hai điểm cần chú ý: chạy lần đầu vẫn phải điền `.env` (kể cả App Password Gmail), và TypeORM kiểm kiểu lỏng hơn một số ORM khác nên phải dựa vào luật lint, chi tiết ở `rationale.md`.

## Decision

**Chosen option**: Option 1: NestJS, PostgreSQL 18 qua TypeORM, đóng gói Docker Compose chạy localhost, tự xử lý token trên các thư viện chuẩn

Dùng NestJS 11 với PostgreSQL 18 (qua TypeORM) làm API REST chạy trong container, đóng gói bằng Docker Compose và phát hành image lên GitHub Container Registry, tự xử lý access và refresh token bằng `@nestjs/jwt` và Passport, phân quyền động theo vai trò lưu trong DB, và áp dụng sáu spec con như bộ quy ước bắt buộc cho mọi tính năng về sau.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `docker-compose-patterns` (`docker/skills`, `.agents/skills/docker-compose-patterns/`) · `multi-stage-dockerfile` (`github/awesome-copilot`, `.agents/skills/multi-stage-dockerfile/`)

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript 5, `strict` bật, cấm `any` | Yêu cầu "tuyệt đối không any"; xem spec con 0001 |
| Runtime | Node 24 LTS, image `node:24-slim` | Repo đang chạy Node 24; nền glibc ít rủi ro với thư viện gốc |
| Framework | NestJS 11 trên Express | Đã có sẵn trong repo (11.2.7), cấu trúc module rõ, hợp nhóm nhỏ |
| API | REST, tiền tố `/api/v1`, Swagger ở `/api/docs` (bật mặc định) | FE tách repo nên cần hợp đồng API đọc được; REST đủ cho CRUD |
| Primary DB | PostgreSQL 18, image chính thức `postgres:18` | Domain nhiều quan hệ, sổ giao dịch, ràng buộc duy nhất, báo cáo thu chi |
| ORM | TypeORM 1.x với `@nestjs/typeorm` và driver `pg`; migration của TypeORM, `synchronize` tắt | Bạn chọn; có module Nest chính thức, hỗ trợ sẵn chỉ mục duy nhất một phần và xóa mềm |
| Auth | `@nestjs/jwt` cộng Passport JWT, argon2id, refresh token ngẫu nhiên lưu bản băm | Đúng yêu cầu token refresh và access, dùng thành phần đã được kiểm chứng |
| Authorization | Vai trò trong DB (`roles`, `user_roles`), danh mục quyền viết trong code có kiểu, guard toàn cục | Tạo vai trò mới được mà vẫn kiểm tra kiểu lúc biên dịch |
| Validation | class-validator cộng class-transformer, `ValidationPipe` toàn cục | Chuẩn của NestJS, đã cài, tích hợp Swagger |
| Errors | Bộ lọc toàn cục, dạng lỗi theo tinh thần RFC 9457, mã lỗi ổn định, đổi mã lỗi PostgreSQL | FE xử lý một kiểu cho mọi lỗi |
| Rate limiting | `@nestjs/throttler` dùng bộ nhớ trong | Chỉ một container API, khỏi thêm Redis |
| Config | `@nestjs/config`, kiểm tra bằng class-validator lúc khởi động, từ chối giá trị `CHANGE_ME` | Sai cấu hình thì dừng ngay, không có dấu `!` |
| Logging, health | `nestjs-pino` ghi JSON kèm requestId ra stdout; `@nestjs/terminus` cho `/api/v1/health` | `docker compose logs` đọc được; health ping DB, dùng cho `HEALTHCHECK` của Docker |
| File storage | Ổ đĩa trong volume Docker `uploads`, sau `StorageService` | Chạy offline, không cần tài khoản ngoài |
| Email | Nodemailer qua Gmail SMTP, sau `MailService`; `MAIL_*` bắt buộc | Bạn chọn giữ Gmail; đổi nhà cung cấp chỉ sửa một file |
| Packaging | Docker Compose: `db` và `api`; cổng API mở ở `127.0.0.1:3000`, DB không mở cổng | Người dùng chỉ cần Docker; máy khác trong mạng không vào được |
| Phát hành | GitHub Actions dựng image `linux/amd64` và `linux/arm64`, đẩy lên GitHub Container Registry khi gắn tag, đính `compose.yaml` và `.env.example` vào Release | Người dùng không cần Git hay Node |
| CI | GitHub Actions kiểm tra mỗi PR: `check`, `e2e`, `image` | Chặn lỗi kiểu, lint, lệch schema và lỗi Dockerfile trước khi merge |
| Dev và test | `compose.override.yaml` mở cổng DB cho máy dev; test e2e dùng Testcontainers với `postgres:18` | Test trên DB thật, không phải giả lập |
| Background jobs | Không dùng | Trạng thái hết hạn đều suy ra khi đọc (spec chức năng mục 6), không cần cron hay hàng đợi |

## Cross child contract

Các hợp đồng chung giữa spec con. Sửa một chỗ thì phải sửa spec con kia.

1. **Payload access token** (0002 và 0003): `{ sub, sid, perms, iat, exp, iss, aud }`, kiểu `AccessTokenPayload` khai báo một nơi ở `src/auth/auth.types.ts`. `perms` là mảng `PermissionKey` lấy từ danh mục quyền của 0003.
2. **Request đã xác thực** (0001, 0002, 0003): kiểu `AuthenticatedRequest` có `user: RequestUser` gồm `userId`, `sessionId`, `permissions`. Decorator `@CurrentUser()` trả về `RequestUser`, không ai đọc `req.user` trực tiếp.
3. **Mã lỗi** (0004 với mọi spec con): mọi `code` nằm trong một enum `ErrorCode` ở `src/common/errors`. Spec con thêm mã mới vào đó, kèm thông điệp tiếng Việt và status.
4. **Biến môi trường** (mọi spec con): một lớp `Env` có kiểu ở `src/config/env.validation.ts`, đọc qua `AppConfigService`. Bảng đầy đủ nằm ở 0006.
5. **`createApp`** (0001 và 0006): một hàm dựng app (tiền tố, phiên bản, helmet, CORS, pipe, bộ lọc, Swagger) dùng chung cho `src/main.ts` và các test e2e.
6. **Schema và migration** (0005 và 0006): mọi thay đổi schema đi qua migration của TypeORM ở `src/database/migrations`, `synchronize` luôn tắt; container API áp migration rồi seed trước khi nhận request.
7. **Giao dịch** (0001, 0002, 0003, 0005): `TransactionRunner.run(fn: (manager: EntityManager) => Promise<T>)`; Repository nhận `manager?: EntityManager`; tên ràng buộc đặt theo `<bảng>_<cột>_unique` để 0004 đổi lỗi trùng giá trị đúng mã.
8. **IP khách** (0002, 0004, 0006): lấy từ `req.ip` của Express; `TRUST_PROXY_HOPS` mặc định 0 vì không có proxy phía trước. Giới hạn tần suất, phiên đăng nhập và log đều dùng giá trị đó.
9. **Hợp đồng với FE** (0002 và 0006): FE chạy ở origin riêng trên `localhost`, nằm trong `ALLOWED_ORIGINS`, gọi `http://localhost:3000/api/v1` với `credentials: 'include'`, và dùng host `localhost` cho cả hai bên để cookie refresh (`Path=/api/v1/auth`) đi đúng.

## Consequences

**Positive**:
- Mọi tính năng sau dùng chung một cách xử lý lỗi, token, quyền, kiểu dữ liệu nên code đồng nhất, dễ review.
- `any` bị chặn ở ba lớp (trình biên dịch, ESLint, CI), kể cả `any` chui vào từ thư viện hoặc truy vấn thô.
- Sửa được lỗi tự đăng ký Admin và khoảng trống đăng nhập hiện có từ tính năng đầu tiên.
- Toàn vẹn dữ liệu do PostgreSQL đảm bảo (khóa ngoại, duy nhất, `CHECK`); không còn dữ liệu sao chép giữa bảng.
- Người dùng chỉ cần Docker; hệ thống chạy offline (trừ gửi email), không tài khoản đám mây, không tên miền.
- Vai trò mới tạo được bằng API mà không cần sửa code kiểm tra quyền (chỉ cần quyền đó đã có trong danh mục).

**Negative / tradeoffs**:
- Chạy lần đầu vẫn cần điền `.env` kể cả App Password Gmail, và thiếu `MAIL_*` thì API không khởi động; "chỉ cần tải Docker" chưa đúng hẳn.
- Không còn link công khai để gửi người khác; mỗi người phải tự chạy trên máy mình.
- TypeORM kiểm kiểu lỏng hơn ở QueryBuilder và truy vấn thô, nên giữ "không any" phụ thuộc vào luật lint và hàm bọc (spec con 0001 và 0005). TypeORM 1.0 mới ra tháng 6 năm 2026 theo kết quả tra web chưa kiểm lại.
- Quyền nằm trong access token nên đổi quyền hoặc khóa tài khoản chỉ có hiệu lực tối đa 15 phút với thao tác thường (thao tác nhạy cảm kiểm tra lại DB).
- Dữ liệu và ảnh nằm trong volume Docker: không tự sao lưu, `docker compose down -v` xóa sạch.
- Ảnh lưu ổ đĩa chưa được nén; API tự lo kiểm tra loại ảnh, dung lượng và quyền đọc ảnh giấy tờ.
- Giới hạn tần suất dùng bộ nhớ trong, không chia sẻ giữa nhiều bản sao API.
- Quy ước chặt (strictTypeChecked, repository bắt buộc) làm chậm lúc viết ban đầu và buộc sửa vài file hiện có.
- Nhiều vai trò mỗi tài khoản đổi BR-01 trong spec chức năng; logic nghiệp vụ phải dựa vào quyền và chủ sở hữu dữ liệu, không dựa tên vai trò.

**Neutral**:
- Cần cập nhật `dactachucnang.md`: BR-01 (nhiều vai trò); F08 vẫn giữ ưu tiên P1 nhưng làm hay không tùy tiến độ; "trường" và "cơ sở" ở F02, F07, F08, mục 8 và 9 đổi thành "địa điểm mốc" (`landmarks`, gồm trường, nơi làm việc, nơi khác); mục 8 thêm bảng `landmarks` và bỏ `provinces`, `schools`, `campuses` riêng.
- Chi tiết từng tính năng (nhà trọ, tin đăng, tìm kiếm, thanh toán, gói) làm bằng `/architect` riêng, theo quy ước ở đây.
- Muốn có địa chỉ công khai sau này chỉ cần chạy cùng `compose.yaml` trên một máy chủ, đặt `COOKIE_SECURE=true` sau lớp HTTPS.

## Follow-up

- [ ] Chạy `/architect` cho từng tính năng theo thứ tự spec chức năng: nhà trọ và tin đăng (F04, F05, F12), duyệt tin (F06), tìm kiếm (F07), liên hệ và lưu (F11, F13), thanh toán và gói (F21 đến F24), báo cáo tài chính (F27), rồi các mục còn lại.
- [ ] Cập nhật `dactachucnang.md` theo mục Neutral ở trên (spec chức năng là tài liệu của bạn, `/architect` không sửa).
- [ ] Chưa có `AGENTS.md` cho dự án. Nên có một file ghi stack và các quy ước ở đây để mọi skill sau đọc được (`/audit` sở hữu việc ghi file này). Mục `## Agent skills` nên ghi bốn skill đã cài: `nestjs-best-practices`, `supabase-postgres-best-practices`, `docker-compose-patterns`, `multi-stage-dockerfile`. Mục Declined nên ghi các skill tìm thấy nhưng chưa cài vì bạn chọn chỉ bản của nhà lớn: Neon Postgres, PostgreSQL Table Design, GitHub PostgreSQL Optimization và Code Review, ba skill TypeORM cộng đồng, các skill Docker cộng đồng; chưa tìm được MCP server đáng tin cho PostgreSQL, TypeORM, Docker, Testcontainers.
- [ ] Chưa có `docs/scope/`. Nếu muốn theo dõi các tính năng, chạy `/scope`; khi tính năng có dòng scope trỏ tới spec này thì trạng thái spec sẽ đi theo vòng đời tính năng.
- [ ] Lát cắt đầu tiên phải kiểm chứng các giả định về Docker, PostgreSQL 18 và TypeORM (danh sách ở 0006, mục "Giả định cần kiểm chứng") trước khi viết tính năng.
- [ ] Chốt tên image và tổ chức GitHub chính xác cho GitHub Container Registry (xem 0006).
- [ ] NestJS đang cài là 11.2.7, báo cáo tra web nói đã có bản chính 12; nâng cấp là quyết định riêng.
- [ ] Nguồn dữ liệu 168 phường/xã của TP.HCM cho bước seed chưa được chốt; bạn cần chọn nguồn (file JSON trong repo) trước khi làm F03.
- [ ] Quyết định làm F08 (tìm quanh một địa điểm mốc hoặc một điểm bất kỳ) hay chưa theo tiến độ; khi làm thì viết spec riêng.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
