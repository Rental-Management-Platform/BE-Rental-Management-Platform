# 0003. Phân quyền động (spec con của 0001 nền móng backend)

**Date**: 2026-10-05

## Summary

Spec con này chốt cách phân quyền theo vai trò (RBAC, mỗi vai trò là một bộ quyền). Vai trò là dữ liệu trong DB, mỗi vai trò chọn nhiều quyền theo từng module và hành động (xem, tạo, sửa, xóa, hoặc `manage` là toàn quyền module). Một tài khoản có thể có nhiều vai trò, quyền là hợp của chúng, và quyền được ghi sẵn trong access token. Admin tạo được vai trò mới bằng API ngay trong MVP, kèm các chốt chặn tự nâng quyền.

## Requirements

**User stories**:
- Là admin, tôi muốn tạo vai trò mới và chọn mỗi module vai trò đó được xem, sửa, xóa hay toàn quyền, để giao việc cho người khác mà không sửa code.
- Là admin, tôi muốn gán nhiều vai trò cho một tài khoản, để một người đảm nhiệm nhiều việc.
- Là chủ trọ, tôi muốn chỉ sửa được dữ liệu của chính mình, để không ai sửa nhầm hay phá dữ liệu của tôi.
- Là admin, tôi muốn khóa tài khoản vi phạm và buộc họ đăng nhập lại, để chặn thiệt hại nhanh.

**Acceptance criteria**:
- **AC-1**: Danh mục quyền được khai báo trong code, có kiểu, dạng `module:action`. `module:manage` bao hàm mọi hành động của module đó. Lưu một vai trò chứa khóa không có trong danh mục bị 400 `PERMISSION_UNKNOWN`.
- **AC-2**: Vai trò lưu trong DB. Ba vai trò hệ thống `admin`, `landlord`, `tenant` được seed sẵn (`is_system = true`): không xóa được, không đổi `key` được, và `admin` luôn giữ `role:manage` và `user:manage`; vi phạm bị 409 `SYSTEM_ROLE_PROTECTED`.
- **AC-3**: Một tài khoản có từ 1 vai trò trở lên (các dòng của nó trong bảng `user_roles`), quyền hiệu lực là hợp của mọi vai trò. Đặt về rỗng bị 400 `LAST_ROLE`.
- **AC-4**: Có guard toàn cục: route không gắn `@Public()` đòi access token hợp lệ; route gắn `@RequirePermissions(...)` đòi đủ mọi quyền liệt kê (hoặc `module:manage` tương ứng), thiếu thì 403 `PERMISSION_DENIED`. Mọi route phải khai báo đúng một trong `@Public()`, `@RequirePermissions(...)`, `@AuthenticatedOnly()`; một test e2e duyệt toàn bộ route và thất bại nếu có route chưa khai báo.
- **AC-5**: Với module có chủ sở hữu (`ownerScoped`), các quyền `read`, `update`, `delete` chỉ áp dụng cho tài nguyên có chủ sở hữu bằng `sub` trong token; tài nguyên của người khác bị 403 `NOT_RESOURCE_OWNER`. Hành động tác động lên dữ liệu người khác (duyệt, ẩn, xác nhận thanh toán, khóa) là quyền riêng, không phải `update` hay `delete`.
- **AC-6**: API quản lý vai trò (`/roles`) cần quyền `role:*` tương ứng. Người gọi không được tạo hay sửa vai trò chứa quyền mà chính họ không có (403 `CANNOT_GRANT_UNHELD_PERMISSION`). Xóa vai trò đang có người dùng bị 409 `ROLE_IN_USE`. `key` trùng bị 409 `ROLE_KEY_TAKEN`.
- **AC-7**: `PUT /users/:id/roles` gán danh sách vai trò cho tài khoản, cần quyền `user:assign`; người gọi không được gán vai trò chứa quyền họ không có. Vai trò không tồn tại bị 404 `ROLE_NOT_FOUND`.
- **AC-8**: Khóa và mở khóa tài khoản bắt buộc có lý do, ghi `locked_reason`, hủy mọi phiên khi khóa, và ghi một dòng lịch sử kiểm duyệt (BR-13). Thao tác làm hệ thống không còn tài khoản `active` nào giữ `role:manage` bị 409 `LAST_ADMIN`. Có `POST /users/:id/revoke-sessions` để buộc đăng nhập lại.
- **AC-9**: Endpoint gắn `@FreshAuth()` đọc lại trạng thái và quyền của người gọi từ DB trước khi kiểm tra; tài khoản vừa bị khóa hay vừa mất quyền bị từ chối ngay dù access token còn hạn. Danh sách bắt buộc gắn `@FreshAuth()`: mọi thao tác ghi của `/roles` và `/users/:id/*`, và (khi có) xác nhận thanh toán, hoàn tiền, tặng gói.
- **AC-10**: Chỉ vai trò có `self_assignable = true` được chọn khi đăng ký công khai (seed: `tenant`, `landlord`); `admin` không bao giờ.
- **AC-11**: Seed (chạy mỗi lần container khởi động, và bằng `npm run seed` ở máy dev) chạy lại nhiều lần vẫn đúng: tạo hoặc cập nhật vai trò hệ thống, tự thêm các khóa mới của danh mục vào `admin`, và tạo tài khoản admin đầu tiên từ biến môi trường chỉ khi chưa có tài khoản nào giữ vai trò admin.
- **AC-12**: Thay đổi quyền của vai trò hoặc vai trò của người dùng hiện ra ở access token của họ tại lần refresh kế tiếp (tối đa `ACCESS_TTL_SECONDS` sau), không cần họ đăng nhập lại.

