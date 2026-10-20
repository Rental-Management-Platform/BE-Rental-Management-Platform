# Verify: theo dõi chủ trọ và hồ sơ công khai · spec 0005 · updated 2026-10-20 (mốc 1 và mốc 2)
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## Mốc 1: bảng `follows` và hồ sơ công khai, phần đọc (AC-1 đến AC-5, AC-9 phần đọc)

Chạy trên một database thử, không chạy trên database đang dùng. Mốc 1 chưa có API theo dõi (mốc 2), nên các dòng `follows` chèn tay bằng `INSERT`. Đăng nhập admin bằng `ADMIN_SEED_*` trong `.env` để khóa, mở khóa tài khoản và đổi `trial_listing_limit`.

### Commands
- [ ] `npm run migration:deploy` trên database trống → mọi migration áp xong, bảng `follows` có ba cột `user_id`, `landlord_id`, `created_at` → AC-2, AC-3
- [ ] Hỏi schema thật bảng `follows`: khóa chính `follows_pkey (user_id, landlord_id)`, hai khóa ngoại `follows_user_id_fk` và `follows_landlord_id_fk` đều `ON DELETE RESTRICT`, `follows_self_check CHECK (user_id <> landlord_id)`, chỉ mục `follows_landlord_id_idx` → AC-2, AC-3
- [ ] `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → "No difference detected", exit 0 → AC-2, AC-3
- [ ] `INSERT INTO follows` trùng cặp (người theo dõi, chủ trọ) → bị khóa chính chặn (SQLSTATE `23505`, ràng buộc `follows_pkey`) → AC-3
- [ ] `INSERT INTO follows` với `user_id` bằng `landlord_id` → bị `follows_self_check` chặn (SQLSTATE `23514`) → AC-8 (lớp cuối ở DB)
- [ ] `npm test` → toàn bộ qua (gồm `landlords.service.spec.ts`, `landlords.repository.spec.ts`, `landlords.mapper.spec.ts`, `error-code.spec.ts`, `listings.repository.spec.ts` và `route-declarations.spec.ts`) → AC-1 đến AC-5, AC-9
- [ ] `npx tsc --noEmit` và `npx eslint "{src,test}/**/*.ts"` → sạch → AC-1 đến AC-5

### UI / manual (gọi API, Postman folder `18 Hồ sơ công khai của chủ trọ`)
Dựng sẵn: chủ trọ L1 có một nhà trọ và 5 tin (hạn mức tạm nâng lên 5 để đăng đủ), trong đó một tin bị xóa mềm (5 lượt xem) và một tin bị chủ trọ ẩn (7 lượt xem), ba tin còn lại có 10, 20, 30 lượt xem; rồi đặt `trial_listing_limit` về 2. Ba người tìm trọ T1, T2, T3 và một người T4 chưa theo dõi ai. Chèn tay `follows` (T1, T2, T3 theo dõi L1).
- [ ] Khách `GET /landlords/:id` của L1 (không token) → 200; đúng bảy khóa `id, name, joinedAt, followerCount, totalViewCount, publicListingCount, isFollowing`; `name` đúng `users.name`; `joinedAt` bằng `users.created_at`; `isFollowing` là `null`; ba số là số nguyên không âm → AC-1 (Value sourcing: `id`, `joinedAt`, `name`)
- [ ] Phản hồi có `Cache-Control: private, no-store` và thân JSON không chứa email, số điện thoại hay chữ `@` → AC-1
- [ ] Token sai, token hết hạn (ký đúng bí mật nhưng `exp` ở quá khứ) → vẫn 200 với `isFollowing: null`, không 401 → AC-1
- [ ] T1 (đã theo dõi) → `isFollowing: true`; T4 (chưa theo dõi) → `false`; chính L1 xem hồ sơ mình → 200 với `false`; các số giống nhau với mọi người xem → AC-1 (Value sourcing: `isFollowing`)
- [ ] Hồ sơ của chủ trọ L2 khác (1 người theo dõi, 300 lượt xem, 2 tin) không bị lẫn số của L1 → AC-1, AC-3, AC-4, AC-5
- [ ] `GET /landlords/<id của một tenant>`, `<id của admin>`, `<uuid không có>` → 404 `LANDLORD_NOT_FOUND`, `message` "Không tìm thấy chủ trọ."; `GET /landlords/abc` → 400 `INVALID_ID` → AC-2
- [ ] Admin khóa L1 → `GET` của L1 là 404 `LANDLORD_NOT_FOUND`, số dòng `follows` của L1 còn nguyên; admin mở khóa → `GET` là 200 và ba số y như trước khi khóa → AC-2
- [ ] Đặt `users.deleted_at` của L1 → 404; bỏ đi → 200 → AC-2
- [ ] `followerCount` của L1 là 3; admin khóa T1 → 2; mở khóa T1 → 3; đặt `deleted_at` của T2 → 2; bỏ đi → 3; xóa dòng `follows` của T3 → 2; chèn lại → 3 → AC-3 (Value sourcing: `followerCount`)
- [ ] `totalViewCount` của L1 là 72 (10 + 20 + 30 + 5 của tin xóa mềm + 7 của tin ẩn); chủ trọ ẩn tin, admin ẩn tin, chủ trọ xóa tin, đặt `trial_ends_at` ở quá khứ → vẫn 72; thêm một lượt xem vào một tin → 73 → AC-4 (Value sourcing: `totalViewCount`)
- [ ] `publicListingCount` của L1 bằng tổng số tin của L1 mà `GET /listings?q=<từ khóa riêng>&pageSize=2` trả cộng mọi trang, **và** bằng một phép đếm độc lập tính từ dòng thô, ở `trial_listing_limit` 5, 4, 3, 2, 1, 0, 2 → AC-5 (Value sourcing: `publicListingCount`)
- [ ] Chủ trọ hết dùng thử và chưa có gói (`trial_ends_at` ở quá khứ) → hồ sơ vẫn 200, `publicListingCount` là 0, `totalViewCount` không giảm; mua gói thì `publicListingCount` bằng `min(số tin đang hiện, max_listings của gói)`; gói hết hạn thì lại 0 và `GET /listings` cũng 0 → AC-4, AC-5
- [ ] 300 lần `GET /landlords/:id` liên tiếp từ một IP → đều tới được route; lần 301 → 429 `RATE_LIMITED` kèm `Retry-After` (giây, từ 1 đến 60) → AC-9 phần đọc
- [ ] Newman folder `18` (cùng folder 00, 01, 03, 04, 05, 07, 08, 09 trước đó) → 0 lỗi → AC-1, AC-2, AC-5

### Điều khiển âm (đã làm khi build, 2026-10-20)
Sửa file đã build trong `dist` để phá đúng một luật, chạy lại 62 phép kiểm, mỗi lần phải có đúng các phép kiểm tương ứng báo SAI, rồi `npx nest build` để khôi phục.
- [x] Đếm người theo dõi không lọc tài khoản đang hoạt động → 2 phép kiểm sai (khóa và xóa mềm người theo dõi) → AC-3
- [x] `totalViewCount` chỉ cộng tin `visible` chưa xóa → 8 phép kiểm sai → AC-4
- [x] `publicListingCount` bỏ luật hạn mức, chỉ còn "visible và chưa xóa" → 10 phép kiểm sai → AC-5
- [x] Khách nhận `isFollowing: false` thay vì `null` → 3 phép kiểm sai → AC-1

### Đã kiểm khi build (2026-10-20)
- [x] 62 phép kiểm HTTP và SQL trên `rental_management_verify` (tất cả các dòng ở "UI / manual" ở trên trừ giới hạn tần suất và Newman), bản build sạch 62 trên 62 sau khi khôi phục.
- [x] Giới hạn đọc: lần 1 đến 300 qua, lần 301 là 429 `RATE_LIMITED` kèm `Retry-After: 60`.
- [x] Newman folder 00, 01, 03, 04, 05, 07, 08, 09, 18: 94 request, 184 assertion, 0 lỗi (không chạy folder 02 vì cần token gửi qua email).
- [x] `npm test`: 57 bộ, 1015 test qua; `tsc` và `eslint` sạch.
- [x] `EXPLAIN (ANALYZE, BUFFERS)` một lần ở 60 060 tin và 32 021 dòng theo dõi giả lập (3 000 chủ trọ, mỗi người 20 tin; 5 000 người thuê, mỗi người theo dõi 6 chủ trọ; một chủ trọ nổi có khoảng 2 000 người theo dõi; một phần người theo dõi bị khóa hoặc xóa mềm), tốt nhất của ba lần chạy, **ghi số, không chỉnh** (đây là bản demo):

  | Câu truy vấn | Chủ trọ thường | Chủ trọ nổi (khoảng 2 000 người theo dõi) |
  |---|---|---|
  | Tra chủ trọ hợp lệ (khóa chính `users`) | 0,012 ms | 0,010 ms |
  | Đếm người theo dõi đang hoạt động (đúng câu Prisma sinh ra: quét chỉ mục `follows_landlord_id_idx`, nối `users` bằng khóa chính; ở chủ trọ nổi băm cả bảng `users` nên chậm hơn) | 0,039 ms | 1,485 ms |
  | Tổng `view_count` qua nhà trọ (chỉ mục `properties_landlord_id_idx` và `listings_property_id_idx`) | 0,029 ms | 0,028 ms |
  | Số tin đang hiện (hai mảnh SQL công khai, hạn mức 2) | 0,189 ms | 0,259 ms |
  | Tra `isFollowing` (khóa chính `follows_pkey`, quét chỉ mục) | 0,008 ms | 0,012 ms |

  Chủ trọ "thường" trong lần đo này (số 1500) rơi vào nhóm hết dùng thử của dữ liệu giả lập nên số tin đang hiện là 0 và câu đếm tin đi ngắn hơn; chủ trọ nổi có số tin đang hiện là 2 và cho cận trên thực tế của câu này. Ba câu gộp cộng lại dưới 2 ms ở cả hai chủ trọ (chạy song song nên thời gian thật còn thấp hơn tổng).

### Chưa kiểm được ở mốc 1
- Theo dõi và bỏ theo dõi bằng API (AC-6, AC-7), chạy lặp và hai lần gọi đồng thời, quyền (chủ trọ, admin, khách), tự theo dõi 409 `CANNOT_FOLLOW_SELF`, giới hạn `followWrite` (AC-8, AC-9 phần ghi): thuộc mốc 2. Cho tới khi có, `isFollowing` của người đăng nhập chỉ đổi được bằng `INSERT` tay.
- Chưa có phép kiểm tự động nào chạy trên database thật; các phép kiểm ở trên là script chạy tay. `/test` có thể khóa lại các dòng bền (hình dạng bảy trường, 404, `Cache-Control`).

## Mốc 2: theo dõi và bỏ theo dõi, phần ghi (AC-6 đến AC-9)

Chạy trên một database thử, không chạy trên database đang dùng. Server **mới khởi động** (bộ đếm giới hạn tần suất nằm trong bộ nhớ, và đăng ký tối đa 10 lần mỗi giờ theo IP). Đăng nhập admin bằng `ADMIN_SEED_*` trong `.env`. Dựng sẵn: chủ trọ L1 (một nhà trọ, một tin 40 lượt xem) và L2, năm người tìm trọ T1 đến T5.

### Commands
- [ ] `npm test` → toàn bộ qua (gồm `landlords.service.spec.ts`, `landlords.repository.spec.ts`, `rate-limits.spec.ts`, `error-code.spec.ts` và `route-declarations.spec.ts`) → AC-6 đến AC-9
- [ ] `npx tsc --noEmit` và `npx eslint "{src,test}/**/*.ts"` → sạch → AC-6 đến AC-9
- [ ] Newman folder `18` cùng folder 00, 01, 03, 04, 05, 07 đến 17 (trừ 02 và 06), trên database dựng lại từ đầu → 0 lỗi → AC-6 đến AC-9

### UI / manual (gọi API, Postman folder `18`, các request `[ghi]`)
- [ ] T1 `POST /landlords/<L1>/follow` → 200; đúng bảy khóa; `isFollowing` là `true`; `followerCount` tăng một; `Cache-Control: private, no-store`; `totalViewCount` 40 và `publicListingCount` 1 → AC-6 (Value sourcing: hồ sơ trả về)
- [ ] `follows` có đúng một dòng (T1, L1) với `created_at` có giá trị → AC-6 (Value sourcing: `user_id`, `landlord_id`, `created_at`)
- [ ] T2 gọi `POST` kèm body `{"userId": <T3>, "landlordId": <L2>}` → 200, dòng ghi là (T2, L1), không có dòng nào của T3 hay tới L2 → AC-6 (Value sourcing: người theo dõi lấy từ token, không từ body)
- [ ] `POST` lặp ba lần → 200 mỗi lần, `followerCount` không đổi, vẫn một dòng → AC-6
- [ ] Sáu vòng, mỗi vòng 10 `POST` đồng thời cùng một cặp (T3,L1), (T3,L2), (T4,L1), (T4,L2), (T2,L2), (T1,L2) → mọi lần 200, đúng một dòng mỗi cặp, `isFollowing` luôn `true`; `followerCount` của L1 bằng một phép đếm SQL độc lập (chỉ người theo dõi `active`, chưa xóa mềm) → AC-6, AC-3
- [ ] `GET /landlords/<L1>` bằng token T1 → `isFollowing: true`, cùng số với kết quả `POST`; bằng token T2 chưa theo dõi (khi chưa gọi) → `false`; khách → `null` → AC-6 (Value sourcing: `isFollowing`)
- [ ] T1 `DELETE /landlords/<L1>/follow` → 200, `isFollowing: false`, `followerCount` giảm một, dòng (T1, L1) mất còn các dòng khác nguyên → AC-7
- [ ] `DELETE` lặp khi chưa theo dõi → 200, số không đổi; 10 `DELETE` đồng thời → mọi lần 200 và dòng đã mất → AC-7
- [ ] Chủ trọ (quyền mặc định) `POST` và `DELETE` → 403 `PERMISSION_DENIED`; admin `POST` và `DELETE` → 403 `PERMISSION_DENIED` dù giữ `follow:manage`; khách → 401 `TOKEN_MISSING`; tổng số dòng `follows` không đổi và không có dòng nào mang id admin → AC-8
- [ ] T1 `POST` id không tồn tại, id của tenant, id của admin → 404 `LANDLORD_NOT_FOUND`; `DELETE` id không tồn tại và id của tenant → 404; `abc` → 400 `INVALID_ID` (cả `POST` và `DELETE`); admin gửi `abc` → 400, không phải 403 → AC-8
- [ ] T1 `POST /landlords/<T1>/follow` (id của chính mình, T1 không phải chủ trọ) → 409 `CANNOT_FOLLOW_SELF`, không phải 404; không có dòng (T1, T1) → AC-8
- [ ] Admin khóa L2 → `POST`, `DELETE` và `GET` của L2 đều 404 `LANDLORD_NOT_FOUND`, dòng (T1, L2) còn nguyên; mở khóa → `GET` bằng T1 là 200 với `isFollowing: true` → AC-2, AC-8
- [ ] Admin cấp `follow:create` và `follow:delete` cho `landlord` (`PATCH /account-types/landlord`, thêm hai khóa vào danh sách cũ), L1 đăng nhập lại → `POST` id của chính mình 409 `CANNOT_FOLLOW_SELF` và không có dòng (L1, L1); `DELETE` id của chính mình 200 với `isFollowing: false`; `POST` L2 → 200 và có dòng (L1, L2). Khôi phục danh sách quyền cũ → L1 `POST` lại bị 403 → AC-8
- [ ] T5 `POST` 60 lần → đều 200; lần 61 → 429 `RATE_LIMITED` kèm `Retry-After` (giây); `DELETE` của T5 vẫn 200 (đếm riêng); T4 `POST` vẫn 200 (đếm theo người dùng); `GET /landlords/<L1>` vẫn 200 → AC-9

### Điều khiển âm (đã làm khi build, 2026-10-20)
Sửa file đã build trong `dist` để phá đúng một luật, chạy lại phép kiểm, mỗi lần phải có đúng các phép kiểm tương ứng báo SAI, rồi `npx nest build` để khôi phục.
- [x] Bỏ `skipDuplicates` ở `createMany` → 4 phép kiểm sai: theo dõi lặp trả 500, 9 trong 10 lần đồng thời trả 500, 60 lần `POST` đầu trả 500 → AC-6
- [x] Bỏ kiểm admin ở `follow` và `unfollow` → 2 phép kiểm sai: admin `POST` và `DELETE` trả 200 (admin ghi được dòng) → AC-8
- [x] Bỏ kiểm tự theo dõi → 2 phép kiểm sai: tenant nhận 404 thay vì 409, chủ trọ có quyền nhận 500 do `follows_self_check` ở DB → AC-8
- [x] Nâng giới hạn `followWrite` từ 60 lên 600 → 2 phép kiểm sai: lần 61 không bị chặn, không có `Retry-After` → AC-9
- [x] Bỏ lệnh xóa ở `unfollow` → 6 phép kiểm sai: số không giảm, dòng không mất, `DELETE` đồng thời không xóa được → AC-7

### Đã kiểm khi build (2026-10-20)
- [x] 67 phép kiểm HTTP và SQL trên `rental_management_verify` (tất cả các dòng ở "UI / manual" ở trên trừ Newman), bản build sạch 67 trên 67 sau khi khôi phục.
- [x] Newman folder 00, 01, 03, 04, 05, 07 đến 18 trên database dựng lại từ đầu: 360 request, 729 assertion, 0 lỗi; chạy lại folder 07, 08, 09, 18 trên cùng database: 84 request, 193 assertion, 0 lỗi (nên folder 18 chạy lại được). Log server không có dòng ERROR. Không chạy folder 02 (cần token gửi qua email) và 06.
- [x] `npm test`: 57 bộ, 1031 test qua (trước mốc này 1015); `tsc` và `eslint` sạch.

### Chưa kiểm được ở mốc 2
- **Giới hạn 60 lần mỗi giờ không nằm trong Postman** (chạy 61 request mỗi lần sẽ làm collection nặng); chỉ có script chạy tay ở trên.
- Chưa đo `EXPLAIN` cho đường ghi: `INSERT ... ON CONFLICT DO NOTHING` và `DELETE` đều theo khóa chính của `follows`, không có truy vấn gộp mới. Đường đọc đã đo ở mốc 1.
- Chưa có phép kiểm tự động nào chạy trên database thật; các phép kiểm ở trên là script chạy tay. `/test` có thể khóa lại các dòng bền (200 kèm hồ sơ, chạy lặp, 403 cho admin, 409, 404).
- **Spec lệch một điểm, cần `/architect`:** mục Security model nói admin theo mặc định không giữ `follow:create`, nhưng admin giữ `manage` mọi module nên qua được guard quyền. Build đã chặn admin bằng 403 trong Service để AC-8 đúng như đã Accept (xem ghi chú ở bước 6 của Build plan). Cần sửa một dòng trong spec cho khớp.

## Acceptance-criteria coverage
- AC-1: hình dạng bảy trường, người xem, `Cache-Control`, không lộ dữ liệu · AC-2: id không phải chủ trọ, khóa, mở khóa, xóa mềm, `INVALID_ID` · AC-3: `followerCount` và ràng buộc DB · AC-4: `totalViewCount` · AC-5: `publicListingCount` (mốc 1).
- AC-6: theo dõi, chạy lặp, đồng thời, nguồn của người theo dõi · AC-7: bỏ theo dõi, chạy lặp, đồng thời · AC-8: quyền (chủ trọ, admin, khách), tự theo dõi, 404, 400, chủ trọ bị khóa · AC-9: phần đọc 300 mỗi phút theo IP (mốc 1) và phần ghi 60 mỗi giờ cho mỗi API theo người dùng (mốc 2).
