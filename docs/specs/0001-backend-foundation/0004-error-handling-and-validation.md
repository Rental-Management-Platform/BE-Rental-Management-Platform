# 0004. Xử lý lỗi và kiểm tra dữ liệu (spec con của 0001 nền móng backend)

**Date**: 2026-10-05, rút gọn ngày 2026-10-06

## Summary

Spec con này chốt cách mọi lỗi và mọi dữ liệu vào đi qua một đường duy nhất, ở mức nhỏ vừa đủ cho một hệ thống demo. Lỗi do code, do kiểm tra dữ liệu và do token đều được một bộ lọc toàn cục đổi thành cùng một JSON gọn, có `code` ổn định để FE quyết định hành động và `requestId` để tra log. Ở mọi API chỉ cần `throw new AppException(ErrorCode.X)`, còn middleware thì gọi `next(error)`. Bản rút gọn đã bỏ phần dịch lỗi PostgreSQL, luật ESLint chặn lỗi gốc của Nest, dạng RFC 9457 đầy đủ và test riêng cho bộ đổi lỗi; các phần đó được ghi ở mục "Cố ý không làm" để mở lại khi cần.

## Decision

Một bộ lọc lỗi toàn cục (`@Catch()` không giới hạn) đăng ký bằng `APP_FILTER`, một registry `ErrorCode` làm nguồn duy nhất cho `code`, `status` và thông điệp, một lớp `AppException` để ném lỗi nghiệp vụ, `ValidationPipe` toàn cục với `whitelist` và `forbidNonWhitelisted`, và một middleware gắn `requestId`. Không có luật ESLint: bộ lọc cũng nhận lỗi gốc của Nest và đổi sang cùng dạng, nên quên dùng `AppException` không làm vỡ dạng lỗi.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`): rule `error-use-exception-filters`, `security-validate-all-input`, `api-use-pipes`.

## Standard definition

**Canonical pattern**:

Body lỗi trả về (`Content-Type: application/json`):

```json
{
  "status": 409,
  "code": "EMAIL_TAKEN",
  "message": "Địa chỉ email này đã được sử dụng.",
  "requestId": "0b6f1c1e-7f7a-4a52-9f7e-3d3c5b2e8a10"
}
```

`errors` chỉ có khi là lỗi kiểm tra dữ liệu (`VALIDATION_FAILED`):

```json
{
  "status": 400,
  "code": "VALIDATION_FAILED",
  "message": "Dữ liệu gửi lên không hợp lệ.",
  "errors": [{ "field": "email", "code": "isEmail", "message": "Phải là địa chỉ email hợp lệ." }],
  "requestId": "0b6f1c1e-7f7a-4a52-9f7e-3d3c5b2e8a10"
}
```

Body không bao giờ chứa stack hay chữ lấy từ lỗi gốc: `message` luôn lấy từ registry. Thông điệp viết bằng tiếng Việt cho đồng nhất với mọi chữ người dùng thấy (kể cả email), còn `code` giữ tiếng Anh vì là hằng số cho FE; FE dựa vào `code` để hiện chữ riêng khi cần.

Registry là nguồn duy nhất (cố ý dùng `Record<ErrorCode, ...>` để trình biên dịch bắt thiếu mã):

```ts
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  EMAIL_TAKEN = 'EMAIL_TAKEN',
  // ...
}

export interface ErrorDefinition {
  readonly status: HttpStatus;
  readonly message: string;
}

export const ERRORS: Record<ErrorCode, ErrorDefinition> = {
  [ErrorCode.VALIDATION_FAILED]: { status: HttpStatus.BAD_REQUEST, message: 'Dữ liệu gửi lên không hợp lệ.' },
  [ErrorCode.EMAIL_TAKEN]: { status: HttpStatus.CONFLICT, message: 'Địa chỉ email này đã được sử dụng.' },
  // ...
};

export interface FieldError { readonly field: string; readonly code: string; readonly message: string }

export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly fieldErrors: readonly FieldError[] = [],
    options?: { cause?: unknown },
  ) {
    super({ code }, ERRORS[code].status, options);
  }
}
```

Cách ném lỗi (quy ước cho mọi code về sau):

| Bạn đang ở đâu | Làm gì |
|---|---|
| controller, service, guard, pipe | `throw new AppException(ErrorCode.EMAIL_TAKEN)` |
| middleware Express thuần | `next(error)` |
| lỗi do Nest hoặc thư viện tự sinh (route không có, body quá lớn) | không làm gì, bộ lọc tự đổi |

Cả ba đều dồn về cùng bộ lọc: `APP_FILTER` đi vào danh sách bộ lọc toàn cục của Nest, và bộ xử lý lỗi cuối của Express (nơi nhận `next(error)`) dùng đúng danh sách đó.

Bộ lọc toàn cục là một file duy nhất, gồm một hàm đổi lỗi thuần và lớp mỏng gọi nó:

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const body = toBody(exception, getRequestId(res));
    // log: 5xx mức error kèm stack; 4xx mức warn một dòng, không stack, không log body request
    res.status(body.status).json(body);
  }
}
```

