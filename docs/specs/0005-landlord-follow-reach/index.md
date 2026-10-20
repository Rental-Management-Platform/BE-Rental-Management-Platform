# 0005. Theo dõi chủ trọ và hồ sơ công khai có số liệu

**Date**: 2026-10-20
**Status**: In Progress

## Summary

Người tìm trọ theo dõi một chủ trọ bằng một lần bấm. Ai cũng mở được hồ sơ công khai của chủ trọ (kể cả khách) để thấy tên, ngày tham gia, số người theo dõi, tổng lượt xem tin và số tin đang hiện. Mọi con số tính lúc đọc từ dữ liệu có sẵn (không bộ đếm lưu sẵn, không việc chạy nền), nên khóa tài khoản, ẩn hay xóa tin có hiệu lực ngay. Spec chỉ thêm một bảng `follows` và ba API; bấm theo dõi nhiều lần vẫn an toàn. Số liệu cộng dồn trên tài khoản là lý do để chủ trọ ở lại và mua gói thay vì bỏ tài khoản.

## Requirements

**User stories**:
- Là người tìm trọ, tôi muốn theo dõi và bỏ theo dõi một chủ trọ bằng một lần bấm, và thấy ngay mình đang theo dõi hay chưa.
- Là khách hay người tìm trọ, tôi muốn mở hồ sơ công khai của chủ trọ để đánh giá độ tin cậy: bao nhiêu người theo dõi, bao nhiêu lượt xem, đang có mấy tin.
- Là chủ trọ, tôi muốn thấy số người theo dõi và tổng lượt xem của mình tăng dần, để không bỏ tài khoản đi lập cái mới.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `GET /landlords/:id` không cần đăng nhập, trả hồ sơ công khai của một chủ trọ đang hoạt động đúng 7 trường: `id`, `name` (rỗng thì `null`), `joinedAt`, `followerCount`, `totalViewCount`, `publicListingCount`, `isFollowing`. Hồ sơ không có email, số điện thoại hay danh sách người theo dõi. Phản hồi có `Cache-Control: private, no-store`. Khách, token sai hoặc hết hạn vẫn nhận 200 với `isFollowing` là `null` (không bị 401); người đã đăng nhập nhận `true` hoặc `false`.
- **AC-2**: Id không phải chủ trọ (tài khoản `tenant` hay `admin`, không tồn tại), hoặc chủ trọ đang bị khóa hay đã xóa mềm, bị 404 `LANDLORD_NOT_FOUND`; id sai định dạng UUID bị 400 `INVALID_ID`. Khóa rồi mở khóa chủ trọ thì hồ sơ và các số trở lại như cũ (dòng theo dõi không bị xóa khi khóa).
- **AC-3**: `followerCount` đếm mỗi người theo dõi đúng một lần và chỉ đếm tài khoản đang hoạt động (`status = active`, chưa xóa mềm). Khóa hoặc xóa mềm một người theo dõi làm số giảm ngay; mở khóa thì số quay lại; bỏ theo dõi làm số giảm một.
- **AC-4**: `totalViewCount` là tổng `view_count` của mọi tin thuộc mọi nhà trọ của chủ trọ, kể cả tin đang ẩn và tin đã xóa mềm; là số nguyên không âm và không giảm khi ẩn tin, xóa tin hay khi hết dùng thử hoặc hết gói. Cách cộng lượt xem từng tin không đổi (spec 0002 AC-13).
- **AC-5**: `publicListingCount` là số tin của chủ trọ thỏa đúng điều kiện hiển thị công khai ngay lúc đọc, nên luôn bằng số tin của chủ trọ đó mà `GET /listings` trả (cộng mọi trang). Chủ trọ hết dùng thử và hết gói thì bằng 0 nhưng hồ sơ vẫn xem được.
- **AC-6**: Người dùng có quyền `follow:create` (mặc định chỉ `tenant`) gọi `POST /landlords/:id/follow` cho một chủ trọ đang hoạt động thì nhận 200 kèm hồ sơ mới với `isFollowing = true` và `followerCount` tăng một. Mỗi cặp (người theo dõi, chủ trọ) chỉ có một dòng: gọi lại vẫn 200 và số không đổi, kể cả khi nhiều lần gọi chạy đồng thời.
- **AC-7**: Người dùng có quyền `follow:delete` gọi `DELETE /landlords/:id/follow` thì nhận 200 kèm hồ sơ mới với `isFollowing = false` và `followerCount` giảm một; khi chưa theo dõi vẫn 200 và số không đổi.
- **AC-8**: Tự theo dõi chính mình bị 409 `CANNOT_FOLLOW_SELF` (kiểm trước khi tra chủ trọ; `CHECK` ở DB là lớp cuối). Theo dõi hoặc bỏ theo dõi một id không phải chủ trọ đang hoạt động bị 404 `LANDLORD_NOT_FOUND`; id sai định dạng bị 400 `INVALID_ID`. Người không có quyền (chủ trọ và admin theo mặc định) bị 403 `PERMISSION_DENIED`, khách bị 401 `TOKEN_MISSING`; cả hai trường hợp không ghi dòng nào.
- **AC-9**: `POST` và `DELETE` theo dõi có giới hạn 60 lần mỗi giờ theo người dùng cho mỗi API; `GET /landlords/:id` dùng nhóm công khai 300 lần mỗi phút theo IP. Vượt thì 429 `RATE_LIMITED` kèm `Retry-After`.

