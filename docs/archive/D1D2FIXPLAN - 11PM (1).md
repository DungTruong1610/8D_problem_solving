# D1 + D2 — Why D2 Looks Broken, and How We Fix Both

**Prepared by:** Quyen (BA) · **For:** AI Team (Dung, Thien, Minh)
**Status:** Ready to implement · **Version:** v2 — see *Revision note* below if you read the earlier copy
**Scope:** D1 (Team) and D2 (Describe the Problem), plus the Record Defect popup
**Related:** `docs/AI-RULES-8D-STEPS.md` — R2.1 is normative for D1, R2.2 for D2

> **Summary of the two steps.** D2 is genuinely broken: it cannot produce Is/Is-Not for any demo case, and when it correctly reports why, the screen has nowhere to show it. **D1 is not broken** — it has correct grounding, a working "Accept all suggested", and complete team data. D1 needs only two small schema additions to satisfy R2.1 fully. Most of the work below is D2.

> **New to SAP QM terms?** Read **Appendix A** first — it explains *characteristic*, how "out of spec" is decided, and walks the two lookups through real data. Roughly ten minutes, and the rest of the document reads much faster afterwards.

---

## Revision note — what changed in v2

**If you already read the version shared earlier (v1), only these five things are new.** Nothing else was edited, removed, or renumbered — the findings F1–F5, all five steps, the popup review, the developer handbook and every decision in §6.6 are unchanged.

| # | Change | Where |
|---|---|---|
| 1 | **New finding F6** — when a case fails two measurements, only the first is compared, and nothing says so | Part 1, findings table |
| 2 | **Fix for F6 added to Step 1** — push a line into `problem.gaps` naming the characteristic that was *not* compared (~20 lines in `caseMapper.ts`) | Part 5, Step 1 |
| 3 | **Step 1 done-criteria extended** to cover the F6 case | §6.5, row 1 |
| 4 | **Appendix A added** — the glossary and worked examples the team asked for | end of document |
| 5 | Pointer to Appendix A for newcomers | top of document |
| 6 | **Worked example added to every major section** — all in `>` blockquote blocks, so they are skippable if you already know the material | throughout |

The examples in change 6, and where to find them:

| Example | Section | Shows |
|---|---|---|
| Unseeded system | Demo scope | Why an empty Material dropdown means "you forgot the seeder" |
| Screen before / after | Part 1 | The same backend result, with and without a field to print it in |
| Roster with `servedOnCount` | Part 1, D1 | What D1-1 and D1-2 look like when fixed |
| One case through all five steps | Part 2 | What each step changes for a single defect |
| Path A vs Path B, side by side | Part 3 | Both produce the same Is/Is-Not — only *How* differs |
| The lookup at analysis time | Part 5, Step 3 | The SQL, and why `computeIsIsNot` needs no changes |
| **Copy-ready seed CSV** | Part 5, Step 5b | A complete file, with the threshold check worked out |

**Effort impact: none worth replanning.** F6 is ~20 lines inside Step 1, which was already scheduled. Steps 2–5 are untouched.

**Why F6 was added.** It came out of a question during review: *"why did the example compare only Flange burr height when Flange flatness also failed?"* The answer turned out to be that the code picks the first out-of-spec row by array position — not by severity. The single-characteristic behaviour is correct and stays; what was missing is that nothing told the user the second failure was never analysed. See **Appendix A.4** for the full reasoning.

---

## Demo scope — read this first

**The JSON-upload path is not demoed.** Every case shown comes from the Record Defect popup.

Two consequences that change how this plan is executed:

**1. Step 3 is not "the real fix" — it is the *only* fix.**
The popup never sends inspection-lot history, and there is no longer an uploaded-JSON escape hatch that carries it. So **100% of demo cases depend on the database lookup.** Without Step 3, D2's Is/Is-Not is empty in every single demo case, with no exceptions.

**2. `mock-data/` and `seed-library.ts` are still required — do not delete them.**

This is the one that will bite someone. "We removed JSON upload" does **not** mean the mock cases are unused. They are seeded into `HistoricalCases`, which feeds two things the demo cannot run without:

| What | Depends on `HistoricalCases` |
|---|---|
| The popup's own dropdowns — Material, Work Center, Defect Code, Partner | `valueHelpSeeder.ts:154-200`, `sourceType: 'reference'`, `referenceTable: 'HistoricalCases'` |
| Precedent search for D1, D4, D8 | the similarity engine scores against closed cases |

If `seed-library.ts` is not run, **the popup's dropdowns are empty** and every precedent-based step reports "no precedent available".

> **Example — what an unseeded system looks like.** You open Record Defect, click the **Material** search help, and get an empty list. You cannot even pick `MAT-10247`. Nothing on screen says why — the dropdown is simply blank, because `HistoricalCases` has no rows to read from. You would spend an hour debugging the value-help service before suspecting the seeder.

**A useful side effect:** because the Material and Work Center dropdowns are populated *from* historical cases, anything the demo user picks is guaranteed to exist in a past case. Material match alone scores **+3**, and work centre **+4** — so a popup-created case will almost always clear the `minScore` of 3 and produce real precedents for D1, D4 and D8. That is free demo quality, and it also tells us exactly which materials Step 5 must seed lots for.

### 3. The architectural principle this establishes

Removing JSON upload moves the system from *"the payload carries everything"* to *"the database is the source of truth."* That is also how the real SAP integration will work, so the demo architecture stops being a fiction.

It also means: **anything the AI needs that the popup does not send must now come from the database.** Auditing the popup payload against `CaseContext` gives two categories.

**Category A — must come from the database.** Reference data that exists independently of this case.

| Field | Consumer | Status |
|---|---|---|
| `historicalInspectionLots` | D2 Is/Is-Not | Step 3 covers it |
| `fmeaLink` | **D7** | **Not yet covered — see below** |

> **Second instance of the same bug.** `caseMapper.ts:432` reads FMEA only from the payload, and the popup sends `fmeaLink: null`. So **D7 reports "no FMEA entry linked" on every demo case**, exactly the way D2 reports "cannot compare". FMEA is a register keyed by process / work centre — it exists before the defect does, so it belongs in the database.
>
> **Recommended:** add an `FmeaRegister` table (`fmeaId, workCenterId, materialId, description`) alongside `InspectionLots` in Step 3, seeded by CSV in Step 5, looked up in the same place in `analyze()`. It is a small addition to work already planned, and it closes D7's gap for roughly an hour of extra effort.

**Category B — correctly empty.** This case's own work product; the 8D has not been performed yet.

