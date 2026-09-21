# Precedent Retrieval — Review of the Matching Engine

**Date:** 2026-08-31 · **Revised 2026-09-01** — prerequisite scheduled, ownership restated
**Branch:** `dev/Thien`
**Status:** review — **owned by the AI / retrieval workstream**, not the chain-alignment plan
**Owner:** AI track (separate from Quyen's chain-alignment plan)
**Audience:** whoever tunes **AI Settings → Similarity**; process owner for R1
**Authoritative for:** the similarity engine — criteria, weights, thresholds. Feeds D1, D3, D4, D5, D8.
**Related:** `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` (captures `defectCodeGroup` in Phase 1.3; takes **no position** on weights) · `SAP-QM-CHAIN-ALIGNMENT-VERIFICATION.md` · `AI Requirements - 8D Copilot POC.md` §2

**Scope:** the one engine that answers *"which closed cases are like this one"*. It feeds D1 (team), D3, D4, D5 and D8, so a change here changes five steps at once.

**Why this is a separate document.**

- `D1D2FIXPLAN - 11PM (1).md` is being implemented and tested right now. Nothing here should be added to it.
- `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` (accepted 2026-09-01) covers the SAP QM chain — flow, screens, fields, integration. Retrieval is a different subject with a different owner. The chain plan **explicitly does not decide** R1 / R4 (semantic weight).
- The findings below propose changing **seeded defaults that the requirements document fixed**, so they need sign-off from whoever owns `AI Requirements - 8D Copilot POC.md` §2.

The two documents meet at one point: once defect **code groups** exist, the group becomes the natural fallback when codes differ. That is finding R7. **Prerequisite now scheduled:** `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` Phase 1.3 stores `defectCodeGroup`. This workstream decides what it is worth; the chain plan only captures the field.

---

## How matching works today, in plain language

For every closed case, the app awards points and keeps anything scoring 3 or more, best 3 shown:

| Signal | Points |
|---|---|
| Same work centre | +4 |
| Same defect code | +4 |
| …or, if the codes differ, the two defect descriptions share **any** word | +2 |
| Same material | +3 |
| …or, if the materials differ, same material family | +1 |
| An AI rates how similar the two case narratives read (0–1), scored only from 0.70 up | up to +5 |
| **Maximum** | **16** |

The first five are plain comparisons in code. The last one is an embedding: the case story is turned into a vector and compared by cosine similarity.

**Verified working.** In the 2026-08-31 live run, all three returned scores reconcile by hand against this table. The engine does what it is configured to do. The findings below are about whether the configuration is right.

---

## Findings

### R1 (high) — The semantic criterion deviates from the signed requirement

| | Requirements §2 | Seeded default in code |
|---|---|---|
| Weight | **+3** | **5** (`defaults.ts:91`) |
| Enabled by default | **No** — *"Off by default for the POC scoring examples below"* | **Yes** (`defaults.ts:113`) |
| Maximum score | 11, or 14 with it on | **16** |

The code comment justifies the 5: at the 0.70 floor it yields 3.5, which just clears the threshold of 3, so the criterion can surface a case on its own. That reasoning is coherent — but it is the *opposite* of the doc's intent, which was that narrative similarity should not by itself qualify a precedent during the POC.

**Consequence to be aware of before a demo.** Anyone recomputing the doc's worked example (`7/11`) against the running system will get a different maximum and a different number. Doc and seed must agree, whichever way the decision goes.

---

### R2 (high) — The prompt hardcodes a formula that is no longer the one being used

`prompts.ts:137-139` tells the model, verbatim:

> *"Precedents are scored: work centre +4, defect code +4 (or +2 when only the defect text overlaps), material +3 (or +1 for the same material family), **out of 11**."*

Two problems:

1. The semantic criterion is not mentioned, and the maximum is wrong. The model reasons about a 16-point score believing the ceiling is 11.
2. **The weights are a literal string.** An admin who retunes them in AI Settings changes the scoring but not the prompt. The two silently diverge.

This undercuts the promise in requirements §4: *"Per-step AI behavior is configuration, not code … similarity weights are tunable in AI Settings and take effect on the next analysis without redeploy."*

**Fix.** Generate that paragraph from the active criteria at prompt-build time. The data is already in hand — `explainScore` does exactly this per case.

---

### R3 (high) — Word matching is one word wide, and looks at the wrong field

Two separate defects, both visible in the live run:

**(a) One shared word earns the full +2.** `MIN_SHARED_KEYWORDS = 1` (`scoring.ts:89`). The live case matched `8D-10049010` on the single word *flange*:

> Ours: `Flange edge burr above limit`
> Theirs: `Chatter marks and surface waviness on milled flange`

A burr and chatter marks are different failures with different causes. This scored the same +2 that a genuinely similar description would.

**(b) It reads only the catalog text, never the operator's own words.** `defectKeywords` is built solely from `product.defectText` (`librarySeeder.ts:117`), and `keywordsOf` falls back to the same field (`scoring.ts:262-268`). `symptomShortText` is never considered.

The live run shows the cost. The logged symptom was *"…pocket depth also reading shallow"*. The precedent `8D-10048880` is titled *"Pocket depth inconsistent across units"*. **It scored +0 on this criterion** — the most obviously matching phrase in the whole test was invisible, because it was in the wrong field on both sides.

**Fix.** Raise the threshold to 2 shared keywords, or scale points by overlap; and include the symptom text on both sides of the comparison. The criterion already reads whatever `sourceField` points at, so (b) is mostly a matter of populating a second keyword column at seed time.

---

### R4 (medium) — For a genuinely new defect, the honest empty answer is weakened

The design's honesty rule is good and explicit (`prompts.ts:141`):

> *"When no case clears 3, write that no team suggestion is available and the team must be assigned manually. That is the correct answer — a plausible list of invented roles is not."*

But with the semantic criterion at weight 5 and a floor of 0.70, a case sharing **nothing** — different machine, different part, different code — scores 3.5 and qualifies. The code is aware of this and deliberately stops pre-filtering, scanning the whole library instead (`precedentRepository.ts:143-149`).

Now the measured baseline, recorded in the codebase itself (`defaults.ts:100-108`, from `scripts/measure-similarity.mjs` over 78 pairs of the current library):

> lowest 0.543 · p25 0.608 · median 0.636 · p75 0.687 · highest 0.792

Every case is English manufacturing-defect prose in one template, so **unrelated cases already sit around 0.64**. The 0.70 cutoff is only just above the 75th percentile.

**Practical consequence.** For a brand-new defect the app will rarely say *"nothing found"*. It will more often show a weak 3.5–4/16 match that shares nothing but writing style — and D1 will then propose a team from it. This is the scenario the design handles worst, and it is also the scenario most likely to appear in a live demo on unfamiliar data.

**Fix options**, in order of preference:

1. **Semantic weight → 3** (the doc's number). `3 × 0.70 = 2.1`, below threshold, so meaning becomes a *booster* for cases that already match on something real and can no longer qualify one alone. Restores R1 at the same time.
2. Require at least one deterministic hit before a case is eligible.
3. Raise `minScore`. Blunt — it also discards weak-but-real matches.

**The tradeoff, stated plainly:** option 1 means a true "same failure, different line, different part, different code" case can no longer be found by wording alone. That is the exact case the semantic criterion was added for. Pairing option 1 with the R3 and R7 fixes is what keeps recall while removing the noise.

---

### R5 (medium) — The score breakdown is computed, sent to the AI, and hidden from the user

`scoreCase` returns a per-criterion breakdown, and `explainScore` formats it as `"13/16 — Work center WC-MILL-07, Material MAT-10247, …"`. That string is passed into the prompt (`prompts.ts:573`) but the Similar panel renders only the bare number (`precedent-panel.tsx:119`).

The model can see why a case scored 13. The engineer cannot. It is exposed on `AiAdminService`, so this is a UI gap only.

*(Also recorded as L5 in `D1D2-FIXPLAN-VERIFICATION.md` — same fix, listed in both places because it belongs to both subjects.)*

---

### R6 (medium) — Counting is delegated to the model; writing is delegated to code

`servedOnCount` is a model-authored integer (`defaults.ts:147`) and was wrong in the live run — 2 reported, 1 correct. The suggested-roles list is model-generated too, though requirements §2 specifies a **tally**.

**The general principle worth settling now, because it will recur at every step:** the model is a good writer and an unreliable accountant. Counting, tallying, ranking and citing are deterministic and belong in code; phrasing a responsibility in this case's language belongs to the model. Today the split runs the other way.

Full detail and the fix are in `D1D2-FIXPLAN-VERIFICATION.md` (finding L1). Noted here because the count is derived from *this* engine's output.

---

### R7 (high) — Match on the defect **code group** when the codes differ

**This is the structural answer to "every defect gets a different code, so how will we ever match?"** — and it depends on the code-group work now scheduled in `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` Phase 1.3.

Codes differ between plants, lines and catalogues. **Groups do not.** SAP groups codes into families deliberately, by a human decision about the nature of the failure.

Replace the binary defect criterion with a graded one:

| Condition | Points |
|---|---|
| Same code group **and** same code | +4 |
| **Same code group, different code** | **+2** |
| Different group | 0 → fall through to keyword / semantic |

**What this buys, in the live run's own terms.** `DEF-0489` (flange burr) and `DEF-0902` (chatter marks) are both `QM-SUR`. Under this rule they score +2 because a person classified them into the same failure family. Under today's rule the match scored +2 because both sentences happened to contain the word *flange*. Same points, incomparably better evidence.

**And it fixes R4's blind spot.** A never-seen-before defect still lands in an *existing* group, so it inherits real precedents on day one instead of finding nothing — or finding something that merely reads alike.

**Evidence that the current criterion is carrying little weight:** in the live run, **2 of 3** matches scored +0 on defect code. Work centre, material and semantics did all the work.

**Effort.** The engine already supports this shape — `Criterion` has `fallbackField` / `fallbackMatch` / `fallbackWeight`. Point the fallback at `defectCodeGroup` with `matchType: 'exact'`, weight 2. It is a change to `DEFAULT_CRITERIA`, not new code. **Prerequisite:** the group must actually be captured and stored — scheduled as Phase 1.3 of `CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md`. This workstream decides the +2; the chain plan only captures the field.

---

## Recommended changes

| # | Change | Type | Depends on |
|---|---|---|---|
| R1 | Settle semantic weight & default: doc says 3/off, code says 5/on | **Decision** | — |
| R4 | Set semantic weight to 3 so meaning boosts rather than qualifies | Config | R1 decision |
| R2 | Build the scoring paragraph in the prompt from the live criteria | Code (small) | — |
| R3a | `MIN_SHARED_KEYWORDS` 1 → 2, or scale points by overlap | Config/code | — |
| R3b | Include `symptomShortText` in keyword matching, both sides | Code + reseed | — |
| R7 | Code-group tier at +2 when codes differ | Config | Code group captured (`CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` Phase 1.3) |
| R5 | Render the existing score breakdown in the Similar panel | UI (small) | — |
| R6 | Compute `servedOnCount` and the roles list instead of asking the model | Code | — |

**Order.** R1 is a decision and blocks R4 — both sit with this workstream, not the chain plan. R2, R3a, R5, R6 are independent and can start immediately. R7 waits on Phase 1.3 of the chain plan.

---

## Open questions

1. **Who owns the similarity defaults?** They exist in three places that can disagree: the requirements doc, `DEFAULT_CRITERIA` in code, and whatever an admin has saved in AI Settings. Today nothing detects divergence. Worth deciding which is authoritative and logging when the live config differs from the seeded default.
2. **Should the semantic threshold be re-measured?** The 0.70 floor was chosen from a measured distribution over the *current* library. That distribution shifts as the library grows or if the embedding model changes — the code comment says so explicitly. Re-running `scripts/measure-similarity.mjs` should be part of any library expansion.
3. **Should retrieval eventually score how a case was *fixed*, not only how it looked?** Not possible today — actions are free text. It becomes possible once Quality Tasks are coded (`CHAIN-ALIGNMENT-IMPLEMENTATION-PLAN.md` Phase 4). Out of scope for the POC; worth recording as the natural next criterion. The chain plan supplies the coding; this workstream decides whether it becomes a criterion.
