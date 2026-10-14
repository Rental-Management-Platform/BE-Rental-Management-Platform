# 0002. Nhà trọ, tin đăng và xem tin công khai: lý giải

File này là bản ghi quyết định (vì sao, các phương án). `/develop` không đọc nó khi build; bản build nằm ở [index.md](index.md).

## Context

> ⚠️ Premise note: Hàng 8 chưa thể thu tiền một mình. Hạn mức tin, dùng thử và gói là các hàng 9 và 10, hiện chưa có spec; trong lúc đó mọi tin `visible` của chủ trọ đang hoạt động hiện công khai không giới hạn. Spec này giả định hai điều: điều kiện hiển thị sẽ được hàng 9 mở rộng đúng một chỗ (`visibleListingsQuery`), và việc kiểm hạn mức sẽ nằm trong giao dịch đăng và hiện tin. Hai điều này được ghi thành Follow-up chứ chưa được thiết kế ở đây. Ngoài ra spec gồm năm nhóm việc (danh mục, nhà trọ, tin, ảnh, kiểm duyệt); mình giữ chung một spec vì chúng dùng chung một mô hình dữ liệu, và chia nhỏ ở Build plan để build từng lát.

Hệ thống là MVP để demo (0001, mục Phạm vi MVP): chủ trọ đăng tin và tin hiện ngay như đăng Facebook, không nháp, không duyệt trước. Vì không có bước duyệt, hai thứ thay cho nó là admin ẩn tin vi phạm sau khi đăng, và điều kiện hiển thị tính lúc đọc nên khóa tài khoản có hiệu lực tức thì. Người tìm trọ phần lớn là sinh viên, hay dùng chung một IP (ký túc xá, quán cà phê), gõ tiếng Việt có dấu lẫn không dấu, và vào xem trước khi đăng ký tài khoản.

Dữ liệu đã chốt từ trước: hai tầng nhà trọ và tin phòng, ba trạng thái tin, năm bảng có tên ở 0005, giao diện lưu ảnh ở 0006, bộ khóa quyền `property`, `listing`, `catalog` ở 0003. Cái còn mở là cột chi tiết, API, mã ngắn của tin, nguồn 168 phường, quy tắc đếm lượt xem, cách lộ số điện thoại, và cách xử lý các tình huống như xóa nhà trọ còn tin hay hai yêu cầu ghi chạy cùng lúc.

Trong code hiện chưa có `StorageService`, `UPLOAD_DIR`, bảng `wards`, `amenities`, cũng chưa có đường đọc đăng nhập tùy chọn cho route công khai (guard hiện tại hoặc chặn hẳn hoặc bỏ qua hoàn toàn route công khai). Nếu không quyết định các điểm này, mỗi cái sẽ bị chọn tạm trong lúc build và khó đổi khi hàng 9 đến 12 đã bám vào.

## Options considered

### Option 1: Hai tầng nhà trọ và tin, `search_key` đã bỏ dấu, đọc đăng nhập tùy chọn, ảnh qua `StorageService` ghi ổ đĩa

Nhà trọ giữ địa chỉ, phí, tiện ích; mỗi tin phòng thuộc một nhà trọ. Tìm từ khóa bằng cột `search_key` (chuỗi bỏ dấu của tiêu đề, tên nhà trọ, địa chỉ, tên phường) kèm chỉ mục trigram. Route công khai tự đọc token nếu có. Ảnh ghi ổ đĩa sau một giao diện.

**Pros**:
- Địa chỉ và phí nhập một lần cho cả nhà trọ nhiều phòng; sửa một chỗ đúng cho mọi tin.
- Tìm không dấu chạy trên Postgres hiện có, không thêm dịch vụ; chỉ mục trigram đủ cho vài nghìn tin.
- Điều kiện hiển thị ở một chỗ, hàng 9 mở rộng chỗ đó thay vì sửa nhiều truy vấn.
- Không thêm thư viện: nhận dạng ảnh bằng chữ ký đầu tệp, đếm lượt xem bằng bộ nhớ.

**Cons**:
- `search_key` là dữ liệu dẫn xuất có ba đường cập nhật phải nhớ giữ khớp.
- Nhiều bảng và nhiều endpoint hơn một mô hình phẳng.
- Đọc đăng nhập tùy chọn là một ngoại lệ so với quy tắc "mỗi route khai báo đúng một kiểu truy cập" nên phải thêm decorator riêng và sửa guard.

### Option 2: Một tầng, mỗi tin tự chứa địa chỉ, phí và tiện ích

Không có bảng nhà trọ; mỗi tin là một bản ghi đầy đủ.

**Pros**:
- Ít bảng nhất, ít join, API gọn; không cần khái niệm "nhà trọ" khi chủ trọ chỉ có một phòng.
- Không có chuyện xóa nhà trọ còn tin.

**Cons**:
- Chủ trọ có 10 phòng phải nhập lại địa chỉ và phí 10 lần; sửa phí điện phải sửa 10 tin, dễ lệch.
- Trái với quyết định MVP đã chốt (hai tầng) và khiến hàng 11, hàng 9 mất chỗ bám tự nhiên (hồ sơ chủ trọ gom theo nhà trọ).

