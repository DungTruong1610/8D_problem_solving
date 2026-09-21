# SAP QM Chain Alignment — Verification of 8D Copilot Screens

**Date:** 2026-08-31 · **Revised 2026-09-01** — findings promoted, object model decided
**Branch:** `dev/Thien`
**Status:** **Promoted** → `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md`. This document is the evidence, not the work list.
**Owner:** Quyen (BA) · **Audience:** Dev team, reviewers
**Authoritative for:** whether the screens and object model match the SAP QM chain — the flow, the fields per screen, the integration gaps. It decides nothing about what gets built or in what order.
**Related:** `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` · `PRECEDENT-RETRIEVAL-REVIEW.md` (retrieval engine, separate owner)

**Scope:** Verify the app against the corrected SAP QM chain (trigger → inspection lot → results recording → defect recording → 8D case) across three dimensions: (1) the flow, (2) business fields per screen, (3) integration points and gaps.

**Revision 2026-08-31 (later the same day).** Sections marked 🆕 were added after reviewing a published SAP walkthrough of the same process in S/4HANA Cloud Public Edition 2302 — *"Defects Creation and Problem Solving by using 8-D Methodology in RISE with SAP Public Cloud"* (SAP Community blog, joesherin_2286, 2023). It confirms several findings below with SAP's own field names, adds one gap nobody had spotted (task codes), and raises one genuine conflict with this document's "Key correction". All three are marked in place.

---

## Reference chain being verified against

```
① TRIGGER EVENT
   goods receipt · production order confirmation · stock transfer
                        │  (usually automatic, not a user action)
                        ▼
② INSPECTION LOT  (QALS)          ← "Create Inspection" happens here,
   material, batch, plant,           but mostly the system creates it
   EQUNR = fixture/equipment
                        │
                        ▼
③ RESULTS RECORDING  (QAMR)
   inspector measures the characteristic → 0.20 mm vs spec 0.50 mm
   characteristic valuated as REJECTED
                        │
                        ▼
④ DEFECT RECORDING  ─────────────────────────────┐
   "Record Defects" app                          │  ONE step,
                                                 │  not two
   creates ▸ QUALITY NOTIFICATION (QMEL)  header │
            └─ DEFECT ITEM (QMFE)         item ──┘
            notification type Q3 = internal problem
                        │
                        ▼
⑤ THE 8D CASE
   the notification IS the case. D1–D8 hang off it.
```

**Key correction (on-premise reading):** there is no separate defect object. A defect is an item (QMFE) inside a quality notification (QMEL). Recording a defect is what causes the notification to exist. "Create Notification → Create Defects" is one box, not two.

> **Update 2026-09-01 — D-1 decided: S/4 Public Cloud.** This correction describes on-premise QM and is now the *closed* reading. The app will be built on the Cloud model (defect and problem-solving process are two objects, 1:1, separate numbers). See `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` D-1. The rest of this document's per-screen field findings still stand; only the object-model conclusion is superseded.

### Three entry paths

| Path | Starts at | Inspection lot exists? |
|---|---|---|
| **A** — defect found during inspection | ② lot → ③ results → ④ defect | ✅ yes, linked |
| **B** — defect found outside inspection (line, warehouse, assembly) | ④ defect directly | ❌ no lot at all |
| **C** — customer complaint (Q1) | Create Quality Notification directly | ❌ no lot |

---

## Scope 1 — Is the flow right?

### What is correct

**No two-step create error.** `app/cnma_proresolve_ui/src/pages/create-defect/index.tsx` is a single dialog titled *Record Quality Defect / Fiori Record Defect* that emits one payload containing header + defect classification + measurements. One submit, one object. This models ④ correctly.

**⑤ is correct *on-premise*.** `Reports.notificationId` is the case key, there is no separate "8D object", and `srv/EightDService.cds` deliberately blocks CREATE on `Reports` so a case can only come into existence through `analyzeFromJson`. The notification *is* the case.

**Path A / Path B is already explicit.**

