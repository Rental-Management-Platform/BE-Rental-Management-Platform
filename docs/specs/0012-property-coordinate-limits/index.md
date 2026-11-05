# 0012. Giới hạn tọa độ nhà trọ

**Date**: 2026-11-03
**Status**: Accepted

## Summary

Hiện tọa độ của nhà trọ chỉ bị chặn ở miền toán học (vĩ độ trong ±90, kinh độ trong ±180), nên một điểm ở Hà Nội, ở nước ngoài hay giữa biển vẫn lưu được. Spec này thêm hai lớp kiểm ở backend: tọa độ phải nằm trong một trong hai khung bao quanh Thành phố Hồ Chí Minh mới (đất liền và Côn Đảo), và phải nằm gần phường chủ trọ đã chọn (hộp bao của phường nới thêm khoảng 500 m). Hộp của 168 phường chỉ là bốn con số mỗi phường, lấy từ bộ ranh giới cùng kho dữ liệu với `wards.json`, lưu thành bốn cột mới của `wards` và trả cho FE. Việc ghim tọa độ từ địa chỉ do FE làm (FE vốn cần bản đồ để chủ trọ kéo ghim); backend không gọi dịch vụ bản đồ nào, chỉ kiểm lại điểm gửi lên.

## Requirements

**User stories**:
- Là chủ trọ, tôi muốn nếu ghim nhầm chỗ (ngoài thành phố, hay sai phường) thì được báo ngay rằng tọa độ sai, để không đăng nhà trọ nằm sai chỗ trên bản đồ.
- Là người tìm trọ, tôi muốn vị trí của mọi nhà trọ có tọa độ nằm gần đúng phường ghi trong địa chỉ, để bản đồ đáng tin.
- Là FE, tôi muốn biết vùng của từng phường để zoom bản đồ và giới hạn chỗ ghim đúng với điều backend sẽ nhận.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1** (khung thành phố, lớp 1): Khi tạo hoặc sửa nhà trọ mà body có cặp tọa độ là số, cặp đó phải nằm trong một trong hai khung: khung đất liền (vĩ độ 10.2 đến 11.7, kinh độ 106.2 đến 107.7) hoặc khung Côn Đảo (vĩ độ 8.4 đến 8.9, kinh độ 105.9 đến 106.9); đúng biên tính là trong. Ngoài cả hai khung (ví dụ Hà Nội 21.0285, 105.8542; điểm 0, 0; điểm giữa biển giữa hai khung 9.5, 106.5; điểm 10.5, 108.5) thì 400 `COORDINATE_OUT_OF_AREA`, `errors` có hai mục `latitude` và `longitude` cùng mã đó. Lỗi thì không ghi gì: POST không tạo nhà trọ, phí hay tiện ích nào; PATCH không đổi trường nào.
- **AC-2** (gần phường, lớp 2): Nếu phường đã chọn có hộp (cả bốn cột hộp của `wards` có giá trị) thì tọa độ còn phải nằm trong hộp đó nới ra 0.0045 độ mỗi phía, ở cả vĩ độ lẫn kinh độ (khoảng 500 m); đúng biên tính là trong. Tọa độ nằm trong khung thành phố nhưng ngoài hộp đã nới thì 400 `COORDINATE_FAR_FROM_WARD`, `errors` hai mục `latitude` và `longitude`, câu lỗi nêu tên phường. Phường không có hộp (admin thêm qua `POST /wards`, hoặc `seed` chưa chạy) thì bỏ lớp này, chỉ còn lớp 1.
- **AC-3** (thứ tự lỗi): POST: 401 → 403 `PERMISSION_DENIED` → 429 `RATE_LIMITED` → 400 `VALIDATION_FAILED` (miền ±90 và ±180, chỉ một tọa độ: giữ nguyên của spec 0002) → 400 `WARD_UNKNOWN` → 400 `AMENITY_UNKNOWN` → 400 `COORDINATE_OUT_OF_AREA` → 400 `COORDINATE_FAR_FROM_WARD`. PATCH giống vậy, thêm 404 `PROPERTY_NOT_FOUND` rồi 403 `NOT_RESOURCE_OWNER` đứng trước 400 `WARD_UNKNOWN`. Hai mã mới do Service ném, sau khi mọi kiểm danh mục đã xong.
- **AC-4** (không có tọa độ, hoặc xóa tọa độ): POST không gửi tọa độ, hoặc gửi `null` cả hai, thì lưu như cũ và không kiểm gì, ở phường nào cũng được. PATCH gửi `null` cả hai luôn xóa được tọa độ, kể cả với nhà trọ cũ đang giữ tọa độ ngoài vùng.
- **AC-5** (sửa nhà trọ):
  - (a) PATCH có cặp số: kiểm với phường hiệu lực, là `wardCode` trong body nếu có, nếu không thì phường đang lưu của nhà trọ.
  - (b) PATCH đổi `wardCode` sang phường khác phường đang lưu, không gửi tọa độ, mà nhà trọ đang có tọa độ: kiểm tọa độ đang lưu với phường mới bằng cả hai lớp; trượt thì 400 như AC-1 hoặc AC-2, `errors` vẫn là `latitude` và `longitude`, câu lỗi nói rõ đây là tọa độ đang lưu và bảo gửi tọa độ mới (hoặc `null`) cùng phường mới. Nhà trọ chưa có tọa độ thì đổi phường bình thường.
  - (c) PATCH không đụng tới phường (không gửi `wardCode`, hoặc gửi đúng phường đang lưu) và không gửi tọa độ: không kiểm gì; nhà trọ cũ có tọa độ ngoài vùng vẫn sửa được tên, địa chỉ, phí, tiện ích.
  - (d) Tọa độ đang lưu được đọc sau khi khóa dòng nhà trọ, trong cùng giao dịch, nên hai PATCH đồng thời không lách được luật.
