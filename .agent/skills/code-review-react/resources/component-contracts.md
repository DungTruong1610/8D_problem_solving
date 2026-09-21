---
name: component-contracts
description: Rules for passing props between React components in cnma_ai_agent_extraction_ui. Focus on null vs undefined, function signature matching, and shared vs local type definitions.
---

# Component Prop Contracts

## Core Principle

**Never assume — verify the component's interface before passing props.**

Read the `interface XxxProps` or `type XxxProps` definition in the target component.
Mismatches cause TS2322 errors or silent type coercion bugs.

## Common Mismatches

### null vs undefined

```ts
// Component expects:
interface Props { schema?: ObjectSchema }  // undefined only

// Parent passes:
const { data: schema } = useQuery(...)  // data: ObjectSchema | undefined | null

// ❌ TS2322 if schema can be null
<Component schema={schema} />

// ✅ coerce null to undefined
<Component schema={schema ?? undefined} />
```

### Extra props that don't exist

```ts
// ❌ ReassignDialog doesn't have reassignName prop
<ReassignDialog reassignName={state.reassignName} ... />

// ✅ remove the prop — check the Props interface
<ReassignDialog ... />
```

### Function signature mismatch

```ts
// Component expects:
identitySearch: (query: string) => Promise<Result[]>

// Hook provides:
searchPrincipals(principalType: string, query: string): Promise<Result[]>

// ❌ Wrong — too many arguments
<Dialog identitySearch={searchPrincipals} />

// ✅ Wrap with adapter
<Dialog identitySearch={(query) => searchPrincipals(currentType, query)} />
```

### Local interface duplicates shared type

```ts
// ❌ Redefining PostingRecord locally — status is required here, optional in shared
interface PostingRecord {
  recordId: string;
  status: string;  // ← required, but shared type has status?: string
}

// ✅ Import and extend from shared type
import type { PostingRecord } from '../../types/review.types';
// Use it directly, or extend only the fields that differ:
interface LocalRecord extends PostingRecord {
  extraDisplayField?: string;
}
```

## Shared Types Location

Always check these before creating a new local interface:

| Shared type | File |
|-------------|------|
| `PostingRecord` | `src/pages/Review/types/review.types.ts` |
| `PrincipalSearchResult` | `src/pages/Review/types/review.types.ts` |
| `DocumentWithWorkflow` | `src/pages/Review/types/review.types.ts` |
| `ExtractedData`, `FieldData` | `src/services/domain/extraction/extraction.types.ts` |
| `ObjectSchema` (= `Schema`) | `src/services/domain/extraction/extraction.types.ts` |

## Before Passing Any Prop

1. Open the target component file
2. Find the `interface XxxProps` definition
3. Check exact types — especially `null` vs `undefined`, optional vs required
4. Run `npm run typecheck` after editing
