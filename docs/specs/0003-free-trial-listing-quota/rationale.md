# 0003. Dùng thử miễn phí và hạn mức tin của chủ trọ: lý giải

File này là bản ghi quyết định (vì sao, các phương án). `/develop` không đọc nó khi build; bản build nằm ở [index.md](index.md).

## Context

> ⚠️ Premise note: Spec này giả định có gói thành viên (hàng 10) để chốt cách tính hạn mức "khi có gói", nhưng hàng 10 chưa có spec, nên bảng `plans`, `orders`, `subscriptions` mới chỉ có tên và dự kiến cột ở 0005. Vì vậy spec này chỉ làm trọn phần dùng thử và hạn mức, đồng thời chốt sẵn hợp đồng cho phần gói: một hàm hạn mức (`MembershipsService.resolve`) và một mảnh SQL hiển thị có chỗ cắm nhánh gói, với thứ tự ưu tiên "gói, rồi dùng thử, rồi 0". Hàng 10 phải thiết kế nhánh đó vào hai chỗ này chứ không dựng thêm một đường kiểm quyền thứ hai. Giả định gói thay (không cộng với) hạn mức dùng thử khi còn hiệu lực.

Đây là chỗ hệ thống thu tiền (0001, mục Phạm vi MVP): người tìm trọ dùng miễn phí mãi, chủ trọ đăng ký miễn phí, được dùng thử một thời gian với vài tin, rồi muốn đăng nhiều hơn hoặc muốn tin còn hiện sau kỳ dùng thử thì phải mua gói. Nếu tin vẫn hiện sau kỳ dùng thử thì chủ trọ không có lý do mua, và nếu hạn mức chỉ chặn ở phía ghi thì chỉ cần bỏ tài khoản lập cái mới là lấy lại quyền (số điện thoại duy nhất đã chặn đường này ở đăng ký, 0001 con 0002).

Các ràng buộc đã có: đăng và hiện tin phải đếm đúng khi hai yêu cầu đến cùng lúc (0005 đã chốt khóa dòng `users` trong giao dịch); điều kiện hiển thị công khai phải suy ra lúc đọc từ chính các cột nên khóa tài khoản hay xóa mềm có hiệu lực ngay (0002, không cờ sao chép); hệ thống không có tiến trình nền và chạy một container; bản này là demo cho khoảng năm người dùng nên ưu tiên gọn, nhưng cổng thu tiền phải thấy được khi trình diễn. Bảng `settings` và các khóa `trial_days`, `trial_listing_limit` đã được đặt tên ở 0005 và 0001 nhưng chưa có cột lưu hạn dùng thử, mã lỗi, cách trả trạng thái cho FE, và cách xử lý chủ trọ vượt hạn mức; đó là phần quyết định ở đây.

Nếu không quyết: code sẽ tự đặt hạn dùng thử và mã lỗi mỗi chỗ một kiểu, và hàng 10 phải làm lại phần đếm tin.

## Options considered

### Option 1: Cột hạn dùng thử cố định lúc đăng ký, hạn mức suy ra lúc đọc, tin vượt hạn mức ẩn bớt theo hạng

`users.trial_ends_at` ghi một lần lúc đăng ký; hai tham số trong `settings`; hạn mức hiện hành tính ở một hàm; đăng và hiện tin kiểm hạn mức trong giao dịch khóa dòng `users`; điều kiện hiển thị công khai thêm vế "tin này nằm trong N tin `visible` đăng sớm nhất của chủ trọ, N là hạn mức hiện hành", viết thành mảnh SQL dùng chung.

**Pros**:
- Một định nghĩa duy nhất của "tin đang hiện công khai", đúng cả khi hết kỳ, hạ hạn mức hay (về sau) hết gói; không việc nền, không cờ lưu thừa.
- Thu tiền chặt: không có kẽ hở "đã đủ hạn mức nhưng tin cũ vẫn hiện mãi" khi admin hạ hạn mức hay gói hết trong lúc dùng thử còn.
- Hạn dùng thử cố định nên đổi `trial_days` không làm ai bất ngờ mất hay được thêm hạn.

**Cons**:
- Phía đọc công khai phải rời Prisma sang SQL thô hai bước, nhiều code và kiểu yếu hơn.
- Mỗi tin ứng viên phải đếm tin cùng chủ trọ, nên truy vấn chậm dần theo số tin (có ngân sách đo được).
- Chủ trọ có thể thấy tin biến mà không báo trước; phải thêm `isPublic` và API trạng thái để FE giải thích.