## Decision

**Chosen option**: Option 1: Một bảng `follows`, mọi số liệu tính lúc đọc, hồ sơ công khai là API đọc mới `GET /landlords/:id`

Người theo dõi (lấy từ token) và chủ trọ nối nhau bằng bảng `follows`. Số người theo dõi, tổng lượt xem và số tin đang hiện không lưu sẵn mà tính lúc đọc: số người theo dõi nối `users` để bỏ tài khoản bị khóa hoặc đã xóa, tổng lượt xem cộng `listings.view_count` qua `properties`, số tin đang hiện dùng lại đúng hai mảnh SQL hiển thị công khai (`publicListingFrom` và `publicListingCondition`) nên không lệch với danh sách. Không tạo bảng `landlord_profiles`: tên hiển thị là `users.name`.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Feature design

Quy ước chung theo 0001 đến 0006: Repository bọc Prisma, id `uuidv7()`, `timestamptz`, tên bảng và cột `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`, đọc thô bằng `$queryRaw` chỉ nằm trong file `*.repository.ts` (luật lint), giao dịch qua `TransactionRunner`.

**Data model** (một migration; mô hình đã được bạn xác nhận):

| Bảng | Khóa chính | Cột | Ràng buộc và chỉ mục |
|---|---|---|---|
| `follows` | (`user_id`, `landlord_id`) | `user_id` (uuid, người theo dõi, FK `users`, RESTRICT), `landlord_id` (uuid, chủ trọ được theo dõi, FK `users`, RESTRICT), `created_at` (timestamptz, mặc định `now()`) | khóa chính `follows_pkey` chặn trùng cặp; `CHECK follows_self_check` (`user_id <> landlord_id`); chỉ mục `follows_landlord_id_idx` trên `landlord_id` để đếm người theo dõi; tên FK `follows_user_id_fk` và `follows_landlord_id_fk`; khóa chính đã phủ tra theo `user_id` |

Quan hệ: `users` N:M `users` qua `follows`. Hai FK đều RESTRICT vì tài khoản chỉ xóa mềm. Khóa ngoại không ép được "đầu `landlord_id` phải là chủ trọ"; Service kiểm loại tài khoản (xem Key invariants). Không đổi `users`, `properties`, `listings`. `schema.prisma` thêm model `Follow` với hai quan hệ có tên (`Follower`, `FollowedLandlord`) trỏ về `User`. Spec 0005 của nền móng (`0001/0005-postgres-data-conventions.md`) đã phác bảng này; `landlord_profiles` mà nó chừa chỗ **không được tạo** (quyết định ở rationale).

**Không có bộ đếm lưu sẵn.** `followerCount`, `totalViewCount`, `publicListingCount` luôn tính lúc đọc bằng ba câu truy vấn gộp chạy song song (ngoài giao dịch) cộng một câu tra chủ trọ và một câu tra `isFollowing`. Ba số có thể lệch nhau vài mili giây vì không chung một ảnh chụp dữ liệu; chấp nhận.

