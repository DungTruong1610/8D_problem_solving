# SAP Chain Alignment — End-to-End Implementation Plan

**Date:** 2026-09-01 (rev 2 — decisions recorded)
**Status:** Accepted — Phase 0 answered, handed to dev. **Frozen (INDEX Rule 2) — do not edit.** What actually got built, and where the build deviated, is logged in `CHAIN-ALIGNMENT-VERIFICATION.md`.
**Owner:** Quyen (BA)
**Audience:** Dev team (execution)
**Authoritative for:** what gets built to align the app with the SAP QM chain — flow, screens, fields, integration — and in what order
**Related:** `SAP-QM-CHAIN-ALIGNMENT-VERIFICATION.md` (findings SAP-nn) · `PRECEDENT-RETRIEVAL-REVIEW.md` (findings RET-nn, **owned by the AI track, not this plan**) · `AI Requirements - 8D Copilot POC.md` (normative)

---

## Scope boundary

**This plan fixes the business chain:** trigger → inspection lot → results → defect → 8D → closed case.

**This plan does not touch the similarity engine.** Weights, keyword thresholds, the semantic criterion and the scoring paragraph in the prompt are owned by a separate workstream and are tracked in `PRECEDENT-RETRIEVAL-REVIEW.md`. Nothing here proposes a number for them.

**The one handoff between the two:** Phase 1.3 stores `defectCodeGroup` and `defectClass`. That is plumbing this plan owes the AI track — the code-group criterion (RET-07) cannot be built until the data exists. We capture it; they decide what it is worth.

---

## The problem in one sentence

The app treats a **defect code** — a label chosen from a catalogue, shared by thousands of defects — as if it were a **defect identity**, and stores it as one free-typed string; everything downstream inherits that mistake.

Three consequences, all observed:

1. The operator can type a code that does not exist, or mistype one that does. Nothing objects.
2. The code group — which is what makes two differently-coded defects recognisably the same family — is captured nowhere.
3. Severity (Critical / Major / Minor) is derived from the code and then discarded, because there is no field to put it in.

---

## Phase 0 — Decisions

**D-1, the object model, is answered. The plan is written for the Cloud model.**

### D-1 · Object model — **DECIDED: S/4 Public Cloud** *(2026-09-01)*

A defect exists on its own, with its own number. "Start Problem-Solving Process" creates a linked 8D, one per defect. A defect record must therefore exist **before and independently of** the 8D, and gap 8 (start an 8D from an existing open defect) is the **primary entry path**.

Consequences, all now in scope:

- New `Defects` entity; `Reports` gains `sourceDefectId`, 1:1.
- The Record Defect popup records a **defect**. Starting an 8D is a separate, explicit action.
- New Master Data → Defects tab.
- A Defect ID column on the 8D worklist.

The on-premise reading (notification *is* the case) is **closed**. It survives only in one place: `Reports.notificationId` remains the case key for imported and seeded data, so nothing built before this plan has to be renumbered.

### D-2 · Semantic similarity weight — **MOVED OUT OF SCOPE**

Was a blocking decision for Phase 3. Retrieval is a separate workstream. This plan takes no position on the number. When the AI track sets it, the requirements doc and the seed still have to agree — that conflict is recorded in `INDEX.md → Known disagreements` and is theirs to close.

### Decisions taken during review *(2026-09-01)*

| # | Point | Decision | Where it lands |
|---|---|---|---|
| Q3 | May an operator type an ID that is not in the catalogue? | **No — hard F4.** New values are added in Master Data first | 1.2 |
| Q4 | When is the inspection-lot F4 with return mapping built? | **Phase 1**, on the Record Defect popup | 1.4 |
| Q5 | What does the UI call Critical / Major / Minor? | **Severity**. Database keeps `defectClass` | 1.3, S7 |
| Q6 | The form offers Q1/Q3; the importer maps Q2. Which wins? | **Add Q2.** Three origins, Q2 behaves like Q3 | 1.6 |
| Q7 | IDs minted in the browser collide | **Server-side number range, assigned on save** | 1.7 |
| Q8 | Restructure the lot into header + N results? | **No — stays one lot = one characteristic** this round | S2 |
| Q9 | Does the closed-case loop get built here? | **Yes — auto-write on D8, JSON import stays** | 5 |
| Q10 | Should the library accept hand-typed rows? | **No manual Add.** Read-mostly | 4.3 |
| Q11 | How much of the worklist redesign? | **All of it** — chain columns and coordinator UX | Phase 3 |
| Q12 | Due Date for Q2/Q3? | **Q1 from the real SLA; Q2/Q3 blank.** No invented deadline | 3.2 |
| Q13 | Which clock is Days Open? | **From 8D start** (`createdAt`), stops at Closed | 3.2 |
| Q14 | Who is the worklist owner column? | **8D Team Leader**, falling back to Coordinator until D1 is accepted | 3.2 |

