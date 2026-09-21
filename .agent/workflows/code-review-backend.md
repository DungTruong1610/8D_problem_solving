---
description: Perform a structured code review for backend (db/ and srv/) only
---

# Backend Code Review Workflow

Use this workflow for reviewing CDS models and CAP service changes only (no frontend).

## 1. Identify Backend Changes

Get the list of changed files in `db/` and `srv/`.
```bash
git diff --name-only HEAD~1 -- db/ srv/
```

## 2. Scout CAP Edge Cases

Before reviewing, analyze potential side effects:
- CDS entity and association changes
- Handler impact on existing consumers
- Draft entity lifecycle side effects
- HANA query performance implications
- Authorization scope propagation

Reference: `skills/code-review/resources/edge-case-scouting.md`

## 3. Run Backend Verification Commands

// turbo-all
```bash
npm run lint
```

```bash
npm run build
```

```bash
cds build
```

```bash
npm test
```

## 4. Review Against CAP Backend Checklist

Key checks for `db/` and `srv/`:

### CDS Schema (`db/`)
- [ ] Entity has `cuid`, `managed` aspects
- [ ] Associations vs. compositions used correctly
- [ ] Inline enums for fixed state values
- [ ] `LargeString` for JSON, `LargeBinary` for files

### Service Logic (`srv/`)
- [ ] No `any` types — `cds-typer` generated types used
- [ ] Logic separated: Handler (orchestration) vs Processor (business logic)
- [ ] Service extends `cds.ApplicationService` with `init()`
- [ ] Correct hook usage: `before` (validation), `on` (custom), `after` (enrichment)
- [ ] `cds.queued()` for background tasks (NOT `cds.spawn`)

### HANA & Database
- [ ] Fluent API used (`SELECT`, `INSERT`, `UPDATE`, `DELETE`)
- [ ] Raw SQL only for vector operations
- [ ] **UPPERCASE** table/column names in raw HANA SQL
- [ ] No N+1 queries

### Security
- [ ] `@requires` annotations for authorization
- [ ] i18n keys for all user-facing messages

## 5. Generate Review Report

```markdown
## Backend Code Review Summary

### Scope
- CDS Changes: [db/ files]
- Service Changes: [srv/ files]

### Verification Status
- Lint: [pass/fail]
- Build: [pass/fail]
- CDS Build: [pass/fail]
- Tests: [pass/fail]

### Issues Found
- Critical: [list]
- High: [list]

### Recommended Actions
1. [prioritized fixes]
```

## 6. Completion

If all verifications pass, backend is ready for review.
