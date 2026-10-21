# 0007. Danh sách người dùng cho admin: lý do và các phương án

Bản dựng nằm ở [index.md](index.md). File này giữ phần "vì sao", không cần cho lúc build.

## Context

> ⚠️ Premise note: danh sách này gom email và số điện thoại của mọi tài khoản vào một API, nhưng dự án chưa khai phạm vi tuân thủ dữ liệu cá nhân nào, và không có nhật ký ai đã đọc gì. Với MVP demo thì chấp nhận được, vì chỉ admin gọi được và mỗi lần gọi đều kiểm lại admin trong database. Nếu sau này chạy thật với người dùng thật, hai việc cần xem lại là giới hạn tần suất và nhật ký đọc; cả hai đã ghi ở Follow-up của spec.

Admin đã khóa và mở khóa được tài khoản (spec 0003 AC-7), nhưng muốn làm vậy phải biết sẵn id của người đó. Tài liệu cho FE ghi thẳng chỗ này là lỗ hổng: màn hình admin "chưa tìm được người để khóa ngoài việc biết sẵn id". Một API `GET /users` từng có và đã bị bỏ ngày 2026-10-08, khi `GET /auth/me` thay vào; từ đó chưa có đường nào liệt kê người dùng.

Các ràng buộc có sẵn: bảng `users` đã có đủ cột cần (loại tài khoản, trạng thái, lý do khóa, ngày tạo), quyền `user:read` đã nằm trong danh mục và chỉ admin giữ, tìm tin của admin đã có mẫu (`contains` qua `escapeLike`, phân trang `Page<T>`), và `@FreshAuth` đã có cho thao tác ghi của admin. Tên người dùng là tiếng Việt, số điện thoại lưu đã chuẩn hóa `0xxxxxxxxx`, email lưu chữ thường. Dự án là MVP demo không chạy thật, nên các ngân sách về quy mô chỉ cần đo một lần và ghi lại.

Hàng 14 của scope giữ phạm vi chặt: chỉ đọc, phân trang, lọc theo loại và trạng thái, tìm theo email, tên, số điện thoại, mỗi dòng có id dùng được với khóa và mở khóa, không bao giờ lộ mật khẩu hay mã băm.

## Options considered

### Option 1: `GET /users` trong module `users`, đọc thẳng bảng `users`, tìm chữ bằng `contains` không phân biệt hoa thường

Một truy vấn đọc có bộ lọc, phân trang và `OR` trên email, tên, số điện thoại. Không đổi schema.

**Pros**:
- Không migration, không bảng, không mã lỗi mới: gọn nhất đủ đáp ứng Done when của hàng 14.
- Tái dùng mẫu đã chạy ở tìm tin của admin (`escapeLike`, `PaginationQueryDto`, `Page<T>`) và cùng tiền tố `/users` với `lock`, `unlock`.
- Danh sách trắng bằng `select` nên mật khẩu băm không có đường rò.

**Cons**:
- Tên phải gõ đúng dấu; `nguyen` không tìm ra `Nguyễn`.
- Việc gập hoa thường với chữ có dấu nhờ vào locale của database.
- Tìm giữa chuỗi quét cả bảng (chấp nhận ở quy mô MVP).

### Option 2: Như Option 1, cộng cột lưu sẵn `users.search_key` để tìm tên không phân biệt dấu

Thêm cột `search_key` dựng bằng `toSearchKey` (hàm đã dùng cho tin), điền lúc đăng ký, kèm migration và điền dữ liệu cũ, có thể kèm chỉ mục GIN `pg_trgm`. Khớp chữ chạy trên cột này.

**Pros**:
- `nguyen` tìm ra `Nguyễn`, giống ô tìm tin; không phụ thuộc locale của database vì gập dấu làm ở ứng dụng.
- Có đường dẫn sẵn tới chỉ mục `pg_trgm` nếu bảng lớn.

**Cons**:
- Thêm một cột, một migration có điền dữ liệu cũ, một nơi nữa phải giữ đồng bộ (đăng ký, seed, và về sau mọi chỗ đổi tên).
- Là phần thêm ngoài điều hàng 14 yêu cầu; admin chủ yếu tìm bằng email hoặc số điện thoại.

### Option 3: Đặt ở `/moderation/users` trong module kiểm duyệt

Giống `GET /moderation/listings`: mọi danh sách của admin nằm dưới `/moderation`.

**Pros**:
- Mọi màn hình kiểm duyệt cùng một tiền tố.

**Cons**:
- Tách các route người dùng thành hai tiền tố (`POST /users/:id/lock` ở một nơi, danh sách ở nơi khác).
- Quyền `user:read` thuộc module `user`, còn `/moderation` hiện gắn với quyền kiểm duyệt tin.

