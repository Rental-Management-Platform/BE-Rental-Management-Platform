# 0014. Đánh giá chủ trọ trên hồ sơ công khai

**Date**: 2026-11-07
**Status**: Accepted

## Summary

Người tìm trọ đã nhắn với một chủ trọ và được họ trả lời thì viết được một đánh giá về chủ trọ đó: số sao từ 1 đến 5 và lời nhận xét tùy chọn. Hồ sơ công khai của chủ trọ thêm điểm trung bình, số đánh giá, và một danh sách đánh giá có phân trang. Mỗi người chỉ có một đánh giá cho mỗi chủ trọ, được sửa và xóa của mình; admin ẩn đánh giá vi phạm kèm lý do, đánh giá bị ẩn rời hồ sơ ngay nhưng vẫn nằm trong database. Spec thêm một bảng `reviews`, tám route và một module quyền `review`; mọi con số tính lúc đọc (không bộ đếm lưu sẵn, không việc chạy nền).

## Requirements

**User stories**:
- Là người tìm trọ đã nhắn với một chủ trọ và được họ trả lời, tôi muốn đánh giá chủ trọ đó để người sau biết họ đáng tin hay không.
- Là khách hay người tìm trọ, tôi muốn đọc điểm trung bình và các đánh giá ngay trên hồ sơ chủ trọ trước khi liên hệ.
- Là người đã viết đánh giá, tôi muốn sửa hay xóa nó, và biết khi admin đã ẩn nó cùng lý do.
- Là admin, tôi muốn tìm và ẩn đánh giá vi phạm kèm lý do, và gỡ ẩn khi ẩn nhầm.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: Hồ sơ công khai của chủ trọ (`GET /landlords/:id` và kết quả của `POST` và `DELETE /landlords/:id/follow`) thêm hai trường, thành chín trường: `reviewCount` (số nguyên từ 0) và `ratingAverage` (số sao trung bình làm tròn một chữ số thập phân, `null` khi `reviewCount` là 0). Cả hai chỉ tính các đánh giá `visible` mà người viết là tài khoản đang hoạt động (`status = active`, chưa xóa mềm), nên `reviewCount` luôn bằng `total` của danh sách ở AC-2 cộng mọi trang, và `ratingAverage` là trung bình số sao của chính các dòng đó. Bảy trường cũ của spec 0005 không đổi. Hồ sơ vẫn `Cache-Control: private, no-store` và vẫn 404 `LANDLORD_NOT_FOUND` với chủ trọ không hợp lệ.
- **AC-2**: `GET /landlords/:id/reviews` không cần đăng nhập (đọc đăng nhập tùy chọn: khách, token sai hay hết hạn vẫn nhận 200, không bao giờ 401), chỉ nhận `page` và `pageSize` (tham số khác bị 400), trả `{ items, total, page, pageSize }`, mới viết trước (`created_at` giảm dần, rồi `id` giảm dần). Chỉ gồm đánh giá `visible` của người viết đang hoạt động. Mỗi phần tử có `id`, `stars`, `comment` (`null` nếu không có), `author` (đúng một trường `name`, có thể `null`), `isMine` (`null` với khách, `true` hay `false` với người đăng nhập), `createdAt`, `updatedAt`. Không có email, số điện thoại, id người viết hay trạng thái. Chủ trọ không hợp lệ (không có, là `tenant` hay `admin`, bị khóa hay đã xóa mềm) bị 404 `LANDLORD_NOT_FOUND`; id sai định dạng bị 400 `INVALID_ID`. Phản hồi có `Cache-Control: private, no-store`.
- **AC-3**: `POST /landlords/:id/review` với body `{ stars, comment? }`: người có quyền `review:create` (mặc định chỉ `tenant`) đã đủ điều kiện (AC-4) nhận 201 đánh giá của mình (hình dạng ở AC-8). `stars` là số nguyên từ 1 đến 5. `comment` bỏ trống hoặc `null` là không có nhận xét; nếu là chuỗi thì bỏ khoảng trắng hai đầu, dài 1 đến 1000 ký tự sau khi bỏ, không chứa `\u0000` (cùng cách đếm và luật của `body` chat, spec 0013 AC-4); chuỗi rỗng hay toàn khoảng trắng bị từ chối. Sai bị 400 `VALIDATION_FAILED` kèm tên trường, không ghi dòng nào. Người viết luôn là người trong token và chủ trọ luôn là `:id`, không nhận từ body.
- **AC-4**: Điều kiện được đánh giá: người gọi có ít nhất một cuộc trò chuyện với chủ trọ đó (`conversations.tenant_id` là người gọi, `landlord_id` là chủ trọ, về bất kỳ tin nào, tin đó đang ẩn hay đã xóa cũng được) trong đó chủ trọ đã gửi ít nhất một tin nhắn. Chỉ kiểm lúc tạo, không kiểm lại khi sửa hay xóa. Người chưa đủ điều kiện (chưa nhắn, hoặc nhắn rồi mà chủ trọ chưa trả lời, hoặc chỉ nhắn với chủ trọ khác) bị 403 `REVIEW_NOT_ELIGIBLE` và không ghi dòng nào.
- **AC-5**: Mỗi cặp (người viết, chủ trọ) chỉ có tối đa một đánh giá: `POST` lần hai bị 409 `REVIEW_ALREADY_EXISTS`, và 20 lần `POST` đồng thời cùng một cặp ra đúng một 201 và 19 lần 409. Tự đánh giá chính mình bị 409 `CANNOT_REVIEW_SELF` (kiểm trước khi tra chủ trọ; `CHECK` ở DB là lớp cuối). Xóa đánh giá thì được viết lại (AC-7).
- **AC-6**: `PATCH /landlords/:id/review` với body `{ stars?, comment? }` (phải có ít nhất một trường; `comment: null` xóa nhận xét; cùng luật giá trị ở AC-3): người có quyền `review:update` sửa đánh giá `visible` của chính mình nhận 200 đánh giá mới, `updatedAt` đổi, `createdAt` không đổi. Chưa có đánh giá nhận 404 `REVIEW_NOT_FOUND`; đánh giá đang bị admin ẩn nhận 409 `REVIEW_HIDDEN`; body rỗng hay sai bị 400 `VALIDATION_FAILED`. Không trường hợp lỗi nào đổi dòng.
- **AC-7**: `DELETE /landlords/:id/review`: người có quyền `review:delete` xóa đánh giá của chính mình (kể cả đang bị ẩn) nhận 204; dòng bị xóa hẳn, điểm trung bình và số đánh giá đổi ngay, và người đó viết lại được (nếu còn đủ điều kiện). Chưa có đánh giá nhận 404 `REVIEW_NOT_FOUND`.
- **AC-8**: `GET /landlords/:id/review` (quyền `review:read`, mặc định chỉ `tenant`) trả 200 `{ review, canReview }`. `review` là `null` hoặc đánh giá của chính người gọi `{ id, stars, comment, status, hiddenReason, createdAt, updatedAt }`, trong đó `status` là `visible` hay `hidden_by_admin` và `hiddenReason` là lý do admin ẩn gần nhất khi đang bị ẩn, còn lại `null`. `canReview` là `true` đúng khi `review` là `null`, người gọi giữ `review:create` trong token, không phải chính chủ trọ đó và đã đủ điều kiện (AC-4); POST vẫn là nơi quyết định cuối. Hai route `POST` và `PATCH` cũng trả đúng hình dạng `review` này. Chủ trọ không hợp lệ bị 404 `LANDLORD_NOT_FOUND`.
- **AC-9**: Quyền và cách ly: khách bị 401 `TOKEN_MISSING` ở bốn route cần đăng nhập (`GET`, `POST`, `PATCH`, `DELETE` của `/landlords/:id/review`); chủ trọ mặc định không giữ khóa `review:*` nên nhận 403 `PERMISSION_DENIED`; admin giữ mọi quyền nhưng cả bốn route này bị 403 `PERMISSION_DENIED` vì Service kiểm loại tài khoản (sau pipe, nên id hay body sai vẫn là 400). Không có route nào nhận id của đánh giá ở phía người viết, nên một người không bao giờ đọc hay đổi được đánh giá của người khác. Phản hồi công khai không bao giờ có email, số điện thoại hay id người viết. Các trường hợp lỗi không ghi dòng nào.
- **AC-10**: Trạng thái tài khoản: khi người viết bị khóa hoặc xóa mềm, đánh giá của họ rời danh sách và hai con số ngay (dòng không bị xóa), mở khóa thì trở lại. Người viết bị khóa mà token còn hạn gọi `POST`, `PATCH` hay `DELETE` nhận 403 `ACCOUNT_LOCKED` ngay (`@FreshAuth`). Khi chủ trọ bị khóa hay xóa mềm, mọi route `/landlords/:id/review` và `/landlords/:id/reviews` trả 404 `LANDLORD_NOT_FOUND`, đánh giá còn nguyên và hiện lại khi mở khóa.
- **AC-11**: `GET /moderation/reviews` (quyền `review:moderate`, chỉ admin giữ) trả `{ items, total, page, pageSize }` gồm mọi đánh giá, mọi trạng thái, mới viết trước. Lọc tùy chọn `status` (`visible` hoặc `hidden_by_admin`), `landlordId`, `authorId` (UUID); giá trị sai bị 400 `VALIDATION_FAILED`, tham số lạ bị 400. Mỗi phần tử `{ id, status, stars, comment, hiddenReason, author { id, name }, landlord { id, name }, createdAt, updatedAt }`; `hiddenReason` như AC-8. Không email hay số điện thoại. Người không phải admin bị 403 `PERMISSION_DENIED`.
- **AC-12**: `POST /moderation/reviews/:id/hide` và `POST /moderation/reviews/:id/unhide` với body `{ reason }` (bắt buộc, cùng luật lý do của kiểm duyệt tin): `hide` chuyển `visible` sang `hidden_by_admin`, `unhide` chuyển `hidden_by_admin` sang `visible`. Mỗi lệnh là một câu `UPDATE` có điều kiện trạng thái nguồn cùng một dòng `moderation_logs` (loại đích `review`, hành động `hide_review` hay `unhide_review`, kèm lý do) trong một giao dịch, chỉ khi đổi đúng một dòng; trả 200 phần tử như ở AC-11. Sai trạng thái nguồn bị 409 `REVIEW_STATE_INVALID`; không có đánh giá bị 404 `REVIEW_NOT_FOUND`; id sai bị 400 `INVALID_ID`; thiếu lý do bị 400 `VALIDATION_FAILED`. Đánh giá bị ẩn rời danh sách công khai và hai con số ngay, được gỡ ẩn thì trở lại. Admin ẩn đua với người viết sửa hay xóa không làm mất cập nhật nào: sửa bị chặn khi đã ẩn, xóa thắng và lệnh ẩn nhận 404.
- **AC-13**: Giới hạn tần suất (con số bạn duyệt ngày 2026-11-07), vượt thì 429 `RATE_LIMITED` kèm `Retry-After`: `POST`, `PATCH`, `DELETE` của `/landlords/:id/review` mỗi route 20 lần mỗi giờ theo người dùng (nhóm `reviewWrite` mới, **mỗi route đếm riêng**). Hai route `GET` dùng nhóm `publicRead` có sẵn (300 lần mỗi phút theo IP). Ba route kiểm duyệt của admin không thêm giới hạn, như kiểm duyệt tin.
- **AC-14**: Ràng buộc ở DB: `reviews` có unique (`author_id`, `landlord_id`), `stars` từ 1 đến 5, `comment` rỗng hoặc dài 1 đến 1000 ký tự, `status` chỉ `visible` hay `hidden_by_admin`, `author_id` khác `landlord_id`, mọi khóa ngoại RESTRICT. `INSERT` thẳng vào bảng vi phạm một trong các điều trên bị DB từ chối. Sau migration, `tenant` giữ bốn khóa `review:read`, `review:create`, `review:update`, `review:delete`; `landlord` không giữ khóa `review:*` nào.

