# Đánh giá chủ trọ (`src/reviews/`)

Người tìm trọ (`tenant`) đánh giá một chủ trọ, theo spec [0014](../../docs/specs/0014-landlord-reviews/index.md). Bảng `reviews`, tám route: năm ở `/landlords/:id/review` và `/landlords/:id/reviews` (bốn của người viết và danh sách công khai), ba của admin ở `/moderation/reviews`. Điểm trung bình và số đánh giá hiện ở hồ sơ chủ trọ (`GET /landlords/:id`).

## File chính
- `reviews.repository.ts`: nơi duy nhất chạm bảng `reviews`. Việc ghi dùng SQL thô (`INSERT ... ON CONFLICT DO NOTHING RETURNING`, `UPDATE ... WHERE status = 'visible' RETURNING`). `publicWhere` là mảnh điều kiện duy nhất cho danh sách công khai, `total` và hai con số của hồ sơ.
- `reviews.service.ts`: thứ tự kiểm lỗi và `assertNotAdmin`. `review-moderation.service.ts`: ẩn và gỡ ẩn của admin. Hai controller: `reviews.controller.ts` (người viết) và `review-moderation.controller.ts` (admin).
- `reviews.mapper.ts`: ánh xạ ra `PublicReview`, `MyReview`, `ModerationReview`. `averageStars` và `orNull` được `src/listing-reviews/` dùng lại. `review-status.ts` giữ hai trạng thái và `REVIEW_LIMITS`. `dto/` là hình dạng vào ra. `reviews.fixtures.ts` chỉ dùng cho test.
- `ReviewsDataModule` chỉ xuất `ReviewsRepository`, để `LandlordsModule` đọc hai con số mà không vòng import.

## Quy ước và ràng buộc
- Điều kiện được đánh giá: chủ trọ đã gửi ít nhất một tin trong cuộc trò chuyện với người gọi (tin nào của chủ trọ cũng được), đọc qua `ChatRepository.hasLandlordReplied`. Module này không tự đọc bảng chat. Chỉ kiểm lúc viết, không kiểm lại khi sửa hay xóa.
- Mỗi cặp (người viết, chủ trọ) tối đa một dòng: khóa duy nhất cộng `ON CONFLICT DO NOTHING`, không cần giao dịch vì chat không bao giờ mất đi. Sửa chỉ khớp dòng `visible`. Không dòng nào đổi thì tra thêm: không có là 404 `REVIEW_NOT_FOUND`, đang ẩn là 409 `REVIEW_HIDDEN` (thử sửa lại một lần nếu vừa được gỡ ẩn).
- Ẩn và gỡ ẩn là một câu `UPDATE` có điều kiện trạng thái nguồn cộng một dòng `moderation_logs` trong cùng giao dịch, chỉ khi đổi đúng một dòng. Phần tử trả về đọc lại SAU giao dịch. Không đụng `updated_at` (đó là lần cuối người viết sửa nội dung). Lý do ẩn nằm ở `moderation_logs` (loại đích `review`), không có cột lý do. Gỡ ẩn đưa thẳng về `visible`.
- Hai con số của hồ sơ luôn bằng tập mà danh sách công khai trả (đánh giá `visible` của người viết `active`, chưa xóa mềm), nên khóa hay xóa mềm người viết đổi số ngay. Trung bình tính bằng số nguyên (`averageStars`, làm tròn nửa lên), không dùng `avg` của DB.
- Admin bị chặn ở Service (`assertNotAdmin`, 403 `PERMISSION_DENIED`) vì `ADMIN_PERMISSIONS` giữ `review:*`. Việc này chạy sau pipe, nên id hay body sai vẫn là 400. `@FreshAuth()` có ở ba route ghi của người viết và hai route ghi của admin.
- Giới hạn tần suất: nhóm `reviewWrite` (20 mỗi giờ theo người dùng) cho ba route ghi, nhóm `publicRead` (300 mỗi phút theo IP) cho hai route đọc, mỗi route đếm riêng. Ba route kiểm duyệt không có giới hạn. Danh sách công khai đọc đăng nhập tùy chọn (`@OptionalAuth()`, không bao giờ 401). Năm route của người viết và công khai trả `Cache-Control: private, no-store`.
- `stars` là số nguyên từ 1 đến 5, `comment` bỏ khoảng trắng hai đầu, 1 đến 1000 ký tự Unicode, không chứa `\u0000`; các CHECK ở DB giữ cùng khoảng. Nhận xét lưu thô, backend không lọc HTML, FE phải escape.
- Mọi khóa ngoại là `RESTRICT` (tài khoản chỉ xóa mềm). Không route nào nhận id của đánh giá ở phía người viết: người viết luôn là người trong token.
- Đổi luật giá trị trong `CreateReviewDto` hay `UpdateReviewDto` cũng đổi đánh giá phòng, vì `src/listing-reviews/` dùng lại chúng.

## Lệnh và tài liệu
- Test: `npm test -- src/reviews`.
- Đổi API đánh giá chủ trọ thì sửa `docs/api/api-for-frontend.md` (mục 6.40). Bộ Postman đã bỏ từ 2026-11-16, không cập nhật `postman-collection.json` nữa.
- Phép kiểm thật trên database thử và cách chạy lại: `docs/specs/0014-landlord-reviews/verify.md`.
- `deleteDemoData` trong `src/database/seed-demo.ts` xóa `reviews` cùng nhật ký ẩn của chúng; đổi bảng này thì giữ bước đó.

_Drafted by /sync from the introducing change, worth a quick human pass._