Bảng đổi lỗi (`toBody`), xét từ trên xuống:

| Nguồn | Điều kiện | status | code |
|---|---|---|---|
| `AppException` | luôn | theo `ERRORS` | theo lỗi, kèm `errors` nếu có |
| `ValidationPipe` | `exceptionFactory` tạo `AppException(VALIDATION_FAILED, errors)` | 400 | `VALIDATION_FAILED` |
| `HttpException` của Nest, hoặc lỗi 4xx của body-parser (có `status` và `expose: true`) | status dưới 500 | giữ nguyên status | 400 `BAD_REQUEST`, 401 `UNAUTHORIZED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 413 `PAYLOAD_TOO_LARGE`, status khác `HTTP_ERROR` |
| Mọi thứ còn lại (lỗi code, lỗi PostgreSQL, 5xx của Nest) | | 500 | `INTERNAL_ERROR` |

JSON hỏng được Nest đổi thành `BadRequestException`, nên ra 400 `BAD_REQUEST` (không có mã riêng).

Giao dịch gặp lỗi Prisma `P2034` (xung đột ghi hoặc deadlock) được thử lại tối đa 3 lần trong `TransactionRunner` (spec 0005); hết lần thử thì ném `AppException(DB_UNAVAILABLE)` (503). Đây là chỗ duy nhất trong dự án đọc mã lỗi của Prisma.

Lỗi token do guard đăng nhập đổi lý do từ chối của Passport: `TokenExpiredError` thành `TOKEN_EXPIRED`, câu `No auth token` thành `TOKEN_MISSING`, còn lại `TOKEN_INVALID`. Sai email hay sai mật khẩu cùng trả `INVALID_CREDENTIALS`.

Quy ước mã lỗi và status: 400 dữ liệu sai (`VALIDATION_FAILED`, `INVALID_ID`, lỗi theo luật nghiệp vụ như `PERMISSION_UNKNOWN`, `PERMISSION_ADMIN_ONLY`), 401 chưa xác thực (`TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `REFRESH_TOKEN_MISSING`, `SESSION_REVOKED`, `SESSION_EXPIRED`), 403 không được phép (`PERMISSION_DENIED`, `NOT_RESOURCE_OWNER`, `ACCOUNT_LOCKED`, `ORIGIN_NOT_ALLOWED`), 404 `NOT_FOUND` và các `*_NOT_FOUND`, 409 xung đột (`EMAIL_TAKEN`, `PHONE_TAKEN`, `SYSTEM_TYPE_PROTECTED`, `CANNOT_LOCK_SELF`, `ACCOUNT_ALREADY_LOCKED`, `ACCOUNT_NOT_LOCKED`), 413, 500, 503. Không dùng 422. Một mã chỉ được thêm vào registry khi có tính năng dùng nó; `RATE_LIMITED` (429) sẽ được thêm khi làm giới hạn tần suất của spec 0002.

Request id: lấy từ header `x-request-id` nếu hợp lệ (tối đa 64 ký tự, chỉ chữ số, chữ cái, gạch dưới và gạch ngang), nếu không thì `crypto.randomUUID()`. Trả lại ở header `X-Request-Id`, có trong mọi dòng log lỗi và mọi body lỗi. Middleware phải chạy trước bộ đọc JSON để lỗi JSON hỏng cũng có `requestId`.

Kiểm tra dữ liệu vào:

```ts
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new AppException(ErrorCode.VALIDATION_FAILED, flattenValidationErrors(errors)),
  });
}

/** Mọi tham số id dùng: `@Param('id', uuidParam()) id: string`. */
export function uuidParam(): ParseUUIDPipe {
  return new ParseUUIDPipe({ exceptionFactory: () => new AppException(ErrorCode.INVALID_ID) });
}
```

`flattenValidationErrors` duyệt đệ quy `children` và tạo `{ field, code, message }` từ `constraints` của class-validator (`code` là tên ràng buộc như `isEmail`, `message` lấy từ bảng `VALIDATION_MESSAGES` ở cùng file, đổi tên ràng buộc thành một câu tiếng Việt không kèm số liệu, bảng phủ mọi ràng buộc các DTO đang dùng: `isEmail` "Phải là địa chỉ email hợp lệ.", `isNotEmpty` "Không được để trống.", `isString` "Phải là chuỗi ký tự.", `isIn` "Giá trị không nằm trong danh sách cho phép.", `matches` "Định dạng không hợp lệ.", `minLength` "Giá trị quá ngắn.", `maxLength` "Giá trị quá dài.", `isArray` "Phải là một danh sách.", `arrayMaxSize` "Danh sách có quá nhiều phần tử.", `isDefined` "Không được thiếu trường này.", `whitelistValidation` "Trường này không được phép gửi lên."; ràng buộc chưa có trong bảng dùng câu "Giá trị không hợp lệ.". Riêng `phone` đặt `message` "Số điện thoại không hợp lệ." ngay trên decorator. DTO nào cần nêu số liệu (ví dụ mật khẩu 8 đến 128 ký tự) đặt `message` riêng ngay trên decorator). Hai tùy chọn `enableImplicitConversion: false` và `stopAtFirstError: false` không cần ghi vì chúng là giá trị mặc định.

