---
name: brainstorm
description: Structured ideation with brutal honesty. Use for architecture decisions, technical debates, feature exploration, feasibility assessment.
---

# 🧠 Brainstorming Skill

**Context:** Use when exploring solutions BEFORE implementing. Debate options, challenge assumptions, find the best approach.

## Core Principles

- **YAGNI** — You Aren't Gonna Need It
- **KISS** — Keep It Simple, Stupid
- **DRY** — Don't Repeat Yourself

## ❌ DO NOT

- Implement solutions (only brainstorm and advise)
- Accept the first idea without exploring alternatives
- Over-engineer for hypothetical future requirements

## ✅ DO

- Ask clarifying questions until 100% clear
- Challenge user assumptions constructively
- Present 2-3 options with trade-offs
- Be brutally honest about feasibility

## Brainstorming Process

```
1. SCOUT        → Understand current state (read docs, check existing code)
2. CLARIFY      → Ask questions about requirements, constraints, timeline
3. RESEARCH     → Check SAP standards, guidelines, existing patterns
4. ANALYZE      → Evaluate 2-3 approaches using CAP-first thinking
5. DEBATE       → Present options, challenge preferences, find optimal
6. DOCUMENT     → Create summary with agreed solution + rationale
```

## CAP-Specific Questions

| Area | Questions to Explore |
|------|---------------------|
| **Entity Design** | Denormalize or normalize? Managed aspect? Composition vs association? |
| **Service Design** | One service or multiple? Unbound actions? Projections? |
| **Performance** | Deep read? Calculated elements? Pagination? |
| **Integration** | S/4 API or custom? Event-driven or sync? Outbox needed? |
| **Security** | @restrict vs custom authorization? Instance-based access? |

## Trade-off Framework

For each option, evaluate:

| Dimension | Consider |
|-----------|----------|
| **Effort** | Development time, skills required |
| **Complexity** | Code maintainability, cognitive load |
| **Performance** | Response time, resource usage |
| **Scalability** | Volume growth, user growth |
| **CAP-Standard** | Follows SAP best practices? |
| **Flexibility** | Future changes, extensions |

## Output Template

```markdown
## Brainstorm: [Topic]

### Problem Statement
[What are we solving?]

### Options Evaluated

#### Option A: [Name]
- **Effort:** Low/Medium/High
- **Pros:** [List]
- **Cons:** [List]

#### Option B: [Name]
- **Effort:** Low/Medium/High
- **Pros:** [List]
- **Cons:** [List]

### Recommendation
[Chosen option] because [rationale].

### Next Steps
1. [Action item]
2. [Action item]
```

## Example

```
USER: "Should we store extracted invoice data in a single entity or split it?"

BRAINSTORM RESPONSE:
"Let me explore options:

**Option A: Single InvoiceData entity**
- ✅ Simple queries, one read
- ❌ Big JSON blob, harder to filter line items
- Best if: Few line items, bulk operations rare

**Option B: InvoiceHeader + InvoiceLines (composition)**
- ✅ Queryable lines, cleaner design
- ✅ CDS-standard composition pattern
- ❌ More entities to manage
- Best if: Line-level queries needed, standard CAP

**Recommendation:** Option B — follows CAP composition pattern, queryable lines, fits our existing patterns.

Questions:
1. Do you need to query individual line items?
2. Expected lines per invoice?
3. Bulk operations on lines?"
```
