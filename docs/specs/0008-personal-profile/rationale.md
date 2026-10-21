# 0008. Hồ sơ cá nhân: lý do và các phương án

Bản dựng nằm ở [index.md](index.md). File này giữ phần "vì sao", không cần cho lúc build.

## Context

> ⚠️ Premise note: hàng 15 của scope cho chủ trọ sửa số điện thoại, nhưng spec 0002 ghi rõ "`landlord` không tự đổi số" như một luật phải luôn đúng. Hai điều này mâu thuẫn, và số điện thoại còn là số liên hệ hiện trên chi tiết mọi tin của chủ trọ, đồng thời là khóa giữ "mỗi số một lần dùng thử". Bạn đã chọn cho đổi số (2026-10-21), nên spec này thay luật cũ bằng luật mới và sửa đúng một dòng ở 0002. Luật cũ chưa bao giờ chặn được lạm dụng thật, vì số không được xác thực bằng mã: ai cũng đăng ký được bằng một số bịa đúng định dạng. Nó chỉ chặn được người khai nhầm.

Sau khi đăng ký, người dùng không có đường nào sửa tên hay số điện thoại của mình. `GET /auth/me` chỉ cho biết mình là ai. Người tìm trọ gõ sai tên thì giữ nguyên. Chủ trọ đổi SIM thì số liên hệ trên mọi tin đăng sai mãi. Spec 0002 của nhóm nền móng (đăng nhập) đã ghi một hệ quả cùng loại: số bị người khác chiếm thì chưa có đường gỡ ngoài sửa trực tiếp database.

Các ràng buộc có sẵn: hai quyền `profile:read` và `profile:update` nằm trong danh mục từ spec 0003, `tenant` và `landlord` đều giữ theo mặc định, admin giữ qua `manage`, nhưng chưa route nào dùng. Bảng `users` đã có `name` và `phone`; số điện thoại của chủ trọ được bảo vệ ở database bằng `users_landlord_phone_check` và chỉ mục duy nhất một phần `users_landlord_phone_unique` (tính cả hàng xóa mềm). Chuẩn hóa và kiểm định dạng số đã có một chỗ (`normalizePhone`, `PHONE_PATTERN`), và token đăng nhập chỉ mang `sub`, `sid`, `type`, `perms`, không mang tên hay số.

Hàng 15 của scope giữ phạm vi chặt: người tìm trọ và chủ trọ xem được hồ sơ của mình và sửa tên, số điện thoại; chủ trọ không xóa được số và không đặt trùng số chủ trọ khác; mỗi người chỉ chạm hồ sơ của chính mình; không lộ mật khẩu hay mã băm; không đổi được loại tài khoản hay trạng thái khóa. Dự án là MVP demo không chạy thật, nên hướng gọn được ưu tiên và các việc cứng hóa chỉ ghi lại.

## Options considered

### Option 1: `GET` và `PATCH /me/profile` trong module `users`, sửa thẳng `name` và `phone` của bảng `users`

Một controller mới đọc và sửa hàng `users` của người gọi theo id trong token. Chủ trọ đổi số với đúng luật lúc đăng ký. Không đổi schema.

**Pros**:
- Không migration, không bảng, không mã lỗi mới: gọn nhất đủ đáp ứng Done when của hàng 15.
- Tái dùng chuẩn hóa số, mẫu kiểm định dạng, mã `PHONE_TAKEN` và chỉ mục duy nhất của đăng ký.
- Cùng họ `/me/*` với `me/membership`, `me/favorites`, `me/listings`; ánh xạ thẳng vào hai quyền `profile:*`.
- Không có tham số id nên không có đường chạm hồ sơ người khác.

**Cons**:
- Chủ trọ đổi số tự do, không xác thực, nên có thêm một đường quay vòng số để lấy thêm kỳ dùng thử (rủi ro đã có từ đăng ký).
- Đổi số đổi luôn số liên hệ ở mọi tin của chủ trọ, không giữ lịch sử.

### Option 2: Thêm `PATCH /auth/me`, giữ một chỗ cho "tôi là ai"

Mở rộng route `/auth/me` có sẵn bằng thao tác sửa, dùng chung `AuthController`.

**Pros**:
- Một URL cho cả đọc và sửa thông tin của mình; FE không phải chọn giữa hai nguồn.

