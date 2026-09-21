# Was the SAP chain-alignment plan actually built?

**Status:** Living log — append-only
**Owner:** Quyen (BA)
**Audience:** Dev team / Process owner / Reviewers
**Authoritative for:** what got built against `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md`, what deviated, and what is still owed
**Related:** `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` (the frozen plan) · `SAP-QM-CHAIN-ALIGNMENT-VERIFICATION.md` (findings SAP-nn) · `PRECEDENT-RETRIEVAL-REVIEW.md` (RET-nn, AI track)

**Why this file exists.** INDEX Rule 2: a plan freezes the moment dev starts, and everything learned afterwards goes here instead. The plan says what we agreed to build. This says what exists.

---

## Entry 1 — Phase 1, "Fix the coding model"

**Checked on:** 2026-09-02 · **Branch:** `dev/Quyen-Test` · **Base commit:** `e9dae40` (Phase 1 work is uncommitted on top)
**Covers:** the re-run bug and items 1.1 – 1.8

**How I checked.** I built it, so this is a build record rather than an independent audit — read it that way. Everything marked ✅ was verified by at least one of: the automated test suite, both type checkers, the CDS model compiler, or a live HTTP call against a running backend. Where the check was a live call, the result is quoted. Nobody has clicked through the UI end to end yet, so anything that depends on how the screens feel in a real operator's hands is **not** covered here.

### The short answer

**Phase 1 is complete — 1.1 through 1.8, plus the re-run bug. Four things came out different from the plan text; all four are below and none of them are quiet.**

| Health check | Result |
|---|---|
| Automated tests | ✅ 940 passed, 30 suites |
| Type checking — backend | ✅ Clean |
| Type checking — frontend | ✅ Clean |
| CDS model compiles | ✅ Yes — `NumberRanges` table generated |
| Live smoke test | ✅ Ran against `dev:backend:local`, results quoted under 1.7 |

The plan named two browser-side ID generators. There was a **third**, unnamed, and it was the worst of them — see 1.7.

---

### The re-run bug ✅ Fixed

*The plan's point: re-running the later steps of an 8D silently dropped the data the earlier steps had loaded, so the re-run answered a poorer question than the first run did.*

`analyzeDownstreamReport` (`eightDAnalyzer.ts:1154`) now calls `enrichFromDatabase`. A downstream re-run keeps D2's inspection history and D7's FMEA link.

---

### 1.1 — Reconcile the catalogue with the case library ✅ Done

*The plan's point: the library used 25 defect codes, the picker offered 13. Making the picker mandatory without fixing that turns it into a wall.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| Extend `DEFECT_CODES` to all 25, each with a code group and a severity class | ✅ | Every code a real case used can now be picked |
| Assign groups by the nature of the failure, not the code prefix | ✅ | Follows the rule the four existing groups already followed |
| Startup check: every `defectCode` in `HistoricalCases` must exist in the catalogue, log loudly on mismatch | ✅ | A future data import that invents a code announces itself at boot instead of failing at the picker |

**Acceptance met.** Every historical case's defect code is selectable, `DEF-0104` on `8D-10049010` included. Guarded by `srv/src/domain/eightd/__tests__/defectCatalogue.test.ts`.

---

### 1.2 — Wire the value-help layer, hard ✅ Done · **1 deviation**

*The plan's point: the picker component was built, tested, and used by no screen. Every ID field was still a raw text box.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| Use `ValueHelpInput` on the defect form and both Master Data forms | ✅ | No ID field is a free-text box any more |
| A value outside the catalogue **blocks save**, not just warns | ✅ | The warning copy stays — it explains why — but the Save button goes dead |
| New `PLANT`, `DEFECT_CODE_GROUP`, `INSPECTION_LOT` lists with return mappings | ✅ | Picking a code fills its description and severity; picking a lot fills the header |

**Worth knowing:** the Save button being disabled is not the only guard. Pressing Enter inside a text field submits a form regardless of a disabled button, so the submit handler re-checks the blockers itself. Two locks on the same door, deliberately.

> **⚠ Deviation — the Inspection Lot picker filters by material only, not material + plant.**
> The plan asked for both. `@cnma/cap-valuehelp` accepts exactly **one** column in `dependsOn`; expressing two would mean forking the library. Reasoning recorded in the code at `valueHelpSeeder.ts:292`.
> *Consequence:* on a material produced at more than one plant, the lot list shows lots from every plant, and the operator has to read the plant column. Not wrong data — just a longer list. Revisit if a multi-plant material shows up in practice.

> **⚠ Carried forward, pre-existing, not blocking.** Material ID validates against a catalogue derived from **closed 8D cases only** — 20 entries. A genuinely new material must be added in Master Data before it can be used on a defect form. That is the escape hatch the plan names, so this is by design; recording it because 20 is a small number and someone will hit it. Notification Coordinator remains free text.

---

### 1.3 — Capture the full defect classification ✅ Done

*The plan's point: SAP classifies a defect by group, code and severity. We stored the code and threw the rest away.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| `defectCodeGroup` + `defectClass` on the payload and on `Reports` | ✅ | The classification survives the save instead of living only in the picker |
| Severity on the popup, read-only, filled by the picker | ✅ | The user sees "Severity"; the schema says `defectClass` (SAP FECLAS). One label, one column name |
| Carry code group into D2 | ✅ | D2 now shows what SAP's D2 shows |
| Reference Number on the popup | ✅ | Nullable — blank stays blank |

**Handoff to the AI track is live.** `defectCodeGroup` is stored and carries no weight, exactly as the plan agreed. RET-07 is unblocked on data; what it is worth is still their decision.

**Still owed:** HANA delta deploy for the new columns.

---

### 1.4 — Fix the measurement fields, and make Path A real ✅ Done

*The plan's point: the spec was one free-text string, a parser guessed at it, and when the guess failed D2 silently compared a different characteristic.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| Split spec into lower limit / upper limit / UoM | ✅ | `outOfSpec` is computed from numbers, not parsed out of prose |
| Add a valuation column (Accepted / Rejected) | ✅ | SAP's step ③ exists in our chain for the first time |
| Numeric quantity + UoM instead of free-text "Quantity / Extent" | ✅ | The seeded `UOM` list is finally used; the server composes the display string so the halves can't disagree |
| Inspection Lot F4 with return mapping | ✅ | Selecting a lot pulls material, plant, work centre, equipment and the characteristic row into the grid |

**Acceptance met.** No parser guessing remains, and selecting a lot fills the header plus a result row with no typing. That mapping is what makes "found during inspection" mean something rather than being a dropdown value with nothing behind it.

**Limitation stands, as the plan already accepted (Q8):** the lot object holds one characteristic, so a lot that failed several cannot be pulled across in one pick. The defect grid takes N rows; the lot behind it does not.

**Still owed:** HANA delta deploy for `defectQuantity`, `defectQuantityUom`, `workCenterId`.

---

### 1.5 — Gate Q1 and stop fabricated defaults ✅ Done · **1 deviation**

*Delivered together with 1.6 — both change the same field.*

*The plan's point: a customer complaint reaches us after the goods have left, so it has no inspection lot of ours. And the form was filling empty fields with invented values that then sat in an auditable record looking real.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| On Q1, hide Discovery Mode and Inspection Lot | ✅ | Replaced by one sentence explaining *why* there is no lot, rather than a blank space |
| On Q1, require the customer reference | ✅ | Blocks save — it is the only link back to the customer's own record |
| Remove `CC-2026-PENDING` and `Customer Quality` | ✅ | Gone, along with the Q1 SLA `'N/A'` |

**Two things worth knowing:**

- **The rule lives in one place.** `originAllowsInspectionLot()` in `srv/src/domain/eightd/types.ts` — the form and the server read the same function, so they cannot drift apart. It is enforced in three layers: the form hides the field, `caseMapper` drops a lot that arrives anyway and records the gap, and `datasetValidator` flags it on the source file.
- **Hidden is not the same as cleared.** Changing origin clears the lot state, *and* the payload builder re-derives the entry mode instead of trusting state — because the JSON-prefill path sets origin and entry mode at two different moments, so state can be inconsistent for a tick.

> **⚠ Deviation — the `'N/A - …'` strings were kept, deliberately.**
> They look like the fabricated defaults the plan asked us to remove. They are not. They are **sentinels**, matched by `isDeliberateNA` (`NA_PATTERN = /^N\/A\b/i` in `datasetValidator.ts`), and they mean *not applicable to this origin* — a stated fact. Deleting them would convert a stated fact back into a silent gap, which is the opposite of what 1.5 is for.
> What changed instead: they are now **origin-aware**, so a supplier defect no longer describes itself as an internal one.

**One consequence that needed a fix elsewhere.** The form used to fill a blank complaint reference with `CC-2026-PENDING`, so `caseMapper` never saw a blank one. Now it can, and a blank had to be taught to mean "unusable" — otherwise a Q1 case with no reference would map as though it had one.

---

### 1.6 — Reconcile the origin list, add Q2 ✅ Done

*The plan's point: the form offered Q1 and Q3, the importer produced Q2. A whole category of case could only be entered from a file.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| Three origins: Q1 Customer Complaint, Q2 Supplier Defect, Q3 Internal | ✅ | Q2 can be entered by hand |
| Q1 never has a lot; Q2 and Q3 optionally do | ✅ | `allowsLot` is data on the list, not a branch in the code |

**Worth knowing:** `datasetValidator`'s customer-fields rule was written for Q3 alone. Rather than copying it for Q2, it now applies to **every** non-customer origin — so the next origin someone adds is covered without anyone remembering to add it.

**Acceptance met.** Every origin the importer produces can be typed by hand, and a Q1 case cannot carry an inspection lot from the form, the JSON importer, or the mapper.

---

### 1.7 — Server-assigned number ranges ✅ Done · **2 deviations, 1 extra find**

*The plan's point: both Master Data tabs picked the next ID in the browser with `max(existing) + 1`. Three defects — two users get the same number and nothing notices; the "existing" set is whatever the browser loaded, so a filtered list produces a number that already exists; and the number appears when the form opens, so abandoned forms burn numbers.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| `NumberRanges` entity `{object, prefix, currentValue, width}` | ✅ | `db/schema/number-ranges.cds` |
| Allocate server-side, on save, in the insert's transaction | ✅ | `before CREATE` handlers in `eightDService.ts`; a failed insert rolls the counter back with it |
| The form shows *"Assigned on save"* | ✅ | Both Master Data tabs and the defect form |
| External assignment stays possible | ✅ | Type a number and it is kept — imported data carries its own |

