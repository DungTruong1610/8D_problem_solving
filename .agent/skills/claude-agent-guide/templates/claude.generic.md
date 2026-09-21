# <PROJECT NAME> — Backend

> Project-specific context cho Claude.
> Architectural rules (SOLID, layer responsibilities, templates) nằm trong skill
> **`solid-backend-nodejs`** — skill sẽ tự activate trên mọi backend task.
> File này CHỈ chứa những thứ riêng của project này.

---

## Stack

<!-- TODO: điền stack thực tế -->
- **Runtime**: Node.js (LTS) + TypeScript (ESM / CommonJS — chọn 1)
- **Framework**: Express / Fastify / Nest / ...
- **ORM**: Mongoose / Prisma / TypeORM / ...
- **Validation**: Zod / Joi / class-validator / ...
- **Auth**: JWT / session / OAuth / ...
- **Storage**: <nếu có — local / S3 / Drive / Cloudinary>
- **External services**: <nếu có — Gemini / OpenAI / Stripe / SendGrid...>

---

## Architecture

Follow the SOLID layered architecture defined in `solid-backend-nodejs`.
Do NOT restate its rules here. When uncertain, re-read that skill's
`references/solid-checklist.md`.

Standard flow:

```
Request
  → authMiddleware
  → Zod validator
  → Controller   (parse req, call service, format res)
  → Service      (business logic, orchestrate repos)
  → Repository   (DB query only)
  → Model        (schema + I<Module>)
Response
  ← Mapper (doc → DTO)
  ← ApiResponse<T>
```

---

## Project-Specific Placement Rules

<!-- TODO: điền khi có rule đặc biệt cho project này. Ví dụ: -->
<!-- "Analytics math nằm ở AnalyticsService, không bao giờ ở controller" -->

| Concern | Goes in | Absolutely not in |
|---|---|---|
| <ví dụ: heavy computation> | `services/<module>.service.ts` | Controllers / routes |
| <ví dụ: external API calls> | `services/<integration>.service.ts` | Controllers (chỉ parse input) |
|   |   |   |

---

## Response Envelope (mandatory — shared với frontend)

**Success**:
```json
{ "success": true, "data": <T> }
```

**Failure**:
```json
{ "success": false, "error": "message", "details": { /* optional */ } }
```

Frontend parse 1 union type duy nhất. Drift = breaking change.

---

## Error Flow (mandatory)

```
Repository → Service → Controller → asyncHandler → errorHandler → client
```

Typed errors có sẵn: `NotFoundError`, `ValidationError`, `UnauthorizedError`,
`ForbiddenError`, `ConflictError`. Anything else → 500 generic.

KHÔNG `try/catch` trong route/controller trừ khi convert low-level error
thành typed `AppError`.

---

## ESM Import Rule

<!-- TODO: xóa section này nếu project dùng CommonJS -->

`tsconfig.json` có `"module": "NodeNext"` → imports targeting `.ts` files MUST
include `.js` extension:

```ts
import { X } from '../services/x.service.js';  // ✅
import { X } from '../services/x.service';     // ❌ "Cannot find module" at runtime
```

---

## 🚨 Post-Task Verification — NON-NEGOTIABLE

Trước ANY "done" / "completed" / "xong rồi", Claude MUST chạy pipeline sau
và report kết quả từng bước:

### 1. Verify imports (mandatory)

Invoke skill **`node-verify-import`** targeting thư mục source (`server/src/`
hoặc `src/`). Skill scan mọi `require()` / `import` và confirm resolve được
trên disk.

**Mandatory sau khi**:
- rename / move file
- tạo file mới
- refactor module
- edit `import` / `require`

Nếu skill báo ≥ 1 broken import → fix → re-run → mới tiếp.

### 2. Type check (mandatory)

```bash
cd <backend-dir> && npx tsc --noEmit
```

Zero type errors. `any` không phải fix — thay bằng real type.

### 3. SOLID checklist (mandatory)

Walkthrough `solid-backend-nodejs` → `references/solid-checklist.md`.
Mỗi ✅ phải verifiable (point vào file/line chứng minh).

### Nếu bất kỳ bước nào fail

KHÔNG claim completion. Fix → chạy lại cả 3 → report results.

### Tại sao có pipeline này

Runtime "Cannot find module" sau refactor là time-waster lớn nhất trong
codebase history. 30 giây verify tránh 30 phút debug. Không optional.

---

## Common Pitfalls

<!-- TODO: điền khi phát sinh incident. Để Claude học từ past mistakes. -->
<!-- Ví dụ: -->
<!-- 1. Missing `.js` in import → runtime error -->
<!-- 2. Mongoose call inside controller "just for one endpoint" -->
<!-- 3. `any` on `req.body` → mất type safety -->
<!-- 4. `new ConcreteRepo()` inside service → hidden dependency -->

1. <pitfall 1>
2. <pitfall 2>

---

## When Claude is unsure

- Architecture question → `solid-backend-nodejs/references/solid-checklist.md`
- Folder layout → `solid-backend-nodejs/references/folder-structure.md`
- Adding new file → matching template trong `solid-backend-nodejs/templates/`
- Verify correctness → chạy 3-step verification pipeline ở trên