## Decision

**Chosen option**: Option 1: Một bảng `reviews` cho mỗi cặp (người viết, chủ trọ), điều kiện viết là chat hai chiều, mọi số tính lúc đọc, admin ẩn kèm lý do trong `moderation_logs`

Một đánh giá là một dòng `reviews` nối người viết với chủ trọ. Ai được viết do dữ liệu chat có sẵn quyết (chủ trọ đã nhắn lại ít nhất một tin); điểm trung bình và số đánh giá không lưu sẵn mà tính từ các dòng `visible` của người viết còn hoạt động, nên ẩn, xóa hay khóa tài khoản có hiệu lực ngay và không bao giờ lệch với danh sách. Ẩn đánh giá theo đúng khuôn ẩn tin: cột `status`, lý do ghi vào `moderation_logs`. Không thêm thư viện, biến môi trường hay việc chạy nền.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Feature design

Quy ước chung theo 0001 đến 0013: Repository bọc Prisma, id `uuidv7()` do DB sinh, `timestamptz`, tên bảng và cột `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`, đọc và ghi thô bằng `$queryRaw` hay `$executeRaw` chỉ nằm trong file `*.repository.ts` (luật lint), giao dịch qua `TransactionRunner`.

**Data model** (một migration; mô hình đã được bạn xác nhận):

