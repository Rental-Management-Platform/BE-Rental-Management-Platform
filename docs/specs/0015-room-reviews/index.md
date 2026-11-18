# 0015. Đánh giá từng phòng trọ trên tin đăng

**Date**: 2026-11-09
**Status**: Accepted

## Summary

Người tìm trọ đã nhắn về một tin đăng cụ thể và được chủ trọ trả lời thì viết được một đánh giá cho phòng trong tin đó: số sao từ 1 đến 5 và lời nhận xét tùy chọn. Chi tiết tin công khai thêm điểm trung bình và số đánh giá của phòng, kèm một route riêng liệt kê các đánh giá có phân trang. Cách làm giống đánh giá chủ trọ ở spec 0014 (mỗi người một đánh giá cho mỗi phòng, sửa và xóa của mình, admin ẩn kèm lý do), nhưng nằm ở một bảng riêng `listing_reviews` nên điểm của chủ trọ không đổi. Mọi con số tính lúc đọc: đánh giá hiện và biến cùng lúc với tin, không bộ đếm lưu sẵn, không việc chạy nền.

## Requirements

**User stories**:
- Là người tìm trọ đã nhắn về một tin và được chủ trọ trả lời, tôi muốn đánh giá chính căn phòng đó để người sau biết phòng có đúng như tin đăng hay không.
- Là khách hay người tìm trọ, tôi muốn đọc điểm trung bình và các đánh giá ngay trên chi tiết tin trước khi liên hệ.
- Là người đã viết đánh giá, tôi muốn sửa hay xóa nó, và biết khi admin đã ẩn nó cùng lý do.
- Là admin, tôi muốn tìm và ẩn đánh giá phòng vi phạm kèm lý do, và gỡ ẩn khi ẩn nhầm.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: Chi tiết công khai `GET /listings/:slugCode` thêm hai trường: `reviewCount` (số nguyên từ 0) và `ratingAverage` (số sao trung bình làm tròn một chữ số thập phân, `null` khi `reviewCount` là 0), cùng giá trị cho khách và người đăng nhập. Chỉ tính các đánh giá `visible` của tin đó mà người viết là tài khoản đang hoạt động (`status = active`, chưa xóa mềm), nên `reviewCount` luôn bằng `total` của danh sách ở AC-2 cộng mọi trang, và `ratingAverage` là trung bình số sao của chính các dòng đó (cùng cách làm tròn nửa lên của `averageStars` ở 0014). Các trường cũ của chi tiết, 404 `LISTING_NOT_FOUND`, cách đếm lượt xem và luật số điện thoại không đổi. Bốn route trả thẻ tin (`GET /listings`, `GET /me/favorites`, `GET /landlords/:id/listings`, `GET /me/listings`) và chi tiết riêng của chủ trọ (`GET /me/listings/:id`) không đổi và không có hai trường này.
- **AC-2**: `GET /listings/:id/reviews` (`:id` là UUID của tin, lấy từ trường `id` của chi tiết) không cần đăng nhập (đọc đăng nhập tùy chọn: khách, token sai hay hết hạn vẫn nhận 200, không bao giờ 401), chỉ nhận `page` và `pageSize` (tham số khác bị 400), trả `{ items, total, page, pageSize }`, mới viết trước (`created_at` giảm dần, rồi `id` giảm dần). Chỉ gồm đánh giá `visible` của người viết đang hoạt động. Mỗi phần tử đúng hình dạng của 0014 AC-2: `id`, `stars`, `comment` (`null` nếu không có), `author` (đúng một trường `name`, có thể `null`), `isMine` (`null` với khách, `true` hay `false` với người đăng nhập), `createdAt`, `updatedAt`; không email, số điện thoại, id người viết hay trạng thái. Tin phải đang hiện công khai theo đúng điều kiện của chi tiết công khai, không thì 404 `LISTING_NOT_FOUND`; id sai định dạng bị 400 `INVALID_ID`. Phản hồi có `Cache-Control: private, no-store`.
- **AC-3**: `POST /listings/:id/review` với body `{ stars, comment? }`: người có quyền `review:create` (mặc định chỉ `tenant`) đã đủ điều kiện (AC-4) nhận 201 đánh giá của mình (hình dạng ở AC-8). `stars` là số nguyên từ 1 đến 5. `comment` bỏ trống hoặc `null` là không có nhận xét; nếu là chuỗi thì bỏ khoảng trắng hai đầu, dài 1 đến 1000 ký tự sau khi bỏ, không chứa `\u0000` (đúng luật của 0014 AC-3); chuỗi rỗng hay toàn khoảng trắng bị từ chối. Sai bị 400 `VALIDATION_FAILED` kèm tên trường, không ghi dòng nào. Người viết luôn là người trong token và tin luôn là `:id`, không nhận từ body.
- **AC-4**: Điều kiện được đánh giá phòng: người gọi có một cuộc trò chuyện về chính tin này (`conversations.listing_id` là `:id`, `tenant_id` là người gọi) trong đó chủ trọ đã gửi ít nhất một tin nhắn (`messages.sender_id` bằng `conversations.landlord_id`). Chỉ kiểm lúc tạo, không kiểm lại khi sửa hay xóa. Người chưa đủ điều kiện (chưa nhắn về tin này, hoặc nhắn rồi mà chủ trọ chưa trả lời, hoặc chỉ nhắn về tin khác, kể cả tin khác của cùng chủ trọ) bị 403 `LISTING_REVIEW_NOT_ELIGIBLE` và không ghi dòng nào.
- **AC-5**: Mỗi cặp (người viết, tin) chỉ có tối đa một đánh giá: `POST` lần hai bị 409 `LISTING_REVIEW_ALREADY_EXISTS`, và 20 lần `POST` đồng thời cùng một cặp ra đúng một 201 và 19 lần 409. Chủ trọ của tin (chủ của nhà trọ chứa tin, nếu được admin cấp `review:create`) đánh giá phòng của chính mình bị 409 `CANNOT_REVIEW_SELF` (kiểm sau khi tin hợp lệ và trước điều kiện chat). Xóa đánh giá thì được viết lại (AC-7).
- **AC-6**: `PATCH /listings/:id/review` với body `{ stars?, comment? }` (phải có ít nhất một trường; `comment: null` xóa nhận xét; cùng luật giá trị ở AC-3): người có quyền `review:update` sửa đánh giá `visible` của chính mình nhận 200 đánh giá mới, `updatedAt` đổi, `createdAt` không đổi. Chưa có đánh giá nhận 404 `LISTING_REVIEW_NOT_FOUND`; đánh giá đang bị admin ẩn nhận 409 `LISTING_REVIEW_HIDDEN`; body rỗng hay sai bị 400 `VALIDATION_FAILED`. Không trường hợp lỗi nào đổi dòng.
- **AC-7**: `DELETE /listings/:id/review`: người có quyền `review:delete` xóa đánh giá của chính mình (kể cả đang bị ẩn) nhận 204; dòng bị xóa hẳn, điểm trung bình và số đánh giá đổi ngay, và người đó viết lại được (nếu còn đủ điều kiện). Chưa có đánh giá nhận 404 `LISTING_REVIEW_NOT_FOUND`.
- **AC-8**: `GET /listings/:id/review` (quyền `review:read`, mặc định chỉ `tenant`) trả 200 `{ review, canReview }`. `review` là `null` hoặc đánh giá của chính người gọi `{ id, stars, comment, status, hiddenReason, createdAt, updatedAt }`, trong đó `status` là `visible` hay `hidden_by_admin` và `hiddenReason` là lý do admin ẩn gần nhất khi đang bị ẩn, còn lại `null`. `canReview` là `true` đúng khi `review` là `null`, người gọi giữ `review:create` trong token, không phải chủ trọ của tin và đã đủ điều kiện (AC-4); POST vẫn là nơi quyết định cuối. Hai route `POST` và `PATCH` cũng trả đúng hình dạng `review` này.
- **AC-9**: Quyền và cách ly: khách bị 401 `TOKEN_MISSING` ở bốn route cần đăng nhập (`GET`, `POST`, `PATCH`, `DELETE` của `/listings/:id/review`); chủ trọ mặc định không giữ khóa `review:*` nên nhận 403 `PERMISSION_DENIED`; admin giữ mọi quyền nhưng cả bốn route này bị 403 `PERMISSION_DENIED` vì Service kiểm loại tài khoản (sau pipe, nên id hay body sai vẫn là 400). Không route nào nhận id của đánh giá ở phía người viết, nên một người không bao giờ đọc hay đổi được đánh giá của người khác. Phản hồi công khai không bao giờ có email, số điện thoại hay id người viết. Các trường hợp lỗi không ghi dòng nào.
- **AC-10**: Hiển thị đi theo tin và theo tài khoản người viết. Khi tin không còn hiện công khai (chủ trọ ẩn hoặc admin ẩn, tin hay nhà trọ bị xóa mềm, chủ trọ bị khóa hay xóa mềm, hết dùng thử hay hết gói, hoặc bị ẩn bớt vì vượt hạn mức), cả năm route `/listings/:id/review` và `/listings/:id/reviews` trả 404 `LISTING_NOT_FOUND`, kể cả `DELETE` của chính người viết; các dòng đánh giá còn nguyên và hiện lại đúng lúc tin hiện lại. Khi người viết bị khóa hoặc xóa mềm, đánh giá của họ rời danh sách và hai con số ngay (dòng không bị xóa), mở khóa thì trở lại. Người viết bị khóa mà token còn hạn gọi `POST`, `PATCH` hay `DELETE` nhận 403 `ACCOUNT_LOCKED` ngay (`@FreshAuth`).
- **AC-11**: `GET /moderation/listing-reviews` (quyền `review:moderate`, chỉ admin giữ) trả `{ items, total, page, pageSize }` gồm mọi đánh giá phòng, mọi trạng thái, kể cả của tin đang ẩn hay đã xóa, mới viết trước. Lọc tùy chọn `status` (`visible` hoặc `hidden_by_admin`), `listingId`, `authorId` (UUID); giá trị sai bị 400 `VALIDATION_FAILED`, tham số lạ bị 400. Mỗi phần tử `{ id, status, stars, comment, hiddenReason, author { id, name }, listing { id, code, title }, createdAt, updatedAt }`; `hiddenReason` như AC-8. Không email hay số điện thoại. Người không phải admin bị 403 `PERMISSION_DENIED`.
- **AC-12**: `POST /moderation/listing-reviews/:id/hide` và `POST /moderation/listing-reviews/:id/unhide` với body `{ reason }` (bắt buộc, cùng luật lý do của kiểm duyệt tin): `hide` chuyển `visible` sang `hidden_by_admin`, `unhide` chuyển `hidden_by_admin` sang `visible`. Mỗi lệnh là một câu `UPDATE` có điều kiện trạng thái nguồn cùng một dòng `moderation_logs` (loại đích `listing_review`, hành động `hide_listing_review` hay `unhide_listing_review`, kèm lý do) trong một giao dịch, chỉ khi đổi đúng một dòng; trả 200 phần tử như ở AC-11. Sai trạng thái nguồn bị 409 `LISTING_REVIEW_STATE_INVALID`; không có đánh giá bị 404 `LISTING_REVIEW_NOT_FOUND`; id sai bị 400 `INVALID_ID`; thiếu lý do bị 400 `VALIDATION_FAILED`. Đánh giá bị ẩn rời danh sách công khai và hai con số ngay, được gỡ ẩn thì trở lại. Admin ẩn đua với người viết sửa hay xóa không làm mất cập nhật nào: sửa bị chặn khi đã ẩn, xóa thắng và lệnh ẩn nhận 404.
- **AC-13**: Giới hạn tần suất (dùng lại nhóm bạn đã duyệt ở 0014, không thêm nhóm), vượt thì 429 `RATE_LIMITED` kèm `Retry-After`: `POST`, `PATCH`, `DELETE` của `/listings/:id/review` dùng nhóm `reviewWrite` (20 lần mỗi giờ theo người dùng, **mỗi route đếm riêng**). Hai route `GET` dùng nhóm `publicRead` (300 lần mỗi phút theo IP, mỗi route đếm riêng). Ba route kiểm duyệt của admin không thêm giới hạn, như kiểm duyệt tin và đánh giá chủ trọ.
- **AC-14**: Ràng buộc ở DB: `listing_reviews` có unique (`author_id`, `listing_id`), `stars` từ 1 đến 5, `comment` là `NULL` hoặc dài 1 đến 1000 ký tự (chuỗi rỗng bị từ chối), `status` chỉ `visible` hay `hidden_by_admin`, mọi khóa ngoại RESTRICT. `INSERT` thẳng vào bảng vi phạm một trong các điều trên bị DB từ chối. Migration không có phần dữ liệu: `tenant` vẫn giữ đúng bốn khóa `review:read`, `review:create`, `review:update`, `review:delete` của 0014, `landlord` vẫn không giữ khóa `review:*` nào, và bảng `reviews` không đổi.
- **AC-15**: Đánh giá chủ trọ của 0014 chạy như cũ: hồ sơ chủ trọ vẫn chín trường với `ratingAverage` và `reviewCount` tính chỉ từ bảng `reviews`, mọi route `/landlords/:id/review` và `/landlords/:id/reviews` và `/moderation/reviews` không đổi hợp đồng. Một đánh giá phòng không bao giờ làm đổi điểm hay số đánh giá của chủ trọ, và ngược lại.
- **AC-16**: `seed:demo` tạo thêm đánh giá phòng mẫu (kèm cuộc trò chuyện hai tin trên đúng tin được đánh giá, chủ trọ trả lời trước lúc viết) đủ các cảnh FE phải xử lý: tin có nhiều đánh giá với điểm lẻ làm tròn, tin chỉ một đánh giá, tin chưa có đánh giá, đánh giá chỉ có sao, nhận xét nhiều dòng, đánh giá đã sửa, một đánh giá bị admin ẩn kèm lý do, đánh giá của người viết bị khóa, đánh giá của tin đang ẩn. `seed:demo --reset` xóa được các dòng `listing_reviews` liên quan (kể cả đánh giá của người thật về tin demo) trước khi xóa tin và tài khoản, và chạy liên tiếp hai lần không lỗi.

