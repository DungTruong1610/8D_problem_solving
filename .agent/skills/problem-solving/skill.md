---
name: problem-solving
description: Systematic techniques for when you're stuck. Use for complexity spirals, debugging, scale issues, assumption constraints.
---

# 🔧 Problem-Solving Skill

**Context:** Use when stuck on a problem. Match your symptom to a technique.

## Quick Dispatch

| Symptom | Technique | Action |
|---------|-----------|--------|
| Implemented 5+ ways, growing edge cases | **Simplification** | Find one insight that eliminates multiple cases |
| "Only one way to do this" | **Inversion** | Flip core assumptions |
| Same issue appears in many places | **Meta-Pattern** | Find the universal pattern |
| Will this work in production? | **Scale Test** | Test at 1000x and 0.01x |
| Conventional solutions don't work | **Collision Thinking** | Mix unrelated concepts |

## Technique 1: Simplification Cascades

**When:** Code keeps growing, more special cases, "just one more condition..."

**Process:**
1. List all special cases
2. Ask: "What single truth would eliminate most of these?"
3. Refactor around that truth

**CAP Example:**
```
PROBLEM: 10 different status validation handlers

INSIGHT: "All validations are just state machine rules"

SOLUTION: One StatusMachine with transition rules
```

## Technique 2: Inversion Exercise

**When:** Solution feels forced, "must be done this way"

**Process:**
1. Identify core assumption
2. Ask: "What if the opposite were true?"
3. Explore what becomes possible

**CAP Example:**
```
ASSUMPTION: "We must call S/4 API on every save"

INVERT: "What if we batch calls at end of transaction?"

RESULT: Use cds.outbox for async batch processing
```

## Technique 3: Meta-Pattern Recognition

**When:** Same problem in 3+ places, reinventing solutions

**Process:**
1. Identify 3+ similar problems
2. Find common pattern
3. Create reusable abstraction

**CAP Example:**
```
PATTERN: Every entity needs audit trail, soft delete, status

SOLUTION: Create aspects: @Auditable, @SoftDeletable, @Statusable
```

## Technique 4: Scale Game

**When:** Unsure about production readiness, edge cases unclear

**Process:**
1. What if 1000x more data?
2. What if 0.01x data (edge case)?
3. What breaks? What still works?

**CAP Example:**
```
QUESTION: "Will bulk import work?"

TEST 1000x: 100K records → Timeout, memory issues
TEST 0.01x: 1 record → Works but over-engineered

INSIGHT: Need chunked processing, progress tracking
```

## Technique 5: Collision Thinking

**When:** Conventional solutions inadequate, need breakthrough

**Process:**
1. Take problem domain (A)
2. Pick unrelated concept (B)
3. Ask: "What if we treated A like B?"

**CAP Example:**
```
DOMAIN A: Document extraction error handling
CONCEPT B: Git version control

COLLISION: "What if we versioned extraction attempts?"

RESULT: ExtractionHistory entity with diff tracking
```

## Decision Tree

```
STUCK?
│
├─ Is code growing out of control?
│   └─ Yes → SIMPLIFICATION
│
├─ Do you feel assumption-constrained?
│   └─ Yes → INVERSION
│
├─ Same problem in multiple places?
│   └─ Yes → META-PATTERN
│
├─ Worried about production scale?
│   └─ Yes → SCALE GAME
│
├─ Need fresh perspective?
│   └─ Yes → COLLISION THINKING
│
└─ Still unsure → Start with SIMPLIFICATION (most common)
```

## CAP-Specific Stuck Patterns

| Stuck On | Try This |
|----------|----------|
| Handler spaghetti | Simplification → Handler registry pattern |
| API performance | Scale Game → N+1 check, $expand depth |
| Authorization mess | Meta-Pattern → Role-Action matrix |
| Integration chaos | Inversion → Event-driven vs sync |
| Complex validation | Simplification → Validation pipeline |
