# Verify: tin đang hiện trên hồ sơ chủ trọ · spec 0009 · updated 2026-10-21
_Steps derived from spec 0009 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Chạy trên một database thử (đã dùng `rental_management_verify`), không chạy trên database đang dùng. Dọn schema, rồi `npx prisma migrate deploy` và `npm run seed`, khởi động lại server trước mỗi lần chạy (bộ đếm giới hạn tần suất nằm trong bộ nhớ; đăng ký tối đa 10 lần mỗi giờ theo IP). Mỗi bước đối chiếu với **hàng thô** bằng SQL, không chỉ với phản hồi. Cần bảy tài khoản: năm chủ trọ (một có ba tin, một có hai tin, một hết dùng thử, một bị khóa rồi mở khóa, một bị xóa mềm bằng SQL), hai người tìm trọ, và admin seed. Hạn mức dùng thử đặt bằng `PATCH /settings/trial_listing_limit` (100 khi dựng dữ liệu, rồi hạ xuống 5, 3, 1, 0).

## Commands
- [ ] `npx tsc --noEmit` và `npx eslint "src/landlords/**/*.ts" "src/listings/listings.repository*.ts"` → sạch → AC-1 đến AC-8
- [ ] `npm test` → toàn bộ qua, gồm `landlords.service.spec.ts` (chín bài mới của `listListings`), `listings.repository.spec.ts` (năm bài mới của điều kiện chủ trọ) và `route-declarations.spec.ts` (route mới khai báo đúng một kiểu quyền) → AC-1 đến AC-8
- [ ] `git status --short prisma/` → rỗng: không migration, không bảng, không cột, không chỉ mục mới → Decision
- [ ] Newman với mọi folder trừ 06 của `docs/api/postman-collection.json` trên database trống mới seed, hai lượt liền (khởi động lại server giữa hai lượt vì bộ đếm đăng nhập admin nằm trong bộ nhớ; folder 18 không đăng nhập admin thêm lần nào) → không request hay assertion nào lỗi, ngoài hai assertion đã biết của folder 02 (cần email thật) → AC-1 đến AC-7

## UI / manual (gọi API, Postman folder `18 Hồ sơ công khai của chủ trọ`)

AC-1, AC-3, ba tin của một chủ trọ (A, B, C đăng cách nhau 25 ms; chủ trọ khác có hai tin):
- [ ] Khách `GET /landlords/:id/listings` → 200, đúng bốn khóa `items`, `total`, `page`, `pageSize`; trang 1 và 20 dòng; `Cache-Control: private, no-store`; ba phần tử theo thứ tự C, B, A → AC-1
- [ ] Mỗi phần tử đúng 15 khóa của phần tử `GET /listings`; `landlord` chỉ có `id` và `name`; duyệt hết `GET /listings` (pageSize 50) lấy tin của chủ trọ này thì **từng phần tử giống hệt** → AC-1
- [ ] `total` bằng `publicListingCount` của `GET /landlords/:id` và bằng số tin của chủ trọ đó trong `GET /listings` cộng mọi trang; hồ sơ vẫn đúng bảy trường → AC-3

AC-5, mọi loại người xem (người tìm trọ T1 đã lưu C):
- [ ] Khách, token `khong-phai-token`, token hết hạn thật (đặt `exp` trong quá khứ, ký lại bằng khóa của server), tiêu đề `Authorization: Basic ...` → 200, không bao giờ 401, `isFavorite` là `null` ở cả ba phần tử → AC-5
- [ ] T1 → C là `true`, A và B là `false`; người tìm trọ chưa lưu gì, chủ trọ xem chính mình, chủ trọ khác, admin → `false` ở mọi phần tử → AC-5
- [ ] Cờ của T1 khớp dòng `favorites` thô; danh sách giống hệt `GET /listings` của cùng người xem kể cả `isFavorite`; T1 lưu A rồi bỏ lưu A thì đọc lại thấy đổi ngay (`[true, false, true]` rồi `[true, false, false]`) và cờ của T2 không đổi → AC-5

