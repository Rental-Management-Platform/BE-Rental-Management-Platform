# 0009. Danh sách tin đang hiện trên hồ sơ chủ trọ

**Date**: 2026-10-21
**Status**: Accepted

## Summary

Hồ sơ công khai của chủ trọ (spec 0005) mới chỉ cho biết chủ trọ có bao nhiêu tin đang hiện, chưa cho xem đó là những tin nào. Spec này thêm một API đọc `GET /landlords/:id/listings` trả đúng những tin đó, có phân trang, mới đăng trước, mỗi phần tử giống hệt tin trong danh sách tìm trọ (kể cả cờ `isFavorite`). Danh sách dùng lại hai mảnh SQL hiển thị công khai có sẵn nên không thể lệch với `GET /listings`, và `total` luôn bằng `publicListingCount` của hồ sơ. Không bảng mới, không migration, không mã lỗi mới, không biến môi trường mới.

## Requirements

**User stories**:
- Là người tìm trọ (hoặc khách), tôi muốn mở hồ sơ một chủ trọ rồi xem các tin đang hiện của họ, để so sánh và chọn phòng từ một chủ trọ mà tôi tin.
- Là người tìm trọ đã đăng nhập, tôi muốn thấy ngay tin nào trong danh sách đó mình đã lưu, để tô biểu tượng tim mà không gọi thêm API.
- Là chủ trọ, tôi muốn người xem hồ sơ của tôi thấy đúng những tin đang hiện công khai, không thấy tin đã ẩn, để hồ sơ phản ánh đúng thứ mà người tìm trọ mở được.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `GET /landlords/:id/listings` không cần đăng nhập, trả 200 `{ items, total, page, pageSize }` với `page`, `pageSize` như các danh sách khác (mặc định trang 1 và 20 dòng, `pageSize` tối đa 50). Mỗi phần tử có đúng các trường của một phần tử `GET /listings` (tin tóm tắt công khai, gồm `landlord` và `isFavorite`). Thứ tự mới đăng trước (`created_at` giảm dần, rồi `id` giảm dần, như kiểu `newest` của `GET /listings`). Phản hồi có `Cache-Control: private, no-store`.
- **AC-2**: `items` chỉ gồm tin của chủ trọ trong đường dẫn và thỏa đúng điều kiện hiển thị công khai ngay lúc đọc. Tin bị chủ trọ hay admin ẩn, đã xóa mềm, nhà trọ đã xóa mềm, chủ trọ hết dùng thử và hết gói, hoặc bị ẩn bớt vì vượt hạn mức đều không hiện. Một tin nằm trong danh sách khi và chỉ khi khách mở được nó ở `GET /listings/:slugCode`. Không bao giờ có tin của chủ trọ khác.
- **AC-3**: `total` bằng `publicListingCount` của `GET /landlords/:id` cho cùng chủ trọ, và bằng số tin của chủ trọ đó mà `GET /listings` trả (cộng mọi trang). Chủ trọ hết dùng thử và hết gói thì 200 với `items` rỗng và `total` 0 (hồ sơ vẫn xem được).
- **AC-4**: Id không phải chủ trọ đang hoạt động (không tồn tại, là `tenant` hay `admin`, chủ trọ đang bị khóa hoặc đã xóa mềm) bị 404 `LANDLORD_NOT_FOUND`, cùng định nghĩa "chủ trọ hợp lệ" với hồ sơ (spec 0005). Id sai định dạng UUID bị 400 `INVALID_ID`. Khóa rồi mở khóa chủ trọ thì danh sách trở lại như cũ.
- **AC-5**: `isFavorite` mỗi phần tử là `null` với khách, token sai hoặc hết hạn (không bao giờ 401); là `true` hoặc `false` với người đã đăng nhập, theo dòng lưu của chính họ (chủ trọ và admin đăng nhập nhận `false`). Đúng quy tắc của `GET /listings` (spec 0006 AC-6).
- **AC-6**: `page` từ 1, `pageSize` từ 1 đến 50; giá trị ngoài biên, hoặc tham số ngoài `page` và `pageSize` (ví dụ `sort`, `q`, `wardCode`), bị 400 `VALIDATION_FAILED`. Trang vượt cuối vẫn 200 với `items` rỗng và `total` đúng.
- **AC-7**: Phần tử không có số điện thoại, email, `viewCount`, trạng thái hay lý do ẩn. Liệt kê không ghi gì và không cộng lượt xem cho tin nào. Hợp đồng của `GET /landlords/:id` (đúng 7 trường) và của `GET /listings` không đổi.
- **AC-8**: Route dùng nhóm giới hạn `publicRead` có sẵn (300 lần mỗi phút theo IP). Vượt thì 429 `RATE_LIMITED` kèm `Retry-After`. Không nhóm giới hạn mới.