### Option 2: Như Option 1 nhưng tin đang hiện luôn giữ hiện, hạn mức chỉ chặn đăng và hiện thêm

Chỉ vế "hết kỳ dùng thử thì mọi tin biến" suy ra lúc đọc; còn khi hạn mức bị hạ thấp hơn số tin đang hiện (admin đổi tham số, gói hết mà dùng thử còn) thì các tin cũ vẫn hiện, chủ trọ chỉ bị chặn đăng hoặc hiện thêm cho đến khi tự ẩn bớt xuống dưới hạn mức.

**Pros**:
- Điều kiện hiển thị chỉ cần một so sánh `trial_ends_at > now`, nên viết được bằng điều kiện `where` của Prisma: không SQL thô, không truy vấn đếm theo từng tin, không đo hiệu năng.
- Không ai mất tin bất ngờ khi admin đổi tham số.

**Cons**:
- Một kẽ hở thu tiền: chủ trọ vượt hạn mức vẫn giữ nguyên số tin đã đăng; chỉ khi hết cả kỳ dùng thử mới biến.
- Hai luật riêng ("hết kỳ thì biến", "vượt hạn mức thì chỉ chặn thêm") phải giải thích với FE và người dùng.

### Option 3: Bảng `entitlements` riêng, một dòng cho mỗi kỳ dùng thử hoặc gói

Dùng thử và gói là cùng một loại bản ghi (`user_id`, `source`, `limit`, `starts_at`, `ends_at`); hạn mức hiện hành là bản ghi còn hiệu lực có hạn mức cao nhất hoặc mới nhất.

**Pros**:
- Dùng thử và gói chung một đường tính, hàng 10 không cần nhánh riêng; có sẵn lịch sử.
- Có thể gia hạn hoặc tặng dùng thử cho một chủ trọ cụ thể bằng cách thêm một dòng.

**Cons**:
- Thêm một bảng và một phép nối trong điều kiện hiển thị công khai, khi hàng 10 vẫn cần `subscriptions` và `orders` riêng để lưu hóa đơn.
- Phải tạo dòng cho mọi chủ trọ (cả cũ lẫn mới) và quyết thêm luật "bản ghi nào thắng", chưa ai cần ở bản demo.

### Option 4: Không lưu hạn, tính sống từ ngày đăng ký cộng `trial_days`

Không thêm cột: hạn dùng thử của mọi chủ trọ là `users.created_at + trial_days`.

**Pros**:
- Không thêm cột, không backfill, không bước điền hạn lúc đăng ký.

**Cons**:
- Admin đổi `trial_days` là đổi hạn của mọi chủ trọ ngay: người đã hết hạn có thể sống lại, người còn hạn có thể bị cắt giữa chừng; không thể đặt `trial_days = 0` để dựng cảnh demo mà không làm sập mọi tài khoản đang có.
- Khó giải thích với chủ trọ vì ngày hết hạn của họ thay đổi theo cài đặt của người khác.

## Rationale

Chọn Option 1. Các lực quyết định là: chủ trọ không có lý do mua nếu tin còn hiện sau kỳ dùng thử (nên hạn mức phải được thực thi ở phía đọc chứ không chỉ chặn đăng); không có việc nền (nên mọi thứ phải suy ra lúc đọc từ `now`); hàng 10 cần cắm gói vào mà không viết lại phần đếm (nên chỉ một hàm hạn mức và một mảnh điều kiện); và bản demo cần thấy được cổng thu tiền (nên `trial_days` phải đặt được về 0 mà không ảnh hưởng ai đã đăng ký). Cột `trial_ends_at` cố định lúc đăng ký thắng Option 4 vì cho phép đổi cài đặt mà không làm ai bất ngờ, và thắng Option 3 vì hạn dùng thử là thuộc tính của tài khoản, không cần một bảng khi hóa đơn và gói đã có bảng riêng ở hàng 10.

