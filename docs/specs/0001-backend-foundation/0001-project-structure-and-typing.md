# 0001. Cấu trúc dự án và chặn any (spec con của 0001 nền móng backend)

**Date**: 2026-10-05

## Summary

Spec con này chốt cách tổ chức code NestJS để 25 module theo spec chức năng đều trông giống nhau: chia theo tính năng, mỗi module có Controller (nhận và trả HTTP), Service (luật nghiệp vụ) và Repository (nơi duy nhất gọi Prisma). Nó cũng chốt cách chặn `any` ở ba lớp: trình biên dịch, ESLint và CI. Có một hàm `createApp` dựng app dùng chung cho `src/main.ts` và các test e2e.

## Decision

Tổ chức theo tính năng (feature module), ba lớp Controller, Service, Repository, mọi thứ có kiểu rõ ràng, `unknown` thay cho `any`, và ba lớp chặn `any` bắt buộc cho mọi file. Quy ước này thay thế bộ khung hiện có ở `src/`.

**Implementation skills**: `nestjs-best-practices` (`kadajett/agent-nestjs-skills`, `.agents/skills/nestjs-best-practices/`): các rule `arch-feature-modules`, `arch-use-repository-pattern`, `arch-avoid-circular-deps`, `di-prefer-constructor-injection`, `devops-use-config-module`.

## Standard definition

**Canonical pattern**:

Bố cục thư mục (module phẳng ở `src/<feature>/`, giữ chỗ hiện tại của `auth` và `users`):

```
src/main.ts                   // entry duy nhất: createApp rồi listen
src/app.factory.ts            // createApp(): dựng và cấu hình app, không listen
src/app.module.ts
src/config/                   // env.validation.ts (lớp Env), app-config.service.ts (getter có kiểu)
src/database/                 // prisma.service.ts, prisma.module.ts, build-database-url.ts, seed.ts
src/generated/prisma/         // client do `prisma generate` sinh, không sửa tay, git bỏ qua
prisma/                       // schema.prisma (mọi model), migrations/ (file SQL do prisma migrate sinh)
prisma.config.ts              // cấu hình Prisma CLI: đường dẫn schema, URL kết nối
src/common/
  errors/                     // ErrorCode, AppException, AllExceptionsFilter (spec 0004)
  http/                       // PaginationQueryDto, Paginated<T>, AuthenticatedRequest
  auth/                       // @Public, @RequirePermissions, @FreshAuth, @CurrentUser, guards (spec 0003)
  persistence/                // TransactionRunner, hàm bọc truy vấn thô có kiểu (queryRows<T>), toSafeInteger
src/storage/                  // StorageService (giao diện) và bản hiện thực ổ đĩa (spec 0006)
src/mail/                     // MailService (giao diện) và bản hiện thực Nodemailer (spec 0006)
src/<feature>/
  <feature>.module.ts
  <feature>.controller.ts
  <feature>.service.ts
  <feature>.repository.ts
  dto/                        // XxxDto (request), XxxResponse (response)
  <feature>.mapper.ts         // hàm thuần: bản ghi sang response
Dockerfile, docker-entrypoint.sh, compose.yaml, compose.override.yaml   // ở gốc repo (spec 0006)
```

Quy tắc các lớp:
- **Controller** chỉ làm việc HTTP: nhận DTO, gọi đúng một phương thức Service, trả response DTO. Không import Prisma, không có luật nghiệp vụ. Tham số đường dẫn là id đi qua `ParseUUIDPipe` (spec 0004).
- **Service** giữ luật nghiệp vụ và điều phối. Không gọi Prisma; chỉ được `import type` các kiểu mô hình và `Prisma.TransactionClient`. Giao dịch chạy qua `TransactionRunner` (spec 0005).
- **Repository** là nơi duy nhất gọi `PrismaService` và truy vấn thô (`$queryRaw`, `$executeRaw`). Phương thức nhận tham số có kiểu và `tx?: Prisma.TransactionClient`, trả về bản ghi có kiểu (không trả kiểu `any`). Xóa mềm lọc bằng hàm dùng chung `notDeleted` và cột nhạy cảm như `passwordHash` bị loại mặc định bằng `omit` (spec 0005).
- **Module khác** chỉ dùng Service được export của module này. Không import Repository của module khác để truy vấn. Cấm vòng phụ thuộc, không dùng `forwardRef`.
- **Response** luôn đi qua hàm mapper có kiểu, không trả thẳng bản ghi của Prisma (không rò `password_hash` hay trường nội bộ).
- Constructor injection, không service locator (`ModuleRef.get`) trong code nghiệp vụ.

