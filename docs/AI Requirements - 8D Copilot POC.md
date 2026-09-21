# AI Requirements — 8D Copilot POC

**Prepared by:** Quyen (BA) **For:** AI Team (Dung, Thien, Minh)
**Purpose:** Define what the AI must do, on what data, and how we'll know the POC proves it — so today's build has a clear, testable target instead of an open-ended "make AI suggestions" brief.

---

## 1. Purpose & Scope

The 8D Copilot assists a QM engineer working an 8D case in SAP, from D1 (Team) to D8 (Closure), for two origins:

- **Q3 — Internal defect:** case starts in SAP's Record Defects app.
- **Q1 — Customer complaint:** case starts in SAP's Create Quality Notification app.

Both origins share one pipeline and one set of AI behaviors below — they only differ in the trigger app and in Q1 cases carrying extra Customer Reference data.

The AI's role in every step is the same: **search the available data, draft a suggestion from real case data, cite where it came from, and let the human confirm or reject it.** The AI never finalizes a step on its own. That now explicitly includes D8: closure is no longer just a completeness gate — the AI searches precedent cases and suggests suitable Lessons Learned and recurrence-prevention data (Section 2, D8 row).

The POC also includes an admin-facing **AI Settings** surface that guides how the AI behaves at each D-step — per-step prompts, input schemas, output layouts, constraints, and similarity tuning — configurable without code changes (Section 3).

Source of truth for the data the AI reads: the **Golden Dataset** (sheets GD 1–16, `ConaSpark_CompetitorResearch_v0.6.xlsx`). Source of truth for what each D-step needs: the **Hackathon Master Checklist** sheet in the same workbook.

---

## 2. Functional Requirements per D-Step

**Where "Reads from" data actually originates:** GD 5 Notifications is the *only* sheet actually typed in at the moment the case is opened — by Record Defects (Q3) or Create Quality Notification (Q1). Every other sheet below is either pre-existing SAP master/quality data that already lived elsewhere before this case existed (Material, Batch, Defect catalog, Work Center, Inspection results, FMEA, BP master), or gets filled in progressively as the team works through D1–D8 (Actions, Causes, Lessons Learned). Record Defects is the trigger and the case header — not the source of most of the facts the AI assembles.

