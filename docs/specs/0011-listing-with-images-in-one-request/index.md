# 0011. Đăng tin kèm ảnh trong một lần gọi

**Date**: 2026-11-02
**Status**: In Progress

## Summary

Hiện chủ trọ phải đăng tin trước (JSON), rồi vào sửa để tải từng ảnh một, nên tin hiện ra khi chưa có ảnh và có thể ở lại như vậy nếu bước ảnh hỏng. Spec này đổi chính `POST /properties/:propertyId/listings` sang `multipart/form-data` (dạng gửi biểu mẫu có kèm tệp): các trường của tin cộng từ 1 đến 5 ảnh trong một lần gọi, và tất cả hoặc không gì cả: một ảnh lỗi, hết hạn mức hay lỗi ghi tệp thì không có tin, không có dòng ảnh, không còn tệp trên ổ đĩa. Đường JSON cũ bỏ hẳn để luật "bắt buộc ảnh" không đi vòng được, và để luật đó giữ mãi thì xóa ảnh cuối cùng của một tin cũng bị chặn (409 `LISTING_IMAGE_REQUIRED`). Không bảng mới, không migration, không biến môi trường mới.

## Requirements

**User stories**:
- Là chủ trọ, tôi muốn chọn ảnh ngay trong biểu mẫu đăng tin và bấm đăng một lần, để không phải đăng xong rồi vào sửa tin để thêm ảnh.
- Là chủ trọ, tôi muốn nếu một ảnh sai thì cả bài chưa được đăng và tôi biết ảnh nào sai, để không có tin nửa vời hiện ra với khách.
- Là người tìm trọ, tôi muốn tin nào mới đăng cũng có ảnh, để có gì mà xem.

