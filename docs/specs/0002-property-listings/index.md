# 0002. Nhà trọ, tin đăng và xem tin công khai

**Date**: 2026-10-12
**Status**: In Progress

## Summary

Spec này chốt cách chủ trọ tạo nhà trọ rồi đăng tin phòng, và cách người tìm trọ (kể cả khách chưa đăng nhập) tìm, lọc và xem tin. Tin hiện ngay khi đăng, không nháp, không duyệt; chủ trọ tự ẩn và hiện lại, còn admin ẩn tin vi phạm kèm lý do và quản lý danh mục phường và tiện ích. Địa chỉ theo đơn vị hành chính hai cấp sau sáp nhập (tỉnh hoặc thành phố, rồi phường, xã hoặc đặc khu; không có quận huyện) và API trả sẵn chuỗi `fullAddress` ghép đúng thứ tự đó. Ảnh tải lên ổ đĩa, tối đa 5 ảnh mỗi tin. Số điện thoại chủ trọ chỉ hiện cho người đã đăng nhập, và lượt xem được đếm một lần cho mỗi người xem trong 30 phút. Hạn mức tin, dùng thử và gói thuộc các hàng sau, nên spec chỉ chừa đúng một chỗ để chúng nối vào.

## Requirements

**User stories**:
- Là chủ trọ, tôi muốn tạo nhà trọ một lần rồi đăng nhiều tin phòng thuộc nhà trọ đó, tin hiện ngay, để người tìm trọ thấy tôi liền.
- Là chủ trọ, tôi muốn tự ẩn tin khi hết phòng và hiện lại khi còn phòng, và biết lý do khi admin ẩn tin của tôi.
- Là người tìm trọ (kể cả khi chưa đăng nhập), tôi muốn lọc tin theo từ khóa, phường, khoảng giá và xem chi tiết một tin kèm ảnh, phí, tiện ích.
- Là admin, tôi muốn ẩn hoặc gỡ ẩn tin vi phạm kèm lý do và quản lý danh mục phường và tiện ích.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1** (đã build ở mốc 1): `GET /wards` và `GET /amenities` công khai trả đủ danh mục. Sau seed có đúng 168 đơn vị cấp xã của Thành phố Hồ Chí Minh mới (mã tỉnh `79`; 113 phường, 54 xã, 1 đặc khu) theo địa chỉ hai cấp sau sáp nhập, không có tên hay cột quận huyện, và danh sách tiện ích mẫu. `name` là tên đầy đủ kèm loại đơn vị; danh sách xếp theo thứ tự chữ cái tiếng Việt của `name`. Seed chạy lại nhiều lần vẫn đúng và chỉ thêm dòng còn thiếu, không ghi đè dòng admin đã sửa.
- **AC-2**: Admin (quyền `catalog:create`, `catalog:update`, `catalog:delete`) tạo, sửa tên và xóa phường và tiện ích. Tạo trùng mã trả 409 `CATALOG_CODE_TAKEN`; xóa mục còn nhà trọ dùng (kể cả nhà trọ đã xóa mềm) trả 409 `CATALOG_IN_USE`; chủ trọ và người tìm trọ bị 403 `PERMISSION_DENIED`. Đổi tên phường làm mới `search_key` của mọi tin thuộc phường đó trong cùng giao dịch.
- **AC-3**: Chủ trọ tạo, xem danh sách, xem chi tiết và sửa nhà trọ của mình (tên, địa chỉ, phường, tọa độ tùy chọn, tối đa một khoản phí cho mỗi loại trong 6 loại, tiện ích). Phường hoặc tiện ích không có trong danh mục bị 400 `WARD_UNKNOWN` hoặc `AMENITY_UNKNOWN`. Người tìm trọ bị 403 `PERMISSION_DENIED`; chủ trọ khác bị 403 `NOT_RESOURCE_OWNER`; nhà trọ không tồn tại bị 404 `PROPERTY_NOT_FOUND`.
- **AC-4**: Chủ trọ xóa mềm nhà trọ của mình khi nhà trọ không còn tin chưa xóa; còn tin thì 409 `PROPERTY_HAS_LISTINGS`.
- **AC-5**: Chủ trọ đăng tin vào nhà trọ của mình; tin sinh ra ở trạng thái `visible`, có `code` ngắn duy nhất và `view_count` bằng 0. Đăng vào nhà trọ của người khác bị 403 `NOT_RESOURCE_OWNER`.
- **AC-6**: Chủ trọ ẩn tin của mình (`visible` sang `hidden_by_owner`) và hiện lại (`hidden_by_owner` sang `visible`). Hiện lại tin đang `hidden_by_admin` bị 403 `LISTING_HIDDEN_BY_ADMIN`; mọi chuyển trạng thái khác không hợp lệ (ẩn tin không `visible`, hiện tin đã `visible`) bị 409 `LISTING_STATE_INVALID`.
- **AC-7**: Chủ trọ sửa tiêu đề, mô tả, giá thuê, diện tích, tiền cọc, ngày vào ở của tin mình ở mọi trạng thái (kể cả `hidden_by_admin`), không đổi được nhà trọ của tin, và xóa mềm tin mình. Sửa tiêu đề, và sửa tên, địa chỉ hay phường của nhà trọ, làm mới `search_key` của các tin liên quan trong cùng giao dịch.
- **AC-8**: Chủ trọ tải lên từng ảnh JPEG, PNG hoặc WebP (kiểm bằng nội dung tệp, không tin tên tệp hay `Content-Type`), tối đa `MAX_UPLOAD_BYTES` mỗi ảnh và 5 ảnh mỗi tin; ảnh có vị trí nhỏ nhất là ảnh bìa; xóa ảnh được. Ảnh thứ 6 bị 409 `LISTING_IMAGE_LIMIT`; sai loại hoặc không có tệp bị 400 `IMAGE_INVALID`; quá dung lượng bị 413 `PAYLOAD_TOO_LARGE`. Ảnh phục vụ công khai ở `GET /api/v1/media/public/:file` kèm `Cache-Control` dài hạn và `X-Content-Type-Options: nosniff`.
- **AC-9**: Admin (quyền `listing:moderate`) ẩn tin `visible` hoặc `hidden_by_owner` thành `hidden_by_admin`, và gỡ ẩn tin `hidden_by_admin` về `hidden_by_owner`, mỗi lần bắt buộc có lý do và ghi một dòng `moderation_logs` trong cùng giao dịch. Chủ trọ không tự hiện lại được tin `hidden_by_admin` (AC-6), và thấy lý do ẩn gần nhất ở tin của mình. Admin có danh sách tin để tìm (lọc theo trạng thái, chủ trọ, từ khóa), kể cả tin đang ẩn. Chuyển trạng thái sai bị 409 `LISTING_STATE_INVALID`.
- **AC-10**: `GET /listings` không cần đăng nhập, chỉ trả tin thỏa điều kiện hiển thị: tin `visible` và chưa xóa mềm, nhà trọ chưa xóa mềm, chủ trọ có `status = 'active'` và chưa xóa mềm. Lọc theo từ khóa `q` (không dấu, không phân biệt hoa thường), `wardCode`, `minPrice`, `maxPrice`; sắp xếp `newest`, `price_asc`, `price_desc`; phân trang `page`, `pageSize`. Khóa chủ trọ hoặc xóa mềm tin hoặc nhà trọ làm tin biến khỏi danh sách ngay. `minPrice` lớn hơn `maxPrice` bị 400 `VALIDATION_FAILED`.
- **AC-11**: `GET /listings/:slugCode` không cần đăng nhập, trả đủ thông tin tin, nhà trọ (phí, tiện ích, phường, tọa độ), ảnh và chủ trọ. Tin không hiển thị công khai (vì bất kỳ lý do nào, kể cả với chính chủ) trả 404 `LISTING_NOT_FOUND`. Chỉ phần mã ngắn ở cuối đường dẫn được dùng để tra, nên đổi tiêu đề vẫn mở được link cũ.
- **AC-12**: Chi tiết tin trả `landlord.phone` chỉ khi request mang access token hợp lệ. Khách, token sai hoặc hết hạn thấy `phone: null` và vẫn xem được tin (không bị 401).
- **AC-13**: Mở chi tiết một tin hiển thị cộng một lượt xem cho mỗi người xem trong 30 phút (người xem là tài khoản nếu có token hợp lệ, không thì IP). Chủ tin không được tính; tải lại trong 30 phút không làm số tăng; lượt xem cộng bằng một câu `UPDATE` nguyên tử; tin không hiển thị không được cộng.
- **AC-14**: Chủ trọ xem danh sách và chi tiết mọi tin chưa xóa của mình (`GET /me/listings`, `GET /me/listings/:id`) kèm `status` và `moderationReason` (có giá trị khi `hidden_by_admin`), kể cả tin đang ẩn.
- **AC-15**: Tạo và sửa nhà trọ, tạo và sửa tin, tải ảnh, và các route công khai (danh sách, chi tiết) có giới hạn tần suất; vượt thì 429 `RATE_LIMITED` kèm `Retry-After`.
- **AC-16**: Mọi nơi trả địa chỉ của nhà trọ hoặc tin (danh sách và chi tiết nhà trọ của chủ trọ, danh sách và chi tiết tin công khai, tin của chủ trọ, danh sách kiểm duyệt) kèm `fullAddress`: `addressText`, tên phường hoặc xã, tên tỉnh hoặc thành phố, nối bằng dấu phẩy theo đúng thứ tự đó (ví dụ `12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh`). Không có quận huyện ở bất cứ đâu. `fullAddress` ghép lúc đọc bằng một hàm dùng chung, không lưu cột. `addressText` chỉ là số nhà và tên đường; phường, xã và tỉnh đến từ `ward`.

