---
description: Perform a comprehensive frontend code review — i18n, design tokens, shadcn usage, TypeScript, code quality
---

# Frontend Code Review Workflow

Use this workflow to review any React + TypeScript + Tailwind frontend application in this repository.
Run from the **frontend project root** (the folder containing `tsconfig.app.json` and `src/`).

## 1. TypeScript Type Checking

// turbo
```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | head -80
```

Report all type errors grouped by file. These are **critical** — must fix.

## 2. Hardcoded Text (Missing i18n)

Scan page/component files for user-facing text not wrapped in `t()`.

// turbo
```bash
grep -rn --include="*.tsx" -E ">\s*[A-Z][a-z]+(\s+[a-zA-Z]+)+\s*</" src/pages/ src/components/common/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -60
```

**What to flag:**
- JSX text like `>Submit Form</` not using `{t('key')}`
- Button labels, headings, descriptions, placeholder attributes, error messages
- **Ignore:** demo files, CSS classes, component names, constants

Report: `| File:Line | Hardcoded Text |`

## 3. Hardcoded Colors (Design Token Violations)

Scan for Tailwind color classes that bypass semantic design tokens.

// turbo
```bash
grep -rn --include="*.tsx" -E "(text|bg|border|ring|shadow)-(red|blue|green|yellow|orange|purple|pink|indigo|teal|cyan|lime|emerald|violet|fuchsia|rose|amber|sky|white|black)-?[0-9]*" src/pages/ src/components/common/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -60
```

**What to flag:**
- `text-red-500`, `bg-blue-100`, `border-green-300` — should use `text-destructive`, `bg-primary`, `border-border`
- `text-white`/`bg-black` — should use `text-primary-foreground`/`bg-background`
- **Ignore:** StatusConfig.tsx (color picker by design), demo files, dark mode overrides (`dark:bg-green-900/40`)

Correct alternatives: `text-foreground`, `bg-primary`, `bg-muted`, `text-muted-foreground`, `border-border`, `text-destructive`, `bg-accent`, `text-primary-foreground`

Report: `| File:Line | Hardcoded Color |`

For a deep fix workflow, run `/code-review-hard-code-color`.

## 3b. Arbitrary Pixel / Sizing Values (Zero-Tolerance)

Scan for arbitrary Tailwind values that hardcode pixel sizes instead of using the spacing/sizing scale.

// turbo
```bash
grep -rn --include="*.tsx" -E "class(Name)?=\"[^\"]*\[[0-9]+(px|rem|em|vh|vw|%)\][^\"]*\"" src/pages/ src/components/common/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -60
```

// turbo
```bash
grep -rn --include="*.tsx" -E "\[(w|h|p|m|gap|text|max-w|min-w|max-h|min-h|top|left|right|bottom)-\[[0-9]" src/pages/ src/components/common/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -40
```

// turbo
```bash
grep -rn --include="*.tsx" -E "style=\{\{[^}]*(padding|margin|width|height|font-size|gap)[^}]*[0-9]px" src/pages/ src/components/common/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -40
```

**What to flag:**
- `w-[600px]`, `h-[42px]`, `p-[10px]`, `gap-[6px]`, `text-[14px]` — use Tailwind scale instead
- `bg-[#b10e10]`, `text-[#6a6d70]` — use semantic tokens (`bg-primary`, `text-muted-foreground`)
- `style={{ padding: '10px', width: '600px' }}` — convert to Tailwind utilities

**Replacement guide:**
| Arbitrary | Scale Alternative |
|---|---|
| `p-[8px]` | `p-2` |
| `p-[10px]` | `p-2.5` |
| `gap-[6px]` | `gap-1.5` |
| `w-[600px]` | `w-full max-w-2xl` |
| `h-[42px]` | `h-10` (40px) or `h-11` (44px) |
| `text-[14px]` | `text-sm` |

For a deep fix workflow, run `/code-review-hard-code-pixel`.

Report: `| File:Line | Arbitrary Value | Suggested Replacement |`

## 4. Raw HTML Elements (Should Use shadcn)

Scan for raw HTML elements that have project UI component replacements.

// turbo
```bash
grep -rn --include="*.tsx" -P "<(button|input|select|textarea|table|label|dialog)\b" src/pages/ src/components/common/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | grep -v 'type="file"' | grep -v 'type="hidden"' | head -40
```

**Replacement map:**
| Raw HTML | Use Instead |
|---|---|
| `<button>` | `<Button>` from `@/components/ui/button` |
| `<input>` | `<Input>` from `@/components/ui/input` |
| `<select>` | `<Select>` from `@/components/ui/select` |
| `<textarea>` | `<Textarea>` from `@/components/ui/textarea` |
| `<table>` | `<Table>` from `@/components/ui/table` |
| `<label>` | `<Label>` from `@/components/ui/label` |
| `<dialog>` | `<Dialog>` from `@/components/ui/dialog` |

**Exceptions:** `<input type="file">`, `<input type="hidden">`, elements inside third-party wrappers

Report: `| File:Line | Raw Element | Suggested Component |`

## 5. Code Quality Checks

### 5a. Console statements
// turbo
```bash
grep -rn --include="*.tsx" --include="*.ts" "console\.\(log\|warn\|error\|debug\|info\)" src/pages/ src/components/ src/hooks/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -30
```

### 5b. Loose `any` types
// turbo
```bash
grep -rn --include="*.tsx" --include="*.ts" -E "(: any\b|as any\b|<any>)" src/pages/ src/hooks/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | head -30
```

### 5c. TODO / FIXME / HACK comments
// turbo
```bash
grep -rn --include="*.tsx" --include="*.ts" -iE "(TODO|FIXME|HACK|XXX|WORKAROUND):" src/ 2>/dev/null | grep -v "node_modules" | head -20
```

### 5d. Large files (> 400 lines — consider splitting)
// turbo
```bash
find src/pages/ src/components/ src/hooks/ -name "*.tsx" -o -name "*.ts" | xargs wc -l 2>/dev/null | sort -rn | head -15
```

## 6. Generate Review Report

After running all checks, compile a final review report with:

### Severity Levels
- 🔴 **Critical** — Type errors, runtime bugs (must fix before merge)
- 🟡 **Warning** — i18n gaps, hardcoded colors, raw HTML (should fix)
- 🟢 **Info** — console.log, `any` types, TODOs, large files (plan to fix)

### Report Template
```markdown
## Frontend Code Review Report

### Summary
| Category | Count | Severity |
|---|---|---|
| TypeScript errors | X | 🔴 |
| Arbitrary pixels/sizes `[10px]` | X | 🔴 |
| Arbitrary hex colors `[#xxx]` | X | 🔴 |
| Hardcoded text (i18n) | X | 🟡 |
| Hardcoded Tailwind colors | X | 🟡 |
| Raw HTML elements | X | 🟡 |
| Console statements | X | 🟢 |
| `any` type usage | X | 🟢 |
| TODOs/FIXMEs | X | 🟢 |
| Large files (>400L) | X | 🟢 |

### Critical Issues
[list type errors]

### Warnings
[list i18n/color/html issues by file]

### Suggestions
[console.log cleanup, any reduction, file splitting recommendations]
```

## 7. Completion

If all critical issues are resolved:
- Code is ready for PR review
- Run `/dev-pr-validation` for final check
