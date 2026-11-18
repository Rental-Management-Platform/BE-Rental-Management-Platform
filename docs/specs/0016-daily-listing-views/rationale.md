# 0016. Lượt xem tin đăng theo ngày: lý giải và các phương án

Phần ghi lại vì sao chọn cách này. `/develop` không đọc file này; bản dùng để build nằm ở [index.md](index.md).

## Context

Hôm nay mỗi tin chỉ có `listings.view_count`, một số cộng dồn. Nó được cộng bằng một câu `UPDATE` nguyên tử, sau khi `ViewDeduplicator` (một `Map` trong bộ nhớ) cho qua: mỗi người xem một lượt cho mỗi tin trong 30 phút, chủ tin không tính, tin phải `visible` và chưa xóa mềm (spec 0002 AC-13). Không có thời điểm của từng lượt nào được giữ lại, nên không ai, kể cả FE, biết tin được xem nhiều hay ít theo từng ngày. Hàng 26 (thống kê cho chủ trọ) cần một chuỗi theo ngày để vẽ biểu đồ và hiện chưa có gì để dựa vào.

Scope đã chốt hai điều: ngày tính theo giờ Việt Nam, và lịch sử chỉ bắt đầu từ lúc có chỗ ghi vì lượt xem cũ không có ngày nên không dựng lại được. Hai điều kiện "xong" cần giữ: mỗi lượt đã tính phải được ghi vào đúng ngày, và hai lượt cùng lúc không được mất hay đếm đôi. Nếu không quyết bây giờ, mỗi ngày trôi qua mà chưa ghi là một ngày lịch sử mất hẳn, vì không có cách dựng lại về sau.

Các ràng buộc của hệ thống hiện tại: câu cộng lượt xem chạy trên route công khai nóng nhất (chi tiết tin), và 0002 (đã Accept) ghi "`view_count` chỉ tăng, chỉ qua một câu `UPDATE`". Prisma 7 với adapter pg gửi tham số `Date` như giờ UTC không kèm múi giờ, nên mọi mốc thời gian đi vào SQL thô phải là chuỗi ISO có `Z` (bài học của 0003). `APP_TIME_ZONE` là định nghĩa duy nhất của "một ngày" (0010). Migration do bạn chạy tay nên API mới có thể khởi động trước khi có bảng. Dự án là bản MVP để demo: không có bộ lập lịch hay việc chạy nền, kiểm bằng script gọi thật và Newman, và đã quen đo ngân sách quy mô một lần rồi bỏ qua. `seed:demo` đặt `view_count` thẳng cho tin demo, và `--reset` bị khóa ngoại RESTRICT chặn nếu quên một bảng con mới.

## Options considered

### Option 1: Bộ đếm theo (tin, ngày), cộng cùng một câu SQL với `view_count`

Một bảng `listing_daily_views` có khóa chính (`listing_id`, `day`) và cột `views`. Câu cộng lượt xem trở thành một câu có CTE ghi dữ liệu: `UPDATE listings ... RETURNING` rồi `INSERT ... ON CONFLICT DO UPDATE` vào bảng ngày.

**Pros**:
- Hai con số cùng đổi hoặc cùng không đổi mà không cần giao dịch, nên "tổng các ngày bằng phần tăng của `view_count`" đúng theo cách xây, không phải theo hy vọng.
- Thêm đúng một upsert vào câu đã có, không thêm vòng đi về với DB; dòng nhỏ và ít (nhiều nhất một dòng cho mỗi tin mỗi ngày).
- Đọc theo khoảng ngày rẻ (quét theo khóa chính), không cần việc chạy nền.

**Cons**:
- Không có giờ, không tách khách với người đăng nhập, và đổi múi giờ sau này không chia lại lịch sử đã ghi.
- Phải viết SQL thô (Prisma client không có CTE ghi dữ liệu), khó đọc hơn.
- Sửa tay `view_count` ngoài câu này (như `seed:demo`) làm hai con số lệch, nên phải có quy ước riêng cho chỗ đó.

