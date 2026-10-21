# Verify: danh sách người dùng cho admin · spec 0007 · updated 2026-10-21
_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Chạy trên một database thử (đã dùng `rental_management_verify`), không chạy trên database đang dùng. Dọn schema, rồi `npx prisma migrate deploy` và `npm run seed`, khởi động lại server trước mỗi lần chạy. Mỗi bước đối chiếu với **phép tính độc lập từ dòng thô** trong `users` (đếm và sắp bằng SQL), không với chính câu truy vấn của ứng dụng. Chạy lại cần database trống vì các dòng dựng tay có tên trùng nhau.

## Commands
- [ ] `npx tsc --noEmit` và `npx eslint "src/users/**/*.ts" src/common/phone.ts src/common/phone.spec.ts` → sạch → AC-1 đến AC-8
- [ ] `npm test` → toàn bộ qua, gồm `phone.spec.ts` (`toPhoneNeedle`), `list-users-query.dto.spec.ts`, `users.repository.spec.ts`, `users.service.spec.ts`, `users.mapper.spec.ts` và `route-declarations.spec.ts` (route mới khai báo đúng một kiểu quyền) → AC-1 đến AC-7
- [ ] `git status --short prisma/` → rỗng: không migration, không bảng, không cột, không chỉ mục mới → Decision
- [ ] Newman với folder 01, 03, 07, 08, 09 rồi 20 của `docs/api/postman-collection.json` trên database trống mới seed → không request hay assertion nào lỗi → AC-1 đến AC-8

## UI / manual (gọi API, Postman folder `20 Danh sách người dùng (admin)`)
Dựng sẵn: admin seed; chủ trọ L1 và người tìm trọ T1 (đăng ký thật); chèn tay bằng SQL các dòng `users`: chủ trọ `Nguyễn Văn Nam` (có số điện thoại), người tìm trọ `NGUYỄN THỊ HOA`, chủ trọ bị khóa `Trần Văn Khóa` kèm `locked_reason`, người tìm trọ không tên không số, người tìm trọ có tên `Giảm 100%_x\y`, một dòng đã xóa mềm, `Nguyen Khong Dau` (không dấu), một dòng có số `0984000111`, hai dòng cùng `created_at`, và hai admin phụ dùng chung mã băm mật khẩu với admin seed (một để khóa, một để xóa mềm).

AC-1, hình dạng và thứ tự:
- [ ] Admin `GET /users` → 200 `{ items, total, page, pageSize }`, `page` 1, `pageSize` 20; `total` bằng `SELECT count(*) ... WHERE deleted_at IS NULL`; `items` đúng thứ tự `created_at` giảm dần rồi `id` giảm dần của dòng thô → AC-1
- [ ] Mỗi phần tử đúng tám khóa (`accountType`, `createdAt`, `email`, `id`, `lockedReason`, `name`, `phone`, `status`); `createdAt` là chuỗi ISO → AC-1
- [ ] Có dòng loại `admin`, dòng bị khóa (với `lockedReason` là lý do đã chèn), dòng `name` và `phone` là `null`; dòng đã xóa mềm không hiện và không vào `total` → AC-1
- [ ] Lật hết trang với `pageSize=3` → ghép lại đúng danh sách thô, không lặp, không sót, `total` đúng ở mọi trang (có hai dòng cùng `created_at`, khóa phụ `id` giữ thứ tự) → AC-1
- [ ] `page=999` → 200, `items: []`, `total` đúng; `pageSize=50` được nhận; `pageSize=51` → 400 `VALIDATION_FAILED` trường `pageSize` → AC-1

AC-2, bộ lọc:
- [ ] `accountType=landlord`, `tenant`, `admin`; `status=locked`, `active`; từng cặp (`landlord` và `locked`, `tenant` và `active`) → `items` và `total` bằng phép lọc thô tương ứng; `landlord` và `locked` ra đúng một dòng → AC-2
- [ ] `accountType=root`, `accountType=ADMIN`, `status=x`, `status=deleted`, `sort=asc`, `landlordId=abc`, `status=active&status=locked` (lặp tham số), `accountType=admin&accountType=tenant` → mỗi cái 400 `VALIDATION_FAILED` đúng tên trường → AC-2