**How the allocation works, and why it isn't the obvious thing.** It is a compare-and-swap: read the counter, then `UPDATE … WHERE currentValue = <the value just read>`, and retry if that matched zero rows. The obvious alternative, `SET currentValue = currentValue + 1`, is atomic at the SQL level but never tells you *which* number it produced — you would have to SELECT afterwards, and another writer fits in that gap. CAS also needs no vendor-specific SQL, so it behaves identically on SQLite and HANA.

**The counter can fall behind reality**, because imported and hand-typed numbers bypass it. So allocation takes an "is this taken?" callback and skips codes already in use, and supplying your own number pulls the counter up behind you.

> **⚠ Extra find — there was a third generator, and the plan didn't name it.**
> `generateRandomId()` in `create-defect/index.tsx` minted `8D-` plus **eight random digits** — the same range the real case library occupies (`8D-10049001`, `8D-10048577`, …), with no collision check at all, and it filled the field the moment the form opened. It was the worst of the three: the other two at least counted. `analyzeFromJson` now allocates from the `DEFECT` range when a hand-entry payload arrives without a number.

> **⚠ Deviation — `INSPLOT` is stored as prefix `''` + width 10, not prefix `'001'` + width 10.**
> Same rendered number (`0010000109`), one fewer pair of fields that can contradict each other.

> **⚠ Deviation — `@mandatory` had to be relaxed at the service layer.**
> `lotId` and `notificationId` are `@mandatory`. CAP's generic input validation runs ahead of **every** application handler — including ones registered with `srv.prepend`, which I tried first — so a form sending a blank field was rejected before the allocator could ever run, and "Assigned on save" could never save.
> The fix is `annotate EightDService.… with { … @mandatory: null }`: the requirement is dropped **in the request**, not in the record. The db-level annotation and `@assert.unique` on `notificationId` are untouched, and the handler always fills a value before the row moves on.

**Acceptance met — verified live** against `dev:backend:local`:

| Check | Result |
|---|---|
| Create a lot with no number | `0010000109` |
| The next one | `0010000110` |
| Client supplies `0010009999` | Kept, counter raised behind it |
| The next allocation | `0010010000` — jumped past |
| **8 concurrent creates** | **8 distinct numbers** |
| `HistoricalCases` payload patch | column `8D-10049122` = payload `8D-10049122` |
| `analyzeFromJson` with no number | `8D-10049121` |
| Opening a form and abandoning it | Consumes nothing |

Test rows were deleted afterwards and the dev counters reset to the real data maximum. 20 unit tests in `srv/src/domain/__tests__/numberRange.test.ts` cover the contention case directly — a fake transaction lets another writer steal the number between the read and the write.

**Reused in Phase 2.1** — `Defects` gets its number from the same range object, as the plan intended.

**Still owed:** HANA delta deploy for `NumberRanges`; one run of `scripts/migrate-number-ranges.cjs` per local SQLite database. That script builds the table from the CDS-compiled `CREATE TABLE` rather than a hand-written one, and seeds the counter from `max()` of the **real tables** rather than from the seed CSV — every machine's database differs from whatever the CSV recorded, and a counter set too low means every future save has to walk the duplicate-check loop.

---

### 1.8 — Rename the misleading Master Data tabs ✅ Done

| What was asked | Done? |
|---|---|
| "QM Inspection Lots" → "Inspection History (Is/Is-Not population)" | ✅ |
| "Historical Defects" → "Closed Case Library" | ✅ |

Manual entry stays for now — removing it is 4.3, not this item.

---

### One test changed, and why

`postProcess.test.ts`, the case *"giữ customerSummary khi case là Q1 khách hàng"*, asserted that a Q1 fixture produced **no** repairs at all. After 1.5, the mapper forces `entryMode: 'outside-inspection'` on Q1 — correctly — which lets `backfillD2IsIsNot` fill `problem.how`, so one repair now appears.

The assertion was narrowed to what the test is actually about: that no `customerSummary` repair happens. It was over-asserting before, and the new repair is the desired behaviour rather than a regression. Recorded here because "I changed a test to make it pass" deserves to be said out loud.

---

## What is still open after Phase 1

| Item | Owner | Note |
|---|---|---|
| HANA delta deploy — `NumberRanges`, `defectQuantity`, `defectQuantityUom`, `workCenterId` | Dev | Local SQLite is migrated; HANA is not |
| `scripts/migrate-number-ranges.cjs` — one run per local database | Every dev | Idempotent; only ever raises the counter |
| Material catalogue is 20 entries, derived from closed cases only | Open question | By design per 1.2, but small enough to bite |
| Notification Coordinator is still free text | Open question | Not in Phase 1 scope; no value help exists for it |
| Phases 2 – 5 | Not started | — |

---

## Entry 2 — Phase 5, "Close the loop: the library learns from closed cases"

**Checked on:** 2026-09-02 · **Branch:** `dev/Quyen-Test` · **Base commit:** `e9dae40` (Phase 1 + Phase 5 work is uncommitted on top)
**Covers:** all of Phase 5 · built out of order on purpose — see below

**Why Phase 5 before 2 – 4.** Phases 2, 3 and 4 all add data to a case. Phase 5 decides whether any of that data ever reaches the case library. Building it last would mean every case closed in the meantime is thrown away, and the two migrations would then have to reconstruct that history from reports. Building it first means Phases 2 – 4 land *into* a loop that is already closed.

**How I checked.** Same standing as Entry 1: I built it, so read this as a build record, not an independent audit. Everything marked ✅ was verified by the test suite, both type checkers, or by reading the migrated SQLite database through the service view. **Nobody has closed a case through the UI yet** — the write-back path has unit coverage on the mapping and type coverage on the plumbing, but the end-to-end "approve D8 in the browser and watch a row appear in the library" is not done. That is the one thing left before this can be called finished.

### The short answer

**Phase 5 is complete in code. One deviation, two bugs fixed on the way, one thing not yet clicked through.**

| Health check | Result |
|---|---|
| Automated tests | ✅ 969 passed, 31 suites (was 940 / 30 — 29 new) |
| Type checking — backend | ✅ Clean |
| Type checking — frontend | ✅ Clean |
| SQLite migration | ✅ Ran — 2 columns, 25 rows back-filled, 33 views rebuilt, verified through the service view |
| Manual UI walkthrough | ❌ Not done |

---

### What the plan asked for

*The plan's point: there is no INSERT into `HistoricalCases` anywhere in `srv/src` outside the seed action. The app never learns from the cases it closes, which is why the library contains nothing but seeded data.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| On D8 completion, write the case back | ✅ | Approving D8 closes the report and writes a library row |
| Compute `defectKeywords` and `materialFamily` at that moment | ✅ | Both routes go through one writer, so neither can drift |
| JSON bulk import stays | ✅ | The paste dialog now calls `seedCaseLibrary` instead of creating rows itself |
| No manual Add (Q10) | ✅ | Button and dialog removed; `CREATE` revoked on the entity |
| Provenance on every row — `closed-in-app` · `imported` | ✅ | New column, shown as a badge in the Closed Case Library tab |

---

### One writer, not two

The obvious build was a second INSERT next to the closure handler. That would have been two places computing `defectKeywords`, `materialFamily`, `searchText` and `attributesJson` — and the codebase already carries a warning about exactly this: two derivations of the same field is a bug that never announces itself.

So `writeHistoricalCase()` was **extracted out of** the seeder (`srv/src/domain/eightd/precedent/librarySeeder.ts`) and both routes call it. Import and closure differ only in the four values they pass: `provenance`, `sourceReportID`, `sapStatus`, `completionDate`. Everything derived is derived once.

### Where the lesson actually lives

`Reports.caseContext` is the snapshot taken at **analysis** time — what SAP handed over, before anyone concluded anything. The thing worth keeping as a precedent is in `Disciplines.resultJson`: the approved root cause, the confirmed team, the assigned actions, the lessons written at closure. Writing `caseContext` straight into the library would store the question and discard the answer.

`buildClosedCaseContext(base, disciplines)` in `srv/src/domain/eightd/precedent/closedCaseWriteBack.ts` therefore takes the analysis context as a **base** and overlays each D-step's approved result on top. It is a pure function with no database access, because it is the most error-prone part of the whole flow: it reads free-form JSON that a model produced and a human edited, with two key variants on nearly every field — `actions` / `assignedActions`, `statement` / `statementOverride`, `team.roster` / `team.assignedRoster`.

**The rule it enforces:** *a D-step that says nothing leaves the base value alone.* Overwriting with empty is the surest way to make a properly-closed case land in the library poorer than its own analysis. The 29 new tests in `srv/src/domain/eightd/__tests__/closedCaseWriteBack.test.ts` exist to pin that down — including that an empty `assignedRoster` does **not** wipe the team, and that malformed JSON on one step does not corrupt the other seven.

Field shapes were read off the live `defaults.ts` form schemas rather than guessed.

---

### The import dialog was itself a dead-row factory

Not in the plan; found while building. The "Import JSON" dialog created rows through OData, one `POST` per item. Those rows therefore had **no** `searchText`, **no** `attributesJson`, **no** `defectKeywords`, **no** `materialFamily`, and no team or action children at all.

`EightDService.cds:88` already warns that a row missing those columns silently scores zero. So every case ever imported through that dialog sat in the library looking perfectly normal on screen and was invisible to precedent retrieval — indistinguishable, from the user's side, from "no similar case found".

The dialog now posts once to `seedCaseLibrary` with the whole array. Same JSON, same validation, same per-item skip reasons surfaced in the toast — but the rows are now complete.

> **⚠ Deviation — JSON import narrowed from `User` to `admin`.**
> `POST` on the `HistoricalCases` entity was open to `User`; the `seedCaseLibrary` action requires `admin`. Rerouting the dialog therefore takes bulk import away from non-admin users. Recorded rather than papered over: it is a real reduction in who can do something they could do yesterday. Widening the action's scope is a one-line change if that turns out to be wrong.

---

### A gate the docs claimed but the code never checked

`EightDService.cds` stated that D8 only opens the closure gate once D1 – D7 are Approved. `reviewDiscipline` never tested it. A direct call to the review action could approve D8 on a half-finished case — and after Phase 5 that half-finished case would be written into the library as a precedent, because `closedOnly` filters on `sapStatus`, not on completeness.