## Decision

Phân quyền động: danh mục quyền viết tay trong code (để có kiểu và mỗi quyền đều có đoạn code kiểm tra nó), vai trò lưu trong DB chọn quyền từ danh mục, nhiều vai trò mỗi tài khoản, quyền gắn trong access token, quy tắc chủ sở hữu cố định trong code. Không dùng CASL; hàm kiểm tra tự viết, ngắn, có kiểu.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`): rule `security-use-guards`, `arch-feature-modules`.

## Feature design

**Data model sketch**:

`roles` (cột `snake_case` trong DB, quy ước ở spec 0005):
- `id`: uuid, khóa chính
- `key`: text, bắt buộc, chữ thường dạng slug, **duy nhất** (`roles_key_unique`)
- `name`: text; `description`: text cho phép rỗng
- `permissions`: cột mảng `text[]`, mặc định rỗng; mỗi phần tử là một `PermissionKey` lấy từ danh mục (không trùng). Danh mục nằm trong code nên DB không kiểm được; Service kiểm khi ghi.
- `is_system`: boolean; `self_assignable`: boolean
- `created_at`, `updated_at`; xóa cứng khi không còn người dùng (không xóa mềm)

`user_roles` (thay cho mảng `roleIds` của bản cũ): khóa chính (`user_id`, `role_id`); `user_id` trỏ `users` (`ON DELETE CASCADE`), `role_id` trỏ `roles` (`ON DELETE RESTRICT`, nên xóa vai trò đang có người dùng bị DB chặn, Service đổi lỗi đó thành 409 `ROLE_IN_USE`); có chỉ mục trên `role_id`. Người dùng phải có ít nhất một dòng, kiểm ở Service trong cùng giao dịch với việc thay danh sách vai trò.

Danh mục quyền khởi đầu (mỗi spec tính năng sau thêm khóa của mình; cột còn lại là gán mặc định lúc seed, `admin` được `module:manage` cho mọi module):

| Module | Hành động | `ownerScoped` | `tenant` | `landlord` |
|---|---|---|---|---|
| `profile` | read, update | có (của chính mình) | cả hai | cả hai |
| `user` | read, lock, assign, revoke | không | không | không |
| `role` | read, create, update, delete | không | không | không |
| `catalog` | read, create, update, delete (phường/xã, tiện ích) | không | không | không |
| `setting` | read, update | không | không | không |
| `property` | read, create, update, delete | có | không | cả bốn |
| `listing` | read, create, update, delete, moderate | có (trừ `moderate`) | không | read, create, update, delete |
| `favorite` | read, create, delete | có | cả ba | không |
| `contact` | reveal | không | có | không |
| `report` | create, read, resolve | có (`create`) | create | không |
| `verification` | create, review | có (`create`) | không | create |
| `boost` | create | có | không | create |
| `product` | read, create, update, delete | không | không | không |
| `order` | create, read, cancel, confirm, refund, gift | có (trừ `confirm`, `refund`, `gift`) | không | create, read, cancel |
| `subscription` | read | có | không | read |
| `inspection` | create, perform | có (`create`) | không | create |
| `ad`, `expense` | read, create, update, delete | không | không | không |
| `finance`, `dashboard` | read | không | không | không |
| `stats` | read | có | không | read |

Kiểu danh mục (minh họa):

```ts
export const PERMISSION_CATALOG = {
  listing: { actions: ['read', 'create', 'update', 'delete', 'moderate'], ownerScoped: true },
  role: { actions: ['read', 'create', 'update', 'delete'], ownerScoped: false },
  // ...
} as const satisfies Record<string, { actions: readonly string[]; ownerScoped: boolean }>;