| Bảng | Khóa chính | Cột | Ràng buộc và chỉ mục |
|---|---|---|---|
| `reviews` | `id` (uuid, `uuidv7()`) | `landlord_id` (uuid, chủ trọ được đánh giá, FK `users`, RESTRICT), `author_id` (uuid, người viết, FK `users`, RESTRICT), `stars` (smallint, bắt buộc), `comment` (text, có thể rỗng), `status` (text, mặc định `visible`), `created_at` (timestamptz, mặc định `now()`), `updated_at` (timestamptz, mặc định `now()`) | unique `reviews_author_id_landlord_id_unique` (một đánh giá cho mỗi cặp, cũng là chỉ mục tra đánh giá của một người); CHECK `reviews_stars_check` (`stars` từ 1 đến 5); CHECK `reviews_comment_check` (`comment` rỗng, hoặc `char_length` từ 1 đến 1000); CHECK `reviews_status_check` (`visible` hoặc `hidden_by_admin`); CHECK `reviews_author_landlord_check` (`author_id <> landlord_id`); chỉ mục `reviews_landlord_id_created_at_idx` trên (`landlord_id`, `created_at` giảm dần, `id` giảm dần) cho danh sách hồ sơ và hai con số; FK `reviews_author_id_fk`, `reviews_landlord_id_fk` |

Quan hệ: `users` 1:N `reviews` hai lần (là người viết, và là chủ trọ được đánh giá). Mọi FK RESTRICT vì tài khoản chỉ xóa mềm. Khóa ngoại và CHECK không ép được "người viết là người tìm trọ đã được chủ trọ trả lời" hay "đích là chủ trọ"; Service lo (xem Security model). Lý do admin ẩn nằm ở `moderation_logs` (loại đích `review`), không có cột lý do. Không lưu cuộc trò chuyện nào đã đủ điều kiện: chat không bao giờ sửa hay xóa nên điều kiện tính lại được bất cứ lúc nào. `schema.prisma` thêm model `Review` và hai quan hệ tên riêng trên `User` (`ReviewAuthor`, `ReviewLandlord`). Migration có phần dữ liệu cuối file thêm khóa quyền mặc định cho `tenant` (xem Security model), chỉ thêm khóa còn thiếu nên chạy lại không đổi.

**State transitions** (đánh giá):

| Từ | Sang | Ai, bằng gì |
|---|---|---|
| (chưa có) | `visible` | người viết, `POST` |
| `visible` | `visible` | người viết, `PATCH` (đổi sao hay nhận xét, `updated_at` đổi) |
| `visible` | `hidden_by_admin` | admin, `hide` kèm lý do |
| `hidden_by_admin` | `visible` | admin, `unhide` kèm lý do (không có bước chủ sở hữu như tin: người viết không tự hiện lại) |
| `visible` hay `hidden_by_admin` | (xóa hẳn dòng) | người viết, `DELETE` |

Đánh giá `hidden_by_admin` không sửa được (409 `REVIEW_HIDDEN`), chỉ xóa được.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/landlords/:id` | GET | `id` (UUID) | hồ sơ công khai, thêm `reviewCount`, `ratingAverage` | công khai, đọc đăng nhập tùy chọn (không đổi so với 0005) | 400 `INVALID_ID`, 404 `LANDLORD_NOT_FOUND`, 429 |
| `/landlords/:id/follow` | POST, DELETE | như 0005 | cùng hồ sơ chín trường | như 0005 | như 0005 |
| `/landlords/:id/reviews` | GET | `id`, `page`, `pageSize` (query) | `{ items, total, page, pageSize }` | công khai, `@OptionalAuth()` | 400 `INVALID_ID`, 400 `VALIDATION_FAILED`, 404 `LANDLORD_NOT_FOUND`, 429 |
| `/landlords/:id/review` | GET | `id` | `{ review, canReview }` | `review:read` | 400, 404 `LANDLORD_NOT_FOUND`, 403, 401, 429 |
| `/landlords/:id/review` | POST | `id`, `stars` (int, bắt buộc), `comment` (string hoặc null, tùy chọn) | 201 `review` | `review:create`, `@FreshAuth` | 400 `INVALID_ID`, 400 `VALIDATION_FAILED`, 404 `LANDLORD_NOT_FOUND`, 403 `REVIEW_NOT_ELIGIBLE`, 409 `REVIEW_ALREADY_EXISTS`, 409 `CANNOT_REVIEW_SELF`, 403, 401, 429 |
| `/landlords/:id/review` | PATCH | `id`, `stars?`, `comment?` | 200 `review` | `review:update`, `@FreshAuth` | 400, 404 `LANDLORD_NOT_FOUND`, 404 `REVIEW_NOT_FOUND`, 409 `REVIEW_HIDDEN`, 403, 401, 429 |
| `/landlords/:id/review` | DELETE | `id` | 204 | `review:delete`, `@FreshAuth` | 400, 404 `LANDLORD_NOT_FOUND`, 404 `REVIEW_NOT_FOUND`, 403, 401, 429 |
| `/moderation/reviews` | GET | `page`, `pageSize`, `status?`, `landlordId?`, `authorId?` | `{ items, total, page, pageSize }` | `review:moderate` | 400 `VALIDATION_FAILED`, 403, 401 |
| `/moderation/reviews/:id/hide` | POST | `id`, `reason` | 200 phần tử admin | `review:moderate`, `@FreshAuth` | 400, 404 `REVIEW_NOT_FOUND`, 409 `REVIEW_STATE_INVALID`, 403, 401 |
| `/moderation/reviews/:id/unhide` | POST | `id`, `reason` | 200 phần tử admin | `review:moderate`, `@FreshAuth` | như `hide` |

Hình dạng trả về. Phần tử danh sách công khai (`GET /landlords/:id/reviews`):

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8e11",
  "stars": 4,
  "comment": "Chủ trọ trả lời nhanh, phòng đúng như ảnh.",
  "author": { "name": "Bạn Lan" },
  "isMine": false,
  "createdAt": "2026-11-07T03:10:00.000Z",
  "updatedAt": "2026-11-07T03:10:00.000Z"
}
```

