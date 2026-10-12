# 0003. Loại tài khoản và phân quyền (spec con của 0001 nền móng backend)

**Date**: 2026-10-05

## Summary

Spec con này chốt cách phân quyền theo loại tài khoản. Mỗi tài khoản thuộc đúng một trong ba loại: `admin`, `landlord` (người đăng bài) hoặc `tenant` (người tìm trọ). Người dùng tự chọn `landlord` hoặc `tenant` lúc đăng ký miễn phí và không đổi được sau đó; `admin` do hệ thống tạo sẵn. Việc mỗi loại được làm là một danh sách quyền (theo từng module và hành động) lưu trong DB. Admin chỉnh được quyền của `landlord` và `tenant` bằng API, nhưng không tạo thêm loại, và quyền của `admin` luôn là toàn bộ. Quyền của loại được ghi sẵn trong access token.

## Requirements

**User stories**:
- Là người dùng mới, tôi muốn đăng ký miễn phí và chọn mình là người đăng bài hay người tìm trọ, để chỉ thấy và làm phần việc của mình.
- Là admin, tôi muốn chỉnh những việc mỗi loại tài khoản được làm (chọn module và hành động), để đổi chính sách mà không sửa code.
- Là chủ trọ, tôi muốn chỉ sửa được dữ liệu của chính mình, để không ai sửa nhầm hay phá dữ liệu của tôi.
- Là admin, tôi muốn khóa tài khoản vi phạm và buộc họ đăng nhập lại, để chặn thiệt hại nhanh.
- Là admin, tôi muốn ẩn tin vi phạm của người khác sau khi đã đăng (không có bước duyệt trước), để gỡ nội dung xấu nhanh mà chủ trọ vẫn đăng được ngay.
- Là admin (người kinh doanh nền tảng), tôi muốn chỉ mình tôi quản lý bảng giá gói, tham số dùng thử và danh mục phường, tiện ích.

