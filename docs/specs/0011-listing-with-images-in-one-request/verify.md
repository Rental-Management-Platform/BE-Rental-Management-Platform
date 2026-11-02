# Verify: đăng tin kèm ảnh trong một lần gọi · spec 0011 · updated 2026-11-02
_Steps derived from spec 0011 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Cả hai mốc đã xong; các bước của mốc 2 (chặn xóa ảnh cuối, AC-7) nằm ở mục "AC-7" bên dưới. Chạy trên một database thử (đã dùng `rental_management_verify`), không chạy trên database đang dùng: dọn schema, rồi `npx prisma migrate deploy` và `node dist/database/seed.js` (sau `npm run build`), đặt `UPLOAD_DIR` sang một thư mục riêng để so thư mục ảnh trước và sau, đặt `PORT` riêng, khởi động lại server trước mỗi lần chạy (bộ đếm giới hạn tần suất nằm trong bộ nhớ; đăng ký tối đa 10 lần mỗi giờ theo IP). Trong mọi bước "không để lại gì" nghĩa là ba thứ cùng đúng: không dòng `listings` mới, không dòng `listing_images` mới, thư mục ảnh y như trước.

## Commands
- [ ] `npx tsc --noEmit` và `npx eslint "{src,apps,libs,test}/**/*.ts"` → sạch → AC-1 đến AC-9
- [ ] `npm test` → toàn bộ qua, gồm `new-listing-images.spec.ts`, `listing-dtos.spec.ts` (khối "số trong multipart"), `listings.service.spec.ts` (khối "ảnh trong cùng yêu cầu"), `property-listings.controller.spec.ts`, `multipart-files.interceptor.spec.ts`, `transaction-runner.spec.ts` → AC-1 đến AC-6, AC-8, AC-9
- [ ] `git status --short prisma/` → rỗng: không migration, không bảng, không cột mới → Decision
- [ ] Newman với mọi folder trừ 02, 06, 23, 24 của `docs/api/postman-collection.json` và `--working-dir docs/api`, trên database trống mới seed, hai lượt liền (khởi động lại server giữa hai lượt), rồi folder 23 riêng → không request hay assertion nào lỗi → AC-1 đến AC-6, AC-9

## UI / manual (gọi API, Postman folder `09 Tin đăng của chủ trọ` và `15 Ảnh tin`)

AC-1, đăng thành công:
- [ ] Chủ trọ còn hạn mức gửi form có `title`, `description`, `price`, `areaM2` và một ảnh PNG ở trường `images` → 201, `status` `visible`, `viewCount` 0, `code` 8 ký tự, `images` có một phần tử `position` 0, `coverImageUrl` bằng `url` của ảnh đó → AC-1
- [ ] Gửi năm ảnh trộn JPEG, PNG, WebP → 201, `position` 0 đến 4 đúng thứ tự gửi, đuôi `jpg`, `png`, `webp` theo nội dung, năm `url` khác nhau; mỗi tệp trên ổ đĩa có đúng byte đã gửi; cả năm mở được ở `GET /media/public/<tệp>` → AC-1
- [ ] `GET /listings/<slug>-<code>` và `GET /listings` thấy tin kèm ảnh bìa → AC-1
- [ ] Gửi ảnh JPEG đặt tên `readme.txt` với `Content-Type: text/plain` → vẫn nhận, đuôi tệp là `jpg` (khóa lưu trữ theo nội dung, không theo tên) → AC-1, AC-3

AC-3, ảnh sai (mỗi bước: không để lại gì):
- [ ] Bốn ảnh tốt cộng một tệp văn bản mang đuôi `.png` → 400 `IMAGE_INVALID`, `errors` đúng một dòng `images.4` (`notImage`) → AC-2, AC-3
- [ ] Hai ảnh sai ở vị trí 1 và 3 → `errors` có cả `images.1` và `images.3` → AC-3
- [ ] Không gửi ảnh → 400 `IMAGE_INVALID`, `errors` một dòng `images` (`imagesRequired`) → AC-3
- [ ] Gửi JSON hợp lệ (không multipart) → 400 `IMAGE_INVALID` → AC-3
- [ ] Ảnh ở trường `file`, `image`, `images[]` hoặc `Images` → 400 `IMAGE_INVALID`, `errors` một dòng `images.0` (`wrongField`), không có dòng `images` riêng → AC-3
- [ ] Sáu tệp → 400 `BAD_REQUEST` chung (không phải `IMAGE_INVALID`) → AC-3
- [ ] Một ảnh quá 5 MiB (kèm hai ảnh tốt) → 413 `PAYLOAD_TOO_LARGE` → AC-3
- [ ] GIF, RIFF không phải WebP, tệp rỗng → 400 `IMAGE_INVALID` tại `images.0` → AC-3
- [ ] Thân multipart bị cắt giữa tệp, thiếu ranh giới kết thúc, thiếu tham số `boundary`, thân rỗng → 400 `BAD_REQUEST`, cả ở đăng tin lẫn `POST /listings/:id/images`; client hủy kết nối giữa chừng → server vẫn sống và không để lại gì → AC-3, AC-9

