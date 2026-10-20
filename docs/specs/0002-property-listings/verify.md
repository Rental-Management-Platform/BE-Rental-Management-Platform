# Verify: nhà trọ, tin đăng và xem tin · spec 0002 · cập nhật 2026-10-20 (thêm mốc 5)
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

---

## Mốc 3: tin đăng, đọc công khai, tin của chủ trọ, ẩn và hiện (AC-5, AC-6, AC-7, AC-10 đến AC-14, AC-16)
_Chủ trọ đăng tin vào nhà trọ của mình (hiện ngay, không nháp, không duyệt), sửa, ẩn, hiện, xóa mềm; khách xem danh sách và chi tiết; người đăng nhập thấy số điện thoại; lượt xem tính theo người xem trong 30 phút. Chưa có ảnh (mốc 4) và admin ẩn tin (mốc 5), nên `coverImageUrl` là `null`, `images` rỗng, và các bước cần tin bị admin ẩn phải đặt tay `status = 'hidden_by_admin'` và chèn dòng `moderation_logs` (`target_type = 'listing'`, `action = 'hide_listing'`) bằng SQL. Đã chạy thật ngày 2026-10-16 trên DB thử bằng script: 198 kiểm tra qua; Newman folder 07, 08, 09: 53 request, 109 assertion._

