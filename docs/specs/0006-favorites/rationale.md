# Rationale: 0006. Lưu tin yêu thích của người tìm trọ

Đây là hồ sơ quyết định (vì sao), `/develop` không cần đọc. Bản build nằm ở [index.md](index.md).

## Context

> ⚠️ Premise note: Lưu yêu thích chỉ là tiện ích cho người tìm trọ nhớ lại một tin. Chủ trọ không thấy ai lưu tin của mình, không có thông báo khi giá đổi hay tin biến mất, nên tính năng này không giúp giữ chủ trọ ở lại mua gói như hàng 11 định làm với số người theo dõi. Thêm nữa, tin bị ẩn thì biến lặng lẽ khỏi danh sách đã lưu và người dùng không được báo vì sao, nên một danh sách ngắn đi có thể gây khó hiểu. Khung đúng là coi đây là một chức năng nhỏ, gọn, để người tìm trọ không phải ghi chú tin ở nơi khác; chưa đầu tư vào số lượt lưu cho chủ trọ hay thông báo. Bạn đã chốt giữ hàng này trong MVP (2026-10-11) và chọn giữ gọn, nên spec thiết kế đúng như vậy.

Hàng 12 của scope: người tìm trọ lưu một tin vào danh sách yêu thích, bỏ lưu và xem danh sách đã lưu; mỗi tin chỉ lưu một lần; tin không còn hiển thị công khai (bị ẩn, chủ trọ bị khóa hoặc hết kỳ dùng thử) không hiện trong danh sách đã lưu.

Các lực tác động lên thiết kế:
- Điều kiện "tin đang hiện công khai" đã viết đúng một lần (0003, 0004) và tính lúc đọc, tách thành hai mảnh SQL dùng chung (`publicListingFrom` và `publicListingCondition`). Nó phụ thuộc cả trạng thái tin, tài khoản chủ trọ, kỳ dùng thử, kỳ gói và hạng của tin theo hạn mức, nên bất cứ cách nào tự suy ra "còn hiện hay không" riêng cho danh sách đã lưu đều dễ lệch với danh sách công khai.
- Quyền `favorite:read`, `favorite:create`, `favorite:delete` đã có sẵn ở `tenant`; spec 0005 của nền móng đã phác bảng `favorites` (khóa chính theo cặp, N:M). Spec 0005 (theo dõi chủ trọ) vừa dựng bảng nối `follows` với cùng khuôn: ghi bằng `ON CONFLICT DO NOTHING`, trả kết quả của hành động, admin bị chặn trong Service.
- Danh sách đã lưu phải phân trang đúng: nếu lọc sau khi phân trang thì trang có lỗ hổng và `total` sai.
- Giao diện danh sách tin cần tô tim, mà `GET /listings` hiện công khai, không đọc đăng nhập, và chưa có header cache.
- Dự án nói rõ là MVP chạy demo: số liệu cần đúng, không cần nhanh hơn mức đo được.

## Options considered

### Option 1: Một bảng `favorites`, mọi thứ tính lúc đọc, ghép bảng vào hai mảnh SQL công khai

Thêm bảng `favorites`. Danh sách đã lưu chạy `publicListingFrom` nối thêm `favorites` của người gọi và lọc bằng `publicListingCondition`, sắp theo lúc lưu, đọc hai bước như `GET /listings`. Cờ `isFavorite` được đọc thêm bằng một truy vấn theo khóa chính ở danh sách và chi tiết công khai.

**Pros**:
- Tin biến khỏi danh sách đã lưu đúng lúc nó biến khỏi công khai, không cờ nào để cập nhật.
- Phân trang và `total` đúng vì lọc nằm trong cùng truy vấn.
- Một bảng, ba API, không việc nền, không biến môi trường, không mã lỗi mới.

**Cons**:
- Danh sách đã lưu đi qua luật xếp hạng theo hạn mức vốn đã đo là chậm ở quy mô lớn.
- `GET /listings` trở thành phụ thuộc người xem nên không cache chung được.

### Option 2: Bảng `favorites` cộng cờ lưu sẵn hoặc xóa dòng lưu khi tin bị ẩn

Giữ thêm cột "đang hiện" trên dòng lưu, hoặc xóa dòng lưu khi tin bị ẩn, khóa hay hết gói, để danh sách đã lưu chỉ đọc bảng `favorites`.

**Pros**:
- Đọc danh sách là một truy vấn đơn giản theo chỉ mục, nhanh nhất.

**Cons**:
- Mỗi sự kiện làm tin biến (chủ trọ ẩn, admin ẩn, khóa chủ trọ, hết dùng thử, hết gói, hạ hạn mức, tin vượt hạn mức) phải cập nhật hàng loạt dòng lưu, kể cả những sự kiện suy ra theo thời gian không có hành động nào kích hoạt. Hết dùng thử và hạ hạn mức cần việc nền.
- Xóa dòng lưu làm người dùng mất tin vĩnh viễn khi tin hiện lại.
- Mâu thuẫn nguyên tắc dự án: không lưu giá trị suy ra khi chưa đo được vấn đề tốc độ.

