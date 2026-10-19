# 0004. Mua gói bằng thanh toán thử và gia hạn theo tháng: lý giải

File này là bản ghi quyết định (vì sao, các phương án). `/develop` không đọc nó khi build; bản build nằm ở [index.md](index.md).

## Context

> ⚠️ Premise note: Thanh toán thử nghĩa là chủ trọ tự bấm xác nhận đơn của mình, không có tiền thật và không có cổng thanh toán, nên trạng thái `paid` **không chứng minh đã thu tiền**, và hệ thống chưa tạo ra doanh thu. Spec này chỉ chứng minh luồng (đơn, kỳ gói, hạn mức, tin hiện lại), đúng với mục tiêu demo ở 0001. Muốn thu tiền thật sau này phải thêm cổng thanh toán ở hai bước tạo và xác nhận đơn, kèm webhook có chữ ký và khóa chống trùng; mô hình đơn và kỳ gói ở đây được dựng để phần thêm đó không phải đổi lại bảng.

Đây là nửa còn lại của chỗ thu tiền (0003 lo nửa đầu: dùng thử và hạn mức). Sau kỳ dùng thử, chủ trọ muốn tin còn hiện hoặc muốn đăng nhiều hơn 2 tin thì phải có một gói đang chạy. 0003 đã chừa sẵn hai chỗ cắm: một hàm hạn mức (`MembershipsService.resolve`) và một mảnh SQL hiển thị công khai, cùng thứ tự ưu tiên "gói, rồi dùng thử, rồi 0". 0001 và 0005 cũng đã chốt phần lớn: ba bảng `plans`, `orders`, `subscriptions`, tiền là số nguyên đồng, giá và số tin chốt vào đơn lúc tạo, đơn có `code` duy nhất và ba trạng thái, thanh toán nằm trong một giao dịch khóa dòng đơn, quyền `plan`, `order`, `subscription` đã có sẵn trong danh mục và quyền mặc định của chủ trọ.

Những điều còn để lại cho spec này: cột chi tiết của ba bảng, các luật khi mua lặp (đang có gói, đang có đơn chờ, bấm hai lần), ai được hủy đơn và hủy khi nào, gói bị tắt hay bị sửa giữa chừng, cách tính thời gian của các kỳ nối tiếp, hợp đồng API, và cách cắm gói vào hàm hạn mức mà không dựng đường kiểm quyền thứ hai. Bản này là demo cho khoảng năm người dùng, ưu tiên gọn, nhưng cổng thu tiền phải thấy được khi trình diễn: chủ trọ hết dùng thử thấy tin biến, mua gói, thấy tin hiện lại ngay.

Nếu không quyết: hạn mức gói sẽ bị kiểm ở nhiều nơi, kỳ gói có thể chồng nhau khi bấm đồng thời, và sửa bảng giá có thể âm thầm đổi hạn mức của người đã mua.

## Options considered

### Option 1: Ba bảng, đơn chốt giá, kỳ gói nối tiếp và DB chặn chồng kỳ, hạn mức qua kỳ đang chạy

`plans` (bảng giá), `orders` (mỗi lần mua một dòng, chốt tên, giá, số tin, số ngày), `subscriptions` (mỗi đơn đã trả một kỳ `starts_at` đến `ends_at`). Thanh toán là một giao dịch khóa `users` rồi dòng đơn, đổi đơn thành `paid` và chèn kỳ nối vào cuối kỳ trước. Hạn mức hiện hành là `max_listings` của đơn của kỳ đang chạy.

**Pros**:
- Khớp mô hình đã chốt ở 0001 và 0005; lịch sử đơn và lịch sử kỳ giữ nguyên dù admin sửa hay tắt gói.
- Chống chồng kỳ và đơn chờ nhân bản ở chính DB (ràng buộc loại trừ, chỉ mục duy nhất một phần), không phụ thuộc kỷ luật của code.
- Gói cắm vào đúng hai chỗ 0003 đã chừa; hàng 11 và 12 dùng lại mảnh điều kiện nên tự đúng.