### Option 2: Cùng bộ đếm, nhưng hai câu trong một giao dịch

Giữ nguyên `UPDATE` hiện có, thêm một câu upsert riêng, bọc cả hai trong `TransactionRunner`.

**Pros**:
- Dễ đọc hơn, có thể dùng Prisma client cho phần upsert; vẫn đúng nguyên tử.

**Cons**:
- Thêm giao dịch (BEGIN và COMMIT, hai câu) trên route nóng nhất và giữ khóa dòng tin lâu hơn một chút.
- Dự án đã gặp cảnh báo của pg khi dùng Prisma trong giao dịch (bài học ở mốc 2 của hàng 8); tránh được nếu chỉ một câu.

### Option 3: Nhật ký từng lượt xem (một dòng cho mỗi lượt, có `viewed_at`)

Mỗi lượt đã tính chèn một dòng có thời điểm chính xác; biểu đồ gom bằng `GROUP BY` lúc đọc.

**Pros**:
- Giữ giờ chính xác, nên sau này vẽ theo giờ, đổi múi giờ hay tách khách với người đăng nhập đều được mà không phải ghi lại.

**Cons**:
- Một dòng cho mỗi lượt: bảng lớn nhanh nhất và mọi biểu đồ phải gom lại mỗi lần đọc.
- Vẫn phải cộng `view_count`, nên vẫn cần ghi hai nơi cùng lúc; không giải quyết được gì hơn Option 1 trong khi chẳng ai yêu cầu độ chính xác tới giờ.

### Option 4: Chụp `view_count` mỗi đêm bằng việc chạy nền rồi lấy hiệu hai lần chụp

Một việc chạy nền ghi `view_count` của mọi tin vào bảng ảnh chụp mỗi đêm; số của một ngày là hiệu của hai ảnh chụp liền nhau.

**Pros**:
- Không chạm đường ghi nóng; câu `UPDATE` cũ giữ nguyên.

**Cons**:
- Dự án không có bộ lập lịch, nên phải thêm một thành phần vận hành mới chỉ cho việc này.
- Một đêm lỡ job là mất trọn ngày, và "ngày" là ngày chụp chứ không phải ngày lượt xảy ra (lượt lúc 23:50 mà ảnh chụp lúc 00:10 thì rơi sang ngày sau).
- Trái với điều kiện "xong" của scope: lượt đã tính phải được ghi vào đúng ngày của nó ngay lúc đó.

## Rationale

Option 1 vì hai lực của Context kéo cùng một hướng: điều kiện "xong" đòi tổng các ngày khớp với phần tăng của `view_count` (nên hai ghi phải nguyên tử), và route chi tiết tin là đường nóng nhất (nên không thêm giao dịch hay vòng đi về). Một câu CTE ghi cả hai nơi trong một thao tác mà không cần giao dịch, nên Option 2 chỉ hơn ở độ dễ đọc, một lợi ích nhỏ so với phí vận hành trên route nóng. Option 3 trả giá lớn (một dòng cho mỗi lượt) để mua độ chính xác theo giờ mà không ai cần, còn Option 4 thêm một bộ lập lịch cho dự án chưa có, và không ghi đúng ngày của lượt. Cái giá của Option 1 (SQL thô, không có giờ) được chấp nhận vì SQL thô đã là cách của route này (0002, 0003), và scope chỉ hỏi số lượt mỗi ngày.

Các quyết định bạn đã chốt trong buổi thiết kế (không phải tôi tự quyết): chọn bộ đếm theo ngày thay vì nhật ký từng lượt; hàng này chỉ ghi, không có route đọc (hàng 26 thiết kế); lượt xem cũ để trống, không dồn vào một ngày và không chia đều; ghi hai nơi bằng một câu CTE; khi ghi lỗi thì request lỗi lớn như hôm nay thay vì nuốt lỗi (lý do: không đổi hành vi ngoài phạm vi hàng này, và việc quên chạy migration hiện ra ngay); giữ mãi, không có việc dọn; `seed:demo` rải `view_count` của mỗi tin qua các ngày từ ngày tạo tin để tổng khớp (cách rải cụ thể do tôi chốt, xem dưới).

