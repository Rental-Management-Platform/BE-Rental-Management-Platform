# Verify: Lượt xem tin đăng theo ngày · spec 0016 · updated 2026-11-16
_Steps derived from spec 0016 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Mốc 1 (AC-1 đến AC-7) và mốc 2 (AC-8, dữ liệu demo) đều đã build và kiểm ngày 2026-11-16.

Cách chạy lại: dùng database thử `rental_management_verify` (không bao giờ database dev), API chạy cổng 3055 với `TRUST_PROXY_HOPS=1` để mỗi request mang một IP riêng qua `X-Forwarded-For`. Các script kiểm nằm ở scratchpad của phiên build (sẽ bị dọn), nên danh sách dưới đây mô tả từng phép kiểm đủ để viết lại.

## Commands
- [x] `npx prisma migrate deploy` trên database trống rồi `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` → cả 15 migration chạy, "No difference detected"   → AC-7
- [x] `npx tsc --noEmit`, `npx eslint` trên 4 file đã sửa, `npm test` → sạch; 2338 test đạt (101 suite), trong đó 8 test mới   → AC-1 đến AC-4
- [x] `git status --short docs/api` → rỗng (hai tài liệu API không đổi); `git diff --name-only` không có controller, quyền, mã lỗi, nhóm giới hạn hay biến môi trường   → AC-7

## Database (AC-6, AC-7)
- [x] Chụp `view_count` của mọi tin và `md5` nội dung của cả 22 bảng cũ trước, áp migration, chụp lại → bằng nhau từng byte; bảng mới rỗng; chỉ thêm đúng một bảng   → AC-7
- [x] Đọc danh mục hệ thống → đúng ba cột (`listing_id` uuid, `day` date, `views` integer, đều NOT NULL), khóa chính `(listing_id, day)`, CHECK `views > 0`, khóa ngoại RESTRICT tới `listings`, không chỉ mục nào khác   → AC-6
- [x] `INSERT` trùng cặp → 23505; `views` 0 và âm → 23514; `listing_id` lạ → 23503; `views` NULL → 23502; `views` 2147483648 → 22003; `DELETE` tin còn dòng ngày → 23001   → AC-6

## Repository thật trên DB thử (AC-1 đến AC-5)
- [x] Ba lượt trên tin mới (hai cùng ngày giờ Việt Nam, một lúc 00:30 ngày sau) → trả 1, 2, 3; hai dòng ngày (2 và 1); `view_count` 3 = tổng ngày   → AC-1
- [x] Tin ẩn bởi chủ, ẩn bởi admin, xóa mềm, id không tồn tại → trả `null`, `view_count` vẫn 0, số dòng `listing_daily_views` không đổi   → AC-2
- [x] Với phiên DB đặt `UTC`, `Asia/Ho_Chi_Minh`, `America/Los_Angeles` (kiểm bằng `SHOW timezone`) và bảy mốc `now` (16:59:59.999Z và 17:00:00.000Z, 23:59:59.999Z, 00:00:00.000Z, cuối năm, 28/02 năm nhuận) → cùng một ngày kỳ vọng, khớp `Intl.DateTimeFormat` của `Asia/Ho_Chi_Minh`   → AC-3
- [x] Đặt sẵn `views = 2147483647` cho ngày của `now`, gọi → câu lỗi (SQLSTATE 22003, không bị nuốt), `view_count` đứng yên ở 0, dòng ngày vẫn 2147483647   → AC-4
- [x] Tin có từ trước (`view_count` > 0, không có dòng ngày), 3 lượt → `view_count` +3, tổng ngày +3, hiệu `view_count` trừ tổng ngày không đổi; mọi tin cũ khác không đổi   → AC-4
- [x] 50 lượt đồng thời trên ngày chưa có dòng, rồi 50 lượt nữa trên ngày đã có dòng, rồi 25 + 25 trên hai ngày cùng lúc → không lỗi nào, giá trị trả về 1..50 và 51..100 không trùng, `view_count` 50, 100, 150, đúng một dòng cho mỗi cặp (tin, ngày)   → AC-5

