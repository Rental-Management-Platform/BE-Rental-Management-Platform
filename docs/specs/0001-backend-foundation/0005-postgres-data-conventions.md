# 0005. Quy ước dữ liệu PostgreSQL (spec con của 0001 nền móng backend)

**Date**: 2026-10-05

## Summary

Spec con này chuyển phần "đối tượng dữ liệu" của spec chức năng (viết theo kiểu bảng và khóa ngoại) thành quy ước cho PostgreSQL 18 qua Prisma 7. Nó chốt bản đồ bảng, cách đặt tên, kiểu cột, khóa ngoại và chỉ mục, giao dịch, tìm từ khóa tiếng Việt, tìm theo khu vực, migration và seed. Vì Postgres có khóa ngoại và phép nối thật, dữ liệu không còn bị sao chép giữa các bảng. Cột chi tiết của từng tính năng do spec tính năng đó chốt sau.

## Decision

Mỗi tính năng có một hoặc vài bảng quan hệ có khóa ngoại và ràng buộc thật. Danh sách có giới hạn (phí, ảnh, tiện ích, vai trò) là bảng con, không phải mảng nhúng. Không sao chép dữ liệu giữa các bảng: điều kiện hiển thị tin dùng phép nối. Mọi thao tác ghi nhiều bảng chạy trong giao dịch qua `TransactionRunner`. Schema chỉ thay đổi bằng migration của Prisma (`prisma migrate`); ứng dụng không bao giờ tự đổi schema.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`): rule `db-use-transactions`, `db-avoid-n-plus-one`, `arch-use-repository-pattern` · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`): rule `schema-primary-keys`, `schema-data-types`, `schema-foreign-key-indexes`, `query-partial-indexes`, `conn-pooling`.

## Standard definition

**Canonical pattern**:

Bản đồ bảng (mức bảng; đã được bạn xác nhận ở bước thiết kế, gồm bảng `landmarks` thay cho `schools` và `campuses`):

| Nhóm | Bảng | Khóa chính và quan hệ | Ràng buộc và chỉ mục chính |
|---|---|---|---|
| Xác thực và quyền | `users` | `id` | `email` duy nhất; `status` là `active` hoặc `locked`; `preferred_landmark_id` (cho phép rỗng) trỏ `landmarks`; xóa mềm |
| | `landlord_profiles` | `user_id` (1:1 với `users`) | Zalo, tên hiển thị, trạng thái xác minh |
| | `roles` | `id` | `key` duy nhất; `permissions` là cột mảng `text[]`; `is_system`, `self_assignable` |
| | `user_roles` | (`user_id`, `role_id`), N:M | xóa người dùng thì xóa dòng; xóa vai trò đang dùng bị chặn (`RESTRICT`) |
| | `auth_sessions`, `password_resets` | `id`; `user_id` trỏ `users` (N:1) | `token_hash` duy nhất; chỉ lưu bản băm; hết hạn kiểm bằng `expires_at` (xem 0002) |
| Danh mục | `wards`, `amenities`, `settings` | `code`, `key`, `key` | tỉnh nằm ngay trong `wards` (`province_code`, `province_name`); `settings` giữ tham số BR-16 theo cặp khóa và giá trị |
| | `landmarks` | `id` | địa điểm mốc để tìm quanh: `name`, `group_name` (tùy chọn, gom nhiều cơ sở của cùng một nơi), `kind` là `school`, `workplace` hoặc `other`, `address_text`, `latitude`, `longitude`, `is_active`; admin quản lý |
| Nhà trọ và tin | `properties` | `id`; `landlord_id` trỏ `users`, `ward_code` trỏ `wards` | `latitude`, `longitude`; chỉ mục (`latitude`, `longitude`); xóa mềm |
| | `property_fees` | `id`; `property_id` trỏ `properties` (N:1, tối đa 6) | loại phí, đơn giá, cách tính |
| | `property_amenities` | (`property_id`, `amenity_key`), N:M | khóa chính chặn trùng |
| | `listings` | `id`; `property_id` trỏ `properties` (N:1) | `search_key` có chỉ mục trigram; chỉ mục cho điều kiện hiển thị 6.1; xóa mềm |
| | `listing_images` | `id`; `listing_id` trỏ `listings` (N:1, tối đa 10) | (`listing_id`, `position`) duy nhất; khóa lưu trữ ảnh |
| | `favorites` | (`user_id`, `listing_id`), N:M | khóa chính chặn trùng |
| | `contact_logs` | `id`; trỏ `users`, `listings` | chỉ mục (`user_id`, `created_at`) để đếm giới hạn mỗi ngày (BR-10) |
| | `reports` | `id`; `reporter_id` trỏ `users`, `listing_id` trỏ `listings` | chỉ mục duy nhất một phần trên (`reporter_id`, `listing_id`) khi `status = 'pending'` (BR-11) |
| | `landlord_verifications` | `id`; `landlord_id` trỏ `users` | ảnh giấy tờ lưu riêng tư trên ổ đĩa (xem 0006) |
| | `listing_daily_stats` | (`listing_id`, `day`) | lượt xem, lưu, liên hệ; cập nhật bằng `ON CONFLICT` |
| | `listing_price_history`, `moderation_logs` | `id` | chỉ thêm, không sửa; chỉ mục theo đối tượng và thời điểm |
| Thu phí | `service_products`, `product_price_history`, `orders`, `payments`, `subscriptions`, `listing_boosts`, `onsite_inspections`, `ad_campaigns`, `ad_daily_stats`, `expenses` | `id`; `orders` trỏ `users` và `service_products`; `payments` trỏ `orders` | `orders.code` duy nhất (nội dung VietQR); `payments.bank_txn_id` duy nhất; `payments` chỉ thêm (BR-24); giá chốt vào đơn |

