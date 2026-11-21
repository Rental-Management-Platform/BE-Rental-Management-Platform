# Dữ liệu seed

Ba file JSON ở đây do `npm run seed` đọc (`src/database/seed-catalog.ts`). Seed chỉ **thêm dòng còn thiếu**, không bao giờ ghi đè dòng admin đã sửa (spec 0002 AC-1); ngoại lệ duy nhất là hộp phường của `ward-bounds.json` (xem bên dưới).

## `wards.json`: phường, xã, đặc khu của TP. Hồ Chí Minh, theo địa chỉ mới sau sáp nhập

Địa chỉ ở Việt Nam từ 01/07/2025 chỉ còn **hai cấp**: tỉnh hoặc thành phố, rồi phường, xã hoặc đặc khu. **Không còn cấp quận, huyện.** Bảng `wards` vì vậy không có cột quận huyện, và một địa chỉ trong hệ thống gồm: số nhà và tên đường (`properties.address_text`), phường hoặc xã (`wards`), tỉnh hoặc thành phố (`wards.province_name`).

- **Nguồn**: kho `thanglequoc/vietnamese-provinces-database`, giấy phép MIT (xem `LICENSE-vietnamese-provinces-database.txt`).
- **File dùng**: `json/vn_only_simplified_json_generated_data_vn_units.json`.
- **Phiên bản dữ liệu lúc dựng**: `v5.2.0`, nghị quyết mới nhất mà nguồn phản ánh là `388/NQ-UBTVQH16`, tạo ngày 2026-09-20. Nền là Quyết định 19/2025/QĐ-TTg (có hiệu lực 01/07/2025).
- **Cách lọc**: lấy tỉnh có `Code = "79"` (Thành phố Hồ Chí Minh mới, đã gồm Bình Dương và Bà Rịa Vũng Tàu cũ). Mỗi phần tử: `code` (mã 5 chữ số của đơn vị), `name` (**tên đầy đủ kèm loại đơn vị**, ví dụ `Phường Bến Thành`, `Xã Bình Chánh`, `Đặc khu Côn Đảo`), `provinceCode`, `provinceName`. Tên đã chuẩn hóa Unicode NFC, sắp theo `code`.
- **Kiểm lúc dựng (2026-10-14)**: đúng **168** dòng, mã duy nhất, gồm 113 phường, 54 xã, 1 đặc khu; không tên nào chứa chữ quận hay huyện; đối chiếu với `provinces.open-api.vn` bản v2: cùng đúng 168 mã, không thiếu không thừa. Có 17 tên chỉ khác cách đặt dấu thanh (`Hoà` trong nguồn, `Hòa` ở nơi kia); ta giữ nguyên cách viết của nguồn. Tìm kiếm bỏ dấu nên không bị ảnh hưởng.
- **Đừng trộn nguồn**: mã đơn vị sau sáp nhập khác mã trước sáp nhập. Muốn thêm tỉnh khác thì lấy từ cùng bộ dữ liệu này, cùng phiên bản.
- Test `src/database/seed-data.spec.ts` canh các điều trên (168 dòng, cơ cấu, không quận huyện).

## `ward-bounds.json`: hộp bao của 168 phường, để kiểm tọa độ nhà trọ (spec 0012)

Mỗi dòng là mã phường và bốn số `minLatitude`, `maxLatitude`, `minLongitude`, `maxLongitude` (độ). `npm run seed` chép chúng vào bốn cột mới của bảng `wards` (`min_latitude` ... `max_longitude`); backend dùng để kiểm tọa độ của nhà trọ có nằm gần phường đã chọn không (hộp nới thêm 0.0045 độ, khoảng 500 m) và trả cho FE là `bounds` của `GET /wards`.

- **Nguồn**: cùng kho `thanglequoc/vietnamese-provinces-database` với `wards.json`, **cùng tag `v5.2.0`** (không trộn phiên bản), thư mục `json/geojson/79_ho_chi_minh/wards/`: 168 tệp GeoJSON, mỗi tệp một phường, mã `properties.code` trùng từng mã trong `wards.json`. Dữ liệu ranh giới phản ánh đơn vị cấp xã theo bản đồ sau sáp nhập. **Chỉ giữ 4 số mỗi phường**, không giữ hình dạng (GeoJSON gốc khoảng 19 MB, không nằm trong repo).
- **Cách dựng** (ngày dựng 2026-11-05): tải 168 tệp về một thư mục (ví dụ bằng GitHub contents API của kho, tag `v5.2.0`), rồi chạy `npx ts-node src/database/scripts/build-ward-bounds.ts <thư mục>`. Script đọc mọi đỉnh của mỗi phường, lấy cực trị, **làm tròn ra ngoài** đến 5 chữ số thập phân (min xuống, max lên, khoảng 1 m, nên hộp không bao giờ co lại), xếp theo mã, và **từ chối ghi** nếu tập mã không trùng đúng tập mã của `wards.json`.
- **Kiểm lúc dựng**: 168 trên 168 mã trùng `wards.json`. Cực trị của 167 đơn vị đất liền: vĩ độ 10.32028 đến 11.50104, kinh độ 106.32897 đến 107.57193; đặc khu Côn Đảo (`26732`): vĩ độ 8.57705 đến 8.77875, kinh độ 106.0881 đến 106.74358. Hộp nhỏ nhất là Phường Bình Tây (`27367`, khoảng 0.9 km × 1.9 km), hộp lớn nhất đất liền là Xã An Thới Đông (`27673`). Hai khung thành phố trong `src/properties/coordinate-area.ts` là các cực trị này làm tròn ra 0.1 độ rồi cộng thêm 0.1 độ. Test `src/database/seed-data.spec.ts` canh: đúng 168 dòng, mã trùng `wards.json`, min không lớn hơn max, không quá 5 chữ số thập phân, và mỗi hộp nới 0.0045 độ nằm trọn trong một trong hai khung.
- **Seed khác một chút so với hai file kia**: `wards.json` và `amenities.json` chỉ **thêm dòng còn thiếu**, còn `ward-bounds.json` điền bốn ô hộp của phường **đã có mà còn rỗng** (phường seed từ trước khi có cột hộp). Ô đã có giá trị thì không bao giờ bị ghi đè, chạy lại nhiều lần vẫn đúng, và phường admin thêm qua API (không có trong file này) giữ rỗng, nên chỉ bị kiểm hai khung thành phố.
- **Khi `wards.json` đổi** (dựng lại từ phiên bản dữ liệu mới) thì dựng lại `ward-bounds.json` cùng lúc bằng script trên, rồi cập nhật hộp trong DB đang chạy (seed không ghi đè ô đã có, nên cần sửa hộp cũ bằng SQL).
- **Giấy phép**: kho nguồn là MIT cho phần mã nguồn, nhưng **giấy phép của chính dữ liệu ranh giới không được nêu**. Ta chỉ giữ 4 số làm tròn cho mỗi phường, không giữ hình dạng. Xác nhận trước khi công bố repo công khai.

## `amenities.json`: tiện ích mẫu

13 tiện ích của nhà trọ (spec 0002). Khóa `key` là chữ thường, số, gạch dưới, bắt đầu bằng chữ cái. Admin thêm, sửa tên, xóa được sau này; tiện ích admin đã xóa sẽ quay lại ở lần seed kế tiếp vì seed chỉ thêm dòng thiếu.