Đánh giá của chính người gọi (`review` trong `GET /landlords/:id/review`, và kết quả của `POST` và `PATCH`):

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8e11",
  "stars": 4,
  "comment": null,
  "status": "hidden_by_admin",
  "hiddenReason": "Nội dung xúc phạm cá nhân.",
  "createdAt": "2026-11-07T03:10:00.000Z",
  "updatedAt": "2026-11-07T03:10:00.000Z"
}
```

Phần tử admin (`GET /moderation/reviews` và kết quả `hide`, `unhide`):

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8e11",
  "status": "hidden_by_admin",
  "stars": 1,
  "comment": "…",
  "hiddenReason": "Nội dung xúc phạm cá nhân.",
  "author": { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02", "name": "Bạn Lan" },
  "landlord": { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01", "name": "Anh Minh" },
  "createdAt": "2026-11-07T03:10:00.000Z",
  "updatedAt": "2026-11-07T03:10:00.000Z"
}
```

Hai trường mới của hồ sơ chủ trọ: `"reviewCount": 12`, `"ratingAverage": 4.3` (JSON không phân biệt `4` và `4.0`, FE tự định dạng một chữ số thập phân). `GET /landlords/:id/review` khi chưa viết: `{ "review": null, "canReview": true }`.

Mã lỗi mới (sáu mã, thêm vào bảng `ErrorCode`, tiếng Việt như các mã khác): `REVIEW_NOT_FOUND` (404, "Không tìm thấy đánh giá."), `REVIEW_NOT_ELIGIBLE` (403, "Bạn chỉ đánh giá được chủ trọ đã trả lời tin nhắn của bạn."), `REVIEW_ALREADY_EXISTS` (409, "Bạn đã đánh giá chủ trọ này rồi."), `CANNOT_REVIEW_SELF` (409, "Bạn không thể đánh giá chính mình."), `REVIEW_HIDDEN` (409, "Đánh giá đang bị ẩn nên không sửa được."), `REVIEW_STATE_INVALID` (409, "Đánh giá không ở trạng thái phù hợp cho thao tác này."). Dùng lại `LANDLORD_NOT_FOUND`, `INVALID_ID`, `VALIDATION_FAILED`, `PERMISSION_DENIED`, `ACCOUNT_LOCKED`, `TOKEN_MISSING`, `RATE_LIMITED`.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi**: các guard (đăng nhập, quyền, `@FreshAuth` ở ba route ghi của người viết và hai route ghi của admin, giới hạn tần suất), rồi các pipe (`INVALID_ID`, `VALIDATION_FAILED`), rồi Service. Trong Service, bốn route của người viết: loại tài khoản admin (403) trước; với `POST` tiếp theo là tự đánh giá (409, so id, chưa tra DB); rồi chủ trọ hợp lệ (404, đúng hàm `findActiveLandlord` của hồ sơ); rồi với `GET` mình, `POST`: đủ điều kiện (403, chỉ `POST`); rồi ghi. Vì pipe chạy trước Service, admin gửi id hay body sai nhận 400 chứ không phải 403 (cùng tiền lệ `follow`, `favorites`, chat).
- **Điều kiện đủ** (AC-4) là một truy vấn tồn tại: có dòng `conversations` với `tenant_id` là người gọi và `landlord_id` là chủ trọ, nối `messages` có `sender_id` là chủ trọ. Viết thành `ChatRepository.hasLandlordReplied(tenantId, landlordId)` vì `ChatRepository` là nơi duy nhất chạm hai bảng chat (xem `src/chat/AGENTS.md`).
- **`POST`**: một câu `INSERT ... ON CONFLICT (author_id, landlord_id) DO NOTHING RETURNING`; không trả dòng nào nghĩa là cặp đã có, thành 409 `REVIEW_ALREADY_EXISTS`. Không cần giao dịch: điều kiện đủ không bao giờ mất đi (chat bất biến) nên không có cửa sổ đua giữa kiểm và ghi.
- **`PATCH`**: một câu `UPDATE ... WHERE author_id = $người gọi AND landlord_id = $id AND status = 'visible'`, đặt `updated_at` về giờ hiện tại; chỉ đặt cột có trong body (`comment: null` đặt về `NULL`). Không dòng nào đổi thì tra thêm một câu: không có dòng là 404 `REVIEW_NOT_FOUND`, dòng ở `hidden_by_admin` là 409 `REVIEW_HIDDEN`. `PATCH` lặp lại với giá trị cũ vẫn đổi `updated_at`.
- **`DELETE`**: `DELETE ... WHERE author_id AND landlord_id`; không dòng nào bị xóa thì 404 `REVIEW_NOT_FOUND`.
- **Hai con số của hồ sơ**: một truy vấn gộp lấy `sum(stars)` và `count(*)` trên các dòng `reviews` có `landlord_id` đó, `status = 'visible'`, nối `users` người viết với `status = 'active'` và `deleted_at IS NULL`. `ratingAverage` tính bằng số nguyên: `round(sum * 10 / count) / 10`, `null` khi `count` là 0 (không dùng `avg` kiểu số thực để khỏi lệch ở các nửa như 4,35). Chạy song song với các số cũ của hồ sơ, ngoài giao dịch; có thể lệch vài mili giây (chấp nhận, như 0005).
- **Danh sách công khai** dùng đúng điều kiện đó (một mảnh điều kiện viết một lần trong `ReviewsRepository`, dùng cho cả danh sách, `total` và hai con số), sắp (`created_at` giảm dần, `id` giảm dần), phân trang bằng `PaginationQueryDto` và `Page<T>` có sẵn. `isMine` so `author_id` với người trong token; khách thì `null`. `author.name` dùng cùng ánh xạ tên của hồ sơ chủ trọ (rỗng hay toàn khoảng trắng thì `null`).
- **`hiddenReason`**: `ModerationLogsRepository.findLatestReviewHideReasons(ids)` (cùng khuôn `findLatestListingHideReasons`, lọc `target_type = 'review'` và `action = 'hide_review'`), chỉ gọi cho các đánh giá đang `hidden_by_admin`, một truy vấn cho cả trang.
- **Hide và unhide** theo khuôn `ListingModerationService`: một `updateMany` có điều kiện trạng thái nguồn (`visible` cho hide, `hidden_by_admin` cho unhide) và một dòng `moderation_logs` trong cùng giao dịch, chỉ khi đổi đúng một dòng; không đổi dòng nào thì 404 nếu không có đánh giá, 409 `REVIEW_STATE_INVALID` nếu sai trạng thái. Đọc lại phần tử SAU giao dịch.
- **Cache**: bốn route `/landlords/:id/review` và `/landlords/:id/reviews` trả `Cache-Control: private, no-store` (nội dung đổi theo người xem).
- **Module**: `src/reviews/` gồm `ReviewsDataModule` (chỉ xuất `ReviewsRepository`, để `LandlordsModule` đọc hai con số mà không vòng import, theo tiền lệ `FavoritesDataModule` và `ListingsDataModule`), `ReviewsModule` (hai controller, `ReviewsService`, `ReviewModerationService`; import `LandlordsModule` để dùng `LandlordsRepository.findActiveLandlord`, nên `LandlordsModule` thêm `exports: [LandlordsRepository]`), `LandlordReviewsController` (`@Controller('landlords')`, năm route), `ReviewModerationController` (`@Controller('moderation/reviews')`), ánh xạ và DTO (`CreateReviewDto`, `UpdateReviewDto`, `ReviewModerationQueryDto`; lý do dùng lại `ModerationReasonDto`). `ChatRepository` thêm `hasLandlordReplied` và xuất qua một module dữ liệu nhỏ như tiền lệ trên; `ModerationLogsRepository` thêm `findLatestReviewHideReasons`. `ReviewsModule` vào `AppModule`.