### Option 3: Phân trang bảng `favorites` trước rồi mới lọc tin còn hiện

Lấy một trang dòng lưu theo thời điểm lưu, rồi hỏi tin nào trong trang còn hiện công khai và bỏ những tin đã biến.

**Pros**:
- Truy vấn lấy trang chỉ chạm bảng `favorites` theo chỉ mục, rẻ.
- Không phải ghép hai mảnh SQL công khai với bảng mới.

**Cons**:
- Trang có lỗ hổng: người có nhiều tin bị ẩn thấy trang ngắn hoặc trống giữa chừng. `total` không đếm được nếu không chạy luật hiển thị cho cả danh sách.
- Cùng nhu cầu lọc vẫn phải chạy luật hiển thị, chỉ chuyển chỗ chạy.

### Option 4: Chỉ lưu ở trình duyệt, backend không làm gì

FE giữ danh sách id tin trong `localStorage` và tự gọi `GET /listings/:slugCode` cho từng tin.

**Pros**:
- Không đổi backend, không bảng, không API.

**Cons**:
- Mất khi đổi máy hay xóa dữ liệu trình duyệt; không đồng bộ giữa điện thoại và máy tính.
- Hàng 12 của scope yêu cầu danh sách gắn với tài khoản và quyền `favorite:*` đã có sẵn trong catalog.
- FE phải gọi từng tin để biết tin nào còn xem được.

## Rationale

Chọn Option 1. Điều quyết định là yêu cầu của scope "tin không còn hiển thị công khai thì không hiện trong danh sách đã lưu": luật đó phụ thuộc trạng thái tin, tài khoản chủ trọ, kỳ dùng thử, kỳ gói và hạn mức, và đã được viết đúng một lần thành hai mảnh SQL. Dùng lại chính hai mảnh đó, nối thêm `favorites`, là cách duy nhất bảo đảm danh sách đã lưu không bao giờ lệch với danh sách công khai mà không phải cập nhật thêm chỗ nào khác. Option 2 phải theo dõi mọi sự kiện làm tin biến, trong đó có những sự kiện không có hành động nào kích hoạt (hết dùng thử, hạ hạn mức), và xóa dòng lưu làm mất tin khi nó hiện lại. Option 3 trông rẻ nhưng làm trang có lỗ hổng và `total` sai, nên không đáp ứng phân trang đúng. Option 4 không đáp ứng yêu cầu danh sách gắn với tài khoản.

Các lựa chọn của bạn khớp hướng này. "Ẩn lặng lẽ, giữ dòng đã lưu" là điều kiện để Option 1 chạy đơn giản: danh sách chỉ cần lọc, không cần xóa hay thông báo. "Không giới hạn số tin" tránh một khóa chống đua khi đếm và một mã lỗi mới; giới hạn ghi 120 lần mỗi giờ đã chặn lạm dụng. "Mới lưu trước, chỉ phân trang" dùng đúng chỉ mục theo thời điểm lưu, không thêm bộ lọc hay chỉ mục phụ. Chạm đến chi phí đã biết: luật xếp hạng theo hạn mức chậm ở 60 nghìn tin (đã đo ở spec 0003 và bạn quyết bỏ qua), nhưng ở đây nó chỉ chạy trên các tin đã lưu của một người nên chi phí theo số tin đã lưu chứ không theo cả bảng; sẽ đo một lần rồi giữ nguyên, như hàng 11.

Cho cờ `isFavorite`, chọn thêm vào danh sách và chi tiết công khai (bạn xác nhận) thay vì một API riêng trả danh sách id đã lưu. Với danh sách không giới hạn số tin, API id có thể dài vô hạn và FE phải tự đối chiếu; gắn cờ ngay vào từng phần tử cho FE tô tim không gọi thêm, với giá một truy vấn theo khóa chính khi đã đăng nhập. Cái giá là `GET /listings` giờ phụ thuộc người xem nên phải trả `Cache-Control: private, no-store`; chấp nhận vì danh sách chưa có cache nào và chi tiết đã có header này từ spec 0002.

Tôi chọn `POST` và `DELETE /listings/:id/favorite` (runner up: `PUT` và `DELETE /me/favorites/:listingId`, đúng ngữ nghĩa chạy lặp hơn nhưng khác kiểu `POST` và `DELETE /landlords/:id/follow` của hàng 11 nên FE phải học hai kiểu), và chọn `{ listingId, isFavorite }` làm kết quả (bạn xác nhận) thay vì trả cả tin để bỏ lưu một tin đã bị ẩn vẫn trả được mà không phải đọc lại tin qua luật hiển thị. Lưu một tin không hiện công khai trả `LISTING_NOT_FOUND` có sẵn để không lộ tin đang ẩn và không thêm mã lỗi. `GET /me/favorites` dùng nhóm giới hạn `publicRead` có sẵn vì nó chạy cùng truy vấn nặng với danh sách công khai (runner up: không giới hạn như `GET /me/listings`, nhưng truy vấn này tốn hơn). Admin bị chặn ở cả ba route theo đúng bài học của hàng 11: danh mục quyền không tự chặn admin vì `ADMIN_PERMISSIONS` là `manage` mọi module.