## HTTP thật trên API (AC-1, AC-2, AC-4, AC-5)
- [x] `GET /listings/:slugCode` lần đầu → 200, `viewCount` 1 trong response, DB `view_count` 1 và một dòng ngày `views` 1 đúng ngày giờ Việt Nam của lúc gọi; IP thứ hai → `viewCount` 2   → AC-1
- [x] Cùng IP mở lại trong 30 phút, chủ tin đã đăng nhập mở tin mình (thấy số điện thoại) → 200, `viewCount` và dòng ngày không đổi   → AC-2
- [x] Tin ẩn bởi chủ, ẩn bởi admin, xóa mềm, mã không tồn tại, slug sai định dạng → 404 `LISTING_NOT_FOUND`, không dòng ngày nào được tạo   → AC-2
- [x] Đặt sẵn `views = 2147483647` cho hôm nay rồi mở chi tiết → 500 `INTERNAL_ERROR`, `view_count` đứng yên   → AC-4
- [x] 50 request đồng thời từ 50 IP khác nhau, hai đợt → tất cả 200, `viewCount` trả về 1..50, `view_count` 50 rồi 100, tổng ngày bằng `view_count`, một dòng   → AC-5
- [x] Chạy lại bộ Postman hiện có, không sửa, bằng Newman 6.2.1 trên database dựng từ trống (bỏ bốn folder 02, 06, 23, 24: cần mail hoặc ghi rõ là chạy riêng) → 24 folder, 823 request, 1790 assertion, 0 lỗi, đúng bằng lần chạy gần nhất trước thay đổi này   → AC-7
  - Lưu ý khi chạy lại: đặt `ACCESS_TTL_SECONDS=900` cho server thử (`.env` khai hai lần, giá trị sau là 60 giây nên token hết hạn giữa chừng và ra hàng trăm lỗi 401). Đừng chạy folder 02 và 06: chúng gọi `forgot-password` và server gửi thư thật qua SMTP trong `.env`. Từ 2026-11-16 bộ Postman không còn được cập nhật, nên bước này chỉ là kiểm hồi quy tùy chọn.

## Điều khiển âm (kiểm có bắt được lỗi thật không)
Mỗi điều khiển sửa thẳng `dist/listings/listings.repository.js`, chạy lại cùng script, mong nó thất bại, rồi khôi phục file (so sánh nội dung).
- [x] `DO UPDATE` đổi thành `DO NOTHING` → 12 phép kiểm thất bại (AC-1, AC-4, AC-5); HTTP: thất bại ở lượt thứ hai trở đi   → AC-5
- [x] Bỏ `AT TIME ZONE` (ngày theo múi giờ phiên) → 11 thất bại, đúng ở phiên `UTC` và `America/Los_Angeles`   → AC-3
- [x] Ngày lấy từ đồng hồ DB thay vì `now` của request → 23 thất bại   → AC-3
- [x] Bỏ điều kiện `status = 'visible' AND deleted_at IS NULL` khỏi câu `UPDATE` → 5 thất bại (ba loại tin không tính vẫn bị cộng và tạo dòng)   → AC-2
- [x] Tách thành hai câu rời (`UPDATE` rồi `INSERT`) → 1 thất bại: tràn số làm `view_count` tăng mà bộ đếm ngày không   → AC-4