**Acceptance criteria**:
- **AC-1**: Danh mục quyền được khai báo trong code, có kiểu, dạng `module:action`. `module:manage` bao hàm mọi hành động của module đó. Mỗi module ghi rõ những hành động chỉ `admin` được giữ (`adminActions`). Lưu một loại chứa khóa không có trong danh mục bị 400 `PERMISSION_UNKNOWN`.
- **AC-2**: Có đúng ba loại tài khoản `admin`, `landlord`, `tenant` ở bảng `account_types`, do migration tạo sẵn kèm quyền mặc định; không thêm, xóa hay đổi `key` được. Quyền của `admin` luôn là `manage` mọi module, tính trong code và không sửa được; sửa quyền của `admin` bị 409 `SYSTEM_TYPE_PROTECTED`.
- **AC-3**: Mỗi tài khoản thuộc đúng một loại (`users.account_type`), chọn lúc đăng ký công khai và chỉ trong `tenant` hoặc `landlord` (spec 0002), không có endpoint đổi loại. Quyền hiệu lực của tài khoản chính là quyền của loại đó.
- **AC-4**: Có guard toàn cục: route không gắn `@Public()` đòi access token hợp lệ; route gắn `@RequirePermissions(...)` đòi đủ mọi quyền liệt kê (hoặc `module:manage` tương ứng), thiếu thì 403 `PERMISSION_DENIED`. Mọi route phải khai báo đúng một trong `@Public()`, `@RequirePermissions(...)`, `@AuthenticatedOnly()`; một test e2e duyệt toàn bộ route và thất bại nếu có route chưa khai báo.
- **AC-5**: Với module có chủ sở hữu (`ownerScoped`), các quyền `read`, `update`, `delete` chỉ áp dụng cho tài nguyên có chủ sở hữu bằng `sub` trong token; tài nguyên của người khác bị 403 `NOT_RESOURCE_OWNER`. Hành động tác động lên dữ liệu người khác (ẩn hoặc gỡ ẩn tin, khóa tài khoản) là quyền riêng, không phải `update` hay `delete`. Quy tắc này áp cho mọi loại tài khoản, kể cả `admin`: admin tác động lên dữ liệu của người khác chỉ qua các quyền riêng đó.
- **AC-6**: Admin xem và chỉnh quyền của `landlord` và `tenant` bằng API loại tài khoản (`account_type:read`, `account_type:update`). Danh sách quyền gửi lên thay toàn bộ danh sách hiện có của loại và được bỏ trùng. Mọi khóa `module:manage` bị từ chối với loại khác `admin` (400 `PERMISSION_ADMIN_ONLY`), vì `manage` bao hàm cả hành động chỉ admin giữ; admin phải chọn từng hành động cụ thể. Cấp cho loại khác `admin` một hành động chỉ admin được giữ, hoặc một module chỉ admin dùng (ví dụ `plan`, `account_type`), cũng bị 400 `PERMISSION_ADMIN_ONLY`. Loại không tồn tại bị 404 `ACCOUNT_TYPE_NOT_FOUND`.
- **AC-7**: Khóa và mở khóa tài khoản bắt buộc có lý do, ghi `locked_reason`, hủy mọi phiên khi khóa, và ghi một dòng lịch sử kiểm duyệt (BR-13). Khóa tài khoản đang khóa bị 409 `ACCOUNT_ALREADY_LOCKED`; mở tài khoản không bị khóa bị 409 `ACCOUNT_NOT_LOCKED`; hai trường hợp này không đổi gì và không ghi lịch sử. Mở khóa đặt `locked_reason` về rỗng; lý do khóa và lý do mở chỉ còn lưu ở `moderation_logs`. Admin không khóa được chính mình (409 `CANNOT_LOCK_SELF`). Có `POST /users/:id/revoke-sessions` để buộc đăng nhập lại.
- **AC-8**: Endpoint gắn `@FreshAuth()` đọc lại trạng thái và quyền của người gọi từ DB trước khi kiểm tra; tài khoản vừa bị khóa hay vừa mất quyền bị từ chối ngay dù access token còn hạn; tài khoản đã xóa mềm hoặc không còn bị từ chối 401 `TOKEN_INVALID`. Danh sách bắt buộc gắn `@FreshAuth()`: mọi thao tác ghi của `/account-types` và `/users/:id/*`, và (khi có) ẩn hoặc gỡ ẩn tin của người khác.
- **AC-9**: Migration tạo ba loại kèm quyền mặc định (danh sách khóa ghi thẳng theo bảng danh mục bên dưới); migration của mỗi tính năng sau thêm khóa quyền mặc định của nó vào `landlord` và `tenant` một lần. Seed (chạy mỗi lần container khởi động, và bằng `npm run seed` ở máy dev) chỉ làm hai việc: kiểm ba loại đã có (thiếu thì dừng với thông báo rõ) và tạo tài khoản admin đầu tiên từ biến môi trường khi chưa có tài khoản nào thuộc loại `admin` (tính cả tài khoản `admin` bị khóa và đã xóa mềm). `ADMIN_SEED_EMAIL` được chuẩn hóa như lúc đăng ký (chữ thường, cắt khoảng trắng) và tra bằng truy vấn tính cả tài khoản đã xóa mềm. Nếu email đó đã thuộc một tài khoản không phải `admin`, seed dừng với thông báo rõ (loại không đổi được nên không nâng cấp tài khoản đó). Chạy seed lại nhiều lần vẫn đúng và không bao giờ ghi đè quyền admin đã chỉnh.
- **AC-10**: Thay đổi quyền của một loại hiện ra ở access token của mọi tài khoản thuộc loại đó tại lần refresh kế tiếp (tối đa `ACCESS_TTL_SECONDS` sau), không cần họ đăng nhập lại.
- **AC-11**: Các module chỉ dành cho `admin` (`user`, `account_type`, `catalog`, `setting`, `plan`) không dùng được bằng tài khoản loại khác: gọi bị 403 `PERMISSION_DENIED`, và không cấp được qua API (AC-6). Báo cáo doanh thu và chi phí (module `finance`, `expense`, `dashboard`) đã hoãn khỏi MVP, khi làm lại thì cũng là module chỉ admin.

## Decision

