# 0014. Đánh giá chủ trọ trên hồ sơ công khai: lý giải

Spec build nằm ở [index.md](index.md). File này giữ phần lý do, chỉ người và `/architect` đọc, `/develop` bỏ qua.

## Context

> ⚠️ Premise note: điều kiện viết đánh giá của spec này là "đã nhắn và được chủ trọ trả lời", tức là bằng chứng đã liên hệ, không phải bằng chứng đã thuê trọ; dự án chưa có hợp đồng thuê, lượt xem phòng hay lịch hẹn để làm bằng chứng mạnh hơn. Hệ quả là một chủ trọ có thể tự lập tài khoản người tìm trọ, nhắn cho chính mình và chấm 5 sao, vì ràng buộc số điện thoại duy nhất chỉ áp cho tài khoản chủ trọ. Với bản demo thì chấp nhận được; nếu chạy thật thì cần thêm chống đánh giá giả (xem Follow-up). Spec nêu rõ điều này thay vì giả vờ chat là bằng chứng ở trọ.

Mô hình kinh doanh của dự án dựa vào lòng tin quanh tài khoản chủ trọ: số người theo dõi và lượt xem tích lũy (spec 0005) để chủ trọ ở lại và mua gói. Hồ sơ công khai hiện chỉ có các con số đó, người xem chưa đọc được lời của người đã từng liên hệ. Theo câu hỏi của bạn ngày 2026-11-07, người xem muốn thấy các đánh giá trọ ngay trên hồ sơ, cạnh tin và nút theo dõi.

Những thứ đã có để dựng lên: chat giữa người tìm trọ và chủ trọ với hai bảng bất biến (spec 0013), hồ sơ công khai và danh sách tin trên hồ sơ (0005, 0009), cách ẩn kèm lý do và nhật ký `moderation_logs` (0002), danh mục quyền với quyền mặc định thêm bằng migration (0003, 0013), và quy tắc "admin giữ mọi quyền nên Service chặn riêng". Chưa có bảng, route hay quyền nào cho đánh giá.

Các lực kéo thiết kế: bản này là MVP để demo nên ưu tiên gọn; đánh giá hiện công khai nên cần một cách xử lý vi phạm; số liệu trên hồ sơ không được lệch với danh sách; và chủ trọ có thể bị tấn công danh tiếng bằng đánh giá của người không hề liên hệ. Không quyết gì thì hồ sơ vẫn chỉ có số liệu khô và người xem không có chỗ đọc ý kiến của người đi trước.

## Options considered

### Option 1: Một bảng `reviews` cho mỗi cặp (người viết, chủ trọ), điều kiện viết là chat hai chiều, mọi số tính lúc đọc, admin ẩn kèm lý do

Một dòng cho mỗi cặp, điều kiện viết đọc từ dữ liệu chat có sẵn, hai con số tính từ chính các dòng của danh sách, ẩn đánh giá theo khuôn ẩn tin.

**Pros**:
- Một bảng, tái dùng ba khuôn đã chạy, không biến môi trường, không việc chạy nền.
- Chặn được đánh giá của người chưa hề trao đổi mà không cần luồng xác minh mới.
- Hai con số luôn khớp danh sách; khóa tài khoản, ẩn hay xóa có hiệu lực ngay.

**Cons**:
- Chat chỉ chứng minh đã liên hệ; tài khoản giả vẫn qua được (xem Premise note).
- Mỗi lần đọc hồ sơ thêm một truy vấn gộp.
- Xóa hẳn dòng làm admin mất nội dung đã bị ẩn.

### Option 2: Bất kỳ người tìm trọ đã đăng nhập đều được đánh giá, không cần bằng chứng

Bỏ điều kiện chat; mọi tài khoản `tenant` viết một đánh giá cho một chủ trọ.

**Pros**:
- Đơn giản nhất: không phụ thuộc module chat, không route "tôi có được viết không".
- Người dùng mới dùng được ngay, không phải chờ chủ trọ trả lời.

**Cons**:
- Không có rào nào trước đánh giá của người chưa từng liên hệ; chấm 1 sao hàng loạt hay chấm 5 sao tự thổi rất dễ.
- Điểm trung bình trên hồ sơ, vốn là tín hiệu tin cậy của dự án, kém đáng tin nhất.

### Option 3: Đánh giá riêng cho từng nhà trọ, hồ sơ chủ trọ gộp lại

Mỗi đánh giá gắn với một nhà trọ của chủ trọ; hồ sơ nhóm theo nhà trọ và có thể có trung bình từng nhà.

**Pros**:
- Chính xác hơn cho chủ trọ có nhiều nhà: người xem biết lời nói về nhà nào.
- Khớp chữ "đánh giá trọ" trong scope hơn.

