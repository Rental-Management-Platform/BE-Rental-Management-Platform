# 0013. Chat giữa người tìm trọ và chủ trọ

**Date**: 2026-11-05
**Status**: Accepted

## Summary

Người tìm trọ nhắn thẳng cho chủ trọ từ một tin đang hiện công khai; chủ trọ thấy hộp thư và trả lời, mỗi bên chỉ đọc được cuộc trò chuyện của chính mình. Mỗi cuộc trò chuyện gắn với một tin và một người tìm trọ, tin nhắn lưu trong database (hai bảng `conversations` và `messages`). FE hỏi lại vài giây một lần bằng REST thường, chưa có kênh đẩy thời gian thực. Chỉ người tìm trọ được mở cuộc trò chuyện, nội dung chỉ là chữ (1 đến 1000 ký tự), không sửa không xóa; có đếm tin chưa đọc cho từng cuộc trò chuyện và cho cái chuông ở đầu trang.

## Requirements

**User stories**:
- Là người tìm trọ đã đăng nhập, tôi muốn nhắn cho chủ trọ ngay từ tin tôi đang xem, để hỏi phòng còn trống không mà không phải gọi điện ngoài hệ thống.
- Là chủ trọ, tôi muốn thấy ai đang hỏi tin nào, trả lời họ, và biết cuộc trò chuyện nào còn tin chưa đọc.
- Là người dùng, tôi muốn người khác không đọc được tin nhắn của tôi, và người chưa đăng nhập không nhắn được.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `POST /listings/:id/conversations` với body `{ body }`: người có quyền `conversation:create` (mặc định chỉ `tenant`) nhắn vào một tin đang hiện công khai nhận 201 `{ conversation, message }`. Lần đầu tạo cuộc trò chuyện (người nhắn là người trong token, chủ trọ là chủ nhà trọ của tin lúc đó) kèm tin nhắn số 1. Mỗi cặp (tin, người nhắn) chỉ có một cuộc trò chuyện: gọi lại, kể cả nhiều lần cùng lúc, thì thêm tin nhắn vào đúng cuộc trò chuyện đó, số thứ tự `seq` liên tiếp, không trùng, không hở. Cùng một người hỏi hai tin khác nhau của một chủ trọ thì có hai cuộc trò chuyện riêng.
- **AC-2**: Mở cuộc trò chuyện thất bại: tin không hiện công khai (không có, đã xóa mềm, bị chủ trọ hay admin ẩn, chủ trọ bị khóa, chủ trọ hết dùng thử và hết gói, hoặc bị ẩn bớt vì vượt hạn mức) bị 404 `LISTING_NOT_FOUND` như chi tiết tin; id không phải UUID bị 400 `INVALID_ID`; chính chủ trọ của tin (khi admin đã cấp cho họ `conversation:create`) bị 409 `CANNOT_CHAT_WITH_SELF`. Không trường hợp nào ghi dòng.
- **AC-3**: `POST /conversations/:id/messages` với body `{ body }`: một trong hai người của cuộc trò chuyện, có `message:create` (mặc định cả `tenant` và `landlord`) nhận 201 tin nhắn `{ id, seq, senderId, isMine, body, createdAt }`. `seq` bằng số tin trước đó cộng một và đúng thứ tự dù nhiều người gửi cùng lúc (20 lần gửi đồng thời ra đúng `seq` 1 đến 20, mỗi số một lần). Gửi xong thì `last_message_at` đổi và mốc đã đọc của chính người gửi nhảy tới `seq` mới. Chủ trọ trả lời được cuộc trò chuyện do người tìm trọ mở.
- **AC-4**: `body` là chuỗi, bỏ khoảng trắng hai đầu, dài 1 đến 1000 ký tự sau khi bỏ, không chứa ký tự NUL (`\u0000`); xuống dòng ở giữa được giữ nguyên. Sai (thiếu, rỗng, toàn khoảng trắng, quá dài, sai kiểu, có NUL) bị 400 `VALIDATION_FAILED` kèm trường `body`, không ghi dòng nào, ở cả hai route gửi.
- **AC-5**: Người kia không còn nhận được: nếu tài khoản bên kia bị khóa hoặc đã xóa mềm, gửi tin bị 409 `CHAT_PEER_UNAVAILABLE` và không ghi; đọc lịch sử, hộp thư và đánh dấu đã đọc vẫn chạy; mở khóa thì gửi lại được. Tài khoản của chính người gửi vừa bị khóa mà token còn hạn thì hai route gửi trả 403 `ACCOUNT_LOCKED` ngay; các route đọc theo token như thường.
- **AC-6**: `GET /conversations/:id/messages` nhận `limit` (1 đến 100, mặc định 30), `afterSeq` (số nguyên từ 0) và `beforeSeq` (số nguyên từ 1); gửi cả `afterSeq` lẫn `beforeSeq` bị 400 `VALIDATION_FAILED`. Trả `{ items, hasMore, lastSeq }`, `items` luôn xếp `seq` tăng dần, mỗi phần tử `{ id, seq, senderId, isMine, body, createdAt }`. Không tham số: `limit` tin mới nhất, `hasMore` cho biết còn tin cũ hơn không. `afterSeq=N`: các tin `seq > N`, tối đa `limit` tin đầu tiên, `hasMore` cho biết còn tin mới hơn không. `beforeSeq=N`: `limit` tin ngay trước `seq` N, `hasMore` cho biết còn tin cũ hơn không. `lastSeq` là số tin hiện có. Đọc không đổi mốc đã đọc.
- **AC-7**: Hộp thư `GET /me/conversations` (`conversation:read`) trả `{ items, total, page, pageSize }` với `page`, `pageSize` như các danh sách khác, chỉ gồm cuộc trò chuyện mà người gọi là người nhắn hoặc là chủ trọ, cái có tin mới nhất nằm trên (`last_message_at` giảm dần, rồi `id` giảm dần); query tùy chọn `listingId` (UUID) lọc theo một tin. `GET /conversations/:id` trả đúng một phần tử cùng dạng. Mỗi phần tử có `id`, `myRole` (`tenant` hoặc `landlord`), `listing { id, code, slug, title, price, coverImageUrl, isPublic }`, `otherUser { id, name }`, `lastMessage { seq, senderId, isMine, body, createdAt }`, `lastMessageAt`, `createdAt`. `listing.isPublic` đúng bằng việc khách có mở được tin ở `GET /listings/:slugCode` ngay lúc đọc (cùng hai mảnh SQL hiển thị công khai); khi `false` thì `coverImageUrl` là `null` vì `/media/public` chỉ phát ảnh của tin đang hiện. `otherUser.name` có thể `null`; chat không lộ số điện thoại hay email của người kia.
- **AC-8**: Quyền và cách ly: khách bị 401 `TOKEN_MISSING`; người không phải một trong hai bên của cuộc trò chuyện (kể cả id không có) nhận 404 `CONVERSATION_NOT_FOUND`, không phân biệt được hai trường hợp; id sai là 400 `INVALID_ID`; chủ trọ mặc định không giữ `conversation:create` nên mở cuộc trò chuyện bị 403 `PERMISSION_DENIED`; admin giữ mọi quyền nhưng cả bảy route chat đều bị 403 `PERMISSION_DENIED` vì Service kiểm loại tài khoản. Các trường hợp này không ghi dòng. Không phản hồi nào có `tenant_read_seq`, `landlord_read_seq` hay thông tin liên hệ của người kia.
- **AC-9**: Cuộc trò chuyện sống tiếp khi tin đổi: sau khi tin bị chủ trọ hay admin ẩn, bị xóa mềm, hoặc chủ trọ hết dùng thử và hết gói, hai bên vẫn đọc và gửi được (miễn tài khoản hai bên còn hoạt động) và `listing.isPublic` là `false`. Chỉ việc mở cuộc trò chuyện mới cần tin đang hiện công khai.
- **AC-10** (mốc 2): `unreadCount` có ở mỗi phần tử hộp thư và ở `GET /conversations/:id`: bằng `last_seq` trừ mốc đã đọc của người gọi (đúng số tin của bên kia sau mốc, vì gửi tin đã dời mốc của chính mình). `GET /me/conversations/unread-count` (`conversation:read`) trả `{ unreadConversations, unreadMessages }` (số cuộc trò chuyện còn tin chưa đọc, tổng số tin chưa đọc). Cả hai khớp một phép tính độc lập từ các dòng thô.
- **AC-11** (mốc 2): `POST /conversations/:id/read` với body `{ upToSeq }` (số nguyên từ 0; `conversation:update`): mốc đã đọc của người gọi thành `GREATEST(mốc cũ, LEAST(upToSeq, last_seq))`, nên không bao giờ lùi và không vượt tin cuối. Trả 200 cùng phần tử như `GET /conversations/:id`. Gọi lặp an toàn; tin đến sau lúc FE nhìn vẫn còn chưa đọc. Chỉ route này và việc gửi tin làm đổi mốc; mọi `GET` thì không.
- **AC-12**: Giới hạn tần suất, mỗi route đếm riêng, vượt thì 429 `RATE_LIMITED` kèm `Retry-After`: mở cuộc trò chuyện (`conversationStart`) 20 lần mỗi giờ theo người dùng; gửi tin (`messageWrite`) 30 lần mỗi phút theo người dùng; năm route đọc và đánh dấu đã đọc (`chatRead`) 120 lần mỗi phút theo người dùng. Hai con số đầu do bạn duyệt ngày 2026-11-05; con số 120 là đề xuất của spec để FE hỏi lại vài giây một lần.
- **AC-13**: Ràng buộc ở DB: `conversations` có unique (`listing_id`, `tenant_id`), `tenant_id` khác `landlord_id`, `last_seq` từ 0 trở lên và hai mốc đọc nằm trong 0 đến `last_seq`; `messages` có unique (`conversation_id`, `seq`), `seq` từ 1 trở lên, `body` dài 1 đến 1000 ký tự; mọi khóa ngoại RESTRICT. Không route nào sửa hay xóa tin nhắn hoặc cuộc trò chuyện. `INSERT` thẳng bằng SQL vi phạm các điều trên bị DB từ chối.