| D-Step | AI must produce | Reads from (Golden Dataset) | Suggested AI Solution (input → output) | Output format | Human-in-the-loop rule |
|---|---|---|---|---|---|
| D1 — Team | **Updated scope — both of the following, not either/or:** (a) *Suggested roles* — which functions (Quality Engineer, Production Engineer, etc.) similar past cases needed; (b) *Suggested individuals* — a ranked shortlist of specific people who served on those similar cases, with how many times. Either way, Email/Telephone still auto-fill once a Partner is picked — that part is unchanged and stays rule-based. | GD 5 Notifications (Team Size), GD 15 Historical Team Assignments (NEW), BP master data | Same retrieval scoring as D4 (work center +4, defect code +4, material +3/family +1) run against past cases — deliberately not a second "similarity" definition. For every past case that clears score 3, look up who served on its team (GD 15) and tally: by function/title → suggested roles; by individual → suggested people, ranked by how often they appear. If nothing clears the threshold, say so — same rule as D4, no guessing. | Two suggestion lists (roles; ranked people) with case citations, plus one "Accept all suggested" button — adds every suggested person in one click rather than requiring an accept per person (deliberate: forcing a click per name doesn't scale if the list is long). Anyone not wanted can be removed afterward from the team table. | Suggestions only; engineer confirms by accepting (or not) — AI never assigns a person automatically, and removal after accepting is always available. |
| D2 — Problem description | **Three views of the same facts, not three features:** (a) the original AI-drafted paragraph; (b) a 5W2H grid (What/Where/When/Who/How/How Many) below it, added per team preference — narrative for a fast read, structured grid for scannable, source-traceable detail; (c) **AI-drafted Is/Is-Not comparison** (NEW, built this session — see the SPC note below for the full mechanism) — compares individual historical inspection lots by fixture/equipment and drafts which one is the likely problem area, citing lot IDs. | GD 1 Materials *(Material Master, pre-existing)*, GD 2 Batches *(Batch Master, pre-existing)*, GD 3 Defects *(defect code catalog, pre-existing)*, GD 4 WorkCenters *(work center master, pre-existing)*, **GD 5 Notifications *(← from Record Defects / Create Quality Notification — the only one of these six actually typed in at case creation)***, GD 6 Inspections *(separate QM inspection lot result, not typed into Record Defects)*, **GD 17 Historical Inspection Lots (NEW)** for the Is/Is-Not comparison. GD 5 now also carries **Found Date** and **Quantity / Extent** (NEW — added to fill real gaps for When/How Many). Correction from an earlier draft of this doc: these should come from **Record Defects / Create Quality Notification directly**, same as the rest of GD 5 — notification creation date is a standard automatic SAP field, and defect quantity is a core input when logging a defect against a production order. This was a gap in our simplified Golden Dataset only, not a real SAP integration challenge — see caveat below the table. | Template-based text generation for the paragraph (same pattern as `draft_d2()` in the reference script); the 5W2H grid reuses the *identical* fields, just relabeled into 6 boxes instead of one sentence — one join, two renderings. **Is/Is-Not**: group GD 17's lots for this Material+Characteristic by Equipment/fixture, compute the nonconforming rate per group, and return the group with the sharpest contrast as IS vs. the cleanest comparable group as IS NOT — no fabricated comparison if there's no real contrast in the data (returns "not applicable" or "no clear contrast" instead). An LLM can be layered on later purely to smooth the paragraph's phrasing — every fact in every view must still trace back to a source field. | Paragraph + source citations, plus a 6-box grid (What/Where/When/Who/How/How Many), plus an IS/IS NOT pair with lot-ID citations | Draft shown as editable text; engineer must approve before D2 is marked Complete. Grid is read-only, always in sync with the paragraph. Is/Is-Not is a draft the engineer accepts or edits, same as every other AI suggestion. |
| D3 — Interim containment | Suggested immediate/containment action(s), reusing similar past containment actions where a strong precedent exists | GD 8 Actions (Action Type = Containment), precedent cases (GD 5–14) | Rule-based lookup first: if a Containment action already exists for this Notification ID, surface it. If none exists yet, fall back to the top-scoring precedent case's containment action (see retrieval scoring below). | 1–2 suggested actions with source case reference | Suggestion only; engineer selects, edits, or writes their own |
| D4 — Root cause | Best-matching root cause candidate — or an explicit "no strong precedent" message if nothing qualifies | GD 7 Causes (Ishikawa), GD 13 5-Why Chain, precedent library (closed cases in GD 5–14). **GD 16 SPC Control Charts** (NEW) is also now available as optional supporting evidence — see the SPC note below — but is not yet wired into the scoring formula itself. | Two-part logic: (1) primary — read this case's own GD 13 5-Why chain and return the step tagged "(root cause)"; if untagged, fall back to the GD 7 Ishikawa row where "Is Root Cause? = Y". (2) supporting — run the retrieval scoring formula below across closed cases and show the top match in a "similar cases" panel alongside the draft. | Root-cause statement + matched precedent case ID + match score + citation | Must never auto-fill "Is Root Cause? = Y"; engineer confirms |
| D5 — Permanent corrective action | Suggested corrective action(s) tied to the confirmed root cause, reusing the precedent's corrective action where applicable | GD 8 Actions (Action Type = Corrective), precedent case's corrective action | Rule-based lookup first: surface this case's own recorded Corrective action if one exists. If not, suggest the corrective action taken in the top-scoring precedent case. | Suggested action text + source | Suggestion only |
| D6 — Implement & verify | No drafting — AI surfaces the list of planned actions and their verification status for the engineer to update | GD 8 Actions | Direct read/display, no AI logic: list all Action rows for this Notification ID with their Status field. | Checklist view | Status changes are manual (Not Started / In Process / Complete) |
| D7 — Preventive action | Suggested preventive action(s), and a flag if a related FMEA entry exists to link | GD 8 Actions (Action Type = Preventive), GD 9 FMEA Link | Same rule-based pattern as D5, filtered to Action Type = Preventive; additionally look up GD 9 FMEA Link by Notification ID and flag a match if found. | Suggested action text + FMEA cross-reference if found | Suggestion only |
| D8 — Closure | **Three parts, not just a gate (UPDATED — D8 is now a search-and-suggest step, same as D1–D5):** (a) completeness gate — are D1–D7 all Complete? (rule-based, unchanged); (b) AI-drafted "Lessons Learned" summary — from this case's own GD 11 fields when they exist, otherwise synthesized from the case's confirmed D2–D7 content (root cause, containment/corrective/preventive actions, verification outcomes) so the engineer never starts from a blank box; (c) **AI-searched precedent lessons (NEW)** — the AI searches closed cases with the same similarity engine and suggests the GD 11 lessons of every case clearing the threshold, plus two recurrence-prevention flags: the GD 9 FMEA entry that should be confirmed as updated, and any *open* notifications sharing this case's work center/defect/material that the same fix may apply to. | GD 11 Lessons Learned (this case **and** closed precedent cases), status of D1–D7, GD 8 Actions, GD 13 5-Why (confirmed root cause), GD 9 FMEA Link, GD 5 Notifications (open cases, for the recurrence scan) | Rule-based gate first: block closure unless all of D1–D7 show status Complete. Lessons draft: template generation from the case's GD 11 "What Worked" / "What Didn't" fields; if GD 11 is empty for this case, build the draft from the confirmed D4 root cause + D3/D5/D7 actions + D6 verification statuses — every sentence still traceable to a source field. Precedent lessons: run the retrieval scoring formula below over closed cases; for each case ≥ threshold, surface its GD 11 rows with case ID + match score. If a precedent clears the threshold but has no GD 11 rows, say "precedent found, no lessons recorded" — and if nothing clears the threshold, say "no precedent lessons available." No guessing, same rule as D1/D4. Recurrence scan: reverse the same scoring against *open* GD 5 rows and flag matches ≥ threshold. | Pass/fail completeness gate + editable draft summary with source citations + ranked precedent-lessons list (case ID, score, lesson text) + recurrence-prevention flags (FMEA reference, open-case matches) | Case cannot close unless D1–D7 are explicitly Complete **and** the engineer approves the summary. Precedent lessons are accept/edit/reject per item, with an "Accept all suggested" button (same pattern as D1). The AI never closes a case and never writes into another open case — the recurrence flag is informational only. |

**Repeat-error / precedent detection** (used by D1 for team role/person suggestion, D3, D4, D5, **D8 for precedent lessons and the recurrence scan**, and optionally shown as a standing "similar cases" panel): score every closed case against the current one and return the top 3, using this formula — reuse as-is, do not redesign. **One similarity engine, reused everywhere** — D1's "which past cases are like this one" is intentionally the exact same question D4 and D8 ask, not a separate metric:

- Work center match: **+4**
- Defect code match: **+4**, or defect-text keyword overlap: **+2**
- Material match: **+3**, or same material family: **+1**
- Optional semantic criterion (already supported by the built Similarity settings page): defect-description embedding similarity **+3**, only counted when cosine similarity ≥ **0.70**. Off by default for the POC scoring examples below.
- Maximum possible deterministic score: **11** (14 with the semantic criterion enabled). Below a score of **3**, do not surface a precedent — say so explicitly instead of guessing.

These weights, the minimum score (default 3), top-N (default 3), and the closed-cases-only rule are the **seeded defaults**, not hard-coded values: an admin can tune all of them in **AI Settings → Similarity** (Section 3) without a code change or redeploy. Every D-step that consumes precedents picks up the tuned values automatically, because there is only one engine.

**Data-quality caveat on D1 (read before building):** the historical rosters in GD 15 for the 3 legacy Q3 cases are backfilled from those cases' own recorded causal data (a Machine-category root cause implies Production Engineer/Maintenance involvement, etc.) — reasonable, but not real recorded history. For 8D-2612, Galileon's published walkthrough doesn't document who was on the team at all, so that roster is explicitly marked ASSUMED. Demo this as "here's how the mechanism works once real historical assignment data exists," not as "the AI learned who's good at this" — the second claim isn't true yet.

**Scoring example** — comparing open case **8D-10048291** against closed case **8D-10047950** (both real rows in GD 5 Notifications): same work center WC-PRESS-12 (+4), same material MAT-10234 (+3), different defect code with no keyword overlap ("Hairline crack..." vs "Mounting-hole diameter...", +0) → **score 7/11**. This is what should appear in the "similar cases" panel, not a guess.

**Data-quality caveat on D2's new fields:** Found Date and Quantity/Extent didn't exist in GD 5 before this update — two different confidence levels here. 8D-10048291's values (340 units, found 2026-08-05) are reused verbatim from the project's own reference backend script, not fresh guesses. 8D-10047950 and 8D-10048150's values are new and explicitly tagged (illustrative) — there was no prior source to draw from. 8D-2612's values ("Since 12 May," "14 pcs / 2 batches") are real, taken directly from Galileon's own published case. In production, both fields should populate from Record Defects / Create Quality Notification directly, same as the rest of GD 5 — this was a gap in our simplified dataset, not a real integration gap. **Who** remains genuinely untracked for Q3 cases — the 5W2H grid says so honestly rather than inventing a name.

**Concept: Is/Is-Not — now built and AI-drafted, not just a dev-reference concept**

Is/Is-Not is a root-cause narrowing technique embedded in D2. The idea: write down two short lists side by side.
- **IS** — the exact conditions where the problem *does* happen (e.g. "Left-Hand variant, Fixture #2, since May 12")
- **IS NOT** — a fair, comparable situation where the same kind of problem *doesn't* happen (e.g. "Right-Hand variant, Fixture #1")

Then look only at what's *different* between the two lists — not what they have in common. That difference is the strongest lead for root cause, because it rules out everything both situations share (same material, same general process) and points straight at what's actually unique to the failing case. This is a real, confirmed feature from Galileon SolveR's published case (doubleSlash doesn't have it).