**Cons**:
- Thêm khóa ngoại, luật "nhà trọ phải thuộc chủ trọ", unique theo nhà trọ, nhà trọ bị xóa mềm thì đánh giá đi đâu, và hồ sơ phải nhóm.
- Điều kiện chat gắn với tin chứ không với nhà trọ, nên phải suy ra nhà trọ từ tin, thêm một lớp phức tạp cho một lát cắt MVP.

## Decision

**Chosen option**: Option 1. Chi tiết ở [index.md](index.md), mục `## Decision`.

## Rationale

Ba điều bạn chốt quyết định lựa chọn. Thứ nhất, đích của đánh giá là chủ trọ, không phải từng nhà trọ, nên Option 3 bị bỏ: hồ sơ công khai vốn là hồ sơ của chủ trọ (spec 0005) và số người theo dõi, lượt xem đã tính theo chủ trọ. Thứ hai, điều kiện viết là chat hai chiều: đây là bằng chứng duy nhất dự án có, và rẻ vì chat bất biến nên không cần lưu cuộc trò chuyện nào đã đủ điều kiện và không cần kiểm lại khi sửa; Option 2 rẻ hơn nhưng bỏ hết rào đúng ở chỗ hồ sơ cần đáng tin nhất. Thứ ba, ẩn vi phạm theo khuôn ẩn tin của admin, giữ đúng tinh thần MVP đã cắt báo cáo tin xấu (không có nút báo cáo, không có bảng báo cáo).

Số liệu tính lúc đọc từ cùng một mảnh điều kiện với danh sách, như spec 0005 làm với số người theo dõi: bộ đếm lưu sẵn sẽ phải được cập nhật ở mọi chỗ ẩn, xóa, khóa tài khoản, và sai một chỗ là hồ sơ hiển thị con số sai mà không ai biết. Chi phí là một truy vấn gộp trên chỉ mục `(landlord_id, created_at, id)` cho mỗi lần đọc hồ sơ, đo một lần ở quy mô 50 nghìn dòng rồi bỏ qua nếu chậm (đúng cách bạn đã chọn ở các spec trước).

### Các quyết định do spec chốt (mục RECOMMEND)

Mỗi mục: lựa chọn, lý do, phương án thứ hai.