## Value sourcing (một bước cho mỗi hàng của bảng nguồn giá trị)
- [x] `listing_id` lấy từ `row.id` của tin đã đọc → dòng ngày luôn thuộc đúng tin vừa mở (HTTP: tin tạo mới có dòng, tin khác không đổi)   → AC-1
- [x] `day` lấy từ `now` của request qua `AT TIME ZONE` với `APP_TIME_ZONE`, đổi múi giờ phiên và mốc 17:00Z → ngày không đổi   → AC-3
- [x] `views` = 1 khi tạo, `+ 1` khi đã có → 50 lượt đồng thời cộng đúng 50   → AC-5
- [x] `viewCount` trả về = `RETURNING view_count` → bằng `view_count` trong DB sau lượt đó, không trùng giữa các lượt đồng thời   → AC-1, AC-5
- [x] Có tính lượt hay không = `isOwner`, `ViewDeduplicator`, điều kiện `visible` → chủ tin, người xem trùng, tin ẩn và xóa mềm không đổi gì   → AC-2
- [x] Demo: các ngày có dòng từ ngày tạo tin đến hôm nay giờ Việt Nam, `views` mỗi ngày chia từ `view_count` bằng bộ sinh số có hạt giống → tổng bằng `view_count` (xem mốc 2: 53 tin, không tin nào lệch tổng, không dòng nào ngoài khoảng ngày)   → AC-8

## Mốc 2: dữ liệu demo
Chạy trên database thử `rental_management_verify`, `UPLOAD_DIR` đặt vào một thư mục thử để không ghi ảnh vào thư mục upload của dev. Các script kiểm nằm ở scratchpad của phiên build (sẽ bị dọn): `check-demo.js` (21 phép kiểm SQL, thêm 3 phép khi truyền danh sách id tin cũ), `plant.js` (cắm dữ liệu thật), `dump-demo-rows.js` (dump mọi hàng dựng ra, bỏ id ngẫu nhiên, mã tin, khóa ảnh, `imageFiles` và `listingDailyViews`, rồi `cmp`).
- [x] `npm run seed:demo` trên database trống (15 migration, rồi `npm run seed`) → thành công, 53 tin và 3130 dòng ngày (tối đa có thể là 3256 ô ngày); 21 phép kiểm SQL đạt: tổng `views` mỗi tin bằng `view_count` (0 tin lệch), mọi tin có `view_count` > 0 đều có dòng, `views` nhỏ nhất lớn hơn 0, không dòng nào trước ngày tạo tin hay sau hôm nay giờ Việt Nam, không dòng mồ côi, số dòng bằng số seed in ra, 12 bảng khác đúng số hàng   → AC-8
  - Tin demo có `view_count` 0: dữ liệu demo hiện không có tin nào như vậy, nên "không dòng nào" được phủ bằng test đơn vị của `buildDailyViewRows`, không bằng database. Một tin có ít lượt hơn số ngày thì ngày ra 0 bị bỏ dòng, tổng vẫn đúng.
- [x] Các hàng bảng khác của demo giống hệt lần chạy trước khi sửa → dump mọi bảng của `buildDemoRows` ở `now` cố định trước khi sửa và sau khi sửa, so từng byte → `cmp` báo giống hệt (169729 byte, 15 bảng; hai lần dump cùng mã cũ cũng giống nhau, nên phép so ổn định)   → AC-8
- [x] `npm run seed:demo -- --reset` ba lần liên tiếp (trước lần một và lần hai cắm dữ liệu thật: ba lượt xem đi qua `ListingsRepository.incrementViewCount` trên một tin đang hiện, và một dòng ngày cũ `2020-01-01` chèn thẳng vào tin khác; trước lần ba không cắm gì) → cả ba thoát 0, mỗi lần id tin cũ không còn, không dòng ngày nào trỏ vào tin cũ (kể cả dòng do lượt xem thật và dòng ngày cũ), dòng `2020-01-01` không còn, lại 3130 dòng ngày và 209 ảnh trên đĩa (ảnh cũ bị xóa, ảnh mới được ghi), 24 phép kiểm đạt mỗi lần   → AC-8
- [x] `npm test -- src/database/demo` và `npm test` → 124 test đạt ở thư mục demo (26 test mới: `demo-daily-views.spec.ts` và hai test ở `demo-build.spec.ts`); toàn bộ 102 suite, 2364 test đạt; `tsc --noEmit` và `eslint` trên 5 file đã sửa sạch   → AC-8