### UI / manual
- [ ] đăng ký hai chủ trọ A và B, một người tìm trọ T; A tạo nhà trọ (phường Bến Thành, `addressText` "12 Lê Lợi") rồi `POST /properties/:propertyId/listings` đủ thân (tiêu đề "Phòng đẹp có gác gần chợ Bến Thành", mô tả, giá 3500000, 22.5 m², cọc 3500000, `availableFrom` 2026-11-01) → 201; `status` `visible`, `viewCount` 0, `moderationReason` null, `code` 8 ký tự thuộc bảng chữ bỏ i, l, o, 0, 1, không có `landlord`, `images` rỗng, `coverImageUrl` null, `slug` `phong-dep-co-gac-gan-cho-ben-thanh`, `availableFrom` "2026-11-01", `fullAddress` "12 Lê Lợi, Phường Bến Thành, Thành phố Hồ Chí Minh" → AC-5, AC-16
- [ ] DB sau khi đăng: `status` `visible`, `view_count` 0, `search_key` "phong dep co gac gan cho ben thanh nha tro hoa hong 12 le loi phuong ben thanh", `available_from` đúng ngày → AC-5
- [ ] đăng tin: B vào nhà trọ của A → 403 `NOT_RESOURCE_OWNER`; T → 403 `PERMISSION_DENIED`; không token → 401; id nhà trọ không có → 404 `PROPERTY_NOT_FOUND`; id sai dạng → 400 `INVALID_ID`; giá 99999, tiêu đề 4 ký tự, diện tích 22.55, ngày `2026-02-30`, thân có `status`, `code`, `viewCount` hoặc `propertyId` → 400 `VALIDATION_FAILED`; sau các lần lỗi không có thêm dòng `listings` → AC-5
- [ ] `GET /listings` không token → 200 `{ items, total, page, pageSize }`, mới nhất trước; mỗi dòng đúng 14 trường (`addressText, areaM2, availableFrom, code, coverImageUrl, createdAt, deposit, fullAddress, id, landlord, price, slug, title, ward`), `landlord` chỉ `id` và `name`, `ward` chỉ `code` và `name`; không số điện thoại của ai (cả khi gửi token) → AC-10, AC-16
- [ ] lọc `q`: "tan dinh" và "Tân Định" cho cùng kết quả (khớp tên phường trong `search_key`), "GAC" không phân biệt hoa thường, nhiều từ nối AND, tên nhà trọ tìm được, quá 6 từ thì chỉ lấy 6 từ đầu, rỗng thì bỏ lọc, quá 500 ký tự → 400; `q=%` chỉ khớp tin có dấu `%` thật, `q=_` chỉ khớp tin có dấu `_` thật, `q=\` không khớp tin nào, `q=ph_ng` không khớp "phong" → AC-10
- [ ] lọc `wardCode` (đúng phường), mã đúng dạng nhưng không có trong danh mục → 200 rỗng, mã sai dạng → 400; `minPrice`, `maxPrice`, khoảng giá, hai giá bằng nhau → 200, `minPrice` lớn hơn `maxPrice` → 400 `VALIDATION_FAILED` → AC-10
- [ ] `sort`: `newest` (mới trước), `price_asc` và `price_desc` (cùng giá thì `id` tăng và giảm), `sort` lạ → 400; `pageSize` 51 và `page` 0 → 400; trang 2 cỡ 4 còn đúng phần dư, trang quá cuối `items` rỗng và `total` giữ nguyên; tham số lạ → 400 → AC-10
- [ ] điều kiện hiển thị tính lúc đọc: chủ trọ ẩn thì tin biến khỏi danh sách, hiện lại thì có; đặt tay `hidden_by_admin` thì biến; khóa tài khoản chủ trọ (`users.status = 'locked'`) thì mọi tin của họ biến ngay, mở khóa thì hiện lại; xóa mềm tài khoản chủ trọ, nhà trọ hoặc tin thì biến → AC-10
- [ ] `GET /listings/<slug>-<code>` → 200 với `description`, `viewCount`, `images`, `property` (tọa độ, `fees` theo thứ tự cố định, `amenities` theo tên, `fullAddress`), `landlord { id, name, phone }`; header `Cache-Control: private, no-store`; không lộ `searchKey`, `deletedAt`, `landlordId`, `propertyId`, `status` → AC-11
- [ ] chi tiết: chỉ `<code>` vẫn 200; slug sai nhưng đúng mã → 200 kèm `slug` đúng; mã lạ, không lấy được mã, mã viết hoa → 404 `LISTING_NOT_FOUND` (không 400); tin đã ẩn → 404 kể cả khi chính chủ gửi token → AC-11
- [ ] số điện thoại: khách → `phone` null và số không xuất hiện ở bất cứ chỗ nào của phản hồi; T đăng nhập → thấy số; token hết hạn, token rác, token ký sai bí mật → vẫn 200 và `phone` null (không 401) → AC-12
- [ ] lượt xem: tin mới 0; khách (một IP) mở 3 lần → DB cộng đúng 1 và phản hồi trả 1; T mở → cộng thêm 1 (người xem khác), mở lại không cộng; chính chủ A mở nhiều lần (đăng nhập) → không cộng; tin đang ẩn → 404 và không cộng → AC-13
- [ ] `GET /me/listings` (A): thấy tin của A ở mọi trạng thái, mới trước, không thấy tin của B và tin xóa mềm; dòng có `status`, `moderationReason`, `viewCount`, không có `landlord`, không có `description`; T → 403; không token → 401; `?status=hidden_by_owner` và `?status=visible` lọc đúng; `status=bogus` → 400; phân trang đúng → AC-14
- [ ] `moderationReason`: đặt tay `hidden_by_admin` và chèn ba dòng `moderation_logs` (hide cũ, unhide, hide mới nhất) → `/me/listings/:id` và danh sách trả lý do của dòng `hide_listing` MỚI NHẤT; đổi `status` về `hidden_by_owner` → lý do biến mất; `GET /me/listings/:id`: B xem tin của A → 403, id không có → 404, id sai dạng → 400, tin đã xóa mềm → 404 → AC-14
- [ ] `POST /listings/:id/hide` rồi `/show`: 200 và đổi trạng thái; ẩn tin đã ẩn và hiện tin đã hiện → 409 `LISTING_STATE_INVALID`; tin `hidden_by_admin`: hiện → 403 `LISTING_HIDDEN_BY_ADMIN`, ẩn → 409 `LISTING_STATE_INVALID`, và trạng thái trong DB không đổi; A ẩn tin của B → 403 `NOT_RESOURCE_OWNER`; T → 403 `PERMISSION_DENIED`; id không có → 404; id sai dạng → 400 → AC-6
- [ ] admin thắng khi đua: mở một kết nối riêng `BEGIN; UPDATE listings SET status = 'hidden_by_admin' WHERE id = '<id>';` (tin đang `hidden_by_owner`), gọi `POST /listings/<id>/show` (phải **chờ**, chưa trả lời), rồi `COMMIT` → `show` trả 403 `LISTING_HIDDEN_BY_ADMIN` và `status` cuối là `hidden_by_admin`; làm lại với `POST .../hide` khi tin `visible` → 409 và vẫn `hidden_by_admin` → AC-6
- [ ] `PATCH /listings/:id`: `{}` → 200; đổi `title` → `slug` đổi, `code` giữ, `search_key` dựng lại theo tiêu đề mới (tìm theo tiêu đề mới thấy, tiêu đề cũ không), link cũ `<slug cũ>-<code>` vẫn mở được và trả `slug` mới; sửa giá, diện tích, mô tả; `deposit: null` và `availableFrom: null` xóa giá trị; gửi `propertyId`, `status`, `code`, `title: null`, `price: null`, giá 5, ngày "mai" → 400; B sửa → 403; T sửa → 403; sửa được tin đang `hidden_by_admin` → AC-7
- [ ] đổi tên và địa chỉ nhà trọ (`PATCH /properties/:id`) → `search_key` của tin dựng lại, tìm theo tên nhà trọ mới thấy tin, `fullAddress` của tin theo địa chỉ mới; đổi `wards.name` trong DB → `fullAddress` ở danh sách và chi tiết đổi theo ngay (ghép lúc đọc); đổi lại sau khi thử → AC-7, AC-16
- [ ] `DELETE /listings/:id`: A xóa tin của B → 403; T → 403; B xóa tin của mình (mọi trạng thái, kể cả `hidden_by_admin`) → 204, dòng còn trong DB với `deleted_at`; sau đó công khai 404, `/me/listings/:id` 404, danh sách không thấy; xóa lần hai, sửa, hiện tin đã xóa → 404; `listingCount` của nhà trọ giảm theo; xóa nhà trọ còn tin → 409 `PROPERTY_HAS_LISTINGS`, hết tin → 204 → AC-4, AC-7
- [ ] đua đăng tin với xóa nhà trọ: chạy song song `POST .../listings` và `DELETE /properties/:id` nhiều vòng → mỗi vòng hoặc (đăng 201, xóa 409) hoặc (đăng 404, xóa 204), không bao giờ có tin sống dưới nhà trọ đã xóa mềm; giữ `SELECT ... FOR UPDATE` dòng nhà trọ, gọi đăng tin (phải chờ), đặt `deleted_at` cho nhà trọ rồi `COMMIT` → đăng tin trả 404 `PROPERTY_NOT_FOUND`; đổi tên nhà trọ song song với đăng tin → `search_key` của tin mới khớp tên cuối → AC-4, AC-5, AC-7
- [ ] giới hạn tần suất: một chủ trọ mới `PATCH /listings/:id` liên tục → lần thứ 61 trong một giờ nhận 429 `RATE_LIMITED` kèm `Retry-After`, `GET /me/listings` vẫn 200; người đăng nhập mở chi tiết lần thứ 61 trong một phút → 429, khách cùng IP vẫn mở được (bộ đếm `user` bỏ qua khách); khách mở chi tiết và `GET /listings` quanh 300 lần mỗi phút theo IP → 429 kèm `Retry-After` (mỗi route đếm riêng) → AC-15

### Commands
- [ ] `npm test` → toàn bộ qua (534 test ở thời điểm build), gồm `listings.service.spec.ts`, `listings.mapper.spec.ts`, `listing-dtos.spec.ts`, `listing-code.spec.ts`, `view-deduplicator.spec.ts`, `search-words.spec.ts`, `escape-like.spec.ts`, `jwt-auth.guard.spec.ts`, `rate-limit.options.spec.ts`, `rate-limits.spec.ts` và `route-declarations.spec.ts` (mọi route mới khai báo đúng một kiểu truy cập, `@OptionalAuth()` tính là công khai) → AC-5 đến AC-14
- [ ] `npx tsc --noEmit` và `npx eslint "src/**/*.ts"` → sạch
- [ ] `newman run docs/api/postman-collection.json --folder "07 Danh mục phường, xã và tiện ích" --folder "08 Nhà trọ của chủ trọ" --folder "09 Tin đăng của chủ trọ và xem tin công khai"` trên API đã seed → 53 request, 109 assertion, không lỗi (folder 09 dùng lại token của folder 08 nên chạy ngay sau nó)
- [ ] trùng mã ngắn: gọi `ListingsRepository.create` với `code` đã có → ném `ListingCodeTakenError` (Prisma `P2002` qua adapter `pg` được nhận ra) và không để lại dòng nào; Service sinh mã mới và thử lại bằng giao dịch mới, hết 5 lần thì 500 `INTERNAL_ERROR` (test đơn vị) → AC-5
- [ ] cộng lượt xem nguyên tử: gọi 50 lần `incrementViewCount` song song → `view_count` tăng đúng 50, mỗi lần trả một giá trị khác nhau; tin không còn `visible` thì trả `null` → AC-13
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` câu lấy trang của danh sách công khai với 5 nghìn và 60 nghìn tin giả lập (10 tình huống: không lọc, `price_asc`, `price_desc`, từ khóa 2 và 3 ký tự, nhiều từ, tên phường, phường, khoảng giá, kết hợp) → câu lấy trang dưới 19 ms ở 60 nghìn tin; sắp xếp dùng chỉ mục một phần `listings_visible_created_at_idx` hoặc `listings_visible_price_idx`; từ khóa chọn lọc (ví dụ tên phường) dùng chỉ mục trigram `listings_search_key_gin`; không phải đổi chỉ mục. Câu `COUNT` chậm dần (khoảng 20 ms ở 60 nghìn tin), đã chấp nhận ở spec → AC-10
- [ ] chạy API bằng `node --trace-deprecation dist/main.js` rồi đăng tin → không có cảnh báo `client.query() when the client is already executing a query` (giao dịch đăng và sửa tin chỉ ghi và đọc từng bước; tin đầy đủ được đọc lại sau khi giao dịch xong) → hạ tầng

