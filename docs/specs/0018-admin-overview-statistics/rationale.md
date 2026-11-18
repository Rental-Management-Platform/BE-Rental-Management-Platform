# 0018. Thống kê tổng quan cho admin: lý giải và các phương án

Phần ghi lại vì sao chọn cách này. `/develop` không đọc file này; bản dùng để build nằm ở [index.md](index.md).

## Context

Admin hiện chỉ có các route rời rạc: `GET /users` cho danh sách tài khoản (kèm `total` theo bộ lọc), `GET /moderation/listings`, `/moderation/reviews` và `/moderation/listing-reviews` cho việc kiểm duyệt, `GET /orders/all` và `GET /orders/revenue` cho đơn và doanh thu. Không có chỗ nào cho admin biết nền tảng có bao nhiêu tài khoản mỗi loại, bao nhiêu chủ trọ đang trả tiền hay đang dùng thử, tin đăng mới nhiều hay ít và ở phường nào, người dùng có xem, nhắn tin, đánh giá nhiều hơn tuần trước không. Nếu FE tự ghép thì phải gọi `GET /users` nhiều lần chỉ để lấy `total`, và không có cách nào lấy số theo ngày. Scope (hàng 27) đã chốt ngược lại: BE tính sẵn để FE chỉ hiển thị, và gom luôn mục "đếm theo loại và trạng thái" mà spec 0007 đã hoãn.

Các ràng buộc đã có. Mọi số của dự án tính lúc đọc từ dòng thô, không có bộ đếm lưu sẵn, không có việc chạy nền (MVP, không chạy thật). Một "ngày" là ngày lịch giờ Việt Nam từ `APP_TIME_ZONE`, và mốc thời gian đi vào SQL thô phải là chuỗi ISO có `Z` (bài học của 0003). Spec 0017 đã xây khoảng ngày, kỳ trước, phần trăm đổi và chuỗi điền đủ ngày cho chủ trọ, và đã dặn các hàng 27 và 28 dùng lại. Luật hiển thị công khai của tin (chủ trọ `active`, còn dùng thử hoặc có gói, hạng so với hạn mức) đã viết đúng một lần ở `src/listings/`. Quyền chỉ admin giữ đã có tiền lệ `order:report` (0010) và có bẫy: token cũ mang `module:manage` bung ra cả hành động mới, nên route chỉ an toàn nhờ `@FreshAuth()`. Admin còn xem dữ liệu của cả nền tảng nên một lỗi về phạm vi (quên một bộ lọc) ở đây không làm lộ số của người khác cho admin, nhưng ở đường của chủ trọ thì làm.

Nếu không quyết bây giờ, FE hoặc phải gọi nhiều route và tự cộng (sai ở các ca biên như tài khoản xóa mềm, gói hết hạn, ranh giới ngày), hoặc mỗi con số mới lại thành một route riêng.

## Options considered

### Option 1: Một route `GET /statistics/overview` tính lúc đọc, qua một `AdminOverviewRepository` chỉ đọc trong `src/statistics/`

Một lần gọi trả mọi nhóm số của nền tảng, kèm kỳ trước, phần trăm đổi và chuỗi theo ngày điền đủ. Mọi số tính lúc đọc từ bảng sẵn có; Repository mới chỉ đọc, dùng lại hai hàm của 0017 và luật công khai của `src/listings/`.

**Pros**:
- FE chỉ gọi một lần, mọi số cùng một thời điểm, không tự tính; không bảng, cột, chỉ mục, migration hay việc nền mới.
- Một chỗ duy nhất để đọc, kiểm và đo toàn bộ SQL tổng quan; đường admin tách khỏi đường chủ trọ.
- Tổng của chuỗi và `value` đến từ cùng các dòng nên khớp nhau theo cách xây; `public` dùng thẳng luật gốc nên không lệch.

**Cons**:
- Phản hồi lớn và mỗi lần gọi chạy khoảng mười lăm truy vấn, nhiều cái quét bảng vì không có chỉ mục theo `created_at`.
- Không có kỳ trước cho số trạng thái hiện tại; số lưu và theo dõi của kỳ cũ có thể giảm.
- Hai màn hình (chủ trọ và admin) đếm khác quy tắc cho cùng một chữ.

