# Verify: đánh giá chủ trọ · spec 0014 · updated 2026-11-07
_Steps derived from spec 0014 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Xong **mốc 1** (AC-1 đến AC-10, AC-13, AC-14) và **mốc 2** (AC-11, AC-12, cùng chạy lại AC-1, AC-2, AC-8 với đánh giá bị ẩn) trong một lần build ngày 2026-11-07, kèm dữ liệu mẫu trong `seed:demo` theo yêu cầu của bạn. Mọi con số "đã chạy" dưới đây là của lần build này. Spec không có giao diện, nên mục "UI / manual" là gọi API (Postman folder `26 Đánh giá chủ trọ`).

## Commands
- [ ] `npx tsc --noEmit` và `npx eslint "{src,apps,libs,test}/**/*.ts"` → sạch → mọi AC
- [ ] `npm test` → toàn bộ qua (đã chạy: 93 bộ, 2109 bài), gồm `reviews.service.spec.ts`, `review-moderation.service.spec.ts`, `reviews.repository.spec.ts`, `reviews.mapper.spec.ts`, `reviews.controller.spec.ts`, `dto/review-dtos.spec.ts`, `landlords.service.spec.ts` và `landlords.mapper.spec.ts` (hồ sơ chín trường), các bảng `rate-limits.spec.ts`, `permission-catalog.spec.ts`, `migration-defaults.spec.ts`, `route-declarations.spec.ts` và `demo/demo-reviews.spec.ts` → mọi AC
- [ ] `npx prisma migrate deploy` trên database trống rồi `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` → in "This is an empty migration", không lệch (đã chạy) → AC-14
- [ ] Trên database đã có dữ liệu: `npm run migration:deploy` → tạo bảng `reviews` và thêm đúng bốn khóa `review:*` cho `tenant`, `landlord` không thêm khóa nào, chạy lại phần dữ liệu không đổi gì (`WHERE k <> ALL ("permissions")`) → AC-14
- [ ] Newman với mọi folder trừ 02, 06, 23, 24 của `docs/api/postman-collection.json`, có `--working-dir docs/api`, trên database trống mới seed (đã chạy: 23 folder, 741 request, 1611 assertion, 0 lỗi, hai lần), folder 26 riêng (70 request) → AC-1 đến AC-12
- [ ] `npm run seed:demo` rồi `npm run seed:demo -- --reset` (kể cả khi một người thật có đánh giá và nhật ký ẩn trỏ vào chủ trọ demo) → thoát 0, mỗi lần đủ 30 đánh giá, 35 cuộc trò chuyện, 69 tin nhắn (đã chạy: đạt, hai lần `--reset`); bỏ bước xóa `reviews` trong `deleteDemoData` thì `--reset` hỏng ở `tx.user.deleteMany()` vì khóa ngoại RESTRICT (đã chạy: bị bắt) → AC-14

## UI / manual (gọi API, Postman folder `26 Đánh giá chủ trọ`)

AC-9, quyền và cách ly:
- [ ] Khách gọi cả bốn route `/landlords/:id/review` → 401 `TOKEN_MISSING`; chủ trọ mặc định → 403 `PERMISSION_DENIED`; admin gọi cả bốn → 403 `PERMISSION_DENIED` và không ghi dòng nào; admin gửi id sai → 400 `INVALID_ID`, body sai hoặc body rỗng ở `PATCH` → 400 `VALIDATION_FAILED` (pipe chạy trước Service) → AC-9 (đã chạy: đạt)
- [ ] Người tìm trọ và chủ trọ gọi ba route kiểm duyệt → 403 `PERMISSION_DENIED`; khách → 401; admin không cấp được `review:moderate` cho `tenant` (400 `PERMISSION_ADMIN_ONLY`) → AC-9, AC-11
- [ ] Không route nào nhận id của đánh giá ở phía người viết; phản hồi công khai không có email, số điện thoại, id người viết hay `status` → AC-9 (đã chạy: đạt, kể cả quét chuỗi phản hồi)