**Acceptance criteria** (hợp đồng build, mỗi điều kiểm được riêng):
- **AC-1**: `POST /properties/:propertyId/listings` nhận `multipart/form-data` với `title`, `description`, `price`, `areaM2` (bắt buộc), `deposit`, `availableFrom` (tùy chọn, không có thì bỏ hẳn trường) và từ 1 đến 5 tệp ở trường `images` (lặp lại). Thành công: 201 với "Tin của chủ trọ" (spec 0002) có `status` `visible`, `viewCount` 0, `code` ngắn, `images[]` theo `position` 0, 1, 2… đúng thứ tự tệp được gửi, và `coverImageUrl` là `url` của ảnh đầu. Mỗi ảnh có đúng một dòng `listing_images` và một tệp trên ổ đĩa có đúng các byte đã gửi. Tin và ảnh hiện công khai theo đúng luật hiển thị của spec 0002 và 0003 (không luật riêng).
- **AC-2**: Tất cả hoặc không gì cả. Mọi lỗi (một ảnh sai, trường sai, nhà trọ không có hay không phải của mình, hết dùng thử, đủ hạn mức, lỗi ghi một tệp, lỗi lúc commit mà tin thực ra chưa lưu) đều không để lại dòng `listings`, dòng `listing_images` hay tệp ảnh nào. Hai yêu cầu cùng lúc khi chỉ còn một chỗ: đúng một yêu cầu thành công, yêu cầu kia 403 `LISTING_QUOTA_REACHED` và không để lại tệp. Nếu commit báo lỗi nhưng tin thực ra đã lưu (mất kết nối đúng lúc COMMIT), tin và ảnh được giữ nguyên và yêu cầu coi như thành công.
- **AC-3**: Ảnh: bắt buộc từ 1 đến 5 tệp, tên trường `images`, loại JPEG, PNG hoặc WebP nhận ra bằng nội dung tệp (tên tệp và `Content-Type` không được tin), mỗi tệp tối đa `MAX_UPLOAD_BYTES`. Thiếu ảnh, tệp sai loại hoặc sai tên trường thì 400 `IMAGE_INVALID` kèm `errors` liệt kê **mọi** ảnh sai (`field` là `images.N`, N đếm từ 0 theo thứ tự tệp trong yêu cầu). `field` là `images` chỉ khi yêu cầu không có tệp nào; có tệp mà không tệp nào ở trường `images` thì mỗi tệp một lỗi `images.N` và không có mục `images` riêng. Tên trường phải đúng `images`: `images[]`, `image`, `file` đều là sai tên trường (ghi rõ ở tài liệu FE). Một ảnh quá dung lượng thì 413 `PAYLOAD_TOO_LARGE`; gửi hơn 5 tệp thì 400 `BAD_REQUEST` chung từ multer, như `POST /listings/:id/images` đã ghi (FE chặn ở 5). Multipart hỏng (thiếu ranh giới, thân bị cắt, client hủy giữa chừng) cũng là 400 `BAD_REQUEST`, không phải 500, ở cả đường này và `POST /listings/:id/images`. Yêu cầu JSON, hoặc multipart không có tệp nào, mà các trường chữ và số hợp lệ cũng nhận 400 `IMAGE_INVALID` (trường sai thì `VALIDATION_FAILED` đến trước, xem AC-5); không còn cách đăng tin không ảnh qua API. Tên tệp trên ổ đĩa do server sinh, không đến từ client.
- **AC-4**: Các trường chữ và số giữ nguyên luật của spec 0002 (tiêu đề 5 đến 120, mô tả 10 đến 5000, giá nguyên từ 100000 đến 100000000, diện tích 1 đến 1000 một chữ số thập phân, cọc nguyên từ 0 đến 1000000000, ngày `YYYY-MM-DD`). Trong multipart số đến dạng chuỗi: chỉ chuỗi số thập phân thường (chữ số, có thể một dấu chấm) được nhận; `1e5`, `0x10`, chuỗi có khoảng trắng hay chuỗi rỗng là 400 `VALIDATION_FAILED` (rỗng không bao giờ thành 0). `100000.0`, `0100000` (số 0 đứng đầu) và `20.50` được nhận vì giá trị sau khi đổi vẫn hợp lệ. Trường tùy chọn để trống (chuỗi rỗng) cũng 400. Trường lạ, hoặc một trường lặp lại hai lần, là 400 `VALIDATION_FAILED`.
- **AC-5**: Thứ tự báo lỗi: 401 → 403 `PERMISSION_DENIED` → 429 `RATE_LIMITED` (ba guard toàn cục chạy đúng thứ tự đó, đều trước multer) → 413 hoặc 400 `BAD_REQUEST` (multer) → 400 `INVALID_ID` → 400 `VALIDATION_FAILED` (trường chữ và số) → 400 `IMAGE_INVALID` (hình dạng yêu cầu, chưa chạm database) → 404 `PROPERTY_NOT_FOUND` → 403 `NOT_RESOURCE_OWNER` → 403 `MEMBERSHIP_REQUIRED` → 403 `LISTING_QUOTA_REACHED`. Yêu cầu bị từ chối ở bước nào cũng không ghi tệp nào trước khi qua hai cửa cuối. Thứ tự `INVALID_ID` rồi `VALIDATION_FAILED` chỉ đúng vì Nest chạy pipe theo thứ tự tham số, nên handler khai báo `@CurrentUser()`, `@Param('propertyId', uuidParam())`, `@Body()`, `@UploadedFiles()` đúng thứ tự đó (có test: UUID sai kèm body sai ra `INVALID_ID`).
- **AC-6**: Cửa hạn mức và khóa của spec 0003 giữ nguyên: hết dùng thử và chưa có gói thì 403 `MEMBERSHIP_REQUIRED`; số tin đang hiện đã bằng hạn mức thì 403 `LISTING_QUOTA_REACHED`; khóa dòng `users` rồi dòng `properties` trong cùng giao dịch với việc chèn tin và ảnh nên hai yêu cầu đồng thời không vượt hạn mức. Gặp trùng mã tin thì thử lại tối đa 5 lần như trước và lần thử lại không để tệp nào trên ổ đĩa.
- **AC-7**: `DELETE /listings/:id/images/:imageId` không xóa ảnh cuối cùng của tin: tin chỉ còn một ảnh thì 409 `LISTING_IMAGE_REQUIRED`, dòng ảnh và tệp còn nguyên. Tin còn từ 2 ảnh trở lên xóa như cũ (204, ảnh nhỏ nhất còn lại thành ảnh bìa). Hai lần xóa đồng thời hai ảnh của tin có đúng 2 ảnh: đúng một lần 204, lần kia 409. Hai lần xóa cùng một ảnh: một lần 204, lần kia 404 `NOT_FOUND`. Thứ tự lỗi: 404 `LISTING_NOT_FOUND` hoặc 403 → 404 `NOT_FOUND` (ảnh không có) → 409. Tin cũ chưa có ảnh nào không bị đụng.
- **AC-8**: Quyền vẫn là `listing:create` (người tìm trọ bị 403 `PERMISSION_DENIED` trước khi multer đọc tệp). Giới hạn tần suất vẫn là nhóm `listingWrite` (60 lần mỗi giờ theo người dùng); vượt thì 429 `RATE_LIMITED` kèm `Retry-After`. Không nhóm giới hạn mới.
- **AC-9**: Không đổi gì ngoài các điểm trên (kể cả multipart hỏng ở `POST /listings/:id/images` nay là 400 thay vì 500): `POST /listings/:id/images` (vẫn tải từng ảnh, vẫn thêm được cho tin đã đăng kể cả tin cũ chưa có ảnh), `PATCH /listings/:id` (JSON), ẩn, hiện, xóa tin, `GET` của tin và `GET /media/public/:file` giữ nguyên hình dạng và hành vi. Dữ liệu demo và tin cũ chưa có ảnh vẫn đọc bình thường.

