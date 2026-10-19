# 0003. Dùng thử miễn phí và hạn mức tin của chủ trọ

**Date**: 2026-10-16
**Status**: In Progress

## Summary

Mỗi chủ trọ mới được dùng thử miễn phí một thời gian (mặc định 30 ngày) và chỉ được có một số tin đang hiện nhất định (mặc định 2). Hết kỳ dùng thử mà chưa có gói thì hạn mức về 0: mọi tin của họ biến khỏi kết quả công khai ngay, không cần việc nền; còn trong kỳ mà hạn mức bị hạ thấp hơn số tin đang hiện thì chỉ các tin đăng sớm nhất còn hiện. Hạn dùng thử lưu thành một cột trên tài khoản lúc đăng ký, hai con số 30 và 2 nằm trong bảng `settings` để admin đổi qua API, và mọi chỗ cần biết "được bao nhiêu tin" đều hỏi một hàm duy nhất, để hàng 10 (mua gói) chỉ việc cắm nhánh gói vào. Đăng hoặc hiện thêm tin được kiểm trong một giao dịch có khóa dòng người dùng nên hai yêu cầu cùng lúc không vượt hạn mức.

## Requirements

**User stories**:
- Là chủ trọ mới, tôi muốn dùng thử miễn phí để đăng vài tin và tự thấy hệ thống có ích trước khi mua gói.
- Là chủ trọ, tôi muốn biết kỳ dùng thử còn bao lâu, hạn mức bao nhiêu tin, đang dùng bao nhiêu, và tin nào đang bị ẩn khỏi công khai vì vượt hạn mức, để biết khi nào cần ẩn bớt hoặc mua gói.
- Là người tìm trọ, tôi không muốn thấy tin của chủ trọ đã hết quyền đăng.
- Là admin, tôi muốn đổi số ngày dùng thử và số tin dùng thử mà không sửa code.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: Đăng ký `landlord` đặt `users.trial_ends_at` bằng thời điểm đăng ký cộng `trial_days` ngày (đọc từ `settings` lúc đó, chính xác đến mili giây, không làm tròn theo ngày); đăng ký `tenant` và tài khoản `admin` do seed tạo để cột này rỗng. Đăng ký landlord trùng số điện thoại vẫn 409 `PHONE_TAKEN` và không tạo thêm kỳ dùng thử (một số điện thoại một lần dùng thử, đã làm ở AC-13 của spec đăng nhập, con 0002 của 0001).
- **AC-2**: Admin xem và đổi hai tham số bằng API. `GET /settings` (quyền `setting:read`) liệt kê `trial_days` và `trial_listing_limit` với giá trị hiện hành (30 và 2 khi chưa có dòng trong DB), khoảng cho phép, `updatedAt` và `updatedBy`. `PATCH /settings/:key` (quyền `setting:update`, `@FreshAuth()`) đổi một khóa và ghi `updated_at`, `updated_by`; giá trị không phải số nguyên hoặc ngoài khoảng (`trial_days` 0 đến 365, `trial_listing_limit` 0 đến 100) bị 400 `VALIDATION_FAILED`; khóa lạ bị 404 `NOT_FOUND`; chủ trọ và người tìm trọ bị 403 `PERMISSION_DENIED`. Đổi `trial_days` chỉ ảnh hưởng chủ trọ đăng ký sau đó; đổi `trial_listing_limit` có hiệu lực ngay cho mọi chủ trọ còn trong kỳ dùng thử.
- **AC-3**: Hạn mức hiện hành của một chủ trọ là `trial_listing_limit` khi `trial_ends_at` lớn hơn thời điểm hiện tại (so sánh chặt: đúng lúc `trial_ends_at` là hết), ngược lại 0. Tài khoản không có `trial_ends_at` (admin) có hạn mức 0. Hạn mức nằm ở một hàm duy nhất; hàng 10 thêm nhánh "gói còn hiệu lực thì theo hạn mức của gói" ở đúng hàm đó.
- **AC-4**: `POST /properties/:propertyId/listings` kiểm hạn mức trong một giao dịch có khóa dòng `users` của người gọi. Hết dùng thử và chưa có gói thì 403 `MEMBERSHIP_REQUIRED`; còn hiệu lực nhưng số tin đang hiện đã bằng hoặc vượt hạn mức thì 403 `LISTING_QUOTA_REACHED`; còn chỗ thì 201. Lỗi nhà trọ không có (404) và nhà trọ của người khác (403) được báo trước hai lỗi này. Bị chặn thì không có tin nào được tạo.
- **AC-5**: `POST /listings/:id/show` kiểm hạn mức như AC-4. Thứ tự báo lỗi: 404 hoặc 403 sở hữu, rồi 403 `LISTING_HIDDEN_BY_ADMIN` hoặc 409 `LISTING_STATE_INVALID`, rồi `MEMBERSHIP_REQUIRED`, rồi `LISTING_QUOTA_REACHED`. Tin admin vừa gỡ ẩn (về `hidden_by_owner`) cũng đi qua kiểm tra này khi chủ trọ hiện lại.
- **AC-6**: Chỉ tin `visible` chưa xóa mềm tính vào số tin đang hiện, kể cả tin đang bị ẩn bớt khỏi công khai vì vượt hạn mức (trạng thái của chúng vẫn là `visible`). Ẩn hoặc xóa một tin trả lại một chỗ, đăng hoặc hiện thêm được ngay. Hết dùng thử không chặn `hide`, `PATCH` và `DELETE` tin, cũng không chặn tạo, sửa, xóa nhà trọ.
- **AC-7**: Hai yêu cầu đăng hoặc hiện tin của cùng một chủ trọ khi chỉ còn một chỗ xếp hàng nhờ khóa dòng `users`: đúng một yêu cầu thành công, yêu cầu kia nhận 403 `LISTING_QUOTA_REACHED`. Qua hai đường đăng và hiện, số tin đang hiện không bao giờ vượt hạn mức.
- **AC-8**: Hết kỳ dùng thử mà không có gói: mọi tin của chủ trọ biến khỏi `GET /listings` và `GET /listings/:slugCode` (404 `LISTING_NOT_FOUND`) ngay từ thời điểm `trial_ends_at`, không cần tiến trình nền. Chủ trọ vẫn xem, sửa, ẩn, xóa tin của mình ở `/me/listings`.
- **AC-9**: Khi số tin đang hiện của chủ trọ lớn hơn hạn mức hiện hành (ví dụ admin hạ `trial_listing_limit`), chỉ N tin đăng sớm nhất (xếp theo `created_at` rồi `id`, N là hạn mức) còn hiện ở `GET /listings` và `GET /listings/:slugCode`; các tin còn lại bị ẩn khỏi hai route đó (chi tiết trả 404) nhưng `status` vẫn `visible`. Chủ trọ ẩn hoặc xóa một tin thì tin đăng sớm nhất kế tiếp trong số bị ẩn bớt hiện lại.
- **AC-10**: `GET /me/membership` (quyền `subscription:read`) trả `state` (`trial` hoặc `expired`), `trialEndsAt`, `trialDaysLeft`, `listingLimit`, `visibleCount`, `remaining`, `overLimitCount`. Người tìm trọ nhận 403 `PERMISSION_DENIED`; người chưa đăng nhập 401.
- **AC-11**: Mọi tin của chủ trọ (`GET /me/listings`, `GET /me/listings/:id`, kết quả các route ghi `POST` đăng, `PATCH`, `hide`, `show`) có thêm `isPublic`: `true` khi `status` là `visible` và tin nằm trong hạn mức hiện hành, ngược lại `false`.
- **AC-12**: Một migration thêm cột `users.trial_ends_at`, `CHECK users_landlord_trial_check` và bảng `settings`; chủ trọ có sẵn nhận hạn bằng thời điểm chạy migration cộng 30 ngày; migration áp được lên DB trống lẫn DB có dữ liệu và `prisma migrate diff` không báo lệch. Seed chỉ thêm hai dòng mặc định còn thiếu (`trial_days` = 30, `trial_listing_limit` = 2), không ghi đè dòng admin đã sửa. Thiếu dòng hoặc giá trị hỏng trong `settings` thì code dùng giá trị mặc định và ghi log cảnh báo, không trả 500.
- **AC-13**: Với khoảng 60 nghìn tin giả lập, câu lấy một trang của `GET /listings` chạy dưới 100 ms và câu đếm tổng dưới 300 ms (đo bằng `EXPLAIN ANALYZE` trên máy dev). Vượt ngân sách thì áp phương án dự phòng ở Build plan, bước 7.