## Decision

**Chosen option**: Option 1: Hai bảng, mỗi cặp (tin, người nhắn) một cuộc trò chuyện, `seq` đếm theo cuộc trò chuyện, FE hỏi lại bằng REST

Một cuộc trò chuyện là một hàng `conversations` giữ hai người, tin, bộ đếm `last_seq` và mốc đã đọc của mỗi bên; mỗi tin nhắn là một hàng `messages` mang `seq` của nó. Gửi tin là một câu `UPDATE` tăng `last_seq` (khóa hàng nên các lần gửi xếp hàng, `seq` liên tiếp) rồi `INSERT` tin; số chưa đọc là phép trừ, không đếm hàng. Không thêm thư viện, biến môi trường hay việc chạy nền.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Feature design

Quy ước chung theo 0001 đến 0006 của nền móng: Repository bọc Prisma, `timestamptz`, tên bảng và cột `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`, đọc và ghi thô bằng `$queryRaw` hay `$executeRaw` chỉ nằm trong file `*.repository.ts` (luật lint), giao dịch qua `TransactionRunner`, mã `id` là `uuidv7()` do DB sinh.

**Data model** (một migration; mô hình đã được bạn xác nhận):

| Bảng | Khóa chính | Cột | Ràng buộc và chỉ mục |
|---|---|---|---|
| `conversations` | `id` (uuid, `uuidv7()`) | `listing_id` (uuid, FK `listings`, RESTRICT), `tenant_id` (uuid, người nhắn, FK `users`, RESTRICT), `landlord_id` (uuid, chủ trọ chép từ tin lúc tạo, FK `users`, RESTRICT), `last_seq` (int, mặc định 0, số tin hiện có), `tenant_read_seq` (int, mặc định 0), `landlord_read_seq` (int, mặc định 0), `last_message_at` (timestamptz, bắt buộc), `created_at` (timestamptz, mặc định `now()`) | unique `conversations_listing_id_tenant_id_unique` (một cuộc trò chuyện cho mỗi cặp); CHECK `conversations_tenant_landlord_check` (`tenant_id <> landlord_id`); CHECK `conversations_seq_check` (`last_seq >= 0` và hai mốc nằm trong 0 đến `last_seq`); chỉ mục `conversations_tenant_id_last_message_at_idx` trên (`tenant_id`, `last_message_at` giảm dần, `id` giảm dần) và `conversations_landlord_id_last_message_at_idx` cùng dạng cho hộp thư; FK `conversations_listing_id_fk`, `conversations_tenant_id_fk`, `conversations_landlord_id_fk` |
| `messages` | `id` (uuid, `uuidv7()`) | `conversation_id` (uuid, FK `conversations`, RESTRICT), `seq` (int), `sender_id` (uuid, FK `users`, RESTRICT), `body` (text), `created_at` (timestamptz, mặc định `now()`) | unique `messages_conversation_id_seq_unique` (cũng là chỉ mục để đọc và hỏi lại theo `seq`); CHECK `messages_seq_check` (`seq >= 1`); CHECK `messages_body_check` (`char_length(body)` từ 1 đến 1000); FK `messages_conversation_id_fk`, `messages_sender_id_fk` |

