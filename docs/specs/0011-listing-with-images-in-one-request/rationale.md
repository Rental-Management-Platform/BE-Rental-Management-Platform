# 0011. Lý giải: đăng tin kèm ảnh trong một lần gọi

Đây là phần ghi lại vì sao chọn như vậy. `/develop` không đọc file này; bản build nằm ở [index.md](index.md).

## Context

Spec 0002 chia việc làm hai bước: `POST /properties/:propertyId/listings` nhận JSON và tạo tin ngay (tin hiện công khai liền, không nháp), rồi `POST /listings/:id/images` nhận từng ảnh một cho một tin đã có. Hệ quả cho chủ trọ là phải đăng xong rồi vào sửa tin để thêm ảnh. Hệ quả cho dữ liệu tệ hơn: tin đã hiện và đã tính vào hạn mức khi chưa có ảnh nào, và nếu bước ảnh hỏng (mạng đứt, một ảnh sai loại, quá dung lượng) thì tin cứ ở đó không ảnh cho tới khi chủ trọ nhớ quay lại sửa. Tài liệu FE mô tả đúng cách làm này; chính API chưa có đường đăng tin kèm ảnh.

Những điều đang ràng buộc cách làm:
- **Ảnh nằm trên ổ đĩa, tin nằm trong database.** Hai nơi không chung giao dịch, nên "tất cả hoặc không gì cả" phải do Service tự bảo đảm bằng cách dọn tệp khi lỗi. Spec 0002 đã chấp nhận rủi ro tệp mồ côi khi tiến trình chết giữa chừng.
- **Đăng tin đã có cửa phức tạp**: khóa `users` rồi `properties`, kiểm sở hữu, kiểm dùng thử và hạn mức, sinh mã ngắn có thử lại khi trùng (spec 0002 và 0003). Cách mới không được làm yếu cửa này hay đảo thứ tự khóa.
- **Dự án chưa có việc nền** (không cron, không hàng đợi) và bản này là MVP để demo: không dựng hạ tầng chỉ để dọn dẹp.
- **Bạn đã chốt hai luật** ngày 2026-11-02: một ảnh lỗi thì hủy cả bài, và bắt buộc ít nhất 1 ảnh khi đăng. Luật thứ hai chỉ có nghĩa nếu không còn đường nào đăng tin không ảnh, nên ảnh hưởng thẳng tới việc đường JSON cũ còn hay mất.
- **FE là Next.js**: gửi tệp bằng `FormData` là việc tự nhiên và trình duyệt tự đặt `Content-Type` kèm ranh giới.
- **ValidationPipe toàn cục không đổi kiểu ngầm** (`transform: true`, không bật chuyển đổi ngầm), nên số trong multipart đến dạng chuỗi và `IsInt` sẽ từ chối; còn `Number('')` là 0, một cái bẫy lặng lẽ.

Nếu không quyết, chủ trọ tiếp tục đăng hai bước, tin không ảnh tiếp tục hiện ra với khách, và luật "bắt buộc ảnh" không có chỗ để áp dụng.

## Options considered

### Option 1: Đổi chính đường đăng tin sang multipart kèm ảnh

`POST /properties/:propertyId/listings` chỉ nhận `multipart/form-data`: các trường chữ cộng 1 đến 5 tệp ở trường `images`. Một giao dịch chèn tin và dòng ảnh, ghi tệp ở cuối, dọn tệp khi lỗi.

**Pros**:
- Chỉ một cách đăng tin, nên luật bắt buộc ảnh không đi vòng được.
- Tin và ảnh cùng có trước khi tin hiện; hạn mức, khóa và sinh mã dùng lại nguyên cửa hiện có.
- Không bảng, không migration, không việc nền; dùng lại `StorageService`, `detectImageType`, cấu hình multer.

**Cons**:
- Thay đổi phá vỡ: FE, bộ Postman và script kiểm đang gọi JSON phải đổi cùng đợt.
- Yêu cầu đăng tin nặng hơn nhiều (đến 25 MiB mặc định), giữ trong bộ nhớ.