**State transitions**: không có. Một dòng `follows` tồn tại hoặc không; không có trạng thái.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/landlords/:id` | GET | `id` (UUID, đường dẫn) | 200 hồ sơ công khai | công khai, đọc đăng nhập tùy chọn (`@OptionalAuth()`) | 400 `INVALID_ID`, 404 `LANDLORD_NOT_FOUND`, 429 |
| `/landlords/:id/follow` | POST | `id` (UUID, đường dẫn); không body | 200 hồ sơ mới (`isFollowing = true`) | `follow:create` | 400 `INVALID_ID`, 409 `CANNOT_FOLLOW_SELF`, 404 `LANDLORD_NOT_FOUND`, 403, 401, 429 |
| `/landlords/:id/follow` | DELETE | `id` (UUID, đường dẫn); không body | 200 hồ sơ mới (`isFollowing = false`) | `follow:delete` | 400 `INVALID_ID`, 404 `LANDLORD_NOT_FOUND`, 403, 401, 429 |

Hình dạng trả về, **Hồ sơ công khai của chủ trọ** (cả ba API):

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01",
  "name": "Anh Nam",
  "joinedAt": "2026-10-05T03:00:00.000Z",
  "followerCount": 12,
  "totalViewCount": 1840,
  "publicListingCount": 2,
  "isFollowing": false
}
```

`name` là `users.name`, rỗng hoặc chỉ khoảng trắng thì `null`. `isFollowing` là `null` với khách, `true` hoặc `false` với người đã đăng nhập. Số đếm là số nguyên không âm.

Mã lỗi mới (thêm vào `ErrorCode`, kèm câu tiếng Việt, theo 0004):

| Mã | Status | Khi nào |
|---|---|---|
| `LANDLORD_NOT_FOUND` | 404 | Id không phải chủ trọ đang hoạt động: không tồn tại, là `tenant` hay `admin`, bị khóa hoặc đã xóa mềm |
| `CANNOT_FOLLOW_SELF` | 409 | Người gọi theo dõi chính tài khoản của mình |

**Quy tắc đầu vào, đầu ra và biên**:
- **Chủ trọ hợp lệ** là dòng `users` có `account_type = 'landlord'`, `status = 'active'` và `deleted_at IS NULL`. Ba route đều dùng đúng định nghĩa này, nên khóa chủ trọ làm cả hồ sơ, theo dõi và bỏ theo dõi trả 404 (dòng `follows` giữ nguyên; mở khóa thì mọi thứ trở lại).
- **Thứ tự kiểm lỗi của `POST`**: quyền (403 hoặc 401) trước, rồi `INVALID_ID` (400), rồi `CANNOT_FOLLOW_SELF` (409, so `:id` với `sub` của token, chưa tra DB), rồi `LANDLORD_NOT_FOUND` (404), rồi ghi. `DELETE` giống vậy nhưng bỏ bước tự theo dõi: id là chính người gọi thì rơi vào 404 hoặc xóa không dòng nào (200, `isFollowing = false`).
- **Chạy lặp**: `POST` ghi bằng một câu `INSERT ... ON CONFLICT DO NOTHING` (Prisma `createMany` với `skipDuplicates`), nên hai lần gọi đồng thời vẫn ra đúng một dòng và cả hai nhận 200. `DELETE` là `deleteMany` theo cặp, không dòng nào bị xóa cũng 200.
- **Phản hồi của ghi** là hồ sơ đọc lại SAU khi ghi xong, bằng đúng hàm của `GET`, với người gọi là người xem (nên `isFollowing` phản ánh dòng vừa ghi).
- **Cache**: cả ba route đặt `Cache-Control: private, no-store` vì `isFollowing` đổi theo người xem.
- **Không body**: `POST` và `DELETE` không nhận body; nội dung gửi kèm bị bỏ qua.
- **`totalViewCount`**: tổng đọc bằng `SUM(l.view_count)::bigint`, đổi sang số của JavaScript trong Repository (`COALESCE` về 0 khi chủ trọ chưa có tin).