**Giới hạn tần suất** (một nhóm mới trong `RATE_LIMITS`, dùng `@RateLimited`):

| Nhóm | Route | Bộ đếm |
|---|---|---|
| `reviewWrite` (mới) | `POST`, `PATCH`, `DELETE /landlords/:id/review` | `user`: 20 lần mỗi giờ, **mỗi route đếm riêng** |
| `publicRead` (có sẵn) | `GET /landlords/:id/reviews`, `GET /landlords/:id/review` | `ip`: 300 lần mỗi phút, mỗi route đếm riêng |

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Mọi route | người gọi và loại tài khoản | `userId` và `accountType` trong `RequestUser` (từ token) |
| `POST` | người viết (`author_id`) | `userId` trong token, không nhận từ đường dẫn hay body |
| `POST`, `PATCH`, `DELETE`, `GET` mình | chủ trọ (`landlord_id`) | tham số đường dẫn `:id` qua `uuidParam()`, rồi `findActiveLandlord` |
| `POST`, `PATCH` | `stars`, `comment` | body của request, qua `@IsInt`, `@Trim()` và kiểm độ dài |
| `POST` | đủ điều kiện hay chưa | `ChatRepository.hasLandlordReplied(userId, :id)` |
| `POST` | `id`, `created_at`, `updated_at`, `status` ban đầu | `uuidv7()`, `now()` của DB, mặc định `visible` |
| `PATCH` | `updated_at` mới | giờ hiện tại do Repository đặt, mỗi lần `PATCH` thành công |
| `GET` mình | `canReview` | `review === null` và `hasPermissions(user.permissions, ['review:create'])` và `userId !== :id` và `hasLandlordReplied` |
| `GET` mình, danh sách admin | `hiddenReason` | `moderation_logs` mới nhất với `target_type = 'review'`, `action = 'hide_review'`, `target_id` là id đánh giá, khi `status = 'hidden_by_admin'`; ngược lại `null` |
| Danh sách công khai | `author.name` | `users.name` của `author_id`, qua ánh xạ tên của hồ sơ |
| Danh sách công khai | `isMine` | `author_id` bằng `userId` trong token; khách (không có `RequestUser`) thì `null` |
| Danh sách công khai | thứ tự, `total`, `page`, `pageSize` | `created_at` giảm dần rồi `id` giảm dần; `count(*)` cùng điều kiện; query qua `PaginationQueryDto` |
| Hồ sơ | `reviewCount`, `ratingAverage` | `count(*)` và `sum(stars)` của đúng tập dòng ở danh sách công khai; trung bình là `round(sum * 10 / count) / 10`, `null` khi `count = 0` |
| Danh sách admin | `author { id, name }`, `landlord { id, name }` | `users.id` và `users.name` của `author_id` và `landlord_id` |
| Danh sách admin | bộ lọc | `status`, `landlordId`, `authorId` từ query, qua `@IsIn` và `@IsUUID` |
| `hide`, `unhide` | người thao tác, lý do | `userId` trong token; `reason` trong body qua `ModerationReasonDto` |
| `hide`, `unhide` | dòng `moderation_logs` | `target_type = 'review'`, `target_id` là `:id`, `action` là `hide_review` hay `unhide_review`, `reason` |

**Key invariants**:
- Mỗi cặp (`author_id`, `landlord_id`) có tối đa một đánh giá, `author_id` khác `landlord_id`, `stars` từ 1 đến 5, `comment` rỗng hoặc 1 đến 1000 ký tự (DB).
- `reviewCount` và `ratingAverage` của hồ sơ luôn tính trên đúng tập dòng mà danh sách công khai trả (cùng một mảnh điều kiện trong Repository), nên không bao giờ lệch nhau ngoài độ trễ vài mili giây.
- Đánh giá `hidden_by_admin` không bao giờ xuất hiện ở danh sách công khai hay trong hai con số, và không sửa được; chỉ admin đổi `status`, và mỗi lần đổi có đúng một dòng `moderation_logs` cùng lý do.
- `author_id` luôn lấy từ token, `landlord_id` luôn lấy từ đường dẫn rồi qua kiểm chủ trọ hợp lệ; không bao giờ từ body.
- Đủ điều kiện chỉ kiểm lúc tạo; sửa và xóa chỉ dựa vào việc đánh giá là của chính người gọi.
- Phản hồi công khai không có email, số điện thoại, id người viết hay `status`; chỉ phần tử admin có id hai bên.

