# 0015. Đánh giá từng phòng trọ trên tin đăng: lý giải và các phương án

Phần ghi lại vì sao chọn cách này. `/develop` không đọc file này; bản dùng để build nằm ở [index.md](index.md).

## Context

> ⚠️ Premise note: chat chỉ chứng minh người viết đã liên hệ về tin, chưa chứng minh đã xem hay ở phòng đó. Một chủ trọ có thể tự đăng ký một tài khoản người tìm trọ, nhắn về chính tin của mình, trả lời rồi chấm 5 sao cho phòng; số điện thoại chỉ bắt buộc duy nhất với tài khoản chủ trọ nên không chặn được việc này. Spec này giữ đúng mức bằng chứng của 0014 (chat hai chiều) và coi việc chống đánh giá giả là việc hoãn. Với bản demo thì chấp nhận; nếu chạy thật thì điểm phòng sẽ bị thổi phồng trước tiên. Không có tiền đề nào khác thiếu spec: chat (0013), đánh giá chủ trọ (0014) và luật hiển thị công khai của tin (0003, 0004) đều đã Accepted.

Hàng 22 cho người tìm trọ đánh giá chủ trọ, nhưng chưa có chỗ nào để nói về chính căn phòng trong một tin đăng. Hai thứ này khác nhau: một chủ trọ tốt có thể có một phòng ẩm, và một phòng đúng như ảnh vẫn có thể thuộc về chủ trọ khó tính. Người xem chi tiết tin cần biết phòng đó ra sao, không chỉ biết chủ trọ.

Trong code, "phòng" là một tin đăng (`listings`: một phòng nằm trong một nhà trọ), còn nhà trọ (`properties`) là cả tòa nhà. Chat đã gắn với tin: mỗi cuộc trò chuyện là một cặp (tin, người nhắn), và chủ trọ của tin được chép vào cuộc trò chuyện lúc tạo. Một tin chỉ hiện công khai khi thỏa một điều kiện dài (tin `visible`, nhà trọ và chủ trọ còn sống, chủ trọ còn dùng thử hoặc còn gói, hạng của tin nằm trong hạn mức), tính lúc đọc và dùng chung cho chi tiết, danh sách, tin đã lưu và chat. Bảng `reviews` của 0014 có unique (người viết, chủ trọ), mọi truy vấn của nó và hai con số của hồ sơ chủ trọ giả định "một dòng là một đánh giá chủ trọ", và hợp đồng hồ sơ chín trường đã được Accept.

Nếu không quyết, người xem chỉ thấy sao của chủ trọ trên hồ sơ và không có tín hiệu nào về phòng, trong khi FE đã có chỗ cho điểm trên chi tiết tin. Dự án là bản MVP để demo, ưu tiên gọn, kiểm bằng script thật và Newman, và đã quen đo một lần rồi bỏ qua nếu chậm.

## Options considered

### Option 1: Bảng riêng `listing_reviews` theo cặp (người viết, tin), chat về đúng tin, hiển thị theo luật công khai của tin

Một bảng mới nối người viết với tin, cùng khuôn với `reviews`. Chỉ người đã nhắn về đúng tin và được chủ trọ trả lời mới viết. Mọi route đọc và ghi đánh giá phòng trả 404 khi tin không hiện công khai. Hai con số chỉ có ở chi tiết tin và không cộng vào điểm chủ trọ.

**Pros**:
- Không chạm bảng, hợp đồng hay test của 0014; đánh giá phòng không thể lọt vào điểm chủ trọ.
- Bằng chứng khớp đúng thứ được chấm (cuộc trò chuyện về tin đó), và chặn được việc hỏi phòng này rồi chấm phòng khác.
- Một hàm `isPubliclyVisible` có sẵn quyết mọi chuyện hiển thị, nên không lộ gì của tin đang ẩn và không thêm luật mới.

**Cons**:
- Hai bảng giống nhau về hình dạng, hai nhánh kiểm duyệt giống nhau; sửa luật của một bên phải nhớ sửa bên kia.
- Cần thêm một truy vấn chat mới (theo tin) bên cạnh truy vấn theo chủ trọ.

### Option 2: Dùng chung bảng `reviews`, thêm cột `listing_id` có thể rỗng

Một dòng `reviews` có `listing_id` là đánh giá phòng, không có là đánh giá chủ trọ. Một danh sách kiểm duyệt, một máy trạng thái.

**Pros**:
- Một bảng, một Repository, một danh sách admin; không nhân đôi khuôn.