- **AC-6** (hộp phường): Bảng `wards` thêm bốn cột `min_latitude`, `max_latitude`, `min_longitude`, `max_longitude` (số thực, cho phép rỗng) và `CHECK` `wards_bounds_check` (bốn cột cùng rỗng hoặc cùng có; min không lớn hơn max; trong miền ±90 và ±180). `prisma/seed-data/ward-bounds.json` có đúng 168 dòng, mã trùng từng mã với `wards.json`, làm tròn ra ngoài đến 5 chữ số thập phân, và mỗi hộp nới 0.0045 độ nằm trọn trong một trong hai khung thành phố. `npm run seed` điền hộp vào những phường còn rỗng, không ghi đè ô đã có giá trị, chạy lại nhiều lần vẫn đúng; phường admin thêm (không có trong file) giữ rỗng.
- **AC-7** (FE biết hộp): `GET /wards`, `POST /wards`, `PATCH /wards/:code` trả thêm `bounds` là `{ minLatitude, maxLatitude, minLongitude, maxLongitude }` hoặc `null`. Đây là hộp thô, chưa nới 0.0045 độ, nên FE ghim trong hộp thô thì luôn được nhận. Các trường cũ giữ nguyên. Phường lồng trong nhà trọ và tin (`property.ward`, `ward`) không đổi, không có `bounds`.
- **AC-8** (không đổi, dữ liệu cũ): Đọc nhà trọ và tin vẫn trả tọa độ đã lưu nguyên xi, kể cả dòng cũ ngoài vùng. Không đổi: miền ±90 và ±180 cùng luật đi cặp ở DTO, ba `CHECK` cũ của `properties`, quyền, sở hữu, giới hạn tần suất. Không có `CHECK` mới trên `properties`. `seed:demo` chạy được và mọi nhà trọ demo có tọa độ đều qua cả hai lớp (có test dữ liệu demo).
- **AC-9** (tài liệu): `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` nói đúng luật mới: hai khung, lề 500 m, quy tắc khi đổi phường, hai mã lỗi, `bounds`, và nói rõ FE tự ghim tọa độ từ địa chỉ (backend không geocode, không gọi dịch vụ bản đồ).

## Decision

**Chosen option**: Option 1: Hai khung thành phố cộng hộp bao của từng phường nới 500 m, kiểm trong Service; FE tự ghim tọa độ từ địa chỉ