`reviewDiscipline` now evaluates `evaluateClosureGate` before approving D8 and rejects with a 400 if the gate is shut. This is a bug fix in its own right and a precondition for the library's promise.

### What closing a case now does

On D8 approval: `Reports.status = 'Closed'`, `sapStatus = 'Completed'`, `completionDate = today`, then the library write. `sapStatus` specifically matters because `CLOSED_STATUSES` is what `precedentRepository` filters candidates on.

**A failed library write does not block the closure.** A human approved that case; refusing to close it because a downstream write failed would be the wrong trade. But the error is not swallowed either — it comes back on `ReviewResult.closure.libraryError` and is logged. Silent is the one thing it must not be.

---

### One bug found by the new tests

`numberOrNull` — the helper that reads the free-text COPQ field at D8 — stripped non-numeric characters and then called `Number()`. **`Number('')` is `0`, not `NaN`.** So "Not quantified" would have written **0 EUR** into the library: a figure that looks measured, drags the average cost of every case down, and nothing reports it. It now returns null for anything with no digits, and the base value survives.

The same helper also mis-read the English thousands separator — "18,500 EUR" came out as **18.5**, because it only handled the German convention. It now disambiguates both: with two separator kinds the last one is the decimal point; a lone separator followed by exactly three digits is a thousands separator. Eight table-driven cases cover it.

---

### One pre-existing landmine, fixed because Phase 5 stepped on it

`srv/src/domain/numberRange.ts` destructured `cds.ql` at **module load**. `cds.ql` does not exist until the CAP runtime boots, so any file importing it — even transitively, even one that only wanted the pure `formatNumber` — died on the `import` line under jest. It went unnoticed because nothing in the import graph reached it from a test until `eightDRepository → closedCaseWriteBack → librarySeeder → numberRange` did.

`taskEvidence.test.ts` failed the moment that edge appeared. `cds.ql` is now read inside the two functions that use it. The file's own comment already said a domain module should not require a booted runtime to load; now it doesn't.

---

### Acceptance

| Check | Result |
|---|---|
| `writeHistoricalCase` is the only INSERT into `HistoricalCases` | ✅ |
| `CREATE` revoked on the entity in `EightDService.cds` | ✅ |
| Add button and create dialog gone from the Closed Case Library tab | ✅ |
| Source column renders `Closed in app` / `Imported` | ✅ |
| Import with no `notificationId` allocates from the `DEFECT` range | ✅ — the seeder used to *skip* those payloads, which would have regressed 1.7's "leave it blank and the server assigns" |
| Re-closing a case replaces its library row rather than duplicating it | ✅ — matched on `notificationId`, children deleted first |
| `before UPDATE` recomputes `defectKeywords` when `defectText` is edited | ✅ |
| 25 existing rows back-filled to `provenance = 'imported'` | ✅ — verified through `EightDService_HistoricalCases`, not just the base table |
| Closing a case end to end in the browser | ❌ **Not done** |

---

### Still owed after Phase 5

| Item | Owner | Note |
|---|---|---|
| Close one case through the UI and confirm the row lands in the library | Dev | The only untested link in the chain |
| `scripts/migrate-case-provenance.cjs` — one run per local database | Every dev | Idempotent; adds two columns and rebuilds the 33 service views |
| HANA delta deploy — `provenance`, `sourceReportID` | Dev | On top of Phase 1's outstanding HANA delta |
| Bulk import now requires `admin` | Open question | See the deviation above |
| Similarity scoring quality | Out of scope | Separate AI workstream — `PRECEDENT-RETRIEVAL-REVIEW.md` |

---

## Entry 3 — Phase 2, "Defect lifecycle"

**Checked on:** 2026-09-02 · **Branch:** `dev/Quyen-Test` · **Base commit:** `e9dae40` (Phase 1 + 5 + 2 work is uncommitted on top)
**Covers:** items 2.1 – 2.4

**How I checked.** Same standing as Entries 1 and 2: I built it, so read this as a build record rather than an independent audit. New this time — **the screens were actually clicked through in a browser**, which is what caught two of the four bugs below. Everything marked ✅ was verified by the test suite, both type checkers, a read through the migrated SQLite service views, or a live click.

### The short answer

**Phase 2 is complete — 2.1 through 2.4. Three deviations, four bugs found on the way, and one thing the migration deliberately left blank.**

| Health check | Result |
|---|---|
| Automated tests | ✅ 994 passed, 32 suites (was 969 / 31 — 25 new) |
| Type checking — backend | ✅ Clean |
| Type checking — frontend | ✅ Clean — **with the right command**, see "the typecheck that checked nothing" |
| SQLite migration | ✅ Ran — 2 tables, 1 column, 25 defects back-filled, 35 views rebuilt, verified through the service views |
| Manual UI walkthrough | ✅ Master Data → Defect Records, and Start 8D end to end |

---

### 2.1 — Separate the defect from the 8D ✅ Done

*The plan's point: in the Cloud model a defect exists on its own and an 8D is opened from it. We had no defect object at all — the Record Defect popup created an 8D.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| New `Defects` entity with its own number from the 1.7 range | ✅ | `Open` / `In Process` / `Completed`, plus material, batch, plant, work centre, classification, reference number |
| Characteristics as a composition | ✅ | `DefectCharacteristics`, written in the same transaction by CAP deep insert |
| `Reports.sourceDefectId`, at most one 8D per defect | ✅ | Enforced server-side in `startEightD`, not in the browser — two tabs cannot race past it |
| The popup records a **defect**; starting an 8D is a separate action | ✅ | Button relabelled from "Create Defect & Start 8D Process" to **"Record Defect"** |

**The new server action.** `startEightD(defectID, title)` accepts either the UUID or the business number, then does three coupled writes in one request: rebuild the analysis payload from the `Defects` row, create the report with `sourceDefectId` set, and flip the defect to `In Process`. It refuses with 404 (no such defect), 409 (already completed, or already carries an 8D) and 400 (the defect fails dataset validation) before writing anything.

**Payload is rebuilt server-side, never posted.** The client sends only a defect number. `buildDefectPayload(defect, characteristics)` reconstructs what the analyzer sees, so there is no route by which a browser can edit case facts on the way into an 8D. That boundary is where 25 of the 25 new tests live (`srv/src/domain/__tests__/defectPayload.test.ts`) — every failure there would be silent, producing a plausible-looking case built on the wrong numbers.

> **⚠ Deviation — the `DEFECT` number range is shared between `Defects.defectId` and `Reports.notificationId`, on purpose.**
> The plan reads as though the defect gets a number from the 1.7 range and the report keeps its own. In SAP the notification **is** the defect, and `Reports.notificationId` is still the case key for every imported and seeded row (the plan says so itself, under D-1). Giving the two objects independent numbers would mean an 8D and the defect it came from carry two different numbers that must then be reconciled by hand in every conversation about the case.
> *Consequence:* `assignBusinessKey` had to grow an `alsoCheck` parameter — allocating from a range that feeds two tables and probing only one of them misses exactly half the range. One code path, both tables checked.

---

### 2.2 — Start an 8D from an existing open defect ✅ Done

*The plan's point: this is the normal path in SAP and the only one the app lacked. It is also the fix for double entry — today the same defect gets recorded twice.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| List defects that are open, in the Create 8D Report dialog | ✅ | A card above the JSON paste area, reloaded on every open |
| Exclude defects that already have an 8D | ✅ | `listStartable()` — see the note below on why it is two calls |
| Carry material, work centre, batch, classification and characteristics in with no retyping | ✅ | Nothing is carried through the browser at all; the server rebuilds it from the row |

**Why `listStartable` makes two calls instead of one filter.** The real condition is *"no `Reports` row carries this `sourceDefectId`"*. CAP's OData v4 cannot express NOT EXISTS across two entities with no association between them, and adding an association purely to serve this filter would force `sourceDefectId` to become a UUID foreign key — the design that was explicitly rejected, because the link has to survive imported rows that have no `Defects` record at all. Two cheap reads beat binding the two tables together.

The list is reloaded every time the dialog opens, and again after any error, because "defects with no 8D" goes stale the moment a colleague opens one. A 409 from the server is therefore expected behaviour, not a bug — it is the authority, and the list is only a hint.

---

### 2.3 — New Master Data → Defects tab ✅ Done · **1 deviation**

*The plan's point: browse and maintain defect records with their 8D link where one exists.*

The tab sits **between** Inspection History and Closed Case Library, which is the order the chain runs in: ② lot → ③ results → ④ defect → closed case. Columns: Defect ID · Status · Symptom · Material · Work Centre · Severity · Found · 8D.

The 8D column is three different things rather than one greyed-out button, because "already has an 8D" and "closed without one" are different facts and a disabled button states neither:

| Row state | What the column shows |
|---|---|
| Has a report | **Open 8D** → navigates to it |
| `Completed`, no report | *Closed without 8D* — plain text, correct and common |
| Open, no report | **Start 8D** → calls the action, toasts, navigates to the new report |

> **⚠ Deviation — the tab does not rebuild the form from the 1,151-line Historical Defects form.**
> The plan says "built from Part A of the existing Historical Defects form (see S3)". Recording a defect reuses **`CreateDefectDialog`** instead. That dialog already carries the eight hard F4 pickers from 1.2, the lot picker with return mapping from 1.4, the `entryMode` rules, the `N/A` sentinels for non-customer origins, and the measured-results grid — all built in Phase 1. Copying Part A would have created a second implementation of every one of those rules, and the second copy is the one that drifts.
> *Consequence:* the tab has list, filter, Start 8D and delete, but no inline **edit** dialog. Correcting a recorded defect is not possible from this screen yet. Flagged rather than hidden — it is a real gap against "browse and **maintain**".

---

### 2.4 — Show the link ✅ Done · **1 deviation**

| What was asked | Done? | What it means in practice |
|---|---|---|
| 8D Detail header shows the source defect number | ✅ | And says "no defect record" explicitly when there is none — that is a fact about the case, not a blank |
| 8D Reports list gains a Defect ID column | ✅ | Between Case and Origin. A dash means imported as JSON, which is a legitimate entry path |
| `/workflow` explains defect → 8D as two steps | ✅ | See the deviation |

