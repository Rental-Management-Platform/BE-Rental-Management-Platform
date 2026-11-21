# Chat (`src/chat/`)

Chat giữa người tìm trọ (`tenant`) và chủ trọ, theo spec [0013](../../docs/specs/0013-chat-tenant-landlord/index.md). Bảy route, hai bảng `conversations` và `messages`. FE hỏi lại bằng REST, chưa có kênh đẩy.

## File chính
- `chat.repository.ts`: nơi duy nhất chạm hai bảng. Việc ghi tin, đánh dấu đã đọc và đếm chưa đọc dùng SQL thô.
- `chat.service.ts`: thứ tự kiểm lỗi và kiểm admin. `chat.controller.ts` có ba controller. `chat.mapper.ts` và `dto/` là hình dạng vào ra.
- `chat-limits.ts`: các con số của chat (1000 ký tự, 30 tin mỗi lần đọc, 100 tối đa). `chat.fixtures.ts` chỉ dùng cho test.
- Cờ `listing.isPublic` và chủ trọ của tin đọc qua `ListingsRepository.findPublicIds` và `findLandlordIdOf`; module này không tự đọc bảng `listings`.
- Điều kiện được đánh giá nằm ở đây vì chỉ `ChatRepository` chạm hai bảng chat: `hasLandlordReplied` (đánh giá chủ trọ, tin nào của chủ trọ cũng được, `src/reviews/`) và `hasLandlordRepliedOnListing` (đánh giá phòng, đúng tin đó, `src/listing-reviews/`). Hai module đánh giá đọc chat chỉ qua hai hàm này.

## Quy ước và ràng buộc
- `seq` đếm theo từng cuộc trò chuyện. Ghi tin chỉ qua một câu khóa hàng (`UPDATE ... SET last_seq = last_seq + 1 ... RETURNING`, hoặc `INSERT ... ON CONFLICT DO UPDATE` ở route mở). Không bao giờ tính `max(seq) + 1`. Giờ của tin lấy từ `clock_timestamp()` trong chính câu đã khóa hàng, không phải `now()`.
- Mốc đã đọc: gửi tin dời mốc của chính người gửi. `POST /conversations/:id/read` đặt mốc bằng `GREATEST(mốc cũ, LEAST(upToSeq, last_seq))`, nên không lùi và không vượt tin cuối. Mọi `GET` không đổi mốc. `unreadCount` là `last_seq` trừ mốc của người gọi. Không phản hồi nào lộ tên cột mốc.
- Điều kiện "người gọi là một trong hai bên" nằm ngay trong truy vấn, nên người ngoài và id không có cùng nhận 404 `CONVERSATION_NOT_FOUND`.
- Admin bị chặn ở Service (`assertNotAdmin`, 403 `PERMISSION_DENIED`) vì `ADMIN_PERMISSIONS` giữ `conversation:*` và `message:*`. Việc này chạy sau pipe, nên id hay body sai vẫn là 400.
- `@FreshAuth()` chỉ có ở hai route ghi tin (`open`, `send`). Các route còn lại, kể cả `read`, theo quyền trong token, nên đổi quyền của loại tài khoản chỉ thấy sau lần đăng nhập hay refresh kế tiếp.
- Mọi route trả `Cache-Control: private, no-store`. Không dòng log hay thông báo lỗi nào được chứa nội dung tin nhắn.
- Giới hạn tần suất dùng nhóm `conversationStart`, `messageWrite`, `chatRead`; mỗi route đếm riêng, không đếm theo nhóm.
- Không route nào sửa hay xóa tin nhắn hay cuộc trò chuyện. Mọi khóa ngoại là `RESTRICT`.
- `body` được cắt khoảng trắng hai đầu, dài 1 đến 1000 ký tự Unicode (`MaxLength` đếm giống `char_length` của PostgreSQL), không chứa `\u0000`.

## Lệnh và tài liệu
- Test: `npm test -- src/chat`.
- Đổi API chat thì sửa `docs/api/api-for-frontend.md` (mục 6.39). Bộ Postman đã bỏ từ 2026-11-16, không cập nhật `postman-collection.json` nữa.
- Phép kiểm thật trên database thử và cách chạy lại: `docs/specs/0013-chat-tenant-landlord/verify.md`.
- Thêm bảng có khóa ngoại `RESTRICT` tới `users` hay `listings` thì phải thêm bước xóa vào `deleteDemoData` trong `src/database/seed-demo.ts`.

_Drafted by /sync from the introducing change, worth a quick human pass._
