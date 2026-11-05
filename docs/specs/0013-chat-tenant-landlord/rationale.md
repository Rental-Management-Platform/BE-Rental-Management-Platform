# 0013. Chat giữa người tìm trọ và chủ trọ: lý giải

Bản ghi quyết định của [index.md](index.md). `/develop` không đọc file này khi build.

## Context

Hiện người xem một tin trọ chỉ thấy tên chủ trọ; muốn hỏi phòng còn trống không, giá có bớt không, thì phải lấy số điện thoại (khách đăng nhập mới thấy) và gọi điện ngoài hệ thống. Ngày 2026-11-05 bạn yêu cầu một phần chat ngay trên tin: người dùng lướt thấy tin thì nhắn được cho chủ trọ của tin đó, bắt buộc đăng nhập, chủ trọ nhận và trả lời, hai bên xem lại được các cuộc trò chuyện của mình.

Các lực tác động:
- **Bản demo, không chạy thật** (bạn đã nói hai lần, 2026-10-11 và 2026-10-19). Một cái gì cần máy chủ có trạng thái, hay kênh kết nối giữ lâu, thêm hạ tầng và thêm chỗ hỏng mà demo không cần.
- **Hạ tầng hiện có đơn giản và một tiến trình**: NestJS, Prisma 7 với Postgres, JWT access token sống 15 phút kèm refresh token trong cookie, bộ giới hạn tần suất nằm trong bộ nhớ, không việc chạy nền, không hàng đợi. FE là Next.js ở repo khác.
- **Mọi tính năng đều đi qua cùng bộ quy tắc**: quyền theo module trong `permission-catalog.ts`, admin giữ `manage` mọi module nên phải chặn riêng trong Service, tin chỉ "công khai" khi qua luật hiển thị ở spec 0003 và 0004, và tài liệu API cho FE phải luôn khớp.
- **Dữ liệu riêng của hai người**: nội dung tin nhắn không được lộ cho người thứ ba, và người chưa đăng nhập không được gửi hay đọc.
- **Điểm chưa chốt trong scope hàng 20**: chat thời gian thực hay không, cuộc trò chuyện gắn với tin hay với chủ trọ, ai được bắt đầu, có giới hạn lượt nhắn không. Mục hoãn "liên hệ chủ trọ có giới hạn mỗi ngày" là chuyện gần nhất.

Không quyết thì FE phải tự dựng ô nhắn tin giả hoặc đẩy người dùng ra Zalo ngoài hệ thống, và hàng 20 vẫn là `needs a decision`.

## Options considered

### Option 1: Hai bảng, một cuộc trò chuyện cho mỗi cặp (tin, người nhắn), `seq` theo cuộc trò chuyện, FE hỏi lại bằng REST

Một hàng `conversations` giữ người nhắn, chủ trọ, tin, bộ đếm `last_seq` và mốc đã đọc của mỗi bên; `messages` giữ từng tin với `seq`. FE gọi `GET .../messages?afterSeq=N` vài giây một lần. Chỉ người tìm trọ mở được cuộc trò chuyện, chỉ chữ, không sửa không xóa.

**Pros**:
- Không thêm thư viện, biến môi trường hay việc chạy nền; mọi thứ nằm trong khuôn của các spec trước.
- Kiểm bằng script gọi thật và Newman như mọi tính năng khác.
- `seq` cho thứ tự chính xác, hỏi "có gì mới" bằng một số nguyên và đếm chưa đọc bằng phép trừ.
- Đường nâng cấp rõ: thêm kênh đẩy sau này không đổi dữ liệu hay route.

**Cons**:
- Không tức thì: tin đến chậm đúng bằng chu kỳ hỏi lại của FE.
- Tốn request khi nhiều người mở trang cùng lúc; không có cách báo cho người đang tắt trang.

### Option 2: Một cuộc trò chuyện cho mỗi cặp (người nhắn, chủ trọ), tin nhắn gắn nhãn tin

Hộp thư của chủ trọ là một dòng cho mỗi người đã nhắn, kiểu Messenger; mỗi tin nhắn mang `listing_id` tùy chọn để biết đang hỏi phòng nào.

**Pros**:
- Hộp thư gọn hơn: một dòng cho mỗi người, không nhân lên theo số phòng người đó hỏi.
- Ít hàng `conversations`.

**Cons**:
- Mất ngữ cảnh: "phòng còn không?" phải kèm nhãn tin ở từng tin nhắn, và giao diện phải tự nhóm lại.
- Không rõ khi người hỏi chưa chọn tin nào (nhắn từ hồ sơ chủ trọ) nên cần quy tắc cho nhãn rỗng.
- Hạ tầng hiển thị tin (ảnh, giá, còn hay không) phải gắn vào từng tin nhắn thay vì vào cuộc trò chuyện.

### Option 3: Kênh WebSocket (Socket.IO) trên cùng hai bảng

