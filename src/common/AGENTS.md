# Phần dùng chung (`src/common/`)

## Overview

Những thứ mọi module cùng dùng: danh mục quyền và các decorator khai báo route, lỗi, giới hạn tần suất, giao dịch, múi giờ, phân trang, tiện ích văn bản và tệp. Sửa ở đây là sửa quy ước của cả dự án.

## Key files

| File | Owns |
|---|---|
| `auth/permission-catalog.ts` | Danh mục quyền `module:action` có kiểu, kèm `ownerScoped` và `adminActions` |
| `auth/*.decorator.ts`, `auth/route-access.ts` | `@Public`, `@RequirePermissions`, `@AuthenticatedOnly`, `@OptionalAuth`, `@FreshAuth`; đọc khai báo của route |
| `auth/ownership.ts` | `assertOwner`: tài nguyên của người khác bị 403 `NOT_RESOURCE_OWNER`, kể cả admin |
| `errors/` | `ErrorCode` (mã cộng câu tiếng Việt), `AppException` (ném lỗi bằng `AppException(ErrorCode.X)`), bộ lọc lỗi toàn cục (body lỗi một dạng `{ status, code, message, errors?, requestId }`), `createValidationPipe`, `RejectInvalidUuidParam`, `requestIdMiddleware` |
| `persistence/transaction-runner.ts` | `TransactionRunner`: giao dịch ReadCommitted, gặp P2034 thì thử lại tối đa 3 lần; Repository nhận `tx` rõ ràng |
| `rate-limit/` | Bảng `RATE_LIMITS` theo nhóm, `@RateLimited(nhóm)`, `AppThrottlerGuard` |
| `time/` | `APP_TIME_ZONE`, `startOfDay`, `startOfNextDay`, ngày lịch `YYYY-MM-DD` |
| `pagination/`, `text/`, `files/` | `{ items, total, page, pageSize }`, `escapeLike`, `toSearchKey`, `toSlug`, nhận multipart và nhận dạng ảnh |

## Conventions

- Mọi route khai báo đúng một trong `@Public()`, `@RequirePermissions(...)`, `@AuthenticatedOnly()`; thiếu hoặc khai báo hai lần bị từ chối, và test duyệt route bắt lỗi này. `@OptionalAuth()` là `@Public()` cộng cờ nhận biết người đăng nhập, token sai thì coi như khách, không bao giờ 401.
- `module:manage` bao hàm mọi hành động của module. Token gộp thành `manage` khi loại tài khoản có đủ mọi hành động. Module chỉ dành cho admin là module có `adminActions` liệt kê hết hành động. Loại khác `admin` không được cấp `*:manage` hay hành động chỉ admin (400 `PERMISSION_ADMIN_ONLY`).
- Admin giữ `manage` mọi module trong code nên qua guard quyền của mọi route. Việc "admin không được làm điều này" (nhắn tin, đánh giá, theo dõi, lưu tin, mua gói) nằm ở Service, chạy sau pipe, nên id hay body sai vẫn là 400.
- `@FreshAuth()` đọc lại trạng thái và quyền từ database, nên tài khoản vừa bị khóa hay mất quyền bị từ chối ngay dù token còn hạn. Route không có nó chỉ thấy quyền mới ở lần refresh kế tiếp.
- Giới hạn tần suất: mỗi route đếm riêng, không đếm theo nhóm. Bộ đếm là `ip`, `email` hoặc `user` tùy nhóm, nhóm không dùng bộ đếm nào thì bộ đó bị bỏ qua cho route.
- Lỗi mới thì thêm mã vào `ErrorCode` kèm câu tiếng Việt; không dịch lỗi PostgreSQL ra cho FE.
- "Một ngày" luôn là ngày giờ Việt Nam từ `APP_TIME_ZONE`; một ngày là khoảng `[startOfDay, startOfNextDay)`, so chặt `<` ở cận trên.

## Gotchas

- Thêm một hành động vào module đã có làm token cũ mang `manage` bung ra cả hành động mới. Route admin dùng hành động mới bắt buộc `@FreshAuth()`, nếu không chủ trọ mang token cũ đọc được dữ liệu admin (đã gặp ở `order:report` và `statistic:report`).
- Khóa quyền mới cần một migration dữ liệu thêm khóa mặc định cho loại tài khoản, vì seed chạy mỗi lần khởi động và không được ghi đè chỉnh sửa của admin.
- Chỉ `*.repository.ts`, `src/database` và `src/common/persistence` được import giá trị từ Prisma (lint chặn).

## Related specs

[0001 nền móng](../../docs/specs/0001-backend-foundation/index.md) (đặc biệt các spec con 0003 phân quyền, 0004 lỗi và kiểm tra, 0005 quy ước Postgres), [0010](../../docs/specs/0010-admin-order-list-revenue/index.md)

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
