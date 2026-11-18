# 0016. Lượt xem tin đăng theo ngày

**Date**: 2026-11-16
**Status**: Accepted

## Summary

Hiện mỗi tin chỉ có một con số cộng dồn `view_count`, nên không ai biết tin được xem nhiều hay ít theo từng ngày và FE không thể tự suy ra lịch sử. Spec này thêm một bảng đếm theo ngày giờ Việt Nam; mỗi lượt xem đã được tính sẽ cộng vào cả `view_count` lẫn bộ đếm của ngày trong cùng một câu SQL, nên hai con số không bao giờ lệch nhau. Lịch sử bắt đầu từ ngày chạy migration (lượt xem cũ không có ngày nên không dựng lại). Hàng này chỉ ghi dữ liệu: không thêm route nào, việc đọc và vẽ biểu đồ là của hàng 26.

## Requirements

**User stories**:
- Là chủ trọ, tôi muốn hệ thống ghi lại mỗi ngày tin của tôi được xem bao nhiêu lượt, để màn hình thống kê (hàng 26) vẽ được biểu đồ theo ngày.
- Là người làm FE, tôi muốn số theo ngày được BE ghi đúng từ lúc xảy ra, để không phải suy ra lịch sử từ một con số cộng dồn.
- Là người chạy bản demo, tôi muốn các tin demo có sẵn lịch sử theo ngày khớp với `view_count`, để biểu đồ có số liệu ngay.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: Mở chi tiết một tin công khai (`GET /listings/:slugCode`) mà lượt đó được tính thì một câu SQL duy nhất vừa cộng `listings.view_count` thêm 1, vừa cộng `views` của dòng `listing_daily_views` (`listing_id` là tin đó, `day` là ngày lịch giờ Việt Nam của thời điểm request) thêm 1, và tạo dòng với `views = 1` nếu ngày đó chưa có dòng. Một lượt được tính khi: người xem không phải chủ tin, đã qua cửa sổ 30 phút của `ViewDeduplicator`, và tin còn `visible` chưa xóa mềm lúc ghi (đúng luật của 0002 AC-13, không đổi). `viewCount` trong response vẫn là số sau khi cộng, cùng giá trị và cùng chỗ như hôm nay.
- **AC-2**: Lượt không được tính không đổi gì: chủ tin mở tin của mình, cùng người xem mở lại trong 30 phút, tin bị ẩn hay xóa mềm đúng giữa lúc đọc và lúc ghi (câu cập nhật không đổi dòng nào), và mọi request ra 404 `LISTING_NOT_FOUND`. Trong các trường hợp đó `view_count` không tăng và không có dòng `listing_daily_views` nào được tạo hay đổi.
- **AC-3**: Ngày là ngày lịch giờ Việt Nam (`APP_TIME_ZONE`, UTC+7), không phải ngày UTC hay ngày của múi giờ phiên DB. Lượt lúc 16:59:59.999 UTC (23:59:59.999 giờ Việt Nam) ghi vào ngày đó; lượt lúc 17:00:00.000 UTC (00:00:00.000 giờ Việt Nam) ghi vào ngày kế; kết quả giống nhau khi phiên DB đặt UTC, `Asia/Ho_Chi_Minh` hay `America/Los_Angeles`. Mốc thời gian là `now` của request (không phải đồng hồ DB), đi vào SQL dạng chuỗi ISO có `Z`.
- **AC-4**: Hai con số đổi cùng lúc hoặc không đổi gì. Với mọi tin tạo sau khi chạy migration, `view_count` luôn bằng tổng `views` của mọi ngày của tin đó. Với tin có từ trước, hiệu `view_count` trừ tổng `views` là một hằng số (phần lượt xem trước khi có ngày) và không đổi sau migration. Nếu ghi dòng ngày bị lỗi (ví dụ `views` của ngày đó đã là 2147483647 nên cộng thêm bị tràn số) thì cả câu SQL lỗi: `view_count` không tăng, và request chi tiết vẫn trả 500 `INTERNAL_ERROR` như hôm nay khi câu `UPDATE` lỗi (lỗi không bị bắt hay nuốt).
- **AC-5**: N lượt được tính đồng thời cho cùng một tin (người xem khác nhau, N tới 50) làm `view_count` tăng đúng N và tổng `views` của ngày tăng đúng N: không mất lượt, không đếm đôi. Điều này đúng cả khi các lượt đó cùng là lượt đầu tiên của một ngày chưa có dòng: không lỗi trùng khóa nào, và đúng một dòng cho cặp (tin, ngày).
- **AC-6**: Ràng buộc ở DB (`INSERT` hay `DELETE` thẳng, không qua API): `listing_daily_views` có khóa chính (`listing_id`, `day`), `day` kiểu `date`, `views` kiểu integer có CHECK `views > 0`, khóa ngoại `listing_id` tới `listings` kiểu RESTRICT. Chèn trùng cặp, chèn `views` bằng 0 hay âm, chèn `listing_id` không tồn tại, và xóa một tin còn dòng ngày bằng `DELETE` thẳng đều bị DB từ chối. Bảng không lưu người xem, IP hay bất cứ thứ gì định danh.
- **AC-7**: Migration chỉ tạo bảng mới, không chạm dữ liệu cũ: bảng mới rỗng, `view_count` của mọi tin và mọi hàng của bảng khác giữ nguyên, `prisma migrate diff` không lệch. Lượt xem trước migration không có ngày và không được dựng lại hay chia đều. Không thêm hay đổi route, quyền, mã lỗi, biến môi trường hay nhóm giới hạn tần suất; mọi response có `viewCount` giữ đúng hình dạng và giá trị như trước; hai tài liệu `docs/api/postman-collection.json` và `docs/api/api-for-frontend.md` không đổi.
- **AC-8**: `seed:demo` tạo dòng ngày cho mọi tin demo có `view_count` lớn hơn 0: các ngày nằm từ ngày tạo tin đến hôm nay (cùng tính theo giờ Việt Nam), mỗi dòng có `views` lớn hơn 0, và tổng `views` của mỗi tin bằng đúng `view_count` của nó; tin có `view_count` bằng 0 không có dòng nào. Phần dựng nằm ở cuối `buildDemoRows` và dùng bộ sinh số riêng có hạt giống, nên mọi hàng khác của demo giữ nguyên giá trị so với trước. `seed:demo --reset` xóa các dòng ngày của tin demo (kể cả dòng do lượt xem thật tạo ra) trước khi xóa tin; chạy `seed:demo --reset` liên tiếp hai lần không lỗi.

