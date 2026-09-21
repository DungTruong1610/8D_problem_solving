---
description: Validate documentation for broken links, invented APIs, and missing config keys
---

# Validate Documentation

Use this workflow to check documentation quality before merging.

## Usage

```bash
# Validate docs/ directory (default)
node scripts/validate-docs.cjs

# Validate specific directory
node scripts/validate-docs.cjs docs/technical

# Specify source directories to search for code
node scripts/validate-docs.cjs docs --src srv,db,app
```

## What It Checks

| Check | What It Does |
|-------|--------------|
| **Code References** | Verifies `functionName()` and `ClassName` exist in codebase |
| **Internal Links** | Ensures `[text](./path.md)` point to existing files |
| **Config Keys** | Confirms `ENV_VAR` exist in `.env.example` |

## Default Source Directories

The script searches for code references in:
- `srv/` (CAP services)
- `db/` (CDS models)
- `app/` (Frontend)

## Example Output

```
## Docs Validation Report

**Files Checked:** 15
**Scan Date:** 2024-02-06

### Potential Issues

⚠️ **Code References** (2 issues)
- `extractInvoice()` in technical/api-reference.md:45 - not found in codebase
- `DocumentProcessor` in technical/architecture.md:23 - not found in codebase

⚠️ **Internal Links** (1 issues)
- `./deleted-file.md` in business/process-flows.md:12 - file not found

### Verified OK

✅ 45 code references validated
✅ 32 internal links working
✅ 8 config keys confirmed
```

## Integration

### In Documentation Audit
Add to `/doc-audit` workflow:
```bash
node scripts/validate-docs.cjs docs
```

### In PR Checklist
Add to `pr-requirements.md`:
- [ ] Run `node scripts/validate-docs.cjs` with no issues

### In Documentation Manager
```
@Documentation Manager
After updating docs, validate with:
node scripts/validate-docs.cjs docs
```