Các quyết định nhỏ tôi tự chốt, mỗi cái kèm lý do và phương án thay thế:
- **Hình dạng spec**: thư mục (`index.md` cộng `rationale.md`, sau này thêm `verify.md`), như 0003 đến 0015, để mọi tính năng có cùng chỗ đặt bản kiểm. Thay thế: một file duy nhất, hợp với spec ngắn nhưng lệch khỏi thói quen của dự án.
- **Đồng hồ quyết định ngày**: `now` của request, đi vào SQL dạng chuỗi ISO có `Z` rồi đổi bằng `AT TIME ZONE` với `APP_TIME_ZONE`. Lý do: cùng đồng hồ mà luật hiển thị đã dùng, kiểm được biên 23:59 và 00:00 bằng đồng hồ giả, không phụ thuộc múi giờ phiên (bài học 0003), và cùng cách gom ngày với 0010. Thay thế: `now()` của DB (không cần tham số nhưng không kiểm biên được) hoặc tự tính chuỗi `YYYY-MM-DD` trong TypeScript (phải thêm một hàm đảo của `startOfDay`, và hai nơi cùng định nghĩa "ngày").
- **Kiểu cột `day`**: `date`. Lý do: dòng ít nhất, so sánh khoảng ngày trực tiếp, và scope chỉ cần theo ngày. Thay thế: gộp theo giờ bằng `timestamptz`, đổi múi giờ được nhưng gấp tới 24 lần số dòng.
- **Khóa ngoại**: RESTRICT, như mọi bảng con khác, vì tin chỉ xóa mềm và `seed:demo --reset` đã quen thêm bước xóa tay. Thay thế: CASCADE, tiện cho `--reset` nhưng cho phép xóa mất lịch sử bằng một câu `DELETE` thẳng.
- **Khóa và chỉ mục**: chỉ khóa chính (`listing_id`, `day`), không thêm `landlord_id` hay chỉ mục theo `day`. Lý do: đủ cho upsert và cho việc quét theo khoảng ngày của một tin; hàng 26 nối qua `listings` và `properties` khi đọc và quyết có cần chỉ mục hay không sau khi đo. Thay thế: chép `landlord_id` vào bảng ngày để cộng theo chủ trọ không cần nối, nhưng nhân đôi một sự thật.
- **Nơi đặt câu ghi**: trong `ListingsRepository.incrementViewCount`, cùng hàm hiện có, không tạo repository mới. Lý do: đó phải là một câu chạm hai bảng, tách ra sẽ buộc hai lần gọi. Thay thế: một `ListingDailyViewsRepository` riêng cho phần đọc của hàng 26, khi hàng đó cần.
- **Mô hình Prisma**: có `ListingDailyView` dù việc ghi là SQL thô, để migration và hàng 26 dùng chung một định nghĩa. Thay thế: chỉ SQL migration viết tay, nhưng sau đó `schema.prisma` lệch DB.
- **Cách chia lịch sử demo**: trọng số theo ngày lấy từ bộ sinh số riêng có hạt giống (nghiêng nhẹ về các ngày gần ngày tạo tin), làm tròn theo phần dư lớn nhất để tổng đúng bằng `view_count`. Lý do: biểu đồ demo có hình dạng thật thay vì phẳng, chạy lại ra cùng số, và không dịch các hàng demo đã có (bộ sinh số riêng, dựng ở cuối). Thay thế: chia đều mọi ngày, dễ kiểm hơn nhưng biểu đồ phẳng.

Đã đo hay chưa đo: chưa đo gì ở dung lượng; con số 22 triệu dòng và cỡ 2 GB trong Consequences là tính tay ở mức xấu nhất, không phải số đo.