Luật viết DTO:
- Mọi trường có decorator (trường không có decorator bị coi là lạ và bị từ chối), mọi chuỗi có `@MaxLength`, mọi mảng có `@ArrayMaxSize`, mọi số có `@IsInt` hoặc `@IsNumber` cùng `@Min` và `@Max`.
- Số và ngày đi qua `@Type(() => Number)` hoặc `@Type(() => Date)` rõ ràng; không dựa vào chuyển kiểu ngầm.
- Chuỗi người dùng nhập được cắt khoảng trắng bằng decorator dùng chung `@Trim()` (có kiểu, không `any`); không áp cho mật khẩu.
- Đối tượng lồng nhau dùng `@ValidateNested` cùng `@Type`.
- Tham số đường dẫn là id (UUID) luôn đi qua `uuidParam()`, vì lỗi PostgreSQL không được dịch (xem bên dưới): id sai dạng mà lọt xuống DB sẽ thành 500.
- Phân trang dùng `PaginationQueryDto`: `page` mặc định 1 (tối thiểu 1), `limit` mặc định 20 (tối đa 50).
- Tên: DTO nhận vào là `XxxDto`, response là `XxxResponse`; hai loại không dùng chung lớp.
- Biến môi trường dùng cùng cách (lớp `Env` với class-validator), kiểm tra khi khởi động và dừng ngay nếu sai.

Dạng phản hồi thành công:
- Một tài nguyên: trả thẳng đối tượng response (không bọc).
- Danh sách: `{ "items": [...], "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }`, kiểu `Paginated<T>`.
- Tạo mới: 201, xóa hoặc thao tác không có nội dung: 204.
- Response đi qua hàm mapper có kiểu (spec 0001 con), không dùng `ClassSerializerInterceptor`.

**Cố ý không làm (bản rút gọn, ghi lại để mở lại khi cần)**:
- **Không dịch lỗi PostgreSQL.** Mọi lỗi từ Prisma (`PrismaClientKnownRequestError` và các lỗi DB khác) ra 500 `INTERNAL_ERROR`, chi tiết nằm trong log. Hệ quả phải tự phòng: id sai dạng dùng `uuidParam()`; trùng giá trị thì service kiểm trước rồi ném mã cụ thể (như `EMAIL_TAKEN`), nên hai người đăng ký cùng email cùng lúc thì người chậm hơn nhận 500. Khi cần, thêm một nhánh `Prisma.PrismaClientKnownRequestError` vào bộ lọc: `P2002` (trùng giá trị, tên trường ở `meta.target`), `P2003` (khóa ngoại), `P2025` (không thấy bản ghi), mã kết nối thành 503; mã nào đúng với PostgreSQL thì kiểm chứng lúc làm. Quy ước tên ràng buộc `<bảng>_<cột>_unique` của spec 0005 vẫn giữ để sẵn sàng việc này.
- **Không dạng RFC 9457 đầy đủ:** không `title`, `detail`, `timestamp`, `path`, không content type `application/problem+json`.
- **Không luật ESLint** `no-restricted-imports` cho các lớp `*Exception` của Nest.
- **Không file `to-problem.ts` riêng và không test đơn vị riêng** cho bộ đổi lỗi; dự án đặt workflow Prototype, kiểm bằng tay.
- **Không mã riêng cho JSON hỏng** (`MALFORMED_JSON`), không decorator Swagger cho lỗi (`@ApiProblemResponses`), không giới hạn tần suất.

**Replaces**:
- Lỗi mặc định của NestJS (`{ statusCode, message, error }`) và `ValidationPipe({ whitelist: true, transform: true })` hiện có ở `main.ts`.
- Thông điệp lỗi rải rác trong service (`'Email already in use'`) và các lớp `ConflictException`, `UnauthorizedException` ném thẳng trong `AuthService`.