## Decision

**Chosen option**: Option 1: Route lồng dưới hồ sơ, `GET /landlords/:id/listings`, dùng lại truy vấn danh sách công khai với thêm một điều kiện theo chủ trọ

Hồ sơ vẫn trả bảy trường như cũ; danh sách là một API đọc riêng cạnh nó, tra chủ trọ hợp lệ bằng đúng hàm của hồ sơ (404 giống hồ sơ), rồi đọc trang tin bằng `findPublicPage` đã có, thêm điều kiện `p.landlord_id`, nên hai mảnh SQL hiển thị công khai không đổi dòng nào.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`)

## Feature design

Quy ước chung theo 0001 đến 0008: Repository bọc Prisma, đọc thô bằng `$queryRaw` chỉ nằm trong file `*.repository.ts` (luật lint), tên cột `snake_case`.

**Data model**: không có bảng, cột hay migration mới. `properties.landlord_id` đã có chỉ mục `properties_landlord_id_idx`, đủ để thu hẹp theo chủ trọ. `schema.prisma` không đổi.

**State transitions**: không có. Danh sách suy ra lúc đọc từ trạng thái tin, nhà trọ, chủ trọ, kỳ dùng thử và kỳ gói.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/landlords/:id/listings` | GET | `id` (UUID, đường dẫn); `page`, `pageSize` (query) | 200 trang tin đang hiện công khai của chủ trọ | công khai, đọc đăng nhập tùy chọn (`@OptionalAuth()`) | 400 `INVALID_ID`, 400 `VALIDATION_FAILED` (phân trang sai hoặc tham số lạ), 404 `LANDLORD_NOT_FOUND`, 429 |

Hình dạng trả về (mỗi phần tử đúng như phần tử của `GET /listings`, spec 0002 và 0006):

```json
{
  "items": [
    {
      "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d11",
      "code": "k3m9x2ab",
      "slug": "phong-tro-gan-dai-hoc",
      "title": "Phòng trọ gần đại học",
      "price": 3000000,
      "areaM2": 20,
      "deposit": null,
      "availableFrom": null,
      "coverImageUrl": "/api/v1/media/public/0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d21.jpg",
      "ward": { "code": "26734", "name": "Phường Bến Thành" },
      "addressText": "5 Đường Thử",
      "fullAddress": "5 Đường Thử, Phường Bến Thành, Thành phố Hồ Chí Minh",
      "landlord": { "id": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d01", "name": "Anh Nam" },
      "createdAt": "2026-10-05T03:00:00.000Z",
      "isFavorite": false
    }
  ],
  "total": 2,
  "page": 1,
  "pageSize": 20
}
```

`landlord` vẫn có trong mỗi phần tử dù cả trang cùng một chủ trọ, để FE dùng lại đúng một thẻ tin cho cả hai danh sách. Không có mã lỗi mới: dùng `LANDLORD_NOT_FOUND`, `INVALID_ID`, `VALIDATION_FAILED`, `RATE_LIMITED` đã có.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi**: route kiểm `:id` (400 `INVALID_ID`) và query (400 `VALIDATION_FAILED`) trước khi vào Service; Service tra chủ trọ hợp lệ (404 `LANDLORD_NOT_FOUND`) rồi mới đọc trang. Chủ trọ không hợp lệ thì không đọc `settings`, không đọc trang, không đọc cờ yêu thích.
- **Chủ trọ hợp lệ** là dòng `users` có `account_type = 'landlord'`, `status = 'active'` và `deleted_at IS NULL`, tra bằng `LandlordsRepository.findActiveLandlord` đúng như hồ sơ.
- **Đọc trang**: `ListingsRepository.findPublicPage` nhận thêm trường tùy chọn `landlordId` trong `PublicListFilter`; có giá trị thì `filterConditions` nối `p.landlord_id = <id>::uuid` vào `WHERE` cùng `publicListingCondition`. `GET /listings` không đặt trường này nên không đổi. Bộ lọc gửi vào là `searchWords: []`, `sort: 'newest'`, không phường, không giá. Đọc hai bước như cũ (spec 0003): hai câu SQL thô chạy song song lấy `id` của trang và `total`, rồi Prisma lấy dữ liệu theo `id` với `publicSummaryInclude`. Tin bị xóa giữa hai bước thì trang ngắn hơn một dòng (chấp nhận như `GET /listings`).
- **`total` và `publicListingCount`** cùng hai mảnh SQL và cùng điều kiện `p.landlord_id`, nên bằng nhau tại cùng một thời điểm. Hai API đọc ở hai lúc khác nhau nên có thể lệch vài mili giây khi dữ liệu đổi giữa chừng; chấp nhận.
- **`isFavorite`**: khách thì `null` và không đọc `favorites`; người đã đăng nhập thì một truy vấn `FavoritesRepository.findSavedIds(viewerId, ids của trang)` rồi gắn cờ bằng `toPublicSummary`. Cùng quy tắc với `ListingsService.listPublic`.
- **Cache**: `Cache-Control: private, no-store` vì `isFavorite` đổi theo người xem.
- **Chủ trọ bị khóa giữa hai bước** (sau khi tra, trước khi đọc trang): điều kiện hiển thị đòi `u.status = 'active'` nên trang rỗng, `total` 0; không lộ gì.
- **Module**: thêm `LandlordsService.listListings(landlordId, query, viewerId, now)` và route `GET :id/listings` trong `LandlordsController`; `LandlordsModule` import thêm `FavoritesDataModule` (chỉ chứa `FavoritesRepository`, không vòng). Không đụng `ListingsModule`.
- **Hiệu năng**: điều kiện `p.landlord_id` thu hẹp bằng `properties_landlord_id_idx` trước khi tính hạng. Đo `EXPLAIN` một lần ở 60 nghìn tin, ghi số, không chỉnh nếu chậm (MVP).

