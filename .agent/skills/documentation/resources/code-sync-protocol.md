---
name: code-sync-protocol
description: Protocol for keeping documentation in sync with code changes.
---

# Code-to-Documentation Sync Protocol

When code changes, documentation must follow. This protocol defines what to update and when.

## Update Triggers

| Code Change | Documentation to Update |
|-------------|-------------------------|
| **New CDS entity** | `data-dictionary.md`, `api-reference.md` |
| **New/modified field** | `data-dictionary.md` |
| **New action/function** | `api-reference.md` |
| **New OData endpoint** | `api-reference.md` |
| **New/modified handler** | `backend-handoff.md` (if API contract changes) |
| **New UI feature** | `user-manual/`, `CHANGELOG.md` |
| **Security change** | `security-layers.md`, `configuration.md` |
| **Config change** | `configuration.md` |
| **New workflow/status** | `process-flows/` |

## Sync Workflow

```
CODE CHANGE MERGED
│
├─ Is it user-visible?
│   ├─ Yes → Update `docs/product/` + `CHANGELOG.md`
│   └─ No  → Continue
│
├─ Does it change API?
│   ├─ Yes → Update `docs/technical/reference/api-reference.md`
│   └─ No  → Continue
│
├─ Does it add/modify entities?
│   ├─ Yes → Update `docs/business/data-dictionary.md`
│   └─ No  → Continue
│
├─ Does it change architecture?
│   ├─ Yes → Update `docs/technical/architecture/`
│   └─ No  → Continue
│
└─ Update `CHANGELOG.md` with change description
```

## CAP-Specific Triggers

### CDS Schema Changes (`db/`)

| CDS Change | Update |
|------------|--------|
| New entity | `data-dictionary.md` — add entity description |
| New aspect | `core-components.md` — document pattern |
| New enum | `data-dictionary.md` — list valid values |
| Association change | `api-reference.md` — update navigation |

### Service Changes (`srv/`)

| Service Change | Update |
|----------------|--------|
| New action | `api-reference.md` — add endpoint, params, response |
| Handler logic | Only if API contract changes |
| Security annotation | `security-layers.md`, `configuration.md` |

## Verification Before Claiming Complete

After updating docs:
- [ ] All code references verified
- [ ] Examples tested
- [ ] Links working
- [ ] CHANGELOG.md entry added
