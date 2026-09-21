---
description: Audit and fix hardcoded user-facing text, replacing them with i18n translation keys using react-i18next
---

# Hardcoded Text Audit & Fix Workflow

Use this workflow to find and replace hardcoded user-facing text with `t()` translation keys.
Run from the **frontend project root** (the folder containing `tsconfig.app.json` and `src/`).

**Stack:** `react-i18next` with `useTranslation()` / `t()`, translations in `src/locales/en.json` and `src/locales/de.json`.

---

## Phase 1: Discovery — Auto-Detect Affected Folders

### 1a. ESLint Scan (primary — catches JSX text, attributes, single words, mixed expressions)

This is the most comprehensive check. It uses the `i18next/no-literal-string` ESLint rule.

// turbo
```bash
node ../../.agent/workflows/scripts/scan_hardcoded.cjs
```

### 1b. Grep Scan (supplementary — catches toast/alert and patterns ESLint may miss)

ESLint `jsx-text-only` mode does **not** check function call arguments like `toast.success("...")`. This grep step catches those.

// turbo
```bash
echo "--- Pattern G1: JSX text content (>Word Word</) (same-line) ---" && grep -rn --include="*.tsx" -P ">\s*[A-Z][a-z]+(\s+[a-zA-Z]+)+\s*</" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | grep -v "{t(" | grep -v "className" | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -30 && echo "" && echo "--- Pattern G2: Hardcoded title/placeholder/label attributes ---" && grep -rn --include="*.tsx" -P '(title|placeholder|label|aria-label)="[A-Z][a-z]' src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | grep -v "{t(" | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -20 && echo "" && echo "--- Pattern G3: Hardcoded strings in toast/alert messages (.tsx + .ts) ---" && grep -rn --include="*.tsx" --include="*.ts" -P "(toast\.(success|error|warning|info)|alert)\s*\(\s*['\"]" src/pages/ src/components/ src/hooks/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | grep -v "t(" | head -20 && echo "" && echo "--- Pattern G4: Multi-line JSX text (standalone capitalized text on its own line) ---" && grep -rn --include="*.tsx" -P "^\s+[A-Z][a-z]+(\s+[A-Za-z]+)*\s*$" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | grep -v "{t(" | grep -v "className" | grep -v "import " | grep -v "//" | grep -v "\*" | grep -v "interface " | grep -v "export " | grep -v "const " | grep -v "return" | head -20 && echo "" && echo "--- Affected Folders Summary ---" && { grep -rl --include="*.tsx" -P ">\s*[A-Z][a-z]+(\s+[a-zA-Z]+)+\s*</" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null; grep -rl --include="*.tsx" -P "^\s+[A-Z][a-z]+(\s+[A-Za-z]+)*\s*$" src/pages/ src/components/common/ src/components/filterbar/ 2>/dev/null; grep -rl --include="*.tsx" --include="*.ts" -P "(toast\.(success|error|warning|info)|alert)\s*\(\s*['\"]" src/pages/ src/components/ src/hooks/ 2>/dev/null; } | grep -v "node_modules" | grep -v "demos/" | sed 's|/[^/]*$||' | sort -u | while read dir; do count=$( { grep -rn --include="*.tsx" -P ">\s*[A-Z][a-z]+(\s+[a-zA-Z]+)+\s*</" "$dir" 2>/dev/null; grep -rn --include="*.tsx" -P "^\s+[A-Z][a-z]+(\s+[A-Za-z]+)*\s*$" "$dir" 2>/dev/null; grep -rn --include="*.tsx" --include="*.ts" -P "(toast\.(success|error|warning|info)|alert)\s*\(\s*['\"]" "$dir" 2>/dev/null; } | grep -v "demos/" | grep -v "{t(" | sort -u | wc -l); if [ "$count" -gt 0 ]; then echo "  📁 $dir — $count instance(s)"; fi; done
```

After running **both 1a and 1b**, the agent should:

1. **Merge results** from ESLint + grep into a unified list of affected files/folders
2. **Create a task list** in `task.md` with one task per affected folder
3. **Process each folder** as a separate phase below

> [!IMPORTANT]
> Not all matches are real issues. **Skip** the following:
> - Component names (e.g. `<ScrollArea>`)
> - CSS class strings
> - Technical props / enum values
> - Demo files / showcase pages
> - Text inside `{t('...')}` already
> - shadcn/ui primitives (these are usually false positives from ESLint)

---

## Phase 2: Fix — Process Each Affected Folder

For **each folder** discovered in Phase 1, repeat these sub-steps:

### 2a. List Hardcoded Text in Current Folder

Use **both** ESLint and grep to get the full picture for each folder.

// turbo
```bash
echo "=== ESLint i18next warnings for <FOLDER_PATH> ===" && npx eslint "<FOLDER_PATH>" -f compact 2>/dev/null | grep "no-literal-string" && echo "" && echo "=== Grep: JSX Text (same-line) ===" && grep -rn --include="*.tsx" -P ">\s*[A-Z][a-z]+(\s+[a-zA-Z]+)+\s*</" <FOLDER_PATH> 2>/dev/null | grep -v "demos/" | grep -v "{t(" && echo "" && echo "=== Grep: Multi-line JSX Text ===" && grep -rn --include="*.tsx" -P "^\s+[A-Z][a-z]+(\s+[A-Za-z]+)*\s*$" <FOLDER_PATH> 2>/dev/null | grep -v "demos/" | grep -v "{t(" | grep -v "import " | grep -v "//" | grep -v "\*" | grep -v "interface " | grep -v "export " | grep -v "const " | grep -v "return" && echo "" && echo "=== Grep: Title/Placeholder/Label Attributes ===" && grep -rn --include="*.tsx" -P '(title|placeholder|label|aria-label)="[A-Z][a-z]' <FOLDER_PATH> 2>/dev/null | grep -v "demos/" | grep -v "{t(" && echo "" && echo "=== Grep: Toast/Alert Messages (.tsx + .ts) ===" && grep -rn --include="*.tsx" --include="*.ts" -P "(toast\.(success|error|warning|info)|alert)\s*\(\s*['\"]" <FOLDER_PATH> 2>/dev/null | grep -v "demos/" | grep -v "t("
```

Replace `<FOLDER_PATH>` with the actual folder path from Phase 1.

### 2b. View & Fix Each File

For each file with hardcoded text:

1. `view_file` to see the context around each hardcoded string
2. Determine if it is **user-facing** (needs i18n) or **technical** (skip)
3. Choose a translation key following the **Key Naming Convention** below
4. Replace the hardcoded text with `{t('key')}` or `t('key')`
5. Add the `useTranslation` import and hook if not already present
6. Add the key + English value to `src/locales/en.json`
7. Add the key + German value to `src/locales/de.json` (translate or leave English as placeholder)
8. After fixing files in the folder, run `npm run i18n:scan` to auto-sync any new `t()` keys into the locale files

### 2c. Verify Folder is Clean

Run **both** ESLint and grep to confirm the folder is clean.

// turbo
```bash
echo "--- ESLint check for <FOLDER_PATH> ---" && lint_count=$(npx eslint "<FOLDER_PATH>" -f json 2>/dev/null | node ../../.agent/workflows/scripts/scan_eslint.cjs | grep -oP '\d+' | head -1) && echo "  ESLint i18next warnings: $lint_count" && echo "" && echo "--- Grep check for <FOLDER_PATH> ---" && grep_count=$( { grep -rn --include="*.tsx" -P ">\s*[A-Z][a-z]+(\s+[a-zA-Z]+)+\s*</" <FOLDER_PATH> 2>/dev/null; grep -rn --include="*.tsx" -P "^\s+[A-Z][a-z]+(\s+[A-Za-z]+)*\s*$" <FOLDER_PATH> 2>/dev/null | grep -v "import " | grep -v "//" | grep -v "\*" | grep -v "interface " | grep -v "export " | grep -v "const " | grep -v "return"; grep -rn --include="*.tsx" --include="*.ts" -P "(toast\.(success|error|warning|info)|alert)\s*\(\s*['\"]" <FOLDER_PATH> 2>/dev/null; } | grep -v "demos/" | grep -v "{t(" | grep -v "className" | sort -u | wc -l) && echo "  Grep matches: $grep_count" && echo "" && if [ "$lint_count" -eq 0 ] && [ "$grep_count" -eq 0 ]; then echo "  ✅ PASS — folder is clean"; else echo "  ⚠️  Review needed ($lint_count lint + $grep_count grep)"; fi
```