---

## Phase map

```
Phase 1  coding model + integration   6–9 d · start now
Phase 2  defect lifecycle (Cloud)     5–8 d · D-1 answered, unblocked
Phase 3  the 8D worklist              3–4 d · needs the Reports promotions in 1.3 / 2.1
Phase 4  coded Quality Tasks          4–6 d · independent, not demo-blocking
Phase 5  close the loop               1–2 d · independent
```

**Fix today, independent of all of it:** the one-line re-run bug — `analyzeDownstreamReport` (`eightDAnalyzer.ts:1154`) does not call `enrichFromDatabase`, so any downstream re-run silently drops D2's inspection history and D7's FMEA link.

> **Build progress is not tracked in this file.** This plan is frozen. See `CHAIN-ALIGNMENT-VERIFICATION.md` for what was built, what deviated, and what is still owed.

---

## Page-by-page change map

The end-to-end view. `—` means the page is untouched in that phase.

| Page / route | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|---|---|---|---|---|---|
| **Record Defect popup** `create-defect/index.tsx` | Hard F4s; code group + severity; lot F4 with return mapping; spec limits + valuation; quantity + UoM; reference number; Q1/Q2 gating; server-assigned ID | Becomes "record a defect" only — no longer implies starting an 8D | — | — | — |
| **Create 8D Report dialog** `eight-d/analyze-dialog.tsx` | — | "Select an existing open defect" becomes the primary path (gap 8) | — | — | — |
| **8D Reports list** `/8d` | — | Defect ID available | Full worklist redesign | — | — |
| **8D Detail** `/8d/:id` | D2 shows code group + code | Header shows the linked defect number | — | D3/D5/D7 actions become coded tasks | — |
| **Master Data** `/master-data` | Tab renames; catalogue reconciliation; number ranges | **New "Defects" tab** | — | Task code catalogue alongside | Library loses manual Add; gains provenance |
| **AI Configuration** | — | — | — | — | *out of scope — AI track* |
| **Workflow / Training** `/workflow` | — | Reflects defect → 8D as two steps | — | — | — |

---

## Phase 1 — Fix the coding model

**Goal:** capture defect classification the way SAP does, and wire the integrations that make Path A mean something.
**Est.** 6–9 days.

### 1.1 Reconcile the catalogue with the case library — **do this first**

The library uses **25** distinct defect codes; the `DEFECT_CODE` value help offers **13**. Twelve historical codes are unselectable, including `DEF-0104` on `8D-10049010`.

**Because F4s are now hard (Q3), an unreconciled catalogue is a wall, not a warning.** The first thing the picker will do is reject valid input, and the operator cannot work around it.

- Extend `DEFECT_CODES` in `srv/src/domain/eightd/valueHelpSeeder.ts` to all 25, each with a `codeGroup` and a `defectClass`.
- Assign groups by the *nature* of the failure, not the code prefix — the four existing groups (`QM-DIM`, `QM-SUR`, `QM-MAT`, `QM-ASM`) already follow that rule.
- Add a startup check: every `defectCode` in `HistoricalCases` must exist in the catalogue. Log loudly on mismatch.

**Acceptance:** every historical case's defect code is selectable in the popup.

### 1.2 Wire the value-help layer — hard

`ValueHelpInput.tsx` and `value-help-service.ts` are built, tested, and **imported by no screen**. Every ID field is still a raw `<Input>`.

The component as written warns and still allows free text. **The decision reverses that for save** (Q3): a value absent from the catalogue is not savable. Keep the warning copy — it explains *why* — and block the submit. The escape hatch for a genuinely new material or code is Master Data, not the defect form.

Replace with `ValueHelpInput` in `create-defect/index.tsx`:

| Field | Value help | Return mapping fills |
|---|---|---|
| Material ID | `MATERIAL` | description, material group |
| Work Center ID | `WORK_CENTER` | description |
| **Plant** *(new field)* | `PLANT` | — |
| **Defect Code Group** *(new field)* | `DEFECT_CODE_GROUP` | filters the code list |
| **Defect Code** | `DEFECT_CODE`, filtered by group | description, **Severity** |
| **Inspection Lot** *(Path A only — see 1.4)* | `INSPECTION_LOT`, filtered by material + plant | material, plant, work centre, equipment, the characteristic row |
| Reported By | `PARTNER` | function, email, phone |

Also both Master Data tab forms.

**Acceptance:** no ID field on any screen accepts a value outside its catalogue; material group, work-centre description and Severity are read-only and derived.

### 1.3 Capture the full defect classification

- Add `defectCodeGroup` and `defectClass` to the payload and to `Reports`.
- Show **Severity** on the popup, read-only, filled by the picker. UI term is Severity; the column is `defectClass` (SAP FECLAS). One label for the user, one name in the schema.
- Carry code group into D2 — SAP's D2 displays *"the defect 'Code Group' and 'Defect code'"*.
- Add **Reference Number** to the popup.

> **Handoff to the AI track:** `defectCodeGroup` stored here is the prerequisite for the code-group criterion (RET-07). This plan captures it and assigns it no weight.

**Acceptance:** a case created through the popup carries group, code, description and Severity, all derived from one pick.

### 1.4 Fix the measurement fields, and make Path A real

Two changes that belong together — the lot's return mapping is what populates the rows this fixes.

- Split **spec** into lower limit / upper limit / UoM instead of one string. Today `outOfSpec` is parsed out of free text (`caseMapper.ts:174`) and returns `null` when parsing fails — and `postProcess.ts:339` picks the Is/Is-Not characteristic from `outOfSpec`, so a parse failure silently changes which characteristic D2 compares.
- Add a **valuation** column (Accepted / Rejected) to the inspection rows. This is SAP's step ③, currently missing from the chain entirely.
- Replace free-text "Quantity / Extent" with **numeric quantity + UoM** (`UOM` value help is seeded and unused).
- **Inspection Lot F4 with return mapping** (Q4): selecting a lot pulls back material, plant, work centre, equipment and the lot's characteristic row into the grid. That mapping *is* Path A — without it, "found during inspection" is a dropdown value with nothing behind it, and the operator retypes data the system already holds.
- Known limitation, accepted for this round: the lot object holds **one** characteristic (Q8), so a lot that failed several cannot be pulled across in one pick. The defect grid supports N rows; the lot behind it does not. Recorded in S2.

**Acceptance:** `outOfSpec` is never `null` for a completed row; no parser guessing; selecting a lot fills the header and at least one result row without typing.

### 1.5 Gate Q1 and stop fabricated defaults

- When origin = Q1, hide Discovery Mode and Inspection Lot; require the customer reference.
- **Remove the silent defaults** `CC-2026-PENDING` / `Customer Quality`. Inventing values into an auditable record is worse than a validation error.

### 1.6 Reconcile the origin list — add Q2

The form offers Q1/Q3; the importer maps Q2. **The list becomes three** (Q6):

| Code | Label | Inspection lot | Discovery Mode |
|---|---|---|---|
| Q1 | Customer Complaint | never | forced outside / none, field hidden |
| Q2 | Supplier Defect | optional | as Q3 |
| Q3 | Internal Problem | optional (Path A) | as today |

**Acceptance:** every origin the importer can produce can also be entered by hand, and no origin can be saved with a lot it cannot have.

### 1.7 Server-assigned number ranges

Both Master Data tabs generate the next ID **in the browser** — `generateNextNotificationId` (`HistoricalDefectsTab.tsx:50`) and `generateNextLotId` (`InspectionLotsTab.tsx:48`), each `max(existing) + 1`. Three defects: **collisions** (two users, same number, nothing detects it); **derived from loaded rows** (filter or paginate and the "next" number can already exist); **assigned too early** (the number appears when the form opens, so abandoned forms burn numbers).

- New `NumberRanges` entity: `{ object, prefix, currentValue, width }` — e.g. `DEFECT / 8D- / 10049201 / 8`, `INSPLOT / 001 / 0000012 / 10`.
- Allocate **server-side, on save**, in the same transaction as the insert.
- The form shows *"Assigned on save"*, not a number.
- External assignment stays possible — SAP supports both, and imported data needs it.

This is also what `Defects` will use in Phase 2.1, so the range object is built once.