> **⚠ Deviation — the explainer went on the live `/workflow` page, not into `workflow/steps.tsx`.**
> `steps.tsx` holds a 12-step narrative of the pipeline and looks like the obvious place for this. **It is dead code** — nothing imports it, and neither do `case-library-section.tsx` or `team-preview-section.tsx`. The route renders "AI Configuration"; only `discipline-section.tsx` is still wired in. Editing `steps.tsx` would have shipped nothing to anybody.
> The live page now opens with a six-step chain strip — inspection result → defect recorded → 8D opened → precedents retrieved → D1–D8 drafted → case closed — with the AI-configured steps highlighted and a sentence stating that ② and ③ are two separate acts and that most defects never become an 8D.
> *Also noticed, not fixed:* the "User Guide" button in that page's header links to `/guide`, which has no route and silently redirects to `/8d`.

---

### The migration, and the one thing it deliberately left blank

`scripts/migrate-defects.cjs` — same shape as the two before it: guard with `PRAGMA table_info`, take DDL from `cds compile --to sql` rather than hand-writing it, never `cds deploy --to sqlite` (it destroys data), drop and recreate every service view because CAP's SQLite views enumerate columns explicitly and cannot see a new one otherwise.

Result on the local database, verified by reading back **through the service views**:

```
2 tables created · sourceDefectId column added
25 lỗi được tạo, 25 báo cáo được nối, 0 đã nối từ trước
50 dòng đặc tính kiểm tra (50 dòng có quy cách dạng câu chữ, để trống giới hạn số)
35 views rebuilt
Báo cáo chưa nối được với lỗi nào: 0
Lỗi mang nhiều hơn một 8D: 0
Completed 20 / In Process 5
```

> **⚠ Deviation — back-filled defects reuse the report's `notificationId` rather than drawing a fresh number.**
> The agreed answer was "backfill one Defect per report, numbered from the 1.7 range". Taken literally that mints 25 brand-new numbers for defects that, in SAP's terms, already had one — and it cuts the case-library link, which keys on `notificationId`. So the backfill reuses the existing number, allocates from the range only where a report has none, and then raises the range counter past every reused value so the next real allocation cannot collide. The counter finished unchanged at 10049120, which is correct: every existing number was already below it.

**What the backfill would not guess.** Legacy payloads store spec values as prose — `'max 0.10mm'`, `'0.05 – 0.15'`. All 50 characteristic rows are like this. Parsing them into `specUpperLimit` would put a **guessed number** into precisely the field D2 reads to decide whether a measurement is out of spec. The limits are therefore left null and the count is printed. A wrong limit there produces a confident, wrong verdict; a null produces no verdict, which is the honest outcome.

`defectClass` and `entryMode` are also null on all 25 back-filled rows — neither existed as a stored field before Phase 1.3, so there is nothing to recover. The Severity column shows a dash for them and a real value for anything recorded since.

---

### Four bugs found on the way

**1. The whole Master Data page crashed.** `InspectionLotsTab.tsx` used `useMemo` without importing it — `ReferenceError: useMemo is not defined`, error boundary, blank page. Every tab on that route, not just the lot form. Introduced in Phase 1; found the first time the page was opened in a browser this session.

**2. The frontend typecheck was checking nothing.** `app/cnma_proresolve_ui/tsconfig.json` is solution-style — `"files": []` plus project references. `npx tsc --noEmit` against it compiles the empty root project and exits 0 without reading a single source file. That is why bug 1 survived a "clean" typecheck. The correct command is `npx tsc -b` (what `npm run build` uses) or `npx tsc -p tsconfig.app.json --noEmit`. **Any "frontend typecheck clean" in Entries 1 and 2 was produced by the wrong command and should be treated as unverified.** Running the right one surfaced two more errors, both pre-existing:

**3. The "In process" worklist filter was dead.** `case-workload.ts` computed `inProgressStep` by comparing a discipline's review status against `'InProcess'`. `reviewStatusOf` returns `'Draft' | 'Approved' | 'ChangeRequested'` — the comparison can never be true, so the chip always matched zero cases and looked exactly like "nothing is in progress". Now the earliest step still in `Draft`, null on closed cases, with `ChangeRequested` deliberately excluded because it has its own chip.

**4. A 1,000-row query fetched on every Closed Case Library render and used by nothing.** `allRows` in `HistoricalDefectsTab.tsx` was assigned and never read. Removed, along with the query behind it and its invalidation.

Backend typecheck (`npx tsc --noEmit` from the repo root) is genuine — that tsconfig is a normal one, not solution-style.

---

### Live smoke test

Against `localhost:4008` + `localhost:5544`, clicking **Start 8D** on a recorded defect:

| Check | Result |
|---|---|
| Defect Records tab renders 26 rows, filters, and shows the right 8D affordance per row | ✅ |
| `Start 8D` appears only on the open, unlinked defect | ✅ |
| Action returns a report ID; toast reads "8D opened for defect 8D-10049122"; navigates to the report | ✅ |
| `Reports.sourceDefectId` = `8D-10049122` | ✅ read back from the database |
| Defect flipped `Open` → `In Process` | ✅ |
| Analysis dispatched | ✅ status `Analyzing`, no error — but it never completed, see below |
| 8D Reports list renders the Defect column | ✅ |

**The analysis never finished.** It was still `Analyzing` with no `errorMessage` twenty minutes after dispatch, against an earlier observed run time of roughly three minutes. That is on the AI side of the boundary, not in anything Phase 2 built — `startEightD` had already committed all three writes correctly before handing off — but it means the finished report was never inspected, and **a hung analysis leaves a report stuck in `Analyzing` with nothing on screen to say so**. Worth a look on its own. The test defect `8D-10049122` and report `75b17fd7` are **still in the local database**; delete them before demoing.

**Known local-environment note:** while a background analysis runs, CAP's SQLite driver holds its single connection and OData reads on that tenant block until it finishes. Reading `db.sqlite` directly in read-only mode is the way around it during a test.

---

### Acceptance

| Check | Result |
|---|---|
| A defect can be recorded without creating an 8D | ✅ |
| A defect can carry at most one 8D, enforced on the server | ✅ 409 |
| An 8D cannot be started from a `Completed` defect | ✅ 409 |
| A defect failing dataset validation is refused with the reason | ✅ 400 |
| Defect number and report number come from one range with no collision | ✅ `alsoCheck` probes both tables |
| Case-library link survives the migration | ✅ 0 orphaned reports, 0 defects with two 8Ds |
| Editing a recorded defect from the Defects tab | ❌ **Not built** — see the 2.3 deviation |

---

### Still owed after Phase 2

| Item | Owner | Note |
|---|---|---|
| Inline edit on the Defects tab | Dev | The "maintain" half of 2.3 |
| Delete the smoke-test defect `8D-10049122` and its report | Dev | Local database only |
| `scripts/migrate-defects.cjs` — one run per local database | Every dev | Idempotent; take a backup first, the script does not |
| HANA delta deploy — `Defects`, `DefectCharacteristics`, `Reports.sourceDefectId` | Dev | On top of the Phase 1 and Phase 5 deltas |
| `/guide` route missing | Dev | Pre-existing; the User Guide button on `/workflow` redirects to `/8d` |
| `workflow/steps.tsx`, `case-library-section.tsx`, `team-preview-section.tsx` are unreferenced | Dev | ~500 lines of narrative that no longer ships — delete or re-wire |
| Close one case through the UI | Dev | Carried over from Entry 2, still open |

## Entry 4 — Phase 3, "The 8D worklist"

**Checked on:** 2026-09-02 · **Branch:** `dev/Quyen-Test` · **Base commit:** `e9dae40` (Phase 1 + 5 + 2 + 3 work is uncommitted on top)
**Covers:** items 3.1 – 3.3

**How I checked.** Same standing as Entries 1–3: I built it, so read this as a build record rather than an independent audit. The list was clicked through in a browser with all 26 seeded reports on screen — filter chips, both column sets, and the row styling were seen working, not inferred. Everything marked ✅ was verified by the test suite, both type checkers, a read back through the migrated SQLite service views, or a live click.

### The short answer

**Phase 3 is complete — 3.1, 3.2 and 3.3. Four deviations, one of which changes what a column contains.**

| Health check | Result |
|---|---|
| Automated tests | ✅ 1018 passed, 33 suites (was 994 / 32 — 24 new, all in `worklistFields.test.ts`) |
| Type checking — backend | ✅ Clean |
| Type checking — frontend | ✅ Clean — `npx tsc -p tsconfig.app.json --noEmit` |
| SQLite migration | ✅ 4 columns added, 26 reports back-filled, 35 views rebuilt, all four read back through `EightDService_Reports` |
| Migration idempotency | ✅ Second run: 4 × "đã có", same back-fill counts, no drift |
| Manual UI walkthrough | ✅ 26 rows, 9 chips with counts, both column sets, row styling, urgency ordering |

---

### 3.1 Promote fields to `Reports` columns ✅ Done · **1 deviation**

*The plan's point: five fields live only inside `sourcePayload`, which cannot be sorted or filtered in a list. It calls this "the gate" — no worklist column can be built until it is done.*