**Giới hạn tần suất**: dùng nhóm `publicRead` có sẵn (`ip`: 300 lần mỗi phút), không nhóm mới, không đổi bảng `RATE_LIMITS`.

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Liệt kê | chủ trọ cần xem (`p.landlord_id`) | tham số đường dẫn `:id`, qua `uuidParam()` |
| Liệt kê | chủ trọ có hợp lệ không | `LandlordsRepository.findActiveLandlord(:id)`, cùng định nghĩa với hồ sơ (spec 0005) |
| Liệt kê | những tin nào, và `total` | `ListingsRepository.findPublicPage` với `landlordId = :id`, cùng `publicListingFrom(now)` và `publicListingCondition(now, trialListingLimit)` |
| Liệt kê | `now` | `new Date()` do controller lấy một lần mỗi request |
| Liệt kê | `trialListingLimit` | `SettingsService.getValue('trial_listing_limit')`, đọc một lần mỗi request, giống `GET /listings` và hồ sơ |
| Liệt kê | thứ tự | `l.created_at DESC, l.id DESC` (kiểu `newest`), cố định trong Service, không nhận từ client |
| Liệt kê | `page`, `pageSize`, `skip` | query qua `PaginationQueryDto`, `skipOf` |
| Liệt kê | các trường tin tóm tắt | cùng `publicSummaryInclude` và cùng hàm `toListingSummary` với `GET /listings`, nên `slug`, `fullAddress`, `coverImageUrl` giống hệt |
| Liệt kê | `isFavorite` | người xem lấy từ token (`@OptionalUser()`): khách `null`; đã đăng nhập thì có dòng `favorites` (`sub`, `listing_id`) hay không |

**Key invariants**:
- Mọi dòng trả về thỏa `p.landlord_id = :id`; không bao giờ có tin của chủ trọ khác.
- Một tin nằm trong danh sách khi và chỉ khi khách mở được nó ở chi tiết công khai, vì dùng đúng hai mảnh SQL chung và không có bản sao điều kiện.
- `total` dùng cùng điều kiện với `publicListingCount`.
- `GET` không ghi gì: không cộng lượt xem tin, không đụng `follows` hay `favorites`.
- `isFavorite` chỉ nói về chính người xem; không API nào lộ ai đã lưu tin nào.
- Hợp đồng của hồ sơ (7 trường) và của `GET /listings` không đổi.

**Security model**:
- Công khai, đọc đăng nhập tùy chọn: token sai hay hết hạn coi như khách, không bao giờ 401. Khách thấy đúng những gì `GET /listings` cho khách thấy: không số điện thoại, không email.
- Chủ trọ hay admin đăng nhập xem được danh sách này như mọi người; không quyền riêng. Chủ trọ bị khóa trả 404 giống hồ sơ, nên không ai phân biệt được "bị khóa" với "không tồn tại".
- Tin bị admin ẩn không xuất hiện và không lộ lý do ẩn.
- Không dữ liệu nào thuộc phạm vi tuân thủ riêng.

