# Tài liệu API và nghiệp vụ cho Frontend

Cập nhật lần cuối: 2026-10-08 (xem mục [Nhật ký thay đổi](#11-nhật-ký-thay-đổi) để biết thay đổi gần nhất).

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

Nền tảng quản lý và cho thuê nhà trọ. Hiện backend đã có phần **tài khoản và phân quyền**; phần nhà trọ, tin đăng, gói thành viên sẽ làm tiếp (mục 10).

### Ba loại tài khoản

| Loại (`accountType`) | Là ai | Cách có tài khoản |
|---|---|---|
| `landlord` | Người đăng bài (chủ trọ) | Tự đăng ký, **bắt buộc có số điện thoại** |
| `tenant` | Người tìm trọ (người thuê) | Tự đăng ký |
| `admin` | Quản trị viên | Không tự đăng ký được. Tài khoản đầu tiên do backend tạo bằng lệnh seed |

Mỗi tài khoản chỉ thuộc **một** loại, chọn lúc đăng ký và **không bao giờ đổi**. Muốn làm cả hai vai trò thì phải dùng hai tài khoản.

### Mô hình kinh doanh (để FE hiểu bối cảnh)

Đăng ký miễn phí. Người tìm trọ dùng miễn phí mãi. Người đăng bài được dùng thử khoảng một tháng với khoảng 1 đến 2 tin, muốn tiếp tục phải mua gói theo tháng. Admin là người vận hành và thu tiền. **Phần dùng thử, hạn mức và mua gói chưa có API** (mục 10).

### Trạng thái các tính năng

| Tính năng | Trạng thái |
|---|---|
| Đăng ký, đăng nhập, làm mới phiên, đăng xuất | Có |
| Loại tài khoản và phân quyền, admin chỉnh quyền | Có |
| Khóa, mở khóa tài khoản, thu hồi phiên (admin) | Có |
| Quên mật khẩu, đặt lại và đổi mật khẩu | Có (mới, 2026-10-08) |
| Giới hạn tần suất (lỗi 429) | Chưa có |
| Nhà trọ, đăng tin, xem tin | Chưa có |
| Dùng thử, hạn mức, mua gói | Chưa có |
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
| Kích thước body | Tối đa 100 KB, quá thì 413 `PAYLOAD_TOO_LARGE` |
| Trường lạ | Gửi trường không có trong mô tả bị từ chối 400 `VALIDATION_FAILED` (không âm thầm bỏ qua) |
| Ngôn ngữ | Mọi `message` trả về là tiếng Việt, hiển thị thẳng cho người dùng được. `code` là hằng số tiếng Anh, FE dùng `code` để rẽ nhánh, không so chuỗi `message` |
| Truy vết | Mỗi response có header `X-Request-Id` (trùng `requestId` trong body lỗi). Gửi kèm khi báo lỗi cho backend |
| Phân trang | Chưa có API danh sách nên chưa có quy ước phân trang |

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
| `PAYLOAD_TOO_LARGE` | 413 | Body quá 100 KB | Hiện `message` |
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
| `NOT_RESOURCE_OWNER` | 403 | Thao tác trên dữ liệu của người khác | Hiện `message` (chưa có API dùng đến) |
| `FORBIDDEN` | 403 | Bị từ chối khác | Hiện `message` |
| `NOT_FOUND` | 404 | Route hoặc nội dung không tồn tại | Hiện `message` |
| `EMAIL_TAKEN` | 409 | Email đã có tài khoản (kể cả tài khoản đã xóa) | Báo lỗi ở ô email |
| `PHONE_TAKEN` | 409 | Số điện thoại đã thuộc một tài khoản người đăng bài khác | Báo lỗi ở ô số điện thoại |
| `RESET_TOKEN_INVALID` | 400 | Liên kết đặt lại mật khẩu sai, hết hạn, đã dùng, hoặc đã bị thay bằng liên kết mới hơn | Báo liên kết không dùng được, mời xin liên kết mới |
| `CURRENT_PASSWORD_WRONG` | 400 | Đổi mật khẩu nhưng mật khẩu hiện tại sai | Báo lỗi ở ô mật khẩu hiện tại. **Không** coi là hết phiên |
| `PERMISSION_UNKNOWN` | 400 | Admin gửi khóa quyền không có trong danh mục | Lỗi lập trình, lấy danh mục từ `GET /permissions` |
| `PERMISSION_ADMIN_ONLY` | 400 | Admin cấp quyền chỉ dành cho admin (hoặc khóa `*:manage`) cho landlord hoặc tenant | Không cho chọn các quyền đó |
| `SYSTEM_TYPE_PROTECTED` | 409 | Sửa quyền của loại `admin` | Không cho sửa loại admin |
| `ACCOUNT_TYPE_NOT_FOUND` | 404 | Khóa loại tài khoản không có | Lỗi lập trình |
| `USER_NOT_FOUND` | 404 | Không có người dùng với id này | Hiện `message` |
| `CANNOT_LOCK_SELF` | 409 | Admin tự khóa chính mình | Hiện `message` |
| `ACCOUNT_ALREADY_LOCKED` | 409 | Khóa tài khoản đang bị khóa | Làm mới trạng thái trên giao diện |
| `ACCOUNT_NOT_LOCKED` | 409 | Mở khóa tài khoản không bị khóa | Làm mới trạng thái trên giao diện |
| `DB_UNAVAILABLE` | 503 | Cơ sở dữ liệu tạm không dùng được | Hiện `message`, cho thử lại sau |
| `INTERNAL_ERROR` | 500 | Lỗi hệ thống | Hiện `message`, gửi `requestId` cho backend |
| `HTTP_ERROR` | khác | Lỗi HTTP khác chưa có mã riêng | Hiện `message` |
| `RATE_LIMITED` | 429 | **Chưa có.** Sẽ báo gọi quá nhiều, kèm header `Retry-After` | Xem mục 10 |

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
| `setting` | read, update | | tất cả | chưa |
| `property` | read, create, update, delete | có | | chưa |
| `listing` | read, create, update, delete, moderate | có | `moderate` | chưa |
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

**Lỗi**: 400 `VALIDATION_FAILED` · 409 `EMAIL_TAKEN` · 409 `PHONE_TAKEN` (số đã thuộc một người đăng bài khác, kể cả tài khoản đã xóa).

### 6.2 Đăng nhập

`POST /auth/login` · công khai

| Trường | Kiểu | Bắt buộc |
|---|---|---|
| `email` | chuỗi | có |
| `password` | chuỗi | có |

**200 OK**: đặt cookie `rt`, trả `{ "accessToken": "...", "expiresIn": 900 }`. Không trả thông tin người dùng: gọi `GET /auth/me` sau đó.

**Lỗi**: 401 `INVALID_CREDENTIALS` (sai email và sai mật khẩu cho cùng một câu trả lời) · 403 `ACCOUNT_LOCKED` (chỉ lộ khi mật khẩu đúng) · 400 `VALIDATION_FAILED`.

### 6.3 Làm mới access token

`POST /auth/refresh` · công khai, dùng cookie `rt` (không có body)

**200 OK**: `{ "accessToken": "...", "expiresIn": 900 }` và (thường) cookie `rt` mới. Quyền trong token mới đã được đọc lại từ cơ sở dữ liệu.

**Lỗi**: 401 `REFRESH_TOKEN_MISSING` · 401 `SESSION_REVOKED` · 401 `SESSION_EXPIRED` · 403 `ACCOUNT_LOCKED` (khi bị khóa, mọi phiên của tài khoản bị hủy) · 403 `ORIGIN_NOT_ALLOWED`.

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

Email được gửi ở nền, nên response trả về ngay và không báo lỗi nếu gửi thất bại. **Lỗi**: 400 `VALIDATION_FAILED` (email sai dạng).

### 6.8 Đặt lại mật khẩu

`POST /auth/reset-password` · công khai

| Trường | Kiểu | Bắt buộc | Luật |
|---|---|---|---|
| `token` | chuỗi | có | Giá trị của tham số `token` trong liên kết email |
| `newPassword` | chuỗi | có | 8 đến 128 ký tự |

**204 No Content.** Mật khẩu mới có hiệu lực ngay và **mọi phiên đăng nhập của tài khoản bị hủy** (mọi thiết bị). FE chuyển người dùng về trang đăng nhập; không có phiên nào để giữ.

**Lỗi**: 400 `RESET_TOKEN_INVALID` (liên kết sai, hết hạn, đã dùng, hoặc đã có liên kết mới hơn) · 400 `VALIDATION_FAILED`. Khi gặp `VALIDATION_FAILED` (ví dụ mật khẩu quá ngắn) liên kết **chưa bị dùng**, người dùng nhập lại được.

### 6.9 Đổi mật khẩu

`POST /auth/change-password` · đăng nhập

| Trường | Kiểu | Bắt buộc | Luật |
|---|---|---|---|
| `currentPassword` | chuỗi | có | Mật khẩu đang dùng |
| `newPassword` | chuỗi | có | 8 đến 128 ký tự. Được phép trùng mật khẩu cũ |

**204 No Content.** Các phiên **khác** (thiết bị khác) bị hủy; phiên đang dùng **giữ nguyên**: access token và cookie hiện tại dùng tiếp bình thường, người dùng không bị đá ra.

**Lỗi**: 400 `CURRENT_PASSWORD_WRONG` · 400 `VALIDATION_FAILED` · 401 `TOKEN_*` · 403 `ACCOUNT_LOCKED`.

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

### Màn hình admin

- **Chỉnh quyền loại tài khoản**: lấy `GET /permissions` (danh mục) và `GET /account-types` (quyền hiện tại). Vẽ ma trận hành động theo module cho `landlord` và `tenant`. Tắt (không cho chọn) mọi hành động trong `adminActions`. Khi lưu, gửi **toàn bộ** danh sách đang chọn bằng `PATCH /account-types/:key`. Nên ghi chú: người dùng đang đăng nhập nhận quyền mới trong tối đa 15 phút hoặc khi họ refresh.
- **Khóa, mở khóa**: bắt nhập **lý do** (bắt buộc cả khóa lẫn mở khóa). Khóa xong thì người đó mất phiên ngay. Hiện tại **chưa có API danh sách người dùng** để tìm id; xem mục 10.

### Hiển thị theo quyền

Ẩn hoặc làm mờ nút khi thiếu quyền (dựa vào `permissions` của `/auth/me`), nhưng **backend vẫn là nơi kiểm cuối**: gặp 403 `PERMISSION_DENIED` thì báo không đủ quyền chứ đừng coi là lỗi hệ thống.

---

## 8. Quy tắc nghiệp vụ cần nhớ

- **Email** duy nhất toàn hệ thống, không phân biệt hoa thường; tài khoản đã xóa vẫn giữ email của nó (đăng ký lại bằng email đó vẫn báo `EMAIL_TAKEN`).
- **Số điện thoại** của người đăng bài duy nhất toàn hệ thống (kể cả tài khoản đã xóa) và người đăng bài không tự đổi số sau khi đăng ký. Mục đích: mỗi số chỉ nhận một lần dùng thử miễn phí (sẽ làm sau). Người tìm trọ có thể trùng số.
- **Loại tài khoản không đổi.** Không có API đổi loại.
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
- **Chưa có giới hạn tần suất** nên ai cũng gọi dồn được các API đăng nhập, quên mật khẩu. Sẽ có (mục 10).
- **Chưa có API danh sách người dùng** nên màn hình admin chưa tìm được người để khóa ngoài việc biết sẵn id.

---

## 10. Chưa có (đã lên kế hoạch)

Backend sẽ làm theo thứ tự dưới đây. Mỗi mục khi xong sẽ vào mục 6 và nhật ký thay đổi.

| Thứ tự | Tính năng | Ảnh hưởng tới FE |
|---|---|---|
| 7 | **Giới hạn tần suất** cho đăng nhập, đăng ký, quên mật khẩu, refresh | Sẽ có lỗi 429 `RATE_LIMITED` kèm header `Retry-After` (giây). FE nên chuẩn bị hiện "thử lại sau N giây" |
| 8 | **Nhà trọ, đăng tin, xem tin**: chủ trọ tạo nhà trọ và tin phòng, **tin hiện ngay khi đăng, không có bước duyệt**. Chủ trọ tự ẩn và hiện lại tin của mình; admin ẩn hoặc gỡ ẩn tin của người khác kèm lý do. Người tìm trọ xem danh sách tin có lọc đơn giản (từ khóa, phường, khoảng giá, sắp xếp) và chi tiết tin (mỗi lần mở tính một lượt xem). Ảnh tải lên, tối đa 5 ảnh mỗi tin | Trang quản lý nhà trọ và tin của chủ trọ (có nút ẩn, hiện), trang danh sách có bộ lọc, trang chi tiết tin, nút ẩn tin cho admin. **Không cần hàng chờ duyệt** |
| 9 | **Dùng thử miễn phí và hạn mức tin** cho chủ trọ: dùng thử 30 ngày, tối đa 2 tin đang hiện (admin đổi được hai con số này). Hết kỳ dùng thử mà chưa mua gói thì tin của chủ trọ tự biến khỏi danh sách công khai | Lỗi chặn đăng hoặc hiện thêm tin kèm gợi ý mua gói; hiện ngày hết hạn dùng thử và số tin còn lại |
| 10 | **Mua gói và gia hạn theo tháng**, **thanh toán thử** (bấm xác nhận là có gói, không có tiền thật, không chuyển sang cổng thanh toán nào, nên **không có trang VNPay**) | Trang chọn gói, nút thanh toán thử, lịch sử đơn |
| 11 | **Theo dõi chủ trọ** và hiển thị số người theo dõi, tổng lượt xem tin | Nút theo dõi, số liệu trên hồ sơ chủ trọ |
| 12 | **Lưu phòng yêu thích** cho người tìm trọ | Nút lưu trên tin, trang danh sách tin đã lưu |
| sau | API **danh sách người dùng** cho admin, API hồ sơ cá nhân | Màn hình quản lý người dùng, trang hồ sơ |

**Đã bỏ khỏi kế hoạch (2026-10-11), FE đừng làm màn hình cho các phần này:** duyệt tin trước khi hiển thị, thanh toán qua VNPay, xác thực chủ trọ bằng giấy tờ, báo cáo tin xấu, liên hệ chủ trọ có giới hạn mỗi ngày, đẩy tin và tin nổi bật, kiểm tra tại chỗ, quảng cáo, báo cáo thu chi và dashboard, thống kê cho chủ trọ, tìm quanh địa điểm mốc, đổi loại tài khoản.

**Về danh sách quyền ở mục 5:** từ 2026-10-12 danh mục quyền chỉ còn 12 module của MVP, khớp với các tính năng ở bảng trên. Các module thuộc phần đã bỏ đã được gỡ khỏi backend (xem nhật ký 2026-10-12).

---

## 11. Nhật ký thay đổi

Mới nhất ở trên cùng. Mục nào **phá vỡ** cách FE đang gọi sẽ ghi rõ "ĐỔI KHÁC VỚI TRƯỚC".

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
