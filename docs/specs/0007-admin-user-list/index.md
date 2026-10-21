# 0007. Danh sách người dùng cho admin

**Date**: 2026-10-21
**Status**: Accepted

## Summary

Admin cần tìm đúng người để khóa hay mở khóa mà không phải biết sẵn id. Spec thêm một API chỉ đọc `GET /users`: phân trang, lọc theo loại tài khoản và trạng thái, tìm theo email, tên hoặc số điện thoại. Không có bảng mới và không có migration, vì mọi thứ đã nằm trong bảng `users`. Chỉ admin gọi được, và mỗi lần gọi hệ thống đọc lại admin trong database (`@FreshAuth`, tức kiểm lại ngay thay vì tin token), vì danh sách lộ email và số điện thoại của mọi người.

## Requirements

**User stories**:
- Là admin, tôi muốn mở danh sách tài khoản, người mới đăng ký nằm trên, để thấy ai vừa vào.
- Là admin, tôi muốn lọc theo loại tài khoản và trạng thái, và gõ email, tên hoặc số điện thoại, để tìm đúng người cần khóa.
- Là admin, tôi muốn mỗi dòng có đủ id, trạng thái và lý do khóa, để bấm khóa hay mở khóa ngay mà không phải tra chỗ khác.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `GET /users` (quyền `user:read`) trả 200 `{ items, total, page, pageSize }`. Mỗi phần tử có đúng tám trường: `id`, `email`, `name` (có thể null), `phone` (có thể null), `accountType`, `status`, `lockedReason` (null khi tài khoản đang `active`), `createdAt`. Danh sách gồm mọi loại tài khoản, kể cả admin và tài khoản đang bị khóa, và bỏ tài khoản đã xóa mềm. Sắp người đăng ký mới nhất trước (`created_at` giảm dần, rồi `id` giảm dần). `page` mặc định 1, `pageSize` mặc định 20 và tối đa 50 như các danh sách khác. Trang quá cuối trả 200 với `items: []` và `total` đúng. `total` đếm mọi dòng khớp bộ lọc, không phụ thuộc trang.
- **AC-2**: Hai bộ lọc tùy chọn: `accountType` (`admin`, `landlord`, `tenant`) và `status` (`active`, `locked`), mỗi tham số một giá trị. Dùng cả hai thì dòng phải thỏa cả hai. `items` và `total` đều theo bộ lọc. Giá trị ngoài danh sách, hay tham số lạ, bị 400 `VALIDATION_FAILED` kèm tên trường sai.
- **AC-3**: Tìm kiếm `q`. Cắt khoảng trắng hai đầu, dài tối đa 254 ký tự (đủ dán một email), dài hơn bị 400 `VALIDATION_FAILED`; rỗng sau khi cắt thì không lọc chữ. Một dòng khớp khi email, tên hoặc số điện thoại chứa nguyên chuỗi `q` ở bất kỳ vị trí nào, không phân biệt hoa thường, kể cả chữ Việt có dấu (`NGUYỄN` và `nguyễn` tìm ra cùng một người). Dấu phải khớp: `nguyen` không tìm ra `Nguyễn`. Các ký tự `%`, `_` và `\` trong `q` được hiểu đúng là chính chúng, không phải ký tự đại diện. `q` kết hợp với hai bộ lọc ở AC-2 bằng AND.
- **AC-4**: Tìm theo số điện thoại không bị khoảng trắng, dấu chấm hay dấu gạch làm hỏng: `0901 234 567` tìm ra số lưu là `0901234567`. `q` dạng quốc tế đầy đủ (`+84901234567` hoặc `84901234567`, tức `84` cộng 9 chữ số) được đổi về `0901234567` trước khi so. Mọi dạng khác giữ nguyên chữ số đã gõ, nên `q=84` vẫn tìm chuỗi `84`, và `q` có chữ cái thì không so với cột số điện thoại.
- **AC-5**: `id` ở mỗi dòng chính là id mà `POST /users/:id/lock` và `POST /users/:id/unlock` nhận. Khóa một tài khoản bằng id lấy từ danh sách rồi đọc lại danh sách thì dòng đó có `status: "locked"` và `lockedReason` là lý do vừa nhập; mở khóa thì `status: "active"` và `lockedReason: null`. Danh sách luôn là trạng thái trong database ngay lúc gọi.
- **AC-6**: Phản hồi không lộ bí mật. Mỗi phần tử chỉ có tám trường ở AC-1; không có `passwordHash`, `passwordChangedAt`, `trialEndsAt`, thông tin phiên đăng nhập hay token ở bất kỳ chỗ nào của phản hồi.
- **AC-7**: Phân quyền. Không đăng nhập: 401 `TOKEN_MISSING`. `tenant` và `landlord`: 403 `PERMISSION_DENIED`, kể cả khi gửi bộ lọc sai (quyền được kiểm trước nên không ai dò được tham số); `user:read` chỉ admin giữ nên không cấp được cho loại khác (spec 0003 AC-6). Route gắn `@FreshAuth()` (spec 0003 AC-8): admin vừa bị khóa với token còn hạn bị 403 `ACCOUNT_LOCKED`; admin đã bị xóa mềm bị 401 `TOKEN_INVALID`. Các trường hợp bị từ chối không đọc bảng `users` để dựng danh sách.
- **AC-8**: Phản hồi 200 có header `Cache-Control: private, no-store`, vì có email và số điện thoại của người khác.

## Decision

**Chosen option**: Option 1: Một route `GET /users` trong module `users`, đọc thẳng bảng `users`, tìm chữ bằng `contains` không phân biệt hoa thường

Danh sách là một truy vấn đọc trên bảng `users` có sẵn (lọc `account_type`, `status`, khớp chữ trên `email`, `name`, `phone`), phân trang bằng `PaginationQueryDto` và trả `Page<T>` như các danh sách khác. Phản hồi chọn đúng tám cột bằng `select` nên `password_hash` không bao giờ rời database. Không migration, không bảng, không chỉ mục, không mã lỗi mới.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`)

