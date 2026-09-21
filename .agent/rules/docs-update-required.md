---
name: docs-update-required
mode: always_on
description: Enforces documentation updates after completing feature development
---

# Documentation Update Rule

## Mandatory Requirement

**After completing ANY code change** (new feature, enhancement, or significant bug fix), you MUST update the relevant documentation before considering the task complete.

---

## Checklist (Before Marking Task Complete)

```markdown
## Documentation Update Checklist
- [ ] Is this a user-visible change? → Update `docs/product/`
- [ ] Does this change workflows/processes? → Update `docs/business/process-flows/`
- [ ] Does this change the API? → Update `docs/technical/reference/api-reference.md`
- [ ] Does this add a new component? → Update `docs/technical/reference/component-reference.md`
- [ ] Does this change configuration? → Update `docs/technical/reference/configuration.md`
- [ ] Does this change architecture? → Update `docs/technical/architecture/`
- [ ] Is this a bug fix? → Add entry to `CHANGELOG.md`
```

---

## Documentation Location Guide

| Change Type | Update Location |
|-------------|-----------------|
| New API endpoint | `docs/technical/reference/api-reference.md` |
| New UI component | `docs/technical/reference/component-reference.md` |
| New workflow/status | `docs/business/process-flows/` |
| New user feature | `docs/product/user-manual/` |
| Admin feature | `docs/product/admin-guide/` |
| Architecture change | `docs/technical/architecture/` |
| Config change | `docs/technical/reference/configuration.md` |
| Security change | `docs/technical/architecture/security-layers.md` |
| Any release change | `CHANGELOG.md` |

---

## Example Enforcement

When you complete a coding task, explicitly state:

```
✅ Code changes complete.

📝 Documentation updates:
- Updated `docs/technical/reference/api-reference.md` with new endpoint
- Added entry to `CHANGELOG.md`

Task is now complete.
```

---

## No Exceptions

- Small changes → At minimum update `CHANGELOG.md`
- Bug fixes → Update `CHANGELOG.md` with fix description
- Refactoring → If behavior changes, update relevant docs

**If no documentation is updated, the task is NOT complete.**
