# Database (`src/database/`)

## Overview

Kết nối Prisma, các lệnh tạo và kiểm tra database, seed dữ liệu nền và seed demo. Schema và migration nằm ngoài thư mục này, ở `prisma/schema.prisma` và `prisma/migrations/`; dữ liệu nguồn của danh mục phường ở `prisma/seed-data/`.

## Key files

| File | Owns |
|---|---|
| `prisma.service.ts`, `prisma.module.ts` | Nơi duy nhất tạo kết nối Prisma: adapter `pg`, pool có hạn kết nối, múi giờ phiên UTC |
| `build-database-url.ts`, `load-env.ts` | Dựng URL kết nối và nạp `.env` cho các script |
| `seed.ts` (cùng `seed-catalog.ts`, `seed-settings.ts`, `seed-plans.ts`, `seed-data.ts`) | `npm run seed`: kiểm ba loại tài khoản, thêm phường, tiện ích, tham số dùng thử, gói mẫu còn thiếu, tạo admin đầu tiên |
| `seed-demo.ts` | `npm run seed:demo`: dữ liệu demo cho FE (nội dung ở `demo/`, xem `demo/AGENTS.md`) |
| `scripts/create-database.ts` | `npm run db:create`: tạo role ứng dụng và database UTF8 bằng tài khoản quản trị Postgres |
| `scripts/check-connection.ts` | `npm run db:check`: kiểm kết nối bằng chính tài khoản ứng dụng |
| `scripts/build-ward-bounds.ts`, `scripts/ward-bounds.ts` | Dựng hộp bao tọa độ của 168 phường cho luật tọa độ nhà trọ (spec 0012) |

## Commands

```bash
npm run db:create          # cần DATABASE_ADMIN_USER và DATABASE_ADMIN_PASSWORD, chạy lại an toàn
npm run db:check
npm run migration:deploy   # áp migration; migration:status để xem trạng thái
npm run seed
npm run seed:demo -- --reset
```

## Conventions

- `seed` chỉ thêm dòng còn thiếu và chạy lại nhiều lần vẫn đúng. Nó không bao giờ ghi đè quyền của loại tài khoản, tên danh mục, giá trị tham số hay giá gói, vì admin có thể đã chỉnh.
- Admin đầu tiên chỉ được tạo khi chưa có tài khoản `admin` nào (tính cả tài khoản bị khóa và đã xóa mềm). Nếu `ADMIN_SEED_EMAIL` đã thuộc một tài khoản không phải admin thì seed dừng với thông báo rõ, vì loại tài khoản không đổi được.
- Quyền mặc định của loại tài khoản đi bằng migration của từng tính năng, không đi bằng seed.
- Chỉ nơi này, `*.repository.ts` và `src/common/persistence` được import giá trị từ Prisma; riêng adapter `@prisma/adapter-pg` chỉ dùng ở `src/database` (lint chặn).
- `seed:demo` chỉ đụng tài khoản có email đuôi `@demo.example.com` và cần `npm run seed` chạy trước.

## Gotchas

- Database phải thuộc về role ứng dụng (`db:create` làm đúng việc này). Tạo bằng tay mà quên `ALTER DATABASE ... OWNER TO` thì `migration:deploy` báo `permission denied for schema public`.
- `seed` và `seed:demo` chạy bản đã biên dịch trong `dist/` (script tự `npm run build` trước), không chạy thẳng bằng `ts-node`.
- Hộp bao tọa độ chỉ dựng lại khi dữ liệu phường đổi, không phải lúc cài đặt hay khởi động ứng dụng.

## Related specs

[0001 nền móng](../../docs/specs/0001-backend-foundation/index.md) (spec con 0005 quy ước Postgres), [0002](../../docs/specs/0002-property-listings/index.md), [0012](../../docs/specs/0012-property-coordinate-limits/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