export type PermissionModule = keyof typeof PERMISSION_CATALOG;
export type PermissionKey = {
  [M in PermissionModule]: `${M}:${(typeof PERMISSION_CATALOG)[M]['actions'][number]}` | `${M}:manage`;
}[PermissionModule];
```

Khi cấp token, danh sách quyền được gộp: nếu một vai trò (hoặc hợp các vai trò) có đủ mọi hành động của một module thì chỉ ghi `module:manage`, để token ngắn.

**State transitions**: tài khoản `active` và `locked` (chuyển qua `user:lock`, có lý do). Phần phiên xem 0002.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/permissions` | GET | không | danh mục: module, hành động, `ownerScoped` (cho màn hình chọn quyền) | `role:read` | 403 |
| `/api/v1/roles` | GET | phân trang | danh sách vai trò | `role:read` | 403 |
| `/api/v1/roles/:id` | GET | `id` | vai trò | `role:read` | 404 `ROLE_NOT_FOUND` |
| `/api/v1/roles` | POST | `key`, `name`, `description?`, `permissions[]`, `selfAssignable?` | 201 vai trò | `role:create`, fresh | 400 `PERMISSION_UNKNOWN`, 403 `CANNOT_GRANT_UNHELD_PERMISSION`, 409 `ROLE_KEY_TAKEN` |
| `/api/v1/roles/:id` | PATCH | một phần của vai trò | vai trò | `role:update`, fresh | 409 `SYSTEM_ROLE_PROTECTED`, 403, 400 |
| `/api/v1/roles/:id` | DELETE | `id` | 204 | `role:delete`, fresh | 409 `ROLE_IN_USE`, `SYSTEM_ROLE_PROTECTED` |
| `/api/v1/users/:id/roles` | PUT | `roleIds[]` | 200 người dùng | `user:assign`, fresh | 400 `LAST_ROLE`, 404 `ROLE_NOT_FOUND`, 403 `CANNOT_GRANT_UNHELD_PERMISSION`, 409 `LAST_ADMIN` |
| `/api/v1/users/:id/lock` | POST | `reason` | 200 | `user:lock`, fresh | 400, 404 `USER_NOT_FOUND`, 409 `LAST_ADMIN` |
| `/api/v1/users/:id/unlock` | POST | `reason` | 200 | `user:lock`, fresh | 400, 404 |
| `/api/v1/users/:id/revoke-sessions` | POST | không | 204 | `user:revoke`, fresh | 404 |

Danh sách và tìm kiếm tài khoản (F18) do spec tính năng đó quyết định.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| mọi route có `@RequirePermissions` | quyền của người gọi | `perms` trong access token (đọc DB nếu route gắn `@FreshAuth()`) |
| kiểm tra chủ sở hữu | `ownerId` của tài nguyên | cột `ownerId` hoặc `landlordId` của bản ghi (mỗi spec tính năng ghi rõ tên cột) |
| kiểm tra chủ sở hữu | người gọi | `sub` trong token |
| tạo hoặc sửa vai trò | quyền người gọi đang giữ | `perms` trong token (đọc DB vì endpoint gắn fresh), mở rộng `module:manage` thành các hành động |
| lock, unlock | `locked_reason`, người thực hiện, thời điểm | input `reason`, `sub` trong token, giờ hệ thống; lưu ở `users` và `moderation_logs` (spec 0005) |
| seed | admin đầu tiên | `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_NAME` |
| seed | quyền mặc định của từng vai trò hệ thống | bảng danh mục ở trên, nằm trong code |
| phát hiện `LAST_ADMIN` | số tài khoản `active` còn giữ `role:manage` | truy vấn đếm nối `users`, `user_roles`, `roles` trong cùng giao dịch với thao tác, sau khi khóa các dòng người dùng liên quan bằng `FOR UPDATE` để hai thao tác đồng thời không cùng qua được kiểm tra |