- `create-defect/index.tsx:104` — `entryMode: 'during-inspection' | 'outside-inspection'`
- The Inspection Lot field disables itself to *"N/A (Found outside scheduled inspection)"* on Path B (`create-defect/index.tsx:786-805`)
- `srv/src/domain/eightd/postProcess.ts:330` writes D2's `problem.how` from it

This is correct SAP behaviour.

### What is wrong

#### ① Master Data → 8D Reports is not a business flow

Creating an inspection lot in Master Data and then going to 8D Reports reads like step ② → ④. It is not.

`srv/src/domain/eightd/eightDAnalyzer.ts:951-976` queries `InspectionLots` **by `materialId` only**, ordered by date, and hands the rows to D2 as `historicalInspectionLots` for Is/Is-Not. It is a *comparison population*, never the parent object of the defect. A lot created in Master Data has **zero** connection to the lot ID typed in the defect popup.

The tab label "QM Inspection Lots" tells the user it is ②.

> **Verdict:** right as a demo seeding path, wrong as a business path, and currently mislabelled as the latter.

#### ② Step ③ Results Recording is missing entirely

The app goes lot → defect with nothing between. In Path A the defect exists *because a characteristic was valuated as rejected*.

In the popup the inspection grid has characteristic / measured / spec / equipment but **no valuation field**. `outOfSpec` is *parsed* out of the free-text spec string at `srv/src/domain/eightd/caseMapper.ts:504` and is allowed to be `null` when parsing fails. The one field that is the actual trigger of the whole chain is inferred, not recorded.

Meanwhile `conforming` *does* exist on the master-data lot form — the valuation is on the wrong screen.

#### ③ Path C is a dropdown value, not an entry path

Q1 is just an option in the same form, which still shows Discovery Mode and Inspection Lot ID. `Q1 - Customer Complaint` + `during-inspection` + a lot number is currently saveable, which cannot exist in SAP. When origin = Q1, Discovery Mode must be forced to outside/none and hidden.

Also: the origin dropdown offers only Q3 and Q1, but the JSON importer maps `Q2 - Supplier Defect`. The two disagree.

---

## Scope 2 — Do the screens carry the right business fields?

### Record Defect popup

| Issue | Detail |
|---|---|
| **Plant missing** | Notification and lot both carry WERKS. `PLANT` value help is seeded (`srv/src/domain/eightd/valueHelpSeeder.ts:138`) — the form has no plant field at all. |
| **Defect code is flat** 🆕 | Real coding is catalog type 9 → **code group → code**. The seeder already models the cascade (`DEFECT_CODE_GROUP` → `DEFECT_CODE`, `valueHelpSeeder.ts:212-234`). The form is one free-text box + a description box. **Confirmed by the SAP walkthrough**, which lists the defect-creation fields as *"Description", "Defects Detailed Description", "Defect Code", "Defect Code Group" and "Reference Number"* — code group is a field of its own, and codes are *"predefined defect codes maintained in the inspection catalog"*, i.e. selected, never typed. The same source shows D2 displaying *"the defect 'Code Group' and 'Defect code'"*, so the group must survive into the case, not just into the form. |
| **Defect class is computed then discarded** 🆕 | `DEFECT_CODE`'s return mapping already carries `defectClass` (Critical / Major / Minor, derived per code with a documented rationale at `valueHelpSeeder.ts:88-104`). The form has no field to receive it, so severity is worked out and dropped on every case. It is also absent from `HistoricalCases`, which is why D1 cannot vary the suggested team by severity. |
| **Catalog and case library use different code spaces** 🆕 | `mock-data/clean/` contains **25** distinct defect codes; the `DEFECT_CODE` value help offers **13**. Twelve historical codes can never be selected — including `DEF-0104`, which is the defect on `8D-10049010`, the highest-scoring precedent in the 2026-08-31 live run. In other words: the best example in the library cannot be re-created through the form. Fix before wiring the F4, or the first thing the F4 does is block valid input. |
| **Reference Number missing** 🆕 | The SAP walkthrough lists it as a defect-creation field (link to the originating document). No equivalent on the popup. |
| **Defect quantity** | "Quantity / Extent on Hold" is `String(60)` free text ("61 units on hold"). QMFE has a numeric defect quantity + UoM. `UOM` value help is seeded and unused. |
| **Derived fields typed by hand** | Material Group (MATKL) and Work Center Description are user-typed. Both come from the material/work-center master via F4 return mapping — typing them lets them contradict the master. |
| **Spec as one string** | `specValue: "max 0.10 mm"` — one string instead of lower/upper limit + UoM. This is precisely why `outOfSpec` can come back null. |
| **Coordinator / Department free text** | Both are partner functions on QMEL. `reportedBy` is correctly a partner picker; the other two are not. |
| **Notification ID client-generated** | `generateRandomId()` at `create-defect/index.tsx:48`, and editable. QMEL numbers are internally assigned. Acceptable as simulation, but should be read-only + labelled "simulated". |
| **Fabricated defaults** | On Q1, empty fields silently become `'CC-2026-PENDING'` / `'Customer Quality'`. Inventing values into an auditable record is worse than a validation error. |
| **Also absent** | reference production order (AUFNR), priority, required start/end. |