## Decision

**Chosen option**: Option 1: Đổi chính đường đăng tin sang `multipart/form-data` kèm ảnh, ghi tin, dòng ảnh và tệp trong một giao dịch có dọn tệp khi lỗi

Đường `POST /properties/:propertyId/listings` chỉ còn nhận multipart; Service kiểm hình dạng ảnh trước khi chạm database, rồi trong một giao dịch qua cửa hạn mức, chèn tin, chèn các dòng ảnh và ghi các tệp; lỗi ở bất kỳ bước nào kể cả commit thì xóa mọi tệp đã thử ghi. Xóa ảnh chuyển vào một giao dịch có khóa dòng tin để chặn xóa ảnh cuối.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`) · `prisma-client-api` (`prisma/skills`, `.agents/skills/prisma-client-api/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`)

## Feature design

Quy ước chung theo 0001 đến 0010: Repository bọc Prisma, giao dịch qua `TransactionRunner`, lỗi qua `AppException`, tên cột `snake_case`.

**Data model**: không có bảng, cột hay migration mới. `listing_images` đã có đủ: `position` `CHECK` 0 đến 4, `UNIQUE (listing_id, position)`, `storage_key` duy nhất (spec 0002). `schema.prisma` không đổi. "Tin phải có ảnh" là luật của API, không phải ràng buộc DB, vì tin cũ chưa có ảnh vẫn tồn tại.

**State transitions**: không đổi. Tin sinh ra `visible` như trước.

**API surface** (tiền tố `/api/v1`):

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/properties/:propertyId/listings` | POST | `multipart/form-data`: `title`, `description`, `price`, `areaM2` (req); `deposit`, `availableFrom` (opt, bỏ hẳn trường nếu không có); `images` (1 đến 5 tệp, lặp lại) | 201 "Tin của chủ trọ" (có `images[]` và `coverImageUrl`) | `listing:create` | 400 `VALIDATION_FAILED`, 400 `IMAGE_INVALID`, 400 `BAD_REQUEST` (hơn 5 tệp), 400 `INVALID_ID`, 413 `PAYLOAD_TOO_LARGE`, 404 `PROPERTY_NOT_FOUND`, 403 `NOT_RESOURCE_OWNER`, 403 `MEMBERSHIP_REQUIRED`, 403 `LISTING_QUOTA_REACHED`, 429 |
| `/listings/:id/images/:imageId` | DELETE | | 204 | `listing:update` | 404 `LISTING_NOT_FOUND`, 403 `NOT_RESOURCE_OWNER`, 404 `NOT_FOUND`, 409 `LISTING_IMAGE_REQUIRED`, 400 `INVALID_ID` |

Mã lỗi mới (thêm vào `ErrorCode`, kèm câu tiếng Việt, theo 0004):

| Mã | Status | Khi nào |
|---|---|---|
| `LISTING_IMAGE_REQUIRED` | 409 | Xóa ảnh cuối cùng của tin. Câu: "Tin phải còn ít nhất một ảnh. Hãy tải ảnh mới lên trước rồi mới xóa ảnh này." |

Ví dụ cho FE (bản đầy đủ nằm ở `api-for-frontend.md`):

```ts
const form = new FormData();
form.append('title', title);
form.append('description', description);
form.append('price', String(price));
form.append('areaM2', String(areaM2));
if (deposit !== null) form.append('deposit', String(deposit)); // để trống thì đừng append
for (const file of files) form.append('images', file); // ảnh đầu là ảnh bìa
await fetch(`${API}/properties/${propertyId}/listings`, {
	method: 'POST',
	headers: { Authorization: `Bearer ${accessToken}` }, // đừng tự đặt Content-Type
	body: form,
});
```

**Value sourcing** (mọi giá trị mỗi hành động tạo ra hoặc hiển thị đều có nguồn):

