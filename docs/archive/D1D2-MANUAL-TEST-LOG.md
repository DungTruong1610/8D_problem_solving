# D1 → D2 Manual Test & Audit Log

**Status:** Living — one section per run
**Owner:** Quyen (BA) — manual execution, human judgement
**Audience:** BA (executing), dev team (receiving findings)
**Authoritative for:** what was clicked, what appeared, and whether it was correct
**Related:** plan `D1D2FIXPLAN - 11PM (1).md` (frozen) · audit `D1D2-FIXPLAN-VERIFICATION.md` · findings `PRECEDENT-RETRIEVAL-REVIEW.md`, `SAP-QM-CHAIN-ALIGNMENT-VERIFICATION.md`

---

## How this document works

**This is a manual audit, not an automated suite.** Every check below is done by a person looking at the screen and deciding whether what appeared is right. The expected values are pre-computed from the seed data so you are comparing against a known answer, not judging by feel.

**Three rules keep it from turning into a design document:**

1. **Record what you saw, not what should change.** "IS column empty" is a result. "We should compute this in code" is a finding.
2. **Every failure gets an ID** — `LIVE-nn`, continuing the series already used in `D1D2-FIXPLAN-VERIFICATION.md` (which holds LIVE-01 … LIVE-06 from Run 1).
3. **A finding lives in exactly one place.** If a failure turns out to be about the *design* rather than this build — as LIVE-03 and LIVE-04 did — write one line here with the ID and move the detail to the relevant findings document. Do not write it up twice.

**Do not edit the fix plan.** It is frozen while the team is implementing.

---

## Pre-conditions — check before every run

| # | Check | Why it matters |
|---|---|---|
| P1 | **The downstream re-run bug is fixed.** `analyzeDownstreamReport` must call `enrichFromDatabase(context)`, as `analyze()` does at `eightDAnalyzer.ts:1050`. | Until fixed, any step-confirm re-run silently drops D2's inspection history and D7's FMEA. **You will misread this as a D2 defect.** Verified still unfixed on 2026-08-31. |
| P2 | Backend on the expected port (dev runs `4008`, seed script defaults to `4004`). | Seeding silently targets the wrong instance. |
| P3 | Case library contains no `9004…` notification IDs. | Dirty-variant duplicates inflate precedent counts — see LIVE-03. |
| P4 | Use only seeded materials. `MAT-10247` and `MAT-88410` are safe. | An unseeded material produces a legitimately empty Is/Is-Not, which looks like a bug. |

---

## The known-good answer — computed from seed data

Pre-computing this is what makes the audit objective. Both materials have 12 inspection-lot rows each, split cleanly across two fixtures.

### `MAT-10247` — Scenario A

| Characteristic | Fixture | Value | Conforming | Lots |
|---|---|---|---|---|
| Flange burr height | `WC-MILL-07-F1` | 0.32 mm | **No** | `0010000001-03` |
| Flange burr height | `WC-MILL-07-F2` | 0.04 mm | Yes | `0010000004-06` |
| Pocket depth | `WC-MILL-07-F1` | 12.84 mm | **No** | `0010000007-09` |
| Pocket depth | `WC-MILL-07-F2` | 13.00 mm | Yes | `0010000010-12` |

**Therefore:** IS = `WC-MILL-07-F1`, IS-NOT = `WC-MILL-07-F2`, on **both** characteristics, 3 lots each side.

### `MAT-88410` — Scenario B

| Characteristic | Failing fixture | Passing fixture |
|---|---|---|
| Helium Leak Rate at 8.0 bar test pressure | `WC-TEST-03-CHAMBER1` | `WC-TEST-03-CHAMBER2` |
| O-ring sealing seat surface roughness (Ra) | `WC-TEST-03-CHAMBER1` | `WC-TEST-03-CHAMBER2` |

---

## Test script

Fill **Actual** and **Status** as you go. Status: `Pass` · `Fail (LIVE-nn)` · `Blocked` · `N/A`.

### Group 1 — Scenario A, D2 (the untested half)

> Run 1 covered D1 only. Every check in this group is still open.

| # | What to do | Expected | Actual | Status |
|---|---|---|---|---|
| T1 | Log Scenario A via Record Defect (`MAT-10247`, `WC-MILL-07`, `DEF-0489`, Path A, **two** characteristic rows both on `WC-MILL-07-F1`) | Case created, status reaches `Analyzed` | | |
| T2 | Open D2 → Is / Is-Not | **ONE** characteristic block, for `Flange burr height` — see the note below before judging this | | |
| T3 | Read the IS column | `WC-MILL-07-F1`, 3 lots, non-conforming | | |
| T4 | Read the IS-NOT column | `WC-MILL-07-F2`, 3 lots, conforming | | |
| T5 | Check lot citations | Real lot IDs from the table above — not invented | | |
| T6 | Look for the **F6 warning** | A sentence naming **`Pocket depth`** as also out of specification and not compared | | |

