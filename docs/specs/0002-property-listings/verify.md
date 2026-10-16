# Verify: nhà trọ, tin đăng và xem tin · spec 0002 · cập nhật 2026-10-16
_Các bước suy ra từ acceptance criteria của spec 0002. `/check verify` chạy lại các bước này; `/test` khóa những bước bền thành test. Mỗi cột mốc build thêm một mục bên dưới._

Chuẩn bị một lần cho mọi mốc: `.env` có đủ biến (xem `verify.md` của spec 0001), DB đã áp migration (`npm run migration:deploy`) và đã seed (`npm run seed`), rồi `npm run start:dev`. Mọi đường dẫn nằm dưới `/api/v1`.

---

## Mốc 1: nền dữ liệu và danh mục phường, xã, tiện ích (AC-1)
_Địa chỉ theo đơn vị hành chính hai cấp sau sáp nhập (tỉnh hoặc thành phố, rồi phường, xã hoặc đặc khu), không có quận huyện. Nguồn dữ liệu và cách kiểm nằm ở `prisma/seed-data/README.md`._

### UI / manual
- [ ] `npm run seed` trên DB mới → in "Phường, xã: thêm 168 dòng mới" và "Tiện ích: thêm 13 dòng mới"; chạy lại lần hai → "thêm 0 dòng mới" cho cả hai → AC-1
- [ ] `GET /wards` không đăng nhập → 200, đúng 168 phần tử, mỗi phần tử chỉ có `code`, `name`, `provinceCode`, `provinceName`; mọi `provinceCode` là `79` và `provinceName` là `Thành phố Hồ Chí Minh` → AC-1
- [ ] trong `GET /wards`: `name` kèm loại đơn vị (113 `Phường`, 54 `Xã`, 1 `Đặc khu Côn Đảo`), không tên nào chứa chữ quận hay huyện, có `Phường Thủ Dầu Một` (Bình Dương cũ) và `Phường Vũng Tàu` (Bà Rịa Vũng Tàu cũ) → AC-1
- [ ] `GET /wards` xếp theo thứ tự chữ cái tiếng Việt (`Đặc khu Côn Đảo` đứng trước `Phường An Đông`; các `Xã` ở cuối); tiếng Việt có dấu hiển thị nguyên vẹn → AC-1
- [ ] `GET /amenities` không đăng nhập → 200, 13 phần tử `{ key, name }` (Ban công, Bếp, Camera an ninh... Wifi), mỗi `key` đúng dạng `^[a-z][a-z0-9_]{1,29}$` → AC-1
- [ ] trong DB đổi tên một phường (ví dụ mã `25747`) và xóa tiện ích `balcony`, rồi chạy lại seed → tên phường đã sửa **không bị ghi đè**; `balcony` quay lại (hệ quả đã chấp nhận ở spec) → AC-1
- [ ] `POST /wards` chưa có API ghi ở mốc này (404 hoặc 401), phần admin thuộc mốc 5 → AC-2