### Option 4: Chỉ tra cứu chính xác theo email, không có danh sách

Một route như `GET /users/lookup?email=...` trả đúng một tài khoản.

**Pros**:
- Nhỏ nhất, không quét bảng, ít dữ liệu cá nhân lộ ra mỗi lần gọi.

**Cons**:
- Không duyệt, không lọc theo loại hay trạng thái, không tìm theo tên hay số điện thoại; admin phải biết sẵn email chính xác. Không đáp ứng Done when của hàng 14.

## Rationale

Chọn Option 1 vì nó đáp ứng đúng từng dòng Done when của hàng 14 mà không thêm gì ngoài đó: bảng `users` đã đủ cột, mọi khối xây dựng đã có (phân trang, thoát ký tự, quyền, kiểm lại admin). Bạn đã nhiều lần ưu tiên gọn cho MVP và không muốn thêm phần chưa yêu cầu, và Option 2 chính là loại phần thêm đó: một cột, một migration, một chỗ phải giữ đồng bộ, để đổi lấy việc gõ tên không dấu, trong khi admin thường tìm bằng email hoặc số điện thoại. Option 2 vẫn là hướng nâng cấp rõ ràng và rẻ khi cần (hàm `toSearchKey` và tiện ích `pg_trgm` đã có), nên ghi ở Follow-up. Option 3 bị loại vì tách các route người dùng làm đôi; Option 4 bị loại vì không đáp ứng yêu cầu duyệt và lọc.

Hai điểm cần bạn chấp nhận có ý thức: tìm tên phải đúng dấu, và việc gập hoa thường chữ có dấu dựa vào locale UTF-8 của database. Điểm sau được kiểm thật ở bước build và ghi vào danh sách việc khi đóng gói.

`@FreshAuth` được chọn cho một thao tác đọc, dù spec 0003 AC-8 chỉ liệt kê thao tác ghi, vì danh sách này là nơi duy nhất liệt kê email và số điện thoại của mọi người: admin vừa bị khóa hay hạ quyền phải mất đường đọc ngay thay vì chờ token hết hạn. Chi phí là một lần đọc một dòng cho mỗi lần gọi, và chỉ admin gọi.

**Các quyết định bạn đã chọn (2026-10-21)**: các trường mỗi dòng là cơ bản cộng `lockedReason` và `createdAt`; khớp chữ không phân biệt hoa thường nhưng dấu phải khớp; `@FreshAuth` mỗi lần gọi; đường dẫn `GET /users`; không giới hạn tần suất; thứ tự cố định mới nhất trước; mô hình dữ liệu không đổi; không có mục References.

**Các lựa chọn tôi đã quyết thay bạn** (chọn, lý do, phương án thay thế):

| Quyết định | Chọn | Vì sao | Phương án thay thế |
|---|---|---|---|
| Nơi đặt code | `UsersController` mới trong `src/users/` | danh sách là đọc bảng `users`, hành động kiểm duyệt vẫn ở `src/moderation/` | thêm `GET` vào `ModerationController` |
| Cách khớp `q` | nguyên chuỗi, một chuỗi con, `OR` trên email, tên, số điện thoại | admin gõ một thứ để tìm một người; tách từ rồi AND qua ba cột phức tạp mà ít lợi | tách từ như tìm tin |
| Số điện thoại trong `q` | `toPhoneNeedle`: bỏ khoảng trắng, dấu chấm, gạch; chỉ đổi `+84` hoặc `84` cộng đúng 9 chữ số về `0`; các dạng khác giữ chữ số đã gõ | `normalizePhone` đổi mọi chuỗi bắt đầu bằng `84` thành `0`, làm `q=84` khớp gần hết số | dùng thẳng `normalizePhone` |
| Mỗi bộ lọc | một giá trị | giống bộ lọc `status` của danh sách tin; FE chưa cần chọn nhiều | cho phép danh sách giá trị |
| Cách chọn cột | `select` liệt kê tám cột | mật khẩu băm không bao giờ rời database kể cả khi thêm cột mới | `omit` mật khẩu như `findById` |
| Header | `Cache-Control: private, no-store` | phản hồi có dữ liệu cá nhân; cùng cách `FavoritesController` | không đặt header |
| Nhật ký đọc | không ghi | `moderation_logs` dành cho hành động có đích; đọc danh sách không có đích | ghi mỗi lần admin mở danh sách |
| Đo quy mô | `EXPLAIN` một lần ở khoảng 50 nghìn người dùng, ghi số, không chỉnh | bạn đã nói đây là MVP không chạy thật | bỏ qua hẳn, hoặc thêm GIN ngay |
| Mã lỗi | không thêm | các mã hiện có đã đủ nghĩa | thêm `USER_SEARCH_INVALID` và tương tự |
