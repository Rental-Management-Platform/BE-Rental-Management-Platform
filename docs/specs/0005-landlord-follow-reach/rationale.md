# Rationale: 0005. Theo dõi chủ trọ và hồ sơ công khai có số liệu

Đây là hồ sơ quyết định (vì sao), `/develop` không cần đọc. Bản build nằm ở [index.md](index.md).

## Context

> ⚠️ Premise note: Theo dõi hiện chưa kích hoạt việc gì ngoài một con số: không thông báo cho người theo dõi, không danh sách "đang theo dõi", và chủ trọ không xem được ai theo dõi mình. Con số lại có thể bị tăng ảo bằng nhiều tài khoản người tìm trọ giả. Vì vậy ý "bỏ tài khoản để lập cái mới sẽ mất hết, nên chủ trọ ở lại và mua gói" chỉ đúng chừng nào chủ trọ nhìn thấy và coi trọng con số; nó không thể chặn việc bỏ tài khoản. Khung đúng hơn là coi đây là một tín hiệu uy tín công khai nhẹ cho người tìm trọ, làm gọn, và chưa đầu tư vào chống gian lận hay thông báo. Bạn đã chốt giữ hàng này trong MVP (2026-10-11), nên spec vẫn thiết kế đúng như vậy.

Hàng 11 của scope: người tìm trọ theo dõi một chủ trọ; hồ sơ công khai của chủ trọ hiện số người theo dõi và tổng lượt xem tin; số cập nhật đúng khi có người bỏ theo dõi hoặc tài khoản bị khóa; không tự theo dõi chính mình; mỗi người chỉ tính một lần. Chỉ giữ một loại lượt xem: `view_count` của tin (hàng 8), cộng dồn theo chủ trọ.

Các lực tác động lên thiết kế:
- Quyền `follow:create` và `follow:delete` đã có sẵn ở `tenant`; spec 0005 của nền móng đã phác bảng `follows` (khóa chính theo cặp, `CHECK` không tự theo dõi, chỉ mục theo `landlord_id`) và chừa chỗ cho bảng `landlord_profiles` để spec này quyết.
- Hồ sơ cần đúng sau mọi thay đổi của dữ liệu khác: khóa hay mở khóa người theo dõi hoặc chủ trọ, ẩn hay xóa tin, hết hay mua gói. Mỗi sự kiện đó đã đổi trạng thái ở bảng khác; một bộ đếm lưu sẵn phải được cập nhật ở từng chỗ đó.
- Điều kiện "tin đang hiện công khai" đã viết đúng một lần (0003, 0004) và đã tính lúc đọc; có hai mảnh SQL dùng chung.
- Chưa ai gọi vào hồ sơ này ở quy mô lớn, và dự án nói rõ là MVP chạy demo: số liệu cần đúng, không cần nhanh hơn mức đo được.
- Chưa có API hồ sơ nào; `users` chỉ có `name`, `phone`, `created_at`; số điện thoại chủ trọ chỉ lộ cho người đã đăng nhập ở chi tiết tin (0002 AC-12).

## Options considered

### Option 1: Một bảng `follows`, mọi số tính lúc đọc, hồ sơ công khai ở `GET /landlords/:id`

Thêm bảng `follows`. Số người theo dõi nối `users` để bỏ tài khoản bị khóa hay đã xóa; tổng lượt xem cộng `listings.view_count` qua `properties`; số tin đang hiện dùng lại hai mảnh SQL hiển thị công khai. Tên lấy từ `users.name`. Ghi theo dõi bằng một câu `INSERT ... ON CONFLICT DO NOTHING`.

**Pros**:
- Số luôn đúng ngay khi nguồn đổi (khóa, mở khóa, ẩn, xóa, hết gói), không cần cập nhật ở nhiều nơi.
- Một bảng và ba API, không việc nền, không trigger, không biến môi trường.
- `publicListingCount` không thể lệch với danh sách công khai vì dùng chung SQL.

**Cons**:
- Mỗi lần mở hồ sơ chạy vài câu truy vấn gộp; chậm dần nếu một chủ trọ có rất nhiều người theo dõi hoặc tin (ở quy mô demo thì không đáng kể).
- Ba số đọc không cùng một ảnh chụp dữ liệu.

### Option 2: Bảng `follows` cộng cột đếm lưu sẵn trên `users` (`follower_count`, `total_view_count`)

