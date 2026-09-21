# Documentation Index & Working Conventions

**Status:** Proposal — not yet executed
**Owner:** Quyen (BA)
**Audience:** Anyone opening this folder; dev team; process owner
**Authoritative for:** what each document is for, which one wins when two disagree, and where a new finding belongs

> **Read this first.** Part 1 is the map of what exists **today** — usable immediately, before anything is moved. Part 2 is the proposed structure and the five rules. Part 3 lists three fixes that should happen regardless of whether the restructure goes ahead.
>
> **Nothing in this folder has been moved or renamed.** Every path below is the path as it exists now.

---

# Part 1 — What exists today

| Document | Stage | Status | Authoritative for |
|---|---|---|---|
| `AI Requirements - 8D Copilot POC.md` | Requirements | **Normative** | What the AI must do, on what data, and the acceptance criteria. Retrieval weights §2 are the seeded defaults. |
| `AI-RULES-8D-STEPS.md` | Requirements | 🔴 **MISSING on this branch** | R2.1 (D1), R2.2 (D2), §R4 acceptance tests 8–10. Cited as normative by the D1/D2 fix plan. See Part 3. |
| `GRAPH-RETRIEVAL-AND-RERANK.vi.md` | Architecture / Superpower | Living | Core flagship: SAP HANA Cloud Graph + openCypher & 2-stage LLM Re-ranking. |
| `RERANK-PRECEDENT-RETRIEVAL.md` | Architecture / Superpower | Living | Stage-2 LLM Re-rank pass spec (D4 Root Cause & D5 Corrective Actions). |
| `8D-COPILOT-E2E-GUIDE.md` | Guide | Living | Business context, AI architecture, E2E test walkthrough (VN). |
| `8D-DISCIPLINE-PIPELINE-AND-CREATE-DEFECT-GUIDE.md` | Guide | Living | The 5-tab step config pipeline and the Create Defect module (VN). |
| `8D-TESTING-PLAN-AND-VALIDATION-MATRIX.md` | Guide / Test | Living | Test scenarios and the validation matrix (VN). |
| `8D_D*.xlsx` (3 files) | Test Data | Living | Test cases and live verified test cases for D2 / D4. |
| `8d-step-prompts.md` | Generated | **Do not edit** | Snapshot of the live prompts. Regenerate: `npm run export:prompts` |
| `*.html` (2 mockups) | Reference / UI | Active | Flagship mockup + E2E pipeline test plan. |
| `archive/` (9 files) | Archive | **Completed / Superseded** | Completed plans & verification logs (D1D2, Chain-alignment, old similarity review, etc.). See `archive/README.md`. |

### Which document wins

1. **`AI Requirements` and `AI-RULES-8D-STEPS`** beat everything. If code or a plan disagrees with them, the code or plan is wrong — or the requirement needs an explicit, dated amendment.
2. **A frozen plan** beats a findings document for work already in build.
3. **Findings documents** describe reality but commit to nothing until promoted into a plan.
4. **Guides** describe how things work today. They are never the reason to build something.

### Known disagreements between documents

Recorded here so nobody has to rediscover them:

| Subject | Conflict | Where it is written up |
|---|---|---|
| Semantic similarity weight | Requirements §2 says **+3, off by default** (max 14). Code seeds **5, on** (max 16). | `PRECEDENT-RETRIEVAL-REVIEW.md` → R1 |
| ~~Defect object model~~ | **Decided 2026-09-01: S/4 Public Cloud** — defect is its own record; 8D is a linked 1:1 process started later. On-premise reading closed. | `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` → D-1 |
| Prompt vs config | The D1 prompt hardcodes "out of 11" and the weights; the live config is out of 16 and tunable. | `PRECEDENT-RETRIEVAL-REVIEW.md` → R2 |

The semantic-weight and prompt-vs-config conflicts belong to the retrieval workstream (a separate owner) and are out of scope for the chain-alignment plan.

---

# Part 2 — Proposed structure

## Why by stage, not by topic

Topic folders fail here because one topic — defect codes, say — legitimately appears as a requirement, a finding, a plan item, and a test result. Stage folders answer the question that actually gets asked: *which document handles what to implement, and which one logs the testing?*

```
docs/
  INDEX.md                    ← this file
  00-requirements/            ← what we promised. Normative. Changes rarely.
  10-findings/                ← "something is wrong". Analysis, no commitment yet.
  20-plans/                   ← "here is what we will do". Frozen once dev starts.
  30-verification/            ← "did it work". One log per plan. Append-only.
  40-guides/                  ← how the system works today. Living.
  90-generated/               ← never hand-edit.
  archive/                    ← superseded, kept for history.
```

The numbers show the flow: **requirements → findings → plan → verification.** A document's folder tells you its stage without opening it.

## Where each current file would go

