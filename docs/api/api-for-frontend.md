# Tài liệu API và nghiệp vụ cho Frontend

Cập nhật lần cuối: 2026-10-20 (xem mục [Nhật ký thay đổi](#11-nhật-ký-thay-đổi) để biết thay đổi gần nhất).

File này do đội backend giữ và **cập nhật cùng mỗi thay đổi API**. Mục đích: để bên FE hiểu hệ thống làm gì, mỗi màn hình cần gọi API nào, và xử lý lỗi ra sao. Đi kèm file này là bộ request thử trong Postman: [`postman-collection.json`](postman-collection.json) (import vào Postman để gọi thử từng API).

Quy ước đọc file: phần nào ghi **Chưa có** nghĩa là đã lên kế hoạch nhưng backend chưa làm, FE đừng dựng giao diện cho phần đó vội.

## Mục lục

1. [Hệ thống làm gì](#1-hệ-thống-làm-gì)
2. [Quy ước chung](#2-quy-ước-chung)
3. [Định dạng lỗi và bảng mã lỗi](#3-định-dạng-lỗi-và-bảng-mã-lỗi)
4. [Đăng nhập, token và phiên](#4-đăng-nhập-token-và-phiên)
5. [Loại tài khoản và quyền](#5-loại-tài-khoản-và-quyền)
6. [Chi tiết từng API](#6-chi-tiết-từng-api)
7. [Luồng màn hình gợi ý](#7-luồng-màn-hình-gợi-ý)
8. [Quy tắc nghiệp vụ cần nhớ](#8-quy-tắc-nghiệp-vụ-cần-nhớ)
9. [Giới hạn đã biết](#9-giới-hạn-đã-biết)
10. [Chưa có (đã lên kế hoạch)](#10-chưa-có-đã-lên-kế-hoạch)
11. [Nhật ký thay đổi](#11-nhật-ký-thay-đổi)
12. [Cách giữ file này luôn đúng](#12-cách-giữ-file-này-luôn-đúng)

---

## 1. Hệ thống làm gì

Nền tảng quản lý và cho thuê nhà trọ. Hiện backend đã có phần **tài khoản và phân quyền**, danh mục địa chỉ và tiện ích, **nhà trọ của chủ trọ** (tạo, xem, sửa, xóa mềm) và **tin đăng** (đăng, sửa, ẩn, hiện, xóa; khách xem danh sách và chi tiết); **bảng giá gói** cùng phần admin quản lý gói (mục 6.26), **đơn mua gói và thanh toán thử** (mục 6.27); **gói đổi hạn mức tin** (mục 6.25); **ảnh của tin** (tải lên, xóa và xem ảnh, mục 6.28); **admin kiểm duyệt tin** (tìm, ẩn, gỡ ẩn kèm lý do, mục 6.29) và **admin quản lý danh mục phường và tiện ích** (mục 6.30).

### Ba loại tài khoản

| Loại (`accountType`) | Là ai | Cách có tài khoản |
|---|---|---|
| `landlord` | Người đăng bài (chủ trọ) | Tự đăng ký, **bắt buộc có số điện thoại** |
| `tenant` | Người tìm trọ (người thuê) | Tự đăng ký |
| `admin` | Quản trị viên | Không tự đăng ký được. Tài khoản đầu tiên do backend tạo bằng lệnh seed |

Mỗi tài khoản chỉ thuộc **một** loại, chọn lúc đăng ký và **không bao giờ đổi**. Muốn làm cả hai vai trò thì phải dùng hai tài khoản.

### Mô hình kinh doanh (để FE hiểu bối cảnh)

Đăng ký miễn phí. Người tìm trọ dùng miễn phí mãi. Người đăng bài được dùng thử khoảng một tháng với khoảng 1 đến 2 tin, muốn tiếp tục phải mua gói theo tháng. Admin là người vận hành và thu tiền. **Kỳ dùng thử lúc đăng ký, việc chặn đăng và hiện tin theo hạn mức, tin biến khỏi công khai khi hết kỳ, và API xem trạng thái dùng thử (`GET /me/membership`) đã chạy** (từ 2026-10-19, mục 6.1, 6.18, 6.19, 6.23 và 6.25). **Bảng giá gói công khai và phần admin quản lý gói đã có** (từ 2026-10-19, mục 6.26); **Đơn mua gói, thanh toán thử và gia hạn nối tiếp đã có API** (từ 2026-10-19, mục 6.27), và **gói đã đổi hạn mức tin** (từ 2026-10-19, mục 6.25): mua xong, chủ trọ hết dùng thử đăng tiếp được ngay và tin của họ hiện lại ngay.

### Trạng thái các tính năng

| Tính năng | Trạng thái |
|---|---|
| Đăng ký, đăng nhập, làm mới phiên, đăng xuất | Có |
| Loại tài khoản và phân quyền, admin chỉnh quyền | Có |
| Khóa, mở khóa tài khoản, thu hồi phiên (admin) | Có |
| Quên mật khẩu, đặt lại và đổi mật khẩu | Có (mới, 2026-10-08) |
| Giới hạn tần suất (lỗi 429) | Có (mới, 2026-10-12) |
| Danh sách phường, xã, đặc khu và tiện ích (cho biểu mẫu nhà trọ) | Có (mới, 2026-10-14) |
| Nhà trọ của chủ trọ (tạo, xem danh sách và chi tiết, sửa, xóa mềm) | Có (mới, 2026-10-16) |
| Tin đăng: đăng, sửa, xóa, ẩn và hiện của chủ trọ; danh sách và chi tiết tin công khai (có lọc, số điện thoại cho người đăng nhập, đếm lượt xem) | Có (mới, 2026-10-16) |
| Ảnh tin: tải lên (tối đa 5 ảnh mỗi tin), xóa ảnh, xem ảnh công khai | Có (mới, 2026-10-19, mục 6.28) |
| Admin ẩn tin và quản lý danh mục phường, tiện ích | Chưa có (đang làm từng phần, mục 10) |
| Tham số hệ thống: admin xem và đổi số ngày dùng thử, số tin dùng thử | Có (mục 6.24). Đã áp vào đăng ký (số ngày) và vào đăng, hiện tin (số tin) từ 2026-10-19 |
| Kỳ dùng thử lúc đăng ký; chặn đăng và hiện tin khi hết dùng thử hoặc đủ hạn mức | Có (mới, 2026-10-19, mục 6.1, 6.18, 6.23) |
| Tin biến khỏi công khai khi hết dùng thử hoặc vượt hạn mức (ẩn bớt theo thứ tự đăng) | Có (mới, 2026-10-19, mục 6.19, 6.20, 8) |
| Xem kỳ dùng thử và hạn mức của tôi (`GET /me/membership`); cờ `isPublic` ở tin của chủ trọ | Có (mới, 2026-10-19, mục 6.25 và 6.18) |
| Bảng giá gói (công khai); admin tạo, sửa, tắt, xóa gói | Có (mới, 2026-10-19, mục 6.26) |
| Tạo đơn mua gói, hủy đơn, thanh toán thử, gia hạn nối tiếp, lịch sử đơn | Có (mới, 2026-10-19, mục 6.27) |
| Gói đổi hạn mức tin và hiển thị công khai; `state = plan` và `subscription` trong `GET /me/membership` | Có (mới, 2026-10-19, mục 6.25) |
| Theo dõi chủ trọ, lượt xem | Chưa có |

---

## 2. Quy ước chung

| Mục | Quy ước |
|---|---|
| Địa chỉ gốc | `http://localhost:3000/api/v1` (dev). Mọi đường dẫn trong file này nằm dưới `/api/v1` |
| Định dạng | Gửi và nhận JSON, UTF-8. Header `Content-Type: application/json` khi có body |
| Xác thực | Header `Authorization: Bearer <accessToken>` cho API cần đăng nhập |
| Cookie | Gọi từ trình duyệt phải bật gửi cookie: `fetch(..., { credentials: 'include' })` hoặc `withCredentials: true` |
| CORS | Chỉ origin của FE nằm trong `ALLOWED_ORIGINS` của backend được gọi. Cho backend biết origin FE của bạn |
| Host | Dùng `localhost` ở **cả FE lẫn API**. Đừng trộn `127.0.0.1`, cookie đăng nhập sẽ không đi |
| Id | UUID (chuỗi), ví dụ `0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d9e` |
| Thời gian | ISO 8601 (UTC) khi API trả thời gian |
| Kích thước body | Tối đa 100 KB, quá thì 413 `PAYLOAD_TOO_LARGE`. Riêng API tải ảnh (6.28) nhận tệp đến dung lượng tối đa của một ảnh |
| Trường lạ | Gửi trường không có trong mô tả bị từ chối 400 `VALIDATION_FAILED` (không âm thầm bỏ qua) |
| Ngôn ngữ | Mọi `message` trả về là tiếng Việt, hiển thị thẳng cho người dùng được. `code` là hằng số tiếng Anh, FE dùng `code` để rẽ nhánh, không so chuỗi `message` |
| Truy vết | Mỗi response có header `X-Request-Id` (trùng `requestId` trong body lỗi). Gửi kèm khi báo lỗi cho backend |
| Phân trang | Query `page` (từ 1, mặc định 1) và `pageSize` (1 đến 50, mặc định 20). Trả `{ "items": [...], "total": 37, "page": 1, "pageSize": 20 }`. `total` là tổng số dòng thỏa điều kiện, không phải số dòng của trang này. Trang quá cuối trả `items` rỗng (không phải lỗi). `pageSize` quá 50, `page` nhỏ hơn 1 hoặc không phải số nguyên là 400 `VALIDATION_FAILED`. Hiện có `GET /properties`, `GET /listings`, `GET /me/listings`, `GET /plans` và `GET /plans/all` phân trang |
| Đọc đăng nhập tùy chọn | `GET /listings/:slugCode` là route công khai nhưng **nên gửi `Authorization: Bearer ...` nếu người dùng đã đăng nhập**: có token hợp lệ thì thấy số điện thoại chủ trọ; không có, sai hoặc hết hạn thì coi như khách (`phone: null`) và vẫn 200, **không bao giờ 401**. Xem 6.20 |

Email được chuẩn hóa: cắt khoảng trắng đầu cuối và đổi thành chữ thường. `An@Example.com` và `an@example.com` là cùng một tài khoản.

---

## 3. Định dạng lỗi và bảng mã lỗi

Mọi lỗi (kể cả lỗi hệ thống, route không tồn tại) đều có cùng một dạng:

```json
{
  "status": 409,
  "code": "EMAIL_TAKEN",
  "message": "Địa chỉ email này đã được sử dụng.",
  "requestId": "2d6f6a0e-6c0f-4e0b-8a53-1d1a9a7d1c11"
}
```

Lỗi nhập liệu (`VALIDATION_FAILED`) có thêm `errors`, liệt kê từng trường sai:

```json
{
  "status": 400,
  "code": "VALIDATION_FAILED",
  "message": "Dữ liệu gửi lên không hợp lệ.",
  "errors": [
    { "field": "phone", "code": "isDefined", "message": "Người đăng bài phải có số điện thoại." },
    { "field": "newPassword", "code": "minLength", "message": "Mật khẩu phải có ít nhất 8 ký tự." }
  ],
  "requestId": "..."
}
```

Lưu ý: **một trường có thể xuất hiện nhiều lần** trong `errors` nếu vi phạm nhiều luật cùng lúc (ví dụ thiếu hẳn trường thì báo cả "phải là chuỗi" lẫn "không được để trống"). Khi hiển thị dưới ô nhập, lấy dòng đầu tiên của mỗi `field`. `field` của trường lồng nhau có dạng `a.b`.

### Bảng mã lỗi

| `code` | HTTP | Khi nào | FE nên làm |
|---|---|---|---|
| `VALIDATION_FAILED` | 400 | Dữ liệu gửi lên sai (xem `errors`) | Hiện lỗi dưới từng ô theo `errors[].field` |
| `INVALID_ID` | 400 | Id trên đường dẫn không phải UUID | Lỗi lập trình, kiểm lại id |
| `BAD_REQUEST` | 400 | Yêu cầu hỏng khác (ví dụ JSON sai cú pháp) | Hiện `message` |
| `PAYLOAD_TOO_LARGE` | 413 | Body JSON quá 100 KB, hoặc ảnh tải lên quá dung lượng tối đa của một ảnh (6.28) | Hiện `message`; với ảnh thì gợi ý chọn ảnh nhỏ hơn |
| `TOKEN_MISSING` | 401 | Thiếu access token | Coi như chưa đăng nhập, chuyển trang đăng nhập |
| `TOKEN_INVALID` | 401 | Access token sai, hỏng, hoặc tài khoản đã bị xóa | Xóa token, chuyển trang đăng nhập |
| `TOKEN_EXPIRED` | 401 | Access token hết hạn (sau 15 phút) | Gọi `POST /auth/refresh` rồi thử lại request (mục 4) |
| `INVALID_CREDENTIALS` | 401 | Sai email hoặc sai mật khẩu (cố ý không phân biệt) | Hiện `message` |
| `REFRESH_TOKEN_MISSING` | 401 | Gọi refresh mà không có cookie | Chuyển trang đăng nhập |
| `SESSION_REVOKED` | 401 | Phiên đã bị hủy (đăng xuất, đổi hoặc đặt lại mật khẩu, bị khóa, bị thu hồi, hoặc phát hiện dùng lại token) | Chuyển trang đăng nhập |
| `SESSION_EXPIRED` | 401 | Phiên hết hạn (30 ngày sau lần đăng nhập) | Chuyển trang đăng nhập |
| `ACCOUNT_LOCKED` | 403 | Tài khoản bị admin khóa | Hiện `message`, không cho dùng tiếp |
| `ORIGIN_NOT_ALLOWED` | 403 | `Origin` của request không nằm trong danh sách cho phép (chỉ ở refresh và logout) | Báo backend thêm origin của FE |
| `PERMISSION_DENIED` | 403 | Đã đăng nhập nhưng không có quyền làm việc này | Hiện thông báo không đủ quyền |
| `NOT_RESOURCE_OWNER` | 403 | Thao tác trên dữ liệu của người khác (hiện: nhà trọ của chủ trọ khác) | Hiện `message`, quay về danh sách của mình |
| `FORBIDDEN` | 403 | Bị từ chối khác | Hiện `message` |
| `NOT_FOUND` | 404 | Route hoặc nội dung không tồn tại (kể cả phường hoặc tiện ích không có ở API danh mục của admin, 6.30) | Hiện `message` |
| `EMAIL_TAKEN` | 409 | Email đã có tài khoản (kể cả tài khoản đã xóa) | Báo lỗi ở ô email |
| `PHONE_TAKEN` | 409 | Số điện thoại đã thuộc một tài khoản người đăng bài khác | Báo lỗi ở ô số điện thoại |
| `RESET_TOKEN_INVALID` | 400 | Liên kết đặt lại mật khẩu sai, hết hạn, đã dùng, hoặc đã bị thay bằng liên kết mới hơn | Báo liên kết không dùng được, mời xin liên kết mới |
| `CURRENT_PASSWORD_WRONG` | 400 | Đổi mật khẩu nhưng mật khẩu hiện tại sai | Báo lỗi ở ô mật khẩu hiện tại. **Không** coi là hết phiên |
| `PERMISSION_UNKNOWN` | 400 | Admin gửi khóa quyền không có trong danh mục | Lỗi lập trình, lấy danh mục từ `GET /permissions` |
| `PERMISSION_ADMIN_ONLY` | 400 | Admin cấp quyền chỉ dành cho admin (hoặc khóa `*:manage`) cho landlord hoặc tenant | Không cho chọn các quyền đó |
| `SYSTEM_TYPE_PROTECTED` | 409 | Sửa quyền của loại `admin` | Không cho sửa loại admin |
| `ACCOUNT_TYPE_NOT_FOUND` | 404 | Khóa loại tài khoản không có | Lỗi lập trình |
| `USER_NOT_FOUND` | 404 | Không có người dùng với id này | Hiện `message` |
| `WARD_UNKNOWN` | 400 | Mã phường hoặc xã (`wardCode`) không có trong `GET /wards`. `errors` có một dòng `field: "wardCode"` | Lỗi lập trình hoặc danh mục đã đổi: tải lại `GET /wards` rồi cho chọn lại |
| `AMENITY_UNKNOWN` | 400 | Có khóa tiện ích (`amenityKeys`) không có trong `GET /amenities`. `errors` có một dòng `field: "amenityKeys"` nêu các khóa lạ | Tải lại `GET /amenities` rồi cho chọn lại |
| `CATALOG_CODE_TAKEN` | 409 | Admin tạo phường (mã) hoặc tiện ích (khóa) trùng với mục đã có (mục 6.30) | Báo lỗi ở ô mã hoặc khóa |
| `CATALOG_IN_USE` | 409 | Admin xóa phường hoặc tiện ích còn nhà trọ đang dùng, kể cả nhà trọ đã xóa mềm (mục 6.30) | Báo "đang có nhà trọ dùng, không xóa được", gợi ý đổi tên |
| `PROPERTY_NOT_FOUND` | 404 | Nhà trọ không có, hoặc đã xóa mềm | Quay về danh sách nhà trọ |
| `PROPERTY_HAS_LISTINGS` | 409 | Xóa nhà trọ còn tin chưa xóa | Báo "xóa các tin của nhà trọ này trước" |
| `LISTING_NOT_FOUND` | 404 | Tin không có hoặc đã xóa; ở route công khai còn gồm tin không hiển thị công khai vì bất kỳ lý do nào (đang ẩn, chủ trọ bị khóa...), kể cả với chính chủ, và đường dẫn không lấy được mã tin; ở API kiểm duyệt của admin (6.29) là tin không có hoặc đã xóa mềm | Hiện "tin không còn", quay về danh sách |
| `LISTING_STATE_INVALID` | 409 | Chuyển trạng thái tin không hợp lệ (ẩn tin không đang hiện, hiện tin đã hiện, ẩn tin đang bị admin ẩn); ở API kiểm duyệt của admin (6.29) là ẩn tin đã bị admin ẩn hoặc gỡ ẩn tin không bị admin ẩn | Tải lại tin (`GET /me/listings/:id`) rồi cập nhật nút |
| `LISTING_HIDDEN_BY_ADMIN` | 403 | Chủ trọ cố hiện lại tin đang bị admin ẩn | Hiện nhãn "bị quản trị viên ẩn" kèm `moderationReason`, ẩn nút "Hiện" |
| `LISTING_IMAGE_LIMIT` | 409 | Tải ảnh lên tin đã đủ 5 ảnh | Tắt nút tải khi `images` đã đủ 5 ảnh; báo "hãy xóa bớt một ảnh trước" |
| `IMAGE_INVALID` | 400 | Tải ảnh mà thiếu tệp, tệp không phải JPEG, PNG hoặc WebP (kiểm bằng nội dung tệp, không theo đuôi tên), sai tên trường (phải là `file`), hoặc gửi nhiều hơn một tệp | Hiện `message`, nhắc chọn đúng một ảnh JPEG, PNG hoặc WebP |
| `MEMBERSHIP_REQUIRED` | 403 | Đăng tin hoặc hiện lại tin khi **kỳ dùng thử đã hết và không có gói đang chạy** (cả tài khoản admin, vì admin không có kỳ dùng thử). Chỉ hai API đăng và hiện tin trả mã này. Mua gói xong là hết mã này | Hiện `message` kèm nút "Mua gói" dẫn tới trang bảng giá (mục 7). Vẫn cho ẩn, sửa, xóa tin và quản lý nhà trọ |
| `LISTING_QUOTA_REACHED` | 403 | Đăng tin hoặc hiện lại tin khi **còn hạn mức (gói đang chạy hoặc kỳ dùng thử) nhưng số tin đang hiện đã bằng hoặc vượt hạn mức đó** | Hiện `message`, gợi ý "ẩn hoặc xóa bớt một tin" (hoặc mua gói lớn hơn). FE biết hạn mức trước qua `GET /me/membership` (6.25) |
| `PLAN_NOT_FOUND` | 404 | Admin sửa hoặc xóa gói không có, hoặc chủ trọ đặt đơn với gói không có | Hiện `message`, tải lại danh sách gói |
| `PLAN_NAME_TAKEN` | 409 | Admin tạo gói hoặc đổi tên gói trùng tên gói khác. `errors` có một dòng `field: "name"` | Báo lỗi ở ô tên |
| `PLAN_IN_USE` | 409 | Admin xóa gói đã có đơn đặt (đơn ở bất kỳ trạng thái nào) | Hiện `message`, gợi ý tắt gói thay vì xóa |
| `PLAN_INACTIVE` | 409 | Đặt đơn bằng gói đã ngừng bán, hoặc thanh toán đơn mà gói đã bị tắt sau khi đặt (đơn vẫn `pending`) | Cho chọn gói khác rồi tạo đơn mới |
| `ORDER_NOT_FOUND` | 404 | Đơn không có (xem, thanh toán, hủy) | Quay về lịch sử đơn |
| `ORDER_STATE_INVALID` | 409 | Thanh toán đơn đã hủy, hoặc hủy đơn đã trả | Tải lại đơn rồi cập nhật nút |
| `CANNOT_LOCK_SELF` | 409 | Admin tự khóa chính mình | Hiện `message` |
| `ACCOUNT_ALREADY_LOCKED` | 409 | Khóa tài khoản đang bị khóa | Làm mới trạng thái trên giao diện |
| `ACCOUNT_NOT_LOCKED` | 409 | Mở khóa tài khoản không bị khóa | Làm mới trạng thái trên giao diện |
| `DB_UNAVAILABLE` | 503 | Cơ sở dữ liệu tạm không dùng được | Hiện `message`, cho thử lại sau |
| `INTERNAL_ERROR` | 500 | Lỗi hệ thống | Hiện `message`, gửi `requestId` cho backend |
| `HTTP_ERROR` | khác | Lỗi HTTP khác chưa có mã riêng | Hiện `message` |
| `RATE_LIMITED` | 429 | Gọi một API có giới hạn (đăng nhập, mật khẩu, ghi nhà trọ) quá nhiều lần trong thời gian ngắn. Kèm header `Retry-After` (số giây phải đợi) | Hiện `message` kèm "thử lại sau N giây", chặn nút gửi đến hết thời gian, **không** tự thử lại. Xem phần "Lỗi 429" ngay dưới |

### Lỗi 429 `RATE_LIMITED`: gọi quá nhanh

Chỉ **sáu API đăng nhập và mật khẩu, các API ghi nhà trọ, tin, tải ảnh và đơn, và ba API đọc công khai (hai của tin, một của bảng giá)** có giới hạn (các API đọc khác thì chưa). Body lỗi cùng dạng như mọi lỗi khác (có `requestId`), kèm header **`Retry-After`**: số giây còn phải đợi (số nguyên, ít nhất 1). Mỗi API đếm riêng, nên bị chặn đăng nhập không làm hỏng việc đọc `GET /auth/me` hay đăng xuất.

| API | Giới hạn theo IP | Giới hạn theo email (hoặc người dùng) | Bị chặn trong |
|---|---|---|---|
| `POST /auth/register` | 10 lần mỗi giờ | không | 1 giờ |
| `POST /auth/login` | 30 lần mỗi 15 phút | 10 lần mỗi 15 phút (theo email trong body) | 15 phút |
| `POST /auth/refresh` | 60 lần mỗi phút | không | 1 phút |
| `POST /auth/forgot-password` | 10 lần mỗi giờ | 3 lần mỗi giờ (theo email trong body) | 1 giờ |
| `POST /auth/reset-password` | 20 lần mỗi giờ | không | 1 giờ |
| `POST /auth/change-password` | không | 10 lần mỗi 15 phút (theo người dùng đang đăng nhập) | 15 phút |
| `POST /properties`, `PATCH /properties/:id`, `DELETE /properties/:id` | không | 30 lần mỗi giờ **cho mỗi API** (ba API đếm riêng, theo người dùng đang đăng nhập) | 1 giờ |
| `POST /properties/:propertyId/listings`, `PATCH /listings/:id`, `DELETE /listings/:id`, `POST /listings/:id/hide`, `POST /listings/:id/show` | không | 60 lần mỗi giờ **cho mỗi API** (năm API đếm riêng, theo người dùng đang đăng nhập) | 1 giờ |
| `POST /listings/:id/images` | không | 60 lần mỗi giờ (theo người dùng đang đăng nhập; chỉ API tải lên. Xóa ảnh và xem ảnh `/media` không bị giới hạn) | 1 giờ |
| `POST /orders`, `POST /orders/:id/pay`, `POST /orders/:id/cancel` | không | 30 lần mỗi giờ **cho mỗi API** (ba API đếm riêng, theo người dùng đang đăng nhập) | 1 giờ |
| `GET /listings` (công khai) | 300 lần mỗi phút | không | 1 phút |
| `GET /plans` (công khai) | 300 lần mỗi phút | không | 1 phút |
| `GET /listings/:slugCode` (công khai) | 300 lần mỗi phút | 60 lần mỗi phút, **chỉ khi request có access token hợp lệ** (khách không bị bộ đếm này, chỉ chịu giới hạn theo IP) | 1 phút |

API của admin (kiểm duyệt tin, danh mục phường và tiện ích, tham số hệ thống, quản lý gói, quyền và khóa tài khoản) **không có giới hạn tần suất thêm**.

Cách đếm: vượt số lần trong cột thì **lần vượt đó bị từ chối và bị chặn đúng khoảng thời gian ở cột "Bị chặn trong"** kể từ lần vượt; `Retry-After` cho biết còn bao lâu. Email được so không phân biệt hoa thường và bỏ khoảng trắng đầu cuối (`An@Example.com` và ` an@example.com ` là một). Gửi email sai dạng hoặc không có email thì tính vào bộ đếm email theo IP, nên không né được giới hạn bằng cách bỏ trống.

FE nên:
- Đọc `Retry-After`, hiện "Thử lại sau N giây" (đổi sang phút nếu lớn) và khóa nút gửi đến hết thời gian.
- **Không tự động thử lại** khi gặp 429: thử lại chỉ kéo dài thời gian bị chặn.
- Với `refresh`: chỉ gọi khi gặp 401 `TOKEN_EXPIRED`, và nếu nhiều request cùng hết hạn thì gom về **một** lần refresh rồi thử lại tất cả. Đừng refresh theo bộ đếm giờ hay mỗi lần chuyển trang.
- Bộ đếm nằm **trong bộ nhớ** của backend: khởi động lại backend là về 0. Khi thử tay mà bị chặn, nhờ restart backend thay vì đợi.
- Khi chạy thử trên máy cá nhân (không qua proxy), mọi client cùng một IP nên giới hạn theo IP dùng chung cho cả máy.

---

## 4. Đăng nhập, token và phiên

Có hai loại chìa khóa:

| | Access token | Refresh token |
|---|---|---|
| Dùng để | Gọi mọi API cần đăng nhập | Lấy access token mới |
| Sống | 15 phút (`expiresIn` = 900 giây) | 30 ngày kể từ lúc đăng nhập |
| FE giữ ở đâu | **Trong bộ nhớ** (biến JS, state). Đừng lưu `localStorage` | Không đụng tới. Nằm trong cookie `rt` loại `HttpOnly`, JavaScript không đọc được |
| Gửi bằng | Header `Authorization: Bearer ...` | Trình duyệt tự gửi cookie khi gọi `/auth/refresh` và `/auth/logout` |

Cookie `rt`: `HttpOnly`, `SameSite=Strict`, `Path=/api/v1/auth` (chỉ gửi cho các API dưới `/api/v1/auth`), sống 30 ngày. Cookie được **xoay vòng**: mỗi lần refresh, backend cấp cookie mới và cookie cũ chết.

### FE làm gì

1. **Sau đăng ký hoặc đăng nhập**: lưu `accessToken` vào bộ nhớ, rồi gọi `GET /auth/me` để biết người dùng là ai, loại tài khoản gì và có quyền gì. Đừng tự giải mã JWT.
2. **Khi tải lại trang** (bộ nhớ mất token): gọi `POST /auth/refresh` ngay lúc khởi động app. Thành công thì có access token mới (rồi gọi `/auth/me`); lỗi 401 thì coi như chưa đăng nhập.
3. **Khi một request trả 401 `TOKEN_EXPIRED`**: gọi `POST /auth/refresh` **đúng một lần**, lấy `accessToken` mới rồi gửi lại request vừa lỗi. Nếu refresh cũng lỗi (`SESSION_REVOKED`, `SESSION_EXPIRED`, `REFRESH_TOKEN_MISSING`) thì xóa trạng thái đăng nhập và chuyển trang đăng nhập.
4. **Nhiều request cùng hết hạn một lúc**: chỉ phát **một** lời gọi refresh, các request còn lại đợi kết quả đó. (Hai tab cùng refresh trong vòng 10 giây vẫn an toàn nhờ khoảng ân hạn, nhưng dùng lại cookie cũ sau 10 giây sẽ bị coi là bị đánh cắp và **hủy cả phiên**.)
5. **Đăng xuất**: gọi `POST /auth/logout`, xóa token trong bộ nhớ.

```
đăng nhập ──> lưu accessToken (bộ nhớ) ──> GET /auth/me
   │
gọi API ──401 TOKEN_EXPIRED──> POST /auth/refresh ──200──> thử lại request
                                    │
                                    └─401──> về trang đăng nhập
```

Mỗi tài khoản giữ tối đa 10 phiên (10 thiết bị). Đăng nhập thêm thì phiên cũ nhất bị hủy và thiết bị đó nhận `SESSION_REVOKED` ở lần refresh tới.

---

## 5. Loại tài khoản và quyền

### Cách quyền hoạt động

Quyền có dạng `module:hành_động`, ví dụ `favorite:create`. FE **không tự suy ra quyền từ loại tài khoản**: luôn lấy từ `permissions` của `GET /auth/me` rồi kiểm bằng `permissions.includes('favorite:create')`. `permissions` ở `/auth/me` đã mở rộng thành từng hành động (không gộp `module:manage`).

Admin có tất cả quyền. Quyền của `landlord` và `tenant` nằm trong cơ sở dữ liệu và **admin chỉnh được** (mục 6.13 và 6.14), nên danh sách bên dưới chỉ là **mặc định** lúc đầu.

| Loại | Quyền mặc định |
|---|---|
| `tenant` (7 quyền) | `profile:read`, `profile:update`, `favorite:read`, `favorite:create`, `favorite:delete`, `follow:create`, `follow:delete` |
| `landlord` (14 quyền) | `profile:read`, `profile:update`, `property:read`, `property:create`, `property:update`, `property:delete`, `listing:read`, `listing:create`, `listing:update`, `listing:delete`, `order:create`, `order:read`, `order:cancel`, `subscription:read` |
| `admin` | Tất cả |

Quyền admin chỉnh được **chỉ gồm hành động lẻ** của các module không dành riêng cho admin. Các hành động trong cột "Chỉ admin" bên dưới và mọi khóa `module:manage` không thể cấp cho landlord hay tenant.

### Danh mục quyền hiện có

`GET /permissions` trả đúng danh mục này (dùng để vẽ màn hình chọn quyền). "Chủ sở hữu" là module mà quyền `read`, `update`, `delete` chỉ áp cho dữ liệu của chính người gọi. "Đã có API" là module đã có API thật ở backend.

| Module | Hành động | Chủ sở hữu | Chỉ admin | Đã có API |
|---|---|---|---|---|
| `profile` | read, update | có | | chưa |
| `user` | read, lock, revoke | | tất cả | `lock`, `revoke` |
| `account_type` | read, update | | tất cả | có |
| `catalog` | read, create, update, delete | | tất cả | chưa |
| `setting` | read, update | | tất cả | có (mục 6.24) |
| `property` | read, create, update, delete | có | | có (mục 6.17) |
| `listing` | read, create, update, delete, moderate | có | `moderate` | `read`, `create`, `update`, `delete` (mục 6.18 đến 6.23); `moderate` chưa |
| `favorite` | read, create, delete | có | | chưa |
| `follow` | create, delete | có | | chưa |
| `plan` | read, create, update, delete | | tất cả | chưa |
| `order` | create, read, cancel | có | | chưa |
| `subscription` | read | có | | chưa |

Danh mục chỉ có **12 module** của bản MVP. Các module `contact`, `report`, `verification`, `boost`, `product`, `inspection`, `ad`, `expense`, `finance`, `dashboard`, `stats` và hai hành động `order:refund`, `order:gift` đã bị gỡ (xem nhật ký 2026-10-12). Khóa của chúng không còn hợp lệ: gửi lên `PATCH /account-types/:key` sẽ nhận 400 `PERMISSION_UNKNOWN`.

### Quyền đổi thì FE thấy khi nào

Access token mang sẵn một bản sao quyền lúc cấp. Khi admin đổi quyền của một loại, tài khoản thuộc loại đó nhận quyền mới ở **lần refresh kế tiếp** (tối đa 15 phút), còn `GET /auth/me` luôn trả quyền mới ngay. Muốn thấy quyền mới sớm, FE gọi `/auth/me`.

---

## 6. Chi tiết từng API

Ký hiệu cột **Cần**: "công khai" = không cần đăng nhập; "đăng nhập" = cần access token; "quyền X" = cần access token và quyền X.

### 6.0 Kiểm tra máy chủ

| | |
|---|---|
| `GET /` | Công khai. Trả chữ thuần `Hello World!` (không phải JSON). Dùng để biết API đang chạy |

### 6.1 Đăng ký

`POST /auth/register` · công khai

| Trường | Kiểu | Bắt buộc | Luật |
|---|---|---|---|
| `email` | chuỗi | có | Email hợp lệ, tối đa 254 ký tự. Được cắt khoảng trắng và đổi chữ thường |
| `password` | chuỗi | có | 8 đến 128 ký tự. Khoảng trắng đầu cuối được giữ nguyên |
| `name` | chuỗi | không | Tối đa 100 ký tự |
| `accountType` | chuỗi | có | Đúng `landlord` hoặc `tenant`. Không có giá trị mặc định. `admin` bị từ chối |
| `phone` | chuỗi | `landlord`: có. `tenant`: không | Xem luật số điện thoại bên dưới |

**Luật số điện thoại.** Backend chuẩn hóa trước khi kiểm: bỏ dấu cách, dấu chấm, dấu gạch; đầu số `+84` hoặc `84` đổi thành `0`. Kết quả phải là số di động Việt Nam đúng dạng `0` + (`3`, `5`, `7`, `8` hoặc `9`) + 8 chữ số. Ví dụ `+84 912.345.678` lưu thành `0912345678`. Tenant không bắt buộc số, nhưng nếu gửi thì cũng bị kiểm định dạng như trên. Chỉ kiểm định dạng và trùng, **không có SMS hay mã xác thực**.

Thứ tự kiểm trùng: email trước, số điện thoại sau.

**Kỳ dùng thử.** Chủ trọ đăng ký xong có ngay một **kỳ dùng thử** tính từ đúng lúc đăng ký (mặc định **30 ngày**, admin đổi được `trial_days` ở 6.24; `0` nghĩa là hết dùng thử ngay, dùng để dựng cảnh "hết quyền" khi demo). Trong kỳ, chủ trọ được hiện tối đa `trial_listing_limit` tin (mặc định 2). Hạn dùng thử **không nằm trong phản hồi này** (`user` vẫn đúng 6 trường); xem ở `GET /me/membership` (6.25). Người tìm trọ không có kỳ dùng thử. Đăng ký trùng số điện thoại bị 409 và **không** tạo thêm kỳ dùng thử (mỗi số điện thoại một lần dùng thử).

**201 Created**: đặt cookie `rt`, trả

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d9e",
    "email": "an@example.com",
    "name": "Nguyễn Văn An",
    "accountType": "landlord",
    "phone": "0912345678",
    "status": "active"
  }
}
```

**Lỗi**: 400 `VALIDATION_FAILED` · 409 `EMAIL_TAKEN` · 409 `PHONE_TAKEN` (số đã thuộc một người đăng bài khác, kể cả tài khoản đã xóa) · 429 `RATE_LIMITED` (quá 10 lần mỗi giờ theo IP).

### 6.2 Đăng nhập

`POST /auth/login` · công khai

| Trường | Kiểu | Bắt buộc |
|---|---|---|
| `email` | chuỗi | có |
| `password` | chuỗi | có |

**200 OK**: đặt cookie `rt`, trả `{ "accessToken": "...", "expiresIn": 900 }`. Không trả thông tin người dùng: gọi `GET /auth/me` sau đó.

**Lỗi**: 401 `INVALID_CREDENTIALS` (sai email và sai mật khẩu cho cùng một câu trả lời) · 403 `ACCOUNT_LOCKED` (chỉ lộ khi mật khẩu đúng) · 400 `VALIDATION_FAILED` · 429 `RATE_LIMITED` (quá 10 lần mỗi 15 phút cho một email, hoặc quá 30 lần mỗi 15 phút theo IP; **mỗi lần đăng nhập sai cũng được đếm**).

### 6.3 Làm mới access token

`POST /auth/refresh` · công khai, dùng cookie `rt` (không có body)

**200 OK**: `{ "accessToken": "...", "expiresIn": 900 }` và (thường) cookie `rt` mới. Quyền trong token mới đã được đọc lại từ cơ sở dữ liệu.

**Lỗi**: 401 `REFRESH_TOKEN_MISSING` · 401 `SESSION_REVOKED` · 401 `SESSION_EXPIRED` · 403 `ACCOUNT_LOCKED` (khi bị khóa, mọi phiên của tài khoản bị hủy) · 403 `ORIGIN_NOT_ALLOWED` · 429 `RATE_LIMITED` (quá 60 lần mỗi phút theo IP).

Trình duyệt tự gửi header `Origin`; backend từ chối nếu origin của FE không nằm trong danh sách cho phép.

### 6.4 Đăng xuất

`POST /auth/logout` · công khai, dùng cookie `rt` (không có body)

**204 No Content**, xóa cookie. Luôn thành công, kể cả khi thiếu cookie. Lỗi duy nhất: 403 `ORIGIN_NOT_ALLOWED`.

### 6.5 Đăng xuất mọi thiết bị

`POST /auth/logout-all` · đăng nhập

**204 No Content**, hủy mọi phiên của người dùng (mọi thiết bị) và xóa cookie.

### 6.6 Tôi là ai

`GET /auth/me` · đăng nhập

**200 OK**

```json
{
  "user": {
    "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d9e",
    "email": "an@example.com",
    "name": "Nguyễn Văn An",
    "accountType": "tenant",
    "phone": null,
    "status": "active"
  },
  "permissions": ["profile:read", "profile:update", "favorite:read", "favorite:create"]
}
```

Đọc thẳng từ cơ sở dữ liệu mỗi lần gọi nên luôn mới nhất. **Lỗi**: 401 `TOKEN_*` · 403 `ACCOUNT_LOCKED` (tài khoản bị khóa) · 401 `TOKEN_INVALID` (tài khoản đã bị xóa).

### 6.7 Quên mật khẩu

`POST /auth/forgot-password` · công khai

| Trường | Kiểu | Bắt buộc |
|---|---|---|
| `email` | chuỗi | có |

**202 Accepted**, **luôn cùng một nội dung** dù email có tài khoản hay không (để không ai dò được email nào đã đăng ký):

```json
{ "message": "Nếu email này có tài khoản, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư." }
```

FE hiển thị câu này và **không** nói "email không tồn tại" hay "đã gửi" chắc chắn. Nếu email có tài khoản, người dùng nhận một email tiếng Việt chứa liên kết:

```
<địa chỉ FE>/reset-password?token=<token>
```

Về liên kết: dùng **một lần**; hết hạn sau **30 phút**; mỗi lần bấm "quên mật khẩu" lại thì liên kết cũ chết, **chỉ liên kết mới nhất** dùng được. Tài khoản bị khóa vẫn nhận email (đặt lại mật khẩu không mở khóa được tài khoản); tài khoản đã xóa thì không.

Email được gửi ở nền, nên response trả về ngay và không báo lỗi nếu gửi thất bại. **Lỗi**: 400 `VALIDATION_FAILED` (email sai dạng) · 429 `RATE_LIMITED` (quá 3 lần mỗi giờ cho một email, hoặc quá 10 lần mỗi giờ theo IP). Khi gặp 429, **vẫn không** nói email có tồn tại hay không; chỉ báo "bạn thao tác quá nhanh, thử lại sau N giây".

### 6.8 Đặt lại mật khẩu

`POST /auth/reset-password` · công khai

| Trường | Kiểu | Bắt buộc | Luật |
|---|---|---|---|
| `token` | chuỗi | có | Giá trị của tham số `token` trong liên kết email |
| `newPassword` | chuỗi | có | 8 đến 128 ký tự |

**204 No Content.** Mật khẩu mới có hiệu lực ngay và **mọi phiên đăng nhập của tài khoản bị hủy** (mọi thiết bị). FE chuyển người dùng về trang đăng nhập; không có phiên nào để giữ.

**Lỗi**: 400 `RESET_TOKEN_INVALID` (liên kết sai, hết hạn, đã dùng, hoặc đã có liên kết mới hơn) · 400 `VALIDATION_FAILED`. Khi gặp `VALIDATION_FAILED` (ví dụ mật khẩu quá ngắn) liên kết **chưa bị dùng**, người dùng nhập lại được. Thêm: 429 `RATE_LIMITED` (quá 20 lần mỗi giờ theo IP).

### 6.9 Đổi mật khẩu

`POST /auth/change-password` · đăng nhập

| Trường | Kiểu | Bắt buộc | Luật |
|---|---|---|---|
| `currentPassword` | chuỗi | có | Mật khẩu đang dùng |
| `newPassword` | chuỗi | có | 8 đến 128 ký tự. Được phép trùng mật khẩu cũ |

**204 No Content.** Các phiên **khác** (thiết bị khác) bị hủy; phiên đang dùng **giữ nguyên**: access token và cookie hiện tại dùng tiếp bình thường, người dùng không bị đá ra.

**Lỗi**: 400 `CURRENT_PASSWORD_WRONG` · 400 `VALIDATION_FAILED` · 401 `TOKEN_*` · 403 `ACCOUNT_LOCKED` · 429 `RATE_LIMITED` (quá 10 lần mỗi 15 phút cho một người dùng, **kể cả các lần gõ sai mật khẩu hiện tại**; chặn người đánh cắp token dò mật khẩu).

### 6.10 Khóa tài khoản (admin)

`POST /users/:id/lock` · quyền `user:lock`

Body: `{ "reason": "Vi phạm quy định đăng tin" }`. `reason` bắt buộc, tối đa 500 ký tự.

**200 OK**: trả `user` ở dạng `{ id, email, name, accountType, phone, status }` với `status: "locked"`. Người bị khóa mất mọi phiên ngay; đăng nhập đúng mật khẩu thì nhận 403 `ACCOUNT_LOCKED`. Ai đã khóa, khi nào, vì sao được ghi lại.

**Lỗi**: 400 `INVALID_ID` · 400 `VALIDATION_FAILED` · 404 `USER_NOT_FOUND` · 409 `ACCOUNT_ALREADY_LOCKED` · 409 `CANNOT_LOCK_SELF` · 403 `PERMISSION_DENIED`.

### 6.11 Mở khóa tài khoản (admin)

`POST /users/:id/unlock` · quyền `user:lock`

Body: `{ "reason": "Đã xác minh lại" }` (bắt buộc). **200 OK**: trả `user` với `status: "active"`. Người dùng phải đăng nhập lại (phiên cũ không được khôi phục).

**Lỗi**: 400 `INVALID_ID` · 400 `VALIDATION_FAILED` · 404 `USER_NOT_FOUND` · 409 `ACCOUNT_NOT_LOCKED` · 403 `PERMISSION_DENIED`.

### 6.12 Thu hồi mọi phiên của một người (admin)

`POST /users/:id/revoke-sessions` · quyền `user:revoke`

Không có body. **204 No Content.** Buộc người đó đăng nhập lại, không đổi trạng thái tài khoản.

**Lỗi**: 400 `INVALID_ID` · 404 `USER_NOT_FOUND` · 403 `PERMISSION_DENIED`.

### 6.13 Danh mục quyền (admin)

`GET /permissions` · quyền `account_type:read`

**200 OK**: mảng, mỗi phần tử một module:

```json
[
  { "module": "profile", "actions": ["read", "update"], "ownerScoped": true, "adminActions": [] },
  { "module": "listing", "actions": ["read", "create", "update", "delete", "moderate"], "ownerScoped": true, "adminActions": ["moderate"] }
]
```

Quyền của một hành động có khóa `module:action`. Hành động nằm trong `adminActions` không cấp được cho landlord hay tenant.

### 6.14 Loại tài khoản và quyền của từng loại (admin)

`GET /account-types` · quyền `account_type:read`

**200 OK**: mảng ba phần tử, quyền đã mở rộng thành từng hành động:

```json
[
  { "key": "admin", "name": "Quản trị viên", "description": "...", "permissions": ["profile:read", "..."] },
  { "key": "landlord", "name": "Người đăng bài", "description": "...", "permissions": ["profile:read", "..."] },
  { "key": "tenant", "name": "Người tìm trọ", "description": "...", "permissions": ["profile:read", "..."] }
]
```

`PATCH /account-types/:key` · quyền `account_type:update`. `:key` là `landlord` hoặc `tenant`.

Body: `{ "permissions": ["profile:read", "profile:update", "favorite:read"] }`

Danh sách này **thay toàn bộ** quyền của loại (không phải thêm hoặc bớt từng cái), nên FE gửi lại danh sách đầy đủ sau khi người dùng chỉnh. Khóa trùng được bỏ trùng. Chỉ gửi **hành động lẻ** (không gửi `module:manage`).

**200 OK**: trả loại tài khoản sau khi đổi, cùng dạng phần tử của `GET /account-types`. Lệnh này luôn kiểm lại cơ sở dữ liệu, không tin quyền trong token.

**Lỗi**: 400 `PERMISSION_UNKNOWN` (khóa không có trong danh mục) · 400 `PERMISSION_ADMIN_ONLY` (quyền chỉ admin hoặc khóa `*:manage`) · 409 `SYSTEM_TYPE_PROTECTED` (`:key` là `admin`) · 404 `ACCOUNT_TYPE_NOT_FOUND` · 403 `PERMISSION_DENIED` · 403 `ACCOUNT_LOCKED`. Với hai lỗi 400 đầu, `errors` có một dòng `field: "permissions"` nêu các khóa gây lỗi.

### 6.15 Danh sách phường, xã, đặc khu

`GET /wards` · công khai (không cần đăng nhập)

**Địa chỉ ở Việt Nam từ 01/07/2025 chỉ còn hai cấp** (sau sáp nhập): tỉnh hoặc thành phố, rồi phường, xã hoặc đặc khu. **Không còn cấp quận, huyện**, nên FE **đừng làm ô chọn quận huyện**. Một địa chỉ nhà trọ gồm: số nhà và tên đường (người dùng gõ), phường hoặc xã (chọn từ danh sách này) và tỉnh hoặc thành phố (đi kèm phường). Gợi ý hiển thị: `{số nhà và đường}, {name}, {provinceName}`, ví dụ `12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh`.

**200 OK**: mảng, xếp theo `name` theo thứ tự chữ cái tiếng Việt:

```json
[
  { "code": "26732", "name": "Đặc khu Côn Đảo", "provinceCode": "79", "provinceName": "Thành phố Hồ Chí Minh" },
  { "code": "26743", "name": "Phường Bến Thành", "provinceCode": "79", "provinceName": "Thành phố Hồ Chí Minh" },
  { "code": "26737", "name": "Phường Tân Định", "provinceCode": "79", "provinceName": "Thành phố Hồ Chí Minh" }
]
```

Cần nhớ:
- `name` là **tên đầy đủ kèm loại đơn vị** (`Phường ...`, `Xã ...`, `Đặc khu ...`), hiển thị thẳng được, không cần tự ghép "Phường" vào trước.
- `code` là mã 5 chữ số theo danh mục hành chính mới. **Dùng `code` để lưu và so sánh**, đừng so chuỗi `name` (cách đặt dấu thanh theo nguồn, ví dụ `Hoà`, người dùng có thể gõ `Hòa`; tìm kiếm tin sẽ bỏ dấu nên không bị ảnh hưởng).
- Bản demo có **168 đơn vị của Thành phố Hồ Chí Minh** (113 phường, 54 xã, 1 đặc khu), kể cả các phường thuộc Bình Dương và Bà Rịa Vũng Tàu cũ vì hai tỉnh đó đã sáp nhập vào thành phố. Mỗi phần tử có sẵn `provinceCode` và `provinceName` nên thêm tỉnh khác sau này không đổi API.
- Danh sách ít thay đổi (chỉ admin sửa được, mục 6.30): FE có thể lưu tạm trong phiên làm việc.

### 6.16 Danh sách tiện ích

`GET /amenities` · công khai

**200 OK**: mảng `{ "key": "wifi", "name": "Wifi" }`, 13 tiện ích mẫu (wifi, máy lạnh, máy nước nóng, phòng vệ sinh riêng, bếp, gác lửng, máy giặt, chỗ để xe, thang máy, camera an ninh, giờ giấc tự do, có nội thất, ban công), xếp theo tên. `key` ổn định, dùng để gửi lên khi tạo hoặc sửa nhà trọ (`amenityKeys`, mục 6.17). Admin thêm, đổi tên và xóa tiện ích ở mục 6.30.

### 6.17 Nhà trọ của chủ trọ

Nhà trọ là nơi giữ **địa chỉ, phí và tiện ích**; về sau mỗi tin phòng thuộc về một nhà trọ. Chủ trọ tạo nhà trọ một lần rồi đăng nhiều tin vào đó (mục 6.18). Mọi API dưới đây cần đăng nhập, **chỉ làm việc trên nhà trọ của chính người gọi**: dữ liệu của chủ trọ khác bị 403 `NOT_RESOURCE_OWNER`. Người tìm trọ (`tenant`) không có quyền `property:*` nên mọi API này trả 403 `PERMISSION_DENIED`. Admin cũng chỉ thao tác được trên nhà trọ của chính mình.

**Hình dạng một nhà trọ** (kết quả của tạo, xem chi tiết và sửa; mỗi dòng của danh sách có thêm `listingCount`):

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d9e",
  "name": "Nhà trọ Hoa Hồng",
  "addressText": "12 Lê Lợi",
  "fullAddress": "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh",
  "ward": { "code": "26743", "name": "Phường Bến Thành", "provinceCode": "79", "provinceName": "Thành phố Hồ Chí Minh" },
  "latitude": 10.7721,
  "longitude": 106.6983,
  "fees": [
    { "kind": "electricity", "price": 3500, "unit": "per_kwh", "note": null },
    { "kind": "water", "price": 20000, "unit": "per_m3", "note": "Tính theo đồng hồ" }
  ],
  "amenities": [
    { "key": "balcony", "name": "Ban công" },
    { "key": "loft", "name": "Gác lửng" },
    { "key": "wifi", "name": "Wifi" }
  ],
  "createdAt": "2026-10-16T03:40:12.345Z",
  "updatedAt": "2026-10-16T03:40:12.345Z"
}
```

Cần nhớ:
- **`fullAddress` do backend ghép sẵn**: `addressText`, tên phường hoặc xã, tên tỉnh hoặc thành phố, nối bằng dấu phẩy, không có quận huyện. **FE hiển thị thẳng, đừng tự ghép.** Backend ghép lúc đọc nên admin đổi tên phường là mọi địa chỉ đổi theo.
- **`addressText` chỉ là số nhà và tên đường** ("12 Lê Lợi"). Đừng cho người dùng gõ phường, xã, tỉnh vào đây: phường lấy từ ô chọn (`GET /wards`, gửi `wardCode`), tỉnh đi theo phường.
- `fees` luôn xếp theo thứ tự cố định `electricity, water, internet, parking, service, other` (chỉ có những khoản đã khai). `amenities` xếp theo tên tiếng Việt. `note` của phí là `null` khi không có, không bao giờ chuỗi rỗng.
- `latitude` và `longitude` là `null` khi chưa có tọa độ.
- Không có `landlordId` trong kết quả: chủ nhà trọ là người đang đăng nhập.

**Các khoản phí** (`fees`): tối đa **một khoản cho mỗi loại** trong 6 loại, nên tối đa 6 khoản.

| Trường | Kiểu | Luật |
|---|---|---|
| `kind` | chuỗi | `electricity` (điện), `water` (nước), `internet`, `parking` (giữ xe), `service` (dịch vụ), `other` (khác) |
| `price` | số nguyên | Đồng Việt Nam, từ 0 đến 100.000.000. `0` nghĩa là miễn phí |
| `unit` | chuỗi | `per_kwh` (mỗi kWh), `per_m3` (mỗi m³), `per_month` (mỗi tháng), `per_person_month` (mỗi người mỗi tháng), `per_vehicle_month` (mỗi xe mỗi tháng). Backend không ràng buộc cặp `kind` với `unit` |
| `note` | chuỗi | Không bắt buộc, tối đa 100 ký tự. Rỗng hoặc chỉ khoảng trắng được lưu là `null` |

#### Tạo nhà trọ

`POST /properties` · quyền `property:create`

| Trường | Kiểu | Bắt buộc | Luật |
|---|---|---|---|
| `name` | chuỗi | có | 2 đến 100 ký tự (đã cắt khoảng trắng đầu cuối) |
| `addressText` | chuỗi | có | 5 đến 200 ký tự, chỉ số nhà và tên đường |
| `wardCode` | chuỗi | có | Đúng 5 chữ số, phải có trong `GET /wards` |
| `latitude`, `longitude` | số | không | **Gửi cùng nhau hoặc không gửi.** Vĩ độ từ -90 đến 90, kinh độ từ -180 đến 180. Gửi `null` cả hai cũng được (coi như không có) |
| `fees` | mảng | không | Tối đa 6 khoản, mỗi loại một khoản (xem bảng trên) |
| `amenityKeys` | mảng chuỗi | không | Tối đa 30 khóa, không trùng, mỗi khóa phải có trong `GET /amenities` |

**201 Created**: nhà trọ vừa tạo (hình dạng ở trên). Không gửi `landlordId` hay trường nào ngoài bảng (bị 400).

**Lỗi**: 400 `VALIDATION_FAILED` (gồm hai khoản phí cùng loại, quá 6 khoản, chỉ một tọa độ, tiện ích trùng) · 400 `WARD_UNKNOWN` · 400 `AMENITY_UNKNOWN` · 403 `PERMISSION_DENIED` · 429 `RATE_LIMITED` (quá 30 lần ghi mỗi giờ). Lỗi thì **không có gì được lưu** (nhà trọ, phí và tiện ích được lưu cùng lúc hoặc không gì cả).

#### Danh sách nhà trọ của tôi

`GET /properties?page=1&pageSize=20` · quyền `property:read`

**200 OK**: `{ "items": [...], "total": 3, "page": 1, "pageSize": 20 }` (quy ước phân trang ở mục 2). Chỉ nhà trọ chưa xóa của người gọi, **mới tạo xếp trước**. Mỗi phần tử có hình dạng như trên cộng `"listingCount": 0`: số tin chưa xóa của nhà trọ đó (mọi trạng thái, kể cả tin đang ẩn; tin đã xóa không tính).

**Lỗi**: 400 `VALIDATION_FAILED` (`page` hoặc `pageSize` sai) · 403 `PERMISSION_DENIED`.

#### Chi tiết nhà trọ

`GET /properties/:id` · quyền `property:read`

**200 OK**: nhà trọ (hình dạng ở trên).

**Lỗi**: 400 `INVALID_ID` · 404 `PROPERTY_NOT_FOUND` (không có hoặc đã xóa mềm) · 403 `NOT_RESOURCE_OWNER` · 403 `PERMISSION_DENIED`.

#### Sửa nhà trọ

`PATCH /properties/:id` · quyền `property:update`

Body có các trường như lúc tạo, **mọi trường đều tùy chọn**, và không trường nào nhận `null` (trừ cặp tọa độ). Cách hoạt động:
- Trường không gửi thì **giữ nguyên**. Gửi `{}` cũng được (không đổi gì, chỉ cập nhật `updatedAt`).
- `fees` và `amenityKeys` nếu gửi thì **thay cả danh sách** bằng danh sách mới, nên FE gửi lại danh sách đầy đủ sau khi người dùng chỉnh; mảng rỗng `[]` là xóa hết.
- **Xóa tọa độ** bằng `"latitude": null, "longitude": null` (cả hai). Đặt tọa độ mới thì gửi cả hai số. Gửi chỉ một trong hai, hoặc một số một `null`, là 400.
- Đổi `name`, `addressText` hay `wardCode` sẽ làm mới khóa tìm kiếm của các tin của nhà trọ (ô tìm kiếm ở `GET /listings` tìm thấy tên và địa chỉ mới ngay).

**200 OK**: nhà trọ sau khi sửa.

**Lỗi**: 400 `VALIDATION_FAILED` · 400 `WARD_UNKNOWN` · 400 `AMENITY_UNKNOWN` · 400 `INVALID_ID` · 404 `PROPERTY_NOT_FOUND` · 403 `NOT_RESOURCE_OWNER` · 403 `PERMISSION_DENIED` · 429 `RATE_LIMITED`. Lỗi thì không có gì bị đổi.

#### Xóa nhà trọ

`DELETE /properties/:id` · quyền `property:delete`

**204 No Content**. Đây là **xóa mềm**: nhà trọ biến khỏi mọi API (xem, sửa, danh sách đều 404 hoặc không thấy). **Chỉ xóa được khi nhà trọ không còn tin chưa xóa**; còn tin thì 409 `PROPERTY_HAS_LISTINGS`, FE nên báo "hãy xóa các tin của nhà trọ này trước".

**Lỗi**: 409 `PROPERTY_HAS_LISTINGS` · 404 `PROPERTY_NOT_FOUND` (kể cả xóa lần hai) · 403 `NOT_RESOURCE_OWNER` · 403 `PERMISSION_DENIED` · 400 `INVALID_ID` · 429 `RATE_LIMITED`.

### 6.18 Đăng tin

`POST /properties/:propertyId/listings` · quyền `listing:create`

Chủ trọ đăng một tin phòng vào **nhà trọ của chính mình** (`:propertyId`, xem 6.17). **Tin hiện ngay khi đăng**: không có bản nháp, không có bước duyệt.

| Trường | Kiểu | Bắt buộc | Luật |
|---|---|---|---|
| `title` | chuỗi | có | 5 đến 120 ký tự (đã cắt khoảng trắng đầu cuối) |
| `description` | chuỗi | có | 10 đến 5000 ký tự. Văn bản thuần, FE tự thoát khi hiển thị |
| `price` | số nguyên | có | Giá thuê mỗi tháng, đồng, từ 100.000 đến 100.000.000 |
| `areaM2` | số | có | Diện tích, từ 1 đến 1000, **tối đa một chữ số thập phân** (`22.5` được, `22.55` bị 400) |
| `deposit` | số nguyên | không | Tiền cọc, đồng, từ 0 đến 1.000.000.000. `null` coi như không gửi |
| `availableFrom` | chuỗi | không | Ngày vào ở, đúng dạng `YYYY-MM-DD` và là ngày có thật (`2026-02-30` bị 400). Ngày đã qua vẫn được. `null` coi như không gửi |

Không gửi `status`, `code`, `propertyId`, `viewCount` (bị 400 vì trường lạ): trạng thái luôn là `visible`, mã ngắn do backend sinh, nhà trọ lấy từ đường dẫn.

**201 Created**: **Tin của chủ trọ**, hình dạng dùng chung cho mọi API ghi tin và cho `GET /me/listings/:id`:

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d9f",
  "code": "k7m2xq9p",
  "slug": "phong-dep-co-gac-gan-cho-ben-thanh",
  "title": "Phòng đẹp có gác gần chợ Bến Thành",
  "description": "Phòng sạch sẽ thoáng mát, có gác lửng, giờ giấc tự do.",
  "price": 3500000,
  "areaM2": 22.5,
  "deposit": 3500000,
  "availableFrom": "2026-11-01",
  "coverImageUrl": null,
  "images": [],
  "ward": { "code": "26743", "name": "Phường Bến Thành" },
  "addressText": "12 Lê Lợi",
  "fullAddress": "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh",
  "property": {
    "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d9e",
    "name": "Nhà trọ Hoa Hồng",
    "addressText": "12 Lê Lợi",
    "fullAddress": "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh",
    "ward": { "code": "26743", "name": "Phường Bến Thành", "provinceCode": "79", "provinceName": "Thành phố Hồ Chí Minh" },
    "latitude": 10.7721,
    "longitude": 106.6983,
    "fees": [ { "kind": "electricity", "price": 3500, "unit": "per_kwh", "note": null } ],
    "amenities": [ { "key": "loft", "name": "Gác lửng" }, { "key": "wifi", "name": "Wifi" } ]
  },
  "viewCount": 0,
  "status": "visible",
  "moderationReason": null,
  "isPublic": true,
  "createdAt": "2026-10-16T04:20:11.000Z"
}
```

Cần nhớ:
- `code` là mã ngắn 8 ký tự (chữ thường và số, bỏ các chữ dễ nhầm). **Đường dẫn công khai của tin là `<slug>-<code>`** (ví dụ `phong-dep-co-gac-gan-cho-ben-thanh-k7m2xq9p`). Chỉ phần `code` ở cuối được dùng để tra, nên đổi tiêu đề (slug đổi) thì link cũ vẫn mở được.
- `status` là một trong `visible` (đang hiện), `hidden_by_owner` (chủ trọ tự ẩn), `hidden_by_admin` (admin ẩn). `moderationReason` có giá trị khi `status` là `hidden_by_admin` (lý do admin ghi), ngược lại `null`.
- **`isPublic`** (từ 2026-10-19) cho biết tin có đang hiện với khách hay không: `true` khi `status` là `visible` **và** tin nằm trong hạn mức hiện hành của chủ trọ (nằm trong N tin `visible` đăng sớm nhất, N là hạn mức, xem 6.19 và 6.25). Tin `visible` mà `isPublic` là `false` là tin đang bị ẩn bớt khỏi công khai vì vượt hạn mức, hoặc vì hết dùng thử mà không có gói đang chạy: nó vẫn `visible` và vẫn tính vào số tin đang hiện. Tin `hidden_by_owner` và `hidden_by_admin` luôn có `isPublic` `false`. Trường này có ở **mọi** phản hồi tin của chủ trọ (`POST` đăng, `PATCH`, `hide`, `show`, `GET /me/listings` và `GET /me/listings/:id`) và **không có** ở API công khai.
- `coverImageUrl` là ảnh bìa và `images[]` là các ảnh theo thứ tự `position`; tin chưa có ảnh thì `coverImageUrl` là `null` và `images` là `[]` (tải ảnh ở 6.28). `url` là đường dẫn tương đối `/api/v1/media/public/<uuid>.<đuôi>`, FE tự nối với địa chỉ API.
- `deposit` và `availableFrom` là `null` khi không có. `availableFrom` luôn là chuỗi `YYYY-MM-DD`.
- `fullAddress` do backend ghép sẵn (xem 6.17), FE hiển thị thẳng.
- **Hạn mức tin (từ 2026-10-19).** Đăng tin là thêm một tin đang hiện, nên chủ trọ phải còn hạn mức (có gói đang chạy hoặc còn trong kỳ dùng thử) và còn chỗ. Hạn mức là số tin của **gói đang chạy** nếu có (thay hạn mức dùng thử, kể cả khi nhỏ hơn), không thì `trial_listing_limit` khi còn dùng thử. Chỉ tin `visible` chưa xóa mới tính vào số tin đang hiện. Có hạn mức mà số tin đang hiện đã **bằng hoặc vượt** nó thì 403 `LISTING_QUOTA_REACHED`; hết dùng thử và không có gói đang chạy thì 403 `MEMBERSHIP_REQUIRED` (mua gói xong hết mã này). Ẩn hoặc xóa một tin trả lại một chỗ, đăng thêm được ngay. Hai yêu cầu đăng cùng lúc khi chỉ còn một chỗ thì đúng một yêu cầu thành công.
- Thứ tự báo lỗi: 404 `PROPERTY_NOT_FOUND` và 403 `NOT_RESOURCE_OWNER` luôn đến **trước** hai lỗi hạn mức; lỗi dữ liệu 400 `VALIDATION_FAILED` đến trước tất cả.

**Lỗi**: 400 `VALIDATION_FAILED` · 404 `PROPERTY_NOT_FOUND` · 403 `NOT_RESOURCE_OWNER` (nhà trọ của người khác) · 403 `MEMBERSHIP_REQUIRED` (hết dùng thử, không có gói) · 403 `LISTING_QUOTA_REACHED` (đủ hạn mức) · 403 `PERMISSION_DENIED` · 400 `INVALID_ID` · 429 `RATE_LIMITED` (quá 60 lần mỗi giờ). Lỗi thì không có tin nào được tạo.

### 6.19 Danh sách tin công khai

`GET /listings` · công khai (không cần đăng nhập)

Danh sách cho trang tìm trọ. **Chỉ tin đang hiện công khai**: tin `visible`, chưa xóa, thuộc nhà trọ chưa xóa của chủ trọ đang hoạt động, và tin nằm trong hạn mức của chủ trọ (khung dưới; chủ trọ không có gói và hết dùng thử thì hạn mức là 0). Tin bị ẩn, bị xóa, chủ trọ bị khóa, hết dùng thử mà không có gói, hoặc gói đã hết hạn biến khỏi danh sách **ngay**, không có độ trễ và không cần việc nền.

> **Luật hiển thị theo hạng (từ 2026-10-19).** Mỗi chủ trọ chỉ có tối đa N tin hiện công khai, N là hạn mức hiện hành của họ: số tin của **gói đang chạy** nếu có (thay hạn mức dùng thử, kể cả khi nhỏ hơn), không thì `trial_listing_limit` khi còn dùng thử (mặc định 2, mục 6.24), không thì 0. Các tin `visible` của họ xếp theo ngày đăng (`createdAt` cũ trước, ngang nhau thì theo `id`), chỉ N tin đầu còn hiện. Khi admin hạ hạn mức xuống dưới số tin đang hiện, các tin đăng sau cùng biến khỏi danh sách và khỏi chi tiết (404), nhưng **`status` của chúng vẫn là `visible`** và chủ trọ vẫn thấy chúng ở `/me/listings`. Chủ trọ ẩn hoặc xóa một tin thì tin đăng sớm nhất kế tiếp trong số bị ẩn bớt hiện lại. Hết kỳ dùng thử mà chưa có gói thì hạn mức là 0: mọi tin của chủ trọ đó biến khỏi công khai từ đúng thời điểm hết kỳ. Gói hết hạn cũng vậy (so chặt: đúng lúc `endsAt` là hết); gói hết mà dùng thử còn thì quay về hạn mức dùng thử. Admin nâng hạn mức hoặc chủ trọ mua gói thì tin hiện lại ngay. `total` và các trang đã tính theo luật này, FE không cần lọc thêm.

| Query | Kiểu | Mặc định | Luật |
|---|---|---|---|
| `q` | chuỗi | không lọc | Từ khóa **không phân biệt dấu và chữ hoa thường** (`tan dinh` tìm ra "Tân Định"). Tìm trong tiêu đề, tên nhà trọ, địa chỉ và tên phường. Tối đa 6 từ (từ thừa bị bỏ), mỗi từ tối đa 50 ký tự (dài hơn bị cắt), các từ nối bằng AND. `%`, `_`, `\` chỉ khớp đúng ký tự đó. `q` rỗng thì không lọc. Tối đa 500 ký tự |
| `wardCode` | chuỗi | không lọc | Mã 5 chữ số của phường hoặc xã (`GET /wards`). Mã đúng dạng nhưng không có trong danh mục trả danh sách rỗng (không phải lỗi); sai dạng là 400 |
| `minPrice`, `maxPrice` | số nguyên | không lọc | Từ 0 đến 100.000.000, so với giá thuê. `minPrice` lớn hơn `maxPrice` là 400 |
| `sort` | chuỗi | `newest` | `newest` (mới đăng trước), `price_asc` (giá tăng dần), `price_desc` (giá giảm dần). Cùng giá thì xếp ổn định, tin đăng sau trước với `price_desc` |
| `page`, `pageSize` | số nguyên | 1 và 20 | Quy ước phân trang ở mục 2 (`pageSize` tối đa 50) |

**200 OK**: `{ "items": [...], "total": 41, "page": 1, "pageSize": 20 }`. Mỗi phần tử là **tin tóm tắt**:

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d9f",
  "code": "k7m2xq9p",
  "slug": "phong-dep-co-gac-gan-cho-ben-thanh",
  "title": "Phòng đẹp có gác gần chợ Bến Thành",
  "price": 3500000,
  "areaM2": 22.5,
  "deposit": 3500000,
  "availableFrom": "2026-11-01",
  "coverImageUrl": null,
  "ward": { "code": "26743", "name": "Phường Bến Thành" },
  "addressText": "12 Lê Lợi",
  "fullAddress": "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh",
  "landlord": { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01", "name": "Anh Nam" },
  "createdAt": "2026-10-16T04:20:11.000Z"
}
```

Cần nhớ:
- **Danh sách không bao giờ có số điện thoại** (dù có đăng nhập). Số chỉ có ở trang chi tiết (6.20).
- `landlord.name` là `null` khi chủ trọ chưa đặt tên.
- Link sang trang chi tiết: `/<slug>-<code>` (hoặc chỉ `<code>`).
- Giới hạn 300 lần mỗi phút theo IP (mục 3).

**Lỗi**: 400 `VALIDATION_FAILED` (query sai, `minPrice` lớn hơn `maxPrice`, `pageSize` quá 50...) · 429 `RATE_LIMITED`.

### 6.20 Chi tiết tin công khai

`GET /listings/:slugCode` · công khai, **đọc đăng nhập tùy chọn**

`:slugCode` là `slug-mã` hoặc chỉ `mã`. **Chỉ phần mã (8 ký tự sau dấu `-` cuối cùng) được dùng để tra**: slug sai hoặc cũ vẫn mở được, và phản hồi trả `slug` đúng để FE thay địa chỉ trên thanh địa chỉ. Không lấy được mã hợp lệ cũng là 404 (không phải 400).

**Gửi kèm `Authorization: Bearer <accessToken>` nếu người dùng đã đăng nhập.** Có token hợp lệ thì thấy số điện thoại của chủ trọ; khách, token sai hoặc token hết hạn thì `landlord.phone` là `null` và **vẫn 200, không bao giờ 401**. Vì vậy FE nên làm mới token hết hạn trước khi mở trang chi tiết nếu muốn hiện số. Phản hồi có `Cache-Control: private, no-store` (nội dung đổi theo người xem), đừng cho proxy hay CDN cache.

**200 OK**: tin tóm tắt (6.19, nhưng `landlord` đổi thành `{ id, name, phone }`) cộng:
- `description`: mô tả đầy đủ.
- `viewCount`: số lượt xem (đã gồm lượt vừa tính nếu có).
- `images`: `[ { "id", "position", "url" } ]` theo `position` tăng dần (ảnh bìa là `position` nhỏ nhất). Tin chưa có ảnh thì là `[]` (tải ảnh ở 6.28).
- `property`: `{ id, name, addressText, fullAddress, ward { code, name, provinceCode, provinceName }, latitude, longitude, fees[], amenities[] }` (như 6.17: `fees` theo thứ tự cố định, `amenities` theo tên tiếng Việt).

**Cách tính lượt xem**: mỗi người xem được cộng **một lượt cho mỗi tin trong 30 phút**. Người xem là tài khoản nếu có token hợp lệ, không thì là địa chỉ IP. **Chủ tin mở không được tính.** Tải lại trong 30 phút không làm số tăng. Tin không hiển thị công khai (404) thì không được cộng. Nhiều người dùng chung một IP (ký túc xá, quán cà phê) mà không đăng nhập thì tính chung một lượt mỗi 30 phút.

**Lỗi**: 404 `LISTING_NOT_FOUND` (mã lạ; tin bị ẩn, bị xóa, chủ trọ hết dùng thử và hết gói, tin bị ẩn bớt vì vượt hạn mức, hết hiển thị vì bất kỳ lý do nào, **kể cả với chính chủ** ở route công khai này) · 429 `RATE_LIMITED` (quá 300 lần mỗi phút theo IP, hoặc quá 60 lần mỗi phút nếu đã đăng nhập).

### 6.21 Tin của tôi

`GET /me/listings` · quyền `listing:read`

Mọi tin chưa xóa của chính người gọi, **ở mọi trạng thái kể cả tin đang ẩn**, mới đăng xếp trước. Query: `status` (tùy chọn: `visible`, `hidden_by_owner` hoặc `hidden_by_admin`; giá trị khác là 400), `page`, `pageSize`.

**200 OK**: `{ "items": [...], "total", "page", "pageSize" }`. Mỗi phần tử là tin tóm tắt (6.19) **không có `landlord`**, cộng `status`, `moderationReason`, `viewCount` và `isPublic` (6.18). Đây là danh sách cho trang quản lý tin: dùng `status` để hiện nhãn và nút "Ẩn" hoặc "Hiện", dùng `isPublic` để hiện nhãn "Đang hiện với khách" hoặc "Đang bị ẩn bớt vì vượt hạn mức" cho tin `visible`.

`GET /me/listings/:id` · quyền `listing:read`

**200 OK**: **Tin của chủ trọ** (hình dạng ở 6.18), có đủ mô tả, ảnh, nhà trọ, `status`, `moderationReason` và `isPublic`. Dùng để mở biểu mẫu sửa.

**Lỗi**: 400 `VALIDATION_FAILED` (`status` lạ) · 400 `INVALID_ID` · 404 `LISTING_NOT_FOUND` (không có hoặc đã xóa) · 403 `NOT_RESOURCE_OWNER` · 403 `PERMISSION_DENIED`.

### 6.22 Sửa và xóa tin

`PATCH /listings/:id` · quyền `listing:update`

Body có các trường `title`, `description`, `price`, `areaM2`, `deposit`, `availableFrom` với **luật như lúc đăng** (6.18); **mọi trường đều tùy chọn**, trường không gửi thì giữ nguyên, gửi `{}` cũng được. `title`, `description`, `price`, `areaM2` không nhận `null`; `deposit` và `availableFrom` nhận `null` để xóa giá trị. **Không đổi được nhà trọ, trạng thái hay mã** (gửi `propertyId`, `status`, `code` là 400). Sửa được ở **mọi trạng thái**, kể cả tin đang bị admin ẩn. Đổi `title` làm đổi `slug` (link cũ vẫn mở được) và làm mới khóa tìm kiếm.

**200 OK**: Tin của chủ trọ sau khi sửa.

**Lỗi**: 400 `VALIDATION_FAILED` · 400 `INVALID_ID` · 404 `LISTING_NOT_FOUND` · 403 `NOT_RESOURCE_OWNER` · 403 `PERMISSION_DENIED` · 429 `RATE_LIMITED` (quá 60 lần mỗi giờ). Lỗi thì không có gì bị đổi.

`DELETE /listings/:id` · quyền `listing:delete`

**204 No Content**. **Xóa mềm** ở mọi trạng thái: tin biến khỏi mọi API (công khai, `/me/listings`), và không còn tính vào `listingCount` của nhà trọ nên sau khi xóa hết tin thì xóa được nhà trọ (6.17).

**Lỗi**: 404 `LISTING_NOT_FOUND` (kể cả xóa lần hai) · 403 `NOT_RESOURCE_OWNER` · 403 `PERMISSION_DENIED` · 400 `INVALID_ID` · 429 `RATE_LIMITED`.

### 6.23 Ẩn và hiện tin

`POST /listings/:id/hide` · quyền `listing:update` (không có body)
`POST /listings/:id/show` · quyền `listing:update` (không có body)

Chủ trọ tự ẩn tin (ví dụ khi hết phòng) và hiện lại khi còn phòng. Mỗi lần chuyển là **một thao tác nguyên tử** có kiểm trạng thái nguồn:

| Trạng thái hiện tại | `hide` | `show` |
|---|---|---|
| `visible` | thành `hidden_by_owner` | 409 `LISTING_STATE_INVALID` |
| `hidden_by_owner` | 409 `LISTING_STATE_INVALID` | thành `visible` |
| `hidden_by_admin` | 409 `LISTING_STATE_INVALID` | **403 `LISTING_HIDDEN_BY_ADMIN`** |

**200 OK**: Tin của chủ trọ sau khi chuyển (đọc `status` và `isPublic` để cập nhật giao diện; sau `hide`, `isPublic` luôn là `false`).

Cần nhớ:
- Tin `hidden_by_admin` **chủ trọ không tự hiện lại được**: FE hiện nhãn "Bị quản trị viên ẩn", hiển thị `moderationReason` (lý do admin ghi) và ẩn nút "Hiện", thay bằng hướng dẫn liên hệ admin (hệ thống chưa có kháng nghị). Chủ trọ vẫn **sửa được** tin để khắc phục. Khi admin gỡ ẩn, tin về `hidden_by_owner` và chủ trọ hiện lại được. Phía admin ẩn và gỡ ẩn ở mục 6.29.
- Admin ẩn đúng lúc chủ trọ bấm hiện thì **admin luôn thắng**: chủ trọ nhận 403 `LISTING_HIDDEN_BY_ADMIN` và trạng thái cuối là `hidden_by_admin`. FE gặp 409 hoặc 403 ở hai API này thì tải lại tin (`GET /me/listings/:id`) để lấy trạng thái thật.
- Tin `hidden_by_owner` và `hidden_by_admin` biến khỏi danh sách và chi tiết công khai.
- **`hide` không bao giờ bị hạn mức chặn** (kể cả khi hết dùng thử và hết gói). **`show` thì có**: hiện lại là thêm một tin đang hiện nên đi qua cùng cửa hạn mức với đăng tin (6.18). Thứ tự báo lỗi của `show`: 404 `LISTING_NOT_FOUND` hoặc 403 `NOT_RESOURCE_OWNER`, rồi `LISTING_HIDDEN_BY_ADMIN` hoặc 409 `LISTING_STATE_INVALID` (theo bảng trên), rồi 403 `MEMBERSHIP_REQUIRED` (hết dùng thử, không có gói), rồi 403 `LISTING_QUOTA_REACHED` (đủ hạn mức của gói hoặc của kỳ dùng thử). Bị chặn thì tin giữ nguyên `hidden_by_owner`.

**Lỗi**: 409 `LISTING_STATE_INVALID` · 403 `LISTING_HIDDEN_BY_ADMIN` (chỉ `show`) · 403 `MEMBERSHIP_REQUIRED` (chỉ `show`) · 403 `LISTING_QUOTA_REACHED` (chỉ `show`) · 404 `LISTING_NOT_FOUND` · 403 `NOT_RESOURCE_OWNER` · 403 `PERMISSION_DENIED` · 400 `INVALID_ID` · 429 `RATE_LIMITED`.

### 6.24 Tham số hệ thống (admin)

Hai tham số nghiệp vụ của kỳ dùng thử miễn phí, admin chỉnh được mà không cần sửa code. Chỉ admin giữ quyền `setting:read` và `setting:update`.

| Khóa (`key`) | Mặc định | Khoảng | Ý nghĩa |
|---|---|---|---|
| `trial_days` | 30 | 0 đến 365 | Số ngày dùng thử của chủ trọ đăng ký **sau** khi đổi. `0` nghĩa là hết dùng thử ngay lúc đăng ký (cách dựng cảnh "hết quyền" khi demo) |
| `trial_listing_limit` | 2 | 0 đến 100 | Số tin đang hiện tối đa trong kỳ dùng thử, áp ngay cho mọi chủ trọ còn trong kỳ |

> **Đã áp vào hành vi (từ 2026-10-19).** `trial_days` quyết định hạn dùng thử của chủ trọ đăng ký sau đó (6.1); `trial_listing_limit` quyết định số tin đang hiện tối đa của chủ trọ còn trong kỳ, kiểm lúc đăng và hiện lại tin (6.18, 6.23). Tin vượt hạn mức bị ẩn bớt khỏi kết quả công khai theo thứ tự đăng (6.19), có hiệu lực ngay khi đổi `trial_listing_limit`. Chủ trọ xem kết quả ở `GET /me/membership` (6.25) và ở cờ `isPublic` của từng tin (6.18). Chủ trọ đang có gói đang chạy dùng hạn mức của gói nên `trial_listing_limit` không ảnh hưởng họ cho đến khi gói hết.

`GET /settings` · quyền `setting:read`

**200 OK**: mảng **đúng hai phần tử** theo thứ tự `trial_days`, `trial_listing_limit` (danh mục cố định, không phân trang):

```json
[
  { "key": "trial_days", "value": 30, "min": 0, "max": 365, "updatedAt": "2026-10-16T03:00:00.000Z", "updatedBy": null },
  { "key": "trial_listing_limit", "value": 2, "min": 0, "max": 100, "updatedAt": "2026-10-16T03:00:00.000Z", "updatedBy": null }
]
```

`PATCH /settings/:key` · quyền `setting:update`. `:key` là `trial_days` hoặc `trial_listing_limit`.

Body: `{ "value": 14 }`. `value` là **số nguyên** (không gửi chuỗi như `"14"` hay số thập phân).

**200 OK**: một phần tử cùng dạng với `GET /settings`, có `updatedAt` là lúc vừa đổi và `updatedBy` là id admin vừa đổi. Lệnh này luôn đọc lại quyền từ cơ sở dữ liệu, nên admin vừa bị khóa bị từ chối ngay dù token còn hạn.

Cần nhớ:
- Dùng `min` và `max` trong chính phản hồi để giới hạn ô nhập, không cứng số trong FE.
- `updatedAt` và `updatedBy` là `null` khi tham số chưa từng được sửa (giá trị lấy từ seed hoặc mặc định). `updatedBy` cũng `null` nếu admin sửa lần cuối đã bị xóa khỏi hệ thống.
- Hệ thống tự dùng giá trị mặc định (30 và 2) nếu dòng tham số bị thiếu hoặc hỏng, nên `GET /settings` không bao giờ 500 vì lý do này.
- Đổi `trial_days` **không** đổi hạn dùng thử của người đã đăng ký; đổi `trial_listing_limit` có hiệu lực ngay cho mọi chủ trọ còn trong kỳ ở lần đăng hoặc hiện lại tin kế tiếp. Hạ hạn mức xuống thấp hơn số tin đang hiện **không đổi `status` của tin nào**, nhưng các tin đăng sau cùng biến khỏi kết quả công khai ngay (6.19) và `isPublic` của chúng thành `false`; đồng thời nó chặn đăng và hiện thêm cho đến khi số tin đang hiện xuống dưới hạn mức mới.

**Lỗi**: 400 `VALIDATION_FAILED` (không phải số nguyên, thiếu `value`, hoặc ngoài khoảng của khóa; `errors` có một dòng `field: "value"`) · 404 `NOT_FOUND` (khóa không có) · 403 `PERMISSION_DENIED` (chủ trọ, người tìm trọ) · 403 `ACCOUNT_LOCKED` · 401 `TOKEN_MISSING`.

### 6.25 Kỳ dùng thử và hạn mức của tôi

`GET /me/membership` · quyền `subscription:read` (chủ trọ có sẵn quyền này, người tìm trọ không có)

Cho chủ trọ biết gói đang chạy (nếu có), kỳ dùng thử còn bao lâu, được hiện bao nhiêu tin, đang hiện bao nhiêu, và có tin nào đang bị ẩn bớt khỏi công khai. Không có tham số: luôn trả số liệu của chính người gọi.

**200 OK**:

```json
{
  "state": "trial",
  "trialEndsAt": "2026-11-18T03:00:00.000Z",
  "trialDaysLeft": 30,
  "subscription": null,
  "listingLimit": 2,
  "visibleCount": 1,
  "remaining": 1,
  "overLimitCount": 0
}
```

Khi chủ trọ đang có gói (`state` là `plan`):

```json
{
  "state": "plan",
  "trialEndsAt": "2026-10-18T03:00:00.000Z",
  "trialDaysLeft": 0,
  "subscription": {
    "orderCode": "k7m2xq9p",
    "planName": "Nâng cao",
    "startsAt": "2026-10-19T03:00:00.000Z",
    "endsAt": "2026-11-18T03:00:00.000Z",
    "daysLeft": 30,
    "paidUntil": "2026-12-18T03:00:00.000Z"
  },
  "listingLimit": 15,
  "visibleCount": 4,
  "remaining": 11,
  "overLimitCount": 0
}
```

| Trường | Ý nghĩa |
|---|---|
| `state` | `plan` (có gói đang chạy), `trial` (không có gói, còn trong kỳ dùng thử) hoặc `expired` (không có gói, hết dùng thử). Có gói đang chạy thì luôn là `plan`, dù dùng thử còn hay hết |
| `trialEndsAt` | Hạn dùng thử, chuỗi ISO 8601 giờ UTC. `null` với tài khoản không có kỳ dùng thử (admin) |
| `trialDaysLeft` | Số ngày dùng thử còn lại, **làm tròn lên** (còn 1 giờ vẫn là 1). `0` khi đã hết. `null` khi `trialEndsAt` là `null`. **Chỉ phụ thuộc `trialEndsAt`, không phụ thuộc `state`**: đang có gói mà dùng thử còn thì vẫn có số ngày |
| `subscription` | Gói đang chạy, hoặc `null` khi không có (xem bảng dưới) |
| `listingLimit` | Số tin `visible` được hiện cùng lúc. Bằng số tin của gói khi `plan`, bằng `trial_listing_limit` khi `trial`, bằng `0` khi `expired` |
| `visibleCount` | Số tin `visible` chưa xóa của chủ trọ, **kể cả tin đang bị ẩn bớt khỏi công khai vì vượt hạn mức** (đúng số mà cửa hạn mức của 6.18 và 6.23 đếm) |
| `remaining` | `listingLimit` trừ `visibleCount`, không âm. Số tin còn đăng hoặc hiện thêm được |
| `overLimitCount` | `visibleCount` trừ `listingLimit`, không âm. Số tin đang bị ẩn bớt khỏi công khai (admin hạ hạn mức; hết dùng thử thì bằng cả `visibleCount`) |

Các trường của `subscription` (chỉ có khi `state` là `plan`):

| Trường | Ý nghĩa |
|---|---|
| `orderCode` | Mã đơn đã mua kỳ đang chạy (cùng `code` ở 6.27) |
| `planName` | Tên gói đã chốt trên đơn |
| `startsAt`, `endsAt` | Hai đầu của kỳ đang chạy, ISO 8601 UTC. Đúng lúc `endsAt` là hết |
| `daysLeft` | Số ngày còn lại của kỳ đang chạy, **làm tròn lên** |
| `paidUntil` | `endsAt` lớn nhất trong mọi kỳ của chủ trọ: **đã trả đến ngày nào**, kể cả các kỳ nối tiếp chưa tới. Bằng `endsAt` khi chưa mua thêm |

Cần nhớ:
- Số liệu tính lúc gọi, không lưu. Sau mỗi lần đăng, ẩn, hiện hoặc xóa tin, hoặc khi admin đổi tham số, FE gọi lại để cập nhật.
- `state` là `expired`: đăng và hiện tin bị 403 `MEMBERSHIP_REQUIRED` và mọi tin của chủ trọ đã biến khỏi công khai. FE hiện lời mời mua gói dẫn tới trang bảng giá (mục 7).
- `overLimitCount` lớn hơn 0 khi còn kỳ dùng thử: FE báo "N tin của bạn đang bị ẩn khỏi khách, hãy ẩn hoặc xóa bớt, hoặc mua gói", và chỉ ra tin nào bằng cờ `isPublic` ở `GET /me/listings` (6.21).
- `remaining` bằng 0 nghĩa là nút "Đăng tin" và "Hiện" sẽ bị 403 `LISTING_QUOTA_REACHED` hoặc `MEMBERSHIP_REQUIRED`. FE có thể tắt sẵn nút kèm lời giải thích, nhưng vẫn phải xử lý hai lỗi này vì số liệu có thể đã đổi.
- `state` là `plan`: hạn mức, `remaining`, `overLimitCount` và `isPublic` đều theo số tin của gói, **thay** hạn mức dùng thử (gói 1 tin trong lúc dùng thử 2 tin thì hạn mức là 1). Gói hết hạn mà dùng thử còn thì `state` về `trial` và `subscription` về `null`. Mua gói **không đổi** `trialEndsAt`.
- Mua thêm khi đang có gói thì kỳ mới nối vào cuối: `endsAt` vẫn là của kỳ đang chạy, chỉ `paidUntil` dời ra. Muốn hiện "gói đến hết ngày ..." thì dùng `paidUntil`.
- Sau khi thanh toán thử xong (6.27), FE gọi lại API này để thấy `state = plan`.
- Admin gọi được (admin có quyền này) nhưng luôn nhận `state` là `expired`, `subscription`, `trialEndsAt` và `trialDaysLeft` là `null`, `listingLimit` là 0: admin không có kỳ dùng thử và không mua được gói.
- Không có giới hạn tần suất riêng cho API này, nhưng đừng gọi lặp mỗi giây.

**Lỗi**: 403 `PERMISSION_DENIED` (người tìm trọ) · 401 `TOKEN_MISSING` (chưa đăng nhập) · 403 `ACCOUNT_LOCKED`.

### 6.26 Bảng giá gói và quản lý gói (admin)

Gói là thứ chủ trọ sẽ mua để có hạn mức tin cao hơn kỳ dùng thử. Bảng giá là công khai; chỉ admin tạo, sửa, tắt, xóa gói (quyền `plan:read`, `plan:create`, `plan:update`, `plan:delete`).

> **Gói đã đổi hạn mức tin (từ 2026-10-19).** Mua gói ở mục 6.27; gói đang chạy thay hạn mức dùng thử (6.25) và tin của chủ trọ hiện lại ngay khi mua xong.

`GET /plans` · **công khai**, không cần đăng nhập

Query: `page`, `pageSize` (mục 2). **200 OK**:

```json
{
  "items": [
    { "id": "01a152f1-93f8-7a52-81cf-e8a1248f09bf", "name": "Cơ bản", "price": 99000, "maxListings": 5, "durationDays": 30 },
    { "id": "01a152f1-93fb-7587-bfe8-eca047ac7e0e", "name": "Nâng cao", "price": 199000, "maxListings": 15, "durationDays": 30 }
  ],
  "total": 3,
  "page": 1,
  "pageSize": 20
}
```

| Trường | Ý nghĩa |
|---|---|
| `id` | Id gói (UUID) |
| `name` | Tên gói, 2 đến 60 ký tự, duy nhất |
| `price` | Giá một kỳ, số nguyên **đồng** (`99000` là 99.000 đ). FE tự định dạng |
| `maxListings` | Số tin được hiện cùng lúc khi gói đang chạy |
| `durationDays` | Số ngày một kỳ (mặc định 30) |

Cần nhớ:
- Chỉ có gói **đang bán**; gói admin đã tắt không hiện. Xếp **giá tăng dần, rồi theo tên**, nên có thể vẽ thẳng từ trái sang phải.
- Không có `isActive` hay mốc thời gian ở API công khai (admin mới thấy).
- Sau `npm run seed` có ba gói mẫu: **Cơ bản** 5 tin 99.000 đ, **Nâng cao** 15 tin 199.000 đ, **Chuyên nghiệp** 50 tin 399.000 đ, mỗi gói 30 ngày. Admin sửa được, nên đừng cứng tên hay giá trong FE.
- Giới hạn 300 lần mỗi phút theo IP (429 `RATE_LIMITED`).

`GET /plans/all` · quyền `plan:read` (chỉ admin)

Query `page`, `pageSize`. Mọi gói **kể cả đã tắt**, cùng thứ tự với bảng giá. Mỗi gói có 8 trường: năm trường của bảng giá cộng `isActive` (boolean), `createdAt`, `updatedAt` (ISO 8601).

`POST /plans` · quyền `plan:create` · `PATCH /plans/:id` · quyền `plan:update` · `DELETE /plans/:id` · quyền `plan:delete`

Ba lệnh ghi này **luôn đọc lại quyền từ cơ sở dữ liệu**, nên admin vừa bị khóa bị từ chối ngay dù token còn hạn (403 `ACCOUNT_LOCKED`).

| Trường (body) | Kiểu | Bắt buộc khi tạo | Luật |
|---|---|---|---|
| `name` | chuỗi | có | 2 đến 60 ký tự sau khi cắt khoảng trắng đầu cuối. Không trùng tên gói khác |
| `price` | số nguyên | có | 0 đến 100.000.000 (đồng). `0` là gói miễn phí |
| `maxListings` | số nguyên | có | 1 đến 1000 |
| `durationDays` | số nguyên | không | 1 đến 365, mặc định 30 |
| `isActive` | boolean | không | Mặc định `true`. `false` là ngừng bán |

- `POST` trả **201** gói ở dạng 8 trường. `PATCH` nhận một hay nhiều trường ở trên, trường nào không gửi thì giữ nguyên (không nhận `null`; thân rỗng là không đổi gì), trả **200** gói sau khi sửa với `updatedAt` mới. `DELETE` trả **204** không thân.
- **Tắt gói** (`PATCH` với `{ "isActive": false }`) là cách ngừng bán: gói biến khỏi bảng giá nhưng vẫn ở `GET /plans/all`. Nên ưu tiên tắt hơn xóa.
- **Xóa** chỉ được khi chưa có đơn nào đặt gói đó (đơn đã hủy cũng tính), ngược lại 409 `PLAN_IN_USE`: FE gợi ý "tắt gói thay vì xóa".
- Sửa giá, số tin hay số ngày chỉ ảnh hưởng đơn tạo **sau đó**; đơn đã tạo giữ nguyên giá, số tin và số ngày của lúc đặt.
- Trường lạ (ví dụ `id`) bị từ chối 400 `VALIDATION_FAILED`.

**Lỗi**: 400 `VALIDATION_FAILED` (giá trị ngoài khoảng, sai kiểu, trường lạ; `errors[].field` chỉ đúng trường) · 400 `INVALID_ID` · 404 `PLAN_NOT_FOUND` (sửa, xóa) · 409 `PLAN_NAME_TAKEN` (tạo, sửa) · 409 `PLAN_IN_USE` (xóa) · 403 `PERMISSION_DENIED` (chủ trọ, người tìm trọ gọi API admin) · 403 `ACCOUNT_LOCKED` (ba lệnh ghi) · 401 `TOKEN_MISSING` · 429 `RATE_LIMITED` (chỉ `GET /plans`).

### 6.27 Đơn mua gói và thanh toán thử

Chủ trọ chọn một gói ở bảng giá (6.26), tạo đơn, rồi bấm thanh toán thử: đơn thành `paid` và có một **kỳ gói**. **Không có tiền thật và không có cổng thanh toán nào**; "đã trả" chỉ nghĩa là chủ trọ tự bấm xác nhận. Mọi API dưới đây cần đăng nhập và **chỉ làm việc trên đơn của chính người gọi**.

> **Gói đã đổi hạn mức tin (từ 2026-10-19).** Thanh toán xong, kỳ gói thay hạn mức dùng thử: `GET /me/membership` có `state = plan` và `subscription` (6.25), chủ trọ hết dùng thử đăng được ngay (hết 403 `MEMBERSHIP_REQUIRED`) và tin của họ hiện lại trong `GET /listings` ngay, không cần chờ gì.

**Ai gọi được.** Chỉ tài khoản **chủ trọ** (`landlord`) tạo được đơn. Người tìm trọ không có quyền đơn nên mọi API đơn trả 403 `PERMISSION_DENIED`. Admin tạo đơn cũng bị 403 `PERMISSION_DENIED` (admin không mua gói); admin xem, thanh toán hay hủy đơn của người khác bị 403 `NOT_RESOURCE_OWNER`, và `GET /orders` của admin luôn rỗng. Chưa đăng nhập là 401.

**Hình dạng một đơn** (dùng chung cho cả năm API):

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01",
  "code": "k7m2xq9p",
  "planId": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d02",
  "planName": "Nâng cao",
  "price": 199000,
  "maxListings": 15,
  "durationDays": 30,
  "status": "paid",
  "paidAt": "2026-10-19T03:00:00.000Z",
  "cancelledAt": null,
  "startsAt": "2026-10-19T03:00:00.000Z",
  "endsAt": "2026-11-18T03:00:00.000Z",
  "createdAt": "2026-10-19T02:59:30.000Z"
}
```

| Trường | Ý nghĩa |
|---|---|
| `code` | Mã ngắn 8 ký tự (chữ thường và số) để chủ trọ đối chiếu, duy nhất |
| `planId` | Gói đã chọn |
| `planName`, `price`, `maxListings`, `durationDays` | **Bản chốt của gói tại lúc tạo đơn.** Admin sửa giá, số tin hay số ngày của gói sau đó **không đổi** đơn này. Hiển thị các trường này, đừng tra lại gói |
| `status` | `pending` (chờ thanh toán), `paid` (đã trả), `cancelled` (đã hủy). `paid` và `cancelled` là trạng thái cuối |
| `paidAt` | Lúc bấm thanh toán; `null` khi chưa trả |
| `cancelledAt` | Lúc hủy; `null` khi chưa hủy |
| `startsAt`, `endsAt` | Kỳ gói của đơn `paid` (ISO 8601, UTC); `null` với đơn `pending` và `cancelled` |
| `createdAt` | Lúc tạo đơn |

Không có `userId` trong kết quả: đơn luôn là của người đang đăng nhập.

`POST /orders` · quyền `order:create` và phải là tài khoản chủ trọ

| Trường (body) | Kiểu | Bắt buộc | Luật |
|---|---|---|---|
| `planId` | chuỗi UUID | có | Id gói lấy từ `GET /plans`. **Chỉ gửi mỗi `planId`**: giá, số tin và số ngày do backend lấy từ gói, trường lạ (ví dụ `price`) bị 400 |

**201 Created**: đơn `pending` (hình dạng ở trên, `paidAt`, `cancelledAt`, `startsAt`, `endsAt` đều `null`). Mỗi chủ trọ chỉ có **tối đa một đơn chờ**: nếu đang có một đơn `pending`, nó tự thành `cancelled` ngay trong lần tạo này. **Lỗi**: 400 `VALIDATION_FAILED` · 403 `PERMISSION_DENIED` · 404 `PLAN_NOT_FOUND` · 409 `PLAN_INACTIVE` (đơn chờ cũ **không** bị hủy khi tạo thất bại) · 401 · 429 `RATE_LIMITED`.

`GET /orders` · quyền `order:read`

Query: `page`, `pageSize` (mục 2) và `status` tùy chọn (`pending`, `paid` hoặc `cancelled`; giá trị khác là 400 `VALIDATION_FAILED`). **200 OK**: `{ items, total, page, pageSize }` gồm đơn của **chính người gọi**, **mới nhất trước**. Đây là lịch sử đơn.

`GET /orders/:id` · quyền `order:read`

**200 OK**: một đơn. **Lỗi**: 400 `INVALID_ID` · 404 `ORDER_NOT_FOUND` · 403 `NOT_RESOURCE_OWNER` (đơn của người khác, kể cả admin).

`POST /orders/:id/pay` · quyền `order:create` · không có body

Thanh toán thử. **200 OK**: đơn `paid` kèm `startsAt` và `endsAt`. Đơn thành `paid` và kỳ gói được tạo **cùng một lúc hoặc không gì cả**.
- **Kỳ nối tiếp.** `startsAt` là thời điểm lớn hơn giữa lúc bấm thanh toán và `endsAt` lớn nhất của các kỳ trước của chủ trọ. Chưa có gói (hoặc gói cũ đã hết) thì kỳ bắt đầu ngay; đang có gói thì kỳ mới **nối vào cuối** kỳ đang chạy (kể cả khi mua gói khác), không chồng, không hở. `endsAt` là `startsAt` cộng đúng `durationDays` ngày (đã chốt trên đơn), chính xác đến mili giây.
- **Bấm hai lần an toàn.** Thanh toán một đơn đã `paid` trả 200 với đúng kết quả lần trước và **không tạo kỳ mới**; bấm đồng thời nhiều lần cũng chỉ tạo một kỳ. FE vẫn nên khóa nút khi đang gửi.
- **Lỗi** (theo thứ tự kiểm): 400 `INVALID_ID` · 404 `ORDER_NOT_FOUND` · 403 `NOT_RESOURCE_OWNER` · 409 `ORDER_STATE_INVALID` (đơn đã `cancelled`) · 409 `PLAN_INACTIVE` (gói đã bị tắt sau khi đặt; đơn vẫn `pending`, cho chủ trọ hủy rồi chọn gói khác) · 403 `PERMISSION_DENIED` · 401 · 429.

`POST /orders/:id/cancel` · quyền `order:cancel` · không có body

Hủy đơn chưa trả. **200 OK**: đơn `cancelled` có `cancelledAt`. Hủy lại đơn đã `cancelled` vẫn 200 với đúng kết quả cũ. Đơn `paid` **không hủy được**: 409 `ORDER_STATE_INVALID` (hoàn tiền chưa có trong bản này). Hủy đơn không đổi hạn mức tin. **Lỗi**: 400 `INVALID_ID` · 404 `ORDER_NOT_FOUND` · 403 `NOT_RESOURCE_OWNER` · 409 `ORDER_STATE_INVALID` · 403 `PERMISSION_DENIED` · 401 · 429.

Cần nhớ:
- **Đơn chờ không tự hết hạn.** Một đơn `pending` bỏ dở nằm đó cho đến khi chủ trọ hủy hoặc tạo đơn mới. Vào lại trang mua gói thì nên gọi `GET /orders?status=pending` và hỏi "tiếp tục thanh toán" hoặc "hủy".
- **Chưa có API riêng cho kỳ gói.** Gói đang chạy và đã trả đến ngày nào xem ở `subscription` của `GET /me/membership` (6.25: `endsAt` của kỳ đang chạy, `paidUntil` của kỳ cuối cùng); lịch sử từng kỳ đọc ở `startsAt`, `endsAt` của các đơn `paid`.
- **Nâng gói phải chờ.** Mọi đơn đã trả đều nối vào cuối kỳ cuối cùng, kể cả khi là gói khác. Chủ trọ đang có gói 5 tin mua gói 15 tin thì hạn mức 15 chỉ có hiệu lực từ lúc kỳ 5 tin hết; không có đổi gói ngay, không cắt gói cũ, không hoàn tiền. FE nên nói rõ điều này ở bước xác nhận đơn khi `subscription` khác `null`.
- `paid` **không chứng minh đã thu tiền** (đây là thanh toán thử). Đừng hiển thị như biên lai thật.
- Ba lệnh ghi (`POST /orders`, `/pay`, `/cancel`) giới hạn 30 lần mỗi giờ cho mỗi API theo người dùng (429 `RATE_LIMITED`, mục 3).

### 6.28 Ảnh của tin

Chủ trọ tải ảnh lên từng tin, **tối đa 5 ảnh mỗi tin**. Ảnh có `position` nhỏ nhất là **ảnh bìa** (`coverImageUrl` ở danh sách). Ảnh được phục vụ công khai ở một đường dẫn riêng. Ảnh không được nén hay đổi kích thước (mục 9).

`POST /listings/:id/images` · quyền `listing:update` (chỉ chủ tin) · gửi **`multipart/form-data`**

| Phần của form | Kiểu | Bắt buộc | Luật |
|---|---|---|---|
| `file` | tệp ảnh | có | Đúng **một** tệp, tên trường đúng là `file`. JPEG, PNG hoặc WebP, nhận ra bằng **nội dung tệp** (đuôi tên và `Content-Type` do trình duyệt gửi không được tin). Tối đa `MAX_UPLOAD_BYTES` byte mỗi ảnh (mặc định 5 MiB) |

```js
const form = new FormData();
form.append('file', fileInput.files[0]);
const res = await fetch(`${API}/listings/${listingId}/images`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` }, // KHÔNG tự đặt Content-Type: trình duyệt tự thêm boundary
  body: form,
});
```

**201 Created**:

```json
{ "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d04", "position": 0, "url": "/api/v1/media/public/3f1c2a9e-7b4d-4e0a-9c15-8d6e2b7a1f40.png" }
```

`position` là vị trí trống nhỏ nhất từ 0 đến 4 (xóa một ảnh rồi tải ảnh mới thì ảnh mới lấp đúng chỗ trống). `url` là đường dẫn tương đối: FE nối với địa chỉ API rồi gán thẳng vào `<img src>`.

**Thứ tự báo lỗi**: 413 `PAYLOAD_TOO_LARGE` (ảnh quá dung lượng) trước, rồi 404 `LISTING_NOT_FOUND` hoặc 403 `NOT_RESOURCE_OWNER`, rồi 400 `IMAGE_INVALID`, rồi 409 `LISTING_IMAGE_LIMIT` (đã đủ 5 ảnh). Ngoài ra: 400 `INVALID_ID` · 403 `PERMISSION_DENIED` (người tìm trọ) · 401 · 429 `RATE_LIMITED` (60 lần mỗi giờ).

`DELETE /listings/:id/images/:imageId` · quyền `listing:update` (chỉ chủ tin)

**204 No Content**, không có thân. Ảnh nhỏ nhất còn lại trở thành ảnh bìa. **Lỗi**: 404 `LISTING_NOT_FOUND` · 403 `NOT_RESOURCE_OWNER` · 404 `NOT_FOUND` (ảnh không có, đã xóa hoặc không thuộc tin này) · 400 `INVALID_ID` · 403 `PERMISSION_DENIED` · 401.

`GET /api/v1/media/public/<uuid>.<đuôi>` · công khai, **không cần token**

Đây là `url` trong phản hồi, dùng thẳng cho thẻ `<img>`. Trả tệp ảnh với `Content-Type` đúng loại (`image/jpeg`, `image/png`, `image/webp`), `Cache-Control: public, max-age=86400` và `X-Content-Type-Options: nosniff`. **Chỉ phục vụ ảnh của tin đang hiện công khai** (đúng điều kiện ở 6.19): tin bị ẩn, bị xóa, chủ trọ bị khóa, hết dùng thử và hết gói, hoặc tin bị ẩn bớt vì vượt hạn mức thì ảnh trả **404 `NOT_FOUND`**. Lỗi 404 không bị cache.

Cần nhớ:
- Tải ảnh được vào tin ở **mọi trạng thái**, kể cả tin đang ẩn và tin bị admin ẩn, và **không bị cửa hạn mức chặn** (như sửa tin), kể cả khi hết dùng thử.
- Hai lần tải đồng thời khi tin chỉ còn một chỗ thì đúng một lần thành công, lần kia nhận 409 `LISTING_IMAGE_LIMIT`.
- Gửi từ 2 đến 5 tệp trong một yêu cầu là 400 `IMAGE_INVALID`; gửi **hơn 5 tệp** bị chặn sớm hơn với 400 `BAD_REQUEST` chung. FE chỉ cần gửi từng ảnh một.
- Không có API đổi thứ tự ảnh: muốn đổi ảnh bìa thì xóa ảnh bìa (ảnh kế tiếp thành bìa) hoặc xóa và tải lại.
- Ảnh của tin bị ẩn nằm trong bộ nhớ đệm trình duyệt tối đa một ngày. Chủ trọ **không xem được ảnh của tin đang ẩn của chính mình** qua đường này (thẻ `<img>` không gửi token); hiện lại tin là thấy.
- Xóa mềm tin giữ nguyên ảnh (ổ đĩa chỉ tăng). Ảnh được kiểm bằng nội dung tệp, tên tệp do backend đặt, không thể đi ra ngoài thư mục lưu ảnh.

### 6.29 Kiểm duyệt tin (admin)

Admin tìm tin của mọi chủ trọ, ẩn tin vi phạm kèm lý do và gỡ ẩn khi chủ trọ đã sửa. Cả ba API cần quyền `listing:moderate` (chỉ admin giữ). Chủ trọ và người tìm trọ gọi bị 403 `PERMISSION_DENIED`; không có token thì 401 `TOKEN_MISSING`. Không có bước duyệt trước khi tin hiện: admin chỉ xử lý sau khi tin đã đăng.

`GET /moderation/listings` · quyền `listing:moderate`

Danh sách tin để kiểm duyệt: **mọi trạng thái, kể cả tin đang ẩn và tin của chủ trọ đã hết dùng thử**, chỉ bỏ tin đã xóa mềm, mới đăng xếp trước. Đây là danh sách riêng của admin, **không** theo luật hiển thị công khai ở 6.19.

| Query | Kiểu | Luật |
|---|---|---|
| `status` | chuỗi, tùy chọn | `visible`, `hidden_by_owner` hoặc `hidden_by_admin`. Giá trị khác là 400 `VALIDATION_FAILED` |
| `landlordId` | UUID, tùy chọn | Chỉ tin của chủ trọ này. Không phải UUID là 400 `VALIDATION_FAILED` |
| `q` | chuỗi, tùy chọn | Từ khóa giống 6.19: không dấu, không phân biệt hoa thường, mỗi từ phải khớp (tối đa 6 từ). Tìm trong tiêu đề, tên nhà trọ, địa chỉ và tên phường. Ký tự `%`, `_` và `\` chỉ khớp chính nó |
| `page`, `pageSize` | số | Như mọi danh sách: `page` từ 1, `pageSize` từ 1 đến 50 (mặc định 20) |

**200 OK**: `{ "items": [...], "total", "page", "pageSize" }`. Mỗi phần tử là một **Mục kiểm duyệt**:

```json
{
  "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d03",
  "code": "k7m2xq9p",
  "slug": "phong-dep-co-gac-gan-cho-ben-thanh",
  "title": "Phòng đẹp có gác gần chợ Bến Thành",
  "price": 3500000,
  "areaM2": 22.5,
  "deposit": 3500000,
  "availableFrom": "2026-11-01",
  "coverImageUrl": null,
  "ward": { "code": "26743", "name": "Phường Bến Thành" },
  "addressText": "12 Lê Lợi",
  "fullAddress": "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh",
  "landlord": { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01", "name": "Anh Nam" },
  "createdAt": "2026-10-20T03:00:00.000Z",
  "status": "hidden_by_admin",
  "moderationReason": "Ảnh không đúng thực tế",
  "viewCount": 12
}
```

Đó là tin tóm tắt (6.19) có `landlord` nhưng **không có số điện thoại**, cộng ba trường: `status`; `moderationReason` (lý do ẩn gần nhất, chỉ có giá trị khi `status` là `hidden_by_admin`, ngược lại `null`); `viewCount`. **Không có `isPublic`** (cờ đó dành cho chủ trọ, 6.18).

`POST /moderation/listings/:id/hide` · quyền `listing:moderate` · cần đăng nhập còn mới
`POST /moderation/listings/:id/unhide` · quyền `listing:moderate` · cần đăng nhập còn mới

Body: `{ "reason": "..." }`. `reason` bắt buộc, **1 đến 500 ký tự sau khi cắt khoảng trắng đầu cuối**: thiếu, rỗng, toàn khoảng trắng hay dài hơn là 400 `VALIDATION_FAILED` (`errors[].field` là `reason`). Không nhận trường nào khác.

| Trạng thái hiện tại | `hide` | `unhide` |
|---|---|---|
| `visible` | thành `hidden_by_admin` | 409 `LISTING_STATE_INVALID` |
| `hidden_by_owner` | thành `hidden_by_admin` | 409 `LISTING_STATE_INVALID` |
| `hidden_by_admin` | 409 `LISTING_STATE_INVALID` | thành `hidden_by_owner` |

**200 OK**: Mục kiểm duyệt sau khi chuyển.

**Lỗi**: 400 `VALIDATION_FAILED` · 400 `INVALID_ID` · 404 `LISTING_NOT_FOUND` (tin không có hoặc đã xóa mềm) · 409 `LISTING_STATE_INVALID` · 403 `PERMISSION_DENIED` · 403 `ACCOUNT_LOCKED` · 401.

Cần nhớ:
- "Cần đăng nhập còn mới" nghĩa là backend đọc lại tài khoản admin từ cơ sở dữ liệu cho hai API ghi này (như khóa tài khoản ở 6.10): admin vừa bị khóa hay vừa mất quyền bị từ chối ngay, không đợi access token hết hạn. `GET /moderation/listings` thì theo quyền trong token như các API đọc khác.
- Mỗi lần ẩn hoặc gỡ ẩn ghi **một dòng lịch sử kiểm duyệt** (người làm, tin, hành động, lý do) trong cùng giao dịch với việc đổi trạng thái. Chưa có API đọc lịch sử này (mục 9).
- `unhide` đưa tin về `hidden_by_owner`, **không** về `visible`: chủ trọ tự bấm "Hiện" lại, và lúc đó tin đi qua cửa hạn mức như mọi lần hiện tin (6.23). Sau `unhide` chủ trọ chỉ thấy nhãn "Bị quản trị viên ẩn" biến mất.
- Lệnh ẩn nhận cả hai trạng thái nguồn. Admin ẩn đúng lúc chủ trọ bấm ẩn hoặc hiện thì **admin luôn thắng** (6.23). Hai admin ẩn cùng một tin cùng lúc thì một người nhận 200, người kia nhận 409 `LISTING_STATE_INVALID` và chỉ có đúng một dòng lịch sử.
- Tin bị ẩn biến khỏi danh sách, chi tiết và ảnh công khai ngay (6.19, 6.20, 6.28). Chủ trọ thấy `status` là `hidden_by_admin` kèm `moderationReason` ở 6.21 và vẫn sửa được tin.
- Admin **không sửa hay xóa tin của người khác** (kiểm chủ sở hữu, 403 `NOT_RESOURCE_OWNER`): admin chỉ ẩn và gỡ ẩn.

### 6.30 Quản lý phường, xã, đặc khu và tiện ích (admin)

Danh sách đọc công khai ở 6.15 và 6.16. Phần ghi (thêm, đổi tên, xóa) chỉ admin giữ quyền `catalog:create`, `catalog:update`, `catalog:delete`. Chủ trọ và người tìm trọ gọi bị 403 `PERMISSION_DENIED`; không có token thì 401 `TOKEN_MISSING`. Hai danh sách ngắn, dùng cho ô chọn, nên **không phân trang**.

| API | Quyền | Body | Kết quả |
|---|---|---|---|
| `POST /wards` | `catalog:create` | `code`, `name`, `provinceCode`, `provinceName` | 201, một phường |
| `PATCH /wards/:code` | `catalog:update` | `name?`, `provinceName?` | 200, phường sau khi sửa |
| `DELETE /wards/:code` | `catalog:delete` | không | 204 |
| `POST /amenities` | `catalog:create` | `key`, `name` | 201, một tiện ích |
| `PATCH /amenities/:key` | `catalog:update` | `name` | 200, tiện ích sau khi sửa |
| `DELETE /amenities/:key` | `catalog:delete` | không | 204 |

Phản hồi là đúng hình dạng của 6.15 (`code`, `name`, `provinceCode`, `provinceName`) và 6.16 (`key`, `name`).

Luật dữ liệu:
- **Phường**: `code` đúng 5 chữ số; `provinceCode` đúng 2 chữ số; `name` và `provinceName` từ 2 đến 100 ký tự sau khi cắt khoảng trắng. `name` là tên đầy đủ kèm loại đơn vị ("Phường Bến Thành"). **Không có trường quận huyện**: trường lạ bị 400. `code` và `provinceCode` là khóa của dòng, **không đổi được** (gửi chúng ở `PATCH` là 400). `PATCH` với thân rỗng trả 200 và không đổi gì.
- **Tiện ích**: `key` gồm chữ thường, số, gạch dưới, bắt đầu bằng chữ, dài 2 đến 30 ký tự; `name` từ 2 đến 50 ký tự. `PATCH` bắt buộc có `name`; khóa không đổi được.

**Lỗi**: 400 `VALIDATION_FAILED` · 409 `CATALOG_CODE_TAKEN` (tạo trùng mã phường hoặc khóa tiện ích, kể cả mã do seed tạo) · 409 `CATALOG_IN_USE` (xóa mục còn nhà trọ đang dùng, **kể cả nhà trọ đã xóa mềm**) · 404 `NOT_FOUND` (phường hoặc tiện ích không có, kể cả mã hay khóa rác) · 403 `PERMISSION_DENIED` · 401.

Cần nhớ:
- **Đổi tên phường làm mới tìm kiếm**: trong cùng giao dịch với việc đổi tên, backend dựng lại từ khóa tìm kiếm của mọi tin chưa xóa thuộc phường đó. Ngay sau `PATCH`, tìm theo tên mới ra tin (6.19) và tìm theo tên cũ không còn ra nữa. `fullAddress` ghép lúc đọc nên cũng đổi ngay ở nhà trọ, tin công khai và tin của chủ trọ. Chỉ đổi `provinceName` thì từ khóa không đổi.
- Xóa bị chặn khi còn nhà trọ dùng, nên gặp 409 `CATALOG_IN_USE` thì báo "mục này đang được nhà trọ sử dụng nên chưa thể xóa". Nhà trọ đã xóa mềm vẫn giữ tham chiếu, nên một phường hay tiện ích từng được dùng thì không bao giờ xóa được.
- Danh sách công khai (6.15, 6.16) thấy thay đổi ngay. FE đang lưu tạm danh sách trong phiên thì nên tải lại sau khi admin sửa.
- `npm run seed` chỉ thêm dòng còn thiếu, nên phường hoặc tiện ích mẫu mà admin đã xóa sẽ quay lại ở lần chạy seed sau; tên admin đã sửa thì seed không ghi đè.

---

## 7. Luồng màn hình gợi ý

### Đăng ký

1. Cho chọn loại: **Người đăng bài** (`landlord`) hoặc **Người tìm trọ** (`tenant`). Nói rõ chọn một lần, không đổi được.
2. Biểu mẫu: email, mật khẩu (8 đến 128 ký tự), tên (không bắt buộc). Chọn người đăng bài thì hiện thêm ô **số điện thoại** (bắt buộc); người tìm trọ thì ô này không bắt buộc.
3. Gọi `POST /auth/register`. Thành công thì làm như đăng nhập (mục 4). Báo lỗi `EMAIL_TAKEN`, `PHONE_TAKEN` ngay ô tương ứng; lỗi `VALIDATION_FAILED` theo `errors[].field`.
4. FE có thể kiểm sơ bộ số điện thoại cho nhanh nhưng **backend là nơi quyết định**; không tự biến đổi số trước khi gửi (backend đã chuẩn hóa).

### Quên mật khẩu (FE cần hai trang)

1. **Trang xin liên kết** (ví dụ `/forgot-password`): nhập email, gọi `POST /auth/forgot-password`, hiện câu `message` trả về (cùng một câu cho mọi email). Có thể thêm đếm ngược trước khi cho bấm gửi lại.
2. **Trang `/reset-password`** (**đường dẫn này cố định**: liên kết trong email luôn trỏ tới `<địa chỉ FE>/reset-password?token=...`):
   - Đọc `token` từ query, rồi xóa nó khỏi thanh địa chỉ (ví dụ `history.replaceState`) để không lọt vào lịch sử hay header `Referer`.
   - Hiện ô mật khẩu mới (và ô nhập lại, kiểm khớp ở FE).
   - Gọi `POST /auth/reset-password`. **204**: báo thành công và chuyển về đăng nhập (mọi phiên cũ đã bị hủy). **400 `RESET_TOKEN_INVALID`**: báo "liên kết không dùng được hoặc đã hết hạn" kèm nút xin liên kết mới. **400 `VALIDATION_FAILED`**: hiện lỗi dưới ô mật khẩu, người dùng nhập lại với cùng liên kết.

### Đổi mật khẩu (trong trang tài khoản)

Hai ô: mật khẩu hiện tại, mật khẩu mới. Gọi `POST /auth/change-password`. **204**: báo thành công, người dùng **vẫn đăng nhập**; thiết bị khác bị đăng xuất, nên nên nói rõ "các thiết bị khác sẽ phải đăng nhập lại". `CURRENT_PASSWORD_WRONG`: báo ở ô mật khẩu hiện tại.

### Quản lý nhà trọ (chủ trọ)

1. **Trang danh sách**: gọi `GET /properties` (phân trang), hiện tên, `fullAddress`, `listingCount` và nút sửa, xóa. Chưa có nhà trọ thì mời tạo nhà trọ đầu tiên. Chỉ hiện cho tài khoản có quyền `property:read` (kiểm `permissions` của `/auth/me`).
2. **Biểu mẫu tạo và sửa** (dùng chung một biểu mẫu):
   - Tên, ô **số nhà và tên đường** (`addressText`), ô chọn **phường hoặc xã** từ `GET /wards` (gửi `code`), và dòng chỉ-đọc hiện tên tỉnh hoặc thành phố đi theo phường đã chọn (`provinceName`). **Không có ô quận huyện.**
   - Phí: tối đa 6 dòng, mỗi loại phí chỉ chọn một lần (ẩn loại đã chọn khỏi danh sách), mỗi dòng gồm giá, đơn vị tính và ghi chú tùy chọn.
   - Tiện ích: nhiều ô chọn từ `GET /amenities` (gửi `key`).
   - Tọa độ (không bắt buộc): nếu có thì phải đủ cả vĩ độ và kinh độ.
   - Khi sửa, gửi lại **toàn bộ** `fees` và `amenityKeys` (backend thay cả danh sách). Chỉ gửi các trường người dùng đã đổi cũng được.
3. **Xóa**: hỏi xác nhận; gặp 409 `PROPERTY_HAS_LISTINGS` thì báo phải xóa các tin trước.
4. Lỗi `VALIDATION_FAILED` hiện dưới từng ô theo `errors[].field`; với phí, `field` có dạng `fees.0.price` (số thứ tự trong mảng đã gửi).

### Đăng và quản lý tin (chủ trọ)

0. **Dải trạng thái dùng thử** đầu trang quản lý tin: gọi `GET /me/membership` (6.25) và hiện "Còn N ngày dùng thử · đang hiện X trên Y tin". `state` là `plan` thì hiện "Gói <planName> đến hết ngày <endsAt> · đang hiện X trên Y tin" (thêm "đã trả đến <paidUntil>" khi `paidUntil` khác `endsAt`); `state` là `expired` thì đổi thành lời mời mua gói. `overLimitCount` lớn hơn 0 thì hiện cảnh báo có tin đang bị ẩn khỏi khách. Gọi lại sau mỗi lần đăng, ẩn, hiện, xóa.
1. **Trang quản lý tin**: `GET /me/listings` (lọc theo `status` nếu muốn), mỗi dòng hiện ảnh bìa, tiêu đề, giá, `fullAddress`, `viewCount` và nhãn trạng thái. Với tin `visible` mà `isPublic` là `false`, thêm nhãn "Đang bị ẩn bớt vì vượt hạn mức" (hoặc "Hết dùng thử và chưa có gói"), đừng hiện như một tin đang chạy bình thường. Nút theo trạng thái: `visible` có "Ẩn"; `hidden_by_owner` có "Hiện"; `hidden_by_admin` **không có nút Hiện**, thay bằng nhãn "Bị quản trị viên ẩn" kèm `moderationReason`.
2. **Đăng tin** từ trang một nhà trọ (hoặc chọn nhà trọ trước): biểu mẫu tiêu đề, mô tả, giá, diện tích, tiền cọc và ngày vào ở (không bắt buộc). Gọi `POST /properties/:propertyId/listings`. **Tin hiện ngay**, nên sau khi thành công có thể mở luôn trang công khai `/<slug>-<code>` cho chủ trọ xem. Chưa có nhà trọ thì dẫn đi tạo nhà trọ trước.
3. **Sửa tin**: mở biểu mẫu bằng `GET /me/listings/:id`, gửi `PATCH` các trường đã đổi (cho phép sửa cả khi tin đang ẩn, kể cả bị admin ẩn). Muốn bỏ tiền cọc hoặc ngày vào ở thì gửi `null`.
4. **Xóa tin**: hỏi xác nhận, `DELETE`. Muốn xóa nhà trọ thì phải xóa hết tin của nó trước.
5. Gặp 409 `LISTING_STATE_INVALID` hoặc 403 `LISTING_HIDDEN_BY_ADMIN` ở nút ẩn, hiện: tải lại tin để lấy trạng thái thật (có thể admin vừa ẩn).
6. **Hạn mức** (đăng tin và nút "Hiện"): gặp 403 `LISTING_QUOTA_REACHED` thì báo "bạn đã dùng hết số tin được hiện, hãy ẩn hoặc xóa bớt một tin" và giữ nguyên biểu mẫu để người dùng không mất chữ đã nhập; gặp 403 `MEMBERSHIP_REQUIRED` thì báo kỳ dùng thử đã hết kèm nút "Mua gói" dẫn tới trang bảng giá (mục "Bảng giá gói" bên dưới); mua xong đăng được ngay. **Không** coi hai lỗi này là lỗi hệ thống, và **không** thử lại tự động. Khi hết dùng thử vẫn cho ẩn, sửa, xóa tin và quản lý nhà trọ bình thường.

7. Tin `visible` vẫn có thể không hiện công khai: chủ trọ hết dùng thử và hết gói, hoặc tin đăng sau bị ẩn bớt vì vượt hạn mức (6.19). **Đừng suy ra từ `status` rằng tin đang hiện với khách; đọc `isPublic`** (6.18), có ở mọi phản hồi tin của chủ trọ.
8. **Ảnh của tin** (trong biểu mẫu tin và trang quản lý tin): nút "Thêm ảnh" mở hộp chọn tệp (`accept="image/jpeg,image/png,image/webp"`), gửi **từng ảnh một** bằng `POST /listings/:id/images` (6.28), hiện ảnh từ `url` trả về. Lấy danh sách ảnh từ `images[]` của `GET /me/listings/:id`, mỗi ảnh có nút "Xóa" gọi `DELETE /listings/:id/images/:imageId`. Ẩn nút thêm khi đã đủ 5 ảnh, nhưng vẫn xử lý 409 `LISTING_IMAGE_LIMIT`, 400 `IMAGE_INVALID` và 413 `PAYLOAD_TOO_LARGE` bằng `message` của backend. Kiểm dung lượng ở FE trước khi gửi nếu muốn (mặc định 5 MiB).

### Tìm trọ (khách và người tìm trọ)

1. **Trang danh sách**: `GET /listings` với ô tìm kiếm (`q`), ô chọn phường (`wardCode` lấy từ `GET /wards`), khoảng giá (`minPrice`, `maxPrice`) và kiểu sắp xếp (`sort`). Phân trang theo mục 2. Chỉ có tin tóm tắt, **không có số điện thoại**. Hiện `fullAddress` thẳng.
2. **Trang chi tiết** (địa chỉ `/<slug>-<code>`): gọi `GET /listings/:slugCode`, **gửi kèm access token nếu đã đăng nhập** để thấy số điện thoại. Khách thì thay chỗ số bằng nút "Đăng nhập để xem số điện thoại". Nếu `slug` trả về khác `slug` trên địa chỉ thì thay địa chỉ trên thanh địa chỉ (`history.replaceState`). 404 thì báo "tin không còn".
3. Số lượt xem hiện ở `viewCount`. Đừng tự cộng ở FE: backend đã tính theo người xem trong 30 phút.
4. **Ảnh**: dùng `coverImageUrl` làm ảnh nhỏ ở danh sách và `images[]` làm thư viện ở trang chi tiết, nối `url` với địa chỉ API rồi gán vào `<img src>` (không cần token). `coverImageUrl` là `null` thì hiện ảnh thay thế. Ảnh trả 404 (tin vừa bị ẩn hay hết hạn mức) thì ẩn ô ảnh chứ đừng coi là lỗi hệ thống.

### Bảng giá gói (khách và chủ trọ)

1. **Trang bảng giá**: gọi `GET /plans` (công khai, không cần token), vẽ mỗi gói một thẻ: tên, giá (định dạng đồng), "tối đa N tin", "N ngày". Đã xếp giá tăng dần.
2. Nút "Mua" (chỉ với chủ trọ đã đăng nhập) gọi `POST /orders` với `planId` của thẻ, rồi chuyển sang bước xác nhận đơn. Khách chưa đăng nhập thì dẫn đi đăng nhập; người tìm trọ và admin không có nút "Mua" (sẽ nhận 403). Thanh toán xong thì gọi lại `GET /me/membership` (6.25): có `state = plan`, chủ trọ đăng được ngay và tin hiện lại với khách ngay.
3. **Bước xác nhận đơn**: hiện `planName`, `price`, `maxListings`, `durationDays` của đơn (bản chốt) và nút "Thanh toán thử" gọi `POST /orders/:id/pay`; nút "Hủy đơn" gọi `POST /orders/:id/cancel`. Khóa nút khi đang gửi. Thanh toán xong hiện `endsAt` ("gói đến hết ngày ..."). Gặp 409 `PLAN_INACTIVE` thì báo "gói đã ngừng bán" và cho chọn lại.
4. **Lịch sử đơn**: `GET /orders` (phân trang, mới nhất trước), mỗi dòng hiện `code`, `planName`, `price`, `status`, và `startsAt`, `endsAt` khi đã trả. Đơn `pending` có nút "Tiếp tục thanh toán" và "Hủy".
5. Chỗ dẫn tới trang này: nút "Mua gói" ở lỗi `MEMBERSHIP_REQUIRED` (6.18) và dải trạng thái khi `state` là `expired` (6.25). Chủ trọ đang có gói cũng có thể vào để gia hạn: kỳ mới nối vào cuối, nên bước xác nhận đơn hiện "gói mới bắt đầu sau khi gói hiện tại hết, vào <`paidUntil`>".
6. **Gói đang chạy** (trang tài khoản hoặc dải trạng thái): đọc `subscription` của `GET /me/membership` (6.25), hiện `planName`, "còn `daysLeft` ngày", "đã trả đến `paidUntil`" và hạn mức `listingLimit`.

### Màn hình admin

- **Chỉnh quyền loại tài khoản**: lấy `GET /permissions` (danh mục) và `GET /account-types` (quyền hiện tại). Vẽ ma trận hành động theo module cho `landlord` và `tenant`. Tắt (không cho chọn) mọi hành động trong `adminActions`. Khi lưu, gửi **toàn bộ** danh sách đang chọn bằng `PATCH /account-types/:key`. Nên ghi chú: người dùng đang đăng nhập nhận quyền mới trong tối đa 15 phút hoặc khi họ refresh.
- **Khóa, mở khóa**: bắt nhập **lý do** (bắt buộc cả khóa lẫn mở khóa). Khóa xong thì người đó mất phiên ngay. Hiện tại **chưa có API danh sách người dùng** để tìm id; xem mục 10.
- **Quản lý gói**: bảng lấy từ `GET /plans/all` (phân trang), hiện cả gói đã tắt với nhãn "Đã ngừng bán". Biểu mẫu tạo và sửa dùng chung: tên, giá, số tin, số ngày, công tắc "Đang bán"; giới hạn ô nhập theo mục 6.26. Công tắc đổi `isActive` bằng `PATCH`. Nút xóa hỏi xác nhận; gặp 409 `PLAN_IN_USE` thì báo "gói đã có đơn, hãy tắt thay vì xóa". Gặp 409 `PLAN_NAME_TAKEN` thì báo ở ô tên (mục 6.26).
- **Tham số hệ thống**: một trang nhỏ với hai ô số: lấy `GET /settings`, mỗi dòng một ô nhập có giới hạn `min` và `max` lấy từ phản hồi, nút lưu gọi `PATCH /settings/:key` cho từng khóa (mục 6.24). Hiện `updatedAt` và `updatedBy` để biết ai sửa lần cuối. Nên ghi chú: đổi số ngày chỉ áp cho chủ trọ đăng ký sau đó.
- **Kiểm duyệt tin**: bảng lấy từ `GET /moderation/listings` (phân trang) với ô tìm kiếm `q`, bộ lọc `status` và `landlordId` (mục 6.29). Mỗi dòng hiện ảnh bìa, tiêu đề, tên chủ trọ, `fullAddress`, `viewCount` và nhãn trạng thái. Tin `visible` hoặc `hidden_by_owner` có nút "Ẩn"; tin `hidden_by_admin` có nút "Gỡ ẩn" và hiện `moderationReason`. Cả hai nút mở hộp nhập **lý do bắt buộc** (1 đến 500 ký tự) trước khi gửi. Sau khi gọi, thay dòng bằng Mục kiểm duyệt trả về; gặp 409 `LISTING_STATE_INVALID` thì tải lại dòng (có thể chủ trọ hoặc admin khác vừa đổi). Nhắc admin: gỡ ẩn **không** tự hiện tin, chủ trọ phải bấm "Hiện". Chưa có màn hình lịch sử kiểm duyệt (mục 9).
- **Danh mục phường, xã và tiện ích**: hai bảng nhỏ lấy từ `GET /wards` và `GET /amenities`, mỗi bảng có nút thêm, đổi tên và xóa (mục 6.30). Ô mã phường đúng 5 chữ số, mã tỉnh đúng 2 chữ số, khóa tiện ích chữ thường, số, gạch dưới; **không có ô quận huyện**. Mã và khóa chỉ nhập lúc tạo, sau đó chỉ cho đổi tên. Tạo gặp 409 `CATALOG_CODE_TAKEN` thì báo ở ô mã; xóa gặp 409 `CATALOG_IN_USE` thì báo "đang có nhà trọ dùng, không xóa được" (gợi ý đổi tên thay vì xóa).

### Hiển thị theo quyền

Ẩn hoặc làm mờ nút khi thiếu quyền (dựa vào `permissions` của `/auth/me`), nhưng **backend vẫn là nơi kiểm cuối**: gặp 403 `PERMISSION_DENIED` thì báo không đủ quyền chứ đừng coi là lỗi hệ thống.

---

## 8. Quy tắc nghiệp vụ cần nhớ

- **Email** duy nhất toàn hệ thống, không phân biệt hoa thường; tài khoản đã xóa vẫn giữ email của nó (đăng ký lại bằng email đó vẫn báo `EMAIL_TAKEN`).
- **Số điện thoại** của người đăng bài duy nhất toàn hệ thống (kể cả tài khoản đã xóa) và người đăng bài không tự đổi số sau khi đăng ký. Mục đích: mỗi số chỉ nhận một lần dùng thử miễn phí (sẽ làm sau). Người tìm trọ có thể trùng số.
- **Loại tài khoản không đổi.** Không có API đổi loại.
- **Địa chỉ hai cấp.** Mọi địa chỉ trong hệ thống theo đơn vị hành chính mới sau sáp nhập: số nhà và đường, phường hoặc xã (`GET /wards`), tỉnh hoặc thành phố. Không có quận huyện. Xem mục 6.15.
- **Nhà trọ** thuộc đúng một chủ trọ (không đổi chủ). Mỗi nhà trọ có tối đa một khoản phí cho mỗi loại trong 6 loại, tiện ích chọn từ danh mục. Xóa nhà trọ là xóa mềm và chỉ được khi không còn tin chưa xóa. Mọi thao tác chỉ trên nhà trọ của chính mình (403 `NOT_RESOURCE_OWNER` nếu khác), kể cả admin.
- **Dùng thử và hạn mức tin** (từ 2026-10-19). Chủ trọ có kỳ dùng thử từ lúc đăng ký (mặc định 30 ngày) và trong kỳ được hiện tối đa 2 tin (admin đổi cả hai con số). Hạn mức hiện hành theo thứ tự: số tin của gói đang chạy nếu có (mục Gói bên dưới), không thì `trial_listing_limit` khi còn trong kỳ dùng thử (so sánh chặt: đúng lúc hết hạn là hết), không thì 0. Chỉ tin `visible` chưa xóa tính vào "đang hiện". Cửa hạn mức chỉ ở **đăng tin** và **hiện lại tin**; ẩn, sửa, xóa tin và mọi thao tác nhà trọ không bị chặn. Hạn mức tính lại mỗi lần gọi, không lưu: đổi tham số hay hết hạn có hiệu lực ngay. Chủ trọ đọc trạng thái ở `GET /me/membership` (6.25) và cờ `isPublic` của từng tin (6.18).
- **Tin đăng** thuộc một nhà trọ, nên chủ tin là chủ nhà trọ (không đổi). Tin **hiện ngay khi đăng**, không nháp, không duyệt. Ba trạng thái: `visible`, `hidden_by_owner`, `hidden_by_admin`. Chủ trọ tự chuyển giữa `visible` và `hidden_by_owner`; tin `hidden_by_admin` chủ trọ không tự hiện lại được nhưng vẫn sửa và xóa được.
- **Một tin hiện ra công khai khi và chỉ khi** tin `visible` và chưa xóa, nhà trọ chưa xóa, và chủ trọ đang hoạt động (không bị khóa, chưa xóa), **tin nằm trong N tin `visible` đăng sớm nhất của chủ trọ**, N là hạn mức hiện hành của chủ trọ (số tin của gói đang chạy, hoặc `trial_listing_limit` khi còn dùng thử, hoặc 0; mục 6.19). Tính lúc đọc nên khóa tài khoản, hết gói và hết dùng thử, hay hạ hạn mức làm tin biến khỏi danh sách ngay, còn mở khóa, nâng hạn mức hay mua gói thì tin hiện lại.
- **Gói** (từ 2026-10-19). Bảng giá công khai chỉ có gói đang bán. Admin tạo, sửa, tắt, xóa gói; xóa chỉ khi chưa có đơn nào đặt gói đó. Giá, số tin và số ngày của một lần mua được chốt vào đơn lúc tạo đơn, nên sửa gói không đổi đơn đã đặt. Mua gói là tạo đơn rồi thanh toán thử (6.27), ra một kỳ 30 ngày; các kỳ nối tiếp nhau. **Gói đang chạy thay hạn mức dùng thử**, kể cả khi nhỏ hơn. Gói hết đúng lúc `endsAt` (so chặt): hạn mức quay về dùng thử nếu còn, không thì 0 và mọi tin biến ngay. Mua gói không đổi hạn dùng thử. Mua thêm khi đang có gói thì kỳ mới nối vào cuối, kể cả gói khác: gói lớn hơn chỉ có hiệu lực từ khi kỳ trước hết.
- **Số điện thoại chủ trọ** chỉ trả ở chi tiết tin và chỉ cho người gọi có access token hợp lệ; không có ở danh sách và không bao giờ có cho khách.
- **Kiểm duyệt tin** (từ 2026-10-20). Không duyệt trước khi tin hiện; admin xử lý sau khi đăng. Admin ẩn tin `visible` hoặc `hidden_by_owner` thành `hidden_by_admin`, và gỡ ẩn tin `hidden_by_admin` về `hidden_by_owner`; mỗi lần bắt buộc có lý do và ghi một dòng lịch sử trong cùng giao dịch (6.29). Admin ẩn đua với chủ trọ thì admin thắng. Admin không sửa hay xóa tin của người khác.
- **Danh mục phường và tiện ích** do admin quản lý (6.30). Xóa chỉ được khi không nhà trọ nào dùng, kể cả nhà trọ đã xóa mềm. Đổi tên phường làm tìm kiếm theo tên mới có hiệu lực ngay.
- **Lượt xem** tính một lần cho mỗi người xem trong 30 phút, chủ tin không tính (6.20).
- **Khóa tài khoản**: tài khoản bị khóa không đăng nhập, không refresh được và mọi phiên bị hủy lúc khóa. Đăng nhập sai mật khẩu vẫn báo `INVALID_CREDENTIALS` (không lộ tài khoản có bị khóa hay không); chỉ khi đúng mật khẩu mới báo `ACCOUNT_LOCKED`. Admin không tự khóa mình được.
- **Đổi hoặc đặt lại mật khẩu** hủy phiên: đặt lại hủy **tất cả**; đổi (khi đang đăng nhập) hủy tất cả **trừ phiên đang dùng**.
- **Mật khẩu mới** có thể trùng mật khẩu cũ (backend không cấm).
- **Mọi thông báo lỗi** là tiếng Việt, hiển thị trực tiếp được.
- **Dữ liệu cá nhân trả về** chỉ gồm `id, email, name, accountType, phone, status`. Không bao giờ có mật khẩu.

---

## 9. Giới hạn đã biết

- **Quyền trong access token có thể cũ tối đa 15 phút.** Khi admin đổi quyền một loại hoặc khóa một tài khoản, với API thường người đó dùng được quyền cũ đến khi token hết hạn. Các thao tác nhạy cảm (sửa quyền loại, khóa, mở khóa, thu hồi phiên) luôn kiểm lại cơ sở dữ liệu nên có hiệu lực ngay. `GET /auth/me` cũng luôn mới.
- **Cookie phụ thuộc host.** FE và API phải cùng dùng `localhost` (khác cổng thì được). Dùng `127.0.0.1` cho một bên thì refresh lỗi âm thầm.
- **Email quên mật khẩu** gửi qua Gmail SMTP của backend; backend chạy thiếu cấu hình mail sẽ không khởi động. Gửi email lỗi không báo cho người gọi API.
- **Giới hạn tần suất nằm trong bộ nhớ** của backend: khởi động lại là về 0, và nếu sau này chạy nhiều bản backend thì mỗi bản đếm riêng. Chạy localhost không qua proxy thì mọi client cùng một IP.
- Người xấu có thể cố ý gọi đăng nhập dồn bằng email của người khác để **khóa đăng nhập email đó trong 15 phút** (đánh đổi của việc giới hạn theo email). Tương tự, người ta có thể gọi dồn quên mật khẩu bằng email đó để chặn việc xin liên kết mới trong 1 giờ. Liên kết đặt lại đã gửi trước đó vẫn dùng được.
- **Chưa có API danh sách người dùng** nên màn hình admin chưa tìm được người để khóa ngoài việc biết sẵn id.
- **Lượt xem tính trong bộ nhớ** của backend: khởi động lại thì mọi người xem được tính lại từ đầu (cộng dư vài lượt), và nếu sau này chạy nhiều bản backend thì mỗi bản tính riêng. Nhiều người không đăng nhập dùng chung một IP chỉ tính một lượt mỗi 30 phút.
- **Số điện thoại với tài khoản vừa bị khóa**: access token còn hạn (tối đa 15 phút) vẫn được coi là đã đăng nhập ở trang chi tiết tin, nên tài khoản vừa bị khóa còn thấy số điện thoại đến khi token hết hạn. Mọi phiên của tài khoản đã bị hủy nên không refresh được.
- **Thanh toán là thanh toán thử**: `paid` chỉ nghĩa là chủ trọ tự bấm, không thu tiền, không biên lai, không hoàn tiền và không đổi gói giữa kỳ (mua gói mới luôn nối vào cuối). Admin chưa xem được đơn của mọi người. Đơn chờ không tự hết hạn. Tin không tự hết hạn: phòng đã cho thuê mà chủ trọ quên ẩn thì tin vẫn nằm đó.
- **Phép nối kỳ gói ở đọc công khai chưa đo riêng** ở hàng chục nghìn tin; nó cộng thêm vào chi phí đã nói ở trên. Chấp nhận ở bản demo.
- **`isPublic` và `GET /me/membership` chỉ nhìn tin và hạn mức**, không nhìn tài khoản đã bị khóa hay nhà trọ đã xóa: `isPublic` là `true` nghĩa là tin nằm trong hạn mức, còn khóa tài khoản chặn tin ở API công khai theo luật ở mục 8. Chủ trọ vừa bị khóa chỉ còn gọi được trong tối đa 15 phút (token còn hạn). Đừng tự tính hạn dùng thử hay hạn mức ở FE, luôn lấy từ `GET /me/membership`.
- **Chủ trọ đăng ký trước 2026-10-16** nhận hạn dùng thử bằng thời điểm chạy migration cộng 30 ngày (không phải thời điểm họ đăng ký).
- **Chưa có kháng nghị** khi bị ẩn tin: chủ trọ sửa tin xong vẫn phải liên hệ admin ngoài hệ thống.
- **Lịch sử kiểm duyệt chưa có API đọc.** Mỗi lần ẩn hoặc gỡ ẩn tin ghi một dòng vào bảng `moderation_logs`, nhưng ra ngoài chỉ có `moderationReason` (lý do ẩn gần nhất) trong API tin. Lý do gỡ ẩn và các lần ẩn cũ chỉ xem được trong cơ sở dữ liệu.
- **Đổi tên phường dựng lại từ khóa từng tin một** trong một giao dịch, nên phường có hàng chục nghìn tin sẽ đổi tên chậm. Một tin đang được đăng đúng lúc phường đổi tên có thể mang tên phường cũ trong từ khóa tìm kiếm cho tới lần sửa tin kế tiếp (hiển thị `fullAddress` vẫn đúng vì ghép lúc đọc). Chấp nhận ở bản demo.
- **Danh mục không có tìm kiếm hay phân trang** (`GET /wards` trả cả 168 đơn vị một lần, và admin quản lý trên cùng danh sách đó).
- **Ảnh tin không được xử lý**: không nén, không đổi kích thước, giữ nguyên dữ liệu EXIF (có thể chứa vị trí GPS và kiểu máy ảnh), không có API đổi thứ tự ảnh. Nếu backend dừng đúng giữa lúc ghi tệp và ghi cơ sở dữ liệu thì có thể còn tệp ảnh mồ côi trên ổ đĩa, và xóa mềm tin cũng giữ ảnh nên ổ đĩa chỉ tăng. Chấp nhận ở bản demo.
- **Chủ trọ không xem được ảnh của tin đang ẩn của chính mình** qua `/media/public` (đường đó chỉ phục vụ tin đang hiện công khai và thẻ ảnh không gửi token); hiện lại tin là thấy. Ảnh của tin vừa bị ẩn còn nằm trong bộ nhớ đệm trình duyệt tối đa một ngày.
- **Tìm kiếm** chỉ khớp theo từng từ (không sửa lỗi chính tả, không tìm gần đúng). Từ ngắn dưới 3 ký tự vẫn tìm được nhưng chậm hơn khi có hàng chục nghìn tin.
- **Số tổng `total` của danh sách** là một phép đếm riêng nên chậm dần khi có hàng chục nghìn tin. Đo thật trên 60 nghìn tin giả lập: phép đếm và các trang sâu mất từ vài trăm mili giây đến vài giây tùy cách tin phân bố giữa các chủ trọ, trong khi dưới vài nghìn tin thì không thấy. Chấp nhận ở bản demo; không phải bản chạy thật.
- Ghi phí hoặc tiện ích khi sửa nhà trọ là **thay cả danh sách** (không có API thêm hay bỏ từng khoản), nên hai thiết bị cùng sửa một nhà trọ thì bản gửi sau thắng.

---

## 10. Chưa có (đã lên kế hoạch)

Backend sẽ làm theo thứ tự dưới đây. Mỗi mục khi xong sẽ vào mục 6 và nhật ký thay đổi.

| Thứ tự | Tính năng | Ảnh hưởng tới FE |
|---|---|---|
| 9 | **Dùng thử miễn phí và hạn mức tin** cho chủ trọ: dùng thử 30 ngày, tối đa 2 tin đang hiện (admin đổi được hai con số này). Hết kỳ dùng thử mà chưa mua gói thì tin của chủ trọ tự biến khỏi danh sách công khai. **Đã có**: API admin xem và đổi hai tham số (mục 6.24); hạn dùng thử đặt lúc đăng ký (6.1); chặn đăng và hiện lại tin khi hết dùng thử hoặc đủ hạn mức (6.18, 6.23, mã lỗi `MEMBERSHIP_REQUIRED` và `LISTING_QUOTA_REACHED`); tin biến khỏi danh sách và chi tiết công khai khi hết kỳ hoặc vượt hạn mức, ẩn bớt theo thứ tự đăng (6.19, 6.20); `GET /me/membership` và cờ `isPublic` (6.25, 6.18). **Còn lại**: đo tốc độ ở hàng chục nghìn tin | Lỗi chặn đăng hoặc hiện thêm tin kèm gợi ý mua gói; hiện ngày hết hạn dùng thử và số tin còn lại |
| 10 | **Mua gói và gia hạn theo tháng**, **thanh toán thử** (bấm xác nhận là có gói, không có tiền thật, không chuyển sang cổng thanh toán nào, nên **không có trang VNPay**). **Đã có**: bảng giá công khai và API admin tạo, sửa, tắt, xóa gói (mục 6.26); tạo, xem, hủy đơn, thanh toán thử và kỳ gói nối tiếp (mục 6.27). Gói đổi hạn mức tin và hiển thị công khai, `state = plan` và `subscription` trong `GET /me/membership` (mục 6.25). **Còn lại**: không còn gì ở backend cho mục này | Trang chọn gói, nút thanh toán thử, lịch sử đơn, dải trạng thái gói đang chạy (đều dựng được) |
| 11 | **Theo dõi chủ trọ** và hiển thị số người theo dõi, tổng lượt xem tin | Nút theo dõi, số liệu trên hồ sơ chủ trọ |
| 12 | **Lưu phòng yêu thích** cho người tìm trọ | Nút lưu trên tin, trang danh sách tin đã lưu |
| sau | API **danh sách người dùng** cho admin, API hồ sơ cá nhân | Màn hình quản lý người dùng, trang hồ sơ |

**Đã bỏ khỏi kế hoạch (2026-10-11), FE đừng làm màn hình cho các phần này:** duyệt tin trước khi hiển thị, thanh toán qua VNPay, xác thực chủ trọ bằng giấy tờ, báo cáo tin xấu, liên hệ chủ trọ có giới hạn mỗi ngày, đẩy tin và tin nổi bật, kiểm tra tại chỗ, quảng cáo, báo cáo thu chi và dashboard, thống kê cho chủ trọ, tìm quanh địa điểm mốc, đổi loại tài khoản.

**Về danh sách quyền ở mục 5:** từ 2026-10-12 danh mục quyền chỉ còn 12 module của MVP, khớp với các tính năng ở bảng trên. Các module thuộc phần đã bỏ đã được gỡ khỏi backend (xem nhật ký 2026-10-12).

---

## 11. Nhật ký thay đổi

Mới nhất ở trên cùng. Mục nào **phá vỡ** cách FE đang gọi sẽ ghi rõ "ĐỔI KHÁC VỚI TRƯỚC".

### 2026-10-20 · Admin kiểm duyệt tin và quản lý danh mục (mốc 5 của nhà trọ và tin; phần nhà trọ và tin xong)

- **API mới** (mục 6.29): `GET /moderation/listings` (danh sách kiểm duyệt có lọc `status`, `landlordId`, `q` và phân trang), `POST /moderation/listings/:id/hide` và `POST /moderation/listings/:id/unhide` (bắt buộc `reason` 1 đến 500 ký tự; ẩn và gỡ ẩn cần đăng nhập còn mới). Gỡ ẩn đưa tin về `hidden_by_owner`, chủ trọ tự hiện lại.
- **API mới** (mục 6.30): `POST /wards`, `PATCH /wards/:code`, `DELETE /wards/:code`, `POST /amenities`, `PATCH /amenities/:key`, `DELETE /amenities/:key` (quyền `catalog:*`, chỉ admin). Đây là thêm method mới trên hai đường dẫn đã có; `GET /wards` và `GET /amenities` công khai **giữ nguyên**. Chỉ thêm, không đổi API đang chạy: không phá FE cũ.
- **Hai mã lỗi bắt đầu được trả**: `CATALOG_CODE_TAKEN` (409) và `CATALOG_IN_USE` (409), đã thêm vào bảng mã lỗi (mục 3). `LISTING_STATE_INVALID` và `LISTING_NOT_FOUND` giờ còn gặp ở API kiểm duyệt của admin.
- Đổi tên phường làm mới tìm kiếm theo tên mới ngay; `fullAddress` đổi theo tên phường ngay.
- `moderationReason` ở API tin của chủ trọ (6.18, 6.21) **đã có từ trước**, giờ có dữ liệu thật khi admin ẩn tin. Hình dạng phản hồi nào đang chạy cũng **không đổi**.
- **Giới hạn tần suất**: API của admin (kiểm duyệt, danh mục) không có giới hạn thêm (mục 3).
- **FE cần làm** (tùy chọn): màn hình kiểm duyệt tin và màn hình quản lý danh mục cho admin (mục 7, Màn hình admin).
- Mục 10 đã bỏ dòng "phần còn lại của nhà trọ và tin" vì đã xong.

### 2026-10-19 · Ảnh của tin: tải lên, xóa và xem ảnh (mốc 4 của nhà trọ và tin)

- **API mới** (mục 6.28): `POST /listings/:id/images` (gửi `multipart/form-data`, một tệp `file`), `DELETE /listings/:id/images/:imageId` và `GET /api/v1/media/public/<uuid>.<đuôi>` (công khai, không cần token). Chỉ thêm, không đổi API đang chạy: không phá FE cũ.
- `coverImageUrl` ở danh sách và `images[]` ở chi tiết, ở tin của chủ trọ **giờ có dữ liệu thật** (trước đó luôn là `null` và `[]`). Hình dạng phản hồi **không đổi**.
- Tối đa 5 ảnh mỗi tin; chỉ nhận JPEG, PNG, WebP kiểm bằng nội dung tệp; dung lượng tối đa mỗi ảnh mặc định 5 MiB. Ảnh chỉ phục vụ khi tin của nó đang hiện công khai; ảnh của tin ẩn, bị xóa hay hết hạn mức trả 404.
- **Ba mã lỗi bắt đầu được trả**: `LISTING_IMAGE_LIMIT` (409) và `IMAGE_INVALID` (400) đã thêm vào bảng mã lỗi (mục 3); `PAYLOAD_TOO_LARGE` (413) giờ còn gặp khi ảnh quá dung lượng.
- **Giới hạn tần suất**: `POST /listings/:id/images` 60 lần mỗi giờ theo người dùng (mục 3). Xóa ảnh và xem ảnh không bị giới hạn.
- Hai biến môi trường mới của backend `UPLOAD_DIR` và `MAX_UPLOAD_BYTES` đều có mặc định; FE không phải làm gì.
- **FE cần làm** (tùy chọn): nút thêm và xóa ảnh trong biểu mẫu tin (mục 7, bước 8), hiện ảnh bìa và thư viện ảnh ở trang tìm trọ (mục 7, bước 4 của Tìm trọ).

### 2026-10-19 · Gói đổi hạn mức tin và hiển thị công khai (mốc 3 của mua gói)

- **ĐỔI KHÁC VỚI TRƯỚC**: chủ trọ có gói đang chạy giờ dùng hạn mức của gói **thay** hạn mức dùng thử. Hệ quả: chủ trọ hết dùng thử mua gói xong **đăng được tin ngay** (hết nhận 403 `MEMBERSHIP_REQUIRED`); tin `visible` của họ **hiện lại ngay** trong `GET /listings` và `GET /listings/:slugCode`; gói hết hạn (đúng lúc `endsAt`) mà dùng thử đã hết thì mọi tin biến ngay, không cần việc nền.
- `GET /me/membership` (mục 6.25): `state` có thêm giá trị `plan`; **thêm trường `subscription`** (`null` khi không có gói đang chạy, ngược lại `orderCode`, `planName`, `startsAt`, `endsAt`, `daysLeft`, `paidUntil`). Hợp đồng từ **bảy lên tám trường**. Chỉ thêm trường, FE cũ đọc theo tên không vỡ; FE kiểm `state` bằng `switch` đầy đủ cần xử lý thêm `plan`.
- **ĐỔI KHÁC VỚI TRƯỚC**: `trialDaysLeft` giờ **chỉ phụ thuộc `trialEndsAt`**, không phụ thuộc `state`. Chủ trọ đang có gói mà dùng thử còn vẫn thấy số ngày dùng thử còn lại. Hết dùng thử vẫn là 0, không có `trialEndsAt` vẫn là `null`.
- `listingLimit`, `remaining`, `overLimitCount` và cờ `isPublic` tính theo hạn mức của gói khi `state = plan`. Gói nhỏ hơn hạn mức dùng thử vẫn thay nó (gói 1 tin trong lúc dùng thử 2 tin thì hạn mức là 1). Gói hết mà dùng thử còn thì `state` về `trial` và `subscription` về `null`.
- Phản hồi của các API khác **không đổi hình dạng**. Không migration, không biến môi trường mới.
- **FE cần làm**: thêm nhánh `plan` vào dải trạng thái (mục 7, bước 0 và mục Bảng giá gói); sau khi thanh toán thử thành công thì gọi lại `GET /me/membership` rồi báo "gói đã có hiệu lực"; bỏ lời dặn "đừng hứa tin hiện lại ngay" của mốc 2 (đã lỗi thời); ở bước xác nhận đơn, nếu đã có gói thì báo "gói mới bắt đầu sau khi gói hiện tại hết".

### 2026-10-19 · Đơn mua gói, thanh toán thử và kỳ gói nối tiếp (mốc 2 của mua gói)

- **API mới** (mục 6.27): `POST /orders`, `GET /orders`, `GET /orders/:id`, `POST /orders/:id/pay`, `POST /orders/:id/cancel`. Chỉ thêm, không đổi API đang chạy: không phá FE cũ.
- Chỉ chủ trọ tạo được đơn (admin và người tìm trọ nhận 403 `PERMISSION_DENIED`). Mỗi chủ trọ tối đa một đơn chờ: tạo đơn mới thì đơn chờ cũ tự thành `cancelled`. Đơn chốt tên, giá, số tin và số ngày của gói lúc tạo.
- **Thanh toán thử** biến đơn thành `paid` và tạo một kỳ gói; các kỳ nối tiếp nhau, không chồng. Bấm hai lần hoặc bấm đồng thời an toàn (200, cùng kết quả, một kỳ).
- **Ba mã lỗi từng chưa có API nào trả nay đã trả được**: `PLAN_INACTIVE`, `ORDER_NOT_FOUND`, `ORDER_STATE_INVALID`; `PLAN_NOT_FOUND` giờ còn gặp khi đặt đơn và `PLAN_IN_USE` gặp được khi gói đã có đơn (mục 3).
- **Giới hạn tần suất**: nhóm `orderWrite` đã áp thật, 30 lần mỗi giờ cho mỗi API trong ba API ghi đơn (mục 3).
- **Chưa có**: gói **chưa đổi hạn mức tin**. `GET /me/membership` chưa có `state = plan` hay `subscription`; chủ trọ đã hết dùng thử mua gói xong vẫn nhận 403 `MEMBERSHIP_REQUIRED` khi đăng tin. Phần này thuộc mốc 3.
- Không có migration hay biến môi trường mới (ba bảng đã có từ mốc 1). Cần `npm run migration:deploy` và `npm run seed` nếu chưa chạy.
- **FE cần làm** (tùy chọn): nút "Mua" ở bảng giá, bước xác nhận đơn kèm thanh toán thử, trang lịch sử đơn (mục 7).

### 2026-10-19 · Bảng giá gói và quản lý gói (mốc 1 của mua gói)

- **API mới** (mục 6.26): `GET /plans` công khai (bảng giá: chỉ gói đang bán, giá tăng dần, phân trang, năm trường mỗi gói) và API admin `GET /plans/all`, `POST /plans`, `PATCH /plans/:id`, `DELETE /plans/:id` (quyền `plan:*`; ba lệnh ghi đọc lại quyền từ cơ sở dữ liệu). Chỉ thêm, không đổi API đang chạy: không phá FE cũ.
- `npm run seed` thêm ba gói mẫu còn thiếu: Cơ bản 5 tin 99.000 đ, Nâng cao 15 tin 199.000 đ, Chuyên nghiệp 50 tin 399.000 đ, mỗi gói 30 ngày. Chạy lại không ghi đè gói admin đã sửa; gói mẫu admin đã xóa sẽ quay lại ở lần seed sau.
- **Sáu mã lỗi mới** vào bảng mã lỗi (mục 3): `PLAN_NOT_FOUND`, `PLAN_NAME_TAKEN`, `PLAN_IN_USE` dùng được ngay; `PLAN_INACTIVE`, `ORDER_NOT_FOUND`, `ORDER_STATE_INVALID` chưa API nào trả (dành cho đơn, mốc sau).
- **Giới hạn tần suất**: `GET /plans` 300 lần mỗi phút theo IP (mục 3). Nhóm `orderWrite` (30 lần mỗi giờ cho tạo, thanh toán, hủy đơn) có trong code từ mốc này và được áp thật ở mốc 2.
- **Chưa có**: tạo đơn, thanh toán thử, kỳ gói. Gói **chưa đổi hạn mức tin**; `GET /me/membership` chưa có `state = plan` hay `subscription`. Chủ trọ hết dùng thử vẫn chưa có cách đăng tiếp.
- Cần chạy `npm run migration:deploy` (migration tạo ba bảng `plans`, `orders`, `subscriptions` và phần mở rộng `btree_gist`) rồi `npm run seed`.
- **FE cần làm** (tùy chọn): trang bảng giá (nút "Mua" chưa làm việc được) và màn hình admin quản lý gói (mục 7).

### 2026-10-19 · Xem trạng thái dùng thử và cờ `isPublic` (mốc 4 của dùng thử)

- **API mới `GET /me/membership`** (quyền `subscription:read`, mục 6.25): trả `state` (`trial` hoặc `expired`), `trialEndsAt`, `trialDaysLeft`, `listingLimit`, `visibleCount`, `remaining`, `overLimitCount`. Thay cho dòng "Chưa có" của hai mốc trước. Người tìm trọ nhận 403 `PERMISSION_DENIED`, người chưa đăng nhập 401.
- **Thêm trường `isPublic`** (boolean) vào mọi phản hồi **tin của chủ trọ**: kết quả `POST` đăng tin, `PATCH`, `hide`, `show`, `GET /me/listings` (từng dòng) và `GET /me/listings/:id`. `true` khi `status` là `visible` và tin nằm trong hạn mức hiện hành; `false` với tin ẩn, tin bị ẩn bớt vì vượt hạn mức, và mọi tin khi hết dùng thử. **Chỉ thêm trường, không đổi gì đang có**: không phá FE cũ. API công khai (`GET /listings`, `GET /listings/:slugCode`) không có trường này.
- Sửa mô tả sai ở mục 6.24 và 9: hạ `trial_listing_limit` **có** ẩn bớt tin khỏi công khai ngay (từ mốc 3), mô tả cũ nói "chưa ẩn" đã lỗi thời.
- **FE cần làm**: thêm dải trạng thái dùng thử ở trang quản lý tin (mục 7, bước 0); hiện nhãn cho tin `visible` có `isPublic` là `false`; gọi lại `GET /me/membership` sau mỗi lần đăng, ẩn, hiện, xóa tin. Chưa cần trang mua gói.

### 2026-10-19 · Tin biến khỏi công khai khi hết dùng thử hoặc vượt hạn mức (mốc 3 của dùng thử)

- **ĐỔI KHÁC VỚI TRƯỚC**: `GET /listings` và `GET /listings/:slugCode` giờ chỉ trả tin của chủ trọ **còn trong kỳ dùng thử** và nằm trong **hạn mức** của họ. Mục này thay cho dòng "Chưa có (mốc sau)" của mốc 2 bên dưới: tin của chủ trọ hết dùng thử **không còn hiện** công khai.
- Hết kỳ dùng thử (so chặt: đúng lúc `trial_ends_at` là hết) mà chưa có gói thì mọi tin của chủ trọ biến khỏi danh sách và chi tiết công khai (chi tiết 404 `LISTING_NOT_FOUND`) ngay, không cần việc nền. Chủ trọ vẫn xem, sửa, ẩn, xóa tin của mình ở `/me/listings`.
- Admin hạ `trial_listing_limit` thấp hơn số tin đang hiện của một chủ trọ thì chỉ các tin **đăng sớm nhất** (theo `createdAt`, rồi `id`) còn hiện công khai. Tin còn lại bị ẩn bớt khỏi danh sách và chi tiết, nhưng `status` vẫn là `visible` và vẫn tính vào số tin đang hiện. Chủ trọ ẩn hoặc xóa một tin thì tin đăng sớm nhất kế tiếp trong số bị ẩn bớt hiện lại. Nâng hạn mức thì hiện lại ngay.
- Hình dạng phản hồi **không đổi**; `total` và phân trang của `GET /listings` đã tính theo luật mới, nên số trang có thể ít đi so với trước. Chủ trọ hết dùng thử gọi chi tiết tin của chính mình ở route công khai cũng 404 (dùng `/me/listings/:id`).
- Admin không có kỳ dùng thử nên tin do admin sở hữu (nếu có) không hiện công khai.
- **Chưa có** (mốc sau): `GET /me/membership` và cờ `isPublic` để chủ trọ biết tin nào đang bị ẩn bớt.
- **FE cần làm**: trang tìm trọ không cần đổi gì. Trang chi tiết đã xử lý 404 thì nay gặp thêm các tin vừa biến mất vì hết dùng thử hoặc hạn mức (báo "tin không còn hiển thị"). Trang quản lý tin của chủ trọ chưa phân biệt được tin bị ẩn bớt, chờ cờ `isPublic`.

### 2026-10-19 · Dùng thử và chặn đăng tin theo hạn mức (mốc 2 của dùng thử)

- **Đăng ký chủ trọ chạy lại bình thường** (lỗi 500 tạm thời của mốc 1 đã hết). Chủ trọ đăng ký xong có kỳ dùng thử tính từ lúc đăng ký, mặc định 30 ngày (admin đổi `trial_days`). Phản hồi đăng ký **không đổi** (`user` vẫn 6 trường, không có hạn dùng thử). Đăng ký người tìm trọ không đổi.
- **ĐỔI KHÁC VỚI TRƯỚC**: hai API `POST /properties/:propertyId/listings` (đăng tin) và `POST /listings/:id/show` (hiện lại tin) giờ có thể trả **hai mã lỗi mới**, đều **403**: `MEMBERSHIP_REQUIRED` (hết dùng thử, chưa có gói) và `LISTING_QUOTA_REACHED` (còn dùng thử nhưng số tin đang hiện đã bằng hoặc vượt hạn mức, mặc định 2). Đã thêm vào bảng mã lỗi ở mục 3. Chỉ tin `visible` chưa xóa tính vào "đang hiện".
- Thứ tự báo lỗi của đăng tin: 404 `PROPERTY_NOT_FOUND` và 403 `NOT_RESOURCE_OWNER` trước, rồi `MEMBERSHIP_REQUIRED`, rồi `LISTING_QUOTA_REACHED`. Của hiện lại tin: 404 hoặc 403 sở hữu, rồi `LISTING_HIDDEN_BY_ADMIN` hoặc `LISTING_STATE_INVALID`, rồi `MEMBERSHIP_REQUIRED`, rồi `LISTING_QUOTA_REACHED`.
- **Không bị chặn** dù hết dùng thử: ẩn, sửa, xóa tin; tạo, sửa, xóa nhà trọ. Ẩn hoặc xóa một tin trả lại một chỗ ngay. Đổi `trial_listing_limit` có hiệu lực ngay ở lần đăng hoặc hiện kế tiếp.
- Hai yêu cầu đăng hoặc hiện cùng lúc của cùng một chủ trọ khi chỉ còn một chỗ: đúng một yêu cầu thành công, yêu cầu kia nhận `LISTING_QUOTA_REACHED`.
- Tài khoản admin không có kỳ dùng thử nên đăng tin bị `MEMBERSHIP_REQUIRED`.
- **Chưa có** (mốc sau): tin của chủ trọ hết dùng thử hoặc vượt hạn mức biến khỏi danh sách và chi tiết công khai; `GET /me/membership`; cờ `isPublic`. Nên **hiện tại tin vẫn hiện công khai dù chủ trọ đã hết dùng thử**.
- **FE cần làm**: xử lý hai mã lỗi mới ở nút đăng tin và nút "Hiện" (mục 7, bước 6): hiện `message`, giữ nguyên biểu mẫu, gợi ý ẩn hoặc xóa bớt tin hoặc mua gói. Chưa cần làm trang trạng thái dùng thử.

### 2026-10-16 · Tham số hệ thống: admin đổi số ngày và số tin dùng thử (mốc 1 của dùng thử)

- Thêm 2 API cho admin: `GET /settings` và `PATCH /settings/:key`. Xem mục 6.24. Quyền `setting:read` và `setting:update` (chỉ admin giữ). Hai khóa: `trial_days` (mặc định 30, từ 0 đến 365) và `trial_listing_limit` (mặc định 2, từ 0 đến 100).
- **Mới lưu và đọc ra, chưa áp vào đâu**: đăng ký chủ trọ chưa có hạn dùng thử và đăng tin chưa bị chặn theo hạn mức. Hai việc đó thuộc mốc 2 và 3 của tính năng; FE đừng dựng giao diện hạn mức vội.
- **Tạm thời, ảnh hưởng tới FE** (đã hết từ 2026-10-19, xem mục nhật ký đó): migration của mốc này thêm ràng buộc "chủ trọ phải có hạn dùng thử", nhưng đăng ký chưa đặt hạn đó. Vì vậy trên cơ sở dữ liệu đã chạy migration, `POST /auth/register` với `accountType: "landlord"` **trả 500 `INTERNAL_ERROR`** cho đến khi xong mốc 2. Đăng ký `tenant` và mọi API khác không đổi.
- Không thêm mã lỗi mới (lỗi dùng `VALIDATION_FAILED`, `NOT_FOUND`, `PERMISSION_DENIED` đã có).
- **FE cần làm**: (tùy chọn) trang tham số cho admin theo luồng ở mục 7; chưa cần làm gì khác.

### 2026-10-16 · Tin đăng: đăng, xem công khai, ẩn và hiện

- Thêm 9 API: `POST /properties/:propertyId/listings` (201), `GET /listings` (công khai, có lọc và phân trang), `GET /listings/:slugCode` (công khai, đọc đăng nhập tùy chọn), `GET /me/listings`, `GET /me/listings/:id`, `PATCH /listings/:id`, `DELETE /listings/:id` (204, xóa mềm), `POST /listings/:id/hide`, `POST /listings/:id/show`. Xem mục 6.18 đến 6.23. Quyền `listing:create`, `listing:read`, `listing:update`, `listing:delete` (landlord đã có sẵn); người tìm trọ nhận 403 `PERMISSION_DENIED` ở các API của chủ trọ.
- **Tin hiện ngay khi đăng**, không nháp, không duyệt. Đường dẫn công khai của tin là `<slug>-<code>`, chỉ phần `code` (8 ký tự) dùng để tra.
- **Số điện thoại chủ trọ chỉ có ở chi tiết tin và chỉ khi gửi access token hợp lệ**; danh sách không bao giờ có. Token sai hoặc hết hạn ở trang chi tiết không bị 401, chỉ mất số điện thoại.
- Mỗi người xem được cộng một lượt xem cho mỗi tin trong 30 phút; chủ tin không tính.
- Ba mã lỗi bắt đầu được trả: `LISTING_NOT_FOUND`, `LISTING_STATE_INVALID`, `LISTING_HIDDEN_BY_ADMIN` (đã thêm vào bảng ở mục 3). Còn lại của đợt 2026-10-14 (`CATALOG_*`, `LISTING_IMAGE_LIMIT`, `IMAGE_INVALID`) vẫn chưa có API trả, FE đừng xử lý trước.
- **Giới hạn tần suất mới** (mục 3): năm API ghi tin mỗi API 60 lần mỗi giờ theo người dùng; `GET /listings` 300 lần mỗi phút theo IP; `GET /listings/:slugCode` 300 lần mỗi phút theo IP và 60 lần mỗi phút cho người đăng nhập.
- `listingCount` ở `GET /properties` giờ có số thật; xóa nhà trọ còn tin trả 409 `PROPERTY_HAS_LISTINGS` (đã chạy từ trước, giờ gặp được qua API).
- Không đổi API nào đang chạy.
- **FE cần làm**: trang quản lý tin và biểu mẫu đăng, sửa tin cho chủ trọ; trang danh sách có bộ lọc và trang chi tiết cho khách (nhớ gửi access token ở trang chi tiết khi đã đăng nhập); xử lý nhãn trạng thái và `moderationReason`; xử lý 429 ở các biểu mẫu ghi.

### 2026-10-16 · Nhà trọ của chủ trọ

- Thêm 5 API cho chủ trọ: `POST /properties` (201), `GET /properties` (có phân trang), `GET /properties/:id`, `PATCH /properties/:id`, `DELETE /properties/:id` (204, xóa mềm). Xem mục 6.17. Quyền `property:create`, `property:read`, `property:update`, `property:delete` (landlord đã có sẵn từ trước). Người tìm trọ nhận 403 `PERMISSION_DENIED`.
- **Địa chỉ trả sẵn `fullAddress`** (số nhà và đường, phường hoặc xã, tỉnh hoặc thành phố; không có quận huyện). FE hiển thị thẳng, không tự ghép.
- Thêm **quy ước phân trang** chung (mục 2): `page`, `pageSize` (tối đa 50), trả `{ items, total, page, pageSize }`. Mới `GET /properties` dùng.
- Bốn mã lỗi bắt đầu được trả: `WARD_UNKNOWN`, `AMENITY_UNKNOWN`, `PROPERTY_NOT_FOUND`, `PROPERTY_HAS_LISTINGS` (đã thêm vào bảng ở mục 3). `NOT_RESOURCE_OWNER` lần đầu có API dùng đến. Bảy mã còn lại của đợt 2026-10-14 (`CATALOG_*`, `LISTING_*`, `IMAGE_INVALID`) vẫn chưa có API trả, FE đừng xử lý trước.
- **Giới hạn tần suất mới**: ba API ghi nhà trọ (`POST`, `PATCH`, `DELETE`) mỗi API bị giới hạn 30 lần mỗi giờ cho mỗi người dùng (đếm riêng từng API), vượt thì 429 `RATE_LIMITED` (mục 3, phần "Lỗi 429"). Các API đọc không bị giới hạn.
- Không đổi API nào đang chạy.
- **FE cần làm**: trang danh sách và biểu mẫu tạo, sửa nhà trọ cho chủ trọ (luồng gợi ý ở mục 7); xử lý 429 ở các biểu mẫu ghi; hiển thị `fullAddress` thẳng.

### 2026-10-14 · Danh sách phường, xã, đặc khu và tiện ích (địa chỉ mới sau sáp nhập)

- Thêm `GET /wards` và `GET /amenities`, **công khai**. Xem mục 6.15 và 6.16.
- **Địa chỉ theo đơn vị hành chính hai cấp sau sáp nhập**: phường, xã, đặc khu của Thành phố Hồ Chí Minh (168 đơn vị, mã 5 chữ số), **không có quận huyện**. `name` đã kèm loại đơn vị.
- Không đổi API nào đang chạy. Thêm 11 mã lỗi vào bảng mã lỗi của backend (`WARD_UNKNOWN`, `AMENITY_UNKNOWN`, `CATALOG_CODE_TAKEN`, `CATALOG_IN_USE`, `PROPERTY_NOT_FOUND`, `PROPERTY_HAS_LISTINGS`, `LISTING_NOT_FOUND`, `LISTING_STATE_INVALID`, `LISTING_HIDDEN_BY_ADMIN`, `LISTING_IMAGE_LIMIT`, `IMAGE_INVALID`); chưa API nào trả chúng, FE đừng xử lý trước, sẽ được ghi ở mục 3 khi API tương ứng ra mắt.
- **FE cần làm**: ô chọn phường hoặc xã lấy từ `GET /wards`; **không làm ô quận huyện**.

### 2026-10-12 · Giới hạn tần suất, lỗi 429 (ĐỔI KHÁC VỚI TRƯỚC)

- **Không thêm endpoint**, nhưng **sáu API có thể trả lỗi mới 429 `RATE_LIMITED`** kèm header `Retry-After` (giây): `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`. Bảng giới hạn và cách xử lý nằm ở mục 3, phần "Lỗi 429".
- Thêm mã lỗi `RATE_LIMITED` (429). Mỗi lần đăng nhập sai cũng được đếm; email so không phân biệt hoa thường.
- **ĐỔI KHÁC VỚI TRƯỚC**: `POST /auth/change-password` giờ bị giới hạn 10 lần mỗi 15 phút cho một người dùng (kể cả lần sai mật khẩu hiện tại). Giới hạn này nằm ngoài thiết kế ban đầu, thêm để chặn dò mật khẩu bằng token bị đánh cắp.
- **FE cần làm**: xử lý 429 ở các biểu mẫu đăng ký, đăng nhập, quên mật khẩu, đặt lại và đổi mật khẩu (hiện "thử lại sau N giây", khóa nút); không tự thử lại; chỉ gọi `refresh` khi gặp `TOKEN_EXPIRED` và gom nhiều request thành một lần refresh.

### 2026-10-12 · Dọn danh mục quyền theo MVP (ĐỔI KHÁC VỚI TRƯỚC)

- **Không thêm hay bỏ endpoint nào**, nhưng nội dung ba API đọc quyền **đã đổi**:
  - `GET /permissions` từ 23 module còn **12 module** (`profile`, `user`, `account_type`, `catalog`, `setting`, `property`, `listing`, `favorite`, `follow`, `plan`, `order`, `subscription`). Module `product` đổi tên thành `plan`. Module `order` chỉ còn hành động `create`, `read`, `cancel`.
  - `GET /account-types`: quyền mặc định của `landlord` từ 18 còn **14**, của `tenant` từ 9 còn **7**. Quyền của `admin` (toàn bộ) cũng ngắn lại theo danh mục.
  - `GET /auth/me`: `permissions` của người dùng ngắn lại theo, token cấp mới sau thay đổi này không còn khóa cũ.
- **Khóa đã bỏ**: `contact:reveal`, `report:*`, `verification:*`, `boost:*`, `product:*`, `inspection:*`, `ad:*`, `expense:*`, `finance:*`, `dashboard:*`, `stats:*`, `order:refund`, `order:gift`. Gửi chúng lên `PATCH /account-types/:key` nhận **400 `PERMISSION_UNKNOWN`** (trước đây một số khóa nhận `PERMISSION_ADMIN_ONLY`).
- **FE cần làm**: nếu màn hình chọn quyền hay phân nhóm quyền đang cứng các module trên thì gỡ ra, nên vẽ theo `GET /permissions`. Token cấp trước thay đổi có thể còn mang khóa cũ đến lần refresh kế tiếp, vô hại vì không route nào dùng chúng.

### 2026-10-11 · Đổi kế hoạch: bỏ duyệt tin, bỏ VNPay, thu gọn phạm vi MVP

- **Chỉ đổi kế hoạch, chưa đổi API nào đang chạy.** Không có endpoint, mã lỗi hay trường nào thay đổi.
- Tin đăng sẽ **hiện ngay khi đăng**; không có hàng chờ duyệt. Admin ẩn tin vi phạm sau khi đăng.
- Mua gói là **thanh toán thử**, không chuyển sang VNPay.
- Thêm hàng 12 (lưu phòng yêu thích) vào kế hoạch; xem danh sách phần đã bỏ ở mục 10.

### 2026-10-08 · Quên mật khẩu, đặt lại mật khẩu, đổi mật khẩu

- Thêm `POST /auth/forgot-password` (202), `POST /auth/reset-password` (204), `POST /auth/change-password` (204). Xem 6.7 đến 6.9.
- Thêm mã lỗi `RESET_TOKEN_INVALID` (400) và `CURRENT_PASSWORD_WRONG` (400).
- **FE cần làm**: trang `/reset-password` đọc `token` từ query (đường dẫn cố định), trang xin liên kết, và biểu mẫu đổi mật khẩu.
- Thêm file này và bộ Postman `postman-collection.json`.

### 2026-10-08 · Loại tài khoản, phân quyền, khóa tài khoản (ĐỔI KHÁC VỚI TRƯỚC)

- **ĐỔI KHÁC VỚI TRƯỚC**: `POST /auth/register` bắt buộc có `accountType` (`landlord` hoặc `tenant`), landlord bắt buộc có `phone`. Không còn nhận `roles`.
- **ĐỔI KHÁC VỚI TRƯỚC**: login và refresh chỉ trả `{ accessToken, expiresIn }`, không còn trả `user`. Gọi `GET /auth/me` để lấy người dùng và quyền. Register vẫn trả `user`.
- **ĐỔI KHÁC VỚI TRƯỚC**: access token mang `type` và `perms` thay cho `roles`. FE không nên giải mã token; dùng `/auth/me`.
- **ĐỔI KHÁC VỚI TRƯỚC**: đã bỏ `GET /users/me` và `GET /users`. Dùng `GET /auth/me`.
- **ĐỔI KHÁC VỚI TRƯỚC**: mọi `message` lỗi, thông báo kiểm tra dữ liệu giờ là tiếng Việt (`code` vẫn là tiếng Anh).
- Thêm `GET /auth/me`, `GET /permissions`, `GET /account-types`, `PATCH /account-types/:key`, `POST /users/:id/lock`, `POST /users/:id/unlock`, `POST /users/:id/revoke-sessions`.
- Thêm mã lỗi `PHONE_TAKEN`, `PERMISSION_UNKNOWN`, `PERMISSION_ADMIN_ONLY`, `SYSTEM_TYPE_PROTECTED`, `ACCOUNT_TYPE_NOT_FOUND`, `USER_NOT_FOUND`, `CANNOT_LOCK_SELF`, `ACCOUNT_ALREADY_LOCKED`, `ACCOUNT_NOT_LOCKED`.

### Trước 2026-10-08 · Nền

- Đăng ký, đăng nhập, access token 15 phút và refresh token xoay vòng trong cookie `rt`, đăng xuất, đăng xuất mọi thiết bị.
- Dạng lỗi chung `{ status, code, message, errors?, requestId }`.

---

## 12. Cách giữ file này luôn đúng

Mỗi lần backend thêm, đổi hoặc bỏ một API, mã lỗi, quy tắc nghiệp vụ hay biến cấu hình mà FE thấy được, **trong cùng lần làm đó** phải:

1. Sửa đúng mục trong mục 6 (hoặc thêm mục mới), bảng mã lỗi mục 3, mục 5 nếu đụng quyền, mục 8 nếu đổi quy tắc.
2. Thêm một dòng vào **Nhật ký thay đổi** (mục 11) với ngày; ghi "ĐỔI KHÁC VỚI TRƯỚC" nếu FE đang chạy sẽ hỏng.
3. Cập nhật dòng "Cập nhật lần cuối" ở đầu file và bảng trạng thái ở mục 1; chuyển tính năng từ mục 10 sang mục 6 khi làm xong.
4. Cập nhật [`postman-collection.json`](postman-collection.json): thêm request mới vào đúng folder, kèm kiểm tra tự động và mô tả; sửa request đã đổi.
