---
description: Audit existing documentation for accuracy and completeness, update outdated docs, create missing docs
---

# Documentation Audit Workflow

Use this workflow to bring documentation up-to-date with the current codebase.

## Prerequisites

- Access to `docs/` directory
- Access to `srv/`, `db/`, `app/` for code verification

---

## 1. Scan Documentation Structure

List all existing documentation:
```bash
find docs/ -name "*.md" -type f | head -50
```

## 2. Identify Code Changes Since Last Doc Update

Check what code changed recently:
```bash
git log --since="30 days ago" --name-only --pretty=format: -- db/ srv/ app/ | sort -u | head -30
```

## 3. Cross-Reference: Code vs Docs

For each category, verify documentation matches code:

### CDS Entities → Data Dictionary
```bash
# List all CDS entities
grep -rh "entity " db/*.cds | grep -v "//" | head -20
```
Compare with `docs/business/data-dictionary.md`

### Service Actions → API Reference
```bash
# List all actions and functions
grep -rh "action \|function " srv/*.cds | head -20
```
Compare with `docs/technical/reference/api-reference.md`

### Handlers → Backend Handoff
```bash
# List all handler files
ls -la srv/handlers/
```
Compare with `docs/technical/implementation/backend-handoff.md`

---

## 4. Generate Audit Report

Create a report with findings:

```markdown
## Documentation Audit Report

**Date:** [today]
**Auditor:** Documentation Manager

### Coverage Summary
| Category | Expected | Found | Gap |
|----------|----------|-------|-----|
| Entities | X | Y | Z missing |
| Actions | X | Y | Z missing |
| Workflows | X | Y | Z missing |

### Outdated Documents
- `docs/technical/reference/api-reference.md` — Missing action X
- `docs/business/data-dictionary.md` — Entity Y not documented

### Missing Documents
- No user guide for feature Z
- No process flow for workflow W

### Recommended Actions (Priority Order)
1. [Critical] Update api-reference.md with new endpoints
2. [High] Add entity X to data-dictionary.md
3. [Medium] Create user guide for feature Y
```

---

## 5. Update Outdated Documents

For each outdated document:
1. Open the document
2. Compare with current code
3. Update sections that are stale
4. Add "Last Updated" date

## 6. Create Missing Documents

For each missing document:
1. Identify the correct location (product/business/technical)
2. Use appropriate template from documentation skill
3. Write content following accuracy protocol (verify before documenting)
4. Add to relevant README index

---

## 7. Validation

After completing updates:
- [ ] All new entities documented
- [ ] All new actions documented
- [ ] No broken internal links
- [ ] CHANGELOG.md updated
- [ ] README indexes updated with new docs

---

## Example Usage

Tell the Documentation Manager:

```
@Documentation Manager 
Run /doc-audit for the project.
Focus on:
1. Review all docs in docs/technical/ for accuracy
2. Compare entities in db/schema.cds with data-dictionary.md
3. Update or create any missing documentation
```

Or more specific:

```
@Documentation Manager
The invoice extraction feature was added last month.
Audit docs to ensure:
- API endpoints are documented
- Data dictionary includes new entities
- User guide covers the new feature
```