Quy ước chung:
- **Tên:** bảng `snake_case` số nhiều, cột `snake_case` trong DB và `camelCase` trong TypeScript, nối bằng `@@map("tên_bảng")` và `@map("tên_cột")` ghi rõ cho từng model và từng trường trong `schema.prisma` (Prisma không có chiến lược đặt tên tự động; không thêm công cụ). Ràng buộc và chỉ mục luôn đặt tên rõ qua tham số `map:`: `<bảng>_<cột>_unique`, `<bảng>_<cột>_idx`, `<bảng>_<cột>_fk`, khóa chính `<bảng>_pkey`. Giữ tên rõ để đọc log lỗi DB; khi spec 0004 mở lại phần dịch lỗi PostgreSQL thì sẽ tra theo các tên này.
- **Id:** `uuid`, mặc định `uuidv7()` khai báo bằng `@default(dbgenerated("uuidv7()")) @db.Uuid` (hàm có sẵn của PostgreSQL 18, sắp theo thời gian nên chỉ mục không bị phân mảnh như UUID v4). Dùng UUID vì id lộ ra ở URL và API. Bảng danh mục dùng khóa tự nhiên kiểu `text` (`wards.code`, `amenities.key`, `settings.key`). Đường dẫn công khai của tin dạng `slug-<mã ngắn>`, mã ngắn do spec tin đăng chốt.
- **Kiểu cột:** `text` (không dùng `varchar(n)`), `timestamptz` cho mọi thời điểm (lưu UTC), `boolean`, `integer` cho tiền, `double precision` cho `latitude` và `longitude` kèm `CHECK` (lat trong [-90, 90], lng trong [-180, 180]), `date` cho khóa theo ngày. Mọi trường khai báo kiểu cột tường minh bằng thuộc tính `@db.*` khi mặc định của Prisma không đúng ý (`@db.Uuid`, `@db.Timestamptz(6)`, `@db.Date`); `String` của Prisma là `text` trong PostgreSQL.
- **Giá trị liệt kê:** cột `text` kèm `CHECK (... IN (...))` và union kiểu trong TypeScript. Không dùng kiểu `enum` của Postgres (sửa danh sách giá trị phải qua migration rắc rối).
- **Tiền:** số nguyên đồng Việt Nam kiểu `integer` (tối đa khoảng 2,1 tỷ đồng mỗi khoản, đủ cho giá thuê, phí và một lần thanh toán). Tổng hợp cho báo cáo tính bằng `SUM(...)::bigint` trong SQL, Postgres trả chuỗi, đổi sang số bằng hàm dùng chung `toSafeInteger`. Không dùng số thực cho tiền.
- **Giờ:** `timestamptz`; phiên làm việc của DB đặt múi giờ UTC. Khóa theo ngày (thống kê, đếm giới hạn mỗi ngày) là cột `date` (`@db.Date`; Prisma trả đối tượng `Date` ở nửa đêm UTC chứ không phải chuỗi, kiểm chứng ở lát cắt đầu), tính theo múi giờ `Asia/Ho_Chi_Minh` bằng hàm dùng chung `toVnDay(date)`.
- **Dấu thời gian:** mọi bảng có `created_at`, `updated_at` (`@default(now())` và `@updatedAt`).
- **Xóa mềm** (BR-15) chỉ cho `users`, `properties`, `listings`: cột `deleted_at`. Prisma không có xóa mềm sẵn: mọi phương thức đọc của Repository cho ba bảng này gắn điều kiện `deletedAt: null` qua một hàm dùng chung `notDeleted`, và xóa là `update` đặt `deletedAt`. Chỉ phương thức có tên tường minh `...IncludingDeleted` mới bỏ điều kiện. Không dùng client extension (ít phép thuật ngầm hơn, đổi lại phải nhớ khi viết phương thức đọc mới).
- **Khóa ngoại:** mọi khóa ngoại khai báo `ON DELETE` rõ ràng. Mặc định `RESTRICT`; chỉ dùng `CASCADE` cho dữ liệu con thuộc hẳn về cha (`auth_sessions`, `password_resets`, `landlord_profiles`, `property_fees`, `property_amenities`, `listing_images`, `user_roles` phía người dùng). Postgres không tự đánh chỉ mục cho cột khóa ngoại, nên mọi cột khóa ngoại phải có chỉ mục, trừ khi nó đã là cột đầu của khóa chính hoặc chỉ mục duy nhất.
- **Danh sách có giới hạn là bảng con**, không phải mảng hay JSON. Giới hạn số dòng (tối đa 6 phí, 10 ảnh) kiểm ở Service. Cột mảng `text[]` chỉ dành cho `roles.permissions` (và cột `users.roles` tạm thời cho đến khi làm spec 0003). Cột mảng là `String[]` trong schema (thành `text[]`) và không dựa vào mặc định của DB: giá trị đặt ở Service; cách Prisma tạo cột này (có `NOT NULL` hay không) kiểm chứng ở lát cắt đầu. Cấm kiểu `Json` (jsonb) trừ khi spec tính năng nêu lý do và có kiểu rõ ràng.
- **Không sao chép dữ liệu giữa các bảng.** Điều kiện hiển thị 6.1 (tin được duyệt, chủ trọ đang hoạt động, còn hạn...) là phép nối `listings`, `properties`, `users`, được viết đúng một lần trong một phương thức Repository (`visibleListingsQuery`). Ngoại lệ duy nhất là `listings.search_key` (xem dưới). Dữ liệu dẫn xuất khác chỉ được thêm khi đo thấy chậm, và phải ghi đường cập nhật duy nhất của nó trong spec tính năng.