| Hành động | Giá trị | Nguồn |
|---|---|---|
| Đăng tin | `title`, `description`, `price`, `areaM2`, `deposit`, `availableFrom` | trường chữ của multipart qua `CreateListingDto`; số đổi từ chuỗi bằng biến đổi `FormNumber` (chỉ chuỗi số thập phân thường) |
| Đăng tin | `property_id`, chủ nhà trọ, `status`, `code`, `search_key` | như spec 0002: đường dẫn `:propertyId` kiểm bằng `assertOwner`; `visible` cố định; mã sinh ở Service; `toSearchKey(...)` |
| Đăng tin | các ảnh cần ghi | `UploadedFiles` của multer (bộ nhớ tạm), mỗi tệp `fieldname` và `buffer` |
| Đăng tin | loại ảnh và đuôi tệp | `detectImageType(buffer)` (chữ ký đầu tệp), không từ tên tệp |
| Đăng tin | `storage_key` mỗi ảnh | `public/<uuid v4>.<jpg|png|webp>` do server sinh một lần cho mỗi ảnh trước vòng thử lại |
| Đăng tin | `position` mỗi ảnh | chỉ số của ảnh trong các tệp ở trường `images`, theo thứ tự đến (0 là ảnh bìa); không cần tìm chỗ trống vì tin mới chưa có ảnh nào |
| Đăng tin | chỉ số `N` trong `images.N` của lỗi | thứ tự tệp trong yêu cầu, đếm mọi tệp từ 0 |
| Đăng tin | hạn mức, `now` | như spec 0003: `MembershipsService.resolve(landlordId, now, tx)`; `now` do controller lấy một lần |
| Đăng tin | dung lượng tối đa mỗi ảnh, số tệp tối đa | `MAX_UPLOAD_BYTES` và hằng 5 của `MulterModule` (có sẵn) |
| Đăng tin | thời hạn giao dịch | hằng số trong code: `timeout` 15000 ms, `maxWait` 5000 ms, truyền qua tham số tùy chọn của `TransactionRunner.run` |
| Đăng tin | `images[]`, `coverImageUrl` trong phản hồi | `readOwner` đọc lại sau commit; `url` ghép từ `storage_key` như mọi nơi |
| Xóa ảnh | ảnh có còn không, số ảnh còn lại | đọc trong giao dịch sau khi khóa dòng tin (`lockListing`), không đọc trước |

**Cách chạy** (đặt đúng thứ tự này, đây là chỗ dễ sai):
1. Controller: `@UseInterceptors(MultipartErrorInterceptor, AnyFilesInterceptor())`. Interceptor ngoài đứng trước và đổi lỗi không phải `HttpException` do bộ đọc multipart ném ra (thiếu ranh giới, thân bị cắt) thành `AppException(BAD_REQUEST)`; nó gắn cả vào `POST /listings/:id/images`. `AnyFilesInterceptor` như đường tải ảnh lẻ, dùng cấu hình `MulterModule` đã có trong `ListingsModule`. `ValidationPipe` kiểm các trường chữ và số.
2. Service, **trước giao dịch**: hàm thuần `prepareListingImages(files)` kiểm hình dạng (1 đến 5 tệp, đúng tên trường `images`, đúng loại bằng nội dung), gom lỗi của mọi ảnh vào một `IMAGE_INVALID`, rồi sinh `storage_key` mỗi ảnh. Mỗi lỗi có `code` và `message` cố định: `imagesRequired` ("Cần gửi từ 1 đến 5 ảnh ở trường images."), `wrongField` ("Ảnh phải gửi ở trường images."), `notImage` ("Chỉ nhận ảnh JPEG, PNG hoặc WebP."), `tooManyImages` ("Chỉ được gửi tối đa 5 ảnh."). Chưa chạm database hay ổ đĩa.
3. Service, **trong một giao dịch** (đặt `timeout` 15000 ms và `maxWait` 5000 ms, vì mặc định 5 giây và 2 giây không đủ khi phải chờ khóa và ghi tệp; vòng thử lại trùng mã bọc ngoài như cũ): khóa `users`, khóa `properties`, `assertOwner`, cửa hạn mức, chèn tin, `createMany` các dòng ảnh, **cuối cùng** ghi các tệp, từng tệp một theo thứ tự và chờ xong mới ghi tệp kế (không ghi song song, để khi một tệp lỗi và đến bước dọn thì không còn tệp nào đang ghi dở rồi hoàn tất sau). Tệp ghi sau khi mọi cửa đã qua nên yêu cầu bị từ chối không ghi gì; lỗi trùng mã xảy ra ở bước chèn tin, trước mọi lần ghi, nên lần thử lại không để tệp.
4. Dọn tệp: một cờ `startedWriting` đặt ngay trước tệp đầu tiên; bọc **cả vòng thử lại, gồm commit**, trong `try/catch`: có lỗi mà cờ đã bật thì xóa mọi `storage_key` của lần đăng (xóa tệp không có sẵn là không lỗi; lỗi xóa chỉ ghi log). Ngoại lệ cho lỗi ở bước commit (hàm gọi lại của giao dịch đã chạy xong và trả `id`, nhưng `$transaction` vẫn ném lỗi, ví dụ mất kết nối đúng lúc COMMIT): trước khi xóa, dùng một truy vấn mới ngoài giao dịch xem tin có `id` đó còn không; còn thì COMMIT đã thành công, giữ tệp và đi tiếp đọc lại tin; không còn mới xóa tệp. Đọc lại `readOwner` nằm **ngoài** phạm vi dọn, để lỗi đọc sau commit không xóa ảnh của tin đã lưu.
5. Xóa ảnh: kiểm chủ như cũ, rồi một giao dịch: `lockListing` (không còn thì `LISTING_NOT_FOUND`) → đọc ảnh còn trong tin (không có thì 404 `NOT_FOUND`) → đếm ảnh (còn một thì 409 `LISTING_IMAGE_REQUIRED`) → xóa dòng. Sau commit mới xóa tệp, lỗi xóa tệp chỉ ghi log như cũ.