**Cons**:
- Ba bảng và một phần mở rộng (`btree_gist`) cho một luồng mà demo chỉ cần "có gói hay không".
- Ràng buộc loại trừ là thứ Prisma không diễn đạt được: có rủi ro lệch khi `migrate diff`.
- Thêm một phép nối `LATERAL` vào đường đọc công khai vốn đã nặng.

### Option 2: Một bảng `subscriptions` có cột trạng thái, không có bảng `orders`

Bấm "mua" là chèn thẳng một dòng `subscriptions` đã `paid`, mang luôn tên gói, giá, số tin. Không có bước đơn chờ.

**Pros**:
- Ít bảng, ít API: không tạo đơn, không hủy đơn, không đơn chờ; luồng chỉ một lệnh.
- Không cần chỉ mục duy nhất một phần cho đơn chờ.

**Cons**:
- Bỏ luồng "tạo đơn rồi bấm thanh toán" mà 0001 và scope đã chốt, mất chỗ cắm cổng thanh toán thật (tạo đơn, rồi xác nhận khi cổng báo về).
- Dồn dữ liệu đơn (giá, mã) và dữ liệu kỳ (thời gian) vào một dòng nên khó thêm hoàn tiền hay đơn lỗi về sau.

### Option 3: Ghi gói thẳng vào `users` (`plan_id`, `plan_ends_at`)

Mua gói chỉ là đặt hai cột trên chủ trọ; gia hạn cộng ngày vào `plan_ends_at`.

**Pros**:
- Đơn giản nhất: không bảng mới, không phép nối, hạn mức đọc từ chính dòng `users`.
- Điều kiện hiển thị công khai chỉ thêm một so sánh cột.

**Cons**:
- Mất lịch sử: không có đơn, không biết ai mua gói nào lúc nào với giá nào; không đối soát được.
- Không nối được hai gói khác nhau (gia hạn ghi đè), và sửa giá hay số tin của gói đổi ngay hạn mức của mọi người đã mua.
- Không có chỗ cho đơn chờ, hủy đơn hay cổng thanh toán thật.

### Option 4: Xác nhận thanh toán bằng webhook giả lập hoặc cổng thật ngay từ bản này

Có endpoint nhận kết quả thanh toán từ bên ngoài, kèm chữ ký và khóa chống trùng, ngay cả khi cổng chỉ là giả lập.

**Pros**:
- Luồng giống thật nhất; demo được cả trường hợp thanh toán thất bại.

**Cons**:
- Trái quyết định ngày 2026-10-11 (bỏ VNPay, thanh toán thử, không biến môi trường mới) và thêm bảng `payments`, bí mật, endpoint công khai cần chống giả mạo, cho một bản không có tiền thật.

## Rationale

Chọn Option 1. Các lực quyết định là: 0001 và 0005 đã chốt ba bảng và luồng đơn rồi thanh toán, nên Option 2 và 3 phải lật lại quyết định đã được bạn Accept; chỗ này là nơi thu tiền nên lịch sử đơn và giá chốt là phần đáng giữ ngay cả ở bản demo; 0003 đã chừa đúng hai chỗ cắm nên chi phí của Option 1 ở phía đọc thấp (một nhánh trong `resolve`, một biểu thức trong mảnh SQL); và hai lỗi dễ xảy ra nhất của luồng này, kỳ chồng nhau và bấm đúp tạo hai gói, cần một chốt cuối ở DB chứ không chỉ ở code. Option 4 bị loại vì quyết định bỏ cổng thanh toán là của bạn và còn hiệu lực; mô hình đơn và kỳ ở Option 1 đủ để thêm cổng sau mà không đổi bảng.