AC-3, tìm chữ:
- [ ] `q` là email đầy đủ, email viết hoa, một đoạn giữa email → ra đúng một tài khoản → AC-3
- [ ] `q=NGUYỄN` và `q=nguyễn` → cùng một tập (`Nguyễn Văn Nam` và `NGUYỄN THỊ HOA`); `q=nguyen` (không dấu) → chỉ `Nguyen Khong Dau`, không ra hai người có dấu; `q=Nguyễn Văn` (cả cụm) → chỉ Nam; `q` có khoảng trắng hai đầu được cắt → AC-3
- [ ] `q=%`, `q=_`, `q=\`, `q=100%_x\y` → chỉ ra dòng có đúng ký tự đó; `q=%%` → rỗng, không khớp mọi dòng → AC-3
- [ ] `q` toàn khoảng trắng và `q=` rỗng → `total` bằng danh sách không lọc → AC-3
- [ ] `q` dài 254 ký tự → 200; 255 ký tự → 400 trường `q`; 254 ký tự kèm khoảng trắng hai đầu → 200 (đếm sau khi cắt) → AC-3
- [ ] `q=Nguyễn` kết hợp `accountType=landlord` → chỉ Nam; kết hợp `accountType=tenant` → chỉ Hoa; `q=Trần` kết hợp `status=active` → không còn dòng (tài khoản khóa bị loại) → AC-2, AC-3

AC-4, số điện thoại:
- [ ] `q` là số đúng, số có khoảng trắng, có dấu chấm, có dấu gạch, nửa đầu của số → ra Nam → AC-4
- [ ] `q=+84...` (mã hóa `%2B`), `q=84...` (cộng 9 chữ số), `q=+84 xxx xxx xxx` có khoảng trắng → cùng ra Nam; `q=+84...` không mã hóa (máy chủ đọc `+` thành khoảng trắng rồi cắt) → vẫn ra đúng Nam → AC-4
- [ ] `q=84` → đúng tập dòng có chuỗi `84` ở email, tên hoặc số (có dòng `0984000111`), không bị đổi thành `0` → AC-4
- [ ] `q` có chữ cái (nửa đầu của số cộng `abc`) → không so với cột số điện thoại, không ra Nam → AC-4

AC-5, khóa rồi mở khóa bằng id lấy từ danh sách:
- [ ] Tìm Nam bằng email, lấy `id`, `POST /users/:id/lock` với `reason` → 200, phản hồi vẫn sáu trường; đọc lại danh sách → `status: "locked"` và `lockedReason` là lý do vừa nhập; `status=locked` thấy dòng đó ngay → AC-5
- [ ] `POST /users/:id/unlock` → 200; đọc lại → `status: "active"`, `lockedReason: null`; `status=locked` không còn dòng đó → AC-5

AC-6, không lộ bí mật:
- [ ] Mọi phản hồi 200 ở trên không chứa chuỗi `passwordHash`, `password_hash`, `argon2`, `passwordChangedAt`, `trialEndsAt`, `token`, `session` ở bất kỳ chỗ nào → AC-6

AC-7, phân quyền:
- [ ] Không token → 401 `TOKEN_MISSING`; token rác → 401 `TOKEN_INVALID` → AC-7
- [ ] `tenant` và `landlord` → 403 `PERMISSION_DENIED`, phản hồi không có `items` hay email; cả hai gửi `accountType=root&pageSize=999&sort=asc` vẫn 403, không phải 400 → AC-7
- [ ] Admin cấp `user:read` cho `landlord` qua `PATCH /account-types/landlord` → 400 `PERMISSION_ADMIN_ONLY`; `landlord` vẫn 403 sau đó → AC-7
- [ ] Admin phụ đăng nhập thật, `GET /users` → 200; admin chính khóa admin phụ; cùng token còn hạn → 403 `ACCOUNT_LOCKED` → AC-7
- [ ] Admin phụ thứ hai đăng nhập thật, `GET /users` → 200; đặt `deleted_at` bằng SQL; cùng token còn hạn → 401 `TOKEN_INVALID` → AC-7
- [ ] Các ca bị từ chối không chạy câu truy vấn danh sách: người gọi bị chặn ở guard quyền trước khi vào `UsersController.list` (cấu trúc, không có phép đo riêng) → AC-7

AC-8, không cache:
- [ ] Mọi 200, kể cả trang rỗng → header `Cache-Control: private, no-store` → AC-8

Từng dòng của bảng Value sourcing (mỗi giá trị có nguồn, đối chiếu với dòng thô):
- [ ] Những tài khoản nào có mặt: bằng đúng tập `deleted_at IS NULL` (so id từng dòng) → AC-1
- [ ] `id`, `email`, `name`, `phone`, `accountType`, `status`, `lockedReason`, `createdAt`: so từng trường với cột cùng tên của dòng thô → AC-1
- [ ] Thứ tự: `created_at` giảm dần rồi `id` giảm dần, kể cả hai dòng cùng `created_at` → AC-1
- [ ] `total`: bằng `count` độc lập với đúng bộ lọc và `q` → AC-1 đến AC-4
- [ ] `page`, `pageSize`: trả lại đúng giá trị query, mặc định 1 và 20 → AC-1
- [ ] Bộ lọc loại và trạng thái so với `account_type`, `status`; chuỗi so khớp email và tên là `q` đã cắt qua `escapeLike`; chuỗi so khớp số điện thoại suy ra từ `q` → AC-2 đến AC-4
- [ ] Người gọi có phải admin: admin phụ thứ ba đăng nhập thật (200), đổi `account_type` của họ sang `tenant` bằng SQL, gọi lại bằng token cũ → `@FreshAuth` đọc lại quyền từ database nên 403 `PERMISSION_DENIED` ngay → AC-7
- [ ] Header `Cache-Control`: hằng `private, no-store` → AC-8

## Điều khiển âm (bước kiểm thật, không phải test tự động)
Sửa tạm file build trong `dist/` (không đụng mã nguồn), chạy lại cả bộ kiểm, rồi dựng lại sạch.
- [ ] Bỏ `escapeLike` ở hai vế email và tên → kiểm tra `q=%`, `q=_`, `q=\`, `q=100%_x\y` và `q=%%` phải sai → AC-3
- [ ] Bỏ điều kiện xóa mềm khỏi `where` của danh sách → dòng đã xóa hiện ra, `total` lệch, lật trang lệch, các phép lọc lệch → AC-1
- [ ] Đổi `select` thành lấy mọi cột **và** cho mapper chép nguyên dòng → kiểm tra "đúng tám trường" và "không chứa passwordHash" phải sai → AC-6
- [ ] Chỉ đổi `select` thành lấy mọi cột (mapper vẫn là danh sách trắng) → phản hồi vẫn sạch (lớp chắn thứ hai), nhưng `users.repository.spec.ts` ("select liệt kê đúng tám cột và không có passwordHash") phải sai → AC-6

## EXPLAIN (đo một lần, không chỉnh)
- [ ] 50 nghìn người dùng trên database thử: đo trang đầu không lọc, `status=locked`, `q` khớp giữa email và `q` là số khớp giữa số điện thoại; ghi số vào mục dưới → AC-1, AC-3

## Acceptance-criteria coverage
- AC-1 … trang đầu, hình dạng, thứ tự, lật trang, trang quá cuối, `pageSize` · AC-2 … bộ lọc và tham số lạ · AC-3 … tìm chữ, hoa thường, dấu, `%_\`, độ dài `q` · AC-4 … số điện thoại, `+84`, `84` · AC-5 … khóa rồi mở khóa bằng id từ danh sách · AC-6 … quét chuỗi nhạy cảm, điều khiển âm `select` · AC-7 … khách, tenant, landlord, cấp quyền, admin bị khóa, admin bị xóa · AC-8 … `Cache-Control`

## Kết quả đã chạy 2026-10-21
- Kiểm thật bằng script gọi API và SQL: **108 kiểm tra, 0 sai**, trên database thử sạch đã migrate và seed, mỗi lần khởi động lại server.
- Điều khiển âm: bỏ `escapeLike` → 5 kiểm tra sai (`%`, `_`, `\`, `100%_x\y`, `%%`); bỏ điều kiện xóa mềm → 16 kiểm tra sai; `select` cùng mapper chép nguyên dòng → 5 kiểm tra sai (tám trường, `passwordHash`, `argon2`, `passwordChangedAt`, `trialEndsAt`); chỉ đổi `select` → 0 kiểm tra API sai (mapper chặn) và đúng một bài unit của Repository sai. Sau mỗi lần đã dựng lại sạch và chạy lại: đạt hết (số kiểm tra tăng dần từ 105 lên 108 khi bổ sung ca `+` không mã hóa và ca admin bị hạ loại).
- `npx tsc --noEmit` và ESLint sạch; `npm test`: 64 suite, 1145 bài qua.
- Newman folder 01, 03, 07, 08, 09, 20: 105 request, 209 assertion, không lỗi.
- Database thử có locale `English_United States.1252` và mã hóa `UTF8`; `ILIKE` gập đúng chữ Việt có dấu (`NGUYỄN` và `nguyễn` ra cùng một người). Database dùng khi đóng gói vẫn nên tạo với locale UTF-8 (xem Follow-up của spec).
- `EXPLAIN (ANALYZE, BUFFERS)` ở 50 001 người dùng (50 000 dòng sinh thêm: 10% chủ trọ, 2% bị khóa, mỗi dòng có số điện thoại riêng), một lần, không chỉnh:

| Truy vấn | Trang (thực thi) | Đếm (thực thi) | API, trung vị 5 lần | Kế hoạch |
|---|---|---|---|---|
| Trang đầu không lọc | 12.0 ms | 6.1 ms | 19 ms | quét bảng, sắp top N |
| `status=locked` (1000 dòng) | 6.4 ms | 5.4 ms | 10 ms | quét bảng, sắp top N |
| `q=bulk4217` (giữa email, 11 dòng) | 44.1 ms | 43.9 ms | 53 ms | quét bảng, sắp |
| `q=0004217` (giữa số điện thoại, 11 dòng) | 46.8 ms | 47.0 ms | 55 ms | quét bảng, sắp |

  Mọi truy vấn quét cả bảng như spec đã dự đoán; không cần chỉ mục `pg_trgm` ở quy mô này. Đây là bản demo nên không chỉnh.

## Ghi chú
- Ca admin bị hạ loại chỉ dựng được bằng SQL vì loại tài khoản không đổi sau khi tạo (spec 0003); API không có đường nào làm việc đó. Ba ca `@FreshAuth` (bị khóa, bị xóa mềm, bị hạ loại) đều đã chạy thật.