**Security model**:
- Bốn route của người viết cần đăng nhập; hai route đọc công khai không cần. Một module quyền mới trong danh mục (đúng bảng ở `permission-catalog.ts`): `review` với `read`, `create`, `update`, `delete`, `moderate`, `ownerScoped: true`, `adminActions: ['moderate']`. `review:read` chỉ canh route "đánh giá của tôi" (đọc công khai không cần quyền); `create`, `update`, `delete` canh ba route ghi; `moderate` canh ba route của admin và chỉ admin giữ được.
- Quyền mặc định (thêm bằng phần dữ liệu của migration): `tenant` giữ bốn khóa `review:read`, `review:create`, `review:update`, `review:delete`; `landlord` không giữ khóa nào, nên chủ trọ không tự đánh giá mình hay ai khác. Admin chỉnh quyền hai loại này bằng API quyền có sẵn.
- **Admin**: `ADMIN_PERMISSIONS` là `manage` mọi module nên admin qua được guard `review:read`, `create`, `update`, `delete`. Service chặn `accountType === 'admin'` bằng 403 `PERMISSION_DENIED` ở bốn route của người viết (như `follow`, `favorites`, chat); admin chỉ đọc và ẩn bằng ba route kiểm duyệt.
- Chủ trọ được admin cấp `review:create` vẫn không đánh giá được chính mình (409), và chỉ đánh giá được chủ trọ đã trả lời mình trong chat (403 nếu chưa).
- Ba route ghi của người viết và hai route ghi của admin dùng `@FreshAuth` (đọc lại trạng thái và quyền từ DB), nên tài khoản vừa bị khóa dừng ngay; `GET` theo quyền trong token như thường (cửa sổ tối đa 15 phút của token đã được chấp nhận ở nơi khác), nên `canReview` có thể trễ một lần refresh khi quyền đổi.
- Đánh giá là chữ do người dùng nhập, lưu nguyên dạng thô: API không lọc HTML hay liên kết, FE phải escape khi hiện. Tên người viết hiện công khai (người xem thấy tên cạnh lời nhận xét); lựa chọn ẩn danh đã bị bạn bỏ.
- Không đụng dữ liệu thuộc phạm vi tuân thủ riêng của bản demo (không thanh toán, không giấy tờ). Mọi đổi trạng thái của admin có nhật ký trong `moderation_logs`.

**Configuration required**: không có biến môi trường, không dịch vụ ngoài, không thư viện mới, không seed. Chỉ cần một migration (bảng, ràng buộc, chỉ mục và phần dữ liệu cho khóa quyền mặc định). DB dev cần `npm run migration:deploy`.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: tenant đã nhắn và được chủ trọ trả lời viết đánh giá 5 sao kèm nhận xét, sửa thành 4 sao, thấy nó ở `GET /landlords/:id/review` (`canReview: false`), khách thấy nó ở danh sách và `reviewCount` 1, `ratingAverage` 4 ở hồ sơ, rồi xóa thì hồ sơ về 0 và `null`, verifies **AC-1**, **AC-2**, **AC-3**, **AC-6**, **AC-7**, **AC-8**
- Failure case: tenant chưa nhắn, hoặc chỉ nhắn chưa được trả lời, hoặc chỉ nhắn với chủ trọ khác: 403 `REVIEW_NOT_ELIGIBLE` và không dòng nào; sau khi chủ trọ trả lời thì viết được, verifies **AC-4**
- Failure case: 20 lần `POST` đồng thời cùng một cặp ra đúng một 201 và 19 lần 409 `REVIEW_ALREADY_EXISTS`; chủ trọ được cấp quyền đánh giá chính mình: 409 `CANNOT_REVIEW_SELF`, verifies **AC-5**
- Failure case: `stars` 0, 6, 4,5, `"5"`, thiếu; `comment` rỗng, toàn khoảng trắng, 1001 ký tự, số, chứa `\u0000`: 400 `VALIDATION_FAILED` ở `POST` và `PATCH`, không đổi dòng; 1000 ký tự và có xuống dòng ở giữa thì được; `PATCH` body rỗng 400; `comment: null` xóa nhận xét, verifies **AC-3**, **AC-6**
- Happy path: danh sách đúng thứ tự mới nhất trước, `page` và `pageSize` ở các biên, tham số lạ 400, `isMine` là `null` với khách và token sai, `true` ở dòng của mình, không có email, số điện thoại, id người viết, chủ trọ bị khóa 404, id `abc` 400, verifies **AC-2**
- Auth/permission: khách 401 ở bốn route người viết; chủ trọ mặc định 403; admin 403 ở cả bốn mà không ghi dòng nào; id sai của admin vẫn 400; người này không đọc hay đổi được đánh giá của người khác (không có đường nào để chỉ vào), verifies **AC-9**
- Failure case: khóa người viết thì đánh giá rời danh sách và hai con số, mở khóa thì trở lại; người viết bị khóa mà token còn hạn gọi ba route ghi: 403 `ACCOUNT_LOCKED`; khóa chủ trọ thì mọi route 404, mở khóa thì đánh giá còn nguyên, verifies **AC-10**, **AC-1**, **AC-2**
- Happy path: admin lọc `GET /moderation/reviews` theo `status`, `landlordId`, `authorId`, thấy cả đánh giá đã ẩn kèm `hiddenReason`; người không phải admin 403; giá trị lọc sai 400, verifies **AC-11**
- Failure case: `hide` rồi `hide` lần hai: 409 `REVIEW_STATE_INVALID`; `unhide` đánh giá `visible`: 409; mỗi lần đổi đúng một dòng `moderation_logs`; ẩn thì rời hồ sơ và hai con số, gỡ ẩn thì trở lại; người viết thấy `status` và `hiddenReason` ở route của mình, `PATCH` bị 409 `REVIEW_HIDDEN`, `DELETE` được; ẩn đua với sửa và với xóa không mất cập nhật nào (hai điều khiển âm), verifies **AC-12**, **AC-6**, **AC-7**, **AC-8**
- Auth/permission: vượt 20 lần mỗi giờ ở từng route ghi nhận 429 kèm `Retry-After`, mỗi route đếm riêng; 300 lần mỗi phút ở hai route đọc, verifies **AC-13**
- Failure case: `INSERT` thẳng vào DB đánh giá trùng cặp, người viết bằng chủ trọ, `stars` 0 hoặc 6, `comment` rỗng hoặc dài 1001, `status` lạ: DB từ chối cả bảy; sau migration `tenant` giữ bốn khóa và `landlord` không giữ khóa nào, verifies **AC-14**
- Kiểm bằng `EXPLAIN` (không phải test tự động): hồ sơ và danh sách của một chủ trọ có 5 nghìn đánh giá trong bảng 50 nghìn dòng; đo một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-1**, **AC-2**