**Key invariants**:
- Tin sinh qua API có từ 1 đến 5 ảnh ngay lúc commit, `position` liền từ 0, đúng thứ tự gửi. Qua API không thể đưa tin về 0 ảnh bằng xóa ảnh (xóa cả tin là chuyện khác).
- Không bao giờ có tin hiện ra mà ảnh chưa ghi xong: dòng ảnh và tệp cùng có trước commit.
- Mọi tệp của một lần đăng thất bại bị xóa (trừ khi tiến trình chết đúng giữa ghi tệp và commit; chấp nhận như spec 0002).
- Khóa lưu trữ do server sinh, khớp `STORAGE_KEY_PATTERN`; không có đường dẫn tệp nào đến từ dữ liệu người dùng.
- Thứ tự khóa `users` → `properties` → `listings` (spec 0003) không đổi; đăng tin không cần khóa dòng `listings` vì dòng đó chưa ai thấy; xóa ảnh chỉ khóa `listings`.
- Luật hiển thị công khai (`visibleListingsQuery` và các mảnh SQL) không đổi một dòng.

**Security model**:
- Đăng tin: quyền `listing:create`, chỉ vào nhà trọ của mình (`NOT_RESOURCE_OWNER`); admin cũng bị kiểm chủ nên không đăng thay người khác. Người tìm trọ bị chặn ở guard trước khi multer đọc tệp.
- Tệp: kiểm bằng nội dung, tên do server sinh, giới hạn dung lượng và số tệp, khi phục vụ có `nosniff`. Ảnh vẫn giữ nguyên EXIF (có thể chứa vị trí GPS), như spec 0002.
- Tối đa 5 tệp mỗi yêu cầu nằm trong bộ nhớ (xem Consequences); giới hạn tần suất `listingWrite` chặn lạm dụng.
- Không dữ liệu nào thuộc phạm vi tuân thủ riêng.

**Configuration required**: không có biến môi trường mới, không dịch vụ ngoài, không seed, không migration. `MAX_UPLOAD_BYTES` có sẵn nay áp cho từng ảnh của lần đăng.