**Acceptance:** two users saving at the same time get two different numbers; opening and abandoning a form consumes nothing.

### 1.8 Rename the misleading Master Data tabs

- "QM Inspection Lots" → **"Inspection History (Is/Is-Not population)"** — it is a comparison population, not the parent lot object.
- "Historical Defects" → **"Closed Case Library"** — it is a precedent store.

`defectKeywords` / `materialFamily` are no longer this tab's problem: manual entry is removed in 4.3, so the rows that used to be typed badly can no longer be typed at all.

---

## Phase 2 — Defect lifecycle *(Cloud model — D-1 decided)*

**Est.** 5–8 days.

### 2.1 Separate the defect from the 8D

- New `Defects` entity: own number (allocated from the 1.7 range), status (`Open` / `In Process` / `Completed`), material, batch, **plant**, work centre, classification, characteristics, reference number.
- `Reports` gains `sourceDefectId`, and a defect may have **at most one** 8D — SAP: *"only possible to create one Problem Solution Process per Defect."*
- The popup records a **defect**. Starting an 8D becomes a separate, explicit action.

### 2.2 "Start an 8D from an existing open defect" — gap 8

In the Create 8D Report dialog, alongside paste / upload / sample:

- List defects that are **open** — not `Completed` / `Closed` (mirror `precedentRepository.ts:11`).
- **Exclude defects that already have an 8D.**
- On selection, carry material, work centre, batch, classification and characteristics straight in — no retyping. Reuse the 1.4 return-mapping pattern.

**Why this ranks high:** in SAP this is the *normal* path, and it is the only one the app lacks. It is also the fix for the double-entry problem — today the same defect gets recorded twice.

### 2.3 New Master Data → Defects tab

Browse and maintain defect records, with their 8D link where one exists. Built from Part A of the existing 1,151-line Historical Defects form (see S3), with the lot F4 and hard pickers from Phase 1.

### 2.4 Show the link

- 8D Detail header shows the source defect number.
- 8D Reports list gains the **Defect ID** column.
- `/workflow` explains defect → 8D as two steps.

> **Observed during test design:** `8D-10048412` is `MAT-10247` · `WC-MILL-07` · `DEF-0489` — the *strongest possible* precedent for a new flange-burr case. It is invisible to D1 because its status is `In Process`. Correct behaviour, and a vivid illustration of why open defects need a first-class place in the model.

---

## Phase 3 — The 8D worklist

**Depends on** 1.3 (`defectClass`), 2.1 (`sourceDefectId`), and the promotions in 3.1.
**Est.** 3–4 days.

### 3.1 Promote five fields to `Reports` columns *(the gate)*

`sourceDefectId`, `defectClass`, `slaResponseDue`, `coordinator`, `teamLeader` exist today only inside `sourcePayload`, which cannot be sorted or filtered in a list. **No worklist column below can be built until this is done.** Small schema task, large consequence.

### 3.2 Columns

**Today:** Case · Origin · Material · Symptom · Root cause · Status · Completeness · Created By · Last Updated By.

Reading it as a coordinator with thirty open cases, three questions go unanswered: *which needs me today* (no due date, age or priority), *where is it stuck* ("0/8" does not say the case is sitting in D4), and *how bad is it* (a cosmetic gloss defect and a critical customer return look identical).

| Column | Derivation | Available? |
|---|---|---|
| **8D ID** | keep (currently "Case") | ✅ |
| **Defect ID** | `Reports.sourceDefectId` | ❌ Phase 2.1 |
| Origin | keep — show the customer name for Q1 | ✅ |
| Material | keep | ✅ |
| Symptom | keep — the only human-readable identifier | ✅ |
| **Severity** | from the code's catalogue entry | ⚠️ computed, never stored → 1.3 |
| **Current step** | lowest D-step not yet `Approved` | ✅ derivable from `Disciplines`; the list already reads them for Completeness |
| Completeness | keep, beside Current step | ✅ |
| Status | keep | ✅ |
| **Days Open** | `today − Reports.createdAt`, **stops** at Completed / Closed | ✅ |
| **Due Date** | Q1: `slaResponseDue`, promoted in 3.1. **Q2/Q3: blank** | ⚠️ |
| **8D Team Leader** | D1 roster's Team Leader; falls back to **Coordinator**, shown greyed, until D1 is accepted | ❌ 3.1 |
| Last updated | keep — **drop Created By**; both show the same address on almost every row | ✅ |

