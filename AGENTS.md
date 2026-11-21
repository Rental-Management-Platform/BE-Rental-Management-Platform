# Rental Management Platform (backend)

API backend cho nền tảng cho thuê trọ: chủ trọ đăng tin, người tìm trọ xem tin, admin kiểm duyệt. Đây là bản MVP để demo, thanh toán chỉ là thanh toán thử. FE nằm ở repo riêng.

## Stack

- **Language / Runtime**: TypeScript 5 (`strict`), Node 24, npm
- **Framework**: NestJS 11 trên Express, REST, tiền tố `/api/v1`
- **Database**: PostgreSQL 18, Prisma 7 với `@prisma/adapter-pg` (client sinh ra ở `src/generated/prisma`, git bỏ qua; chưa nâng lên Prisma 8)
- **Key dependencies**: `@nestjs/jwt` cộng Passport JWT, argon2id (`@node-rs/argon2`), `@nestjs/throttler` (bộ nhớ trong), class-validator, nodemailer, multer, Jest 30 (file `*.spec.ts` nằm cạnh code)
- **Docker (từ 2026-11-21)**: `Dockerfile`, `compose.yaml` (db, migrate, api, demo-seed theo profile), mẫu nginx và sao lưu ở `deploy/`, hướng dẫn ở `docs/deployment/`; `/health` có ping DB và helmet đã có
- **Spec 0001 quyết định nhưng chưa có trong code**: CI (hàng 23), `nestjs-pino`, Swagger, Testcontainers

## Build approach

Skateboard (làm bản mỏng nhất dùng được trước, rồi mới mở rộng). Workflow mặc định là Prototype: chỉ `/develop`, bạn tự kiểm bằng tay.

## Commands

```bash
npm install               # tự chạy prisma generate
npm run db:create         # tạo role ứng dụng và database (cần DATABASE_ADMIN_*)
npm run migration:deploy  # áp migration (viết migration mới: npm run migration:dev)
npm run seed              # phường, tiện ích, tham số, gói mẫu, admin đầu tiên (chạy lại an toàn)
npm run seed:demo         # dữ liệu demo cho FE; thêm -- --reset để làm mới
npm run start:dev         # API ở http://localhost:3000/api/v1
npm test                  # Jest; theo vùng: npm test -- src/chat
npx tsc --noEmit          # kiểm kiểu cả file test (npm run build chỉ biên dịch mã nguồn)
npm run lint              # có --fix nên tự sửa file
```

## Specs

Nằm ở `docs/specs/`, mỗi spec là một thư mục `NNNN-title/` (`index.md`, `rationale.md`, `verify.md`). Kế hoạch ở `docs/scope/scope.md`. API cho FE ở `docs/api/api-for-frontend.md`.

## Rules

- Chỉ làm đúng tính năng hoặc bước được nêu trong lệnh. Muốn chạm module khác thì hỏi trước, chưa được đồng ý thì không viết code cho phần đó (xem `docs/scope/scope.md`, mục Giới hạn khi build).
- Lớp dữ liệu: chỉ `*.repository.ts`, `src/database` và `src/common/persistence` được import giá trị từ Prisma (lint chặn). Cấm `$queryRawUnsafe` và `$executeRawUnsafe`. Giao dịch đi qua `TransactionRunner`.
- Mỗi route khai báo đúng một trong `@Public()`, `@RequirePermissions(...)`, `@AuthenticatedOnly()`, và gắn `@RateLimited(nhóm)`. Thêm `@FreshAuth()` khi phải đọc lại quyền từ database.
- Quyền mới: thêm vào `PERMISSION_CATALOG` kèm một migration dữ liệu cấp khóa mặc định cho loại tài khoản (không dùng seed).
- Mỗi request chỉ một đồng hồ `now`, lấy ở controller rồi truyền xuống. "Một ngày" là ngày giờ Việt Nam (`APP_TIME_ZONE`). Không truyền `Date` vào SQL thô, truyền chuỗi ISO có `Z`.
- Quy ước database: id `uuidv7()`, `timestamptz`, tiền là số nguyên đồng, tên `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`.
- Đổi API thì sửa `docs/api/api-for-frontend.md` trong cùng lần làm. Bộ Postman đã bỏ từ 2026-11-16.
- Đây là MVP không chạy thật: đo các ngân sách quy mô, ghi số vào `verify.md` rồi bỏ qua. Phần đúng sai thì kiểm thật đầy đủ.

## Agent skills

- [nestjs-best-practices](.agents/skills/nestjs-best-practices/): `kadajett/agent-nestjs-skills`, mô hình module, DI, bảo mật cho NestJS
- [prisma-client-api](.agents/skills/prisma-client-api/): `prisma/skills`, truy vấn và bộ lọc của Prisma Client
- [prisma-cli](.agents/skills/prisma-cli/): `prisma/skills`, lệnh `prisma migrate`, `generate`, `db`
- [prisma-orm-setup](.agents/skills/prisma-orm-setup/): `prisma/skills`, cài đặt và sửa kết nối Prisma
- [supabase-postgres-best-practices](.agents/skills/supabase-postgres-best-practices/): `supabase/agent-skills`, schema, index, migration và truy vấn Postgres
- [docker-compose-patterns](.agents/skills/docker-compose-patterns/): `docker/skills`, Compose cho hàng 23 (đóng gói)
- [multi-stage-dockerfile](.agents/skills/multi-stage-dockerfile/): `github/awesome-copilot`, Dockerfile nhiều tầng cho hàng 23

## Context files

- [src/common/AGENTS.md](src/common/AGENTS.md): phân quyền, lỗi, giới hạn tần suất, giao dịch, thời gian dùng chung
- [src/auth/AGENTS.md](src/auth/AGENTS.md): đăng ký, đăng nhập, token, phiên, đặt lại mật khẩu
- [src/listings/AGENTS.md](src/listings/AGENTS.md): tin đăng và luật hiển thị công khai (nơi duy nhất)
- [src/orders/AGENTS.md](src/orders/AGENTS.md): đơn mua gói thử, kỳ gói nối tiếp, hạn mức
- [src/database/AGENTS.md](src/database/AGENTS.md): kết nối Prisma, seed nền, script tạo database
- [src/database/demo/AGENTS.md](src/database/demo/AGENTS.md): bộ dữ liệu demo cho FE
- [src/chat/AGENTS.md](src/chat/AGENTS.md): chat giữa người tìm trọ và chủ trọ
- [src/reviews/AGENTS.md](src/reviews/AGENTS.md): đánh giá chủ trọ
- [src/listing-reviews/AGENTS.md](src/listing-reviews/AGENTS.md): đánh giá từng phòng
- [src/statistics/AGENTS.md](src/statistics/AGENTS.md): thống kê của chủ trọ và tổng quan của admin

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