### Master Data → Inspection Lots

Fields: lotId, origin, plant, material, date, equipment, work center, characteristic, measured value, unit, conforming.

That is QALS+QAMR flattened to **one lot = one characteristic**. Real lots have N characteristics. Fine as an Is/Is-Not population, wrong as "the lot object" — which reinforces the labelling problem above.

### Master Data → Historical Defects

Fields match `HistoricalCases` (notification, origin, sapStatus, symptom, material + MATKL family, work center, defect code/text, Ishikawa category, COPQ). Business-correct.

But the tab is named "Historical Defects" when the entity is a **closed-case precedent library** — and `srv/EightDService.cds:88` itself warns that hand-written rows lack computed `defectKeywords` / `materialFamily` and therefore **silently never score**. The tab lets users create exactly those dead rows.

---

### 8D steps D3 / D5 / D7 — actions are prose where SAP has coded tasks 🆕

**Not previously flagged, and it is the largest single field gap in the app.**

In SAP, every action in the 8D is a **Quality Task**, and a task is coded exactly the way a defect is. The walkthrough repeats the same field list three times — for D3 containment, D5 corrective and D7 preventive:

> enter the relevant details like **"Task Code", "Task Code Group"**, "Description", "Task Processor" and "Time Effort"

with **Planned End Date** and **Processor Notes** added when the processor opens the task, and a status lifecycle of its own (*Set in Process → Implement → Complete*).

In this app, D3/D5/D7 actions are free-typed sentences with an owner and a status (`defaults.ts:304-307`: *"Return containment.actions as rows with action and status"*). There is no code, no code group, no processor, no time effort, no planned end date.

**Why this matters more than field parity.** Coded tasks are *searchable*. "What did we do the last time we had a surface defect on this line?" is a lookup against `(task code group, task code)` — the same mechanism the defect catalog gives us for problems. Today every containment and corrective action in the case library is unstructured text, which is precisely why D3/D5/D7 precedent reuse depends on the AI re-reading old sentences rather than on retrieval.

**Consequence for scoring:** the retrieval formula has no criterion for "cases that were fixed the same way", and cannot have one until tasks are coded.

**Recommendation:** treat this as its own work item, sized separately from the popup. It touches the D3/D5/D7 form schemas, `HistoricalActions`, and the library seeder. It is not a prerequisite for the demo.

---

## Scope 3 — Integration points and gaps