| Field | Why empty is correct |
|---|---|
| `fiveWhyChain`, `causesIshikawa` | The engineer has not analysed yet. D4 falls back to precedent hypotheses plus the AI's independent diagnosis — the designed behaviour. |
| `actions` | Nothing has been done yet. D3/D5/D7 correctly run in *proposal* mode. |
| `teamAssignments` | Suggesting these is D1's entire job. |
| `lessonsLearned` | D8 correctly synthesises from confirmed D2–D7 content. |
| `isIsNot` | Computed, never hand-written. |

**Do not seed Category B.** A freshly logged defect *should* have all of it empty, and every step running in "propose from precedent" mode is the honest scenario. Pre-filling it would fabricate work the engineer has not done, and would break R0.2 and R0.3.

### 4. To verify before the demo

With no recorded 5-Why, D4's headline becomes the AI's **independent diagnosis** — the strongest feature in the product, since the model derives the causal chain from raw evidence alone. But **R2.4.3** requires `independentVerification` to state *agrees / disagrees / insufficient evidence*, and on a fresh case there is no recorded answer to compare against.

This path is untested. Verify that D4 renders sensibly on a popup-created case — ideally *"no recorded root cause yet; this is the AI's independent hypothesis"* — rather than an empty or confusing verification block. Add a test to `__tests__/blindEvidence.test.ts` or `progressiveAnalyzer.test.ts`.

---

## Part 1 — What is wrong, in plain language

### The short story

**The AI is not broken. It is answering correctly, and we are throwing its answer away.**

Think of it like this. You ask an inspector: *"Which machine is causing this problem?"*

To answer, the inspector needs to see **several machines** and compare them. But we only ever show him **one machine** — the one from the current defect.

So he gives the honest answer: *"I cannot tell you. You only showed me one machine."*

That is the right answer. But our report form has **no line to print that sentence on**. So the page just shows an empty box. Everyone looks at it and thinks the AI failed.

Two separate problems, one symptom.

> **Example — what is on screen today vs. after Step 1.**
>
> ```
> TODAY                              AFTER STEP 1
> ┌── Is ──────────┐                 ┌── Is / Is-Not status ─────────────────┐
> │                │                 │ Not applicable — no historical        │
> │   (empty)      │                 │ inspection lots recorded for          │
> └────────────────┘                 │ Flange burr height.                   │
> ┌── Is not ──────┐                 └───────────────────────────────────────┘
> │                │
> │   (empty)      │                 Reader: "There is no history to compare
> └────────────────┘                  against — that is why it is blank."
>
> Reader: "The AI failed."
> ```
>
> Same backend result in both columns. The only difference is whether the form has somewhere to print the sentence.

### D1 — what we found (short version: it works)

D1 was reviewed with the same lens. **It has no data gap and no broken behaviour.** Verified working:

| Checked | Result |
|---|---|
| "Accept all suggested" button (R2.1 HITL) | ✅ implemented — `team-roster-widget.tsx`, `step-suggestion-config.ts:94` |
| Email / phone auto-fill once a partner is picked | ✅ works — all **41** team-member records in `mock-data/clean/` carry both fields |
| `selectionMethod` restricted to the four allowed values | ✅ enforced by enum in the form schema |
| "Unassigned" rule for a role with no grounded person | ✅ in the prompt, and `sourceType` has an `unassigned` value |
| Grounding — no invented names | ✅ `D1_GROUNDING` pattern `^(team\.\|precedents#)` |

> **Stale comment, no action needed.** `valueHelpSeeder.ts:~190` says email and phone are empty because the mock data does not carry them. That is no longer true — every partner has both. Delete or correct the comment when you are next in the file; it misleads, but nothing is broken.

Two genuine gaps remain, both small and both in the same file as D2's Step 1:

| # | What | Rule | Effect |
|---|---|---|---|
| **D1-1** | `servedOnCount` is missing from the roster item schema | R2.1 | People cannot be ranked by how often they served, and the UI cannot show *"served on 1 similar case"*. Fails acceptance criterion 6. |
| **D1-2** | No field to hold the empty-state sentence *"No team suggestion available; assign manually."* | R2.1 Empty | Exactly the same class of defect as D2's missing `isIsNotStatus`. Fails acceptance criterion 7. |

> **Example — D1-1, what the roster should look like.** A new defect on `WC-MILL-07`. Three past cases clear the score threshold; Heli Weber served on all three, Minh Dinh on one.
>
> ```
> TODAY                                    AFTER THE FIX
> Heli Weber    Quality Engineer           Heli Weber    Quality Engineer    served on 3 similar cases
> Minh Dinh     Production Engineer        Minh Dinh     Production Engineer served on 1 similar case
> (order: whatever the model emitted)      (order: by servedOnCount, highest first)
> ```
>
> Without `servedOnCount` the engineer cannot see that Heli is the strongest suggestion, and the ordering carries no meaning.
>
> **Example — D1-2, a case with no precedent.** Defect on a brand-new material nothing matches. Today D1 must still emit a roster (`minItems: 1`), so it produces `Unassigned` rows with no explanation. After the fix, `team.suggestionStatus` reads *"No team suggestion available; assign manually."* and `selectionMethod` is `Roles only - assignment required` — the engineer knows to staff it by hand rather than wondering whether the AI crashed.

### D2 — the six findings, in plain words

| # | What it is | Why it matters |
|---|---|---|
| **F1** | **The defect popup never sends the comparison data.** When you log a defect it sends the measurement for *this* defect — but not the history of other measurements on other machines. | Without history there is nothing to compare, so Is/Is-Not can never work. This is the main cause. |
| **F2** | **The screen has no box for "I cannot compare".** The AI writes this explanation, but the form was never given a field to display it. | The user sees blank boxes instead of a clear reason. This is why it *looks* broken rather than *looks* honest. |
| **F3** | **The AI instructions contradict themselves.** One sentence says "never write Is/Is-Not, we don't have the data." Another says "explain your Is/Is-Not reasoning." | The old sentence was written *before* the feature was built and nobody updated it. The AI receives both at once. |
| **F4** | **Almost no test data.** Out of 23 test cases, only **one** contains the comparison history. | Even when everything else works, there is nothing to demo with. |
| **F5** | **There is no table in the database to hold this history at all.** Today it can only arrive inside an uploaded JSON file. | This is the deeper reason F1 exists. Fixing it fixes D2 for every case, not just uploaded ones. |
| **F6** 🆕 | **When a case fails two measurements, only the first is compared — and nothing says so.** Is/Is-Not runs on one characteristic, chosen by position in the list, not by importance. | The user sees a confident comparison and assumes D2 covered the whole problem. It covered half of it, silently. See Appendix A.3. |

