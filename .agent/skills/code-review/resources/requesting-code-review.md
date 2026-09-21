---
name: requesting-code-review
description: Protocol for dispatching code review requests. Use after completing tasks, major features, or before merging to main branch.
---

# Requesting Code Review

Dispatch structured code review requests to catch issues before they cascade.

**Core principle:** Scout first, review often.

## When to Request Review

**Mandatory:**
- After each task in multi-step development
- After completing major feature
- Before merge to main
- After CDS model changes

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

### 0. Scout Edge Cases First
```
Before requesting review, analyze:
- Files affected by changes (not just modified files)
- Data flow paths that could break
- Edge cases and boundary conditions
- Potential side effects

See: resources/edge-case-scouting.md
```

### 1. Get Git SHAs
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

### 2. Prepare Review Request

Provide structured context:

```markdown
## Code Review Request

**What:** [Brief description of implementation]
**Plan/Requirements:** [Reference to task or requirements doc]
**Base SHA:** [starting commit]
**Head SHA:** [ending commit]
**Scout Findings:** [Edge cases discovered]

### Changed Files
- [list key files]

### CAP-Specific Concerns
- CDS Changes: [entity/service modifications]
- Handler Changes: [event handler updates]
- Security: [authorization changes]
- Performance: [query or processing changes]
```

### 3. Review Checklist for CAP

| Area | Check |
|------|-------|
| CDS Model | Associations valid, aspects applied, compositions correct |
| Handlers | Draft events handled, `$expand` depth considered |
| Authorization | `@requires` annotations, scope checks |
| OData | Navigation paths work, filters perform |
| TypeScript | Types generated (`cds-typer`), no `any` abuse |
| Tests | Unit tests added, E2E scenarios covered |

### 4. Act on Feedback

- Fix **Critical** issues immediately
- Fix **Important** issues before proceeding
- Note **Minor** issues for later
- Push back if reviewer is wrong (with reasoning)

## Priority Matrix

| Priority | Definition | Action |
|----------|------------|--------|
| Critical | Security vulnerability, data loss, breaking change | Fix immediately |
| High | Performance issue, type safety, missing error handling | Fix before proceeding |
| Medium | Code smell, maintainability, documentation gap | Fix in this PR |
| Low | Style, minor optimization | Note for later |

## Example

```
[Just completed: Add document classification service]

1. Scout edge cases for classification changes
2. Get SHAs:
   BASE_SHA=a7981ec
   HEAD_SHA=3df7661

3. Request review:
   What: Document classification with AI extraction
   Plan: Task 3 from docs/plans/ai-integration.md
   Scout: Found missing null check on confidence score
   
   CAP Concerns:
   - CDS: New ClassificationResult entity with association to Document
   - Handler: Async AI call with timeout handling
   - Security: Admin scope required for reprocessing action

4. Reviewer returns:
   Strengths: Clean async handling, good error mapping
   High: Missing retry logic for AI timeout
   Medium: Consider batch processing for bulk operations
   
5. Fix: Add retry with exponential backoff
6. Continue to next task
```

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed High-priority issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

## Integration with Workflows

- **Feature Development:** Review after each major component
- **Bug Fixes:** Review before merge
- **Refactoring:** Review at each phase boundary