## Feature design

Quy ước chung theo 0001 đến 0006 của nền móng: Repository bọc Prisma, `timestamptz`, tên bảng và cột `snake_case`, đọc thô bằng `$queryRaw` chỉ nằm trong file `*.repository.ts` (spec này không cần SQL thô).

**Data model**: không bảng mới, không cột mới, không migration, không chỉ mục mới. Danh sách đọc các cột có sẵn của `users` (mô hình đã được bạn xác nhận):

| Trường trả về | Cột | Ghi chú |
|---|---|---|
| `id` | `users.id` | uuidv7; chính là id của `lock` và `unlock` |
| `email` | `users.email` | đã lưu chữ thường |
| `name` | `users.name` | có thể null |
| `phone` | `users.phone` | đã chuẩn hóa dạng `0xxxxxxxxx`; có thể null |
| `accountType` | `users.account_type` | `admin`, `landlord` hoặc `tenant` |
| `status` | `users.status` | `active` hoặc `locked` |
| `lockedReason` | `users.locked_reason` | chỉ có giá trị khi đang khóa; mở khóa đặt về null |
| `createdAt` | `users.created_at` | ngày tham gia |
| không bao giờ | `password_hash` và mọi cột khác | `select` chỉ liệt kê tám cột trên |

Chỉ mục có sẵn `users_account_type_idx` phục vụ bộ lọc loại tài khoản. Bộ lọc `status` và tìm chữ quét bảng, chấp nhận được ở quy mô MVP (xem Consequences).

**State transitions**: không có. Spec này chỉ đọc; khóa và mở khóa vẫn do `ModerationController` của spec 0003.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/users` | GET | query tùy chọn: `page`, `pageSize`, `accountType`, `status`, `q` | 200 `{ items, total, page, pageSize }` | `user:read` (chỉ admin) và `@FreshAuth()` | 400 `VALIDATION_FAILED`, 401 `TOKEN_MISSING`, 401 `TOKEN_INVALID`, 403 `PERMISSION_DENIED`, 403 `ACCOUNT_LOCKED` |

Một phần tử của `items`:

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01",
  "email": "nam@example.com",
  "name": "Nguyễn Văn Nam",
  "phone": "0901234567",
  "accountType": "landlord",
  "status": "locked",
  "lockedReason": "Đăng tin giả mạo",
  "createdAt": "2026-10-05T03:00:00.000Z"
}
```