### What this means for the demo

Right now, **every case created through the Record Defect popup will show an empty Is/Is-Not section, forever.** It is not intermittent and it is not a model problem. It is structural.

---

## Part 2 — What we will do, in plain language

Five steps, in order. Each one is useful on its own.

| Step | What | Effort | Why now |
|---|---|---|---|
| **1** | Let the AI explain itself on screen (**D1 + D2**) | ~half day | Smallest change, biggest change in impression |
| **2** | Fix the AI instructions (**D1 + D2**) | ~2 hours | Config only, no deployment |
| **3** | Build the measurement-history table | ~1–2 days | **The real fix** |
| **4** | Add the two paths, end to end | ~1.5 days | Makes both demo stories visible, and makes "How" a fact |
| **5** | Prepare demo data | ~half day | Without this, nothing to show |

**Step 1 — Let the AI explain itself.**
Add the missing box to the screen. Nothing else changes. Immediately, instead of two empty boxes, the user reads *"Cannot compare — there is no measurement history for this part."* The demo stops looking broken. **Do this first.**

**Step 2 — Fix the contradictory instruction.**
Delete the old sentence, keep the new one, push the update. This is an AI Settings change — no code deployment.

**Step 3 — Build the history table. ← the real fix**
Create a place in the database to store past inspection measurements. When the AI analyses a case it looks up: *"show me all past measurements for this same part and same characteristic."* That is exactly what a real SAP system does.

This is the step that actually makes D2 work — for **every** case, including ones created from the popup.

**Step 4 — Add the two paths, end to end.**
Add a choice at the top of the popup: *"Found during inspection"* or *"Found outside inspection."* Send that choice to the backend and let D2 use it, so the **How** box states a recorded fact instead of a guess.

**Step 5 — Prepare demo data.**
First list every part + characteristic used by our demo cases, then fill the history table so each one has either real history **or** a deliberate "nothing to compare" story. Keep **one** visual defect (a scratch, no measurement) so you can show the AI correctly refusing to compare.

Note: we do **not** need to edit the 22 existing test files. Once Step 3 is in place the system looks the history up from the database, so those files start working without being touched — as long as the table covers the parts they use.

> Say this out loud during the demo: **an AI that says "I don't know" when it doesn't know is the feature, not a bug.**

**If time is short:** Steps 1, 2, 3, 5 give a working D2 on both paths. Step 4 can degrade to a label-only dropdown.

> **Example — one demo case, walked through all five steps.** Operator logs a burr defect on `MAT-10247` at `WC-MILL-07`, measuring `Flange burr height` at 0.32mm against a max of 0.10mm.
>
> | Step | What it changes for this case |
> |---|---|
> | — (today) | Is/Is-Not: two empty boxes. Looks broken. |
> | **1** | Is/Is-Not: *"Not applicable — no historical inspection lots recorded for Flange burr height."* Honest, but still no comparison. |
> | **2** | No visible change yet — the model now knows it may not invent the pair. |
> | **3** | The lookup finds 7 lots. **IS** = EQ-MILL07-002 (3/4, 75%), **IS NOT** = EQ-MILL07-005 (0/3, 0%). The feature works. |
> | **4** | *How* box now reads *"Found during inspection — inspection lot INS-80411"* instead of a guess. |
> | **5** | The material actually has those 7 lots seeded, so step 3 has something to find. |
>
> Steps 3 and 5 are what make the feature real. Steps 1 and 2 make it honest while you wait for them.

---

## Part 3 — Is the Record Defect popup right?

**No — it is about 70% right.** It is fully correct for one of the two paths we want to demo, and cannot express the other.

### What is already correct — do not change these

- **Measurements are logged inside the defect.** Characteristic, measured value, unit, operator (max/min/nominal/between), limit, upper limit — as repeatable rows. It sends both the text form *and* the real numbers, which stops the system mis-reading values like `≤0.10` and losing the evidence.
- **It does not pre-fill the 8D team.** The "Coordinator" field deliberately does not flow into the team list. Correct — choosing the team is D1's job, and pre-filling would corrupt D1's suggestions.
- **It leaves causes, actions and 5-Why empty.** Correct — those belong to D3–D7.
- **Section structure matches SAP:** 1. Defect · 2. Reference Object · 3. Impact & Measured Evidence · 4. Responsibility · 5. Customer (Q1 only).

### What is wrong or missing

| # | Problem | Business impact | Fix |
|---|---|---|---|
| **A** | **No fixture / equipment field.** Each measurement says *what* was measured but not *on which machine*. | This is the exact dimension Is/Is-Not compares. Without it the feature cannot exist. | Add **Equipment / Fixture** to each measurement row in Section 3. |
| **B** | **No path choice.** The form assumes the defect was found outside inspection. | Only one of the two demo paths is expressible. | Add a toggle at the top of Section 1. |
| **C** | **No inspection lot number.** When a defect *is* found during inspection, SAP has a lot number linking them. | Path A cannot be shown as a real SAP link. | Add an **Inspection Lot** field, visible only in "during inspection" mode. |
| **D** | **Nothing tells the user why measurements matter.** | People skip Section 3, D2 comes out weak, and they blame the AI. | Add helper text: *"Measurements here become the evidence in D2 and the comparison in D4."* |

### One important thing NOT to change

**Do not make the popup collect the measurement history.**

It is tempting to add a table where the user pastes past measurements. **That would be wrong.** No inspector would type in the last twenty lots while logging one defect. In real SAP that data already exists in the system.

The history must come from the database (Step 3), not from the person filling the form. **Keep the popup about this defect only.**

### Summary of popup changes

```
Section 1 — Defect
  + [Toggle]  ( ) Found during inspection   ( ) Found outside inspection
  + [Field]   Inspection Lot          <- only when "during inspection"

Section 3 — Impact & Measured Evidence
  + [Field]   Equipment / Fixture     <- per measurement row
  + [Hint]    "Measurements here become D2 evidence and D4 comparison."
```

Four changes. That is the whole popup fix.