**Why a GD16-style summary alone can't do this:** Is/Is-Not needs a *population* of comparable inspection records — other fixtures, other variants, other dates for the same part — not just an aggregated target/limit summary. GD 16 - SPC Control Charts tells you the rules (Target/Spec/Action/Warning limits); it can't tell you *which* fixture is the problem. That needs individual records.

**SPC schema confirmed (real SAP export received) — this is what unblocked the build:** we reviewed 8 real exported tables (QALS, QAMR, QASH, QAST, QAVE, QPSH, QPSP, QPST). QALS confirmed a real **Equipment** field exists per inspection lot — that's the fixture dimension Galileon uses, with no assumed join needed. This became **GD 17 - Historical Inspection Lots**: individual lot records (Material, Characteristic, Equipment/Fixture, Measured Value, Conforming Y/N), separate from GD 16's aggregated summary.

**Built and demoed this session:** the AI groups GD 17's lots for a case's Material+Characteristic by Equipment/fixture, computes the nonconforming rate per group, and drafts the group with the sharpest contrast as IS vs. the cleanest comparable group as IS NOT — citing the exact lot IDs used. Validated three ways:
1. For **8D-10048291** (chamfer): correctly identifies EQ-PRESS12-004 as IS (3/4 lots nonconforming, 75%) vs. EQ-PRESS12-009 as IS NOT (0/3, 0%) — consistent with D4's existing root-cause citation for the same equipment.
2. For **8D-10047950** (hole diameter): same pattern, EQ-PRESS12-004 vs. EQ-PRESS12-011.
3. For **8D-2612** (the real Galileon case): the AI's independently-computed answer correctly points to Fixture #2/LH variant vs. Fixture #1/RH variant — the same fixture Galileon's real published case names, computed from our own illustrative lot population, not copied from their answer. This is the strongest evidence the mechanism actually works, not just that it runs without error.