AC-4, trường chữ và số:
- [ ] `price` là `100000.0` hoặc `0100000`, `areaM2` là `20.50` → 201 với `price` 100000 hoặc `areaM2` 20.5 → AC-4
- [ ] `price` là `abc`, `1e5`, `0x10`, ` 5`, rỗng, `99999`; `areaM2` là `20.55` hoặc rỗng; `deposit` rỗng hoặc `1e3`; `availableFrom` rỗng hoặc `2026-02-30`; trường lạ `status` hoặc `code`; `title` hoặc `price` gửi hai lần; `price[x]=1` → mỗi ca 400 `VALIDATION_FAILED` nêu đúng trường → AC-4
- [ ] `title` có khoảng trắng hai đầu → được cắt → AC-4

AC-5, thứ tự báo lỗi:
- [ ] `propertyId` không phải UUID kèm `price` sai → 400 `INVALID_ID`, không phải `VALIDATION_FAILED` → AC-5
- [ ] `propertyId` không phải UUID kèm ảnh quá dung lượng → 413 → AC-5
- [ ] Trường sai kèm không có ảnh → `VALIDATION_FAILED` đến trước `IMAGE_INVALID` → AC-5
- [ ] Nhà trọ của người khác hoặc không tồn tại, kèm ảnh sai → 400 `IMAGE_INVALID` (đến trước 403 và 404) → AC-5
- [ ] Nhà trọ của người khác kèm ảnh tốt → 403 `NOT_RESOURCE_OWNER`; nhà trọ không có → 404 `PROPERTY_NOT_FOUND`; admin đăng vào nhà trọ của chủ trọ → 403 `NOT_RESOURCE_OWNER`; mỗi ca không để lại gì → AC-5
- [ ] Người tìm trọ → 403 `PERMISSION_DENIED`; không đăng nhập → 401; mỗi ca không để lại gì → AC-5, AC-8

AC-6 và AC-2, hạn mức, đồng thời, tất cả hoặc không gì cả:
- [ ] Chủ trọ hết dùng thử (`trial_days` 0 lúc đăng ký) và chưa có gói → 403 `MEMBERSHIP_REQUIRED`, không để lại gì → AC-6
- [ ] Chủ trọ đủ hạn mức → 403 `LISTING_QUOTA_REACHED`, không để lại gì → AC-6
- [ ] Còn đúng một chỗ, sáu yêu cầu đồng thời, mỗi yêu cầu hai ảnh → đúng một 201 và năm 403 `LISTING_QUOTA_REACHED`; thư mục ảnh chỉ thêm đúng hai tệp của yêu cầu thắng; database thêm đúng một tin và hai dòng ảnh → AC-2, AC-6
- [ ] Gây lỗi ghi tệp thứ ba (bốn ảnh) → ném lại lỗi gốc, không tin, không dòng ảnh, hai tệp đã ghi bị xóa → AC-2
- [ ] Gây lỗi ở bước commit khi tin không lưu (callback xong rồi ném lỗi trong giao dịch) → không tin, không dòng ảnh, ba tệp bị xóa → AC-2
- [ ] Gây lỗi báo sau commit khi tin đã lưu → yêu cầu coi như thành công, tin, ba dòng ảnh và ba tệp được giữ → AC-2
- [ ] Gây lỗi đọc lại tin sau commit → tin, dòng ảnh và tệp còn nguyên (không xóa ảnh của tin đã lưu) → AC-2
- [ ] Ép trùng mã tin ở lần thử đầu → thử lại, thành công, mã thật khác mã trùng, thư mục chỉ thêm đúng số tệp của ảnh; ép trùng cả 5 lần → 500 `INTERNAL_ERROR`, không tệp → AC-6
- [ ] Làm chậm tệp đầu quá 15 giây → yêu cầu lỗi sau khoảng 16 giây (Prisma chờ hàm gọi lại xong rồi mới báo giao dịch hết hạn lúc commit), mọi tệp đã ghi bị xóa, không tin → AC-2

