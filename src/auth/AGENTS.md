# Xác thực (`src/auth/`)

## Overview

Đăng ký, đăng nhập, làm mới token, đăng xuất, "tôi là ai", quên và đổi mật khẩu. Phân quyền theo loại tài khoản nằm ở `src/common/auth/` và `src/account-types/`, thư mục này chỉ cấp và kiểm token.

## Key files

| File | Owns |
|---|---|
| `auth.service.ts` | Điều phối đăng ký, đăng nhập, xoay vòng token, đăng xuất, `me` |
| `token.service.ts` | Cấp token: access là JWT HS256 ngắn hạn; refresh là chuỗi ngẫu nhiên 256 bit, chỉ lưu bản băm SHA-256 |
| `auth-sessions.repository.ts` | Phiên đăng nhập: một dòng mỗi phiên, giữ bản băm token hiện hành và token liền trước (cho ân hạn), `sid` là id phiên trong access token |
| `password.service.ts`, `password-hasher.ts` | Băm argon2id, đổi mật khẩu, đặt lại mật khẩu qua email |
| `password-resets.repository.ts` | Token đặt lại mật khẩu, cùng cách làm với refresh: chỉ lưu bản băm |
| `guards/` | `jwt-auth.guard.ts` (xác thực không đọc database), `permissions.guard.ts`, `origin.guard.ts` |
| `refresh-cookie.ts` | Đặt và xóa cookie refresh |

## Conventions

- Access token mang `sub`, loại tài khoản (`type`) và quyền (`perms`). Guard xác thực không đọc database; `@FreshAuth()` mới đọc lại người dùng và quyền.
- Refresh token xoay vòng, nằm trong cookie (`REFRESH_COOKIE_NAME`, mặc định `rt`), database chỉ giữ bản băm. Dùng lại token liền trước trong ân hạn `REFRESH_GRACE_SECONDS` thì chỉ cấp lại access token và giữ nguyên cookie; ngoài ân hạn là dấu hiệu bị đánh cắp. Tối đa `MAX_SESSIONS_PER_USER` phiên mỗi người.
- Mỗi lần refresh đọc lại người dùng từ database, nên khóa và xóa mềm có hiệu lực tại đó, và quyền mới của loại tài khoản vào token từ lần refresh kế tiếp.
- Đăng ký chỉ chọn `tenant` hoặc `landlord` (`admin` do seed tạo). Chủ trọ nhận `trial_ends_at` tính từ `now` do controller lấy; số điện thoại của chủ trọ là bắt buộc và duy nhất.
- `OriginGuard` chống CSRF cho hai route chạy bằng cookie (`/auth/refresh`, `/auth/logout`): có header `Origin` mà không nằm trong `ALLOWED_ORIGINS` thì bị chặn. Gắn bằng `@UseGuards` trên đúng hai route, không đăng ký toàn cục.
- Quên mật khẩu và đăng xuất luôn "thành công" với người dùng, không lộ email có tồn tại hay cookie có hợp lệ. Mỗi route có giới hạn tần suất riêng theo IP, và theo email ở `login` và `forgot-password`.

## Gotchas

- Giá trị thô của refresh token và token đặt lại mật khẩu chỉ đi ra cookie hoặc email một lần: không lưu, không log. Không log mật khẩu hay bản băm ở bất kỳ đâu.
- `@Public()` không có nghĩa là bỏ qua đăng nhập ở mọi route: dùng `@OptionalAuth()` khi route công khai vẫn cần biết người xem là ai.

## Related specs

[0001 nền móng](../../docs/specs/0001-backend-foundation/index.md), đặc biệt spec con 0002 (token) và 0003 (phân quyền); [0003 dùng thử](../../docs/specs/0003-free-trial-listing-quota/index.md) cho kỳ dùng thử lúc đăng ký

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
