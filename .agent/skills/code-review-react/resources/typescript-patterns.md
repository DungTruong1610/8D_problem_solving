---
name: typescript-patterns
description: Common TypeScript error patterns in cnma_ai_agent_extraction_ui and their fixes. Reference when encountering TS errors in the Review page or extraction services.
---

# TypeScript Error Patterns

Recurring errors found in `cnma_ai_agent_extraction_ui` and how to fix them.

## Pattern 1 — `string | undefined` vs `string | null` (TS2345)

**Error:**
```
Type 'string | undefined' is not assignable to type 'string | null'.
  Type 'undefined' is not assignable to type 'string | null'.
```

**Cause:** API error messages are typed as `string | undefined`. State is typed as `string | null`.

**Fix:**
```ts
// ❌ error
const msg = err.response?.data?.error?.message || err.message;
setState(prev => ({ ...prev, error: msg }));

// ✅ fix — coerce with ?? null
setState(prev => ({ ...prev, error: msg ?? null }));
```

---

## Pattern 2 — Spread of `unknown` (TS2698)

**Error:**
```
Spread types may only be created from object types.
```

**Cause:** `list[i]` from `unknown[]` is `unknown`. TypeScript can't spread `unknown`.

**Fix:**
```ts
// ❌ error
const obj = { ...list[i] };

// ✅ fix — cast before spread
const obj = { ...(list[i] as Record<string, unknown>) };
```

---

## Pattern 3 — `import type` on runtime value (TS + runtime crash)

**Error:** No TS error (tsconfig allows it) but **app crashes at runtime**.

**Cause:** `verbatimModuleSyntax: true` erases `import type` entirely.

**Fix:**
```ts
// ❌ RUNTIME CRASH — extractionService is undefined at runtime
import type { extractionService } from '@/services/domain/extraction/extractionService';
extractionService.executeDynamicAction(...); // TypeError!

// ✅ value import — preserved at runtime
import { extractionService } from '@/services/domain/extraction/extractionService';
```

**Rule:** Only use `import type` when you NEVER call or instantiate the import.

---

## Pattern 4 — `null` vs `undefined` in component props (TS2322)

**Error:**
```
Type 'ObjectSchema | null | undefined' is not assignable to type 'ObjectSchema | undefined'.
  Type 'null' is not assignable to type 'ObjectSchema | undefined'.
```

**Cause:** `useQuery` returns `data: T | undefined`. But props can return `null` too.

**Fix:**
```ts
// ❌ error — schema could be null from useQuery result
<Component schema={schema} />

// ✅ fix — coerce null to undefined
<Component schema={schema ?? undefined} />
```

---

## Pattern 5 — Index signature on `{}` (TS7053)

**Error:**
```
Element implicitly has an 'any' type because expression of type 'string'
can't be used to index type '{}'.
```

**Cause:** Spread of `unknown` gives `{}` which has no index signature.

**Fix:**
```ts
// ❌ error
const obj = { ...item };    // item: unknown → obj: {}
obj[fieldName] = value;     // can't index {}

// ✅ fix — cast at spread point
const obj = { ...(item as Record<string, unknown>) };
obj[fieldName] = value;     // ✅ Record<string, unknown> is indexable
```

---

## Pattern 6 — Union literal narrowed to `string` (TS2322)

**Error:**
```
Type 'string' is not assignable to type '"USER" | "GROUP"'.
```

**Cause:** Object literal `{ type: 'USER' }` infers `type: string`.

**Fix:**
```ts
// ❌ inferred as string
const result = { id: '1', name: 'Alice', type: 'USER' };

// ✅ fix — use as const
const result = { id: '1', name: 'Alice', type: 'USER' as const };
```

---

## Pattern 7 — Missing exported type (TS2305)

**Error:**
```
Module '"./useSchema"' has no exported member 'Schema'.
```

**Cause:** `useSchema.ts` didn't export a `Schema` type.

**Fix:** Add to `useSchema.ts`:
```ts
import type { ObjectSchema } from '@/services/domain/extraction/extraction.types';
export type Schema = ObjectSchema;
```

---

## Shared Types Reference

| Type | Location |
|------|----------|
| `ExtractedData` | `extraction.types.ts` |
| `FieldData` | `extraction.types.ts` |
| `ObjectSchema` / `Schema` | `extraction.types.ts` / `hooks/useSchema.ts` |
| `PostingRecord` | `pages/Review/types/review.types.ts` |
| `PrincipalSearchResult` | `pages/Review/types/review.types.ts` |
| `DocumentLegacy` / `DocumentWithWorkflow` | `pages/Review/types/review.types.ts` |
