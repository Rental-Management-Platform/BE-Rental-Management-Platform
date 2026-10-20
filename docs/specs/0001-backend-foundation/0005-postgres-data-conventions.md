# 0005. Quy ước dữ liệu PostgreSQL (spec con của 0001 nền móng backend)

**Date**: 2026-10-05

## Summary

Spec con này chuyển phần "đối tượng dữ liệu" của spec chức năng (viết theo kiểu bảng và khóa ngoại) thành quy ước cho PostgreSQL 18 qua Prisma 7. Nó chốt bản đồ bảng, cách đặt tên, kiểu cột, khóa ngoại và chỉ mục, giao dịch, tìm từ khóa tiếng Việt, tìm theo khu vực (đã hoãn khỏi MVP), migration và seed. Vì Postgres có khóa ngoại và phép nối thật, dữ liệu không còn bị sao chép giữa các bảng. Cột chi tiết của từng tính năng do spec tính năng đó chốt sau.

## Decision

Mỗi tính năng có một hoặc vài bảng quan hệ có khóa ngoại và ràng buộc thật. Danh sách có giới hạn (phí, ảnh, tiện ích) là bảng con, không phải mảng nhúng. Không sao chép dữ liệu giữa các bảng: điều kiện hiển thị tin dùng phép nối. Mọi thao tác ghi nhiều bảng chạy trong giao dịch qua `TransactionRunner`. Schema chỉ thay đổi bằng migration của Prisma (`prisma migrate`); ứng dụng không bao giờ tự đổi schema.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`): rule `db-use-transactions`, `db-avoid-n-plus-one`, `arch-use-repository-pattern` · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`): rule `schema-primary-keys`, `schema-data-types`, `schema-foreign-key-indexes`, `query-partial-indexes`, `conn-pooling`.

## Standard definition

**Canonical pattern**:

Bản đồ bảng (mức bảng; đã được bạn xác nhận ở bước thiết kế, gồm bảng `landmarks` thay cho `schools` và `campuses`):