Service kiểm tọa độ bằng hai hàm thuần (không gọi dịch vụ ngoài, không PostGIS): lớp 1 so với hai khung hằng số, lớp 2 so với bốn cột hộp của phường đã chọn cộng lề 0.0045 độ; luật chỉ nằm ở Service, không thêm `CHECK` vào `properties` (basis: spec 0002 AC-3 và `IsCoordinate`, luật đi cặp đã có; `prisma/seed-data/README.md`, nguồn của `wards.json`; kiểm bằng hộp bao thay cho hình học chính xác).

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`)

## Feature design

Quy ước chung theo 0001 đến 0011: Repository bọc Prisma, giao dịch qua `TransactionRunner`, lỗi qua `AppException`, tên cột `snake_case`, `CHECK` viết tay trong file migration (0005).

**Data model** (mô hình đã được bạn xác nhận ngày 2026-11-03):

| Bảng | Thay đổi | Ghi chú |
|---|---|---|
| `wards` (khóa chính `code`, 1 phường : N nhà trọ) | thêm `min_latitude`, `max_latitude`, `min_longitude`, `max_longitude`, kiểu `double precision`, cho phép rỗng | `CHECK` `wards_bounds_check`: bốn cột cùng rỗng, hoặc cùng có với `min <= max`, vĩ độ trong [-90, 90], kinh độ trong [-180, 180]. Không chỉ mục (đọc theo khóa chính). Trong `schema.prisma`: `minLatitude Float? @map("min_latitude")` và ba cột còn lại |
| `properties` | không đổi | Ba `CHECK` cũ giữ nguyên. **Không thêm `CHECK`**: nếu thêm bản `NOT VALID` thì mọi `UPDATE` một dòng cũ ngoài vùng (kể cả xóa mềm) sẽ lỗi, trái AC-5 (c) |

File seed `prisma/seed-data/ward-bounds.json`: mảng 168 phần tử `{ code, minLatitude, maxLatitude, minLongitude, maxLongitude }`, xếp theo `code`, làm tròn ra ngoài (min xuống, max lên) đến 5 chữ số thập phân (khoảng 1 m) để hộp không bao giờ co lại. Không bảng mới.

**State transitions**: không có.

**Hằng số** (trong `src/properties/coordinate-area.ts`):

| Hằng | Giá trị | Ý nghĩa |
|---|---|---|
| `CITY_BOXES` | đất liền `{ minLatitude: 10.2, maxLatitude: 11.7, minLongitude: 106.2, maxLongitude: 107.7 }`; Côn Đảo `{ minLatitude: 8.4, maxLatitude: 8.9, minLongitude: 105.9, maxLongitude: 106.9 }` | Cực trị thật của 168 phường làm tròn ra ngoài đến 0.1 độ rồi cộng thêm 0.1 độ (khoảng 11 km): đất liền vĩ độ 10.3203 đến 11.5010, kinh độ 106.3290 đến 107.5719; Côn Đảo (mã `26732`) vĩ độ 8.5771 đến 8.7787, kinh độ 106.0881 đến 106.7436 |
| `COORDINATE_MARGIN_DEGREES` | `0.0045` | Lề quanh hộp phường, khoảng 500 m (1 độ vĩ độ gần 111.3 km; kinh độ ở 10.8 độ Bắc ngắn hơn khoảng 2%, bỏ qua) |

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/properties` | POST | như spec 0002 (`latitude`, `longitude` tùy chọn, đi cặp) | 201 nhà trọ, không đổi | `property:create` | thêm 400 `COORDINATE_OUT_OF_AREA`, 400 `COORDINATE_FAR_FROM_WARD` |
| `/properties/:id` | PATCH | như spec 0002; luật mới ở AC-5 | nhà trọ, không đổi | `property:update` | thêm hai mã trên |
| `/wards` | GET | | mảng phường, mỗi phần tử thêm `bounds` | công khai | không đổi |
| `/wards` | POST | như spec 0002 (không nhận hộp) | phường, `bounds: null` | `catalog:create` | không đổi |
| `/wards/:code` | PATCH | như spec 0002 (không nhận hộp) | phường, `bounds` giữ nguyên | `catalog:update` | không đổi |

Mã lỗi mới (thêm vào `ErrorCode`, kèm câu tiếng Việt, theo 0004):

| Mã | Status | Khi nào |
|---|---|---|
| `COORDINATE_OUT_OF_AREA` | 400 | Tọa độ nằm ngoài cả hai khung thành phố. Câu: "Tọa độ nằm ngoài khu vực Thành phố Hồ Chí Minh." |
| `COORDINATE_FAR_FROM_WARD` | 400 | Tọa độ trong khung thành phố nhưng quá xa phường đã chọn. Câu: "Tọa độ quá xa phường hoặc xã đã chọn." |

Mỗi mã kèm `errors` hai mục (`latitude` và `longitude`, cùng `code`, `message` riêng). Câu của lớp 2 nêu tên phường, ví dụ "Tọa độ cách xa Phường Bến Thành. Hãy ghim lại trong hoặc sát ranh giới phường này." Khi lỗi đến từ tọa độ đang lưu (AC-5 b): "Tọa độ đang lưu của nhà trọ quá xa Phường Bến Thành. Hãy gửi tọa độ mới cùng phường mới, hoặc gửi latitude và longitude đều là null để xóa."