> ### ⚠️ Read before judging T2 — one characteristic is compared, by design
>
> `postProcess.ts:339` picks a **single** characteristic:
>
> ```ts
> const primaryChar = context.inspections.find((i) => i.outOfSpec)?.characteristic
>                     || context.inspections[0]?.characteristic;
> ```
>
> and `computeIsIsNot` is called **once** with it (`postProcess.ts:343`). So D2 compares the **first out-of-spec characteristic in list order** and no others. Two blocks would be a *new feature*, not a passing test.
>
> This is finding **F6** in the fix plan, and the plan's chosen remedy was to **warn**, not to compare both. So:
>
> - **T2 passes** with one block, for `Flange burr height` (row 1 of your entry).
> - **T6 is the real test.** The warning must name `Pocket depth`. If the block appears but the warning does not, that is a genuine failure — the user is being shown a confident comparison covering half the problem, silently.
>
> **Both characteristics do register as out of spec**, so the warning has grounds to fire. I checked the spec parser: `parseSpec` normalises `±` to `+/-` (`caseMapper.ts:114`) and the tolerance branch handles `13.00 ± 0.05 mm` → 12.84 is 0.16 outside a 0.05 tolerance → out of spec. And `max 0.10 mm` vs `0.32 mm` → out of spec. Neither returns `null`.
>
> **If you want to test the parser's failure mode instead**, enter a spec the parser cannot read — e.g. `13.00 nominal` or `within drawing tol` — and `outOfSpec` becomes `null`. `primaryChar` then falls through to `context.inspections[0]`, and the F6 warning loses its basis. Worth one deliberate run, since operators will type exactly that sort of thing.
| T7 | Read `problem.how` | Says the defect surfaced during inspection (Path A) | | |
| T8 | Read the 5W2H grid | What / Where / How Many populated from what you entered, no invented facts | | |
| T9 | Read `problem.isIsNotBasis` | Cites the records the comparison rests on | | |

### Group 2 — Scenario B, Q1 customer complaint / Path B

> Never run. This is the second entry path and the customer-facing branch.

| # | What to do | Expected | Actual | Status |
|---|---|---|---|---|
| T10 | Log Scenario B (`MAT-88410`, `WC-TEST-03`, Q1, Path B, both characteristics on `CHAMBER1`) | Inspection Lot field locks to *"N/A (Found outside scheduled inspection)"* | | |
| T11 | Check the customer block | Complaint reference and customer contact are **kept as entered**, not silently defaulted to `CC-2026-PENDING` / `Customer Quality` | | |
| T12 | Open D2 → Is / Is-Not | IS = `CHAMBER1`, IS-NOT = `CHAMBER2` | | |
| T13 | Read `problem.how` | Says the defect surfaced via customer complaint, **not** inspection | | |
| T14 | Check D2 `complaintReference` | Read from what you entered; the AI must not write this field | | |
| T15 | Check D1 for a Q1 case | Team suggestion reflects the customer/SLA context | | |

### Group 3 — the re-run path (only after P1 is fixed)

| # | What to do | Expected | Actual | Status |
|---|---|---|---|---|
| T16 | On Scenario A, confirm a step to trigger a downstream re-run | D2's Is/Is-Not **survives** the re-run | | |
| T17 | Open D7 after the same re-run | FMEA link still present, not *"no FMEA entry linked"* | | |

### Group 4 — D1, Scenario A

> Full detail on prior findings is in `D1D2-FIXPLAN-VERIFICATION.md`. Expected values below are computed from the case library.

#### The known-good answer for D1

**Eligible precedents.** Only `Completed` / `Closed` cases are candidates (`closedOnly: true`, `precedentRepository.ts:11`). Against Scenario A (`MAT-10247` · `WC-MILL-07` · `DEF-0489` · *"Flange edge burr above limit"*):

| Case | Work centre | Defect code | Material | Deterministic | + semantic ≈ |
|---|---|---|---|---|---|
| `8D-10049010` | +4 | +2 (*flange*) | +3 exact | 9 | **≈13/16** |
| `8D-10048880` | +4 | +0 | +3 exact | 7 | **≈10.7/16** |
| `8D-10048811` | +4 | +0 | **+1 family** (MAT-10905 is also `MG-HOUSING`) | 5 | **≈8–9/16** |
| `8D-10049120` | +0 (`WC-QA-01`) | +0 | +3 exact | 3 | ≈6–7/16 — 4th, should not appear |

**Expect exactly these three, in this order.** Semantic values shift with the symptom wording, so treat the totals as approximate and the **deterministic column as exact**.

> **Diagnostic:** if any `9004…` case appears, pre-condition P3 was not met — the dirty duplicates are still in the library (LIVE-03).

#### ⚠️ The best-matching case is deliberately invisible