**8D-10048150** (visual defect, no measurable characteristic) correctly shows "not applicable" rather than fabricating a comparison — same honesty pattern as D1's "no team suggestion available" edge case.

**What's still a real limitation, not fixed by this build:** SAP's native SPC grouping is Material+Characteristic(+Vendor), not fixture/variant — GD 17 models the fixture dimension using QALS's real Equipment field, which works for our example, but a live rollout needs to confirm fixtures are actually tracked as Equipment records in your system. Cp/Cpk and trend direction are still **calculated**, not stored fields, and would need genuine multi-lot history from SAP rather than the illustrative population used here.

### 2.1 Worked Example — Case 8D-10048291 (Q3, Bracket Housing X200)

Every input below is a real field from the Golden Dataset; every output is what the AI should produce from it. Use this to sanity-check the POC end to end.

**D1 — Team**
- Input: current case 8D-10048291 scored against the other 3 closed cases (same formula as D4) → only 8D-10047950 clears the threshold, at score 7/11 (same work center, same material, different defect). GD 15 roster for 8D-10047950: Minh Dinh (Production Engineer, Team Leader), Heli Weber (Quality Engineer), Dung Truong (Warehouse Clerk), Thien Tu (Production Worker).
- Output: *Suggested roles* — Production Engineer, Quality Engineer, Warehouse Clerk, Production Worker, cited to case 8D-10047950. *Suggested individuals* — the same four people, each shown as "served on 1 similar case," with a single "Accept all suggested" button that adds all four at once (first becomes 8D Team Leader, rest 8D Team Member) — no need to click accept four separate times. Engineer can remove anyone not wanted from the team table afterward. Email/Telephone auto-fill as before (unchanged, rule-based).
- Edge case, verified: case 8D-10048150 has no past case clearing the score-3 threshold — the AI correctly shows "no team suggestion available; assign manually" instead of guessing.