| # | Integration | Status |
|---|---|---|
| 1 | **Value help layer → any screen** | **Built, wired to nothing.** `components/ui/ValueHelpInput.tsx`, `services/value-help-service.ts`, `srv/src/domain/eightd/valueHelpSeeder.ts` all exist; no screen imports them. Every ID field in the defect popup and both master-data forms is still a raw `<Input>`. Biggest gap, cheapest to close — the backend is done. |
| 2 | **Inspection Lots → Record Defect popup** | **None.** Lot ID is free text (`create-defect/index.tsx:786`); `INS-99999` saves happily. Should be F4 on `InspectionLots` filtered by material/plant, and selecting a lot should pull back material, plant, equipment, work center **and the characteristic rows** into the grid. That return-mapping *is* Path A. |
| 3 | **Historical Defects → Record Defect popup** | **None.** Two distinct things worth building: (a) F4 on material / work center / defect code sourced from history — the seeder already declares `referenceTable: 'HistoricalCases'`; (b) a live "3 similar closed cases on this material + defect code" hint *inside* the popup before submit. Today precedent lookup only runs **after** analysis and is frozen into `precedentsJson`. |
| 4 | Record Defect → 8D Detail | **Works.** `analyzeFromJson` → reportID → navigate. |
| 5 | Inspection Lots → D2 Is/Is-Not | **Connected, but by material only, not by lot.** Side effect: any lot a user adds in Master Data silently changes Is/Is-Not for *every* case on that material. |
| 6 | **8D closure → Historical Defects** | **Missing.** No INSERT into `HistoricalCases` anywhere in `srv/src` — only the `seedCaseLibrary` action. The library never learns from cases this app itself closed. This is the arc that closes ⑤ back to the precedent store. |
| 7 | FMEA | `FmeaRegister` is `@readonly`, seed-only, no maintenance UI — yet D7 depends on it and falls back when empty. |
| 8 | **Open defects → Create 8D Report popup** 🆕 | **Missing, and it is the one that matches SAP most closely.** The popup offers three ways in: paste JSON, upload a file, or pick from a short hardcoded list of "incoming issues". There is no way to select a **defect that already exists and is still open**. See below. |

### ⑧ The popup cannot start an 8D from an existing open defect 🆕

**What is missing.** A quality engineer who already recorded a defect — it exists, it is in progress, it is not closed — has no way to say *"start an 8D on this one"*. They must re-enter or re-paste the case, creating a second record of the same defect.

**Why this is the highest-value integration on the list.** It is not a convenience feature; it is **the SAP flow itself.** The Public Cloud walkthrough describes exactly this sequence:

1. The defect is created in **Process Defects** and exists on its own.
2. Later, someone presses **"Start Problem-Solving Process"**.
3. *"a Problem-solving number is generated, which is then linked to the defect"*, and the 8D is worked in **Resolve Internal Problems**.

So in SAP, **starting an 8D from an existing open defect is the normal path**, and creating one from scratch is the exception. In this app it is the only path that does not exist.

**What it should do.**

- List defects that are **open** — not `Completed` / `Closed` (the same statuses `precedentRepository.ts:11` already treats as closed, applied in reverse).
- Exclude defects that already have an 8D. The walkthrough is explicit: *"it is only possible to create one Problem Solution Process per Defect."* One defect, at most one 8D.
- On selection, carry the defect's material, work centre, batch, defect code + code group, and its measured characteristics straight into the analysis — no retyping, no second record.

**Dependency — now unblocked.** This item is the concrete UI expression of D-1. **Decided 2026-09-01: Public Cloud.** Gap 8 is the primary entry path and is Phase 2.2 of `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md`.

**Related, not the same.** Gap 3 proposes an F4 on *closed historical* cases, to help fill in a new defect. This item is about *open current* defects, to avoid creating one twice. Both are useful; they solve different problems.

---

> **Update 2026-09-01.** The list below is the *finding-time* order. The committed build order, with the decisions that followed, lives in `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md`. Do not implement from this list.

## Recommended fix order