**Giới hạn tần suất** (thêm một nhóm vào `RATE_LIMITS`, dùng `@RateLimited`; con số do bạn duyệt ngày 2026-10-20):

| Nhóm | Route | Bộ đếm |
|---|---|---|
| `followWrite` (mới) | `POST` và `DELETE /landlords/:id/follow` | `user`: 60 lần mỗi giờ, **mỗi API đếm riêng** |
| `publicRead` (đã có) | `GET /landlords/:id` | `ip`: 300 lần mỗi phút |

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Theo dõi, bỏ theo dõi | người theo dõi (`follows.user_id`) | `sub` trong access token qua `@CurrentUser()`, không nhận từ đường dẫn hay body |
| Theo dõi, bỏ theo dõi | chủ trọ (`follows.landlord_id`) | tham số đường dẫn `:id`, qua `uuidParam()` |
| Theo dõi | `created_at` | mặc định `now()` của cột |
| Theo dõi | chủ trọ có hợp lệ không | tra `users` theo `:id` với định nghĩa "chủ trọ hợp lệ" ở trên |
| Theo dõi | có phải tự theo dõi không | so `:id` với `sub` của token |
| Mọi route | hồ sơ trả về | một hàm đọc hồ sơ duy nhất, người xem là `req.user` (nếu có) |
| Hồ sơ | `id`, `joinedAt`, `name` | `users.id`, `users.created_at`, `users.name` (rỗng hoặc chỉ khoảng trắng thì `null`) |
| Hồ sơ | `followerCount` | `count(*)` các dòng `follows` có `landlord_id = :id` nối `users` ở `user_id` với `status = 'active'` và `deleted_at IS NULL` |
| Hồ sơ | `totalViewCount` | `SUM(listings.view_count)` nối `properties` qua `property_id` với `properties.landlord_id = :id`, không lọc trạng thái hay xóa mềm |
| Hồ sơ | `publicListingCount` | `count(*)` các tin có `properties.landlord_id = :id` và thỏa `publicListingCondition(now, trialListingLimit)` trên phép nối `publicListingFrom(now)`; `now` do controller lấy một lần mỗi request, hạn mức dùng thử đọc từ `settings` (`trial_listing_limit`) giống `GET /listings` |
| Hồ sơ | `isFollowing` | người gọi có `req.user` (đọc đăng nhập tùy chọn): có dòng `follows` (`sub`, `:id`) thì `true`, không thì `false`; khách: `null` |
| Lỗi | 404 hay 409 | chủ trọ không hợp lệ thì `LANDLORD_NOT_FOUND`; `:id` bằng `sub` thì `CANNOT_FOLLOW_SELF` |

**Key invariants**:
- Mỗi cặp (`user_id`, `landlord_id`) có tối đa một dòng (khóa chính); không bao giờ có dòng tự theo dõi (`CHECK` và kiểm ở Service).
- `landlord_id` của mọi dòng luôn là một tài khoản `landlord`: Service chỉ ghi sau khi tra chủ trọ hợp lệ. Loại tài khoản không đổi sau khi tạo (0003), nên điều này không hỏng về sau.
- `user_id` luôn lấy từ token, không bao giờ từ đường dẫn hay body.
- Dòng `follows` không bị xóa khi khóa hoặc xóa mềm hai đầu; hiển thị (có tính hay không, có xem được hồ sơ hay không) suy ra lúc đọc.
- Các số trên hồ sơ không được lưu ở đâu cả; `publicListingCount` dùng đúng hai mảnh SQL của danh sách công khai nên không thể lệch với `GET /listings`.
- `GET` không ghi gì (không cộng lượt xem hồ sơ; hàng 11 đã chốt chỉ giữ lượt xem tin).

**Security model**:
- Công khai: `GET /landlords/:id`. Đọc đăng nhập tùy chọn: token sai hay hết hạn coi như khách, không bị 401. Hồ sơ chỉ gồm tên hiển thị và các số tổng; **không có email, số điện thoại, danh sách người theo dõi hay danh tính người theo dõi**. `isFollowing` chỉ nói về chính người xem.
- Ghi: `POST` cần `follow:create`, `DELETE` cần `follow:delete`. `tenant` có cả hai mặc định (migration `account_types_phone`); `landlord` và `admin` không. Admin có thể gán quyền này cho `landlord` bằng API quyền (0003); khi đó chủ trọ theo dõi được chủ trọ khác nhưng không theo dõi được chính mình (409). Quyền là `ownerScoped`: dòng ghi luôn thuộc về người gọi, nên không cần `assertOwner`.
- Không dữ liệu nào thuộc phạm vi tuân thủ riêng; tên hiển thị là thông tin chủ trọ đã chọn công khai.