AC-6, phân trang và tham số:
- [ ] `pageSize=51`, `page=0`, `pageSize=0`, `page=abc`, `pageSize=1.5`, `sort=price_asc`, `q=abc`, `wardCode=...`, `minPrice=1`, `page=1&foo=bar` → mỗi cái 400 `VALIDATION_FAILED` → AC-6
- [ ] `pageSize=50` → 200; `page=99` → 200, `items` rỗng, `total` đúng; hai trang liên tiếp (`pageSize=2`) ghép lại bằng danh sách đầy đủ, không trùng, không sót → AC-6

AC-7, không lộ và không ghi:
- [ ] Phần tử không có khóa `phone`, `email`, `viewCount`, `status`, `moderationReason`, `description`, `images`; văn bản JSON không chứa `@example.com` → AC-7
- [ ] Chụp `view_count` của mọi tin, gọi danh sách với chín loại người xem, chụp lại → bằng nhau; đếm `follows`, `favorites`, `moderation_logs` trước và sau → bằng nhau → AC-7
- [ ] `GET /listings` giữ nguyên 15 khóa mỗi phần tử; hồ sơ giữ nguyên bảy trường → AC-7

AC-2 và AC-3, tin bẩn và các hạn mức (chủ trọ có A, B, C, D ẩn bởi chủ, E ẩn bởi admin, F xóa mềm, G ở nhà trọ xóa mềm bằng SQL, rồi V1, V2, V3):
- [ ] Với hạn mức 100, 5, 3, 1, 0, và cho cả hai chủ trọ: danh sách bằng **phép tính độc lập từ dòng thô** (tin `visible` chưa xóa, xếp theo `(created_at, id)`, lấy N đầu, bỏ tin ở nhà trọ xóa mềm, mới đăng trước); `total` bằng độ dài và bằng `publicListingCount`; cùng tập tin với `GET /listings` → AC-2, AC-3
- [ ] Với từng hạn mức, mỗi tin của hai chủ trọ nằm trong danh sách **khi và chỉ khi** `GET /listings/:slugCode` của khách trả 200 → AC-2
- [ ] D, E, F, G không bao giờ hiện; không bao giờ có tin của chủ trọ khác; đúng giá trị đã biết: hạn mức 5 cho V1, C, B, A (G chiếm hạng 3 rồi bị loại), hạn mức 3 cho C, B, A, hạn mức 1 cho A, hạn mức 0 cho danh sách rỗng và `total` 0; trả hạn mức 100 thì V3, V2, V1, C, B, A → AC-2, AC-3
- [ ] Chủ trọ có hai tin, đặt `trial_ends_at` về quá khứ bằng SQL → 200, `items` rỗng, `total` 0, hồ sơ vẫn 200 với `publicListingCount` 0; mua gói nhỏ nhất (`POST /orders`, `POST /orders/:id/pay`) → hai tin trở lại, `total` 2 bằng `publicListingCount`, khớp phép tính độc lập → AC-3

AC-4, chủ trọ không hợp lệ:
- [ ] Id của người tìm trọ, của admin, id không tồn tại (UUID đúng dạng) → 404 `LANDLORD_NOT_FOUND`, cùng mã lỗi với `GET /landlords/:id` → AC-4
- [ ] Admin khóa chủ trọ → 404; mở khóa → 200 và nội dung **giống hệt** lúc trước khi khóa → AC-4
- [ ] Chủ trọ xóa mềm bằng SQL → 404 → AC-4
- [ ] Id `abc`, `123`, `...8dzz` → 400 `INVALID_ID`; id sai và query sai cùng lúc → vẫn 400 (spec không định mã nào đứng trước); id đúng dạng nhưng không phải chủ trọ kèm `pageSize=99` → 400 `VALIDATION_FAILED` (kiểm query trước khi tra chủ trọ) → AC-4, AC-6

AC-8, giới hạn tần suất (chạy sau khi chờ 62 giây cho cửa sổ đếm cũ hết):
- [ ] 300 lần liền đều 200, lần thứ 301 → 429 `RATE_LIMITED` kèm `Retry-After` từ 1 đến 60 giây; hồ sơ và `GET /listings` vẫn 200 vì mỗi API đếm riêng → AC-8

