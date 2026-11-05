# 0012. Lý giải: giới hạn tọa độ nhà trọ

Đây là phần ghi lại vì sao chọn như vậy. `/develop` không đọc file này; bản build nằm ở [index.md](index.md).

## Context

> ⚠️ Premise note: Với phường đã có hộp, lớp 2 gần như bao luôn lớp 1, vì hộp của mọi phường nằm trọn trong khung thành phố. Vậy lớp 1 chủ yếu là lưới đỡ rẻ cho phường chưa có hộp (admin thêm qua API, hoặc seed chưa chạy) và cho lỗi dữ liệu hộp. Vẫn giữ cả hai vì bạn yêu cầu hai lớp, và vì lớp 1 không cần dữ liệu nên làm được trước (mốc 1). Thêm nữa, dữ liệu ranh giới là của bên thứ ba và giấy phép riêng của nó không được nêu, nên ta chỉ giữ bốn con số mỗi phường, không giữ hình dạng.

Hiện tọa độ của nhà trọ là tùy chọn và chỉ bị chặn ở miền toán học: `IsCoordinate` (DTO) kiểm vĩ độ trong ±90, kinh độ trong ±180 và luật đi cặp; ba `CHECK` của `properties` lặp lại đúng điều đó (spec 0002 AC-3, 0005). Vì vậy một điểm ở Hà Nội, ở nước ngoài hay giữa biển vẫn lưu được, hiện công khai trong chi tiết tin, và sẽ làm bản đồ của FE sai. Bảng `wards` (168 đơn vị cấp xã của Thành phố Hồ Chí Minh mới, gồm cả Bình Dương và Bà Rịa Vũng Tàu cũ) chỉ có mã và tên, chưa có dữ liệu vị trí nào.

Ngày 2026-11-03 bạn yêu cầu giới hạn hai lớp: tọa độ nằm trong một khung bao quanh TP.HCM mới (khung rộng, chỉ chặn điểm sai rõ ràng) và nằm gần phường chủ trọ đã chọn; bạn cũng muốn khi chủ trọ nhập địa chỉ thì tự xác định và ghim tọa độ, giao cho FE nếu FE làm tốt hơn, không thì backend làm. Tọa độ vẫn tùy chọn.

Những điều đang ràng buộc cách làm:
- **Phường rất khác cỡ.** Theo dữ liệu ranh giới đo ngày 2026-11-03, hộp bao của phường nhỏ nhất rộng khoảng 0.9 km × 1.9 km (Phường Bình Tây), phường lớn nhất khoảng 24.7 km × 14.3 km (Xã An Thới Đông). "Gần phường" không thể là một khoảng cách cố định cho mọi phường.
- **TP.HCM mới có một đảo xa.** Đặc khu Côn Đảo nằm cách đất liền hơn một độ vĩ độ, nên một khung chữ nhật duy nhất quanh cả thành phố sẽ rộng hơn nhiều so với phần đất liền.
- **Dự án không có dịch vụ bản đồ, không có PostGIS, không có việc nền**; bản này là MVP để demo, ưu tiên gọn.
- **Có dữ liệu cũ và dữ liệu demo.** Nhà trọ cũ có thể giữ tọa độ ngoài vùng; mười hai nhà trọ demo có tọa độ đặt tay.
- **Quy ước của dự án:** `CHECK` viết tay trong migration, seed chỉ thêm dòng còn thiếu, luật nghiệp vụ nằm ở Service, mã lỗi riêng cho lỗi nghiệp vụ (0004, 0005).
- **FE là Next.js và vốn cần bản đồ** để chủ trọ kéo ghim và xem lại vị trí.

Nếu không quyết, bản đồ tiếp tục nhận điểm sai, và chỗ duy nhất ngăn chặn là FE tự giác.

## Options considered

### Option 1: Hai khung thành phố cộng hộp bao của từng phường nới 500 m

Lớp 1 so điểm với hai khung hằng số (đất liền và Côn Đảo). Lớp 2 so điểm với hộp bao của phường (bốn con số mỗi phường, lưu trong `wards`, điền bằng seed từ bộ ranh giới) nới 0.0045 độ mỗi phía. Cả hai chỉ là so sánh số, nằm trong Service.

**Pros**:
- Dữ liệu rất nhỏ (168 hàng × 4 số), so sánh bằng code thường, không cần thư viện hay phần mở rộng database.
- Mọi điểm thật nằm trong phường đều nằm trong hộp của nó, nên người ghim đúng không bao giờ bị từ chối oan; lề lo cho ca ghim sát biên.
- Vừa với mọi cỡ phường, vì hộp theo phường chứ không theo một khoảng cách chung.
- FE dùng chính bốn số đó để zoom và giới hạn ghim.