**Configuration required**: không có biến môi trường, không dịch vụ ngoài, không seed, không migration quyền. Chỉ cần migration tạo bảng `follows`.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: tenant theo dõi chủ trọ, nhận hồ sơ có `isFollowing = true` và `followerCount` tăng một; mở lại bằng `GET` ra cùng số; bỏ theo dõi thì về như cũ, verifies **AC-1**, **AC-6**, **AC-7**
- Happy path: chủ trọ có 3 tin, 2 trong hạn mức, một tin đã xóa mềm: `publicListingCount` bằng số tin của chủ trọ đó trong `GET /listings` cộng mọi trang; `totalViewCount` bằng tổng `view_count` của cả 3 tin, verifies **AC-4**, **AC-5**
- Failure case: hai lần `POST` đồng thời cùng cặp: cả hai 200, DB có đúng một dòng; `POST` lần ba vẫn 200 và số không đổi; `DELETE` khi chưa theo dõi vẫn 200, verifies **AC-6**, **AC-7**
- Failure case: khóa tài khoản người theo dõi làm `followerCount` giảm ngay, mở khóa thì quay lại; xóa mềm cũng vậy, verifies **AC-3**
- Failure case: khóa chủ trọ thì `GET`, `POST`, `DELETE` đều 404 `LANDLORD_NOT_FOUND`; mở khóa thì hồ sơ trở lại với số cũ (dòng theo dõi còn), verifies **AC-2**
- Failure case: chủ trọ hết dùng thử và hết gói: `publicListingCount` là 0 nhưng hồ sơ vẫn 200 và `totalViewCount` không giảm; ẩn hay xóa tin cũng không làm `totalViewCount` giảm, verifies **AC-4**, **AC-5**
- Failure case: id của một tenant, của admin, id không tồn tại: 404 `LANDLORD_NOT_FOUND`; id `abc`: 400 `INVALID_ID`; tự theo dõi (sau khi gán quyền cho chủ trọ): 409 `CANNOT_FOLLOW_SELF` và DB không có dòng nào, verifies **AC-2**, **AC-8**
- Auth/permission: khách `GET` nhận 200 với `isFollowing = null`, token hết hạn cũng vậy; khách `POST` nhận 401; chủ trọ và admin `POST` nhận 403 và không có dòng nào được ghi, verifies **AC-1**, **AC-8**
- Auth/permission: vượt 60 lần `POST` trong một giờ nhận 429 kèm `Retry-After` trong khi `DELETE` (đếm riêng) vẫn chạy; vượt 300 lần `GET` mỗi phút nhận 429, verifies **AC-9**
- Phản hồi không lộ: hồ sơ không có khóa nào ngoài 7 trường, không email, không số điện thoại, và có `Cache-Control: private, no-store`, verifies **AC-1**
- Kiểm bằng `EXPLAIN` (không phải test tự động): ba câu truy vấn gộp của hồ sơ ở khoảng 60 nghìn tin và vài chục nghìn dòng theo dõi giả lập; đo một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-3**, **AC-4**, **AC-5**

## Build plan

Hướng build theo Skateboard (bản mỏng nhất dùng được trước, rồi mới mở rộng): mốc 1 đã có một đường đọc trọn vẹn (hồ sơ công khai với các số, thử được bằng dòng chèn tay), mốc 2 thêm đường ghi. Hai cột mốc, mỗi mốc một lần `/develop` rồi dừng cho bạn review (khớp ô `Build it` trong scope). Mỗi mốc có đổi API thì cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong mốc đó (quy tắc tài liệu sống), gắn `@RateLimited` ngay khi tạo route.