### Option 2: Nhiều route theo nhóm (tài khoản, tin, tương tác, việc cần xử lý)

Mỗi thẻ trên màn hình gọi route riêng, có thể nạp riêng.

**Pros**:
- Mỗi route nhỏ, dễ kiểm và đo; một thẻ chậm không kéo cả màn hình.
- FE bỏ được thẻ không cần mà không tốn truy vấn.

**Cons**:
- Cần khoảng bốn lần gọi cho một màn hình, các con số đến từ bốn thời điểm khác nhau và FE phải giữ cùng khoảng ngày cho cả bốn; trái ý "mở một màn hình là thấy mọi con số".
- Lặp lại phần kiểm tham số, `@FreshAuth()`, kỳ trước và phần trăm đổi ở mỗi controller.

### Option 3: Tổng quát hóa `GET /me/statistics`: dùng lại các truy vấn của chủ trọ với `landlordId` để trống cho admin

Một Repository, một bộ truy vấn; admin gọi không kèm chủ trọ thì ra số của cả nền tảng.

**Pros**:
- Ít code mới nhất; luật đếm của hai màn hình luôn là một.

**Cons**:
- Các truy vấn của 0017 áp luật công khai (người theo dõi `active`, đánh giá `visible`) và lọc theo chủ trọ ở từng câu; bỏ lọc thì phải sửa từng câu và chỉ một câu quên lọc là đủ làm số của người khác lộ ra ở đường của chủ trọ.
- Nhiều khối của admin (tài khoản, nhóm chủ trọ theo gói, phường, việc cần xử lý) không có chỗ trong bộ truy vấn của chủ trọ nên vẫn phải thêm; kết quả là một Repository lẫn hai việc.

### Option 4: Bảng tổng hợp theo ngày cập nhật bằng sự kiện hoặc việc nền

Một bảng như `platform_daily_stats` được ghi mỗi khi có sự kiện hoặc chụp mỗi đêm; route chỉ đọc bảng này.

**Pros**:
- Đọc nhanh ở mọi quy mô, giữ được lịch sử chính xác kể cả cho số trạng thái hiện tại, nên so sánh kỳ trước đúng cho mọi con số.

**Cons**:
- Phải sửa nhiều route đã xong để ghi thêm, hoặc thêm bộ lập lịch mà dự án chưa có; mỗi chỗ ghi là một nguồn lệch số, và cần backfill.
- Quá nặng cho bản demo, và "tính lúc đọc" đã là quy ước của dự án.

## Rationale

Chọn Option 1. Hàng 27 muốn đúng một màn hình với mọi số cùng thời điểm, nên route đơn thắng Option 2 ngay từ đầu; và 0017 đã trả giá để có sẵn khoảng ngày, kỳ trước, phần trăm đổi và chuỗi điền đủ ngày, nên dùng lại rẻ và cho hai màn hình cùng cách tính. Option 4 vẫn loại vì cùng lý do với 0017: dự án chưa có việc nền và đây là bản demo không chạy thật, trong khi cái giá của "tính lúc đọc" (khoảng mười lăm truy vấn quét bảng ở cỡ vài chục nghìn dòng) là thứ bạn đã chọn đo một lần rồi bỏ qua.

Option 3 hấp dẫn vì ít code, nhưng nó đổi một rủi ro nhỏ lấy một rủi ro lớn. Với admin, thiếu một bộ lọc không có hại gì; còn ở đường của chủ trọ, đúng một câu SQL bị bỏ lọc là chủ trọ thấy số của người khác. Tách hẳn `AdminOverviewRepository` nghĩa là đường của chủ trọ không bao giờ có chế độ "bỏ lọc", và đổi lại ta chỉ chịu thêm code. Cùng lý do với việc không áp luật công khai ở màn hình admin: admin đếm mọi dòng để thấy hoạt động thật, và nhờ vậy không có thêm bản sao nào của luật công khai để lệch (0017 đã chịu hai bản sao; bản thứ ba sẽ là lần thứ ba phải nhớ cập nhật). Riêng `public` thì không viết lại, import thẳng hai hàm đã `export` nên luật vẫn viết đúng một lần.