AC-8, giới hạn tần suất:
- [ ] Một chủ trọ gửi 60 yêu cầu đăng tin (kể cả bị từ chối) rồi yêu cầu thứ 61 → 429 `RATE_LIMITED` kèm `Retry-After` là số giây; chủ trọ khác vẫn đăng được → AC-8

AC-7, chặn xóa ảnh cuối (mốc 2; Postman folder `15 Ảnh tin`, cuối folder):
- [ ] Tin có 3 ảnh, xóa ảnh bìa → 204; tệp của ảnh đó biến khỏi ổ đĩa; database còn 2 dòng; ảnh nhỏ nhất còn lại thành `coverImageUrl` → AC-7
- [ ] Xóa tiếp khi còn 2 ảnh → 204, tin còn đúng một ảnh → AC-7
- [ ] Xóa ảnh cuối → 409 `LISTING_IMAGE_REQUIRED` với câu "Tin phải còn ít nhất một ảnh. Hãy tải ảnh mới lên trước rồi mới xóa ảnh này."; dòng ảnh và tệp còn nguyên, không thêm bớt tệp, tin, dòng ảnh nào; ảnh vẫn mở được ở `GET /media/public/<tệp>` → AC-7
- [ ] Thay ảnh duy nhất: tải ảnh mới (`POST /listings/:id/images`, nhận `position` 0), rồi xóa ảnh cũ → 204; tin còn đúng ảnh mới và nó là ảnh bìa; xóa tiếp ảnh mới → 409 → AC-7
- [ ] Hai lần xóa đồng thời hai ảnh của tin có đúng 2 ảnh, lặp nhiều vòng (đã chạy 12 vòng) → mỗi vòng đúng một 204 và một 409, tin còn đúng 1 dòng ảnh và 1 tệp, không vòng nào còn 0 ảnh → AC-7
- [ ] Hai lần xóa đồng thời cùng một ảnh của tin có 3 ảnh → một 204 và một 404 `NOT_FOUND`, tin còn 2 dòng, tệp của ảnh bị xóa mất, hai tệp kia còn → AC-7
- [ ] Ba lần xóa đồng thời ba ảnh của tin có 3 ảnh → hai 204 và một 409, tin còn 1 ảnh → AC-7
- [ ] Thứ tự lỗi: chủ trọ khác (và admin) xóa ảnh cuối của tin người ta → 403 `NOT_RESOURCE_OWNER` (không phải 409); tin không có → 404 `LISTING_NOT_FOUND`; tin đã xóa mềm → 404 `LISTING_NOT_FOUND`; `imageId` không có hoặc của tin khác trên tin chỉ có 1 ảnh → 404 `NOT_FOUND` (không phải 409); id không phải UUID → 400 `INVALID_ID`; người tìm trọ → 403 `PERMISSION_DENIED`; không đăng nhập → 401 → AC-7
- [ ] Tin đang ẩn: còn 2 ảnh xóa được một, ảnh cuối vẫn 409 → AC-7
- [ ] Tin cũ chưa có ảnh nào (xóa các dòng ảnh bằng SQL để dựng): xóa một `imageId` bất kỳ → 404 `NOT_FOUND` (không phải 409); `POST /listings/:id/images` vẫn thêm được (`position` 0), rồi xóa ảnh đó → 409 → AC-7, AC-9
- [ ] Điều khiển âm: bỏ `lockListing` trong `ListingImagesService.remove` (sửa tệp biên dịch ở `dist/`, sao lưu trước rồi trả lại) rồi chạy lại hai ảnh đồng thời → phép kiểm phải hỏng (hai 204, tin còn 0 ảnh); trả lại rồi chạy lại phải qua → AC-7

AC-9, không đổi:
- [ ] `POST /listings/:id/images` (trường `file`) thêm ảnh vào tin vừa đăng → 201 `position` 1; `PATCH /listings/:id` JSON, `hide`, `show`, `DELETE /listings/:id/images/:imageId` (khi còn từ 2 ảnh), `GET /me/listings` vẫn chạy → AC-9
- [ ] `npm run seed:demo` chạy hai lần liền không lỗi; một tin demo cũ chưa có ảnh: chủ tin đọc được qua `GET /me/listings/:id` (`images` rỗng, `coverImageUrl` `null`) và thêm ảnh được qua `POST /listings/:id/images` (`position` 0) → AC-9

