---
name: code-review-reception
description: Protocol for receiving and handling code review feedback. Use when external reviewers comment on PRs, suggestions are unclear, or feedback needs technical verification.
---

# Code Review Reception

**Core principle:** Verify before implementing. Ask before assuming. Technical correctness over social comfort.

## Response Pattern

```
1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One at a time, test each
```

## Forbidden Responses

❌ "You're absolutely right!" / "Great point!" / "Thanks for [anything]"
❌ "Let me implement that now" (before verification)

✅ Restate technical requirement
✅ Ask clarifying questions
✅ Push back with technical reasoning
✅ Just start working (actions > words)

## Handling Unclear Feedback

```
IF any item unclear:
  STOP - don't implement anything
  ASK for clarification on ALL unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

## Source-Specific Handling

**Human partner:** Trusted — implement after understanding, no performative agreement

**External reviewers:**
```
BEFORE implementing:
  1. Technically correct for THIS codebase?
  2. Breaks existing functionality?
  3. Reason for current implementation?
  4. Works with CAP/HANA/BTP stack?

IF wrong: Push back with technical reasoning
IF can't verify: State limitation, ask direction
IF conflicts with team decisions: Stop, discuss first
```

## YAGNI Check

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage
  IF unused: "This isn't called. Remove it (YAGNI)?"
  IF used: Implement properly
```

## CAP-Specific Verification Points

Before implementing reviewer suggestions, verify:

| Suggestion Area | Verify Against |
|-----------------|----------------|
| CDS entity changes | Existing associations, compositions |
| Handler modifications | Draft lifecycle, `$expand` implications |
| Authorization changes | XSUAA scopes, existing `@requires` |
| OData API changes | Navigation paths, filter expressions |
| HANA query changes | Index availability, query plan |

## Implementation Order

```
1. Clarify unclear items FIRST
2. Implement: blocking → simple → complex
3. Test each individually (npm test)
4. Verify no regressions (cds build, npm run build)
```

## When To Push Back

- Breaks existing OData navigation or associations
- Reviewer lacks CAP/BTP context
- Violates YAGNI (unused feature)
- Technically incorrect for CAP stack
- Conflicts with existing aspects/compositions
- Breaks authorization model

**How:** Technical reasoning, specific questions, reference working tests

## Acknowledging Correct Feedback

✅ "Fixed. [Brief description]"
✅ "Good catch — [issue]. Fixed in [location]."
✅ Just fix it (actions > words)

❌ ANY gratitude or performative expression

## Bottom Line

External feedback = suggestions to evaluate, not orders.
Verify. Question. Then implement.