## Decision

**Chosen option**: Option 1: Một bảng `listing_daily_views` giữ một bộ đếm cho mỗi cặp (tin, ngày giờ Việt Nam), cộng cùng câu SQL với `view_count`

Câu SQL cộng lượt xem hiện có (`ListingsRepository.incrementViewCount`) trở thành một câu duy nhất có CTE ghi dữ liệu (một CTE là một khối `WITH` đặt tên): `UPDATE listings ... RETURNING` rồi `INSERT ... ON CONFLICT DO UPDATE` vào bảng ngày. Vì là một câu nên hai bên cùng đổi hoặc cùng không đổi, không cần giao dịch. Lỗi ghi vẫn làm request lỗi như hôm nay. Hàng này chỉ ghi, không có route đọc; hàng 26 thiết kế phần đọc. `seed:demo` thêm lịch sử khớp `view_count`. Spec này sửa 0002 ở đúng một điểm: AC-13 và dòng bất biến "`view_count` chỉ đổi qua một câu `UPDATE`" nay đọc là "chỉ đổi qua câu SQL duy nhất dưới đây"; luật đếm (30 phút, chủ tin không tính, tin phải `visible`) giữ nguyên.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `prisma-cli` (`prisma/skills`, `.agents/skills/prisma-cli/`)

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).

## Feature design

