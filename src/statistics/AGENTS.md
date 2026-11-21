# Thống kê của chủ trọ (`src/statistics/`)

Chủ trọ xem mọi con số của mình ở một route `GET /me/statistics`, theo spec [0017](../../docs/specs/0017-landlord-statistics/index.md). Không bảng hay cột mới: mọi số tính lúc đọc từ các bảng có sẵn. Phản hồi có chín khối: `period`, `listings`, `membership`, `views`, `interest`, `ratings`, `chat`, `spending`, `series`.

## File chính
- `statistics.repository.ts`: chỉ đọc, không có phương thức ghi. Mỗi nguồn là một câu SQL thô (`Prisma.sql`) trả các dòng theo ngày cộng một dòng tổng (`day` là `NULL`) qua `dailyWithTotal`, nên số theo ngày và số tổng của một nguồn đến từ cùng một lần đọc.
- `statistics.service.ts`: thứ tự kiểm lỗi, kiểm loại tài khoản, chạy mười truy vấn song song trong một `Promise.all`, rồi tách mỗi nguồn đúng một lần bằng `splitByPeriod`.
- `statistics.mapper.ts`: hình dạng phản hồi (`toSeries`, `toRatingBlock`, `toListingBuckets`, `toTopListing`, `splitByPeriod`). `dto/` là hình dạng vào ra.
- `stat-period.ts`: khoảng ngày (`resolveStatPeriod`, `toRangeBounds`, `localDateOf`, `addDays`). `stat-metric.ts`: `toMetric` (`value`, `previous`, `changePercent`) và `toRateMetric` cùng `pointsChange` (so bằng điểm phần trăm). Cả hai là hàm thuần để các hàng thống kê của admin dùng lại: hàng 27 (`GET /statistics/overview`) đã dùng ngay trong thư mục này, hàng 28 (doanh thu theo chủ trọ) sẽ dùng tiếp; nếu một hàng đặt code ngoài thư mục này thì chuyển cả hai sang `src/common/`.
- Module nhập `MembershipsModule` (hạn mức và kỳ gói) và `SubscriptionsDataModule` (`findLatestEndsAt`). Các bảng còn lại do Repository đọc thẳng.

## Quy ước và ràng buộc
- Repository này đọc thẳng bảng của module khác nên **viết lại luật công khai bằng SQL**: người theo dõi `active` và chưa xóa mềm; đánh giá chủ trọ `visible` của người viết `active`; đánh giá phòng `visible`, người viết `active`, tin chưa xóa mềm; chỉ đơn đã trả (theo `paid_at`); chat theo vai chủ trọ (`landlord_id`), chưa đọc là `last_seq` trừ `landlord_read_seq`, một cuộc "đã được trả lời" khi chủ trọ gửi ít nhất một tin trong cuộc đó. Đổi luật ở `src/reviews/`, `src/listing-reviews/`, `src/chat/` hay phần theo dõi của `src/landlords/` thì sửa luôn ở đây.
- Ngày là ngày lịch giờ Việt Nam (`APP_TIME_ZONE`), không phụ thuộc múi giờ phiên: nhãn ngày lấy bằng `to_char(... AT TIME ZONE ...)`, cận là `[start, end)` dạng chuỗi ISO có `Z` (không truyền `Date` vào SQL thô, xem `toSqlTimestamp`).
- Thứ tự lỗi: guard (token và `statistic:read`), pipe của query, `resolveStatPeriod` (400), rồi loại tài khoản (403), và luôn trước mọi lần đọc dữ liệu. Admin giữ `manage` mọi module nên qua guard; Service chặn bằng loại tài khoản `landlord`. Người gọi luôn là `sub` của token, không route nào nhận id chủ trọ.
- Không `@FreshAuth()` (dữ liệu của chính người gọi). Nhóm giới hạn tần suất `publicRead`, mỗi route đếm riêng. Phản hồi trả `Cache-Control: private, no-store`.
- Số theo kỳ có `previous` và `changePercent` (một chữ số thập phân, `null` khi kỳ trước bằng 0). Số trạng thái hiện tại (tin theo trạng thái, hạn mức, điểm đánh giá, các tổng) không có kỳ trước vì lịch sử trạng thái không được lưu. `chat.replyRate` so bằng điểm phần trăm (`changePoints`), `null` khi kỳ không mở cuộc nào. Điểm trung bình là số nguyên qua `averageStars` của `src/reviews/`, không dùng `avg` của DB.
- Lượt lưu và người theo dõi đếm từ các dòng đang có theo `created_at`, nên lịch sử có thể co lại khi người dùng bỏ lưu hay bỏ theo dõi. Lượt xem và biểu đồ tính cả tin ẩn và tin xóa mềm, còn `views.top` chỉ gồm tối đa 5 tin chưa xóa mềm. Lượt xem theo ngày đọc từ `listing_daily_views` (spec 0016), lịch sử chỉ bắt đầu từ ngày bảng có chỗ ghi.
- `series` điền đủ mọi ngày của kỳ với bốn cột (`views`, `newFavorites`, `newFollowers`, `newConversations`). Tổng mỗi cột bằng `value` của Metric tương ứng, vì Service tách mỗi nguồn đúng một lần. Cuộc "đã trả lời" tính theo ngày mở cuộc, không theo ngày trả lời.
- Tiền là số nguyên đồng: tổng dùng `SUM(...)::bigint` rồi `Number()`, không đi qua `int4`.
- Không giao dịch: các nhóm truy vấn có thể lệch một dòng khi đang có ghi, trong một nhóm thì luôn khớp. Không có chỉ mục `favorites(listing_id)`; đo ở 60 nghìn tin thì route mất khoảng 84 mili giây (30 ngày) và 94 mili giây (366 ngày), đã bỏ qua có chủ ý.