Hàm dựng app dùng chung (minh họa, chi tiết khi build):

```ts
export async function createApp(): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  app.useLogger(app.get(Logger));
  app.set('trust proxy', config.trustProxyHops);
  app.use(helmet());
  app.enableCors({ origin: config.allowedOrigins, credentials: true });
  app.useBodyParser('json', { limit: '100kb' });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(app.get(AllExceptionsFilter));
  if (config.swaggerEnabled) setupSwagger(app);
  return app; // main.ts gọi enableShutdownHooks và listen; test e2e gọi init
}
```

Cách xử lý biên giới có kiểu thay cho `any`:
- `catch (error: unknown)`, thu hẹp kiểu bằng `instanceof` hoặc type guard.
- Dữ liệu từ ngoài (`JSON.parse`, body, header, phản hồi của thư viện không có kiểu) gán vào `unknown` rồi kiểm tra bằng class-validator hoặc type guard, không ép kiểu bằng `as`.
- Biến môi trường đọc qua `AppConfigService` có getter có kiểu; không gọi `configService.get<string>('X')` ở nơi khác.
- **Truy vấn thô của Prisma là chỗ duy nhất `any` dễ lọt, nên có quy tắc riêng:** chỉ dùng `$queryRaw` và `$executeRaw` dạng tagged template (tham số gắn sẵn), luôn gọi với kiểu hàng cụ thể (`$queryRaw<Row[]>`) và đi qua hàm bọc `queryRows<T>` ở `src/common/persistence/` kiểm kết quả bằng type guard; cấm `$queryRawUnsafe` và `$executeRawUnsafe`; ưu tiên API có kiểu (`findMany`, `updateMany`...) với `Prisma.XxxWhereInput` thay cho SQL thô.
- Model trong `prisma/schema.prisma` khai báo kiểu cột tường minh (`@db.Uuid`, `@db.Timestamptz(6)`...) khi mặc định của Prisma không đúng ý; cấm kiểu `Json` khi không có lý do ghi trong spec tính năng (spec 0005).
- `@CurrentUser()` lấy `RequestUser` từ `AuthenticatedRequest` bằng `getRequest<AuthenticatedRequest>()`; không đọc `req.user` trực tiếp.

**Replaces**:
- Cấu hình hiện có: `noImplicitAny: false`, `no-explicit-any: off`, `no-unsafe-argument: warn`.
- Dấu `!` ở `jwt.strategy.ts` và `configService.get<string>()` rải rác.
- Gắn guard từng route bằng `@UseGuards(...)` (thay bằng guard toàn cục, spec 0003).
- Mẫu hiện có `MongooseModule` và schema Mongoose ở `src/users/schemas/` (thay bằng `PrismaModule` và model trong `schema.prisma`).

**Enforcement**:

Lớp 1, trình biên dịch (`tsconfig.json`, thêm vào `compilerOptions`):

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true,
  "strictPropertyInitialization": false
}
```

`strictPropertyInitialization: false` là nới lỏng duy nhất, vì lớp DTO và lớp cấu hình được framework điền giá trị mà trình biên dịch không thấy. Mọi thứ khác giữ chặt.

Lớp 2, ESLint (`eslint.config.mjs`): dùng `tseslint.configs.strictTypeChecked` thay cho `recommendedTypeChecked`, và đặt các luật sau ở mức `error`:
- `@typescript-eslint/no-explicit-any`, toàn bộ nhóm `no-unsafe-*` (argument, assignment, call, member-access, return).
- `@typescript-eslint/no-non-null-assertion`, `@typescript-eslint/no-floating-promises`, `@typescript-eslint/ban-ts-comment`.
- `@typescript-eslint/explicit-module-boundary-types`.
- `@typescript-eslint/consistent-type-assertions` với `objectLiteralTypeAssertions: 'never'`.
- `linterOptions.reportUnusedDisableDirectives: 'error'`, và dùng plugin `@eslint-community/eslint-plugin-eslint-comments` với luật `no-restricted-disable` cấm tắt `@typescript-eslint/no-explicit-any` và `@typescript-eslint/no-unsafe-*` bằng comment.
- `no-restricted-imports` cấm import giá trị từ `src/generated/prisma/**` và `@prisma/client` ngoài `*.repository.ts`, `src/database/**` và `src/common/persistence/**` (đặt `allowTypeImports: true` để mọi nơi vẫn được `import type`); cấm `@prisma/adapter-pg` ngoài `src/database/**`. Một luật `no-restricted-syntax` cấm gọi `$queryRawUnsafe` và `$executeRawUnsafe`.
- `--max-warnings 0` ở mọi lệnh lint.

Lớp 3, CI và hook:
- Script `npm run check` chạy `tsc --noEmit`, `eslint . --max-warnings 0`, `jest` và `nest build`.
- GitHub Actions chạy `npm run check` trên mọi PR; không merge khi đỏ (spec 0006).
- `husky` cùng `lint-staged` chạy ESLint và `tsc --noEmit` trước khi commit.

**Rollout**: Code mới theo ngay. Bộ khung hiện có (khoảng 20 file) được sửa trong lát cắt đầu tiên của spec con 0002 và 0003, vì chúng được viết lại ở đó.

**Exceptions**: Không có ngoại lệ cho code ứng dụng. Nếu một thư viện trả `any`, gán ngay vào `unknown` và kiểm tra bằng type guard hoặc class-validator, trong một file bọc nhỏ; file bọc đó cũng không được tắt luật.

## Rationale (ngắn)

Nhóm nhỏ làm khoảng 25 module nên giá trị lớn nhất là sự đồng nhất: ai mở module nào cũng thấy cùng một hình dạng. Repository bắt buộc gom mọi lời gọi Prisma vào một chỗ (kể cả truy vấn thô, nơi `any` dễ lọt vào nhất), cho phép test Service bằng repository giả và làm việc truyền `tx` cho giao dịch trở nên tường minh. ORM là Prisma, vốn sinh kiểu chặt cho truy vấn thường, nên phần lớn chữ "tuyệt đối không any" được giữ nhờ chính ORM; các quy tắc riêng cho truy vấn thô ở trên lo phần còn lại. Giá phải trả là thêm một file mỗi module; chấp nhận vì bạn nhấn mạnh "gọn gàng, tuyệt đối không any". Chặn `any` ở ba lớp vì mỗi lớp bắt một kiểu lọt khác nhau: trình biên dịch bắt `any` ngầm, ESLint bắt `any` chui qua thư viện, CI bắt việc quên chạy hai lớp trước. Phương án nhẹ hơn (chỉ `no-explicit-any`) không chặn được `any` đi qua `JSON.parse`, `req.user` hay kiểu của thư viện, nên không đáp ứng chữ "tuyệt đối".

## Consequences

**Positive**:
- Code đồng nhất, dễ review, dễ test (Service được test bằng repository giả).
- `any` bị chặn kể cả khi chui vào từ thư viện hoặc từ truy vấn thô.
- Chạy ở máy chủ khác chỉ là chạy cùng image; không còn entry riêng theo nền tảng.

**Negative / tradeoffs**:
- Thêm một file Repository mỗi module, kể cả module rất nhỏ (danh mục tiện ích).
- `strictTypeChecked` bực hơn lúc viết ban đầu; phải quen với `unknown` và type guard.
- Truy vấn thô của Prisma vẫn cần quy tắc và hàm bọc để giữ kiểu chặt; ai quên quy tắc sẽ bị lint chặn.
- Phải sửa vài file hiện có để qua được bộ luật mới.

**Neutral**:
- Thêm các thư viện: `prisma`, `@prisma/client`, `@prisma/adapter-pg` (cả ba ghim `@7`), `pg`, `helmet`, `nestjs-pino`, `@nestjs/terminus`, `@nestjs/swagger`, `@nestjs/throttler`, `husky`, `lint-staged`, plugin eslint-comments; bỏ `@nestjs/mongoose` và `mongoose`.

## Follow-up

- [ ] Khi build, kiểm chứng đúng tên và chữ ký của `useBodyParser`, `tseslint.configs.strictTypeChecked` và cấu hình plugin eslint-comments với phiên bản đang dùng; các đoạn mã ở trên là minh họa.
- [ ] Kiểm chứng Prisma 7 cùng `@prisma/adapter-pg` chạy với NestJS 11.2.x dạng CommonJS và qua `strictTypeChecked` với mẫu Repository ở trên (xem bảng giả định của spec 0006).
