# Verify: giới hạn tọa độ nhà trọ · spec 0012 · updated 2026-11-05
_Steps derived from spec 0012 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Cả hai mốc đã xong: mốc 1 (khung thành phố, lớp 1) ở các mục đầu, mốc 2 (hộp phường, lớp 2) ở các mục có chữ "mốc 2" từ giữa file trở xuống. Chạy trên một database thử (đã dùng `rental_management_verify`), không chạy trên database đang dùng: dọn schema, rồi `npx prisma migrate deploy` và `node dist/database/seed.js` (sau `npm run build`), đặt `PORT` riêng, khởi động lại server trước mỗi lần chạy (bộ đếm giới hạn tần suất nằm trong bộ nhớ; đăng ký tối đa 10 lần mỗi giờ theo IP, ghi nhà trọ tối đa 30 lần mỗi giờ cho mỗi API theo người). Trong mọi bước "không ghi gì" nghĩa là: không dòng `properties`, `property_fees`, `property_amenities` mới, và dòng nhà trọ đang sửa y như trước (kể cả `updated_at`).

## Commands
- [ ] `npx tsc --noEmit` và `npx eslint "{src,apps,libs,test}/**/*.ts"` → sạch → AC-1, AC-3, AC-4, AC-5, AC-8
- [ ] `npm test` → toàn bộ qua, gồm `coordinate-area.spec.ts`, hai khối khung thành phố trong `properties.service.spec.ts`, `error-code.spec.ts`, `demo-data.spec.ts` (bài "mọi tọa độ của nhà trọ demo nằm trong khung thành phố") → AC-1, AC-3, AC-4, AC-5 (a, c), AC-8
- [ ] `git status --short prisma/` → rỗng: mốc 1 không migration, không bảng, không cột mới → Migration plan (chỉ đúng với mốc 1; mốc 2 thêm migration `20261103090000_ward_bounds`, xem "Mốc 2: lệnh")
- [ ] Newman với mọi folder trừ 02, 06, 23, 24 của `docs/api/postman-collection.json` và `--working-dir docs/api`, trên database trống mới seed, hai lượt liền (khởi động lại server giữa hai lượt), rồi folder 23 riêng → không request hay assertion nào lỗi → AC-1, AC-8, AC-9

## UI / manual (gọi API, Postman folder `08 Nhà trọ của chủ trọ`)

AC-1, tạo nhà trọ (`POST /properties`, chủ trọ còn dùng thử):
- [ ] Gửi từng điểm ngoài khung: Hà Nội (21.0285, 105.8542), (0, 0), giữa biển (9.5, 106.5), ngoài khơi (10.5, 108.5), vĩ độ Côn Đảo ghép kinh độ đất liền (8.6, 107.2), vĩ độ đất liền ghép kinh độ Côn Đảo (10.5, 106.0), sát ngoài biên (10.199999, 106.7), kèm một phí và một tiện ích → mỗi ca 400 `COORDINATE_OUT_OF_AREA`, `message` "Tọa độ nằm ngoài khu vực Thành phố Hồ Chí Minh.", `errors` đúng hai dòng `latitude` và `longitude` cùng mã đó, không ghi gì → AC-1
- [ ] Gửi điểm trong khung: Bến Thành, Vũng Tàu, Củ Chi, Côn Đảo, bốn góc (10.2, 106.2), (11.7, 107.7), (8.4, 105.9), (8.9, 106.9) → mỗi ca 201, phản hồi và dòng database có đúng tọa độ đã gửi → AC-1

AC-4, không có tọa độ:
- [ ] Không gửi tọa độ, hoặc gửi `null` cả hai → 201, `latitude` và `longitude` là `null` → AC-4

AC-3, thứ tự lỗi khi sai nhiều thứ cùng lúc (điểm sai luôn là Hà Nội):
- [ ] `wardCode` lạ → 400 `WARD_UNKNOWN`; tiện ích lạ → 400 `AMENITY_UNKNOWN`; cả hai lạ → `WARD_UNKNOWN` → AC-3
- [ ] Chỉ gửi `latitude` → 400 `VALIDATION_FAILED`; `latitude` 91 hoặc `longitude` 181 → 400 `VALIDATION_FAILED` (không phải `COORDINATE_OUT_OF_AREA`; luật miền ±90 và ±180 cùng luật đi cặp giữ nguyên) → AC-3, AC-8
- [ ] Người tìm trọ → 403 `PERMISSION_DENIED`; không đăng nhập → 401 → AC-3

