# Verify: lưu tin yêu thích · spec 0006 · updated 2026-10-21 (mốc 1 và mốc 2)
_Steps derived from spec 0006 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Chạy trên một database thử (đã dùng `rental_management_verify`), không chạy trên database đang dùng. Dựng dữ liệu bằng chính API: đăng ký chủ trọ và người tìm trọ, tạo nhà trọ và tin, rồi làm cho tin biến khỏi công khai bằng API thật (chủ trọ ẩn, admin ẩn, xóa mềm, admin khóa chủ trọ, hạ hạn mức bằng `PATCH /settings/trial_listing_limit`). Hai thao tác không có API nên làm bằng SQL: đặt `users.trial_ends_at` ở quá khứ (hết dùng thử) và đọc dòng `favorites` thô để đối chứng. Đăng nhập admin bằng `ADMIN_SEED_*`. Bộ đếm giới hạn tần suất nằm trong bộ nhớ và đăng ký tối đa 10 lần mỗi giờ theo IP, nên khởi động lại server trước mỗi lần chạy script.

## Mốc 1: bảng `favorites`, lưu, bỏ lưu và danh sách đã lưu (AC-1 đến AC-5, AC-7, AC-8)

### Commands
- [ ] `npm run migration:deploy` trên database trống → mọi migration áp xong, có bảng `favorites` với ba cột `user_id`, `listing_id`, `created_at` → AC-1
- [ ] Hỏi schema thật bảng `favorites`: khóa chính `favorites_pkey (user_id, listing_id)`, hai khóa ngoại `favorites_user_id_fk` và `favorites_listing_id_fk` đều `ON DELETE RESTRICT`, chỉ mục `favorites_user_id_created_at_idx (user_id, created_at DESC, listing_id DESC)` → AC-1, AC-4
- [ ] `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected", exit 0 → AC-1
- [ ] `INSERT INTO favorites` với tin không tồn tại → khóa ngoại chặn (SQLSTATE `23503`); chèn trùng cặp → khóa chính chặn (`23505`) → AC-1
- [ ] `npm test` → toàn bộ qua (gồm `favorites.service.spec.ts`, `favorites.repository.spec.ts`, `favorites.mapper.spec.ts`, `listings.repository.spec.ts`, `rate-limits.spec.ts` và `route-declarations.spec.ts`) → AC-1 đến AC-5, AC-7, AC-8
- [ ] `npx tsc --noEmit` và `npx eslint "{src,test}/**/*.ts"` → sạch → AC-1 đến AC-8

### UI / manual (gọi API, Postman folder `19 Tin yêu thích`)
Dựng sẵn: ba chủ trọ L1 (5 tin A đến E), L2 (tin F), L3 (tin G); người tìm trọ T1 (người lưu chính), T2 (đồng thời), T3 (thử lỗi, phải còn 0 dòng); hạn mức dùng thử tạm nâng lên 10 để đăng đủ.
- [ ] T1 `POST /listings/:id/favorite` tin A → 200 `{ listingId, isFavorite: true }`, `Cache-Control: private, no-store`, DB có đúng một dòng `(T1, A)` với `created_at` có giá trị → AC-1
- [ ] Body giả `{ userId, user_id, listingId, listing_id }` bị bỏ qua: dòng ghi thuộc T1 và tin ở đường dẫn → AC-1 (Value sourcing: người lưu lấy từ token, tin từ đường dẫn)
- [ ] Lưu lặp ba lần vẫn 200, DB vẫn một dòng; 20 lần `POST` đồng thời cùng một cặp → tất cả 200 và đúng một dòng; 6 vòng đồng thời (mỗi vòng 10 lần, một cặp khác nhau) → tất cả 200, mỗi cặp một dòng → AC-1
- [ ] `DELETE` → 200 `{ listingId, isFavorite: false }`, dòng bị xóa; `DELETE` lại, `DELETE` id không có trong DB → vẫn 200; `DELETE /listings/abc/favorite` → 400 `INVALID_ID` → AC-2
- [ ] T3 lưu tin: id không có trong DB, tin bị chủ trọ ẩn, tin bị admin ẩn, tin đã xóa mềm, chủ trọ bị khóa, chủ trọ hết dùng thử và không có gói, tin bị ẩn bớt vì vượt hạn mức (hạn mức đặt về 1) → mỗi lần 404 `LISTING_NOT_FOUND` và T3 vẫn 0 dòng; tin đăng sớm nhất trong hạn mức vẫn lưu được (đối chứng dương); `POST /listings/abc/favorite` → 400 `INVALID_ID` → AC-3
- [ ] T1 lưu A, B, C, D, E, F, G (cách nhau vài mili giây) → `GET /me/favorites` có 7 tin theo thứ tự G, F, E, D, C, B, A; mỗi phần tử có đúng các trường của tin tóm tắt cộng `favoritedAt` và `isFavorite: true`; chủ trọ chỉ có `id` và `name`; từng phần tử trùng từng trường với tin tương ứng của `GET /listings` (trừ `favoritedAt`, `isFavorite`); `Cache-Control: private, no-store` → AC-4
- [ ] Lưu lại tin đã lưu không đẩy nó lên đầu (dòng cũ giữ `created_at`) → AC-1, AC-4
- [ ] Phân trang `pageSize=3`: trang 1 và 2 mỗi trang 3, trang 3 có 1, ghép lại đúng danh sách đầy đủ, `total` 7; trang 99 rỗng nhưng `total` vẫn 7; `pageSize=0`, `pageSize=51`, `page=0`, `page=abc`, `pageSize=2.5`, `sort=newest`, `q=a` → 400 `VALIDATION_FAILED` → AC-4
- [ ] T2 (chưa lưu gì) thấy danh sách rỗng, không thấy dòng của T1 → AC-4, AC-7
- [ ] Chủ trọ ẩn B → B biến khỏi danh sách, `total` 6, dòng `favorites` vẫn nguyên; hiện lại B → B quay về đúng vị trí theo lúc lưu → AC-5
- [ ] Admin ẩn C rồi gỡ ẩn và chủ trọ hiện lại → C biến rồi quay về; admin khóa L2 → F biến, mở khóa → F quay về; L3 hết dùng thử (SQL) → G biến; L3 mua gói (tạo đơn và thanh toán thử) → G quay về dù đã hết dùng thử (mảnh nối kỳ gói nằm trong truy vấn) → AC-5
- [ ] Hạn mức 3, 2, 1, 0 rồi 10 → mỗi giá trị, danh sách khớp **phép tính độc lập từ dòng thô** (trạng thái, xóa mềm, chủ trọ, kỳ gói, hạng theo `(created_at, id)` tính bằng JavaScript, không dùng SQL của production) cùng tập và cùng thứ tự; chủ trọ có gói vẫn thấy tin khi hạn mức 0 → AC-5
- [ ] Với **mọi** tin đã lưu ở **mọi** bước trên: tin có trong danh sách đã lưu khi và chỉ khi khách mở được `GET /listings/:slugCode` (200), còn lại 404 → AC-5
- [ ] Chủ trọ xóa mềm D sau khi đã lưu → D biến khỏi danh sách, dòng `(T1, D)` vẫn còn; `DELETE` lên D → 200 và dòng bị xóa → AC-2, AC-5
- [ ] Khách gọi cả ba API → 401 `TOKEN_MISSING`; chủ trọ (không giữ `favorite:*`) và admin gọi cả ba → 403 `PERMISSION_DENIED` và không ghi dòng nào; admin `POST /listings/abc/favorite` → 400 `INVALID_ID` (route kiểm id trước Service) → AC-7
- [ ] Admin cấp `favorite:*` cho loại `landlord` (`PATCH /account-types/landlord`), chủ trọ đăng nhập lại lưu được tin của chính mình và của chủ trọ khác, đọc được danh sách của mình; khôi phục quyền → chủ trọ lại 403 → AC-7
- [ ] 120 lần `POST` liên tiếp của một người → 200; lần 121 → 429 `RATE_LIMITED` kèm `Retry-After` (số giây dương, tối đa 3600); `DELETE` (bộ đếm riêng) vẫn 200 khi `POST` đã bị chặn; người dùng khác không bị chặn lây; `DELETE` cũng chặn ở lần 121 → AC-8
- [ ] 300 lần `GET /me/favorites` trong một phút → 200; lần 301 → 429 kèm `Retry-After`; `GET /listings` (bộ đếm riêng của route đó) không bị chặn lây → AC-8
- [ ] Log server không có lỗi 500 hay cảnh báo của pg → AC-1 đến AC-8

## Mốc 2: cờ `isFavorite` ở danh sách và chi tiết tin công khai (AC-6, AC-7)

### Commands
- [ ] `npm test` → toàn bộ qua (gồm `listings.service.spec.ts`, `listings.mapper.spec.ts`, `favorites.repository.spec.ts`) → AC-6
- [ ] `npx tsc --noEmit` và `npx eslint "{src,test}/**/*.ts"` → sạch → AC-6

### UI / manual (gọi API, Postman folder `19 Tin yêu thích` nửa sau và folder `09`)
Dựng sẵn: chủ trọ L1 với tin X, Y (hiện) và Z (chủ trọ ẩn); T1 lưu X; T2 lưu Y.
- [ ] `GET /listings?pageSize=50` với khách, token rác, token hết hạn thật (lấy token hợp lệ, đặt `exp` ở quá khứ, ký lại bằng khóa của server), tiêu đề `Authorization: Basic ...` → 200 (không bao giờ 401), `isFavorite` là `null` ở mọi phần tử → AC-6
- [ ] Cùng request với T1 → X `true`, Y `false`; với T2 → X `false`, Y `true`; với chủ trọ và admin đã đăng nhập → `false` ở mọi phần tử (không phải `null`, không 403) → AC-6, AC-7
- [ ] Mỗi phần tử có đúng các trường cũ cộng `isFavorite`; `landlord` chỉ có `id` và `name`; `Cache-Control: private, no-store`; Z (đang ẩn) không có trong danh sách → AC-6
- [ ] Duyệt mọi trang `pageSize=2` với T1: `isFavorite` của từng tin khớp tập `favorites` thô của T1 → AC-6 (Value sourcing: `isFavorite` lấy từ token và dòng `favorites`)
- [ ] `GET /listings/:slugCode` của X và Y với từng loại người xem ở trên → `isFavorite` đúng; `Cache-Control: private, no-store`; các trường chi tiết cũ giữ nguyên cộng `isFavorite`; Z → 404 `LISTING_NOT_FOUND` → AC-6
- [ ] T1 lưu Y rồi bỏ lưu Y → chi tiết và danh sách đọc lại ngay thấy `true` rồi `false`; T2 không bị ảnh hưởng (vẫn lưu Y) → AC-6
- [ ] `GET /me/listings`, `GET /me/listings/:id`, `GET /moderation/listings`, `GET /properties` không có trường `isFavorite`; `GET /me/favorites` luôn `isFavorite: true` → AC-6

## Kết quả đo `EXPLAIN` (Critical test scenarios, một lần, không chỉnh)
Đo ngày 2026-10-21 trên database thử với 60 048 tin giả lập (3 000 chủ trọ, mỗi chủ trọ 20 tin, 10% đang ẩn, 5% xóa mềm, 5% chủ trọ hết dùng thử), hạn mức dùng thử 2, mỗi câu chạy 3 lần lấy lần nhanh nhất, dùng đúng `publicListingFrom` và `publicListingCondition` trong `dist`:

| Người lưu | Câu | Thời gian |
|---|---|---|
| 200 tin (17 tin đang hiện) | trang 1 (20 dòng đầu) | 2,4 ms |
| 200 tin | trang cuối (OFFSET sâu) | 2,2 ms |
| 200 tin | đếm tổng | 2,4 ms |
| 5 000 tin (460 tin đang hiện) | trang 1 | 2,4 ms |
| 5 000 tin | trang cuối (OFFSET sâu) | 52,6 ms |
| 5 000 tin | đếm tổng | 47,6 ms |

Kế hoạch dùng chỉ mục `favorites_user_id_created_at_idx` cho trang 1; câu đếm của người lưu 5 000 tin chuyển sang nối băm và quét tuần tự. Chậm hơn khi số tin đã lưu lớn, nhưng nhỏ hơn nhiều so với số đo của phép đếm ở danh sách công khai (spec 0003 AC-13: từ vài trăm mili giây đến vài giây ở 60 nghìn tin). Không chỉnh gì vì đây là bản demo (bạn đã chọn bỏ qua ngân sách thời gian ngày 2026-10-19).

## Đã chạy thật trên database thử (2026-10-21)
- 1 078 bài unit qua (trước đó 1 031), `tsc` và `eslint` sạch.
- Mốc 1: script gọi thật 245 kiểm tra HTTP và SQL, cộng script giới hạn tần suất 11 kiểm tra. Bốn điều khiển âm (bỏ `skipDuplicates`, bỏ kiểm tin hiện công khai khi lưu, bỏ chặn admin, bỏ điều kiện hiển thị công khai ở danh sách đã lưu) đều bị script bắt (mỗi điều khiển làm ít nhất 3 kiểm tra sai).
- Mốc 2: script gọi thật 127 kiểm tra. Ba điều khiển âm (cờ danh sách luôn `false`, cờ chi tiết luôn `false`, controller không truyền người xem) đều bị bắt (mỗi điều khiển làm ít nhất 4 kiểm tra sai).
- Newman toàn bộ (folder 00, 01, 03, 04, 05, 07 đến 19): 405 request và 828 assertion, 0 lỗi, hai lần liên tiếp trên cùng một database. Folder 02 (cần token gửi qua email) và folder 06 (giới hạn tần suất, chạy riêng) không nằm trong lần chạy.
- Log server của các lần chạy sạch (script mốc 1, script giới hạn tần suất, script mốc 2 và các lần Newman): 0 lỗi 500, 0 cảnh báo pg.

## Phát hiện khi build
- `ADMIN_PERMISSIONS` là `manage` của mọi module, nên admin qua được guard quyền `favorite:*` (đúng như spec dự đoán ở Security model). Service chặn riêng loại tài khoản `admin` bằng 403 ở cả ba route, giống `follow` (spec 0005) và `OrdersService.create` (spec 0004). Một negative control (bỏ chặn) cho admin lưu được và ghi dòng `favorites`.
- Folder 09 của Postman có một assertion kiểm chặt danh sách trường của phần tử `GET /listings`; đã thêm `isFavorite` vào danh sách đó (đổi có chủ đích của AC-6, không phải hồi quy).
- Folder 19 chạy một mình sẽ 401 vì thiếu `userToken` và `tenantToken` (do folder 01, 08, 09 lưu); chạy sau folder 09 trong cùng một lần là đúng như mô tả của folder.

## Acceptance-criteria coverage
- AC-1 … lưu, lặp, đồng thời, nguồn giá trị, ràng buộc DB (mốc 1) · AC-2 … bỏ lưu, bỏ lưu id lạ và tin đã xóa (mốc 1) · AC-3 … bảy loại tin không lưu được, `INVALID_ID` (mốc 1) · AC-4 … danh sách, thứ tự, trường, phân trang, header (mốc 1) · AC-5 … tin biến và quay lại, đối chứng độc lập, khớp chi tiết công khai (mốc 1) · AC-6 … `isFavorite` ở danh sách và chi tiết, mọi loại người xem, danh sách khác không đổi (mốc 2) · AC-7 … khách, chủ trọ, admin, chủ trọ được cấp quyền (mốc 1, mốc 2) · AC-8 … 120 lần mỗi giờ mỗi API, 300 lần mỗi phút (mốc 1)