Mỗi dòng của bảng nguồn giá trị (spec, "Value sourcing"), kiểm biên của nguồn:
- [ ] Số từ chuỗi (`FormNumber`): `deposit=` rỗng không thành 0 đồng, `1e5` không thành 100000 (xem AC-4 ở trên) → AC-4
- [ ] `storage_key`: sinh một lần trước vòng thử lại, đuôi theo nội dung; cùng một khóa ở dòng ảnh và tệp trên ổ đĩa sau khi thử lại trùng mã → AC-1, AC-6
- [ ] `position` theo chỉ số tệp: đổi thứ tự `append` thì đổi `position` và ảnh bìa theo → AC-1
- [ ] Chỉ số `N` trong `images.N`: chèn tệp sai ở các vị trí khác nhau, `N` luôn là thứ tự tệp trong form đếm từ 0 → AC-3
- [ ] `now` cho cửa hạn mức do controller lấy một lần: chủ trọ đúng lúc hết dùng thử (`trial_days` 0) bị chặn → AC-6
- [ ] `images[]` và `coverImageUrl` trong phản hồi: đọc lại sau commit, khớp dòng `listing_images` trong database → AC-1
- [ ] Xóa ảnh, "ảnh có còn không, số ảnh còn lại" đọc trong giao dịch sau khi khóa dòng tin: hai lần xóa đồng thời không cùng thấy "còn hai" (xem bước hai ảnh đồng thời ở AC-7 và điều khiển âm bỏ khóa) → AC-7

## Acceptance-criteria coverage
- AC-1 … đăng tin kèm 1 và 5 ảnh, byte đúng, công khai · AC-2 … lỗi ghi tệp, lỗi commit, commit báo lỗi mà tin đã lưu, đồng thời, hết hạn giao dịch · AC-3 … mọi ca ảnh sai, tệp quá lớn, multipart hỏng · AC-4 … số dạng chuỗi và trường sai · AC-5 … thứ tự lỗi · AC-6 … hạn mức, trùng mã · AC-8 … quyền và 429 · AC-9 … các đường không đổi, seed demo, tin cũ chưa có ảnh
- AC-7 … xóa tuần tự đến ảnh cuối, thay ảnh duy nhất, ba ca đồng thời, thứ tự lỗi, tin ẩn, tin xóa mềm, tin cũ 0 ảnh, điều khiển âm bỏ khóa

## Kết quả đã chạy 2026-11-02 (mốc 1)
- **114 kiểm tra HTTP và database** (script `verify.js`) trên server cổng 3055: gồm 6 yêu cầu đồng thời khi còn một chỗ và 61 lần gọi cho giới hạn 429; log server không có lỗi 5xx. **25 kiểm tra gây lỗi thật bên trong Service** (script `inject.js`, nạp `dist/` và thay `StorageService.put`, `TransactionRunner.run`, `findOwnerDetail`, `generateListingCode` trên chính database thử). **7 kiểm tra** `seed:demo` hai lần và tin cũ chưa có ảnh (script `legacy.js`). Tất cả 0 sai.
- **Ba điều khiển âm đều bị bắt**: bỏ bước dọn tệp làm thư mục ảnh thừa 2, 3 và 3 tệp ở ba tình huống; để `Number('')` đi qua làm `deposit` rỗng và `price=1e5` được nhận (201) thay vì 400; ghi tệp trước cửa hạn mức làm 8 bài unit hỏng.
- Unit: 1522 bài (78 bộ), `tsc` và `eslint` sạch. Newman folder 00, 01, 03, 04, 05, 07 đến 22 (bỏ 02 và 06): 573 request, 1222 assertion, 0 lỗi, hai lượt liền (khởi động lại server giữa hai lượt, cùng một database); folder 23: 38 request, 75 assertion, 0 lỗi. Lần chạy đầu trên bộ Postman chưa sửa assertion có 11 assertion hỏng (folder 09 và 15, đều do tin mới giờ có sẵn ảnh), chứng tỏ bộ kiểm bắt được thay đổi.