## Decision

**Chosen option**: Option 1: Một bảng riêng `listing_reviews` cho mỗi cặp (người viết, tin), điều kiện viết là chat hai chiều về chính tin đó, mọi số tính lúc đọc, hiển thị đi theo luật công khai của tin, admin ẩn kèm lý do trong `moderation_logs`

Một đánh giá phòng là một dòng `listing_reviews` nối người viết với một tin đăng. Ai được viết do dữ liệu chat có sẵn quyết (cuộc trò chuyện về đúng tin đó, chủ trọ đã nhắn lại ít nhất một tin); điểm trung bình và số đánh giá không lưu sẵn mà tính từ các dòng `visible` của người viết còn hoạt động, nên ẩn, xóa hay khóa tài khoản có hiệu lực ngay và không bao giờ lệch với danh sách. Đánh giá chỉ đọc và ghi được khi tin đang hiện công khai (đúng hàm `isPubliclyVisible` mà lưu tin và chat đang dùng), nên không có đường nào lộ nội dung của tin đang ẩn. Ẩn đánh giá theo khuôn của 0014. Bảng `reviews` và mọi điểm của chủ trọ giữ nguyên. Không thêm thư viện, biến môi trường, quyền hay nhóm giới hạn mới, và không việc chạy nền.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Feature design

