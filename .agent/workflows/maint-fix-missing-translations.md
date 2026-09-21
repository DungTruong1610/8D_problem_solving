---
description: Automatically discover missing i18n keys from the source code and inject fallback translations into en.json
---

# Fix Missing Translations Workflow

Use this workflow to automatically fill in translations for keys that exist in the code (`t('key')`) but are missing from the `en.json` file. The workflow scans the code, auto-generates Title Case fallback strings, and outputs a task report to the UI's `tasks` folder.

---

## Auto-Fix Command

Run this command from the **frontend project root** (the directory containing `app/` folder) to analyze the UI codebase, generate a report, and fix all missing strings in `en.json`.

// turbo
```bash
node .workflows/scripts/fix_missing_translations.cjs
```

### What this script does:
1. Dynamically scans the entire UI's `src` codebase for any occurrences of `t('...')` and `i18nKey="..."`.
2. Recursively flattens the `en.json` dict and checks against it.
3. Automatically computes safe, human-readable Title Case English fallback strings (e.g., `docAnalytics.byType` -> `"By Type"`).
4. Safely overrides the `en.json` with exactly those keys (in alphabetical order).
5. Outputs an accountability markdown report at `<ui-project>/tasks/missing-translation-tasks.md` listing exactly what was mapped and autocompleted so that any nuances can be manually verified.

> **Note on Team Usage:**
> The script determines absolute file paths cleanly via Node's `__dirname`. It does not contain arbitrarily hardcoded workstation roots (`C:\Users\...`), ensuring maximum platform independence for any teammates or CI routines!