AC-4, điều kiện được đánh giá (mỗi ca: 403 `REVIEW_NOT_ELIGIBLE` và không ghi dòng nào):
- [ ] Người tìm trọ nhắn mà chủ trọ chưa trả lời; nhiều tin của người tìm trọ vẫn chưa được trả lời; chỉ nhắn với chủ trọ khác; chưa nhắn ai → 403, và `GET /landlords/:id/review` cho `canReview: false`
- [ ] Chủ trọ trả lời xong → `canReview: true` và `POST` được 201; tin của chủ trọ đã xóa mềm hay đang ẩn không làm mất điều kiện → AC-4 (đã chạy: đạt)

AC-3, ghi và kiểm đầu vào:
- [ ] `POST` với `stars` 5 và nhận xét có khoảng trắng hai đầu → 201, đúng bảy trường, nhận xét đã bỏ khoảng trắng, xuống dòng ở giữa giữ nguyên, `status` `visible`, `hiddenReason` `null`, `createdAt` bằng `updatedAt`, `Cache-Control: private, no-store`; DB: người viết từ token, chủ trọ từ đường dẫn → AC-3, AC-8
- [ ] `stars` 0, 6, 4.5, `"5"`, `null`, thiếu; `comment` rỗng, toàn khoảng trắng, 1001 ký tự, 1001 emoji, số, có NUL; trường lạ `authorId`, `landlordId`, `status`, `id` → mỗi ca 400 `VALIDATION_FAILED` kèm đúng trường, không ghi dòng nào → AC-3 (đã chạy: đạt)
- [ ] `comment` vắng và `null` → 201 và DB lưu `NULL`; 1000 ký tự, 1000 emoji, 1000 ký tự cộng khoảng trắng hai đầu, `stars` 1 → 201 → AC-3

AC-5, trùng cặp, đồng thời, tự đánh giá:
- [ ] `POST` lần hai → 409 `REVIEW_ALREADY_EXISTS`, đánh giá cũ không đổi → AC-5
- [ ] 20 lần `POST` đồng thời cùng một cặp (người dùng mới để bộ đếm 20 lần mỗi giờ còn nguyên) → đúng một 201 và 19 lần 409, đúng một dòng mới trong DB → AC-5 (đã chạy: đạt)
- [ ] Admin cấp `review:create` cho `landlord`: chủ trọ tự đánh giá mình → 409 `CANNOT_REVIEW_SELF` (kiểm trước khi tra chủ trọ), đánh giá chủ trọ khác chưa trả lời → 403; `GET` mình cho `canReview: false`; khôi phục quyền mặc định → AC-5, AC-8

AC-6 và AC-7, sửa và xóa:
- [ ] `PATCH` `stars` → 200, nhận xét giữ nguyên, `createdAt` không đổi, `updatedAt` mới hơn (DB cũng vậy); `comment: null` xóa nhận xét; gửi lại đúng giá trị cũ vẫn đổi `updatedAt`; người khác sửa chỉ đổi đánh giá của chính họ → AC-6
- [ ] `PATCH` body rỗng, `stars` 0 hoặc 6 hoặc `null` (kể cả kèm `comment`), `comment` rỗng, 1001 ký tự, trường lạ → 400 và dòng không đổi (kể cả `updated_at`); chưa có đánh giá → 404 `REVIEW_NOT_FOUND`; đánh giá đang bị ẩn → 409 `REVIEW_HIDDEN` và dòng không đổi → AC-6
- [ ] `DELETE` → 204 không body, dòng bị xóa hẳn, hai con số của hồ sơ đổi ngay, viết lại được; xóa lần hai → 404 `REVIEW_NOT_FOUND`; xóa đánh giá đang bị ẩn → 204 (nhật ký ẩn còn lại) → AC-7

AC-8, đánh giá của tôi và `canReview`:
- [ ] Chưa viết nhưng đủ điều kiện → `{ review: null, canReview: true }`; đã viết → `canReview: false`, `review` đủ bảy trường; chủ trọ, tenant hay admin hay id không có làm `:id` → 404 `LANDLORD_NOT_FOUND`; `abc` → 400 → AC-8
- [ ] Gỡ `review:create` khỏi `tenant` rồi tenant đăng nhập lại → `canReview: false` dù đủ điều kiện chat; trả lại quyền → `true` (quyền đọc từ token, không trễ quá một lần refresh) → AC-8
- [ ] Đánh giá bị ẩn → người viết thấy `status` `hidden_by_admin` kèm `hiddenReason` là lý do ẩn **gần nhất** khi ẩn nhiều lần → AC-8, AC-12