**Move to an optional/settings column set:** Root cause (long, truncates, meaningless before D4), COPQ, Work centre, Plant, Created By.

> **Note on Days Open — this overrules live code.** `case-workload.ts:59` computes age from `foundDate ?? createdAt`, describing `createdAt` as a value that "makes every backlogged case look brand new". Both statements are true, which is why they are now **two columns**: **Days Open** measures the 8D (`createdAt`, per the terminology table), and **Response Lag** — optional — measures `createdAt − foundDate`, the delay this note was worried about. Neither pretends to be the other.

### 3.3 Two behaviours worth more than any column

- **Filter chips** — *My cases · Overdue · Critical · Awaiting my approval*. A coordinator opens the worklist to answer "what needs me", and today they must read every row.
- **Overdue and Critical styling** on the row itself, not buried in a cell.

**Deferred, deliberately:** a target cycle-time policy for Q2/Q3 (e.g. Critical 14 · Major 30 · Minor 60). That is a business decision to be configured, not a field to be read, and showing an invented Q3 due date would be worse than showing none. It returns as its own item if the business wants internal cases on a clock.

---

## Phase 4 — Coded Quality Tasks

**Independent of everything above. Not demo-blocking. Est.** 4–6 days.

SAP models every 8D action as a Quality Task with **Task Code, Task Code Group, Task Processor, Time Effort, Planned End Date** and its own status lifecycle. The app has free-typed sentences with an owner and a status.

The payoff is retrieval, not field parity: coded tasks make *"what did we do last time this happened"* a lookup instead of an AI re-reading old prose. It also unlocks a future criterion — *cases that were fixed the same way* — which is impossible today. That criterion is the AI track's to weigh; the coding is ours to supply.

Touches: the D3/D5/D7 form schemas, `HistoricalActions`, the library seeder, and a task code catalogue in Master Data alongside the defect one.

---

## Phase 5 — Close the loop

**Est.** 1–2 days. Independent.

There is **no INSERT into `HistoricalCases` anywhere in `srv/src`** outside the seed action. The library never learns from cases this app closes — which is why it contains nothing but seeded data.

- **On D8 completion, write the case back.** Compute `defectKeywords` and `materialFamily` at that moment, from the closed case (`EightDService.cds:88` warns that rows lacking them silently never score).
- **JSON bulk import stays** — it is how years of closed cases get in at go-live. Reuses `seedCaseLibrary` and the paste dialog already built.
- **No manual Add** (Q10). Those two routes are the only ways in.

Provenance on every row: `closed-in-app` · `imported`. When someone asks "why did the AI suggest that", knowing whether the precedent was a real closed case or a migration record is the first thing you want.

---

## Detailed screen designs

Each answers: **can we reuse the screen, and what is missing?** The right-hand column is where the work is scheduled, so no design floats without an owner.

| Design | Scheduled in |
|---|---|
| S1 Record Defect | 1.2, 1.3, 1.4, 1.5, 1.6, 1.7 · Phase 2.1 |
| S2 Inspection Lots | 1.8 (rename), 1.7 (number range), 1.4 (lot F4) |
| S3 Defects *(new)* | Phase 2.1–2.3 |
| S4 Closed Case Library | Phase 5 |
| S5 Create 8D Report | Phase 2.2 |
| S6 Worklist | Phase 3 |
| S7 Terminology | binding on all of the above |

---

### S1 · Record Defect

**Reuse: yes, and it stops meaning "start an 8D".** The layout, the SAP field labelling and roughly 60% of the fields are a sound defect-recording form. What is missing is the classification chain (code group → code → Severity), the plant, the lot link, and any guarantee that what was typed exists.

Fields absent from the form today, all now scheduled: **Defect Code Group** (the code is only unique within a group — without it the key is wrong), **Severity**, **Plant**, **Reference Number**, **defect quantity + UoM as numbers**, **valuation per characteristic**, and the **inspection lot as a real link** rather than free text.

Two paths through the same dialog, unchanged and correct: **Path A** (found during inspection) picks a lot and inherits its data; **Path B** (found outside inspection) leaves the lot empty. Q1 customer complaints take neither.

The notification/defect ID moves from `generateRandomId()` on the client to the server-assigned range (1.7).

---

### S2 · Master Data → Inspection Lots