Quan hệ: `users` 1:N `conversations` (hai lần: là người nhắn và là chủ trọ), `listings` 1:N `conversations`, `conversations` 1:N `messages`, `users` 1:N `messages`. Mọi FK RESTRICT vì người dùng và tin chỉ xóa mềm. Khóa ngoại và CHECK không ép được "người nhắn phải có quyền mở" hay "người gửi là một trong hai bên"; Service lo (xem Security model). Hai cột mốc đọc là hai cột vì chỉ có đúng hai người; không có bảng người tham gia. Không đổi `users`, `properties`, `listings`. `schema.prisma` thêm model `Conversation`, `Message` và các quan hệ ngược trên `User` (hai quan hệ tên riêng cho người nhắn và chủ trọ, một cho tin đã gửi) và `Listing`. Migration cũng có phần dữ liệu cuối file: thêm khóa quyền mặc định cho hai loại tài khoản (xem Security model), chỉ thêm khóa còn thiếu nên chạy lại không đổi.

**State transitions**: không có. Cuộc trò chuyện chỉ có bộ đếm tăng; tin nhắn bất biến. Việc cuộc trò chuyện còn gửi được hay không suy ra lúc gửi từ trạng thái hai tài khoản.

**API surface** (tiền tố `/api/v1`; mọi route cần đăng nhập):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/listings/:id/conversations` | POST | `id` (UUID, đường dẫn), `body` (string) | 201 `{ conversation, message }` | `conversation:create`, `@FreshAuth` | 400 `INVALID_ID`, 400 `VALIDATION_FAILED`, 404 `LISTING_NOT_FOUND`, 409 `CANNOT_CHAT_WITH_SELF`, 403, 401, 429 |
| `/conversations/:id/messages` | POST | `id` (UUID), `body` (string) | 201 tin nhắn | `message:create`, `@FreshAuth` | 400, 404 `CONVERSATION_NOT_FOUND`, 409 `CHAT_PEER_UNAVAILABLE`, 403 (gồm `ACCOUNT_LOCKED`), 401, 429 |
| `/conversations/:id/messages` | GET | `id`, `limit`, `afterSeq`, `beforeSeq` (query) | `{ items, hasMore, lastSeq }` | `conversation:read` | 400, 404 `CONVERSATION_NOT_FOUND`, 403, 401, 429 |
| `/conversations/:id` | GET | `id` | một phần tử cuộc trò chuyện | `conversation:read` | 400, 404 `CONVERSATION_NOT_FOUND`, 403, 401, 429 |
| `/me/conversations` | GET | `page`, `pageSize`, `listingId` (query, tùy chọn) | trang các phần tử cuộc trò chuyện | `conversation:read` | 400 `VALIDATION_FAILED`, 403, 401, 429 |
| `/me/conversations/unread-count` | GET | không | `{ unreadConversations, unreadMessages }` (mốc 2) | `conversation:read` | 403, 401, 429 |
| `/conversations/:id/read` | POST | `id`, `upToSeq` (int) (mốc 2) | 200 một phần tử cuộc trò chuyện | `conversation:update` | 400, 404 `CONVERSATION_NOT_FOUND`, 403, 401, 429 |

Hình dạng trả về:

Phần tử cuộc trò chuyện (hộp thư, `GET /conversations/:id`, `conversation` của route mở, kết quả `read`):

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d51",
  "myRole": "landlord",
  "listing": {
    "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d11",
    "code": "k3m9x2ab",
    "slug": "phong-tro-gan-dai-hoc",
    "title": "Phòng trọ gần đại học",
    "price": 3000000,
    "coverImageUrl": "/api/v1/media/public/0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d21.jpg",
    "isPublic": true
  },
  "otherUser": { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02", "name": "Bạn Lan" },
  "lastMessage": {
    "seq": 4,
    "senderId": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02",
    "isMine": false,
    "body": "Dạ phòng còn trống không anh?",
    "createdAt": "2026-11-05T03:10:00.000Z"
  },
  "lastMessageAt": "2026-11-05T03:10:00.000Z",
  "createdAt": "2026-11-05T02:50:00.000Z",
  "unreadCount": 2
}
```

