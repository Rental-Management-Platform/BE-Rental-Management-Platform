# 0004. Xử lý lỗi và kiểm tra dữ liệu (spec con của 0001 nền móng backend)

**Date**: 2026-10-05

## Summary

Spec con này chốt cách mọi lỗi và mọi dữ liệu vào đi qua một đường duy nhất. Mọi lỗi (do code, do kiểm tra dữ liệu, do PostgreSQL, do giới hạn tần suất) được một bộ lọc toàn cục đổi thành một dạng JSON thống nhất theo tinh thần RFC 9457 (chuẩn mô tả lỗi HTTP), có `code` ổn định để FE xử lý và thông điệp tiếng Việt. Dữ liệu vào được kiểm tra bằng class-validator, trường lạ bị từ chối. Phản hồi thành công trả thẳng tài nguyên, danh sách có phân trang.

## Decision

Một bộ lọc lỗi toàn cục (`@Catch()` không giới hạn), một registry `ErrorCode` làm nguồn duy nhất cho `code`, `status` và thông điệp, một lớp `AppException` để ném lỗi nghiệp vụ, `ValidationPipe` toàn cục với `whitelist` và `forbidNonWhitelisted`. Ném các lớp `*Exception` của NestJS trực tiếp trong code tính năng bị cấm bằng ESLint.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`): rule `error-use-exception-filters`, `security-validate-all-input`, `api-use-pipes`.

## Standard definition

**Canonical pattern**:

Dạng lỗi trả về (`Content-Type: application/problem+json`, bỏ `type` vì mặc định là `about:blank`, `code` đóng vai trò định danh):

```json
{
  "status": 400,
  "title": "Bad Request",
  "code": "VALIDATION_FAILED",
  "detail": "Dữ liệu gửi lên không hợp lệ.",
  "errors": [
    { "field": "email", "code": "isEmail", "message": "Email không đúng định dạng." }
  ],
  "requestId": "0b6f1c1e-7f7a-4a52-9f7e-3d3c5b2e8a10",
  "timestamp": "2026-10-05T03:12:45.120Z",
  "path": "/api/v1/auth/register"
}
```

`errors` chỉ có khi là lỗi kiểm tra dữ liệu. Body không bao giờ chứa stack hay thông điệp nội bộ.

Registry là nguồn duy nhất (cố ý dùng `Record<ErrorCode, ...>` để trình biên dịch bắt thiếu mã):

```ts
export enum ErrorCode {
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  EMAIL_TAKEN = 'EMAIL_TAKEN',
  // ...
}

interface ErrorDefinition {
  readonly status: HttpStatus;
  readonly message: string;
}