**Cons**:
- Hộp thô hơn đường ranh thật: góc hộp không thuộc phường vẫn qua, nhất là phường dài và chéo.
- Cần một cột dữ liệu mới, một migration và một bước seed điền ô rỗng.

### Option 2: Hai khung cộng đường ranh phường chính xác

Điểm phải nằm trong đa giác của phường (cộng lề), kiểm bằng PostGIS hoặc một thư viện hình học.

**Pros**:
- Chính xác nhất: không có "góc thừa" của hộp.

**Cons**:
- Đường ranh của 168 phường nặng khoảng 19 MB, 217,352 đỉnh; phải đưa vào database hoặc vào bộ nhớ, và cần PostGIS hoặc thư viện hình học, cả hai đều mới với dự án.
- Chính xác hơn mức cần: bản đồ FE và dữ liệu ranh giới không bao giờ khớp từng mét, nên vẫn phải có lề; độ chính xác thêm bị lề nuốt mất.

### Option 3: Hai khung cộng một bán kính cố định quanh tâm phường

Mỗi phường có một điểm tâm; điểm gửi lên phải cách tâm không quá một khoảng cố định.

**Pros**:
- Ý tưởng dễ nói nhất; hai con số mỗi phường.

**Cons**:
- Một bán kính không vừa cả phường 1 km lẫn phường 25 km: chọn nhỏ thì chặn oan người ghim đúng ở phường lớn, chọn lớn thì để lọt điểm ở phường lân cận của phường nhỏ.
- Dữ liệu ranh giới không có sẵn điểm tâm (chỉ có hộp và đường ranh), nên vẫn phải tính tâm từ hộp, thành ra khó hơn Option 1 mà kém hơn.

### Option 4: Chỉ hai khung thành phố, hoãn lớp "gần phường"

Chỉ làm lớp 1 (mốc 1) và để lớp 2 cho một lần sau.

**Pros**:
- Không dữ liệu mới, không migration, không bước seed; xong nhanh.

**Cons**:
- Không làm điều bạn yêu cầu: điểm ở phường khác của cùng thành phố vẫn qua, và FE không có hộp phường để zoom bản đồ.

## Rationale

Chọn Option 1. Lực chính là cỡ phường chênh nhau hơn hai mươi lần và dự án chưa có hạ tầng hình học: chỉ hộp bao theo phường vừa giữ được "gần phường" với mọi cỡ, vừa là bốn con số có thể so sánh bằng code thường. Option 2 chính xác hơn mức cần, vì ngay cả với đường ranh thật ta vẫn phải nới lề để chứa chênh lệch giữa bản đồ FE và dữ liệu ranh giới, nên độ chính xác thêm bị lề nuốt. Option 3 không giải được bài toán cỡ phường. Option 4 bỏ mất chính điều bạn yêu cầu, nhưng chính cấu trúc của nó là mốc 1 của Option 1, nên Option 1 đi theo hướng Skateboard (bản mỏng nhất dùng được trước): khung thành phố ra trước, hộp phường ra sau.

