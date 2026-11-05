# Verify: chat giữa người tìm trọ và chủ trọ · spec 0013 · updated 2026-11-05
_Steps derived from spec 0013 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Xong **mốc 1** (AC-1 đến AC-9, AC-12, AC-13) và **mốc 2** (AC-10, AC-11, AC-12: `unreadCount`, `unread-count`, `POST /conversations/:id/read`, `EXPLAIN`). Phần mốc 2 nằm ngay trước mục "Cách chạy lại". Mọi con số "đã chạy" ở các mục dưới đây, trừ phần mốc 2, là của lần build mốc 1 ngày 2026-11-05, trên database thử `rental_management_verify` (không phải database dev), API chạy cổng riêng, bằng script Node gọi HTTP thật cộng SQL đối chiếu (script nằm ở thư mục tạm của phiên, không nằm trong repo; cách dựng lại ở mục "Cách chạy lại" cuối file).

## Commands
- [ ] `npx tsc --noEmit` và `npx eslint "{src,apps,libs,test}/**/*.ts"` → sạch → mọi AC
- [ ] `npm test` → toàn bộ qua (đã chạy: 86 bộ, 1800 bài), gồm `chat.service.spec.ts`, `chat.repository.spec.ts`, `chat.mapper.spec.ts`, `chat.controller.spec.ts`, `dto/chat-dtos.spec.ts`, các bảng `rate-limits.spec.ts`, `error-code.spec.ts`, `permission-catalog.spec.ts`, `migration-defaults.spec.ts` và `route-declarations.spec.ts` (mọi route chat khai báo đúng một kiểu quyền) → AC-1 đến AC-9, AC-12
- [ ] `npx prisma migrate deploy` trên database trống rồi `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → exit 0, không lệch (đã chạy: 0) → AC-13
- [ ] Trên database đã có dữ liệu: `npm run migration:deploy` → thêm đúng bốn khóa chat cho `tenant` và ba khóa (không có `conversation:create`) cho `landlord`, chạy lại phần dữ liệu không đổi gì (đã kiểm bằng cách chạy lại hai câu `UPDATE`) → AC-8
- [ ] Newman với mọi folder trừ 02, 06, 23, 24 của `docs/api/postman-collection.json`, có `--working-dir docs/api`, trên database trống mới seed (đã chạy: 22 folder, 652 request, 1404 assertion, 0 lỗi, hai lần, và một lần nữa trên cùng database sau khi khởi động lại server), folder 25 riêng 60 request và 133 dòng kiểm tra → AC-1 đến AC-9
- [ ] `npm run seed:demo` rồi tạo cuộc trò chuyện trỏ vào tin demo và tài khoản demo, rồi `npm run seed:demo -- --reset` → thoát 0, không còn dòng `conversations` và `messages` nào (đã chạy: trước khi sửa lỗi khóa ngoại `conversations_listing_id_fk`, sau khi sửa thoát 0 và xóa hết) → tương thích seed demo

## UI / manual (gọi API, Postman folder `25 Chat giữa người tìm trọ và chủ trọ`)

AC-8, quyền và đăng nhập:
- [ ] Khách gọi cả năm route → 401 `TOKEN_MISSING`; chủ trọ mặc định mở cuộc trò chuyện → 403 `PERMISSION_DENIED`; admin gọi cả năm route → 403 `PERMISSION_DENIED` và không ghi dòng nào; admin gửi id sai → 400 `INVALID_ID`, body rỗng → 400 `VALIDATION_FAILED` (pipe chạy trước Service) → AC-8
- [ ] Id sai ở `:id` của ba route theo cuộc trò chuyện → 400 `INVALID_ID` → AC-8

AC-1, mở cuộc trò chuyện:
- [ ] `tenant` mở tin A với `body` có khoảng trắng hai đầu → 201 `{ conversation, message }`, `message.seq` 1, `body` đã bỏ khoảng trắng, `conversation.myRole` `tenant`, `otherUser` là chủ trọ, `listing.isPublic` true, `coverImageUrl` mở được (200), `Cache-Control: private, no-store` (từ mốc 2 có thêm `unreadCount` 0, xem phần mốc 2); DB: `tenant_id` là người gọi, `landlord_id` chép từ nhà trọ của tin, `last_seq` 1, `tenant_read_seq` 1, `landlord_read_seq` 0 → AC-1
- [ ] Gọi lại cùng tin → 201, cùng `conversation.id`, `seq` 2; DB `last_seq` 2, mốc người nhắn dời tới 2, mốc chủ trọ vẫn 0, `landlord_id` không đổi, `last_message_at` tăng, vẫn một hàng cho cặp → AC-1
- [ ] Cùng người hỏi tin B của cùng chủ trọ → cuộc trò chuyện khác, `seq` 1; người tìm trọ khác hỏi tin A → cuộc trò chuyện riêng → AC-1
- [ ] 20 lần mở đồng thời cùng một cặp (tin, người nhắn) → cả 20 lần 201, đúng một hàng `conversations`, `seq` trả về đúng 1 đến 20 mỗi số một lần, DB `last_seq` 20, tin 1 đến 20 không hở, mỗi nội dung đúng một dòng và `seq` trả về khớp `seq` lưu → AC-1 (đã chạy: đạt)
- [ ] Mở lẫn gửi đồng thời trên một cuộc trò chuyện (6 lần mở, 6 gửi của người nhắn, 6 trả lời của chủ trọ) → cả 18 lần 201, `seq` liên tiếp không trùng không hở → AC-1, AC-3 (đã chạy: đạt)

AC-2, mở thất bại (mỗi ca: 404 `LISTING_NOT_FOUND` và không ghi dòng nào, và khách cũng không mở được chi tiết tin):
- [ ] Tin không tồn tại; tin bị chủ trọ ẩn; tin bị admin ẩn; chủ trọ bị khóa; chủ trọ hết dùng thử và hết gói (`trial_ends_at` quá khứ); tin bị ẩn bớt vì vượt hạn mức (`trial_listing_limit` 1, tin thứ hai); tin đã xóa mềm → AC-2
- [ ] Người đã có cuộc trò chuyện về tin đó cũng bị 404 khi gọi lại route mở → AC-2, AC-9
- [ ] `:id` là `abc` → 400 `INVALID_ID`; admin cấp `conversation:create` cho `landlord`, chủ trọ mở tin của chính mình → 409 `CANNOT_CHAT_WITH_SELF` và không ghi; cùng chủ trọ mở tin của chủ trọ khác → 201 với `myRole` `tenant`; gỡ quyền → 403 → AC-2, AC-8

AC-3, gửi tin:
- [ ] Chủ trọ trả lời cuộc trò chuyện của người tìm trọ → 201, `seq` 3, `isMine` true, `senderId` là chủ trọ; DB `landlord_read_seq` 3 và `tenant_read_seq` giữ 2; `createdAt` khớp dòng DB; người tìm trọ đọc thấy `isMine` false ở tin đó → AC-3
- [ ] 20 lần gửi đồng thời vào một cuộc trò chuyện từ hai người (10 mỗi bên) → cả 20 lần 201, `seq` trả về đúng dãy liền sau `last_seq` cũ mỗi số một lần, DB `last_seq` tăng đúng 20, mốc đã đọc của mỗi bên bằng `seq` lớn nhất bên đó đã gửi và không vượt `last_seq` → AC-3 (đã chạy: đạt)

AC-4, nội dung (cả hai route gửi):
- [ ] Thiếu `body`, rỗng, toàn khoảng trắng, 1001 ký tự, 1001 emoji, số, mảng, object, `null`, có NUL ở giữa, chỉ có NUL, trường lạ `tenantId` → mỗi ca 400 `VALIDATION_FAILED` kèm đúng trường (`body`, hoặc `tenantId` cho trường lạ), không ghi dòng nào; JSON hỏng → 400 chứ không 500 → AC-4
- [ ] 1 ký tự; đúng 1000 ký tự; 1000 ký tự cộng khoảng trắng hai đầu; xuống dòng ở giữa (`\n` và `\r\n`) giữ nguyên; 1000 chữ `đ`; 1000 emoji (lưu `char_length` 1000, đúng bằng giới hạn DB); mảnh thay thế lẻ → 201 hoặc không phải 5xx → AC-4 (đã chạy: đạt)

AC-5, người kia bị khóa hoặc đã xóa:
- [ ] Khóa chủ trọ → người tìm trọ gửi → 409 `CHAT_PEER_UNAVAILABLE`, không ghi, thông báo lỗi không lặp nội dung tin; người tìm trọ vẫn đọc được lịch sử, chi tiết, hộp thư; chính chủ trọ bị khóa (token còn hạn) gửi → 403 `ACCOUNT_LOCKED`, vẫn đọc theo token; mở khóa → gửi lại được 201 → AC-5
- [ ] Đặt `users.deleted_at` của chủ trọ → gửi 409, đọc được; khôi phục → gửi lại được → AC-5
- [ ] Khóa người tìm trọ → họ gửi và mở cuộc trò chuyện mới đều 403 `ACCOUNT_LOCKED`, vẫn đọc được; chủ trọ gửi cho họ → 409 `CHAT_PEER_UNAVAILABLE`; mở khóa → chủ trọ gửi lại được → AC-5

AC-6, đọc tin (cuộc trò chuyện 12 tin do hai bên xen kẽ):
- [ ] Không tham số → 12 tin tăng dần, `hasMore` false, `lastSeq` 12; `limit` 1, 5, 11, 12, 100 → đúng tập và `hasMore`; `beforeSeq` 1, 3, 8, 13, 100; `afterSeq` 0, 5, 7, 11, 12, 100, 2147483647 → đúng tập, đúng `hasMore` ở từng chế độ → AC-6 (đã chạy: 16 ca đạt)
- [ ] `limit` 0, 101, -1, 1.5, `abc`; `afterSeq` -1, 1.5, `abc`, 2147483648; `beforeSeq` 0, -2, `abc`, 2147483648; cả hai con trỏ (kể cả `afterSeq=0&beforeSeq=1`) → mỗi ca 400 `VALIDATION_FAILED` → AC-6
- [ ] Đi ngược từng 5 tin bằng `beforeSeq` và đi xuôi từng 5 tin bằng `afterSeq` đều gom đủ 1 đến 12 theo thứ tự, không trùng, không hở; sau mọi lần đọc, hai mốc đã đọc không đổi → AC-6

AC-7, hộp thư và chi tiết:
- [ ] Hộp thư của `tenant`, `landlord` (kể cả chủ trọ được cấp quyền đã mở một cuộc với tin của chủ trọ khác, `myRole` `tenant`) khớp thứ tự và tập tính độc lập bằng SQL (`last_message_at` giảm dần rồi `id` giảm dần), `total` đúng; mỗi phần tử khớp DB về `myRole`, `otherUser`, `lastMessage`; `GET /conversations/:id` trả đúng phần tử của hộp thư; `lastMessageAt` bằng `lastMessage.createdAt` → AC-7
- [ ] `page`, `pageSize`, `listingId` lọc đúng (chủ trọ lọc tin A thấy cả hai cuộc trò chuyện); `listingId` `abc`, `pageSize` 51 và 0, `page` 0 và `abc` → 400; không có số điện thoại, email, `tenant_read_seq` hay `landlord_read_seq` trong bất kỳ phản hồi nào → AC-7, AC-8
- [ ] `listing.isPublic` khớp việc khách mở được chi tiết tin qua từng trạng thái (ẩn bởi chủ trọ, ẩn bởi admin, chủ trọ bị khóa, hết dùng thử, vượt hạn mức, xóa mềm) và hiện lại; khi `false` thì `coverImageUrl` là `null` và `/media/public/...` của ảnh đó trả 404, hiện lại thì 200 → AC-7, AC-9

AC-8, cách ly:
- [ ] Người tìm trọ khác và chủ trọ khác gọi `GET` chi tiết, `GET` tin nhắn, `POST` gửi vào cuộc trò chuyện của người khác → 404 `CONVERSATION_NOT_FOUND`, cùng status, mã và `message` với id không tồn tại, không ghi dòng nào; hộp thư của họ không chứa cuộc trò chuyện đó → AC-8
- [ ] Không có route sửa hay xóa: `PATCH`, `PUT`, `DELETE` trên `/conversations/:id`, `DELETE /conversations/:id/messages`, `PATCH` và `DELETE /conversations/:id/messages/:mid` → 404, số dòng không đổi → AC-13

AC-9, cuộc trò chuyện sống tiếp khi tin đổi:
- [ ] Với từng trạng thái ở AC-2 (trừ khóa chủ trọ, thuộc AC-5): người tìm trọ gửi được 201, chủ trọ trả lời được 201, đọc lịch sử được, `isPublic` false, tiêu đề, mã và giá còn đủ; tin xóa mềm vẫn nhắn được hai chiều → AC-9

AC-12, giới hạn tần suất (server vừa khởi động lại để bộ đếm về 0):
- [ ] 20 lần mở trong một giờ → 201, lần 21 → 429 `RATE_LIMITED` kèm `Retry-After` là số nguyên trong 1 đến 3600; người dùng khác không bị ảnh hưởng → AC-12
- [ ] 30 lần gửi trong một phút (route mở đã hết lượt vẫn gửi được) → 201, lần 31 → 429 kèm `Retry-After` từ 1 đến 60 → AC-12
- [ ] 120 lần `GET /conversations/:id` trong một phút → 200, lần 121 → 429; trong lúc đó `GET /me/conversations` và `GET /conversations/:id/messages` vẫn 200 (mỗi route đếm riêng) → AC-12

AC-13, ràng buộc ở DB (INSERT thẳng bằng SQL, mỗi ca bị từ chối đúng ràng buộc):
- [ ] Trùng (`listing_id`, `tenant_id`); `tenant_id` bằng `landlord_id`; `last_seq` âm; mốc người nhắn hoặc mốc chủ trọ lớn hơn `last_seq`; mốc chủ trọ âm; tin, người nhắn, chủ trọ không tồn tại; thiếu `last_message_at`; tin nhắn `seq` 0 và âm; `body` rỗng; `body` 1001 ký tự; trùng (`conversation_id`, `seq`); cuộc trò chuyện và người gửi không tồn tại → mỗi ca bị từ chối bởi đúng ràng buộc đã đặt tên (`conversations_listing_id_tenant_id_unique`, `conversations_tenant_landlord_check`, `conversations_seq_check`, `messages_seq_check`, `messages_body_check`, `messages_conversation_id_seq_unique`, các khóa ngoại) → AC-13
- [ ] Xóa người dùng, tin hay cuộc trò chuyện đang được tham chiếu → bị từ chối (RESTRICT, mã SQLSTATE `23001`) → AC-13
- [ ] Đối chứng: một cuộc trò chuyện hợp lệ kèm tin 1000 ký tự chèn được (trong giao dịch rồi hủy) → các lần từ chối trên là do đúng ràng buộc → AC-13

Bất biến toàn bảng sau mọi bước:
- [ ] Số tin bằng `last_seq`; `seq` mỗi cuộc trò chuyện chạy 1 đến `last_seq` không hở; hai mốc nằm trong 0 đến `last_seq`; người gửi luôn là một trong hai bên; `landlord_id` luôn là chủ trọ của nhà trọ chứa tin; mốc của mỗi bên bằng `seq` lớn nhất bên đó đã gửi (ở mốc 1; từ mốc 2 route `read` còn dời mốc lên, nên chỉ còn đúng là "không nhỏ hơn", xem phần mốc 2); `last_message_at` khớp tin cuối trong 1 ms; `createdAt` của tin tăng theo `seq` → AC-3, AC-13
- [ ] Nhật ký server sau toàn bộ lần chạy không chứa nội dung tin nhắn (dấu riêng của lần chạy) và không chứa mật khẩu → Security model

## Value sourcing (mỗi giá trị có nguồn, vary đầu vào để bắt nguồn sai)
- [ ] `tenant_id` và `sender_id` chỉ lấy từ token: gửi `tenantId` trong body bị 400; hai tài khoản khác nhau mở cùng tin ra hai cuộc trò chuyện khác nhau → AC-1
- [ ] `landlord_id` chép từ nhà trọ của tin: bằng chủ trọ của `properties` chứa tin ở mọi dòng (kiểm bằng SQL nối `listings`, `properties`) → AC-1
- [ ] `isPublic` dùng đúng hai mảnh SQL công khai: lặp lại toàn bộ phép kiểm dưới ba múi giờ phiên của database (`America/Los_Angeles`, `Asia/Ho_Chi_Minh`, `Pacific/Kiritimati`) → cùng kết quả 433 kiểm tra → AC-7, AC-9
- [ ] `isMine` theo `sender_id` và người gọi: cùng một tin, hai người đọc thấy giá trị đảo nhau → AC-3, AC-6
- [ ] `seq` và giờ lấy từ chính câu lệnh khóa hàng: tin `seq` n+1 không bao giờ có `createdAt` nhỏ hơn tin `seq` n kể cả khi 20 giao dịch chạy đồng thời → AC-3

## Điều khiển âm (phá cố ý một chỗ trong `dist`, chạy lại phép kiểm, rồi trả về)
Chín điều khiển, mỗi cái phải làm ít nhất một kiểm tra hỏng. Đã chạy cả chín, đều bị bắt:
- [ ] Bỏ tính `seq` trong câu khóa hàng (đọc `max(seq)+1` từ bảng tin) → 7 kiểm tra hỏng, thấy 500 và `seq` trùng ở phần gửi đồng thời → AC-3
- [ ] Bỏ điều kiện "người gọi là một trong hai bên" trong truy vấn → 16 kiểm tra hỏng, người ngoài đọc được chi tiết và tin nhắn → AC-8. Lần đầu tôi thử thay bằng `OR: [..., {}]` thì **không** hỏng gì (Prisma không coi `{}` là "khớp hết"), nên điều khiển đó vô nghĩa; đổi sang xóa hẳn dòng điều kiện mới có hiệu lực
- [ ] Bỏ kiểm admin → 12 kiểm tra hỏng → AC-8
- [ ] Bỏ điều kiện hiển thị công khai khi tính `isPublic` (coi mọi tin là công khai) → 11 kiểm tra hỏng → AC-7, AC-9
- [ ] Bỏ kiểm tin đang hiện khi mở → 16 kiểm tra hỏng → AC-2
- [ ] Bỏ kiểm tự nhắn cho mình → 1 kiểm tra hỏng: thành 500 thay vì 409 (CHECK `conversations_tenant_landlord_check` ở DB vẫn chặn, không ghi dòng) → AC-2, AC-13
- [ ] Bỏ kiểm người kia bị khóa → 11 kiểm tra hỏng → AC-5
- [ ] Gửi tin không dời mốc đã đọc của người gửi → 3 kiểm tra hỏng → AC-3
- [ ] Bỏ hàng dư `limit + 1` của `hasMore` → 9 kiểm tra hỏng → AC-6

## Acceptance-criteria coverage
- AC-1 … mở và gọi lại, hai tin khác nhau, 20 lần mở đồng thời, mở lẫn gửi đồng thời · AC-2 … bảy trạng thái tin, id sai, tự nhắn cho mình · AC-3 … trả lời, 20 lần gửi đồng thời, mốc đã đọc · AC-4 … 12 ca sai và 7 ca đúng ở hai route · AC-5 … khóa, xóa mềm, mở khóa ở cả hai phía · AC-6 … 16 cửa sổ, 15 tham số sai, đi ngược và đi xuôi · AC-7 … hộp thư của ba loại người dùng, phân trang, lọc, `isPublic` · AC-8 … khách, chủ trọ, admin, người ngoài, id sai · AC-9 … sáu trạng thái, hai chiều nhắn · AC-12 … ba nhóm giới hạn, từng route đếm riêng · AC-13 … 20 ca INSERT thẳng, RESTRICT, đối chứng
- AC-10 … `unreadCount` và `unread-count` qua nhiều bước gửi, đánh dấu, hai vai trò, khớp dòng thô sau mọi bước · AC-11 … kẹp, không lùi, lặp, đua, quyền, khóa, tin đổi, 9 ca body sai · AC-12 (hai route mới) … 120 lần mỗi phút, đếm riêng từng route. Chi tiết ở phần mốc 2 ngay dưới. `EXPLAIN` (hộp thư 5 nghìn cuộc trò chuyện, đọc 50 nghìn tin, `unread-count`) đã đo, số ở phần mốc 2.

## Mốc 2: chưa đọc và đánh dấu đã đọc · AC-10, AC-11, AC-12 · 2026-11-05
_Mọi con số "đã chạy" trong phần này là của lần build mốc 2 ngày 2026-11-05, trên database thử `rental_management_verify` (không phải database dev), API cổng 3055, bằng script Node gọi HTTP thật cộng SQL đối chiếu. Phép đối chiếu cho `unreadCount` **đếm lại từ dòng thô** của bảng `messages` (số tin của bên kia có `seq` lớn hơn mốc của người gọi), không dùng phép trừ `last_seq` của code. Mốc 2 không có migration mới (không đổi schema)._

### Commands (mốc 2)
- [ ] `npx tsc --noEmit` và `npx eslint "{src,apps,libs,test}/**/*.ts"` → sạch (đã chạy: sạch) → mọi AC
- [ ] `npm test` → toàn bộ qua (đã chạy: 86 bộ, 1846 bài, mốc 2 thêm 46 bài trong `chat.service.spec.ts`, `chat.repository.spec.ts`, `chat.mapper.spec.ts`, `chat.controller.spec.ts`, `dto/chat-dtos.spec.ts`) → AC-10, AC-11, AC-12
- [ ] Newman với mọi folder trừ 02, 06, 23, 24 của `docs/api/postman-collection.json`, có `--working-dir docs/api`, trên database trống mới seed → 22 folder, 671 request, 1455 assertion, 0 lỗi (đã chạy hai lần liền trên cùng database, khởi động lại server giữa hai lần); folder 25 giờ có 79 request (thêm 19 cho mốc 2, cộng các dòng kiểm `unreadCount` vào request cũ) → AC-10, AC-11

### UI / manual (mốc 2, Postman folder `25 Chat giữa người tìm trọ và chủ trọ`, hoặc gọi API)

AC-10, `unreadCount` và `GET /me/conversations/unread-count`:
- [ ] Người tìm trọ T1 mở tin A → 201, `conversation.unreadCount` là số nguyên 0; chủ trọ L1 `GET /conversations/:id` thấy `unreadCount` 1 và hộp thư của L1 thấy 1 ở phần tử; `unread-count`: T1 `{0, 0}`, L1 `{1, 1}`, người chưa có cuộc nào `{0, 0}`; `Cache-Control: private, no-store` → AC-10 (đã chạy: đạt)
- [ ] Mọi `GET` (tin nhắn, chi tiết, hộp thư, `unread-count`) của cả hai bên không đổi `last_seq`, hai mốc, `last_message_at` (so cả bảng `conversations` trước và sau) → AC-10, AC-11 (đã chạy: đạt)
- [ ] L1 gửi 2 tin → L1 `unreadCount` 0 (tin của chính mình không tính), T1 thấy 2 và `unread-count` `{1, 2}`; T1 gửi 3 tin → T1 0, L1 thấy 3; DB `last_seq` 6, mốc người nhắn 6, mốc chủ trọ 3 → AC-10 (đã chạy: đạt)
- [ ] Bốn cuộc của L1 làm chủ trọ (3, 1, 2, 1 tin chưa đọc) → `unread-count` `{4, 7}`; L1 cũng làm người nhắn ở một cuộc của L2 (admin cấp `conversation:create`): tin L1 tự gửi không đổi `{4, 7}`; L2 trả lời 3 tin → L1 `{5, 10}` (cuộc vai người nhắn đọc `tenant_read_seq`, cuộc vai chủ trọ đọc `landlord_read_seq`, mỗi cuộc đúng một lần) → AC-10 (đã chạy: đạt)
- [ ] Sau mỗi bước, cho cả 5 người: `unreadCount` ở hộp thư, ở `GET /conversations/:id` và hai số của `unread-count` đều bằng phép tính độc lập từ dòng thô → AC-10 (đã chạy: đạt)
- [ ] Không phản hồi nào có tên cột mốc đã đọc, số điện thoại hay email; hộp thư L1 có 5 cuộc (4 vai chủ trọ, 1 vai người nhắn), mỗi phần tử có `unreadCount` → AC-8, AC-10 (đã chạy: đạt)

AC-11, `POST /conversations/:id/read`:
- [ ] L1 `read` với `upToSeq` 5 trên cuộc có 6 tin → 200 (không phải 201), `unreadCount` 1, `myRole` `landlord`, đúng tám khóa, `Cache-Control: private, no-store`; DB mốc chủ trọ 5, mốc người nhắn vẫn 6, `last_seq` và `last_message_at` không đổi, số tin không đổi; phản hồi bằng đúng `GET /conversations/:id` ngay sau đó → AC-11 (đã chạy: đạt)
- [ ] Gọi lặp cùng giá trị → 200 cùng kết quả; `upToSeq` 2 và 0 (nhỏ hơn mốc cũ) → 200, mốc vẫn 5 → AC-11 (đã chạy: đạt)
- [ ] FE nhìn tới seq 6 rồi T1 gửi thêm seq 7 và 8: `read` 6 → mốc 6, `unreadCount` 2 (tin đến sau vẫn chưa đọc) → AC-11 (đã chạy: đạt)
- [ ] `upToSeq` 9, 100, 2147483647 trên cuộc 8 tin → 200, mốc kẹp đúng 8 (không vượt `last_seq`), `unreadCount` 0 → AC-11 (đã chạy: đạt)
- [ ] Người nhắn đánh dấu: dời `tenant_read_seq`, không đụng `landlord_read_seq`; L1 ở vai người nhắn của cuộc khác dời `tenant_read_seq` của cuộc đó → AC-11 (đã chạy: đạt)
- [ ] Có tin mới sau khi đã đọc hết → `unreadCount` về 1 → AC-10 (đã chạy: đạt)
- [ ] Lỗi, mỗi ca không ghi dòng nào: khách `read` và `unread-count` → 401 `TOKEN_MISSING`; admin → 403 `PERMISSION_DENIED`; admin gửi id sai → 400 `INVALID_ID`, `upToSeq` sai → 400 `VALIDATION_FAILED` (pipe chạy trước Service); người ngoài (người tìm trọ khác, chủ trọ khác) → 404 `CONVERSATION_NOT_FOUND` cùng status, mã và `message` với id không có; `:id` là `abc` → 400 `INVALID_ID` → AC-8, AC-11 (đã chạy: đạt)
- [ ] Body sai, mỗi ca 400 `VALIDATION_FAILED` kèm `upToSeq`: thiếu, âm, 1.5, chuỗi `"3"`, `null`, 2147483648, mảng, boolean, chữ; trường lạ `landlordReadSeq` và `lastSeq` → 400 kèm đúng hai trường đó; không gửi body → 400; JSON hỏng → 400 chứ không 500 → AC-11 (đã chạy: đạt)
- [ ] Quyền: gỡ `conversation:update` của `landlord`, đăng nhập lại → `read` 403 `PERMISSION_DENIED`, `unread-count` vẫn 200, `tenant` vẫn 200; gỡ `conversation:read` → `unread-count` 403; khôi phục → `read` lại 200. **Token cũ vẫn mang quyền cũ** (hai route mới không `@FreshAuth`, theo quyền trong token như các route đọc khác), nên đổi quyền chỉ có hiệu lực sau lần đăng nhập hay refresh kế tiếp → AC-8 (đã chạy: đạt, kể cả ca token cũ còn quyền)
- [ ] Tài khoản bị khóa (AC-5): khóa chủ trọ → người kia `read` 200; chính chủ trọ bị khóa (token còn hạn) `read` và `unread-count` vẫn 200 → AC-5, AC-11 (đã chạy: đạt)
- [ ] Tin đổi trạng thái (AC-9): xóa mềm tin A rồi `read` → 200, `isPublic` `false`, `coverImageUrl` `null`, `unread-count` vẫn khớp dòng thô → AC-9, AC-11 (đã chạy: đạt)

Đua (mốc không bao giờ vượt `last_seq`, không có 5xx):
- [ ] 20 vòng: người nhắn gửi cùng lúc với 3 lần chủ trọ `read` (hai lần với số lớn nhất) → mọi phản hồi 200 hoặc 201, mốc không vượt `last_seq`, `seq` từ 1 đến `last_seq` không hở → AC-11 (đã chạy: đạt)
- [ ] 20 lần `read` đồng thời với giá trị trộn → mốc cuối đúng bằng `max(mốc cũ, min(giá trị lớn nhất, last_seq))` → AC-11 (đã chạy: đạt)
- [ ] Chính người nhắn vừa gửi vừa `read` với số nhỏ (6 vòng) → mốc người nhắn bằng `last_seq` (`read` không kéo lùi mốc mà việc gửi vừa dời), `unreadCount` 0 → AC-3, AC-11 (đã chạy: đạt)

AC-12, hai route mới (server vừa khởi động lại để bộ đếm về 0):
- [ ] 120 lần `GET /me/conversations/unread-count` → 200, lần 121 → 429 `RATE_LIMITED` kèm `Retry-After` nguyên trong 1 đến 60; người dùng khác vẫn 200; `GET /me/conversations` và `POST read` vẫn 200 (mỗi route đếm riêng); 120 lần `POST read` → 200, lần 121 → 429; `GET /conversations/:id` vẫn 200 → AC-12 (đã chạy: đạt)

Bất biến toàn bảng sau mọi bước (mốc 2):
- [ ] `last_seq` bằng số tin; hai mốc nằm trong 0 đến `last_seq` và không bao giờ lùi giữa hai bước (kiểm sau từng bước); mốc mỗi bên không nhỏ hơn `seq` lớn nhất bên đó đã gửi; nhật ký server không chứa nội dung tin nhắn (dấu riêng của lần chạy) và không chứa mật khẩu → AC-3, AC-10, AC-11 (đã chạy: 219 kiểm tra, 0 hỏng)

### Value sourcing (mốc 2)
- [ ] `unreadCount` = `last_seq` trừ mốc của người gọi, cột chọn theo `myRole`: cùng một cuộc, hai người thấy hai số khác nhau; đọc nhầm cột của bên kia làm 65 kiểm tra hỏng (điều khiển 4) → AC-10
- [ ] `unread-count` gom theo người gọi từ hai nhánh (là người nhắn, là chủ trọ): người vừa làm chủ trọ vừa làm người nhắn không bị đếm đôi hay gộp số bằng nhau (điều khiển 5 và 6) → AC-10
- [ ] Mốc mới = `GREATEST(mốc cũ, LEAST(upToSeq, last_seq))` với `upToSeq` từ body → AC-11

### Điều khiển âm (mốc 2)
Phá cố ý một chỗ trong `dist` trên database vừa reset, chạy lại toàn bộ phép kiểm thật, rồi trả về. Mỗi điều khiển phải làm ít nhất một kiểm tra hỏng. Đã chạy cả chín, đều bị bắt (kèm bài học: mỗi điều khiển đều đổi hành vi thật, không phải đổi cú pháp):
- [ ] Bỏ `GREATEST` (mốc có thể lùi) → 9 kiểm tra hỏng (`upToSeq` nhỏ hơn mốc cũ làm mốc lùi, phép theo dõi "mốc không lùi", mốc cuối của đua `read` trộn) → AC-11
- [ ] Bỏ `LEAST` (mốc có thể vượt `last_seq`) → 31 kiểm tra hỏng; DB từ chối bằng `conversations_seq_check` nên route trả 500, tức bất biến ở DB vẫn giữ → AC-11, AC-13
- [ ] `unreadCount` không trừ mốc (đếm cả tin của chính mình) → 72 kiểm tra hỏng → AC-10
- [ ] `unreadCount` đọc nhầm cột mốc của bên kia → 65 kiểm tra hỏng → AC-10
- [ ] `unread-count` dùng `UNION` thay `UNION ALL` (gộp các số bằng nhau thành một) → 11 kiểm tra hỏng → AC-10
- [ ] `unread-count` bỏ nhánh chủ trọ → 13 kiểm tra hỏng → AC-10
- [ ] `read` bỏ điều kiện "người gọi là một trong hai bên" → 12 kiểm tra hỏng (người ngoài đổi được mốc) → AC-8, AC-11
- [ ] `read` bỏ kiểm admin → 1 kiểm tra hỏng (admin nhận 404 thay vì 403) → AC-8
- [ ] `unread-count` bỏ kiểm admin → 1 kiểm tra hỏng (admin nhận 200 thay vì 403) → AC-8

### EXPLAIN (đo một lần, không chỉnh; AC-6, AC-7, AC-10)
Đo trên database thử sau khi dựng 5 nghìn người tìm trọ, 5 nghìn cuộc trò chuyện của một chủ trọ (3 tin mỗi cuộc) và một cuộc 50 nghìn tin (tổng 5.003 cuộc của chủ trọ đó, 65.014 tin), rồi `ANALYZE`, `EXPLAIN (ANALYZE, BUFFERS)`, dữ liệu nằm sẵn trong bộ nhớ đệm. Dữ liệu đo đã xóa sau khi đo.
- [ ] Hộp thư của chủ trọ có 5.003 cuộc: trang 1 (20 dòng) **0,525 ms**, 78 buffer; trang cuối (`OFFSET` 4980) **1,195 ms**; đếm `total` **0,448 ms**; tin cuối của 20 cuộc (`findLastMessages`) **0,192 ms**, `BitmapOr` trên `messages_conversation_id_seq_unique`. Planner chọn `Seq Scan` trên `conversations` vì chủ trọ này giữ 5.003 trên 5.008 dòng của bảng (bảng chỉ 78 trang), nên số này **không** cho biết chỉ mục `conversations_landlord_id_last_message_at_idx` chạy nhanh cỡ nào; bảng nhiều người dùng thì chưa đo → AC-7
- [ ] Đọc tin của cuộc 50 nghìn tin: 31 tin mới nhất **0,018 ms** (4 buffer), `afterSeq` 49000 **0,019 ms** (6 buffer), `beforeSeq` 25000 **0,018 ms** (4 buffer); cả ba là `Index Scan` trên `messages_conversation_id_seq_unique`, không phụ thuộc số tin → AC-6
- [ ] `unread-count`: chủ trọ có 5.003 cuộc **0,803 ms** (80 buffer, `Seq Scan` nhánh chủ trọ, nhánh người nhắn `Index Scan` 0 dòng); người có 1 cuộc **0,018 ms** (hai `Index Scan`) → AC-10
- [ ] Hai câu `UPDATE` của `read` (người gọi là chủ trọ): bên người nhắn khớp 0 hàng **0,034 ms**, bên chủ trọ khớp 1 hàng **0,052 ms** (`conversations_pkey`) → AC-11
- Kết luận ghi lại: tất cả dưới 1,3 ms ở cỡ này, nên không chỉnh gì (bản demo, theo spec).

## Cách chạy lại (script không nằm trong repo)
1. `npm run build`, rồi đặt database thử về sạch (`DROP SCHEMA public CASCADE; CREATE SCHEMA public`), `npx prisma migrate deploy`, `node dist/database/seed.js`, với `DATABASE_NAME` trỏ vào database thử và cổng khác cổng dev.
2. Khởi động `node dist/main`; script đăng ký 3 chủ trọ và 5 người tìm trọ (dưới giới hạn 10 lần đăng ký mỗi giờ), đăng nhập admin một lần, tự khởi động lại server ở bốn chỗ để đặt lại bộ đếm tần suất (trước phần đọc tin, người kia bị khóa, đồng thời, giới hạn tần suất).
3. Tạo tin cần ảnh nên dùng `docs/api/sample-listing.png` qua `multipart/form-data` (spec 0011).
4. Quyền chat mặc định trong database phải đúng bốn khóa cho `tenant` và ba cho `landlord`; folder 03 của Postman đặt lại danh sách quyền của `tenant`, nên danh sách khôi phục của folder đó đã được thêm bốn khóa chat.
5. Mốc 2 dùng ba script cùng thư mục tạm của phiên (cũng không nằm trong repo): `verify-m2.js` (219 kiểm tra, dùng lại `chat-lib.js`), `control-m2.js` (chín điều khiển âm: mỗi cái đặt lại database, vá `dist`, chạy `verify-m2.js`, rồi trả `dist` về) và `explain-m2.js` (dựng dữ liệu lớn, `EXPLAIN`, rồi dọn). Folder 25 của Postman được dựng lại từ một script sinh, chạy lại được. Bài học khi viết phép kiểm quyền: chỉ route `@FreshAuth` đọc lại quyền từ database, nên sau khi đổi quyền của loại tài khoản phải đăng nhập lại mới thấy hiệu lực ở các route đọc.