Quy ước chung theo 0001 đến 0015: Repository bọc Prisma, `timestamptz`, tên bảng và cột `snake_case` qua `@@map` và `@map`, ràng buộc đặt tên `<bảng>_<cột>_unique|idx|fk|check`, SQL thô chỉ nằm trong file `*.repository.ts` (luật lint), tham số thời gian vào SQL thô là chuỗi ISO có `Z` qua `toSqlTimestamp` (không truyền `Date`, xem `src/common/time/app-time-zone.ts`).

**Data model** (một migration, `20261116090000_listing_daily_views`; mô hình đã được bạn xác nhận):

| Bảng | Khóa chính | Cột | Ràng buộc và chỉ mục |
|---|---|---|---|
| `listing_daily_views` | (`listing_id`, `day`) | `listing_id` (uuid, tin được xem, FK `listings`, RESTRICT), `day` (date, ngày lịch giờ Việt Nam của lượt xem), `views` (integer, bắt buộc, số lượt đã tính trong ngày đó) | khóa chính `listing_daily_views_pkey` (cũng là đích của `ON CONFLICT` và chỉ mục cho việc quét theo khoảng ngày của một tin); CHECK `listing_daily_views_views_check` (`views > 0`); FK `listing_daily_views_listing_id_fk`; không chỉ mục nào khác |

Quan hệ: `listings` 1:N `listing_daily_views`. Không có dòng cho ngày không có lượt nào. Mọi FK RESTRICT vì tin chỉ xóa mềm; tin bị ẩn hay xóa mềm giữ nguyên lịch sử của nó. Không có cột `landlord_id`: hàng 26 sẽ nối qua `listings` và `properties` khi đọc. Không có `created_at` hay `updated_at` (ngày đã là thời gian của dòng, và dòng chỉ tăng). Không lưu người xem hay IP. `schema.prisma` thêm model `ListingDailyView` và quan hệ `dailyViews` trên `Listing`; mô hình Prisma phục vụ migration và hàng 26, còn việc ghi dùng SQL thô vì Prisma client không viết được CTE ghi dữ liệu. Migration không có phần dữ liệu: không sao chép hay chia đều `view_count` cũ.

**State transitions**: không có máy trạng thái. Một dòng chỉ được tạo (lượt đầu của ngày) rồi tăng `views`; không có đường nào sửa giảm hay xóa dòng ngoài `seed:demo --reset`.