**Key invariants**:
- Mọi quyền lưu trong `roles.permissions` đều có trong danh mục (kiểm tra khi ghi, không tin DB khi đọc: khóa lạ bị bỏ qua và ghi log).
- `admin` luôn có `role:manage` và `user:manage`; luôn còn ít nhất một tài khoản `active` giữ `role:manage`, kể cả khi hai quản trị viên cùng bị hạ quyền một lúc (khóa dòng `FOR UPDATE` trong giao dịch, spec 0005).
- Quy tắc chủ sở hữu là mã cố định, vai trò mới không chỉnh được; vì vậy không thể cấu hình nhầm thành "sửa tin của người khác".
- Không ai nâng quyền cho chính mình hay người khác vượt quá quyền mình đang giữ.
- Hợp quyền của nhiều vai trò chỉ làm tăng quyền, không có "từ chối" (không có quyền phủ định).
- Logic nghiệp vụ dựa vào quyền hoặc chủ sở hữu dữ liệu, không dựa tên vai trò.

**Security model**:
- Ai đọc, ghi gì: bảng danh mục ở trên là mặc định lúc seed; admin chỉnh được bằng API vai trò.
- Mặc định an toàn: một route quên khai báo bị test e2e bắt (AC-4). Route chỉ khai báo `@AuthenticatedOnly()` dành cho thao tác của chính người dùng (ví dụ `/auth/me`).
- Khóa tài khoản có hiệu lực ngay với endpoint nhạy cảm (`@FreshAuth()`) và tối đa 15 phút với endpoint thường; các phiên bị hủy nên không refresh được. Tin của chủ trọ bị khóa biến mất khỏi kết quả ngay vì điều kiện hiển thị nối với `users.status` mỗi lần truy vấn, không dựa vào cờ sao chép (xem 0005).
- Không thuộc chuẩn tuân thủ đặc biệt.

**Configuration required**:
- `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` (bí mật), `ADMIN_SEED_NAME`

**Critical test scenarios**:
- Happy path: admin tạo vai trò mới chỉ có `listing:read`, gán cho một tài khoản, tài khoản đó refresh và đọc được nhưng gọi sửa thì 403, verifies **AC-3**, **AC-4**, **AC-6**, **AC-7**, **AC-12**
- Failure case: gửi khóa quyền không tồn tại khi tạo vai trò bị 400, verifies **AC-1**
- Failure case: xóa vai trò đang được gán bị 409; sửa hay xóa vai trò hệ thống bị 409, verifies **AC-2**, **AC-6**
- Failure case: khóa hay hạ quyền tài khoản admin cuối cùng bị 409 `LAST_ADMIN`, verifies **AC-8**
- Auth/permission: chủ trọ A sửa tin của chủ trọ B bị 403 `NOT_RESOURCE_OWNER` dù có `listing:update`, verifies **AC-5**
- Auth/permission: người có quyền `role:create` nhưng không có `user:manage` không thể tạo vai trò chứa `user:manage`, verifies **AC-6**
- Auth/permission: tài khoản vừa bị khóa với access token còn hạn bị từ chối ở endpoint `@FreshAuth()` ngay lập tức, verifies **AC-9**
- Auth/permission: đăng ký công khai với vai trò `admin` bị từ chối, verifies **AC-10**
- Happy path: chạy `seed` hai lần không tạo trùng, và khóa mới của danh mục xuất hiện ở `admin`, verifies **AC-11**
- Failure case: test duyệt route thất bại khi một route không khai báo `@Public`, `@RequirePermissions` hay `@AuthenticatedOnly`, verifies **AC-4**

## Build plan

Yêu cầu có trước: cấu hình có kiểu, kết nối DB và `TransactionRunner` (slice 0 của spec 0006), mã lỗi (spec 0004). Nhiệm vụ 1 và 2 phải xong trước nhiệm vụ 2 của spec 0002 (token mang `perms`).

