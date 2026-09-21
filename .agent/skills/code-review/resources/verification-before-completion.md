---
name: verification-before-completion
description: Evidence-based verification gates before claiming work is complete. Use before committing, creating PRs, or claiming any task is done.
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## CAP Verification Commands

| Claim | Command | Success Criteria |
|-------|---------|------------------|
| Lint passes | `npm run lint` | 0 errors, 0 warnings |
| Build passes | `npm run build` | Exit 0, no TS errors |
| CDS compiles | `cds build` | No CDS errors |
| Tests pass | `npm test` | All tests pass (0 failures) |
| E2E passes | `npm run test:e2e` | All scenarios pass |
| MTA builds | `mbt build` | `.mtar` generated |
| Deploy works | `cf deploy` | App running, health OK |

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | `npm test` output: 0 failures | Previous run, "should pass" |
| Lint clean | `npm run lint`: 0 errors | Partial check |
| Build succeeds | `npm run build`: exit 0 | Linter passing |
| CDS valid | `cds build`: no errors | TypeScript compiles |
| Bug fixed | Original symptom passes | "Code changed" |
| Feature complete | Checklist verified | "Tests pass" |

## Red Flags — STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!")
- About to commit/push/PR without verification
- Relying on partial verification
- Thinking "just this once"
- **ANY wording implying success without verification output**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler ≠ CDS |
| "CDS compiles" | CDS ≠ TypeScript ≠ runtime |
| "Partial check is enough" | Partial proves nothing |

## Key Patterns

**Tests:**
```
✅ [npm test] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Build:**
```
✅ [npm run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't prove build)
```

**CDS:**
```
✅ [cds build] [See: no errors] "CDS model valid"
❌ "TypeScript compiles" (different check)
```

**Full Stack:**
```
✅ npm run lint → npm run build → cds build → npm test → "Ready for review"
❌ "I've made the changes" (no verification)
```

## CAP-Specific Verification Sequence

For any CAP change, run in order:

```bash
# 1. Lint
npm run lint

# 2. TypeScript build
npm run build

# 3. CDS compilation
cds build

# 4. Unit tests
npm test

# 5. (If applicable) E2E tests
npm run test:e2e

# 6. (Before deploy) MTA build
mbt build
```

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Claiming a bug is fixed

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.