> **Example — the same defect logged on each path, after the fix.**
>
> ```
> PATH A — inspector finds it during inspection
>   Entry mode        (o) Found during inspection
>   Inspection Lot    INS-80411
>   Defect            DEF-0489  Flange edge burr above limit
>   Material          MAT-10247  Bracket Housing X240
>   Work Center       WC-MILL-07  CNC Milling Line 7
>   Measurement 1     Flange burr height | 0.32 | mm | max | 0.10 | EQ-MILL07-002
>
>   -> D2 "How" box:  "Found during inspection — inspection lot INS-80411."
>
> PATH B — operator finds it on the line
>   Entry mode        (o) Found outside inspection
>   Inspection Lot    (hidden — not applicable)
>   Defect            DEF-0489  Flange edge burr above limit
>   Material          MAT-10247  Bracket Housing X240
>   Work Center       WC-MILL-07  CNC Milling Line 7
>   Measurement 1     Flange burr height | 0.32 | mm | max | 0.10 | EQ-MILL07-002
>
>   -> D2 "How" box:  "Found outside inspection — reported from the line."
> ```
>
> **Both cases produce the same Is/Is-Not**, because the comparison is looked up by material + characteristic, not by how the defect was found. The entry mode only changes the *How* sentence. That is the point of Part 4.

---

## Part 4 — Background: the two paths

Understanding this explains why the fix is shaped the way it is.

In SAP, a defect can reach us by two routes:

```
PATH A — found during inspection
  trigger event (goods receipt / production confirmation)
      -> inspection lot created automatically   (QALS)
      -> inspector records results              (QAMR)
      -> characteristic rejected
      -> defect recorded  ->  quality notification (QMEL + QMFE)
      -> THE 8D CASE

PATH B — found outside inspection (on the line, in the warehouse)
      -> defect recorded directly -> quality notification
      -> THE 8D CASE
```

Note: **a "defect" is not a separate object.** It is an item (`QMFE`) inside a quality notification (`QMEL`). The notification **is** the 8D case — that is why the case ID and the notification ID are the same number.

### The key insight for D2

D2 needs **two different kinds of lookup**:

| Lookup | Question | Joined on |
|---|---|---|
| **Case-scoped** | "What are the facts of *this* case?" | notification number |
| **Population-scoped** | "What do comparable records from *other* cases look like?" | **material + characteristic** |

Is/Is-Not is population-scoped. It deliberately leaves the current case. That is why adding an inspection-lot number to the popup does **not** fix it — and why the history table (Step 3) does.

**Consequence:** with Step 3 in place, Is/Is-Not works on **both** paths. A Path B defect still has a material, and that material still has inspection history. Path A vs Path B only changes what the *current* case can show, not what the comparison can find.

---

## Part 5 — Technical detail

### The failure chain

```
popup builds payload ---> no historicalInspectionLots key
                              |
                              v
      caseMapper: rows(data,'historical_inspection_lots') -> []
                              |
                              v
           computeIsIsNot([]) -> applicable:false, reason:"..."
                              |
                              v
        fiveW2H writes problem.isIsNotStatus = reason
                              |
                              v
    D2_FORM_SCHEMA has NO isIsNotStatus field   <- reason silently dropped
                              |
                              v
             UI renders two EMPTY Is/Is-Not boxes
```

The backend is correct at every stage. The answer never reaches the screen.

### Findings with file references

**F1 — the popup never sends the lot population.**
`app/cnma_proresolve_ui/src/pages/create-defect/index.tsx:459` builds the payload with `inspections: rows` and `isIsNot: null`, but there is no `historicalInspectionLots` key. The mapper accepts four aliases for it (`srv/src/domain/eightd/caseMapper.ts:391`) — none are sent.

**F2 — `problem.isIsNotStatus` has no form field.**
`srv/src/domain/eightd/fiveW2H.ts:135` writes the reason. `D2_FORM_SCHEMA`
(`srv/src/domain/eightd/precedent/defaults.ts:173-195`) does not declare that field, and the `d2-ai-result` group does not list it.

> `docs/REFACTOR-PLAN.md:191` claims this field was added. It was not. The **How** box mentioned in the same sentence *is* present, so only half that change landed.

Effect: rule **R2.2.4**'s honesty behaviour is fully implemented in the backend and discarded at the form layer.

**F3 — contradictory D2 prompt.**
`DEFAULT_DISCIPLINE_GUIDE.D2` in `srv/src/domain/eightd/prompts.ts` still says:

> "Is / Is-Not is a manual field on this screen… Never draft Is / Is-Not yourself — it needs a population of comparable records this dataset does not carry."

But the same combined prompt appends (`defaults.ts:284`):

> "Put the reasoning behind Is / Is-Not into `problem.isIsNotBasis`, citing the records it rests on."

The `is` / `isNot` **values** are safe — they are overwritten deterministically by `applyResolvedProblemFields`. Only `isIsNotBasis` is model-written, so it returns empty or hedged.

**F4 — test data.**
`mock-data/clean/case-8D-10048412.json` is the only file carrying `historicalInspectionLots`.

**F5 — no persistence.**
`db/schema/` has no inspection-lot entity. `historicalInspectionLots` exists only in `CaseContext`, populated from the request payload.

**Minor — constraint pattern.**
D2's `sourcePattern` is `^(header|product|inspections|isIsNot|derivedFacts)`. A citation to `historicalInspectionLots#N` trips a warning. Add the alternative.

### Step-by-step technical tasks

**Step 1 — schema honesty pass (D1 + D2)**

One PR, one file (`precedent/defaults.ts`). D1 and D2 have the same defect — a message the backend produces with no field to display it — so fix them together.

*D2:*
- Add `structuredField('problem.isIsNotStatus', 'Is / Is-Not status', 'callout', 'string', 12, {})` to `D2_FORM_SCHEMA`.
- Add `'problem.isIsNotStatus'` to the `d2-ai-result` group field list.
- Add `historicalInspectionLots` to the D2 `sourcePattern` alternation.

*D1:*
- Add `servedOnCount: { type: 'integer', description: 'How many qualifying precedent cases this person served on. Rank the roster by this value, descending.' }` to the `team.roster` item properties (**D1-1**). Leave it out of `required` — a current-case member has no precedent count.
- Add `structuredField('team.suggestionStatus', 'Suggestion status', 'callout', 'string', 12, {})` and put it in the `d1-ai-result` group (**D1-2**).

*D2 — F6 (🆕 new in v2), in `caseMapper.ts`:* after resolving `inspections`, count the rows with `outOfSpec === true`. When there is more than one, push a line into `gaps` naming the characteristic that **was** compared and the one(s) that were **not**:

> *"Is/Is-Not was computed for Flange burr height. Flange flatness is also out of specification and was not compared."*

Keep the existing single-characteristic behaviour — it is the correct default (see Appendix A.3). This only makes the boundary visible. `problem.gaps` already renders as a warning list, so no new field is needed. Roughly 20 lines.

Then re-seed both: `npm run push:prompts -- D1` and `npm run push:prompts -- D2`