1. **Wire the existing value-help layer into both forms.** Closes gap 1 and most of Scope 2's derived-field problems at once.
2. **Make Inspection Lot ID an F4 with return mapping into the inspection grid** (gap 2). This is what makes Path A mean something.
3. **Add a valuation column (Accepted / Rejected) to the popup's inspection rows**, and split spec into lower/upper + UoM. Stops `outOfSpec` being a parse gamble, and puts step ③ back in the chain.
4. **Gate Q1:** hide Discovery Mode + Lot, require customer reference instead of defaulting it. Add Q2 or remove it from the importer.
5. **Rename the tabs** — "Inspection History (Is/Is-Not population)" and "Closed Case Library" — and either compute `defectKeywords`/`materialFamily` on manual insert or make that tab read-only.
6. **Write closed reports back into `HistoricalCases`** (gap 6).

**Added 2026-08-31** — slot these in:

| Where | What | Note |
|---|---|---|
| **Before step 1** | **Reconcile the defect catalog with the case library** (25 codes vs 13). | Wiring the F4 first would block valid historical codes. Cheap, data-only, and it is a prerequisite, not an enhancement. |
| **With step 1** | Add **Defect Code Group** to the popup as the first, required picker; make Defect Code depend on it; add a read-only **Defect Class** field fed by the existing return mapping; add **Reference Number**. | All four are already modelled in the seeder — this is wiring, not new design. Carry code group through to D2, as SAP does. |
| **Separate work item** | **Coded Quality Tasks for D3/D5/D7** (task code + task code group + processor + time effort + planned end date). | Largest field gap; not demo-blocking. See the new Scope 2 subsection. |
| **Unblocked 2026-09-01** | Defect object vs problem-solving process. | **D-1 decided: Cloud.** Phase 2 of `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md`. |

**Not in this document.** The precedent-matching engine (criteria weights, keyword matching, semantic threshold) was reviewed separately in `PRECEDENT-RETRIEVAL-REVIEW.md`. It matters here because the defect-code criterion is only as good as the coding model above: once code groups exist, the group becomes the natural fallback when codes differ.

---

## Conflict to settle before this goes to dev 🆕 — **SETTLED 2026-09-01: Public Cloud**

**This document states:** *"there is no separate defect object. A defect is an item (QMFE) inside a quality notification (QMEL). Recording a defect is what causes the notification to exist."* — and concludes that the notification **is** the case.

**The SAP walkthrough describes something different** for S/4HANA Cloud Public Edition 2302:

1. A defect is created in the **Process Defects** app and gets its own number.
2. Later, someone presses **"Start Problem-Solving Process"**, and *"a Problem-solving number is generated, which is then linked to the defect."*
3. The 8D is then worked in a **separate app** — *Resolve Internal Problems* — opened by that problem-solving number.
4. *"it is only possible to create one Problem Solution Process per Defect."*

So in the Cloud flow there are **two objects with two numbers in a 1:1 relationship**, created at two different moments — not one object.

**Both readings are defensible.** The QMEL/QMFE model is classic on-premise QM and is what the underlying tables still look like; the Process Defects / Resolve Internal Problems split is what the Public Cloud Fiori apps present. The blog is Public Cloud 2302, which is the target platform.

**Why it matters to the build.** Today `Reports.notificationId` is the one and only key, and a case exists only via `analyzeFromJson` — so recording a defect and starting the 8D are the *same* action. That cannot express the real sequence: many defects are recorded and closed without ever becoming an 8D. If the Cloud model is the target, the app needs a defect record that exists before, and independently of, the problem-solving process.

**Two things this does *not* change:**

- The popup stays **one dialog** — Scope 1's "no two-step create error" finding still holds. Splitting defect from problem-solving process is about *object lifecycle*, not about splitting the form.
- It does **not** mean one report should hold several defects. The Cloud relationship is 1:1, so the current single-defect form is right.

**Decision (2026-09-01):** Public Cloud. Defect and problem-solving process are two objects, 1:1, created at two different moments. Gap 8 is the primary path. Full consequences in `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` D-1 / Phase 2. The on-premise reading is closed. The two things this does *not* change (one dialog, 1:1) remain true.

---

## Open question / assumption

Not verified: whether an S/4 connection is planned for any of these F4s, which would change whether item #2 is worth building against the local table. The seeder comments suggest `sourceType: 'reference' → 'external'` is the intended switch, so building against the local table now is safe.
