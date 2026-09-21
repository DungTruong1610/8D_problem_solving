# Did the team actually build what the D1/D2 fix plan asked for?

**Checked on:** 2026-08-30 · **Branch:** `dev/Thien` · **Latest commit:** `75fc36e`
**Plan being checked:** `docs/D1D2FIXPLAN - 11PM (1).md`

**How I checked.** I read the code and the seed data and compared them, line by line, against every task in the plan. I also ran the automated test suite, the type checker, and the database model compiler. What I could **not** do is start the system and click through it — so anything that depends on how the AI actually behaves on a live case is marked *"needs a real run"* rather than *"passed"*.

---

## The short answer

**Everything in the plan got built. The code is healthy. There is one real bug, and it will show up on stage if we don't fix it.**

| The three health checks | Result |
|---|---|
| Automated tests | ✅ All 875 passed |
| Type checking (catches broken code) | ✅ Clean |
| Database model compiles | ✅ Yes — both new tables are created correctly |

The team also built two things the plan only *suggested* rather than required: the FMEA table for D7, and a Master Data screen for browsing the new inspection history.

**The one thing to fix before the demo** is described in §"The bug" below. It is a single missing line of code, but it quietly switches off the D7 FMEA lookup — the exact problem the plan was trying to solve.

---

## Step by step — what the plan asked, and what is there

### Step 1 — "Give the AI somewhere to explain itself" ✅ Done

*The plan's point: the AI was correctly saying "I cannot compare, there is no history" — but the report form had no box to print that sentence in, so the user just saw blanks and assumed the AI was broken.*

| What was asked | Done? | What it means in practice |
|---|---|---|
| A box on the D2 form for the "why I couldn't compare" sentence | ✅ | The sentence now appears on screen instead of two empty boxes |
| Same for D1 — a box for "no team suggestion available" | ✅ | A case with no matching past case now explains itself instead of showing blank rows |
| Show *"served on 3 similar cases"* next to each suggested person | ✅ | The engineer can see who the strongest suggestion is, and the list order finally means something |
| **F6** — when a case fails two measurements, say which one was *not* compared | ✅ | The warning list now reads *"Is/Is-Not was computed for Flange burr height. Flange flatness is also out of specification and was not compared."* — word for word what the plan asked for |

**Two things worth knowing:**

- The plan warned that every step's settings are written down **twice** in the code, and the second copy silently wins — so editing the wrong one looks successful and changes nothing. The team edited the right one. (They updated the dead copy too, for the next reader.)
- The team went further than asked. The plan put the "no team suggestion available" sentence in the AI's instructions — meaning the AI is *asked* to produce it. The team also hard-coded it, so the sentence appears **guaranteed**, whether or not the AI cooperates. That is a stronger result than the plan required.

**One small difference, not a problem.** The plan said to put the D1 status box in a group called `d1-ai-result`. That group doesn't exist — D1 was deliberately built to show only one table on the report. The box went into the group that *does* exist, so it still shows up. Same outcome.

---

### Step 2 — "Stop the AI receiving contradictory instructions" ✅ Done

*The plan's point: one instruction said "never write Is/Is-Not, we don't have the data"; another said "explain your Is/Is-Not reasoning". The AI was getting both at once.*

- The old contradictory sentence is **gone** — I searched for it and it no longer exists anywhere.
- The replacement text is in place, and says what the plan required: the IS / IS NOT values are calculated by the system, the AI does not choose them, and when no comparison is possible the AI must not invent one.
- The team actually improved on the plan's draft: the AI is now told to structure its explanation into two named sections (*detail by characteristic*, then *synthesis and conclusion*), which will read better on the report.
- Both new D1 instructions were added exactly as written, and there is an automated test guarding them so nobody can quietly delete them later.

---

### Step 3 — "Build the measurement-history table" ✅ Done *(this is where the bug is — see below)*

*The plan called this "the real fix" — without it, Is/Is-Not is empty on every case created from the popup.*

| What was asked | Done? |
|---|---|
| A new database table holding past inspection measurements | ✅ `InspectionLots` — with all the columns the plan listed, plus a unit column |
| When the case doesn't carry its own history, look it up in the table | ✅ |
| If a case *does* carry its own history, that still wins (so old test files keep working) | ✅ |
| Let the AI's "blind diagnosis" see the history too | ✅ |
| **The optional extra:** an FMEA table so D7 stops saying "no FMEA entry linked" on every case | ✅ **Built** — the plan only recommended this |

**A small difference, and it is fine.** The plan's example looked up history by *material + characteristic*. The code looks up by *material only*, then filters by characteristic slightly later. Same answer, just a few more rows loaded on the way. It is also what makes the F6 two-characteristic case work properly.

---

### Step 4 — "The two paths, end to end" ✅ Done