**Critical test scenarios** (mỗi dòng ứng với một AC):
- Happy path: đăng tin với 1 ảnh rồi với 5 ảnh (PNG, JPEG, WebP trộn): 201, `images[]` đúng thứ tự gửi, `coverImageUrl` là ảnh đầu, mỗi tệp trên ổ đĩa có đúng các byte đã gửi, tin và ảnh mở được công khai, verifies **AC-1**
- Failure case: bốn ảnh hợp lệ cộng một tệp văn bản mang đuôi `.png`: 400 `IMAGE_INVALID` với `errors` đúng `images.4`; không có tin mới, không dòng ảnh mới, thư mục ảnh không thêm tệp nào (so sánh trước và sau); gửi hai ảnh sai thì `errors` có cả hai, verifies **AC-2**, **AC-3**
- Failure case: ghi tệp thứ ba lỗi (StorageService giả) và commit lỗi (giao dịch giả): không còn tệp nào, không tin; lỗi `readOwner` sau commit không xóa ảnh của tin đã lưu; commit báo lỗi mà tin thực ra đã lưu thì tin và ảnh được giữ, verifies **AC-2**
- Failure case: không ảnh, yêu cầu JSON, ảnh ở trường `file` hay `images[]`, thân multipart bị cắt (400 `BAD_REQUEST`, không 500), sáu tệp (400 `BAD_REQUEST`), một ảnh quá `MAX_UPLOAD_BYTES` (413, không tin), verifies **AC-3**
- Failure case: `price` là `abc`, `1e5`, ` 5`, rỗng; `areaM2` `20.55`; `deposit=` rỗng; `availableFrom=` rỗng; trường lạ; `title` hai lần: đều 400 `VALIDATION_FAILED`; JSON số vẫn không đi qua được vì thiếu ảnh, verifies **AC-4**
- Failure case: thứ tự lỗi khi cùng lúc sai nhiều thứ (ví dụ nhà trọ người khác cộng ảnh sai: 400 `IMAGE_INVALID` đến trước 403), và mọi lỗi từ 404 trở đi không để tệp, verifies **AC-5**
- Failure case: hết dùng thử (403 `MEMBERSHIP_REQUIRED`), đủ hạn mức (403 `LISTING_QUOTA_REACHED`), mỗi lần không để tệp; còn một chỗ mà sáu yêu cầu đồng thời (chạy với kích thước pool kết nối đã biết, vì mỗi yêu cầu chờ khóa giữ một kết nối): đúng một 201, năm 403, thư mục ảnh chỉ thêm đúng ảnh của yêu cầu thành công; ép trùng mã tin thì thử lại và không để tệp, verifies **AC-2**, **AC-6**
- Failure case: tin có 2 ảnh: xóa một (204), xóa ảnh còn lại (409 `LISTING_IMAGE_REQUIRED`, dòng và tệp còn); hai lần xóa đồng thời hai ảnh của tin có 2 ảnh: một 204 một 409; hai lần xóa cùng một ảnh: một 204 một 404; tin cũ 0 ảnh: xóa là 404 `NOT_FOUND` như trước, tải ảnh lên vẫn được, verifies **AC-7**, **AC-9**
- Auth/permission: người tìm trọ nhận 403 `PERMISSION_DENIED`, không đăng nhập 401, admin đăng vào nhà trọ người khác 403 `NOT_RESOURCE_OWNER`; lần thứ 61 trong một giờ nhận 429 `RATE_LIMITED` kèm `Retry-After`, verifies **AC-8**
- Không đổi: `POST /listings/:id/images`, `PATCH`, ẩn, hiện, `GET` danh sách và chi tiết, `/media/public` cho kết quả như trước; `seed:demo` chạy lại không lỗi, verifies **AC-9**
- Điều khiển âm (phá cố ý rồi xem phép kiểm có bắt không): bỏ bước dọn tệp thì kiểm thư mục thấy tệp thừa; ghi tệp trước cửa hạn mức thì yêu cầu bị từ chối để lại tệp; để `Number('')` đi qua thì `deposit=` thành 0 đồng; bỏ khóa dòng tin khi xóa ảnh thì hai lần xóa đồng thời để tin còn 0 ảnh, verifies **AC-2**, **AC-4**, **AC-5**, **AC-7**

## Build plan

Hướng build theo Tracer Bullet (một sợi chỉ mỏng chạy trọn qua mọi tầng trước, rồi dày dần): mốc 1 là sợi chỉ chính, từ yêu cầu multipart, qua kiểm lỗi, giao dịch, ổ đĩa, tới phản hồi, ngay từ đầu đã tất cả hoặc không gì cả vì đó là lõi của tính năng, và kéo theo bộ Postman cùng tài liệu FE vì đường JSON cũ ngừng chạy ngay sau mốc này. Mốc 2 dày thêm bằng luật chặn xóa ảnh cuối. Mỗi mốc là một lần `/develop` rồi dừng cho bạn review (khớp các ô con của `Build it` trong scope). Tài liệu sống: `docs/api/api-for-frontend.md` và `docs/api/postman-collection.json` cập nhật trong từng mốc.