**Configuration required**: không có biến môi trường, không dịch vụ ngoài, không seed, không migration.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: chủ trọ có 3 tin hiện (ba thời điểm đăng khác nhau): `GET /landlords/:id/listings` trả 3 phần tử, mới đăng trước, đủ các trường của phần tử `GET /listings`, `total` 3, bằng `publicListingCount` của hồ sơ và bằng số tin của chủ trọ đó trong `GET /listings` cộng mọi trang, verifies **AC-1**, **AC-3**
- Failure case: chủ trọ có tin do chủ trọ ẩn, tin do admin ẩn, tin xóa mềm, nhà trọ xóa mềm, tin vượt hạn mức; chủ trọ khác cũng có tin: danh sách chỉ có các tin đang hiện của đúng chủ trọ, đối chiếu với một phép tính độc lập từ dòng thô ở các hạn mức 5, 3, 1, 0, verifies **AC-2**, **AC-3**
- Failure case: chủ trọ hết dùng thử và chưa có gói: 200, `items` rỗng, `total` 0, hồ sơ vẫn 200 với `publicListingCount` 0; mua gói thì tin trở lại, verifies **AC-3**
- Failure case: id của một tenant, của admin, id không tồn tại, chủ trọ bị khóa, chủ trọ xóa mềm: 404 `LANDLORD_NOT_FOUND`; id `abc`: 400 `INVALID_ID`; khóa rồi mở khóa thì danh sách trở lại như cũ, verifies **AC-4**
- Happy path: khách, token sai, token hết hạn thật, người tìm trọ đã lưu một tin, chủ trọ, admin cùng mở một danh sách: `isFavorite` là `null` cho ba loại đầu, đúng `true` hoặc `false` cho người tìm trọ, `false` cho chủ trọ và admin, không 401, verifies **AC-5**
- Failure case: `pageSize=51`, `page=0`, `sort=price_asc`, `q=abc`: 400 `VALIDATION_FAILED`; `page` vượt cuối: 200 `items` rỗng, `total` đúng; hai trang liên tiếp không trùng và không sót phần tử, verifies **AC-6**
- Phản hồi không lộ: không khóa `phone`, `email`, `viewCount`, `status`, `moderationReason` trong phần tử; sau khi gọi danh sách, `view_count` của các tin không đổi; hồ sơ vẫn đúng 7 trường và `GET /listings` không đổi trường nào, verifies **AC-7**
- Auth/permission: vượt 300 lần mỗi phút nhận 429 `RATE_LIMITED` kèm `Retry-After`, verifies **AC-8**
- Điều khiển âm (phá cố ý rồi xem phép kiểm có bắt không): bỏ điều kiện `p.landlord_id` thì lộ tin của chủ trọ khác; bỏ bước tra chủ trọ thì chủ trọ bị khóa nhận 200 thay vì 404; cờ `isFavorite` luôn `false` thì người đã lưu không thấy tim, verifies **AC-2**, **AC-4**, **AC-5**
- Kiểm bằng `EXPLAIN` (không phải test tự động): danh sách ở khoảng 60 nghìn tin với một chủ trọ nổi có vài trăm tin; đo một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-2**

## Build plan

Hướng build theo Skateboard (bản mỏng nhất dùng được trước, rồi mới mở rộng): tính năng chỉ là một API đọc nên đi trọn một mốc, không có phần ghi hay migration để tách. Một cột mốc, một lần `/develop` rồi dừng cho bạn review (khớp ô `Build it` trong scope). Cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong mốc (quy tắc tài liệu sống), gắn `@RateLimited` ngay khi tạo route.