| Nhóm | Bảng | Khóa chính và quan hệ | Ràng buộc và chỉ mục chính |
|---|---|---|---|
| Xác thực và quyền | `users` | `id`; `account_type` trỏ `account_types` | `email` duy nhất; `status` là `active` hoặc `locked`; `account_type` bắt buộc và không đổi sau khi tạo; `phone` đã chuẩn hóa (xem 0002), chỉ mục duy nhất một phần `users_landlord_phone_unique` trên `phone` khi `account_type = 'landlord'` và tính cả dòng xóa mềm; `CHECK` `users_landlord_phone_check` (`account_type <> 'landlord' OR phone IS NOT NULL`); hạn dùng thử của chủ trọ do spec dùng thử chốt (cột và cách tính); xóa mềm |
| | `landlord_profiles` | `user_id` (1:1 với `users`) | **hoãn khỏi MVP, chưa tạo bảng** (spec 0005 theo dõi chủ trọ, 2026-10-20: hồ sơ công khai dùng `users.name`). Thiết kế giữ lại cho khi cần: tên hiển thị riêng, Zalo (tùy chọn); xác thực chủ trọ cũng đã hoãn |
| | `account_types` | `key` (khóa tự nhiên: `admin`, `landlord`, `tenant`) | `CHECK` chỉ nhận ba giá trị đó; `permissions` là cột mảng `text[]`; chỉ có ba dòng, do migration chèn kèm quyền mặc định |
| | `auth_sessions`, `password_resets` | `id`; `user_id` trỏ `users` (N:1) | `token_hash` duy nhất; chỉ lưu bản băm; hết hạn kiểm bằng `expires_at` (xem 0002) |
| Danh mục | `wards`, `amenities`, `settings` | `code`, `key`, `key` | **địa chỉ hai cấp sau sáp nhập (từ 01/07/2025): không có cấp quận huyện**, nên `wards` là phường, xã, đặc khu và tỉnh hoặc thành phố nằm ngay trong nó (`province_code`, `province_name`); `wards.code` là mã 5 chữ số theo danh mục hành chính mới, `name` là tên đầy đủ kèm loại đơn vị (ví dụ "Phường Bến Thành"); `amenities.key` có `CHECK` dạng `^[a-z][a-z0-9_]{1,29}$`; `settings` giữ tham số nghiệp vụ theo cặp khóa và giá trị (`trial_days` mặc định 30, `trial_listing_limit` mặc định 2; xem `index.md`, mục Phạm vi MVP) |
| | `landmarks` | `id` | **hoãn khỏi MVP, chưa tạo bảng.** Thiết kế giữ lại cho khi làm tìm quanh địa điểm mốc: `name`, `group_name`, `kind` là `school`, `workplace` hoặc `other`, `address_text`, `latitude`, `longitude`, `is_active`; admin quản lý |
| Nhà trọ và tin | `properties` | `id`; `landlord_id` trỏ `users`, `ward_code` trỏ `wards` | `address_text` chỉ là số nhà và tên đường (phường, xã, tỉnh lấy từ `ward_code`); `latitude`, `longitude` tùy chọn, `CHECK` khoảng giá trị và cả hai cùng có hoặc cùng rỗng, **không đánh chỉ mục tọa độ** (chưa ai tìm theo tọa độ); xóa mềm |
| | `property_fees` | `id`; `property_id` trỏ `properties` (N:1, tối đa 6) | loại phí, đơn giá, đơn vị tính; `UNIQUE (property_id, kind)` nên tối đa một khoản cho mỗi trong 6 loại |
| | `property_amenities` | (`property_id`, `amenity_key`), N:M | khóa chính chặn trùng |
| | `listings` | `id`; `property_id` trỏ `properties` (N:1) | `code` mã ngắn 8 ký tự duy nhất (đường dẫn công khai `slug-mã`); `status` là `visible`, `hidden_by_owner` hoặc `hidden_by_admin` (`CHECK`; không có trạng thái nháp hay chờ duyệt, tin sinh ra là `visible`); `view_count` là số nguyên đếm lượt xem, tăng bằng một câu `UPDATE` nguyên tử; `search_key` có chỉ mục trigram; hai chỉ mục một phần cho điều kiện hiển thị 6.1 (`created_at DESC, id DESC` và `price, id`, cùng `WHERE status = 'visible' AND deleted_at IS NULL`); xóa mềm |
| | `listing_images` | `id`; `listing_id` trỏ `listings` (N:1, tối đa 5) | (`listing_id`, `position`) duy nhất; khóa lưu trữ ảnh |
| | `favorites` | (`user_id`, `listing_id`), N:M; `user_id` trỏ `users`, `listing_id` trỏ `listings` | khóa chính chặn lưu trùng; thêm `created_at` (mốc "mới lưu trước"), hai FK `RESTRICT`, chỉ mục (`user_id`, `created_at` giảm dần, `listing_id` giảm dần); dòng lưu giữ nguyên khi tin bị ẩn hay chủ trọ bị khóa, việc hiện ra suy ra lúc đọc từ luật hiển thị công khai (spec 0006) |
| | `follows` | (`user_id`, `landlord_id`), N:M; cả hai trỏ `users` | khóa chính chặn theo dõi trùng; `CHECK` không tự theo dõi chính mình; chỉ mục theo `landlord_id` để đếm người theo dõi; thêm `created_at`, hai FK `RESTRICT`; số người theo dõi tính lúc đọc từ bảng này (chỉ người theo dõi `active` và chưa xóa), không lưu bộ đếm (chi tiết ở spec 0005 `docs/specs/0005-landlord-follow-reach/`) |
| | `moderation_logs` | `id`; `actor_id` trỏ `users` | `target_type`, `target_id` (đối tượng bị tác động), `action` (`lock`, `unlock`, và `hide_listing`, `unhide_listing` khi làm ẩn tin), `reason` bắt buộc, `created_at`; chỉ thêm, không sửa; chỉ mục (`target_type`, `target_id`, `created_at`) |
| Gói | `plans`, `orders`, `subscriptions` | `id`; `orders` trỏ `users` và `plans`; `subscriptions` trỏ `users`, `plans` và `orders` | `plans`: tên, giá (`integer` đồng), số tin tối đa, số ngày hiệu lực (30), bật hay tắt; `orders.code` duy nhất, `status` là `pending`, `paid` hoặc `cancelled`, giá và số tin chốt vào đơn lúc tạo; `subscriptions`: `starts_at`, `ends_at`, gia hạn nối tiếp từ `ends_at` của gói đang chạy. Thanh toán thử nên không có bảng `payments` hay mã giao dịch của cổng. Cột chi tiết do spec mua gói chốt |

