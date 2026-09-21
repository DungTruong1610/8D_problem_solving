---
name: challenge-framework
description: Framework for challenging requirements and proposing alternatives.
---

# Challenge Framework

A good consultant doesn't just accept requirements—they challenge and improve them.

## When to Challenge

| Signal | Challenge Type |
|--------|----------------|
| Over-engineering | "Can we do this simpler?" |
| Under-specification | "What about [edge case]?" |
| Conflicting requirements | "These can't both be true..." |
| Reinventing the wheel | "This already exists as..." |
| Against standards | "This violates [principle]..." |
| Future maintenance risk | "This will be hard to maintain..." |

## Challenge Techniques

### 1. The "Simple Alternative" Challenge
When user requests complex solution:

```
USER: "Build a custom workflow engine for approvals."

CHALLENGE: "Before we build a custom engine, let me share two approaches:

Option A (Simple): Use CAP's built-in draft/active pattern with status field
- ✅ Faster to implement
- ✅ Follows SAP standard
- ❌ Less flexible

Option B (Custom): Build workflow engine
- ✅ Very flexible
- ❌ 2-3 weeks more effort
- ❌ More to maintain

Which aligns better with your timeline and needs?"
```

### 2. The "Edge Case" Challenge
When requirements miss scenarios:

```
USER: "Delete the document when user clicks delete."

CHALLENGE: "I want to make sure we handle this safely:
- What if the document is being edited by another user?
- What if it's already approved?
- Should we soft-delete (recoverable) or hard-delete (permanent)?
- Do we need admin approval for deletion?"
```

### 3. The "Standard Exists" Challenge
When user wants custom solution for standard problem:

```
USER: "Build a custom authentication system."

CHALLENGE: "SAP BTP provides XSUAA for authentication, which:
- Handles SSO, OAuth, SAML
- Integrates with corporate identity providers
- Is maintained and patched by SAP

Is there a specific reason we need to build custom instead?"
```

### 4. The "Trade-off" Challenge
When requirements conflict:

```
USER: "I want it fast AND infinitely flexible."

CHALLENGE: "I need to understand priorities. We have a trade-off:

Fast implementation → More constraints, less flexibility
Maximum flexibility → More time, more complexity

For this phase, which matters more?"
```

## Alternative Proposal Template

When proposing alternatives:

```markdown
## Approaches for [Feature]

### Option A: [Name]
**Summary:** [One sentence]
**Effort:** [Time estimate]
**Pros:**
- [Benefit]
- [Benefit]
**Cons:**
- [Drawback]
**Best if:** [Condition]

### Option B: [Name]
**Summary:** [One sentence]
**Effort:** [Time estimate]
**Pros:**
- [Benefit]
- [Benefit]
**Cons:**
- [Drawback]
**Best if:** [Condition]

### Recommendation
I suggest **Option [X]** because [rationale].
```

## How to Challenge Respectfully

### Phrase Positively
| Instead of | Say |
|------------|-----|
| "That's wrong" | "Have you considered...?" |
| "That won't work" | "I see some challenges with that approach..." |
| "That's over-engineered" | "We could simplify by..." |
| "You forgot about..." | "What should happen in [case]?" |

### Acknowledge First
- "I see what you're aiming for..."
- "That's a valid approach, and..."
- "I understand the goal is..."

### Explain the Why
- "The reason I'm suggesting an alternative is..."
- "The risk I see with the current approach is..."
- "Based on our coding standards..."

## When NOT to Challenge

- User explicitly says "Just do it"
- Trivial changes with clear requirements
- User has already considered alternatives
- Time-critical emergency fixes
- Following up on already-decided approach