Bạn chọn luật "ẩn bớt theo hạng" (Option 1) thay vì "giữ nguyên tin đang hiện, chỉ chặn thêm" (Option 2), phương án mà mình đã đề xuất. Mình theo lựa chọn của bạn vì nó giữ đúng một luật duy nhất cho mọi trường hợp tin vượt hạn mức, kể cả hết kỳ (hạn mức 0). Cái giá bạn nhận có ý thức là: phía đọc công khai phải dùng SQL thô hai bước, truy vấn đếm tổng chậm dần theo số tin, và FE cần `isPublic` cùng API trạng thái để chủ trọ hiểu vì sao tin biến. Vì hiệu năng là rủi ro duy nhất chưa đo được, spec đặt ngân sách bằng con số (AC-13), hai phương án dự phòng theo thứ tự (chỉ mục một phần, rồi đếm theo chủ trọ một lần), và một lối thoát rõ ràng: nếu vẫn vượt thì quay lại `/architect` chứ không tự đổi luật.

Thứ tự "tin đăng sớm nhất còn hiện" chọn vì xếp theo `created_at` rồi `id` không đổi theo thời gian, nên chủ trọ đoán được tin nào biến và tin cũ đã có lượt xem không mất; muốn đổi tin nào hiện thì tự ẩn tin khác. Số tin đang hiện vẫn tính cả tin bị ẩn bớt, vì nếu không tính thì chủ trọ đăng thêm được ngay và tin mới lại bị ẩn, một vòng vô nghĩa.

Phần mình tự quyết khi viết spec (các mục RECOMMEND), mỗi mục kèm phương án thứ hai:
- **Đồng hồ**: dùng `now` của ứng dụng lấy một lần mỗi request rồi truyền vào SQL, thay vì `now()` của DB, vì một đồng hồ cho cả quyết định thì kiểm thử được bằng giá trị cố định. Phương án thứ hai là `now()` của DB, bỏ vì khó kiểm thử và dễ lệch giữa phần ứng dụng và phần SQL.
- **Đọc `settings` không đệm**: một lần tra khóa chính mỗi request, vì chỉ có hai khóa và một container. Phương án thứ hai là đệm trong bộ nhớ vài chục giây, bỏ vì thêm trạng thái cần vô hiệu hóa khi admin đổi.
- **Thiếu hoặc hỏng `settings` thì dùng mặc định và ghi log cảnh báo**, không 500: đăng ký và đọc công khai không được hỏng chỉ vì thiếu bước seed. Phương án thứ hai là báo lỗi hệ thống, bỏ vì làm sập mọi đường đọc công khai vì một dòng cấu hình.
- **Khoảng cho phép**: `trial_days` từ 0 đến 365, `trial_listing_limit` từ 0 đến 100; 0 cho phép để dựng cảnh hết quyền khi demo.
- **Thứ tự báo lỗi** sở hữu, rồi trạng thái, rồi quyền dùng, rồi hạn mức: lỗi đúng với yêu cầu của người gọi đến trước, không lộ tình trạng hạn mức khi họ đã gọi sai.
- **Thứ tự khóa** `users`, rồi `properties`, rồi `listings` trên mọi đường, để không có vòng chờ giữa đăng tin, hiện tin, sửa và xóa nhà trọ.
- **403 cho cả hai mã lỗi**: nguyên nhân là quyền của tài khoản chứ không phải trạng thái của tin (409) và 402 ít được thư viện FE hỗ trợ.
- **Admin không có kỳ dùng thử**: một quy tắc duy nhất "không có `trial_ends_at` và không có gói thì hạn mức 0", thay vì một ngoại lệ cho admin ở hai chỗ.

Các điểm bạn tự chọn trong buổi thiết kế (không phải mình quyết): kỳ dùng thử bắt đầu lúc đăng ký; hạn lưu thành cột lúc đăng ký; chủ trọ có sẵn nhận hạn tính từ lúc chạy migration (để tin trên bản demo hiện tại không biến bất ngờ); gói thay hạn mức dùng thử khi còn hiệu lực; tin vượt hạn mức ẩn bớt theo hạng, giữ các tin đăng sớm nhất; hai mã lỗi 403; nhà trọ vẫn tạo và sửa được khi hết dùng thử; một API riêng `GET /me/membership`; `GET /settings` cùng `PATCH /settings/:key` với `@FreshAuth()`; kiểu `value` là text kèm trình kiểm riêng từng khóa; cột `updated_at` và `updated_by`; admin không có dùng thử; cờ `isPublic` cho tin của chủ trọ.