Không có mã lỗi mới: dùng `VALIDATION_FAILED`, `TOKEN_MISSING`, `TOKEN_INVALID`, `PERMISSION_DENIED`, `ACCOUNT_LOCKED` đã có.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi**: token (401) → kiểm lại admin trong database vì `@FreshAuth` (403 `ACCOUNT_LOCKED` hoặc 401 `TOKEN_INVALID`) → quyền `user:read` (403 `PERMISSION_DENIED`) → kiểm tham số (400). Người không phải admin gửi tham số sai nhận 403, không phải 400.
- **Bộ lọc**: `accountType` kiểm bằng `ACCOUNT_TYPES` có sẵn; `status` kiểm bằng một danh sách hằng mới `USER_STATUSES` (`active`, `locked`). Mỗi tham số nhận một giá trị. Tham số không khai báo bị từ chối bởi `ValidationPipe` toàn cục, như `sort` ở các danh sách khác.
- **Tìm chữ**: `q` đã cắt khoảng trắng, đưa nguyên chuỗi (không tách từ) vào một điều kiện `OR` trên `email`, `name`, `phone`. Mỗi vế là `contains` không phân biệt hoa thường (Prisma `mode: 'insensitive'`, tức `ILIKE`) với chuỗi đã qua `escapeLike`. Vế `phone` dùng chuỗi chữ số do `toPhoneNeedle(q)` trả về và chỉ có mặt khi hàm đó trả giá trị khác `null`.
- **`toPhoneNeedle(q)`** (hàm thuần, cạnh `normalizePhone` trong `src/common/phone.ts`): bỏ khoảng trắng, dấu chấm, dấu gạch; nếu còn đúng dạng `+84` hoặc `84` cộng 9 chữ số thì đổi bằng `normalizePhone` về `0` cộng 9 chữ số; nếu không thì trả chuỗi đó khi nó chỉ gồm chữ số; còn lại trả `null`. Nhờ giới hạn "đủ 9 chữ số" mà `q=84` không bị đổi thành `0`.
- **Thứ tự và phân trang**: `orderBy [{ createdAt: 'desc' }, { id: 'desc' }]`; `id` là uuidv7 theo thời gian nên khóa phụ này ổn định. Một lần `findMany` với `skip`, `take` và một lần `count` cùng `where`, chạy song song như `findModerationPage`.
- **Không cache**: header `Cache-Control: private, no-store` đặt bằng `@Header` như `FavoritesController` và `LandlordsController`.
- **Module**: `UsersController` mới trong `src/users/` (`@Controller('users')`, chỉ có `GET`), thêm vào `controllers` của `UsersModule`; không đụng `ModerationController` (chỉ có `POST :id/...`) nên hai controller cùng tiền tố `users` không trùng route. Truy vấn nằm ở `UsersRepository.findAdminPage`, luật nghiệp vụ mỏng ở `UsersService.listForAdmin`, hình dạng trả về ở `users.mapper.ts` (`AdminUserListItem`, `toAdminUserItem`). Danh sách và `lock`, `unlock` vẫn trả hai hình dạng khác nhau (`UserResponse` có sáu trường, không đổi).
- **Giới hạn tần suất**: không gắn `@RateLimited`; cổng giới hạn bỏ qua hoàn toàn route không gắn nhóm (bạn chọn ngày 2026-10-21, giống `GET /moderation/listings`).

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| `GET /users` | những tài khoản nào có mặt | bảng `users`, loại dòng có `deleted_at` khác null |
| `GET /users` | `id`, `email`, `name`, `phone` | cột cùng tên của `users` |
| `GET /users` | `accountType`, `status` | cột `account_type`, `status` |
| `GET /users` | `lockedReason` | cột `locked_reason` (do `lockActive` đặt, `unlockLocked` xóa) |
| `GET /users` | `createdAt` | cột `created_at` |
| `GET /users` | thứ tự | `created_at` giảm dần, rồi `id` giảm dần |
| `GET /users` | `total` | `count` với đúng `where` của trang |
| `GET /users` | `page`, `pageSize` | query, `PaginationQueryDto` |
| `GET /users` | bộ lọc loại và trạng thái | query `accountType`, `status`, so với `account_type`, `status` |
| `GET /users` | chuỗi so khớp email và tên | query `q` đã cắt khoảng trắng, qua `escapeLike` |
| `GET /users` | chuỗi so khớp số điện thoại | `toPhoneNeedle(q)`, suy ra từ `q` |
| `GET /users` | người gọi có phải admin | `user:read` trong quyền đọc lại từ database nhờ `@FreshAuth` (tính từ loại tài khoản; admin giữ mọi quyền) |
| `GET /users` | header `Cache-Control` | hằng `private, no-store` |