export const ERRORS: Record<ErrorCode, ErrorDefinition> = {
  [ErrorCode.VALIDATION_FAILED]: { status: HttpStatus.BAD_REQUEST, message: 'Dữ liệu gửi lên không hợp lệ.' },
  [ErrorCode.EMAIL_TAKEN]: { status: HttpStatus.CONFLICT, message: 'Email này đã được sử dụng.' },
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
// dùng: throw new AppException(ErrorCode.EMAIL_TAKEN);
```

Bộ lọc toàn cục là lớp mỏng; phần đổi sang dạng lỗi là một hàm thuần để test đơn vị:

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const problem = toProblem(exception, { path: req.originalUrl, requestId: getRequestId(req) });
    // log: 5xx mức error kèm stack và cause; 4xx mức warn không kèm stack
    res.status(problem.status).type('application/problem+json').json(problem);
  }
}
```

Bảng đổi lỗi (`toProblem`), xét từ trên xuống:

| Nguồn | Điều kiện | status | code |
|---|---|---|---|
| `AppException` | luôn | theo `ERRORS` | theo lỗi |
| Lỗi từ `ValidationPipe` | `exceptionFactory` tạo `AppException(VALIDATION_FAILED, errors)` | 400 | `VALIDATION_FAILED` |
| TypeORM `QueryFailedError` | `driverError.code = '23505'` (trùng giá trị duy nhất) | 409 | tra theo tên ràng buộc `driverError.constraint` trong `UNIQUE_CONSTRAINT_ERRORS` (ví dụ `users_email_unique` thành `EMAIL_TAKEN`), mặc định `DUPLICATE_KEY` |
| `QueryFailedError` | `23503` (vi phạm khóa ngoại: xóa dòng còn được tham chiếu, hoặc tham chiếu dòng không tồn tại) | 409 | `REFERENCE_CONFLICT` (Service thường kiểm trước và ném mã `*_NOT_FOUND` hay `*_IN_USE` cụ thể hơn) |
| `QueryFailedError` | `22P02` (chuỗi không đúng dạng UUID lọt tới DB) | 400 | `INVALID_ID` (lưới an toàn; đường chính là `ParseUUIDPipe`) |
| `QueryFailedError` | `23502` (cột bắt buộc bị rỗng), `23514` (vi phạm `CHECK`) | 500 | `INTERNAL_ERROR`, ghi log mức error: đây là lỗi code vì DTO lẽ ra đã chặn dữ liệu này |
| Lỗi kết nối DB | `ECONNREFUSED`, `ETIMEDOUT`, mã lớp `08`, `57P01`, `53300` | 503 | `DB_UNAVAILABLE` |
| `EntityNotFoundError` của TypeORM | `findOneOrFail` không thấy dòng | 404 | `NOT_FOUND` (lưới an toàn; Service nên ném mã `*_NOT_FOUND` cụ thể) |
| `ThrottlerException` | vượt giới hạn | 429 | `RATE_LIMITED` (và header `Retry-After`) |
| body-parser | JSON hỏng; quá `100kb` | 400; 413 | `MALFORMED_JSON`; `PAYLOAD_TOO_LARGE` |
| `HttpException` của Nest (route không có, v.v.) | còn lại | theo status | `NOT_FOUND` hoặc mã chung tương ứng |
| Mọi thứ khác | lỗi không lường | 500 | `INTERNAL_ERROR` với thông điệp chung chung |

Giao dịch gặp lỗi `40001` (serialization_failure) hoặc `40P01` (deadlock_detected) được thử lại tối đa 3 lần trong `TransactionRunner` (spec 0005) trước khi tới bộ lọc; hết lần thử thì ném `AppException(DB_UNAVAILABLE)`.

Quy ước mã lỗi và status: 400 dữ liệu sai (`VALIDATION_FAILED`, `INVALID_ID`, `MALFORMED_JSON`, lỗi theo luật nghiệp vụ như `ROLE_NOT_ASSIGNABLE`), 401 chưa xác thực (`TOKEN_MISSING`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS`, `REFRESH_TOKEN_MISSING`, `SESSION_REVOKED`, `SESSION_EXPIRED`), 403 không được phép (`PERMISSION_DENIED`, `NOT_RESOURCE_OWNER`, `ACCOUNT_LOCKED`, `ORIGIN_NOT_ALLOWED`, `CANNOT_GRANT_UNHELD_PERMISSION`), 404 `NOT_FOUND` và các `*_NOT_FOUND`, 409 xung đột (`EMAIL_TAKEN`, `DUPLICATE_KEY`, `REFERENCE_CONFLICT`, `ROLE_KEY_TAKEN`, `ROLE_IN_USE`, `SYSTEM_ROLE_PROTECTED`, `LAST_ADMIN`), 413, 429, 500, 503. Không dùng 422.

Request id: lấy từ header `x-request-id` nếu hợp lệ (tối đa 64 ký tự, chỉ chữ số, chữ cái, gạch dưới và gạch ngang), nếu không thì `crypto.randomUUID()`. Trả lại ở header `X-Request-Id`, có trong mọi dòng log và mọi body lỗi.

Kiểm tra dữ liệu vào:

```ts
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    stopAtFirstError: false,
    exceptionFactory: (errors) => new AppException(ErrorCode.VALIDATION_FAILED, flattenValidationErrors(errors)),
  });
}
```

Luật viết DTO:
- Mọi trường có decorator (trường không có decorator bị `whitelist` bỏ), và mọi chuỗi có `@MaxLength`, mọi mảng có `@ArrayMaxSize`, mọi số có `@IsInt` hoặc `@IsNumber` cùng `@Min` và `@Max`.
- Số và ngày đi qua `@Type(() => Number)` hoặc `@Type(() => Date)` rõ ràng; không dựa vào chuyển kiểu ngầm.
- Chuỗi người dùng nhập được cắt khoảng trắng bằng decorator dùng chung `@Trim()` (có kiểu, không `any`).
- Đối tượng lồng nhau dùng `@ValidateNested` cùng `@Type`.
- Tham số đường dẫn là id (UUID) đi qua `ParseUUIDPipe` của NestJS cấu hình `exceptionFactory` trả `AppException(INVALID_ID)` (kiểm chứng tùy chọn phiên bản UUID với phiên bản đang dùng).
- Phân trang dùng `PaginationQueryDto`: `page` mặc định 1 (tối thiểu 1), `limit` mặc định 20 (tối đa 50).
- Tên: DTO nhận vào là `XxxDto`, response là `XxxResponse`; hai loại không dùng chung lớp.
- Biến môi trường dùng cùng cách (lớp `Env` với class-validator), kiểm tra khi khởi động và dừng ngay nếu sai.

Dạng phản hồi thành công:
- Một tài nguyên: trả thẳng đối tượng response (không bọc).
- Danh sách: `{ "items": [...], "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 } }`, kiểu `Paginated<T>`.
- Tạo mới: 201, xóa hoặc thao tác không có nội dung: 204.
- Response đi qua hàm mapper có kiểu (spec 0001 con), không dùng `ClassSerializerInterceptor`.

Mọi endpoint khai báo response bằng decorator Swagger (`@ApiOkResponse({ type })`) và lỗi bằng một decorator chung `@ApiProblemResponses(...)`.

**Replaces**:
- Lỗi mặc định của NestJS (`{ statusCode, message, error }`) và `ValidationPipe({ whitelist: true, transform: true })` hiện có ở `main.ts`.
- Thông điệp lỗi rải rác trong service (`'Email already in use'`).

**Enforcement**:
- ESLint `no-restricted-imports` cấm import `BadRequestException`, `NotFoundException`, `ConflictException`, `UnauthorizedException`, `ForbiddenException`, `InternalServerErrorException` và `HttpException` từ `@nestjs/common` ở mọi nơi trừ `src/common/errors/**`; thông báo trong luật chỉ về `AppException`.
- `Record<ErrorCode, ErrorDefinition>` làm trình biên dịch báo lỗi khi thêm mã mà quên khai báo status và thông điệp.
- Test đơn vị cho `toProblem` phủ từng dòng trong bảng đổi lỗi; test e2e kiểm tra một lỗi mỗi loại có đủ trường và không lộ stack.

**Rollout**: Code mới theo ngay. Bộ khung hiện có chuyển trong lát cắt đầu của spec con 0002.

**Exceptions**: Không có. Health check của `@nestjs/terminus` (`GET /api/v1/health`, gắn `@Public()`) giữ dạng phản hồi riêng của nó.

## Rationale (ngắn)

FE cần một cách duy nhất để đọc lỗi, và cần `code` ổn định (không phải câu chữ) để quyết định hành động, ví dụ gặp `TOKEN_EXPIRED` thì gọi refresh. Dạng theo tinh thần RFC 9457 là chuẩn công nghiệp nên không phải tự đặt và có tài liệu chung. Registry một chỗ tránh cảnh mỗi module tự đặt thông điệp và status. Thông điệp tiếng Việt đặt ở BE vì sản phẩm chỉ có một ngôn ngữ, khỏi cần thư viện i18n; cái giá là muốn đa ngôn ngữ sau này thì FE dùng `code` để dịch. class-validator được giữ vì đã cài, là chuẩn của NestJS và tích hợp Swagger; Zod cho kiểu suy ra từ schema nhưng thêm thư viện và đi lệch hướng của code hiện có. Cấm ném `*Exception` trực tiếp là cách duy nhất giữ registry không bị bỏ qua. Phương án thay thế đã cân nhắc: phong bì tự đặt `{ success, error }` (quen mắt nhưng là chuẩn tự đặt), giữ dạng mặc định (không có mã lỗi).

## Consequences

**Positive**:
- FE xử lý một dạng lỗi cho mọi trường hợp; `code` ổn định nên đổi câu chữ không làm vỡ FE.
- Không rò thông tin nội bộ; mọi lỗi 5xx có requestId để tra log.
- Lỗi PostgreSQL phổ biến (trùng giá trị duy nhất, vi phạm khóa ngoại, id sai, mất kết nối) trở thành lỗi dễ hiểu thay vì 500.

**Negative / tradeoffs**:
- Mỗi lỗi nghiệp vụ mới phải thêm vào registry trước khi dùng (hơi chậm nhưng có chủ ý).
- Thông điệp tiếng Việt cố định ở BE; đa ngôn ngữ cần làm thêm.
- Phải duy trì bảng `UNIQUE_CONSTRAINT_ERRORS` khớp tên ràng buộc; vì vậy mọi ràng buộc duy nhất phải đặt tên rõ theo quy ước `<bảng>_<cột>_unique` (spec 0005).

**Neutral**:
- Thêm các thư viện `@nestjs/swagger` cho decorator response.

## Follow-up

- [ ] Khi build, kiểm chứng `QueryFailedError` của TypeORM 1.x đặt mã lỗi và tên ràng buộc ở đâu (dự kiến `driverError.code` và `driverError.constraint` của driver `pg`) với phiên bản đang dùng.
- [ ] Nếu cần đa ngôn ngữ, định nghĩa cách FE dịch theo `code`.