**Mốc 1: bảng và hồ sơ công khai (đọc)**
1. Thêm model `Follow` vào `schema.prisma` và một migration tạo bảng `follows` kèm khóa chính, hai FK, `CHECK follows_self_check`, chỉ mục `follows_landlord_id_idx`; thêm mã lỗi `LANDLORD_NOT_FOUND` vào `ErrorCode` kèm câu tiếng Việt và test đơn vị; áp migration lên DB thử và hỏi schema thật, satisfies **AC-2**, **AC-3** (đã build ở mốc 1, 2026-10-20: model `Follow` với hai quan hệ có tên `Follower` và `FollowedLandlord` (và hai quan hệ ngược `following`, `followers` trên `User`); migration `20261020090000_landlord_follows` gồm bảng, khóa chính `follows_pkey`, hai khóa ngoại `RESTRICT`, chỉ mục `follows_landlord_id_idx` và `CHECK follows_self_check`; áp lên DB thử `rental_management_verify` và đã hỏi DB thật: ba cột, khóa chính, hai khóa ngoại, `CHECK` và chỉ mục đều có, `prisma migrate diff` không báo lệch; mã lỗi `LANDLORD_NOT_FOUND` (404, "Không tìm thấy chủ trọ.") và test đơn vị `src/common/errors/error-code.spec.ts`)
2. `ListingsRepository` thêm hai phương thức đọc gộp theo chủ trọ: tổng `view_count` (mọi tin) và số tin thỏa điều kiện hiển thị công khai (dùng `publicListingFrom` và `publicListingCondition`, cùng `now` và hạn mức); thêm `LandlordsRepository` (tra chủ trọ hợp lệ, đếm người theo dõi đang hoạt động, tra `isFollowing`), satisfies **AC-3**, **AC-4**, **AC-5** (đã build ở mốc 1, 2026-10-20: `ListingsRepository.sumViewCountByLandlord` (SQL thô `COALESCE(SUM(l.view_count), 0)::bigint`, đổi sang số bằng `Number` ở Repository, không lọc trạng thái hay xóa mềm) và `countPublicByLandlord` (đúng hai mảnh `publicListingFrom` và `publicListingCondition` với cùng `now` và hạn mức, thêm `p.landlord_id`); `src/landlords/landlords.repository.ts` có `findActiveLandlord`, `countActiveFollowers` và `isFollowing`. Lựa chọn nhỏ của người build: số người theo dõi và `isFollowing` dùng Prisma có kiểu (`count` với bộ lọc quan hệ `user`, `findUnique` theo khóa chính ghép `userId_landlordId`), không SQL thô; chỉ hai câu đọc `listings` là SQL thô vì cần dùng chung hai mảnh SQL công khai)
3. Module `src/landlords/`: `LandlordsService.getProfile` (gom ba số song song, `isFollowing` là `null` với khách), `LandlordsController` với `GET /landlords/:id` (`@OptionalAuth()`, `@RateLimited('publicRead')`, `uuidParam()`, `Cache-Control: private, no-store`, `now` lấy một lần), đăng ký module, satisfies **AC-1**, **AC-2**, **AC-9** (đã build ở mốc 1, 2026-10-20: `src/landlords/` gồm controller, service, repository, mapper, DTO `LandlordProfileResponse` và `LandlordsModule` (import `ListingsDataModule` và `SettingsModule`, đã vào `AppModule`). `LandlordsService.getProfile(landlordId, viewerId, now)` tra chủ trọ trước (không có thì 404 và không tính gì thêm), rồi đọc `trial_listing_limit` một lần, rồi chạy song song bằng `Promise.all` ba số và `isFollowing` (khách thì không tra, ra `null`). Hàm này cũng là hàm mà mốc 2 gọi lại sau khi ghi. `name` rỗng hoặc chỉ khoảng trắng thành `null` ở mapper, và mapper chọn từng trường một nên không cột nào khác của `users` lọt ra được)
4. Test đơn vị (Service, Repository, DTO/mapper, duyệt route khai báo quyền), `EXPLAIN` một lần ở 60 nghìn tin giả lập (ghi số, không chỉnh), cập nhật Postman (folder 18, phần đọc) và `api-for-frontend.md` (mục hồ sơ, bảng mã lỗi, nhật ký), kiểm thật trên DB thử bằng dòng `follows` chèn tay (khóa, mở khóa người theo dõi và chủ trọ, ẩn và xóa tin, hết dùng thử), satisfies **AC-1** đến **AC-5** (đã build ở mốc 1, 2026-10-20: 1015 test đơn vị qua (trước đó 987), `tsc` và `eslint` sạch. Kiểm thật trên DB thử `rental_management_verify` bằng 62 phép kiểm HTTP và SQL với dòng `follows` chèn tay: bảy trường và mọi kiểu người xem (khách, token sai, token hết hạn, người đang theo dõi, người chưa theo dõi, chính chủ); id của tenant, của admin, không tồn tại, `abc`; khóa và mở khóa chủ trọ (dòng `follows` còn nguyên, các số trở lại như cũ) và xóa mềm chủ trọ; khóa và xóa mềm người theo dõi; DB chặn trùng cặp (`follows_pkey`) và tự theo dõi (`follows_self_check`); `totalViewCount` 72 không giảm khi ẩn, xóa hay hết dùng thử; `publicListingCount` so với `GET /listings` cộng mọi trang **và** với một đồng hồ độc lập tính từ dòng thô ở hạn mức 5, 4, 3, 2, 1, 0, rồi với gói và hết gói. Bốn điều khiển âm trên `dist` (đếm người theo dõi không lọc tài khoản đang hoạt động; `totalViewCount` lọc theo trạng thái; `publicListingCount` bỏ luật hạn mức; khách nhận `false` thay vì `null`) đều bị đúng các phép kiểm bắt, bản build sạch lại 62 trên 62. Giới hạn đọc: 300 lần qua, lần 301 là 429 `RATE_LIMITED` kèm `Retry-After: 60`. `EXPLAIN` một lần ở 60 060 tin và 32 021 dòng theo dõi (một chủ trọ nổi có khoảng 2 000 người theo dõi): câu chậm nhất là đếm người theo dõi của chủ trọ nổi, 1,5 ms; tra chủ trọ, tổng lượt xem và số tin đang hiện đều dưới 0,3 ms; ba số cộng lại dưới 2 ms, nên không chỉnh gì. Postman folder 18 (13 request, không thêm lần đăng ký nào) chạy cùng folder 00, 01, 03, 04, 05, 07, 08, 09: 94 request, 184 assertion, 0 lỗi (không chạy folder 02 vì cần token gửi qua email). FE guide thêm mục 6.31, dòng `LANDLORD_NOT_FOUND`, dòng giới hạn tần suất, dòng 11 ở mục 10 và nhật ký)