Tìm từ khóa tiếng Việt:
- `search_key` là chuỗi gộp tiêu đề, địa chỉ và tên phường/xã, chuẩn hóa bằng hàm `toSearchKey(...parts)`: Unicode NFD, bỏ dấu kết hợp, đổi `đ` và `Đ` thành `d`, chữ thường, gộp khoảng trắng. Chữ `đ` không tách dấu được nên không dựa vào phần mở rộng `unaccent`.
- Cập nhật `search_key` khi tiêu đề đổi (Service tin đăng) và khi địa chỉ nhà trọ đổi (Service nhà trọ chạy một câu `UPDATE listings SET search_key = ... WHERE property_id = ...` trong cùng giao dịch).
- Từ khóa người dùng cũng qua `toSearchKey`, tách tối đa 6 từ (mỗi từ tối đa 50 ký tự), thoát ký tự `%`, `_`, `\` của `LIKE`, rồi AND các điều kiện `search_key LIKE '%từ%' ESCAPE '\'`. Tham số luôn được gắn (bind), không nối chuỗi.
- Chỉ mục `GIN` với `gin_trgm_ops` trên `search_key`, nhờ phần mở rộng `pg_trgm` có sẵn trong image chính thức. Cả phần mở rộng và chỉ mục tạo bằng SQL trong file migration (hoặc khai báo trong schema nếu Prisma diễn đạt được `gin_trgm_ops`; kiểm chứng ở lát cắt đầu). Từ ngắn hơn 3 ký tự không dùng được chỉ mục nhưng vẫn đúng, và nhanh ở quy mô vài nghìn tin.

Tìm theo khu vực (F08, tùy tiến độ):
- Tâm tìm kiếm đến từ một trong hai nguồn: `landmark_id` (API lấy tọa độ từ `landmarks`) hoặc cặp `lat` và `lng` gửi trực tiếp (cho nơi mong muốn bất kỳ mà FE chọn trên bản đồ). Backend chỉ cần tọa độ và bán kính (1, 2, 3 hoặc 5 km), không phụ thuộc khái niệm trường học.
- Một phương thức Repository duy nhất: lọc theo khung tọa độ dùng chỉ mục (`latitude`, `longitude`) rồi tính khoảng cách Haversine (đường chim bay) bằng `$queryRaw` có kiểu, trả về khoảng cách theo km. Khi dữ liệu lớn hoặc cần chính xác hơn, đổi image sang bản có PostGIS và thêm một migration; không cần đổi kiểu cột hiện tại.