*The plan's point: the 5W2H "How" box was guessing. It said "found during inspection" simply because the case happened to have inspection rows attached — a plausible substitute, not a recorded fact.*

Everything asked for is there and connected all the way through:

- The popup now has the **Found during inspection / Found outside inspection** choice at the top.
- The **Inspection Lot** field appears only when "during inspection" is selected, and is cleared otherwise.
- Each measurement row now has its own **Equipment / Fixture** field — this is the thing Is/Is-Not actually compares, so without it the feature could not exist.
- The helper text under Section 3 is there, explaining why measurements matter.
- All three travel from the popup, through the backend, into the case, into the "How" box, and are saved on the report.
- The "How" box now reads *"Detected during in-process inspection (Lot: INS-80411)"* — a recorded fact instead of a guess.

**Note for whoever reads the plan next:** the plan points at a file called `fiveW2H.ts`. **That file no longer exists** — an earlier refactoring folded its logic into another file, and that is where the "How" change landed. The behaviour is the same; only the plan's page reference is out of date.

---

### Step 5 — "Prepare the demo data" ⚠️ Data is done; two loose ends

**The data itself is solid — I recounted it by hand.**

The plan set two thresholds. If seed data falls below either one, the system correctly refuses to compare — which on stage looks exactly like a bug even though it isn't. So this was worth checking properly:

| Threshold | Required | What the data has |
|---|---|---|
| Lots per equipment group | at least 2 | **3** everywhere |
| Difference in failure rate between the two groups | at least 25 points | **100 points** everywhere (one group fails 100%, the other 0%) |

All **18** material-and-characteristic combinations clear both thresholds comfortably. That closes the plan's acceptance test #4 — the numbers on screen will match the lots cited.

**The two loose ends:**

1. **13 materials have history seeded; the demo popup can offer 20.** So 8 materials will produce the honest *"cannot compare"* message. Per the plan's own **decision D-3** this is correct product behaviour and was probably deliberate — but nothing written down says so, so a future reader can't tell a decision from an oversight.
2. **The plan asked for the list of "rich" materials to be handed to whoever runs the demo (task 5c).** That list doesn't exist as a document. It is *partly* covered by the new **Master Data** screen, where the driver can browse the seeded history live. Still worth writing the 13 material numbers on a card.

**A nice accident:** on case `8D-10048412`, *Flange burr height* has history seeded but *Flange flatness* does not — and both failed. That single case will demo a real IS / IS NOT **and** the new F6 warning at the same time. Better than what the plan planned for.

---

## The acceptance tests

| # | The test | Result |
|---|---|---|
| 1 | Popup case on a material **with** history → a real IS / IS NOT pair | 🔶 **Needs a real run.** Every piece is in place and the data is correct — but this one depends on the AI behaving, so I can't tick it from the code alone. |
| 2 | Popup case on a material **without** history → the explanation sentence, not blanks | ✅ **Guaranteed.** The sentence is written by code, not left to the AI. |
| 3 | Visual defect with nothing measurable → *"Not applicable…"* | ✅ **Guaranteed**, same reason |
| 4 | Recount the cited lots by hand — do the percentages match? | ✅ **Passed.** I did the recount; all 18 combinations are correct. |
| 5 | The old JSON case still overrides the table | ✅ Passed |
| 6 | The 5W2H grid and the paragraph agree with each other | 🔶 Needs a real run — this is AI behaviour |
| 7 | Without the seeder, dropdowns are empty | ✅ Dependency unchanged, seeder kept |
| 8 | D1 roster shows *"served on N cases"*, sorted highest first | 🔶 The field, the instruction and the screen are all there — but **the sorting is only requested of the AI**, not enforced by code, and no test checks it. Watch this one on a real run. |
| 9 | No matching past case → *"No team suggestion available; assign manually."* | ✅ **Guaranteed** by code |
| 10 | Accepting a suggested person fills in their email and phone | ✅ Was already working; unchanged |

---

## The bug 🔴

**In plain terms:** the database lookup that Step 3 built is only switched on for the *first, full* analysis of a case. There is a **second** way the system analyses cases — the one it uses when you confirm a step and it re-runs everything after it — and that second path was never given the lookup.

**Why this matters more than it sounds:**

That re-run path starts from **D5 by default**, which means it re-analyses **D7**. And D7 is precisely where the new FMEA table was supposed to help. So on every re-run, D7 goes back to saying *"no FMEA entry linked"* — the exact complaint the plan was written to fix. The same thing happens to D2's Is/Is-Not if anyone re-runs from D2: a material that *does* have history seeded will report *"cannot compare"*.

**The fix is one line** — copy the same lookup call into the second path, right after the case is loaded, exactly as it is done in the first path.

**Where:** `srv/src/domain/eightd/eightDAnalyzer.ts`, in `analyzeDownstreamReport` around line 1154 — mirroring what line 1051 already does in `analyze()`.