AC-1 và AC-5 (a), sửa nhà trọ (`PATCH /properties/:id`):
- [ ] Nhà trọ có sẵn một khoản phí, một tiện ích, một tọa độ; PATCH đổi tên, địa chỉ, thay phí, thay tiện ích kèm từng điểm ngoài khung ở trên → mỗi ca 400 `COORDINATE_OUT_OF_AREA`, `errors` đúng `latitude` và `longitude`, dòng, phí, tiện ích y như trước kể cả `updated_at` → AC-1, AC-5 (a)
- [ ] PATCH sang Côn Đảo (8.6934, 106.6086) → 200 và trả tọa độ mới; PATCH đúng biên (10.2, 106.2) → 200; PATCH sát ngoài biên (10.199999, 106.2) → 400 → AC-1, AC-5 (a)

AC-4 và AC-5 (c), không gửi tọa độ, xóa tọa độ:
- [ ] PATCH chỉ `name` → 200, tọa độ giữ nguyên; PATCH `latitude` và `longitude` đều `null` → 200, tọa độ thành `null` → AC-4, AC-5 (c)

AC-3, thứ tự lỗi khi sửa:
- [ ] Chủ trọ khác kèm điểm Hà Nội → 403 `NOT_RESOURCE_OWNER`; id nhà trọ không có kèm điểm Hà Nội → 404 `PROPERTY_NOT_FOUND`; `wardCode` lạ kèm điểm Hà Nội → `WARD_UNKNOWN`; tiện ích lạ kèm điểm Hà Nội → `AMENITY_UNKNOWN`; chỉ một tọa độ → `VALIDATION_FAILED`; người tìm trọ → 403 `PERMISSION_DENIED` → AC-3

AC-4, AC-5 (c), AC-8, nhà trọ cũ giữ tọa độ ngoài vùng (chèn bằng SQL: `UPDATE properties SET latitude = 21.0285, longitude = 105.8542 WHERE id = ...`):
- [ ] `GET /properties/:id` và `GET /properties` trả tọa độ cũ nguyên xi → AC-8
- [ ] PATCH đổi tên, địa chỉ, phí, tiện ích; PATCH thân rỗng; PATCH chỉ gửi đúng `wardCode` hiện tại → mỗi ca 200 và tọa độ cũ không bị đụng (mốc 1 chưa kiểm tọa độ đang lưu khi đổi phường; việc đó là mốc 2) → AC-5 (c), AC-8
- [ ] PATCH tọa độ mới ngoài vùng (0, 0) → 400, tọa độ cũ giữ nguyên → AC-1
- [ ] PATCH `null` cả hai → 200, xóa được dù đang giữ tọa độ ngoài vùng; chèn lại tọa độ cũ rồi PATCH tọa độ hợp lệ (10.7721, 106.698) → 200, sửa lại được → AC-4

AC-8, dữ liệu demo:
- [ ] `npm run seed:demo` (trên database thử) chạy hai lần liền không lỗi; bài unit "mọi tọa độ của nhà trọ demo nằm trong khung thành phố" qua → AC-8

AC-9, tài liệu (mốc 1):
- [ ] `docs/api/api-for-frontend.md` có hai khung (bảng ở mục 6.17), mã lỗi `COORDINATE_OUT_OF_AREA` ở bảng mã lỗi, kiểu `ErrorCode` và Phụ lục C, thứ tự lỗi, lời nói rõ FE tự ghim tọa độ và backend không geocode, và mục nhật ký 2026-11-05; phần lề 500 m, quy tắc đổi phường, `COORDINATE_FAR_FROM_WARD` và `bounds` chờ mốc 2 → AC-9
- [ ] Postman folder 08 có sáu request mới (Hà Nội, phường lạ kèm Hà Nội, đặt Côn Đảo, sửa giữa biển, đọc lại sau lỗi, xóa lại tọa độ) và không đăng nhập admin thêm lần nào → AC-9