**Target: 0** on both ESLint and grep. Mark the folder as `[x]` in `task.md`.

---

## Phase 3: Final Verification

Run ESLint on the **entire project** plus grep for toast/alert patterns.

// turbo
```bash
echo "========================================" && echo "  FINAL VERIFICATION" && echo "========================================" && echo "" && echo "--- ESLint i18next/no-literal-string (page-level files only) ---" && npx eslint src/pages/ src/components/common/ src/components/filterbar/ -f json 2>/dev/null | node ../../.agent/workflows/scripts/scan_eslint.cjs && echo "" && echo "--- Grep: Toast/Alert (cases ESLint misses) ---" && toast_count=$(grep -rn --include="*.tsx" --include="*.ts" -P "(toast\.(success|error|warning|info)|alert)\s*\(\s*['\"]" src/pages/ src/components/ src/hooks/ 2>/dev/null | grep -v "node_modules" | grep -v "demos/" | grep -v "t(" | wc -l) && echo "  Toast/alert hardcoded: $toast_count" && echo "" && echo "--- Translation file consistency ---" && en_keys=$(cat src/locales/en.json | grep -c '":') && de_keys=$(cat src/locales/de.json | grep -c '":') && echo "  en.json: $en_keys keys" && echo "  de.json: $de_keys keys" && if [ "$en_keys" -eq "$de_keys" ]; then echo "  ✅ Key count matches"; else echo "  ⚠️  Key count mismatch — check for missing translations"; fi
```

### 3b. Sync & detect missing translations

Run `i18next-scanner` to find `t()` keys in code that are **not yet in the locale files**, then check for empty values.

// turbo
```bash
echo "--- Syncing t() keys with locale files ---" && npm run i18n:scan && echo "" && echo "--- Missing translations (empty values in en.json) ---" && en_missing=$(grep -c '""' src/locales/en.json 2>/dev/null || echo 0) && echo "  en.json empty values: $en_missing" && echo "" && echo "--- Missing translations (empty values in de.json) ---" && de_missing=$(grep -c '""' src/locales/de.json 2>/dev/null || echo 0) && echo "  de.json empty values: $de_missing" && echo "" && if [ "$en_missing" -eq 0 ] && [ "$de_missing" -eq 0 ]; then echo "  ✅ All t() keys have translations"; else echo "  ⚠️  Missing translations found — listing keys with empty values:"; echo ""; echo "  en.json:"; grep -n '""' src/locales/en.json 2>/dev/null | head -20; echo ""; echo "  de.json:"; grep -n '""' src/locales/de.json 2>/dev/null | head -20; fi
```

### 3c. TypeScript check — catches missing `useTranslation` imports

If a file uses `t()` but never imported `useTranslation` or destructured `t`, TypeScript will report `TS2304: Cannot find name 't'`.

> [!IMPORTANT]
> You **must** use `-p tsconfig.app.json` because the root `tsconfig.json` uses project references with `"files": []` and does **not** check frontend files.