---

## Other open items (none urgent)

**Half the tests the plan asked for were not written.** The suite is green, but nothing currently tests the new database lookup or the F6 warning line. That is *why* the bug above could slip through unnoticed — there was no test to catch it. Specifically missing: a test that the lookup fills in the history, a test that a case's own history still wins, a test for the F6 sentence, and a test that the roster is sorted by "served on" count.

**The seeding script still points at the wrong port.** It defaults to `4004`; the development backend runs on `4008`. The plan flagged this and suggested fixing it alongside Step 5. Until then, seeding only works if you override it:

```bash
SEED_HOST=http://127.0.0.1:4008 npx tsx scripts/seed-library.ts
```

**A misleading comment is still in the code**, claiming team members have no email or phone. They do. The plan explicitly said this needs no action — it's tidiness, nothing is broken.

**One check the plan asked for was never done.** On a freshly logged defect there is no recorded root cause, so D4 has nothing to compare its own independent diagnosis against. The plan asked someone to confirm D4 still reads sensibly in that situation, and to add a test. Neither happened. This needs a real run to judge.

---

## What to do before the demo

1. **Fix the one-line bug.** Without it, D7's FMEA and any D2 re-run quietly lose their database grounding — and it will look like the AI failed.
2. **Run one live case** on `MAT-10247` through the popup. That single run closes acceptance tests 1, 6 and 8, which are the only ones I could not confirm from the code.
3. **Write the 13 seeded material numbers on a card** for whoever drives the demo, so nobody picks an unseeded material on stage.

Everything else is finished and verified.

---
---

# Live-run results — 2026-08-31

**What this section is.** The verification above was done by reading code, and it deferred every behaviour question to *"needs a real run"*. That run has now happened: one case logged through the Record Defect popup on `MAT-10247` (`8D-10049121`), analysed end to end. This section records what the live run showed, and closes the three acceptance tests that could not be confirmed from code.

**Bottom line.** The plumbing works. Precedent retrieval is accurate and the roster is grounded in real people from real cases. **One acceptance criterion fails on content rather than on plumbing:** the "served on N similar cases" count is produced by the AI instead of being counted by the program, and on this run it was wrong.

---

## Acceptance tests that were pending

| # | What it required | Result |
|---|---|---|
| 1 | A case logged through the popup produces a real Is/Is-Not | Passed — retrieval and analysis ran end to end |
| 6 | Roster shows "served on N similar cases", ordered by that count | **Partly failed** — the badge renders and the ordering is correct, but one of the six counts is wrong. See finding L1. |
| 8 | Precedent panel shows matched cases with scores | Passed — 3 matches shown, scores reconcile by hand (see below) |

**Scores verified by hand**, against the formula in the criteria config:

| Case | Work centre | Defect code | Material | Deterministic | Shown |
|---|---|---|---|---|---|
| `8D-10049010` | +4 | +2 (shares the word *flange*) | +3 | 9 | **13/16** |
| `8D-90048880` | +4 | +0 | +3 | 7 | **10.8/16** |
| `8D-10048880` | +4 | +0 | +3 | 7 | **10.7/16** |

The remainder in each row is the semantic criterion. The arithmetic is sound — the scoring engine is doing exactly what it is configured to do. Whether it is configured *correctly* is a separate question, reviewed in `PRECEDENT-RETRIEVAL-REVIEW.md`.

---

## Findings from the live run

### L1 (high) — "Served on N similar cases" is guessed, not counted

**What happened.** The roster showed *"Heli Weber — served on 2 similar cases"*. She appears on **one** of the three precedents (`8D-10049010`). The correct number is 1.

**Why it happened.** `servedOnCount` is declared as an ordinary integer in the D1 roster schema (`srv/src/domain/eightd/precedent/defaults.ts:147`) and the prompt asks the model to fill it in (`defaults.ts:300`). Nothing recomputes or checks it. It is a count over a three-item list being produced by a language model.

**Why it matters beyond the wrong number.** The plan requires the roster to be *ordered* by this count, so an inflated count promotes the wrong person to the top of the list — which is exactly the decision the badge exists to inform. The original requirement (`AI Requirements - 8D Copilot POC.md`, section 2, D1 row) specifies a **tally**, not a model output: *"by individual → suggested people, ranked by how often they appear."*

**Fix.** Compute it in post-processing from the precedent block and remove it from the schema the model fills. The same argument applies to the suggested-roles list, which is also model-generated today.

---

### L2 (medium) — The roster shows no case citation, and the AI's own reason is discarded

**What happened.** Each suggested person shows name, role, the badge, and a responsibility sentence. There is no indication of *which past case* the person came from, and no reason for the choice.