### Acceptance-criteria coverage
- spec 0002: AC-5 đăng tin (hiện ngay, `code` duy nhất, 403 nhà trọ người khác) · AC-6 ẩn và hiện của chủ trọ (cả hai hướng, `LISTING_HIDDEN_BY_ADMIN`, `LISTING_STATE_INVALID`, admin thắng khi đua) · AC-7 sửa và xóa mềm tin, cộng làm mới `search_key` khi đổi tiêu đề (phần nhà trọ đã có từ mốc 2) · AC-10 danh sách công khai (lọc, sắp xếp, phân trang, điều kiện hiển thị) · AC-11 chi tiết công khai · AC-12 số điện thoại theo đăng nhập tùy chọn · AC-13 lượt xem · AC-14 `GET /me/listings` và `/me/listings/:id` kèm `moderationReason` · AC-15 phần `listingWrite`, `publicRead`, `publicDetail` · AC-16 `fullAddress` ở tin tóm tắt, chi tiết và tin của chủ trọ. Chưa làm: AC-2, AC-8, AC-9 và phần còn lại của AC-15 (tải ảnh), AC-16 (danh sách kiểm duyệt).

### Value sourcing
- [ ] `code` do `crypto.randomInt` sinh từ bảng 31 ký tự, không nhận từ client; trùng thì thử lại tối đa 5 lần bằng giao dịch mới → AC-5
- [ ] `status` luôn `visible` lúc đăng (Service không truyền, cột mặc định), `view_count` luôn 0 → AC-5
- [ ] `search_key` = `toSearchKey(tiêu đề, tên nhà trọ, địa chỉ, tên phường)` với giá trị mới nhất của nhà trọ (đọc sau khi khóa dòng nhà trọ); ba đường cập nhật duy nhất: đăng hoặc sửa tiêu đề tin, sửa tên, địa chỉ hay phường của nhà trọ (mốc 2), đổi tên phường (mốc 5) → AC-5, AC-7
- [ ] chủ tin = `properties.landlord_id` (không có cột trên `listings`); người sửa, xóa, ẩn, hiện được kiểm bằng `assertOwner` với `sub` trong token → AC-6, AC-7
- [ ] `slug` = `toSlug(title)` tính lúc đọc, không lưu; tra bằng phần mã ở cuối `slugCode` khớp `^[a-z0-9]{8}$` → AC-11
- [ ] `landlord.phone` = `users.phone` chỉ khi `req.user` có (đọc đăng nhập tùy chọn), không thì `null`; số rỗng cũng `null` → AC-12
- [ ] người xem = `req.user.userId` nếu có, không thì `req.ip`; chủ tin = `properties.landlord_id` → AC-13
- [ ] `viewCount` = giá trị sau `UPDATE ... SET view_count = view_count + 1 ... RETURNING` nếu vừa tính lượt, không thì giá trị đã đọc → AC-13
- [ ] `fullAddress` = `toFullAddress(addressText, ward)` ghép lúc đọc từ nhà trọ của tin; tên phường lấy từ `wards` tại thời điểm đọc → AC-16
- [ ] `coverImageUrl` là ảnh có `position` nhỏ nhất của tin, dạng `/api/v1/media/<storage_key>`; chưa có ảnh thì `null` → AC-10
- [ ] `moderationReason` = `reason` của dòng `moderation_logs` mới nhất có `target_type = 'listing'`, `target_id` là tin và `action = 'hide_listing'`, chỉ khi `status = 'hidden_by_admin'` → AC-14
- [ ] `total` = `count` cùng điều kiện hiển thị và cùng bộ lọc; thứ tự `newest` là `created_at DESC, id DESC`, hai kiểu giá có khóa phụ chỉ là `id` → AC-10
- [ ] từ khóa: `toSearchKey(q)`, cắt 6 từ đầu, mỗi từ cắt 50 ký tự, thoát `\`, `%`, `_` bằng `escapeLike` rồi `contains` nối AND → AC-10

## Mốc 4: ảnh tin (AC-8 và phần tải ảnh của AC-15)

Chuẩn bị: database thử đã `migration:deploy` và `seed`; API chạy với `UPLOAD_DIR` trỏ một thư mục thử và `MAX_UPLOAD_BYTES=1048576` (để thử 413 bằng tệp 1,5 MB). Chủ trọ L1 (đã mua gói 50 tin để đăng nhiều tin), chủ trọ khác O, người tìm trọ T, admin. Phần Postman là folder `15 Ảnh tin` (chạy với `--working-dir docs/api`); phần đồng thời, quá dung lượng, lỗi DB giả và hạ hạn mức do script thử.

### UI / manual

**Tải lên và phục vụ ảnh (AC-8)**
- [ ] L1 tải PNG thật nhưng khai tên `../../phong.php` và `Content-Type: text/html` → 201 `{ id, position: 0, url }` (đúng ba trường), `url` dạng `/api/v1/media/public/<uuid>.png`, tên gốc không lọt vào khóa → AC-8
- [ ] Tải JPEG rồi WebP → vị trí 1 và 2, đuôi `.jpg` và `.webp`; ổ đĩa có đúng 3 tệp mới → AC-8
- [ ] `GET url` không token → 200, đúng từng byte, `Content-Type` đúng loại, `Cache-Control: public, max-age=86400`, `X-Content-Type-Options: nosniff`, `Content-Length` đúng → AC-8
- [ ] `GET /listings?q=...` có `coverImageUrl` là ảnh vị trí 0; `GET /listings/:slugCode` có `images[]` đủ ba ảnh theo `position`; `GET /me/listings/:id` có `images[]` → AC-8, AC-10, AC-11, AC-14

**Xóa ảnh**
- [ ] Xóa ảnh vị trí 1 → 204, tệp biến khỏi ổ đĩa, `GET url` 404; tải ảnh mới nhận lại vị trí 1; xóa ảnh bìa (vị trí 0) thì ảnh có vị trí nhỏ nhất còn lại thành `coverImageUrl`; xóa lại ảnh đã xóa → 404 `NOT_FOUND` → AC-8

**Giới hạn 5 ảnh**
- [ ] Năm ảnh đầu 201; ảnh thứ sáu → 409 `LISTING_IMAGE_LIMIT`, ổ đĩa chỉ tăng 5 tệp, DB có vị trí 0 đến 4; xóa ảnh vị trí 2 rồi tải lại → nhận vị trí 2 → AC-8

**Tệp sai và thứ tự báo lỗi**
- [ ] Văn bản đặt tên `.png` với `Content-Type: image/png`, GIF, tệp rỗng, sai tên trường (`photo`), hai tệp, form chỉ có trường chữ, thân JSON, không có thân → mỗi ca 400 `IMAGE_INVALID`; không tệp nào còn trên ổ đĩa, không dòng ảnh nào được tạo; sau đó ảnh hợp lệ vẫn tải được → AC-8
- [ ] Ảnh 1,5 MB khi `MAX_UPLOAD_BYTES` là 1 MiB → 413 `PAYLOAD_TOO_LARGE`; sáu tệp một lần → 400 `BAD_REQUEST` chung (multer chặn sớm, đã ghi ở hướng dẫn FE mục 6.28) → AC-8
- [ ] Chủ trọ khác gửi tệp văn bản → 403 `NOT_RESOURCE_OWNER` (đến trước 400); chủ trọ khác gửi ảnh 1,5 MB → 413 (multer chạy trước kiểm chủ, đúng thứ tự spec); tin không có → 404 `LISTING_NOT_FOUND`; `:id` không phải UUID → 400 `INVALID_ID`; T → 403 `PERMISSION_DENIED`; chưa đăng nhập → 401; admin tải vào tin người khác → 403 `NOT_RESOURCE_OWNER` → AC-8
- [ ] Xóa ảnh: chủ trọ khác → 403 `NOT_RESOURCE_OWNER`; ảnh của tin khác dù chủ tin đúng → 404 `NOT_FOUND`; `imageId` không phải UUID → 400 `INVALID_ID`; T → 403 `PERMISSION_DENIED`; ảnh còn nguyên sau mọi lần bị từ chối → AC-8

**Chỉ phục vụ ảnh của tin đang hiện công khai**
- [ ] Chủ trọ ẩn tin → ảnh 404 `NOT_FOUND`, lỗi 404 không mang `Cache-Control: public`; hiện lại → 200 → AC-8
- [ ] Đặt `hidden_by_admin` bằng SQL → ảnh 404, nhưng vẫn tải được ảnh vào tin đó (201, đúng spec "mọi trạng thái"); gỡ → 200 → AC-8, AC-9
- [ ] Khóa tài khoản chủ trọ → ảnh 404; mở khóa → 200 → AC-8, AC-10
- [ ] Chủ trọ hết dùng thử, chưa có gói → ảnh 404; mua gói → 200 ngay; dời kỳ gói về quá khứ khi dùng thử đã hết → 404; trả lại `trial_ends_at` → 200 → AC-8 (cùng luật hiển thị của 0003 và 0004)
- [ ] Nhà trọ xóa mềm → 404; xóa mềm tin → 404 nhưng dòng ảnh và tệp còn nguyên → AC-8
- [ ] Admin hạ `trial_listing_limit` xuống 1: ảnh của tin đăng sớm nhất 200, ảnh của tin sau 404; đặt lại 2 → 200 → AC-8

**Route phục vụ ảnh không lộ gì ngoài ảnh đã tải**
- [ ] Khóa đúng dạng nhưng không có trong DB, đuôi `.exe`, chữ hoa, `%2e%2e%2f%2e%2e%2f.env`, `..%5C..%5C.env`, `/media/public/`, `/media/private/<tệp>`, thiếu đuôi → mọi ca 404; mọi tên tệp trên ổ đĩa đúng `<uuid>.<jpg|png|webp>`, không có thư mục con → AC-8

**Đồng thời và lỗi giữa chừng**
- [ ] 8 vòng, mỗi vòng tin có 4 ảnh (chèn bằng SQL) và hai lần tải đồng thời → mỗi vòng đúng một 201 và một 409 `LISTING_IMAGE_LIMIT`, số tệp mới bằng số lần 201 (người thua không để lại tệp), DB có đúng vị trí 0 đến 4 → AC-8
- [ ] Gắn trigger làm mọi `INSERT` vào `listing_images` ném lỗi: tải ảnh → 500 `INTERNAL_ERROR` không lộ chi tiết, tệp đã ghi bị xóa (ổ đĩa không tăng); gỡ trigger thì tải lại được → AC-8

**Giới hạn tần suất (phần tải ảnh của AC-15)**
- [ ] 61 lần `POST /listings/:id/images` không kèm tệp: 60 lần đầu 400 `IMAGE_INVALID`, lần 61 → 429 `RATE_LIMITED` kèm `Retry-After` lớn hơn 0; route khác của cùng người không bị chặn cùng; `/media/public` không bị giới hạn → AC-15

### Commands
- [ ] `npm test` → 906 bài qua; `npx tsc --noEmit` và `npx eslint src` sạch → AC-8, AC-15
- [ ] Mốc 4 không có migration mới (bảng `listing_images` đã có từ mốc 1) → AC-8
- [ ] Newman các folder 00 đến 05 và 07 đến 15 từ trên xuống, `--working-dir docs/api`, `MAX_UPLOAD_BYTES` để mặc định → 253 request, 479 assertion, chỉ hai assertion đã biết của folder 02 hỏng (cần token từ email) → AC-8

### Điều khiển âm (đã làm khi build, 2026-10-19)
- Bỏ `FOR UPDATE` của `lockListing` trong `dist`: cả 8 vòng đồng thời đều ra một 201 cộng một 500 `INTERNAL_ERROR` (ràng buộc `UNIQUE (listing_id, position)` vẫn chặn vị trí trùng nhưng thành 500 thay vì 409). Khôi phục thì 8 trên 8 vòng đúng.
- Bỏ lệnh xóa tệp khi lỗi trong `dist`: sau lỗi chèn giả còn một tệp mồ côi. Khôi phục thì ổ đĩa không tăng.
- Bỏ kiểm hiển thị của route ảnh trong `dist`: 8 kiểm tra hỏng (tin ẩn, chủ trọ bị khóa, hết dùng thử, gói hết, nhà trọ xóa mềm, tin xóa mềm, luật hạng).
- Lỗi thật bắt được nhờ bước kiểm này: decorator `@Header` đặt `Cache-Control: public, max-age=86400` cả trên lỗi 404, nên trình duyệt sẽ nhớ "404" cả ngày dù tin được hiện lại. Đã sửa bằng cách đặt header sau khi tìm thấy ảnh; kiểm lại qua.

### Acceptance-criteria coverage
- AC-8: mọi nhóm bước ở trên. AC-15: phần tải ảnh (60 lần mỗi giờ theo người dùng) có bước ở mốc này; phần còn lại của AC-15 thuộc mốc 5.

### Value sourcing
- [ ] `position` = vị trí trống nhỏ nhất từ 0 đến 4, tính trong giao dịch đã khóa dòng tin bằng `SELECT ... FOR UPDATE` → AC-8
- [ ] `storage_key` = `public/<uuid v4>.<jpg|png|webp>` do Service sinh; đuôi lấy từ loại ảnh nhận ra bằng nội dung, không từ tên tệp hay `Content-Type` → AC-8
- [ ] Dung lượng tối đa mỗi ảnh = `MAX_UPLOAD_BYTES` (mặc định 5242880, tối đa 10485760); thư mục lưu = `UPLOAD_DIR` (mặc định `uploads`) → AC-8
- [ ] `Content-Type` khi phục vụ suy từ đuôi của `:file`; tin của ảnh tra bằng `storage_key` → AC-8
- [ ] Ảnh được phục vụ khi và chỉ khi tin của nó thỏa `publicListingFrom` cộng `publicListingCondition`, với `now` do controller lấy một lần mỗi request và hạn mức dùng thử đọc từ `settings` → AC-8

### Chưa kiểm được ở mốc 4
- Hai lần xóa đồng thời cùng một ảnh; tiến trình chết đúng giữa lúc ghi tệp và commit (để lại tệp mồ côi, spec đã chấp nhận); `UPLOAD_DIR` không ghi được do quyền; `Cross-Origin-Resource-Policy` khi thêm `helmet` (chưa có `helmet`); Docker Compose với `/data/uploads` (thuộc spec 0006, chưa có `compose.yaml`).
- Chưa có kiểm cuối do `/check verify` chạy trên bản độc lập; các bước ở trên do người build chạy.

---

## Mốc 5: kiểm duyệt của admin, danh mục admin, tài liệu và kiểm cuối (AC-2, AC-9, AC-15 và rà lại AC-1 đến AC-16)

Chạy trên một database thử (ví dụ `rental_management_verify`), không chạy trên database đang dùng. Cần admin do `npm run seed` tạo; đăng nhập bằng `ADMIN_SEED_*`. Mốc này không có migration mới.

### UI / manual

**Kiểm duyệt tin: quyền và đầu vào (AC-9)**
- [ ] Chủ trọ và người tìm trọ gọi `GET /moderation/listings`, `POST /moderation/listings/:id/hide`, `POST /moderation/listings/:id/unhide` → 403 `PERMISSION_DENIED`; không token → 401 `TOKEN_MISSING`; tin không đổi → AC-9
- [ ] `hide` thiếu `reason`, `reason` rỗng, toàn khoảng trắng, 501 ký tự, thêm trường lạ `status` → 400 `VALIDATION_FAILED` (`errors[].field` đúng), tin không đổi trạng thái, không có dòng `moderation_logs` mới → AC-9
- [ ] `:id` là `abc` → 400 `INVALID_ID`; id đúng dạng nhưng không có tin → 404 `LISTING_NOT_FOUND`; tin đã xóa mềm → 404 → AC-9
- [ ] Khóa tài khoản admin trong DB khi token còn hạn rồi `hide` → 403 `ACCOUNT_LOCKED` (`@FreshAuth`); `GET /moderation/listings` không có `@FreshAuth` nên theo quyền trong token → AC-9

**Ẩn và gỡ ẩn (AC-9)**
- [ ] Admin `hide` tin `visible` với lý do có khoảng trắng đầu cuối → 200, `status` là `hidden_by_admin`, `moderationReason` đã cắt khoảng trắng, `landlord` chỉ có `id` và `name`, không có `isPublic`, `fullAddress` hai cấp. DB có đúng một dòng `moderation_logs` (`target_type = listing`, `action = hide_listing`, `actor_id` là admin, đúng lý do) → AC-9
- [ ] `hide` lần hai → 409 `LISTING_STATE_INVALID`, không thêm dòng lịch sử → AC-9
- [ ] Tin bị ẩn: `GET /listings/:slugCode` → 404, biến khỏi `GET /listings`, ảnh ở `/media/public` → 404 → AC-9
- [ ] Chủ trọ: `GET /me/listings/:id` và `GET /me/listings` thấy `hidden_by_admin` kèm `moderationReason`; `show` → 403 `LISTING_HIDDEN_BY_ADMIN`; `hide` của chủ trọ → 409; `PATCH` sửa tin vẫn 200 → AC-9, AC-14
- [ ] `unhide` thiếu lý do → 400; `unhide` tin đang `visible` hoặc `hidden_by_owner` → 409 → AC-9
- [ ] `unhide` đúng → 200, `status` là `hidden_by_owner`, `moderationReason` là `null`, một dòng `unhide_listing`; tin CHƯA hiện công khai; chủ trọ `show` → 200 `visible` và tin hiện lại → AC-9
- [ ] Admin `hide` tin đang `hidden_by_owner` → 200 `hidden_by_admin` → AC-9
- [ ] Ẩn, gỡ ẩn, rồi ẩn lại với lý do khác: chủ trọ thấy lý do MỚI NHẤT → AC-9

**Danh sách kiểm duyệt (AC-9)**
- [ ] `GET /moderation/listings?pageSize=50` → 200 `{ items, total, page, pageSize }`, mới nhất trước, thấy cả `visible`, `hidden_by_owner`, `hidden_by_admin` và tin của chủ trọ đã hết dùng thử; không có tin đã xóa mềm → AC-9
- [ ] Lọc `status`, `landlordId`, `q` (không dấu, không phân biệt hoa thường; khớp tiêu đề, tên nhà trọ, tên phường). `q=%` và `q=_` chỉ ra tin có ký tự đó thật; `q=\` không lỗi 500 và ra rỗng; `q` toàn khoảng trắng thì bỏ lọc → AC-9
- [ ] `status=deleted`, `landlordId=abc`, `pageSize=51` → 400 `VALIDATION_FAILED` → AC-9
- [ ] Mỗi dòng đúng 17 trường của Mục kiểm duyệt; `moderationReason` chỉ có giá trị ở tin `hidden_by_admin` → AC-9, AC-16

**Danh mục admin (AC-2)**
- [ ] Chủ trọ và người tìm trọ: `POST`, `PATCH`, `DELETE` trên `/wards` và `/amenities` → 403; không token → 401 → AC-2
- [ ] `POST /wards`: mã 4 chữ số, mã có chữ, mã tỉnh 3 chữ số, thiếu tên, trường lạ `districtName` → 400 `VALIDATION_FAILED`; hợp lệ → 201 đúng 4 trường; trùng mã (kể cả mã do seed tạo) → 409 `CATALOG_CODE_TAKEN`; `GET /wards` công khai thấy ngay → AC-2
- [ ] `PATCH /wards/:code`: tên rỗng hoặc gửi `code` → 400; phường không có hoặc mã rác → 404 `NOT_FOUND`; thân rỗng → 200 không đổi gì → AC-2
- [ ] Đổi tên phường (trước đó "tên cũ" khớp một tin có tiêu đề không chứa tên phường): ngay sau `PATCH`, tìm theo tên mới ra tin (ở `GET /listings` và `GET /moderation/listings`), tìm theo tên cũ không còn ra tin đó; `fullAddress` của nhà trọ và tin đổi theo; chỉ đổi `provinceName` thì `search_key` không đổi → AC-2, AC-16
- [ ] `DELETE /wards/:code`: phường còn nhà trọ dùng → 409 `CATALOG_IN_USE`; phường chỉ còn nhà trọ đã xóa mềm dùng → 409; phường chưa ai dùng → 204 và biến khỏi `GET /wards`; xóa lại → 404; tạo nhà trọ chọn phường vừa xóa → 400 `WARD_UNKNOWN` → AC-2
- [ ] Tiện ích: khóa chữ hoa, bắt đầu bằng số, 31 ký tự, thiếu tên → 400; tạo → 201 đúng 2 trường; trùng khóa (kể cả `wifi`) → 409; `PATCH` đổi tên → 200, `PATCH` thiếu tên hoặc gửi `key` → 400, không có → 404; `DELETE` còn nhà trọ dùng (kể cả đã xóa mềm) → 409 `CATALOG_IN_USE`, chưa ai dùng → 204, xóa lại → 404; nhà trọ chọn khóa vừa xóa → 400 `AMENITY_UNKNOWN` → AC-2

**Đua nhau (AC-9)**
- [ ] 20 vòng: tin `hidden_by_owner`, đồng thời admin `hide` và chủ trọ gọi `show`, `hide`, `show` → mọi vòng kết thúc ở `hidden_by_admin` và lệnh của admin trả 200 → AC-6, AC-9
- [ ] 10 vòng: hai lệnh `hide` của admin cùng lúc trên một tin `visible` → một 200 và một 409; DB có đúng một dòng `hide_listing` cho tin đó → AC-9

**Giới hạn tần suất (AC-15)**
- [ ] Khởi động lại API (bộ đếm về 0). `PATCH /properties/:id` lần 31 → 429 `RATE_LIMITED` kèm `Retry-After` là số nguyên dương; `PATCH /listings/:id` lần 61; `POST /listings/:id/images` lần 61; `GET /listings/:slugCode` của người đăng nhập lần 61 (khách cùng IP vẫn mở được); `GET /listings` lần 301 → AC-15
- [ ] 120 lần `GET /moderation/listings` liên tiếp không bị 429 (API admin không giới hạn thêm) → AC-15

### Commands
- [ ] `npm test` → 53 suite, 987 bài qua; `npx tsc --noEmit` và `npx eslint "src/**/*.ts" "test/**/*.ts"` (không `--fix`) sạch → mọi AC
- [ ] `git diff -- prisma` rỗng: mốc 5 không đổi `schema.prisma` và không có migration mới → AC-2, AC-9
- [ ] Newman các folder 00, 01, 03, 04, 05 và 07 đến 17 từ trên xuống trên DB thử sạch, `--working-dir docs/api` → 329 request, 645 assertion, 0 lỗi; chạy lần hai trên cùng DB cũng 0 lỗi (folder 17 tự dọn: phường và tiện ích thử bị xóa, tên phường thật được trả về) → AC-2, AC-9
- [ ] Log API trong lúc chạy Newman: không dòng `ERROR`, không phản hồi 5xx, không cảnh báo `pg` về truy vấn song song trên một kết nối → AC-2, AC-9

### Điều khiển âm (đã làm khi build, 2026-10-20)
- Bỏ điều kiện trạng thái nguồn khỏi câu `updateMany` của `transition` trong `dist`: admin chỉ thắng 1 trong 20 vòng đua, và hai lệnh `hide` cùng lúc cho 2 dòng lịch sử thay vì 1. Build lại từ mã nguồn thì 20/20 và 10/10.
- Cho Service ghi lịch sử bất kể câu lệnh có đổi dòng nào không (`if (changed)` thành `if (true)` trong `dist`): hai lệnh `hide` cùng lúc luôn cho 2 dòng lịch sử, 0/10 vòng đạt. Build lại thì 10/10.
- Lỗi của chính phép kiểm bắt được khi viết: tiêu đề tin mẫu có sẵn chữ "Bến Thành" nên vẫn khớp từ khóa tên phường cũ qua tiêu đề. Phép kiểm đổi tên phường giờ dùng tin có tiêu đề không chứa tên phường và có điều khiển dương (trước khi đổi tên thì khớp); folder 17 của Postman dựng theo cách đó.

### Acceptance-criteria coverage
- AC-2: các bước danh mục admin, đổi tên phường làm mới `search_key`, quyền. AC-9: các bước ẩn, gỡ ẩn, danh sách kiểm duyệt, đua và điều khiển âm. AC-15: bước giới hạn tần suất gọi thật cho cả năm nhóm (các nhóm đã được thêm ở mốc 3 và 4, mốc 5 không thêm nhóm nào). Rà lại cả spec: AC-1 đến AC-16 đều có bước ở mốc 1 đến 5.

### Value sourcing
- [ ] `actor_id` và `reason` của ẩn, gỡ ẩn = `sub` của token (đọc lại DB do `@FreshAuth`) và `reason` trong body đã cắt khoảng trắng → đăng nhập hai admin khác nhau, mỗi người ẩn một tin, `actor_id` đúng từng người → AC-9
- [ ] `moderationReason` = `reason` của dòng `moderation_logs` mới nhất có `target_type = listing`, `action = hide_listing`, chỉ khi `status` là `hidden_by_admin` → ẩn, gỡ ẩn, ẩn lại với lý do khác: chủ trọ thấy lý do mới nhất; sau gỡ ẩn là `null` → AC-9
- [ ] Trạng thái nguồn của lệnh ẩn (`visible` hoặc `hidden_by_owner`) và của lệnh gỡ ẩn (`hidden_by_admin`) nằm trong chính câu `updateMany`, không đọc ra trước → AC-9
- [ ] `landlord { id, name }` của Mục kiểm duyệt = `properties.landlord_id` và `users.name` (rỗng thì `null`); không có số điện thoại → AC-9
- [ ] "Còn nhà trọ dùng" = khóa ngoại RESTRICT của DB (`properties.ward_code`, `property_amenities.amenity_key`), tính cả nhà trọ đã xóa mềm vì dòng vẫn còn → AC-2
- [ ] Tin cần làm mới `search_key` khi đổi tên phường = mọi tin chưa xóa của nhà trọ có `ward_code` đó; khóa mới = `toSearchKey(tiêu đề, tên nhà trọ, địa chỉ, tên phường mới)` → AC-2
- [ ] Mã lỗi suy từ Prisma: trùng khóa chính (`P2002`) = `CATALOG_CODE_TAKEN`; dòng không có (`P2025`) = `NOT_FOUND`; vi phạm khóa ngoại khi xóa (`P2003`) = `CATALOG_IN_USE` → AC-2

### Chưa kiểm được ở mốc 5
- Khóa tài khoản admin khi token còn hạn rồi `hide` (`@FreshAuth` ra 403 `ACCOUNT_LOCKED`) và hai admin khác nhau ẩn (cột `actor_id`): chưa chạy ở mốc này vì DB thử chỉ có một admin. Cơ chế `@FreshAuth` có bước kiểm riêng ở `verify.md` của hàng 9 (spec 0003, mốc 1).
- Đổi tên phường đúng lúc có tin đang được đăng (tin mới có thể mang `search_key` theo tên cũ); spec đã chấp nhận.
- Đổi tên phường có hàng nghìn tin (lặp từng tin trong một giao dịch): chưa đo.
- Chưa có bộ test e2e tự động bằng Jest (xem ghi chú ở bước 12 của Build plan); chưa có kiểm cuối do `/check verify` chạy trên bản độc lập, các bước ở trên do người build chạy.