**Key invariants**:
- Phản hồi chỉ gồm tám trường do `select` ở Repository liệt kê; `password_hash` không được đọc ra khỏi database cho route này.
- Dòng `deleted_at` khác null không bao giờ hiện và không vào `total`.
- Mọi so khớp chữ đi qua `escapeLike`; `q` không bao giờ đổi nghĩa câu truy vấn.
- Thứ tự cố định theo (`created_at`, `id`) nên phân trang không lặp hay sót dòng khi không có ghi mới.
- Danh sách luôn phản ánh database lúc gọi; không có cache ở server hay trình duyệt.
- Spec này không ghi gì vào database.

**Security model**:
- Một route, cần `user:read`. Mô-đun `user` trong danh mục quyền có `read` là hành động chỉ admin (`adminActions`), nên không cấp được cho `landlord` hay `tenant` (spec 0003 AC-6) và không cần migration quyền. Admin giữ quyền này vì `ADMIN_PERMISSIONS` tính trong code.
- `@FreshAuth()`: mở rộng danh sách của spec 0003 AC-8 (hiện chỉ nêu thao tác ghi) sang một thao tác đọc, vì danh sách gom email và số điện thoại của mọi người. Admin vừa bị khóa hay bị hạ quyền mất đường đọc ngay, không chờ token hết hạn.
- Dữ liệu cá nhân: email, số điện thoại, tên. Dự án chưa khai phạm vi tuân thủ riêng. Không có nhật ký đọc (xem Consequences).
- Admin xem được cả tài khoản admin khác; khóa admin khác đã được spec 0003 cho phép (chỉ cấm tự khóa mình).

**Configuration required**: không có biến môi trường, dịch vụ ngoài, seed hay migration.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: admin mở `GET /users`: dòng đăng ký mới nhất nằm đầu, mỗi phần tử đúng tám trường, không có `passwordHash` ở bất kỳ đâu trong JSON, `total` khớp một phép đếm độc lập tính từ dòng thô, verifies **AC-1**, **AC-6**
- Happy path: lọc `accountType=landlord&status=locked`; tìm theo email, theo tên viết hoa và viết thường kể cả chữ có dấu (`NGUYỄN` và `nguyễn`), theo số `0901 234 567` và `+84901234567`; `q=84` tìm chuỗi `84`; `q=%` và `q=_` không khớp mọi dòng; `q` toàn khoảng trắng như không có `q`, verifies **AC-2**, **AC-3**, **AC-4**
- Happy path: khóa một tài khoản bằng id lấy từ danh sách rồi đọc lại: `locked` kèm lý do; mở khóa: `active`, `lockedReason` null, verifies **AC-5**
- Failure case: trang quá cuối trả `items: []` và `total` đúng; `pageSize=51`, `accountType=root`, `status=x`, `sort=asc` và `q` dài 255 ký tự mỗi cái bị 400 `VALIDATION_FAILED` đúng tên trường; một dòng xóa mềm chèn tay không hiện và không tính vào `total`, verifies **AC-1**, **AC-2**, **AC-3**
- Auth/permission: khách 401; `tenant` và `landlord` 403 (cả khi gửi bộ lọc sai); admin vừa bị khóa với token còn hạn 403 `ACCOUNT_LOCKED`; admin đã xóa mềm 401 `TOKEN_INVALID`; cấp `user:read` cho `landlord` qua `PATCH /account-types/landlord` bị 400 `PERMISSION_ADMIN_ONLY`, verifies **AC-7**
- Happy path: phản hồi 200 có `Cache-Control: private, no-store`, verifies **AC-8**
- Điều khiển âm (bước kiểm thật, không phải test tự động): bỏ `escapeLike`, bỏ điều kiện xóa mềm, và đổi `select` thành lấy mọi cột; mỗi thay đổi phải bị đúng kiểm tra tương ứng bắt, verifies **AC-1**, **AC-3**, **AC-6**
- Kiểm bằng `EXPLAIN` (không phải test tự động): khoảng 50 nghìn người dùng trên database thử; đo trang đầu không lọc, lọc `status=locked`, và `q` khớp giữa email; đo một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-1**, **AC-3**

