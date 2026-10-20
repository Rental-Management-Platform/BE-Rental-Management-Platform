# 0006. Lưu tin yêu thích của người tìm trọ

**Date**: 2026-10-20
**Status**: Accepted

## Summary

Người tìm trọ lưu một tin bằng một lần bấm, bỏ lưu khi muốn, và mở danh sách tin đã lưu của mình (tin mới lưu nằm trên). Spec thêm một bảng `favorites` và ba API; hai API đọc tin công khai có thêm cờ `isFavorite` để FE tô biểu tượng tim mà không phải gọi thêm. Tin nào không còn hiện công khai thì biến khỏi danh sách đã lưu nhưng dòng lưu vẫn còn, nên tin hiện lại là quay về chỗ cũ. Mọi thứ tính lúc đọc từ luật hiển thị công khai có sẵn, không việc chạy nền.

## Requirements

**User stories**:
- Là người tìm trọ, tôi muốn lưu một tin bằng một lần bấm và thấy ngay mình đã lưu, để quay lại xem sau.
- Là người tìm trọ, tôi muốn mở danh sách tin đã lưu, tin mới lưu nằm trên, và không bị lẫn những tin đã không còn xem được.
- Là người tìm trọ, tôi muốn danh sách tin và trang chi tiết cho biết tin nào mình đã lưu, để giao diện tô tim ngay.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `POST /listings/:id/favorite`: người dùng có quyền `favorite:create` (mặc định chỉ `tenant`) lưu một tin đang hiện công khai thì nhận 200 `{ listingId, isFavorite: true }`. Mỗi cặp (người dùng, tin) chỉ có một dòng: gọi lại vẫn 200 và không thêm dòng, kể cả khi nhiều lần gọi chạy đồng thời. Số tin được lưu của một người không bị giới hạn.
- **AC-2**: `DELETE /listings/:id/favorite`: người có quyền `favorite:delete` nhận 200 `{ listingId, isFavorite: false }` và dòng lưu bị xóa. Chưa lưu thì vẫn 200. Bỏ lưu không kiểm tin có tồn tại hay đang hiện công khai, nên bỏ lưu được cả tin đã bị ẩn hay đã xóa, và id không có cũng 200.
- **AC-3**: Lưu một tin không hiện công khai (không tồn tại, đã xóa mềm, bị chủ trọ hay admin ẩn, chủ trọ bị khóa, chủ trọ hết dùng thử và hết gói, hoặc bị ẩn bớt vì vượt hạn mức) bị 404 `LISTING_NOT_FOUND` và không ghi dòng nào. Id không phải UUID bị 400 `INVALID_ID`.
- **AC-4**: `GET /me/favorites` (quyền `favorite:read`) trả `{ items, total, page, pageSize }` với `page`, `pageSize` như các danh sách khác. Chỉ gồm tin do chính người gọi đã lưu và đang hiện công khai ngay lúc đọc, sắp xếp mới lưu trước (`created_at` của dòng lưu giảm dần, rồi `listing_id` giảm dần). Mỗi phần tử là tin tóm tắt công khai (cùng các trường như `GET /listings`) cộng `favoritedAt` (lúc lưu) và `isFavorite: true`; `total` chỉ đếm tin đang hiện. Không có bộ lọc hay `sort`. Phản hồi có `Cache-Control: private, no-store`.
- **AC-5**: Tin đã lưu mà không còn hiện công khai (bị ẩn, đã xóa, chủ trọ bị khóa, hết dùng thử và hết gói, vượt hạn mức) biến khỏi `items` và `total` ngay lúc đọc, nhưng dòng lưu giữ nguyên; tin hiện lại thì quay về đúng vị trí theo lúc lưu. Điều kiện hiển thị dùng đúng hai mảnh SQL của danh sách công khai, nên một tin nằm trong danh sách đã lưu khi và chỉ khi khách mở được nó ở `GET /listings/:slugCode`.
- **AC-6**: `GET /listings` và `GET /listings/:slugCode` thêm trường `isFavorite`: `null` với khách, token sai hoặc hết hạn (không bao giờ 401); `true` hoặc `false` với người đã đăng nhập, phản ánh dòng lưu của chính họ. `GET /listings` đổi sang đọc đăng nhập tùy chọn và trả `Cache-Control: private, no-store` (chi tiết đã có header này). Các trường khác giữ nguyên; danh sách tin của chủ trọ và danh sách kiểm duyệt không đổi.
- **AC-7**: Phân quyền: khách bị 401 `TOKEN_MISSING`; chủ trọ (mặc định không giữ `favorite:*`) bị 403 `PERMISSION_DENIED`; admin giữ mọi quyền nhưng cả ba route vẫn bị 403 `PERMISSION_DENIED` vì Service kiểm loại tài khoản; các trường hợp này không ghi dòng nào. Người lưu luôn là người trong token, và không API nào cho thấy dòng lưu của người khác. Chủ trọ được admin cấp quyền thì lưu được, kể cả tin của chính mình, không có luật riêng.
- **AC-8**: `POST` và `DELETE /listings/:id/favorite` giới hạn 120 lần mỗi giờ theo người dùng, mỗi API đếm riêng; `GET /me/favorites` dùng nhóm công khai 300 lần mỗi phút theo IP. Vượt thì 429 `RATE_LIMITED` kèm `Retry-After`.