**D2 — Problem description**
- Input: GD 1 Materials (MAT-10234 = "Bracket Housing X200"), GD 2 Batches (B-48213), GD 3 Defects (DEF-0451 = "Hairline crack near mounting hole"), GD 4 WorkCenters (WC-PRESS-12 = "Forming Press Line 2"), GD 6 Inspections (Mounting-hole chamfer: measured 0.20mm vs spec 0.50mm +/-0), GD 5 Notifications (Origin = Q3 - Internal Defect)
- Output: *"Bracket Housing X200 (MAT-10234), Batch B-48213, was logged under notification 8D-10048291 (Q3 – Internal Defect) with defect 'Hairline crack near mounting hole' (DEF-0451) at Forming Press Line 2 (WC-PRESS-12). Inspection characteristic 'Mounting-hole chamfer' measured 0.20mm against a specification of 0.50mm +/-0 — out of tolerance."* Cited sources: GD 1, GD 2, GD 3, GD 4, GD 5, GD 6 rows for this notification.
- 5W2H grid, same case, same underlying fields: **What** "Hairline crack near mounting hole — Mounting-hole chamfer: 0.20mm vs spec 0.50mm +/-0" · **Where** "Forming Press Line 2 (WC-PRESS-12)" · **When** "2026-08-05" · **Who** "Not tracked in current dataset" (real gap — Q3 cases have no reporter field; Q1 cases show the customer contact instead) · **How** "Found during in-process inspection" · **How Many** "340 units affected".
- Is/Is-Not — Input: GD 17 lots for MAT-10234 / "Mounting-hole chamfer" — 7 lots across 2 equipment IDs. EQ-PRESS12-004: 4 lots, 3 nonconforming (INS-90104, INS-90106, INS-90107). EQ-PRESS12-009: 3 lots, 0 nonconforming. Output: *IS* "EQ-PRESS12-004 — 3/4 lots nonconforming (75%) for Mounting-hole chamfer" · *IS NOT* "EQ-PRESS12-009 — 0/3 lots nonconforming (0%) for Mounting-hole chamfer", citing all 7 lot IDs. Consistent with D4's own root-cause citation for this case (EQ-PRESS12-004, last maint 2026-06-15).

**D3 — Interim containment**
- Input: GD 8 Actions, filtered to Notification ID = 8D-10048291 and Action Type = Containment
- Output: *"Quarantine remaining stock from batch B-48213 pending root-cause confirmation"* — shown as a suggested action (this row already exists with Status = Done, so the AI is confirming/surfacing it, not inventing it)

**D4 — Root cause**
- Input: GD 13 5-Why Chain for this case — Step 1: "Why crack near mounting hole?" → "Mounting-hole chamfer measured 0.20mm vs 0.50mm spec (undersized)"; Step 2 (tagged root cause): "Why was the chamfer undersized?" → "Unmonitored forming-die wear on WC-PRESS-12 consumed the tolerance margin," evidence "Equipment maintenance log EQ-PRESS12-004"
- Output: Root cause = *"Unmonitored forming-die wear on WC-PRESS-12 consumed the tolerance margin"*, cited to Step 2 of the 5-Why chain and the equipment maintenance log — not a guess, and not auto-marked as confirmed

