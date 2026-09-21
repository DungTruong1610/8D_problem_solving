# <PROJECT NAME> — NestJS Backend

> Project-specific context cho Claude (NestJS variant).
> Architectural rules (SOLID, layer responsibilities, templates) nằm trong skill
> **`solid-backend-nodejs`** — skill sẽ tự activate. File này chỉ chứa
> NestJS-specific adaptations + project-specific context.

---

## Stack

<!-- TODO: điền stack thực tế -->
- **Framework**: NestJS (v10+)
- **Language**: TypeScript
- **HTTP adapter**: Express / Fastify (chọn 1)
- **ORM**: TypeORM / Prisma / Mongoose / ...
- **Validation**: `class-validator` + `class-transformer` (hoặc Zod custom pipe)
- **Auth**: `@nestjs/passport` + JWT / session / OAuth
- **Config**: `@nestjs/config`
- **Testing**: `@nestjs/testing` + Jest
- **External**: <điền nếu có — Redis, Bull, Kafka, Stripe...>

---

## Architecture — NestJS mapping sang SOLID skill

NestJS có IoC container sẵn, nên **bỏ** `composition/container.ts` trong skill.
Các layer khác vẫn giữ nguyên, chỉ đổi idiom:

| Layer trong skill | NestJS equivalent | Decorator |
|---|---|---|
| Route | `*.controller.ts` routes | `@Controller('path')` |
| Controller | Controller methods | `@Get()`, `@Post()`, `@Body()`, `@Param()` |
| Service | Provider class | `@Injectable()` |
| Repository | Provider class (custom) hoặc TypeORM `Repository` | `@Injectable()` |
| Mapper | Provider class (pure) | `@Injectable()` |
| Interface | TS interface + DI token | `@Inject('TOKEN')` |
| Middleware | Middleware / Interceptor | `@Injectable() implements NestMiddleware` |
| Validator | Pipe | `@UsePipes(new ValidationPipe())` |
| Error handler | Exception filter | `@Catch()` |
| Module boundary | Module | `@Module({})` |

Standard flow:

```
Request
  → Guard(s)          (auth, roles)
  → Interceptor(s)    (logging, transform)
  → Pipe(s)           (validation, parsing)
  → Controller        (decorator-routed method)
  → Service           (@Injectable, business logic)
  → Repository        (@Injectable, data access)
  → DB
Response
  ← Mapper / Interceptor (DTO transform)
  ← ApiResponse<T>
Error path
  → ExceptionFilter   (global, typed HttpException subclasses)
```

---

## SOLID trong NestJS — điểm khác skill chung

### DI (D)

Không cần `composition/container.ts`. NestJS resolve providers qua decorator.
Nhưng **vẫn phải inject interface chứ không phải concrete class** cho SOLID thật sự:

```ts
// ❌ Coupled to concrete
constructor(private readonly repo: TradeRepository) {}

// ✅ DIP via DI token
constructor(@Inject('ITradeRepository') private readonly repo: ITradeRepository) {}

// Trong module:
providers: [
  { provide: 'ITradeRepository', useClass: TradeRepository }
]
```

### Module boundary (SRP + ISP)

1 module = 1 bounded context. Export chỉ những providers mà module khác cần.
KHÔNG export toàn bộ — đó là ISP violation cấp module.

### Exception handling

Không cần `asyncHandler` — Nest tự wrap async. Không cần custom `errorHandler`
— dùng exception filter. Giữ hierarchy `AppError` → hoặc map sang NestJS built-in:

| Skill error | NestJS equivalent |
|---|---|
| `NotFoundError` | `NotFoundException` |
| `ValidationError` | `BadRequestException` |
| `UnauthorizedError` | `UnauthorizedException` |
| `ForbiddenError` | `ForbiddenException` |
| `ConflictError` | `ConflictException` |
| `AppError` (base) | `HttpException` |

Tạo 1 global exception filter để unify response shape:

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Map sang ApiResponse<T> format
  }
}
```

---

## Response Envelope (mandatory)

Dùng Interceptor để auto-wrap:

```ts
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_ctx, next) {
    return next.handle().pipe(map((data) => ({ success: true, data })));
  }
}
```

Mount global:
```ts
app.useGlobalInterceptors(new ResponseInterceptor());
app.useGlobalFilters(new AllExceptionsFilter());
```

Success: `{ success: true, data: <T> }`
Failure: `{ success: false, error: "message", details?: {...} }`

---

## Validation — Zod hoặc class-validator

**Class-validator** (Nest-native):
```ts
export class CreateTradeDto {
  @IsDateString() date: string;
  @IsString() @Length(1, 20) instrument: string;
}
// app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
```

**Zod** (nếu đã quen từ skill) — tạo `ZodValidationPipe`:
```ts
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodType<T>) {}
  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error.flatten());
    return result.data;
  }
}
```

**Chọn 1 — đừng mix 2 thư viện trong cùng project.**

---

## Project-Specific Placement Rules

<!-- TODO: điền -->

| Concern | Goes in | Not in |
|---|---|---|
|   |   |   |

---

## 🚨 Post-Task Verification — NON-NEGOTIABLE

Trước ANY "done", Claude MUST chạy:

### 1. Verify imports (mandatory)

Invoke skill **`node-verify-import`** targeting `src/`.

### 2. Type check + build

```bash
npm run build            # nest build (gồm cả tsc)
# hoặc
npx tsc --noEmit
```

Zero type errors. Zero build errors.

### 3. NestJS-specific: DI graph validate

```bash
nest start --dry-run     # nếu có setup
```

Hoặc chạy `npm run start` và check logs — nếu có "Nest can't resolve
dependencies" = DI graph broken, không được claim done.

### 4. Test pass (nếu có)

```bash
npm run test
npm run test:e2e         # nếu có
```

### 5. SOLID checklist

Walkthrough `solid-backend-nodejs/references/solid-checklist.md`.

### Nếu bất kỳ bước nào fail → fix → re-run → rồi mới claim.

---

## Common Pitfalls — NestJS

1. **Circular DI** (ModuleA imports ModuleB imports ModuleA) → dùng `forwardRef()` hoặc refactor để tách bounded context.
2. **Inject concrete class thay vì token** → DIP bị phá. Luôn dùng `@Inject('IToken')` cho abstraction.
3. **Quên `@Injectable()`** trên class cần DI → runtime error "Can't resolve dependencies".
4. **Module không `export`** provider → module khác import sẽ báo "not found".
5. **Business logic trong Controller** → dùng Service. Controller chỉ parse + delegate.
6. **Pipe throws generic Error** thay vì `BadRequestException` → ExceptionFilter không nhận đúng status.
7. **Global Pipe config thiếu `transform: true`** → `@Body() dto: CreateTradeDto` vẫn là plain object, không phải class instance → `class-validator` decorators không chạy.

<!-- TODO: thêm pitfalls khi gặp incident trong project này -->

---

## When Claude is unsure

- Architecture question → `solid-backend-nodejs/references/solid-checklist.md`
- Folder layout → NestJS-style: `src/<module>/<module>.{module,controller,service,repository}.ts`
- Adding new module → `nest g module <name>` + `nest g controller <name>` + `nest g service <name>`
- Verify correctness → chạy 5-step verification pipeline ở trên
