---
name: typecheck-workflow
description: How and when to run TypeScript type checking in cnma_ai_agent_extraction_ui. Vite builds do NOT check types — this must be done manually.
---

# TypeScript Check Workflow

## The Golden Rule

**Run after every code edit. No exceptions.**

```powershell
# CWD: ai-agent-extraction/app/cnma_ai_agent_extraction_ui/
npm run typecheck
```

This runs `tsc -b`. Exit code 0 = clean. Any other exit code = errors to fix.

## Why This Matters

| Tool | Checks Types? |
|------|--------------|
| `vite build` | ❌ No — esbuild transpiles only |
| `tsc --noEmit` | ⚠️ Partial — misses project references |
| `tsc -b` (= `npm run typecheck`) | ✅ Full check |
| IDE / Language Server | ✅ Yes — but only for open files |

The tsconfig has `verbatimModuleSyntax: true`. This means `import type { fn }`
is ERASED at runtime — calling `fn()` will throw `TypeError: fn is not a function`.
TypeScript does NOT warn about this unless you run `tsc -b`.

## Scoped Checks (Faster)

```powershell
# Only errors in the Review page:
npx tsc -b 2>&1 | Select-String "pages/Review"

# Only errors in a specific file:
npx tsc -b 2>&1 | Select-String "ArrayFieldRenderer"
```

## Build Script Integration

The `package.json` scripts are configured as:

```json
"typecheck":  "tsc -b",
"build":      "npm run typecheck && vite build && npm run zip",
"build:mta":  "npm run typecheck && vite build",
"build-dev":  "vite build"
```

- `build` and `build:mta` → typecheck runs first, will FAIL on type errors
- `build-dev` → NO typecheck, use only for local dev iteration

## Interpreting Output

```
src/pages/Review/index.tsx(857,36): error TS2345: ...
└── File path (line, col)          └── Error code and message

Exit code: 1   ← Errors present, do not proceed
Exit code: 0   ← Clean, safe to proceed
```

## Checklist Before Reporting Done

- [ ] `npm run typecheck` exits 0
- [ ] No errors under `pages/Review`
- [ ] No new `import type` on runtime values
- [ ] Props passed to components match their interface exactly