**Enforcement**:
- `Record<ErrorCode, ErrorDefinition>` làm trình biên dịch báo lỗi khi thêm mã mà quên khai báo status và thông điệp.
- Không có luật lint. Ai ném lỗi gốc của Nest thì bộ lọc vẫn đổi sang cùng dạng, chỉ mất mã lỗi cụ thể (ra mã chung theo status).
- Kiểm bằng tay: mỗi loại lỗi (ném `AppException`, lỗi nhập liệu, route không có, JSON hỏng, body quá lớn, lỗi lạ, ba mã token, đăng nhập sai, email trùng) trả đúng `status`, `code`, có `requestId` trùng header, và không có stack.

**Rollout**: Code mới theo ngay. Bộ khung hiện có (`main.ts`, `AuthService`, `JwtAuthGuard` cũ) chuyển trong lát cắt đầu của lộ trình (scope hàng 1 đến 3). Các thông điệp tiếng Anh đã viết trong registry và trong `AppException` được viết lại sang tiếng Việt khi build hàng 5 và 6; `code` không đổi.

**Exceptions**: Health check của `@nestjs/terminus` (`GET /api/v1/health`, gắn `@Public()`) giữ dạng phản hồi riêng của nó.

## Rationale (ngắn)

Hệ thống này là demo nhỏ do một người tự viết tay, và FE chỉ cần hai thứ: một cách duy nhất để đọc lỗi, và `code` ổn định (không phải câu chữ) để quyết định hành động, ví dụ gặp `TOKEN_EXPIRED` thì gọi refresh. Bản rút gọn giữ đúng những phần mang lại điều đó: registry một chỗ (`code`, `status`, thông điệp không thể lệch nhau, trình biên dịch bắt thiếu), bộ lọc toàn cục để API chỉ cần `throw` hoặc `next(error)`, `requestId` (rẻ mà giúp tra log), và `forbidNonWhitelisted` (chính là thứ chặn `roles` trong body đăng ký, spec 0002 AC-1). Phần bị cắt đều là phần phải duy trì mà demo chưa dùng tới: bảng dịch SQLSTATE gắn chặt với tên ràng buộc, luật lint, các trường RFC 9457 mà FE chưa đọc, và test cho một bộ đổi lỗi mà bạn kiểm bằng tay. Việc cắt có giá: lỗi PostgreSQL ra 500 nên người viết phải kiểm trước ở service và dùng `uuidParam()`.

Thông điệp viết bằng tiếng Việt theo quyết định của bạn, để mọi chữ người dùng thấy (thông báo lỗi, thông báo kiểm tra dữ liệu, email) cùng một ngôn ngữ; `code` vẫn tiếng Anh để FE không phụ thuộc câu chữ và code đọc được ở log.

Phương án đã cân nhắc: bản đầy đủ của spec này lúc đầu (RFC 9457, dịch lỗi PostgreSQL, ESLint, test bảng; khoảng 10 file hướng dẫn và nhiều thứ phải giữ khớp nhau, quá nặng cho phạm vi demo), phong bì tự đặt `{ success, error }` (quen mắt nhưng là chuẩn tự đặt), và giữ dạng mặc định của Nest (không có `code` nên FE không phân biệt được `TOKEN_EXPIRED` với `TOKEN_INVALID`).

## Consequences

**Positive**:
- FE xử lý một dạng lỗi cho mọi trường hợp; `code` ổn định nên đổi câu chữ không làm vỡ FE.
- API không phải tự dựng JSON lỗi; hai cách ném (`throw`, `next`) cùng dồn về một bộ lọc.
- Không rò thông tin nội bộ; mọi lỗi 5xx có `requestId` để tra log.
- Ít thứ phải giữ khớp: bộ đổi lỗi nằm trong một file, không có file lint hay test riêng.

**Negative / tradeoffs**:
- Lỗi PostgreSQL ra 500: id sai dạng (nếu quên `uuidParam()`) và trùng giá trị đồng thời không có thông báo rõ.
- Thông điệp tiếng Việt cố định ở BE; `code` giữ tiếng Anh. FE cần ngôn ngữ khác thì tự dịch theo `code`.
- Không có luật lint, nên ai ném lỗi gốc của Nest mất mã lỗi cụ thể mà trình biên dịch không báo.
- Không có test tự động cho bộ lọc, dễ lệch khi sửa mà không ai nhận ra.
- Mỗi lỗi nghiệp vụ mới phải thêm vào registry trước khi dùng (có chủ ý).

**Neutral**:
- Mở lại phần dịch lỗi PostgreSQL hay dạng RFC 9457 đầy đủ sau này là việc thêm vào bộ lọc, không đổi cách các API ném lỗi.

## Follow-up

- [ ] Khi build, kiểm chứng lỗi quá lớn của body-parser mang `status` và `expose: true` (nếu không, 413 sẽ thành 500), và mã `P2034` của Prisma trong `TransactionRunner`.
- [ ] Khi cần dịch lỗi PostgreSQL hoặc dạng RFC 9457 đầy đủ, chạy `/architect` để mở lại phần đã cắt; bản đầy đủ nằm trong lịch sử git của file này.