| Today | Proposed | Note |
|---|---|---|
| `AI Requirements - 8D Copilot POC.md` | `00-requirements/AI-REQUIREMENTS-POC.md` | rename only |
| `AI-RULES-8D-STEPS.md` | `00-requirements/` | **recover first** |
| `REFACTOR-PLAN.md` | `20-plans/` or `archive/` | recover, then decide |
| `SAP-QM-CHAIN-ALIGNMENT-VERIFICATION.md` | `10-findings/SAP-QM-CHAIN-ALIGNMENT.md` | drop "VERIFICATION" — it is a findings doc and the name misleads |
| `PRECEDENT-RETRIEVAL-REVIEW.md` | `10-findings/` | as is |
| `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` | `20-plans/` | Frozen — dev started 2026-09-01 |
| `CHAIN-ALIGNMENT-VERIFICATION.md` | `30-verification/` | as is |
| `D1D2FIXPLAN - 11PM (1).md` | `20-plans/D1D2-FIXPLAN.md` | rename; keep frozen |
| `D1D2-FIXPLAN-VERIFICATION.md` | `30-verification/` | as is |
| 3 VN guides + `AI-SETTINGS-D1-CONFIGURATION.md` | `40-guides/` | mark Living |
| `8d-step-prompts.md` | `90-generated/` | mark Generated |
| 2 `.html` files | `40-guides/` or `archive/` | decide |
| `_to_delete_probe` | delete | empty file |

**Do the moves with `git mv`**, in one commit that changes nothing else, so history follows the files and the diff is reviewable.

## The five rules

### Rule 1 — One finding lives in exactly one document, forever

Every finding gets a stable ID. Other documents **cite the ID and never restate the content**.

| Prefix | Document |
|---|---|
| `SAP-nn` | SAP QM chain alignment |
| `RET-nn` | Precedent retrieval review |
| `LIVE-nn` | Live-run verification (currently L1–L6) |

A plan writes *"implements RET-07"*, not a copy of RET-07. **This is the one rule that stops the collapse you noticed.** It has already been breached once: the hidden score-breakdown issue is written up as both `L5` and `R5`. Pick one as canonical — `RET-05`, since it belongs to the retrieval engine — and reduce the other to a one-line cross-reference.

### Rule 2 — A plan freezes the moment dev starts

After that, everything new goes to the verification log. **Never edit a plan the team is building against** — they lose the ability to tell what they agreed to.

*This is already being done in practice; the rule just makes it explicit.*

### Rule 3 — Every document opens with the same header

```
Status:   Draft | In review | Accepted (frozen) | Living | Generated | Superseded
Owner:    Quyen (BA)
Audience: Dev team / Process owner / Reviewers
Authoritative for: <the one subject this document decides>
Related:  <document names or finding IDs>
```

`Authoritative for` is the important line. **If two documents claim the same subject, one of them is wrong** — resolve it rather than letting both stand.

### Rule 4 — Findings are promoted into plans, not copied

A findings document is an inbox. When a finding is accepted for build:

1. The plan references the finding ID.
2. The finding is marked `→ planned in 20-plans/<file>.md`.
3. The text is **not** duplicated.

A finding can also be closed as `→ rejected (reason)` or `→ needs decision (owner)`. Every finding ends in one of those three states, so the inbox drains.

### Rule 5 — Everything is committed, always

A document nobody can `git pull` does not exist. Five of the current documents — including the requirements and the fix plan — exist only on one laptop. That is what caused the missing-rulebook problem in Part 3.

## Where a new finding goes — decision path

```
Is it about something already in build?
  YES → the verification log for that plan (30-verification/)
  NO  ↓
Does it contradict the requirements or the SAP model?
  YES → 10-findings/, and add it to "Known disagreements" above
  NO  ↓
Is it about how the system behaves rather than what it should do?
  YES → 40-guides/ (update the living guide)
  NO  → 10-findings/, new or existing document
```

---

# Part 3 — Three fixes that matter regardless

## 1. 🔴 Recover the missing rulebook — highest priority

`D1D2FIXPLAN` cites `docs/AI-RULES-8D-STEPS.md` three times as **normative**, including *"acceptance tests 8, 9, 10 in §R4 must pass"*. **That file is not on `dev/Thien`.** It exists only on `origin/BA/Quyen`, in commit `a0ec8b8`:

```bash
git log --all --oneline -- docs/AI-RULES-8D-STEPS.md
```

So every developer implementing the fix plan on this branch is being held to acceptance criteria they cannot read. `docs/REFACTOR-PLAN.md` is in the same commit and equally absent.

To bring both onto this branch:

```bash
git checkout origin/BA/Quyen -- "docs/AI-RULES-8D-STEPS.md" "docs/REFACTOR-PLAN.md"
```

Then check whether the `origin/BA/Quyen` copy of `AI Requirements - 8D Copilot POC.md` differs from the local untracked one — they may have diverged:

```bash
git diff origin/BA/Quyen -- "docs/AI Requirements - 8D Copilot POC.md"
```

## 2. Commit the five untracked documents

```bash
git status --short docs/
```

Currently untracked — visible to nobody but this machine:

- `AI Requirements - 8D Copilot POC.md` ← **normative**
- `D1D2FIXPLAN - 11PM (1).md` ← **the plan being built right now**
- `D1D2-FIXPLAN-VERIFICATION.md`
- `SAP-QM-CHAIN-ALIGNMENT-VERIFICATION.md`
- `PRECEDENT-RETRIEVAL-REVIEW.md`

## 3. Delete the junk file

`docs/_to_delete_probe` is a tracked, empty, 0-byte file.

---

## Naming convention

`AREA-SUBJECT.md` — no dates, no times, no `(1)`.

Versions belong in git, not in filenames. `D1D2FIXPLAN - 11PM (1).md` carries a drafting hour and a browser-download suffix; both are noise that makes the folder look like a downloads directory rather than a document set.