- **Verify D2:** analyse any popup-created case — the Is/Is-Not area shows a sentence, not blanks.
- **Verify D1:** on a case with no precedent clearing score 3, `team.suggestionStatus` reads *"No team suggestion available; assign manually."*

**Step 2 — repair the prompt**
- In `prompts.ts`, replace the Is/Is-Not paragraph of `DEFAULT_DISCIPLINE_GUIDE.D2` with wording that matches **R2.2.3**: the pair is computed by code from the lot population; the model writes only the surrounding narrative into `problem.isIsNotBasis` and may never choose the equipment.
- Re-seed: `npm run push:prompts -- D2`
- **Verify:** `isIsNotBasis` comes back populated and cites lot IDs.

**Step 3 — the history table**
- New CDS entity, e.g. `InspectionLots`: `lotId, materialId, characteristic, equipment, measuredValue, conforming, lotDate, plant`.
- In `enrichContext`: when the payload carries no `historicalInspectionLots`, query the table by `materialId` + characteristic-under-investigation and populate `CaseContext.historicalInspectionLots` from it.
- Keep payload-supplied lots as an override so existing JSON test cases keep working.
- Include the lots in `blindEvidence` — the population contains no recorded answer, so the blind diagnosis should see it.
- **Verify:** acceptance tests 8, 9, 10 in `AI-RULES-8D-STEPS.md` §R4 pass from the database, with no lots in the payload.

> **Example — what the lookup does at analysis time.** A popup case arrives with `materialId = MAT-10247` and one failing characteristic, `Flange burr height`. The payload carries **no** lots. The fallback fires:
>
> ```sql
> SELECT * FROM InspectionLots
>  WHERE materialId     = 'MAT-10247'
>    AND characteristic = 'Flange burr height';
> ```
>
> Seven rows come back — from other cases, other dates, two different machines. They are written into `CaseContext.historicalInspectionLots`, and from that point everything downstream behaves exactly as it does today for the one JSON file that carries its own lots. `computeIsIsNot` is not modified at all; it simply stops receiving an empty array.

**Step 4 — the two paths, end to end** (see decision **D-1** in §6.6)

*Frontend:*
- Add `entryMode: 'during-inspection' | 'outside-inspection'` state; render the toggle in Section 1.
- Add `inspectionLotId`, shown only in `during-inspection` mode.
- Add `equipment` to `InspectionDraft` and `EMPTY_INSPECTION`; render per row in Section 3.
- Emit `entryMode`, `inspectionLotId` and per-row `equipment` in the payload.
- Add the helper text under the Section 3 header.

*Backend:*
- Accept `entryMode` and `inspectionLotId` in `caseMapper`'s header normaliser, alias-tolerant like the neighbouring fields.
- Add both to `CaseContext.header`.
- Use them in `resolveFiveW2H`'s `how` branch: when `entryMode === 'during-inspection'`, emit *"Found during inspection — inspection lot &lt;id&gt;."* **Keep the existing inference as the fallback** when `entryMode` is absent, so uploaded JSON and old payloads do not regress.
- Persist both on `Reports`.

**Step 5 — demo data**

*5a — coverage audit (do this first).* Since the popup's Material dropdown is sourced from `HistoricalCases` (see **Demo scope** above), the list of materials a demo user can pick is finite and knowable. Derive it directly:

```sql
SELECT DISTINCT materialId, materialDesc FROM HistoricalCases ORDER BY materialId;
```

That is the complete set of materials reachable from the popup. For each one, pair it with the characteristic a demo defect would use, then decide deliberately: **rich** (seed a contrasting lot population) or **empty** (no lots, expected to show the honesty message). Do not guess a number of parts — this query defines it.

*5b — seed.* Load via CSV in `db/data/` (decision **D-2** in §6.6), named `<namespace>-InspectionLots.csv`. For every pair marked rich, seed at least two equipment groups, **≥ 2 lots per group** (`DEFAULT_MIN_GROUP_SIZE`) and a nonconforming-rate contrast of **≥ 25 percentage points** (`DEFAULT_MIN_CONTRAST`, both in `isIsNot.ts`). Below either threshold `computeIsIsNot` returns *not applicable*, which will look like a bug during the demo even though it is correct.

> **Example — a complete, copy-ready seed file.** `db/data/cnma.proresolve-InspectionLots.csv`. Note the **semicolon** delimiter and the `ID` column, matching the existing `cnma.proresolve-SampleEntity.csv`.
>
> ```csv
> ID;lotId;materialId;characteristic;equipment;measuredValue;conforming;lotDate;plant
> a1000000-0000-4000-8000-000000000001;INS-80411;MAT-10247;Flange burr height;EQ-MILL07-002;0.32mm;false;2026-06-02;1010
> a1000000-0000-4000-8000-000000000002;INS-80412;MAT-10247;Flange burr height;EQ-MILL07-002;0.28mm;false;2026-06-09;1010
> a1000000-0000-4000-8000-000000000003;INS-80413;MAT-10247;Flange burr height;EQ-MILL07-002;0.09mm;true;2026-06-16;1010
> a1000000-0000-4000-8000-000000000004;INS-80414;MAT-10247;Flange burr height;EQ-MILL07-002;0.21mm;false;2026-06-23;1010
> a1000000-0000-4000-8000-000000000005;INS-80421;MAT-10247;Flange burr height;EQ-MILL07-005;0.06mm;true;2026-06-04;1010
> a1000000-0000-4000-8000-000000000006;INS-80422;MAT-10247;Flange burr height;EQ-MILL07-005;0.08mm;true;2026-06-11;1010
> a1000000-0000-4000-8000-000000000007;INS-80423;MAT-10247;Flange burr height;EQ-MILL07-005;0.07mm;true;2026-06-18;1010
> ```
>
> Check it against the thresholds before committing:
>
> ```
> EQ-MILL07-002   4 lots, 3 nonconforming  -> 75%    group size 4 >= 2  OK
> EQ-MILL07-005   3 lots, 0 nonconforming  ->  0%    group size 3 >= 2  OK
>                                   contrast 75 points >= 25            OK
> -> IS = EQ-MILL07-002, IS NOT = EQ-MILL07-005, citing all 7 lot IDs
> ```
>
> Copy this block per rich material, changing the material, characteristic and equipment IDs. Values are taken from `mock-data/clean/case-8D-10048412.json`, so this exact set is already known to work.

*5c — value-help alignment.* The popup lets the demo user pick any material. Publish the list of rich materials to whoever runs the demo, or restrict the demo script to them — otherwise picking an unseeded material produces a correct but unhelpful "cannot compare" on stage.