Các bảng đã hoãn khỏi MVP và chưa tạo: `landmarks`, `contact_logs`, `reports`, `landlord_verifications`, `listing_daily_stats`, `listing_price_history`, `listing_boosts`, `onsite_inspections`, `ad_campaigns`, `ad_daily_stats`, `expenses`, `payments`. Lượt xem của MVP là cột `listings.view_count`; tổng lượt xem của một chủ trọ là `SUM(view_count)` trên tin của họ.

Quy ước chung:
- **Tên:** bảng `snake_case` số nhiều, cột `snake_case` trong DB và `camelCase` trong TypeScript, nối bằng `@@map("tên_bảng")` và `@map("tên_cột")` ghi rõ cho từng model và từng trường trong `schema.prisma` (Prisma không có chiến lược đặt tên tự động; không thêm công cụ). Ràng buộc và chỉ mục luôn đặt tên rõ qua tham số `map:`: `<bảng>_<cột>_unique`, `<bảng>_<cột>_idx`, `<bảng>_<cột>_fk`, khóa chính `<bảng>_pkey`. Giữ tên rõ để đọc log lỗi DB; khi spec 0004 mở lại phần dịch lỗi PostgreSQL thì sẽ tra theo các tên này.
- **Id:** `uuid`, mặc định `uuidv7()` khai báo bằng `@default(dbgenerated("uuidv7()")) @db.Uuid` (hàm có sẵn của PostgreSQL 18, sắp theo thời gian nên chỉ mục không bị phân mảnh như UUID v4). Dùng UUID vì id lộ ra ở URL và API. Bảng danh mục dùng khóa tự nhiên kiểu `text` (`wards.code`, `amenities.key`, `settings.key`). Đường dẫn công khai của tin dạng `slug-<mã ngắn>`; mã ngắn là cột `listings.code`, 8 ký tự ngẫu nhiên (spec 0002).
- **Kiểu cột:** `text` (không dùng `varchar(n)`), `timestamptz` cho mọi thời điểm (lưu UTC), `boolean`, `integer` cho tiền, `double precision` cho `latitude` và `longitude` kèm `CHECK` (lat trong [-90, 90], lng trong [-180, 180]), `date` cho khóa theo ngày (MVP chưa có bảng nào cần khóa này; dùng khi làm thống kê hoặc giới hạn theo ngày). Mọi trường khai báo kiểu cột tường minh bằng thuộc tính `@db.*` khi mặc định của Prisma không đúng ý (`@db.Uuid`, `@db.Timestamptz(6)`, `@db.Date`); `String` của Prisma là `text` trong PostgreSQL.
- **Giá trị liệt kê:** cột `text` kèm `CHECK (... IN (...))` và union kiểu trong TypeScript. Không dùng kiểu `enum` của Postgres (sửa danh sách giá trị phải qua migration rắc rối).
- **Tiền:** số nguyên đồng Việt Nam kiểu `integer` (tối đa khoảng 2,1 tỷ đồng mỗi khoản, đủ cho giá thuê, phí và một lần thanh toán). Tổng hợp cho báo cáo tính bằng `SUM(...)::bigint` trong SQL, Postgres trả chuỗi, đổi sang số bằng hàm dùng chung `toSafeInteger`. Không dùng số thực cho tiền.
- **Giờ:** `timestamptz`; phiên làm việc của DB đặt múi giờ UTC. Khóa theo ngày (thống kê, đếm giới hạn mỗi ngày) là cột `date` (`@db.Date`; Prisma trả đối tượng `Date` ở nửa đêm UTC chứ không phải chuỗi, kiểm chứng ở lát cắt đầu), tính theo múi giờ `Asia/Ho_Chi_Minh` bằng hàm dùng chung `toVnDay(date)`.
- **Dấu thời gian:** mọi bảng có `created_at`, `updated_at` (`@default(now())` và `@updatedAt`).
- **Xóa mềm** (BR-15) chỉ cho `users`, `properties`, `listings`: cột `deleted_at`. Prisma không có xóa mềm sẵn: mọi phương thức đọc của Repository cho ba bảng này gắn điều kiện `deletedAt: null` qua một hàm dùng chung `notDeleted`, và xóa là `update` đặt `deletedAt`. Chỉ phương thức có tên tường minh `...IncludingDeleted` mới bỏ điều kiện. Không dùng client extension (ít phép thuật ngầm hơn, đổi lại phải nhớ khi viết phương thức đọc mới).
- **Khóa ngoại:** mọi khóa ngoại khai báo `ON DELETE` rõ ràng. Mặc định `RESTRICT`; chỉ dùng `CASCADE` cho dữ liệu con thuộc hẳn về cha (`auth_sessions`, `password_resets`, `landlord_profiles`, `property_fees`, `property_amenities`, `listing_images`). Postgres không tự đánh chỉ mục cho cột khóa ngoại, nên mọi cột khóa ngoại phải có chỉ mục, trừ khi nó đã là cột đầu của khóa chính hoặc chỉ mục duy nhất.
- **Danh sách có giới hạn là bảng con**, không phải mảng hay JSON. Giới hạn số dòng (tối đa 6 phí, 5 ảnh) do ràng buộc ở DB chặn cuối (`UNIQUE` và `CHECK`) và Service kiểm trước để trả lỗi rõ. Cột mảng `text[]` chỉ dành cho `account_types.permissions`. Cột mảng là `String[]` trong schema (thành `text[]`) và không dựa vào mặc định của DB: giá trị đặt ở Service. Prisma sinh cột mảng cho phép rỗng, nên migration thêm `NOT NULL` bằng tay (Prisma không coi đó là lệch). Cấm kiểu `Json` (jsonb) trừ khi spec tính năng nêu lý do và có kiểu rõ ràng.
- **Không sao chép dữ liệu giữa các bảng.** Điều kiện hiển thị 6.1 (tin `visible`, chủ trọ đang hoạt động và chưa bị xóa, chủ trọ còn dùng thử hoặc có gói đang hiệu lực) là phép nối `listings`, `properties`, `users`, được viết đúng một lần trong một phương thức Repository (`visibleListingsQuery`). Ngoại lệ duy nhất là `listings.search_key` (xem dưới). Dữ liệu dẫn xuất khác chỉ được thêm khi đo thấy chậm, và phải ghi đường cập nhật duy nhất của nó trong spec tính năng.