## Decision

**Chosen option**: Option 1: Một bảng `favorites`, mọi thứ tính lúc đọc, danh sách đã lưu ghép thêm vào đúng hai mảnh SQL hiển thị công khai

Người lưu (lấy từ token) và tin nối nhau bằng bảng `favorites`. Danh sách đã lưu chạy cùng hai mảnh SQL `publicListingFrom` và `publicListingCondition` của danh sách công khai, thêm một phép nối với `favorites` của người gọi, nên tin biến khỏi danh sách đúng lúc nó biến khỏi công khai mà không có cờ nào để cập nhật. Cờ `isFavorite` ở danh sách và chi tiết công khai được đọc thêm bằng một truy vấn theo khóa chính.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Feature design

Quy ước chung theo 0001 đến 0006 của nền móng: Repository bọc Prisma, `timestamptz`, tên bảng và cột `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`, đọc thô bằng `$queryRaw` chỉ nằm trong file `*.repository.ts` (luật lint), giao dịch qua `TransactionRunner`.

**Data model** (một migration; mô hình đã được bạn xác nhận):

| Bảng | Khóa chính | Cột | Ràng buộc và chỉ mục |
|---|---|---|---|
| `favorites` | (`user_id`, `listing_id`) | `user_id` (uuid, người lưu, FK `users`, RESTRICT), `listing_id` (uuid, tin được lưu, FK `listings`, RESTRICT), `created_at` (timestamptz, mặc định `now()`) | khóa chính `favorites_pkey` chặn lưu trùng một cặp và phủ luôn việc tra theo `user_id`; chỉ mục `favorites_user_id_created_at_idx` trên (`user_id`, `created_at` giảm dần, `listing_id` giảm dần) cho thứ tự "mới lưu trước"; tên FK `favorites_user_id_fk` và `favorites_listing_id_fk` |

Quan hệ: `users` 1:N `favorites` N:1 `listings`, tức N:M giữa người dùng và tin. Cả hai FK đều RESTRICT vì tài khoản và tin chỉ xóa mềm. Khóa ngoại không ép được "người lưu phải là người tìm trọ"; Service lo (xem Security model). Không có cột đếm, ghi chú hay nhãn; không chỉ mục riêng theo `listing_id` vì số lượt lưu cho chủ trọ nằm ngoài phạm vi. Không đổi `users`, `properties`, `listings`. `schema.prisma` thêm model `Favorite` và hai quan hệ ngược (`favorites` trên `User` và trên `Listing`). Spec `0001/0005-postgres-data-conventions.md` đã phác bảng này (khóa chính theo cặp, N:M).