Cùng mô hình dữ liệu, nhưng gửi và nhận qua một cổng WebSocket, có thể thêm trạng thái đang gõ và trực tuyến.

**Pros**:
- Cảm giác chat thật, tin đến ngay.
- Là hướng đi quen thuộc khi sản phẩm lớn lên.

**Cons**:
- Thêm thư viện và một lớp kết nối giữ lâu; xác thực khi bắt tay với access token 15 phút phải có cách xử lý hết hạn giữa chừng.
- Bộ giới hạn tần suất, `@FreshAuth`, quy tắc quyền và thứ tự lỗi hiện có không áp lên cổng này mà phải làm lại.
- Script gọi thật, Newman và Postman không kiểm được; chưa có bộ e2e cho nó.
- Nhiều tiến trình sau này cần thêm tầng phát tin giữa các tiến trình; với demo thì chỉ là chi phí.

## Decision

Xem [index.md](index.md), mục Decision: Option 1.

## Rationale

Option 1 vì các lực của bản demo này chỉ nghiêng về nó. Hàng 20 cần cái chat chạy được và kiểm được; không cần cảm giác tức thì. Hạ tầng một tiến trình, không việc nền và không thư viện mới là điều bạn đã giữ suốt các hàng trước, nên một lớp kết nối giữ lâu (Option 3) mua tính năng không ai yêu cầu bằng chi phí và rủi ro lớn nhất, và nó là thứ duy nhất trong ba phương án mà bộ kiểm hiện có không chạm tới. Lựa chọn của bạn khớp: tin nhắn lưu trong DB, FE hỏi lại.

Gắn cuộc trò chuyện vào (tin, người nhắn) thay vì (người nhắn, chủ trọ) vì câu hỏi trong thuê trọ gần như luôn về một phòng cụ thể. Chủ trọ có nhiều phòng nên ngữ cảnh là thứ họ cần nhất khi mở hộp thư, và gắn vào tin còn cho FE hiện đúng tin (tên, giá, ảnh, còn mở không) mà không phải lưu gì thêm. Cái giá là hộp thư dài hơn khi một người hỏi nhiều phòng, nên chấp nhận.

Cho riêng người tìm trọ mở cuộc trò chuyện (chủ trọ chỉ trả lời) vì đó đúng là luồng bạn mô tả và nó chặn chủ trọ nhắn tràn người lạ. Cho quyền này đi qua danh mục quyền (`conversation:create`) thay vì viết cứng loại tài khoản, để bạn đổi bằng API quyền sau này mà không sửa code.

`seq` theo cuộc trò chuyện thay vì dùng `id` uuidv7 và thời gian: thứ tự chính xác khi hai bên gửi cùng lúc (hàng bị khóa trong câu cập nhật), một số nguyên để hỏi "sau N", và `unreadCount` thành phép trừ. Ghép với việc gửi tin dời mốc của chính mình, không bao giờ cần `COUNT` trên bảng tin nhắn.

**Kiểm tiền đề.** Không có vấn đề cần nêu: yêu cầu đúng cỡ, không đòi hạ tầng mới, và mọi tiền đề (đăng nhập, quyền, luật hiển thị tin) đã có spec. Rủi ro lớn nhất của sản phẩm không phải kỹ thuật mà là thông báo: không có email hay đẩy thì chủ trọ có thể không thấy tin trong nhiều ngày. Đã ghi ở Consequences và Follow-up.

### Các quyết định do spec chốt (mục RECOMMEND)

