---
name: node-verify-import
description: |
  Verifies that all require() and import paths in a Node.js project resolve to
  actual files on disk. Catches broken imports caused by file renames, refactoring,
  or copy-paste errors — before they blow up at runtime.

  ALWAYS trigger this skill when the user asks to:
  - Vietnamese: kiểm tra import, verify import, check require, import bị hỏng, lỗi module not found,
    kiểm tra path import, xác minh require, sau khi đổi tên file, sau refactor, trước khi commit
  - English: verify imports, check broken imports, validate require paths, check module resolution,
    find broken require, scan imports, after renaming files, before commit import check
  - Also trigger proactively when: running a code review skill, finishing a refactor,
    user reports "Cannot find module" errors, or user asks to validate code after restructuring files.

  Works with any Node.js / CAP / SAP project. Supports CommonJS (require) and ES module (import) syntax.
metadata:
  version: 1.0.0
  author: Leo
---

# Skill: node-verify-import

Scans `.js` and `.ts` files for `require()` / `import` statements and verifies every local
path actually exists on disk. Reports broken imports with file name and line number so they
can be fixed immediately.

---

## Step 1 — Detect Language

Check the user's message language:
- Vietnamese → respond in Vietnamese ("Anh/chị")
- English → respond in English
- Default → English

---

## Step 2 — Determine Scan Target

Ask the user which directory to scan **only if** it's not already clear from context.
Use `AskUserQuestion` with these options:

| Option | Description |
|--------|-------------|
| `srv/` (Recommended) | Standard CAP backend folder |
| `src/` | Typical frontend / other Node project |
| Whole project | Scan everything (slower) |
| Custom | Let user type a path |

If the user already mentioned a path (e.g., "check imports in `lib/`"), skip this step and
use that path directly.

---

## Step 3 — Run the Verification Script

Run the bundled script using the Bash tool:

```bash
node <skill_dir>/scripts/verify-imports.js [--dir <target_dir>] [--ext js,ts] [--skip node_modules,generated,dist]
```

**Full example:**
```bash
node /path/to/skill/scripts/verify-imports.js --dir srv
```

The script auto-detects the project root as `process.cwd()`. It resolves `--dir` relative
to that root, so run the command **from the project root** (or use an absolute path for `--dir`).

**CLI flags (all optional):**

| Flag | Default | Description |
|------|---------|-------------|
| `--dir` | `srv` | Directory to scan |
| `--ext` | `js,ts` | File extensions to check (comma-separated) |
| `--skip` | `node_modules,generated,service-specifications,dist,.git` | Dirs to exclude |
| `--json` | off | Output machine-readable JSON instead of human text |

---

## Step 4 — Interpret and Report Results

**If 0 broken imports:**

> "✅ Tất cả imports hợp lệ! / ✅ All imports are valid!"
> Show total files scanned and total requires checked.

**If broken imports found:**

Group errors by file for readability. Show:
- Relative file path + line number
- The broken `require("...")` path
- What path it resolved to (to help the user understand what's wrong)

Then suggest likely causes:
- File was renamed but require wasn't updated
- Wrong relative path (`../` vs `./`)
- Missing `.js` extension in the require path
- File exists as `.ts` but required as `.js`

---

## Step 5 — Offer to Fix (Optional)

If broken imports were found, offer:

1. **Show fix suggestions** — list the corrected require paths side-by-side
2. **Auto-fix** — update the files using Edit tool (ask confirmation first)
3. **Skip** — user just wanted the report

---

## Important Notes for All Agents

- Always run the script via `node`, not by executing it directly
- The script uses only Node.js built-ins (`fs`, `path`) — no `npm install` needed
- If the scan directory doesn't exist, the script exits with code 0 and prints a warning (not an error) — this is intentional for CI use
- Exit code 1 = broken imports found; exit code 0 = all good
- The script skips comment lines (`//`, `*`) to avoid false positives
- It checks three candidate paths for each require: `path`, `path.js`, `path/index.js`