1. Danh mục quyền có kiểu, hàm `hasPermission`, hàm gộp `module:manage`, hàm mở rộng và test đơn vị, satisfies **AC-1**, **AC-3**
2. Entity và migration cho `roles` và `user_roles`, repository, bộ seed vai trò hệ thống và admin đầu tiên (chạy khi container khởi động và bằng `npm run seed`), satisfies **AC-2**, **AC-10**, **AC-11**
3. Guard toàn cục (xác thực không đọc DB, kiểm quyền), decorator `@Public`, `@RequirePermissions`, `@AuthenticatedOnly`, `@FreshAuth`, `@CurrentUser`, test e2e duyệt route, satisfies **AC-4**, **AC-9**
4. Service tính quyền hiệu lực của một người dùng (dùng cho token và cho `@FreshAuth()`), satisfies **AC-3**, **AC-12**
5. API vai trò và danh mục quyền với các chốt chặn nâng quyền, satisfies **AC-6**
6. Gán vai trò cho tài khoản, khóa, mở khóa, thu hồi phiên, kiểm tra `LAST_ADMIN`, ghi lịch sử kiểm duyệt, satisfies **AC-7**, **AC-8**, **AC-9**
7. Helper kiểm tra chủ sở hữu dùng chung cho các module có `ownerScoped`, satisfies **AC-5**
8. Test e2e trên Postgres thật (Testcontainers) cho các kịch bản ở trên, gồm một kịch bản hai thao tác hạ quyền admin chạy đồng thời, satisfies **AC-1** đến **AC-12**

## Rationale (ngắn)

Danh mục quyền nằm trong code vì mỗi quyền phải có đoạn code kiểm tra nó; một quyền chỉ có trong DB sẽ không làm được gì. Vai trò nằm trong DB là phần bạn cần để tạo vai trò mới mà không sửa code. Quy tắc chủ sở hữu cố định trong code (thay vì phạm vi `own` hay `any` chọn được) vì thế hợp với spec chức năng (chủ trọ chỉ sửa tin của mình, admin chỉ ẩn hoặc khôi phục) và loại bỏ cả một lớp lỗi cấu hình nhầm; cái giá là không tạo được vai trò "sửa mọi tin", và nếu sau này cần (ví dụ môi giới) thì thêm phạm vi `any` bằng một spec mới. Nhiều vai trò mỗi tài khoản và quyền nằm trong token là các quyết định của bạn, khác đề xuất ban đầu của mình (một vai trò, đọc DB mỗi request); các chốt chặn `@FreshAuth()`, refresh đọc lại DB và hủy phiên khi khóa bù cho độ trễ của token. CASL không cần vì chỉ có một quy tắc điều kiện (chủ sở hữu) và nó đã cố định.

## Consequences

**Positive**:
- Tạo vai trò mới và chọn quyền bằng API, không sửa code kiểm quyền.
- Chặn nâng quyền, tự khóa mình, và route quên khai báo.
- Token mang sẵn quyền nên kiểm quyền không tốn truy vấn DB.

**Negative / tradeoffs**:
- Đổi quyền hoặc khóa chỉ có hiệu lực tối đa 15 phút với endpoint thường.
- Token của admin dài hơn (đã giảm bằng `module:manage`).
- Mỗi tính năng mới phải thêm khóa vào danh mục và seed lại; danh mục là một nơi sửa chung.
- Chưa có phạm vi `any` chọn được: vai trò kiểu "sửa mọi tin" không tạo được.
- FE phải làm màn hình quản lý vai trò mà spec chức năng chưa có (BE đã có API).

**Neutral**:
- BR-01 trong spec chức năng cần sửa thành "một tài khoản có một hoặc nhiều vai trò".

## Follow-up

- [ ] Mỗi spec tính năng sau liệt kê khóa quyền của mình và bảng gán mặc định cho các vai trò hệ thống.
- [ ] Chưa có cách một người dùng tự thêm vai trò thứ hai (ví dụ người thuê muốn thành chủ trọ); hiện chỉ admin gán. Quyết định lại nếu cần.
- [ ] Cân nhắc phạm vi `own` hoặc `any` chọn được nếu về sau cần vai trò kiểu môi giới.