Quyền theo mẫu `order:report`: một hành động chỉ admin nằm trong module sẵn có, cộng `@FreshAuth()` bắt buộc. Nó thêm bẫy token cũ nhưng bẫy này đã có tiền lệ, đã có test (0010) và đã được ghi lại, nên rẻ hơn mở thêm một module quyền mới.

## Calls I made for you (đổi được)

Những chỗ tôi tự quyết lúc viết spec vì cần toàn cảnh thiết kế. Nếu bạn muốn khác, nói và tôi sửa spec trước khi build.

- **Khóa quyền**: `statistic:report`, hành động chỉ admin trong module `statistic` có sẵn (cùng mẫu `order:report`). Phương án thay: một module quyền riêng chỉ admin, bỏ được bẫy token cũ nhưng thêm một mục danh mục; chọn mẫu có sẵn vì đã được kiểm.
- **Chỗ đặt code**: trong `src/statistics/` cùng module với 0017 (hai controller, hai service, hai repository). Phương án thay: module `src/admin-statistics/` cộng việc chuyển hai file trợ giúp sang `src/common/`; chọn cách đầu vì không phải di chuyển gì và hàng 28 có thể dùng lại tại chỗ.
- **Không `@RateLimited`**: như `GET /users` và `GET /orders/all`, route chỉ admin và đã đọc lại database mỗi lần gọi. Phương án thay: dùng nhóm `publicRead` như màn hình chủ trọ.
- **Không kiểm loại tài khoản trong Service**: như 0010; quyền chỉ admin không cấp được cho loại khác và `@FreshAuth()` đã đọc lại tài khoản. Có kiểm tra bằng token chủ trọ ký tay ở bước kiểm thật.
- **Đăng ký mới chỉ gồm chủ trọ và người tìm trọ**, bỏ `admin` (không bao giờ tự đăng ký), và đếm cả tài khoản sau đó bị xóa mềm; số hiện có thì bỏ tài khoản xóa mềm. Tin mới cũng đếm cả tin xóa mềm: "đăng mới" là hoạt động đăng bài, xóa sau không làm nó không xảy ra.
- **`createdByWard` chỉ có kỳ này**, mọi phường có tin mới, không cắt top, sắp `count` giảm dần rồi `wardCode` tăng dần. Cộng lại đúng bằng `listings.created.value` nên không cần dòng "khác". Phương án thay: top 10 kèm dòng "khác", tiết kiệm payload nhưng phức tạp hơn mà tối đa chỉ vài trăm phần tử.
- **`toHandle` chỉ đếm số bị admin ẩn**; tin bị chủ trọ ẩn là chuyện của chủ trọ. Đánh giá đang ẩn đếm mọi dòng `hidden_by_admin`, cùng cách danh sách kiểm duyệt của admin liệt kê (không áp luật công khai).
- **Khung theo ngày không kèm dòng tổng toàn thời gian**: khối này không có số toàn thời gian nên bỏ được một lần quét thêm mỗi nguồn. `dailyWithTotal` của 0017 giữ nguyên.
- **Không có số toàn thời gian cho tương tác**: hàng 27 chỉ liệt kê số theo kỳ; số hiện có chỉ có cho tài khoản, chủ trọ theo gói, tin và việc cần xử lý.
- **Tên khóa**: `registered`, `onPlan`, `onTrial`, `trialExpired`, `visibleButNotPublic`, `createdByWard`, `toHandle`; `engagement.follows` và `engagement.favorites` (số dòng) khác `interest.newFollowers` của chủ trọ (số người theo dõi `active`).
- **Hai mốc**: Mốc 1 đủ để admin dùng ngay (tài khoản, chủ trọ, tin, lượt xem), Mốc 2 thêm năm nguồn tương tác, việc cần xử lý và các cột còn lại, giống cách 0017 chia.
- **Không đổi `src/listings/`**: `public` import `publicListingFrom` và `publicListingCondition` đã `export` sẵn, nên cả việc chạm sang module khác lẫn việc viết lại luật đều không xảy ra.