## Tổng quan cho admin (`GET /statistics/overview`)
Spec [0018](../../docs/specs/0018-admin-overview-statistics/index.md). Một route, phản hồi có bảy khối, tính lúc đọc từ bảng có sẵn, không bảng hay migration mới. File: `admin-statistics.controller.ts`, `admin-overview.service.ts`, `admin-overview.repository.ts`, `admin-overview.mapper.ts`, `dto/admin-overview.response.ts`.
- Khóa quyền `statistic:report` chỉ admin giữ (trong `permission-catalog.ts`). **Không bỏ `@FreshAuth()`**: token chủ trọ cũ mang `statistic:manage` bung ra cả `report`, chỉ việc đọc lại quyền mới chặn được.
- Khác màn của chủ trọ: mọi số tương tác đếm **mọi dòng**, không áp luật công khai (chat, tin nhắn, hai loại đánh giá, theo dõi, lưu, lượt xem toàn nền tảng). Chỉ `listings.public` dùng luật của `src/listings/`.
- `dailyCounts` (xuất từ `admin-overview.repository.ts`) là mẫu cho chuỗi theo ngày; `EngagementSource` liệt kê sáu nguồn tương tác, mỗi nguồn một bảng, không join, không lọc. Dòng cần thêm nguồn thì thêm vào `engagementQuery`, và cột chuỗi thêm vào `OverviewSeriesColumns`.
- Service chạy 16 truy vấn song song trong một `Promise.all`. Số trạng thái hiện tại (tài khoản, nhóm chủ trọ, tin theo trạng thái, `public`, việc cần xử lý) không có kỳ trước; `toHandle.hiddenListings` lấy từ `listingCounts.hiddenByAdmin` nên luôn bằng `listings.hiddenByAdmin`.
- Đo ở 60 nghìn tin: khoảng 3,4 giây (30 ngày) và 3,5 giây (366 ngày), gần hết ở `listings.public` (cùng chi phí với `total` của `GET /listings`), mọi truy vấn khác dưới 215 mili giây. Đã bỏ qua có chủ ý (MVP); muốn nhanh hơn thì bỏ hoặc cache `public`, không phải các phép đếm khác.
- Kiểm thật, điều khiển âm và số đo: `docs/specs/0018-admin-overview-statistics/verify.md`. API cho FE ở mục 6.43 của `docs/api/api-for-frontend.md`.

## Lệnh và tài liệu
- Test: `npm test -- src/statistics`.
- Đổi API thống kê thì sửa `docs/api/api-for-frontend.md` (mục 6.42, luồng màn hình ở mục 7, kiểu TypeScript, nhật ký thay đổi). Postman đã bỏ.
- Khóa quyền `statistic:read` nằm trong `src/common/auth/permission-catalog.ts`, kèm migration `20261116100000_landlord_statistic_permission`.
- Phép kiểm thật trên database thử, các điều khiển âm và số đo quy mô: `docs/specs/0017-landlord-statistics/verify.md`.

_Drafted by /sync from the introducing change, worth a quick human pass._
