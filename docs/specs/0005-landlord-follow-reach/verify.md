# Verify: theo dõi chủ trọ và hồ sơ công khai · spec 0005 · updated 2026-10-20 (mốc 1)
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

## Acceptance-criteria coverage
- AC-1: hình dạng bảy trường, người xem, `Cache-Control`, không lộ dữ liệu · AC-2: id không phải chủ trọ, khóa, mở khóa, xóa mềm, `INVALID_ID` · AC-3: `followerCount` và ràng buộc DB · AC-4: `totalViewCount` · AC-5: `publicListingCount` · AC-9: phần đọc (300 mỗi phút theo IP) đã phủ; phần ghi chờ mốc 2.
- AC-6, AC-7, AC-8: chưa phủ (mốc 2).