## Decision

**Chosen option**: Option 1: Hạn dùng thử lưu một cột lúc đăng ký, hạn mức suy ra lúc đọc từ một hàm duy nhất, tin vượt hạn mức bị ẩn bớt khỏi công khai theo thứ tự đăng.

Cột `users.trial_ends_at` cố định lúc đăng ký (không tính sống từ `trial_days`), hai tham số trong bảng `settings` có API cho admin, hạn mức hiện hành tính một lần ở `MembershipsService` (không lưu), đăng và hiện tin kiểm hạn mức trong giao dịch khóa dòng `users`, và điều kiện hiển thị công khai thêm vế "xếp hạng trong các tin đang hiện của chủ trọ không vượt hạn mức" viết đúng một lần thành mảnh SQL.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Feature design

Quy ước chung theo bộ spec nền 0001 (các con 0001 đến 0006) và spec nhà trọ 0002: Repository bọc Prisma (chỉ `*.repository.ts` import giá trị từ Prisma), id `uuidv7()`, `timestamptz`, tên bảng và cột `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`, giao dịch qua `TransactionRunner`, mã lỗi trong `ErrorCode` với câu tiếng Việt, API có tiền tố `/api/v1`.

**Data model sketch** (một migration, tên dạng `<ngày>_free_trial_settings`):

