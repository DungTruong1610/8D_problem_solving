---
name: accuracy-protocol
description: Evidence-based documentation protocol. Verify before writing to prevent inventing APIs.
---

# Documentation Accuracy Protocol

**Principle:** Only document what you can verify exists in the codebase.

## Evidence-Based Writing

Before documenting any code reference, verify it exists:

| Documenting | Verification Command |
|-------------|---------------------|
| Function/class | `grep -r "function {name}\|class {name}" srv/` |
| API endpoint | Check route definitions in `srv/*.cds` |
| Config key | Verify in `.env.example` or `package.json` |
| CDS entity | Check `db/schema.cds` or `db/*.cds` files |
| File reference | Confirm file exists before linking |

## Red Flags (Stop & Verify)

**STOP and verify if you're about to:**
- Write `functionName()` without seeing it in code
- Document API response format without checking actual code
- Link to files you haven't confirmed exist
- Describe env vars not in `.env.example`
- Quote parameter names from memory

## Conservative Output Strategy

| Certainty Level | Action |
|-----------------|--------|
| Verified (saw the code) | Document in full detail |
| Uncertain (didn't check) | Describe high-level intent only |
| Ambiguous (code is unclear) | Note "implementation may vary" |
| Unknown (can't find) | **Don't document it** |

## CAP-Specific Verification

### Before Documenting Entities
```bash
# Verify entity exists
grep -r "entity {EntityName}" db/
```

### Before Documenting Actions
```bash
# Verify action exists in service definition
grep -r "action {actionName}" srv/*.cds
```

### Before Documenting Handlers
```bash
# Verify handler implementation
grep -r "{actionName}" srv/handlers/
```

### Before Documenting API Fields
```bash
# Check cds-typer generated types
grep -r "{fieldName}" srv/@cds-models/
```

## Internal Link Hygiene

**Rules:**
- Only use `[text](./path.md)` for files that exist in `docs/`
- For code files, verify path before documenting
- Prefer relative links within `docs/`
- Test all links after writing

## Self-Validation Checklist

After completing documentation:

- [ ] All function/class references exist in codebase
- [ ] All API endpoints verified in service definitions
- [ ] All config references exist in `.env.example`
- [ ] All file links point to existing files
- [ ] No invented parameter names or return types
- [ ] Examples tested and working

## Common Mistakes

| Mistake | Prevention |
|---------|------------|
| Invented API | Run grep before documenting |
| Wrong parameter name | Check generated types |
| Outdated endpoint | Verify in `srv/*.cds` |
| Broken link | Check file exists before linking |
| Ghost config | Compare with `.env.example` |