Tìm từ khóa tiếng Việt:
- `search_key` là chuỗi gộp tiêu đề tin, tên nhà trọ, địa chỉ (số nhà và đường) và tên phường hoặc xã, chuẩn hóa bằng hàm `toSearchKey(...parts)` (đã có ở `src/common/text/to-search-key.ts`): Unicode NFD, bỏ dấu kết hợp, đổi `đ` và `Đ` thành `d`, chữ thường, gộp khoảng trắng. Chữ `đ` không tách dấu được nên không dựa vào phần mở rộng `unaccent`. Cách đặt dấu thanh (`Hoà` hay `Hòa`) ra cùng một khóa.
- Ba đường cập nhật `search_key` duy nhất: đăng hoặc sửa tiêu đề tin (Service tin đăng); sửa tên, địa chỉ hay phường của nhà trọ (Service nhà trọ chạy một câu `UPDATE listings SET search_key = ... WHERE property_id = ...` trong cùng giao dịch); đổi tên một phường (Service danh mục làm mới mọi tin chưa xóa thuộc phường đó, cùng giao dịch).
- Từ khóa người dùng cũng qua `toSearchKey`, tách tối đa 6 từ (mỗi từ tối đa 50 ký tự), thoát ký tự `\`, `%`, `_` của `LIKE` bằng cách thêm `\` đứng trước (hàm `escapeLike`), rồi AND các điều kiện `contains` của Prisma (sinh `search_key LIKE '%từ%'`; không cần mệnh đề `ESCAPE` vì `\` là ký tự thoát mặc định ở PostgreSQL). **Prisma `contains` không tự thoát `%` và `_`** (đã kiểm chạy thật ngày 2026-10-14), nên bước thoát tay là bắt buộc. Tham số luôn được gắn (bind), không nối chuỗi.
- Chỉ mục `GIN` với `gin_trgm_ops` trên `search_key`, nhờ phần mở rộng `pg_trgm` có sẵn trong image chính thức. Phần mở rộng tạo bằng SQL trong file migration; chỉ mục khai báo trong `schema.prisma` (`@@index([searchKey(ops: raw("gin_trgm_ops"))], type: Gin, map: "listings_search_key_gin")`), vì nếu chỉ tạo bằng SQL thì `prisma migrate diff` coi nó là lệch và đòi xóa. Từ ngắn hơn 3 ký tự không dùng được chỉ mục nhưng vẫn đúng, và nhanh ở quy mô vài nghìn tin.

Tìm theo khu vực (F08, hoãn khỏi MVP; thiết kế giữ lại cho khi làm):
- Tâm tìm kiếm đến từ một trong hai nguồn: `landmark_id` (API lấy tọa độ từ `landmarks`) hoặc cặp `lat` và `lng` gửi trực tiếp (cho nơi mong muốn bất kỳ mà FE chọn trên bản đồ). Backend chỉ cần tọa độ và bán kính (1, 2, 3 hoặc 5 km), không phụ thuộc khái niệm trường học.
- Một phương thức Repository duy nhất: lọc theo khung tọa độ dùng chỉ mục (`latitude`, `longitude`) rồi tính khoảng cách Haversine (đường chim bay) bằng `$queryRaw` có kiểu, trả về khoảng cách theo km. Khi dữ liệu lớn hoặc cần chính xác hơn, đổi image sang bản có PostGIS và thêm một migration; không cần đổi kiểu cột hiện tại.

Giao dịch:
- `TransactionRunner.run<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>` bọc `prisma.$transaction(fn, { isolationLevel: 'ReadCommitted' })`. Gặp lỗi `P2034` (xung đột ghi hoặc deadlock) thì thử lại tối đa 3 lần với độ trễ ngắn tăng dần; hết lần thử thì ném `AppException(DB_UNAVAILABLE)`.
- Repository nhận `tx?: Prisma.TransactionClient` và dùng một hàm nội bộ `client(tx)` (có `tx` thì dùng nó, không thì dùng `PrismaService`). Không dùng cách ngầm truyền giao dịch qua ngữ cảnh bất đồng bộ; luồng đi rõ ràng.
- Bắt buộc dùng giao dịch cho: xác nhận thanh toán thử (đơn thành `paid` và tạo hoặc gia hạn gói), khóa tài khoản kèm hủy phiên, ẩn hoặc gỡ ẩn tin kèm ghi `moderation_logs`, đăng hoặc hiện tin kèm kiểm hạn mức, sửa địa chỉ nhà trọ kèm cập nhật `search_key`, và mọi thao tác ghi từ hai bảng trở lên cần nguyên tử.
- Khóa dòng khi cần chống xử lý trùng: xác nhận thanh toán thử khóa dòng đơn bằng `FOR UPDATE` (bấm hai lần không tạo hai gói) (Prisma không có API khóa dòng, nên viết `$queryRaw` có kiểu ngay trong giao dịch). Giữ giao dịch ngắn (vài dòng, dưới một giây).
- Hạn mức tin đang hiện: trong một giao dịch, khóa dòng `users` của chủ trọ (`SELECT ... FOR UPDATE` qua `$queryRaw` có kiểu), đếm tin `visible` của họ, so với hạn mức hiện hành rồi mới chèn tin hoặc đổi trạng thái về `visible`. Hai yêu cầu đồng thời của cùng một chủ trọ xếp hàng nên không vượt hạn mức. Lượt xem dùng một câu `UPDATE listings SET view_count = view_count + 1 WHERE id = ...` (cộng ngay trong DB, không đọc rồi ghi). Khi chỉ cần biết có dòng nào được đổi (như xoay refresh token), dùng `updateMany` rồi đọc `count`.

Migration và seed:
- Migration là file SQL ở `prisma/migrations`, sinh bằng `prisma migrate dev` (thêm `--create-only` khi cần sửa tay) rồi đọc lại trước khi giữ. Ứng dụng không bao giờ tự đổi schema, ở mọi môi trường. Thay đổi không tương thích ngược làm theo hai bước (thêm cột cho phép rỗng, chuyển dữ liệu, rồi mới thêm ràng buộc).
- Khi dữ liệu cũ có thể vi phạm một ràng buộc mới, migration dừng với thông báo rõ (khối `DO` kèm `RAISE EXCEPTION`) thay vì tự sửa hay bịa dữ liệu. Với bản demo, cách đơn giản nhất là không chuyển dữ liệu cũ mà làm lại DB dev từ đầu (như 0003 nhiệm vụ 2).
- Ràng buộc `CHECK` và chỉ mục duy nhất một phần viết bằng SQL trong file migration: `schema.prisma` không diễn đạt được chúng, và `prisma migrate diff --exit-code` bỏ qua chúng (không báo lệch, không đòi xóa). Chỉ mục GIN trigram thì khác: phải khai báo trong `schema.prisma`, nếu không Prisma đòi xóa nó. Nếu về sau một công cụ Prisma đòi xóa một đối tượng viết tay, kiểm lệch bằng so `pg_dump --schema-only` thay cho `migrate diff` (như 0006 giả định 6), và nếu `migrate dev` vẫn đòi xóa thì chuyển ràng buộc đó sang kiểm ở Service rồi mở lại quyết định này bằng `/architect`.
- Migration (`prisma migrate deploy`) chạy khi container khởi động (spec 0006), trước khi API nhận request; migration lỗi thì container thoát với mã khác 0.
- `seed` chạy lại nhiều lần vẫn đúng và **chỉ thêm dòng còn thiếu theo khóa tự nhiên (`INSERT ... ON CONFLICT DO NOTHING`), không ghi đè dòng admin đã sửa** (hệ quả đã chấp nhận: mục mẫu admin đã xóa sẽ quay lại ở lần seed sau): `wards` (168 đơn vị cấp xã của Thành phố Hồ Chí Minh mới, từ `prisma/seed-data/wards.json`; nguồn, phiên bản và cách kiểm ở `prisma/seed-data/README.md`, đã build ở mốc 1 của spec 0002), `amenities` (13 mẫu, `prisma/seed-data/amenities.json`), `settings` (kèm `trial_days` và `trial_listing_limit`), vài gói mẫu cho `plans` (số gói và giá do spec mua gói chốt), admin đầu tiên (spec 0003); ba loại tài khoản kèm quyền mặc định do migration tạo, không do seed. `landmarks` không seed mặc định.

Kết nối: Prisma dùng `@prisma/adapter-pg` (pool của `pg`). `DATABASE_POOL_MAX` mặc định 10 (tiến trình luôn bật nên giữ pool bền), hạn kết nối 5000 ms và hạn rảnh 30000 ms; mặc định của `pg` không có hạn kết nối nên phải đặt, và tên tùy chọn của adapter kiểm chứng ở lát cắt đầu (xem 0006 giả định 14). Biến vẫn là năm biến `DATABASE_*`; hàm dùng chung `buildDatabaseUrl(settings)` dựng URL cho cả `PrismaService` và `prisma.config.ts` (mật khẩu qua `encodeURIComponent`), và `prisma.config.ts` gọi `loadEnvFile()` trước khi đọc biến. `PrismaService` thử kết nối lại khi khởi động (10 lần, cách nhau 3 giây) phòng trường hợp DB chưa sẵn sàng, dù Compose đã đợi DB khỏe.

Môi trường dev và test:
- Máy dev chạy `docker compose up -d db` (tệp `compose.override.yaml` mở cổng `127.0.0.1:5432`) rồi `npm run start:dev`.
- Máy dev đã có PostgreSQL 18 cài sẵn thì không cần container `db`: điền `.env`, chạy `npm run db:create` (tạo role ứng dụng không phải superuser và database UTF8 mới, đọc mật khẩu quản trị từ `.env`, chạy lại vẫn an toàn), `npm run db:check`, rồi `npm run migration:deploy`. Database luôn tạo bằng `TEMPLATE template0 ENCODING 'UTF8'` vì cụm Postgres cài trên Windows thường mặc định WIN1252, không lưu được tiếng Việt có dấu (đã gặp và kiểm chứng ngày 2026-10-05).
- Test e2e dùng `@testcontainers/postgresql` với image `postgres:18`: một container cho cả lượt chạy (global setup), áp migration, dọn dữ liệu giữa các test. Test đơn vị dùng repository giả.

Sao lưu: dữ liệu nằm trong volume `pgdata`. Sao lưu bằng `docker compose exec db pg_dump -U $POSTGRES_USER -d $POSTGRES_DB > backup.sql` và phục hồi bằng `psql`; lệnh nằm trong README. `docker compose down -v` xóa cả volume (mất dữ liệu), README nói rõ.

**Replaces**:
- Toàn bộ quy ước MongoDB cũ: bản đồ bộ sưu tập, nhúng hay tham chiếu, hợp đồng sao chép dữ liệu lên tin đăng (`landlordActive`, `location`, `wardCode`, `addressText`, `landlordId`), chỉ mục TTL, `TransactionRunner` trên `ClientSession`, `maxPoolSize` kiểu serverless, replica set cho dev và test.
- `isActive: boolean` ở `users` hiện có (thay bằng `status` và `locked_reason`).
- Cách đặt tên kiểu `provinces`, `schools`, `campuses` riêng ở mục 8 của spec chức năng (tỉnh nằm trong `wards`, trường và nơi làm việc gộp thành `landmarks`).

**Enforcement**:
- ESLint `no-restricted-imports` cấm import giá trị từ Prisma ngoài `*.repository.ts`, `src/database/**` và `src/common/persistence/**`, cấm `$queryRawUnsafe` và `$executeRawUnsafe` (spec 0001 con).
- CI chạy kiểm tra lệch schema: áp mọi migration lên Postgres trống rồi chạy `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`, phải thoát mã 0 (không còn thay đổi nào chưa có migration).
- Test e2e chạy truy vấn vào catalog của Postgres để khẳng định mọi cột khóa ngoại có chỉ mục dẫn đầu.
- Test đơn vị cho `toSearchKey`, `toVnDay`, `toSafeInteger`; test e2e trên Postgres thật cho các giao dịch bắt buộc, cho thử lại khi deadlock, và cho chỉ mục duy nhất một phần `users_landlord_phone_unique`.
- Review chặn `jsonb`, `simple-json`, `simple-array`, cột thiếu `type`, danh sách không giới hạn nằm trong một cột.

**Rollout**: Áp dụng ngay cho bảng mới. Bảng `users` hiện có được viết lại trong spec con 0002 và 0003 (chưa có dữ liệu thật; DB dev được làm lại từ đầu, không chuyển dữ liệu thử cũ).

**Exceptions**: `listings.search_key` là cột dẫn xuất duy nhất được phép trong MVP (`listings.view_count` là bộ đếm, không phải bản sao của dữ liệu khác). Truy vấn thô có kiểu chỉ dùng cho khóa dòng, tìm khu vực (khi làm) và các phép tổng hợp chỉ đọc, qua hàm bọc có kiểu.

## Rationale (ngắn)

Domain này có đơn hàng gói, hạn mức tin cần đếm chính xác và nhiều ràng buộc duy nhất, hợp với cơ sở dữ liệu quan hệ. Vì Postgres nối bảng và kiểm khóa ngoại thật, ta bỏ cả lớp việc giữ khớp dữ liệu sao chép của bản MongoDB cũ: ít code, ít test bất biến, không còn nguy cơ lệch dữ liệu. UUID v7 thay `bigint identity` vì id lộ ra ở API và PostgreSQL 18 có sẵn hàm sinh nên không cần thêm phần mở rộng. Kiểu `text` kèm `CHECK` thay cho kiểu `enum` của Postgres để đổi danh sách giá trị chỉ là một migration nhỏ. Truyền `tx` (`Prisma.TransactionClient`) tường minh thay cho thư viện giao dịch ngầm để luồng dữ liệu đọc được và test được, cùng tinh thần với bản `session` cũ. Phương án thay thế: giữ MongoDB (xem rationale của spec tổng), hoặc JSONB cho phí và ảnh (ít bảng hơn nhưng mất ràng buộc và kiểu).

## Consequences

**Positive**:
- Toàn vẹn dữ liệu do DB đảm bảo (khóa ngoại, duy nhất, `CHECK`), không phụ thuộc kỷ luật ở ứng dụng.
- Không còn dữ liệu sao chép giữa bảng; điều kiện hiển thị nằm ở một chỗ.
- Hạn mức tin đếm đúng ngay cả khi chủ trọ bấm đăng nhiều lần cùng lúc.
- Tìm theo khu vực thêm sau không cần đổi dữ liệu hiện có.

**Negative / tradeoffs**:
- Điều kiện hiển thị tin là phép nối ba bảng ở đường tìm kiếm nóng; phải có chỉ mục đúng và kiểm bằng `EXPLAIN` ở spec tin đăng.
- Truy vấn thô của Prisma (`$queryRaw`) kiểm kiểu lỏng; phải dựa vào luật ESLint và hàm bọc có kiểu để giữ "không any" ở phần đó.
- Prisma phải ghi `@@map` và `@map` cho từng bảng và cột nên schema dài hơn; không có xóa mềm tự động nên mỗi phương thức đọc phải nhớ `notDeleted`.
- `search_key` vẫn là một bản sao dẫn xuất cần giữ khớp bằng đúng ba đường cập nhật (xem phần tìm từ khóa).
- `CHECK` và chỉ mục duy nhất một phần phải viết SQL tay trong migration (Prisma bỏ qua chúng nên không báo lệch); chỉ mục GIN phải khai báo trong `schema.prisma`, quên thì `prisma migrate diff` đòi xóa nó.
- Dữ liệu nằm trong volume Docker: quên sao lưu hoặc chạy `down -v` là mất.

**Neutral**:
- Mỗi spec tính năng chốt cột chi tiết, chỉ mục cụ thể và tiện nghi mức phòng (`listing_amenities` theo spec chức năng, nếu cần). Cột chi tiết, mã ngắn và chỉ mục của nhà trọ và tin đã chốt ở spec 0002.
- Bảng `landmarks` và cột `users.preferred_landmark_id` đã hoãn khỏi MVP; khi làm tìm quanh địa điểm mốc (F08) thì tạo ở migration của tính năng đó.

## Follow-up

- [x] Nguồn dữ liệu 168 phường, xã, đặc khu đã chốt và dựng ngày 2026-10-14 (xem `prisma/seed-data/README.md`). Chưa đối chiếu được với bản chính thức của Quyết định 19/2025/QĐ-TTg (Phụ lục II); mới có hai nguồn cộng đồng khớp nhau.
- [ ] Mỗi spec tính năng chốt cột chi tiết và chỉ mục cụ thể; riêng nhà trọ và tin đã chốt ở spec 0002, còn kiểm `EXPLAIN` cho điều kiện hiển thị 6.1 ở mốc 3 của spec đó.
- [ ] Kiểm chứng ở lát cắt đầu phần còn lại: cột `@db.Date` đọc ra đúng ngày; chỉ mục trigram được dùng khi tìm (xem `EXPLAIN`). Danh sách đầy đủ ở bảng giả định của 0006.
- [ ] F08 đã hoãn khỏi MVP; khi cần thì viết spec riêng cho tìm theo tâm (`landmark_id` hoặc `lat` và `lng`).