**API surface**: không thêm hay đổi route. Route duy nhất chạm vào là route đã có, hợp đồng không đổi:

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/listings/:slugCode` | GET | như hiện tại | như hiện tại (`viewCount` là số sau khi cộng) | công khai, đọc đăng nhập tùy chọn (không đổi) | như hiện tại, thêm 500 `INTERNAL_ERROR` nếu ghi lượt xem lỗi (như hôm nay) |

**Câu ghi** (thay thân của `ListingsRepository.incrementViewCount`, nay nhận thêm `now: Date`; trả `view_count` sau khi cộng hoặc `null` nếu không có dòng nào đổi):

```sql
WITH bumped AS (
  UPDATE listings
  SET view_count = view_count + 1
  WHERE id = $id::uuid AND status = 'visible' AND deleted_at IS NULL
  RETURNING id, view_count
), daily AS (
  INSERT INTO listing_daily_views (listing_id, day, views)
  SELECT id, ($nowIso::timestamptz AT TIME ZONE $tz)::date, 1
  FROM bumped
  ON CONFLICT (listing_id, day)
  DO UPDATE SET views = listing_daily_views.views + 1
)
SELECT view_count FROM bumped
```

`$nowIso` là `toSqlTimestamp(now)`, `$tz` là `APP_TIME_ZONE`. Khối `daily` luôn chạy tới hết dù câu chính không đọc nó, và chỉ chèn khi `bumped` có dòng, nên tin không `visible` không để lại dấu vết nào (AC-2). `ListingsService.getPublicDetail` truyền `now` đã có sẵn (controller lấy một lần mỗi request) vào hàm này. Luật quyết định có tính lượt hay không (`isOwner`, `ViewDeduplicator.shouldCount`) giữ nguyên trong Service.

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Ghi lượt xem | tin (`listing_id`) | `row.id` của tin đã đọc ở `getPublicDetail` (đã qua luật hiển thị công khai) |
| Ghi lượt xem | `day` | `now` của request (`new Date()` do controller lấy một lần), đi vào SQL qua `toSqlTimestamp`, đổi sang ngày bằng `AT TIME ZONE` với `APP_TIME_ZONE` (định nghĩa duy nhất của "ngày", spec 0010) |
| Ghi lượt xem | `views` | 1 khi tạo dòng, `views + 1` khi dòng đã có |
| Ghi lượt xem | `viewCount` trả về cho client | `RETURNING view_count` của câu `UPDATE` (như hôm nay) |
| Ghi lượt xem | có tính lượt hay không | `isOwner` (người xem so với chủ nhà trọ), `ViewDeduplicator.shouldCount` (30 phút, trong bộ nhớ), điều kiện `status = 'visible' AND deleted_at IS NULL` của câu `UPDATE` (cả ba không đổi so với 0002) |
| Demo | các ngày có dòng | từ `createdAt` của tin (đổi sang ngày giờ Việt Nam) đến hôm nay (giờ Việt Nam) |
| Demo | `views` mỗi ngày | `view_count` của tin demo chia theo trọng số lấy từ bộ sinh số riêng có hạt giống, làm tròn theo phần dư lớn nhất để tổng đúng bằng `view_count` |

**Key invariants**:
- `view_count` và bộ đếm ngày chỉ đổi qua câu SQL duy nhất ở trên (sau migration). Riêng `seed:demo` đặt `view_count` trực tiếp và tự dựng dòng ngày khớp với nó (AC-8).
- `views` chỉ tăng. Một dòng tồn tại khi và chỉ khi ngày đó có ít nhất một lượt đã tính.
- `day` luôn là ngày giờ Việt Nam của `now` trong request, không bao giờ lấy từ đồng hồ DB hay múi giờ phiên.
- Thứ tự khóa luôn là dòng `listings` trước, rồi dòng ngày. Các lượt cùng một tin đã xếp hàng ở khóa dòng `listings` của câu `UPDATE` (như hôm nay), nên dòng ngày không thêm tranh chấp hay bế tắc: lượt sau chờ lượt trước xong rồi mới thấy dòng ngày đã có và rơi vào nhánh `DO UPDATE`.
- Lượt xem trước migration không có ngày: với tin cũ, `view_count` trừ tổng `views` là phần "trước khi có ghi theo ngày" và đứng yên.

**Security model**: không có route đọc hay ghi mới, nên không có quyền mới. Bảng chỉ chứa số đếm, không có email, IP hay id người xem; việc ai được đọc bảng là quyết định của hàng 26. Chi tiết tin công khai giữ nguyên cách ẩn số điện thoại và cách loại lượt của chủ tin.

**Configuration required**: không có biến môi trường hay khóa mới. Migration phải chạy trước khi API mới khởi động (`npm run migration:deploy`): chưa có bảng thì mọi lượt xem được tính sẽ ra 500 ở chi tiết tin (đúng quyết định "lỗi thì báo lớn", xem Consequences).

**Critical test scenarios** (mỗi mục ứng với AC trong `## Requirements`):
- Happy path: mở chi tiết một tin lần đầu trong ngày thì `view_count` tăng 1 và có dòng (tin, hôm nay) với `views = 1`; người khác mở thì `views = 2`, `viewCount` trong response là số sau khi cộng, verifies **AC-1**
- Không tính: chủ tin, cùng người xem trong 30 phút (đồng hồ giả), tin ẩn, tin xóa mềm, id sai (404): không dòng nào đổi, verifies **AC-2**
- Biên ngày: hai mốc 16:59:59.999 UTC và 17:00:00.000 UTC nhân ba múi giờ phiên (`UTC`, `Asia/Ho_Chi_Minh`, `America/Los_Angeles`) ra cùng một ngày kỳ vọng, verifies **AC-3**
- Nguyên tử: đặt sẵn `views = 2147483647` cho ngày hôm nay rồi mở chi tiết thì 500 và `view_count` không đổi; với tin mới, `view_count` bằng tổng `views` sau mọi lượt, verifies **AC-4**
- Đồng thời: 50 lượt cùng lúc từ 50 IP khác nhau vào một tin, một lần trên ngày chưa có dòng và một lần trên ngày đã có dòng, kèm điều khiển âm đổi hành vi thật (đổi `DO UPDATE` thành `DO NOTHING` thì tổng ngày thấp hơn `view_count` đúng bằng số lượt chen vào), verifies **AC-5**
- Ràng buộc DB: `INSERT` trùng cặp, `views` 0 và âm, `listing_id` lạ, `DELETE` tin còn dòng ngày đều bị từ chối, verifies **AC-6**
- Migration và hợp đồng: so `view_count` mọi tin trước và sau migration, `migrate diff` không lệch, Newman không đổi, verifies **AC-7**
- Demo: tổng `views` mỗi tin demo bằng `view_count`, không ngày nào ngoài khoảng ngày tạo đến hôm nay, hàng bảng khác giống hệt lần chạy trước khi sửa, `--reset` hai lần liên tiếp không lỗi, verifies **AC-8**

