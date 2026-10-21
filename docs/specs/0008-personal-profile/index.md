# 0008. Hồ sơ cá nhân

**Date**: 2026-10-21
**Status**: Accepted

## Summary

Người đã đăng nhập xem và sửa hồ sơ của chính mình, gồm tên và số điện thoại, bằng hai API `GET /me/profile` và `PATCH /me/profile`. Hai quyền `profile:read` và `profile:update` đã có từ spec 0003 nhưng chưa route nào dùng, nên spec này không thêm bảng, cột hay migration. Chủ trọ được đổi số điện thoại với đúng luật lúc đăng ký (bắt buộc, đúng định dạng, không trùng chủ trọ khác), nên spec này sửa luật cũ "chủ trọ không tự đổi số" của spec 0002 trong nhóm nền móng (đăng nhập). Đổi email, ảnh đại diện và xóa tài khoản để sau.

## Requirements

**User stories**:
- Là người tìm trọ hoặc chủ trọ, tôi muốn xem hồ sơ của mình để biết tên, email và số điện thoại hệ thống đang giữ.
- Là người dùng, tôi muốn sửa tên và số điện thoại để thông tin đúng khi tôi đổi tên hiển thị hay đổi SIM.
- Là chủ trọ, tôi muốn đổi số điện thoại liên hệ của mình mà tin đăng vẫn luôn có một số hợp lệ, không trùng chủ trọ khác.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `GET /me/profile` (quyền `profile:read`) trả 200 hồ sơ của người gọi với đúng bảy trường: `id`, `email`, `name` (có thể null), `phone` (có thể null), `accountType`, `status`, `createdAt`. Không có `passwordHash`, `passwordChangedAt`, `trialEndsAt`, `lockedReason`, `deletedAt`, thông tin phiên hay token ở bất kỳ chỗ nào. Luôn là trạng thái trong database lúc gọi. Có header `Cache-Control: private, no-store`.
- **AC-2**: `PATCH /me/profile` (quyền `profile:update`) nhận body JSON với hai trường tùy chọn `name` và `phone`, trả 200 hồ sơ sau khi sửa cùng bảy trường và cùng header như AC-1. Trường vắng mặt thì giữ nguyên. Body không có trường nào (`{}`) trả 200 hồ sơ hiện tại và không ghi gì (`updated_at` không đổi). `name` được cắt khoảng trắng hai đầu, dài tối đa 100 ký tự (dài hơn là 400 `VALIDATION_FAILED` kèm trường `name`); `name: null`, chuỗi rỗng hay chuỗi toàn khoảng trắng xóa tên (lưu null).
- **AC-3**: Số điện thoại của `tenant` và `admin`. `phone` được chuẩn hóa như lúc đăng ký (bỏ dấu cách, chấm, gạch; đầu `+84` hoặc `84` đổi thành `0`) rồi phải khớp `0` cộng 9 chữ số, đầu số 3, 5, 7, 8 hoặc 9; sai định dạng là 400 `VALIDATION_FAILED` kèm trường `phone` và câu "Số điện thoại không hợp lệ.". `phone: null` xóa số (lưu null); chuỗi rỗng là 400 như lúc đăng ký. Số của `tenant` và `admin` không cần duy nhất và không bị so với số của chủ trọ.
- **AC-4**: Số điện thoại của `landlord`. Chủ trọ không bao giờ có số rỗng: `phone: null` là 400 `VALIDATION_FAILED` kèm trường `phone` và câu "Người đăng bài phải có số điện thoại.", và không ghi gì. Số mới (đã chuẩn hóa, đúng định dạng) phải khác số của mọi chủ trọ khác, kể cả tài khoản đã xóa mềm; trùng thì 409 `PHONE_TAKEN` và không ghi gì, kể cả khi `name` gửi cùng. Gửi lại đúng số hiện tại của chính mình, ở dạng nào cũng được (`+84 912 345 678` cho số `0912345678`), là 200 chứ không phải `PHONE_TAKEN`. Đổi sang số tự do là 200 và số mới có hiệu lực ngay.
- **AC-5**: Chỉ `name` và `phone` sửa được. `email`, `accountType`, `status`, `id`, `roles`, `password`, `passwordHash`, `lockedReason` hay bất kỳ trường lạ nào gửi lên đều bị 400 `VALIDATION_FAILED` kèm tên trường (không bị lờ đi), và sau lời gọi đó hàng `users` không đổi.
- **AC-6**: Mỗi người chỉ xem và sửa hồ sơ của chính mình. Người cần sửa lấy từ token, route không nhận id nào ở đường dẫn hay body. Hai tài khoản A và B: `PATCH` của A chỉ đổi hàng của A, hàng của B giữ nguyên từng cột; gửi `id` của B trong body là 400 theo AC-5.
- **AC-7**: Phân quyền và trạng thái. Không đăng nhập: 401 `TOKEN_MISSING`; token hỏng: 401 `TOKEN_INVALID`. Loại tài khoản không còn quyền (admin gỡ `profile:read` hay `profile:update` qua `PATCH /account-types/...`, có hiệu lực ở lần refresh kế tiếp): 403 `PERMISSION_DENIED`. Tài khoản bị khóa mà token còn hạn: 403 `ACCOUNT_LOCKED` ở cả `GET` và `PATCH`, và `PATCH` không ghi gì. Tài khoản đã xóa mềm: 401 `TOKEN_INVALID`. Cả ba loại `tenant`, `landlord`, `admin` xem và sửa được hồ sơ của chính mình.
- **AC-8**: Đổi hồ sơ không làm gì ngoài việc đổi hai cột. Sau khi chủ trọ đổi tên hay số: `GET /auth/me`, `GET /landlords/:id` (tên) và chi tiết tin của chủ trọ khi người xem đã đăng nhập (số) đều hiện giá trị mới ngay, không cần làm gì thêm; access token và cookie refresh cũ vẫn dùng được; `trial_ends_at`, tin đăng, gói và kỳ dùng thử không đổi.
- **AC-9**: `PATCH /me/profile` thuộc nhóm giới hạn tần suất `profileWrite`: 30 lần mỗi giờ theo người dùng; lần thứ 31 trong cùng giờ là 429 `RATE_LIMITED` kèm header `Retry-After`. `GET /me/profile` không bị giới hạn.

