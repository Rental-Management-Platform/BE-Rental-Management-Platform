# 0009. Lý giải: danh sách tin đang hiện trên hồ sơ chủ trọ

Đây là phần ghi lại vì sao chọn như vậy. `/develop` không đọc file này; bản build nằm ở [index.md](index.md).

## Context

Hồ sơ công khai của chủ trọ (`GET /landlords/:id`, spec 0005) cho `publicListingCount`, tức là có bao nhiêu tin đang hiện, nhưng người xem không mở được danh sách các tin đó từ hồ sơ. Spec 0005 đã hoãn việc này và ghi rằng cần một bộ lọc theo chủ trọ. Hàng 16 của scope đưa nó vào kế hoạch.

Những điều đang ràng buộc cách làm:
- **Luật hiển thị công khai phức tạp và nằm ở đúng một chỗ.** Một tin hiện ra khi tin, nhà trọ, chủ trọ đều hợp lệ và tin nằm trong hạn mức hiệu lực của chủ trọ (kỳ gói đang chạy, hoặc dùng thử, xếp hạng theo thứ tự đăng). Luật này viết một lần thành hai mảnh SQL (`publicListingFrom` và `publicListingCondition`) và mọi đường đọc công khai dùng chung: danh sách, chi tiết, ảnh, số tin trên hồ sơ, danh sách đã lưu. Một bản sao thứ hai của luật sẽ sớm lệch.
- **Hồ sơ có hợp đồng chặt.** Spec 0005 AC-1 chốt đúng bảy trường, và FE đã dựng màn hình theo đó.
- **`GET /listings` chưa có bộ lọc theo chủ trọ.** Chỉ danh sách kiểm duyệt của admin có `landlordId`.
- **Phần tử phải giống thẻ tin của danh sách tìm trọ**, kể cả cờ `isFavorite`, để FE dùng lại một component (scope hàng 16, Done when).
- **Chủ trọ không hợp lệ phải ra cùng 404 như hồ sơ**, kể cả chủ trọ bị khóa, để không ai phân biệt được hai trường hợp.
- Bản này là MVP để demo, ưu tiên gọn, không việc nền, không hạ tầng mới. Một chủ trọ MVP chỉ có vài tin.

Nếu không quyết, người xem thấy "đang có 2 tin" mà không bấm vào đâu được, và FE phải tự đoán tin nào của chủ trọ bằng cách lọc phía client trên danh sách tìm trọ, việc không làm được vì danh sách phân trang.

## Options considered

### Option 1: Route lồng dưới hồ sơ, `GET /landlords/:id/listings`

Một API đọc riêng nằm cạnh hồ sơ. Service tra chủ trọ hợp lệ bằng đúng hàm của hồ sơ, rồi đọc trang tin bằng truy vấn danh sách công khai có sẵn với thêm một điều kiện theo chủ trọ.

**Pros**:
- Id sai định dạng ra `INVALID_ID` và chủ trọ không hợp lệ ra `LANDLORD_NOT_FOUND`, đúng như hồ sơ, không cần mã lỗi mới.
- `GET /listings` và hồ sơ giữ nguyên hợp đồng.
- Đúng cách nhìn "mở hồ sơ rồi xem tin" của scope; đường dẫn tự nói nghĩa.
- Điều kiện theo chủ trọ thêm vào truy vấn có sẵn, hai mảnh SQL công khai không đổi dòng nào.

**Cons**:
- FE gọi hai API để dựng trang hồ sơ.
- Thêm một route mới cần giữ trong Postman, tài liệu FE và test.

### Option 2: Bộ lọc `landlordId` trên `GET /listings`

Thêm tham số `landlordId` vào `ListListingsQueryDto` của danh sách công khai; FE gọi `GET /listings?landlordId=...`.

**Pros**:
- Không route mới; FE có luôn các bộ lọc và kiểu sắp xếp sẵn của danh sách tìm trọ.
- Một hợp đồng cho mọi danh sách tin công khai.

**Cons**:
- Id sai định dạng ra `VALIDATION_FAILED` chứ không phải `INVALID_ID`, lệch với hồ sơ.
- Chủ trọ không có hoặc bị khóa chỉ ra danh sách rỗng, không ra 404; muốn 404 như Done when thì phải thêm một lần tra chủ trọ vào đường đi của một route công khai nóng nhất.
- Có bộ lọc thì `total` không còn chắc bằng `publicListingCount`, vì người dùng có thể thêm `q` hay khoảng giá.
- Đổi hợp đồng của `GET /listings` để phục vụ một màn hình khác.