**Cons**:
- Phải đổi bảng đã Accept: unique (`author_id`, `landlord_id`) thành chỉ mục một phần, và mọi truy vấn của đánh giá chủ trọ phải thêm `listing_id IS NULL`. Quên một chỗ là đánh giá phòng lọt vào điểm chủ trọ mà không ai biết, đúng nhóm lỗi cần tránh.
- Cần cả `landlord_id` lẫn `listing_id` trên cùng một dòng, hoặc một CHECK "đúng một trong hai", làm ràng buộc DB rối hơn.

### Option 3: Đánh giá theo nhà trọ (cả tòa nhà)

Một đánh giá gắn với `properties`, một người đánh giá một nhà trọ một lần, điểm hiện trên mọi tin của nhà trọ đó.

**Pros**:
- Hợp khi người ở đánh giá cả tòa nhà (an ninh, giờ giấc, chỗ để xe) hơn là từng phòng.
- Một nhà trọ có nhiều tin thì điểm không bị chia nhỏ.

**Cons**:
- Chat gắn với tin chứ không với nhà trọ, nên phải suy ra nhà trọ từ tin; một lớp phức tạp 0014 đã từ chối.
- Không trả lời đúng yêu cầu "đánh giá từng phòng": hai phòng khác nhau trong cùng tòa nhà nhận cùng một điểm.

### Option 4: Bảng riêng nhưng điều kiện viết nới (bất kỳ cuộc trò chuyện nào với chủ trọ đã trả lời)

Như Option 1, nhưng dùng nguyên `ChatRepository.hasLandlordReplied` của 0014: chỉ cần chủ trọ đã trả lời bất kỳ tin nhắn nào của người đó, về tin nào cũng được.

**Pros**:
- Không thêm truy vấn chat nào, ít code và ít test nhất.
- Người đã nhắn một lần được đánh giá mọi phòng của chủ trọ đó.

**Cons**:
- Người hỏi phòng A chấm được phòng B chưa từng hỏi, nên "đánh giá phòng" yếu hơn chính tên của nó.
- Một chủ trọ nhiều tin dễ bị chấm hàng loạt bởi người chỉ nhắn về một tin.

## Decision

**Chosen option**: Option 1. Chi tiết ở [index.md](index.md), mục `## Decision`.

## Rationale

Bốn điều bạn chốt quyết định lựa chọn. Thứ nhất, đích của đánh giá là tin đăng, không phải nhà trọ, nên Option 3 bị bỏ: chat đã gắn với tin, và yêu cầu là từng phòng. Thứ hai, điều kiện viết là cuộc trò chuyện về đúng tin đó, nên Option 4 bị bỏ: nó rẻ hơn nhưng làm "đánh giá phòng" thành "đánh giá bất kỳ phòng nào của người mình từng nhắn", đúng chỗ điểm cần đáng tin; chi phí thêm chỉ là một truy vấn tồn tại theo hai khóa unique có sẵn. Thứ ba, bảng riêng thay vì dùng chung, nên Option 2 bị bỏ: một lỗi quên điều kiện trong bảng chung làm sai điểm của chủ trọ mà không báo lỗi, còn hai bảng giống nhau chỉ tốn một khuôn lặp lại mà 0014 đã chứng minh chạy được. Thứ tư, hai điểm không cộng vào nhau, nên hồ sơ chủ trọ giữ chín trường và đúng yêu cầu của hàng 24 là đánh giá chủ trọ chạy như cũ.

Hiển thị đi theo tin, vì điều kiện công khai của tin đã gánh sẵn cả chục trường hợp (ẩn, xóa, khóa, hết dùng thử, hết gói, vượt hạn mức) và `favorites` cùng chat đã dựa vào nó; thêm một luật riêng cho đánh giá chỉ tạo thêm chỗ lệch. Cái giá là người viết không xóa được đánh giá của mình khi tin đang ẩn, một việc hiếm và vô hại vì đánh giá đó không hiện ở đâu. Số liệu tính lúc đọc từ cùng một mảnh điều kiện với danh sách, như 0005 và 0014, vì bộ đếm lưu sẵn sẽ phải cập nhật ở mọi chỗ ẩn, xóa, khóa. Điểm phòng chỉ lên chi tiết tin (đúng điều kiện xong của hàng 24); đưa lên bốn danh sách thẻ tin là sửa bốn route ở ba module, quá nhiều cho một lát cắt MVP.

### Các quyết định do spec chốt (mục RECOMMEND)

Mỗi mục: lựa chọn, lý do, phương án thứ hai.