### Commands
- [ ] `npm test` → toàn bộ qua, gồm `seed-data.spec.ts` (168 dòng, cơ cấu 113, 54, 1, không quận huyện, bộ nạp từ chối dữ liệu hỏng), `to-search-key.spec.ts`, `to-slug.spec.ts`, `detect-image-type.spec.ts`, `catalog.service.spec.ts` → AC-1
- [ ] `npx tsc --noEmit` và `npx eslint "src/**/*.ts"` → sạch
- [ ] `DATABASE_NAME=<db> npx prisma migrate deploy` trên DB trống, rồi `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected" (cả chỉ mục GIN lẫn phần viết tay không bị báo lệch) → AC-1
- [ ] truy vấn DB: có đủ 7 bảng `wards`, `amenities`, `properties`, `property_fees`, `property_amenities`, `listings`, `listing_images`; 13 ràng buộc `CHECK`; chỉ mục `listings_search_key_gin` (GIN), `listings_visible_created_at_idx` và `listings_visible_price_idx` (một phần, có `WHERE status = 'visible' AND deleted_at IS NULL`); khóa ngoại `properties_ward_code`, `properties_landlord_id`, `listings_property_id`, `property_amenities_amenity_key` là RESTRICT, còn `property_fees`, `property_amenities`, `listing_images` theo cha là CASCADE → hạ tầng cho AC-3 đến AC-10
- [ ] DB chặn dữ liệu sai: chèn tiện ích khóa `Wifi Free`, tin có `status` lạ, ảnh `position = 5` → lỗi `23514` (vi phạm `CHECK`) → hạ tầng cho AC-6, AC-8
- [ ] `newman run docs/api/postman-collection.json` các folder 00, 01, 03, 04, 05, 06, 07 → không lỗi (folder 07 là danh mục phường và tiện ích)

### Acceptance-criteria coverage
- spec 0002: AC-1 `GET /wards`, `GET /amenities` công khai, seed 168 phường và 13 tiện ích chỉ thêm dòng thiếu. Mốc này cũng dựng sẵn hạ tầng (bảng, `CHECK`, chỉ mục, mã lỗi, hàm tiện ích) cho AC-3 đến AC-14.

### Value sourcing
- [ ] danh sách phường lấy từ `prisma/seed-data/wards.json` (bản `v5.2.0` của thanglequoc, tỉnh mã 79); test `seed-data.spec.ts` canh 168 dòng và cơ cấu; không trộn mã phường trước sáp nhập (mã không đủ 5 chữ số bị bộ nạp từ chối) → AC-1
- [ ] `name` của phường lấy nguyên tên đầy đủ trong nguồn, chuẩn hóa NFC; `provinceName` lấy từ tên tỉnh của nguồn → AC-1
- [ ] thứ tự danh sách do Service sắp bằng `Intl.Collator('vi')`, không do collation của DB: đổi collation DB không làm đổi thứ tự → AC-1
- [ ] danh sách tiện ích mẫu lấy từ `prisma/seed-data/amenities.json` (13 khóa theo spec 0002) → AC-1

---

## Mốc 2: nhà trọ của chủ trọ (AC-3, AC-4, AC-16)
_Tạo, xem danh sách và chi tiết, sửa, xóa mềm nhà trọ, kèm phí, tiện ích và `fullAddress`. Chưa có API đăng tin (mốc 3), nên các bước cần tin phải chèn tay vào bảng `listings` bằng SQL (cần `code` 8 ký tự duy nhất, `title`, `description`, `price`, `area_m2`, `search_key`). Đã chạy thật ngày 2026-10-16 trên DB thử bằng script: 93 kiểm tra qua._

### UI / manual
- [ ] đăng ký hai chủ trọ A và B, một người tìm trọ T; A gọi `POST /properties` đủ thân (tên, `addressText` "12 Lê Lợi", `wardCode` 26743, `latitude` 10.7721, `longitude` 106.6983, ba khoản phí `water`, `electricity`, `parking`, ba tiện ích `wifi`, `loft`, `balcony`) → 201; `fullAddress` đúng "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh"; `fees` xếp `electricity, water, parking`; `amenities` xếp theo tên tiếng Việt (Ban công, Gác lửng, Wifi); không có `landlordId` hay `deletedAt` → AC-3, AC-16
- [ ] T gọi `POST /properties` và `GET /properties` → 403 `PERMISSION_DENIED`; không token → 401 `TOKEN_MISSING` → AC-3
- [ ] `POST /properties` với phường `00000` → 400 `WARD_UNKNOWN`; tiện ích `ho_boi` → 400 `AMENITY_UNKNOWN` (thông báo nêu khóa); hai khoản phí cùng `kind`, bảy khoản phí, chỉ `latitude` không `longitude`, thân có `landlordId`, tên một ký tự → 400 `VALIDATION_FAILED` (không 500); sau các lần lỗi DB không có thêm dòng `properties`, `property_fees` nào → AC-3
- [ ] A tạo thêm hai nhà trọ rồi `GET /properties` → `{ items, total, page, pageSize }`, mới tạo xếp trước, `listingCount` 0; `?page=2&pageSize=2` còn 1 dòng, `total` 3; `?page=9` → `items` rỗng, `total` 3; `pageSize=51` và `page=0` → 400; B gọi → `total` 0 → AC-3
- [ ] `GET /properties/:id`: A → 200 giống kết quả tạo; B → 403 `NOT_RESOURCE_OWNER`; id không có → 404 `PROPERTY_NOT_FOUND`; `khong-phai-uuid` → 400 `INVALID_ID` → AC-3
- [ ] `PATCH /properties/:id` bằng `{}` → 200, dữ liệu giữ nguyên, `updatedAt` đổi; B sửa → 403; T sửa → 403 `PERMISSION_DENIED`; `name: null` → 400; chỉ `latitude: null` → 400; phường lạ hoặc tiện ích lạ → 400 và tên không bị lưu → AC-3
- [ ] `PATCH` với `fees` (một khoản), `amenityKeys` (`wifi`), `latitude` và `longitude` đều `null` → 200; phí và tiện ích bị **thay cả danh sách** (DB còn đúng 1 dòng phí), tọa độ về `null`; `fees: []` và `amenityKeys: []` xóa hết → AC-3
- [ ] chèn tay hai tin sống, một tin đã xóa mềm (`deleted_at` có giá trị) vào nhà trọ của A và một tin vào nhà trọ khác; `PATCH` đổi `name` → `search_key` của hai tin sống dựng lại thành `toSearchKey(title, tên mới, địa chỉ, tên phường)`, tin đã xóa mềm và tin của nhà trọ khác **không đổi**; đổi `addressText` và `wardCode` → khóa theo địa chỉ và phường mới, `fullAddress` trả về theo phường mới; chỉ đổi phí → khóa không đổi → AC-7 (phần nhà trọ), AC-16
- [ ] trong DB đổi `wards.name` của phường mà nhà trọ đang dùng → `GET /properties/:id` trả `fullAddress` với tên mới ngay (ghép lúc đọc, không lưu cột); đổi lại sau khi thử → AC-16
- [ ] `GET /properties`: `listingCount` của nhà trọ có 2 tin sống và 1 tin xóa mềm là 2 → AC-3
- [ ] `DELETE /properties/:id`: B → 403; A khi còn tin sống → 409 `PROPERTY_HAS_LISTINGS` và `deleted_at` vẫn rỗng; đặt `deleted_at` cho các tin rồi A xóa → 204, dòng vẫn còn trong DB với `deleted_at`; sau đó `GET` và `PATCH` → 404 `PROPERTY_NOT_FOUND`, `DELETE` lần hai → 404, danh sách không còn nhà trọ đó → AC-4
- [ ] một chủ trọ mới ghi liên tục (`PATCH {}`) quá 30 lần trong một giờ → 429 `RATE_LIMITED` kèm `Retry-After` từ 1; `GET /properties` của người đó vẫn 200 → AC-15 (phần ghi nhà trọ)

### Commands
- [ ] `npm test` → toàn bộ qua (334 test ở thời điểm build), gồm `properties.service.spec.ts`, `property-dtos.spec.ts`, `properties.mapper.spec.ts`, `pagination.spec.ts`, `to-full-address.spec.ts`, `rate-limits.spec.ts` và `route-declarations.spec.ts` (mọi route của `PropertiesController` khai báo quyền) → AC-3, AC-4, AC-16
- [ ] `npx tsc --noEmit` và `npx eslint "src/**/*.ts"` → sạch
- [ ] `newman run docs/api/postman-collection.json --folder "07 Danh mục phường, xã và tiện ích" --folder "08 Nhà trọ của chủ trọ"` trên API đã seed → 24 request, 51 assertion, không lỗi
- [ ] đua nhau: mở một kết nối riêng, `BEGIN; SELECT 1 FROM properties WHERE id = '<id>' FOR UPDATE;`, gọi `DELETE /properties/<id>` (phải **chờ**, chưa trả lời), trong kết nối riêng chèn một tin vào nhà trọ đó rồi `COMMIT` → `DELETE` trả 409 `PROPERTY_HAS_LISTINGS` (không lọt tin đăng cùng lúc); làm lại với `ROLLBACK` không chèn gì → `DELETE` trả 204 → AC-4
- [ ] hai `PATCH` đổi tên song song vào cùng một nhà trọ có tin → cả hai 200 và `search_key` của tin khớp tên cuối cùng trong DB → AC-7 (phần nhà trọ)
- [ ] chạy API với `node --trace-deprecation dist/main.js` rồi tạo và sửa nhà trọ → không có cảnh báo `client.query() when the client is already executing a query` (cảnh báo này xuất hiện nếu đọc nhiều quan hệ hoặc `create` lồng nhau trong giao dịch đang mở) → hạ tầng

### Acceptance-criteria coverage
- spec 0002: AC-3 tạo, xem danh sách và chi tiết, sửa nhà trọ (kiểm chủ sở hữu, phường và tiện ích phải có trong danh mục, phí tối đa 6) · AC-4 xóa mềm có chặn khi còn tin · AC-16 `fullAddress` ở nhà trọ (danh sách và chi tiết; tin công khai và kiểm duyệt thuộc mốc sau) · AC-7 chỉ phần nhà trọ làm mới `search_key` · AC-15 chỉ phần ghi nhà trọ (`propertyWrite`, 30 lần mỗi giờ). Chưa làm: AC-2, AC-5 đến AC-14, và các phần còn lại của AC-15, AC-16.

### Value sourcing
- [ ] `landlord_id` của nhà trọ mới là `sub` trong access token, không nhận từ body (gửi `landlordId` bị 400; DB có đúng id người tạo) → AC-3
- [ ] `ward_code` lấy từ body và được kiểm tồn tại trong `wards` trước khi ghi (mã lạ → `WARD_UNKNOWN`, không dòng nào được lưu) → AC-3
- [ ] `fullAddress` = `[addressText, ward.name, ward.provinceName].join(', ')` ghép lúc đọc bằng `toFullAddress`; đổi tên phường làm đổi kết quả mà không cần ghi lại nhà trọ → AC-16
- [ ] `listingCount` = số tin của nhà trọ có `deleted_at IS NULL`, mọi trạng thái (thử với tin `hidden_by_owner` và tin xóa mềm) → AC-3
- [ ] `search_key` của tin = `toSearchKey(title, name, addressText, ward.name)` với tên, địa chỉ, phường **sau** khi sửa; ba trường hợp đổi (tên, địa chỉ, phường) đều ra khóa mới → AC-7
- [ ] thứ tự `fees[]` do mapper sắp theo `electricity, water, internet, parking, service, other` và `amenities[]` theo `Intl.Collator('vi')`, không do thứ tự DB trả về → AC-3