Phân quyền theo loại tài khoản: danh mục quyền viết tay trong code (để có kiểu và mỗi quyền đều có đoạn code kiểm tra nó), ba loại cố định lưu trong DB với danh sách quyền mà admin chỉnh được, mỗi tài khoản một loại, quyền gắn trong access token, quy tắc chủ sở hữu cố định trong code. Không dùng CASL; hàm kiểm tra tự viết, ngắn, có kiểu.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`): rule `security-use-guards`, `arch-feature-modules`.

## Feature design

**Data model sketch** (cột `snake_case` trong DB, quy ước ở spec 0005):

`account_types`:
- `key`: text, khóa chính, `CHECK` chỉ nhận `'admin' | 'landlord' | 'tenant'` (`account_types_key_check`)
- `name`: text; `description`: text cho phép rỗng
- `permissions`: cột mảng `text[]`, `NOT NULL`, mặc định mảng rỗng; mỗi phần tử là một `PermissionKey` lấy từ danh mục (không trùng). Với `admin` cột để mảng rỗng và bị bỏ qua khi đọc, vì quyền của `admin` tính trong code. Danh mục nằm trong code nên DB không kiểm được; Service kiểm khi ghi.
- `created_at`, `updated_at`; không xóa mềm; không có đường thêm hay xóa dòng ngoài migration

`users.account_type`: text, bắt buộc, khóa ngoại tới `account_types.key` (`ON DELETE RESTRICT`), có chỉ mục. Đặt lúc đăng ký (hoặc lúc seed admin) và không có đường cập nhật. Ba dòng `account_types` nằm trong migration nên khóa ngoại luôn thỏa, kể cả khi chưa chạy seed.

Migration (nhiệm vụ 2) không chuyển dữ liệu cũ: DB dev được làm lại từ đầu bằng `prisma migrate reset` (bạn chạy, không phải agent). Trong một migration, theo thứ tự: một khối `DO` dừng với thông báo rõ nếu bảng `users` còn dòng (thay vì đoán dữ liệu); tạo bảng `account_types` và chèn ba dòng kèm quyền mặc định; bỏ cột `users.roles`; thêm `users.account_type` bắt buộc với khóa ngoại và chỉ mục; thêm `users.phone` cùng `CHECK` `users_landlord_phone_check` và chỉ mục duy nhất một phần `users_landlord_phone_unique` (spec 0002 AC-13, spec 0005).

Danh mục quyền của MVP (mỗi spec tính năng sau thêm khóa của mình nếu cần; `admin` luôn có `module:manage` mọi module; hai cột cuối là quyền mặc định, chỉnh được bằng API):

| Module | Hành động | `ownerScoped` | Chỉ admin giữ | `tenant` | `landlord` |
|---|---|---|---|---|---|
| `profile` | read, update | có (của chính mình) | không | cả hai | cả hai |
| `user` | read, lock, revoke | không | cả module | không | không |
| `account_type` | read, update | không | cả module | không | không |
| `catalog` | read, create, update, delete (phường/xã, tiện ích) | không | cả module | không | không |
| `setting` | read, update | không | cả module | không | không |
| `property` | read, create, update, delete | có | không | không | cả bốn |
| `listing` | read, create, update, delete, moderate | có (trừ `moderate`) | `moderate` | không | read, create, update, delete |
| `favorite` | read, create, delete | có | không | cả ba | không |
| `follow` | create, delete | có | không | cả hai | không |
| `plan` | read, create, update, delete (bảng giá gói; xem bảng giá công khai không cần quyền) | không | cả module | không | không |
| `order` | create, read, cancel | có | không | không | cả ba |
| `subscription` | read | có | không | không | read |

Ghi chú về phạm vi MVP (cập nhật 2026-10-11, xem mục "Phạm vi MVP" của `index.md`):
- `listing:moderate` nghĩa là ẩn và gỡ ẩn tin của người khác sau khi đã đăng, kèm lý do. Không có duyệt trước, không có hàng chờ.
- Thanh toán thử: chủ trọ tự xác nhận đơn của chính mình bằng quyền `order:create`. Không có quyền xác nhận thanh toán, hoàn tiền hay tặng gói của admin.
- Các module `contact`, `report`, `verification`, `boost`, `product`, `inspection`, `ad`, `expense`, `finance`, `dashboard`, `stats` và các hành động `order:refund`, `order:gift` đã hoãn khỏi MVP nên không còn trong danh mục. Code và migration hiện tại vẫn chứa chúng cho đến khi dọn (xem Follow-up).

Kiểu danh mục (minh họa):

```ts
export const PERMISSION_CATALOG = {
  listing: { actions: ['read', 'create', 'update', 'delete', 'moderate'], ownerScoped: true, adminActions: ['moderate'] },
  account_type: { actions: ['read', 'update'], ownerScoped: false, adminActions: ['read', 'update'] },
  // ...
} as const satisfies Record<string, { actions: readonly string[]; ownerScoped: boolean; adminActions: readonly string[] }>;

