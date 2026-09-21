---
name: code-review-react
description: TypeScript/React code review and verification for any React UI project. ALWAYS run npm run typecheck after editing any file. Covers type safety patterns, import discipline, and component prop contracts.
---

# ⚛️ React / TypeScript Code Review Skill

**Context:** Use this skill when editing any file inside the React UI project (`app/*/src/`).

## Core Rule

> **After EVERY code edit — run `npm run typecheck` before reporting done.**

Vite's esbuild bundler skips type checking. Code can build successfully and crash at runtime.
`npm run typecheck` (`tsc -b`) is the only command that catches all errors.

## Four Practices

| Practice | When | Reference |
|----------|------|-----------|
| Post-Edit Typecheck | After every file edit | Run `npm run typecheck` directly |
| Type Error Patterns | When fixing TS errors | See patterns below |
| Component Contracts | Before passing props between components | See patterns below |
| Import Discipline | When adding/moving imports | See patterns below |

## Verification Checklist

| Check | Command | Pass Condition |
|-------|---------|----------------|
| **TypeScript** | `npm run typecheck` | Exit 0, zero errors |
| **Review pages** | `npx tsc -b 2>&1 \| Select-String "pages/"` | No output |
| **Lint** | `npm run lint` | 0 errors |
| **Build** | `npm run build` | Exit 0 (runs typecheck first) |

## Quick Decision Tree

```
AFTER EDITING CODE?
│
├─ Edited .tsx / .ts file → RUN npm run typecheck FIRST
│    ├─ Errors in pages/Review → Fix before anything else
│    ├─ Errors in other folders → Note and report to user
│    └─ No errors → Continue
│
├─ Added new import → CHECK: is it `import type` or `import`?
│    ├─ Importing a function/class/value → MUST be `import { x }`
│    └─ Importing only a type → `import type { T }` is fine
│
└─ Passing props to a component → VERIFY prop types match exactly
     ├─ null vs undefined → component interface specifies which
     └─ Union literal types → use `as const` or explicit cast
```

## React/TypeScript Red Flags

- `import type { service }` where `service` is called at runtime → **RUNTIME CRASH**
- `error: msg` where `msg: string | undefined` but state is `string | null` → **TS error**
- `{ ...list[i] }` where `list: unknown[]` → **Spread error TS2698**
- Local interface duplicates shared type with different field optionality → **Silent mismatch**
- `schema={schema}` where `schema: T | null` but prop is `T | undefined` → **TS error**

## Bottom Line

1. Run `npm run typecheck` — always, no exceptions
2. Fix errors in `pages/Review` before anything else
3. Never use `import type` for runtime values (verbatimModuleSyntax is ON)
4. Check `null` vs `undefined` when passing to component props

**Edit → Typecheck → Fix → Done.**