### Option 2: Thêm đường mới, giữ đường JSON cũ

Thêm một route thứ hai (ví dụ `/properties/:propertyId/listings/with-images`) nhận multipart; đường cũ vẫn nhận JSON.

**Pros**:
- Không phá FE đang chạy; chuyển dần được.

**Cons**:
- Đường JSON vẫn đăng được tin không ảnh, nên luật bắt buộc ảnh chỉ còn là lời khuyên.
- Hai đường cho cùng một việc: hai bộ tài liệu, hai bộ test, và hai hành vi hạn mức phải giữ giống nhau.

### Option 3: Một đường nhận cả hai kiểu nội dung

Cùng route: JSON thì tạo tin không ảnh như cũ, multipart thì bắt buộc ảnh.

**Pros**:
- Không phá FE cũ, không thêm route.

**Cons**:
- Cũng đi vòng được luật bắt buộc ảnh (gửi JSON).
- Một route có hai hình dạng body: tài liệu, kiểm lỗi và đoán kiểu dữ liệu rối hơn.

### Option 4: Tải ảnh lên trước, rồi đăng tin tham chiếu ảnh đã tải

`POST /uploads` trả mã ảnh tạm; `POST .../listings` nhận JSON kèm danh sách mã ảnh.

**Pros**:
- Yêu cầu đăng tin nhỏ, JSON như cũ; FE tải ảnh song song và có thanh tiến trình từng ảnh.

**Cons**:
- Cần chỗ lưu ảnh tạm và một việc nền dọn ảnh tạm không ai dùng; dự án chưa có việc nền.
- Nhiều bề mặt API hơn (thêm route, thêm trạng thái "ảnh tạm", thêm mã lỗi), và vẫn phải kiểm "mã ảnh thuộc người này, chưa dùng".
- Vẫn là nhiều lần gọi từ phía FE, không đúng điều bạn muốn.

## Rationale

Option 1. Điều ràng buộc nhất là luật "bắt buộc ít nhất 1 ảnh" cùng với việc dự án không có việc nền. Option 2 và 3 giữ đường JSON nên luật chỉ là lời khuyên, đúng điều bạn muốn tránh. Option 4 cần ảnh tạm và một việc dọn ảnh tạm, hạ tầng mà bản MVP này đã chủ động không có. Cái giá của Option 1 là thay đổi phá vỡ, nhưng FE đang được dựng cùng lúc và bạn vừa chấp nhận phá để có một đường duy nhất; rủi ro được ghi ở Migration plan và Follow-up.