## Decision

**Chosen option**: Option 1: Hai tầng nhà trọ và tin, tìm từ khóa bằng cột `search_key` đã bỏ dấu cùng chỉ mục trigram, đọc đăng nhập tùy chọn ở route công khai, ảnh qua `StorageService` ghi ổ đĩa

Chủ trọ tạo nhà trọ rồi đăng tin phòng thuộc nhà trọ; điều kiện hiển thị công khai viết đúng một lần trong một phương thức Repository (`visibleListingsQuery`); route công khai đọc access token nếu có (không có hay sai thì coi như khách) để ẩn số điện thoại với khách và loại lượt xem của chính chủ; ảnh kiểm bằng nội dung tệp rồi ghi qua `StorageService`.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Feature design

Quy ước chung theo 0001 đến 0006: Repository bọc Prisma, id `uuidv7()`, `timestamptz`, tên bảng và cột `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`, giá trị liệt kê là `text` kèm `CHECK`, tiền là `integer` đồng, xóa mềm bằng `notDeleted`, giao dịch qua `TransactionRunner`.

**Data model** (một migration; mô hình đã được bạn xác nhận):

| Bảng | Khóa chính | Cột | Ràng buộc và chỉ mục |
|---|---|---|---|
| `wards` | `code` (text) | `name`, `province_code`, `province_name`, `created_at`, `updated_at` | Địa chỉ hai cấp sau sáp nhập (từ 01/07/2025): không có cột quận huyện, tỉnh hoặc thành phố nằm ngay trong `wards`. `code` là mã 5 chữ số theo danh mục hành chính mới (không trộn với mã trước sáp nhập); `name` là tên đầy đủ kèm loại đơn vị ("Phường Bến Thành", "Xã Bình Chánh", "Đặc khu Côn Đảo"); mã tỉnh HCM là `79`. Đã build ở mốc 1 (migration `20261014090000_property_listings`) |
| `amenities` | `key` (text, dạng `^[a-z][a-z0-9_]{1,29}$`) | `name`, `created_at`, `updated_at` | |
| `properties` | `id` | `landlord_id` (FK `users`, RESTRICT), `name`, `address_text`, `ward_code` (FK `wards`, RESTRICT), `latitude?`, `longitude?`, `created_at`, `updated_at`, `deleted_at?` | `CHECK` lat trong [-90, 90], lng trong [-180, 180], và cả hai cùng rỗng hoặc cùng có; chỉ mục `landlord_id`, `ward_code`; không đánh chỉ mục tọa độ (chưa ai tìm theo tọa độ). `address_text` chỉ là số nhà và tên đường, không gồm phường, xã, tỉnh (đã nằm ở `ward_code`) |
| `property_fees` | `id` | `property_id` (FK, CASCADE), `kind`, `price` (integer), `unit`, `note?` | `kind` là `electricity`, `water`, `internet`, `parking`, `service`, `other`; `unit` là `per_kwh`, `per_m3`, `per_month`, `per_person_month`, `per_vehicle_month`; `price >= 0`; `UNIQUE (property_id, kind)` nên tối đa 6 dòng |
| `property_amenities` | (`property_id`, `amenity_key`) | | FK `properties` CASCADE, FK `amenities` RESTRICT; chỉ mục `amenity_key` |
| `listings` | `id` | `property_id` (FK, RESTRICT), `code`, `title`, `description`, `price` (integer), `area_m2` (double precision), `deposit?` (integer), `available_from?` (date), `status`, `view_count` (integer), `search_key`, `created_at`, `updated_at`, `deleted_at?` | `code` duy nhất; `status` là `visible`, `hidden_by_owner`, `hidden_by_admin`, mặc định `visible`; `price > 0`, `area_m2 > 0`, `deposit >= 0`, `view_count >= 0`; chỉ mục `property_id`; GIN trigram trên `search_key` (khai báo trong `schema.prisma`); hai chỉ mục một phần viết SQL trong migration: `(created_at DESC, id DESC)` và `(price, id)`, cùng điều kiện `WHERE status = 'visible' AND deleted_at IS NULL` |
| `listing_images` | `id` | `listing_id` (FK, CASCADE), `position` (smallint), `storage_key`, `created_at` | `CHECK position BETWEEN 0 AND 4`; `UNIQUE (listing_id, position)`; `storage_key` duy nhất |

Quan hệ: chủ trọ 1:N nhà trọ 1:N tin 1:N ảnh (tối đa 5); nhà trọ 1:N phí (tối đa 6); nhà trọ N:M tiện ích. `listings` không có `landlord_id`: chủ tin là `properties.landlord_id`. `moderation_logs` đã có, dùng với `target_type = 'listing'`, `action` là `hide_listing` hoặc `unhide_listing`. Quyền mặc định của landlord đã có đủ `property:*` và `listing:read|create|update|delete`, nên không cần migration quyền; `listing:moderate` và `catalog:*` chỉ admin giữ.

**Dữ liệu seed** (`npm run seed`, chỉ thêm dòng còn thiếu): `wards` từ `prisma/seed-data/wards.json`, **đã dựng ở mốc 1 ngày 2026-10-14** từ bộ `thanglequoc/vietnamese-provinces-database` (MIT) bản `v5.2.0`, nền là Quyết định 19/2025/QĐ-TTg: tỉnh mã `79` có đúng 168 dòng (113 phường, 54 xã, 1 đặc khu), không tên nào có quận huyện, và khớp từng mã với `provinces.open-api.vn` v2 (cùng 168 mã). Nguồn, cách lọc và cách kiểm ghi ở `prisma/seed-data/README.md`; test `src/database/seed-data.spec.ts` canh các điều đó. Dựng lại sau này mà số dòng lệch thì **dừng và hỏi bạn**, không tự sửa. `amenities` mẫu: `wifi`, `air_conditioner`, `water_heater`, `private_bathroom`, `kitchen`, `loft`, `washing_machine`, `parking`, `elevator`, `security_camera`, `free_hours`, `furnished`, `balcony`.

**State transitions** (tin):

| Từ | Hành động (ai) | Sang |
|---|---|---|
| (chưa có) | đăng (chủ trọ) | `visible` |
| `visible` | ẩn (chủ trọ) | `hidden_by_owner` |
| `hidden_by_owner` | hiện (chủ trọ) | `visible` |
| `visible` hoặc `hidden_by_owner` | ẩn kèm lý do (admin, `listing:moderate`) | `hidden_by_admin` |
| `hidden_by_admin` | gỡ ẩn kèm lý do (admin) | `hidden_by_owner` |
| mọi trạng thái | xóa (chủ trọ) | xóa mềm |

