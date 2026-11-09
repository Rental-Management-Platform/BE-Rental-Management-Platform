# Verify: đánh giá từng phòng · spec 0015 · updated 2026-11-09
_Steps derived from spec 0015 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Xong **mốc 1** (AC-1 đến AC-10, AC-13, AC-14, AC-15) và **mốc 2** (AC-11, AC-12, AC-16: kiểm duyệt của admin và dữ liệu demo) ngày 2026-11-09. Mọi phép kiểm thật chạy trên database thử `rental_management_verify` (sau `migrate deploy` và `npm run seed`), API trên cổng 3055, mỗi lần chạy bắt đầu từ database sạch.

## Commands
- [ ] `npx tsc --noEmit` và `npx eslint "{src,test}/**/*.ts"` (không `--fix`) → sạch → mọi AC (đã chạy sau mốc 2: đạt)
- [ ] `npm test` → toàn bộ qua (đã chạy sau mốc 2: 101 bộ, 2330 bài; sau mốc 1 là 97 bộ, 2235 bài), gồm `listing-reviews.service.spec.ts`, `listing-reviews.repository.spec.ts`, `listing-reviews.controller.spec.ts`, `listing-review-moderation.service.spec.ts`, `listing-reviews.mapper.spec.ts`, `dto/listing-review-moderation-query.dto.spec.ts`, `demo-room-reviews.spec.ts`, `moderation-logs.repository.spec.ts`, các bài mới của `chat.repository.spec.ts`, `error-code.spec.ts`, `listings.mapper.spec.ts`, `listings.service.spec.ts`, và `route-declarations.spec.ts` (mọi route khai báo đúng một kiểu quyền) → AC-1 đến AC-13, AC-16
- [ ] `npx prisma migrate deploy` trên database trống rồi `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected", `migrate status` báo "Database schema is up to date" (14 migration) → AC-14 (đã chạy: đạt)
- [ ] Trên database đã có dữ liệu: `npm run migration:deploy` → tạo bảng `listing_reviews`, **không** đổi quyền của loại tài khoản nào (migration không có phần dữ liệu) → AC-14
- [ ] Newman với mọi folder trừ 02, 06, 23, 24 của `docs/api/postman-collection.json`, có `--working-dir docs/api`, trên database trống mới seed → 0 lỗi (đã chạy sau mốc 1: 24 folder, 802 request, 1740 assertion, 0 lỗi, folder 27 có 61 request, 129 dòng `pm.test`; sau mốc 2: 24 folder, 823 request, 1790 assertion, 0 lỗi, folder 27 có 82 request, 179 dòng `pm.test`; folder 26 và 03 vẫn qua) → AC-1 đến AC-12, AC-15
- [ ] `npm run seed:demo` rồi `npm run seed:demo -- --reset`, kể cả khi một người thật có đánh giá phòng (và nhật ký ẩn) về tin demo → thoát 0, đánh giá phòng của tài khoản demo và về tin demo bị xóa cùng nhật ký của chúng, đánh giá của người thật về tin thật còn nguyên, chạy lần hai liên tiếp vẫn thoát 0 → AC-14, AC-16 (đã chạy: 10 phép kiểm đạt; bỏ bước xóa `listing_reviews` trong `deleteDemoData` thì `--reset` hỏng với `listing_reviews_listing_id_fk`)
- [ ] `EXPLAIN (ANALYZE, BUFFERS)` đúng câu SQL Prisma sinh ra, một tin có 5.000 đánh giá trong bảng 50.000 dòng → ghi số, không chỉnh → AC-1, AC-2 (đã chạy: trang đầu 0,06 ms, trang cuối `skip` 4600 là 3,9 ms, đếm `total` 2,3 ms, hai con số 2,2 ms; danh sách theo chỉ mục `listing_reviews_listing_id_created_at_idx`; mẫu đo không có người viết bị khóa nên phép nối người viết hoạt động chưa loại dòng nào)

## UI / manual (gọi API, Postman folder `27 Đánh giá phòng`)

AC-14, bảng và ràng buộc (hỏi schema thật):
- [ ] Có `listing_reviews` đúng tám cột (không có `landlord_id`), `id` mặc định `uuidv7()`, `status` mặc định `visible`, ba CHECK (`stars`, `comment`, `status`), hai khóa ngoại RESTRICT, unique `(author_id, listing_id)`, chỉ mục `(listing_id, created_at DESC, id DESC)` → AC-14 (đã chạy: đạt)
- [ ] `INSERT` thẳng bị DB từ chối: `stars` 0 và 6, `comment` rỗng và 1001 ký tự, `status` lạ (mỗi ca `23514`), tin không có và người viết không có (`23503`), trùng cặp (`23505`); hợp lệ được: `comment` NULL, 1000 ký tự, `stars` 1 và 5; xóa người dùng đang có đánh giá bị RESTRICT chặn → AC-14 (đã chạy: đạt)
- [ ] `tenant` giữ đúng bốn khóa `review:*` và không giữ `review:moderate`; `landlord` không giữ khóa `review:*` nào; bảng `reviews` vẫn tám cột và đúng bảy ràng buộc cũ (không tính các dòng `*_not_null`) → AC-14 (đã chạy: đạt)

AC-9, quyền và cách ly:
- [ ] Khách gọi cả bốn route `/listings/:id/review` → 401 `TOKEN_MISSING`; chủ trọ mặc định → 403 `PERMISSION_DENIED`; admin gọi cả bốn → 403 `PERMISSION_DENIED`; admin gửi id sai → 400 `INVALID_ID`, body sai (`stars` 9) hay `PATCH` body rỗng → 400 `VALIDATION_FAILED` (pipe chạy trước Service); không dòng nào được ghi → AC-9 (đã chạy: đạt)
- [ ] `GET /listings/:id/reviews`: khách 200, token sai 200 (không bao giờ 401), admin 200; truyền `code` hay `slug-mã` thay vì UUID → 400 `INVALID_ID` → AC-2, AC-9 (đã chạy: đạt)
- [ ] Phản hồi công khai không có email, số điện thoại, id người viết, `status` hay `hidden`; không route nào nhận id của đánh giá ở phía người viết → AC-9 (đã chạy: đạt, kể cả quét chuỗi phản hồi)

AC-4, điều kiện được đánh giá (mỗi ca: 403 `LISTING_REVIEW_NOT_ELIGIBLE` và không ghi dòng nào):
- [ ] Nhắn về tin mà chủ trọ chưa trả lời; nhiều tin của người tìm trọ vẫn chưa được trả lời; chưa nhắn ai → 403, và `GET /listings/:id/review` cho `canReview: false`
- [ ] **Chủ trọ trả lời về một tin khác (A2) của cùng chủ trọ** rồi đánh giá tin A → 403; chủ trọ khác trả lời về tin khác → 403; người nhắn tự nhắn thêm vào cuộc trò chuyện (không tính là chủ trọ trả lời) → 403
- [ ] Cùng người đó ở tin A2 (đã được trả lời) → `canReview: true`; chủ trọ trả lời đúng cuộc trò chuyện về tin A → `canReview: true` và `POST` được 201 → AC-4 (đã chạy: đạt)

AC-3, ghi và kiểm đầu vào:
- [ ] `POST` với `stars` 5 và nhận xét có khoảng trắng hai đầu → 201, đúng bảy trường, nhận xét bỏ khoảng trắng và giữ xuống dòng ở giữa, `status` `visible`, `hiddenReason` `null`, `createdAt` bằng `updatedAt`, `Cache-Control: private, no-store`; dòng DB có người viết từ token và tin từ đường dẫn; bảng `reviews` không đổi → AC-3, AC-8 (đã chạy: đạt)
- [ ] `stars` 0, 6, 4.5, `"5"`, `null`, thiếu; `comment` rỗng, toàn khoảng trắng, 1001 ký tự, 1001 emoji, số, có NUL; trường lạ `authorId`, `listingId`, `status`, `id`, `landlordId` → mỗi ca 400 `VALIDATION_FAILED` kèm đúng trường, không ghi dòng nào → AC-3 (đã chạy: đạt)
- [ ] `comment` vắng và `null` → 201 và DB lưu `NULL`; 1000 ký tự, 1000 emoji, 1000 ký tự cộng khoảng trắng hai đầu, `stars` 1 → 201; tin không có → 404 `LISTING_NOT_FOUND`; id `abc` → 400 `INVALID_ID` → AC-3 (đã chạy: đạt)

AC-5, trùng cặp, đồng thời, tự đánh giá:
- [ ] `POST` lần hai → 409 `LISTING_REVIEW_ALREADY_EXISTS`, đánh giá cũ không đổi → AC-5 (đã chạy: đạt)
- [ ] 20 lần `POST` đồng thời cùng một cặp (người dùng mới để bộ đếm còn nguyên) → đúng một 201 và 19 lần 409, đúng một dòng mới trong DB → AC-5 (đã chạy: đạt; bỏ `ON CONFLICT DO NOTHING` thì 19 lần ra 500)
- [ ] Admin cấp `review:create` và `review:read` cho `landlord`: chủ trọ đánh giá tin của chính mình (cả hai tin) → 409 `CANNOT_REVIEW_SELF` (kiểm trước điều kiện chat), đánh giá tin của chủ trọ khác chưa trả lời → 403; `GET` mình cho `canReview: false`; khôi phục quyền mặc định rồi kiểm lại `landlord` không giữ khóa `review:*` → AC-5 (đã chạy: đạt)

AC-6 và AC-7, sửa và xóa:
- [ ] `PATCH` `stars` → 200, nhận xét giữ nguyên, `createdAt` không đổi, `updatedAt` mới hơn (DB cũng vậy); `comment: null` xóa nhận xét; gửi lại đúng giá trị cũ vẫn đổi `updatedAt`; người khác sửa chỉ đổi đánh giá của chính họ → AC-6 (đã chạy: đạt)
- [ ] `PATCH` body rỗng, `stars` 0 hoặc 6 hoặc `null` (kể cả kèm `comment`), `comment` rỗng, 1001 ký tự, trường lạ → 400 và dòng không đổi (kể cả `updated_at`); chưa có đánh giá → 404 `LISTING_REVIEW_NOT_FOUND`; tin không có → 404 `LISTING_NOT_FOUND` → AC-6 (đã chạy: đạt)
- [ ] `DELETE` → 204 không body, dòng bị xóa hẳn, `reviewCount` giảm một và `ratingAverage` khớp phép tính SQL độc lập ngay, viết lại được; xóa lần hai → 404 `LISTING_REVIEW_NOT_FOUND`; người khác xóa chỉ xóa của chính họ → AC-7 (đã chạy: đạt)

AC-8, đánh giá của tôi, `canReview` và đánh giá bị ẩn (ở mốc 1 giả lập bằng SQL vì chưa có route của admin):
- [ ] `GET /listings/:id/review` khi đã viết: `review` đủ bảy trường, `canReview: false`; chưa viết và chưa đủ điều kiện: `{ review: null, canReview: false }`; thiếu `review:create` trong token (đăng nhập lại sau khi gỡ khóa): `canReview: false` dù đủ điều kiện chat; có lại khóa: `true` → AC-8 (đã chạy: đạt)
- [ ] Đánh giá bị ẩn (`UPDATE ... status='hidden_by_admin'` kèm hai dòng log ẩn, lần mới nhất thắng, và một dòng log loại đích `review` cùng id): `GET` mình cho `status: hidden_by_admin` và `hiddenReason` đúng của loại `listing_review`; `PATCH` → 409 `LISTING_REVIEW_HIDDEN` và dòng không đổi; rời danh sách công khai; gỡ ẩn thì `hiddenReason` về `null` và sửa lại được; `DELETE` đánh giá đang ẩn → 204, nhật ký ẩn còn lại; viết lại được → AC-6, AC-7, AC-8 (đã chạy: đạt; lấy lý do từ loại đích sai thì phép kiểm này hỏng)

AC-2, danh sách công khai:
- [ ] Mới viết trước, bốn dòng cùng `created_at` thì `id` giảm dần (khớp thứ tự của SQL độc lập); khung `{ items, total, page, pageSize }`; ba trang cỡ 5 ghép lại đúng thứ tự (5, 5, 2); trang quá cuối → `items` rỗng, `total` giữ nguyên; `pageSize` 50 đủ 12 dòng → AC-2 (đã chạy: đạt)
- [ ] `page=0`, `pageSize=0`, `pageSize=51`, `page=abc`, tham số lạ (`sort`, `stars`, `extra`) → 400 `VALIDATION_FAILED`; id `abc` → 400 `INVALID_ID`; tin không có → 404; tin chưa có đánh giá → 200, `items` rỗng, `total` 0 → AC-2 (đã chạy: đạt)
- [ ] `isMine`: `null` với khách và token sai, `true` ở đúng dòng của người xem, `false` ở các dòng khác, người xem chưa viết thì không dòng nào `true` → AC-2 (đã chạy: đạt)

AC-1, hai con số của chi tiết tin:
- [ ] Tin có 20 đánh giá tổng 87 sao → `reviewCount` 20 và `ratingAverage` 4.4 (4,35 làm tròn nửa lên), khớp phép `round` của SQL numeric, và `reviewCount` bằng `total` của danh sách; tin chưa có đánh giá → 0 và `null`; khách và người đăng nhập nhận cùng hai số, các trường cũ (`isFavorite`, `description`, `images`, `property`, `landlord`) còn nguyên → AC-1 (đã chạy: đạt)
- [ ] Bốn danh sách thẻ tin (`GET /listings`, `GET /me/favorites`, `GET /landlords/:id/listings`, `GET /me/listings`) và `GET /me/listings/:id` **không** có `reviewCount` hay `ratingAverage` → AC-1 (đã chạy: đạt)

AC-10, hiển thị đi theo tin và tài khoản:
- [ ] Với từng lý do tin không hiện công khai: chủ trọ ẩn, admin ẩn, tin xóa mềm, nhà trọ xóa mềm, chủ trọ bị khóa, chủ trọ xóa mềm, hết dùng thử và hết gói, vượt hạn mức (hạn mức 1, tin đăng sau bị ẩn) → chi tiết công khai 404 và cả năm route (danh sách, `GET` mình, `POST`, `PATCH`, `DELETE` của chính người viết) 404 `LISTING_NOT_FOUND`, không ghi gì, dòng còn nguyên; khôi phục thì chi tiết 200 và đánh giá trở lại đủ số dòng cũ → AC-10 (đã chạy: đạt cả tám lý do)
- [ ] Khóa người viết: đánh giá rời danh sách và hai con số ngay (khớp nguồn độc lập), dòng không bị xóa, token còn hạn gọi `POST`, `PATCH`, `DELETE` → 403 `ACCOUNT_LOCKED`; mở khóa thì trở lại; xóa mềm người viết cũng rời, bỏ xóa mềm thì trở lại → AC-10 (đã chạy: đạt)

AC-13, giới hạn tần suất:
- [ ] `PATCH` 20 lần (404 mỗi lần), lần 21 → 429 `RATE_LIMITED` kèm `Retry-After` tối đa 3600; `DELETE` và `POST` vẫn qua (bộ đếm riêng), người dùng khác vẫn qua; `POST` và `DELETE` cũng bị 429 ở lần 21; `GET /listings/:id/reviews` 300 lần đầu qua, lần 301 → 429 kèm `Retry-After` tối đa 60, và `GET /listings/:id/review` có bộ đếm riêng → AC-13 (đã chạy: đạt)

AC-15, không lẫn với đánh giá chủ trọ:
- [ ] Một tenant đánh giá cả chủ trọ (route cũ `/landlords/:id/review`) lẫn phòng: bảng `listing_reviews` không đổi khi viết đánh giá chủ trọ; hồ sơ chủ trọ vẫn chín trường và `reviewCount` chỉ đếm bảng `reviews`; chi tiết tin chỉ đếm đánh giá phòng; `GET /moderation/reviews` không liệt kê đánh giá phòng nào; `GET`, `PATCH`, `DELETE` đánh giá chủ trọ chạy như cũ và không đụng đánh giá phòng → AC-15 (đã chạy: đạt)

## Value sourcing: mỗi giá trị đúng nguồn của nó (đổi đầu vào, kiểm đầu ra)
- [ ] Người gọi và loại tài khoản (`userId`, `accountType` từ token): đổi token thì đánh giá đọc và sửa được đổi theo; admin luôn 403; không route nào nhận id người viết → AC-9
- [ ] Tin (`:id`, qua `isPubliclyVisible`): UUID đúng → 200; `code` hay `slug-mã` → 400; UUID lạ → 404; tám lý do ẩn ở AC-10 → 404 → AC-10
- [ ] Đồng hồ và hạn mức dùng thử (`now` của request, `trial_listing_limit`): hạ hạn mức xuống 1 làm tin đăng sau 404, hết dùng thử làm 404, khôi phục thì trở lại → AC-10
- [ ] Người viết (`author_id`): body có `authorId` bị 400, dòng DB có người trong token → AC-3
- [ ] `stars`, `comment` (body qua DTO của 0014): bảng giá trị biên ở AC-3 và AC-6 → AC-3, AC-6
- [ ] Chủ trọ của tin (`findLandlordIdOf`): chủ trọ có quyền `POST` tin của chính mình → 409, chủ trọ của tin khác → 403 → AC-5
- [ ] Đủ điều kiện (`hasLandlordRepliedOnListing`): sáu ca ở AC-4, trong đó trả lời ở tin khác của cùng chủ trọ không tính → AC-4
- [ ] `id`, `created_at`, `updated_at`, `status` ban đầu (DB sinh): `createdAt` bằng `updatedAt` khi mới viết, `status` `visible`, `id` là UUID → AC-3
- [ ] `updated_at` của `PATCH` (`clock_timestamp()`): mỗi lần `PATCH` thành công đổi, kể cả gửi lại giá trị cũ → AC-6
- [ ] `canReview` (chưa viết, có `review:create`, khác chủ trọ của tin, đủ điều kiện): bốn nhánh của công thức, từng nhánh đổi riêng → AC-8
- [ ] `hiddenReason` (log mới nhất, loại đích `listing_review`, hành động `hide_listing_review`): hai lần ẩn lấy lần mới, dòng log loại đích khác cùng id không lẫn vào, đang hiện thì `null` → AC-8
- [ ] `author.name`, `isMine`, thứ tự, `total`, `page`, `pageSize` của danh sách: ở AC-2 → AC-2
- [ ] `reviewCount`, `ratingAverage` của chi tiết tin (đúng tập dòng của danh sách): 20 đánh giá tổng 87 sao ra 4.4, khóa người viết và đánh giá bị ẩn đổi số ngay → AC-1
- [ ] Danh sách admin (`author { id, name }`, `listing { id, code, title }`, ba bộ lọc `status`, `listingId`, `authorId`), và `hide`, `unhide` (người thao tác là admin, lý do đã bỏ khoảng trắng, dòng `moderation_logs` loại đích `listing_review`, `updated_at` không đổi) → AC-11, AC-12 (đã chạy: đạt, mục "Mốc 2" bên dưới)

## Mốc 2: kiểm duyệt của admin và dữ liệu demo (đã chạy 2026-11-09)
Kiểm thật bằng một script HTTP và database thật: **122 phép kiểm, 0 hỏng** (script `verify-m2.js`, dựng dữ liệu riêng gồm 2 chủ trọ, 3 người tìm trọ, 4 đánh giá phòng và 1 đánh giá chủ trọ để thử lẫn loại). Chạy lại mốc 1 sau khi sửa module: vẫn **336 phép kiểm, 0 hỏng**.
- [ ] `GET /moderation/listing-reviews`: khách 401 `TOKEN_MISSING`, người tìm trọ và chủ trọ 403 `PERMISSION_DENIED`, và cả hai route ghi cũng vậy, không ghi gì; `review:moderate` không nằm trong quyền mặc định của `tenant` hay `landlord`, và admin không cấp được cho loại khác (400 `PERMISSION_ADMIN_ONLY`) → AC-11, AC-12 (đã chạy: đạt)
- [ ] Admin: 200 khung `{ items, total, page, pageSize }`, `total` bằng số dòng của bảng (mọi trạng thái), thứ tự khớp SQL độc lập, mỗi phần tử đúng chín trường, `author { id, name }`, `listing { id, code, title }` khớp DB, không email, số điện thoại hay chủ trọ; đánh giá chỉ có sao ra `comment` `null` → AC-11 (đã chạy: đạt)
- [ ] Bộ lọc `listingId`, `authorId`, `status` (từng cái và cả ba cùng lúc, kết quả khớp số dòng thật), tin không có đánh giá → 200 rỗng, phân trang trang 2 cỡ 3 ra dòng thứ tư của thứ tự độc lập; `status=deleted`, `listingId=abc`, `authorId=123`, `page=0`, `pageSize=51`, `q`, `sort` và `landlordId` → 400 `VALIDATION_FAILED` → AC-11 (đã chạy: đạt)
- [ ] Admin vẫn thấy đánh giá của người viết bị khóa (còn ở danh sách công khai thì không), của tin bị chủ trọ ẩn và của tin bị xóa mềm (kèm mã và tiêu đề của tin), khi chủ trọ bị khóa vẫn gỡ ẩn được → AC-11 (đã chạy: đạt)
- [ ] `hide`: 200, `status` `hidden_by_admin`, `hiddenReason` là lý do đã bỏ khoảng trắng; đúng một dòng `moderation_logs` (loại đích `listing_review`, `hide_listing_review`, lý do, `actor_id` là admin); DB chỉ đổi `status` (`created_at`, `updated_at`, `stars`, `comment` giữ nguyên) → AC-12 (đã chạy: đạt)
- [ ] Sau `hide`: rời danh sách công khai, `reviewCount` và `ratingAverage` của chi tiết tin đổi ngay (2 đánh giá trung bình 3 thành 1 đánh giá trung bình 5) và khớp nguồn độc lập; hồ sơ chủ trọ (đánh giá chủ trọ) không đổi; người viết thấy `status` `hidden_by_admin` kèm `hiddenReason` ở `GET /listings/:id/review` với `canReview` `false`; `PATCH` → 409 `LISTING_REVIEW_HIDDEN` và dòng không đổi; `DELETE` được (204), nhật ký ẩn còn lại, viết lại được → AC-12, AC-6, AC-7, AC-8 (đã chạy: đạt)
- [ ] `hide` lần hai → 409 `LISTING_REVIEW_STATE_INVALID`; `unhide` đánh giá đang hiện → 409; cả hai không ghi log; `unhide` đưa thẳng về `visible`, thêm một dòng `unhide_listing_review`, trở lại danh sách và hai con số; ẩn, gỡ, ẩn lại thì `hiddenReason` là lý do lần mới nhất và đánh giá này có đúng 5 dòng log (ẩn, gỡ, ẩn, gỡ, ẩn) → AC-12 (đã chạy: đạt)
- [ ] 400 `INVALID_ID` (`abc`, cả hide và unhide); 400 `VALIDATION_FAILED` kèm trường `reason` khi thiếu, rỗng, toàn khoảng trắng, 501 ký tự, là số hay có trường lạ; 404 `LISTING_REVIEW_NOT_FOUND` khi id không có hay đánh giá đã bị xóa; **id của đánh giá chủ trọ ở route đánh giá phòng → 404 `LISTING_REVIEW_NOT_FOUND`, và id của đánh giá phòng ở `/moderation/reviews/:id/hide` → 404 `REVIEW_NOT_FOUND`**; không đổi dòng và không ghi log → AC-12, AC-15 (đã chạy: đạt)
- [ ] 20 lệnh `hide` đồng thời cùng một đánh giá → đúng một 200 và 19 lần 409, đúng một dòng log; 12 vòng ẩn đua với sửa của người viết → luôn nhất quán (sửa thắng hay ẩn thắng, không bao giờ sửa đè lên đánh giá đã ẩn, lệnh ẩn trên dòng `visible` luôn thành công); 12 vòng ẩn đua với xóa → xóa luôn thắng cuối cùng, ẩn thành công thì đúng một log, ẩn nhận 404 thì không quá một log → AC-12 (đã chạy: đạt)
- [ ] Chạy lại AC-1, AC-2, AC-8 với đánh giá bị ẩn bằng route của admin thay cho SQL: chi tiết tin và danh sách công khai khớp nguồn độc lập về tập dòng, thứ tự và hai con số; danh sách công khai không lộ `status` hay lý do → AC-1, AC-2, AC-8 (đã chạy: đạt)
- [ ] AC-15: `GET /moderation/reviews` chỉ liệt kê đánh giá chủ trọ (không lẫn đánh giá phòng) và `GET /moderation/listing-reviews` không liệt kê đánh giá chủ trọ; không dòng log loại `review` nào bị ghi khi ẩn đánh giá phòng → AC-15 (đã chạy: đạt)
- [ ] `FreshAuth` của hai route ghi và quyền của ba route chỉ kiểm bằng bài đơn vị (`listing-reviews.controller.spec.ts`: đúng một kiểu khai báo `review:moderate`, `@FreshAuth` ở `hide` và `unhide`, không giới hạn tần suất, `HttpCode` 200); chưa thử bằng một admin thứ hai bị khóa vì chỉ có một tài khoản admin → AC-12, AC-13 (chỉ đơn vị)

Dữ liệu demo (script `verify-seed-m2.js`: **45 phép kiểm, 0 hỏng**):
- [ ] `seed:demo` rồi `seed:demo -- --reset` hai lần liên tiếp → thoát 0 cả ba lần, dòng tóm tắt nêu "16 đánh giá phòng (1 bị admin ẩn)", sau mỗi lần cùng số dòng: 16 đánh giá phòng (1 ẩn, 1 dòng log loại `listing_review`), 51 cuộc trò chuyện, 101 tin nhắn, 30 đánh giá chủ trọ (1 dòng log loại `review`) → AC-16 (đã chạy: đạt)
- [ ] SQL độc lập: mỗi đánh giá phòng có cuộc trò chuyện của chính người viết trên ĐÚNG tin đó mà chủ trọ đã trả lời trước lúc viết; mỗi cặp (người viết, tin) một dòng → AC-4, AC-16 (đã chạy: đạt)
- [ ] Từng tin có đánh giá: số đếm và trung bình bằng SQL numeric khớp bảng kỳ vọng (phòng 18m² của Khoa 4 đánh giá và 4,3, studio Võ Văn Ngân 3 và 4,7, studio Pasteur 1 và 5, phòng gần sân bay 3 và 3, phòng gần Aeon 2 và 4,5, tin đang ẩn 1 và 3); chi tiết tin cho đúng `reviewCount` và `ratingAverage`, danh sách công khai có `total` bằng `reviewCount` và đúng tập, thứ tự; tin bị chủ trọ ẩn thì chi tiết 404 dù còn dòng; điểm nguyên 3 là số `3`; tin chưa có đánh giá cho 0 và `null`; phòng 18m² có 6 dòng nhưng 4 tính (một bị admin ẩn, một của Sơn bị khóa), có đánh giá chỉ sao, nhiều dòng và đã sửa mà không lộ lý do ẩn → AC-1, AC-2, AC-16 (đã chạy: đạt)
- [ ] Admin: `GET /moderation/listing-reviews` có 16 dòng đúng thứ tự độc lập, lọc `hidden_by_admin` ra đúng một dòng kèm `hiddenReason` từ nhật ký, đánh giá của tin đang ẩn vẫn thấy, `GET /moderation/reviews` vẫn 30 → AC-11, AC-15, AC-16 (đã chạy: đạt)
- [ ] Đăng nhập thật: Lan Anh ở tin cũ nhất của Phát `canReview` `true`; Tuấn nhắn Bảo chưa được trả lời `canReview` `false` và `POST` → 403 `LISTING_REVIEW_NOT_ELIGIBLE`; Linh `canReview` `true` ở tin cũ nhất của Nhung và `false` ở tin khác của Nhung; Quân thấy đánh giá bị ẩn kèm lý do và sửa → 409 `LISTING_REVIEW_HIDDEN`; Sơn (người viết bị khóa) đăng nhập 403 `ACCOUNT_LOCKED` → AC-8, AC-16 (đã chạy: đạt)

## Điều khiển âm (mỗi điều khiển đổi hành vi thật của `dist/`, rồi chạy lại cả bộ phép kiểm thật)
- [ ] Mốc 1: mười hai điều khiển, đều **bắt được** (đã chạy: 12 trên 12): bỏ kiểm chat về đúng tin (mọi cuộc trò chuyện đã được trả lời đều tính); bỏ kiểm tin hiện công khai; bỏ lọc `visible`; bỏ lọc người viết còn hoạt động; bỏ kiểm admin; hai con số lấy từ một tập khác với danh sách; `INSERT` không còn `ON CONFLICT DO NOTHING`; `UPDATE` không còn điều kiện `visible`; bỏ kiểm chủ trọ tự đánh giá; lý do ẩn lấy sai loại đích; `DELETE` bỏ kiểm tin hiện công khai; tin của chính người nhắn tính là chủ trọ đã trả lời → AC-1 đến AC-10, AC-14
- [ ] Mốc 2, ba điều khiển bắt buộc theo spec, đều **bắt được**: câu sửa của người viết bỏ điều kiện `visible` (3 phép kiểm hỏng: sửa đè lên đánh giá đã ẩn); `hide` và `unhide` bỏ điều kiện trạng thái nguồn trong câu `UPDATE` (9 hỏng: ẩn hai lần ra 200); không ghi dòng `moderation_logs` (12 hỏng) → AC-12
- [ ] Mốc 2, tám điều khiển thêm, đều **bắt được** (đã chạy: 11 trên 11 cả nhóm): dòng log ghi sai loại đích; lệnh bị từ chối luôn trả 404 (không bao giờ 409); danh sách admin bỏ bộ lọc `listingId`; bỏ bộ lọc `authorId`; danh sách admin áp luật công khai (chỉ `visible`); danh sách admin sắp cũ nhất trước; lý do ẩn lấy sai loại đích; phần tử admin lấy `listing.title` từ mã tin → AC-11, AC-12
- [ ] Dữ liệu demo, năm điều khiển, đều **bắt được** (đã chạy: 5 trên 5): `--reset` không còn xóa `listing_reviews` (hỏng với khóa ngoại RESTRICT ở `tx.listing.deleteMany`); seed không ghi đánh giá phòng nào; cuộc trò chuyện làm bằng chứng mở trên tin cũ nhất thay vì tin được đánh giá (hàm dựng từ chối vì cặp bị tạo hai lần); đánh giá bị ẩn không có dòng nhật ký đúng loại đích; chủ trọ không trả lời trong cuộc trò chuyện làm bằng chứng → AC-4, AC-14, AC-16
- Điều khiển "ghi log và đổi trạng thái không cùng giao dịch" không thử được bằng HTTP (chỉ đổi tính nguyên tử, không đổi kết quả thấy được); bài đơn vị `listing-review-moderation.service.spec.ts` kiểm `transition` và `logs.add` nhận đúng `tx` của cùng một lần `run`.

## Chưa đo (có chủ ý)
- `EXPLAIN` của danh sách admin không lọc (sắp theo `created_at`, `id` giảm dần trên cả bảng, không có chỉ mục riêng cho phép này): spec chỉ yêu cầu đo chi tiết tin và danh sách công khai (đã đo ở mốc 1), đây là màn hình chỉ admin dùng và là bản demo (không chỉnh nếu chậm). Khi lọc theo `listingId` thì điều kiện và thứ tự khớp chỉ mục `listing_reviews_listing_id_created_at_idx`, nhưng chưa đo xem planner có chọn nó không.

## Acceptance-criteria coverage
- AC-1 … hai con số khớp danh sách và nguồn độc lập, bốn thẻ tin không có trường → "AC-1, hai con số", Value sourcing, EXPLAIN · AC-2 … danh sách → "AC-2" · AC-3 … ghi và kiểm đầu vào → "AC-3" · AC-4 … điều kiện chat theo đúng tin → "AC-4" · AC-5 … trùng, đua, tự đánh giá → "AC-5" · AC-6 … sửa và đánh giá đang ẩn → "AC-6 và AC-7", "AC-8" · AC-7 … xóa → "AC-6 và AC-7"
- AC-8 … `canReview` và `hiddenReason` → "AC-8" · AC-9 … quyền, admin, cách ly → "AC-9" · AC-10 … tám lý do ẩn, khóa người viết → "AC-10" · AC-13 … giới hạn tần suất → "AC-13" · AC-14 … bảng, ràng buộc, quyền không đổi, `--reset` → "AC-14", Commands · AC-15 … không lẫn đánh giá chủ trọ → "AC-15"
- AC-11 … danh sách, bộ lọc, quyền, tin ẩn hay xóa vẫn thấy → "Mốc 2: kiểm duyệt của admin và dữ liệu demo" · AC-12 … hide, unhide, log, đua, 409 và 404 → "Mốc 2", "Điều khiển âm" · AC-16 … dữ liệu demo, `--reset` hai lần, đối chiếu số → "Dữ liệu demo" (`verify-seed-m2.js`), `demo-room-reviews.spec.ts`