### Option 3: Full text search của Postgres hoặc một công cụ tìm kiếm ngoài

`tsvector` với cấu hình `simple` cộng bỏ dấu, hoặc Meilisearch, Elasticsearch.

**Pros**:
- Xếp hạng theo độ liên quan, chịu gõ sai, tìm theo cụm từ tốt hơn.

**Cons**:
- Chữ `đ` không tách dấu được bằng `unaccent` (0005), nên vẫn phải tự chuẩn hóa như Option 1.
- Thêm cột và chỉ mục dẫn xuất, hoặc thêm một dịch vụ phải vận hành và đồng bộ dữ liệu; quá nặng cho một demo vài nghìn tin.

## Rationale

Chọn Option 1. Lực chính từ Context: demo gọn, người xem là sinh viên gõ có dấu lẫn không dấu, tin phải biến ngay khi khóa tài khoản, và hàng 9 đến 12 sẽ bám vào tin và chủ trọ. Hai tầng giữ đúng quyết định MVP và tránh nhập lại dữ liệu cho chủ trọ nhiều phòng. `search_key` kèm trigram giải bài toán tìm không dấu bằng chính Postgres đang chạy; cái giá là một cột dẫn xuất, nhưng 0005 đã chấp nhận riêng cột này và spec liệt kê đúng ba đường cập nhật để nó không lệch.

Điều kiện hiển thị tính bằng phép nối lúc đọc, không cờ sao chép, nên khóa chủ trọ hay xóa nhà trọ có hiệu lực ngay và hàng 9 chỉ thêm một vế điều kiện ở một hàm. Với số điện thoại, đọc đăng nhập tùy chọn gần như miễn phí vì chi tiết tin vốn cần biết người xem để loại lượt xem của chính chủ; đổi lại lộ số cho người đã đăng nhập là chặn thu thập hàng loạt rẻ nhất có thể. Ảnh đi qua `StorageService` đúng như 0006 để sau này đổi sang kho đám mây chỉ sửa một lớp.

Bạn chọn làm luôn API admin cho danh mục ở hàng 8 thay vì phương án mình khuyên (chỉ đọc cộng seed). Mình ghi đúng theo lựa chọn của bạn. Cái giá cụ thể: thêm sáu endpoint, và đổi tên phường trở thành đường cập nhật thứ ba của `search_key` (vì tên phường nằm trong chuỗi này theo 0005).

## Các quyết định nhỏ (đã hỏi bạn hoặc mình tự quyết)

