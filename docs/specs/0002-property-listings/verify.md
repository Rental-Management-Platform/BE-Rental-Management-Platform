# Verify: nhà trọ, tin đăng và xem tin · spec 0002 · cập nhật 2026-10-14
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