Giao dịch:
- `TransactionRunner.run<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>` bọc `prisma.$transaction(fn, { isolationLevel: 'ReadCommitted' })`. Gặp lỗi `P2034` (xung đột ghi hoặc deadlock) thì thử lại tối đa 3 lần với độ trễ ngắn tăng dần; hết lần thử thì ném `AppException(DB_UNAVAILABLE)`.
- Repository nhận `tx?: Prisma.TransactionClient` và dùng một hàm nội bộ `client(tx)` (có `tx` thì dùng nó, không thì dùng `PrismaService`). Không dùng cách ngầm truyền giao dịch qua ngữ cảnh bất đồng bộ; luồng đi rõ ràng.
- Bắt buộc dùng giao dịch cho: xác nhận thanh toán (đơn, thanh toán, gói, lượt đẩy), đổi vai trò kèm hủy phiên, khóa tài khoản kèm hủy phiên, sửa địa chỉ nhà trọ kèm đưa tin về Chờ duyệt và cập nhật `search_key`, và mọi thao tác ghi từ hai bảng trở lên cần nguyên tử.
- Khóa dòng khi cần chống xử lý trùng: xác nhận thanh toán khóa dòng đơn bằng `FOR UPDATE` (Prisma không có API khóa dòng, nên viết `$queryRaw` có kiểu ngay trong giao dịch); kiểm tra `LAST_ADMIN` khóa các dòng người dùng giữ `role:manage` (spec 0003). Giữ giao dịch ngắn (vài dòng, dưới một giây).
- Đếm hạn mức và lượt dùng dùng một câu `UPDATE ... SET n = n + 1 WHERE ... AND n < giới_hạn RETURNING ...`, không đọc rồi ghi. Thống kê ngày dùng `INSERT ... ON CONFLICT (listing_id, day) DO UPDATE SET views = listing_daily_stats.views + 1` qua `$executeRaw` có kiểu (`upsert` của Prisma không đảm bảo một câu SQL nguyên tử cho phép cộng dồn). Khi chỉ cần biết có dòng nào được đổi (như xoay refresh token), dùng `updateMany` rồi đọc `count`.

Migration và seed:
- Migration là file SQL ở `prisma/migrations`, sinh bằng `prisma migrate dev` (thêm `--create-only` khi cần sửa tay) rồi đọc lại trước khi giữ. Ứng dụng không bao giờ tự đổi schema, ở mọi môi trường. Thay đổi không tương thích ngược làm theo hai bước (thêm cột cho phép rỗng, chuyển dữ liệu, rồi mới thêm ràng buộc).
- Ràng buộc `CHECK`, chỉ mục duy nhất một phần và mọi chỉ mục mà `schema.prisma` không diễn đạt được (GIN trigram) viết bằng SQL trong file migration. Phải kiểm chứng ở lát cắt đầu rằng `prisma migrate dev` và `prisma migrate diff --exit-code` không đòi xóa chúng (xem 0006 giả định 6); nếu Prisma đòi xóa thì kiểm lệch bằng so `pg_dump --schema-only` thay cho `migrate diff` (như 0006 giả định 6), và nếu `migrate dev` vẫn đòi xóa thì chuyển các ràng buộc đó sang kiểm ở Service rồi mở lại quyết định này bằng `/architect`.
- Migration (`prisma migrate deploy`) chạy khi container khởi động (spec 0006), trước khi API nhận request; migration lỗi thì container thoát với mã khác 0.
- `seed` chạy lại nhiều lần vẫn đúng (thêm hoặc cập nhật theo khóa tự nhiên): `wards` (168 đơn vị của TP.HCM, từ file JSON trong repo), `amenities`, `settings`, vai trò hệ thống, admin đầu tiên (spec 0003). `landmarks` không seed mặc định.

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
- Test đơn vị cho `toSearchKey`, `toVnDay`, `toSafeInteger`; test e2e trên Postgres thật cho các giao dịch bắt buộc, cho thử lại khi deadlock, và cho chỉ mục duy nhất một phần của `reports`.
- Review chặn `jsonb`, `simple-json`, `simple-array`, cột thiếu `type`, danh sách không giới hạn nằm trong một cột.

**Rollout**: Áp dụng ngay cho bảng mới. Bảng `users` hiện có được viết lại trong spec con 0002 (chưa có dữ liệu thật nên không cần di chuyển).