**Mốc 1: đăng tin kèm ảnh trong một lần gọi**
1. `CreateListingDto`: biến đổi `FormNumber` (chỉ nhận chuỗi `^\d+(\.\d+)?$`, ngược lại thành `NaN`; số JSON giữ nguyên) áp lên `price`, `areaM2`, `deposit`; sửa chú thích "Body đăng tin"; ba trường số không mang `@Trim()` (hiện cũng không có), nên `" 5"` không bị cắt khoảng trắng rồi lọt qua; test đơn vị trong `listing-dtos.spec.ts` (chuỗi hợp lệ gồm `100000.0`, `0100000`, `20.50`, rỗng, `1e5`, `0x10`, `" 5"`, `20.55`, trường tùy chọn rỗng, trường lạ, `title` gửi hai lần, `price[x]=1`), satisfies **AC-4**
2. `src/listings/new-listing-images.ts`: hàm thuần `prepareListingImages(files)` (đếm, tên trường, loại bằng `detectImageType`, gom lỗi `images` và `images.N`, sinh `storage_key` và `position`); dùng lại kiểu `UploadedImage`; test đơn vị đủ các nhánh lỗi và thứ tự, satisfies **AC-3**
3. `ListingImagesRepository.createMany(listingId, images, tx)`; `ListingsService.create(user, propertyId, dto, files, now)` theo mục "Cách chạy" (chuẩn bị ảnh trước, vòng thử lại trong phạm vi dọn tệp, ghi tệp cuối giao dịch); inject `StorageService` và `ListingImagesRepository`; `TransactionRunner.run(fn, options?)` nhận thêm `timeout` và `maxWait` tùy chọn (nơi gọi khác không đổi, có test); test đơn vị (thứ tự gọi, từ chối ở cửa không ghi tệp, trùng mã không để tệp, tệp ghi tuần tự nên tệp sau không bắt đầu khi tệp trước chưa xong, ghi tệp thứ ba lỗi và commit lỗi mà tin không có thì xóa hết, commit lỗi mà tin đã lưu thì giữ tệp và trả tin, `readOwner` lỗi sau commit không xóa), satisfies **AC-1**, **AC-2**, **AC-5**, **AC-6**
4. `src/common/files/multipart-error.interceptor.ts` (đổi lỗi đọc multipart không phải `HttpException` thành 400 `BAD_REQUEST`, `HttpException` đi qua nguyên; test đơn vị) gắn vào cả `ListingImagesController.upload`; `PropertyListingsController.create`: `@UseInterceptors(MultipartErrorInterceptor, AnyFilesInterceptor())`, `@UploadedFiles()` (đúng thứ tự tham số `@CurrentUser()`, `@Param`, `@Body()`, `@UploadedFiles()`, có test UUID sai kèm body sai ra `INVALID_ID`), giữ `@RequirePermissions('listing:create')` và `@RateLimited('listingWrite')`; test duyệt route (0003) vẫn qua, satisfies **AC-1**, **AC-3**, **AC-8**
5. Kiểm thật trên DB thử (mọi kịch bản ở trên có tệp ảnh thật, so thư mục ảnh trước và sau, đồng thời, giả lỗi ghi tệp và commit (cả ca commit lỗi mà tin đã lưu), thân multipart bị cắt, 429, ba điều khiển âm đầu); Postman: đổi các request đăng tin (26 request theo đường dẫn lúc viết spec, đếm lại khi build) sang `formdata` với `images` là `sample-listing.png`, thêm request cho ca lỗi mới, không đăng nhập admin thêm lần nào; `api-for-frontend.md`: mục 6.18 viết lại, 6.28 và mục 2 (dung lượng body), bảng mã lỗi (`IMAGE_INVALID`), bảng giới hạn, mục 7 (biểu mẫu đăng tin), Phụ lục A, B, C, nhật ký có nhãn thay đổi phá vỡ; chạy lại unit, lint, Newman hai lượt liền, satisfies **AC-1** đến **AC-6**, **AC-8**, **AC-9**

**Mốc 2: chặn xóa ảnh cuối cùng**
6. `ErrorCode.LISTING_IMAGE_REQUIRED` (409, câu tiếng Việt), thêm vào mọi nơi liệt kê mã lỗi (test bảng mã lỗi), satisfies **AC-7**
7. `ListingImagesService.remove`: giao dịch `lockListing` → ảnh còn không → đếm → xóa dòng, xóa tệp sau commit; `ListingImagesRepository` thêm đọc ảnh và đếm trong giao dịch; test đơn vị (409 khi còn một ảnh, 404 trước 409, tin 0 ảnh), satisfies **AC-7**
8. Kiểm thật (xóa tuần tự, hai lần xóa đồng thời, cùng một ảnh hai lần, tin cũ 0 ảnh, điều khiển âm bỏ khóa), Postman thêm request xóa ảnh (xóa được khi còn từ 2 ảnh, 409 khi còn một) vào folder ảnh, `api-for-frontend.md` (6.28, bảng mã lỗi, Phụ lục A, B, mục 7 bước ảnh, nhật ký; ghi rõ tin cũ chỉ còn một ảnh thì không xóa được ảnh đó xuống 0), `verify.md` của spec, chạy lại toàn bộ unit, lint, Newman hai lượt liền, satisfies **AC-7**, **AC-9**

## Migration plan

**Strategy**: no migration needed cho dữ liệu; thay đổi API phá vỡ, triển khai cùng lúc với FE (một lần).
**Phases**:
1. Backend đổi `POST /properties/:propertyId/listings` sang multipart và chặn xóa ảnh cuối; FE đổi biểu mẫu đăng tin cùng đợt.
2. Bộ Postman và tài liệu FE đã đổi theo ngay trong mốc 1.
**Rollback**: revert một commit; không đổi schema hay dữ liệu, các tin và ảnh đã tạo vẫn hợp lệ.
**Risks**: FE cũ còn gọi JSON sẽ nhận 400 `IMAGE_INVALID` (thiếu ảnh) thay vì lỗi mơ hồ; kiểm FE đã đổi trước khi chạy bản mới.

## Consequences

