# <PROJECT NAME> — Backend (Prisma ORM)

> Project-specific context cho Claude (Prisma variant).
> Architectural rules (SOLID, layer responsibilities, templates) nằm trong skill
> **`solid-backend-nodejs`** — skill sẽ tự activate. File này chỉ chứa
> Prisma-specific adaptations + project-specific context.

---

## Stack

<!-- TODO: điền stack thực tế -->
- **Runtime**: Node.js (LTS) + TypeScript (ESM / CJS — chọn 1)
- **Framework**: Express / Fastify / NestJS / ...
- **ORM**: Prisma (v5+)
- **Database**: PostgreSQL / MySQL / SQLite / ...
- **Validation**: Zod (khuyến nghị — type inference pair tốt với Prisma)
- **Auth**: JWT / session / OAuth
- **Migrations**: `prisma migrate`
- **External services**: <nếu có>

---

## Prisma — mapping sang skill layers

Prisma **không có concept "Model" kiểu Mongoose** — schema define trong
`prisma/schema.prisma`, types auto-generated. Layer mapping:

| Layer trong skill | Prisma equivalent |
|---|---|
| `models/*.ts` | **Bỏ** — schema ở `prisma/schema.prisma`, types auto-generated |
| `interfaces/*.ts` | Giữ nguyên — define I<Module>Repository, I<Module>Service, DTOs |
| `repositories/*.ts` | Wrap `PrismaClient` — không để service gọi trực tiếp `prisma.trade.findMany()` |
| `mappers/*.ts` | Giữ nguyên — Prisma result → DTO (remove `createdAt` → ISO string, etc.) |
| `services/*.ts` | Giữ nguyên |
| Rest | Giữ nguyên |

### Generated types — dùng đúng cách

```ts
import type { Trade, Prisma } from '@prisma/client';

// DB shape (internal) — dùng trong repo + mapper
type ITrade = Trade;

// Input types auto-generated
type TradeCreateInput = Prisma.TradeCreateInput;
type TradeUpdateInput = Prisma.TradeUpdateInput;
```

**KHÔNG** tự tạo `ITrade` interface trùng với generated `Trade` — sẽ drift.

---

## PrismaClient — singleton, inject via DI

```ts
// prisma/client.ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
});

// Handle graceful shutdown
process.on('beforeExit', async () => { await prisma.$disconnect(); });
```

Inject `PrismaClient` vào repository qua constructor. **Không** `new PrismaClient()`
trong mỗi repo — sẽ exhaust connection pool.

```ts
// repositories/trade.repository.ts
export class TradeRepository implements ITradeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(filter: Prisma.TradeWhereInput): Promise<Trade[]> {
    return this.prisma.trade.findMany({ where: filter, orderBy: { createdAt: 'desc' } });
  }
  // ...
}
```

Composition root wire `prisma` vào:
```ts
// composition/container.ts
import { prisma } from '../prisma/client.js';
const tradeRepo = new TradeRepository(prisma);
```

---

## Transactions — `prisma.$transaction`

Dùng khi nhiều writes phải atomic:

```ts
await this.prisma.$transaction(async (tx) => {
  const trade = await tx.trade.create({ data });
  await tx.auditLog.create({ data: { action: 'trade.create', tradeId: trade.id } });
  return trade;
});
```

**Quan trọng**: pass `tx` xuống — đừng dùng `this.prisma` bên trong callback,
sẽ thoát transaction.

---

## Response Envelope (mandatory)

```ts
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };
```

---

## Error Flow (mandatory)

Prisma throws `PrismaClientKnownRequestError` với `code` như `P2002` (unique
violation), `P2025` (record not found). Map về typed `AppError` **trong
repository**, không để leak lên service:

```ts
async create(data: Prisma.TradeCreateInput): Promise<Trade> {
  try {
    return await this.prisma.trade.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ConflictError('Trade already exists', { fields: e.meta?.target });
    }
    throw e;
  }
}
```

Common Prisma error codes:

| Code | Meaning | Map to |
|---|---|---|
| P2002 | Unique constraint violation | `ConflictError` |
| P2025 | Record not found (update/delete) | `NotFoundError` |
| P2003 | Foreign key constraint | `ValidationError` |
| P2014 | Invalid ID | `ValidationError` |

---

## Project-Specific Placement Rules

<!-- TODO: điền -->

| Concern | Goes in | Not in |
|---|---|---|
|   |   |   |

---

## 🚨 Post-Task Verification — NON-NEGOTIABLE

Trước ANY "done", Claude MUST chạy:

### 1. Schema validate

```bash
npx prisma validate
```

Schema syntax OK.

### 2. Generate Prisma Client (sau mọi schema change)

```bash
npx prisma generate
```

Generated types update. Skip bước này = TS types lệch khỏi runtime.

### 3. Migration check (nếu schema đổi)

```bash
npx prisma migrate dev --name <descriptive-name>
```

Dev migration được apply. Review SQL trong `prisma/migrations/`.

**Production**: KHÔNG chạy `migrate dev`. Dùng `migrate deploy`.

### 4. Verify imports

Invoke skill **`node-verify-import`** targeting `src/`.

### 5. Type check

```bash
npx tsc --noEmit
```

Zero type errors.

### 6. SOLID checklist

Walkthrough `solid-backend-nodejs/references/solid-checklist.md`.

### 7. Test (nếu có)

```bash
npm test
```

### Nếu bất kỳ bước nào fail → fix → re-run → rồi mới claim.

---

## Common Pitfalls — Prisma

1. **Quên `npx prisma generate` sau khi sửa schema** → TS báo field không tồn tại nhưng runtime pass (hoặc ngược lại). Luôn chạy `generate` sau schema change.
2. **`new PrismaClient()` trong nhiều file** → connection pool exhausted. Dùng singleton export từ `prisma/client.ts`.
3. **Dùng `this.prisma` trong `$transaction` callback** thay vì `tx` → escape transaction, mất atomicity.
4. **Forget `.$disconnect()`** khi test / script ngắn → process hang.
5. **Select all columns** khi chỉ cần vài → dùng `select: {}` hoặc `include: {}` để tối ưu.
6. **N+1 query** từ nested access → dùng `include` hoặc `select` nested thay vì for-loop.
7. **`findUnique` vs `findFirst`** — `findUnique` chỉ dùng cho unique fields; dùng sai sẽ lỗi TS.
8. **Migration đã apply trên dev nhưng chưa `migrate deploy` trên prod** → schema drift giữa environments.
9. **Raw SQL qua `$queryRaw` không escape** → SQL injection. Dùng `Prisma.sql\`...\`` template tagged literal.

<!-- TODO: thêm pitfalls khi gặp incident trong project này -->

---

## When Claude is unsure

- Architecture question → `solid-backend-nodejs/references/solid-checklist.md`
- Schema design → Prisma docs + team review (migrations irreversible)
- Transaction boundaries → nếu 2 writes phải all-or-nothing, wrap trong `$transaction`
- Verify correctness → chạy 7-step verification pipeline ở trên
- Performance → `prisma studio` + query log trong dev mode