Mọi chuyển trạng thái là một câu `updateMany ... WHERE id = ? AND status <điều kiện trạng thái nguồn>` rồi đọc `count`; `count = 0` nghĩa là trạng thái không còn như dự định, trả `LISTING_STATE_INVALID`. Điều kiện nguồn nằm **trong chính câu lệnh**, không đọc trạng thái ra trước rồi mới ghi: lệnh ẩn của admin có hai trạng thái nguồn nên dùng `status IN ('visible', 'hidden_by_owner')`, và chỉ ghi `moderation_logs` (cùng giao dịch) khi `count = 1`. Nhờ vậy admin ẩn tin cùng lúc chủ trọ bấm ẩn hay hiện thì admin luôn thắng, kể cả khi chủ trọ đổi trạng thái đúng giữa hai bước.

**API surface** (tiền tố `/api/v1`; quyền ghi trong bảng là quyền cần có; phân trang mặc định `page=1`, `pageSize=20`, tối đa 50, trả `{ items, total, page, pageSize }`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/wards` | GET | không | mảng `{ code, name, provinceCode, provinceName }`, xếp theo thứ tự chữ cái tiếng Việt của `name` | công khai | |
| `/amenities` | GET | không | mảng `{ key, name }` | công khai | |
| `/wards` | POST | `code` (`^[0-9]{5}$`), `name`, `provinceCode` (`^[0-9]{2}$`), `provinceName` (req) | phường | `catalog:create` | 400 `VALIDATION_FAILED`, 409 `CATALOG_CODE_TAKEN` |
| `/wards/:code` | PATCH | `name?`, `provinceName?` | phường | `catalog:update` | 404 `NOT_FOUND` |
| `/wards/:code` | DELETE | | 204 | `catalog:delete` | 404 `NOT_FOUND`, 409 `CATALOG_IN_USE` |
| `/amenities` | POST | `key`, `name` (req) | tiện ích | `catalog:create` | 409 `CATALOG_CODE_TAKEN` |
| `/amenities/:key` | PATCH | `name` | tiện ích | `catalog:update` | 404 `NOT_FOUND` |
| `/amenities/:key` | DELETE | | 204 | `catalog:delete` | 404 `NOT_FOUND`, 409 `CATALOG_IN_USE` |
| `/properties` | POST | `name`, `addressText`, `wardCode` (req); `latitude`, `longitude`, `fees[]` (`kind`, `price`, `unit`, `note?`), `amenityKeys[]` (opt) | 201 nhà trọ | `property:create` | 400 `WARD_UNKNOWN`, `AMENITY_UNKNOWN`, 429 |
| `/properties` | GET | `page`, `pageSize` | nhà trọ của mình kèm `listingCount`, xếp `created_at DESC, id DESC` | `property:read` | |
| `/properties/:id` | GET | | nhà trọ kèm phí, tiện ích | `property:read` | 404 `PROPERTY_NOT_FOUND`, 403 `NOT_RESOURCE_OWNER` |
| `/properties/:id` | PATCH | mọi trường như tạo, đều tùy chọn; `fees` và `amenityKeys` nếu gửi thì thay cả danh sách; `latitude` và `longitude` gửi cùng nhau, `null` cả hai để xóa | nhà trọ | `property:update` | như trên, 400 `WARD_UNKNOWN` |
| `/properties/:id` | DELETE | | 204 | `property:delete` | 409 `PROPERTY_HAS_LISTINGS`, 403, 404 |
| `/properties/:propertyId/listings` | POST | `title`, `description`, `price`, `areaM2` (req); `deposit`, `availableFrom` (opt) | 201 tin (`visible`) | `listing:create` | 404 `PROPERTY_NOT_FOUND`, 403 `NOT_RESOURCE_OWNER`, 429 |
| `/me/listings` | GET | `status?`, `page`, `pageSize` | tin tóm tắt của mình kèm `status`, `moderationReason`, `viewCount`, xếp `created_at DESC, id DESC` | `listing:read` | 400 `VALIDATION_FAILED` (`status` sai) |
| `/me/listings/:id` | GET | | tin kèm `status`, `moderationReason` | `listing:read` | 404 `LISTING_NOT_FOUND`, 403 |
| `/listings/:id` | PATCH | `title?`, `description?`, `price?`, `areaM2?`, `deposit?`, `availableFrom?` (cho phép `null` với hai trường cuối) | tin | `listing:update` | 404, 403 |
| `/listings/:id` | DELETE | | 204 | `listing:delete` | 404, 403 |
| `/listings/:id/hide` | POST | | tin | `listing:update` | 409 `LISTING_STATE_INVALID`, 403 |
| `/listings/:id/show` | POST | | tin | `listing:update` | 403 `LISTING_HIDDEN_BY_ADMIN`, 409 `LISTING_STATE_INVALID` |
| `/listings/:id/images` | POST | multipart, một trường `file` | 201 `{ id, position, url }` | `listing:update` | 409 `LISTING_IMAGE_LIMIT`, 400 `IMAGE_INVALID`, 413, 429 |
| `/listings/:id/images/:imageId` | DELETE | | 204 | `listing:update` | 404 `NOT_FOUND`, 403 |
| `/listings` | GET | `q?`, `wardCode?`, `minPrice?`, `maxPrice?`, `sort?`, `page`, `pageSize` | trang tin tóm tắt | công khai | 400 `VALIDATION_FAILED`, 429 |
| `/listings/:slugCode` | GET | `slugCode` (`slug-mã` hoặc chỉ `mã`) | chi tiết tin | công khai, đọc đăng nhập tùy chọn | 404 `LISTING_NOT_FOUND`, 429 |
| `/media/public/:file` | GET | | tệp ảnh, chỉ khi tin của ảnh còn hiển thị | công khai | 404 `NOT_FOUND` |
| `/moderation/listings` | GET | `status?`, `landlordId?`, `q?`, `page`, `pageSize` | trang "Mục kiểm duyệt" (xem Hình dạng trả về) | `listing:moderate` | 400 `VALIDATION_FAILED` |
| `/moderation/listings/:id/hide` | POST | `reason` (req, 1 đến 500 ký tự sau khi cắt khoảng trắng) | "Mục kiểm duyệt" | `listing:moderate`, `@FreshAuth()` | 400 `VALIDATION_FAILED`, 409 `LISTING_STATE_INVALID`, 404 `LISTING_NOT_FOUND` |
| `/moderation/listings/:id/unhide` | POST | `reason` (req, 1 đến 500 ký tự sau khi cắt khoảng trắng) | "Mục kiểm duyệt" | `listing:moderate`, `@FreshAuth()` | 400 `VALIDATION_FAILED`, 409 `LISTING_STATE_INVALID`, 404 `LISTING_NOT_FOUND` |

Hình dạng trả về:
- **Tin tóm tắt** (danh sách công khai): `{ id, code, slug, title, price, areaM2, deposit, availableFrom, coverImageUrl, ward: { code, name }, addressText, fullAddress, landlord: { id, name }, createdAt }`.
- **Chi tiết công khai**: tin tóm tắt cộng `description`, `viewCount`, `images[] { id, position, url }`, `property: { id, name, addressText, fullAddress, ward { code, name, provinceCode, provinceName }, latitude, longitude, fees[], amenities[] { key, name } }`, `landlord: { id, name, phone }`.
- **Tin của chủ trọ** (`/me/listings/:id` và kết quả mọi route ghi của chủ trọ: đăng, sửa, ẩn, hiện tin): như chi tiết công khai, bỏ `landlord`, thêm `status` và `moderationReason`. Danh sách `GET /me/listings` dùng **tin tóm tắt** (bỏ `landlord`) cộng `status`, `moderationReason`, `viewCount`; ảnh, phí, tiện ích đầy đủ chỉ có ở `/me/listings/:id`.
- **Mục kiểm duyệt** (`GET /moderation/listings` và kết quả của hai route ẩn, gỡ ẩn của admin): tin tóm tắt (có `landlord { id, name }`) cộng `status`, `moderationReason`, `viewCount`.
- **Nhà trọ của chủ trọ** (`/properties`, `/properties/:id`): `{ id, name, addressText, fullAddress, ward { code, name, provinceCode, provinceName }, latitude, longitude, fees[], amenities[], createdAt, updatedAt }`, cộng `listingCount` ở danh sách.
- **`fullAddress`** (AC-16): `[addressText, ward.name, ward.provinceName]` nối bằng `, `, tính lúc đọc bằng hàm dùng chung `toFullAddress`; FE hiển thị thẳng, không tự ghép.
- `url` của ảnh là đường dẫn tương đối `/api/v1/media/public/<uuid>.<đuôi>`; FE tự nối với địa chỉ API.
- Mọi trường nhận từ body đi qua DTO có `@Trim()`; chữ là văn bản thuần, FE chịu trách nhiệm thoát khi hiển thị.

Giới hạn dữ liệu nhận vào: `title` 5 đến 120 ký tự; `description` 10 đến 5000; `price` số nguyên từ 100000 đến 100000000; `areaM2` từ 1 đến 1000, tối đa một chữ số thập phân; `deposit` số nguyên từ 0 đến 1000000000; `availableFrom` dạng `YYYY-MM-DD`; nhà trọ `name` 2 đến 100, `addressText` 5 đến 200 (chỉ số nhà và tên đường, không gồm phường, xã, tỉnh); phí `price` từ 0 đến 100000000, `note` tối đa 100; `amenityKeys` tối đa 30, không trùng; `wardCode` khớp `^[0-9]{5}$` (mã phường sau sáp nhập); `q` tối đa 6 từ, mỗi từ tối đa 50 ký tự. Các biên còn lại ở mục "Quy tắc đầu vào, đầu ra và biên" ngay dưới.

Mã lỗi mới (thêm vào `ErrorCode`, kèm câu tiếng Việt, theo 0004):

| Mã | Status | Khi nào |
|---|---|---|
| `WARD_UNKNOWN` | 400 | Phường trong body không có trong danh mục |
| `AMENITY_UNKNOWN` | 400 | Có khóa tiện ích không có trong danh mục |
| `CATALOG_CODE_TAKEN` | 409 | Tạo phường hoặc tiện ích trùng mã |
| `CATALOG_IN_USE` | 409 | Xóa phường hoặc tiện ích còn được nhà trọ dùng |
| `PROPERTY_NOT_FOUND` | 404 | Nhà trọ không tồn tại hoặc đã xóa mềm |
| `PROPERTY_HAS_LISTINGS` | 409 | Xóa nhà trọ còn tin chưa xóa |
| `LISTING_NOT_FOUND` | 404 | Tin không tồn tại, đã xóa mềm, hoặc (ở route công khai) không hiển thị |
| `LISTING_STATE_INVALID` | 409 | Chuyển trạng thái không hợp lệ |
| `LISTING_HIDDEN_BY_ADMIN` | 403 | Chủ trọ cố hiện tin đang bị admin ẩn |
| `LISTING_IMAGE_LIMIT` | 409 | Đã đủ 5 ảnh |
| `IMAGE_INVALID` | 400 | Thiếu tệp hoặc không phải JPEG, PNG, WebP |

Phường hoặc tiện ích không tồn tại ở đường dẫn dùng mã chung `NOT_FOUND`; ảnh không thuộc tin cũng vậy.

**Quy tắc đầu vào, đầu ra và biên** (chốt ngày 2026-10-14 sau kiểm tra chéo; mỗi điều từng là chỗ người build phải tự đặt):
- **Danh sách kiểm duyệt**: bỏ tin đã xóa mềm; xếp `created_at DESC, id DESC`; `q` đi qua `toSearchKey` và `escapeLike` như danh sách công khai; `status` ngoài ba giá trị thì 400 `VALIDATION_FAILED`. `reason` của ẩn và gỡ ẩn là 1 đến 500 ký tự sau khi cắt khoảng trắng; rỗng hay dài hơn thì 400.
- **Hình dạng route ghi**: route ghi của chủ trọ trả "Tin của chủ trọ" (tạo và sửa nhà trọ trả "Nhà trọ của chủ trọ"); route admin trả "Mục kiểm duyệt".
- **Thứ tự**: danh sách nhà trọ và tin của chủ trọ `created_at DESC, id DESC`; `images[]` theo `position` tăng dần; `fees[]` theo thứ tự cố định `electricity, water, internet, parking, service, other`; `amenities[]` theo tên tiếng Việt (`Intl.Collator('vi')`).
- **Giá trị trống** trả `null`, không bao giờ chuỗi rỗng: `coverImageUrl` của tin chưa có ảnh, `landlord.name` chưa đặt, `landlord.phone` khi là khách hoặc khi `users.phone` rỗng.
- **`availableFrom`**: luôn trả chuỗi `YYYY-MM-DD` cắt từ ISO UTC của cột `date` (không đổi múi giờ để không lệch ngày); nhận cả ngày đã qua, không kiểm cận dưới.
- **Phí và tọa độ nhà trọ**: DTO chặn `kind` trùng và quá 6 khoản bằng 400 `VALIDATION_FAILED` (không để `UNIQUE` của DB thành 500); không ràng buộc cặp `kind` với `unit`; gửi chỉ một trong hai tọa độ thì 400 `VALIDATION_FAILED` ở cả POST lẫn PATCH (xóa tọa độ ở PATCH là `null` cả hai).
- **Mã phường và danh mục**: mã phường là `^[0-9]{5}$` ở mọi nơi (DTO, query `wardCode`, `POST /wards`); `provinceCode` của `POST /wards` khớp `^[0-9]{2}$`; `provinceCode` và `provinceName` vẫn nhận từ body để mở thêm tỉnh sau này.
- **Biên của `GET /listings`**: `page` từ 1; `pageSize` từ 1 đến 50, quá 50 thì 400; `sort` ngoài ba giá trị thì 400; `q` quá 6 từ thì chỉ lấy 6 từ đầu, `q` rỗng sau khi cắt thì bỏ lọc; `wardCode` đúng dạng nhưng không có trong danh mục thì trả danh sách rỗng (không phải lỗi); `minPrice` và `maxPrice` là số nguyên từ 0 đến 100000000, `minPrice` lớn hơn `maxPrice` thì 400.
- **Id sai định dạng**: mọi `:id`, `:propertyId`, `:imageId` đi qua `uuidParam()` theo 0004: sai dạng UUID thì 400 `INVALID_ID`, không để lỗi kiểu của Prisma thành 500. Riêng `slugCode`: không lấy được mã 8 ký tự hợp lệ hoặc không có tin hiển thị thì 404 `LISTING_NOT_FOUND`; mã đúng nhưng phần slug sai thì vẫn 200 và trả `slug` đúng để FE thay URL.
- **Tải ảnh, thứ tự kiểm lỗi**: 413 (multer, quá dung lượng) trước, rồi 404 `LISTING_NOT_FOUND` hoặc 403 `NOT_RESOURCE_OWNER`, rồi 400 `IMAGE_INVALID` (thiếu tệp, sai loại, sai tên trường, gửi nhiều tệp), rồi 409 `LISTING_IMAGE_LIMIT`. Tải ảnh được ở mọi trạng thái của tin, kể cả `hidden_by_admin` (giống AC-7).
- **Cache chi tiết tin**: `GET /listings/:slugCode` đặt `Cache-Control: private, no-store` vì nội dung (số điện thoại) đổi theo người xem.
- **Ảnh của tin không hiển thị**: `GET /media/public/:file` chỉ phục vụ khi dòng `listing_images` tồn tại và tin của nó thỏa `visibleListingsQuery`, ngược lại 404 `NOT_FOUND`. `Cache-Control` là `public, max-age=86400` (một ngày, thay cho một năm) để ảnh của tin bị admin ẩn biến khỏi bộ nhớ đệm trong một ngày. Hệ quả chấp nhận: thẻ ảnh không gửi token nên chính chủ cũng không xem được ảnh của tin đang ẩn qua đường này (hiện lại tin là thấy), và mỗi ảnh tốn một truy vấn nhỏ.

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Tạo nhà trọ | `landlord_id` | `sub` trong access token qua `@CurrentUser()`, không nhận từ body |
| Tạo nhà trọ | `ward_code` hợp lệ | body, Service kiểm tồn tại trong `wards` |
| Đăng tin | `property_id` và chủ nhà trọ | tham số đường dẫn; so `properties.landlord_id` với `sub` bằng `assertOwner` |
| Đăng tin | `status` | cố định `visible` ở Service, không nhận từ body |
| Đăng tin | `code` | Service sinh 8 ký tự từ bảng chữ `abcdefghjkmnpqrstuvwxyz23456789` bằng `crypto.randomInt`; chèn thẳng rồi bắt lỗi trùng (`P2002` trên `listings_code_unique`), sinh mã mới và thử lại tối đa 5 lần; vòng thử lại bọc **ngoài cả giao dịch** (một giao dịch Postgres đã lỗi thì bị hủy, không chèn tiếp được); hết 5 lần thì 500 `INTERNAL_ERROR` kèm log. Không kiểm trùng trước vì vẫn đua giữa hai request |
| Đăng, sửa tin, sửa nhà trọ | `search_key` | `toSearchKey(title, property.name, property.address_text, ward.name)` (0005) |
| Đọc tin công khai | `slug` | `toSlug(title)` lúc đọc, không lưu: bỏ dấu, `đ` thành `d`, chữ thường, ký tự lạ thành `-`, tối đa 60 ký tự, rỗng thì dùng `tin` |
| Mở chi tiết | tra tin bằng mã | phần sau dấu `-` cuối cùng của `slugCode`, khớp `^[a-z0-9]{8}$`; không khớp thì 404, không 400 |
| Mở chi tiết | `landlord.phone` | `users.phone` nếu `req.user` có (đọc đăng nhập tùy chọn), không thì `null` |
| Mở chi tiết | người xem và chủ tin | người xem là `req.user.userId`, không có thì `req.ip` (0001, hợp đồng 8); chủ tin là `properties.landlord_id` |
| Mở chi tiết | `viewCount` | giá trị sau `UPDATE ... SET view_count = view_count + 1` nếu vừa tính lượt, không thì giá trị đã đọc |
| Danh sách, chi tiết | tên phường, tên tỉnh, tên chủ trọ, ảnh | join `wards` (`name`, `province_name`), `users.name` (có thể rỗng), `listing_images` (bìa là `position` nhỏ nhất) |
| Mọi nơi trả địa chỉ | `fullAddress` | hàm dùng chung `toFullAddress(addressText, ward)` = `[addressText, ward.name, ward.provinceName].join(', ')`, ghép lúc đọc, không lưu cột (AC-16) |
| `GET /wards`, `GET /amenities` | thứ tự | Service sắp bằng `Intl.Collator('vi')` theo `name`, trùng tên thì theo `code` (không dựa vào collation của DB, vì collation Windows và Linux xếp tiếng Việt khác nhau) |
| Danh sách | `total` | `count` cùng điều kiện hiển thị và cùng bộ lọc |
| Danh sách | từ khóa | `toSearchKey(q)`, cắt từ, mỗi từ qua hàm dùng chung `escapeLike` (thêm `\` trước `\`, `%`, `_`) rồi một điều kiện `contains` nối bằng AND. **Prisma gắn tham số nhưng KHÔNG tự thoát `%` và `_`** (đã kiểm chạy thật ngày 2026-10-14: `contains: '_'` khớp mọi dòng); sau khi tự thoát bằng `\` thì `\_` chỉ khớp dấu gạch dưới thật, không cần mệnh đề `ESCAPE` vì `\` là ký tự thoát mặc định của `LIKE` ở PostgreSQL |
| Xem nhà trọ của mình | `listingCount` | số tin chưa xóa mềm của nhà trọ (`_count` của Prisma với `notDeleted`) |
| Xem tin của mình | tập tin cần trả | tin có `properties.landlord_id` bằng `sub`, chưa xóa mềm, mọi trạng thái; `status` lọc theo query `status` |
| Danh sách công khai | sắp xếp mặc định | `sort = newest`: `created_at DESC, id DESC`; `price_asc`: `price ASC, id ASC`; `price_desc`: `price DESC, id DESC`. Khóa phụ của hai kiểu giá chỉ là `id` (không phải `created_at`) để khớp đúng chỉ mục một phần `(price, id)`, quét được cả hai chiều; `id` là UUID v7 sắp theo thời gian nên vẫn ổn định và gần với "mới trước" |
| Danh sách admin | thông tin chủ trọ | `users.id` và `users.name` qua `properties.landlord_id` |
| Xem tin của mình | `moderationReason` | dòng `moderation_logs` mới nhất có `target_type = 'listing'`, `target_id` là tin, `action = 'hide_listing'`; chỉ khi `status = 'hidden_by_admin'` |
| Admin ẩn hoặc gỡ ẩn | `actor_id`, `reason` | `sub` trong token (đọc lại DB do `@FreshAuth()`); `reason` từ body |
| Tải ảnh | `position` | vị trí trống nhỏ nhất từ 0 đến 4, tính trong giao dịch đã khóa dòng tin bằng `SELECT ... FOR UPDATE` |
| Tải ảnh | `storage_key` và đuôi tệp | Service sinh `public/<uuid v4>.<jpg|png|webp>`; đuôi lấy từ loại ảnh nhận ra bằng nội dung, không từ tên tệp |
| Tải ảnh | dung lượng tối đa | env `MAX_UPLOAD_BYTES` |
| Phục vụ ảnh | `Content-Type` | suy từ đuôi của `:file` (chỉ ba giá trị) |
| Đổi tên phường | tin cần làm mới `search_key` | mọi tin chưa xóa của nhà trọ có `ward_code` đó |

**Điều kiện hiển thị công khai** (`visibleListingsQuery`, viết đúng một lần trong Repository, mọi truy vấn công khai đều dùng): `status = 'visible'` và `deleted_at IS NULL` ở tin; `deleted_at IS NULL` ở nhà trọ; chủ trọ `status = 'active'` và `deleted_at IS NULL`. Hàng 9 sẽ thêm vế "còn dùng thử hoặc có gói đang hiệu lực" đúng ở hàm này; hàng 8 không có vế đó.

**Đọc đăng nhập tùy chọn**: decorator `@OptionalAuth()` gồm `@Public()` cộng một khóa metadata riêng, nên vẫn tính là đúng một khai báo (AC-4 của 0003). `JwtAuthGuard` với route này vẫn thử xác thực token nếu có header `Authorization`, bắt mọi lỗi (sai, hết hạn, tài khoản bị khóa) và cho đi tiếp như khách; không có header thì đi tiếp ngay. Test duyệt route (0003) phải nhận đúng route này là công khai.

**Đếm lượt xem không trùng**: một lớp nhỏ trong bộ nhớ (`Map` từ `<người xem>:<id tin>` sang thời điểm hết hạn, cửa sổ 30 phút, hằng số trong code). Lượt đầu của một cặp trong cửa sổ thì cộng, các lượt sau thì bỏ qua. Dọn dòng hết hạn định kỳ mỗi phút bằng `setInterval` có `unref` (bắt đầu ở `onModuleInit`, dừng ở `onModuleDestroy`), không quét theo từng request; nếu vẫn quá 100000 dòng thì xóa sạch (chấp nhận cộng dư vài lượt). Mất khi API khởi động lại; chấp nhận được vì đã chọn không thêm bảng.

**Ảnh**: `StorageService` theo hợp đồng của 0006 (`put`, `get`, `delete` theo khóa, khóa kiểm bằng biểu thức `^public/[0-9a-f-]{36}\.(jpg|png|webp)$` trước khi chạm ổ đĩa, đường dẫn đã giải quyết phải nằm trong `UPLOAD_DIR`). Tải lên dùng `FileInterceptor('file')` của `@nestjs/platform-express` với bộ nhớ tạm, `limits.fileSize = MAX_UPLOAD_BYTES`, một tệp mỗi request. Loại ảnh nhận ra bằng chữ ký đầu tệp viết tay (JPEG `FF D8 FF`; PNG `89 50 4E 47 0D 0A 1A 0A`; WebP `RIFF` cách bốn byte rồi `WEBP`), không thêm thư viện. Thứ tự: khóa dòng tin và kiểm số ảnh, ghi tệp, chèn dòng `listing_images`; lỗi ở bước chèn **hoặc ở bước commit** thì xóa tệp (bọc cả lời gọi `TransactionRunner`, gồm commit, trong `try/catch`, không chỉ câu chèn). Nếu tiến trình chết đúng giữa ghi tệp và commit thì tệp mồ côi vẫn có thể còn lại; chấp nhận ở bản demo. Xóa ảnh: xóa dòng trước, xóa tệp sau (lỗi xóa tệp chỉ ghi log). Xóa mềm tin hay nhà trọ giữ nguyên ảnh. Route phục vụ ảnh gắn `@Public()`, chỉ phục vụ ảnh của tin còn hiển thị (xem "Quy tắc đầu vào, đầu ra và biên"), đặt `Cache-Control: public, max-age=86400` và `X-Content-Type-Options: nosniff`, trả `StreamableFile`.

**Giới hạn tần suất** (thêm nhóm vào `RATE_LIMITS`, dùng `@RateLimited`; con số do bạn duyệt ngày 2026-10-14):

| Nhóm | Route | Bộ đếm |
|---|---|---|
| `propertyWrite` | tạo, sửa, xóa nhà trọ | `user`: 30 lần mỗi giờ |
| `listingWrite` | đăng, sửa, xóa, ẩn, hiện tin | `user`: 60 lần mỗi giờ |
| `listingImage` | tải ảnh lên | `user`: 60 lần mỗi giờ |
| `publicRead` | danh sách công khai | `ip`: 300 lần mỗi phút (đủ rộng cho nhiều sinh viên dùng chung một IP ký túc xá) |
| `publicDetail` | chi tiết tin công khai | `ip`: 300 lần mỗi phút; thêm `user`: 60 lần mỗi phút **chỉ khi request có người đăng nhập** (chống một tài khoản miễn phí cào số điện thoại của mọi chủ trọ) |

Bộ đếm `user` bị bỏ qua khi request không có người dùng (khách): cấu hình `skipIf` cho bộ đếm `user` trong `RATE_LIMIT_OPTIONS`, nên khách chỉ chịu `ip` 300 lần mỗi phút và không bị dồn vào giới hạn 60 theo IP. Admin (kiểm duyệt, danh mục) không giới hạn thêm; ảnh tĩnh `/media` không giới hạn.

**Key invariants**:
- Một tin hiển thị công khai khi và chỉ khi thỏa `visibleListingsQuery`; không cờ sao chép nào thay thế phép nối.
- `listings.status` chỉ có ba giá trị (`CHECK`); chuyển trạng thái chỉ qua `updateMany` có điều kiện trạng thái cũ (xem trên); chủ trọ không bao giờ đưa tin ra khỏi `hidden_by_admin`.
- Ẩn hoặc gỡ ẩn của admin và dòng `moderation_logs` của nó nằm trong một giao dịch; không có lý do thì không đổi trạng thái.
- `listings.property_id` không đổi sau khi tạo.
- Xóa mềm nhà trọ và đăng tin vào nhà trọ cùng khóa dòng `properties` bằng `SELECT ... FOR UPDATE` trong giao dịch của mình, nên không thể có tin sống nằm dưới một nhà trọ đã xóa mềm (AC-4): đăng tin chạy trước thì xóa nhà trọ nhận `PROPERTY_HAS_LISTINGS`, xóa chạy trước thì đăng tin nhận `PROPERTY_NOT_FOUND`.
- `search_key` luôn bằng `toSearchKey(title, tên nhà trọ, địa chỉ, tên phường)`; có ba đường cập nhật duy nhất: đăng hoặc sửa tiêu đề tin, sửa tên hay địa chỉ hay phường của nhà trọ, đổi tên phường.
- `view_count` chỉ tăng, chỉ qua `UPDATE ... SET view_count = view_count + 1`.
- Tối đa 5 ảnh mỗi tin do `CHECK position` cộng `UNIQUE (listing_id, position)` ở DB, và khóa dòng tin ở Service để hai lần tải đồng thời không gây lỗi 500.
- Tối đa 6 khoản phí mỗi nhà trọ do `UNIQUE (property_id, kind)` cộng `CHECK kind`.
- Mọi đọc `properties` và `listings` đi qua `notDeleted` (trừ phương thức tên `...IncludingDeleted`).
- Không đường dẫn tệp nào sinh từ dữ liệu người dùng; khóa lưu trữ do server sinh.

**Security model**:
- Công khai: `GET /wards`, `/amenities`, `/listings`, `/listings/:slugCode`, `/media/public/:file`. Chi tiết tin đọc đăng nhập tùy chọn; token sai không bị 401 mà coi như khách.
- Chủ trọ (`landlord`): quyền `property:*` và `listing:read|create|update|delete`, chỉ trên dữ liệu của chính mình; dữ liệu người khác bị 403 `NOT_RESOURCE_OWNER` (0003 AC-5). Người tìm trọ (`tenant`) không có quyền nào ở đây ngoài đọc công khai.
- Admin: `listing:moderate` (ẩn, gỡ ẩn, xem danh sách kiểm duyệt) và `catalog:*`; admin cũng bị kiểm chủ sở hữu nên không sửa tin của người khác bằng `listing:update`. Ẩn và gỡ ẩn gắn `@FreshAuth()` (0003 AC-8); ghi danh mục không bắt buộc `@FreshAuth()`.
- Dữ liệu cá nhân: số điện thoại chủ trọ là dữ liệu cá nhân; chỉ lộ cho người đã đăng nhập, không lộ ở danh sách, không ghi vào log. Chưa có quy định tuân thủ nào áp dụng riêng cho tính năng này.
- Tải ảnh: kiểm loại bằng nội dung, giới hạn dung lượng, tên tệp do server sinh, `nosniff` khi phục vụ; ảnh không được nén hay xóa dữ liệu EXIF (xem Consequences). Khi thêm `helmet` về sau, route ảnh phải gửi `Cross-Origin-Resource-Policy: cross-origin`, nếu không FE khác origin không hiện được ảnh.

**Configuration required**:
- `UPLOAD_DIR`: thư mục lưu ảnh. Mặc định trong code là `uploads` (tương đối với thư mục chạy, cho máy dev); Docker Compose đặt `/data/uploads` (0006). Thư mục `uploads/` phải được `.gitignore`.
- `MAX_UPLOAD_BYTES`: dung lượng tối đa mỗi ảnh, số nguyên từ 1 đến 10485760, mặc định `5242880`.
- Thêm cả hai vào lớp `Env` và `.env.example`. Không có biến bí mật mới, không dịch vụ ngoài. Thêm `@types/multer` vào `devDependencies`; `multer` đã đi kèm `@nestjs/platform-express`.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: chủ trọ tạo nhà trọ kèm phí và tiện ích, đăng tin, tin có trong `GET /listings` ngay, mở bằng `slug-mã` thấy chi tiết kèm ảnh vừa tải, verifies **AC-3**, **AC-5**, **AC-8**, **AC-10**, **AC-11**
- Happy path: nhà trọ ở "Phường Bến Thành" với `addressText` "12 Lê Lợi" trả `fullAddress` đúng "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh" ở nhà trọ, tin tóm tắt, chi tiết và tin của chủ trọ; không chuỗi địa chỉ nào chứa chữ quận hay huyện; đổi tên phường thì `fullAddress` đổi theo ngay, verifies **AC-16**
- Happy path: ẩn rồi hiện lại tin của mình, tin biến rồi hiện lại trong danh sách công khai, verifies **AC-6**, **AC-10**
- Happy path: admin ẩn tin kèm lý do, chủ trọ thấy `moderationReason` và hiện lại bị 403 `LISTING_HIDDEN_BY_ADMIN`; admin gỡ ẩn thì tin về `hidden_by_owner` và chủ trọ hiện được, verifies **AC-6**, **AC-9**, **AC-14**
- Failure case: admin ẩn đúng lúc chủ trọ bấm hiện (chạy song song): trạng thái cuối luôn là `hidden_by_admin`, verifies **AC-6**, **AC-9**
- Failure case: hai request tải ảnh đồng thời vào tin đã có 4 ảnh: đúng một thành công, một nhận 409 `LISTING_IMAGE_LIMIT`, không có 500; tệp của request thua không còn trên ổ đĩa, verifies **AC-8**
- Failure case: gửi tệp `.png` thật ra là văn bản, tệp quá lớn, và request không có tệp, lần lượt nhận 400 `IMAGE_INVALID`, 413, 400 `IMAGE_INVALID`, verifies **AC-8**
- Failure case: khóa tài khoản chủ trọ rồi xóa mềm một nhà trọ, tin tương ứng biến khỏi danh sách công khai và chi tiết trả 404, verifies **AC-10**, **AC-11**
- Failure case: xóa nhà trọ còn tin bị 409 `PROPERTY_HAS_LISTINGS`; xóa phường còn nhà trọ dùng bị 409 `CATALOG_IN_USE`, verifies **AC-2**, **AC-4**
- Failure case: từ khóa `%`, `_` hoặc `\` không khớp mọi tin (chỉ khớp ký tự đó thật sự có trong tin); `minPrice` lớn hơn `maxPrice` bị 400; từ khóa `tan dinh` tìm được tin của phường Tân Định và đổi tên phường làm từ khóa mới tìm ra tin, verifies **AC-2**, **AC-10**
- Failure case: mở chi tiết ba lần liên tiếp bằng cùng một IP trong 30 phút chỉ cộng một lượt; chính chủ đăng nhập mở thì không cộng; tin ẩn thì không cộng, verifies **AC-13**
- Auth/permission: khách và token hết hạn thấy `phone: null` nhưng vẫn nhận 200; người đã đăng nhập thấy số, verifies **AC-12**
- Auth/permission: chủ trọ A sửa, xóa, hiện, ẩn, tải ảnh vào tin hay nhà trọ của B nhận 403 `NOT_RESOURCE_OWNER`; tenant tạo nhà trọ nhận 403 `PERMISSION_DENIED`; admin dùng `listing:update` trên tin người khác nhận 403 `NOT_RESOURCE_OWNER`, verifies **AC-3**, **AC-5**, **AC-7**
- Auth/permission: chủ trọ và tenant gọi `POST /wards` nhận 403; admin tạo được; tạo trùng mã nhận 409, verifies **AC-2**
- Auth/permission: vượt giới hạn tạo tin hoặc mở chi tiết nhận 429 `RATE_LIMITED` kèm `Retry-After`, verifies **AC-15**
- Failure case: `:id` không phải UUID nhận 400 `INVALID_ID`; `slugCode` đúng mã sai slug nhận 200 kèm `slug` đúng, mã lạ nhận 404 `LISTING_NOT_FOUND`, verifies **AC-11**
- Failure case: ảnh của tin bị admin ẩn hoặc đã xóa mềm nhận 404 ở `/media/public/:file`, hiện lại thì ảnh phục vụ lại, verifies **AC-8**, **AC-9**
- Failure case: hai khoản phí cùng `kind`, bảy khoản phí, chỉ một tọa độ, `reason` rỗng hoặc dài hơn 500, `pageSize` 51, `sort` sai đều nhận 400 `VALIDATION_FAILED` (không 500), verifies **AC-3**, **AC-9**, **AC-10**
- Auth/permission: người đã đăng nhập mở chi tiết tin quá 60 lần mỗi phút nhận 429 trong khi khách cùng IP vẫn mở được đến 300 lần, và phản hồi chi tiết có `Cache-Control: private, no-store`, verifies **AC-12**, **AC-15**
- Kiểm bằng `EXPLAIN` (không phải test tự động): truy vấn danh sách công khai dùng chỉ mục một phần và chỉ mục trigram ở quy mô vài nghìn tin, verifies **AC-10**

## Build plan

Hướng build theo Skateboard (bản mỏng nhất dùng được trước, rồi mở rộng): tới bước 5 đã có một đường đi trọn vẹn (chủ trọ đăng tin, khách thấy tin), các bước sau thêm dần.

Năm cột mốc, mỗi mốc một lần `/develop` rồi dừng cho bạn review (khớp ô `Build it` trong scope): **mốc 1** = bước 1 và 2 (đã build, 2026-10-14); **mốc 2** = bước 3; **mốc 3** = bước 4 đến 7; **mốc 4** = bước 8; **mốc 5** = bước 9 đến 12. Mỗi mốc có đổi API thì cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong mốc đó (quy tắc tài liệu sống), không dồn về bước 12; gắn `@RateLimited` ngay khi tạo route.

1. Thêm `schema.prisma` và một migration cho toàn bộ mô hình ở trên (bảng, `CHECK`, chỉ mục một phần, chỉ mục GIN), thêm mã lỗi mới vào `ErrorCode`, hàm `toSearchKey`, `toSlug`, nhận ra loại ảnh, kèm test đơn vị, satisfies **AC-1**, **AC-5**, **AC-8**, **AC-10** (đã build ở mốc 1, thêm hàm `toFullAddress` ở mốc 2)
2. Dựng `prisma/seed-data/wards.json` từ bộ thanglequoc (đếm 168 dòng của tỉnh `79`, đối chiếu `provinces.open-api.vn`; lệch thì dừng hỏi bạn), danh sách tiện ích mẫu, seed chỉ thêm dòng thiếu, và `GET /wards`, `GET /amenities`, satisfies **AC-1** (đã build ở mốc 1)
3. Module nhà trọ: tạo, xem, sửa (thay danh sách phí và tiện ích, làm mới `search_key`), xóa mềm có chặn khi còn tin, kiểm chủ sở hữu, trả `fullAddress` bằng `toFullAddress`, satisfies **AC-3**, **AC-4**, **AC-7**, **AC-16** (đã build ở mốc 2, 2026-10-16; phần AC-7 về nhà trọ làm mới `search_key` đã có, phần sửa và xóa mềm tin thuộc bước 7)
4. Module tin: đăng tin (sinh `code`, `search_key`, trạng thái `visible`), `visibleListingsQuery`, danh sách và chi tiết công khai (lọc, sắp xếp, phân trang, `slug`), `GET /me/listings` và `/me/listings/:id`, mọi phản hồi có địa chỉ đều kèm `fullAddress`, satisfies **AC-5**, **AC-10**, **AC-11**, **AC-14**, **AC-16** (đã build ở mốc 3, 2026-10-16; `ListingsModule` tách module dữ liệu `ListingsDataModule` để tránh import vòng với `PropertiesModule`)
5. Kiểm `EXPLAIN` cho danh sách công khai ở vài nghìn tin giả lập, chỉnh chỉ mục nếu cần, satisfies **AC-10** (đã kiểm ở mốc 3, 2026-10-16: 5 nghìn và 60 nghìn tin giả lập, câu lấy trang dưới 19 ms, chỉ mục một phần và chỉ mục trigram đều được dùng khi có lợi, không phải đổi chỉ mục)
6. `@OptionalAuth()`, ẩn số điện thoại với khách, lớp đếm lượt xem không trùng, cộng `view_count` nguyên tử, satisfies **AC-12**, **AC-13** (đã build ở mốc 3, 2026-10-16)
7. Sửa và xóa mềm tin, ẩn và hiện của chủ trọ với `updateMany` có điều kiện trạng thái, satisfies **AC-6**, **AC-7** (đã build ở mốc 3, 2026-10-16)
8. `StorageService` (ổ đĩa), biến `UPLOAD_DIR` và `MAX_UPLOAD_BYTES`, tải và xóa ảnh có khóa dòng tin, route phục vụ ảnh, satisfies **AC-8** (đã build ở mốc 4, 2026-10-19: `src/storage/` có lớp trừu tượng `StorageService` (`put`, `get`, `delete`) và `DiskStorageService`; khóa kiểm bằng `STORAGE_KEY_PATTERN` rồi đường dẫn đã giải quyết phải nằm trong `UPLOAD_DIR`, thư mục gốc giải quyết ở lần dùng đầu để bản cấu hình giả của test không bị chạm. `UPLOAD_DIR` (mặc định `uploads`) và `MAX_UPLOAD_BYTES` (mặc định 5242880, từ 1 đến 10485760) vào `Env`, `AppConfigService` và `.env.example`; `/uploads` vào `.gitignore`; `@types/multer` vào `devDependencies`. `ListingImagesRepository`, `ListingImagesService`, `ListingImagesController` (`POST` và `DELETE /listings/:id/images`) và `MediaController` (`GET /media/public/:file`) nằm trong `ListingsModule`, kèm `MulterModule.registerAsync` đọc dung lượng từ `AppConfigService`. Nhóm giới hạn `listingImage` (60 lần mỗi giờ theo người dùng) thêm ngay ở mốc này theo quy tắc "gắn `@RateLimited` ngay khi tạo route", nên cả năm nhóm của bước 11 đã có. Lựa chọn nhỏ của người build, đều giữ đúng AC: (1) dùng `AnyFilesInterceptor` rồi kiểm trong Service thay cho `FileInterceptor('file')`, để sai tên trường hay gửi nhiều tệp trả `IMAGE_INVALID` SAU kiểm chủ sở hữu đúng thứ tự "Tải ảnh, thứ tự kiểm lỗi"; riêng quá 5 tệp trong một request bị multer chặn sớm bằng 400 `BAD_REQUEST` chung. (2) Route phục vụ ảnh dùng `publicListingFrom` cộng `publicListingCondition` (luật của 0003 và 0004) vì `visibleListingsQuery` mà spec còn nhắc đã bị thay từ hàng 9; phần "Điều kiện hiển thị công khai" ở trên cần `/sync` hoặc `/architect` cập nhật. (3) `Cache-Control` và `nosniff` đặt bằng tay sau khi tìm thấy ảnh, không dùng `@Header`, vì decorator đó đặt cả trên lỗi 404 (đã gặp khi kiểm thật, trình duyệt sẽ nhớ 404 cả ngày). Kiểm thật: 86 kiểm tra HTTP và SQL với tệp ảnh thật, ba điều khiển âm, Newman 253 request và 479 assertion)
9. Kiểm duyệt: ẩn, gỡ ẩn kèm `moderation_logs`, danh sách cho admin, `moderationReason` ở tin của chủ trọ, satisfies **AC-9**, **AC-14**
10. API admin cho danh mục (tạo, sửa tên, xóa; làm mới `search_key` khi đổi tên phường), satisfies **AC-2**
11. Giới hạn tần suất cho bốn nhóm mới, satisfies **AC-15**
12. Test e2e trên Postgres thật cho các kịch bản trên, cập nhật `docs/api/postman-collection.json` và `docs/api/api-for-frontend.md` (quy tắc tài liệu sống của dự án), `.env.example`, README, satisfies **AC-1** đến **AC-16**

## Consequences

**Positive**:
- Một đường đi trọn vẹn từ chủ trọ đăng tin đến khách xem tin, đủ để demo ngay; hạn mức, gói và theo dõi chủ trọ (hàng 9 đến 12) bám vào đúng hai chỗ: `visibleListingsQuery` và giao dịch đăng, hiện tin.
- Điều kiện hiển thị nằm ở một nơi và tính lúc đọc, nên khóa tài khoản hay xóa mềm có hiệu lực ngay, không cờ sao chép.
- Không thêm bảng hay thư viện cho lượt xem và nhận dạng ảnh; không dịch vụ ngoài nào.
- Link tin ổn định dù đổi tiêu đề, mã ngắn không đoán được số lượng tin.

**Negative / tradeoffs**:
- Đến khi làm hàng 9, mọi tin `visible` của chủ trọ đang hoạt động hiện công khai không giới hạn số lượng và thời gian: hàng 8 một mình chưa thu tiền được.
- Tin không tự hết hạn: phòng đã cho thuê mà chủ trọ quên ẩn thì tin cũ vẫn nằm đó.
- Chủ trọ không có đường kháng nghị trong hệ thống khi bị ẩn tin: sửa tin xong vẫn phải liên hệ admin ngoài hệ thống (báo cáo tin xấu và kháng nghị đã hoãn khỏi MVP).
- Đếm lượt xem trong bộ nhớ: mất khi khởi động lại, không chia sẻ giữa nhiều bản sao API, và nhiều người dùng chung một IP (ký túc xá, quán cà phê) tính chung thành một lượt mỗi 30 phút. Câu chữ "mỗi lần mở cộng một" của hàng 8 được thay bằng quy tắc này.
- Ảnh không nén, không đổi kích thước, giữ nguyên dữ liệu EXIF (có thể chứa tọa độ GPS và model máy); xử lý ảnh làm sau nếu cần.
- Ghi tệp và ghi DB không nguyên tử: lỗi giữa chừng có thể để lại tệp mồ côi (đã giảm bằng cách xóa tệp khi chèn lỗi); tin xóa mềm giữ ảnh nên ổ đĩa chỉ tăng.
- `search_key` có ba đường cập nhật; đổi tên một phường lớn phải lặp qua từng tin trong một giao dịch, chấp nhận ở quy mô demo.
- Seed chỉ thêm dòng thiếu nên phường hoặc tiện ích mẫu mà admin đã xóa sẽ quay lại ở lần khởi động sau.
- Giới hạn 300 lần mỗi phút theo IP cho route công khai có thể chạm với nhiều người cùng IP; phân trang kiểu `page` kèm `count` chậm dần khi tin lên hàng chục nghìn, chấp nhận ở quy mô demo.
- Khách không thấy số điện thoại nên FE phải gửi access token ở trang chi tiết (kể cả khi token vừa hết hạn thì FE làm mới trước).

**Neutral**:
- Ba chi tiết spec này từng lệch so với 0005 (seed chỉ thêm dòng thiếu, `search_key` thêm tên nhà trọ, cột `listings.code`) đã được đồng bộ ngày 2026-10-14, cùng `0003` AC-9 (seed làm ba việc), `0006` (image chép `prisma/seed-data`) và `index.md` của 0001.
- Đã quyết định chưa có `landlord_profiles`, tìm theo tọa độ, tiện ích mức phòng, đổi thứ tự ảnh; thêm sau bằng một migration nhỏ.
- Danh sách `/me/listings` và `/properties` phân trang cùng kiểu với danh sách công khai.

## Follow-up

- [x] Đồng bộ `0005-postgres-data-conventions.md` (seed chỉ thêm dòng thiếu, `search_key` gồm tên nhà trọ và ba đường cập nhật, cột `listings.code`, bỏ chỉ mục tọa độ, địa chỉ hai cấp, 5 ảnh), `0003` AC-9 (seed làm ba việc), `0006` (image chép `prisma/seed-data`) và `index.md` của 0001 (nguồn 168 phường đã chốt): xong ngày 2026-10-14.
- [x] Cập nhật dòng "Done when" của hàng 8 trong `docs/scope/scope.md` (lượt xem theo cửa sổ 30 phút, danh mục admin, danh sách kiểm duyệt, `fullAddress`): làm ngay khi bạn xác nhận spec.
- [ ] Hàng 9 thêm vế dùng thử và gói vào `visibleListingsQuery`, và kiểm hạn mức trong giao dịch đăng tin và hiện tin (khóa dòng `users` của chủ trọ, theo 0005); hàng 11 dùng `SUM(view_count)`; hàng 12 trỏ `favorites.listing_id` vào `listings.id`.
- [x] Số dòng phường của tỉnh mã `79` đã đếm ở mốc 1: đúng 168 và khớp từng mã với `provinces.open-api.vn` v2.
- [ ] Còn mở: đối chiếu thêm với bản chính thức của Quyết định 19/2025/QĐ-TTg (Phụ lục II), chưa kiểm được (mới có hai nguồn cộng đồng khớp nhau). Làm khi bạn có file hoặc đường dẫn bản chính thức; nếu số dòng lệch thì dựng lại `wards.json` từ nguồn đó và dừng hỏi bạn trước khi seed lên DB đã có dữ liệu.
- [x] Giới hạn tần suất ở bảng trên đã được bạn duyệt ngày 2026-10-14.
- [ ] Nếu sau này thêm `helmet`, route ảnh phải gửi `Cross-Origin-Resource-Policy: cross-origin`.
- [ ] Hoãn, thêm lại bằng `/scope` khi cần: tin tự hết hạn, kháng nghị khi bị ẩn tin, đổi thứ tự ảnh, nén ảnh và xóa EXIF, tiện ích mức phòng, tìm theo tọa độ, dọn tệp ảnh của tin đã xóa mềm.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