**Exceptions**: Báo cáo tài chính được dùng SQL thô có kiểu cho truy vấn tổng hợp nhiều bảng (chỉ đọc, qua hàm bọc có kiểu). `listings.search_key` là cột dẫn xuất duy nhất được phép trong MVP.

## Rationale (ngắn)

Domain này có sổ giao dịch, ràng buộc duy nhất và báo cáo thu chi, hợp với cơ sở dữ liệu quan hệ. Vì Postgres nối bảng và kiểm khóa ngoại thật, ta bỏ cả lớp việc giữ khớp dữ liệu sao chép của bản MongoDB cũ: ít code, ít test bất biến, không còn nguy cơ lệch dữ liệu. UUID v7 thay `bigint identity` vì id lộ ra ở API và PostgreSQL 18 có sẵn hàm sinh nên không cần thêm phần mở rộng. Kiểu `text` kèm `CHECK` thay cho kiểu `enum` của Postgres để đổi danh sách giá trị chỉ là một migration nhỏ. Truyền `tx` (`Prisma.TransactionClient`) tường minh thay cho thư viện giao dịch ngầm để luồng dữ liệu đọc được và test được, cùng tinh thần với bản `session` cũ. Phương án thay thế: giữ MongoDB (xem rationale của spec tổng), hoặc JSONB cho phí và ảnh (ít bảng hơn nhưng mất ràng buộc và kiểu).

## Consequences

**Positive**:
- Toàn vẹn dữ liệu do DB đảm bảo (khóa ngoại, duy nhất, `CHECK`), không phụ thuộc kỷ luật ở ứng dụng.
- Không còn dữ liệu sao chép giữa bảng; điều kiện hiển thị nằm ở một chỗ.
- Báo cáo thu chi viết bằng SQL tổng hợp thông thường.
- Tìm theo khu vực thêm sau không cần đổi dữ liệu hiện có.

**Negative / tradeoffs**:
- Điều kiện hiển thị tin là phép nối ba bảng ở đường tìm kiếm nóng; phải có chỉ mục đúng và kiểm bằng `EXPLAIN` ở spec tin đăng.
- Truy vấn thô của Prisma (`$queryRaw`) kiểm kiểu lỏng; phải dựa vào luật ESLint và hàm bọc có kiểu để giữ "không any" ở phần đó.
- Prisma phải ghi `@@map` và `@map` cho từng bảng và cột nên schema dài hơn; không có xóa mềm tự động nên mỗi phương thức đọc phải nhớ `notDeleted`.
- `search_key` vẫn là một bản sao dẫn xuất cần giữ khớp bằng đúng hai đường cập nhật.
- Chỉ mục GIN và chỉ mục duy nhất một phần phải viết SQL trong migration, và `prisma migrate` có thể đòi xóa chúng (chưa kiểm chứng, xem 0006 giả định 6).
- Dữ liệu nằm trong volume Docker: quên sao lưu hoặc chạy `down -v` là mất.

**Neutral**:
- Mỗi spec tính năng chốt cột chi tiết, chỉ mục cụ thể, mã ngắn của tin và tiện nghi mức phòng (`listing_amenities` theo spec chức năng, nếu cần).
- Bảng `landmarks` và cột `users.preferred_landmark_id` được tạo ở migration của tính năng đầu tiên cần đến chúng (hồ sơ người thuê hoặc F08), không bắt buộc có trong lát cắt đầu.

## Follow-up

- [ ] Chốt nguồn dữ liệu 168 phường/xã (file JSON trong repo) trước khi làm F03.
- [ ] Mỗi spec tính năng chốt cột chi tiết, chỉ mục cụ thể (kèm `EXPLAIN` cho điều kiện hiển thị 6.1) và mã ngắn của tin.
- [ ] Kiểm chứng ở lát cắt đầu: `uuidv7()` làm mặc định khóa chính và Prisma đọc lại id sau khi chèn; `prisma migrate dev` và `migrate diff --exit-code` không đòi xóa `CHECK`, chỉ mục một phần và chỉ mục GIN viết bằng SQL; cột `@db.Date` và `String[]` hoạt động như mô tả; chỉ mục trigram được dùng (xem `EXPLAIN`). Danh sách đầy đủ ở bảng giả định của 0006 (các dòng 2, 5, 6, 14 đến 16).
- [ ] Quyết định F08 làm hay chưa theo tiến độ; khi làm thì viết spec riêng cho tìm theo tâm (`landmark_id` hoặc `lat` và `lng`).