## Build plan

Hướng build theo Skateboard (bản mỏng nhất dùng được trước, rồi mới mở rộng): mốc 1 cho người đã nhắn với chủ trọ viết, sửa, xóa đánh giá và cho mọi người đọc chúng cùng điểm trung bình trên hồ sơ, vậy là dùng được hết vòng; mốc 2 thêm kiểm duyệt của admin, chỉ thêm route chứ không đổi hợp đồng của mốc 1. Bảng, mọi ràng buộc và khóa quyền nằm trong một migration ở mốc 1. Giữa hai mốc admin chưa có cách ẩn đánh giá xấu ngoài SQL tay, nên nên làm mốc 2 ngay sau khi bạn review mốc 1. Hai mốc, mỗi mốc một lần `/develop` rồi dừng cho bạn review (khớp ô `Build it` trong scope). Mỗi mốc đổi API thì cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong mốc đó (quy tắc tài liệu sống), gắn `@RateLimited` ngay khi tạo route.

**Mốc 1: viết, sửa, xóa, đọc và hai con số trên hồ sơ**
1. Thêm model `Review` vào `schema.prisma` (hai quan hệ tên riêng `ReviewAuthor` và `ReviewLandlord` trên `User`) và một migration tạo bảng, unique, chỉ mục danh sách, bốn CHECK viết tay (`reviews_stars_check`, `reviews_comment_check`, `reviews_status_check`, `reviews_author_landlord_check`) và phần dữ liệu thêm bốn khóa `review:*` mặc định cho `tenant` (chỉ thêm khóa còn thiếu); áp lên DB thử, hỏi schema thật, `migrate diff` không lệch, sửa `migration-defaults.spec.ts`, satisfies **AC-14**, **AC-9**
2. Danh mục quyền thêm `review` (`read`, `create`, `update`, `delete`, `moderate`, `adminActions: ['moderate']`) kèm test danh mục; sáu mã lỗi kèm bảng ánh xạ; nhóm `reviewWrite` trong `RATE_LIMITS` kèm test bảng giới hạn, satisfies **AC-9**, **AC-13**
3. `ChatRepository.hasLandlordReplied` (xuất qua module dữ liệu nhỏ, không vòng import) và `ModerationLogsRepository.findLatestReviewHideReasons`, satisfies **AC-4**, **AC-8**
4. `src/reviews/`: `ReviewsRepository` (mảnh điều kiện dùng chung, `INSERT ... ON CONFLICT DO NOTHING`, `UPDATE` có điều kiện `visible`, `DELETE`, tra đánh giá của một người, gộp `sum` và `count`, trang danh sách), `ReviewsService` (kiểm admin trước, rồi thứ tự lỗi như mục "Quy tắc"), ánh xạ (`author.name`, `isMine`, `hiddenReason`, `canReview`), DTO (`CreateReviewDto`, `UpdateReviewDto`), `LandlordReviewsController` với năm route (`@RequirePermissions`, `@RateLimited`, `@FreshAuth` ở ba route ghi, `@OptionalAuth` ở danh sách, `uuidParam()`, `Cache-Control: private, no-store`), `ReviewsDataModule` và `ReviewsModule` vào `AppModule`; `LandlordsModule` import `ReviewsDataModule` và xuất `LandlordsRepository`; `LandlordsService` thêm `reviewCount` và `ratingAverage` vào hồ sơ (cả `follow` và `unfollow` đi qua `getProfile` nên tự có), đổi `LandlordProfileResponse`, `toLandlordProfile` và các test đang kiểm "đúng bảy trường" thành chín, satisfies **AC-1** đến **AC-10**, **AC-13**
5. Thêm bước xóa `reviews` vào `deleteDemoData` trong `src/database/seed-demo.ts` (xóa mọi dòng có `author_id` hoặc `landlord_id` là tài khoản demo, kể cả đánh giá của người thật về chủ trọ demo), vì khóa ngoại RESTRICT sẽ chặn `--reset`, satisfies **AC-14**
6. Test đơn vị (Service, Repository, ánh xạ, bảng quyền và duyệt route khai báo quyền, mapper hồ sơ chín trường), kiểm thật trên DB thử (điều kiện đủ qua bốn tình huống chat, 20 lần `POST` đồng thời, giá trị biên, quyền, khóa người viết và chủ trọ, ràng buộc DB bằng `INSERT` thẳng, 429, hai con số đối chiếu bằng phép tính độc lập từ dòng thô), điều khiển âm (bỏ kiểm chat, bỏ lọc `visible`, bỏ lọc người viết còn hoạt động, bỏ kiểm admin, hai con số lấy từ một tập khác với danh sách), `EXPLAIN` một lần theo kịch bản ở mục test (ghi số, không chỉnh), Postman folder 26 (tái dùng token có sẵn, không đăng ký tài khoản mới, không đăng nhập admin lại; kiểm folder 03: danh sách quyền mặc định của `tenant` ở đó phải có bốn khóa `review:*`), `api-for-frontend.md` (mục 6.40 mới, mục hồ sơ chủ trọ thêm hai trường, bảng mã lỗi và giới hạn tần suất, màn hình, quy tắc, nhật ký, phụ lục), `verify.md`, satisfies **AC-1** đến **AC-10**, **AC-13**, **AC-14**

**Mốc 2: kiểm duyệt của admin**
7. `ReviewModerationService` (danh sách có lọc, `hide`, `unhide` theo khuôn `ListingModerationService`), `ReviewModerationController` với ba route (`review:moderate`, `@FreshAuth` ở hai route ghi, `ModerationReasonDto`), DTO `ReviewModerationQueryDto`, ánh xạ phần tử admin, satisfies **AC-11**, **AC-12**
8. Test đơn vị, kiểm thật trên DB thử (bộ lọc, ẩn và gỡ ẩn kèm đúng một dòng log, `hiddenReason` thật, rời và trở lại danh sách và hai con số, `PATCH` bị 409 khi đã ẩn, `DELETE` được, ẩn đua với sửa và với xóa), điều khiển âm (bỏ điều kiện `visible` trong câu sửa, bỏ điều kiện trạng thái nguồn trong `hide`, bỏ dòng log), mở rộng Postman folder 26 (tái dùng `adminToken`) và `api-for-frontend.md`, `verify.md`, satisfies **AC-11**, **AC-12**, và chạy lại **AC-1**, **AC-2**, **AC-8** với đánh giá bị ẩn