Điều khiển âm (bước kiểm thật, không phải test tự động; sửa file build trong `dist`, không đụng mã nguồn, rồi dựng lại `dist` sạch):
- [ ] Bỏ điều kiện `p.landlord_id` khỏi câu SQL → danh sách lộ tin của chủ trọ khác: nhiều kiểm tra phải sai → AC-2, AC-3
- [ ] Bỏ bước tra chủ trọ hợp lệ trong `listListings` → id người tìm trọ, admin, id lạ, chủ trọ bị khóa và chủ trọ xóa mềm nhận 200 thay vì 404: các kiểm tra 404 phải sai → AC-4
- [ ] Cờ `isFavorite` luôn `false` cho người đã đăng nhập → T1 không thấy tim ở C: các kiểm tra cờ phải sai → AC-5

Giá trị theo bảng Value sourcing (mỗi hàng một kiểm tra):
- [ ] `p.landlord_id` từ `:id` qua `uuidParam()` → id sai dạng 400, tin của chủ trọ khác không bao giờ lẫn vào → AC-2, AC-4
- [ ] Chủ trọ hợp lệ từ `findActiveLandlord` → năm loại id không hợp lệ đều 404 như hồ sơ → AC-4
- [ ] Những tin nào và `total` từ `findPublicPage` với `landlordId` → phép tính độc lập, `GET /listings`, chi tiết công khai → AC-2, AC-3
- [ ] `now` từ controller, một lần mỗi request → chạy lại toàn bộ script với phiên database ở `America/Los_Angeles` và `Pacific/Kiritimati` (qua `PGOPTIONS="-c timezone=..."`) → kết quả không đổi → AC-2, AC-3
- [ ] `trialListingLimit` từ `settings` → hạ hạn mức 100, 5, 3, 1, 0 thì danh sách đổi ngay → AC-2, AC-3
- [ ] Thứ tự `created_at DESC, id DESC` cố định → C, B, A; tham số `sort` bị 400 → AC-1, AC-6
- [ ] `page`, `pageSize`, `skip` từ query → hai trang liên tiếp, trang vượt cuối, biên 51 và 0 → AC-6
- [ ] Các trường tin từ `publicSummaryInclude` và `toListingSummary` → từng phần tử giống hệt phần tử của `GET /listings` → AC-1
- [ ] `isFavorite` từ token và `favorites` → chín loại người xem ở trên → AC-5

## Acceptance-criteria coverage
- AC-1 … bốn khóa, 15 khóa mỗi phần tử, thứ tự, header, giống hệt `GET /listings` · AC-2 … hạn mức 100, 5, 3, 1, 0, tin ẩn, xóa, nhà trọ xóa, chủ trọ khác, danh sách khi và chỉ khi chi tiết mở được, điều khiển âm bỏ `p.landlord_id` · AC-3 … `total` bằng `publicListingCount` và bằng `GET /listings`, hết dùng thử, mua gói · AC-4 … năm loại id không hợp lệ, khóa rồi mở khóa, `INVALID_ID`, điều khiển âm bỏ bước tra chủ trọ · AC-5 … chín loại người xem, khớp `favorites` thô, đọc lại ngay sau lưu và bỏ lưu, điều khiển âm cờ luôn false · AC-6 … mười tham số sai, biên 50, trang vượt cuối, hai trang liên tiếp · AC-7 … không lộ khóa nào, `view_count` và ba bảng không đổi · AC-8 … đúng 300 rồi 429, `Retry-After`, mỗi API đếm riêng