## Decision

**Chosen option**: Option 1: Hai route `GET` và `PATCH /me/profile` trong module `users`, sửa thẳng hai cột `name` và `phone` của bảng `users`

Một `ProfileController` mới trong `src/users/` đọc và sửa hàng `users` của người gọi theo id trong token; `UsersService` giữ luật nghiệp vụ (trạng thái tài khoản, luật số điện thoại của chủ trọ), `UsersRepository` giữ truy vấn. Không bảng, cột, chỉ mục hay migration mới; chỉ mục duy nhất một phần và `CHECK` của số điện thoại chủ trọ có từ spec 0003 vẫn là chốt chặn cuối.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`)

## Feature design

Quy ước chung theo 0001 đến 0007: Repository bọc Prisma, `timestamptz`, cột `snake_case`, lỗi ném bằng `AppException` với mã có sẵn.

**Data model**: không bảng mới, không cột mới, không migration, không chỉ mục mới (mô hình đã được bạn xác nhận). Feature đọc và sửa hàng `users` của người gọi:

| Trường API | Cột `users` | Khi sửa |
|---|---|---|
| `id`, `email`, `accountType`, `status` | `id`, `email`, `account_type`, `status` | chỉ đọc, không bao giờ đổi ở đây |
| `name` | `name` (rỗng được, tối đa 100) | cắt khoảng trắng; `null` hay rỗng sau khi cắt thì lưu null |
| `phone` | `phone` (rỗng được) | chuẩn hóa về `0xxxxxxxxx`; `landlord` bắt buộc và duy nhất giữa các chủ trọ; `tenant` và `admin` tùy chọn, không duy nhất |
| `createdAt` | `created_at` | chỉ đọc |
| không bao giờ trả | `password_hash`, `password_changed_at`, `trial_ends_at`, `locked_reason`, `deleted_at` | ngoài API này |

`updated_at` do Prisma tự cập nhật. Chốt chặn có sẵn ở database: `users_landlord_phone_check` (chủ trọ không có số rỗng) và `users_landlord_phone_unique` (chỉ mục duy nhất một phần theo `phone` cho `account_type = 'landlord'`, tính cả hàng xóa mềm).

**State transitions**: không có.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/me/profile` | GET | không có | 200 hồ sơ bảy trường | `profile:read` | 401 `TOKEN_MISSING`, 401 `TOKEN_INVALID`, 403 `PERMISSION_DENIED`, 403 `ACCOUNT_LOCKED` |
| `/me/profile` | PATCH | body tùy chọn: `name` (chuỗi hoặc null, tối đa 100), `phone` (chuỗi hoặc null) | 200 hồ sơ sau khi sửa | `profile:update`, `@RateLimited('profileWrite')` | 400 `VALIDATION_FAILED`, 409 `PHONE_TAKEN`, 401 `TOKEN_MISSING`, 401 `TOKEN_INVALID`, 403 `PERMISSION_DENIED`, 403 `ACCOUNT_LOCKED`, 429 `RATE_LIMITED` |