## Điều khiển âm của mốc 2
Mỗi điều khiển sửa file đã biên dịch trong `dist`, chạy `node dist/database/seed-demo.js --reset` thẳng (không dùng `npm run seed:demo`, vì nó build lại và xóa bản sửa), mong phép kiểm thất bại, rồi khôi phục file và so nội dung.
- [x] Bỏ bước `listingDailyView.deleteMany` khỏi `seed-demo.js` → `--reset` thoát 1 với `Foreign key constraint violated on the constraint: listing_daily_views_listing_id_fk` ở `tx.listing.deleteMany()`, giao dịch hoàn lại (số dòng ngày giữ 3131), script kiểm báo 5 lỗi (53 tin cũ còn, 3131 dòng ngày cũ còn, dòng `2020-01-01` còn)   → AC-8
- [x] Bỏ vòng "phần dư lớn nhất" trong `demo-daily-views.js` → seed ra 2942 dòng thay vì 3130, cả 53 tin lệch tổng so với `view_count`   → AC-8
- [x] Bỏ `listingDailyView.createMany` khỏi `seed-demo.js` → 0 dòng ngày, 53 tin có `view_count` > 0 không có dòng, 4 phép kiểm lỗi   → AC-8
- [x] Thêm một lượt rút từ bộ số dùng chung ở đầu `buildDemoRows` (`demo-build.js`) → dump khác bản gốc (phép so nhạy với lệch số ngẫu nhiên), và bản khôi phục lại giống hệt bản gốc   → AC-8
- [x] Ba đột biến trên mã nguồn `demo-daily-views.ts`, mỗi lần chạy `npm test -- src/database/demo`: bỏ vòng phần dư (9 test đỏ), dồn mọi lượt còn thiếu vào ngày đầu (2 test đỏ), tính ngày theo UTC thay vì giờ Việt Nam (6 test đỏ); khôi phục bằng so nội dung, chạy lại 124 xanh   → AC-8
- Ghi chú: ngày tạo tin và hôm nay đều tính bằng cùng hàm `vietnamDayOf`, đối chiếu với `Intl.DateTimeFormat` của `Asia/Ho_Chi_Minh` trên 400 thời điểm và các mốc 16:59:59.999Z, 17:00:00.000Z, cuối năm, 29/02. Phần dựng nằm SAU CÙNG trong `buildDemoRows` và dùng bộ số riêng (`DAILY_VIEWS_SEED`), nên dù lấy chung bộ số thì cũng không đổi hàng nào đã có; điều khiển thứ tư chứng minh phép so bắt được nếu bước này chạy sớm hơn.

## Acceptance-criteria coverage
- AC-1 … HTTP lần đầu, Repository ba lượt, Value sourcing `listing_id`, `viewCount` · AC-2 … Repository bốn loại tin, HTTP chủ tin và lượt trùng và năm kiểu 404, điều khiển bỏ điều kiện `visible` · AC-3 … ba múi giờ phiên nhân bảy mốc, hai điều khiển · AC-4 … tràn số ở Repository và HTTP, tin cũ hiệu không đổi, điều khiển hai câu rời · AC-5 … 50 lượt Repository ba đợt, 50 request HTTP hai đợt, điều khiển `DO NOTHING` · AC-6 … bốn bước Database · AC-7 … chụp trước sau, `migrate diff`, `git status docs/api`, Newman · AC-8 … mốc 2: seed trên database trống với 21 phép kiểm SQL, dump so từng byte cho các bảng khác, ba lần `--reset` (hai lần có cắm lượt xem thật và dòng ngày cũ), năm điều khiển âm trên `dist` và ba đột biến mã nguồn
- Chưa kiểm một phần: nhịp 30 phút của `ViewDeduplicator` bằng đồng hồ thật (đã có test đơn vị với đồng hồ giả; luật này không đổi từ spec 0002).
- Chưa kiểm trên database dev `rental_management` (không động tới): bạn tự chạy `npm run migration:deploy` rồi `npm run seed:demo -- --reset`. Chưa đo kích cỡ bảng ở mức xấu nhất 60 nghìn tin x 365 ngày (mục tùy chọn của Follow-up, bỏ qua có chủ đích như các ngân sách quy mô khác).