**State transitions**: không có. Một dòng `favorites` tồn tại hoặc không; việc nó có hiện ra hay không suy ra lúc đọc.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/listings/:id/favorite` | POST | `id` (UUID, đường dẫn); không body | 200 `{ listingId, isFavorite: true }` | `favorite:create` | 400 `INVALID_ID`, 404 `LISTING_NOT_FOUND`, 403, 401, 429 |
| `/listings/:id/favorite` | DELETE | `id` (UUID, đường dẫn); không body | 200 `{ listingId, isFavorite: false }` | `favorite:delete` | 400 `INVALID_ID`, 403, 401, 429 |
| `/me/favorites` | GET | `page`, `pageSize` (query) | 200 trang tin đã lưu | `favorite:read` | 400 `VALIDATION_FAILED` (phân trang sai), 403, 401, 429 |
| `/listings` | GET (đổi) | như cũ | như cũ, thêm `isFavorite` mỗi phần tử | công khai, đọc đăng nhập tùy chọn (`@OptionalAuth()`) | như cũ |
| `/listings/:slugCode` | GET (đổi) | như cũ | như cũ, thêm `isFavorite` | công khai, đọc đăng nhập tùy chọn (đã có) | như cũ |

Hình dạng trả về:

Kết quả lưu và bỏ lưu (hai API ghi):

```json
{ "listingId": "0192f1c2-7a4b-7c3e-9d1a-3b5f6a7c8d11", "isFavorite": true }
```

Phần tử của `GET /me/favorites` ("Tin đã lưu"): đúng các trường của tin tóm tắt công khai (spec 0002) cộng hai trường:

```json
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
  "favoritedAt": "2026-10-20T03:00:00.000Z",
  "isFavorite": true
}
```

`isFavorite` ở danh sách và chi tiết công khai là `boolean | null`; ở `GET /me/favorites` luôn là `true`. Danh sách tin của chủ trọ và danh sách kiểm duyệt không có trường này. Không có mã lỗi mới: dùng `LISTING_NOT_FOUND`, `INVALID_ID`, `PERMISSION_DENIED`, `TOKEN_MISSING`, `RATE_LIMITED` đã có.

**Quy tắc đầu vào, đầu ra và biên**:
- **Thứ tự kiểm lỗi của `POST`**: quyền (401 hoặc 403) trước, rồi `INVALID_ID` (400), rồi loại tài khoản admin (403, ở Service), rồi tin có hiện công khai không (404), rồi ghi. Admin gửi id sai nhận 400 chứ không phải 403, vì route kiểm id trước Service (giống `follow` của spec 0005 sau khi build). `DELETE` giống vậy nhưng bỏ bước kiểm tin: chỉ quyền, `INVALID_ID`, admin, rồi xóa. `GET /me/favorites`: quyền, admin, phân trang.
- **Lưu**: `POST` kiểm tin bằng `ListingsRepository.isPubliclyVisible(id, { now, trialListingLimit })`, rồi ghi bằng một câu `INSERT ... ON CONFLICT DO NOTHING` (Prisma `createMany` với `skipDuplicates`). Hai lần gọi đồng thời vẫn ra đúng một dòng và cả hai nhận 200. Nếu tin bị ẩn đúng giữa kiểm tra và ghi thì dòng lưu vẫn được ghi; vô hại vì tin đó đã bị ẩn lặng lẽ khỏi danh sách.
- **Bỏ lưu**: một câu `deleteMany` theo cặp, không tra thêm gì, nên không có dòng nào cũng 200. Kết quả luôn là `isFavorite: false`, không đọc lại.
- **Kết quả của ghi** là hằng theo hành động (`true` sau `POST`, `false` sau `DELETE`), `listingId` là id ở đường dẫn.
- **Không body**: `POST` và `DELETE` không nhận body; nội dung gửi kèm bị bỏ qua.
- **Danh sách đã lưu** đọc hai bước như `findPublicPage` (spec 0003). Bước một: hai câu SQL thô chạy song song, lấy `l.id` cùng `f.created_at` của trang theo đúng thứ tự và đếm `total`, cả hai dùng `publicListingFrom(now)` nối thêm `JOIN favorites f ON f.listing_id = l.id AND f.user_id = <người gọi>` và `publicListingCondition(now, trialListingLimit)`, sắp `f.created_at DESC, f.listing_id DESC`. Bước hai: Prisma lấy dữ liệu tin theo `id` với cùng phần `include` của danh sách công khai rồi xếp lại thứ tự, `favoritedAt` lấy từ bước một. Tin bị xóa giữa hai bước thì bỏ qua (trang ngắn hơn một dòng, chấp nhận như `GET /listings`). Hai mảnh SQL công khai không đổi; chỉ nối thêm phía sau.
- **`isFavorite` ở danh sách công khai**: sau khi có `id` của trang, người xem đã đăng nhập thì đọc thêm một truy vấn `favorites` theo (`user_id`, `listing_id` thuộc trang) rồi gắn cờ; khách thì không đọc và cờ là `null`. **Ở chi tiết**: một truy vấn theo khóa chính (`user_id`, `listing_id`). Người đăng nhập mà không phải `tenant` (chủ trọ, admin) cũng nhận `false`, không phải `null`.
- **Cache**: `POST`, `DELETE` và `GET /me/favorites` đặt `Cache-Control: private, no-store`; `GET /listings` cũng đặt header này vì nội dung giờ đổi theo người xem.
- **Phân trang**: `page` từ 1, `pageSize` 1 đến 50, mặc định 20 (`PaginationQueryDto`, `Page<T>` có sẵn).
- **Module**: `src/favorites/` gồm `FavoritesController` (`GET /me/favorites`), `ListingFavoritesController` (`POST`, `DELETE /listings/:id/favorite`), `FavoritesService`, `FavoritesRepository`; thêm `FavoritesDataModule` chỉ chứa `FavoritesRepository`, để `ListingsModule` và `FavoritesModule` cùng import mà không vòng. `FavoritesModule` import `ListingsDataModule` và `SettingsModule`. Truy vấn danh sách đã lưu nằm ở `ListingsRepository` (nơi duy nhất đọc bảng `listings`), còn `FavoritesRepository` chỉ chạm bảng `favorites`.

**Giới hạn tần suất** (thêm một nhóm vào `RATE_LIMITS`, dùng `@RateLimited`; con số do bạn duyệt ngày 2026-10-20):

| Nhóm | Route | Bộ đếm |
|---|---|---|
| `favoriteWrite` (mới) | `POST` và `DELETE /listings/:id/favorite` | `user`: 120 lần mỗi giờ, **mỗi API đếm riêng** |
| `publicRead` (đã có) | `GET /me/favorites`, `GET /listings` | `ip`: 300 lần mỗi phút |

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Lưu, bỏ lưu | người lưu (`favorites.user_id`) | `sub` trong access token qua `@CurrentUser()`, không nhận từ đường dẫn hay body |
| Lưu, bỏ lưu | tin (`favorites.listing_id`) | tham số đường dẫn `:id`, qua `uuidParam()` |
| Lưu | `created_at` | mặc định `now()` của cột |
| Lưu | tin có lưu được không | `ListingsRepository.isPubliclyVisible(id, { now, trialListingLimit })`; `now` do controller lấy một lần mỗi request, `trial_listing_limit` đọc từ `settings` qua `SettingsService.getValue` giống `GET /listings` |
| Lưu, bỏ lưu, đọc danh sách | người gọi có phải admin không | `accountType` trong `RequestUser` (từ token) |
| Lưu, bỏ lưu | `listingId`, `isFavorite` trong kết quả | `listingId` là id ở đường dẫn; `isFavorite` là hằng theo hành động |
| `GET /me/favorites` | những tin nào | `favorites.user_id` bằng `sub` của token, nối `publicListingFrom` và lọc `publicListingCondition` cùng `now` |
| `GET /me/favorites` | thứ tự | `favorites.created_at` giảm dần, rồi `favorites.listing_id` giảm dần |
| `GET /me/favorites` | `favoritedAt` | `favorites.created_at`, lấy ở bước một của đọc hai bước |
| `GET /me/favorites` | `total` | `count(*)` cùng mảnh `FROM` và `WHERE` với trang |
| `GET /me/favorites` | các trường tin tóm tắt | cùng `include` và cùng hàm ánh xạ với `GET /listings` (spec 0002), nên `fullAddress`, `coverImageUrl`, `slug` giống hệt |
| `GET /me/favorites` | `page`, `pageSize` | query, `PaginationQueryDto` |
| `GET /listings`, chi tiết | `isFavorite` | người xem lấy từ token (đọc đăng nhập tùy chọn): khách `null`; đã đăng nhập thì có dòng `favorites` (`sub`, `listing_id`) hay không |
| Mọi route | `now` | `new Date()` do controller lấy một lần mỗi request |

**Key invariants**:
- Mỗi cặp (`user_id`, `listing_id`) có tối đa một dòng (khóa chính).
- `user_id` luôn lấy từ token, không bao giờ từ đường dẫn hay body.
- Dòng `favorites` không bị xóa khi tin bị ẩn hay xóa mềm, chủ trọ bị khóa, hết dùng thử hay hết gói; việc hiện hay không suy ra lúc đọc.
- Danh sách đã lưu dùng đúng hai mảnh SQL công khai nên không bao giờ hiện thứ mà `GET /listings/:slugCode` không mở được cho khách.
- Không dòng nào mang `user_id` của admin được ghi qua API.
- Người dùng chỉ đọc được dòng lưu của chính mình; không API nào lộ ai đã lưu tin nào hay có bao nhiêu lượt lưu. `isFavorite` chỉ nói về chính người xem.

**Security model**:
- Cả ba route mới cần đăng nhập. `POST` cần `favorite:create`, `DELETE` cần `favorite:delete`, `GET /me/favorites` cần `favorite:read`. `tenant` có cả ba mặc định (migration `account_types_phone`); `landlord` và `admin` không giữ mặc định. Quyền là `ownerScoped`: dòng ghi luôn thuộc người gọi nên không cần `assertOwner`.
- **Admin**: `ADMIN_PERMISSIONS` là `manage` của mọi module, nên admin qua được guard quyền `favorite:*`. Service chặn `accountType === 'admin'` bằng 403 `PERMISSION_DENIED` ở cả ba route, giống `follow` (spec 0005, đã gặp khi build) và `OrdersService.create` (spec 0004).
- Chủ trọ được admin cấp `favorite:*` thì lưu được tin của người khác và cả tin của chính mình; không luật riêng.
- Lưu một tin không hiện công khai trả 404 như chi tiết tin, để không ai dò được tin đang ẩn hay bị admin ẩn.
- Không dữ liệu nào thuộc phạm vi tuân thủ riêng. Danh sách yêu thích là dữ liệu riêng của người dùng nhưng không nhạy cảm.

**Configuration required**: không có biến môi trường, không dịch vụ ngoài, không seed, không migration quyền. Chỉ cần migration tạo bảng `favorites`.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: tenant lưu một tin, nhận `isFavorite: true`; mở `GET /me/favorites` thấy tin đó đầu danh sách kèm `favoritedAt`; bỏ lưu thì danh sách trống và `total` về 0, verifies **AC-1**, **AC-2**, **AC-4**
- Failure case: hai chục lần `POST` đồng thời cùng cặp: tất cả 200, DB có đúng một dòng; `POST` lần nữa vẫn 200; `DELETE` khi chưa lưu và `DELETE` một id không có vẫn 200, verifies **AC-1**, **AC-2**
- Failure case: `POST` một tin bị chủ trọ ẩn, bị admin ẩn, đã xóa mềm, của chủ trọ bị khóa, của chủ trọ hết dùng thử và hết gói, và một tin vượt hạn mức: mỗi lần 404 `LISTING_NOT_FOUND` và không có dòng nào; id `abc` thì 400 `INVALID_ID`, verifies **AC-3**
- Failure case: lưu ba tin rồi lần lượt ẩn, khóa chủ trọ, hạ hạn mức: tin biến khỏi `items` và `total` giảm, dòng `favorites` còn nguyên; đảo ngược thì tin quay về đúng thứ tự; số tin trong danh sách đã lưu khớp một phép kiểm độc lập tính từ dòng thô, verifies **AC-4**, **AC-5**
- Happy path: người xem đã đăng nhập, khách, token sai, token hết hạn mở `GET /listings` và chi tiết: `isFavorite` là `true` hoặc `false` cho người đăng nhập (cả chủ trọ và admin nhận `false`), `null` cho ba loại còn lại, không 401; danh sách có `Cache-Control: private, no-store`; danh sách của chủ trọ và kiểm duyệt không có trường mới, verifies **AC-6**
- Auth/permission: khách `POST` nhận 401; chủ trọ và admin gọi cả ba route nhận 403 và không ghi dòng nào; chủ trọ được cấp quyền lưu được tin của chủ trọ khác và của chính mình, verifies **AC-7**
- Auth/permission: vượt 120 lần `POST` trong một giờ nhận 429 kèm `Retry-After` trong khi `DELETE` (đếm riêng) vẫn chạy; vượt 300 lần `GET /me/favorites` mỗi phút nhận 429, verifies **AC-8**
- Kiểm bằng `EXPLAIN` (không phải test tự động): danh sách đã lưu ở khoảng 60 nghìn tin với một người lưu 200 tin và một người lưu 5 nghìn tin; đo một lần, ghi số vào `verify.md`, không chỉnh nếu chậm vì đây là bản demo, verifies **AC-4**, **AC-5**

## Build plan

Hướng build theo Skateboard (bản mỏng nhất dùng được trước, rồi mới mở rộng): mốc 1 đã có trọn vòng lưu, bỏ lưu và xem danh sách đã lưu; mốc 2 thêm cờ `isFavorite` vào hai API công khai, là phần duy nhất đổi hợp đồng của API đang chạy. Hai cột mốc, mỗi mốc một lần `/develop` rồi dừng cho bạn review (khớp ô `Build it` trong scope). Mỗi mốc có đổi API thì cập nhật `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` ngay trong mốc đó (quy tắc tài liệu sống), gắn `@RateLimited` ngay khi tạo route.

**Mốc 1: lưu, bỏ lưu và danh sách đã lưu**
1. Thêm model `Favorite` vào `schema.prisma` và một migration tạo bảng `favorites` kèm khóa chính, hai FK RESTRICT, chỉ mục `favorites_user_id_created_at_idx`; áp migration lên DB thử và hỏi schema thật. Thêm nhóm `favoriteWrite` (120 lần mỗi giờ theo người dùng) vào `RATE_LIMITS` kèm test bảng giới hạn, satisfies **AC-1**, **AC-2**, **AC-8**
2. `FavoritesRepository` (`addFavorite` bằng `createMany` với `skipDuplicates`, `removeFavorite` bằng `deleteMany`) và `FavoritesDataModule`; `ListingsRepository.findFavoritePage(userId, visibility, skip, take)` đọc hai bước theo đúng hai mảnh SQL công khai nối thêm `favorites`; hàm ánh xạ `toSavedListing` và kiểu `SavedListingResponse`, satisfies **AC-4**, **AC-5**
3. `FavoritesService` (`save`, `unsave`, `list`, kiểm admin trước, `isPubliclyVisible` rồi ghi, `trial_listing_limit` đọc từ `settings` một lần mỗi request), `ListingFavoritesController` (`POST` và `DELETE /listings/:id/favorite`: `@RequirePermissions`, `@RateLimited('favoriteWrite')`, `@HttpCode(200)`, `uuidParam()`, `Cache-Control: private, no-store`) và `FavoritesController` (`GET /me/favorites`: `favorite:read`, `@RateLimited('publicRead')`); `FavoritesModule` vào `AppModule`, satisfies **AC-1** đến **AC-5**, **AC-7**, **AC-8**
4. Test đơn vị (Service, hai Repository, ánh xạ, duyệt route khai báo quyền), `EXPLAIN` một lần ở 60 nghìn tin giả lập (ghi số, không chỉnh), kiểm thật trên DB thử (các tin không hiện công khai, đồng thời, quyền, 429, điều khiển âm cho phép ghi lặp, kiểm admin và nối hiển thị công khai), Postman folder 19 và `api-for-frontend.md` (mục 6.33, bảng mã lỗi và giới hạn tần suất, màn hình, nhật ký), `verify.md`, satisfies **AC-1** đến **AC-5**, **AC-7**, **AC-8**. Đã làm 2026-10-21: `toSavedListing` nằm ở `src/favorites/favorites.mapper.ts`, kiểu `SavedListingRow` (hàng tin cộng `favoritedAt`) ở `listings.repository.ts`; admin bị chặn trong Service như đã dự đoán ở Security model; số đo `EXPLAIN` ở `verify.md`

**Mốc 2: cờ `isFavorite` trên danh sách và chi tiết công khai**
5. Kiểu `PublicListingSummaryResponse` (tin tóm tắt cộng `isFavorite`) và trường `isFavorite` của `ListingDetailResponse`; `ListingsModule` import `FavoritesDataModule`; `FavoritesRepository.findSavedIds(userId, listingIds)` và `isFavorite(userId, listingId)`; `ListingsController.list` đổi từ `@Public()` sang `@OptionalAuth()` kèm `Cache-Control: private, no-store`; `ListingsService.listPublic(query, viewerId, now)` và `getPublicDetail` gắn cờ (khách `null`), satisfies **AC-6**
6. Kiểm thật trên DB thử (khách, token sai, token hết hạn, tenant, chủ trọ, admin; danh sách của chủ trọ và kiểm duyệt không đổi), điều khiển âm cho phép đọc cờ, Newman toàn bộ; cập nhật Postman (folder 09 và 19), `api-for-frontend.md` (mục 6.19, 6.20, 6.33, màn hình, giới hạn đã biết, nhật ký, bỏ dòng 12 ở mục 10), `verify.md`, satisfies **AC-6**, **AC-7**. Đã làm 2026-10-21: thêm `toPublicSummary` ở `listings.mapper.ts`; `OwnerListingDetailResponse` dùng `Omit` để không thừa hưởng `isFavorite` của `ListingDetailResponse`; đã sửa một assertion của Postman folder 09 (danh sách trường của phần tử `GET /listings`)

## Consequences

**Positive**:
- Một bảng, ba API mới, không việc nền, không biến môi trường, không mã lỗi mới: gọn đúng tinh thần MVP.
- Tin biến khỏi danh sách đã lưu đúng lúc nó biến khỏi công khai (ẩn, khóa, hết gói, hạ hạn mức) vì dùng chung hai mảnh SQL; không chỗ nào để lệch như cờ lưu sẵn.
- Lưu và bỏ lưu lặp lại hay đồng thời đều an toàn, hợp với bấm đúp và thử lại khi mạng chậm.
- `isFavorite` ở danh sách và chi tiết cho FE tô tim trong một lần gọi, không cần API phụ.

**Negative / tradeoffs**:
- `GET /listings` đổi từ không phụ thuộc người xem sang đổi theo người xem: phải trả `Cache-Control: private, no-store`, nên proxy hay CDN không cache chung được danh sách công khai nữa. Phần tử mới `isFavorite` là thêm trường, không phá FE cũ.
- Tin biến khỏi danh sách đã lưu một cách lặng lẽ: người dùng không được báo tin nào biến hay vì sao, và không bỏ lưu được tin đang ẩn qua giao diện (API `DELETE` vẫn chạy nếu biết id). Số tin biến không hiển thị ở đâu.
- Không giới hạn số tin được lưu: bảng lớn dần theo người dùng; chỉ giới hạn ghi 120 lần mỗi giờ chặn lạm dụng. Danh sách của một người lưu hàng nghìn tin sẽ chậm hơn.
- Danh sách đã lưu chạy luật xếp hạng theo hạn mức (một truy vấn con đếm cho mỗi dòng) trên các tin đã lưu; luật này đã đo là chậm ở 60 nghìn tin (spec 0003 AC-13, bạn quyết bỏ qua vì là MVP). Chi phí ở đây tỷ lệ với số tin đã lưu của một người, không với cả bảng, nhưng sẽ đo một lần rồi giữ nguyên.
- Mỗi lần mở danh sách công khai khi đã đăng nhập chạy thêm một truy vấn `favorites` theo khóa chính; chi tiết thêm một truy vấn nữa.
- Thêm một nhánh đặc biệt cho admin trong Service (như `follow` và `OrdersService.create`) vì quyền admin mở mọi module.
- Lưu chỉ là tiện ích cho người tìm trọ: chủ trọ không thấy ai lưu tin của mình, không có thông báo, nên tính năng này không làm chủ trọ ở lại mua gói (xem premise note ở rationale).

**Neutral**:
- Thêm module `src/favorites/` và `FavoritesDataModule`, một phương thức `findFavoritePage` ở `ListingsRepository`, nhóm giới hạn `favoriteWrite`, kiểu `PublicListingSummaryResponse` và `SavedListingResponse`.
- Quyền `favorite:read`, `favorite:create`, `favorite:delete` đã có sẵn ở `tenant` nên không cần migration quyền; nếu admin đã gỡ chúng khỏi `tenant` trong DB thì tenant bị 403 cho tới khi cấp lại.
- Số `0006` trùng chữ với spec con `0006-docker-packaging-and-release` của spec 0001, như 0002 đến 0005 đã trùng với các spec con của 0001; spec nào cũng nằm trong thư mục riêng nên không đụng nhau.
- Hàng 11 (theo dõi) và hàng 12 không phụ thuộc nhau.

## Follow-up

- [ ] Hoãn, thêm lại bằng `/scope` khi cần: số lượt lưu cho chủ trọ, ghi chú riêng cho tin đã lưu, thông báo khi tin đã lưu đổi giá hay biến mất, bộ lọc hoặc kiểu sắp xếp cho danh sách đã lưu, báo số tin đã lưu đang bị ẩn (`unavailableCount`), giới hạn số tin được lưu, API riêng trả danh sách id đã lưu.
- [ ] Mục Security model của spec 0005 vẫn nói admin mặc định không giữ `follow:create`; code thực tế chặn admin trong Service. Cần `/architect` sửa một dòng ở spec 0005 (đã ghi ở ghi chú bước 6 của spec đó).
- [ ] Sau khi build, `/sync` ghi bảng `favorites`, nhóm `favoriteWrite` và việc `GET /listings` đọc đăng nhập tùy chọn vào các spec nền móng và spec 0002 nếu còn lệch.
- [x] Đồng bộ `0001/0005-postgres-data-conventions.md`: dòng `favorites` ghi thêm `created_at`, hai FK `RESTRICT`, chỉ mục theo thời điểm lưu (xong ngày 2026-10-20 khi viết spec này).

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