export type PermissionModule = keyof typeof PERMISSION_CATALOG;
export type PermissionKey = {
  [M in PermissionModule]: `${M}:${(typeof PERMISSION_CATALOG)[M]['actions'][number]}` | `${M}:manage`;
}[PermissionModule];

export const ACCOUNT_TYPES = ['admin', 'landlord', 'tenant'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const SELF_REGISTER_TYPES = ['landlord', 'tenant'] as const; // dùng ở đăng ký (spec 0002)
```

Khi cấp token, danh sách quyền của loại được gộp: nếu loại có đủ mọi hành động của một module thì chỉ ghi `module:manage`, để token ngắn.

**State transitions**: tài khoản `active` và `locked` (chuyển qua `user:lock`, có lý do). Loại tài khoản không có chuyển trạng thái: đặt một lần lúc tạo. Phần phiên xem 0002.

**API surface**:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/api/v1/permissions` | GET | không | danh mục: module, hành động, `ownerScoped`, hành động chỉ admin (cho màn hình chọn quyền) | `account_type:read` | 403 |
| `/api/v1/account-types` | GET | không | ba loại kèm quyền (của `admin`: toàn bộ) | `account_type:read` | 403 |
| `/api/v1/account-types/:key` | PATCH | `permissions[]` (thay toàn bộ, bỏ trùng; từ chối mọi khóa `*:manage` với loại khác `admin`) | loại sau khi sửa | `account_type:update`, fresh | 400 `PERMISSION_UNKNOWN`, 400 `PERMISSION_ADMIN_ONLY`, 404 `ACCOUNT_TYPE_NOT_FOUND`, 409 `SYSTEM_TYPE_PROTECTED`, 403 |
| `/api/v1/users/:id/lock` | POST | `reason` | 200 | `user:lock`, fresh | 400, 404 `USER_NOT_FOUND`, 409 `CANNOT_LOCK_SELF`, 409 `ACCOUNT_ALREADY_LOCKED` |
| `/api/v1/users/:id/unlock` | POST | `reason` | 200 | `user:lock`, fresh | 400, 404, 409 `ACCOUNT_NOT_LOCKED` |
| `/api/v1/users/:id/revoke-sessions` | POST | không | 204 | `user:revoke`, fresh | 404 |

Đăng ký chọn loại nằm ở spec 0002. Danh sách và tìm kiếm tài khoản (F18) do spec tính năng đó quyết định.

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| mọi route có `@RequirePermissions` | quyền của người gọi | `perms` trong access token (đọc DB nếu route gắn `@FreshAuth()`) |
| cấp token (login, register, refresh) | `perms` | quyền của loại của người dùng: `account_types.permissions` (của `admin`: toàn bộ, tính trong code), đã gộp thành `module:manage` khi đủ mọi hành động |
| cấp token (login, register, refresh) | `type` | `users.account_type` của người dùng; không đổi sau khi tạo nên không bao giờ cũ trong token |
| kiểm tra chủ sở hữu | `ownerId` của tài nguyên | cột `ownerId` hoặc `landlordId` của bản ghi (mỗi spec tính năng ghi rõ tên cột) |
| kiểm tra chủ sở hữu | người gọi | `sub` trong token |
| sửa quyền của loại | hành động hoặc module chỉ admin giữ | trường `adminActions` của danh mục trong code |
| lock, unlock | `locked_reason`, người thực hiện, thời điểm | input `reason`, `sub` trong token, giờ hệ thống; `users.locked_reason` chỉ có giá trị khi đang khóa; mọi lần khóa và mở ghi một dòng vào `moderation_logs` (spec 0005) |
| chống tự khóa | người thực hiện và đối tượng | `sub` trong token và `:id` trong đường dẫn |
| seed | admin đầu tiên | `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_NAME` |
| migration tạo ba loại | quyền mặc định của `landlord` và `tenant` | bảng danh mục ở trên, ghi thẳng thành danh sách khóa trong file migration (SQL không đọc được hằng số trong code); khóa lạ khi đọc bị bỏ qua và ghi log, test e2e kiểm mọi khóa mặc định có trong danh mục |

**Key invariants**:
- Mọi quyền lưu trong `account_types.permissions` đều có trong danh mục (kiểm tra khi ghi, không tin DB khi đọc: khóa lạ bị bỏ qua và ghi log).
- Chỉ có ba loại, mỗi tài khoản đúng một loại, không đổi sau khi tạo; không có đường thêm, xóa hay đổi loại.
- Quyền của `admin` không lưu và không sửa được, nên không cần chốt chặn "không nâng quyền vượt mức mình": chỉ admin sửa quyền và admin vốn có tất cả; việc cần chặn duy nhất là cấp hành động chỉ admin cho loại khác (AC-6).
- Admin không khóa được chính mình. Tài khoản `admin` chỉ được tạo bằng seed.
- Quy tắc chủ sở hữu là mã cố định, quyền của loại không chỉnh được và áp cho mọi loại kể cả `admin`; vì vậy không thể cấu hình nhầm thành "sửa tin của người khác".
- Cột `account_types.permissions` của `landlord` và `tenant` không bao giờ chứa khóa `*:manage` hay quyền chỉ admin giữ; khóa `module:manage` chỉ xuất hiện trong token khi loại có đủ mọi hành động của module (AC-1).
- Quyền chỉ cộng, không có "từ chối" (không có quyền phủ định).
- Logic nghiệp vụ dựa vào quyền hoặc chủ sở hữu dữ liệu, không dựa tên loại. Ngoại lệ có chủ đích là các quy tắc gắn với người đăng bài (dùng thử, hạn mức); spec của chúng ghi rõ chỗ so loại, và loại lấy từ `type` trong token (hoặc `users.account_type` khi đã đọc người dùng), không suy từ quyền.

**Security model**:
- Ai đọc, ghi gì: bảng danh mục ở trên là mặc định lúc migration tạo loại; admin chỉnh được quyền của `landlord` và `tenant` bằng API loại tài khoản, trừ các quyền chỉ admin giữ.
- Mặc định an toàn: một route quên khai báo bị test e2e bắt (AC-4). Route chỉ khai báo `@AuthenticatedOnly()` dành cho thao tác của chính người dùng (ví dụ `/auth/me`).
- Khóa tài khoản có hiệu lực ngay với endpoint nhạy cảm (`@FreshAuth()`) và tối đa 15 phút với endpoint thường; các phiên bị hủy nên không refresh được. Tin của chủ trọ bị khóa biến mất khỏi kết quả ngay vì điều kiện hiển thị nối với `users.status` mỗi lần truy vấn, không dựa vào cờ sao chép (xem 0005).
- Bảng giá gói, tham số dùng thử, danh mục phường và tiện ích nằm ở các module chỉ admin (AC-11).
- Không thuộc chuẩn tuân thủ đặc biệt.

**Configuration required**:
- `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` (bí mật), `ADMIN_SEED_NAME`

**Critical test scenarios**:
- Happy path: admin bỏ `favorite:create` khỏi loại `tenant`, một tài khoản `tenant` refresh rồi lưu phòng yêu thích thì bị 403, verifies **AC-6**, **AC-10**
- Failure case: gửi khóa quyền không tồn tại khi sửa loại bị 400 `PERMISSION_UNKNOWN`, verifies **AC-1**, **AC-6**
- Failure case: sửa quyền của `admin` bị 409 `SYSTEM_TYPE_PROTECTED`; cấp `listing:moderate` hoặc `plan:create` cho `landlord` bị 400 `PERMISSION_ADMIN_ONLY`, verifies **AC-2**, **AC-6**, **AC-11**
- Failure case: admin tự khóa mình bị 409 `CANNOT_LOCK_SELF`, verifies **AC-7**
- Failure case: khóa tài khoản đang khóa bị 409 `ACCOUNT_ALREADY_LOCKED`; mở tài khoản đang mở bị 409 `ACCOUNT_NOT_LOCKED`, không ghi thêm lịch sử, verifies **AC-7**
- Failure case: gửi `listing:manage` hoặc `property:manage` cho `landlord` khi sửa quyền loại bị 400 `PERMISSION_ADMIN_ONLY`, verifies **AC-6**
- Auth/permission: admin sửa tin của chủ trọ bằng quyền `listing:update` bị 403 `NOT_RESOURCE_OWNER`; chỉ ẩn hoặc gỡ ẩn được bằng `listing:moderate`, verifies **AC-5**
- Failure case: chạy `seed` khi `ADMIN_SEED_EMAIL` đã là tài khoản `tenant` (kể cả đã xóa mềm, kể cả viết hoa hay thừa khoảng trắng) dừng với thông báo rõ và không đổi loại tài khoản đó, verifies **AC-9**
- Auth/permission: chủ trọ A sửa tin của chủ trọ B bị 403 `NOT_RESOURCE_OWNER` dù có `listing:update`, verifies **AC-5**
- Auth/permission: `landlord` và `tenant` gọi API quản lý gói (ví dụ tạo gói) hoặc sửa tham số dùng thử bị 403 `PERMISSION_DENIED`, verifies **AC-11**
- Auth/permission: tài khoản vừa bị khóa với access token còn hạn bị từ chối ở endpoint `@FreshAuth()` ngay lập tức, verifies **AC-8**
- Auth/permission: đăng ký công khai với loại `admin` hoặc kèm `roles` bị từ chối, verifies **AC-3**
- Happy path: chạy `seed` hai lần không tạo thêm admin và không ghi đè quyền đã chỉnh của `landlord` hay `tenant`; chạy trên DB mới chỉ có migration thì ba loại đã có và đăng ký không lỗi khóa ngoại, verifies **AC-9**
- Failure case: test duyệt route thất bại khi một route không khai báo `@Public`, `@RequirePermissions` hay `@AuthenticatedOnly`, verifies **AC-4**

## Build plan

Yêu cầu có trước: cấu hình có kiểu, kết nối DB và `TransactionRunner` (slice 0 của spec 0006), mã lỗi (spec 0004). Nền token của spec 0002 đã có và tạm dùng cột `users.roles`, enum `Role`, `RolesGuard` và `@Roles`; các nhiệm vụ dưới đây thay chúng.

1. Danh mục quyền có kiểu (kèm `adminActions`), hàm `hasPermission`, hàm gộp `module:manage`, hàm mở rộng, bảng quyền mặc định và test đơn vị, satisfies **AC-1**, **AC-11**
2. Model Prisma và migration cho `account_types` và `users.account_type` (một migration theo thứ tự ở phần Data model: chèn ba loại kèm quyền mặc định, thêm `users.account_type` bắt buộc, thêm `users.phone` cùng `CHECK` và chỉ mục duy nhất một phần, bỏ cột `roles`; không chuyển dữ liệu cũ vì DB dev làm lại từ đầu; đây là nơi duy nhất bỏ cột `users.roles`), bỏ enum `Role`, `RolesGuard` và `@Roles` cũ, repository, bộ seed chỉ kiểm ba loại và tạo admin đầu tiên (chạy khi container khởi động và bằng `npm run seed`), satisfies **AC-2**, **AC-3**, **AC-9**
3. Guard toàn cục (xác thực không đọc DB, kiểm quyền), decorator `@Public`, `@RequirePermissions`, `@AuthenticatedOnly`, `@FreshAuth`, `@CurrentUser`, test e2e duyệt route; token mang `type` và `perms` thay cho `roles`, satisfies **AC-4**, **AC-8**
4. Service tính quyền hiệu lực của một người dùng từ loại của họ (dùng cho token và cho `@FreshAuth()`), satisfies **AC-3**, **AC-10**
5. API loại tài khoản và danh mục quyền với kiểm tra hành động chỉ admin, satisfies **AC-6**
6. Khóa, mở khóa, thu hồi phiên, chống tự khóa, ghi lịch sử kiểm duyệt, satisfies **AC-7**, **AC-8**
7. Helper kiểm tra chủ sở hữu dùng chung cho các module có `ownerScoped`, satisfies **AC-5**
8. Test e2e trên Postgres thật (Testcontainers) cho các kịch bản ở trên, satisfies **AC-1** đến **AC-11**

## Rationale (ngắn)

Mô hình kinh doanh gắn dùng thử, hạn mức và gói vào người đăng bài, nên mỗi tài khoản chỉ cần một loại và nhiều vai trò hay vai trò tạo tùy ý không còn phục vụ mục tiêu: bỏ chúng cùng các chốt chặn đi kèm (gán vai trò, `LAST_ROLE`, `LAST_ADMIN`, chặn nâng quyền theo quyền đang giữ). Phần giữ lại là lựa chọn của bạn: quyền của từng loại nằm trong DB để admin chỉnh bằng API mà không sửa code (mình từng đề xuất cố định hẳn trong code cho gọn hơn). Danh mục quyền vẫn nằm trong code vì mỗi quyền phải có đoạn code kiểm tra nó; một quyền chỉ có trong DB sẽ không làm được gì. Vì admin luôn có mọi quyền và chỉ admin sửa được quyền, một quy tắc đơn giản (hành động chỉ admin không cấp được cho loại khác) thay thế cả lớp chặn nâng quyền cũ. Quy tắc chủ sở hữu cố định trong code (thay vì phạm vi `own` hay `any` chọn được) hợp với spec chức năng (chủ trọ chỉ sửa tin của mình, admin chỉ ẩn hoặc khôi phục) và loại bỏ cả một lớp lỗi cấu hình nhầm; cái giá là không tạo được loại "sửa mọi tin". Quyền nằm trong token là quyết định của bạn từ trước (khác đề xuất ban đầu của mình là đọc DB mỗi request); token mang thêm `type` vì loại không đổi sau khi tạo nên không bao giờ cũ, giúp FE chọn giao diện và quy tắc của người đăng bài khỏi đọc DB; các chốt chặn `@FreshAuth()`, refresh đọc lại DB và hủy phiên khi khóa bù cho độ trễ của token. CASL không cần vì chỉ có một quy tắc điều kiện (chủ sở hữu) và nó đã cố định.

## Consequences

**Positive**:
- Admin chỉnh quyền của từng loại bằng API, không sửa code kiểm quyền.
- Mỗi tài khoản một loại nên các quy tắc dùng thử, hạn mức và gói gắn thẳng vào người đăng bài, ít trường hợp biên.
- Chặn cấp nhầm quyền admin cho loại khác bằng một quy tắc ngắn; chặn tự khóa mình và route quên khai báo.
- Token mang sẵn quyền nên kiểm quyền không tốn truy vấn DB; bảng giá gói và tham số dùng thử chỉ admin sửa được.

**Negative / tradeoffs**:
- Đổi quyền hoặc khóa chỉ có hiệu lực tối đa 15 phút với endpoint thường.
- Mỗi tính năng mới phải thêm khóa vào danh mục, kèm hành động chỉ admin, và migration của nó thêm khóa mặc định cho `landlord` và `tenant`; danh mục là một nơi sửa chung.
- Không tạo thêm loại mới (ví dụ môi giới) bằng API: thêm loại là một thay đổi spec và migration.
- Người vừa thuê vừa cho thuê phải dùng hai tài khoản.
- FE phải làm màn hình chỉnh quyền của loại mà spec chức năng chưa có (BE đã có API).

**Neutral**:
- Quy tắc một loại cho mỗi tài khoản trùng với BR-01 của bản chức năng cũ.

## Follow-up

- [ ] Dọn danh mục trong code cho khớp bảng trên: bỏ các module đã hoãn khỏi `PERMISSION_CATALOG`, đổi `product` thành `plan`, bỏ `order:refund` và `order:gift`, thêm migration gỡ các khóa thừa khỏi `account_types.permissions` của `landlord` và `tenant` (khóa lạ chỉ bị bỏ qua và ghi log, nên không gấp), sửa test danh mục và `verify.md`. Việc của `/develop`, làm trước khi làm tính năng nhà trọ để `GET /permissions` không hiện quyền ma.
- [ ] Mỗi spec tính năng sau liệt kê khóa quyền của mình, các hành động chỉ admin, và bảng gán mặc định cho `landlord` và `tenant` (migration của tính năng thêm khóa mặc định một lần, không dùng seed chạy mỗi lần khởi động để khỏi ghi đè chỉnh sửa của admin).
- [ ] Chưa có cách một người dùng đổi loại (ví dụ người tìm trọ muốn thành người đăng bài); hiện phải tạo tài khoản khác. Quyết định lại nếu cần, và khi đó phải cân nhắc lại quy tắc một lần dùng thử cho mỗi SĐT.
- [ ] Cân nhắc loại môi giới, hoặc phạm vi `own` hay `any` chọn được, nếu về sau cần.