AC-2, danh sách công khai:
- [ ] Khách: 200, đúng bốn khóa, mỗi phần tử đúng bảy trường, `isMine` `null`, mới viết trước; 26 dòng chia ba trang cỡ 10 ghép lại đúng thứ tự, không lặp (nguồn đối chiếu là SQL độc lập); trang vượt cuối → rỗng, `total` giữ nguyên; chín dòng cùng `created_at` → thứ tự phụ `id` giảm dần → AC-2
- [ ] `page` 0, `pageSize` 0 hoặc 51, `page=abc`, tham số lạ (`sort`, `q`, `landlordId`) → 400 `VALIDATION_FAILED`; id `abc` → 400 `INVALID_ID`; chủ trọ không có, là tenant, là admin → 404 `LANDLORD_NOT_FOUND` → AC-2
- [ ] Token sai → 200 và `isMine` `null`, không bao giờ 401; người đăng nhập → `isMine` `true` đúng ở dòng của mình → AC-2 (đã chạy: đạt)

AC-1, hai con số của hồ sơ:
- [ ] `GET /landlords/:id` đúng chín trường; `reviewCount` bằng `total` của danh sách; `ratingAverage` khớp phép tính SQL `numeric` độc lập; 87 sao trên 20 đánh giá → **4.4** (đúng 4,35 làm tròn nửa lên); chưa có đánh giá → `reviewCount` 0 và `ratingAverage` `null` (không phải 0); `POST` và `DELETE /landlords/:id/follow` cũng trả chín trường → AC-1 (đã chạy: đạt)

AC-10, trạng thái tài khoản:
- [ ] Khóa người viết → đánh giá rời danh sách và hai con số ngay (dòng còn nguyên); mở khóa hoặc bỏ xóa mềm → trở lại; người viết bị khóa mà token còn hạn gọi `POST`, `PATCH`, `DELETE` → 403 `ACCOUNT_LOCKED` → AC-10
- [ ] Khóa chủ trọ → hồ sơ, danh sách, `GET` mình, `POST`, `PATCH`, `DELETE` đều 404 `LANDLORD_NOT_FOUND`, đánh giá còn nguyên và hiện lại khi mở khóa; xóa mềm chủ trọ cũng 404 → AC-10

AC-11 và AC-12, kiểm duyệt của admin:
- [ ] `GET /moderation/reviews`: đúng bốn khóa, mỗi phần tử đúng chín trường kèm id và tên hai bên, không email hay số điện thoại, đủ mọi dòng (kể cả người viết bị khóa), mới viết trước khớp nguồn độc lập; lọc `status`, `landlordId`, `authorId` riêng và cùng lúc; `status` lạ, `landlordId` hay `authorId` không phải UUID, `page` 0, tham số lạ → 400 `VALIDATION_FAILED` → AC-11
- [ ] `hide` với lý do có khoảng trắng hai đầu → 200, `hidden_by_admin`, `hiddenReason` đã cắt; đúng một dòng `moderation_logs` (`review`, `hide_review`, lý do, người thao tác là admin); chỉ cột `status` đổi (`created_at`, `updated_at`, `stars`, `comment` giữ nguyên); rời danh sách công khai và hai con số ngay → AC-12
- [ ] `hide` lần hai → 409 `REVIEW_STATE_INVALID` không ghi log; `unhide` đánh giá đang hiện → 409; `unhide` → 200, `visible`, `hiddenReason` `null`, thêm đúng một dòng log `unhide_review`, trở lại danh sách và hai con số; thiếu lý do, lý do rỗng hay 501 ký tự, trường lạ → 400; id không có → 404 `REVIEW_NOT_FOUND`; id sai → 400 `INVALID_ID` → AC-12
- [ ] 20 lệnh `hide` đồng thời cùng một đánh giá → đúng một 200 và 19 lần 409, đúng một dòng log → AC-12 (đã chạy: đạt)
- [ ] 12 vòng `hide` đua với `PATCH`: sửa luôn nhất quán (thắng thì có giá trị mới, bị chặn thì 409 và dòng giữ nguyên), `hide` trên dòng đang hiện luôn 200, trạng thái cuối khớp kết quả → AC-12 (đã chạy: đạt, ẩn thắng và sửa thắng đều xảy ra)
- [ ] 12 vòng `hide` đua với `DELETE`: xóa luôn 204 và dòng biến mất; `hide` hoặc 200 kèm đúng một log, hoặc 404 với không quá một log (lệnh ẩn đã ghi xong rồi người viết xóa trước lúc đọc lại, hoặc xóa đến trước) → AC-12 (đã chạy: đạt)
- [ ] Admin vẫn ẩn và gỡ ẩn được khi chủ trọ đang bị khóa → AC-12