Các quyết định nhỏ do tôi (người viết spec) chốt, kèm phương án thứ hai:
- **Ghi tệp ở cuối giao dịch, sau mọi cửa.** Lý do: yêu cầu bị từ chối vì hết hạn mức hay sai chủ nhà trọ không ghi gì lên ổ đĩa, nên người dùng đã hết hạn mức không thể làm ổ đĩa quay vòng 25 MiB mỗi yêu cầu. Phương án thứ hai: ghi tệp trước giao dịch cho khỏi giữ khóa lúc ghi, đổi lại phải ghi rồi xóa cho mọi yêu cầu bị từ chối. Với ổ đĩa cục bộ và giao dịch mặc định 5 giây thì khóa giữ vài chục mili giây, nên chọn không ghi thừa.
- **Kiểm hình dạng ảnh trước khi chạm database**, nên `IMAGE_INVALID` đến trước 404 và 403 (khác đường tải ảnh lẻ). Lý do: lỗi đó chỉ phụ thuộc vào chính yêu cầu, cùng loại với `VALIDATION_FAILED` vốn đã đến trước kiểm chủ sở hữu, không lộ thông tin nào, và không giữ khóa nào để kiểm. Phương án thứ hai: kiểm chủ trước như đường tải ảnh lẻ cho đồng nhất, đổi lại giữ khóa lâu hơn hoặc tra database hai lần.
- **Số trong multipart đổi bằng một biến đổi riêng chỉ nhận chuỗi số thập phân thường**, thay vì bật chuyển đổi ngầm toàn cục. Lý do: bật toàn cục đổi hành vi mọi DTO khác và `Number('')` thành 0 lặng lẽ; `@Type(() => Number)` có cùng cái bẫy `''` thành 0. Phương án thứ hai: `@Type(() => Number)` từng trường, ngắn hơn nhưng để lọt `''` và `1e5`.
- **`IMAGE_INVALID` kèm `errors` theo từng ảnh** (bạn chọn) thay vì mã lỗi mới: dùng lại dạng `errors` có sẵn; ảnh sai là lý do bỏ cả bài nên người dùng cần biết ảnh nào.
- **Tên trường `images`, thứ tự gửi là thứ tự `position`, ảnh đầu là bìa** (bạn chọn): không có API đổi thứ tự ảnh (spec 0002), nên thứ tự lúc đăng là cách duy nhất chọn ảnh bìa.
- **Giữ nhóm giới hạn `listingWrite`**, không gộp với `listingImage`: một yêu cầu là một lần đăng; bộ đếm theo từng route (đã gặp ở spec 0009) nên gộp nhóm cũng không cộng dồn hai route. Phương án thứ hai: nhóm riêng cho đường đăng kèm ảnh, thêm một con số phải chọn mà chưa có số đo nào đòi hỏi.
- **Chặn xóa ảnh cuối bằng khóa dòng tin** (bạn chọn chặn): xóa trong giao dịch có `SELECT ... FOR UPDATE` như đường tải ảnh, vì đọc số ảnh rồi mới xóa mà không khóa thì hai lần xóa đồng thời hai ảnh cuối đều thấy "còn hai" và để lại tin 0 ảnh. Phương án thứ hai: không chặn (đơn giản hơn, không mã lỗi mới); bạn đã chọn chặn để tin đăng từ nay luôn còn ảnh.
- **Giao dịch đăng tin đặt `timeout` 15 giây và `maxWait` 5 giây** (kiểm chéo): mặc định của Prisma là 5 giây và 2 giây, mà giao dịch này phải chờ khóa dòng `users` sau các yêu cầu khác của cùng chủ trọ và còn ghi tệp; hết hạn giữa chừng sinh 500 dù không lỗi thật. Phương án thứ hai: giữ mặc định (đơn giản, nhưng dễ 500 khi đồng thời hoặc ổ đĩa chậm).
- **Lỗi ở commit thì kiểm tin còn không rồi mới xóa tệp** (kiểm chéo): nếu COMMIT đã tới PostgreSQL mà client chỉ thấy mất kết nối, việc dọn tệp theo thói quen sẽ xóa ảnh của một tin đã lưu và để lại tin hiện công khai với ảnh hỏng. Một truy vấn mới chỉ chạy ở nhánh lỗi nên không tốn gì ở đường thường. Phương án thứ hai: luôn xóa khi có lỗi (đơn giản hơn, sai trong ca hiếm này).
- **Ghi tệp tuần tự, không song song** (kiểm chéo): nếu ghi song song, một tệp lỗi đưa luồng vào bước dọn khi các tệp khác còn đang ghi, rồi chúng ghi xong sau khi đã xóa và để lại tệp mồ côi. Năm tệp nhỏ ghi tuần tự không đáng kể.
- **Đổi lỗi đọc multipart hỏng thành 400 `BAD_REQUEST` bằng một interceptor bọc ngoài** (kiểm chéo): Nest chỉ dịch lỗi của multer, còn lỗi của bộ đọc bên dưới (thiếu ranh giới, thân bị cắt) ra 500 như lỗi hệ thống dù do client. Gắn cả vào đường tải ảnh lẻ vì cùng lỗi. Phương án thứ hai: để nguyên (không thêm file, nhưng log 500 sai chỗ).
- **`LISTING_IMAGE_REQUIRED`** là tên mã lỗi mới, 409 như `LISTING_IMAGE_LIMIT`, vì lỗi nằm ở trạng thái của tin chứ không ở dữ liệu gửi lên.