Điều khiển âm:
- [ ] Sửa tệp biên dịch `dist/properties/properties.service.js` (sao lưu trước, trả lại sau) để `requireCoordinateAllowed` luôn cho qua, khởi động lại server, chạy lại cả bộ kiểm trên → các ca ngoài khung phải hỏng (201 thay vì 400, thêm dòng nhà trọ, phí, tiện ích); trả lại rồi chạy lại phải qua hết → AC-1

Mỗi dòng của bảng nguồn giá trị (spec, "Value sourcing"), phần của mốc 1:
- [ ] Tọa độ cần kiểm lấy từ `dto.latitude` và `dto.longitude` (đã qua `IsCoordinate`): cặp số thì kiểm, `null` hay vắng thì không kiểm, chỉ một tọa độ thì dừng ở `VALIDATION_FAILED` trước khi tới Service (xem các bước AC-3 ở trên) → AC-1, AC-4
- [ ] Hai khung thành phố lấy từ hằng `CITY_BOXES`: thử bốn góc, bốn cạnh và ngay sát ngoài mỗi cạnh cho cả hai khung (bài unit `coordinate-area.spec.ts`) và qua HTTP (các bước AC-1 ở trên) → AC-1
- [ ] Test dữ liệu "mọi tọa độ demo qua luật" đọc từ `demo-data.ts` và `CITY_BOXES` → AC-8
- Các nguồn của mốc 2 (hộp phường, lề, tọa độ đang lưu khi đổi phường, `bounds` trong `GET /wards`, `ward-bounds.json`) không kiểm ở mốc 1; xem mục "Mốc 2: gọi API" bên dưới → AC-2, AC-5 (b, d), AC-6, AC-7

## Acceptance-criteria coverage
- AC-1 … mọi điểm ngoài và trong khung, bốn góc, sát ngoài biên, POST và PATCH, không ghi gì · AC-3 (phần mốc 1) … thứ tự lỗi POST và PATCH · AC-4 … không gửi, `null` cả hai, xóa tọa độ nhà trọ cũ · AC-5 (a, c) … sửa kèm tọa độ, sửa không đụng tọa độ · AC-8 … đọc tọa độ cũ, ba `CHECK` cũ không đổi, `seed:demo`, test dữ liệu demo · AC-9 (phần mốc 1) … tài liệu FE và Postman
- Phần còn lại (AC-2, AC-3 hai mã sau cùng của chuỗi, AC-5 b và d, AC-6, AC-7, phần còn lại của AC-8 và AC-9) do mốc 2 phủ: xem "Mốc 2: phủ tiêu chí" bên dưới

## Kết quả đã chạy 2026-11-05 (mốc 1)
- **105 kiểm tra HTTP và database** (script `verify-m1.js`) trên server cổng 3055 và database thử vừa dựng lại: các bước POST, PATCH, thứ tự lỗi và nhà trọ cũ ngoài vùng ở trên. 0 sai; log server không có lỗi 5xx.
- **Điều khiển âm đã bắt**: cho `requireCoordinateAllowed` luôn qua ở tệp biên dịch (sao lưu rồi trả lại) thì 51 trên 105 kiểm tra hỏng đúng chỗ (điểm ngoài khung nhận 201, thêm dòng nhà trọ, phí và tiện ích); trả lại thì 105 trên 105 qua.
- Unit: 1562 bài (79 bộ), `tsc` và `eslint` sạch, không file nào đổi trong `prisma/`. Newman folder 00, 01, 03, 04, 05, 07 đến 22 (bỏ 02 và 06): 589 request, 1254 assertion, 0 lỗi, hai lượt liền (khởi động lại server giữa hai lượt, cùng một database); folder 23: 38 request, 75 assertion, 0 lỗi. So với trước mốc: thêm 6 request và 13 assertion ở folder 08.
- `npm run seed:demo` trên database thử chạy hai lần liền, thoát 0.