Quy ước chung theo 0001 đến 0014: Repository bọc Prisma, id `uuidv7()` do DB sinh, `timestamptz`, tên bảng và cột `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`, đọc và ghi thô bằng `$queryRaw` hay `$executeRaw` chỉ nằm trong file `*.repository.ts` (luật lint), giao dịch qua `TransactionRunner`.

**Data model** (một migration; mô hình đã được bạn xác nhận):

| Bảng | Khóa chính | Cột | Ràng buộc và chỉ mục |
|---|---|---|---|
| `listing_reviews` | `id` (uuid, `uuidv7()`) | `listing_id` (uuid, tin được đánh giá, FK `listings`, RESTRICT), `author_id` (uuid, người viết, FK `users`, RESTRICT), `stars` (smallint, bắt buộc), `comment` (text, có thể rỗng), `status` (text, mặc định `visible`), `created_at` (timestamptz, mặc định `now()`), `updated_at` (timestamptz, mặc định `now()`) | unique `listing_reviews_author_id_listing_id_unique` (một đánh giá cho mỗi cặp, cũng là chỉ mục tra đánh giá của một người); CHECK `listing_reviews_stars_check` (`stars` từ 1 đến 5); CHECK `listing_reviews_comment_check` (`comment` là `NULL`, hoặc `char_length` từ 1 đến 1000; chuỗi rỗng bị từ chối); CHECK `listing_reviews_status_check` (`visible` hoặc `hidden_by_admin`); chỉ mục `listing_reviews_listing_id_created_at_idx` trên (`listing_id`, `created_at` giảm dần, `id` giảm dần) cho danh sách và hai con số; FK `listing_reviews_author_id_fk`, `listing_reviews_listing_id_fk` |

Quan hệ: `listings` 1:N `listing_reviews`, và `users` 1:N `listing_reviews` (là người viết). Mọi FK RESTRICT vì tài khoản và tin chỉ xóa mềm. Không có cột `landlord_id`: chủ trọ của tin luôn lấy qua nhà trọ chứa tin (`ListingsRepository.findLandlordIdOf`). Khóa ngoại và CHECK không ép được "người viết là người đã được chủ trọ của tin trả lời trong chat" hay "người viết không phải chủ trọ của tin"; Service lo (xem Security model). Lý do admin ẩn nằm ở `moderation_logs` (loại đích `listing_review`), không có cột lý do. Không lưu cuộc trò chuyện nào đã đủ điều kiện: chat không bao giờ sửa hay xóa nên điều kiện tính lại được bất cứ lúc nào. `schema.prisma` thêm model `ListingReview`, quan hệ `reviews` trên `Listing` và quan hệ tên riêng `ListingReviewAuthor` trên `User`. Migration không có phần dữ liệu (tenant đã giữ bốn khóa `review:*` từ 0014); `moderation_logs.target_type` và `action` là chuỗi tự do nên không cần đổi bảng.

**State transitions** (đánh giá, giống 0014):

| Từ | Sang | Ai, bằng gì |
|---|---|---|
| (chưa có) | `visible` | người viết, `POST` |
| `visible` | `visible` | người viết, `PATCH` (đổi sao hay nhận xét, `updated_at` đổi) |
| `visible` | `hidden_by_admin` | admin, `hide` kèm lý do |
| `hidden_by_admin` | `visible` | admin, `unhide` kèm lý do (người viết không tự hiện lại) |
| `visible` hay `hidden_by_admin` | (xóa hẳn dòng) | người viết, `DELETE` |

Đánh giá `hidden_by_admin` không sửa được (409 `LISTING_REVIEW_HIDDEN`), chỉ xóa được.