## Build plan

Hướng build theo Skateboard (bản mỏng nhất dùng được trước, rồi mới mở rộng): đây chỉ là một route đọc nên một mốc, một lần `/develop`, rồi dừng cho bạn review (khớp ô `Build it` trong scope). Quy tắc tài liệu sống: cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong mốc này.

**Mốc 1: danh sách người dùng cho admin**
1. Hằng `USER_STATUSES` và kiểu `UserStatus` (file `src/users/user-status.ts`) và hàm `toPhoneNeedle` trong `src/common/phone.ts`, kèm test đơn vị cho `toPhoneNeedle` (các ca ở AC-4, gồm `q=84`, `+84`, chuỗi có chữ cái, chuỗi rỗng), satisfies **AC-2**, **AC-4**
2. `ListUsersQueryDto` (kế thừa `PaginationQueryDto`; `accountType` kiểm bằng `ACCOUNT_TYPES`, `status` bằng `USER_STATUSES`, `q` có `@Trim()`, `@IsString()`, `@MaxLength(254)`), kèm test DTO (giá trị lạ, tham số lạ, `q` quá dài), satisfies **AC-2**, **AC-3**
3. `UsersRepository.findAdminPage(filter, skip, take)` với `select` liệt kê đúng tám cột, `where` gồm điều kiện xóa mềm, bộ lọc và vế `OR` của `q` (đã qua `escapeLike`), `findMany` và `count` song song; kiểu `AdminUserRow`; `UsersService.listForAdmin(query)` (tính `toPhoneNeedle`, bỏ `q` rỗng, `toPage`); `toAdminUserItem` trong `users.mapper.ts`; test đơn vị cho Repository (hình dạng `where` với từng tổ hợp bộ lọc), Service và mapper (không có `passwordHash`), satisfies **AC-1** đến **AC-4**, **AC-6**
4. `UsersController` (`GET /users`: `@RequirePermissions('user:read')`, `@FreshAuth()`, `@Header('Cache-Control', 'private, no-store')`, không `@RateLimited`) vào `controllers` của `UsersModule`; test duyệt route khai báo quyền chạy lại, satisfies **AC-1**, **AC-5**, **AC-7**, **AC-8**
5. Kiểm thật trên database thử (xem Critical test scenarios: mọi AC, tên có dấu viết hoa và viết thường để xác nhận locale của database, ba điều khiển âm, khóa rồi mở khóa qua id từ danh sách), `EXPLAIN` một lần ở khoảng 50 nghìn người dùng (ghi số, không chỉnh), và `verify.md`, satisfies **AC-1** đến **AC-8**
6. Tài liệu: Postman folder 20 `Danh sách người dùng (admin)` (request cho mọi AC, kèm một request khóa rồi mở khóa dùng id lấy từ danh sách); `api-for-frontend.md` thêm mục 6.34 `Danh sách người dùng (admin)`, sửa bullet "Khóa, mở khóa" và thêm bullet danh sách vào "Màn hình admin" (gồm ghi chú: phản hồi `lock` và `unlock` không có `lockedReason` và `createdAt`, nên FE tải lại danh sách hoặc tự ghép trường `status` và lý do vừa nhập), bỏ dòng "Chưa có API danh sách người dùng" ở mục giới hạn đã biết, sửa dòng "sau" ở mục 10, thêm một mục nhật ký, satisfies **AC-1** đến **AC-8**

## Consequences