**Mốc 1: danh sách tin đang hiện của chủ trọ**
1. `PublicListFilter` thêm `landlordId?: string`; `filterConditions` nối `p.landlord_id = <id>::uuid` khi có; `GET /listings` không đặt trường này nên không đổi; test đơn vị của Repository (câu SQL có điều kiện khi có `landlordId`, không có khi vắng), satisfies **AC-1**, **AC-2**, **AC-3**
2. `LandlordsService.listListings(landlordId, query, viewerId, now)`: tra chủ trọ hợp lệ (404), đọc `trial_listing_limit` một lần, gọi `findPublicPage` với `landlordId`, `sort: 'newest'`, đọc `findSavedIds` cho người đã đăng nhập, ánh xạ bằng `toPublicSummary`, đóng gói bằng `toPage`; `LandlordsModule` import `FavoritesDataModule`; test đơn vị của Service (chủ trọ không hợp lệ không đọc gì thêm, khách `null`, người đăng nhập `true` hoặc `false`, trang rỗng không đọc cờ), satisfies **AC-1** đến **AC-5**
3. Route `GET :id/listings` trong `LandlordsController`: `@OptionalAuth()`, `@RateLimited('publicRead')`, `@Header('Cache-Control', 'private, no-store')`, `uuidParam()`, `PaginationQueryDto`, `@OptionalUser()`, `now` lấy một lần; test duyệt route khai báo quyền, satisfies **AC-1**, **AC-4**, **AC-6**, **AC-8**
4. Kiểm thật trên DB thử (các kịch bản ở trên gồm khóa và mở khóa, hết dùng thử, mua gói, hạn mức hạ thấp, mọi loại người xem, 429, phép tính độc lập từ dòng thô, điều khiển âm), `EXPLAIN` một lần ở 60 nghìn tin (ghi số, không chỉnh), Postman thêm request vào folder 18 (không đăng nhập admin thêm lần nào, vì đăng nhập admin bị giới hạn 10 lần mỗi 15 phút), `api-for-frontend.md` (mục mới 6.36, nhắc ở 6.31, bảng mã lỗi và giới hạn tần suất, màn hình hồ sơ chủ trọ ở mục 7, nhật ký), `verify.md`, satisfies **AC-1** đến **AC-8**

## Consequences

**Positive**:
- Một API đọc, không bảng, không migration, không mã lỗi, không biến môi trường, không nhóm giới hạn mới: gọn đúng tinh thần MVP.
- Danh sách dùng đúng hai mảnh SQL hiển thị công khai nên tự đúng khi tin bị ẩn, chủ trọ bị khóa, hết dùng thử, hết gói hay hạ hạn mức; `total` luôn bằng `publicListingCount`.
- Phần tử giống hệt thẻ tin của `GET /listings` nên FE dùng lại một component cho hai màn hình, kể cả tim yêu thích.
- Hồ sơ giữ nguyên bảy trường nên FE đang chạy không bị ảnh hưởng.

**Negative / tradeoffs**:
- FE phải gọi hai API để dựng trang hồ sơ (hồ sơ rồi danh sách), thay vì một lần.
- Logic gắn `isFavorite` (khách `null`, đăng nhập thì tra một truy vấn) nằm ở hai nơi: `ListingsService.listPublic` và `LandlordsService.listListings`, chừng mười dòng. Có lệch thì nhìn thấy ở test so với `GET /listings`, nhưng vẫn là hai bản để giữ đồng bộ.
- Không có bộ lọc hay kiểu sắp xếp: người xem không sắp theo giá được trên danh sách này. Chủ trọ MVP chỉ có vài tin nên đủ dùng.
- Mỗi lần mở danh sách chạy hai câu SQL thô cộng một truy vấn lấy tin, cộng một truy vấn cờ yêu thích khi đã đăng nhập, cộng một lần tra chủ trọ. Luật xếp hạng theo hạn mức đã đo là chậm ở 60 nghìn tin (spec 0003 AC-13, bạn quyết bỏ qua vì là MVP); ở đây bị thu hẹp theo một chủ trọ nên rẻ hơn, nhưng vẫn đo một lần rồi giữ nguyên.
- `total` và `publicListingCount` đọc ở hai request khác nhau nên có thể lệch vài mili giây khi dữ liệu đổi giữa chừng.
- Mọi phần tử mang `landlord` giống nhau: thừa vài chục byte mỗi dòng, đổi lại không phải làm kiểu phần tử thứ hai.

**Neutral**:
- Thêm một phương thức `listListings` ở `LandlordsService`, một trường tùy chọn ở `PublicListFilter`, một import ở `LandlordsModule`; không đụng `ListingsModule`.
- Hàng 11 (theo dõi) và hàng 12 (lưu tin) không đổi hợp đồng; hàng này chỉ đọc từ chúng.
- Số `0009` là số kế tiếp trong `docs/specs/`.

## Follow-up

- [ ] Hoãn, thêm lại bằng `/scope` khi cần: bộ lọc hoặc kiểu sắp xếp cho danh sách này (giá, phường), lọc theo nhà trọ, nhúng trang đầu vào chính hồ sơ để FE gọi một lần, danh sách rút gọn không có `landlord`.
- [ ] Sau khi build, `/sync` ghi route mới vào các spec còn lệch. Spec 0005 đã được sửa ngay khi viết spec này (xem dưới).
- [x] Spec 0005, mục Follow-up: dòng "danh sách tin đang hiện của chủ trọ trên hồ sơ (cần bộ lọc `landlordId` ở `GET /listings`)" đã trỏ sang spec này và đổi cách làm thành route lồng `GET /landlords/:id/listings` (xong ngày 2026-10-21 khi viết spec này).

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