Luật nối tiếp "mọi đơn cộng vào cuối, bất kể gói" được chọn thay cho "khác gói thì chạy ngay và cắt gói cũ" vì chỉ cần một luật, không mất ngày đã trả, không cần quyết chuyện hoàn tiền hay tính chênh lệch. Cái giá bạn nhận có ý thức là nâng lên gói lớn hơn khi đang có gói phải chờ gói cũ hết. Một đơn một kỳ (không có số lượng) cũng vì lý do giữ gọn: muốn ba tháng thì mua ba lần và các kỳ tự nối. Đơn chốt giá, số tin, số ngày thay vì đọc sống từ gói vì lịch sử đơn phải đúng với lúc mua và vì việc admin sửa bảng giá không nên âm thầm đổi hạn mức của người đã trả tiền. Cái giá là một nhóm cột bản chốt trên `orders` (hồ sơ lịch sử, không phải bản sao phải giữ khớp). Bấm thanh toán lần hai trả 200 cùng kết quả vì đó là thao tác lành tính (bấm đúp, mạng chậm) và cách này không cần khóa idempotency riêng khi đã có khóa dòng đơn.

Phần mình tự quyết khi viết spec (các mục RECOMMEND), mỗi mục kèm phương án thứ hai:
- **Ràng buộc loại trừ ở DB cho chồng kỳ** (bạn đã chọn): `EXCLUDE USING gist` trên `(user_id, tstzrange(starts_at, ends_at))`. Phương án thứ hai là chỉ khóa `users` ở ứng dụng, bỏ vì DB không đảm bảo khi code sót khóa. Đã kiểm `btree_gist` là phần mở rộng "tin cậy" có sẵn trên Postgres 18.1, role chủ database tạo được như `pg_trgm`. Rủi ro còn lại là Prisma báo lệch, có lối thoát ghi ở Build plan bước 1 và Follow-up.
- **Khoảng nửa mở `[starts_at, ends_at)`**: kỳ đang chạy khi `starts_at <= now < ends_at`, đúng lúc `ends_at` là hết, giống cách so chặt `trial_ends_at` ở 0003. Hai kỳ liền nhau (`ends_at` trước bằng `starts_at` sau) không bị coi là chồng.
- **Kỳ gói không lưu tên gói và số tin**, đọc qua `order_id` từ đơn đã chốt: một nguồn sự thật, không bản sao. Phương án thứ hai là copy `max_listings` sang kỳ để đọc nhanh hơn, bỏ vì thêm cột phải giữ khớp mà đơn không bao giờ đổi.
- **Thanh toán khóa `users` của người gọi trước rồi mới khóa đơn**: serialize mọi lần mua của cùng một chủ trọ, nên `MAX(ends_at)` đọc ra không đổi trước khi chèn kỳ. Phương án thứ hai là chỉ khóa đơn, bỏ vì hai đơn khác nhau của cùng chủ trọ (một vừa tạo, một vừa trả) có thể đọc cùng `MAX(ends_at)` và tạo hai kỳ cùng bắt đầu; ràng buộc loại trừ sẽ bắt được nhưng người dùng nhận lỗi thay vì kết quả đúng.
- **Admin không tạo được đơn** dù có mọi quyền trong code (`ADMIN_PERMISSIONS`): `OrdersService.create` kiểm `accountType` là `landlord`. Phát hiện lúc viết spec: nếu không, admin mua gói là đăng tin và tin hiện công khai, phá luật "mỗi loại tài khoản một vai" và "admin không có kỳ dùng thử" của 0003. Phương án thứ hai là bỏ `order:*` khỏi `ADMIN_PERMISSIONS`, bỏ vì hệ thống quyền hiện không có khái niệm "module chỉ chủ trọ" và thêm nó là một thay đổi lớn hơn một dòng kiểm.
- **`GET /plans/all` cho admin, `GET /plans` công khai chỉ gói đang bán**: hai route rõ quyền thay vì một route có tham số `includeInactive` đọc đăng nhập tùy chọn. Phương án thứ hai là một route duy nhất, bỏ vì trộn đường công khai và đường có quyền.
- **`@FreshAuth()` cho ba lệnh ghi gói**: giá và hạn mức của gói quyết định ai đăng được bao nhiêu tin, cùng lý do với `PATCH /settings/:key` ở 0003. Phương án thứ hai là không cần, bỏ vì chi phí gần bằng không.
- **Hủy đơn đã hủy trả 200, hủy đơn đã trả trả 409**: nhất quán với việc bấm thanh toán lại trả 200. Hoàn tiền đã hoãn khỏi MVP nên không hủy được đơn `paid`.
- **Phân trang cả `GET /plans`**: quy ước "mọi danh sách đều phân trang"; số gói nhỏ nên một trang đủ. Phương án thứ hai là trả mảng trần như `GET /settings`, bỏ vì số gói không cố định như hai khóa tham số.
- **Khoảng giá trị**: `price` từ 0 đến 100.000.000 (cho phép gói giá 0 để dựng demo), `max_listings` từ 1 đến 1000, `duration_days` từ 1 đến 365, `name` dài 2 đến 60 và duy nhất. Số tin của gói tối thiểu 1 vì gói 0 tin vô nghĩa (muốn ngừng bán thì tắt gói).
- **`code` của đơn**: 8 ký tự cùng bảng chữ và cùng cách sinh, thử lại khi trùng với mã tin ở 0002. Dùng lại cơ chế đã kiểm chứng thay vì định dạng mới.
- **`trialDaysLeft` theo `trialEndsAt`, không theo `state`**: `state` nay có thể là `plan` trong khi dùng thử còn, nên tính theo `state` sẽ trả 0 sai. Đổi nhỏ, hợp đồng bảy trường của 0003 giữ nguyên.
- **`/me/membership.subscription` có `paidUntil`**: kỳ nối tiếp nên chủ trọ cần biết đã trả đến ngày nào, không chỉ kỳ hiện tại hết khi nào. Phương án thứ hai là thêm `GET /me/subscriptions` (bạn đã chọn không thêm route).
- **Mua gói không đổi `trial_ends_at`**: gói thay hạn mức khi còn hiệu lực, hết gói mà dùng thử còn thì quay lại; với mặc định 30 ngày dùng thử thường hết trước khi gói đầu tiên hết. Phương án thứ hai là kết thúc dùng thử khi mua, bỏ vì thêm ghi vào `users` trong giao dịch thanh toán mà không có lợi ích rõ.
- **Thứ tự báo lỗi của `pay`**: sở hữu, rồi trạng thái đơn, rồi gói còn bán; lỗi đúng với yêu cầu đến trước, không lộ tình trạng gói khi đơn không phải của người gọi.
- **Giới hạn tần suất `orderWrite` 30 lần mỗi giờ** (bạn đã duyệt): cùng cỡ `propertyWrite`; mỗi route đếm riêng như `listingWrite`.

Các điểm bạn tự chọn trong buổi thiết kế (không phải mình quyết): mọi đơn nối tiếp sau gói đang chạy; đơn chốt giá, số tin, số ngày lúc tạo; tạo đơn mới thì tự hủy đơn chờ cũ (tối đa một đơn chờ); bấm thanh toán lần hai trả 200; thanh toán đơn của gói đã tắt bị chặn bằng 409; xóa gói chỉ khi chưa có đơn nào; một kỳ mỗi đơn; ba gói mẫu 5, 15, 50 tin giá 99.000, 199.000, 399.000 đồng; không thêm mô tả hay thứ tự cho gói, bảng giá xếp theo giá tăng dần; ràng buộc loại trừ ở DB chống chồng kỳ; `orderWrite` 30 lần mỗi giờ; không thêm route lịch sử kỳ gói; không có mục Tham chiếu (References).