## Kết quả đã chạy 2026-10-21
- Kiểm thật bằng script gọi API và SQL: **159 kiểm tra, 0 sai**, trên database thử sạch đã migrate và seed, server mới khởi động. Lần chạy đầu có 2 kiểm tra sai, cả hai do lỗi của chính script (viết sai thứ tự `[true, false, false]` và giả định bộ đếm giới hạn chung giữa các API), đã sửa script, không sửa mã.
- Điều khiển âm, cả ba đều bị bắt: bỏ điều kiện `p.landlord_id` → **56 kiểm tra sai** (danh sách lộ tin của chủ trọ khác, `total` lệch `publicListingCount`, hai trang liên tiếp sai); bỏ bước tra chủ trọ → **10 sai** (năm loại id nhận 200 với `items` rỗng thay vì 404, và năm lần so mã lỗi với hồ sơ); cờ `isFavorite` luôn `false` → **5 sai**. Sau điều khiển cuối đã `npm run build` lại để `dist` sạch.
- Múi giờ phiên database: chạy lại script (bỏ phần AC-8) với `America/Los_Angeles` và `Pacific/Kiritimati`, mỗi lần database dọn sạch: **154 kiểm tra, 0 sai** cả hai (đã kiểm `SHOW timezone` thấy `PGOPTIONS` có hiệu lực).
- `npx tsc --noEmit` và ESLint sạch; `npm test`: 65 suite, **1226 bài** qua (thêm 14 bài: 9 của Service, 5 của Repository).
- Newman mọi folder trừ 06: **493 request, 1037 assertion, hai lượt liền** (khởi động lại server giữa hai lượt); chỉ hai assertion đã biết của folder 02 (`Đặt lại mật khẩu`, `Đổi mật khẩu`, cần email thật) sai ở cả hai lượt. Folder 18 có 13 request mới, không đăng nhập admin thêm lần nào.
- `EXPLAIN (ANALYZE, BUFFERS)` một lần ở **60 317 tin** và 3 009 tài khoản giả lập, chạy ba lần lấy lần nhanh nhất, **không chỉnh gì** (bản demo): chủ trọ nổi có 300 tin, hạn mức 50 (50 tin hiện): trang 1 **12,2 ms**, trang cuối 12,0 ms, câu đếm 12,2 ms; cùng chủ trọ hạn mức 2 (2 tin hiện): 13,4 ms, 12,2 ms, 12,0 ms; chủ trọ thường có 20 tin, hạn mức 2: **0,29 ms**, 0,27 ms, 0,24 ms. Kế hoạch đi qua `properties_landlord_id_idx` rồi `listings_property_id_idx`, nên chi phí theo số tin của riêng chủ trọ đó. Đối chiếu `GET /listings` trang đầu không điều kiện chủ trọ ở cùng dữ liệu: **1 038 ms** (đã biết là chậm, spec 0003 AC-13). Trang đầu và câu đếm chạy song song nên độ trễ gần với con số lớn hơn của hai câu.

## Ghi chú
- **Mỗi API đếm giới hạn riêng**: bộ đếm `publicRead` tính theo từng route, nên 300 lần ở danh sách tin không làm hồ sơ hay `GET /listings` bị 429. Spec nói "nhóm `publicRead` có sẵn, 300 lần mỗi phút theo IP" và đúng như vậy; FE guide ghi rõ bộ đếm riêng.
- **Tin ở nhà trọ xóa mềm vẫn chiếm hạng** trong luật hạn mức (câu đếm hạng của `publicListingCondition` không lọc `p2.deleted_at`), nên G chiếm hạng 3 ở hạn mức 5 rồi bị loại, chủ trọ còn lại A, B, C, V1. Đây là hành vi sẵn có của hai mảnh SQL dùng chung, không đổi ở spec này. Qua API thường không tạo được tình huống này (nhà trọ còn tin thì không xóa được), nên chỉ gặp khi sửa SQL tay.
- Spec không định thứ tự khi `:id` sai định dạng và query cũng sai; script chỉ đòi 400. Id đúng dạng nhưng không phải chủ trọ kèm query sai nhận 400 `VALIDATION_FAILED` (query được kiểm trước khi tra chủ trọ).
- Ca khóa, mở khóa, hết dùng thử, mua gói, hạn mức hạ thấp, xóa mềm bằng SQL, 300 lần rồi 429 và điều khiển âm cần nhiều tài khoản, SQL hoặc sửa `dist` nên chỉ có ở script kiểm này, không có trong Postman folder 18. Folder 18 chỉ chạy các request đọc, không tạo thêm tài khoản, không ghi gì.