## Build plan

Cách build theo scope là Skateboard (làm bản mỏng nhất dùng được trước): mốc 1 là bản ghi dữ liệu thật chạy được từ đầu đến cuối, mốc 2 chỉ làm giàu dữ liệu demo. Mỗi mốc xong thì dừng; không làm hàng 26 trong lần này.

**Mốc 1: ghi lượt xem theo ngày**
1. Migration `20261116090000_listing_daily_views` tạo bảng với khóa chính, CHECK và khóa ngoại RESTRICT (không có phần dữ liệu), thêm model `ListingDailyView` và quan hệ `dailyViews` vào `schema.prisma`, sinh lại Prisma client, satisfies **AC-6**, **AC-7**
2. Thay thân `ListingsRepository.incrementViewCount(id, now)` bằng câu CTE ở trên, truyền `now` từ `ListingsService.getPublicDetail`, sửa các bài unit hiện có và thêm bài mới cho hai tham số mới, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**
3. Kiểm bằng script gọi thật trên database thử (không mock DB): ghi cơ bản, các lượt không tính, biên ngày ở ba múi giờ phiên, lỗi tràn số làm `view_count` đứng yên, 50 lượt đồng thời kèm điều khiển âm, ràng buộc DB, so `view_count` trước và sau migration, Newman chạy lại không đổi, satisfies **AC-1** đến **AC-7**

**Mốc 2: dữ liệu demo**
4. Thêm bước dựng dòng ngày vào cuối `buildDemoRows` (bộ sinh số riêng có hạt giống, chia `view_count` theo ngày từ ngày tạo tin đến hôm nay), chèn trong `seed-demo.ts` sau khi chèn tin, và thêm bước xóa `listing_daily_views` của tin demo vào `deleteDemoData` trước khi xóa tin; thêm bài test cho phần dựng trong `src/database/demo`, satisfies **AC-8**
5. Chạy `seed:demo --reset` hai lần liên tiếp trên database thử, kiểm tổng mỗi tin và các hàng bảng khác không đổi, satisfies **AC-8**

Cả hai mốc không đổi API nên hai tài liệu `docs/api/` giữ nguyên; báo cáo `/develop` ghi rõ điều đó thay vì sửa.

## Consequences

**Positive**:
- Có lịch sử lượt xem theo ngày thật từ ngày chạy migration, đủ để hàng 26 vẽ biểu đồ mà không cần việc chạy nền, route mới hay thư viện mới.
- Hai con số không thể lệch nhau: một câu SQL, nên một lượt hoặc đổi cả hai hoặc không đổi gì, và có thể chứng minh bằng phép cộng tay.
- Không đổi hợp đồng API, quyền hay tài liệu FE.