## Kết quả đã chạy 2026-11-02 (mốc 2)
- **46 kiểm tra HTTP và database** (script `verify-m2.js`) trên server cổng 3055 và database thử vừa dựng lại: xóa tuần tự 3 ảnh xuống 1 rồi bị chặn (so tệp trên ổ đĩa và dòng database), thay ảnh duy nhất, ba ca đồng thời mỗi ca 12 vòng (hai ảnh của tin có 2 ảnh, cùng một ảnh hai lần, ba ảnh cùng lúc), thứ tự lỗi, tin ẩn, tin xóa mềm, tin cũ chưa có ảnh. 0 sai; log server không có lỗi 5xx.
- **Điều khiển âm đã bắt**: bỏ `lockListing` khỏi `remove` ở tệp biên dịch (sao lưu rồi trả lại) thì 25 trên 30 vòng hai ảnh đồng thời ra hai 204 và để tin còn 0 ảnh, phép kiểm hỏng đúng chỗ; trả lại thì 46 trên 46 qua.
- Unit: 1529 bài (78 bộ), `tsc` và `eslint` sạch, không file nào đổi trong `prisma/`. Newman folder 00, 01, 03, 04, 05, 07 đến 22 (bỏ 02 và 06): 583 request, 1241 assertion, 0 lỗi, hai lượt liền (khởi động lại server giữa hai lượt, cùng một database); folder 23: 38 request, 75 assertion, 0 lỗi. So với mốc 1: thêm 10 request và 19 assertion ở folder 15.

## Ghi chú
- Mốc 2: script kiểm `verify-m2.js` nằm ở thư mục tạm của phiên (không có trong repo), dựng lại từ `helpers` của `verify.js` mốc 1. Chạy tối đa khoảng 12 vòng mỗi ca vì tin đăng bị giới hạn 60 lần mỗi giờ theo người (30 vòng làm hết hạn mức: 429).
- Các script kiểm nằm ở thư mục tạm của phiên làm việc (không có trong repo). Làm lại theo các bước trên khi cần. Bản Newman cũ ở các thư mục tạm trước đã hỏng (thiếu `package.json`); cài lại bằng `npm install newman@6.2.1`.
- **Lệch spec thứ nhất**: spec viết "Nest chạy pipe theo thứ tự tham số nên `INVALID_ID` rồi `VALIDATION_FAILED`". Kiểm thật cho thấy sai: Nest giải các tham số của handler song song (`Promise.all`), lỗi nào xong trước thì thắng, và đã đo được `VALIDATION_FAILED` thắng. Để AC-5 đúng thật, build thêm `RejectInvalidUuidParam('propertyId')` (interceptor chạy sau bước đọc multipart, trước mọi pipe); test có đối chứng bỏ nó thì ra `VALIDATION_FAILED`.
- **Lệch spec thứ hai**: spec viết `@UseInterceptors(MultipartErrorInterceptor, AnyFilesInterceptor())` với interceptor đứng ngoài. Interceptor đứng ngoài bắt cả lỗi ném từ handler (lỗi database biến 500 thành 400, trái AC-9). Build `MultipartFilesInterceptor` là lớp con của `AnyFilesInterceptor` chỉ bắt lỗi của bước đọc multipart. Thêm nữa, với bản Nest đang cài mọi thân multipart hỏng đã thử đều ra 400 `BAD_REQUEST` ngay cả khi không có interceptor này, nên "multipart hỏng là 500" của spec không tái hiện được; interceptor chỉ là lớp phòng thủ.
- **Giả định sai của chính build, đã gỡ**: lúc đầu thêm cờ `abandoned` để tự xóa tệp ghi dở khi giao dịch hết hạn (cho rằng Prisma báo lỗi ngay ở giây 15 mà không hủy hàm gọi lại). Kiểm thật cho thấy Prisma chờ hàm gọi lại xong rồi mới báo lỗi lúc commit (lỗi ở giây 16, cả ba tệp đã ghi), nên bước dọn luôn thấy đủ tệp và cờ đó là mã thừa; đã gỡ cùng test của nó.
- **Quyết định nhỏ của build**: nếu lỗi ở bước commit và cũng không hỏi lại được database để biết tin đã lưu chưa, giữ nguyên các tệp (tệp mồ côi vô hại hơn tin hiện ra với ảnh hỏng) và ghi log khóa các tệp để dọn tay. Spec chưa nói ca này.
- Việc còn lại cho `/architect` và `/sync` (xem Follow-up của spec): sửa dòng "pipe theo thứ tự tham số" và đoạn hai interceptor trong spec cho khớp code, rà các spec còn nhắc đăng tin bằng JSON (0002 AC-5 và bảng API, 0003 nếu có ví dụ).
