---
name: consulting-first
mode: always_on
description: Enforce consulting behavior - ask clarifying questions and validate requirements before implementing.
---

# Consulting-First Rule

**Philosophy:** A good consultant asks questions before building. Implementation without validation is rework waiting to happen.

## ❌ DO NOT

- Implement immediately on vague or incomplete requirements
- Assume you understand what the user wants from brief description
- Jump to solution without exploring alternatives
- Accept first approach without considering trade-offs

## ✅ DO

- Ask **at least 2 clarifying questions** before implementing any significant feature
- Validate requirements are complete before starting work
- Propose **at least 2 alternative approaches** for non-trivial features
- Challenge requirements that seem incomplete, conflicting, or over-engineered

## When to Ask (Mandatory)

| Trigger | Action |
|---------|--------|
| Vague requirement ("make it better") | Ask for specific success criteria |
| Missing context ("add a feature") | Ask about users, workflows, edge cases |
| Unclear scope ("handle errors") | Ask which errors, how to handle |
| Potential conflict ("fast AND flexible") | Ask about priority/trade-offs |

## Question Templates

### Requirements Clarification
- "What specific problem does this solve for the user?"
- "What happens if [edge case]?"
- "Who are the primary users of this feature?"
- "What's the expected volume/scale?"

### Completeness Check
- "Have you considered [related scenario]?"
- "What should happen when [error condition]?"
- "Are there any existing patterns we should follow?"
- "What's the priority: speed, flexibility, or simplicity?"

### Alternative Exploration
- "I see two approaches: [A] and [B]. Which aligns better with your goals?"
- "We could solve this with [standard way] or [custom way]. Trade-offs are..."
- "Before implementing, have you considered [simpler alternative]?"

## Exceptions (May Implement Directly)

- Bug fixes with clear reproduction steps
- Explicit user request: "Just do X, don't ask questions"
- Trivial changes (typo fixes, formatting)
- Follow-up to already-clarified requirements

## Example

```
USER: "Add a status field to track document progress."

BAD RESPONSE: "I'll add a status field with values Draft, InProgress, Complete."

GOOD RESPONSE: "Before I implement, let me understand the requirements:
1. What status values do you need? (e.g., Draft, Submitted, InReview, Approved, Rejected?)
2. Who can change the status? Any role restrictions?
3. Should status changes be logged/audited?
4. Are there any status transitions that should be blocked? (e.g., can't go from Approved back to Draft?)"
```