AC-13, giới hạn tần suất (script riêng, khởi động lại server để đặt lại bộ đếm):
- [ ] `PATCH` lần 21 → 429 `RATE_LIMITED` kèm `Retry-After` từ 1 đến 3600; ngay sau đó `DELETE` và `POST` vẫn qua (bộ đếm riêng mỗi route); người dùng khác vẫn qua; `POST` lần 21 và `DELETE` lần 21 cũng 429 → AC-13
- [ ] `GET /landlords/:id/reviews` lần 301 trong một phút → 429 kèm `Retry-After` tối đa 60; `GET /landlords/:id/review` có bộ đếm riêng, vẫn 200 → AC-13 (đã chạy: đạt)

AC-14, ràng buộc ở DB (hỏi schema thật rồi `INSERT` thẳng):
- [ ] Có `reviews_pkey`, hai khóa ngoại RESTRICT, `reviews_stars_check`, `reviews_comment_check`, `reviews_status_check`, `reviews_author_landlord_check`, unique `reviews_author_id_landlord_id_unique`, chỉ mục `reviews_landlord_id_created_at_idx` → AC-14
- [ ] DB từ chối bảy `INSERT`: trùng cặp (23505), người viết bằng chủ trọ, `stars` 0, `stars` 6, `comment` rỗng, `comment` 1001 ký tự, `status` lạ; chấp nhận `comment` `NULL` và đúng 1000 ký tự; xóa người dùng đang có đánh giá bị khóa ngoại chặn → AC-14 (đã chạy: đạt)
- [ ] Sau migration `tenant` giữ bốn khóa `review:read`, `review:create`, `review:update`, `review:delete` (không có `review:moderate`), `landlord` không giữ khóa `review:*` nào → AC-14, AC-9

Dữ liệu mẫu (`seed:demo`, ngoài spec, theo yêu cầu của bạn):
- [ ] Hồ sơ qua API khớp: Khoa 8 đánh giá (4,5), Nhung 7 (4,3), Bảo 4 (3,3), Phát 3 (4,7), Huy 2 (4,5), Tâm 1 (5,0), Mai và Hà chưa có (`null`); Lan bị khóa → 404 dù còn 3 dòng; đánh giá của Sơn (người viết bị khóa) không có ở danh sách Khoa; mỗi số khớp phép tính SQL độc lập → (đã chạy: đạt)
- [ ] Đăng nhập bằng tài khoản demo: Lan Anh với Phát → `canReview: true` và viết được 201; Tuấn với Bảo (chưa được trả lời) → `canReview: false` và `POST` 403 `REVIEW_NOT_ELIGIBLE`; Quân thấy đánh giá về Nhung `hidden_by_admin` kèm `hiddenReason`, sửa 409 `REVIEW_HIDDEN`; admin thấy cả 30 đánh giá và đúng 1 `hidden_by_admin` → (đã chạy: đạt)

