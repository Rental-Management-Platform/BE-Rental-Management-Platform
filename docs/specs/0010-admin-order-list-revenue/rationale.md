# 0010. Admin xem đơn mua gói và thống kê doanh thu: lý do và các phương án

Bản dựng nằm ở [index.md](index.md). File này giữ phần "vì sao", không cần cho lúc build.

## Context

> ⚠️ Premise note: con số "doanh thu" ở đây là tiền của thanh toán thử. Đơn `paid` chỉ nghĩa là chủ trọ tự bấm xác nhận (spec 0004), không có cổng thanh toán, không biên lai, không thu tiền thật. Một màn hình thống kê dễ khiến người xem tin con số là tiền thật. Với MVP demo thì chấp nhận được, miễn là tài liệu cho FE ghi rõ và màn hình không gọi nó là doanh thu đã thu. Khi có cổng thanh toán thật, thống kê phải đọc từ giao dịch đã đối soát chứ không từ cờ `paid`; đó là một quyết định riêng ở spec sau.

Admin đã quản lý được gói (spec 0004), khóa và mở khóa tài khoản (0003), và tìm người dùng (0007), nhưng chưa biết ai đã mua gói nào. Lý do nằm ở thiết kế: mọi API đơn là của chủ sở hữu, `GET /orders` chỉ trả đơn của chính người gọi và `assertOwner` chặn cả admin xem đơn người khác. Spec 0004 ghi thẳng điều này trong Consequences ("admin không xem được đơn của ai") và đưa "admin xem đơn của mọi người và số liệu doanh thu" vào mục hoãn. Hàng 17 của scope đưa nó vào kế hoạch theo yêu cầu của bạn ngày 2026-10-21, và lần gọi này bạn nói rõ là cần cả xem đơn lẫn thống kê doanh thu.

Các ràng buộc có sẵn. Bảng `orders` đã giữ đủ dữ liệu: mã, chủ trọ, gói, bốn cột bản chốt (tên gói, giá, số tin, số ngày), trạng thái, `paid_at`, `cancelled_at`, `created_at`, và kỳ gói nằm ở `subscriptions`. Giá trên đơn là giá đã chốt lúc tạo nên cộng lại luôn ra đúng số tiền của đơn dù admin sửa giá gói sau đó. Danh mục quyền có sẵn mẫu hành động chỉ admin (`listing:moderate`) và `@FreshAuth` đã dùng cho một route đọc dữ liệu cá nhân (0007). Dự án là MVP demo không chạy thật nên các ngân sách quy mô chỉ cần đo một lần rồi ghi lại.

Hai điểm khó của riêng tính năng này. Một là "ngày": admin nghĩ theo ngày Việt Nam, còn database lưu `timestamptz` (UTC); đơn trả lúc 00:30 sáng ngày 1 tháng 11 giờ Việt Nam nằm ở ngày 31 tháng 10 theo UTC, nên nếu ranh giới ngày lấy sai thì doanh thu tháng bị lệch một đơn vào đúng đêm giao tháng. Hai là cột ngày: tiền vào lúc đơn được trả (`paid_at`), nhưng đơn chờ và đơn đã hủy không có `paid_at`, và đơn chờ không tự hết hạn nên có thể được trả rất lâu sau khi tạo.

## Options considered

### Option 1: Hai route đọc riêng cho admin trên bảng `orders` có sẵn, danh sách theo ngày tạo kèm `summary`, thống kê theo ngày trả bằng một câu SQL

`GET /orders/all` liệt kê đơn của mọi chủ trọ (lọc trạng thái, chủ trọ, gói, khoảng ngày tạo) và trả thêm số đơn đã trả cùng tổng tiền của tập đang lọc. `GET /orders/revenue` trả tổng, chia theo gói và chia theo ngày hoặc tháng của `paid_at`. Quyền là hành động chỉ admin mới `order:report`.

**Pros**:
- Không bảng, không migration; mọi số tính lúc đọc nên không có gì để giữ đồng bộ.
- Mỗi API trả lời đúng một câu hỏi: "xem các đơn này" (theo ngày tạo, đủ mọi trạng thái) và "tiền vào lúc nào" (theo ngày trả).
- Một câu SQL cho cả ba con số tổng nên thống kê không thể tự mâu thuẫn.
- Hợp đúng chữ "thống kê" của bạn mà không phình thành dashboard.

**Cons**:
- Hai cột ngày khác nhau ở hai API, cùng khoảng ngày có thể ra hai tổng hơi khác nhau.
- Hai route, hai DTO, một hằng múi giờ mới: nhiều việc hơn Option 2.
- Không chỉ mục mới nên quét bảng; ổn ở quy mô demo.

### Option 2: Chỉ một route `GET /orders/all` có `summary`, đúng chữ hàng 17, không có API thống kê riêng