Ví dụ cho FE (bản đầy đủ ở `api-for-frontend.md`):

```ts
// FE tự ghim: dùng dịch vụ bản đồ của FE để đổi địa chỉ thành điểm; backend chỉ kiểm lại.
const ward = wards.find((w) => w.code === wardCode);
if (ward?.bounds) {
	const { minLatitude, minLongitude, maxLatitude, maxLongitude } = ward.bounds;
	map.fitBounds([[minLatitude, minLongitude], [maxLatitude, maxLongitude]]); // zoom về phường
}
// Ghim trong hộp thô này thì luôn được backend nhận (backend còn nới thêm 500 m).
```

**Value sourcing** (mọi giá trị mỗi hành động cần đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Tạo, sửa nhà trọ | tọa độ cần kiểm | `dto.latitude` và `dto.longitude` (cặp đã qua `IsCoordinate`: cùng là số trong miền, hoặc cùng `null`) |
| Tạo | phường để kiểm | dòng `wards` do `requireWard(dto.wardCode)` trả, đã kèm bốn cột hộp (không thêm truy vấn) |
| Sửa | phường hiệu lực | `dto.wardCode` nếu có và khác phường đang lưu (qua `requireWard`), nếu không thì `current.ward` đã có trong `findAddressSource` |
| Sửa khi đổi phường, không gửi tọa độ | tọa độ đang lưu | cột `properties.latitude` và `longitude`; `findAddressSource` hiện chưa chọn hai cột này nên thêm vào `select`; đọc sau `lockLiveById` |
| Mọi lần kiểm | hai khung thành phố | hằng `CITY_BOXES` |
| Lớp 2 | hộp phường | bốn cột của `wards`; một trong bốn rỗng (thực ra cả bốn rỗng, nhờ `CHECK`) thì bỏ lớp 2 |
| Lớp 2 | lề | hằng `COORDINATE_MARGIN_DEGREES`, cùng giá trị cho mọi phường, cộng vào cả hai trục |
| Câu lỗi lớp 2 | tên phường | `ward.name` của dòng đã đọc |
| Seed | hộp từng phường | `ward-bounds.json`, dựng bằng script từ GeoJSON phường của kho `thanglequoc/vietnamese-provinces-database` tag `v5.2.0` |
| `GET /wards` | `bounds` | bốn cột của `wards`; `null` khi chưa có hộp |
| Test dữ liệu | "mọi hộp nằm trong khung thành phố", "mọi tọa độ demo qua luật" | `ward-bounds.json`, `CITY_BOXES`, `demo-data.ts` |

**Cách chạy** (đặt đúng thứ tự này):
1. `coordinate-area.ts` chứa các hàm thuần: `isInsideCity(latitude, longitude)` (đúng biên là trong), `toWardBounds(ward)` (trả `null` nếu cột rỗng), `isNearWard(latitude, longitude, bounds)` (so với hộp nới `COORDINATE_MARGIN_DEGREES` mỗi phía, đúng biên là trong). Không truy vấn, không ném lỗi.
2. `PropertiesService` thêm một hàm riêng `requireCoordinateAllowed(point, ward, origin)` (`origin` là `sent` hoặc `stored`, chỉ để chọn câu lỗi): `isInsideCity` sai thì ném `COORDINATE_OUT_OF_AREA`; còn `toWardBounds(ward)` có hộp mà `isNearWard` sai thì ném `COORDINATE_FAR_FROM_WARD`.
3. Tạo: trong giao dịch hiện có, sau `requireWard` và `requireAmenities`, nếu `dto.latitude` là số thì gọi `requireCoordinateAllowed` với `ward` vừa đọc. `null` hay vắng thì không gọi.
4. Sửa: sau khóa dòng, `assertOwner`, `findAddressSource` (nay có `latitude`, `longitude`), phường hiệu lực và `requireAmenities`: nếu `dto.latitude` là số thì kiểm cặp trong body (`origin = sent`); nếu không gửi tọa độ mà phường đổi sang mã khác `current.wardCode` và `current.latitude` khác `null` thì kiểm tọa độ đang lưu (`origin = stored`); còn lại không kiểm. Kiểm xong mới ghi.
5. Seed: sau `createMany` của `wards`, với mỗi dòng trong `ward-bounds.json` chạy `updateMany({ where: { code, minLatitude: null }, data })`; ô đã có giá trị không bao giờ bị ghi đè. Log số phường vừa điền.
6. Catalog: `WardCatalogResponse` (mở rộng `WardResponse` với `bounds`) và `toWardCatalogResponse` chỉ dùng cho `GET /wards`, `POST /wards`, `PATCH /wards/:code`; `toWardResponse` và `WardResponse` giữ nguyên cho phường lồng trong nhà trọ và tin.

**Key invariants**:
- Sau mọi lần ghi có gửi tọa độ hoặc đổi phường, tọa độ đang lưu của nhà trọ (nếu có) nằm trong một khung thành phố và, nếu phường có hộp, trong hộp nới 0.0045 độ của phường.
- Ghi không đụng tới tọa độ hay phường thì không kiểm gì, nên dòng cũ ngoài vùng vẫn sửa được các trường khác.
- Luật nằm ở Service (hai lớp), DB chỉ giữ ba `CHECK` cũ của `properties` và `wards_bounds_check`.
- Hộp phường là dữ kiện danh mục: chỉ migration và seed ghi; API admin hiện không sửa được.
- Cùng một lề cho mọi phường; cùng hai khung cho mọi nhà trọ.

**Security model**:
- Không đổi: quyền `property:create` và `property:update`, kiểm chủ sở hữu bằng `assertOwner`, giới hạn tần suất ghi hiện có. `GET /wards` vẫn công khai; thêm hộp phường không lộ gì riêng tư (dữ kiện địa lý công khai).
- Tọa độ nhà trọ là vị trí nhà cho thuê (đã công khai trên tin), không phải dữ liệu cá nhân của người dùng; không phạm vi tuân thủ riêng.
- Backend không gọi dịch vụ bản đồ nào, nên không có khóa bí mật, hạn mức gọi hay chi phí mới. GeoJSON gốc (khoảng 19 MB) chỉ dùng lúc dựng file, không nằm trong repo và không có lúc chạy.

**Configuration required**: không biến môi trường mới. Hai khung và lề là hằng số trong code (đổi bằng sửa code, không phải cấu hình).

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: tạo nhà trọ ở "Phường Bến Thành" với một điểm trong phường rồi sửa sang điểm khác trong phường: 201 và 200, tọa độ lưu và trả như cũ; Côn Đảo với điểm trên đảo được nhận, verifies **AC-1**, **AC-2**
- Failure case: Hà Nội, (0, 0), (9.5, 106.5), (10.5, 108.5) ở POST và PATCH: 400 `COORDINATE_OUT_OF_AREA`, `errors` đúng `latitude` và `longitude`, không có dòng nhà trọ, phí, tiện ích mới và PATCH không đổi trường nào (so trước và sau), verifies **AC-1**
- Failure case: điểm ở phường khác, cách xa phường đã chọn: 400 `COORDINATE_FAR_FROM_WARD` nêu tên phường; điểm đúng biên hộp nới thì nhận, lệch thêm một phần triệu độ thì 400; ba cỡ phường (Bình Tây nhỏ nhất, An Thới Đông lớn nhất, Côn Đảo) cùng đúng; phường admin vừa tạo (không hộp) nhận mọi điểm trong khung, verifies **AC-2**
- Failure case: thứ tự lỗi khi sai nhiều thứ cùng lúc (mã phường lạ kèm điểm ở Hà Nội ra `WARD_UNKNOWN`; tiện ích lạ kèm điểm xa phường ra `AMENITY_UNKNOWN`; chủ khác kèm điểm sai ra 403; một tọa độ ra `VALIDATION_FAILED`), verifies **AC-3**
- Happy path: POST không tọa độ ở phường bất kỳ; PATCH `null` cả hai xóa được, kể cả nhà trọ cũ có tọa độ ngoài vùng (chèn thẳng bằng SQL để thử), verifies **AC-4**
- Failure case: PATCH chỉ đổi `wardCode` sang phường xa nhà trọ đang có tọa độ: 400, câu nói đây là tọa độ đang lưu, dòng không đổi; gửi kèm tọa độ mới hợp lệ thì thành công; nhà trọ không tọa độ đổi phường được; PATCH chỉ sửa `name` của nhà trọ cũ ngoài vùng thành công; gửi đúng `wardCode` hiện tại cũng không kiểm; hai PATCH đồng thời (đổi phường và đổi tọa độ) cho trạng thái cuối vẫn qua luật, verifies **AC-5**
- Happy path: sau `migration:deploy` và `seed`, 168 phường có hộp; `seed` lần hai không đổi gì; sửa tay một hộp trong DB rồi `seed` lại thì giá trị đó không bị ghi đè; `wards_bounds_check` từ chối ba ca (chỉ một cột có giá trị, min lớn hơn max, ngoài miền), verifies **AC-6**
- Happy path: `GET /wards` có `bounds` đúng số liệu của file; `POST /wards` trả `bounds: null`; `property.ward` và `ward` trong tin không có `bounds`, verifies **AC-7**
- Không đổi: đọc nhà trọ cũ ngoài vùng vẫn trả đúng tọa độ; `seed:demo` chạy lại không lỗi và test dữ liệu demo qua cả hai lớp; test biên dịch ba `CHECK` cũ, verifies **AC-8**
- Điều khiển âm (phá cố ý rồi xem phép kiểm có bắt không): bỏ lề thì ca "đúng biên nới" trượt; bỏ kiểm tọa độ đang lưu khi đổi phường thì ca đổi phường để lọt điểm cũ; bỏ khóa dòng khi đọc tọa độ đang lưu thì ca hai PATCH đồng thời lọt; đổi `toWardBounds` thành luôn có hộp thì ca phường không hộp bắt được, verifies **AC-2**, **AC-5**

## Build plan

Hướng build theo Skateboard (làm bản mỏng nhất dùng được trước, rồi mới mở rộng): mốc 1 là khung thành phố, không cần dữ liệu hay migration mới nhưng đã chặn được điểm ở Hà Nội và giữa biển; mốc 2 thêm hộp phường (dữ liệu, migration, seed, lớp 2, luật đổi phường, `bounds` cho FE). Mỗi mốc là một lần `/develop` rồi dừng cho bạn review. Tài liệu sống `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` cập nhật trong từng mốc.

**Mốc 1: khung thành phố (lớp 1)**
1. `src/properties/coordinate-area.ts`: `CITY_BOXES` và `isInsideCity`; test đơn vị (bốn góc và bốn cạnh mỗi khung là trong; ngay sát ngoài biên là ngoài; Hà Nội, (0, 0), (9.5, 106.5), (10.5, 108.5) là ngoài; Vũng Tàu, Củ Chi, Côn Đảo là trong), satisfies **AC-1**
2. `ErrorCode.COORDINATE_OUT_OF_AREA` (400, câu tiếng Việt) và mọi nơi liệt kê mã lỗi (có test bảng mã), satisfies **AC-1**, **AC-3**
3. `PropertiesService`: hàm `requireCoordinateAllowed` (mới chỉ có lớp 1), gọi ở `create` và `update` theo "Cách chạy" mục 2 đến 4 trừ phần đổi phường (để mốc 2); test đơn vị (ngoài khung thì 400 và không gọi repository ghi, thứ tự sau `WARD_UNKNOWN` và `AMENITY_UNKNOWN`, `null` và vắng không kiểm, PATCH không đụng tọa độ không kiểm, nhà trọ cũ ngoài vùng sửa tên được), satisfies **AC-1**, **AC-3**, **AC-4**, **AC-5** (a, c)
4. Test `demo-data.spec.ts`: mọi tọa độ demo nằm trong khung thành phố; kiểm thật trên DB thử (các điểm ngoài khung ở POST và PATCH, so trước và sau, nhà trọ cũ chèn bằng SQL, điều khiển âm bỏ kiểm); Postman thêm request cho ca lỗi mới (không đăng nhập admin thêm lần nào); `api-for-frontend.md` (mục nhà trọ: luật hai khung, mã lỗi mới, FE tự ghim; bảng mã lỗi; Phụ lục kiểu dữ liệu và lỗi), chạy lại unit, lint, Newman hai lượt liền, satisfies **AC-1**, **AC-8**, **AC-9**

**Mốc 2: hộp phường (lớp 2)**
5. `schema.prisma` thêm bốn cột `Float?` cho `Ward` và migration `20261103090000_ward_bounds` (bốn `ADD COLUMN`, rồi `CHECK` `wards_bounds_check` viết tay bằng SQL); `prisma generate`; kiểm `prisma migrate diff` không lệch và áp lên DB có sẵn 168 phường không lỗi, satisfies **AC-6**
6. `src/database/scripts/build-ward-bounds.ts`: đọc một thư mục các tệp GeoJSON phường (đường dẫn truyền vào), tính hộp từ mọi đỉnh, làm tròn ra ngoài đến 5 chữ số, xếp theo `code`, ghi `ward-bounds.json`; từ chối ghi nếu mã không trùng đúng 168 mã của `wards.json`. Chạy một lần với 168 tệp của `json/geojson/79_ho_chi_minh/wards/` tag `v5.2.0`. `prisma/seed-data/README.md` ghi nguồn, tag, ngày dựng, số liệu kiểm (168 trên 168, cực trị), cách tải lại và ghi chú giấy phép dữ liệu ranh giới chưa nêu; `seed-data.ts` thêm `loadWardBoundsSeed`; `seedCatalog` điền hộp vào ô rỗng theo "Cách chạy" mục 5; test (`seed-data.spec.ts`: 168 dòng, mã trùng `wards.json`, min không lớn hơn max, đúng 5 chữ số, mỗi hộp nới 0.0045 nằm trong một khung thành phố; test seed: điền khi rỗng, chạy lại không đổi, không ghi đè), satisfies **AC-6**
7. `WardCatalogResponse` và `toWardCatalogResponse` cho `GET /wards`, `POST /wards`, `PATCH /wards/:code`; phường lồng trong nhà trọ và tin giữ `toWardResponse`; test mapper và catalog (có `bounds`, `null` khi rỗng, nhà trọ và tin không có `bounds`), satisfies **AC-7**
8. `ErrorCode.COORDINATE_FAR_FROM_WARD` (400, câu tiếng Việt); `coordinate-area.ts` thêm `COORDINATE_MARGIN_DEGREES`, `toWardBounds`, `isNearWard`; test đơn vị (trong hộp, đúng biên hộp nới tính bằng chính biểu thức trong code, lệch thêm một phần triệu độ thì ngoài, hộp rỗng thì `null`, ba cỡ phường thật Bình Tây, An Thới Đông, Côn Đảo), satisfies **AC-2**
9. `PropertiesService`: thêm lớp 2 vào `requireCoordinateAllowed`; `PropertiesRepository.findAddressSource` chọn thêm `latitude` và `longitude`; luật đổi phường (AC-5 b) ở `update`; câu lỗi nêu tên phường và phân biệt `sent` với `stored`; test đơn vị (thứ tự lỗi đủ chuỗi AC-3, đổi phường kèm hoặc không kèm tọa độ, nhà trọ không tọa độ, gửi đúng phường hiện tại, phường không hộp), satisfies **AC-2**, **AC-3**, **AC-5**
10. Dữ liệu demo: chỉnh tọa độ demo cho qua lớp 2 (đã đo ngày 2026-11-03: Phú Nhuận mã `27073` cách hộp 0.54 km và Bình Trị Đông mã `27448` cách hộp 1.21 km, cần dời vào trong; các nhà trọ còn lại đã qua hoặc sát hộp, đo lại bằng test); `demo-data.spec.ts` kiểm mọi tọa độ demo qua cả hai lớp bằng `ward-bounds.json`, satisfies **AC-8**
11. Kiểm thật trên DB thử (migration, `seed` hai lần và ca không ghi đè, từng ca ở "Critical test scenarios" gồm điểm biên, đổi phường, nhà trọ cũ, phường admin tạo không hộp, hai PATCH đồng thời, bốn điều khiển âm); Postman thêm request cho ca lớp 2, đổi phường và `bounds` (không đăng nhập admin thêm lần nào); `api-for-frontend.md` (mục nhà trọ và mục phường, bảng mã lỗi, FE zoom về hộp phường, Phụ lục A, B, C, nhật ký), `verify.md` của spec; chạy lại toàn bộ unit, lint, Newman hai lượt liền, satisfies **AC-2** đến **AC-9**

## Migration plan

**Strategy**: no migration needed cho dữ liệu cũ (thêm cột cho phép rỗng, điền bằng seed, rồi luật mới đọc cột; không `NOT NULL`, không `CHECK` mới trên bảng nhà trọ).
**Phases**:
1. Mốc 1 triển khai không đụng database: chỉ code Service và mã lỗi.
2. Mốc 2: `npm run migration:deploy` (thêm bốn cột và `CHECK`), rồi chạy `npm run seed` một lần để điền hộp, rồi mới chạy bản code mới. Nếu bản code lên trước khi seed chạy thì hộp rỗng và lớp 2 im lặng tắt (chỉ còn lớp 1) cho đến khi seed chạy.
**Rollback**: revert commit code; bốn cột và `CHECK` ở lại vô hại. Muốn gỡ hẳn thì viết tay `ALTER TABLE wards DROP CONSTRAINT wards_bounds_check, DROP COLUMN ...` (Prisma không sinh migration lùi).
**Risks**: FE gửi điểm ngoài vùng hay sai phường sẽ nhận 400 mới (thay đổi hành vi, không đổi hình dạng body); phường admin thêm không có hộp nên không được kiểm lớp 2; seed quên chạy thì lớp 2 tắt mà không báo.

## Consequences

**Positive**:
- Điểm ở Hà Nội, nước ngoài hay giữa biển bị chặn, và điểm ở phường khác bị chặn, với mã lỗi riêng nên FE báo đúng câu.
- Không dịch vụ ngoài, không PostGIS, không biến môi trường, không khóa bí mật; dữ liệu mới chỉ 168 hàng × 4 số.
- FE nhận hộp phường nên zoom bản đồ đúng phường và chặn chỗ ghim đúng điều backend nhận, nên chủ trọ hiếm khi gặp lỗi.
- Dữ liệu nguồn cùng kho, cùng phiên bản, cùng mã với `wards.json` (đã kiểm 168 trên 168), nên không có phép ghép mã mơ hồ.

**Negative / tradeoffs**:
- Hộp bao thô hơn đường ranh thật: góc hộp không thuộc phường vẫn qua, nhất là phường dài và chéo. Chấp nhận vì mục tiêu là "gần phường", không phải "đúng trong ranh giới".
- Hộp Côn Đảo rộng khoảng 22 km × 71 km và phần lớn là biển (đặc khu gồm các đảo nhỏ ở xa), nên một điểm trên biển trong hộp đó vẫn qua.
- Lề 500 m cho phép điểm sát biên phường lân cận qua; ở phường nhỏ nhất (khoảng 0.9 km × 1.9 km) lề này đáng kể.
- Nhà trọ cũ ngoài vùng không bị dọn, chỉ bị kiểm khi gửi tọa độ mới hoặc đổi phường (bạn đã chọn ngày 2026-11-03 vì đây là DB demo).
- Phường admin thêm qua API không có hộp và API hiện không nhận hộp, nên chỉ bị lớp 1.
- Mốc ranh giới do bên thứ ba dựng: dữ liệu nguồn nêu đơn vị cấp xã theo bản đồ sau sáp nhập, nhưng giấy phép của chính dữ liệu ranh giới không được nêu (kho là MIT cho mã nguồn). Ta chỉ giữ 4 số làm tròn mỗi phường, không giữ hình dạng. Phường nào đổi sau phiên bản `v5.2.0` thì phải dựng lại file.
- Đổi quy ước seed một chút: ngoài "chỉ thêm dòng còn thiếu" (0005, 0002 AC-1), seed nay còn điền ô hộp còn rỗng của dòng đã có (không ghi đè ô nào đã có giá trị).
- FE phải xử lý hai mã lỗi mới và nên đổi biểu mẫu để ghim trong hộp phường.
- Hai tọa độ demo phải dời để qua luật mới.

**Neutral**:
- `findAddressSource` đọc thêm hai cột; `PropertiesService` thêm một hàm riêng; `CatalogModule` thêm một kiểu phản hồi.
- Số `0012` là số kế tiếp trong `docs/specs/`. Spec này thêm luật cho AC-3 của spec 0002 (luật miền ±90 và ±180 cùng luật đi cặp vẫn đúng); sau khi bạn xác nhận, `0002` có một dòng trỏ sang spec này.
- Backend không geocode, nên quyết định "ai ghim" nằm hẳn ở FE; nếu sau này FE cần backend làm, đó là một spec riêng.

## Follow-up

- [ ] FE: tự ghim tọa độ từ địa chỉ bằng dịch vụ bản đồ của FE, dùng `bounds` để zoom và giới hạn chỗ ghim, xử lý hai mã lỗi mới và lỗi khi đổi phường (backend không làm việc này).
- [ ] Hoãn, thêm lại bằng `/scope` khi cần: kiểm theo đường ranh chính xác (PostGIS), cho `POST /wards` và `PATCH /wards/:code` nhận hộp, dọn tọa độ cũ ngoài vùng, endpoint geocode phía backend.
- [ ] Sau khi build, `/sync` rà `0002` (AC-3 và dòng "Phí và tọa độ nhà trọ"), `0005` (dòng quy ước seed) và README của `prisma/seed-data`.
- [ ] Còn mở: giấy phép của dữ liệu ranh giới gốc (bản đồ tham chiếu đơn vị hành chính do nhà xuất bản của Bộ Nông nghiệp và Môi trường phát hành) không được nêu trong kho nguồn; xác nhận trước khi công bố repo công khai.
- [ ] Hộp phường là số liệu theo bản dữ liệu `v5.2.0` (ngày 2026-09-21); khi `wards.json` được dựng lại từ phiên bản mới thì dựng lại `ward-bounds.json` cùng lúc bằng script.

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