Một hồ sơ:

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01",
  "email": "nam@example.com",
  "name": "Nguyễn Văn Nam",
  "phone": "0901234567",
  "accountType": "landlord",
  "status": "active",
  "createdAt": "2026-10-05T03:00:00.000Z"
}
```

Không có mã lỗi mới: dùng `VALIDATION_FAILED`, `PHONE_TAKEN`, `TOKEN_MISSING`, `TOKEN_INVALID`, `PERMISSION_DENIED`, `ACCOUNT_LOCKED`, `RATE_LIMITED` đã có. `GET /auth/me` giữ nguyên.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi**: token (401) → quyền (403 `PERMISSION_DENIED`) → kiểm body (400, ValidationPipe toàn cục) → đọc người gọi trong database (403 `ACCOUNT_LOCKED`, 401 `TOKEN_INVALID`) → luật số điện thoại (400, 409). Giới hạn tần suất (429) chạy ở guard như các route ghi khác. Hệ quả chấp nhận được: tài khoản bị khóa gửi body sai nhận 400, không phải 403.
- **`UpdateProfileDto`**: `name` dùng `@IsOptional()` (cho cả vắng mặt lẫn `null`), `@Trim()`, `@IsString()`, `@MaxLength(100)`. `phone` chỉ kiểm khi có mặt và khác `null` (`@ValidateIf`): `@NormalizePhone()`, `@IsString({ message: 'Số điện thoại không hợp lệ.' })`, `@Matches(PHONE_PATTERN, { message: 'Số điện thoại không hợp lệ.' })`, cùng hàm và mẫu với `RegisterDto`. Trường lạ bị `forbidNonWhitelisted` chặn, nên `email`, `accountType`, `status` bị 400 mà không cần code riêng.
- **`UsersService.updateProfile(userId, dto)`**: (1) đọc người gọi bằng `findById`; không có thì 401 `TOKEN_INVALID`, `status = 'locked'` thì 403 `ACCOUNT_LOCKED`. (2) Không có trường nào trong `dto` thì trả hồ sơ hiện tại, không ghi. (3) `name`: `dto.name?.trim() || null`. (4) `phone` có mặt và người gọi là `landlord`: `null` thì ném `AppException(VALIDATION_FAILED, [{ field: 'phone', message: 'Người đăng bài phải có số điện thoại.' }])`; số khác số hiện tại thì kiểm trùng với chủ trọ khác (bỏ qua hàng của chính người gọi, tính cả xóa mềm), trùng thì 409 `PHONE_TAKEN`. (5) Ghi `name` và `phone` bằng đúng một câu cập nhật có điều kiện (id của người gọi, chưa xóa mềm), nên hoặc cả hai đổi hoặc không gì đổi. Loại tài khoản lấy từ hàng vừa đọc, không từ token.
- **Kiểm trùng bỏ qua chính mình**: hàm `landlordPhoneExistsIncludingDeleted` của spec 0002 nhận thêm id cần bỏ qua (đăng ký không truyền). Chốt chặn cuối vẫn là chỉ mục duy nhất.
- **Header**: `Cache-Control: private, no-store` đặt bằng `@Header` trên cả `GET` và `PATCH`, như `FavoritesController`.
- **Module**: `ProfileController` (`@Controller('me/profile')`) vào `controllers` của `UsersModule`; không đụng `UsersController` (`GET /users`, của admin) hay `AuthController`. Hình dạng trả về là `ProfileResponse` và `toProfileResponse` trong `users.mapper.ts`, tách khỏi `UserResponse` (sáu trường, dùng ở đăng ký, `/auth/me`, khóa và mở khóa) vì có thêm `createdAt`.
- **Giới hạn tần suất**: thêm nhóm `profileWrite` (`user`: 30 lần mỗi giờ) vào `RateLimitGroup` và `RATE_LIMITS`. Chỉ `PATCH` gắn nhóm này.

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| cả hai route | hàng nào được đọc hay sửa | `userId` trong access token (`sub`), không có id nào từ client |
| `GET`, `PATCH` | `id`, `email`, `name`, `phone`, `accountType`, `status` | cột cùng tên của `users` (`account_type`) |
| `GET`, `PATCH` | `createdAt` | cột `created_at` |
| `PATCH` | `name` mới | body `name`, cắt khoảng trắng; rỗng thì null |
| `PATCH` | `phone` mới | body `phone`, qua `normalizePhone` và `PHONE_PATTERN` |
| `PATCH` | người gọi có phải chủ trọ | cột `account_type` của hàng vừa đọc |
| `PATCH` | số mới có bị chủ trọ khác giữ không | truy vấn `users` theo `phone` và `account_type = 'landlord'`, bỏ hàng của người gọi, tính cả xóa mềm |
| `PATCH` | số mới có đổi so với hiện tại không | so với cột `phone` của hàng vừa đọc |
| `GET`, `PATCH` | tài khoản có bị khóa hay đã xóa không | cột `status` và `deleted_at` của hàng vừa đọc |
| `PATCH` | `updated_at` | Prisma `@updatedAt` |
| `PATCH` | bộ đếm giới hạn tần suất | khóa `user` = `userId` trong token (nhóm `profileWrite`) |
| cả hai route | header `Cache-Control` | hằng `private, no-store` |
| cả hai route | người gọi có quyền | `profile:read` hay `profile:update` trong token (đổi quyền có hiệu lực ở lần refresh kế tiếp, spec 0003 AC-10) |

**Key invariants**:
- Chủ trọ không bao giờ có số rỗng: Service chặn bằng 400; `users_landlord_phone_check` là chốt chặn cuối.
- Một số điện thoại chỉ thuộc về một tài khoản `landlord`, kể cả tài khoản đã xóa mềm: kiểm trước trong Service, `users_landlord_phone_unique` là chốt chặn cuối. Đây thay cho vế "`landlord` không tự đổi số" của luật cũ ở spec 0002.
- Chỉ đúng một hàng `users`, hàng của id trong token, bị ghi, và chỉ hai cột `name`, `phone` (cùng `updated_at`).
- `name` và `phone` đổi cùng nhau hoặc không đổi gì: một câu cập nhật, mọi kiểm tra chạy trước nó.
- `account_type`, `status`, `email`, `password_hash` không có đường ghi nào từ route này.
- Số điện thoại được chuẩn hóa và kiểm định dạng bằng đúng `normalizePhone` và `PHONE_PATTERN` của đăng ký.
- Phản hồi chỉ gồm bảy trường do `toProfileResponse` liệt kê; `password_hash` không được đọc cho hai route này.

**Security model**:
- Hai route cần `profile:read` hay `profile:update`. Module `profile` có `ownerScoped: true` và không có hành động chỉ admin, nên `tenant` và `landlord` giữ cả hai theo mặc định và admin giữ qua `manage` (spec 0003). Quyền "chỉ của chính mình" thực hiện bằng cấu trúc: id lấy từ token, không có tham số id nên không cần `assertOwner`.
- Không `@FreshAuth()` và không đòi mật khẩu hiện tại (bạn chọn ngày 2026-10-21). Service đã đọc hàng của người gọi nên khóa hoặc xóa mềm có hiệu lực ngay ở hai route này; quyền bị gỡ có hiệu lực ở lần refresh kế tiếp, như mọi route người dùng khác.
- Dữ liệu cá nhân: email, tên, số điện thoại, nhưng chỉ của chính người gọi. Dự án chưa khai phạm vi tuân thủ riêng. Không ghi tên hay số vào log ngoài những gì lớp log hiện có đã ghi.
- `409 PHONE_TAKEN` lộ rằng một số đang thuộc về một chủ trọ, như ở đăng ký; chỉ tài khoản chủ trọ gọi tới được nhánh này, và bị giới hạn 30 lần mỗi giờ.
- Số điện thoại không được xác thực bằng mã (spec 0002): người dùng có thể nhập số không phải của mình.

**Configuration required**: không có biến môi trường, dịch vụ ngoài, seed hay migration.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: tenant `GET /me/profile`: đúng bảy trường, không có `passwordHash` ở bất kỳ đâu, giá trị khớp hàng thô trong database, có `Cache-Control: private, no-store`; `PATCH` `{ "name": "  Lan  ", "phone": "+84 912.345.678" }` trả `name: "Lan"` và `phone: "0912345678"`, đọc lại và hàng thô đều khớp, `updated_at` đã đổi, verifies **AC-1**, **AC-2**, **AC-3**
- Happy path: tenant `PATCH` `{ "phone": null }` xóa số; `{ "name": "   " }` và `{ "name": null }` xóa tên; `{}` trả 200 và `updated_at` không đổi; admin xem và sửa hồ sơ của chính mình, verifies **AC-2**, **AC-3**, **AC-7**
- Happy path: landlord đổi sang số tự do (kể cả viết `+84 912 345 678`); gửi lại đúng số hiện tại ở hai dạng khác nhau đều 200; tenant đặt số trùng số của một chủ trọ vẫn 200, verifies **AC-3**, **AC-4**
- Failure case: landlord gửi số của chủ trọ khác nên 409 `PHONE_TAKEN`, và `name` gửi cùng không đổi; số của một chủ trọ đã xóa mềm (chèn tay) cũng 409; `phone: null` thì 400 trường `phone` với câu "Người đăng bài phải có số điện thoại."; `phone: ""`, `"12345"`, `"0212345678"`, `name` dài 101 ký tự đều 400 đúng tên trường, và hàng không đổi, verifies **AC-2**, **AC-3**, **AC-4**
- Failure case: body có `email`, `accountType`, `status`, `id`, `password`, `roles` hoặc trường lạ bị 400 kèm đúng tên trường; hàng thô giữ nguyên, verifies **AC-5**
- Failure case: hai chủ trọ cùng lúc đặt cùng một số tự do, lặp mười vòng: không bao giờ có hai hàng giữ cùng số, người thua nhận 409 hoặc 500 (500 là cái giá chấp nhận được, xem Consequences), verifies **AC-4**
- Auth/permission: hai tài khoản A và B, `PATCH` của A không đổi một cột nào của B (so hàng thô trước và sau); khách 401 `TOKEN_MISSING`, token rác 401 `TOKEN_INVALID`; admin gỡ `profile:update` khỏi `tenant` thì sau refresh `PATCH` là 403 `PERMISSION_DENIED` còn `GET` vẫn 200; tài khoản bị khóa với token còn hạn: `GET` và `PATCH` đều 403 `ACCOUNT_LOCKED` và không ghi; tài khoản xóa mềm 401 `TOKEN_INVALID`, verifies **AC-6**, **AC-7**
- Happy path: chủ trọ đổi tên và số rồi `GET /auth/me`, `GET /landlords/:id` và chi tiết một tin của mình (đăng nhập) hiện giá trị mới; access token và cookie refresh cũ vẫn dùng được; `trial_ends_at` và số tin đang hiện không đổi, verifies **AC-8**
- Failure case: 30 lần `PATCH` trong một giờ thành công, lần 31 là 429 `RATE_LIMITED` kèm `Retry-After`; trăm lần `GET` vẫn 200, verifies **AC-9**
- Điều khiển âm (bước kiểm thật, không phải test tự động): bỏ vế "bỏ qua hàng của chính người gọi" ở kiểm trùng; bỏ chặn `phone: null` của chủ trọ; cho mapper chép nguyên hàng. Mỗi thay đổi phải bị đúng kiểm tra tương ứng bắt (gửi lại số của mình bị 409; `phone: null` thành 500 thay vì 400; `passwordHash` xuất hiện trong phản hồi), verifies **AC-1**, **AC-4**

## Build plan

Hướng build theo Skateboard (bản mỏng nhất dùng được trước, rồi mới mở rộng): hai route trên một bảng có sẵn nên một mốc, một lần `/develop`, rồi dừng cho bạn review (khớp ô `Build it` trong scope). Quy tắc tài liệu sống: cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong mốc này.

**Mốc 1: xem và sửa hồ sơ của chính mình**
1. Nhóm giới hạn `profileWrite` (`user`: 30 lần mỗi giờ) trong `src/common/rate-limit/rate-limits.ts`, kèm cập nhật test của bảng giới hạn, satisfies **AC-9**
2. `UpdateProfileDto` (`name` và `phone` như mô tả ở "Quy tắc đầu vào"), `ProfileResponse` và `toProfileResponse` (danh sách trắng bảy trường) trong `users.mapper.ts`, kèm test DTO (tên có khoảng trắng, `null`, rỗng, 101 ký tự; số nhiều dạng, `null`, rỗng, sai định dạng; trường lạ) và test mapper (không có `passwordHash` kể cả khi hàng đầu vào có), satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**
3. `UsersRepository.updateProfile(id, changes)` (một câu cập nhật có điều kiện, id của người gọi và chưa xóa mềm, không lấy `passwordHash`); mở rộng `landlordPhoneExistsIncludingDeleted` nhận id cần bỏ qua (đăng ký không truyền, hành vi cũ giữ nguyên), kèm test Repository, satisfies **AC-2**, **AC-4**, **AC-6**
4. `UsersService.getProfile(userId)` và `updateProfile(userId, dto)` theo từng bước ở "Quy tắc đầu vào" (đọc người gọi, khóa hoặc xóa mềm, không có trường thì không ghi, luật chủ trọ, một câu ghi), kèm test Service cho mọi nhánh (tenant, landlord, admin; số của mình; số trùng; `null`; khóa), satisfies **AC-1** đến **AC-4**, **AC-7**
5. `ProfileController` (`GET`: `@RequirePermissions('profile:read')`; `PATCH`: `@RequirePermissions('profile:update')` và `@RateLimited('profileWrite')`; `@Header('Cache-Control', 'private, no-store')` cả hai) vào `controllers` của `UsersModule`; test duyệt route khai báo quyền chạy lại, satisfies **AC-1**, **AC-2**, **AC-7**, **AC-9**
6. Kiểm thật trên database thử (xem Critical test scenarios: mọi AC, đua hai chủ trọ cùng một số mười vòng, hàng thô trước và sau của tài khoản thứ hai, ba điều khiển âm, đọc lại qua `/auth/me`, `/landlords/:id` và chi tiết tin) và `verify.md`, satisfies **AC-1** đến **AC-9** (riêng **AC-8** chỉ cần kiểm ở bước này, không có code riêng)
7. Tài liệu: Postman folder 21 `Hồ sơ cá nhân` (request cho mọi AC); `api-for-frontend.md` thêm mục 6.35 `Hồ sơ cá nhân`, một dòng trong mục `/auth/me` nói rằng tên và số sửa ở `PATCH /me/profile` rồi gọi lại `/auth/me`, thêm nhóm `profileWrite` vào đoạn giới hạn tần suất, và một mục nhật ký; sửa dòng "chủ trọ không tự đổi số" nếu tài liệu có, satisfies **AC-1** đến **AC-9**

## Consequences

**Positive**:
- Hai route, không bảng, không cột, không migration, không mã lỗi mới, không biến môi trường: gọn đúng tinh thần MVP.
- Đưa hai quyền `profile:read` và `profile:update` đã có vào dùng, nên danh mục quyền không còn khóa chết.
- Tái dùng gần hết thứ có sẵn: `normalizePhone`, `PHONE_PATTERN`, `@NormalizePhone`, `@Trim`, `PHONE_TAKEN`, nhóm giới hạn theo người dùng, `@Header`.
- Người chủ trọ lỡ khai nhầm số hay đổi SIM có đường sửa, thay vì phải nhờ sửa trực tiếp trong database như spec 0002 đã ghi.
- Quyền "chỉ của chính mình" đúng theo cấu trúc: không có tham số id thì không có đường nào chạm hồ sơ người khác.

**Negative / tradeoffs**:
- Số điện thoại không được xác thực bằng mã, nên chủ trọ có thể đặt bất kỳ số nào đúng định dạng, kể cả số của người khác chưa đăng ký. Đổi số trả lại số cũ cho người khác đăng ký, nên một người có thể đổi số liên tục để lấy thêm kỳ dùng thử. Rủi ro này đã có từ lúc đăng ký (số không xác thực), spec này chỉ thêm một đường nữa; bạn đã chấp nhận.
- Số điện thoại của chủ trọ là số liên hệ trên chi tiết mọi tin của họ, kể cả tin đã đăng từ trước. Đổi số là đổi ở mọi tin cùng lúc và không giữ lịch sử số cũ.
- Không đòi mật khẩu để đổi số: access token bị đánh cắp (tối đa 15 phút) có thể đổi số liên hệ của chủ trọ sang số của kẻ trộm. Chủ trọ đổi lại được; giảm nhẹ bằng giới hạn 30 lần mỗi giờ và token ngắn hạn.
- Hai chủ trọ cùng lúc đặt cùng một số tự do: chỉ mục duy nhất chặn bản trùng nhưng người thua nhận 500, không phải 409, vì bộ lọc lỗi không dịch lỗi database (spec 0004). Giống đăng ký; chấp nhận cho demo.
- Không có nhật ký thay đổi hồ sơ: không ai biết số hay tên cũ là gì.
- Tên không có luật nào ngoài độ dài: chủ trọ đặt được tên giống người khác. Tên hiện ở hồ sơ công khai và chi tiết tin; xác thực chủ trọ đã hoãn khỏi MVP.
- Không đổi được email: người mất quyền vào hộp thư không có đường khôi phục ngoài nhờ sửa tay. Đã hoãn có chủ đích, vì dự án chưa có bước xác thực email.
- `GET /auth/me` và `GET /me/profile` trả gần cùng dữ liệu; FE chọn một để dựng màn hồ sơ (xem Follow-up).

**Neutral**:
- Thêm `ProfileController`, `UpdateProfileDto`, `ProfileResponse`, `toProfileResponse`, `getProfile` và `updateProfile` ở Service, `updateProfile` ở Repository, nhóm giới hạn `profileWrite`.
- Access token không mang tên hay số nên không cần cấp lại token sau khi sửa.
- Admin dùng chung route này cho chính mình; số của admin tùy chọn và không duy nhất, như `tenant`.
- Số `0008` không trùng spec nào; thư mục riêng nên không đụng các spec con của 0001.
- Hàng 15 chỉ cần hàng 5 (quyền) và hàng 4 (token); không phụ thuộc hàng nào khác.

## Follow-up

- [ ] Hoãn, thêm lại bằng `/scope` khi cần: đổi email (cần xác thực email mới và quyết định về phiên đăng nhập), ảnh đại diện (dùng lại `StorageService`), xóa tài khoản của chính mình, giới hạn đổi số (ví dụ một lần mỗi 30 ngày), đòi mật khẩu hiện tại khi đổi số, giữ lịch sử số cũ để chặn quay vòng dùng thử, dịch lỗi chỉ mục duy nhất thành 409 `PHONE_TAKEN` khi đua, nhật ký thay đổi hồ sơ, luật cho tên hiển thị.
- [ ] Spec 0002 của nhóm nền móng (`0001-backend-foundation/0002-authentication-tokens.md`) có vế "`landlord` không tự đổi số" ở mục Key invariants. Đã sửa đúng dòng đó trỏ về spec này khi viết spec; phần Security model của 0002 nói "chưa có đường gỡ ngoài sửa số trực tiếp trong DB" cũng cần `/architect` đọc lại sau khi build.
- [ ] Sau khi build, `/sync` ghi hai route `GET` và `PATCH /me/profile` và việc dùng `profile:*` vào spec 0003 (nhóm nền móng) nếu còn lệch.
- [ ] Chọn một nguồn cho FE dựng màn hồ sơ: `GET /me/profile` (bảy trường, có `createdAt`) hay `GET /auth/me` (sáu trường kèm `permissions`); tài liệu FE ghi rõ cả hai.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