`unreadCount` chỉ có từ mốc 2. Tin nhắn:

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d61",
  "seq": 4,
  "senderId": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02",
  "isMine": false,
  "body": "Dạ phòng còn trống không anh?",
  "createdAt": "2026-11-05T03:10:00.000Z"
}
```

Mã lỗi mới (ba mã, thêm vào bảng `ErrorCode`, tiếng Việt như các mã khác): `CONVERSATION_NOT_FOUND` (404, "Không tìm thấy cuộc trò chuyện."), `CANNOT_CHAT_WITH_SELF` (409, "Bạn không thể nhắn tin cho chính mình."), `CHAT_PEER_UNAVAILABLE` (409, "Người kia hiện không nhận được tin nhắn."). Dùng lại `LISTING_NOT_FOUND`, `INVALID_ID`, `VALIDATION_FAILED`, `PERMISSION_DENIED`, `ACCOUNT_LOCKED`, `TOKEN_MISSING`, `RATE_LIMITED`.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi**: các guard (đăng nhập, quyền, kiểm tài khoản trực tiếp của `@FreshAuth` ở hai route gửi, giới hạn tần suất), rồi các pipe (`INVALID_ID`, `VALIDATION_FAILED`), rồi Service. Trong Service: loại tài khoản admin (403) trước; sau đó với route mở: tin có hiện công khai không (404), chính chủ tin (409), ghi; với route gửi: đọc cuộc trò chuyện và kiểm người gọi là một trong hai bên (404 `CONVERSATION_NOT_FOUND`), kiểm người kia còn hoạt động (409), ghi. Vì pipe chạy trước Service, admin gửi id hay body sai nhận 400 chứ không phải 403 (cùng tiền lệ `follow` và `favorites`).
- **Mở cuộc trò chuyện** (một giao dịch): đọc chủ trọ của tin (`properties.landlord_id` của nhà trọ chứa tin), rồi một câu `INSERT INTO conversations ... ON CONFLICT (listing_id, tenant_id) DO UPDATE` đặt `last_seq` = 1 và mốc đọc của người nhắn = 1 khi tạo mới, hoặc tăng `last_seq` thêm 1, dời mốc của người nhắn tới `seq` mới và đặt `last_message_at` khi đã có, trả `last_seq`; rồi `INSERT` tin với `seq` đó. Hai tab bấm cùng lúc ra một cuộc trò chuyện và hai tin `seq` 1 và 2. `landlord_id` của hàng đã có không bị đổi.
- **Gửi tin** (một giao dịch): đọc cuộc trò chuyện cùng trạng thái hai tài khoản (không khóa) để kiểm người gọi và người kia; rồi `UPDATE conversations SET last_seq = last_seq + 1, last_message_at = now(), <cột mốc của người gửi> = last_seq + 1 WHERE id = $1 RETURNING last_seq` (câu này khóa hàng, nên các lần gửi cùng lúc xếp hàng và nhận `seq` liên tiếp); rồi `INSERT` tin. Người kia bị khóa đúng giữa lúc đọc và lúc ghi thì tin vẫn ghi; vô hại. Cột mốc của người gửi chọn theo người gọi là `tenant_id` hay `landlord_id` (hai câu lệnh trong code, không dùng `CASE`).
- **Gửi dời mốc của chính mình tới `seq` mới** nên gửi tin cũng coi như đã đọc hết cuộc trò chuyện (kể cả tin chưa kịp xem của bên kia). Chấp nhận để `unreadCount` chỉ là phép trừ; xem Consequences.
- **Đọc tin**: lấy `limit + 1` hàng theo `seq` (chỉ mục unique), cắt lại `limit` hàng để biết `hasMore`, trả lại theo `seq` tăng dần. Không tham số thì đọc từ `seq` lớn nhất xuống; `afterSeq` đọc từ nhỏ lên; `beforeSeq` đọc từ lớn xuống rồi đảo lại.
- **Hộp thư**: điều kiện `tenant_id = người gọi OR landlord_id = người gọi` (mỗi nhánh có chỉ mục riêng), sắp `last_message_at DESC, id DESC`, phân trang `PaginationQueryDto` và `Page<T>` có sẵn. Tin nhắn cuối lấy theo (`conversation_id`, `seq = last_seq`). `listing.isPublic` đọc bằng một truy vấn thô cho cả trang: các id tin của trang đi qua `publicListingFrom(now)` và `publicListingCondition(now, trialListingLimit)` (hai mảnh SQL của danh sách công khai, không đổi), tin nằm trong kết quả là `true`. `trial_listing_limit` đọc một lần mỗi request qua `SettingsService.getValue`. Tin đã xóa mềm vẫn hiện `title`, `code`, `slug`, `price` của nó với `isPublic` `false`.
- **Đánh dấu đã đọc**: một câu `UPDATE ... SET <cột mốc của người gọi> = GREATEST(<cột>, LEAST($upToSeq, last_seq)) WHERE id = $1 AND <người gọi là một trong hai bên>`; không hàng nào bị đổi thì 404. Không kiểm người kia; đọc luôn được.
- **`body`**: `@Trim()` có sẵn, `@IsString`, độ dài 1 đến 1000 (đếm đơn vị UTF-16 trong JS, chặt hơn hoặc bằng cách đếm ký tự của `char_length`, nên giới hạn ở DB không bao giờ bị vi phạm), và từ chối `\u0000` (Postgres không lưu được NUL trong `text`, sẽ thành lỗi 500 nếu lọt). Lưu nguyên dạng chữ thường, FE phải escape khi hiện. `upToSeq` là int từ 0 đến 2147483647; giá trị lớn hơn `last_seq` được kẹp xuống, không báo lỗi.
- **Cache**: mọi route chat trả `Cache-Control: private, no-store` (nội dung riêng và đổi liên tục).
- **Nhật ký**: không dòng log hay thông báo lỗi nào chứa nội dung tin nhắn; chỉ `requestId`.
- **Module**: `src/chat/` gồm `ChatModule`, `ListingConversationsController` (route mở), `ConversationsController` (các route còn lại), `MeConversationsController` (`/me/conversations` và `unread-count`), `ChatService`, `ChatRepository`, ánh xạ và DTO. `ChatModule` import `ListingsDataModule` và `SettingsModule`; `ListingsRepository` thêm `findLandlordIdOf(listingId)` và `findPublicIds(ids, visibility)` (nơi duy nhất đọc bảng `listings` và giữ hai mảnh SQL công khai). `ChatModule` vào `AppModule`.

**Giới hạn tần suất** (thêm ba nhóm vào `RATE_LIMITS`, dùng `@RateLimited`):

| Nhóm | Route | Bộ đếm |
|---|---|---|
| `conversationStart` (mới) | `POST /listings/:id/conversations` | `user`: 20 lần mỗi giờ |
| `messageWrite` (mới) | `POST /conversations/:id/messages` | `user`: 30 lần mỗi phút |
| `chatRead` (mới) | `GET /me/conversations`, `GET /conversations/:id`, `GET /conversations/:id/messages`, `GET /me/conversations/unread-count`, `POST /conversations/:id/read` | `user`: 120 lần mỗi phút, **mỗi route đếm riêng** |

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Mọi route | người gọi và loại tài khoản | `userId` và `accountType` trong `RequestUser` (từ token) |
| Mọi route | `now` | `new Date()` do controller lấy một lần mỗi request |
| Mở | người nhắn (`tenant_id`) | `userId` trong token, không nhận từ đường dẫn hay body |
| Mở | tin (`listing_id`) | tham số đường dẫn `:id` qua `uuidParam()` |
| Mở | chủ trọ (`landlord_id`) | `properties.landlord_id` của nhà trọ chứa tin, đọc bằng `ListingsRepository.findLandlordIdOf` lúc mở rồi chép vào hàng |
| Mở | tin có mở được không | `ListingsRepository.isPubliclyVisible(id, { now, trialListingLimit })`; `trial_listing_limit` từ `SettingsService.getValue` |
| Mở, gửi | `body` | body của request, qua `@Trim()` và kiểm độ dài |
| Mở, gửi | `seq` mới | `conversations.last_seq` cộng 1, lấy trong chính câu `UPDATE` hay `INSERT ... ON CONFLICT` đang khóa hàng |
| Mở, gửi | `sender_id` | `userId` trong token |
| Mở, gửi | `last_message_at`, `created_at` | `now()` của DB |
| Mở, gửi | mốc đọc của người gửi | `last_seq` mới, cùng câu lệnh với bộ đếm |
| Gửi, đọc, đánh dấu | người gọi là bên nào | `userId` bằng `tenant_id` hay `landlord_id` của hàng; không bằng cái nào thì 404 |
| Gửi | người kia còn hoạt động không | `users.status` và `users.deleted_at` của bên còn lại |
| Đọc tin | `isMine` | `messages.sender_id` bằng `userId` |
| Đọc tin | `hasMore`, `lastSeq` | lấy `limit + 1` hàng; `lastSeq` là `conversations.last_seq` |
| Hộp thư, chi tiết | `myRole` | `userId` bằng `tenant_id` thì `tenant`, ngược lại `landlord` |
| Hộp thư, chi tiết | `otherUser` | `users.id` và `users.name` của bên còn lại |
| Hộp thư, chi tiết | `lastMessage` | hàng `messages` có `seq` bằng `conversations.last_seq` |
| Hộp thư, chi tiết | `listing.code`, `slug`, `title`, `price` | cột của hàng `listings`, qua cùng ánh xạ chuỗi tin tóm tắt của `GET /listings` |
| Hộp thư, chi tiết | `listing.isPublic` | id tin có nằm trong kết quả của `publicListingFrom` cộng `publicListingCondition` với `now` và `trial_listing_limit` |
| Hộp thư, chi tiết | `listing.coverImageUrl` | ảnh đầu của tin theo cùng quy tắc `GET /listings` khi `isPublic`, ngược lại `null` |
| Hộp thư | thứ tự, `total`, `page`, `pageSize` | `last_message_at` giảm dần rồi `id` giảm dần; `count(*)` cùng điều kiện; query qua `PaginationQueryDto` |
| Hộp thư, chi tiết (mốc 2) | `unreadCount` | `last_seq` trừ `tenant_read_seq` hay `landlord_read_seq` theo `myRole` |
| `unread-count` (mốc 2) | hai số | cùng các cột `last_seq` và mốc đọc, gom theo người gọi |
| Đánh dấu đã đọc (mốc 2) | mốc mới | `GREATEST(mốc cũ, LEAST(upToSeq, last_seq))` với `upToSeq` từ body |

**Key invariants**:
- Mỗi cặp (`listing_id`, `tenant_id`) có tối đa một cuộc trò chuyện, và `tenant_id` khác `landlord_id` (DB).
- `seq` của một cuộc trò chuyện chạy 1 đến `last_seq`, không trùng, không hở; `last_seq` bằng số tin (DB giữ không trùng, hàng khóa giữ không hở).
- Mỗi mốc đọc nằm trong 0 đến `last_seq` và chỉ tăng; sau khi gửi, mốc của người gửi bằng `last_seq`, nên mọi tin có `seq` lớn hơn mốc của một người đều do bên kia gửi.
- Nội dung tin nhắn không bao giờ đổi và không bao giờ bị xóa qua API; không route nào sửa hay xóa cuộc trò chuyện.
- `tenant_id` và `sender_id` luôn lấy từ token, `landlord_id` luôn lấy từ tin; không bao giờ từ body hay đường dẫn.
- Chỉ hai bên của một cuộc trò chuyện đọc được nó; người ngoài, kể cả admin, không đọc được và không phân biệt được "không có" với "không phải của mình".
- Không log và không trả nội dung tin nhắn ngoài các route đọc của chính hai bên.

**Security model**:
- Cả bảy route cần đăng nhập. Hai module quyền mới trong danh mục (đúng bảng ở `permission-catalog.ts`, cùng `ownerScoped: true`, `adminActions: []`): `conversation` với `read`, `create`, `update`, và `message` với `create`. Mở cuộc trò chuyện cần `conversation:create`; gửi cần `message:create`; các route đọc cần `conversation:read`; đánh dấu đã đọc cần `conversation:update`.
- Quyền mặc định (thêm bằng phần dữ liệu của migration): `tenant` giữ cả bốn khóa; `landlord` giữ `conversation:read`, `conversation:update`, `message:create` và không giữ `conversation:create`, nên chủ trọ trả lời nhưng không tự mở được. Admin chỉnh quyền hai loại này bằng API quyền có sẵn.
- **Admin**: `ADMIN_PERMISSIONS` là `manage` của mọi module nên admin qua được guard quyền `conversation:*` và `message:*`. Service chặn `accountType === 'admin'` bằng 403 `PERMISSION_DENIED` ở cả bảy route, như `follow`, `favorites` và `OrdersService.create`. Chat không có góc nhìn kiểm duyệt cho admin; muốn dừng một người lạm dụng thì khóa tài khoản.
- Chủ trọ được cấp `conversation:create` thì mở được cuộc trò chuyện với tin của chủ trọ khác, nhưng không với tin của chính mình (409).
- Hai route gửi dùng `@FreshAuth` (đọc lại trạng thái tài khoản từ DB), nên tài khoản vừa bị khóa dừng gửi ngay; các route đọc theo token như thường (cửa sổ tối đa 15 phút của token đã được chấp nhận ở nơi khác).
- Mở cuộc trò chuyện với tin không hiện công khai trả 404 như chi tiết tin, để không ai dò được tin đang ẩn.
- Số điện thoại, email, `tenant_read_seq`, `landlord_read_seq` không có trong bất kỳ phản hồi chat nào.
- Tin nhắn là dữ liệu riêng của hai người dùng, không thuộc phạm vi tuân thủ riêng của bản demo; xem Consequences về lưu giữ.

**Configuration required**: không có biến môi trường, không dịch vụ ngoài, không thư viện mới, không seed. Chỉ cần một migration (bảng, ràng buộc và phần dữ liệu cho khóa quyền mặc định). DB dev cần `npm run migration:deploy`.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: tenant mở cuộc trò chuyện vào một tin, chủ trọ thấy nó trong hộp thư, trả lời, tenant đọc `GET /conversations/:id/messages` thấy hai tin `seq` 1 và 2 với `isMine` đúng, verifies **AC-1**, **AC-3**, **AC-6**, **AC-7**
- Failure case: 20 lần mở đồng thời cùng một cặp (tin, tenant) ra đúng một hàng `conversations` và `seq` 1 đến 20 không trùng không hở; 20 lần gửi đồng thời vào một cuộc trò chuyện ra `seq` liên tiếp; hai người gửi đồng thời cho cùng kết quả, verifies **AC-1**, **AC-3**, **AC-13**
- Failure case: mở vào tin bị ẩn, đã xóa mềm, của chủ trọ bị khóa, hết dùng thử và hết gói, vượt hạn mức: 404 và không dòng nào; id `abc` 400; chủ trọ được cấp quyền mở vào tin của chính mình 409, verifies **AC-2**
- Failure case: `body` thiếu, rỗng, toàn khoảng trắng, 1001 ký tự, số thay vì chuỗi, chứa `\u0000`: 400 `VALIDATION_FAILED` ở cả hai route gửi, không dòng nào; 1000 ký tự và có xuống dòng ở giữa thì được, verifies **AC-4**
- Failure case: khóa chủ trọ rồi tenant gửi: 409 `CHAT_PEER_UNAVAILABLE`, nhưng tenant vẫn đọc được lịch sử; mở khóa thì gửi lại được; tenant bị khóa mà token còn hạn gửi tin: 403 `ACCOUNT_LOCKED`, verifies **AC-5**
- Happy path: đọc không tham số, `afterSeq`, `beforeSeq`, `limit` ở các biên (1, 100, 101), cả hai tham số cùng lúc 400; `hasMore` đúng ở từng chế độ; đọc không đổi mốc đã đọc, verifies **AC-6**
- Happy path: hộp thư của tenant và của chủ trọ, đúng thứ tự mới nhất trước, `listingId` lọc đúng, `isPublic` khớp việc khách mở được `GET /listings/:slugCode` qua một chuỗi tin bị ẩn, khóa, hết gói và hiện lại, `coverImageUrl` là `null` khi không công khai, không có số điện thoại hay email, verifies **AC-7**, **AC-9**
- Auth/permission: khách 401; người thứ ba và id không có cùng 404 `CONVERSATION_NOT_FOUND`; chủ trọ mặc định mở cuộc trò chuyện 403; admin gọi cả bảy route 403 và không ghi dòng nào; chủ trọ trả lời được cuộc trò chuyện của tenant, verifies **AC-8**
- Happy path (mốc 2): `unreadCount` và `unread-count` khớp một phép tính độc lập từ dòng thô qua một chuỗi gửi, đánh dấu, gửi tiếp; `read` với `upToSeq` nhỏ hơn mốc cũ không lùi, lớn hơn `last_seq` bị kẹp; đua giữa `read` và gửi không bao giờ làm mốc vượt `last_seq`, verifies **AC-10**, **AC-11**
- Auth/permission: vượt 20 lần mở trong một giờ, 30 lần gửi trong một phút, 120 lần đọc trong một phút đều nhận 429 kèm `Retry-After`, mỗi route đếm riêng, verifies **AC-12**
- Failure case: `INSERT` thẳng vào DB cuộc trò chuyện trùng cặp, người nhắn bằng chủ trọ, `seq` 0, `body` rỗng hoặc dài 1001, mốc đọc lớn hơn `last_seq`: DB từ chối cả sáu, verifies **AC-13**
- Kiểm bằng `EXPLAIN` (không phải test tự động): hộp thư của một người có 5 nghìn cuộc trò chuyện, đọc tin của một cuộc trò chuyện 50 nghìn tin, và `unread-count`; đo một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-7**, **AC-6**

## Build plan

Hướng build theo Skateboard (bản mỏng nhất dùng được trước, rồi mới mở rộng): mốc 1 đã cho hai người nhắn qua lại hết vòng (mở, hộp thư, đọc, trả lời, cách ly); mốc 2 thêm đếm chưa đọc và đánh dấu đã đọc, là phần chỉ thêm trường và route chứ không đổi hợp đồng của mốc 1. Cả hai bảng và mọi cột (kể cả cột mốc đọc) nằm trong một migration ở mốc 1, vì gửi tin ở mốc 1 đã phải dời mốc của người gửi cho dữ liệu đúng ngay từ đầu. Hai cột mốc, mỗi mốc một lần `/develop` rồi dừng cho bạn review (khớp ô `Build it` trong scope). Mỗi mốc đổi API thì cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong mốc đó (quy tắc tài liệu sống), gắn `@RateLimited` ngay khi tạo route.

**Mốc 1: nhắn qua lại, hộp thư, cách ly**
1. Thêm model `Conversation` và `Message` vào `schema.prisma` (hai quan hệ tên riêng của `User` cho người nhắn và chủ trọ, một cho tin đã gửi, một ngược lại trên `Listing`) và một migration tạo hai bảng, hai chỉ mục hộp thư, bốn CHECK viết tay (`conversations_tenant_landlord_check`, `conversations_seq_check`, `messages_seq_check`, `messages_body_check`) và phần dữ liệu thêm khóa quyền mặc định cho `tenant` và `landlord` (chỉ thêm khóa còn thiếu); áp lên DB thử, hỏi schema thật, `migrate diff` không lệch, sửa `migration-defaults.spec.ts`, satisfies **AC-13**, **AC-8**
2. Danh mục quyền thêm `conversation` (`read`, `create`, `update`) và `message` (`create`) kèm test danh mục; ba mã lỗi `CONVERSATION_NOT_FOUND`, `CANNOT_CHAT_WITH_SELF`, `CHAT_PEER_UNAVAILABLE` kèm bảng ánh xạ; ba nhóm `conversationStart`, `messageWrite`, `chatRead` trong `RATE_LIMITS` kèm test bảng giới hạn, satisfies **AC-8**, **AC-12**
3. `ListingsRepository.findLandlordIdOf` và `findPublicIds` (dùng nguyên hai mảnh SQL công khai), satisfies **AC-1**, **AC-7**, **AC-9**
4. `src/chat/`: `ChatRepository` (mở bằng `INSERT ... ON CONFLICT`, gửi bằng `UPDATE ... RETURNING` rồi `INSERT` trong `TransactionRunner`, đọc cuộc trò chuyện kèm trạng thái hai tài khoản, hộp thư, tin nhắn theo `seq`), `ChatService` (kiểm admin trước, rồi thứ tự lỗi như mục "Quy tắc"), ánh xạ (`myRole`, `isMine`, `isPublic`, `coverImageUrl`), DTO (`SendMessageDto`, `MessagesQueryDto`, `ConversationsQueryDto`), ba controller với năm route của mốc 1 (`@RequirePermissions`, `@RateLimited`, `@FreshAuth` ở hai route gửi, `uuidParam()`, `Cache-Control: private, no-store`), `ChatModule` vào `AppModule`, satisfies **AC-1** đến **AC-9**, **AC-12**
5. Test đơn vị (Service, Repository, ánh xạ, bảng quyền và duyệt route khai báo quyền), kiểm thật trên DB thử (đồng thời mở và gửi, cách ly, quyền, `body` biên, người kia bị khóa, tin đổi trạng thái, ràng buộc DB bằng `INSERT` thẳng, 429), điều khiển âm (bỏ khóa hàng làm `seq` hở hoặc trùng, bỏ kiểm người tham gia làm lộ cuộc trò chuyện, bỏ kiểm admin, bỏ điều kiện `isPublic`), Postman folder 25 (tái dùng token có sẵn, không đăng ký tài khoản mới, đăng nhập admin lại không quá giới hạn), `api-for-frontend.md` (mục 6.39, bảng mã lỗi và giới hạn tần suất, màn hình, quy tắc, giới hạn đã biết, nhật ký, phụ lục), `verify.md`, satisfies **AC-1** đến **AC-9**, **AC-12**, **AC-13**

**Mốc 2: chưa đọc và đánh dấu đã đọc**
6. `unreadCount` trong ánh xạ và các truy vấn hộp thư và chi tiết; `GET /me/conversations/unread-count` và `POST /conversations/:id/read` (`ReadConversationDto`, câu `UPDATE` kẹp bằng `GREATEST` và `LEAST`), cùng nhóm `chatRead`, satisfies **AC-10**, **AC-11**, **AC-12**
7. Test đơn vị, kiểm thật trên DB thử (phép tính độc lập cho `unreadCount` và `unread-count` qua nhiều bước gửi và đánh dấu, mốc không lùi, kẹp theo `last_seq`, đua giữa `read` và gửi, 429), điều khiển âm (bỏ `GREATEST` cho mốc lùi, bỏ `LEAST` cho mốc vượt, `unreadCount` đếm cả tin của chính mình), `EXPLAIN` một lần theo kịch bản ở mục test (ghi số, không chỉnh), mở rộng Postman folder 25 và `api-for-frontend.md`, `verify.md`, satisfies **AC-10**, **AC-11**, **AC-12**

## Consequences

**Positive**:
- Hai bảng, bảy route, không thư viện mới, không biến môi trường, không việc chạy nền: gọn đúng tinh thần MVP và khớp cách kiểm bằng script thật và Newman đang dùng.
- `seq` theo cuộc trò chuyện cho thứ tự chính xác, cho FE hỏi "có gì mới sau số N" bằng một số nguyên, và biến việc đếm chưa đọc thành phép trừ.
- Mỗi tin một cuộc trò chuyện nên chủ trọ biết ngay người ta hỏi phòng nào, và cuộc trò chuyện vẫn đúng khi tin đổi trạng thái.
- Cách ly rõ: hai bên của cuộc trò chuyện, không ai khác, kể cả admin; người ngoài chỉ thấy 404.
- Thiết kế không chặn đường nâng cấp: thêm kênh đẩy (SSE hay WebSocket) sau này chỉ thêm một cách báo "có `seq` mới", không đổi dữ liệu hay route REST.

**Negative / tradeoffs**:
- Không có kênh đẩy và không có email: chủ trọ chỉ biết có tin khi mở trang và FE hỏi lại; tin đến lúc họ không đăng nhập nằm chờ. Với demo thì ổn, còn dùng thật thì thông báo là thứ đầu tiên cần thêm.
- Hỏi lại tốn request: mỗi cuộc trò chuyện đang mở, hộp thư và cái chuông mỗi thứ một request mỗi vài giây cho mỗi người đang mở trang. Giới hạn 120 mỗi phút mỗi route cho phép hỏi 2 lần mỗi giây; bộ đếm giới hạn nằm trong bộ nhớ nên mất khi khởi động lại.
- Gửi tin dời mốc đã đọc của chính mình tới tin cuối, nên một tin của bên kia chưa kịp xem sẽ được tính là đã đọc nếu mình gửi tin từ một tab khác. Đổi lại `unreadCount` rẻ và đúng ở trường hợp thường.
- Một người hỏi ba phòng của cùng một chủ trọ ra ba cuộc trò chuyện; hộp thư của chủ trọ dài hơn so với một luồng cho mỗi người.
- Không sửa, không xóa, không báo cáo, không chặn người: một tin nhắn xấu ở lại mãi, và admin không xem được để điều tra, chỉ khóa được tài khoản. Tin nhắn lưu mãi không có chính sách giữ hay xóa; nếu chạy thật thì cần quy định lưu giữ và cách xóa.
- Cuộc trò chuyện sống tiếp dù tin bị admin ẩn vì vi phạm, nên người dùng vẫn nhắn được cho chủ trọ đó cho tới khi tài khoản bị khóa.
- Cờ `listing.isPublic` chạy luật hiển thị công khai (có phần xếp hạng theo hạn mức đã đo là chậm ở 60 nghìn tin, spec 0003 AC-13) cho các tin của một trang hộp thư; chi phí tỷ lệ với một trang (tối đa 50 tin), không với cả bảng.
- Hộp thư dùng `tenant_id = ... OR landlord_id = ...` trên hai chỉ mục riêng nên có thể phải gộp rồi sắp xếp; đo một lần, không chỉnh.
- Admin cần một nhánh riêng trong Service (như `follow`, `favorites`) vì quyền admin mở mọi module.
- Nội dung là chữ thô lưu nguyên: FE phải escape khi hiện, backend không lọc HTML hay liên kết.

**Neutral**:
- Thêm module `src/chat/`, hai bảng, hai module quyền, ba mã lỗi, ba nhóm giới hạn, hai phương thức ở `ListingsRepository`; hợp đồng của API đang chạy không đổi.
- DB dev cần `npm run migration:deploy`; sau đó tenant và landlord đã có sẵn quyền chat. Nếu admin đã chỉnh quyền hai loại này và gỡ khóa chat thì họ bị 403 cho tới khi cấp lại.
- Số `0013` không trùng ai vì mỗi spec nằm trong thư mục riêng.

## Follow-up

- [ ] Hoãn, thêm lại bằng `/scope` khi cần: thông báo khi có tin mới (email, đẩy trình duyệt; cần việc nền hay gửi trong request), kênh đẩy thời gian thực (SSE hoặc WebSocket) thay cho hỏi lại, trạng thái đang gõ và đang trực tuyến, ảnh và tệp trong tin nhắn, sửa hoặc xóa tin nhắn của mình, báo cáo hay chặn một người, góc nhìn kiểm duyệt cho admin kèm nhật ký, `clientMessageId` chống gửi trùng, ghim, tắt tiếng hoặc lưu trữ cuộc trò chuyện, tìm trong tin nhắn, chính sách giữ và xóa tin nhắn, chủ trọ chủ động nhắn tên người đã lưu hay theo dõi mình, mở cuộc trò chuyện từ hồ sơ chủ trọ khi chưa chọn tin, hạn mức mở cuộc trò chuyện theo ngày lưu trong DB.
- [ ] Sau khi build, `/sync` ghi hai bảng, ba nhóm giới hạn và hai module quyền vào các spec nền móng nếu còn lệch (`0001/0005-postgres-data-conventions.md` chưa có hai bảng này), và chuyển mục hoãn "liên hệ chủ trọ có giới hạn mỗi ngày" trong scope thành đã thay bằng chat (chỉ còn giới hạn theo giờ).
- [ ] Mục Security model của spec 0005 vẫn nói admin mặc định không giữ `follow:create` (đã nêu ở spec 0006), cần `/architect` sửa một dòng; spec này đã làm đúng từ đầu cho chat.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