- **Route người viết dùng id chủ trọ, không dùng id đánh giá** (`/landlords/:id/review`, số ít): mỗi cặp chỉ có một đánh giá nên id chủ trọ đủ xác định, và người viết không bao giờ cầm được id đánh giá của ai khác (cách ly không cần kiểm quyền sở hữu thêm). Thứ hai: `/reviews/:id` kèm kiểm chủ sở hữu, thêm một loại 404 và một đường dò.
- **`ratingAverage` tính bằng số nguyên** (`round(sum * 10 / count) / 10`) từ `sum` và `count` của một truy vấn gộp, `null` khi không có đánh giá: tránh kiểu số thực của `avg` làm lệch ở các nửa như 4,35 (trung bình của số nguyên chia cho số lượng chỉ chạm đúng nửa khi phép chia chính xác, nên `Math.round` đúng). Thứ hai: `round(avg(stars)::numeric, 1)` trong SQL thô, đúng nhưng thêm một câu SQL thô.
- **Chưa có phân bố số sao và chưa có số đánh giá tối thiểu trước khi hiện điểm**: giữ hồ sơ gọn; thêm sau không đổi hợp đồng đã có (chỉ thêm trường). Thứ hai: trả `breakdown` ngay, thêm một `GROUP BY` và một trường cho FE mà bạn chưa xin.
- **`comment` rỗng hay toàn khoảng trắng bị 400, `null` là không có nhận xét**: giống độ nghiêm của `body` chat, tránh lưu chuỗi trống mơ hồ với `NULL`. Thứ hai: đổi chuỗi rỗng thành `NULL` cho dễ với form, nhưng FE phải nhớ gửi `null` khi xóa nhận xét ở `PATCH` thì vẫn cần.
- **`isMine` là `null` với khách**: cùng quy ước `isFollowing` và `isFavorite`. Thứ hai: `false` cho gọn, mất khả năng phân biệt khách với người chưa viết.
- **`POST` và `PATCH` trả đánh giá của mình, không trả hồ sơ mới**: FE gọi lại hồ sơ khi cần; `follow` trả hồ sơ vì nút theo dõi cần số mới ngay, còn đánh giá thì danh sách mới là thứ cần làm mới. Thứ hai: trả kèm hai con số.
- **Lý do ẩn nằm ở `moderation_logs`, không có cột `hidden_reason`**: đúng khuôn tin, một nơi ghi nhật ký. Thứ hai: cột `hidden_reason` trên `reviews`, đọc rẻ hơn (không tra log) nhưng thành hai nơi giữ một sự thật.
- **`unhide` đưa thẳng về `visible`**: tin có bước "chủ trọ tự hiện lại" vì liên quan hạn mức, còn đánh giá không có chủ sở hữu nào để quyết thay admin. Thứ hai: đưa về trạng thái chờ người viết, thêm một trạng thái cho không việc gì.
- **Đánh giá bị ẩn không sửa được, xóa thì được**: admin vừa phán xét đúng phiên bản nào thì phiên bản đó, người viết không thể đổi chữ rồi để admin gỡ ẩn một đoạn họ chưa đọc, và ẩn đua với sửa không có cửa sổ mất cập nhật vì hai câu `UPDATE` loại trừ nhau theo `status`. Thứ hai: cho sửa nhưng vẫn ẩn, admin không có tín hiệu rằng chữ đã đổi.
- **Mọi route dưới `/landlords/:id` cần chủ trọ hợp lệ, kể cả xóa đánh giá của chính mình**: một hàm kiểm duy nhất, giống `follow`. Thứ hai: cho xóa kể cả khi chủ trọ bị khóa; thêm một nhánh cho một trường hợp hiếm mà đánh giá đó vốn không hiện ở đâu.
- **Admin chặn trong Service bằng 403 ở bốn route người viết**, `@FreshAuth` ở các route ghi: tiền lệ `follow`, `favorites`, chat. Thứ hai: gỡ `review:*` khỏi `ADMIN_PERMISSIONS`, nhưng quyền admin tính trong code là `manage` mọi module nên cách đó phải sửa danh mục quyền.
- **Module tách `ReviewsDataModule`** (chỉ xuất `ReviewsRepository`) để `LandlordsModule` đọc hai con số mà không vòng import với `ReviewsModule` (cần `LandlordsRepository`): đúng tiền lệ `FavoritesDataModule`, `ListingsDataModule`. Thứ hai: `forwardRef` giữa hai module, hoạt động nhưng khó đọc.
- **`ChatRepository.hasLandlordReplied` thay vì cho `ReviewsRepository` đọc thẳng hai bảng chat**: `src/chat/AGENTS.md` ghi `ChatRepository` là nơi duy nhất chạm hai bảng đó. Thứ hai: viết truy vấn ở `ReviewsRepository`, ít file hơn nhưng hai module cùng biết lược đồ chat.
- **Giới hạn tần suất 20 lần mỗi giờ mỗi route ghi**: con số bạn duyệt; hai route đọc dùng `publicRead` có sẵn thay vì thêm nhóm. Thứ hai: nhóm đọc riêng cho `GET` của người viết, không có lý do vì route đó rẻ.
- **Đo `EXPLAIN` một lần rồi không chỉnh nếu chậm**: theo lựa chọn "MVP, không chạy thật" của bạn ở các spec trước.

### Nhật ký trả lời của bạn (2026-11-07)

- Đích của đánh giá: chủ trọ nói chung, mỗi người một đánh giá cho mỗi chủ trọ.
- Ai viết được: người tìm trọ có chat hai chiều với chủ trọ; sau đó chốt cụ thể là bất kỳ cuộc trò chuyện nào với chủ trọ đó (về tin nào cũng được) mà chủ trọ đã gửi ít nhất một tin, kiểm một lần lúc tạo.
- Nội dung: số sao 1 đến 5 bắt buộc, nhận xét tùy chọn tối đa 1000 ký tự.
- Xử lý vi phạm: admin ẩn và gỡ ẩn kèm lý do, nhật ký trong `moderation_logs`, không có nút báo cáo.
- Người viết sửa và xóa được đánh giá của mình; chủ trọ không trả lời đánh giá lúc này.
- Hồ sơ: hai con số cộng một danh sách riêng phân trang; người xem chỉ thấy tên người viết cùng cờ `isMine`.
- Số liệu tính lúc đọc; một bảng chỉ có sao, nhận xét, trạng thái và thời gian; xóa là xóa hẳn dòng; đánh giá của người viết bị khóa ẩn khỏi danh sách và hai con số cho tới khi mở khóa.
- Mô hình dữ liệu được xác nhận nguyên vẹn.
- Route: một route "đánh giá của tôi" trả `{ review, canReview }`, ba route ghi `POST`, `PATCH`, `DELETE` trên `/landlords/:id/review`, danh sách admin có ba bộ lọc cộng `hide` và `unhide`; người viết thấy `status` và lý do khi bị ẩn, xóa được nhưng không sửa được.
- Giới hạn tần suất 20 lần mỗi giờ mỗi route ghi; không có mục References.