**Reorder: yes.** The chain is ② lot → ③ results → ④ defect. Tab order should teach the flow, not contradict it: Inspection Lot first, Defects second, Closed Case Library third.

**Verdict: reuse the screen; do not restructure it this round.**

The form has lot ID, plant, material, equipment, work centre, characteristic, measured value, unit, conforming — good fields, wrong cardinality. It models **one lot = one characteristic**; a real lot is a header with N results. That flattening is defensible for its actual job (an Is/Is-Not comparison population) and wrong as "the lot object" — which is what the old tab name claimed.

Renaming it (1.8) resolves the false claim without paying for the restructure. The consequence is stated plainly in 1.4: the lot F4 can carry one characteristic, so a multi-characteristic reject still needs the defect grid filled by hand. Revisit when a real lot is imported, or when a plant records one.

`conforming` already exists here — it is the valuation, and it is on the *right* screen; it is the defect screen that lacked it.

---

### S3 · Master Data → Defects *(new tab)*

The existing "Historical Defects" form is **two forms fused together**, and the merge is the bug:

| Part | Fields | Belongs to |
|---|---|---|
| **A — defect record** | Notification ID (QMNUM), Origin (QMART), Found Date (QMDAT), Quantity on hold (RKMNG), Reported By (PARNR), Coordinator, Symptom (QMTXT), Material (MATNR) + description + group (MATKL), Batch (CHARG), Work Centre (ARBPL) + description, Defect Code (FECOD) + description (FETXT), Characteristic, Measured value, Spec limit, Equipment (EQUNR) | **Recording a defect** → new `Defects` tab |
| **B — 8D outcome** | SAP Status (QSTAT), Completion Date (QMDAB), Ishikawa 6M category (URCOD), FMEA reference, COPQ, Root Cause / 5-Why conclusion (URTXT), Proven Corrective Action (D5) | **A closed case, after the 8D** → stays in `HistoricalCases` |

**Reuse Part A, do not reuse the entity.** The table behind today's tab is `HistoricalCases` — the precedent store, which retrieval reads with `closedOnly: true`. Logging a live defect into it means writing an open, outcome-less row into the store the AI learns from.

| Tab | Entity | Purpose | Status values |
|---|---|---|---|
| **Defects** *(new, from Part A)* | `Defects` | Log a defect as it is found | Open · In Process · Completed |
| **Closed Case Library** *(existing, keeps Part B)* | `HistoricalCases` | Precedent store | Completed · Closed only |

Phase 5 connects them: a completed 8D writes its case into the library.

---

### S4 · Closed Case Library

**Read-mostly.** A searchable list with a detail view. **No Add button** (Q10) — rows arrive from 8D closure or bulk import, and the screen enforces what the entity already promises:

1. **Nothing open.** The library is `closedOnly` by definition; an open case has no proven lesson.
2. **Computed fields are computed.** `defectKeywords` / `materialFamily` are derived at write time, never hand-typed. The old tab let users create dead rows — they looked saved, and the AI never saw them.

Each row shows its provenance (`closed-in-app` · `imported`), the 8D it came from where one exists, and the code group + Severity that Phase 1 now captures.

---

### S5 · The Create 8D Report popup

**Today:** paste JSON · upload a file · pick from a hardcoded list of three "incoming issues". None of these is how an 8D starts in SAP.

**Add as the primary path: select an ongoing defect.**

| Element | Behaviour |
|---|---|
| **Defect** (hard F4, required) | Lists defects that are **Open / In Process** and **have no 8D yet**. Search by defect number, material, work centre, symptom. Shows symptom, material, code + group, Severity, found date, days since found |
| *Read-only preview* | On selection, show what will be carried over: material, batch, plant, work centre, classification, characteristics. The user sees what the 8D will be built from **before** pressing the button |
| **Priority** (optional) | Defaults from Severity — Critical → High |
| **Required completion date** (optional) | Defaults from SLA for Q1; blank for Q2/Q3 |
| **Coordinator** (optional, partner F4) | Defaults to the defect's coordinator |

**Deliberately not on this popup:** team, problem statement, containment. D1 proposes the team, D2 drafts the problem — asking for them here duplicates the Copilot's entire purpose.

**On submit:** allocate the problem-solving number from the 1.7 range, link it to the defect, set the defect to *In Process*, run the analysis, navigate to `/8d/:id`. Exactly SAP's "Start Problem-Solving Process".

**Keep paste/upload**, demoted to a secondary "Import from JSON" section — it is how demo data and migrated cases get in, and the test flow depends on it.