## Ghi chú
- Script kiểm `verify-m1.js` nằm ở thư mục tạm của phiên (không có trong repo), dựng lại từ `lib.js`, `reset-db.js`, `server.js` của các lần kiểm trước. Một chủ trọ chỉ ghi nhà trọ được 30 lần mỗi giờ cho mỗi API, nên bộ kiểm chia ca cho nhiều chủ trọ.
- **Một bài unit cũ phải đổi cho đúng luật mới**: bài "chỉ đổi phí, tiện ích hay tọa độ thì không đụng khóa tìm kiếm" gửi điểm (10, 106), nay nằm ngoài khung thành phố nên bị từ chối. Đổi sang (10.5, 106.5); ý nghĩa của bài (không đụng `search_key`) không đổi.
- Quyết định nhỏ của build: ở mốc 1 `requireCoordinateAllowed` chỉ nhận điểm (chưa nhận phường và `origin`), vì hai tham số đó chỉ dùng ở mốc 2; mốc 2 mở rộng chữ ký, các chỗ gọi đổi theo.
- Việc cho `/sync` sau khi cả hai mốc xong: xem Follow-up của spec (rà `0002`, `0005`, README của `prisma/seed-data`).

## Mốc 2: lệnh
- [ ] `npx tsc --noEmit` và `npx eslint "{src,apps,libs,test}/**/*.ts"` → sạch → AC-2 đến AC-8
- [ ] `npm test` → toàn bộ qua, gồm `coordinate-area.spec.ts` (hộp nới, ba cỡ phường thật), `properties.service.spec.ts` (hai khối hộp phường khi tạo và khi sửa), `seed-data.spec.ts` (`ward-bounds.json` và bộ nạp), `seed-catalog.spec.ts`, `scripts/ward-bounds.spec.ts`, `catalog*.spec.ts` (`bounds`), `error-code.spec.ts`, `demo-data.spec.ts` (bài "trong hộp phường đã chọn nới 500 m") → AC-2, AC-3, AC-5, AC-6, AC-7, AC-8
- [ ] Trên database thử đã có 168 phường nạp theo cột cũ: `npx prisma migrate deploy` (migration `20261103090000_ward_bounds`) → không lỗi; bảng `wards` có bốn cột `double precision` cho phép rỗng và ràng buộc `wards_bounds_check`; cả 168 hộp còn rỗng → AC-6
- [ ] `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → thoát 0 (không lệch schema) → AC-6
- [ ] `node dist/database/seed.js` (sau `npm run build`) → báo "điền 168 phường còn rỗng"; chạy lần hai → "điền 0"; sửa tay một hộp rồi seed lại → hộp đó không bị ghi đè; đặt một phường về rỗng cả bốn cột rồi seed → "điền 1" → AC-6
- [ ] Cố ghi vào `wards` một hộp chỉ có một cột, min lớn hơn max (vĩ độ, kinh độ), vĩ độ ngoài ±90, kinh độ ngoài ±180 → cả năm ca bị `wards_bounds_check` từ chối; hộp hợp lệ và bốn cột cùng rỗng được nhận → AC-6
- [ ] `properties` vẫn đúng ba `CHECK` cũ (`properties_coordinates_pair_check`, `properties_latitude_check`, `properties_longitude_check`), không có `CHECK` mới → AC-8
- [ ] Newman như mốc 1 (mọi folder trừ 02, 06, 23, 24; hai lượt liền, khởi động lại server giữa hai lượt; rồi folder 23 riêng) → không request hay assertion nào lỗi → AC-2, AC-5, AC-7, AC-8, AC-9
- [ ] `npm run seed:demo` hai lần liền → thoát 0; mọi nhà trọ demo có tọa độ nằm trong hộp phường nới 500 m (so bằng SQL với bảng `wards`) → AC-8

## Mốc 2: gọi API (Postman folder `07`, `08`, `17`)

AC-7, hộp phường cho FE (`GET /wards`, `POST /wards`, `PATCH /wards/:code`):
- [ ] `GET /wards` → mỗi phần tử đúng năm khóa `code, name, provinceCode, provinceName, bounds`; 168 phường seed đều có `bounds` đúng từng số của `ward-bounds.json` (hộp thô, chưa cộng 0.0045); Bến Thành có `{10.76341, 10.77959, 106.68449, 106.70266}` → AC-7
- [ ] Admin `POST /wards` một phường mới → 201 `bounds: null`; `GET /wards` có phường đó với `bounds: null`; API không nhận hộp (trường lạ bị 400, hoặc không lưu) → AC-7
- [ ] Admin `PATCH /wards/26743` đổi `provinceName` → 200, `bounds` giữ nguyên; `PATCH` phường không hộp → `bounds` vẫn `null` → AC-7
- [ ] `GET /properties/:id` → `ward` chỉ có bốn khóa, không có `bounds`; tin công khai (`GET /listings`, `GET /listings/:slug-:code`) → `ward` chỉ có `code` và `name`, không có `bounds` → AC-7

AC-2 và AC-3, tạo nhà trọ (`POST /properties`):
- [ ] Giữa Bến Thành → 201. Vũng Tàu (10.346, 107.0843) với `wardCode` Bến Thành → 400 `COORDINATE_FAR_FROM_WARD`, `message` "Tọa độ quá xa phường hoặc xã đã chọn.", `errors` đúng hai dòng `latitude` và `longitude` cùng mã, câu lỗi nêu "Phường Bến Thành" và khác nhau giữa hai dòng, không ghi gì → AC-2
- [ ] Đúng mép nới ở bốn cạnh của Bến Thành (cạnh bắc: `maxLatitude + 0.0045`, tính đúng như code) → 201 và lưu nguyên số; lệch thêm một phần triệu độ ra ngoài mỗi cạnh → 400 `COORDINATE_FAR_FROM_WARD` → AC-2
- [ ] Điểm Bến Thành mà chọn Bình Tây → 400 nêu "Phường Bình Tây"; điểm Bình Tây chọn đúng Bình Tây → 201 → AC-2
- [ ] Ba cỡ phường: Bình Tây (27367, nhỏ nhất), An Thới Đông (27673, lớn nhất trên đất liền), Đặc khu Côn Đảo (26732): giữa hộp → 201; đúng mép nới phía bắc → 201; thêm một phần triệu độ → 400 → AC-2
- [ ] Phường admin vừa tạo (không hộp): Vũng Tàu → 201; Hà Nội → 400 `COORDINATE_OUT_OF_AREA` (chỉ còn lớp 1) → AC-2
- [ ] Hà Nội với phường có hộp → `COORDINATE_OUT_OF_AREA` (lớp 1 đứng trước lớp 2) → AC-3
- [ ] Thứ tự lỗi: mã phường lạ + điểm xa → `WARD_UNKNOWN`; tiện ích lạ + điểm xa → `AMENITY_UNKNOWN`; chỉ vĩ độ → `VALIDATION_FAILED`; vĩ độ 91 → `VALIDATION_FAILED`; người tìm trọ → 403 `PERMISSION_DENIED`; không đăng nhập → 401 → AC-3
- [ ] Không gửi tọa độ, hoặc `null` cả hai, ở phường bất kỳ (kể cả An Thới Đông) → 201, tọa độ `null` → AC-4

AC-5, sửa nhà trọ (`PATCH /properties/:id`):
- [ ] a: chỉ gửi cặp số, không `wardCode`: trong hộp phường đang lưu → 200; Vũng Tàu kèm đổi tên, phí, tiện ích → 400 `COORDINATE_FAR_FROM_WARD`, dòng, phí, tiện ích y như trước (kể cả `updated_at`) → AC-5 a
- [ ] a: `wardCode` Bình Tây kèm điểm Bến Thành → 400 nêu Bình Tây, câu lỗi không nói "đang lưu", không đổi gì; `wardCode` Bình Tây kèm điểm Bình Tây → 200 → AC-5 a
- [ ] b: nhà trọ giữ tọa độ ở Bình Tây, chỉ gửi `wardCode` Bến Thành → 400 `COORDINATE_FAR_FROM_WARD` nêu Bến Thành, câu lỗi có "đang lưu" và "null", dòng không đổi → AC-5 b
- [ ] b: đổi phường kèm tọa độ mới hợp lệ → 200; kèm `latitude`, `longitude` đều `null` → 200 và tọa độ bị xóa; nhà trọ chưa có tọa độ đổi phường → 200 → AC-5 b
- [ ] b: tọa độ đang lưu (10.781, 106.695) nằm trong hộp nới của cả Bến Thành và Tân Định, chỉ đổi `wardCode` sang Tân Định → 200 → AC-5 b
- [ ] b: sang phường admin tạo (không hộp): tọa độ đang lưu trong khung → 200, rồi mọi điểm trong khung → 200, Hà Nội → 400 `COORDINATE_OUT_OF_AREA` → AC-2, AC-5
- [ ] Thứ tự lỗi khi sửa: chủ khác + điểm xa → 403 `NOT_RESOURCE_OWNER`; nhà trọ không có → 404; phường lạ → `WARD_UNKNOWN`; tiện ích lạ → `AMENITY_UNKNOWN` (đều trước tọa độ); người tìm trọ → 403 `PERMISSION_DENIED` → AC-3
- [ ] Nhà trọ cũ lệch (chèn thẳng bằng SQL tọa độ Hà Nội, rồi Vũng Tàu): `GET` trả tọa độ nguyên xi; sửa tên, địa chỉ, phí, tiện ích → 200 và tọa độ không bị đụng; `{}` → 200; gửi đúng phường đang lưu → 200; chỉ đổi phường (khi tọa độ ở Hà Nội) → 400 `COORDINATE_OUT_OF_AREA` có "đang lưu"; đổi phường kèm `null` cả hai → 200; `null` cả hai xóa được; gửi điểm đúng phường sửa lại được → AC-4, AC-5 b và c, AC-8
- [ ] d: hai PATCH đồng thời lên cùng một nhà trọ đang ở điểm (10.781, 106.695) của Bến Thành: một cái chỉ đổi `wardCode` sang Tân Định, một cái đổi tọa độ sang (10.772, 106.695) (hợp Bến Thành, xa Tân Định); lặp 12 lượt, hai chủ trọ → mỗi lượt đúng một cái 200, trạng thái cuối luôn qua luật (điểm trong hộp nới của phường lưu) → AC-5 d

Postman:
- [ ] Folder 07 `GET /wards` có assertion `bounds` (168 hộp, nằm trong hai khung, Bến Thành đúng số); folder 08 có request COORDINATE_FAR_FROM_WARD ở POST, PATCH đổi phường kèm điểm Côn Đảo, PATCH chỉ đổi phường (tọa độ đang lưu), PATCH điểm xa phường, và request trả phường về như cũ kèm `null`; folder 17 kiểm `bounds: null` của phường admin tạo và `bounds` giữ nguyên khi đổi tên phường thật → AC-7, AC-9

## Mốc 2: phủ tiêu chí
- AC-2 … POST và PATCH, mép nới bốn cạnh, ba cỡ phường, phường không hộp · AC-3 … chuỗi lỗi đủ cả hai mã tọa độ, POST và PATCH · AC-4 … không gửi, `null` cả hai, nhà trọ cũ · AC-5 (a, b, c, d) … phường hiệu lực, đổi phường kèm hoặc không kèm tọa độ, gửi đúng phường hiện tại, đua hai PATCH · AC-6 … migration trên DB có sẵn dữ liệu, `CHECK`, seed điền và không ghi đè, không lệch schema, `ward-bounds.json` · AC-7 … `bounds` ở ba API danh mục, phường lồng trong nhà trọ và tin không có · AC-8 … `seed:demo`, bài dữ liệu demo, ba `CHECK` cũ, đọc tọa độ cũ nguyên xi · AC-9 … tài liệu FE và Postman

## Kết quả đã chạy 2026-11-05 (mốc 2)
- **30 kiểm tra dữ liệu** (script `verify-m2-db.js`) trên database thử: giấu migration mới, áp các migration cũ, nạp 168 phường cộng một phường admin theo cột cũ, trả migration mới về chỗ cũ và áp lên DB đã có dữ liệu; cột, `CHECK` (năm ca từ chối, hai ca nhận), ba `CHECK` cũ của `properties`, `prisma migrate diff` thoát 0, seed lần 1 điền 168, lần 2 điền 0 và băm bảng không đổi, hộp sửa tay không bị ghi đè, phường rỗng được điền lại đúng, phường admin giữ rỗng. 0 sai.
- **89 kiểm tra HTTP và database** (script `verify-m2.js`) trên server cổng 3055: các bước ở "Mốc 2: gọi API" ở trên, gồm 24 lượt đua hai PATCH (đúng một thành công ở cả 24 lượt, trạng thái cuối luôn qua luật). 0 sai; chạy lại sau khi dựng lại `dist` vẫn 89 trên 89.
- **Bốn điều khiển âm đều bắt được** (phá một chỗ trong tệp biên dịch, sao lưu rồi trả lại): (1) bỏ lề (`COORDINATE_MARGIN_DEGREES = 0`) → 9 kiểm tra hỏng, đúng các ca mép nới; (2) bỏ kiểm tọa độ đang lưu khi đổi phường → ca "chỉ đổi `wardCode`" nhận 200 thay vì 400, bị bắt; (3) bỏ `FOR UPDATE` ở `lockLiveById` → 23 trên 24 lượt đua cho cả hai PATCH thành công và trạng thái cuối vi phạm luật; (4) coi mọi phường là có hộp → 7 kiểm tra hỏng (phường admin tạo bị từ chối, `bounds` không còn `null`). Lần đầu điều khiển (4) không bắt được vì bản vá của tôi sai (chỉ sửa một vế của chuỗi `||`); đã sửa bản vá rồi chạy lại.
- Unit: 1644 bài (81 bộ), `tsc` và `eslint` sạch. Newman folder 00, 01, 03, 04, 05, 07 đến 22 (bỏ 02 và 06): 592 request, 1271 assertion, 0 lỗi, hai lượt liền (khởi động lại server giữa hai lượt, cùng một database); folder 23: 38 request, 75 assertion, 0 lỗi. So với trước mốc: thêm 3 request và 17 assertion.
- `npm run seed:demo` trên database thử chạy hai lần liền, thoát 0; 12 đến 13 nhà trọ demo có tọa độ (số đổi theo kịch bản folder 23) đều nằm trong hộp phường nới 500 m.

## Ghi chú (mốc 2)
- Hai tọa độ demo được dời vào trong hộp phường: Bình Trị Đông (`27448`) vĩ độ 10.7451 thành 10.757, Phú Nhuận (`27073`) kinh độ 106.6869 thành 106.681. Đã đo trước (2026-11-03) rằng chỉ hai điểm này trượt; bài dữ liệu demo kiểm cả 12 nhà trọ.
- **Hai request Postman của mốc 1 phải đổi cho đúng luật mới**: "Đặt tọa độ nhà trọ trên Côn Đảo" nay phải gửi kèm `wardCode` 26732 (điểm trên đảo xa phường Bến Thành đang lưu), và "Xóa lại tọa độ" nay trả phường về `{{wardCode}}` cùng `null` cả hai. Bài "đúng 4 trường" ở folder 17 thành "đúng 5 trường" vì thêm `bounds`.
- Dữ liệu hộp (`ward-bounds.json`) dựng từ GeoJSON phường của kho `thanglequoc/vietnamese-provinces-database` tag `v5.2.0` bằng `build-ward-bounds.ts`: 168 trên 168 mã trùng `wards.json`, cực trị khớp số trong spec. Giấy phép dữ liệu ranh giới gốc vẫn là việc còn mở của spec.
- Việc người dùng cần làm để DB đang dùng có hộp: `npm run migration:deploy`, rồi `npm run seed` một lần. Chưa làm hai lệnh này trên `rental_management` (chỉ chạy trên database thử).
- Prettier chạy trên cả thư mục `src/catalog` và `src/properties` đã đổi cuối dòng một số file từ CRLF sang LF; nội dung không đổi (`git diff` trống với các file đó).