**D5 — Permanent corrective action**
- Input: GD 8 Actions, Action Type = Corrective, for this notification
- Output: *"Replace worn forming die"* (existing row, Status = Verified)

**D6 — Implement & verify**
- Input: all GD 8 Actions rows for this notification (Containment: Done; Corrective: Verified; Preventive: Verified)
- Output: a checklist view of the three actions and their status — no drafting, engineer updates status manually

**D7 — Preventive action**
- Input: GD 8 Actions, Action Type = Preventive; GD 9 FMEA Link
- Output: *"Shorten die-wear inspection interval from 5,000 to 2,000 cycles"*, cross-referenced to FMEA-PRESS12-07 ("Forming die wear")

**D8 — Closure**
- Input: status of D1–D7 (all must be Complete); GD 11 Lessons Learned for this case; the same precedent search as D1/D4 (only 8D-10047950 clears the threshold, score 7/11) and its GD 11 rows; GD 9 FMEA Link (FMEA-PRESS12-07); open GD 5 notifications scanned for work center WC-PRESS-12 / material MAT-10234 / defect DEF-0451 matches.
- Output, part 1 (gate): completeness check passes.
- Output, part 2 (draft summary): *"What worked: precedent case reuse shortened the PM interval. What didn't: relying on inspection alone without a die-wear trigger."* — drafted from this case's own GD 11 fields, editable.
- Output, part 3 (searched suggestions): a "Lessons from similar cases" panel citing 8D-10047950 (score 7/11) with whatever GD 11 rows exist for that case — and if that case has no GD 11 rows, the panel honestly shows *"precedent found, no lessons recorded"* instead of inventing one. Plus recurrence-prevention flags: *"Confirm FMEA-PRESS12-07 ('Forming die wear') was updated per D7"* and the result of the open-case scan (in the current Golden Dataset no other open case clears the threshold, so the scan correctly reports no matches).
- Edge case, same honesty rule as D1: for **8D-10048150** (no precedent clears score 3), D8 still drafts the summary from that case's own data but the precedent-lessons panel shows *"no precedent lessons available"* — no fabricated lesson.
- The engineer accepts/edits the summary and any suggested lessons, then closes the case manually. The AI never closes it.

---

## 3. AI Settings — Per-Step AI Guidance (NEW requirement)

The app must expose an admin-facing **AI Settings** area (`/#/ai-settings`) that lets an administrator steer how the AI behaves **at each D-step** — without a code change or redeploy. Much of this already exists in the build (see `docs/AI-SETTINGS-D1-CONFIGURATION.md` and `docs/8D-COPILOT-E2E-GUIDE.md`); this section makes it a formal requirement and defines what must be finished.

### 3.1 What must be configurable, and where