Các lựa chọn nhỏ hơn đã chốt và lý do:
- **Lề 500 m (0.0045 độ).** Đo trên mười hai nhà trọ demo: lề 0 qua 8, lề 500 m qua 10, lề 1 km qua 11. 500 m đủ chứa một điểm ghim ở đường biên phường và chênh lệch giữa hai bản đồ, mà vẫn chặn được điểm ở phường lân cận; 1 km ở phường nhỏ nhất (khoảng 1 km chiều ngang) đã gần bằng cả phường. Một hằng cho mọi phường, không phép tính lượng giác: ở 10.8 độ Bắc kinh độ ngắn hơn vĩ độ khoảng 2%, bỏ qua.
- **Hai khung, không phải một.** Một khung duy nhất bao cả Côn Đảo sẽ trải từ vĩ độ 8.4 đến 11.7, nuốt thêm một dải khoảng 145 km theo chiều bắc nam giữa đất liền và đảo, cùng một phần Đồng Nai, Tây Ninh, Long An. Hai khung (cực trị thật của dữ liệu, làm tròn ra ngoài 0.1 độ, cộng thêm 0.1 độ) chặt hơn nhiều mà vẫn rộng, đúng ý "chỉ chặn điểm sai rõ ràng".
- **Hộp lưu ở cột của `wards`, điền bằng seed.** Một nơi cho dữ kiện về phường, xem được trong DB, và phường nào chưa có hộp thì tự bỏ lớp 2. Phương án đọc file JSON lúc chạy không cần migration nhưng tách dữ kiện phường ra hai nơi và phường admin thêm không bao giờ có hộp. Seed dùng `createMany` với `skipDuplicates` nên không đụng dòng đã có; vì thế cần thêm bước điền ô rỗng, một sửa nhỏ quy ước "chỉ thêm dòng còn thiếu".
- **Chỉ kiểm ở Service, không `CHECK` trên `properties`.** Lớp 2 so với một bảng khác, không viết được thành `CHECK`. Lớp 1 viết được, nhưng thêm vào `properties` sẽ bắt buộc dùng `NOT VALID` để giữ dòng cũ, và Postgres vẫn kiểm lại mọi `UPDATE` của dòng đó: ngay cả xóa mềm nhà trọ cũ ngoài vùng cũng lỗi. Bạn đã chọn để dòng cũ yên, nên luật chỉ ở Service, một chỗ duy nhất, và chỉ kiểm khi ghi có đụng tới tọa độ hoặc phường.
- **Hai mã lỗi riêng.** `COORDINATE_OUT_OF_AREA` và `COORDINATE_FAR_FROM_WARD` do Service ném như `WARD_UNKNOWN`, để FE báo hai câu khác nhau ("ngoài thành phố" và "xa phường đã chọn") mà không phải đọc chữ trong câu lỗi. Đã đưa bạn chọn giữa hai mã, một mã chung và `VALIDATION_FAILED`; bạn chọn hai mã.
- **Đổi phường mà không gửi tọa độ thì kiểm tọa độ đang lưu.** Đây là cách duy nhất để luật "tọa độ đang lưu luôn gần phường của nó" đúng sau mọi lần ghi, và không mất dữ liệu lặng lẽ như tự xóa tọa độ. Bạn đã chọn phương án này.
- **Dòng cũ để yên.** DB này là bản demo, không có dữ liệu thật để bảo vệ; dọn trong migration sẽ xóa lặng lẽ một giá trị chủ trọ đã nhập. Bạn đã chọn để yên.

### Quyết định phụ: ai ghim tọa độ từ địa chỉ

Hai phương án: FE ghim và backend chỉ kiểm lại (đã chọn), hoặc backend gọi dịch vụ bản đồ để đổi địa chỉ thành điểm.
- FE vốn cần bản đồ để chủ trọ kéo ghim và xem lại, nên FE làm việc đổi địa chỉ thành điểm là tự nhiên; backend gọi dịch vụ bản đồ thêm khóa bí mật, hạn mức gọi, chi phí, và điều kiện lỗi mạng ở chỗ đang giữ giao dịch, trong khi FE vẫn phải có bản đồ. Đây cũng là khuyến nghị `/scope` đã ghi ở hàng 19 và bạn chọn ngày 2026-11-03.
- Hệ quả: backend chỉ cần kiểm lại điểm FE gửi (hai lớp ở trên). Nếu sau này FE không làm tốt được, đó là một spec riêng (endpoint geocode phía backend), không phải sửa spec này.

## Evidence (đo ngày 2026-11-03)

**Nguồn dữ liệu (đọc từ kho `thanglequoc/vietnamese-provinces-database`, cùng kho đã dựng `wards.json`):**
- Bản mới nhất `v5.2.0` (trang ghi ngày 21/09, README ghi hiệu lực 20/09/2026; năm không hiện trên trang), 34 tỉnh và 3,321 phường xã, theo nghị quyết 388/NQ-UBTVQH16. Kho mã nguồn dùng giấy phép MIT.
- GeoJSON xuất hiện từ `v4.1.0`. Bố cục: một tệp mỗi phường tại `json/geojson/<mã tỉnh>_<tên tỉnh>/wards/<mã phường>_<tên phường>.geojson`, mỗi tệp một FeatureCollection với một Feature, id là mã phường 5 chữ số; thuộc tính gồm `code`, `name`, `fullName`, `areaKm2`; có hộp bao (bbox); hệ tọa độ WGS 84, thứ tự kinh độ rồi vĩ độ. Không có điểm tâm.
- Nguồn bản đồ do kho ghi: "Vietnam Administrative Units Reference Map" của nhà xuất bản thuộc Bộ Nông nghiệp và Môi trường. Giấy phép riêng của dữ liệu ranh giới không được nêu ở các trang đã đọc; trang gốc của bản đồ chưa mở được trong lần kiểm này.