**Mốc 2: theo dõi và bỏ theo dõi (ghi)**
5. Thêm mã lỗi `CANNOT_FOLLOW_SELF` và nhóm `followWrite` (60 lần mỗi giờ theo người dùng) vào `RATE_LIMITS`; `LandlordsRepository` thêm ghi (`createMany` với `skipDuplicates`, `deleteMany` theo cặp), satisfies **AC-6**, **AC-7**, **AC-8**, **AC-9**
6. `LandlordsService.follow` và `unfollow` theo đúng thứ tự kiểm lỗi (tự theo dõi, chủ trọ hợp lệ, ghi, đọc lại hồ sơ) và hai route `POST` và `DELETE /landlords/:id/follow` (`@RequirePermissions('follow:create')` và `('follow:delete')`, `@RateLimited('followWrite')`, `@HttpCode(200)`, `uuidParam()`), satisfies **AC-6**, **AC-7**, **AC-8**
7. Kiểm thật trên DB thử: chạy lặp, hai lần gọi đồng thời (số dòng trong DB), điều khiển âm cho phép ghi lặp, quyền (chủ trọ, admin, khách), tự theo dõi sau khi gán quyền, 60 lần ghi rồi 429, `Retry-After`; Newman toàn bộ; cập nhật Postman (folder 18, phần ghi), `api-for-frontend.md` (mục theo dõi, bảng giới hạn tần suất, màn hình, quy tắc, giới hạn đã biết, nhật ký, bỏ dòng 11 ở mục 10), `verify.md`, satisfies **AC-6** đến **AC-9**

## Consequences