Giữ hai cột đếm trên `users`, tăng giảm trong cùng giao dịch với việc ghi theo dõi, và cộng lượt xem vào cột tổng mỗi khi cộng `view_count` của một tin.

**Pros**:
- Đọc hồ sơ là một lần đọc một dòng, nhanh nhất.
- Số đếm không phải tính lại khi nhiều người xem.

**Cons**:
- Mỗi sự kiện khác làm số lệch nếu quên cập nhật: khóa hay mở khóa người theo dõi, xóa mềm tài khoản, và việc cộng lượt xem ở bảng `listings` phải ghi thêm vào `users` trong cùng câu lệnh. Cột `view_count` hiện cộng bằng một câu `UPDATE` nguyên tử, thêm cột thứ hai làm câu đó thành hai bảng.
- Mâu thuẫn với nguyên tắc dự án: không lưu giá trị suy ra khi chưa đo được vấn đề tốc độ.
- Cần việc sửa số (đối soát) khi lệch.

### Option 3: Bảng `follows` cộng bảng `landlord_profiles` (tên hiển thị riêng, Zalo) và API chủ trọ tự sửa hồ sơ

Tạo bảng 1:1 với `users` cho chủ trọ, có tên hiển thị riêng khỏi tên đăng ký và Zalo tùy chọn; hồ sơ công khai đọc từ đây.

**Pros**:
- Chủ trọ chọn tên hiển thị công khai khác tên đăng ký; chỗ để thêm Zalo và các trường hồ sơ khác về sau.

**Cons**:
- Thêm một bảng, một API ghi, quy tắc tạo lúc đăng ký hay lúc đầu tiên, và test, trong khi yêu cầu hàng 11 chỉ cần tên và các con số.
- Zalo thuộc phần liên hệ chủ trọ đã hoãn khỏi MVP.
- Spec 0002 đã quyết chưa có `landlord_profiles`.

## Rationale

Chọn Option 1. Điều quyết định là yêu cầu "số cập nhật đúng khi có người bỏ theo dõi hoặc tài khoản bị khóa": mọi sự kiện đó đổi dữ liệu ở bảng khác (`users`, `listings`, các kỳ gói), nên tính lúc đọc từ nguồn thật là cách duy nhất không bao giờ lệch mà không phải sửa thêm chỗ nào khác. Option 2 đổi sự đơn giản đó lấy một tốc độ chưa ai đo là cần, và biến câu cộng lượt xem nguyên tử của tin thành ghi hai bảng. Điều này khớp lời bạn nói đây là MVP không chạy thật: đo ít, giữ đúng, và ghi lại số đo nếu chậm.

Hai quy tắc của bạn quyết định chi tiết. Chọn "mọi tin kể cả ẩn và đã xóa" cho tổng lượt xem vì mục tiêu của hàng 11 là số tích lũy trên tài khoản; nếu chỉ tính tin còn sống thì chủ trọ xóa tin là mất công sức tích lũy, trái ý đó. Chọn "chỉ đếm người theo dõi đang hoạt động" để số không phồng vì tài khoản đã bị khóa, và vì tính lúc đọc nên chi phí chỉ là một phép nối. Chọn trả 404 cho cả hồ sơ lẫn ghi khi chủ trọ bị khóa để nhất quán với cách tin của họ biến khỏi công khai (0002 AC-10), đồng thời giữ dòng `follows` để mở khóa là mọi thứ trở lại.

Option 3 bị loại vì yêu cầu không cần tên riêng, Zalo đã hoãn, và 0002 đã quyết chưa có bảng này; thêm sau là một migration nhỏ. Bạn đã chọn không tạo bảng. Cho phản hồi của ghi, chọn trả hồ sơ mới (bạn xác nhận) thay vì 204 để nút và con số cập nhật trong một lần gọi. Tôi chọn `POST /landlords/:id/follow` và `DELETE /landlords/:id/follow` (runner up: `PUT` và `DELETE /me/following/:id`, đúng ngữ nghĩa chạy lặp hơn nhưng không có chỗ tự nhiên cho `GET /landlords/:id` và lạ hơn so với kiểu `hide`/`show` đang dùng ở các API khác). Thứ tự kiểm lỗi đặt "tự theo dõi" trước tra chủ trọ để trả mã đúng nghĩa (409) thay vì 404, và `CANNOT_FOLLOW_SELF` là 409 giống `CANNOT_LOCK_SELF` đã có.