| Field the plan named | Done? | Where it came from |
|---|---|---|
| `sourceDefectId` | ✅ | Already delivered in Phase 2.1 |
| `defectClass` | ⚠️ **Deviation** — see below | Column exists, is null on 25/26 rows; the value comes from the F4 catalogue |
| `slaResponseDue` | ✅ `Date` | `caseContext.customer.slaResponseDue` |
| `coordinator` | ✅ `String(100)` | `caseContext.responsibility.coordinator` |
| `teamLeader` | ✅ `String(100)` | D1 `resultJson` → `team.assignedRoster`, role `8D Team Leader` |
| **`customerRef`** *(added, not in the plan's list)* | ✅ `String(50)` | `caseContext.customer.complaintReference` — see the 3.2 deviation on customer name |

**`slaResponseDue` is a `Date`, and that is the whole point.** The source string is free text: an ISO date on Q1 cases, and the sentinels `'N/A'` / `'N/A - Internal Defect'` on internal ones. A column that sometimes holds `'N/A'` can be neither compared to today nor sorted — the only two things this column exists to do. `isoDateOrNull` rejects anything that is not a real date, checking both the shape and `Date.parse` (`'2026-13-45'` matches the pattern and is not a date). **10 dates written, 16 sentinels left null.** The original string is untouched in `caseContext`; nothing is lost, it is just not pretended to be a date.

> This is decision **Q12** enforced in the schema rather than in a comment: no invented deadline for an internal case. A fabricated due date looks exactly like a real one, and no reader can tell them apart.

**`teamLeader` is kept in sync at exactly the two places `assignedRoster` is written** — `saveAssignedTeam` and `saveDisciplineFieldValue` — so the column cannot drift from D1. Reading it out of D1 on demand would mean parsing one discipline's `resultJson` per row: thirty open cases, thirty JSON parses, to draw one column.

> **⚠ Bug found and fixed during the migration — the team leader back-filled as bare numbers.**
> The first run wrote `"100001"`, `"100014"` into the column. D1's roster stores only `{partnerId, partnerRole}`; the names are master data in `HistoricalTeamMembers`, and `BP-100014` and `100014` are the same person written two ways. The extractor was split into `teamLeaderRefFrom` (pure, returns both name and ID, prefix stripped) and `resolveTeamLeaderName` (async directory lookup), so the extraction stayed unit-testable while the column gets a readable name. Re-run: **24 of 24 leaders resolved to real names**, 0 left as numbers.

> **⚠ Deviation — `defectClass` is read from the F4 catalogue, not from the column.**
> The column exists on `Reports`, and it is **null on 25 of 26 rows** — it is written on the defect-recording path, not on the seeded and imported ones. Rather than back-fill a guess, the Severity column reads `Reports.defectClass` first and falls back to the defect-code catalogue (`useValueHelp(DEFECT_CODE)` → `defectClass` per entry). That is not a workaround: defect class is a property of the **code**, not of one occurrence of it. Ordering it column-first means a value a user edits on a case still wins.
> *Consequence:* the same catalogue feeds the Record Defect form's F4, so the two screens cannot state different severities for the same code.

> **Deviation — `coordinator` is written but empty on every seeded row.**
> `caseContext.responsibility.coordinator` is absent from all 26 reports: **0 written / 26**. The column, the write path and the fallback display are all in place and will populate on cases created from now on. Today the "8D Team Leader" column falls back to nothing on the two reports without a D1 leader, rather than to a coordinator name.

---

### 3.2 Columns ✅ Done · **1 deviation**

*The plan's point: the list describes what a case **is**; a coordinator with thirty open cases needs to know which one needs them today, where it is stuck, and how bad it is.*

Default column set, left to right:

| Column | Where it comes from | Note |
|---|---|---|
| 8D ID | `notificationId` | kept |
| **Defect** | `sourceDefectId` | `—` with a tooltip on JSON-imported cases — a valid entry route, not missing data |
| Origin | `origin` + **`customerRef`** | full words, not the `Q1`/`Q3` codes |
| Material | `materialDesc` over `materialId` | description first, code beneath and smaller |
| Symptom | `symptomShortText` | the only human-readable identifier |
| **Severity** | `defectClass` → catalogue | Critical / Major / Minor, tooltip carries the priority reason |
| **Current step** | lowest D-step not `Approved` | a returned step overrides it, because it is more urgent |
| Completeness | approved / 8 | kept, beside Current step |
| Status | `status` | kept; `Analyzing` renders a spinner |
| **Days open** | `createdAt` → now, **stops at closure** | red when past the 60-day clock |
| **Due date** | `slaResponseDue` | plus "68d overdue" / "due today" / "in 3d"; `—` with a tooltip on Q2/Q3 |
| **8D Team Leader** | `teamLeader`, falling back to `coordinator` | the fallback renders **greyed and italic** |
| Last updated | `modifiedBy` + `modifiedAt` | **Created By dropped**, as instructed |

**Optional set, behind a "More columns" toggle:** Root cause · **Response lag** · CoPQ (EUR) · Work centre · Plant · Created by. All six render; **Plant is blank on all 26 rows** because `Reports.plant` is unpopulated in the seed data — a data gap, not a rendering one.

**Days Open and Response Lag are two columns, and the plan is right that they must be.** `case-workload.ts` computed age from `foundDate ?? createdAt`, with a comment arguing that `createdAt` "makes every backlogged case look brand new". True — but it answers a different question. Merged into one number, a case **opened** three weeks late and a case **running** three weeks slow read identically while needing opposite responses. Days Open now measures the 8D from `createdAt` and stops when the case closes; Response Lag measures `createdAt − foundDate` and lives in the optional set. Live data makes the split obvious: every case reads **0d open** and **22–75d response lag** — the backlog is entirely in intake, and the old single column would have shown none of it.

> **⚠ Deviation — Origin shows the customer's complaint reference, not the customer's name.**
> The plan asks for "the customer name for Q1". **There is no customer name anywhere in the model or the data.** `caseContext.customer` carries exactly three fields: `complaintReference`, `plantContact`, `slaResponseDue` — checked across all 26 reports, 0 have a name under any key. A column headed with a name and blank on every row would be worse than none, so the Q1 identifier that *does* exist is shown instead: `CC-2026-0442` beneath the Origin badge. It is also what someone reads aloud when they phone the customer.
> *Consequence:* one more promoted column, `customerRef String(50)`, with the same sentinel problem as the due date — internal cases store the sentence `'N/A - internal defect, no customer reference'`. `customerRefOrNull` rejects any value starting with an `N/A` word, so **10 references written, 16 sentinels left null**. A test pins `NAVISTAR-2026-11` as a value that must survive: it starts with `NA` and is a real reference, and the word boundary in the pattern is the only thing keeping it.

---

### 3.3 Two behaviours worth more than any column ✅ Done · **1 deviation**

**Filter chips — nine, each with a live count.** The count is deliberate: a chip reading `0` must be visibly, truthfully empty rather than looking like a broken filter. Chips with a zero count render dimmed.

| Chip | Live count | Rule |
|---|---|---|
| All cases | 26 | — |
| My cases | 0 | owner matches the signed-in identity — see the deviation |
| Overdue | 10 | past customer commitment, or past a containment/closure clock |
| Critical | 16 | rule-based priority, not a model score |
| Awaiting approval | 24 | analysed, fewer than 8 signatures |
| Changes requested | 0 | at least one step sent back |
| In process | 24 | earliest step still `Draft` |
| Customer complaints | 10 | Q1 and open |
| Signed off | 0 | closed |

> **⚠ Deviation — "Awaiting my approval" was delivered as "Awaiting approval".**
> The data model has no approver field: a step in `Draft` is waiting for *someone* to sign, not for a named person. Narrowing the chip to "mine" would produce a chip that is permanently empty — the identical bug that `inProgressStep` had until this phase (it compared against `'InProcess'`, a value `reviewStatusOf` never returns, so the "In process" chip was silently always zero). Anyone wanting their own can click **My cases** alongside it.

> **Note on "My cases" reading 0.** Not a defect: the owner column holds Business Partner names (`Heli Weber`, `Thien Tu`) and the local dev session is `Local Developer`. `isMyCase` compares display name, name, email and ID, and also the email local part with `.`/`_`/`-` mapped to spaces — so `quyen.tran@…` matches `Quyen Tran`. It will populate against a real directory; it cannot against seeded names.

**Overdue and Critical styling is on the row, not in a cell.** `DataTable` gained an optional `rowClassName?: (row) => string | undefined`, applied at all three render sites (mobile card, main table, selection table). Overdue rows get a red wash; open Critical rows get a red left edge. Closed cases are never tinted — they demand no action, and colouring them dilutes the rows that do.

**Default ordering is urgency, not recency.** The list sorted by `createdAt desc`, answering "which is newest" — a question nobody opens a worklist to ask, and one that pushes the most urgent case (usually the oldest) to the bottom. `compareByUrgency` sorts open before closed, then priority, then **soonest real deadline**, then age. Verified live: the top ten rows read 26 Jun → 18 Aug, ascending, with the internal cases below them.

**Priority is a rule, not a model.** Ranking someone's work is a thing they will argue with, and they are entitled to. A four-line rule can be argued with — you can point at the line that fired, and the tooltip states it (`customer complaint · customer response 68 day(s) past due · major defect class`). A model score cannot, and the first time it ranks a customer complaint as Low is the last time anyone trusts the column.

---

### What was found on the way

**`case-workload.ts` was dead code.** 200 lines of derivations with no call site anywhere in the app — the list page never imported it. Phase 3.2 therefore turned out to be mostly *wiring an existing module in*, not writing new logic. Three functions were replaced (`ageInDays` → `daysOpen` + `responseLagDays` + `daysUntilDue`) and seven fields added to `CaseWorkload`; the rest was already there and correct.

**Two dead filters, both silently empty.** `inProcess` compared against `'InProcess'`, which `reviewStatusOf` never returns. Fixed to `Draft`; the chip now reads 24. This is the failure mode the "Awaiting approval" deviation above exists to avoid repeating — a filter that returns nothing looks exactly like a filter with nothing to return.

**A stale backend serves a stale model.** Requests carrying the new columns hung with no error and no log line while a server started before the schema change was still listening. Restarting it fixed it instantly. Worth knowing: the symptom is a spinner, not an error.

**Every row of every unselectable table shared one key — found, fixed.** `DataTable.tsx` has three row-render sites. Two fall back to `` `row-${index}` `` when no `selection` prop is passed; the third fell back to `''`. That third site is the one the worklist renders through, and the worklist passes no `selection` — so all 26 rows were keyed `""`. React cannot tell one row from another under a shared key: a row's local state can follow the wrong record once the list is filtered or re-sorted, which on this page happens on every chip click. Fixed at `DataTable.tsx:887` by taking the `index` the callback was not receiving and matching the other two sites.

An earlier draft of this entry said the warning fired ~9 times at app mount, did not recur on worklist renders, and that the keys on this page were unique. **All three were wrong.** The measurement behind them was taken with the console hook installed *after* the render it was meant to observe, so it recorded a page that had already finished warning. Re-measured properly:

| | Before fix | After fix |
|---|---|---|
| Mount `#/8d` (26 rows) | 75 warnings | **0** |
| `#/master-data`, `#/workflow` | 0 | 0 |
| "Signed off" chip (0 rows) | 0 new | 0 |
| "All cases" chip (26 rows) | 25 new | 0 |
| Distinct `<tr>` fiber keys | 1 (`""`) | 26 |

The count scaling exactly with row count is what identified it: 26 siblings, one key, 25 collisions. The bug is older than Phase 3 — Phase 3 only made it visible by putting a filterable 26-row table on screen.

---

### Acceptance

| Check | Result |
|---|---|
| Due date sorts and filters as a real column, not a JSON field | ✅ `Date` column, read back through the service view |
| No invented deadline on an internal case | ✅ 16 sentinels null, blank cell with a tooltip |
| Severity visible on the list | ✅ from the catalogue, same source as the defect form's F4 |
| Current step distinguishes "sitting at D4" from "0/8" | ✅ step code + label, returned steps override |
| Days Open stops at closure | ✅ |
| Days Open and Response Lag are not the same number | ✅ 0d vs 22–75d on live data |
| Team leader shows a name, not a partner ID | ✅ 24/24 resolved through the directory |
| Coordinator fallback is visually distinct | ✅ greyed + italic, tooltip explains why |
| Created By dropped from the default set | ✅ still available under More columns |
| Chips carry counts, zero-count chips look empty not broken | ✅ |
| Overdue / Critical styling on the row | ✅ `rowClassName`, all three render sites |
| Most urgent case is at the top | ✅ due dates ascending, closed last |
| Customer name on Q1 | ⚠️ **complaint reference instead** — no customer name exists in the data |
| "Awaiting my approval" | ⚠️ **delivered as "Awaiting approval"** — no approver field in the model |

---

### Still owed after Phase 3

| Item | Owner | Note |
|---|---|---|
| `scripts/migrate-worklist-fields.cjs` — one run per local database | Every dev | Idempotent and re-runnable; **stop the CAP server first**, and take a backup — the script does not |
| HANA delta deploy — `slaResponseDue`, `coordinator`, `teamLeader`, `customerRef` | Dev | On top of the Phase 1, 5 and 2 deltas |
| `Reports.plant` unpopulated | Dev | The optional Plant column renders blank on all 26 rows |
| `Reports.defectClass` unpopulated on seeded rows | Dev | Severity falls back to the catalogue; harmless, but the column is misleading if read directly |
| A target cycle-time policy for Q2/Q3 | Business | Deferred by the plan itself; internal cases have no clock until it is set |
| ~~Duplicate-key React warning~~ | — | **Closed.** Root cause found in `DataTable.tsx`, fixed, 75 → 0 verified in the browser. See above |
| Everything still owed from Entries 1–3 | — | Unchanged; see the end of Entry 3 |

---

## Entry 5 — Phase 4, "Coded quality tasks"

**Checked on:** 2026-09-02 · **Branch:** `dev/Quyen-Test` · **Base commit:** `e9dae40` (Phase 1 + 5 + 2 + 3 + 4 work is uncommitted on top)
**Covers:** the whole of Phase 4 — the plan states it as prose rather than numbered items, so the sub-headings below are mine, keyed to the "Touches" list the plan ends on.

**How I checked.** Same standing as Entries 1–4: I built it, so read this as a build record, not an independent audit. Everything marked ✅ was verified by the test suite, both type checkers, a server log line, or a live click in the browser. The one item I could not verify by clicking — that the AI never emits a code — is verified by a test that asserts on the schema rather than the prose.

### The short answer

**Phase 4 is complete. No deviations from the plan's intent, but one deliberate refusal of the obvious implementation, and one bug found by looking at the screen.**

| Health check | Result |
|---|---|
| Automated tests | ✅ 1057 passed, 35 suites (was 1047 / 34 — 10 new, all in `taskCodingContract.test.ts`) |
| Type checking — backend | ✅ Clean |
| Type checking — frontend | ✅ Clean — `npx tsc -p tsconfig.app.json --noEmit` |
| Schema migration | ✅ **None needed** — `HistoricalActions.taskCode` was already migrated; the new projection generates a view byte-identical to the one in `db.sqlite`, confirmed against `cds compile --dialect sqlite` |
| Catalogue coverage, live | ✅ `26/32` codes used across the case library, **0 orphans, 0 uncoded actions** |
| Manual UI walkthrough | ✅ Both Master Data catalogues, the Code column, the F4 picker, the detail dialog, a full accept → edit → save → read-back → revert cycle |

---

### The decision the whole phase rests on: the AI does not write the code ✅ Done

*The plan's point: coded tasks make "what did we do last time this happened" a lookup instead of an AI re-reading old prose.*

The obvious implementation is a `taskCode` field on the D3/D5/D7 output schema. **I did not build that, on purpose.** A model will always fill such a field with a plausible code, including when it picks the wrong one — and at that moment there are **two** sources of truth for a code, the model and `classifyTaskCode`, with no way to tell which is right. A wrong code is worse than no code: it is a lookup that quietly returns the wrong precedent.

So the contract is: **the AI writes the sentence, the rules assign the code.** What Phase 4 changed in the prompts is not a new field but the *shape of the sentence*, so the rules can read it:

| Constant in `precedent/defaults.ts` | What it does |
|---|---|
| `TASK_CODING_MECHANIC` | Requires every action to open with the imperative verb naming the **primary** work, because `classifyTaskCode` matches on the leading clause |
| `NO_TASK_CODE_MECHANIC` | Forbids the model from emitting a task code, code group, or planned end date at all |

Both are appended to the D3, D5 and D7 mechanics. The `action` item descriptions were reworded to match.

> **This decision is spread across three files and would be silently undone by anyone adding the field "for completeness", so it is locked by tests rather than by a comment.** `taskCodingContract.test.ts` asserts, for each of D3/D5/D7, that the prompt carries both mechanics **and that `inputSchemaJson` contains none of `taskCode`, `taskCodeGroup`, `plannedEndDate`. The schema assertion is the real one — a prompt is advice, a schema is what the model is blocked from generating.
>
> One test is behavioural rather than textual, and proves the wording earns its place: `"Rework 48 bridged boards and re-test continuity"` and `"Re-test continuity on 48 boards after rework"` describe the same work and must classify **differently**. If anyone loosens the leading-clause rule, that test goes red instead of a real case quietly filing under the wrong code.

---

### The D3/D5/D7 task UI ✅ Done

`action-table.tsx` gained a **Code** column and, in the task detail dialog, a Task Code picker, a derived Code Group, and a Planned End Date.

**The code picker goes through `ValueHelpInput`, not a local `<Select>`.** Both QM catalogues must switch to S/4 by editing one `ValueHelpList` row. A hand-rolled dropdown here would be the one that gets forgotten on that day.

**It is deliberately not `strict`, unlike the defect code.** The defect-code F4 hard-blocks because an off-catalogue defect code scores zero on precedent retrieval. Task codes do not feed scoring, so blocking a save would trade "a record missing a code" for "a task assigned to nobody" — the worse of the two.

**The code group is read-only and never stored independently.** Every write path — `handleSave`, `handleCreateTask`, `normalizeTasks` — derives it with `taskCodeGroupOf(code)`. One code belongs to exactly one group, so a separately-stored group is a field that can only ever be *wrong*.

**Typing a task by hand classifies it the same way accepting an AI suggestion does.** `handleCreateTask` falls back to `classifyTaskCode(name)` when the code box is left blank. Without this, statistics by code would report that hand-added tasks "rarely have a code" — a conclusion about the input form, read as a conclusion about the factory.

**`plannedEndDate` is in the dialog, not in the table.** It is per-task operational data; the code is in the table because retrieval is what Phase 4 is *for*. Another date column would only make the table narrower without paying anything back to lookup.

---

### Master Data → Code Catalogues ✅ Done

*The plan asked for "a task code catalogue in Master Data alongside the defect one".* Delivered as **one read-only tab showing both**, because the defect catalogue had no UI at all — it lived in `ValueHelpList` and surfaced only through an F4 dropdown, which meant the hard-block's advice to "add it in Master Data first" pointed at a screen that did not exist.

Read-only is the point, not a shortcut: both are SAP master data (type 9 defects, type 2 tasks). A write path here would promise something that has to be withdrawn when S/4 is connected, and in the meantime would create a second catalogue drifting from SAP's.

**The "Used in closed cases" column is the visible proof that Phase 4 works.** It counts by fetching the column and tallying client-side rather than using `$apply=groupby` — a group-by returns empty rather than erroring on some adapters, and a column of zeroes looks exactly like "nobody has used any code". Zero renders as a literal `0`, not `—`: a code that exists and has never been used is a fact, not a missing cell.

---

### `verifyTaskCatalogueCoverage()` ✅ Done

A startup check beside the existing defect one, in `valueHelpSeeder.ts`, called from `server.ts` **after** `seedLibraryFromBundle()` — it reads `HistoricalActions`, a composition child of `HistoricalCases`, so an empty library would make it report "full coverage of 0 codes": technically true, useless.

It differs from the defect version in what an orphan *means*. A defect code is typed by a human into a hard F4, so an orphan there is a data-entry problem. A task code is derived by rule, so **an orphan means the rules and the catalogue have drifted** — a programmer's error, logged at `error`. Uncoded actions are logged at `warn`, not `error`, because a blank code is the *correct* answer for prose the rules cannot read; it is a rising count that is the signal to add a rule.

Live output on the seeded library:

```
Đã seed 2 định nghĩa F4: TASK_CODE_GROUP, TASK_CODE
Catalogue phủ đủ 25 mã lỗi
Danh mục nhiệm vụ phủ đủ 26/32 mã đang dùng trong kho hành động.
```

**26 of 32 is full coverage, not a gap.** The remaining 6 are documented in `shared/task-catalogue.ts` as codes the rules never emit on their own — they only ever appear as the *second* half of a compound action, which the leading-clause rule correctly files under the first half. They exist so a human can pick them by hand.

---

### One bug found by looking at the screen

> **⚠ `GET /HistoricalActions` returned 405, and every usage count read `0`.**
> `HistoricalActions` is a composition child of `HistoricalCases`. CAP auto-exposes it — the view `EightDService_HistoricalActions` exists and so does its `<EntitySet>` in the EDMX — but an auto-exposed child is only reachable **through its parent** (`HistoricalCases(ID)/actions`). Calling it at the top level is `405 Method Not Allowed`.
>
> This is exactly the failure the fetch-then-count decision above was chosen to avoid, and it still got through, because the symptom is identical: a column of zeroes. It was caught by reading the **network log** after the screenshot looked wrong, not by any error surfacing in the app.
>
> *Fix:* an explicit `@readonly entity HistoricalActions as projection on ns.HistoricalActions;` in `EightDService.cds` — the same pattern `HistoricalTeamMembers` already uses. `@readonly` and not writable: actions enter the library by the two paths already declared on `HistoricalCases`, and a write path here would be a second source of codes.
>
> *No migration:* the generated view was compared against `db.sqlite` and is identical, so this is a service-model change only.

---

### Acceptance

| Check | Result |
|---|---|
| Every D3/D5/D7 action carries a task code and code group | ✅ On accept, on hand-add, and on manual edit |
| The AI cannot emit a code | ✅ Absent from all three `inputSchemaJson`; locked by 10 tests |
| Action text is shaped so the rules can read it | ✅ Both mechanics on D3/D5/D7; leading-clause behaviour asserted |
| Code group can never disagree with the code | ✅ Derived at every write path, never stored independently |
| Both QM catalogues are visible in Master Data | ✅ New Code Catalogues tab, task and defect side by side |
| "What did we do last time" is a count, not a read | ✅ `TSK-1010 = 11`, `1030 = 7`, `1020 = 4` … on live data |
| Catalogue and rules cannot drift unnoticed | ✅ `verifyTaskCatalogueCoverage()` at boot, orphans at `error` |
| One switch to S/4 for both catalogues | ✅ Both go through `ValueHelpList`; no hand-rolled picker |
| Live round trip | ✅ Accept → `TSK-1010` → edit to `TSK-1020` (group follows) → date `2026-09-30` → save → reopen → `Sep 30, 2026` + catalogue text → revert |

---

### One thing fixed because Phase 4 stepped on it

**The Task column collapsed to a few dozen pixels once the Code column was added.** The table is `w-full` and the six other columns are all `whitespace-nowrap`, so the browser satisfies them first and gives the remainder to Task — the only column allowed to wrap. With six columns the remainder was enough; with seven, action text fell to roughly one word per line. Fixed by giving Task a `min-w-[240px]` floor and letting the existing `overflow-x-auto` handle the overflow: horizontal scrolling is something a reader understands, a vertical column of single words is not.

---

### Still owed after Phase 4

| Item | Owner | Note |
|---|---|---|
| HANA delta deploy — the `HistoricalActions` projection | Dev | Service-model only; no table or column change |
| `scripts/migrate-task-codes.mts` — one run per local database | Every dev | Idempotent; **stop the CAP server first** |
| Everything still owed from Entries 1–4 | — | Unchanged; see the end of Entry 4 |

---

## Entry 6 — Carry-overs: the Create 8D popup, the retired "Defect Class", and inline defect edit

**Checked on:** 2026-09-02 · **Branch:** `dev/Quyen-Test` · **Base commit:** `e9dae40` (all phase work is uncommitted on top)
**Covers:** the three items left open at the end of Entries 1–5 — **S5** (the Create 8D popup was missing half its design), **S7** (two UI strings still said "Defect Class" after the term was retired), and the **inline defect edit** logged as a deviation from Entry 3 · 2.3. Plus the two naming decisions the user settled before this build started.

**How I checked.** Same standing as Entries 1–5: I built it, so read this as a build record, not an independent audit. Everything marked ✅ was verified by the test suite, both type checkers, a direct OData call, or a live click in the browser.

### The short answer

**All three carry-overs are closed.** One of them turned out to be hiding a data-loss bug that would never have surfaced as an error, and one turned out to be hiding a silent no-op in code that had already been written.

| Health check | Result |
|---|---|
| Automated tests | ✅ 1057 passed, 35 suites (unchanged — the new paths are UI and CDS actions, neither covered by the backend suite) |
| Type checking — backend | ✅ Clean |
| Type checking — frontend | ✅ Clean — `npx tsc -p tsconfig.app.json --noEmit` |
| Schema migration | ✅ **None needed** — the due date reuses `Reports.slaResponseDue`; no new column, so the 35 SQLite service views are untouched |
| Served model | ✅ `startEightD(defectID, title, dueDate, coordinator)` and `setCaseCommitments(reportID, dueDate, coordinator)` both present in `$metadata` after restart |
| Manual UI walkthrough | ✅ The popup end to end on a real internal defect, the detail-header editor through a full set → clear cycle, and a defect edit → save → read-back |

---

### The decision that shaped everything else: where a committed due date lives

The user's answer to the deferred Q2/Q3 cycle-time question was **"allow users to set it for each 8D report case"** — per case, not a blanket policy. That is compatible with decision **Q12** (the system invents no deadline for internal cases) but only if the distinction is stated precisely:

> **Q12 constrains the *system*, not a *human*.** "The app must not invent a deadline" and "nobody may commit to one" are different sentences. A coordinator typing a date into a box is a person making a promise, and that is exactly what Q12 wanted to exist.

Three routes were possible. **Two were rejected after reading the code, not after trying them:**

| Route | Why not |
|---|---|
| A new column, e.g. `Reports.committedDue` | CAP's SQLite service views enumerate columns explicitly. A new column means dropping and recreating 35 views — a migration for a field that already exists |
| Through the payload — `buildDefectPayload` → `customer_reference.sla_response_due` | Cleanest on paper: single source of truth, visible to the AI. **But `datasetValidator.ts:217-224` raises `Q1-ONLY-CUSTOMER-FIELDS` for any non-`N/A` value there on a non-customer case, and `defectPayload.ts:104-109` hard-codes the `N/A` sentinel for non-Q1 origins.** Every internal case with a committed date would have been flagged invalid by the app's own validator |

**Chosen: `Reports.slaResponseDue`, one column with two write paths** — derived from the customer SLA on a Q1 case, typed by a human on any case. The commitment is a ProResolve workflow field and never enters the SAP-shaped payload, so the validator stays right about what it is checking.

> **This is the entry's one load-bearing claim, so it is the one I verified against the database rather than by reading.** See "The bug this uncovered" below.

---

### S5 — the Create 8D popup ✅ Done

`analyze-dialog.tsx` went from 416 to 751 lines. What it did before: list open defects, click one, analyse. What was missing was everything between the click and the analysis.

| Added | Why it earns the space |
|---|---|
| A search box over the defect list | Filtered **client-side**. `listStartable` takes a `search` parameter, but using it means two network round trips (Defects + Reports) per keystroke to filter a list already in memory and capped at 100 rows |
| A two-beat selection: pick, then preview | The first click no longer starts an irreversible analysis. It fetches the full defect and shows what the 8D will actually read |
| "WHAT THIS 8D WILL ANALYSE" — origin, found date, material, plant, work centre, code group / code, quantity, inspection results | The old dialog asked the user to commit an AI run against a row they had seen four columns of |
| **Required completion date** | The user's per-case decision, above |
| **Coordinator**, with partner F4 | Defaults to the coordinator on the defect |
| A `← Change` button | A preview you cannot back out of is a confirmation screen, not a preview |
| Code **and** code group on each list row | A bare code like `0012` says nothing without its group — the same number under two groups is two different defects |

**What is deliberately still absent: team, problem statement, containment.** Those are D1, D2 and D3 content. Collecting them here would mean either the AI overwrites what the user typed, or the user's text blocks the AI — and the popup would become a worse version of three screens that already exist.

**Priority is absent on purpose.** The user's answer was "skip it entirely": the derived priority in `case-workload.ts` already drives row ordering and styling, and a stored field would be a second, staler answer to the same question.

**Sample cases and JSON import are behind one header icon** (`{}` → `✕`), per the user's decision — *"the focus will be only from create 8D from current on going defect"*. They are not removed; they are one click away, with `aria-label`/`title` "Import a case as JSON" / "Back to defect list".

**On an internal case the date box starts empty, and says why:** *"Optional. Internal defects carry no SLA, so nothing is filled in — set a date only if the team commits to one."* On a Q1 case it pre-fills from the customer SLA. That difference is Q12, made visible instead of documented.

---

### The bug this uncovered: a commitment that survives creation and dies three minutes later ⚠

`createReport` writes `slaResponseDue` and `coordinator` at INSERT. **`saveReportContext` writes the same two columns again, after AI enrichment.** Enrichment derives them from the payload — which for an internal case yields `"N/A"` and `null`.

So the original implementation would have worked perfectly in a manual test and failed in production: the user sets a date, sees it, and roughly three minutes later the analysis finishes and silently replaces it with nothing. No error, no log line, no failed request. **The field would simply appear not to save, intermittently.**

Fixed by making the second write **fill blanks only**:

```ts
const current = await SELECT.one.from(REPORTS)
    .columns('slaResponseDue', 'coordinator').where({ ID: reportID });
...
slaResponseDue: current?.slaResponseDue ?? enrichedDue,
coordinator:    current?.coordinator    ?? enrichedCoordinator,
```

**Verified against the live database, not by reading.** After creating an 8D from internal defect `8D-10049123` with a committed date:

```
columns:  slaResponseDue = "2026-10-15"   coordinator = "Quyen La"
caseContext (written by saveReportContext, 1754 bytes):
          customer.slaResponseDue = "N/A"   responsibility.coordinator = null
```

The enriched context says `N/A`; the columns still hold the promise. That is the guard working — and it is the only way to tell, because both states look identical from the UI until the analysis finishes.

> **A second, quieter defect in the same area:** `createReport` had already been given a `commitments` parameter, and the INSERT body still read `isoDateOrNull(context.customer?.slaResponseDue)`. The parameter was accepted and **ignored**. TypeScript does not complain about an unused function parameter, and neither type checker flagged it. The fix is one line each for the date and the coordinator, and it is written as `committedDue ?? isoDateOrNull(...)` rather than `committedDue ?? null` — because opening an 8D and leaving the date box empty must **not** erase the real SLA of a Q1 case.

---

### The date is editable after creation, too ✅ Done

Two fields set in the seconds before an AI run starts are close to useless if they can only be set then. `case-commitments.tsx` is a pencil-toggle inline editor, placed **last** in the detail overview grid — a single editable tile in the middle of ten read-only ones is an invitation to try clicking the other ten.

It is a **narrow CDS action**, `setCaseCommitments(reportID, dueDate, coordinator)`, not an UPDATE on `Reports`. Exposing UPDATE would open all ~40 columns including `caseContext`, `sourcePayload` and every AI result, in order to allow editing two of them. `Reports` deliberately has no UPDATE exposed; this follows that.

**Empty string means delete here, and means "fall back to the payload" in `startEightD`.** The two actions are genuinely different operations — one is "I am not committing to anything at open time", the other is "remove the commitment" — and the difference is documented at both call sites rather than inferred.

**The poll would have eaten the user's typing.** The detail page refetches every 3 s and react-query hands back a new object each time. The sync effect is therefore gated on `editing`:

```ts
useEffect(() => {
    if (editing) return;          // ← without this, every 3 s wipes the box mid-word
    setDueDate(report.slaResponseDue ?? '');
    setCoordinator(report.coordinator ?? '');
}, [editing, report.slaResponseDue, report.coordinator]);
```

Live round trip, all through the browser: set `2026-09-30` + `Minh Dinh` → tiles render → reopen → clear both → save → both tiles read `—`, `Case commitments updated`, row back to `null`/`null`. Server-side validation checked by direct OData call: `31/12/2026` → **400** `dueDate '31/12/2026' is not a valid ISO date (YYYY-MM-DD)`; unknown report → **404**.

> An invalid date is **rejected**, not silently dropped. `isoDateOrNull` returns `null` for both "not sent" and "sent garbage"; the handler separates the two, because a coordinator who mistypes a date must find out that their date was discarded.

---

### S7 — the last two "Defect Class" strings ✅ Done

The term was retired in favour of **Severity** in Entry 3. Two section headings still carried its relative:

| File | Was | Now |
|---|---|---|
| `create-defect/index.tsx:1533` | `3. Defect Classification & Measurements` | `3. Defect Codes & Measurements` |
| `master-data/HistoricalDefectsTab.tsx:803` | `3. Defect Classification & QM Measurements` | `3. Defect Codes & QM Measurements` |

Both sections hold the code group, the code, the severity and the measurements — naming them after their contents avoids the vocabulary question entirely. Verified in the live DOM: the Create Defect dialog now contains no occurrence of "Classification".

**`defectClass` remains the column name.** One label for the user, one name in the schema mirroring SAP's `FECLAS` — deliberate, and commented as such at `create-defect/index.tsx:185`.

---

### D8 is "Team Recognition" everywhere ✅ Done

The user's chosen name. It was already correct in `case-stepper.tsx`, `case-workload.ts`, `workflow/index.tsx` and `ProfileConfigPanel.tsx`; `step-progress.ts:6` still said **`Congratulate`**. One step with two names is two steps as far as a reader is concerned.

`Closure and Recognition` in `types.ts`, `profileRepository.ts` and `precedent/defaults.ts` is **left alone on purpose** — that is the *discipline* long name in the AI-configuration surface, the same register as `Permanent Corrective Actions` and `Prevent Recurrence`, not the step label on the case.

---

### Inline defect edit — the Entry 3 · 2.3 deviation ✅ Closed

Master Data → Defect Records now has a pencil beside the trash.

**It reuses `CreateDefectDialog` rather than adding an edit form**, following that file's own argument: a second form is a second copy of the entire input rulebook, and *bản sao sẽ lệch*. New optional `defect` prop; absent means create.

Three things that are not obvious and would each have been a bug:

1. **The row from the list is not good enough to edit.** `list()` selects about twenty columns and does not expand `characteristics`. Handing a list row to the form opens an empty measurement grid — and saving then **overwrites real measurement data with an empty grid, with no warning at all**. `openEdit` therefore calls `getWithCharacteristics(row.ID)` first and shows a spinner in the button while it loads.
2. **The hydration effect depends on `[open, defect?.ID]`, not `[defect]`.** React-query returns a new object identity on every refetch; depending on the object would re-run hydration mid-edit and wipe what the user was typing.
3. **The dialog is keyed `key={editItem?.ID ?? 'new'}`.** It holds ~30 fields in local state. Without the remount, editing defect A then opening B shows a composite of both, and "Record Defect" afterwards inherits A's values. Verified by clicking exactly that sequence: after saving an edit, the create dialog opened completely blank.

`defectId` and `status` are stripped from the PATCH body. The number is issued once from the `DEFECT` range and the audit trail refers to it; status follows the 8D, not this form. The Notification ID input is `readOnly` and `disabled` in edit mode, with the reason on screen.

**Live round trip:** edited `8D-10049122`, changed the symptom text and the plant → save → read back: symptom and plant updated, `defectId` unchanged, `status` still `In Process` (not reset to `Open`), and the measurement row intact with the same characteristic, value, limit and UoM.

#### The fourth thing — and it was losing data ✅ Fixed

The round trip above ended with a note that the characteristic came back with a **new** `ID`, filed as harmless because nothing in the codebase links to one. That was too generous. `DefectCharacteristics` is `cuid, **managed**` (`db/schema/defects.cds:125`), so delete-and-reinsert does not only renumber the row — it **resets `createdAt` and `createdBy`**.

The database said so plainly. Defect `8D-10049122` was created at `08:41:02.126Z`; after the symptom-text edit above, its measurement row claimed `createdAt = 15:04:21.829Z` — the second I touched an unrelated field.

> For a QM app, *when was this measured and who entered it* is exactly the question an audit asks. Editing a typo in a description silently re-dated every measurement on the record.

**Cause.** CAP deep-updates a composition by matching on the **key**. A child sent *with* its key is UPDATEd in place; children sent *without* keys mean "the old set is gone, here is a new one" — delete, then insert.

**Fix** — three coordinated edits in `create-defect/index.tsx`, threading the child key from read to write:

| Where | Change |
|---|---|
| `InspectionFormRow` | new optional `ID?: string` — empty means a row the user just added |
| hydration | keeps `c.ID` when filling the grid from `getWithCharacteristics` |
| `defectRecord` | re-attaches keys positionally: `...(keptRows[idx]?.ID ? { ID: keptRows[idx].ID } : {})` |

The key is attached **outside** `builtPayloadObject`. That object is the SAP-shaped payload and its `inspections` mapping is an explicit field whitelist; a ProResolve row key does not belong in it. The two are aligned by re-running the same filter (`filter(i => cleanInput(i.characteristic))`), which preserves order — so row *n* of one array is row *n* of the other. Commented in place as a pair that must be changed together.

**Verified against the running server**, all four shapes, on `8D-10049122`:

| PATCH shape | `ID` | `createdAt` | Outcome |
|---|---|---|---|
| child **without** key (the old behaviour) | `01c73dbd…` → `1e2f4b25…` | `15:04:21.829Z` → `15:38:10.356Z` | ❌ reproduces the bug — the test is sensitive |
| child **with** key, value `0.32` → `0.33` | unchanged | unchanged | ✅ updated in place, `modifiedAt` advanced |
| keyed row **+** a new unkeyed row | row 1 unchanged | row 1 unchanged | ✅ row 2 inserted with its own fresh key |
| the added row removed again | row 1 unchanged | row 1 unchanged | ✅ row 2 deleted, row 1 survives |

Content still round-trips; only the destruction stopped.

---

### One thing the walkthrough exposed that is not a bug

Saving the edit was **blocked** by the strict Plant value help: *"Plant holds a value outside the catalogue."* The row genuinely held plant `1010`; the `PLANT` catalogue is `1000/2000/3000/4000`.

This is the hard-block doing its job — but it means a legacy row with one bad field cannot be corrected until that field is fixed first. Checked whether it is systemic: **of 26 defects, exactly one has an off-catalogue plant, and it is the smoke-test row I created in an earlier entry.** Every other row has `plant = null`. Not a data-quality problem; left as is.

---

### One observation left undiagnosed

Partway through the verification above, the local CAP server stopped answering **every** request — `$metadata` included — while the `8D-10049123` analysis had been running for over thirty minutes. Not slow: no response at all, from the browser or the shell. A restart cleared it, and the report came back up as `Failed`.

I cannot say what caused it, and killing the process destroyed the evidence, so this is logged as a symptom rather than a finding. Two candidates worth checking if it recurs: an analysis step blocking the event loop, or the SQLite write lock being held across a long AI call. Worth a repeat attempt with the server log kept.

> The commitment columns are unaffected either way — `8D-10049123` still reads `2026-10-15` / `Quyen La` after a failed run and a restart, which is the fill-blanks-only guard holding under the worst case available.

---

### Acceptance

| Check | Result |
|---|---|
| The popup shows what the 8D will read before it runs | ✅ Preview gate on a real internal defect |
| A due date can be committed per case, at open time | ✅ `8D-10049123` → `2026-10-15` on a Q3 internal case |
| …and changed afterwards | ✅ `setCaseCommitments`, set and clear, through the UI |
| The system still invents no deadline (Q12) | ✅ Internal case opens with the box empty and says why |
| A commitment survives AI enrichment | ✅ Columns hold the promise while `caseContext` says `N/A` |
| An invalid date is rejected, not dropped | ✅ 400 with the offending value quoted |
| No stored Priority field | ✅ Per the user's decision; ordering still derived |
| Samples/JSON behind one icon | ✅ `{}` in the dialog header, labelled both ways |
| "Defect Class" gone from the UI | ✅ Zero occurrences of "Classification" in the Create Defect DOM |
| D8 named once | ✅ `Team Recognition` in all five step-label maps |
| A defect can be corrected without deleting it | ✅ Edit → save → read-back, measurements intact |
| Editing cannot silently destroy measurements | ✅ Full record fetched before the form opens |
| Create mode never inherits edit state | ✅ `key` remount, verified by clicking the sequence |
| Editing a defect keeps measurement provenance | ✅ Child key threaded through; `ID` and `createdAt` survive, add and remove still work |

---

### Still owed after Entry 6

| Item | Owner | Note |
|---|---|---|
| Delete test rows `8D-10049122` (+ report `75b17fd7`) and `8D-10049123` (+ report `d53d3f52`) | Dev | Both are UI smoke tests of mine. Both reports are now in a terminal state (`Failed`), so nothing will write to them — safe to delete. `…122` also carries the four provenance PATCHes from the verification above |
| `Reports.plant`, `Reports.defectClass` unpopulated on seeded rows | Dev | Unchanged from Entry 4 |
| Per-machine migration scripts | Every dev | `migrate-number-ranges.cjs`, `migrate-case-provenance.cjs`, `migrate-defects.cjs`, `migrate-worklist-fields.cjs`, `migrate-task-codes.mts` — **stop the CAP server first** |
| HANA delta deploy | Dev | Now also covers the two new `EightDService` actions — service-model only, no table change |
| The missing `/guide` route | Dev | Unchanged from Entry 3 |
| Unreferenced `workflow/` files | Dev | `steps.tsx`, `case-library-section.tsx`, `team-preview-section.tsx` |
| Close one case through the UI end to end | Dev | Still never done; D8 approval writes to the precedent library and that path is untested by hand |
| Reproduce the server hang with the log kept | Dev | See *One observation left undiagnosed* — a long analysis and a fully unresponsive server, cause unknown |
| Everything still owed from Entries 1–5 | — | Unchanged |

---