**Positive**:
- Một bảng, ba API, không bộ đếm, không việc nền, không biến môi trường mới: gọn đúng tinh thần MVP.
- Mọi số luôn đúng ngay sau khóa hay mở khóa tài khoản, ẩn hay xóa tin, hết hay mua gói, vì tính lúc đọc từ nguồn thật; không có chỗ nào để số bị lệch như bộ đếm lưu sẵn.
- `publicListingCount` dùng đúng hai mảnh SQL của danh sách công khai, nên không thể khác `GET /listings`.
- Theo dõi lặp lại và bỏ theo dõi lặp lại an toàn, hợp với bấm đúp và thử lại khi mạng chậm.
- Hồ sơ công khai ra luôn `isFollowing` và các số mới sau mỗi lần ghi, nên FE cập nhật nút trong một lần gọi.

**Negative / tradeoffs**:
- Theo dõi hiện chỉ làm tăng một con số: không thông báo cho người theo dõi, không danh sách "đang theo dõi", chủ trọ không xem được ai theo dõi mình. Tác dụng giữ chủ trọ ở lại phụ thuộc việc chủ trọ nhìn thấy và coi trọng con số.
- Số người theo dõi có thể bị tăng ảo bằng nhiều tài khoản người tìm trọ giả; chỉ có giới hạn đăng ký 10 lần mỗi giờ theo IP và việc admin khóa tài khoản chặn lại. Không có chống gian lận nào khác.
- Chủ trọ bị khóa thì mất cả hồ sơ lẫn khả năng bỏ theo dõi (404); người theo dõi vẫn giữ dòng đó đến khi chủ trọ được mở khóa.
- Mỗi lần mở hồ sơ chạy ba câu truy vấn gộp (đếm, cộng, đếm có điều kiện hạng) cộng hai câu tra. Ổn ở quy mô demo vì chủ trọ có ít tin và tra theo chỉ mục `landlord_id`, nhưng `publicListingCount` tốn hơn hai số còn lại; sẽ đo một lần rồi giữ nguyên.
- Ba số được đọc không cùng một ảnh chụp dữ liệu, nên trong khoảng vài mili giây chúng có thể phản ánh hai thời điểm khác nhau.
- `totalViewCount` gồm cả lượt xem của tin đã ẩn hoặc xóa, nên khác tổng `viewCount` của các tin đang hiển thị trong `GET /me/listings`; FE đừng cộng tay để đối chiếu.
- Theo dõi chạy lặp trả 200 chứ không phải 201, và `DELETE` trả thân JSON; hai điểm hơi khác thói quen REST thuần nhưng đổi lại FE gọn.

**Neutral**:
- Thêm một module `src/landlords/` và hai phương thức đọc gộp ở `ListingsRepository`; mã lỗi mới `LANDLORD_NOT_FOUND`, `CANNOT_FOLLOW_SELF`; nhóm giới hạn mới `followWrite`.
- Quyền `follow:create` và `follow:delete` đã có sẵn ở `tenant` nên không cần migration quyền; nếu admin đã gỡ chúng khỏi `tenant` trong DB thì tenant bị 403 cho tới khi cấp lại.
- Hàng 12 (lưu phòng) không phụ thuộc spec này.

## Follow-up

- [ ] Hoãn, thêm lại bằng `/scope` khi cần: danh sách "đang theo dõi" của người tìm trọ (`GET /me/following`), danh sách tên người theo dõi cho chủ trọ, thông báo cho người theo dõi khi chủ trọ đăng tin mới, danh sách tin đang hiện của chủ trọ trên hồ sơ (cần bộ lọc `landlordId` ở `GET /listings`), số người theo dõi trong chi tiết tin, bảng `landlord_profiles` (tên hiển thị riêng, Zalo), chống tăng ảo số người theo dõi.
- [x] Đồng bộ `0001/0005-postgres-data-conventions.md`: dòng `landlord_profiles` ghi rõ spec theo dõi chủ trọ đã quyết chưa tạo bảng; dòng `follows` khớp spec này (xong ngày 2026-10-20).
- [ ] Sau khi build, `/sync` ghi bảng `follows` và nhóm `followWrite` vào các spec nền móng nếu còn lệch.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