// turbo
```bash
echo "--- TypeScript check for missing t() imports ---" && tsc_errors=$(npx tsc -p app/cnma_ai_agent_extraction_ui/tsconfig.app.json --noEmit 2>&1 | grep "Cannot find name 't'" | wc -l) && echo "  Missing t() imports: $tsc_errors" && echo "" && if [ "$tsc_errors" -eq 0 ]; then echo "  ✅ All t() usages have matching imports"; else echo "  ⚠️  Files with missing useTranslation hook:"; npx tsc -p app/cnma_ai_agent_extraction_ui/tsconfig.app.json --noEmit 2>&1 | grep "Cannot find name 't'" | sed 's/:.*//;s|app/cnma_ai_agent_extraction_ui/||' | sort -u; echo ""; echo "  Fix: Add 'const { t } = useTranslation();' inside the component function."; fi
```

**Auto-fix pattern**: For each file reported, the agent should:
1. Open the file and find the component that uses `t()`
2. Check if `useTranslation` is imported — if not, add `import { useTranslation } from 'react-i18next';`
3. Check if `const { t } = useTranslation();` exists in the component — if not, add it at the top of the component body

---

## Translation Key Naming Convention

Use **dot-separated, lowercase** keys grouped by page/component:

```
{page}.{section}.{element}
```

### Examples

| Hardcoded Text | Translation Key |
|---------------|----------------|
| `>Document Review<` in Review page | `review.title` |
| `>Upload Files<` button in Dashboard | `dashboard.actions.uploadFiles` |
| `>No results found<` in table | `common.noResults` |
| `placeholder="Search..."` in filter | `common.search` |
| `>Save Changes<` button | `common.actions.save` |
| `>Are you sure?<` in dialog | `common.confirmDialog.title` |
| `title="Delete Item"` | `common.actions.delete` |
| `>Field is required<` validation | `validation.required` |
| `toast.success("Saved!")` | `common.messages.saved` |

### Key Prefixes

| Prefix | Usage |
|--------|-------|
| `dashboard.*` | Dashboard page |
| `review.*` | Review page |
| `emailInbox.*` | Email Inbox page |
| `trainingCenter.*` | Training Center page |
| `schemaEditor.*` | Schema Editor page |
| `referenceData.*` | Reference Data page |
| `common.*` | Shared across pages |
| `common.actions.*` | Buttons, links |
| `common.messages.*` | Toast/alert messages |
| `common.labels.*` | Form labels |
| `common.status.*` | Status texts |
| `validation.*` | Validation messages |

---

## Implementation Patterns

### Basic JSX Text
```diff
- <h1>Document Review</h1>
+ <h1>{t('review.title')}</h1>
```

### Attribute Strings
```diff
- <Input placeholder="Search documents..." />
+ <Input placeholder={t('common.search')} />
```

### Template Literals with Variables
```diff
- <span>{count} documents found</span>
+ <span>{t('dashboard.documentsFound', { count })}</span>
```

In `en.json`:
```json
"dashboard": {
  "documentsFound": "{{count}} documents found"
}
```

### Toast Messages
```diff
- toast.success("Document saved successfully");
+ toast.success(t('common.messages.documentSaved'));
```

### Adding useTranslation Hook

If a file doesn't have the hook yet:
```tsx
import { useTranslation } from 'react-i18next';

// Inside the component:
const { t } = useTranslation();
```

---

## What to Skip (False Positives)

- **Component names:** `<ScrollArea>`, `<CardContent>`, `<AlertDescription>`
- **CSS classes:** `className="flex items-center"`
- **Technical values:** `type="button"`, `variant="ghost"`, `value="default"`
- **Console/debug strings:** `console.log("Loaded")`
- **Demo/sample files:** anything in `demos/` folder
- **Already translated:** contains `{t(` or `t(`
- **Code-only strings:** enum values, API endpoints, field keys

---

## Translation File Reference

| File | Purpose |
|------|---------|
| `src/locales/en.json` | English translations (primary) |
| `src/locales/de.json` | German translations |
| `src/i18n.ts` | i18n configuration |

When adding keys, maintain the **same nested structure** in both files.
Always add to **both** `en.json` and `de.json` simultaneously.