*5d — keep one negative case.* One visual-defect case with no measurable characteristic, to demonstrate the *"not applicable"* branch.

**The mock JSON files do not need editing** — but they must still be seeded (`seed-library.ts`), because the popup's dropdowns and all precedent search read from them. See **Demo scope** at the top.

> Note for Step 3 design: `HistoricalCases.sourcePayload` (`db/schema/case-library.cds`) already stores each case's complete original JSON, so `case-8D-10048412`'s lots are in the database today — just not queryable as a population across cases. That is an argument for a dedicated indexed `InspectionLots` table rather than parsing JSON blobs at analysis time.

### Acceptance for this work

| # | Test | Expected |
|---|---|---|
| 1 | Create a defect via the popup for a material **with** seeded history, analyse | Is/Is-Not returns a real IS / IS NOT pair with cited lot IDs |
| 2 | Create a defect via the popup for a material **without** history, analyse | Is/Is-Not area shows the explanatory sentence, not blanks |
| 3 | Create a **visual** defect (no measurable characteristic), analyse | *"Not applicable — this defect has no measurable characteristic."* |
| 4 | Recount the cited lot IDs by hand | Nonconforming rates match what the UI shows |
| 5 | Existing JSON payload `case-8D-10048412.json` | Unchanged behaviour — payload lots still override the table. *Regression check only; this path is not demoed.* |
| 7 | Run the demo with `seed-library.ts` **not** executed | Popup dropdowns empty and no precedents — confirms the dependency is real and documented, not folklore |
| 8 | **D1** — popup case on a material with a strong precedent | Roster cites the precedent case, each person shows `servedOnCount`, ordered highest first (**AI-RULES R4 #6**) |
| 9 | **D1** — popup case with no precedent clearing score 3 | *"No team suggestion available; assign manually."* and `selectionMethod = "Roles only - assignment required"` (**R4 #7**) |
| 10 | **D1** — accept a suggested person | Email and phone auto-fill from the partner record; the AI did not write them |
| 6 | 5W2H grid vs paragraph | Same numbers in both — no disagreement (**R2.2.1**) |

Tests 2 and 3 are the ones that prove the honesty rules. Test 4 is what proves the result is evidence rather than an opinion.

---

## Part 6 — Developer handbook

Everything needed to start without asking the BA.

### 6.1 Environment

```bash
npm install
npm install --prefix app/cnma_proresolve_ui
cp .env.example .env
npm run deploy:sqlite      # creates sqlite.db - required, AI Settings reads AIModels
npm run dev                # BE + FE together
```

Backend runs on **port 4008** (`dev:backend`). Unit tests: `npm test`. Type check: `npm run typecheck`.

> **Known trap — wrong default port in the seed script.** `scripts/seed-library.ts:23` still defaults to `http://127.0.0.1:4004`, but the dev backend listens on **4008** (`package.json:11`, and `wait-backend.mjs` / `push-step-config.mjs` both already use 4008). Seeding will fail with a connection error unless you override it:
>
> ```bash
> SEED_HOST=http://127.0.0.1:4008 npx tsx scripts/seed-library.ts
> ```
>
> Worth fixing the default in the same PR as Step 5.

### 6.2 Exact insertion points

| Step | File | Where |
|---|---|---|
| 1 | `srv/src/domain/eightd/precedent/defaults.ts` | `D2_FORM_SCHEMA` field list (~line 173–194) and the `d2-ai-result` group (~line 195) |
| 1 | same file | `D1_FORM_SCHEMA` — `team.roster` item properties (~line 147) and the `d1-ai-result` group (~line 171) |
| 1 | same file | D2 `constraintsJson` → `D2_SOURCES` pattern, in `STRUCTURED_CONFIG_OVERRIDES` (~line 284). See the override warning below. |
| 2 | `srv/src/domain/eightd/prompts.ts` | `DEFAULT_DISCIPLINE_GUIDE.D2`, the Is/Is-Not paragraph |
| 2 | `precedent/defaults.ts` | `STRUCTURED_CONFIG_OVERRIDES.D1.combinedPrompt` — append the two D1 instructions |
| 3 | `db/schema/` | new `InspectionLots` entity |
| 3 | `srv/src/domain/eightd/eightDAnalyzer.ts:901` | right after `const context = mapCase(raw);`, before the `Promise.all` phases |
| 4 | `app/cnma_proresolve_ui/src/pages/create-defect/index.tsx` | Section 1 card (~line 658), Section 3 card (~line 978), `InspectionDraft` (~line 116), payload builder (~line 421) |
| 4 | `srv/src/domain/eightd/caseMapper.ts` | header normaliser (~lines 360–373) |
| 4 | `srv/src/domain/eightd/types.ts` | `CaseContext.header` (~line 128) |
| 4 | `srv/src/domain/eightd/fiveW2H.ts:88` | the `how` branch |

`mapCase` is a pure function with no database access — keep it that way. The lookup in Step 3 belongs in `analyze()`, which already does database work through `findPrecedentsByStep`.

> **Trap — every step's config is defined twice, and the second one wins silently.**
>
> `defaults.ts` builds `DEFAULT_STEP_PROMPTS` in two layers:
>
> ```
> line 293-410   base array                  D1..D8, each with constraintsJson
> line 282-291   STRUCTURED_CONFIG_OVERRIDES D1..D8, also with constraintsJson
> line 411       ].map(row => ({ ...row, ...OVERRIDES[row.stepCode] }))
>                                          ^^^^^ spread last -> the override wins
> ```
>
> D2's real `constraintsJson` is the one in `STRUCTURED_CONFIG_OVERRIDES` (~line 284). **The copy in the base array (~line 361) is dead code for D2 — it is never read.** Editing only that one compiles, saves, shows no error, and changes nothing.
>
> This applies to all eight steps, not just D2. Same failure mode as the `combinedPrompt ?? systemPrompt` override documented in `docs/8d-step-prompts.md`.
>
> **Edit the override.** Optionally update the dead copy to match so the next reader is not misled — but that is tidiness, not function.

### 6.3 Step 2 — the replacement prompt text

Delete the existing Is/Is-Not paragraph in `DEFAULT_DISCIPLINE_GUIDE.D2` and use this:

```
Is / Is-Not narrows the root cause. The IS and IS NOT values are COMPUTED by
the system from the historical inspection lots: it groups them by equipment,
counts the nonconforming rate per group, and takes the sharpest contrast. You
do not choose them and you must not restate or alter them.

Your job is problem.isIsNotBasis. In one or two sentences explain why that
pair is the lead: name the lot IDs behind each side, and say plainly that both
groups share the same material and characteristic, so the equipment is the only
difference between them. That difference is the lead for D4.

When the system reports that no comparison was possible, do not invent one.
Leave the basis empty and let the status line speak for itself.
```

**D1 additions to `STRUCTURED_CONFIG_OVERRIDES.D1.combinedPrompt`** — append these two instructions to the existing array:

```
Set servedOnCount on every precedent-sourced roster row to the number of
qualifying precedent cases that person served on, and order the roster by it,
highest first. A person taken from the current case has no count - omit it.

When no precedent clears the minimum score, set team.suggestionStatus to
exactly "No team suggestion available; assign manually." and set
selectionMethod to "Roles only - assignment required". Do not invent a roster.
```

Then re-seed and confirm both changes took effect:

```bash
npm run push:prompts -- D1
npm run push:prompts -- D2
```

> Reminder from `docs/8d-step-prompts.md`: the runtime reads `combinedPrompt ?? systemPrompt`, so **`combinedPrompt` fully replaces `systemPrompt`** rather than adding to it. Editing the wrong box saves successfully, shows in the UI, and changes nothing.

### 6.4 Tests to add or update

| Step | Test file | What to cover |
|---|---|---|
| 1 | `__tests__/formSchemaWidgets.test.ts`, `stepDataSchema.test.ts` | `problem.isIsNotStatus`, `team.suggestionStatus` and roster `servedOnCount` are declared and grouped |
| 2 | `__tests__/disciplineGuide.test.ts` | D2 guide no longer contains the "never draft" wording; D1 guide carries the `servedOnCount` and empty-state instructions |
| 1–2 | `__tests__/precedentShape.test.ts` | roster rows expose `servedOnCount` and are ordered by it, descending |
| 3 | `__tests__/caseMapper.test.ts` | payload lots still override the table (regression) |
| 3 | new test | table fallback populates `historicalInspectionLots` when payload has none |
| 3 | `__tests__/isIsNot.test.ts` | unchanged — the arithmetic is not being modified |
| 5 | `__tests__/fiveW2H.test.ts` | already asserts the "no measurable characteristic" path; extend for the no-lots path |

`isIsNot.ts` itself should not need changes. If a task seems to require editing it, stop and re-read **R2.2.3** — the arithmetic is deliberately fixed.

### 6.5 Definition of done per step

| Step | Done when |
|---|---|
| 1 | **D2:** a popup-created case shows an explanatory sentence in the Is/Is-Not area, no blanks; a case with two failing characteristics names the uncompared one in `problem.gaps` (F6). **D1:** a case with no qualifying precedent shows *"No team suggestion available; assign manually."* |
| 2 | **D2:** `problem.isIsNotBasis` is populated and cites lot IDs on a case with history. **D1:** roster rows carry `servedOnCount` and are ordered by it, descending. |
| 3 | Acceptance tests 8, 9, 10 of `AI-RULES-8D-STEPS.md` §R4 pass with **no lots in the payload**. |
| 4 | Both entry modes are selectable; equipment is captured per row; the **How** box on a Path A case names the inspection lot; a case with no `entryMode` still renders the old inferred sentence. |
| 5 | Every material in the demo script produces either a real IS/IS NOT pair or a deliberate, readable "cannot compare" message. |

### 6.6 Decisions — settled, no open points

All four questions below are **decided**. Implement as written; do not re-open unless something in the code contradicts the reasoning.

**D-1 — `entryMode` and `inspectionLotId` are persisted end to end, and D2 consumes them.**

Not display-only. The payoff is that the 5W2H **How** box stops being a guess. Today `fiveW2H.ts:88` infers it:

```ts
how = inspections.length
    ? 'Found during inspection — the case carries recorded inspection results.'
    : ...
```

That is a proxy ("this case has inspection rows, so probably an inspection found it"), not a recorded fact. With `entryMode` it becomes fact, and with the lot number it becomes traceable:

> *"Found during inspection — inspection lot INS-90104."*

Tasks: add `entryMode` and `inspectionLotId` to the popup payload → accept both in `caseMapper` (alias-tolerant, like the other header fields) → add to `CaseContext.header` → use in `resolveFiveW2H`'s `how` branch → persist on `Reports`. When `entryMode` is absent (old payloads, uploaded JSON), fall back to the current inference so nothing regresses.

Rule reference: this is **R2.2.2** — a box must carry its real source, not a plausible substitute.

**D-2 — seed `InspectionLots` with CSV in `db/data/`.**

Not a seed action. `db/data/*.csv` is deployed to HANA by the HDI deployer at deploy time, and this repo already uses the pattern (`cnma.identity-*.csv`). Inspection-lot history is static reference data set once, so CSV is simpler, version-controlled, and behaves identically on SQLite and HANA. Follow the CAP naming convention: `<namespace>-InspectionLots.csv`.

> The credential limitation noted at the top of `scripts/seed-library.ts` is about writing at **runtime** on Cloud Foundry. It does not apply to deploy-time CSV loading.

**D-3 — leave the popup's material value help unrestricted.**

Do not filter it to seeded materials. Picking an unseeded material produces the honest "cannot compare" message, which is real product behaviour. Instead, hand the demo driver the list of seeded materials from task 5a.

**D-4 — resolved by D-1.** `entryMode` reaches the backend because the **How** box consumes it.

### 6.7 Suggested split of work

Steps 1, 2 and 5a can start immediately and in parallel — none of them depend on each other.

| Work | Depends on | Can start |
|---|---|---|
| Step 1 (form field) | — | now |
| Step 2 (prompt) | — | now |
| Step 5a (coverage audit) | — | now — and it **must** finish before 5b |
| Step 3 (table + fallback) | 5a, for knowing what to seed | after 5a |
| Step 5b–5d (seeding) | Step 3 | after 3 |
| Step 4 (popup UI) | — | any time; independent of 1–3 |

Step 3 is the only genuinely hard task. If one person takes it, Steps 1, 2 and 4 can be finished by others in the same day.

---

# Appendix A — Terms and worked examples 🆕

*New in v2 — this whole appendix. If you read v1, nothing here replaces anything you already read; it only explains the vocabulary the rest of the document uses.*

For anyone joining this work without the SAP QM background. Every example uses real data from `mock-data/clean/case-8D-10048412.json`.

## A.1 What is a "characteristic"?

**A characteristic is the specific property you measure on a part.** Not the part, and not the problem — the *property*.

Think of a health check-up. The **patient** is the part. The **characteristics** are blood pressure, cholesterol, weight. Each has its own normal range and is measured separately. You would never compare someone's blood pressure against their cholesterol — different things, different rulers.

Same in QM. Four terms people mix up:

| Term | Example | Plain meaning |
|---|---|---|
| **Material** | `MAT-10247` | *which part* |
| **Defect** | "Flange edge burr above limit" | *what went wrong*, in catalogue words |
| **Characteristic** | `Flange burr height` | *which property was measured* |
| **Measured value / spec** | `0.32mm` vs `max 0.10mm` | the number, and the allowed range |

So the characteristic is **the ruler you used**. "Flange burr height" means: *we measured how tall the burr on the flange edge is.*

One part can have several. Case `8D-10048412` measured two:

```
Flange burr height   0.32mm   vs   max 0.10mm
Flange flatness      0.09mm   vs   0.05mm +/-0
```

Two rulers, two results, one part. **This is why the characteristic is part of the lookup key** — comparing burr-height numbers against flatness numbers is as meaningless as comparing blood pressure to weight.

## A.2 How "out of spec" is decided

Two paths, reliable one first (`caseMapper.ts:566`):

```ts
outOfSpec: evaluateOutOfSpecNumeric({ measuredNumeric, specOperator, specLimit, specUpperLimit })
        ?? evaluateOutOfSpec(r.measured_value, r.spec_value)
```

**Path 1 — real numbers.** When the source separates value, operator and limit into proper fields, the comparison is plain arithmetic. The popup sends exactly these, so popup-created cases never guess.

**Path 2 — parse the text.** Only when Path 1 has nothing. `parseSpec` reads the spec *string* and builds a test, trying four patterns in order:

| Pattern | Example | Test |
|---|---|---|
| `max N` | `max 0.10mm` | v ≤ 0.10 |
| `min N` | `min 5.0mm` | v ≥ 5.0 |
| `N +/- D` | `0.05mm +/-0` | \|v − 0.05\| ≤ 0 |
| `N - M` | `0.20 - 0.30` | 0.20 ≤ v ≤ 0.30 |

Our two rows:

```
Flange burr height  0.32  vs "max 0.10mm"   -> 0.32 <= 0.10 ?       NO -> out of spec
Flange flatness     0.09  vs "0.05mm +/-0"  -> |0.09-0.05| <= 0 ?   NO -> out of spec
```

Read the second one twice: **±0 means zero tolerance** — the value must be *exactly* 0.05, so 0.09 fails.

**Key detail:** when no pattern matches, the result is `null` — meaning *"cannot tell"*, **not** *"in spec"*. Deliberate: a wrong verdict here would be handed to D2 and D4 as evidence, so the code refuses to guess.

## A.3 The two lookups, worked through

The single most important idea in D2. Same case, `8D-10048412`.

### Lookup 1 — case-scoped: *"What are the facts of this case?"*

```sql
WHERE notificationId = '8D-10048412'
```

Returns **this case only**: material, work centre, defect code, found date, quantity, and **2 inspection rows**.

That fills What / Where / When / How Many. Enough to *describe* the problem.

Now ask it *"which machine is causing this?"* It cannot answer — it holds **one** burr-height measurement. One point is not a comparison.

### Lookup 2 — population-scoped: *"What do comparable records look like?"*

**Forget the notification entirely.** Different question:

```sql
WHERE materialId     = 'MAT-10247'
  AND characteristic = 'Flange burr height'
```

Returns **7 lots** — other cases, other dates, other machines:

| Lot | Equipment | Measured | OK? |
|---|---|---|---|
| INS-80411 | EQ-MILL07-**002** | 0.32mm | no |
| INS-80412 | EQ-MILL07-**002** | 0.28mm | no |
| INS-80413 | EQ-MILL07-**002** | 0.09mm | yes |
| INS-80414 | EQ-MILL07-**002** | 0.21mm | no |
| INS-80421 | EQ-MILL07-**005** | 0.06mm | yes |
| INS-80422 | EQ-MILL07-**005** | 0.08mm | yes |
| INS-80423 | EQ-MILL07-**005** | 0.07mm | yes |

Group by equipment and count:

```
EQ-MILL07-002   4 lots, 3 bad  ->  75%   <- IS
EQ-MILL07-005   3 lots, 0 bad  ->   0%   <- IS NOT
                              contrast = 75 points  (threshold is 25)
```

**IS** = EQ-MILL07-002 · **IS NOT** = EQ-MILL07-005, citing all 7 lot IDs.

Both machines made the *same part*, measured with the *same ruler*. The only difference is the machine. **That difference is the lead for D4.**

### Why this proves the popup cannot fix it

Look at what Lookup 2 filtered on: **material + characteristic. The notification number never appears.** Six of those seven lots have nothing to do with case 8D-10048412.

That is why adding an inspection-lot number to the popup would not help — it still only describes *this* case. And it is why the history must live in a database table spanning many cases (Step 3).

**And if the case were investigating `Flange flatness` instead**, Lookup 2 would return **zero** rows — there is no flatness history in this population. The system would correctly report *"no historical inspection lots recorded for Flange flatness"* rather than reusing burr-height numbers. That is the characteristic filter doing its job.

## A.4 Why only one characteristic is compared (finding F6)

`isIsNot.ts:158` picks exactly one:

```ts
return (inspections.find((row) => row.outOfSpec === true) ?? inspections[0])?.characteristic ?? '';
```

**The intent is right.** Comparing on a characteristic that *passed* would be arithmetically valid but business-meaningless — you are hunting the source of **this** defect, so you compare on the ruler that failed.

**The gap:** in case `8D-10048412` **both** characteristics failed. `.find()` returns the first match, and "first" means *position in the JSON array* — not severity, not business importance. Burr height wins because it was listed first; flatness is silently dropped.

What is already fine: the output names the ruler it used — the IS/IS NOT text ends with `…for Flange burr height`.

What is missing: **nothing says the second failing characteristic was never analysed.** Hence F6, and the `gaps` line added in Step 1. The single-characteristic default stays; only the boundary becomes visible.

## A.5 Quick reference — the SAP tables behind all this

| Table | Holds | Used for |
|---|---|---|
| `QMEL` | quality notification header | **the 8D case itself** — case ID = notification ID |
| `QMFE` | notification *items* = the defects | a "defect" is not a separate object; it is a row here |
| `QALS` | inspection lot header — material, batch, **equipment** | the fixture dimension Is/Is-Not groups by |
| `QAMV` | characteristic specification per lot | the target and tolerance |
| `QAMR` | characteristic *result* per lot | the measured value, conforming yes/no |

`QALS.EQUNR` (Equipment) is the field the whole Is/Is-Not feature rests on. Confirmed present in the real SAP export.