| Bảng | Khóa chính | Cột | Ràng buộc và chỉ mục |
|---|---|---|---|
| `users` (đã có) | `id` | thêm `trial_ends_at` (`timestamptz`, rỗng được) | `CHECK users_landlord_trial_check`: `account_type <> 'landlord' OR trial_ends_at IS NOT NULL` (giống `users_landlord_phone_check`). Landlord có sẵn được điền `now() + interval '30 days'` ngay trong migration, rồi mới thêm `CHECK`. Tenant và admin để rỗng |
| `settings` (mới) | `key` (text) | `value` (text, bắt buộc), `updated_at` (`timestamptz`, mặc định `now()`), `updated_by` (uuid, rỗng được) | `CHECK settings_key_check`: `key ~ '^[a-z][a-z0-9_]{1,59}$'`; `updated_by` là khóa ngoại tới `users(id)` với `ON DELETE SET NULL` (`settings_updated_by_fk`) |

Hạn mức hiện hành và "tin đang hiện công khai" là **dữ liệu suy ra lúc đọc, không lưu** (không cột cờ, không bảng sao chép). Bảng khóa của `settings` do code đăng ký (`SETTING_DEFINITIONS`): mỗi khóa có kiểu số nguyên, khoảng cho phép và giá trị mặc định.

| Khóa | Mặc định | Khoảng | Ý nghĩa |
|---|---|---|---|
| `trial_days` | 30 | 0 đến 365 | Số ngày dùng thử của chủ trọ đăng ký SAU khi đổi. `0` nghĩa là hết dùng thử ngay lúc đăng ký (cách dựng cảnh "hết quyền" khi demo) |
| `trial_listing_limit` | 2 | 0 đến 100 | Số tin đang hiện tối đa trong kỳ dùng thử, áp ngay cho mọi chủ trọ còn trong kỳ |

**Hạn mức hiện hành** (`MembershipsService.resolve(userId, now, tx?)`, một nơi duy nhất; hàng 10 chỉ thêm nhánh đầu):

1. (hàng 10) Có gói còn hiệu lực (`ends_at` lớn hơn `now`): `state = 'plan'`, hạn mức là số tin tối đa của gói. Gói thay hạn mức dùng thử khi còn hiệu lực.
2. `trial_ends_at` lớn hơn `now`: `state = 'trial'`, hạn mức là `trial_listing_limit`.
3. Còn lại: `state = 'expired'`, hạn mức 0 (kể cả tài khoản không có `trial_ends_at`).

**Điều kiện hiển thị công khai** (thay `visibleListingsQuery` của 0002; vế mới là vế cuối): tin `status = 'visible'` và chưa xóa mềm, nhà trọ chưa xóa mềm, chủ trọ `status = 'active'` và chưa xóa mềm, **và** `rank` của tin không vượt hạn mức hiện hành của chủ trọ, với `rank` = 1 cộng số tin `visible` chưa xóa của cùng chủ trọ có `(created_at, id)` nhỏ hơn. Hạn mức 0 thì không tin nào qua, nên "hết kỳ thì mọi tin biến" là trường hợp riêng của cùng luật. Viết đúng một lần thành mảnh SQL `publicListingCondition(now, trialListingLimit)`; hình dạng:

```sql
-- l = listings, p = properties, u = users; $now và $trialLimit do ứng dụng truyền vào
l.status = 'visible' AND l.deleted_at IS NULL
AND p.deleted_at IS NULL
AND u.status = 'active' AND u.deleted_at IS NULL
AND u.trial_ends_at > $now                         -- hàng 10: OR có gói còn hiệu lực
AND (SELECT count(*) FROM listings l2 JOIN properties p2 ON p2.id = l2.property_id
     WHERE p2.landlord_id = u.id AND l2.status = 'visible' AND l2.deleted_at IS NULL
       AND (l2.created_at, l2.id) < (l.created_at, l.id))
    < $trialLimit                                  -- hàng 10: hạn mức của gói khi có gói
```

