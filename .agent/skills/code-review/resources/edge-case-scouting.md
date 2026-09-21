---
name: edge-case-scouting
description: Proactive detection of edge cases, side effects, and potential issues before code review. Use after implementation, especially for multi-file changes or shared utility refactors.
---

# Edge Case Scouting

Proactive detection of edge cases, side effects, and potential issues before code review.

## Purpose

Code reviews catch obvious issues but miss subtle side effects. Scouting detects:
- Files affected by changes reviewer might not check
- Data flow paths that could break
- Boundary conditions and error paths
- Integration issues across modules

## When to Use

**Mandatory:** Multi-file features, shared utility refactors, complex bug fixes, CDS model changes
**Optional:** Single-file changes, docs, config updates

## Process

### 1. Identify Changed Files
```bash
git diff --name-only HEAD~1
```

### 2. Analyze Impact Areas

For each changed file, investigate:

```
1. Files importing/depending on changed modules
2. Data flow paths through modified functions
3. Error handling paths not tested
4. Boundary conditions (null, empty, max)
5. Race conditions in async code
6. State management side effects
```

### 3. CAP-Specific Edge Cases

| Change Type | Scout For |
|-------------|-----------|
| CDS Entity | Association consumers, navigation paths, draft handlers |
| Service Handler | `$expand` depth, async operations, transaction boundaries |
| Authorization | Scope propagation, role inheritance, annotation coverage |
| HANA Artifacts | Index usage, query performance, full-text configs |
| External API | Timeout handling, retry logic, error mapping |

### 4. Document Findings

```markdown
## Scout Findings
- **Issues found:** [list]
- **Verified:** [what was checked]
- **Addressed:** [what was fixed]
- **Needs review:** [remaining concerns]
```

## Scout Prompts by Change Type

**Feature Implementation:**
```
Scout edge cases for [feature].
Changed: [files]
Find: consumers, error states, untested inputs, performance, OData compatibility
```

**Bug Fix:**
```
Scout side effects of fix in [file].
Bug: [description], Fix: [approach]
Find: other paths using this logic, dependent features, similar bugs elsewhere
```

**CDS Refactor:**
```
Scout breaking changes in [entity/service].
Before: [old structure], After: [new structure]
Find: navigation consumers, handler impacts, Fiori UI bindings
```

## What Edge Case Scouting Catches

| Issue | Why Missed in Review | Scouting Detects |
|-------|----------------------|------------------|
| Indirect dependencies | Not in diff | Traces imports and usages |
| Race conditions | Hard to spot statically | Analyzes async flows |
| State mutations | Hidden side effects | Tracks data paths |
| Missing null checks | Assumed safe | Boundary analysis |
| OData nav breaks | Out of review scope | Cross-service search |
| Draft entity issues | Complex lifecycle | Draft event tracing |

## Red Flags

- Shared utility changed but only one caller tested
- Error path leads to unhandled rejection
- State modified in place without event emission
- CDS association changed without handler update
- Authorization scope added without UI check

## Example

```
1. Done: Add caching to DocumentService.getDocument()
2. Diff: srv/services/DocumentService.ts
3. Scout: "edge cases for caching in getDocument()"
4. Report:
   - DetailController expects fresh data on edit save
   - BatchProcessor loops getDocument() (memory risk)
   - No cache clear on updateDocument()
   - Draft scenarios not considered
5. Fix: Add invalidation on update, maxSize limit, draft bypass
6. Document for code review
```

## Bottom Line

Scout before review. Don't trust "simple changes" — scout them anyway.