**Đo trên 168 tệp của tỉnh `79` (tag `v5.2.0`, thư mục `json/geojson/79_ho_chi_minh/wards/`):**
- Tổng dung lượng 18,999,671 byte, 217,352 đỉnh, kiểu hình học `MultiPolygon`.
- Mã phường trùng `wards.json` đúng 168 trên 168, không thiếu không thừa; id của Feature bằng `properties.code` ở cả 168 tệp.
- Cực trị đất liền (167 phường): vĩ độ 10.3203 đến 11.5010, kinh độ 106.3290 đến 107.5719. Đặc khu Côn Đảo (`26732`): vĩ độ 8.5771 đến 8.7787, kinh độ 106.0881 đến 106.7436 (các đảo nhỏ ở xa làm hộp rộng khoảng 22 km × 71 km, phần lớn là biển).
- Hộp nhỏ nhất: Phường Bình Tây khoảng 0.9 km × 1.9 km; Phường Vĩnh Hội khoảng 1.1 km × 2.1 km. Hộp lớn nhất theo chiều cao: Xã An Thới Đông khoảng 24.7 km × 14.3 km (257.85 km²), Xã Phước Thành khoảng 23.7 km × 11.4 km (123.49 km²).

**Mười hai nhà trọ demo so với hộp thô của phường đã gắn** (khoảng cách ra ngoài hộp, tính theo km):

| Mã | Phường | Kết quả |
|---|---|---|
| 26890 | Hạnh Thông | trong hộp |
| 26824 | Thủ Đức | trong hộp |
| 26929 | Bình Thạnh | 0.06 km ngoài hộp |
| 26743 | Bến Thành | trong hộp |
| 27043 | Đức Nhuận | trong hộp |
| 27004 | Tân Bình | 0.36 km ngoài hộp |
| 27448 | Bình Trị Đông | 1.21 km ngoài hộp |
| 27475 | Tân Hưng | trong hộp |
| 25951 | Đông Hòa | trong hộp |
| 25966 | Lái Thiêu | trong hộp |
| 26526 | Tam Thắng | trong hộp |
| 27073 | Phú Nhuận | 0.54 km ngoài hộp |

Kết quả: lề 0 qua 8, lề 500 m qua 10, lề 1 km qua 11. Hai điểm cần dời khi lề là 500 m: Phú Nhuận và Bình Trị Đông.

Cách đo: tải 168 tệp vào một thư mục tạm ngoài repo, chạy hai script Python chỉ đọc (đối chiếu mã, tính cực trị, so tọa độ demo). Không tệp nào của nguồn được đưa vào repo ở bước này.

**Đã thấy trong kết quả tìm nhưng không dùng:** một kho có tệp điểm trụ sở xã cho 3,321 đơn vị (chỉ là điểm, không phải đường ranh, chưa mở); gói dữ liệu ranh giới trả phí của một bên thương mại (chưa kiểm giấy phép và phạm vi); và kho GeoJSON 34 phường cũ của Thành phố Thủ Đức (cấu trúc trước sáp nhập, không dùng được cho 168 đơn vị mới).

## References

**Project sources** (verifiable, in this repo):
- Spec 0002: AC-3 và dòng "Phí và tọa độ nhà trọ" ở Edge cases (luật miền và đi cặp, được giữ nguyên); `src/properties/dto/is-coordinate.decorator.ts`
- Spec 0005: `CHECK` viết tay trong migration, `double precision` cho tọa độ, quy ước seed chỉ thêm dòng còn thiếu; `src/database/seed-catalog.ts`
- Spec 0004: mã lỗi qua `ErrorCode` và `AppException`; spec 0011: dạng spec thư mục gần nhất
- `prisma/seed-data/README.md`: nguồn, phiên bản và cách kiểm của `wards.json`
- Scope hàng 19 (`docs/scope/scope.md`): yêu cầu 2026-11-03 và khuyến nghị để FE ghim

**Practices & standards**:
- Lọc thô bằng hộp bao trước khi cần hình học chính xác
- Thêm cột cho phép rỗng, điền dữ liệu, rồi mới để code dùng (không `NOT NULL` ngay)
- Kiểm lại ở server mọi giá trị client tự tính, không tin client
- Một nguồn, một phiên bản, một bộ mã cho dữ liệu danh mục (cùng kho với `wards.json`)

**Links** (web verified 2026-11-03):
- vietnamese-provinces-database, các bản phát hành (v5.2.0 mới nhất): https://github.com/thanglequoc/vietnamese-provinces-database/releases
- Bản phát hành v4.1.0, nơi GeoJSON xuất hiện và mô tả bố cục tệp: https://github.com/thanglequoc/vietnamese-provinces-database/releases/tag/v4.1.0
- README của kho (giấy phép MIT, số liệu 3,321 phường xã): https://github.com/thanglequoc/vietnamese-provinces-database
- Tài liệu GIS của kho (WGS 84, SRID 4326, kinh độ rồi vĩ độ): https://github.com/thanglequoc/vietnamese-provinces-database/blob/master/docs/gis/README.md