---

### S6 · The 8D worklist

Designed in Phase 3. Screen-level note: **Current step** and **Days Open** are derivable today and should not wait for the rest — if Phase 3 is staged, those two plus the Severity column go first.

---

### S7 · Terminology — one term per concept, on every page

**The left column is the only term that appears in the UI.**

| Use this term | Means | Not to be confused with | Where it lives | Schema name |
|---|---|---|---|---|
| **Defect ID** | The defect record's own number | *8D ID* — a different object | Defects · worklist | `Defects.id` |
| **8D ID** | The problem-solving process number | *Defect ID* | 8D Reports | `Reports.notificationId` |
| **Defect Code** | **What kind** of defect — `DEF-0489` = *Flange edge burr above limit*. Chosen from the catalogue | *Severity* | Defect · D2 | `defectCode` |
| **Defect Code Group** | The family the code belongs to — `QM-SUR` = surface | *Defect Code* | Defect · D2 | `defectCodeGroup` |
| **Severity** | **How serious** — Critical / Major / Minor. Derived automatically from the code. UI label; "Defect Class" is retired | *Defect Code* | Defect · worklist | `defectClass` |
| **Coordinator** | Owns the **defect** — named when the defect is logged | *8D Team Leader* | Defect · worklist fallback | `coordinator` |
| **8D Team Leader** | Leads the **8D** — assigned in D1 from the roster | *Coordinator* | D1 · worklist | `teamLeader` |
| **Days Open** | Days the **8D** has been open (`createdAt`) | *Response Lag* | worklist | derived |
| **Response Lag** | Days between the defect being found and the 8D starting | *Days Open* | worklist (optional) | derived |
| **Due Date** | When the 8D must be finished | — | worklist | `slaResponseDue` |

#### Defect Code vs Severity — why both exist

They answer different questions, and SAP keeps them apart deliberately:

- **Defect Code** = the diagnosis. *Flange edge burr above limit.*
- **Severity** = the triage level. *Major.*

Severity is **not typed by anyone** — it is a property of the code in the catalogue, so two people recording the same defect always get the same severity. That is the whole point of deriving it, and it is why the field is read-only on every screen. It is already computed in `valueHelpSeeder.ts` and thrown away for lack of a column.

#### Defect ID vs 8D ID — the same confusion, one level up

Today `notificationId` is both: the defect's identity *and* the case key. Under the Cloud model (D-1) they are two numbers on two objects with a 1:1 link — which is why Phase 2 exists.

---

## Out of scope, deliberately

| Item | Why |
|---|---|
| **Similarity engine** — weights, keyword thresholds, semantic criterion, the scoring paragraph in the prompt | Owned by a separate workstream. Tracked in `PRECEDENT-RETRIEVAL-REVIEW.md`. This plan supplies the data it needs (1.3) and takes no position on the numbers |
| Multiple defects per 8D | SAP is 1:1. An earlier draft of this analysis suggested otherwise; it was wrong |
| Live S/4 connection | Value helps are built to switch `sourceType: 'reference' → 'external'`. The two-level defect key must exist first |
| Renaming D8 | The detail page says "Closure"; SAP and `/workflow` say "Team Recognition". Cosmetic; decide separately |
| Restructuring inspection lots into header + N results | Deferred by Q8 — see S2 for what that costs |
| Q2/Q3 due-date policy | Needs a business decision on target cycle times — see 3.3 |

---

## Sequencing summary

```
D-1 DECIDED — Cloud model. No open decisions block this plan.

Phase 1  coding + integration ── 6–9 d · start now
   │                              └─ unblocks Severity, Defect ID and the AI track's RET-07
Phase 2  defect lifecycle ─────── 5–8 d · unblocked by D-1
Phase 3  worklist ─────────────── 3–4 d · needs 1.3 + 2.1 + the 3.1 promotions
Phase 4  coded tasks ──────────── 4–6 d · independent
Phase 5  close the loop ───────── 1–2 d · independent
```

**Starts tomorrow, no dependencies:** 1.1 catalogue reconciliation, 1.2 hard F4 wiring, 1.8 renames, 1.7 number ranges.
**Fix today, outside the phases:** the re-run bug (`eightDAnalyzer.ts:1154`).

Estimates are order-of-magnitude, from reading the code rather than from the team's velocity. Treat them as relative sizing, not commitments.