| Quyết định | Chọn | Phương án thay thế | Lý do |
|---|---|---|---|
| Ai thấy số điện thoại chủ trọ | Chỉ người đã đăng nhập (bạn chọn) | Mọi người; số liên hệ riêng mỗi nhà trọ | Chặn thu thập số hàng loạt, gần như không tốn thêm |
| Quy tắc đếm lượt xem | Một lượt mỗi người xem trong 30 phút, bộ nhớ (bạn chọn) | Mỗi lần mở cộng một; bảng `listing_views` | Tải lại không làm số tăng, mà số này là thứ giữ chủ trọ ở lại; không thêm bảng |
| Xóa nhà trọ còn tin | Chặn bằng 409 (bạn chọn) | Xóa luôn tin; không cho xóa nhà trọ | Không ai mất tin ngoài ý muốn |
| Danh mục phường, tiện ích | Làm luôn API admin (bạn chọn, mình đã khuyên chỉ đọc cộng seed) | Chỉ đọc cộng seed | Theo lựa chọn của bạn |
| Trường nhà trọ | Tên, địa chỉ, phường, tọa độ tùy chọn (bạn chọn) | Bộ gọn không tọa độ; thêm nội quy và mô tả chung | Tọa độ để FE ghim bản đồ và để sau này tìm quanh địa điểm khỏi bù dữ liệu |
| Trường tin | Thêm tiền cọc và ngày vào ở (bạn chọn) | Bộ gọn; thêm loại phòng và số người tối đa | Hai thông tin người thuê nào cũng hỏi đầu tiên |
| Phí | Bộ sáu loại cố định (bạn chọn) | Tự do gõ tên | So sánh và hiển thị đồng nhất |
| Tiện ích | Chỉ ở nhà trọ (bạn chọn) | Thêm mức phòng | Đúng dòng scope; tiện ích riêng của phòng ghi vào mô tả |
| Ảnh | Không bắt buộc, ảnh vị trí nhỏ nhất là bìa, không đổi thứ tự (bạn chọn) | Endpoint đổi thứ tự; bắt buộc một ảnh | Tin hiện ngay và không có trạng thái nháp nên không thể bắt buộc ảnh mà không làm request tạo tin phức tạp |
| Chống lạm dụng | Chỉ giới hạn tần suất ghi theo tài khoản (bạn chọn) | Trần cứng 20 nhà trọ và 100 tin | Ít luật nhất; hạn mức tin đang hiện là việc hàng 9 |
| Hết hạn tin | Không, chủ trọ tự ẩn (bạn chọn) | Tự biến sau 60 ngày | Đúng ba trạng thái đã chốt, không thêm cột hay endpoint làm mới |
| Nguồn 168 phường | Bộ thanglequoc, MIT (bạn chọn) | provinces.open-api.vn v2; bạn tự đưa file | Giấy phép rõ; `/develop` đếm đúng 168 dòng hoặc dừng |
| Mục Tham khảo | Không (bạn chọn) | Chỉ tên nguồn; tên nguồn kèm đường dẫn | Giữ spec gọn |
| Mã ngắn của tin | 8 ký tự ngẫu nhiên từ 31 ký tự dễ đọc, cột `code` duy nhất, đường dẫn `slug-mã`, `slug` tính lúc đọc (mình quyết) | Dùng tiền tố UUID; số thứ tự tăng dần | Số thứ tự để lộ số tin; tiền tố UUID dài hơn; `slug` không lưu nên đổi tiêu đề không làm hỏng link cũ |
| Phân trang | `page` và `pageSize` kèm `total` (mình quyết) | Phân trang theo con trỏ | Cần tổng số và sắp theo giá; quy mô demo; con trỏ khó hơn với sắp theo giá |
| URL của chủ trọ | `/properties`, `/me/listings`, `POST /properties/:id/listings`, `hide` và `show` là endpoint riêng (mình quyết) | Một `PATCH` đổi `status` | Mã lỗi riêng cho từng chuyển trạng thái, và chủ trọ không tự đặt được `hidden_by_admin` |
| Đọc đăng nhập tùy chọn | Decorator `@OptionalAuth()`, token sai coi như khách (mình quyết) | Token sai trả 401 | Route công khai không bao giờ chặn người xem chỉ vì token cũ |
| Lý do ẩn cho chủ trọ | Hiện lý do ẩn gần nhất ở tin của mình (mình quyết) | Không hiện | Không biết lý do thì không sửa được tin |
| Chuyển trạng thái khi đồng thời | `updateMany` có điều kiện trạng thái cũ (mình quyết) | Khóa dòng rồi đọc, ghi | Một câu duy nhất, admin luôn thắng chủ trọ |
| Số ảnh tối đa khi đồng thời | `CHECK position` cộng khóa dòng tin (mình quyết) | Chỉ kiểm ở Service | DB là lớp cuối chặn quá 5 ảnh; khóa dòng để người thua nhận 409 thay vì 500 |
| Xóa mềm tin và ảnh | Giữ ảnh (mình quyết) | Xóa tệp ngay | Xóa mềm nghĩa là có thể đối chiếu lại; dọn tệp để sau |
| Quyền ghi danh mục | `catalog:*`, không bắt buộc `@FreshAuth()` (mình quyết) | Bắt buộc `@FreshAuth()` | Danh sách bắt buộc của 0003 AC-8 không có danh mục |
| `UPLOAD_DIR` mặc định | `uploads` ở thư mục chạy, Compose đặt `/data/uploads` (mình quyết) | `/data/uploads` cho mọi nơi | `/data/uploads` trên Windows trỏ ra `D:\data\uploads`, không hợp máy dev |

## Bằng chứng: nguồn dữ liệu 168 phường

Kết quả một lần tra web ngày 2026-10-12 bằng subagent rẻ tiền (tối đa 5 tìm kiếm, 8 trang). Đây là tóm tắt của subagent, mình chưa kiểm lại từng điều; chỗ nào chưa kiểm được thì ghi "chưa kiểm". Không có đường dẫn nào được đưa vào spec để người khác bấm vào, vì bạn chọn không có mục Tham khảo.

| Nguồn | Giấy phép | Dạng dữ liệu | Số phường tỉnh 79 | Ghi chú |
|---|---|---|---|---|
| provinces.open-api.vn v2 | chưa kiểm (kho gốc nghe nói GPL-3.0) | tỉnh có `code`, `name`, `wards[]`; phường 5 chữ số | đã đếm đúng 168 | cộng đồng, không chính thức; ngày cập nhật chưa kiểm |
| thanglequoc/vietnamese-provinces-database (được chọn) | MIT (thấy trên trang) | JSON; phường có `code`, `name`, `full_name`, `province_code`, mã 5 chữ số | chưa kiểm | theo Quyết định 19/2025; bản mới nhất nhắc một nghị quyết 2026; FAQ ghi "37 tỉnh" trong khi quyết định gốc là 34, cần đối chiếu |
| tranngocminhhieu/vietnamadminunits | MIT | bộ dữ liệu đã xử lý theo đơn vị mới | chưa kiểm | tên file chưa kiểm |

Danh mục chính thức của Tổng cục Thống kê không truy cập được (lỗi DNS) và tệp Quyết định 19/2025/QĐ-TTg (Phụ lục II) không tải được, nên chưa có phép đối chiếu với nguồn chính thức. Vì vậy `/develop` phải đếm đúng 168 dòng cho tỉnh mã `79`, đối chiếu với `provinces.open-api.vn`, và dừng hỏi bạn khi lệch (xem Follow-up trong `index.md`). Mã phường sau sáp nhập khác mã trước sáp nhập, nên không trộn hai nguồn.
