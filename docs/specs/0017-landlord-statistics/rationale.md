# 0017. Thống kê cho chủ trọ: lý giải và các phương án

Phần ghi lại vì sao chọn cách này. `/develop` không đọc file này; bản dùng để build nằm ở [index.md](index.md).

## Context

Chủ trọ hiện có rải rác vài con số: `GET /me/listings` cho tin của họ kèm cờ `isPublic`, `GET /me/membership` cho gói và hạn mức, `GET /landlords/:id` cho số người theo dõi, tổng lượt xem và điểm đánh giá công khai, `GET /me/conversations/unread-count` cho số chưa đọc. Không có chỗ nào cho họ biết tin được xem nhiều hay ít theo ngày, ai quan tâm, chat có được trả lời, hay mình đã chi bao nhiêu. Nếu FE tự ghép thì phải gọi nhiều route, tự đếm, tự tính phần trăm và tự điền ngày trống; scope (hàng 26) đã chốt ngược lại: BE tính sẵn để FE chỉ hiển thị. Số người theo dõi và lượt xem cũng là thứ giữ chủ trọ ở lại mua gói (mô hình kinh doanh ở scope), nên màn hình này có giá trị với bản demo.

Các ràng buộc đã có. Mọi số của dự án tính lúc đọc từ dòng thô (spec 0005, 0010, 0014), không có bộ đếm lưu sẵn và không có bộ lập lịch hay việc chạy nền (MVP, không chạy thật). Một "ngày" là ngày lịch giờ Việt Nam từ `APP_TIME_ZONE` (0010), và mốc thời gian đi vào SQL thô phải là chuỗi ISO có `Z` (bài học của 0003). Lượt xem theo ngày chỉ có từ spec 0016 và chỉ cho lượt xem sau đó. Bỏ lưu và bỏ theo dõi xóa dòng, đánh giá bị admin ẩn vẫn nằm trong bảng nhưng không còn công khai, trạng thái tin chỉ giữ giá trị hiện tại: nghĩa là lịch sử của nhiều con số không dựng lại được chính xác. Số liệu phải khớp các route công khai đã có (người theo dõi, lượt xem, điểm), nếu không chủ trọ sẽ thấy hai con số khác nhau cho cùng một thứ. Danh mục quyền yêu cầu mỗi tính năng thêm khóa của mình kèm migration.

Nếu không quyết bây giờ, FE hoặc phải tự tính (và sai ở các ca biên như tin xóa mềm, gói hết hạn, ranh giới ngày), hoặc mỗi con số mới lại thành một route riêng.

## Options considered

### Option 1: Một route `GET /me/statistics` tính lúc đọc, qua một `StatisticsRepository` chỉ đọc

Một lần gọi trả mọi nhóm số, kèm kỳ trước, phần trăm đổi và chuỗi theo ngày điền đủ. Mọi số tính lúc đọc từ bảng sẵn có; `StatisticsRepository` mới đọc nhiều bảng nhưng không ghi.

**Pros**:
- FE chỉ gọi một lần, mọi số cùng một thời điểm, không tự tính; không bảng, cột hay việc nền mới.
- Một chỗ duy nhất để đọc, kiểm và đo toàn bộ SQL thống kê; không đụng code của bảy module khác.
- Tổng của chuỗi và `value` đến từ cùng các dòng nên khớp nhau theo cách xây.

**Cons**:
- Phản hồi lớn và mỗi lần gọi chạy khoảng mười truy vấn.
- Luật công khai (đánh giá `visible`, người theo dõi `active`) viết lại lần thứ hai ngoài module chủ, có nguy cơ lệch về sau.
- Không có kỳ trước cho số trạng thái hiện tại, và số lưu hay theo dõi của kỳ cũ có thể giảm.

### Option 2: Nhiều route theo nhóm (tin, lượt xem, quan tâm, chat, gói)

Mỗi thẻ trên màn hình gọi route riêng, có thể nạp riêng và dùng khoảng ngày riêng.

**Pros**:
- Mỗi route nhỏ, dễ kiểm và dễ đo; một thẻ chậm không kéo cả màn hình.
- FE có thể bỏ thẻ không cần mà không tốn truy vấn.

**Cons**:
- Cần khoảng năm lần gọi cho một màn hình, các con số đến từ năm thời điểm khác nhau và FE phải giữ cùng một khoảng ngày cho cả năm; trái ý "mở một màn hình là thấy mọi con số".
- Năm controller, năm quyền hay một quyền dùng chung phải quyết, và lặp lại phần kỳ trước, phần trăm đổi và kiểm tham số.

### Option 3: Bảng tổng hợp theo ngày cho chủ trọ, cập nhật khi có sự kiện hoặc bằng việc nền

Một bảng như `landlord_daily_stats` (lượt xem, lưu, theo dõi, chat, chi tiêu mỗi ngày) được ghi mỗi khi có sự kiện hoặc chụp mỗi đêm; route chỉ đọc bảng này.

**Pros**:
- Đọc nhanh ở mọi quy mô, và có thể giữ lịch sử chính xác cho cả số trạng thái hiện tại (chụp mỗi ngày), nên so sánh kỳ trước đúng cho mọi con số.
- Bỏ lưu hay bỏ theo dõi không làm kỳ cũ đổi.

**Cons**:
- Phải sửa nhiều route đã build xong (lưu, theo dõi, chat, đánh giá, đơn) để ghi thêm, hoặc thêm bộ lập lịch mà dự án chưa có; mỗi chỗ ghi là một nguồn lệch số.
- Lịch sử chỉ bắt đầu từ ngày bảng có mặt và cần backfill; quá nặng cho bản demo, và "tính lúc đọc" đã là quy ước của dự án.