**Negative / tradeoffs**:
- Mỗi lượt được tính trên route công khai nóng nhất thêm một thao tác ghi (một upsert trong cùng câu, không thêm vòng đi về với DB), và việc ghi là SQL thô khó đọc hơn Prisma client.
- Số theo ngày chỉ chính xác bằng bộ đếm 30 phút trong bộ nhớ của 0002: API khởi động lại thì một người xem lại có thể được tính thêm một lượt, nhiều bản sao API không chia sẻ bộ nhớ, và nhiều người chung một IP tính chung. Đây là lượt xem đã tính, không phải số người xem khác nhau, FE nên gọi tên đúng như vậy.
- Lượt xem cũ không có ngày: với mọi tin có từ trước, tổng các ngày nhỏ hơn `view_count` đúng bằng phần cũ, mãi mãi. Hàng 26 muốn hiện phần này thì lấy `view_count` trừ tổng ngày.
- Ngày được chốt thành `date` ngay lúc ghi nên đổi `APP_TIME_ZONE` sau này không chia lại lịch sử đã ghi (Việt Nam không đổi giờ mùa hè, nên không phải lo cho bản này). Không có giờ, nên không vẽ được biểu đồ theo giờ.
- Quên chạy migration trước khi khởi động API mới thì chi tiết tin bị 500 ở mọi lượt được tính (cố ý: lỗi hiện ngay thay vì mất số liệu âm thầm). Giảm nhẹ bằng việc ghi rõ ở Configuration và báo cáo `/develop`.
- Giữ mãi không có việc dọn. Cỡ xấu nhất: 60 nghìn tin, mỗi tin được xem mỗi ngày suốt một năm, ra khoảng 22 triệu dòng (60 000 x 365 = 21 900 000), ước thô cỡ 2 GB cả chỉ mục (chưa đo). Chấp nhận có chủ đích vì đây là bản MVP không chạy thật và dự án không có bộ lập lịch.
- Câu của 0002 (AC-13, dòng bất biến về `view_count`) nay lỗi thời ở một điểm; xem Follow-up.

**Neutral**:
- `ViewDeduplicator`, luật chủ tin không tính và điều kiện `visible` giữ nguyên, nên mọi số hiển thị hiện tại (`viewCount` ở chi tiết, `/me/listings`, kiểm duyệt, tổng lượt xem của hồ sơ chủ trọ) không đổi.
- Rollback là hoàn lại commit; bảng mới còn lại cũng vô hại.
- Model Prisma `ListingDailyView` được sinh ra nhưng chưa có truy vấn nào dùng ở hàng này.

## Follow-up

- [ ] Sửa 0002 cho khớp: AC-13 và dòng bất biến "`view_count` chỉ tăng, chỉ qua một câu `UPDATE`" (cùng đoạn Consequences nhắc cộng lượt xem) nên thêm một dòng trỏ tới spec này. `/sync` sẽ cờ nó; `/architect` quyết sửa tại chỗ hay chỉ thêm con trỏ.
- [ ] Hàng 26 thiết kế phần đọc: khoảng ngày, kỳ liền trước và phần trăm đổi, ai được đọc, và việc nối qua `listings` và `properties` để cộng theo chủ trọ (cân nhắc thêm chỉ mục khi đo thấy cần). Hàng 26 phụ thuộc hàng này.
- [ ] Việc chỉ bạn làm được: chạy `npm run migration:deploy` trên DB dev trước khi khởi động API mới, rồi `npm run seed:demo -- --reset` để có dòng ngày cho các tin demo.
- [ ] Tùy chọn: đo một lần số dòng và dung lượng bảng ở mức xấu nhất (60 nghìn tin, 365 ngày) bằng dữ liệu sinh ra, ghi số vào `verify.md`, rồi bỏ qua như các ngân sách quy mô khác.
- [ ] `/sync`: `src/database/demo/AGENTS.md` (file này bị git bỏ qua) nên có thêm một dòng về bảng `listing_daily_views` cần bước xóa trong `deleteDemoData`; và `src/listings/` chưa có `AGENTS.md` ghi câu cộng lượt xem nay chạm hai bảng.