**Cons**:
- `AuthController` là phần đăng nhập, phiên và mật khẩu; trộn sửa hồ sơ vào đó làm module lớn thêm và lệch khỏi quyền `profile:*` (route này hiện chỉ cần đăng nhập).
- `GET /auth/me` đang trả `permissions` cho FE dựng giao diện; gắn thêm thao tác ghi vào cùng URL làm rõ ràng giữa "tôi là ai" và "sửa hồ sơ" mờ đi.

### Option 3: Bảng riêng `user_profiles` (tên hiển thị, ảnh, Zalo, giới thiệu)

Tách thông tin hồ sơ khỏi `users` sang một bảng một-một, mở đường cho các trường phụ về sau.

**Pros**:
- Có chỗ sẵn cho ảnh đại diện, tên hiển thị khác tên thật, liên hệ Zalo, giới thiệu chủ trọ.
- `users` giữ gọn, chỉ còn dữ liệu đăng nhập.

**Cons**:
- Thêm bảng, migration, một lần nối ở mọi nơi hiện tên, và một chỗ nữa phải giữ đồng bộ với `users.name` đang được hồ sơ chủ trọ và chi tiết tin đọc.
- Không ai yêu cầu các trường phụ đó trong hàng 15; spec nhà trọ (`0002-property-listings`) đã quyết định chưa có `landlord_profiles` và spec 0005 hoãn "bảng hồ sơ chủ trọ riêng (tên hiển thị, Zalo)", cả hai là quyết định có chủ ý chờ trường đầu tiên cần.

### Option 4: Như Option 1 nhưng chủ trọ không đổi được số (giữ luật 0002)

Chỉ `tenant` và `admin` sửa số; chủ trọ chỉ sửa tên.

**Pros**:
- Giữ nguyên luật cũ của 0002 và không thêm đường quay vòng số dùng thử.
- Số liên hệ trên tin đăng không bao giờ đổi âm thầm.

**Cons**:
- Mâu thuẫn trực tiếp với dòng Done when của hàng 15 ("chủ trọ không xóa được số điện thoại" chỉ có nghĩa nếu họ sửa được số).
- Chủ trọ khai nhầm hoặc đổi SIM mắc kẹt với số sai, và số sai nằm trên mọi tin của họ.
- Không chặn được lạm dụng thật vì số không được xác thực.

## Rationale

Chọn Option 1 vì nó đáp ứng đúng từng dòng Done when của hàng 15 mà không thêm gì ngoài đó: bảng `users` đã đủ cột, hai quyền đã có, và mọi khối xây dựng (chuẩn hóa số, kiểm trùng, mã lỗi, giới hạn theo người dùng, header không cache) đã nằm sẵn. Bạn đã nhiều lần ưu tiên gọn cho MVP, nên hai cái được thêm vào (bảng hồ sơ riêng ở Option 3, gộp vào `/auth/me` ở Option 2) bị loại: Option 3 trả giá bằng một migration và một chỗ đồng bộ cho những trường chưa ai cần, Option 2 trộn việc sửa hồ sơ vào module đăng nhập và bỏ quyền `profile:*` không dùng.

Vế đáng cân nhắc nhất là Option 4. Nó đúng về mặt giữ luật cũ, nhưng luật cũ chỉ bảo vệ trên giấy: số điện thoại không xác thực bằng mã (spec 0002 đã nhận rõ điều này), nên ai muốn lấy thêm kỳ dùng thử chỉ cần đăng ký bằng một số bịa. Giữ khóa chỉ làm khổ người khai nhầm, và để lại cho họ đúng cái lỗi mà 0002 gọi là "chưa có đường gỡ". Vì vậy chọn cho đổi số với đúng luật của đăng ký, và ghi thẳng cái giá vào Consequences. Nếu sau này có xác thực số bằng mã, mới đáng quay lại giữ khóa hoặc giới hạn tần suất đổi số.

Thứ tự kiểm lỗi cho phép Service đọc hàng của người gọi sau khi body đã qua kiểm định, nên tài khoản bị khóa gửi body sai nhận 400. Đổi lại, Service chỉ đọc một lần để vừa kiểm khóa, vừa biết loại tài khoản, vừa so số mới với số hiện tại, không cần `@FreshAuth()` (vốn chỉ dùng cho route admin) và không cần thêm truy vấn.