### Option 4: Một route, nhưng mỗi Repository chủ có thêm hàm thống kê

`StatisticsService` ghép kết quả của hàm mới trong `ListingsRepository`, `FavoritesRepository`, `LandlordsRepository`, `ChatRepository`, `ReviewsRepository`, `ListingReviewsRepository` và `OrdersRepository`.

**Pros**:
- Giữ đúng quy ước "bảng nào do Repository của module đó chạm"; dùng lại bộ lọc công khai sẵn có nên không lệch luật.

**Cons**:
- Sửa bảy module và bảy bộ test cho một route đọc; kéo theo nhiều phụ thuộc giữa các module (hoặc thêm `*DataModule`) và nguy cơ vòng import.
- Rải SQL thống kê khắp nơi, khó xem và khó đo một lần.

## Rationale

Option 1 vì ba lực của Context cùng chỉ về một hướng: màn hình phải ra bằng một lần gọi với số do BE tính (loại Option 2), dự án không có việc nền nên mọi số tính lúc đọc như 0005 và 0010 (loại Option 3), và đây là một route đọc nên không nên sửa bảy module (loại Option 4). Cái giá của Option 1 là luật công khai bị viết lại một lần nữa; ta chấp nhận và đặt ba AC so với `GET /landlords/:id` và `GET /me/conversations/unread-count` để lệch luật lộ ra ngay lúc kiểm, thay vì dựa vào việc nhớ sửa hai chỗ.

Việc chia số thành "theo kỳ" và "trạng thái hiện tại" là hệ quả trung thực của dữ liệu: không có bảng lịch sử trạng thái, nên con số "trước" của số trạng thái chỉ có thể là phỏng đoán. Bạn đã chọn không so sánh chúng (không ước lượng, không chụp theo ngày). Đây là điểm lệch duy nhất so với chữ của hàng 26, và đã được nêu ở Consequences.

Về khoảng ngày, mặc định 30 ngày và trần 366 ngày cho cả chuỗi lẫn truy vấn một giới hạn rõ, và kỳ trước cùng độ dài liền sát trước làm mọi phép so sánh có cùng nghĩa với mọi khoảng. Kết quả trả `previous` cùng `value` thay vì chỉ phần trăm, để FE hiện được cả hai và không phải đoán kỳ trước.

### Các quyết định tôi chốt thay bạn khi viết spec

Bạn có thể đổi bất kỳ điều nào ở bước review.
- **Quyền**: một khóa mới `statistic:read` cộng kiểm loại tài khoản `landlord` trong Service, không `@FreshAuth`. Lý do: số của chính người gọi, giống `GET /me/membership`; dự phòng: dùng `@FreshAuth` nếu muốn chủ trọ vừa bị khóa dừng xem ngay.
- **Giới hạn tần suất**: dùng lại nhóm `publicRead` (300 mỗi phút theo IP), không nhóm mới, như `GET /me/favorites`. Dự phòng: nhóm riêng theo người dùng nếu route bị lạm dụng.
- **Tỉ lệ trả lời**: so sánh bằng điểm phần trăm (`changePoints`), không dùng `changePercent`, vì "50% lên 60%" mà ra "+20%" dễ gây hiểu nhầm cho một con số vốn đã là phần trăm. Dự phòng: `changePercent` tương đối cho thống nhất với các số khác.
- **Chuỗi theo ngày điền đủ**: tổng từng cột bằng `value` tương ứng; kỳ trước lấy từ cùng một truy vấn phủ cả hai kỳ rồi tách trong code, để không có hai câu SQL tự mâu thuẫn.
- **Làm tròn bằng số nguyên**: giống `averageStars` (spec 0014), để kết quả không phụ thuộc cách số thực biểu diễn các nửa. Dự phòng: `ROUND` của DB, nhưng nhạy với kiểu số.
- **Lỗi khoảng ngày báo ở trường `to`**: cả `from` sau `to` lẫn quá 366 ngày, giống 0010. Kiểm nằm ở hàm thuần `resolveStatPeriod` vì mặc định phụ thuộc `now`, không phải ở decorator của DTO.
- **Hạn mức dựng trước, các truy vấn còn lại chạy song song**: `isPublic` của top cần hạn mức, và việc chạy song song giữ thời gian gọi gần bằng truy vấn chậm nhất. Dự phòng: chạy tuần tự nếu hồ bơi kết nối bị nghẽn khi đo.
- **`isPublic` tính trong SQL** bằng cùng luật hạng của `publicListingCondition`, thay vì kéo thêm `findEarliestVisibleIds` từ `ListingsRepository`, để không đụng module khác.
- **Tên khối và trường**: `period`, `listings`, `membership`, `views`, `interest`, `ratings`, `chat`, `spending`, `series`; số đếm đặt tên theo nghĩa (`newFavorites`, `repliedConversations`), nhất quán với `viewCount`, `followerCount` đã có.
- **Chia hai mốc**: mốc 1 cho đường chạy thông với tin, hạn mức, lượt xem, top tin và cột `views` của chuỗi; mốc 2 cho phần còn lại. Hợp với Skateboard và với thói quen của dự án (mỗi mốc một lần `/develop` rồi dừng review).
- **Đặt hai file trợ giúp trong `src/statistics/`**, chưa vào `src/common/`, vì mới có một nơi dùng; chuyển khi hàng 27 và 28 cần.
- **Tên migration**: `statistic_read_permission` ngày build, theo mẫu migration chat và đánh giá.
- **Không đổi seed**: dữ liệu `seed:demo` đã có lưu, theo dõi, đánh giá, chat và (từ spec 0016) lượt xem theo ngày; bước kiểm cuối chạy route với một chủ trọ demo để xem số có ý nghĩa.