**Positive**:
- Một lần gọi đăng cả tin lẫn ảnh; không còn trạng thái tin hiện ra rồi mới có ảnh, và không còn tin kẹt không ảnh khi bước ảnh hỏng.
- Không bảng, không migration, không biến môi trường, không nhóm giới hạn mới; dùng lại `StorageService`, `detectImageType`, cửa hạn mức và `TransactionRunner`.
- Lỗi ảnh nói rõ ảnh nào sai (`images.N`), nên bỏ cả bài mà người dùng vẫn biết sửa gì.
- Chỉ một đường đăng tin nên luật bắt buộc ảnh không đi vòng được.

**Negative / tradeoffs**:
- Thay đổi phá vỡ: mọi nơi gọi đăng tin bằng JSON (FE, bộ Postman, script kiểm) phải đổi; bộ Postman có hơn hai mươi request cần sửa.
- Một lần đăng giữ tối đa 5 ảnh trong bộ nhớ (mặc định 25 MiB mỗi yêu cầu, và 50 MiB khi `MAX_UPLOAD_BYTES` đặt ở mức tối đa 10 MiB; bộ nhớ tạm của multer); nhiều chủ trọ đăng cùng lúc tốn bộ nhớ theo đó. Chấp nhận cho bản demo.
- Repo hiện không có reverse proxy (máy chủ đứng trước API). Nếu thêm về sau, giới hạn thân yêu cầu của nó phải từ 5 lần `MAX_UPLOAD_BYTES` cộng khoảng 1 MiB trở lên, nếu không proxy trả 413 dạng HTML trước khi yêu cầu tới Nest.
- Nếu `readOwner` lỗi sau commit thì client nhận 500 dù tin đã lưu và ảnh còn nguyên; vì không có khóa chống trùng, gửi lại sẽ tạo tin thứ hai. Hiếm, chấp nhận.
- Tệp được ghi khi giao dịch còn mở, giữ khóa dòng `users` và `properties` của chủ trọ trong lúc ghi (giao dịch của đường này đặt hết hạn sau 15 giây). Ổ đĩa chậm quá mức đó thì lỗi 500 và tệp được dọn. Đổi lại yêu cầu bị từ chối không ghi tệp nào.
- Ghi tệp và ghi database không nguyên tử: nếu tiến trình chết đúng giữa hai việc thì có thể còn tệp mồ côi (như spec 0002, chấp nhận ở bản demo).
- Gửi lại sau lỗi phải gửi lại cả năm ảnh; không có khóa chống trùng, nên bấm đúp có thể tạo hai tin (FE khóa nút trong lúc gửi, như mọi thao tác tạo mới).
- Gửi hơn 5 tệp nhận 400 `BAD_REQUEST` chung chứ không phải `IMAGE_INVALID`, và multer không giới hạn số trường chữ (không gia cố vì là MVP).
- "Tin phải có ảnh" chỉ là luật của API: tin cũ chưa có ảnh vẫn tồn tại (dữ liệu demo cố ý giữ một tin như vậy) và không bị ép bổ sung.
- Muốn thay ảnh duy nhất của một tin thì phải tải ảnh mới lên trước rồi mới xóa ảnh cũ.
- Thứ tự báo lỗi của đường đăng tin (hình dạng yêu cầu đến trước kiểm chủ sở hữu) khác đường tải ảnh lẻ của spec 0002 (kiểm chủ trước); hai thứ tự cùng được ghi lại.

**Neutral**:
- `ListingsService` thêm hai thứ được inject (`StorageService`, `ListingImagesRepository`); `ListingsModule` đã import `StorageModule` nên không đổi module.
- `POST /listings/:id/images` vẫn là đường thêm ảnh cho tin đã có, kể cả tin cũ không ảnh.
- Số `0011` là số kế tiếp trong `docs/specs/`. Spec này đổi AC-5 và AC-8 của spec 0002; sau khi bạn xác nhận, `0002` có một dòng trỏ sang spec này.

## Follow-up

- [ ] Hoãn, thêm lại bằng `/scope` khi cần: sửa tin kèm ảnh trong một lần (PATCH multipart), đổi thứ tự hay chọn ảnh bìa, nén hoặc đổi kích thước hoặc xóa EXIF của ảnh, khóa chống trùng khi đăng tin, giới hạn số trường chữ trong multipart, dọn tệp mồ côi bằng việc nền.
- [ ] FE đổi biểu mẫu đăng tin sang `FormData` cùng đợt phát hành (backend không còn nhận JSON ở đường này).
- [ ] Sau khi build, `/sync` rà các spec còn nhắc đăng tin bằng JSON (0002 AC-5 và bảng API, 0003 nếu có ví dụ).

## Rationale

Lý giải và các phương án: xem [rationale.md](rationale.md).