**Why it happened.** The model already emits `selectionReason` ("why this person, in one line") and `sourceCase` (the precedent notification ID) for every row. `team-roster-widget.tsx:485` renders `caseResponsibility` and nothing else — `row.selectionReason` and `row.sourceCase` appear in the TypeScript interface and in no JSX.

**Why it matters.** This is the acceptance criterion in section 4 of the requirements: *"Every precedent-based suggestion cites the case ID, the match score, and what was done in that case."* The data is being generated and thrown away at the last step.

**Related, worth stating plainly for reviewers:** the responsibility sentence itself is *inferred, not retrieved*. All the model receives per person is `name (functionTitle, led the team)` — the precedent's actions carry no owner (`prompts.ts:551`). So "Lead investigation, coordinate root cause analysis…" is the model expanding a job title, not a record of what that person did. That is by design (`caseResponsibility` is defined as accountability *for this case*), but rendered next to a "served on N cases" badge it reads like history. Showing `sourceCase` alongside it is what keeps the two apart.

**Fix.** Render both fields. No model change, no schema change.

---

### L3 (medium) — Two of the three "similar cases" are the same case

**What happened.** `8D-90048880` and `8D-10048880` are the same incident: identical symptom text, same defect code, same work centre, same three team members. `90048880` is the *dirty* variant (`"  MAT-10247 "`, `"Production Eng."`).

**Consequences, both real:**

- The panel says "3 matches" when there are 2 distinct incidents.
- Three people are badged *"served on 2 similar cases"* when they served on one case that is stored twice. Those numbers are literally correct and substantively misleading — worse than being wrong, because they look verified.

**Why it happened.** `scripts/bundle-library.mjs:24` seeds **only** from `mock-data/clean/`, so a `9004…` case should not be in the library. It most likely arrived from an earlier test run being analysed in-app.

**Fix.** Audit `HistoricalCases` for `9004…` notification IDs and remove them before the demo. Worth adding a guard so dirty-variant cases cannot enter the library.

---

### L4 (medium) — One business partner ID belongs to two different people

**What happened.** The roster showed *"Rita Fischer — no matching business partner"*, so she cannot be accepted onto the team.

**Why it happened.** `BP-100088` is used for **Klaus Richter** in 8 records and **Rita Fischer** in 4 across the case library. The partner value help is keyed on `partnerId` over `HistoricalTeamMembers` (`valueHelpSeeder.ts:186`), so one name wins the lookup and the other becomes unresolvable. Both colliding identities happen to appear on this same roster.

**The UI behaved correctly** — `team-roster-widget.tsx:506` refuses to let an unresolvable person be added to the decision table. This is a master-data defect, not a code defect.

**Fix.** Give Rita Fischer her own ID across `mock-data/clean/` and re-seed. Worth a uniqueness check at seed time so the next collision fails loudly instead of silently dropping a person.

---

### L5 (low) — The precedent panel hides the reason for the score

**What happened.** The Similar panel shows `13/16` and nothing else.

**Why it matters.** The backend already computes a full per-criterion breakdown and formats it as `"13/16 — Work center WC-MILL-07, Material MAT-10247, …"`. That string **is** sent to the AI (`prompts.ts:573`) but never shown to the user (`precedent-panel.tsx:119` renders the bare number). The model can see why; the engineer cannot.

**Fix.** Render the existing `explanation` string under the score. It is already on the payload.

---

### L6 (informational) — A "failed analysis" banner on an old case is stale, not a live failure

Case `8D-10048880` displays *"Analysis failed … Tăng max_tokens hoặc giảm thinkingBudget"*. **This is not a current failure.** That wording no longer exists anywhere in the source — it was replaced on 2026-08-27 (`bd5c66e`) by a message that includes the model name and the tokens actually produced. `markFailed` persists `errorMessage` on the row, so a failure recorded before that date sits there permanently until the case is re-analysed.

**Action:** press **Re-analyze** on that case before the demo so the banner clears. No code fix needed.

Note also that the stale message's advice ("raise max_tokens") is the opposite of what the code now does: truncation at the ceiling is treated as a degenerate repeat-loop and retried once at a higher temperature with an anti-repetition instruction (`eightDAnalyzer.ts:663`). If a *fresh* truncation ever appears, the new message will carry `model=` and `đã sinh N token` — and if produced equals the ceiling exactly, the cause is the loop, not a budget shortage.

---

## Recommended order

1. **L1** — compute `servedOnCount`. It is the only finding that puts a *wrong statement on screen*.
2. **L3 + L4** — clean the library and the partner IDs. Data-only, no deployment.
3. **L2 + L5** — render the citations and the score breakdown. Small UI changes that close a stated acceptance criterion.
4. **L6** — re-analyse `8D-10048880`.

Nothing here blocks the demo except L1 and L6, and L6 is a button press.