## Value sourcing (mỗi giá trị có nguồn, vary đầu vào để bắt nguồn sai)
- [ ] Người gọi và loại tài khoản (`RequestUser`) → đổi qua khách, tenant, landlord, admin: đúng bảng quyền và đúng 403 của admin → AC-9
- [ ] `author_id` từ token, không từ body → hai người viết khác nhau cùng viết về một chủ trọ ra hai dòng với đúng người viết; body có `authorId` → 400 → AC-3, AC-5
- [ ] `landlord_id` từ `:id` rồi qua `findActiveLandlord` → đổi `:id` qua chủ trọ hợp lệ, tenant, admin, không có, bị khóa, xóa mềm: chỉ chủ trọ hợp lệ qua → AC-3, AC-10
- [ ] `stars`, `comment` từ body qua DTO → bảng giá trị biên ở AC-3 và AC-6 → AC-3, AC-6
- [ ] Đủ điều kiện từ `ChatRepository.hasLandlordReplied` → bốn tình huống chat, tin ẩn hay xóa mềm, chủ trọ trả lời sau → AC-4
- [ ] `id`, `created_at`, `updated_at`, `status` ban đầu từ DB → `POST` ra `visible`, hai mốc bằng nhau; `PATCH` đổi `updated_at` mỗi lần → AC-3, AC-6
- [ ] `canReview` = chưa có đánh giá và có `review:create` trong token và không phải chính chủ trọ và đủ điều kiện → bỏ từng vế một thì ra `false` → AC-8
- [ ] `hiddenReason` từ dòng `hide_review` mới nhất → ẩn, gỡ, ẩn lần hai với lý do khác: ra lý do lần hai; đang `visible` thì `null` dù còn log cũ → AC-8, AC-11
- [ ] `author.name` từ `users.name` qua ánh xạ tên của hồ sơ → tên rỗng hay toàn khoảng trắng ra `null` (kiểm bằng test đơn vị `reviews.mapper.spec.ts`) → AC-2
- [ ] `isMine` so `author_id` với token, khách `null` → khách, token sai, chính chủ, người khác → AC-2
- [ ] Thứ tự, `total`, `page`, `pageSize` từ `created_at` giảm dần rồi `id` giảm dần và `count(*)` cùng điều kiện → 26 dòng, ba trang, các dòng cùng `created_at` → AC-2
- [ ] `reviewCount`, `ratingAverage` từ đúng tập dòng của danh sách → khóa người viết, ẩn, xóa, xóa mềm: hai con số và `total` đổi cùng nhau; số đối chiếu tính bằng SQL `numeric` → AC-1, AC-10, AC-12
- [ ] `author { id, name }`, `landlord { id, name }`, bộ lọc ở danh sách admin → đối chiếu với `users`; ba bộ lọc riêng và cùng lúc → AC-11
- [ ] Người thao tác và lý do của `hide`, `unhide`, dòng `moderation_logs` → dòng có `target_type` `review`, `target_id` đúng, `action`, `reason` đã cắt, `actor_id` là admin → AC-12

## Điều khiển âm (phá cố ý một chỗ trong `dist`, chạy lại phép kiểm, rồi trả về)
19 điều khiển, **cả 19 bị bắt** (số kiểm hỏng ghi sau tên; lần chạy `verify-r1` có 239 kiểm, `verify-r2` có 89):
- [x] Bỏ kiểm "chủ trọ đã trả lời" khi tạo → 27 hỏng
- [x] Danh sách và hai con số bỏ lọc `status = 'visible'` → 1 hỏng
- [x] Danh sách và hai con số bỏ lọc "người viết đang hoạt động" → 3 hỏng
- [x] Bỏ kiểm admin ở bốn route của người viết → 4 hỏng
- [x] Hai con số lấy từ một tập khác với danh sách (bỏ mọi lọc) → 2 hỏng
- [x] Câu `UPDATE` của `PATCH` bỏ điều kiện `status = 'visible'` → 2 hỏng
- [x] `INSERT` bỏ `ON CONFLICT DO NOTHING` → 3 hỏng
- [x] Bỏ kiểm tự đánh giá chính mình → 1 hỏng
- [x] `canReview` bỏ kiểm quyền `review:create` trong token → 1 hỏng
- [x] `isMine` luôn `false` với người đăng nhập → 2 hỏng
- [x] Trung bình cắt xuống thay vì làm tròn nửa lên → 5 hỏng
- [x] `DELETE` chỉ xóa được đánh giá đang hiện → 10 hỏng
- [x] `hide` bỏ điều kiện trạng thái nguồn → 9 hỏng
- [x] `hide` không ghi dòng `moderation_logs` → 11 hỏng
- [x] Danh sách admin chỉ trả đánh giá đang hiện → 3 hỏng
- [x] `hide` đọc lại không kèm lý do ẩn → 2 hỏng
- [x] `hide` cũng đổi `updated_at` → 1 hỏng
- [x] `hide` đánh giá không có trả 409 thay vì 404 → 4 hỏng
- [x] Bỏ bước xóa `reviews` trong `deleteDemoData` → `seed:demo -- --reset` hỏng ở `tx.user.deleteMany()` (khóa ngoại RESTRICT)

