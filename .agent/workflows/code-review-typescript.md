---
description: Run TypeScript compilation check (noEmit) on the frontend and auto-fix errors
---

# TypeScript Compilation Review & Fix Workflow

Use this workflow to detect and fix TypeScript errors in the frontend application.
Run from the **project root** (the monorepo folder containing `app/` and `srv/`).

> [!IMPORTANT]
> You **must** use `-p app/cnma_ai_agent_extraction_ui/tsconfig.app.json` because the root `tsconfig.json` uses project references with `"files": []` and does **not** check frontend files.

---

## Phase 1: Run TypeScript Check

// turbo
```bash
echo "========================================" && echo "  TYPESCRIPT COMPILATION CHECK" && echo "========================================" && echo "" && npx tsc -p app/cnma_ai_agent_extraction_ui/tsconfig.app.json --noEmit 2>&1 | tee /tmp/tsc-output.txt && echo "" && error_count=$(grep -c "error TS" /tmp/tsc-output.txt 2>/dev/null | tail -1 || echo 0) && echo "--- Summary ---" && echo "  Total errors: $error_count" && if [ "$error_count" -eq 0 ]; then echo "  ✅ No TypeScript errors"; else echo ""; echo "  By error code:"; grep -oP 'error TS\d+' /tmp/tsc-output.txt | sort | uniq -c | sort -rn; echo ""; echo "  By file:"; grep 'error TS' /tmp/tsc-output.txt | sed 's/(.*//;s|app/cnma_ai_agent_extraction_ui/||' | sort | uniq -c | sort -rn; fi
```

---

## Phase 2: Auto-Fix Each Error Type

After Phase 1, process each error type. Common patterns:

### TS2304: Cannot find name 'X'

Usually means a missing import or hook. Most common case: `Cannot find name 't'`.

**Fix pattern:**
1. Open the file and find the component that uses `t()`
2. Check if `useTranslation` is imported — if not, add `import { useTranslation } from 'react-i18next';`
3. Check if `const { t } = useTranslation();` exists **inside the component** — if not, add it at the top of the component body
4. ⚠️ If a file has **multiple components**, each one needs its own `const { t } = useTranslation();`

### TS2305: Module has no exported member 'X'

A named export is missing from the source module.

**Fix pattern:**
1. Open the source module and check if the type/function exists
2. If it exists but isn't exported, add `export`
3. If it was renamed, update the import to use the new name
4. If it was removed, remove the import and fix usages

### TS2322: Type 'X' is not assignable to type 'Y'

**Fix pattern:**
1. Check the expected type at the usage site
2. Check what type is actually being passed
3. Fix with type assertion, type guard, or correct the data flow

### TS2339: Property 'X' does not exist on type 'Y'

**Fix pattern:**
1. Check if the property was renamed — update usage
2. Check if the interface is missing the property — add it
3. Check if needs optional chaining (`?.`) for possibly undefined types

---

## Phase 3: Verify

Re-run the check to confirm all errors are resolved.

// turbo
```bash
echo "--- Re-checking TypeScript ---" && error_count=$(npx tsc -p app/cnma_ai_agent_extraction_ui/tsconfig.app.json --noEmit 2>&1 | grep -c "error TS" || echo 0) && echo "  Errors remaining: $error_count" && if [ "$error_count" -eq 0 ]; then echo "  ✅ All TypeScript errors resolved"; else echo "  ⚠️  Still has errors — re-run Phase 1 for details"; fi
```
