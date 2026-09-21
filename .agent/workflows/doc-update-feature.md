---
description: Update all relevant documentation after completing a new feature development
---

# Post-Feature Documentation Update

Use this workflow immediately after completing a new feature, before creating a PR.

---

## 1. Identify What Changed

List all files you modified for this feature:
```bash
git diff --name-only develop
```

Categorize changes:
- **CDS entities** (`db/`)
- **Service logic** (`srv/`)
- **UI components** (`app/`)
- **Configuration** (`mta.yaml`, `package.json`, etc.)

---

## 2. Update Technical Documentation

### If you added/modified CDS entities:
Update `docs/technical/reference/core-components.md`
- Add entity description
- Document key fields
- Note any associations

### If you added/modified API endpoints:
Update `docs/technical/reference/api-reference.md`
- Add endpoint path
- Document request/response format
- Include example payloads

### If you changed architecture:
Update `docs/technical/architecture/`
- Update system diagrams
- Document new components
- Update data flow if applicable

### If you changed configuration:
Update `docs/technical/reference/configuration.md`
- Document new env variables
- Update security settings if applicable

---

## 3. Update Business Documentation

### If you added new workflow/status:
Create/update in `docs/business/process-flows/`
- Add Mermaid flow diagram
- Document decision points
- **NO code allowed**

### If you added new entities:
Update `docs/business/data-dictionary.md`
- Add entity in plain language
- List key fields with descriptions
- **NO technical implementation details**

---

## 4. Update Product Documentation

### If you added user-visible feature:
Create/update in `docs/product/user-manual/`
- Write step-by-step guide
- Add screenshots if helpful
- Use non-technical language

### If you changed admin settings:
Update `docs/product/admin-guide/`
- Document new configuration options
- Explain when to use them

---

## 5. Update CHANGELOG

Add entry to `CHANGELOG.md`:

```markdown
## [Unreleased]

### Added
- [Feature Name] - Brief description (#issue-number)

### Changed
- [What changed] - Why it matters

### Fixed
- [Bug fix] - What was wrong
```

---

## 6. Update README Indexes

If you created new docs, add links to:
- `docs/README.md`
- `docs/technical/README.md` (for technical docs)
- `docs/business/README.md` (for business docs)
- `docs/product/README.md` (for product docs)

---

## 7. Verification Checklist

Before creating PR:
- [ ] Technical docs updated for code changes
- [ ] Business docs updated (if workflow/entity changes)
- [ ] Product docs updated (if user-visible changes)
- [ ] CHANGELOG.md has entry
- [ ] No broken internal links
- [ ] All code references verified to exist
- [ ] "Last Updated" date refreshed

---

## Quick Reference: What to Update

| Change Type | Documentation to Update |
|-------------|-------------------------|
| New entity | `data-dictionary.md`, `core-components.md` |
| New action | `api-reference.md` |
| New status flow | `process-flows/` + Mermaid diagram |
| New UI feature | `user-manual/`, `CHANGELOG.md` |
| Config change | `configuration.md` |
| Security change | `security-layers.md`, `admin-guide/` |
| Any change | `CHANGELOG.md` |

---

## Example Usage

After completing invoice extraction feature:

```
@Documentation Manager
I just completed the invoice extraction feature. Changes include:
- New InvoiceHeader and InvoiceLine entities
- New extractInvoice action
- New status flow: UPLOADED → EXTRACTING → EXTRACTED → REVIEWED

Please update all relevant documentation following /doc-update-feature workflow.
```