**Positive**:
- Một route, không bảng, không migration, không mã lỗi mới, không biến môi trường: gọn đúng tinh thần MVP.
- Đóng đúng lỗ hổng đã ghi ở tài liệu FE: màn hình admin tìm được người để khóa hay mở khóa mà không phải biết sẵn id.
- Tái dùng gần hết thứ có sẵn: `PaginationQueryDto`, `Page<T>`, `escapeLike`, quyền `user:read`, `@FreshAuth`, `@Header`.
- Hình dạng trả về là danh sách trắng chọn đúng cột nên mật khẩu băm không có đường rò ra, kể cả khi sau này ai đó thêm cột vào `users`.

**Negative / tradeoffs**:
- Tìm tên phải gõ đúng dấu: `nguyen` không tìm ra `Nguyễn`. Admin tìm bằng email hoặc số điện thoại không bị ảnh hưởng. Muốn không phân biệt dấu như tìm tin thì phải thêm cột `users.search_key` kèm migration và điền dữ liệu cũ.
- Việc không phân biệt hoa thường với chữ có dấu nhờ vào locale của database (`ILIKE`). Locale UTF-8 như `en_US.utf8` thì đúng; locale `C` chỉ gập chữ ASCII. Bước kiểm thật xác nhận trên database thử, và database dùng khi đóng gói phải tạo với locale UTF-8.
- Tìm chữ ở giữa chuỗi (`%chữ%`) không dùng được chỉ mục btree nên quét cả bảng `users`; bộ lọc `status` cũng quét. Ổn ở vài nghìn tài khoản. Ở khoảng 50 nghìn sẽ đo một lần rồi giữ nguyên; nếu sau này chậm, thêm chỉ mục GIN `pg_trgm` như tin đăng (tiện ích đã bật ở migration đầu).
- Không có giới hạn tần suất: token admin bị đánh cắp có thể lật hết từng trang 50 dòng và chép email, số điện thoại của mọi người. Giảm nhẹ bằng `@FreshAuth`, access token ngắn hạn, và chỉ admin gọi được. Bạn đã chọn không thêm.
- Không có nhật ký đọc: không ai biết admin nào đã xem danh sách. `moderation_logs` ghi hành động có đích; mở danh sách không có đích.
- Mỗi lần gọi đọc thêm một dòng `users` để kiểm lại admin (`@FreshAuth`); chỉ admin gọi nên chấp nhận.
- Phản hồi `lock` và `unlock` vẫn là `UserResponse` sáu trường, không có `lockedReason` và `createdAt`. FE không thể thay cả dòng bằng phản hồi đó mà phải tải lại hoặc tự ghép.
- Đây là route đọc đầu tiên gắn `@FreshAuth()`; danh sách "bắt buộc gắn `@FreshAuth()`" của spec 0003 AC-8 cần thêm dòng này (xem Follow-up).

**Neutral**:
- Thêm `UsersController` đầu tiên cho `UsersModule`, `findAdminPage` ở `UsersRepository`, `listForAdmin` ở `UsersService`, `ListUsersQueryDto`, `USER_STATUSES` và `toPhoneNeedle`.
- Quyền `user:read` đã có trong danh mục từ spec 0003 và chưa route nào dùng; không cần migration quyền.
- Số `0007` không trùng spec nào; thư mục riêng nên không đụng các spec con của 0001.
- Hàng 14 không phụ thuộc hàng nào khác; chỉ cần `lock` và `unlock` của hàng 5.

## Follow-up

- [ ] Hoãn, thêm lại bằng `/scope` khi cần: chi tiết một tài khoản (`GET /users/:id`), tham số `sort`, thời điểm đăng nhập gần nhất, người khóa và lúc khóa (từ `moderation_logs`), thông tin chủ trọ (hạn dùng thử, số tin, gói), tìm tên không phân biệt dấu (`users.search_key`), giới hạn tần suất cho danh sách, nhật ký đọc, đếm theo loại và trạng thái, xuất danh sách.
- [ ] Spec 0003 AC-8 liệt kê route bắt buộc `@FreshAuth()` chỉ gồm thao tác ghi; cần `/architect` sửa một dòng để thêm `GET /users`.
- [ ] Khi đóng gói (spec `0001/0006-docker-packaging-and-release.md`), tạo database với locale UTF-8 để tìm tên có dấu không phân biệt hoa thường đúng.
- [ ] Sau khi build, `/sync` ghi route `GET /users` và việc dùng `user:read` vào spec 0003 (AC-7) nếu còn lệch.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