| Quyết định | Chọn | Vì sao | Phương án kế |
|---|---|---|---|
| Mở cuộc trò chuyện | lấy hoặc tạo rồi thêm tin, luôn 201, không có cuộc trò chuyện rỗng | FE không phải kiểm trước; hai tab bấm cùng lúc cho một cuộc trò chuyện nhờ khóa duy nhất | trả 409 và id cũ, bắt FE tìm trước |
| Cách khóa khi gửi | một câu `UPDATE ... RETURNING` khóa hàng cuộc trò chuyện, không `SELECT FOR UPDATE` riêng | ít câu lệnh hơn, cùng kết quả: `seq` liên tiếp, không hở | khóa hàng bằng `SELECT FOR UPDATE` trước |
| Gửi dời mốc của chính mình | có, tới `seq` mới | biến chưa đọc thành phép trừ, không cần đếm hàng | chỉ dời khi không còn tin chưa xem, rồi phải đếm hàng |
| Người không phải hai bên | 404 `CONVERSATION_NOT_FOUND`, không 403 | không cho ai dò được id có tồn tại; cùng tinh thần `LISTING_NOT_FOUND` | 403 |
| Mở vào tin của chính mình | 409 `CANNOT_CHAT_WITH_SELF` | chỉ xảy ra khi admin cấp quyền cho chủ trọ; giống `CANNOT_FOLLOW_SELF` | cho phép |
| Người kia bị khóa hoặc xóa | đọc được, gửi bị 409 `CHAT_PEER_UNAVAILABLE` (bạn chọn) | tin không rơi vào chỗ không ai đọc | ẩn cuộc trò chuyện |
| Kiểm tài khoản trực tiếp | `@FreshAuth` ở hai route gửi (bạn chọn) | tài khoản bị khóa vì spam dừng ngay | theo token 15 phút như các route khác |
| Cách đọc tin | con trỏ `afterSeq` và `beforeSeq`, `limit` 30 mặc định, tối đa 100 (bạn chọn kiểu con trỏ) | trang theo số bị lệch khi có tin mới | `page` và `pageSize` |
| Đánh dấu đã đọc | route riêng với `upToSeq`, kẹp và không lùi (bạn chọn) | tab ẩn hỏi lại không xóa chưa đọc; `GET` không đổi dữ liệu | đọc là tự đánh dấu |
| Số chưa đọc cho cái chuông | route nhỏ `unread-count` (bạn chọn) | hỏi thường xuyên mà không tải cả hộp thư | nhét vào hộp thư |
| Quyền mặc định | tenant có cả bốn khóa; landlord thiếu `conversation:create` | khớp "chỉ người tìm trọ mở" mà vẫn chỉnh được bằng API | tách khóa mở thành loại tài khoản cứng |
| Cỡ giới hạn đọc | 120 lần mỗi phút mỗi route, theo người dùng | đủ cho FE hỏi lại vài giây một lần ở mỗi route (tối đa hai lần mỗi giây); đếm theo người dùng vì mọi route cần đăng nhập | 60 mỗi phút |
| Số ký tự | 1 đến 1000 (bạn chọn); đếm bằng độ dài chuỗi JS, chặt hơn `char_length` | DB không bao giờ bị vi phạm bởi biểu tượng cảm xúc | đếm theo điểm mã |
| Ký tự NUL | từ chối | Postgres không lưu được NUL trong `text`, nếu lọt là lỗi 500 | bỏ qua, chờ bắt lỗi DB |
| Phần tử hộp thư | tin nhắn cuối đủ nội dung, `isPublic`, `coverImageUrl` rỗng khi không công khai | FE không phải cắt hay gọi thêm; `/media/public` chỉ phát ảnh tin đang hiện nên không đưa đường dẫn sẽ 404 | cắt sẵn bản xem trước ở backend |
| Người kia trong phản hồi | chỉ `id` và `name` | chat không phải đường lộ số điện thoại hay email; số điện thoại chủ trọ đã có ở chi tiết tin cho người đăng nhập | thêm số điện thoại |
| Cache | `Cache-Control: private, no-store` ở mọi route chat | riêng tư và đổi liên tục | không đặt |
| Thông báo email khi có cuộc trò chuyện mới | không (bạn chọn) | gửi trong request thêm độ trễ và chỗ hỏng; bản đúng cần việc nền | gửi email lần đầu của cuộc trò chuyện |
| Chống gửi trùng | không (bạn chọn); FE khóa nút | cùng quyết định với đăng tin ở spec 0011; trùng trong chat rõ ràng và vô hại | `clientMessageId` duy nhất theo cuộc trò chuyện |
| Cách đo hiệu năng | `EXPLAIN` một lần, ghi số, không chỉnh | bạn đã chốt cách này cho bản MVP | đặt ngân sách |

### Nhật ký trả lời của bạn (2026-11-05)

Tất cả theo đề xuất của spec, không đổi gì: một cuộc trò chuyện cho mỗi cặp (tin, người nhắn); tin nhắn lưu trong DB, FE hỏi lại; chỉ người tìm trọ mở, chủ trọ trả lời; chỉ chữ; có mốc đã đọc và đếm chưa đọc; cuộc trò chuyện sống tiếp khi tin biến khỏi công khai, chỉ mở mới cần tin công khai; chỉ giới hạn tần suất (20 cuộc trò chuyện mới mỗi giờ, 30 tin mỗi phút); không sửa, không xóa; hai bảng; `seq` theo cuộc trò chuyện; `tenant_id` và `landlord_id` lưu trên hàng; tối đa 1000 ký tự; mô hình dữ liệu xác nhận không đổi; lấy hoặc tạo rồi thêm tin; con trỏ `seq`; `unread-count` riêng; đánh dấu đã đọc bằng route riêng; bộ quyền `conversation` và `message`; admin bị chặn mọi route chat; người kia bị khóa thì đọc được nhưng không gửi được; kiểm tài khoản trực tiếp ở hai route gửi; không email; không chống gửi trùng; thông tin cuộc trò chuyện gồm tin (id, mã, tiêu đề, giá, ảnh bìa, `isPublic`) và người kia (id, tên); không có mục References.