Prisma không diễn đạt được phép xếp hạng này, nên các đường đọc công khai chạy **hai bước**: bước một là SQL thô (`$queryRaw` có kiểu) lấy `id` của một trang theo đúng thứ tự cộng tổng số bằng cùng mảnh điều kiện; bước hai là `findMany({ where: { id: { in } }, include })` rồi xếp lại theo thứ tự của bước một. Chi tiết theo mã (`GET /listings/:slugCode`) cũng đi hai bước. Bộ lọc `q`, `wardCode`, `minPrice`, `maxPrice` và `sort` của 0002 giữ nguyên, chỉ chuyển sang dạng mảnh SQL.

**State transitions**: không thêm trạng thái. Chỉ `create` và `show` (đưa tin về `visible`) có thêm cửa kiểm hạn mức; `hide`, `PATCH`, `DELETE` không bị chặn bởi hạn mức.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/auth/register` | POST | không đổi | không đổi (`user` vẫn 6 trường; `trial_ends_at` nằm trong DB, lấy qua `/me/membership`) | công khai | không đổi |
| `/properties/:propertyId/listings` | POST | không đổi | 201 tin của chủ trọ, thêm `isPublic` | `listing:create` | 403 `MEMBERSHIP_REQUIRED`, 403 `LISTING_QUOTA_REACHED` (sau 404 và 403 sở hữu) |
| `/listings/:id/show` | POST | không đổi | tin của chủ trọ, thêm `isPublic` | `listing:update` | 403 `MEMBERSHIP_REQUIRED`, 403 `LISTING_QUOTA_REACHED` (sau 403 `LISTING_HIDDEN_BY_ADMIN`, 409 `LISTING_STATE_INVALID`) |
| `/listings` | GET | không đổi | chỉ tin trong hạn mức (luật hiển thị mới) | công khai | không đổi |
| `/listings/:slugCode` | GET | không đổi | như cũ | công khai, đọc đăng nhập tùy chọn | 404 `LISTING_NOT_FOUND` khi tin hết hiển thị vì hạn mức |
| `/me/listings`, `/me/listings/:id`, `/listings/:id` (PATCH), `/listings/:id/hide` | GET, GET, PATCH, POST | không đổi | thêm `isPublic` vào tin tóm tắt và tin của chủ trọ | như cũ | không đổi |
| `/me/membership` | GET | không | `{ state, trialEndsAt, trialDaysLeft, listingLimit, visibleCount, remaining, overLimitCount }` | `subscription:read` | 403 `PERMISSION_DENIED` |
| `/settings` | GET | không | mảng `{ key, value, min, max, updatedAt, updatedBy }` (hai khóa; không phân trang vì là danh mục cố định hai dòng) | `setting:read` | 403 |
| `/settings/:key` | PATCH | `value: integer` (req) | một phần tử như trên | `setting:update`, `@FreshAuth()` | 400 `VALIDATION_FAILED`, 404 `NOT_FOUND`, 403 |

Mã lỗi mới (thêm vào `ErrorCode`, câu tiếng Việt, đều 403 vì nguyên nhân là quyền của tài khoản chứ không phải trạng thái của tin; body lỗi giữ dạng chung, con số hạn mức lấy từ `/me/membership`):

| Mã | Status | Khi nào | Câu |
|---|---|---|---|
| `MEMBERSHIP_REQUIRED` | 403 | Đăng hoặc hiện tin khi `state = 'expired'` | "Kỳ dùng thử của bạn đã hết và chưa có gói đang hiệu lực. Hãy mua gói để đăng hoặc hiện tin." |
| `LISTING_QUOTA_REACHED` | 403 | Đăng hoặc hiện tin khi còn hiệu lực nhưng số tin đang hiện đã bằng hoặc vượt hạn mức | "Bạn đã dùng hết số tin được hiện theo hạn mức hiện tại. Hãy ẩn hoặc xóa bớt một tin, hoặc nâng gói, để đăng thêm." |

Hình dạng `GET /me/membership` (hàng 10 chỉ thêm `state = 'plan'` và trường `subscription`, không đổi các trường này):

```json
{
  "state": "trial",
  "trialEndsAt": "2026-11-15T03:00:00.000Z",
  "trialDaysLeft": 29,
  "listingLimit": 2,
  "visibleCount": 1,
  "remaining": 1,
  "overLimitCount": 0
}
```

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Mọi nơi cần "bây giờ" | `now` | đồng hồ ứng dụng, lấy một lần mỗi request rồi truyền xuống Service, Repository và SQL (một đồng hồ, kiểm thử được bằng cách truyền giá trị cố định) |
| Đăng ký landlord | `users.trial_ends_at` | `now` + `settings.trial_days` ngày, tính bằng `now.getTime() + ngày * 86400000`; `trial_days` đọc lúc đăng ký, thiếu hoặc hỏng thì mặc định 30 |
| Đăng ký tenant, seed admin | `users.trial_ends_at` | rỗng |
| Hạn mức hiện hành | `state` và `limit` | `users.trial_ends_at` so với `now`, cộng `settings.trial_listing_limit` đọc từ DB (có kiểm khoảng, hỏng thì mặc định 2); hàng 10 thêm gói |
| Kiểm khi đăng hoặc hiện | số tin đang hiện | `count` tin `status = 'visible'`, `deleted_at IS NULL`, qua `properties.landlord_id = sub` của token, đọc trong giao dịch đã khóa dòng `users` |
| Kiểm khi đăng hoặc hiện | lỗi nào | `state = 'expired'` thì `MEMBERSHIP_REQUIRED`; `state` còn hiệu lực và số tin đang hiện không nhỏ hơn hạn mức thì `LISTING_QUOTA_REACHED` |
| Danh sách và chi tiết công khai | tin có hiện không | mảnh `publicListingCondition(now, trialListingLimit)`; `trialListingLimit` đọc một lần mỗi request từ `settings` |
| `/me/membership` | `state`, `trialEndsAt`, `listingLimit` | như "Hạn mức hiện hành"; `trialEndsAt` là cột (rỗng với admin) |
| `/me/membership` | `trialDaysLeft` | `ceil((trialEndsAt - now) / 86400000)` khi `state = 'trial'`; `0` khi `expired`; `null` khi `trialEndsAt` rỗng |
| `/me/membership` | `visibleCount`, `remaining`, `overLimitCount` | `visibleCount` như trên; `remaining = max(0, listingLimit - visibleCount)`; `overLimitCount = max(0, visibleCount - listingLimit)` |
| Tin của chủ trọ | `isPublic` | `status = 'visible'` và `id` nằm trong N tin `visible` chưa xóa đăng sớm nhất của chủ trọ (`created_at` rồi `id`, N là hạn mức hiện hành); một truy vấn `LIMIT N` cho mỗi request |
| `GET /settings` | `value`, `min`, `max` | dòng `settings` (ép số nguyên, hỏng hoặc thiếu thì mặc định); `min`, `max` từ `SETTING_DEFINITIONS` |
| `GET /settings` | `updatedAt`, `updatedBy` | cột cùng tên; rỗng khi chưa có dòng |
| `PATCH /settings/:key` | `updated_by`, `updated_at` | `sub` trong token (đọc lại từ DB do `@FreshAuth()`), `now` |
| `PATCH /settings/:key` | khoảng hợp lệ | `SETTING_DEFINITIONS[key].min` và `.max` |

**Key invariants**:
- Chủ trọ luôn có `trial_ends_at` (`CHECK` ở DB); `settings.key` đúng dạng.
- Qua `create` và `show`, số tin đang hiện của một chủ trọ không vượt hạn mức hiện hành: kiểm và ghi nằm trong cùng giao dịch, sau khi khóa dòng `users` của chủ trọ bằng `SELECT ... FOR UPDATE`. Số tin đang hiện chỉ có thể vượt hạn mức khi hạn mức bị hạ từ bên ngoài (admin đổi tham số, hết gói, hết dùng thử), và khi đó luật hiển thị ẩn bớt phần vượt.
- **Thứ tự khóa** mọi đường: dòng `users` trước, rồi dòng `properties`, rồi `listings`. `create` khóa `users` rồi khóa nhà trọ (đổi thứ tự hiện tại là khóa nhà trọ trước); `show` chỉ khóa `users`; `update` tin, `PATCH` và `DELETE` nhà trọ không khóa `users`, nên không có vòng chờ.
- Tin có công khai hay không là suy ra từ một mảnh SQL duy nhất; không cờ sao chép, không việc nền.
- Giá trị `settings` luôn được ép kiểu và kiểm khoảng khi đọc; hỏng thì dùng mặc định và ghi log cảnh báo (tối đa một lần mỗi khóa mỗi tiến trình, để không tràn log ở đường đọc công khai).
- Mọi `Date` so với `trial_ends_at` đều đến từ một `now` do ứng dụng lấy, không trộn đồng hồ ứng dụng với `now()` của DB trong cùng một quyết định.

**Security model**:
- `GET /me/membership`: chỉ chủ của dữ liệu (đọc theo `sub`); quyền `subscription:read` landlord đã có sẵn, tenant không có. Admin có quyền nhưng nhận `state = 'expired'` với `trialEndsAt` rỗng, vô hại.
- `GET /settings` và `PATCH /settings/:key`: chỉ admin (`setting:*` là quyền chỉ admin giữ, theo spec phân quyền con 0003 của 0001); `PATCH` thêm `@FreshAuth()` vì tham số quyết định ai thấy tin của ai. Không giới hạn tần suất thêm (admin, theo 0002).
- Không có dữ liệu cá nhân mới; không có quy định tuân thủ riêng. Thanh toán chỉ là thanh toán thử (hàng 10), không có tiền thật.
- Tài khoản admin không có kỳ dùng thử nên không đăng được tin (`MEMBERSHIP_REQUIRED`) và tin do admin sở hữu (nếu có) không hiện công khai.

**Configuration required**: không có biến môi trường hay bí mật mới. Hai tham số nghiệp vụ nằm trong bảng `settings`.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: đăng ký landlord, `trial_ends_at` bằng thời điểm đăng ký cộng 30 ngày; đăng 2 tin, tin thứ 3 nhận `LISTING_QUOTA_REACHED`; ẩn một tin thì đăng được tin thứ 3, verifies **AC-1**, **AC-3**, **AC-4**, **AC-6**
- Happy path: `GET /me/membership` đúng các con số trong và sau khi đăng, verifies **AC-10**
- Failure case: đặt tay `trial_ends_at` về quá khứ: mọi tin của chủ trọ biến khỏi danh sách và chi tiết công khai ngay (không cần restart hay việc nền), `/me/listings` vẫn thấy, đăng và hiện nhận `MEMBERSHIP_REQUIRED`, `hide`, `PATCH`, `DELETE` và tạo nhà trọ vẫn được, verifies **AC-4**, **AC-5**, **AC-6**, **AC-8**
- Failure case: chủ trọ có 3 tin `visible`, admin hạ `trial_listing_limit` xuống 2: tin đăng sớm nhất hai tin còn hiện, tin thứ 3 biến khỏi công khai, `status` vẫn `visible`, `isPublic` false; chủ trọ xóa tin thứ nhất thì tin thứ 3 hiện lại; `overLimitCount` đúng, verifies **AC-9**, **AC-10**, **AC-11**
- Failure case: hai yêu cầu `POST` đăng tin song song khi còn đúng một chỗ: một 201, một `LISTING_QUOTA_REACHED`; trộn một yêu cầu `show` với một yêu cầu đăng: cũng đúng một thành công, verifies **AC-7**
- Failure case: `show` tin do admin vừa gỡ ẩn khi chủ trọ đã đủ hạn mức: `LISTING_QUOTA_REACHED`; tin `hidden_by_admin` thì `LISTING_HIDDEN_BY_ADMIN` đến trước, verifies **AC-5**
- Failure case: xóa dòng `settings`, hoặc đặt `value` thành chữ: đăng ký vẫn thành công với 30 ngày, hạn mức mặc định 2, có log cảnh báo, không 500, verifies **AC-12**
- Failure case: đăng ký landlord trùng số điện thoại: 409 `PHONE_TAKEN`, không có tài khoản hay kỳ dùng thử mới, verifies **AC-1**
- Auth/permission: tenant gọi `GET /me/membership`, `GET /settings`, `PATCH /settings/:key`: 403 `PERMISSION_DENIED`; chủ trọ gọi hai route settings: 403; admin `PATCH` với token chưa đọc lại quyền (khóa hoặc đổi quyền giữa chừng): bị từ chối do `@FreshAuth()`; giá trị 366 cho `trial_days`, `-1`, `1.5`, chữ: 400; khóa lạ: 404, verifies **AC-2**, **AC-10**
- Auth/permission: admin đăng tin: `MEMBERSHIP_REQUIRED`, verifies **AC-3**
- Kiểm bằng `EXPLAIN ANALYZE` (không phải test tự động): 60 nghìn tin giả lập, trang dưới 100 ms, đếm tổng dưới 300 ms, verifies **AC-13**

## Build plan

Theo Skateboard (bản mỏng nhất dùng được trước): sau bước 4 cổng thu tiền đã chạy ở phía ghi (kỳ dùng thử, hạn mức, chặn đăng và hiện), các bước sau thêm dần phía đọc.

1. Migration `<ngày>_free_trial_settings`: cột `users.trial_ends_at`, điền landlord có sẵn bằng `now() + interval '30 days'` rồi mới thêm `CHECK users_landlord_trial_check`, bảng `settings` cùng `CHECK settings_key_check` và khóa ngoại `updated_by`; cập nhật `schema.prisma`; áp lên DB và xác nhận schema đã có thật (bảng, cột, ràng buộc), `prisma migrate diff` không lệch; seed thêm hai dòng mặc định còn thiếu (`INSERT ... ON CONFLICT DO NOTHING`), satisfies **AC-12** (đã build ở mốc 1, 2026-10-16, migration `20261016090000_free_trial_settings`; vì `CHECK users_landlord_trial_check` có từ mốc này, `POST /auth/register` cho landlord trả 500 cho đến khi xong bước 3 ở mốc 2)
2. Module `settings`: `SETTING_DEFINITIONS` (khóa, kiểu, khoảng, mặc định), Repository, Service đọc có ép kiểu, kiểm khoảng và dự phòng mặc định kèm log cảnh báo; `GET /settings`, `PATCH /settings/:key` (`@RequirePermissions('setting:read'|'setting:update')`, `@FreshAuth()` cho ghi, ghi `updated_by` và `updated_at`), satisfies **AC-2**, **AC-12** (đã build ở mốc 1, 2026-10-16, `src/settings/`; `SettingsService.getValue(key)` là hàm để mốc 2 và 3 đọc `trial_days` và `trial_listing_limit`)
3. Module `memberships`: `MembershipsService.resolve(userId, now, tx?)` theo ba nhánh ở trên (nhánh gói để trống kèm chú thích cho hàng 10), `trialEndsAtForNewLandlord(now)`; `AuthService.register` truyền `trialEndsAt` xuống `UsersService.create` và `UsersRepository` (kiểu `NewUser` thêm trường), satisfies **AC-1**, **AC-3**
4. Cổng hạn mức ở phía ghi: thêm `MEMBERSHIP_REQUIRED` và `LISTING_QUOTA_REACHED` vào `ErrorCode`; `UsersRepository.lockById` (`SELECT ... FOR UPDATE` qua `$queryRaw` có kiểu), `ListingsRepository.countVisibleByLandlord`; viết lại `ListingsService.create` (khóa `users` rồi khóa nhà trọ, kiểm sở hữu, kiểm hạn mức, rồi chèn; vòng thử lại mã ngắn vẫn bọc ngoài giao dịch) và `show` (kiểm sở hữu và trạng thái, khóa `users`, kiểm hạn mức, rồi chuyển trạng thái bằng `updateMany` có điều kiện), satisfies **AC-4**, **AC-5**, **AC-6**, **AC-7**
5. Phía đọc công khai: mảnh SQL `publicListingCondition(now, trialListingLimit)` và đọc hai bước (SQL thô lấy id của trang cùng tổng số, rồi Prisma lấy dữ liệu và xếp lại) cho `GET /listings` và `GET /listings/:slugCode`, giữ nguyên bộ lọc `q`, `wardCode`, `minPrice`, `maxPrice`, `sort` của 0002 và `escapeLike`; `trialListingLimit` đọc một lần mỗi request; `visibleListingsQuery` cũ bị xóa (không để hai bản cùng tồn tại), satisfies **AC-8**, **AC-9**
6. `GET /me/membership` (quyền `subscription:read`) và cờ `isPublic` cho tin của chủ trọ (mapper nhận tập id "trong hạn mức" từ một truy vấn `LIMIT N`), satisfies **AC-10**, **AC-11**
7. Đo `EXPLAIN ANALYZE` của trang và đếm tổng với 60 nghìn tin giả lập (cùng cách ở mốc 3 của 0002). Phương án dự phòng theo thứ tự: (a) thêm chỉ mục một phần `listings_visible_property_created_at_idx` trên `(property_id, created_at, id)` với điều kiện `status = 'visible' AND deleted_at IS NULL`; (b) tính số tin đang hiện của từng chủ trọ một lần trong CTE và chỉ xếp hạng cho chủ trọ có số tin vượt hạn mức; (c) nếu vẫn quá ngân sách thì dừng và quay lại `/architect` (xem Follow-up), không tự đổi luật, satisfies **AC-13**
8. Tài liệu sống và kiểm cuối: cập nhật `docs/api/postman-collection.json` và `docs/api/api-for-frontend.md` ngay trong lần build (API mới, mã lỗi mới, trường `isPublic`, luật hiển thị mới, bảng giới hạn không đổi), script kiểm thật trên DB thử cho đồng thời (khóa `users`), hết hạn, hạ hạn mức và đếm, `verify.md`, satisfies **AC-1** đến **AC-13**

## Consequences

**Positive**:
- Một hàm hạn mức và một mảnh SQL hiển thị: hàng 10 chỉ cắm nhánh gói vào hai chỗ đã chừa, không sửa chỗ nào khác; hàng 11 (`SUM(view_count)` theo chủ trọ) và hàng 12 (danh sách đã lưu phải lọc tin hết hiển thị) dùng lại cùng mảnh điều kiện.
- Không việc nền, không cờ lưu thừa: hết hạn có hiệu lực đúng giây, đổi tham số có hiệu lực ngay (hạn mức) hoặc cho người sau (số ngày).
- Phía ghi chặn bằng khóa dòng nên không lách được bằng cách gửi song song.
- Demo được cổng thu tiền: đặt `trial_days = 0` rồi đăng ký chủ trọ mới là thấy ngay cảnh hết quyền.

**Negative / tradeoffs**:
- Đường đọc công khai rời Prisma sang SQL thô hai bước: nhiều code hơn, kiểu yếu hơn, hai câu truy vấn cho mỗi lần đọc, và mảnh SQL phải giữ khớp tay với các bộ lọc. Đây là cái giá của luật "ẩn bớt theo hạng" (bạn chọn thay cho "giữ nguyên tin đang hiện").
- Luật hạng làm mỗi tin ứng viên phải đếm các tin cùng chủ trọ: câu đếm tổng chậm dần theo số tin; chấp nhận ở quy mô demo và có ngân sách đo được (AC-13).
- Chủ trọ có thể thấy tin biến khỏi công khai mà không có cảnh báo nào ngoài `isPublic` và `/me/membership`; hệ thống không gửi email nhắc hết hạn (cần việc nền, hoãn).
- Admin hạ `trial_listing_limit` là ẩn tin của mọi chủ trọ còn trong kỳ cùng lúc, không báo trước.
- Số tin đang hiện vẫn tính cả tin bị ẩn bớt, nên chủ trọ muốn đăng thêm phải tự ẩn hoặc xóa chứ không đổi được bằng cách chờ.
- `isPublic` thêm một truy vấn nhỏ cho mỗi lần đọc tin của chủ trọ.
- Đồng hồ là của ứng dụng: chạy nhiều bản API lệch giờ thì ranh giới hết hạn lệch theo, không đáng kể với một container.
- Đọc `settings` mỗi request (một lần tra khóa chính, không đệm): đơn giản hơn nhưng thêm một lần tới DB ở đường đọc công khai.

**Neutral**:
- Hạn dùng thử cố định lúc đăng ký nên đổi `trial_days` không đụng người đã đăng ký; không có cách gia hạn dùng thử cho một chủ trọ cụ thể (hoãn).
- `UserResponse` (6 trường) và `GET /auth/me` không đổi; FE lấy trạng thái dùng thử từ `GET /me/membership`.
- Quyền `subscription:read` được dùng sớm cho API này; hàng 10 dùng tiếp cho API gói của tôi.
- Spec này thay đổi triển khai của `visibleListingsQuery` (0002) và thêm một việc cho seed (AC-9 của spec phân quyền con 0003 của 0001, và 0005): cần đồng bộ sau khi build (xem Follow-up).

## Follow-up

- [ ] Hàng 10 (`/architect membership packages and payment`): thêm nhánh gói vào `MembershipsService.resolve` và vào mảnh SQL hiển thị (gói còn hiệu lực thay hạn mức dùng thử), thêm `state = 'plan'` và trường `subscription` vào `/me/membership`; chốt quyền và cột chi tiết của `plans`, `orders`, `subscriptions` ở đó. Hàng 10 không cần quyết riêng "khi hạn mức của gói mới thấp hơn số tin đang hiện": luật ẩn bớt theo hạng của spec này đã áp cho mọi nguồn hạn mức.
- [ ] Sau khi build, đồng bộ các spec khác (`/sync` hoặc `/architect`): 0002 mục "Điều kiện hiển thị công khai" và Follow-up đầu tiên (nay là SQL thô hai bước kèm luật hạng, hạn mức kiểm ở `create` và `show`); 0005 (dòng bảng `users` đã có `trial_ends_at`, dòng giao dịch đăng và hiện tin, dòng seed `settings`, thứ tự khóa `users`, `properties`, `listings`); AC-9 của spec phân quyền con 0003 của 0001 (seed nay làm bốn việc: thêm `settings`); `docs/scope` hàng 9.
- [ ] Nếu bước 7 của Build plan không đạt ngân sách AC-13 kể cả sau hai phương án dự phòng: quay lại `/architect` để cân nhắc phương án đã loại "giữ nguyên tin đang hiện, chỉ chặn đăng thêm" (Option 2 ở `rationale.md`).
- [ ] Hoãn, thêm lại bằng `/scope` khi cần: email nhắc sắp hết dùng thử, admin gia hạn dùng thử cho một chủ trọ cụ thể, API công khai cho FE hiện "dùng thử N ngày, M tin" trước khi đăng ký (hiện chỉ admin đọc `settings`).

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
