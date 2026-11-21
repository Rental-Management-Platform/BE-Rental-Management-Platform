# Dữ liệu demo (`src/database/demo/`)

Bộ dữ liệu demo cho FE. Chạy bằng `npm run seed:demo` (build rồi chạy `dist/database/seed-demo.js`); thêm `-- --reset` để xóa dữ liệu demo cũ rồi tạo lại (làm mới mốc thời gian). Điểm vào là `src/database/seed-demo.ts`; thư mục này giữ nội dung và cách dựng hàng.

## File chính
- `demo-data.ts`: nội dung tĩnh (tài khoản, nhà trọ, tin, đơn). Mọi mốc thời gian là "số ngày trước hôm nay", nên các kịch bản (còn dùng thử, hết dùng thử, gói hết hạn, vượt hạn mức, bị khóa) đúng vào lúc chạy.
- `demo-build.ts`: đổi nội dung đó thành hàng bảng theo thời điểm chạy.
- `demo-images.ts`: vẽ ảnh minh họa bằng bộ sinh số giả ngẫu nhiên có hạt giống, nên chạy lại ra cùng ảnh; không tải ảnh từ ngoài.
- `demo-reviews.ts`: đánh giá chủ trọ (spec 0014) và các cuộc trò chuyện mẫu. `demo-room-reviews.ts`: đánh giá từng phòng (spec 0015), nhận ra tin bằng tiêu đề đúng từng chữ trong `DEMO_LISTINGS` (tiêu đề không được trùng nhau).
- `demo-daily-views.ts`: chia `view_count` của mỗi tin demo ra từng ngày giờ Việt Nam (spec 0016), làm tròn theo phần dư lớn nhất nên tổng các ngày đúng bằng `view_count`. Số liệu này là thứ `GET /me/statistics` và `GET /statistics/overview` (`src/statistics/`) đọc ra.

## Quy ước và ràng buộc
- Mọi tài khoản demo có email đuôi `@demo.example.com` (`DEMO_EMAIL_DOMAIN`). `--reset` chỉ xóa đúng các tài khoản đó, cùng các dòng của người thật trỏ vào dữ liệu demo (lưu tin, theo dõi, cuộc trò chuyện kèm tin nhắn, đánh giá chủ trọ, đánh giá phòng, cùng nhật ký ẩn của các đánh giá đó).
- Mật khẩu chung của mọi tài khoản demo lấy từ `DEMO_SEED_PASSWORD` trong `.env` (xem `.env.example`), không đặt trong code.
- Bảng mới có khóa ngoại `RESTRICT` tới `users`, `properties` hay `listings` thì phải thêm bước xóa vào `deleteDemoData` (trong `seed-demo.ts`, trước khi xóa dòng cha). Nếu quên, `--reset` hỏng vì khóa ngoại; đã gặp với `conversations_listing_id_fk` và `listing_reviews_listing_id_fk`. `listing_daily_views` cũng xóa theo tin (không theo dòng do seed tạo), nên các dòng do lượt xem thật của API ghi vào tin demo đi theo.
- Phần dựng mới thêm vào **cuối** `buildDemoRows` (sau vòng `DEMO_CHATS`): cả hàm dùng chung một bộ số ngẫu nhiên có hạt giống, nên chèn giữa chừng sẽ đổi lượt xem, ngày lưu và cuộc trò chuyện đã có.
- Mỗi cặp (tin, người nhắn) chỉ một cuộc trò chuyện (`conversations_listing_id_tenant_id_unique`). Cảnh nào cần bằng chứng chat thì mở qua `startChat` (có tham số `onListing` để chọn tin) hoặc dùng lại cuộc sẵn có qua `chatOf`; đừng tạo cuộc thứ hai cho cùng cặp.
- Tọa độ nhà trọ demo phải qua luật của spec [0012](../../../docs/specs/0012-property-coordinate-limits/index.md) (`isInsideCity`, `isNearWard`); `demo-data.spec.ts` kiểm điều này.

## Lệnh
- Test: `npm test -- src/database/demo`.

_Drafted by /sync from the introducing change, worth a quick human pass._