## Acceptance-criteria coverage
- AC-1 đo bằng hồ sơ chín trường, nguồn SQL độc lập, ca 87 sao trên 20 đánh giá, khóa người viết · AC-2 danh sách, ba trang, thứ tự phụ, đăng nhập tùy chọn · AC-3 ghi và kiểm đầu vào · AC-4 bốn tình huống chat · AC-5 trùng, 20 lần đồng thời, tự đánh giá · AC-6 sửa, `REVIEW_HIDDEN` · AC-7 xóa · AC-8 `canReview`, `hiddenReason` · AC-9 quyền và admin 403 · AC-10 khóa và xóa mềm hai phía · AC-11 danh sách admin · AC-12 ẩn, gỡ ẩn, log, đua · AC-13 429 mỗi route đếm riêng · AC-14 ràng buộc DB và quyền mặc định.

## EXPLAIN (đo một lần, không chỉnh; AC-1, AC-2)
Một chủ trọ có 5000 đánh giá trong bảng 50 000 dòng (10 chủ trọ, 5000 người viết, khoảng 8% người viết bị khóa, đã `ANALYZE`), đúng câu SQL Prisma sinh ra, `EXPLAIN (ANALYZE, BUFFERS)`, trung vị 7 lần:
- Danh sách trang 1 (20 dòng): **0,06 ms**. Quét chỉ mục `reviews_landlord_id_created_at_idx` rồi nối `users` bằng khóa chính, dừng sau 20 dòng.
- Danh sách trang cuối (`skip` 4980): **3,6 ms**. Bitmap theo chỉ mục `landlord_id`, hash join với `users`, sắp xếp 5000 dòng.
- Đếm `total`: **2,3 ms**; hai con số của hồ sơ (`count` và `sum`): **2,1 ms**. Cùng kế hoạch bitmap và hash join.
- Mỗi lần mở hồ sơ thêm một truy vấn gộp (khoảng 2 ms ở quy mô này). Không chỉnh vì là bản demo (đã ghi ở mục 9 của tài liệu FE). Chưa đo nhiều chủ trọ cùng có nhiều đánh giá.

## Cách chạy lại (script không nằm trong repo)
Các script nằm trong scratchpad của phiên build `2a00618d-b381-4f10-aa0f-429b81b38519` (dưới `C:\Users\Lenovo\AppData\Local\Temp\claude\e6e7ba5983779e99\`) nên có thể đã mất; chép từ phiên chat (spec 0013) rồi sửa tên nếu cần. Tên và việc của chúng: `lib.js` (đường dẫn, môi trường, database thử `rental_management_verify`, cổng 3055), `reset-db.js` (xóa schema có chốt chặn, `migrate deploy`, `dist/database/seed.js`), `server.js start|stop`, `chat-lib.js` và `review-lib.js` (gọi API, đăng ký, dựng tin, nguồn đối chiếu SQL), `verify-r1.js` (239 kiểm mốc 1), `verify-r2.js` (89 kiểm mốc 2), `control-r1.js` (điều khiển âm, `--only=` chọn số), `explain-r1.js`, `verify-seed.js` (48 kiểm dữ liệu mẫu), `postman-reviews.js` (sinh folder 26 và sửa folder 03, 18; chạy lại được), `run-newman.js main` (Newman nằm ở scratchpad của phiên `781252a4…`, thêm folder `26` vào danh sách).
Lưu ý khi chạy lại:
- Chạy `reset-db.js` ở shell **không** nạp `.env` vào `DATABASE_NAME`; `npm run seed` chạy `npm run build` trước, nên điều khiển âm vá `dist` phải làm sau bước seed.
- `.env` của bạn có `ACCESS_TTL_SECONDS` hai lần (dòng 7 là 900, dòng 43 là 60; dòng sau thắng). Với 60 giây, bộ Newman hết token giữa chừng; `lib.js` đặt 900 riêng cho môi trường kiểm, không đụng `.env`.
- Mỗi lần chạy `verify-r1.js` cần database vừa reset (có hạn 10 lần đăng ký mỗi giờ theo IP: script tự khởi động lại server để đặt lại bộ đếm).
- Folder 26 dùng token có sẵn (`userToken`, `tenantToken`, `otherLandlordToken`, `adminToken`), không đăng ký hay đăng nhập admin lại; các ca cần đổi quyền, nhiều tài khoản hay khóa nằm ở script riêng.
