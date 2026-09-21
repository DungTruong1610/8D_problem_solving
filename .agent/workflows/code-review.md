---
description: Perform a structured code review with edge case scouting and verification gates
---

# Code Review Workflow

Use this workflow after implementing a feature or before creating a Pull Request.

## 1. Identify Changes

Get the list of changed files for review scope.
```bash
git diff --name-only HEAD~1
```

## 2. Scout Edge Cases

Before reviewing, analyze potential side effects:
- Files importing/depending on changed modules
- CDS association navigation impacts
- Draft entity side effects
- OData `$expand` depth issues
- Authorization scope omissions

Reference: `skills/code-review/resources/edge-case-scouting.md`

## 3. Run Verification Commands

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

## 4. Review Against CAP Checklist

Open and verify each item in the checklist:
- Reference: `skills/code-review/resources/cap-review-checklist.md`

Key checks:
- [ ] Entity has `cuid`, `managed` aspects
- [ ] No `any` types — `cds-typer` generated types used
- [ ] Logic separated (Handler vs Processor)
- [ ] `cds.queued()` for background tasks (not `cds.spawn`)
- [ ] HANA raw SQL uses UPPERCASE identifiers
- [ ] Integration test covers new endpoint

## 5. Generate Review Report

Create a structured review summary:

```markdown
## Code Review Summary

### Scope
- Files: [list changed files]
- Focus: [feature/fix/refactor]

### Verification Status
- Lint: [pass/fail]
- Build: [pass/fail]
- CDS Build: [pass/fail]
- Tests: [pass/fail]

### Issues Found
- Critical: [list]
- High: [list]
- Medium: [list]

### Recommended Actions
1. [prioritized fixes]
```

## 6. Completion

If all verifications pass and issues are addressed:
- Code is ready for Pull Request
- Run `/dev-pr-validation` for final check