## Consequences

**Positive**:
- Một bảng, tám route, không thư viện mới, không biến môi trường, không việc chạy nền: gọn đúng tinh thần MVP và khớp cách kiểm bằng script thật và Newman đang dùng.
- Điều kiện viết dựa trên chat có sẵn: không cần luồng xác minh mới, mà vẫn chặn được đánh giá của người chưa hề trao đổi.
- Hai con số tính lúc đọc từ cùng một mảnh điều kiện với danh sách nên không lệch; khóa tài khoản, ẩn hay xóa có hiệu lực ngay.
- Tái dùng ba khuôn đã chạy: hồ sơ công khai (0005, 0009), ẩn kèm lý do (0002), quyền mặc định qua migration và chặn admin trong Service (0013).

**Negative / tradeoffs**:
- Chat là bằng chứng đã liên hệ chứ không phải đã ở trọ. Một chủ trọ có thể tự đăng ký một tài khoản người tìm trọ, nhắn cho chính mình, trả lời rồi chấm 5 sao (số điện thoại chỉ bắt buộc duy nhất với tài khoản chủ trọ). Chưa có biện pháp chống; với bản demo thì chấp nhận, nếu chạy thật thì đây là điểm yếu đầu tiên của điểm tin cậy.
- Một đánh giá duy nhất đã làm điểm trung bình thành chính nó, vì chưa có số đánh giá tối thiểu mới hiện điểm; FE nên hiện kèm `reviewCount`.
- Xóa là xóa hẳn dòng: người viết xóa một đánh giá đang bị ẩn thì admin mất luôn nội dung (nhật ký chỉ còn lý do, không còn chữ). Chọn vậy để giữ unique đơn giản và giống `follows`, `favorites`.
- Đánh giá đang bị ẩn không sửa được, nên người viết muốn sửa lỗi chỉ có cách xóa rồi viết lại (vẫn được vì điều kiện chat không mất đi); admin không có tín hiệu "đã sửa".
- Admin chưa tìm được theo từ trong nhận xét, chỉ lọc theo trạng thái, chủ trọ, người viết; và giữa hai mốc chưa có công cụ ẩn.
- Mỗi lần đọc hồ sơ thêm một truy vấn gộp (đo `EXPLAIN` một lần, không chỉnh nếu chậm); hai con số, danh sách và các số cũ của hồ sơ không chung một ảnh chụp dữ liệu nên lệch được vài mili giây.
- Tên người viết hiện công khai cạnh lời nhận xét về một chủ trọ có thể trả đũa; lựa chọn ẩn danh đã bị bạn bỏ để giữ độ tin cậy.
- Chủ trọ bị khóa thì người viết không xóa được đánh giá của mình cho tới khi mở khóa (mọi route dưới `/landlords/:id` cần chủ trọ hợp lệ); đánh giá đó vốn không hiện ở đâu.
- `canReview` đọc quyền từ token nên có thể trễ một lần refresh khi admin đổi quyền; `POST` vẫn là nơi quyết định cuối.
- Hợp đồng hồ sơ của spec 0005 (đúng bảy trường) đổi thành chín trường; xem Follow-up.
- Nội dung là chữ thô lưu nguyên: FE phải escape khi hiện, backend không lọc HTML hay liên kết.

**Neutral**:
- Thêm module `src/reviews/`, một bảng, một module quyền, sáu mã lỗi, một nhóm giới hạn, một phương thức ở `ChatRepository` và một ở `ModerationLogsRepository`, một dòng `exports` ở `LandlordsModule`; hợp đồng các API đang chạy chỉ đổi ở hồ sơ (thêm hai trường).
- DB dev cần `npm run migration:deploy`; sau đó tenant đã có sẵn quyền đánh giá. Nếu admin đã chỉnh quyền của `tenant` bằng API thì các khóa mới đã được thêm cho đủ, nhưng quyền mà admin đã gỡ cho riêng loại này thì không bị khôi phục (chỉ thêm khóa còn thiếu).
- `seed:demo` không tạo đánh giá nào; `--reset` xóa được đánh giá liên quan nhờ bước ở mục 5.
- Số `0014` không trùng ai vì mỗi spec nằm trong thư mục riêng.

## Follow-up

- [x] Đã sửa ngày 2026-11-18 ở 0005 (AC-1, ví dụ phản hồi, bài kiểm) và 0009 (năm chỗ nhắc hồ sơ bảy trường). Mục AC-1 của spec 0005 vẫn nói hồ sơ có "đúng 7 trường" (kèm chú thích của `LandlordProfileResponse`); spec này làm thành chín trường, kể cả kết quả của `follow` và `unfollow`. Cần `/architect` sửa một dòng ở 0005 khi build xong (hoặc ngay bây giờ nếu bạn muốn).
- [ ] FE (không thuộc backend, ghi vào `api-for-frontend.md`): dựng JSON-LD `aggregateRating` từ `ratingAverage` và `reviewCount` cho SEO hồ sơ chủ trọ; escape `comment`; khách nhận `isMine: null`; route đọc đăng nhập tùy chọn không bao giờ 401 nên làm mới token trước khi gọi.
- [ ] Hoãn, thêm lại bằng `/scope` khi cần: chủ trọ trả lời đánh giá, phân bố số sao (bao nhiêu đánh giá 5 sao, 4 sao...), lọc hoặc sắp theo sao, nút báo cáo đánh giá, ảnh trong đánh giá, bình chọn "hữu ích", đánh giá riêng cho từng nhà trọ, chống đánh giá giả (tuổi tài khoản tối thiểu, số tin nhắn tối thiểu), tìm theo chữ trong nhận xét cho admin, giữ lại nội dung đã xóa (xóa mềm), thông báo cho chủ trọ khi có đánh giá mới hoặc cho người viết khi bị ẩn (cần việc nền), số đánh giá tối thiểu trước khi hiện điểm, hạn mức viết theo ngày lưu trong DB, dòng đánh giá mẫu trong `seed:demo`.
- [ ] Sau khi build, `/sync` ghi bảng `reviews`, nhóm giới hạn và module quyền `review` vào các spec nền móng nếu còn lệch (`0001/0005-postgres-data-conventions.md`), tạo `src/reviews/AGENTS.md`, và thêm bước `reviews` vào ghi chú `src/chat/AGENTS.md` về `deleteDemoData` nếu cần.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