Danh sách lọc được kèm tổng đơn đã trả và tổng tiền; muốn "doanh thu tháng 10" thì lọc `status=paid` và khoảng ngày rồi đọc `summary`.

**Pros**:
- Nhỏ nhất: một route, một DTO, không cần nghĩ tới chuỗi theo thời gian, ô trống hay tính nhóm theo múi giờ.
- Chỉ một cột ngày, không có hai con số lệch nhau.

**Cons**:
- Không có xu hướng theo thời gian và không có chia theo gói; admin phải tự lọc từng tháng, từng gói rồi ghi lại.
- Bạn đã nói rõ cần "thống kê doanh thu", nên phải làm lại thêm một lần ngay sau đó.

### Option 3: Một route gom cả danh sách lẫn thống kê vào một phản hồi

`GET /orders/all` trả `items` cùng `byPlan` và `series` trong cùng một lần gọi.

**Pros**:
- FE chỉ gọi một lần cho cả màn hình.

**Cons**:
- Mỗi lần lật trang lại tính thống kê một lần nữa, và hai thứ có phân trang khác nhau bị trói vào nhau.
- Phản hồi nặng và khó cache; sau này tách ra thì phải đổi hợp đồng.

### Option 4: Bảng doanh thu tổng hợp lưu sẵn theo ngày (`revenue_daily`)

Mỗi lần thanh toán cập nhật một dòng của bảng tổng hợp; thống kê đọc bảng này.

**Pros**:
- Đọc thống kê rất nhanh ở mọi quy mô, và chuỗi theo ngày có sẵn dạng đầy đủ.

**Cons**:
- Là giá trị suy ra được lưu sẵn: phải giữ đồng bộ với mọi chỗ đổi trạng thái đơn và mọi lần sửa dữ liệu, dễ lệch khi có lỗi giữa chừng. Thêm một bảng và một migration cho một nhu cầu chưa đo thấy chậm.
- Vi phạm quy ước "tính lúc đọc, chỉ lưu sẵn khi đã đo thấy chậm" mà dự án đang theo.

## Rationale

Chọn Option 1 vì nó khớp đúng những gì bạn xin và không thừa gì. Bạn muốn thấy đơn của chủ trọ và thống kê doanh thu, nên Option 2 chỉ đáp ứng nửa sau theo kiểu "tự cộng tay"; còn Option 3 và 4 trả giá bằng sự ràng buộc giữa hai phần hoặc một bảng phải giữ đồng bộ, trong khi dữ liệu nằm sẵn ở một bảng nhỏ (đơn ít hơn tin rất nhiều) và dự án đã chọn tính lúc đọc (0003, 0005, 0006).

Việc tách hai cột ngày là chủ ý, không phải sơ suất. Tiền vào lúc `paid_at`, nên thống kê tính theo đó; còn danh sách phải cho thấy cả đơn chờ và đơn đã hủy mà hai loại này không có `paid_at`, nên nó lọc theo `created_at`. Bạn chọn đúng cách này (2026-10-21) thay vì ép một cột cho cả hai, và đổi lại là ghi rõ trong tài liệu FE rằng hai tổng có thể lệch quanh biên kỳ. Một câu SQL duy nhất cho thống kê vừa giữ ba con số tổng khớp nhau vừa tránh khe hở nếu có thanh toán chen vào giữa ba lần đọc riêng.

Múi giờ là hằng `Asia/Ho_Chi_Minh` trong code, bạn chọn thay cho biến môi trường, tham số của client hay UTC: sản phẩm này chỉ cho Việt Nam, UTC+7 không có giờ mùa hè, và một hằng không tạo thêm biến phải khai hay hai admin thấy hai con số. Đổi lại là một test so độ lệch cố định với `Intl` để hai cách biểu diễn (độ lệch dùng cho ranh giới ngày ở Node, tên múi giờ dùng trong `AT TIME ZONE` ở SQL) không lệch nhau.

Quyền là một hành động chỉ admin trong module `order` thay vì khôi phục các module `finance` hay `dashboard` đã hoãn khỏi MVP: ít khóa hơn, cùng kiểu `listing:moderate`, và vẫn đúng tinh thần câu của 0003 AC-11 (báo cáo doanh thu là chỉ admin). Cái giá phải trả là module `order` giờ có một hành động mà chủ trọ không giữ, nên token của chủ trọ không còn gộp được thành `order:manage`; token cũ còn hạn vẫn mang khóa gộp đó và nó bung ra cả `order:report`, nên `@FreshAuth()` ở hai route là bắt buộc chứ không chỉ là cẩn thận thêm. Các lựa chọn gia cố theo cùng tinh thần với 0007 (không giới hạn tần suất, không nhật ký đọc, không chỉ mục mới, đo `EXPLAIN` một lần rồi bỏ qua) được ghi ở Consequences vì dự án là MVP demo không chạy thật.