| Area | What the admin controls | Status |
|---|---|---|
| **General Settings** | Which model runs each pipeline activity (`parseData`, `analyzeDefect`, `reviewQuality`) and the thinking-budget token allowance. | Built |
| **Model Registry** | Sync available Foundation Models from SAP AI Core / Generative AI Hub; enable/disable each model. | Built |
| **Similarity** | The precedent-search criteria weights (work center, defect code/keyword, material/family, optional semantic), `minScore` threshold, `topN`, and `closedOnly`. Section 2's formula is the seeded default. | Built |
| **Step Prompts (D1–D8)** | Per step: `systemPrompt` + `userTemplate` + an `enabled` toggle. Disabled or blank → automatic fallback to the code defaults (`srv/src/domain/eightd/prompts.ts`). This is the primary "guide the AI per D-step" mechanism and must cover **all eight steps**, including the updated D8. | Built for D1–D8 |
| **Per-step configuration editors** (`/ai-settings/step-prompts/:stepCode`) | Four deeper configuration areas per step: **Data Schema** (which verified context sections feed the step's input block), **Prompt Guide** (combined step guidance, 80-line limit), **Form Mapping** (output field paths + report layout), **Constraints** (grounding rules appended to the system prompt and deterministically rechecked in post-processing). | Built for D1–D4; **required for D5–D8 in this POC — D8 first**, since its behavior changed in Section 2 |

### 3.2 D8 editor — minimum configuration surface

Because D8 is now a search-and-suggest step, its editor must at minimum expose:

- **Data Schema**: toggles for which inputs feed the D8 draft — own GD 11 fields, confirmed D4 root cause, D3/D5/D7 actions, D6 verification statuses, precedent GD 11 rows, GD 9 FMEA link, open-case recurrence scan.
- **Prompt Guide**: the drafting guidance for the Lessons Learned summary (e.g., tone, length, "What Worked / What Didn't" structure).
- **Form Mapping**: output paths for the gate result, draft summary, precedent-lessons list, and recurrence flags.
- **Constraints**: the non-negotiable grounding rules — every lesson must cite a GD 11 row or a source field; "no precedent lessons available" must be emitted rather than a fabricated lesson; the completeness gate result is computed, never AI-asserted.

### 3.3 Governance rules (apply to every step's configuration)

- **Fallback, never breakage**: disabled or blank configuration falls back to the code defaults, so analysis always remains operational. Blank JSON is treated as unconfigured, not invalid.
- **Validation on save**: duplicate output paths, unknown group fields, unsupported types/rules, and Data-Schema/Form-Mapping mismatches are rejected at save time, in both the browser and the CAP service.
- **Snapshot per report**: each generated discipline stores `resultJson`, `formSchemaJson`, `validationJson`, and `configVersion`, so a later configuration change never silently rewrites how a historical report renders.
- **The safety envelope is NOT admin-editable**: a prompt edit can change tone, emphasis, or structure — it can never disable the human-in-the-loop rules (Section 4), the citation requirement, the fixed response envelope, or the D8 completeness gate. Post-processing rechecks constraints deterministically regardless of what the prompt says.
- **Auditability**: configuration changes are logged (who, what, when) to the same audit trail as AI suggestions; `previewStepConfiguration(stepCode, payload)` on `AiAdminService` lets an admin inspect the effective input, schemas, rules, and config version without exposing AI credentials.

---

## 4. Cross-Cutting Requirements

- **Every AI-drafted value must trace back to a real field** in the Golden Dataset or a cited precedent case. No invented facts, no placeholder text presented as real data.
- **Every suggestion is a draft, not a decision.** The AI never marks a step Complete, never sets "Is Root Cause? = Y", never closes a case. A human action is always required.
- **Every precedent-based suggestion cites the case ID, the match score, and what was done in that case.**
- **Every AI action (draft shown, suggestion accepted/rejected) is logged** to an audit trail (who, what, when) — this doesn't need to be a full production logging system for the POC, just visible and demonstrable.
- **Q1 vs Q3 is not a special case in the AI logic** — the same functions run for both; only the presence of Customer Reference data (GD 14) differs.
- **Per-step AI behavior is configuration, not code** — prompts, input schemas, output layouts, constraints, and similarity weights are tunable in AI Settings (Section 3) and take effect on the next analysis without redeploy. The safety rules above are the one exception: they are enforced in code and cannot be configured away.

---

## 5. Acceptance Criteria (how we'll know the POC qualifies)

Test against real rows already in the Golden Dataset — don't invent new test cases:

1. Given notification **8D-10048291** (Q3), the AI correctly drafts a D2 problem statement using its actual material, batch, defect, and inspection data — every fact in the draft must be traceable to that row.
2. Given the same case, the AI's D4 retrieval returns the correct top-scoring precedent (recompute the score by hand against the formula in Section 2 to confirm the AI's number matches).
3. Given a case where no precedent clears score 3, the AI returns the "no strong precedent" message instead of fabricating a root cause.
4. Given notification **8D-2612** (Q1, real Galileon reference case), the same D2/D4 logic runs correctly and the Customer Reference fields (GD 14) are available without breaking the Q3 flow.
5. D8 closure is correctly blocked if any of D1–D7 is not marked Complete, and correctly allowed once all seven are.
6. Given **8D-10048291**, D1 correctly suggests roles Production Engineer / Quality Engineer / Warehouse Clerk / Production Worker and the four matching individuals, citing precedent case 8D-10047950 (score 7/11) — recompute by hand to confirm.
7. Given **8D-10048150**, which has no past case clearing the score-3 threshold, D1 correctly shows "no suggestion available" instead of fabricating a team.
8. Given **8D-10048291** and **8D-10047950**, D2's Is/Is-Not correctly identifies EQ-PRESS12-004 as IS and the comparison equipment as IS NOT, with the right lot counts and nonconforming rates — recompute by hand against GD 17 to confirm.
9. Given **8D-2612** (real Galileon reference case), D2's Is/Is-Not independently computes Fixture #2/LH variant as IS and Fixture #1/RH variant as IS NOT — the same fixture Galileon's real published case names, without having been told the answer in advance.
10. Given **8D-10048150** (visual defect, no measurable characteristic), D2's Is/Is-Not correctly shows "not applicable" instead of fabricating a comparison.
11. Given **8D-10048291** with D1–D7 Complete, D8 drafts the Lessons Learned summary from that case's own GD 11 fields **and** shows a precedent-lessons panel citing 8D-10047950 (score 7/11) — surfacing that case's GD 11 rows if they exist, or "precedent found, no lessons recorded" if they don't. Never a fabricated lesson.
12. Given **8D-10048150** (no precedent clears score 3), D8 still drafts a summary from that case's own data, and the precedent-lessons panel correctly shows "no precedent lessons available."
13. **AI Settings — Step Prompts**: adding an instruction to D4's system prompt (e.g., *"Always check equipment calibration date."*) demonstrably changes the next analysis's D4 output; disabling that step prompt makes the next analysis fall back to the code default. No redeploy in either direction.
14. **AI Settings — Similarity**: changing the work-center weight from 4 to 5 changes the computed precedent scores on the next retrieval (recompute by hand to confirm), and restoring it returns the scores in criteria 2 and 6. No redeploy.
15. **AI Settings — snapshots**: after changing a step's Form Mapping, a previously generated report still renders with its original saved layout, while the next report uses the new one.
16. **AI Settings — safety envelope**: no combination of prompt/constraint edits allows the AI to mark a step Complete, set "Is Root Cause? = Y", or close a case — post-processing still enforces these regardless of configuration.