`8D-10048412` is **MAT-10247 · WC-MILL-07 · DEF-0489** — same material, same line, **same defect code**. It would score 4+4+3 = 11 deterministic, ≈15/16, the strongest possible match in the library.

**It is excluded, because its status is `In Process`.** Only closed cases can be precedents.

This is **correct behaviour, not a bug** — an unfinished case has no proven lesson to reuse. Do not log it as a failure. But it is worth recording as a design observation: the single most relevant case in the plant is invisible to D1 precisely because it is the one still being worked. Consequence to check: **Thien Tu (Production Worker) appears only on `8D-10048412`. If he shows up in the roster, something is wrong** — either the status filter leaked, or the dirty twin `90048412` is in the library.

#### Expected roster

Counting each person across the three eligible precedents:

| Person | Function | Appears on | Correct `servedOnCount` |
|---|---|---|---|
| **Heli Weber** | Quality Engineer | 10049010, 10048811 | **2** |
| Klaus Richter | CNC Maintenance Specialist | 10049010 | 1 |
| Quyen La | Quality Technician | 10049010 | 1 |
| Rita Fischer | Assembly Supervisor | 10048880 | 1 |
| Minh Dinh | Production Engineer | 10048880 | 1 |
| Karl Wagner | Maintenance Planner | 10048880 | 1 |
| Ingo Braun | Manufacturing Engineer | 10048811 | 1 |
| Petra Vogel | Document Control Officer | 10048811 | 1 |

**Suggested roles** should be these eight function titles, and nothing else. Any role not in this column is invented — a grounding failure, which `D1_GROUNDING` is supposed to prevent.

> **⚠️ Trap in T22 — a right number is not a computed number.** Heli Weber's correct count here is **2**, and LIVE-01 showed the model emitting **2** when the answer was 1. So the badge may read correctly *by coincidence*. **Verify the others**, especially that nobody shows 2 or 3 when the table above says 1. `servedOnCount` is still model-generated until LIVE-01 is fixed.

#### Checks

| # | Check | Expected | Actual | Status |
|---|---|---|---|---|
| T18 | Precedent panel — which cases | The three above, in that order. No `9004…`, no `8D-10048412` | | |
| T19 | Precedent panel — scores | Deterministic parts match the table exactly | | |
| T20 | Suggested roles | Only the eight function titles listed above | | |
| T21 | Suggested individuals | Only the eight people listed above. **No Thien Tu** | | |
| T22 | `servedOnCount` per person | Matches the table — read the trap note above | | |
| T23 | Roster order | Descending by count: Heli Weber first | | |
| T24 | Each row cites its source case | LIVE-02: not rendered as of Run 1 — expect this to still fail | | |
| T25 | Score breakdown under each score | LIVE-05 / RET-05: number only as of Run 1 — expect this to still fail | | |
| T26 | Every person is addable | LIVE-04: Rita Fischer expected to show *"no matching business partner"* (`BP-100088` collision) unless the data was fixed | | |
| T27 | Responsibility sentences | Specific to this case — reference `WC-MILL-07`, the fixtures, or the burr/pocket-depth characteristics. Generic job-description text is a weak result, not a failure | | |

---

## Run log

### Run 1 — 2026-08-31 · `8D-10049121` · D1 only

Covered D1 and precedent retrieval. **D2 not exercised.** Findings **LIVE-01 … LIVE-06** are recorded in `D1D2-FIXPLAN-VERIFICATION.md` and are not repeated here.

One correction carried forward: acceptance test 1 was marked *passed* on the grounds that analysis completed end to end. The actual criterion is *"produces a real Is/Is-Not"*, which Group 1 tests for the first time. Treat test 1 as **open** until T2–T5 pass.

### Run 2 — _date_ · _case ID_ · _scope_

| Group | Result | Findings raised |
|---|---|---|
| 1 — Scenario A D2 | | |
| 2 — Scenario B | | |
| 3 — Re-run path | | |
| 4 — D1 regression | | |

**Notes:**

---

## Where a failure goes

```
Does the failure contradict what the fix plan promised?
  YES → finding here (LIVE-nn) + tell the dev team. It is a build defect.
  NO  ↓
Is it wrong data rather than wrong code?
  YES → one line here (LIVE-nn), detail to the relevant findings doc.
        e.g. LIVE-03 duplicate cases, LIVE-04 partner ID collision
  NO  ↓
Is it about the design being wrong rather than the build being wrong?
  YES → one line here, detail to SAP-QM-CHAIN-ALIGNMENT or PRECEDENT-RETRIEVAL-REVIEW.
        These are Thread B and are not this plan's problem to fix.
```

The last branch is the one that matters. Several things you will notice during testing are **correct implementations of a design we have since questioned** — the defect code being a flat text box, for instance. Those are not test failures. Logging them as failures against the current build wastes the team's time and buries the real defects.
