---
name: code-review
description: Ensure code quality through structured reviews, edge case detection, and evidence-based verification. Use before PRs, after implementing features, or when claiming task completion.
---

# 🔍 Code Review Skill

**Context:** Use this skill for all code quality assessment activities in SAP CAP/BTP projects.

## Core Principles

**YAGNI** · **KISS** · **DRY** — Always.

- **Technical rigor over social comfort** — No performative agreement ("Great point!")
- **Verify before implementing** — Ask before assuming
- **Evidence before claims** — Fresh verification output required
- **Be honest, be direct, be concise**

## Four Practices

| Practice | When | Reference |
|----------|------|-----------|
| Receiving Feedback | External PR comments, unclear suggestions | `resources/code-review-reception.md` |
| Requesting Review | After tasks, before merge, stuck on problem | `resources/requesting-code-review.md` |
| Edge Case Scouting | After implementation, before review | `resources/edge-case-scouting.md` |
| Verification Gates | Before any completion claim | `resources/verification-before-completion.md` |
| **CAP Review Checklist** | During code review | `resources/cap-review-checklist.md` |

## CAP Standards References

Before reviewing, familiarize yourself with team standards:

| Domain | Standard |
|--------|----------|
| Backend | [backend-guidelines.md](../../guidelines/backend-guidelines.md) |
| Frontend | [design-guidelines.md](../../guidelines/design-guidelines.md) |
| Code | [coding-standards.md](../../rules/coding-standards.md) |
| Testing | [testing-guidelines.md](../../guidelines/testing-guidelines.md) |
| Security | [security-guidelines.md](../../guidelines/security-guidelines.md) |

## Quick Decision Tree

```
SITUATION?
│
├─ Received feedback → STOP if unclear, verify if external, implement if human partner
├─ Completed work → Scout edge cases → Request code review
└─ About to claim status → RUN verification command FIRST
```

## CAP-Specific Verification Checklist

| Check | Command | What to Verify |
|-------|---------|----------------|
| Lint | `npm run lint` | 0 errors/warnings |
| Build | `npm run build` | Exit 0, no TypeScript errors |
| CDS Build | `cds build` | Schema compiles, no CDS errors |
| Unit Tests | `npm test` | All tests pass |
| E2E Tests | `npm run test:e2e` | All scenarios pass |
| MTA Build | `mbt build` | `.mtar` generated successfully |

## CAP-Specific Review Focus

- **CDS Modeling:** Entity relationships, aspects, compositions vs. associations
- **Event Handlers:** Draft handling, `$expand` depth, request interception
- **Authorization:** XSUAA scopes, `@requires` annotations, role checks
- **OData Patterns:** Navigation paths, filters, query performance
- **HANA Queries:** Native artifacts, indexes, full-text search

## Bottom Line

1. Technical correctness over social performance
2. Scout edge cases before review
3. Evidence before claims

**Verify. Scout. Question. Then implement. Evidence. Then claim.**