---

## 6. Out of Scope for This POC

- Live SAP connection (OData/RFC) — use the Golden Dataset as the data source today; ABAP/Phat's OData work is a separate, parallel task.
- Authentication, roles & permissions.
- Multi-language support.
- Production-grade logging/observability — a visible audit trail in the demo is sufficient.
- Role-based access control on AI Settings — for the POC, anyone with the URL can configure; locking it to an admin role is a production concern (falls under the authentication exclusion above).
- Writing into other cases from D8's recurrence scan — the flag is informational only in this POC; automated cross-case actions are out of scope.

---

## 7. Reference Materials

- `ConaSpark_CompetitorResearch_v0.6.xlsx` — sheets: **Hackathon Master Checklist** (now includes a Source System / SAP Module column per data point), **GD 0 – Relationships** (data model + system architecture; ER diagram now shows each entity's source system, and GD 16/GD 17 with a distinct join style since they aggregate by Material+Characteristic rather than by case), **GD 1–14** (Golden Dataset), **GD 15 – Team Assignments** (historical roster per case, powers D1's suggestions; rows for 8D-2612 are explicitly marked ASSUMED, not real), **GD 16 – SPC Control Charts** (real QASH/QAST field names, confirmed against your live SAP export; one illustrative snapshot per case's Material+Characteristic), **GD 17 – Historical Inspection Lots** (NEW — real QALS/QAMR field names, individual per-lot records powering D2's AI-drafted Is/Is-Not comparison; illustrative except 8D-2612's population, which is built to independently reproduce Galileon's real published Is/Is-Not answer as validation — see the Is/Is-Not note in Section 2)
- `8D Copilot - Flagship Mockup (Internal Defect + Customer Complaint).html` — working click-through reference for expected UI/UX behavior per step
- `8D Reports - AI Backend (backbone reference).py` — reference implementation of the retrieval scoring and D2/D4 drafting logic described above; reuse this logic rather than rebuilding it from scratch
- `docs/AI-SETTINGS-D1-CONFIGURATION.md` — as-built documentation of the per-step configuration editors (Data Schema / Prompt Guide / Form Mapping / Constraints) for D1–D4; Section 3 requires extending this pattern to D5–D8
- `docs/8D-COPILOT-E2E-GUIDE.md` — end-to-end business + architecture + test guide, including the AI Settings tabs (General Settings, Model Registry, Similarity, Step Prompts) and the 4-step analysis pipeline (`enrichContext` → `diagnoseIndependently` → `generateReport` → `postProcess`)