**API surface** (tiền tố `/api/v1`; `:id` luôn là UUID của tin, lấy từ trường `id` của chi tiết công khai, không phải `slug-mã`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/listings/:slugCode` | GET | như hiện tại | chi tiết tin, thêm `reviewCount`, `ratingAverage` | công khai, đọc đăng nhập tùy chọn (không đổi) | như hiện tại |
| `/listings/:id/reviews` | GET | `id`, `page`, `pageSize` (query) | `{ items, total, page, pageSize }` | công khai, `@OptionalAuth()` | 400 `INVALID_ID`, 400 `VALIDATION_FAILED`, 404 `LISTING_NOT_FOUND`, 429 |
| `/listings/:id/review` | GET | `id` | `{ review, canReview }` | `review:read` | 400, 404 `LISTING_NOT_FOUND`, 403, 401, 429 |
| `/listings/:id/review` | POST | `id`, `stars` (int, bắt buộc), `comment` (string hoặc null, tùy chọn) | 201 `review` | `review:create`, `@FreshAuth` | 400 `INVALID_ID`, 400 `VALIDATION_FAILED`, 404 `LISTING_NOT_FOUND`, 409 `CANNOT_REVIEW_SELF`, 403 `LISTING_REVIEW_NOT_ELIGIBLE`, 409 `LISTING_REVIEW_ALREADY_EXISTS`, 403, 401, 429 |
| `/listings/:id/review` | PATCH | `id`, `stars?`, `comment?` | 200 `review` | `review:update`, `@FreshAuth` | 400, 404 `LISTING_NOT_FOUND`, 404 `LISTING_REVIEW_NOT_FOUND`, 409 `LISTING_REVIEW_HIDDEN`, 403, 401, 429 |
| `/listings/:id/review` | DELETE | `id` | 204 | `review:delete`, `@FreshAuth` | 400, 404 `LISTING_NOT_FOUND`, 404 `LISTING_REVIEW_NOT_FOUND`, 403, 401, 429 |
| `/moderation/listing-reviews` | GET | `page`, `pageSize`, `status?`, `listingId?`, `authorId?` | `{ items, total, page, pageSize }` | `review:moderate` | 400 `VALIDATION_FAILED`, 403, 401 |
| `/moderation/listing-reviews/:id/hide` | POST | `id`, `reason` | 200 phần tử admin | `review:moderate`, `@FreshAuth` | 400, 404 `LISTING_REVIEW_NOT_FOUND`, 409 `LISTING_REVIEW_STATE_INVALID`, 403, 401 |
| `/moderation/listing-reviews/:id/unhide` | POST | `id`, `reason` | 200 phần tử admin | `review:moderate`, `@FreshAuth` | như `hide` |

Hình dạng trả về. Phần tử danh sách công khai (`GET /listings/:id/reviews`), đánh giá của chính người gọi (`review` trong `GET /listings/:id/review`, kết quả `POST` và `PATCH`) và `{ review, canReview }` đúng như 0014 (xem `src/reviews/dto/review.response.ts`), nên tái dùng các kiểu phản hồi, DTO `CreateReviewDto`, `UpdateReviewDto` và các hàm ánh xạ của `src/reviews/` (luật giá trị giống hệt). Phần tử admin (`GET /moderation/listing-reviews` và kết quả `hide`, `unhide`):

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8e11",
  "status": "hidden_by_admin",
  "stars": 1,
  "comment": "…",
  "hiddenReason": "Nội dung xúc phạm cá nhân.",
  "author": { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02", "name": "Bạn Lan" },
  "listing": { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d09", "code": "k7m2xq9a", "title": "Phòng 20m² gần ĐH Bách Khoa" },
  "createdAt": "2026-11-09T03:10:00.000Z",
  "updatedAt": "2026-11-09T03:10:00.000Z"
}
```

Hai trường mới của chi tiết tin: `"reviewCount": 12`, `"ratingAverage": 4.3` (JSON không phân biệt `4` và `4.0`, FE tự định dạng một chữ số thập phân). `GET /listings/:id/review` khi chưa viết: `{ "review": null, "canReview": true }`.

Mã lỗi mới (năm mã, thêm vào bảng `ErrorCode`, tiếng Việt như các mã khác): `LISTING_REVIEW_NOT_FOUND` (404, "Không tìm thấy đánh giá phòng."), `LISTING_REVIEW_NOT_ELIGIBLE` (403, "Bạn chỉ đánh giá được phòng mà chủ trọ đã trả lời tin nhắn của bạn về chính tin này."), `LISTING_REVIEW_ALREADY_EXISTS` (409, "Bạn đã đánh giá phòng này rồi."), `LISTING_REVIEW_HIDDEN` (409, "Đánh giá phòng đang bị ẩn nên không sửa được."), `LISTING_REVIEW_STATE_INVALID` (409, "Đánh giá phòng không ở trạng thái phù hợp cho thao tác này."). Dùng lại `LISTING_NOT_FOUND`, `CANNOT_REVIEW_SELF`, `INVALID_ID`, `VALIDATION_FAILED`, `PERMISSION_DENIED`, `ACCOUNT_LOCKED`, `TOKEN_MISSING`, `RATE_LIMITED`.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi**: các guard (đăng nhập, quyền, `@FreshAuth` ở ba route ghi của người viết và hai route ghi của admin, giới hạn tần suất), rồi các pipe (`INVALID_ID`, `VALIDATION_FAILED`), rồi Service. Trong Service, bốn route của người viết: loại tài khoản admin (403) trước; rồi tin đang hiện công khai (404 `LISTING_NOT_FOUND`, một lần `isPubliclyVisible`, cùng cách `favorites` và chat đã làm); với `POST` tiếp theo là chủ trọ của tin (409 `CANNOT_REVIEW_SELF`, so `findLandlordIdOf` với người gọi); rồi với `GET` mình (chỉ khi chưa có đánh giá) và `POST`: đủ điều kiện (403, chỉ `POST`); rồi ghi. Vì pipe chạy trước Service, admin gửi id hay body sai nhận 400 chứ không phải 403 (cùng tiền lệ 0014, `follow`, `favorites`, chat). Danh sách công khai chỉ kiểm tin hiện công khai.
- **Tin hiện công khai**: gọi `ListingsRepository.isPubliclyVisible(listingId, visibility)` với `now` là đồng hồ ứng dụng do controller lấy một lần mỗi request (`new Date()`) và `trial_listing_limit` đọc từ `SettingsService`, đúng như `FavoritesService`; điều kiện này là `publicListingFrom` cộng `publicListingCondition`, nên một tin mở được ở chi tiết công khai khi và chỉ khi năm route đánh giá không 404.
- **Điều kiện đủ** (AC-4) là một truy vấn tồn tại: có dòng `conversations` với `listing_id` là `:id` và `tenant_id` là người gọi, nối `messages` có `sender_id` bằng `conversations.landlord_id`. Viết thành `ChatRepository.hasLandlordRepliedOnListing(tenantId, listingId)` (SQL thô trong repository, tra theo khóa unique `conversations_listing_id_tenant_id_unique` rồi theo `messages_conversation_id_seq_unique`) vì `ChatRepository` là nơi duy nhất chạm hai bảng chat (xem `src/chat/AGENTS.md`). Hàm `hasLandlordReplied` của 0014 không đổi.
- **`POST`**: một câu `INSERT ... ON CONFLICT (author_id, listing_id) DO NOTHING RETURNING`; không trả dòng nào nghĩa là cặp đã có, thành 409 `LISTING_REVIEW_ALREADY_EXISTS`. Không cần giao dịch: điều kiện đủ không bao giờ mất đi (chat bất biến). Nếu tin bị ẩn đúng giữa lúc kiểm và lúc ghi thì dòng vẫn được ghi; vô hại vì nó biến khỏi mọi đường đọc cùng tin (như `favorites`).
- **`PATCH`**: một câu `UPDATE ... WHERE author_id = $người gọi AND listing_id = $id AND status = 'visible'`, đặt `updated_at = clock_timestamp()`; chỉ đặt cột có trong body (`comment: null` đặt về `NULL`). Không dòng nào đổi thì tra thêm một câu: không có dòng là 404 `LISTING_REVIEW_NOT_FOUND`, dòng ở `hidden_by_admin` là 409 `LISTING_REVIEW_HIDDEN` (nếu lúc tra dòng đã được gỡ ẩn thì thử sửa lại một lần, như 0014). `PATCH` lặp lại với giá trị cũ vẫn đổi `updated_at`.
- **`DELETE`**: `DELETE ... WHERE author_id AND listing_id`; không dòng nào bị xóa thì 404 `LISTING_REVIEW_NOT_FOUND`.
- **Hai con số của chi tiết tin**: một truy vấn gộp (`count` và tổng `stars`) trên các dòng `listing_reviews` có `listing_id` đó, `status = 'visible'`, người viết `status = 'active'` và chưa xóa mềm; `ratingAverage` tính bằng `averageStars(count, starSum)` có sẵn của `src/reviews/reviews.mapper.ts` (số nguyên, làm tròn nửa lên, `null` khi `count` là 0). Chạy song song với việc đọc `isFavorite`, ngoài giao dịch; có thể lệch vài mili giây so với các số khác của chi tiết (chấp nhận, như 0005 và 0014).
- **Danh sách công khai** dùng đúng điều kiện đó (một mảnh điều kiện viết một lần trong `ListingReviewsRepository`, dùng cho danh sách, `total` và hai con số), sắp (`created_at` giảm dần, `id` giảm dần), phân trang bằng `PaginationQueryDto` và `Page<T>` có sẵn. `isMine` so `author_id` với người trong token; khách thì `null`. `author.name` dùng cùng ánh xạ tên của 0014.
- **`hiddenReason`**: `ModerationLogsRepository.findLatestListingReviewHideReasons(ids)` (cùng khuôn `findLatestReviewHideReasons`, lọc `target_type = 'listing_review'` và `action = 'hide_listing_review'`), chỉ gọi cho các đánh giá đang `hidden_by_admin`, một truy vấn cho cả trang. Kiểu `NewModerationLog` mở rộng thêm loại đích `listing_review` và hai hành động.
- **Hide và unhide** theo khuôn `ReviewModerationService` của 0014: một `updateMany` có điều kiện trạng thái nguồn (`visible` cho hide, `hidden_by_admin` cho unhide) và một dòng `moderation_logs` trong cùng giao dịch, chỉ khi đổi đúng một dòng; không đổi dòng nào thì 404 nếu không có đánh giá, 409 `LISTING_REVIEW_STATE_INVALID` nếu sai trạng thái. Đọc lại phần tử SAU giao dịch. Danh sách admin không kiểm tin có hiện công khai hay không (admin thấy mọi đánh giá), tên tin lấy từ `listings.title` và `listings.code`.
- **Cache**: năm route `/listings/:id/review` và `/listings/:id/reviews` trả `Cache-Control: private, no-store` (nội dung đổi theo người xem). Chi tiết tin giữ nguyên header hiện có.
- **Module**: `src/listing-reviews/` gồm `ListingReviewsDataModule` (chỉ xuất `ListingReviewsRepository`, để `ListingsModule` đọc hai con số mà không vòng import, theo tiền lệ `ReviewsDataModule`), `ListingReviewsModule` (hai controller, `ListingReviewsService`, `ListingReviewModerationService`; import `ListingReviewsDataModule`, `ListingsDataModule`, `ChatDataModule`, `SettingsModule`, `ModerationModule`), `ListingReviewsController` (`@Controller('listings')`, năm route; đường dẫn hai đoạn nên không đụng `GET /listings/:slugCode`), `ListingReviewModerationController` (`@Controller('moderation/listing-reviews')`), `ListingReviewModerationQueryDto` (`status`, `listingId`, `authorId`); lý do dùng lại `ModerationReasonDto`. `ListingReviewsModule` vào `AppModule`. `ListingsModule` import `ListingReviewsDataModule`; `ListingsService.getPublicDetail` thêm hai con số; `ListingDetailResponse` và `toListingDetail` thêm hai trường. `ChatRepository` thêm `hasLandlordRepliedOnListing`; `ModerationLogsRepository` thêm `findLatestListingReviewHideReasons`.

**Giới hạn tần suất** (không nhóm mới, dùng `@RateLimited`):

| Nhóm | Route | Bộ đếm |
|---|---|---|
| `reviewWrite` (có sẵn từ 0014) | `POST`, `PATCH`, `DELETE /listings/:id/review` | `user`: 20 lần mỗi giờ, **mỗi route đếm riêng** |
| `publicRead` (có sẵn) | `GET /listings/:id/reviews`, `GET /listings/:id/review` | `ip`: 300 lần mỗi phút, mỗi route đếm riêng |

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Mọi route | người gọi và loại tài khoản | `userId` và `accountType` trong `RequestUser` (từ token) |
| Năm route công khai và của người viết | tin (`listing_id`) | tham số đường dẫn `:id` qua `uuidParam()`, rồi `isPubliclyVisible` |
| Năm route công khai và của người viết | đồng hồ và hạn mức dùng thử cho luật hiển thị | `new Date()` do controller lấy một lần mỗi request; `trial_listing_limit` từ `SettingsService` |
| `POST` | người viết (`author_id`) | `userId` trong token, không nhận từ đường dẫn hay body |
| `POST`, `PATCH` | `stars`, `comment` | body của request, qua `CreateReviewDto` hay `UpdateReviewDto` của 0014 (`@IsInt`, `@Trim()`, kiểm độ dài) |
| `POST`, `GET` mình | chủ trọ của tin (để chặn tự đánh giá) | `ListingsRepository.findLandlordIdOf(:id)` |
| `POST`, `GET` mình | đủ điều kiện hay chưa | `ChatRepository.hasLandlordRepliedOnListing(userId, :id)` |
| `POST` | `id`, `created_at`, `updated_at`, `status` ban đầu | `uuidv7()`, `now()` của DB, mặc định `visible` |
| `PATCH` | `updated_at` mới | `clock_timestamp()` do câu `UPDATE` đặt, mỗi lần `PATCH` thành công |
| `GET` mình | `canReview` | `review === null` và `hasPermissions(user.permissions, ['review:create'])` và người gọi khác chủ trọ của tin và `hasLandlordRepliedOnListing` |
| `GET` mình, danh sách admin | `hiddenReason` | `moderation_logs` mới nhất với `target_type = 'listing_review'`, `action = 'hide_listing_review'`, `target_id` là id đánh giá, khi `status = 'hidden_by_admin'`; ngược lại `null` |
| Danh sách công khai | `author.name` | `users.name` của `author_id`, qua ánh xạ tên của 0014 |
| Danh sách công khai | `isMine` | `author_id` bằng `userId` trong token; khách (không có `RequestUser`) thì `null` |
| Danh sách công khai | thứ tự, `total`, `page`, `pageSize` | `created_at` giảm dần rồi `id` giảm dần; `count(*)` cùng điều kiện; query qua `PaginationQueryDto` |
| Chi tiết tin | `reviewCount`, `ratingAverage` | `count` và tổng `stars` của đúng tập dòng ở danh sách công khai, cho `listing_id` của tin vừa tìm thấy; trung bình là `averageStars(count, starSum)`, `null` khi `count = 0` |
| Danh sách admin | `author { id, name }`, `listing { id, code, title }` | `users.id` và `users.name` của `author_id`; `listings.id`, `listings.code`, `listings.title` của `listing_id` |
| Danh sách admin | bộ lọc | `status`, `listingId`, `authorId` từ query, qua `@IsIn` và `@IsUUID` |
| `hide`, `unhide` | người thao tác, lý do | `userId` trong token; `reason` trong body qua `ModerationReasonDto` |
| `hide`, `unhide` | dòng `moderation_logs` | `target_type = 'listing_review'`, `target_id` là `:id`, `action` là `hide_listing_review` hay `unhide_listing_review`, `reason` |

**Key invariants**:
- Mỗi cặp (`author_id`, `listing_id`) có tối đa một đánh giá, `stars` từ 1 đến 5, `comment` là `NULL` hoặc 1 đến 1000 ký tự (DB).
- `reviewCount` và `ratingAverage` của chi tiết tin luôn tính trên đúng tập dòng mà danh sách công khai trả (cùng một mảnh điều kiện trong Repository), nên không bao giờ lệch nhau ngoài độ trễ vài mili giây.
- Đánh giá `hidden_by_admin` không bao giờ xuất hiện ở danh sách công khai hay trong hai con số, và không sửa được; chỉ admin đổi `status`, và mỗi lần đổi có đúng một dòng `moderation_logs` cùng lý do.
- Mọi route công khai và của người viết trả 404 khi tin không hiện công khai; không đường nào đọc hay ghi đánh giá của tin đang ẩn.
- `author_id` luôn lấy từ token, `listing_id` luôn lấy từ đường dẫn rồi qua kiểm tin hiện công khai; không bao giờ từ body.
- Đủ điều kiện chỉ kiểm lúc tạo và chỉ tính cuộc trò chuyện về đúng tin được đánh giá; sửa và xóa chỉ dựa vào việc đánh giá là của chính người gọi.
- Bảng `reviews` và hai con số của hồ sơ chủ trọ không bao giờ đọc hay đếm dòng của `listing_reviews`, và ngược lại.
- Phản hồi công khai không có email, số điện thoại, id người viết hay `status`; chỉ phần tử admin có id người viết.

**Security model**:
- Bốn route của người viết cần đăng nhập; hai route đọc công khai không cần. Không thêm module quyền: dùng đúng `review` của 0014 (`read`, `create`, `update`, `delete`, `moderate`, `adminActions: ['moderate']`). `review:read` chỉ canh route "đánh giá của tôi"; `create`, `update`, `delete` canh ba route ghi; `moderate` canh ba route của admin và chỉ admin giữ được.
- Quyền mặc định không đổi: `tenant` giữ bốn khóa `review:read`, `create`, `update`, `delete`; `landlord` không giữ khóa nào, nên chủ trọ không tự đánh giá phòng của mình hay phòng của ai khác. Admin chỉnh quyền hai loại này bằng API quyền có sẵn; vì dùng chung khóa nên không bật tắt riêng đánh giá phòng được.
- **Admin**: `ADMIN_PERMISSIONS` là `manage` mọi module nên admin qua được guard `review:*`. Service chặn `accountType === 'admin'` bằng 403 `PERMISSION_DENIED` ở bốn route của người viết (như 0014, `follow`, `favorites`, chat); admin chỉ đọc và ẩn bằng ba route kiểm duyệt.
- Chủ trọ được admin cấp `review:create` vẫn không đánh giá được phòng của chính mình (409), và chỉ đánh giá được tin mà mình đã được chủ trọ của tin trả lời trong chat (403 nếu chưa).
- Ba route ghi của người viết và hai route ghi của admin dùng `@FreshAuth` (đọc lại trạng thái và quyền từ DB), nên tài khoản vừa bị khóa dừng ngay; `GET` theo quyền trong token như thường (cửa sổ tối đa 15 phút đã được chấp nhận ở nơi khác), nên `canReview` có thể trễ một lần refresh khi quyền đổi.
- Đánh giá là chữ do người dùng nhập, lưu nguyên dạng thô: API không lọc HTML hay liên kết, FE phải escape khi hiện. Tên người viết hiện công khai cạnh lời nhận xét (như 0014).
- Không đụng dữ liệu thuộc phạm vi tuân thủ riêng của bản demo (không thanh toán, không giấy tờ). Mọi đổi trạng thái của admin có nhật ký trong `moderation_logs`.

**Configuration required**: không có biến môi trường, không dịch vụ ngoài, không thư viện mới, không nhóm giới hạn mới, không seed bắt buộc. Chỉ cần một migration (bảng, ràng buộc, chỉ mục; không phần dữ liệu). DB dev cần `npm run migration:deploy`; muốn thấy đánh giá phòng mẫu thì chạy `npm run seed:demo -- --reset`.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: tenant đã nhắn về một tin và được chủ trọ trả lời viết đánh giá 5 sao kèm nhận xét, sửa thành 4 sao, thấy nó ở `GET /listings/:id/review` (`canReview: false`), khách thấy nó ở danh sách và `reviewCount` 1, `ratingAverage` 4 ở chi tiết tin, rồi xóa thì chi tiết về 0 và `null`, verifies **AC-1**, **AC-2**, **AC-3**, **AC-6**, **AC-7**, **AC-8**
- Failure case: tenant chưa nhắn về tin này, hoặc chỉ nhắn chưa được trả lời, hoặc chỉ nhắn về một tin khác (kể cả của cùng chủ trọ): 403 `LISTING_REVIEW_NOT_ELIGIBLE` và không dòng nào; sau khi chủ trọ trả lời đúng cuộc trò chuyện của tin này thì viết được, verifies **AC-4**
- Failure case: 20 lần `POST` đồng thời cùng một cặp ra đúng một 201 và 19 lần 409 `LISTING_REVIEW_ALREADY_EXISTS`; chủ trọ của tin được cấp quyền đánh giá phòng mình: 409 `CANNOT_REVIEW_SELF`, verifies **AC-5**
- Failure case: `stars` 0, 6, 4,5, `"5"`, thiếu; `comment` rỗng, toàn khoảng trắng, 1001 ký tự, số, chứa `\u0000`: 400 `VALIDATION_FAILED` ở `POST` và `PATCH`, không đổi dòng; 1000 ký tự và có xuống dòng ở giữa thì được; `PATCH` body rỗng 400; `comment: null` xóa nhận xét, verifies **AC-3**, **AC-6**
- Happy path: danh sách đúng thứ tự mới nhất trước, `page` và `pageSize` ở các biên, tham số lạ 400, `isMine` là `null` với khách và token sai, `true` ở dòng của mình, không có email, số điện thoại, id người viết, id `abc` 400, verifies **AC-2**
- Auth/permission: khách 401 ở bốn route người viết; chủ trọ mặc định 403; admin 403 ở cả bốn mà không ghi dòng nào; id sai của admin vẫn 400; người này không đọc hay đổi được đánh giá của người khác, verifies **AC-9**
- Failure case: tin bị chủ trọ ẩn, admin ẩn, xóa mềm, chủ trọ bị khóa, hết dùng thử hoặc vượt hạn mức: cả năm route 404 `LISTING_NOT_FOUND` kể cả `DELETE`, dòng còn nguyên, tin hiện lại thì đánh giá trở lại; khóa người viết thì đánh giá rời danh sách và hai con số, mở khóa thì trở lại; người viết bị khóa mà token còn hạn gọi ba route ghi: 403 `ACCOUNT_LOCKED`, verifies **AC-10**, **AC-1**, **AC-2**
- Happy path: admin lọc `GET /moderation/listing-reviews` theo `status`, `listingId`, `authorId`, thấy cả đánh giá đã ẩn kèm `hiddenReason` và cả đánh giá của tin đang ẩn; người không phải admin 403; giá trị lọc sai 400, verifies **AC-11**
- Failure case: `hide` rồi `hide` lần hai: 409 `LISTING_REVIEW_STATE_INVALID`; `unhide` đánh giá `visible`: 409; mỗi lần đổi đúng một dòng `moderation_logs`; ẩn thì rời chi tiết và hai con số, gỡ ẩn thì trở lại; người viết thấy `status` và `hiddenReason` ở route của mình, `PATCH` bị 409 `LISTING_REVIEW_HIDDEN`, `DELETE` được; ẩn đua với sửa và với xóa không mất cập nhật nào (hai điều khiển âm), verifies **AC-12**, **AC-6**, **AC-7**, **AC-8**
- Auth/permission: vượt 20 lần mỗi giờ ở từng route ghi nhận 429 kèm `Retry-After`, mỗi route đếm riêng; 300 lần mỗi phút ở hai route đọc, verifies **AC-13**
- Failure case: `INSERT` thẳng vào DB đánh giá trùng cặp, `stars` 0, `stars` 6, `comment` là chuỗi rỗng, `comment` dài 1001, `status` lạ, `listing_id` không tồn tại: DB từ chối cả bảy; sau migration `tenant` giữ đúng bốn khóa và `landlord` không giữ khóa nào, bảng `reviews` không đổi, verifies **AC-14**
- Happy path: một tenant đánh giá cả chủ trọ (0014) lẫn một phòng của chủ trọ đó: hồ sơ chủ trọ chỉ đếm đánh giá chủ trọ, chi tiết tin chỉ đếm đánh giá phòng, `GET /moderation/reviews` không liệt kê đánh giá phòng; Newman cũ của folder đánh giá chủ trọ chạy không lỗi, verifies **AC-15**
- Happy path: `seed:demo --reset` chạy hai lần liên tiếp không lỗi, chi tiết các tin mẫu hiện đúng số đánh giá và điểm đối chiếu bằng phép tính độc lập từ dòng thô, verifies **AC-16**
- Kiểm bằng `EXPLAIN` (không phải test tự động): chi tiết và danh sách của một tin có 5 nghìn đánh giá trong bảng 50 nghìn dòng; đo một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-1**, **AC-2**

## Build plan

Hướng build theo Skateboard (bản mỏng nhất dùng được trước, rồi mới mở rộng): mốc 1 cho người đã nhắn về một tin viết, sửa, xóa đánh giá phòng và cho mọi người đọc chúng cùng điểm trung bình trên chi tiết tin, vậy là dùng được hết vòng; mốc 2 thêm kiểm duyệt của admin, rồi dữ liệu demo làm bước cuối. Bảng và mọi ràng buộc nằm trong một migration ở mốc 1. Giữa hai mốc admin chưa có cách ẩn đánh giá xấu ngoài SQL tay, nên nên làm mốc 2 ngay sau khi bạn review mốc 1. Hai mốc, mỗi mốc một lần `/develop` rồi dừng cho bạn review. Mỗi mốc đổi API thì cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong mốc đó (quy tắc tài liệu sống), gắn `@RateLimited` ngay khi tạo route.

**Mốc 1: viết, sửa, xóa, đọc và hai con số trên chi tiết tin**
1. Thêm model `ListingReview` vào `schema.prisma` (quan hệ `reviews` trên `Listing`, quan hệ tên riêng `ListingReviewAuthor` trên `User`) và một migration tạo bảng, unique, chỉ mục danh sách và ba CHECK viết tay (`listing_reviews_stars_check`, `listing_reviews_comment_check`, `listing_reviews_status_check`), không phần dữ liệu; áp lên DB thử, hỏi schema thật, `migrate diff` không lệch, satisfies **AC-14**
2. Năm mã lỗi `LISTING_REVIEW_*` kèm bảng ánh xạ; `NewModerationLog` thêm loại đích `listing_review` và hai hành động; `ModerationLogsRepository.findLatestListingReviewHideReasons`, satisfies **AC-4**, **AC-8**, **AC-12**
3. `ChatRepository.hasLandlordRepliedOnListing` (một truy vấn tồn tại theo khóa unique, hàm `hasLandlordReplied` cũ không đổi), satisfies **AC-4**, **AC-8**
4. `src/listing-reviews/`: `ListingReviewsRepository` (mảnh điều kiện dùng chung, `INSERT ... ON CONFLICT DO NOTHING`, `UPDATE` có điều kiện `visible`, `DELETE`, tra đánh giá của một người, gộp `count` và tổng `stars`, trang danh sách), `ListingReviewsService` (kiểm admin, rồi tin hiện công khai bằng `isPubliclyVisible`, rồi chủ trọ của tin, rồi điều kiện chat, theo mục "Quy tắc"), tái dùng DTO, kiểu phản hồi và ánh xạ của `src/reviews/` (`averageStars` cho điểm trung bình), `ListingReviewsController` với năm route (`@RequirePermissions`, `@RateLimited` với `reviewWrite` hoặc `publicRead`, `@FreshAuth` ở ba route ghi, `@OptionalAuth` ở danh sách, `uuidParam()`, `Cache-Control: private, no-store`), `ListingReviewsDataModule` và `ListingReviewsModule` vào `AppModule`; `ListingsModule` import `ListingReviewsDataModule`; `ListingsService.getPublicDetail` thêm `reviewCount` và `ratingAverage` (chạy song song với `isFavorite`), đổi `ListingDetailResponse`, `toListingDetail` và các test đang kiểm đúng các trường của chi tiết, satisfies **AC-1** đến **AC-10**, **AC-13**, **AC-15**
5. Thêm bước xóa `listing_reviews` vào `deleteDemoData` trong `src/database/seed-demo.ts` (xóa mọi dòng có `author_id` là tài khoản demo hoặc `listing_id` là tin demo, kể cả đánh giá của người thật về tin demo, trước khi xóa tin và tài khoản), vì khóa ngoại RESTRICT sẽ chặn `--reset`, satisfies **AC-14**, **AC-16**
6. Test đơn vị (Service, Repository, controller, bảng mã lỗi, duyệt route khai báo quyền và giới hạn, chi tiết tin có hai trường mới), kiểm thật trên DB thử (điều kiện đủ qua các tình huống chat gồm chat về tin khác của cùng chủ trọ, 20 lần `POST` đồng thời, giá trị biên, quyền, tin biến mất theo từng lý do rồi hiện lại, khóa người viết, ràng buộc DB bằng `INSERT` thẳng, 429, hai con số đối chiếu bằng phép tính độc lập từ dòng thô, đánh giá chủ trọ không bị đụng), điều khiển âm (bỏ kiểm chat về đúng tin, bỏ kiểm tin hiện công khai, bỏ lọc `visible`, bỏ lọc người viết còn hoạt động, bỏ kiểm admin, hai con số lấy từ một tập khác với danh sách; mỗi điều khiển phải đổi hành vi thật, không chỉ đổi chữ), `EXPLAIN` một lần theo kịch bản ở mục test (ghi số, không chỉnh), Postman folder mới (tái dùng token có sẵn, không đăng ký tài khoản mới, không đăng nhập admin lại; kiểm folder 03 và các folder đánh giá chủ trọ vẫn qua), `api-for-frontend.md` (mục mới cho đánh giá phòng, mục chi tiết tin thêm hai trường, bảng mã lỗi và giới hạn tần suất, màn hình, quy tắc, nhật ký, phụ lục; ghi rõ `:id` là UUID của tin, không phải `slug-mã`), `verify.md`, satisfies **AC-1** đến **AC-10**, **AC-13**, **AC-14**, **AC-15**

**Mốc 2: kiểm duyệt của admin và dữ liệu demo**
7. `ListingReviewModerationService` (danh sách có lọc, `hide`, `unhide` theo khuôn `ReviewModerationService`), `ListingReviewModerationController` với ba route (`review:moderate`, `@FreshAuth` ở hai route ghi, `ModerationReasonDto`), DTO `ListingReviewModerationQueryDto`, ánh xạ phần tử admin kèm `listing { id, code, title }`, satisfies **AC-11**, **AC-12**
8. Test đơn vị, kiểm thật trên DB thử (bộ lọc, ẩn và gỡ ẩn kèm đúng một dòng log, `hiddenReason` thật, rời và trở lại chi tiết tin và hai con số, `PATCH` bị 409 khi đã ẩn, `DELETE` được, ẩn đua với sửa và với xóa), điều khiển âm (bỏ điều kiện `visible` trong câu sửa, bỏ điều kiện trạng thái nguồn trong `hide`, bỏ dòng log), mở rộng Postman folder (tái dùng `adminToken`) và `api-for-frontend.md`, `verify.md`, satisfies **AC-11**, **AC-12**, và chạy lại **AC-1**, **AC-2**, **AC-8** với đánh giá bị ẩn
9. Dữ liệu demo: nội dung tĩnh `src/database/demo/demo-room-reviews.ts` (cùng khuôn `demo-reviews.ts`), `demo-build.ts` dựng các dòng `listing_reviews`, `conversations` và `messages` (cuộc trò chuyện hai tin trên đúng tin được đánh giá, chủ trọ trả lời trước lúc viết) và dòng `moderation_logs` cho đánh giá bị ẩn, test cùng khuôn `demo-reviews.spec.ts`; chạy `seed:demo -- --reset` hai lần liên tiếp trên DB thử, đối chiếu số đánh giá và điểm bằng phép tính độc lập, satisfies **AC-16**

## Consequences

**Positive**:
- Một bảng, tám route mới và hai trường mới, không thư viện, không biến môi trường, không quyền hay nhóm giới hạn mới, không việc chạy nền: gọn đúng tinh thần MVP và khớp cách kiểm bằng script thật và Newman đang dùng.
- Điều kiện viết gắn với chính tin được đánh giá, nên chặn được người chỉ hỏi một phòng rồi chấm phòng khác của cùng chủ trọ; vẫn dựa vào chat có sẵn nên không cần luồng xác minh mới.
- Bảng riêng nên đánh giá chủ trọ của 0014 không bị chạm: hồ sơ vẫn chín trường, mọi con số và test cũ giữ nguyên, một đánh giá phòng không bao giờ lọt vào điểm của chủ trọ.
- Đánh giá hiện và biến đúng lúc tin hiện và biến (cùng hàm `isPubliclyVisible`), nên không lộ nội dung của tin đang ẩn và không cần nhớ thêm luật hiển thị nào.
- Hai con số tính lúc đọc từ cùng một mảnh điều kiện với danh sách nên không lệch; khóa tài khoản, ẩn hay xóa có hiệu lực ngay.

**Negative / tradeoffs**:
- Chat là bằng chứng đã liên hệ chứ không phải đã ở phòng đó. Một chủ trọ có thể tự đăng ký một tài khoản người tìm trọ, nhắn về chính tin của mình, trả lời rồi chấm 5 sao (số điện thoại chỉ bắt buộc duy nhất với tài khoản chủ trọ). Chưa có biện pháp chống; với bản demo thì chấp nhận, nếu chạy thật thì đây là điểm yếu đầu tiên của điểm tin cậy (cùng điểm yếu của 0014).
- Một đánh giá duy nhất đã làm điểm trung bình thành chính nó vì chưa có số đánh giá tối thiểu; FE nên hiện kèm `reviewCount`.
- Tin là đơn vị được đánh giá, nên khi chủ trọ đăng lại cùng một căn phòng thành tin mới thì đánh giá cũ ở lại với tin cũ và tin mới bắt đầu từ 0.
- Điểm phòng chỉ có ở chi tiết tin; bốn danh sách thẻ tin và chi tiết riêng của chủ trọ chưa có, nên FE chưa hiện được sao trên thẻ. Đã chọn vậy để không sửa bốn route ở ba module trong một lát cắt MVP.
- Tin không còn hiện công khai thì người viết cũng không đọc, sửa hay xóa được đánh giá của mình (404 cho tới khi tin hiện lại); đánh giá đó vốn không hiện ở đâu.
- Xóa là xóa hẳn dòng: người viết xóa một đánh giá đang bị ẩn thì admin mất luôn nội dung (nhật ký chỉ còn lý do), như 0014.
- Đánh giá đang bị ẩn không sửa được, nên người viết muốn sửa lỗi chỉ có cách xóa rồi viết lại; admin không có tín hiệu "đã sửa".
- Dùng chung khóa quyền `review:*` với đánh giá chủ trọ nên admin không bật tắt riêng đánh giá phòng được; ai muốn tách thì phải thêm một module quyền và một migration dữ liệu sau.
- Hai module phụ thuộc nhau ở mức mã: `src/listing-reviews/` tái dùng DTO, kiểu phản hồi và ánh xạ của `src/reviews/` để luật giá trị không lệch; đổi luật của đánh giá chủ trọ sẽ đổi cả đánh giá phòng.
- Admin chưa lọc được theo chủ trọ hay tìm theo từ trong nhận xét, chỉ lọc theo trạng thái, tin, người viết; và giữa hai mốc chưa có công cụ ẩn.
- Mỗi lần đọc chi tiết tin thêm một truy vấn gộp (đo `EXPLAIN` một lần, không chỉnh nếu chậm); chi tiết tin, hai con số và `isFavorite` không chung một ảnh chụp dữ liệu nên lệch được vài mili giây.
- `canReview` đọc quyền từ token nên có thể trễ một lần refresh khi admin đổi quyền; `POST` vẫn là nơi quyết định cuối.
- Nội dung là chữ thô lưu nguyên: FE phải escape khi hiện, backend không lọc HTML hay liên kết.

**Neutral**:
- Thêm module `src/listing-reviews/`, một bảng, năm mã lỗi, một phương thức ở `ChatRepository` và một ở `ModerationLogsRepository`, một import ở `ListingsModule`; hợp đồng các API đang chạy chỉ đổi ở chi tiết tin (thêm hai trường).
- DB dev cần `npm run migration:deploy`; không có phần dữ liệu nên quyền của `tenant` không đổi và không ghi đè chỉnh sửa quyền nào của admin.
- `seed:demo` tạo thêm đánh giá phòng mẫu; người dùng cần chạy `npm run seed:demo -- --reset` để thấy chúng.
- Số `0015` không trùng ai vì mỗi spec nằm trong thư mục riêng.

## Follow-up

- [ ] FE (không thuộc backend, ghi vào `api-for-frontend.md`): `:id` của các route đánh giá phòng là UUID `id` của chi tiết tin, không phải `slug-mã`; dựng JSON-LD `aggregateRating` từ `ratingAverage` và `reviewCount` cho SEO chi tiết tin; escape `comment`; khách nhận `isMine: null`; route đọc đăng nhập tùy chọn không bao giờ 401 nên làm mới token trước khi gọi; chi tiết tin 404 thì năm route đánh giá cũng 404.
- [ ] Hoãn, thêm lại bằng `/scope` khi cần: điểm phòng trên thẻ tin ở bốn danh sách (`GET /listings`, `GET /me/favorites`, `GET /landlords/:id/listings`, `GET /me/listings`) và trên chi tiết riêng của chủ trọ, điểm trung bình các phòng cộng vào hồ sơ chủ trọ, lọc admin theo chủ trọ, đánh giá riêng cho nhà trọ, đánh giá theo phòng mang sang khi đăng lại tin, tách quyền riêng cho đánh giá phòng, và mọi mục đã hoãn ở 0014 (chủ trọ trả lời, phân bố số sao, lọc hoặc sắp theo sao, nút báo cáo, ảnh trong đánh giá, bình chọn "hữu ích", chống đánh giá giả, tìm theo chữ cho admin, giữ lại nội dung đã xóa, thông báo, số đánh giá tối thiểu trước khi hiện điểm).
- [ ] Sau khi build, `/sync` tạo `src/listing-reviews/AGENTS.md`, ghi bảng `listing_reviews` vào các spec nền móng nếu còn lệch (`0001/0005-postgres-data-conventions.md`), thêm bước `listing_reviews` vào ghi chú về `deleteDemoData` ở `src/chat/AGENTS.md` và `src/database/demo/AGENTS.md` nếu cần.
- [ ] `AGENTS.md` gốc hiện rỗng (0 byte) nên danh sách kỹ năng cộng đồng ở mục Decision lấy từ spec 0014 và thư mục `.agents/skills/`; cần `/audit` hoặc `/sync` điền lại mục `## Agent skills`.
- [x] Đã đóng ngày 2026-11-18 (xem 0014). Mục "Follow-up" của 0014 về dòng AC-1 của spec 0005 (hồ sơ "đúng 7 trường") vẫn còn mở và không thuộc spec này.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
