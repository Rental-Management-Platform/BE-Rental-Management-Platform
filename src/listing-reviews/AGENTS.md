# Đánh giá từng phòng (`src/listing-reviews/`)

Người tìm trọ (`tenant`) đánh giá một phòng, tức một tin đăng, theo spec [0015](../../docs/specs/0015-room-reviews/index.md). Bảng `listing_reviews`, tám route: năm ở `/listings/:id/review` và `/listings/:id/reviews`, ba của admin ở `/moderation/listing-reviews`. Chi tiết công khai `GET /listings/:slugCode` có thêm `reviewCount` và `ratingAverage`. Cách làm giống `src/reviews/` (đánh giá chủ trọ), nhưng điểm của phòng và điểm của chủ trọ nằm ở hai bảng riêng và không bao giờ lẫn nhau.

## File chính
- `listing-reviews.repository.ts`: nơi duy nhất chạm bảng `listing_reviews`. Cùng khuôn với `ReviewsRepository`: ghi bằng SQL thô, `publicWhere` là mảnh điều kiện duy nhất cho danh sách, `total` và hai con số, `transition` là câu `UPDATE` ẩn hay gỡ ẩn.
- `listing-reviews.service.ts` (người viết và danh sách công khai), `listing-review-moderation.service.ts` (admin), `listing-reviews.controller.ts` (năm route, đường dẫn hai đoạn nên không đụng `GET /listings/:slugCode`), `listing-review-moderation.controller.ts`.
- `listing-reviews.mapper.ts`: chỉ có phần tử của admin (`toModerationListingReview`). Phần tử công khai, `MyReview`, DTO viết và sửa, `averageStars` và `orNull` dùng lại từ `src/reviews/`. `dto/` giữ kiểu phản hồi và query của admin. `listing-reviews.fixtures.ts` chỉ dùng cho test.
- `ListingReviewsDataModule` chỉ xuất `ListingReviewsRepository`, để `ListingsModule` đọc hai con số của chi tiết tin mà không vòng import.

## Quy ước và ràng buộc
- **`:id` ở năm route đầu là UUID của tin** (trường `id` của chi tiết công khai), không phải `slug-mã`; `slug-mã` hay `code` bị 400 `INVALID_ID`. **`:id` ở ba route kiểm duyệt là id của đánh giá.** Id của đánh giá chủ trọ ở route đánh giá phòng (và ngược lại) là 404.
- Tin phải đang hiện công khai: Service gọi `ListingsRepository.isPubliclyVisible` với `now` do controller lấy một lần mỗi request và `trial_listing_limit` từ `SettingsService`. Không thì cả năm route trả 404 `LISTING_NOT_FOUND`, kể cả `DELETE` của chính người viết. Dòng đánh giá còn nguyên và hiện lại cùng tin. Ba route admin không kiểm điều này.
- Điều kiện được đánh giá: có cuộc trò chuyện của người gọi về CHÍNH tin này mà chủ trọ đã gửi ít nhất một tin, đọc qua `ChatRepository.hasLandlordRepliedOnListing`. Chat về tin khác của cùng chủ trọ không tính. Chủ trọ của tin (qua `ListingsRepository.findLandlordIdOf`) đánh giá phòng mình là 409 `CANNOT_REVIEW_SELF`, kiểm trước điều kiện chat.
- Thứ tự kiểm lỗi trong Service: admin (403), tin hiện công khai (404), tự đánh giá (409), đủ điều kiện (403), ghi. Vì pipe chạy trước Service, id hay body sai vẫn là 400.
- Một cặp (người viết, tin) tối đa một dòng: `INSERT ... ON CONFLICT DO NOTHING RETURNING`, không cần giao dịch. Sửa chỉ khớp dòng `visible`; đang ẩn là 409 `LISTING_REVIEW_HIDDEN`, chưa có là 404 `LISTING_REVIEW_NOT_FOUND`.
- Ẩn và gỡ ẩn: một câu `UPDATE` có điều kiện trạng thái nguồn cộng một dòng `moderation_logs` (loại đích `listing_review`, hành động `hide_listing_review` hay `unhide_listing_review`) trong cùng giao dịch, chỉ khi đổi đúng một dòng; sai trạng thái là 409 `LISTING_REVIEW_STATE_INVALID`. Đọc lại phần tử SAU giao dịch. Không đụng `updated_at`. `hiddenReason` lấy từ `ModerationLogsRepository.findLatestListingReviewHideReasons`, không lẫn với lý do của đánh giá chủ trọ vì loại đích khác.
- `reviewCount` và `ratingAverage` của chi tiết tin tính lúc đọc trên đúng tập dòng của danh sách công khai (`summarize`, chạy song song với `isFavorite`, ngoài giao dịch). Chỉ chi tiết công khai có hai trường này; bốn danh sách thẻ tin và chi tiết riêng của chủ trọ thì không.
- Không thêm quyền hay nhóm giới hạn: dùng chung khóa `review:*` với đánh giá chủ trọ (nên không bật tắt riêng được), nhóm `reviewWrite` và `publicRead`. Admin bị chặn ở Service ở bốn route người viết; hai route ghi của admin có `@FreshAuth()`, ba route admin không có giới hạn tần suất.
- Người viết bị khóa hay xóa mềm thì đánh giá rời danh sách và hai con số ngay, mở khóa thì trở lại. Mọi khóa ngoại là `RESTRICT`.

## Lệnh và tài liệu
- Test: `npm test -- src/listing-reviews`.
- Đổi API đánh giá phòng thì sửa `docs/api/api-for-frontend.md` (mục 6.41). Bộ Postman đã bỏ từ 2026-11-16, không cập nhật `postman-collection.json` nữa.
- Phép kiểm thật trên database thử, các điều khiển âm và cách chạy lại: `docs/specs/0015-room-reviews/verify.md`.
- `deleteDemoData` trong `src/database/seed-demo.ts` xóa `listing_reviews` (của tài khoản demo và về tin demo, kể cả của người thật) cùng nhật ký ẩn trước khi xóa tin và tài khoản; quên bước này thì `--reset` hỏng với `listing_reviews_listing_id_fk`. Dữ liệu mẫu nằm ở `src/database/demo/demo-room-reviews.ts`.

_Drafted by /sync from the introducing change, worth a quick human pass._