- **Không có cột `landlord_id` trên `listing_reviews`**: chủ trọ luôn suy ra từ tin qua nhà trọ (`findLandlordIdOf`), nên không có bản sao nào để lệch; tự đánh giá bị chặn bằng kiểm chủ trọ ở Service, và chat không bao giờ có người nhắn trùng chủ trọ (CHECK ở `conversations`). Thứ hai: chép `landlord_id` để có CHECK `author_id <> landlord_id` ở DB, đổi lấy thêm một cột, một khóa ngoại và một nguồn sai lệch.
- **Module mới `src/listing-reviews/`, tái dùng DTO, kiểu phản hồi và ánh xạ của `src/reviews/`**: một Repository riêng cho bảng riêng, nhưng luật giá trị (sao, nhận xét, tên người viết, làm tròn) chỉ viết một lần. Thứ hai: nhét vào `src/reviews/` (một module làm hai việc, import vòng với `ListingsModule`) hoặc sao chép DTO (luật có thể lệch dần).
- **Route số ít theo id của tin: `/listings/:id/review` và `/listings/:id/reviews`**: mỗi cặp chỉ có một đánh giá nên id tin đủ xác định, và người viết không bao giờ cầm được id đánh giá của ai khác; cùng khuôn `/landlords/:id/review` và `/listings/:id/favorite`. Thứ hai: `/listing-reviews/:id` kèm kiểm chủ sở hữu, thêm một loại 404 và một đường dò.
- **Kiểm tin hiện công khai trước, rồi mới kiểm tự đánh giá, rồi mới kiểm chat**: kiểm công khai là rào đầu để không lộ tin đang ẩn, còn kiểm tự đánh giá cần id chủ trọ của tin nên phải sau khi biết tin có thật. Thứ hai: kiểm tự đánh giá trước (như 0014, không cần tra DB), nhưng ở đây phải tra chủ trọ của tin nên không còn rẻ.
- **Admin chỉ lọc theo `status`, `listingId`, `authorId`**: ba cột có sẵn, đủ để tìm đánh giá vi phạm. Thứ hai: thêm `landlordId` qua phép nối `listings` rồi `properties`, bỏ vì không có chỉ mục và chưa ai cần.
- **Điều kiện chat là một truy vấn tồn tại bằng SQL thô trong `ChatRepository`**: so `messages.sender_id` với `conversations.landlord_id` là phép so hai cột, Prisma `findFirst` không viết được gọn. Thứ hai: hai truy vấn Prisma (lấy cuộc trò chuyện theo khóa unique rồi tìm tin nhắn của chủ trọ), chậm hơn một vòng tới DB.
- **Hai con số của chi tiết tin chạy song song với `isFavorite`**: không thêm độ trễ nối tiếp; có thể lệch vài mili giây (chấp nhận như 0005 và 0014). Thứ hai: nối vào giao dịch của lượt xem, bỏ vì không cần.
- **Dùng lại nhóm giới hạn `reviewWrite` và `publicRead`** (bạn chọn): bộ đếm tính theo route nên đánh giá phòng và đánh giá chủ trọ vẫn đếm riêng. Thứ hai: nhóm `roomReviewWrite` riêng cùng con số, tách được khi cần chỉnh.
- **Dùng lại module quyền `review`** (bạn chọn): tenant đã giữ bốn khóa nên migration không có phần dữ liệu. Thứ hai: module quyền riêng cho đánh giá phòng, đổi lấy một migration dữ liệu và bật tắt riêng được.
- **Năm mã lỗi `LISTING_REVIEW_*` riêng, dùng lại `CANNOT_REVIEW_SELF` và `LISTING_NOT_FOUND`** (bạn chọn): lời 403 của 0014 nói về chủ trọ nên sai với phòng, và FE phân biệt được hai loại bằng mã. Thứ hai: dùng lại mã `REVIEW_*` rồi sửa lời chung, đổi hành vi đã ship.
- **Hai mốc, dữ liệu demo là bước cuối của mốc 2** (bạn chọn): mốc 1 đã dùng được hết vòng người viết và người đọc; kiểm duyệt đi liền sau. Dữ liệu demo cần tin, cuộc trò chuyện và cả đánh giá bị ẩn nên để sau khi có kiểm duyệt. Thứ hai: ba mốc với demo là mốc riêng, thêm một lần dừng cho bạn review mà không đổi gì ở hợp đồng.
- **Kiểm duyệt dùng route phản chiếu `/moderation/listing-reviews`** (bạn chọn): mỗi danh sách admin là một truy vấn đơn giản, hợp đồng `GET /moderation/reviews` không đổi. Thứ hai: một danh sách gộp hai loại bằng UNION, đổi hình dạng phản hồi đã Accept.
- **Dạng thư mục** (`index.md` cộng `rationale.md`) như 0001 đến 0014, vì có `verify.md` ở mỗi mốc.