**Các quyết định bạn đã chọn (2026-10-21)**: chỉ sửa tên và số điện thoại (không đổi email, không ảnh đại diện, không xóa tài khoản); chủ trọ đổi số với đúng luật của đăng ký; admin dùng cùng API cho chính mình; tên xóa được và số của tenant và admin xóa được, số chủ trọ thì không; đường dẫn `GET` và `PATCH /me/profile`; phản hồi gồm sáu trường của `/auth/me` cộng `createdAt`; nhóm giới hạn `profileWrite` 30 lần mỗi giờ theo người dùng; kiểm trùng trước và để người thua trong cuộc đua nhận 500 như đăng ký; mô hình dữ liệu không đổi; kiểm bằng token cộng đọc database trong Service, không `@FreshAuth()` và không đòi mật khẩu; sửa đúng một dòng ở spec 0002 ngay bây giờ; không có mục References.

**Các lựa chọn tôi đã quyết thay bạn** (chọn, lý do, phương án thay thế):

| Quyết định | Chọn | Vì sao | Phương án thay thế |
|---|---|---|---|
| Nơi đặt code | `ProfileController` mới trong `src/users/`, Service và Repository của `users` | dữ liệu là hàng `users`, scope đã ghi `code in src/users/`; chỉ cần thêm controller | module `profile` riêng với Service riêng |
| Body rỗng `{}` | 200 hồ sơ hiện tại, không ghi | `PATCH /properties/:id` cũng không từ chối body rỗng; không cần mã lỗi mới | 400 `VALIDATION_FAILED` |
| Cách xóa trường | `name`: `null`, rỗng hay chỉ khoảng trắng đều xóa; `phone`: chỉ `null` xóa, chuỗi rỗng là 400 | khớp hành vi đăng ký (`name?.trim() \|\| null`; số rỗng bị `@Matches` chặn) nên không thêm luật mới | chuỗi rỗng cũng xóa số |
| Số của admin | tùy chọn, không duy nhất, như `tenant` | chỉ chủ trọ bị luật duy nhất (chỉ mục một phần theo `account_type`) | cấm admin có số |
| Chủ trọ gửi lại số của mình | 200, không phải `PHONE_TAKEN` | kiểm trùng bỏ qua hàng của chính người gọi; so với số hiện tại nên không cần ghi lại | báo trùng với chính mình |
| Ghi hai trường | một câu cập nhật sau mọi kiểm tra | `name` gửi kèm số bị từ chối không được đổi một nửa | hai câu ghi riêng |
| Loại tài khoản lấy từ đâu | hàng vừa đọc trong database | cùng giá trị với token (không đổi được) nhưng Service đã có sẵn hàng đó | `RequestUser.accountType` |
| Trạng thái khóa | Service trả 403 `ACCOUNT_LOCKED` ở cả hai route, như `getMe` | token còn hạn tối đa 15 phút; người bị khóa không nên sửa hồ sơ | để cho sửa tới khi token hết hạn |
| Header | `Cache-Control: private, no-store` ở cả `GET` và `PATCH` | phản hồi có email và số điện thoại; cùng cách `FavoritesController` | không đặt header |
| Hình dạng phản hồi | `ProfileResponse` bảy trường, danh sách trắng riêng | `UserResponse` sáu trường đang dùng ở đăng ký, `/auth/me`, khóa và mở khóa, không nên đổi hình dạng | thêm `createdAt` vào `UserResponse` (đụng bốn chỗ) |
| Mã lỗi | không thêm | các mã hiện có đã đủ nghĩa, kể cả lỗi theo trường từ Service như `listings.service` và `settings.service` | thêm `PHONE_REQUIRED` |
| Nhật ký thay đổi | không ghi | `moderation_logs` dành cho hành động admin có đích; sửa hồ sơ của chính mình không có đích | ghi mỗi lần đổi số |
| Số mốc | một mốc, một lần `/develop` | hai route trên một bảng có sẵn, khớp ô `Build it` của scope | tách đọc và ghi thành hai mốc |
| Đua hai chủ trọ cùng số | giữ kết quả 500 cho người thua, kiểm thật mười vòng | khớp đăng ký; dịch lỗi database đã nằm ở mục Deferred | bắt lỗi chỉ mục duy nhất, trả 409 |