### Option 3: Cả hai route

Làm cả `GET /landlords/:id/listings` và bộ lọc `landlordId` trên `GET /listings`.

**Pros**:
- Linh hoạt nhất cho FE.

**Cons**:
- Hai hợp đồng cho cùng một dữ liệu, phải giữ giống nhau và test hai lần.
- Không có nhu cầu nào hiện nay cần cả hai; thêm sau rẻ hơn gỡ bớt.

### Option 4: Nhúng trang đầu vào chính `GET /landlords/:id`

Hồ sơ trả thêm mảng `listings` (vài tin đầu).

**Pros**:
- FE dựng trang hồ sơ bằng một lần gọi.

**Cons**:
- Phá hợp đồng "đúng bảy trường" của spec 0005 và làm hồ sơ nặng hơn cho mọi lời gọi, kể cả sau mỗi lần theo dõi và bỏ theo dõi (hai API đó trả lại hồ sơ).
- Phân trang bị lệch: trang đầu nằm trong hồ sơ, các trang sau lại phải có một API riêng, tức là vẫn phải làm Option 1.

## Rationale

Chọn Option 1. Lực quyết định là luật hiển thị công khai chỉ được viết một lần và hợp đồng bảy trường của hồ sơ. Option 1 giữ cả hai nguyên vẹn, và là cách duy nhất cho id sai và chủ trọ bị khóa ra đúng hai lỗi mà hồ sơ đã ra, nên FE xử lý một kiểu lỗi cho cả hai màn hình. Option 2 rẻ hơn vài dòng nhưng đổi hợp đồng của route công khai nóng nhất và mất cả hai lỗi đó. Option 4 phá hợp đồng đã chốt và vẫn buộc phải làm Option 1 cho các trang sau. Option 3 trả giá hai hợp đồng cho một nhu cầu mới có một. Thêm một route đọc là chi phí nhỏ so với việc FE không phải đoán, và sau này nếu cần bộ lọc thì Option 2 cộng thêm được mà không phá gì.

**Các quyết định nhỏ do tôi chốt** (bạn có thể đổi ở bước duyệt spec):
- **Chỉ phân trang, mới đăng trước, không bộ lọc, không `sort`** (bạn đã chọn): `total` luôn bằng `publicListingCount`, đúng Done when, và danh sách này ngắn nên lọc hay sắp theo giá chưa có việc. Phương án kế: nhận `sort` của `GET /listings`.
- **Code nằm ở `LandlordsService`, lọc ở Repository**: `PublicListFilter` thêm `landlordId`, `LandlordsService.listListings` gọi `findPublicPage`, đọc cờ qua `FavoritesDataModule`. Nhất quán với `getProfile` vốn đã gọi `ListingsRepository` trực tiếp, và không kéo cả `ListingsModule` (nhiều phụ thuộc) vào `LandlordsModule`. Cái giá là khoảng mười dòng gắn `isFavorite` nằm ở hai nơi. Phương án kế: export `ListingsService` và thêm một phương thức dùng chung `listPublicByLandlord`, hết trùng nhưng LandlordsModule kéo theo ListingsModule và các module của nó.
- **Dùng nhóm giới hạn `publicRead` có sẵn** (300 lần mỗi phút theo IP, như hồ sơ và danh sách tìm trọ): route này đọc rẻ hơn danh sách tìm trọ vì đã thu hẹp theo chủ trọ. Phương án kế: một nhóm riêng, không cần vì không có số liệu cho thấy một mức khác.
- **Giữ `landlord` trong mỗi phần tử**: đổi lại một kiểu phần tử duy nhất cho hai danh sách. Phương án kế: bỏ trường này, tiết kiệm vài chục byte mỗi dòng nhưng thêm một kiểu và một hàm ánh xạ.
- **`Cache-Control: private, no-store`**: bắt buộc vì `isFavorite` đổi theo người xem, như `GET /listings`.
- **Hiệu năng đo một lần rồi bỏ qua**: theo quyết định MVP đã ghi ở các spec trước, số đo vào `verify.md`, không chỉnh.
