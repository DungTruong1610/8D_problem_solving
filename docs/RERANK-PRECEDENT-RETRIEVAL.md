# Precedent Re-ranking (Stage-2 LLM Pass) — D4 & D5

> Feature documentation for the two-stage precedent retrieval introduced for D4 (Root Cause)
> and D5 (Corrective Actions). Covers motivation, architecture, scoring semantics, the admin
> configuration guide, fallback behavior, and how to evaluate before enabling.

---

## 1. Motivation — why a second stage

Stage-1 retrieval compares the open case and each historical case **separately**:

- exact / keyword / family matching on normalized fields (work center, defect code, material),
- cosine similarity between two **pre-computed** embeddings (bi-encoder).

That is fast, deterministic and hand-recomputable — but it is structurally weak at the one
question D4 actually asks: *"do these two cases fail by the same physical mechanism?"*
The stored embedding mixes symptom and cause into a single vector, and no separate-encoding
method can weigh evidence *across* the two texts.

A **re-rank pass** fixes exactly that: a model reads the open case **and** each candidate
**together** and scores relevance against a step-specific instruction. It is more accurate
for nuanced semantic questions and more expensive (one model call per search), so it only
runs on the small top-K pool that stage 1 already filtered.

### Where it applies — and where it deliberately does not

| Step | Re-rank | Why |
|---|---|---|
| **D4** Root Cause | ✅ profile `diagnosis` | "Same physical failure mechanism" is the textbook cross-encoder question — the weakest spot of the mixed embedding. |
| **D5** Corrective | ✅ profile `corrective` | "Does the candidate's corrective action remove **this** root cause?" — judged best by reading both texts together. |
| D1 Team | ❌ | Ranking *people* by served-on counts is an aggregation problem, not a text-relevance problem. |
| D3 Containment | ❌ | Relevance is structural (same defect code); action texts are short — nothing for a reranker to "understand". |
| D2 | ❌ (possible later) | Cosine on symptom text already performs acceptably; revisit with measurements. |
| D6 / D8 | ❌ | Retrieval itself carries little value for these steps. |

**Re-rank is per-step, not shared.** D4 and D5 are bound to separate profiles, each with its
own instruction, weight, floor and on/off switch, and each producing its own independent LLM
call over its own candidate pool. Enabling it for D4 does not affect D5, and vice versa.

---

## 2. Architecture — two-stage flow

```
Stage 1 (unchanged, widened):
  fetchCandidates (SQL filter) → scoreCase (pure function) → keep candidates that
  COULD still reach minScore after re-rank (stage1 + rerankWeight ≥ minScore)
  → sort by stage-1 score → pool of top-K        K = min(20, max(topN × 4, 12))

Stage 2 (new, only when the profile has an enabled `rerank` criterion):
  ONE listwise LLM call for the whole pool:
    input  = instruction + open-case query text + K candidate texts
    output = JSON [{ notificationId, score 0-100, reason }]
  → each candidate's placeholder breakdown row is filled in with
    points = weight × (score / 100), reason recorded in `matchedOn`

Final:
  filter by the real minScore → sort by total score (same tie-breaks) → top-N
```

Key implementation points:

- **Listwise, one call** (`srv/src/domain/eightd/precedent/reranker.ts`): all K candidates go
  in a single prompt; the model calibrates scores across the list. Cost: one `reviewQuality`
  activity call per search per profile with re-rank enabled.
- **Deterministic setup**: `temperature: 0` with a sub-threshold thinking budget — the same
  mechanism the blind diagnosis uses, so the same input ranks the same way.
- **Pool admission uses reachability, not the raw floor**: a candidate whose stage-1 score
  plus the re-rank weight can still reach `minScore` is admitted to the pool. Filtering by
  `minScore` before re-ranking would eliminate exactly the cases stage 2 exists to rescue.
  The real `minScore` contract is enforced on the **final** score.
- **The SQL pre-filter knows about re-rank**: `nonFilterableReach` counts the re-rank weight
  as non-filterable (like cosine), so the candidate fetch falls back to a full scan rather
  than silently excluding cases that could only win through stage 2.

---

## 3. Scoring semantics — the explainability contract survives

Every score in this system is a sum of visible breakdown lines ("recompute the score by
hand"). Re-rank joins that contract rather than bypassing it — it follows the exact template
the `cosine` criterion established (a model-derived continuous number, with a floor and a
weight, sitting in the breakdown):

| Property | Value |
|---|---|
| Criterion `matchType` | `rerank` (no DB migration — `matchType` is a free string column) |
| Points | `weight × (model score / 100)`, rounded to 1 decimal |
| Floor | `minSimilarity` reused on the model's 0–1 scale (default 0.5 = below 50/100 scores zero) |
| Ceiling (`maxScore`) | includes the re-rank weight whenever the criterion is enabled — standard rule |
| Breakdown `matchedOn` | `rerank 80/100 — <the model's one-line reason>` — visible in the Precedent Panel and Step Score preview |
| Stage-1 placeholder | `scoreCase` emits a `none` row with 0 points for the criterion; stage 2 fills it in |

Defensive normalization of model output (`normalizeRerankOutput`, pure and unit-tested):
unknown notification IDs are dropped (the model cannot add cases), scores are clamped to
0–100, non-numeric scores are ignored, duplicate IDs keep the first occurrence, and missing
IDs simply leave their row at `none` with an explanatory note.

---

## 4. Admin guide

Both profiles are **seeded automatically at startup** (idempotent — existing profiles and
admin-modified bindings are never touched):

| Profile | Bound to | Criteria |
|---|---|---|
| `diagnosis` ("Diagnosis (D4)") | D4 | clone of `default`'s criteria **+** `Mechanism re-rank` (disabled) |
| `corrective` ("Corrective (D5)") | D5 | clone of `default`'s criteria **+** `Action-fit re-rank` (disabled) |

The binding is only moved to the new profile if the step was still on `default`; a binding
an admin already changed is left alone. The profiles are `isSystem` (not deletable) — to get
rid of re-rank, **disable the criterion**, don't try to delete the profile.

### Enabling and tuning (Object Schema page / step's Object Schema tab)

1. Open the profile (`Diagnosis (D4)` or `Corrective (D5)`).
2. On the `LLM Re-rank` criterion card:
   - **Switch it on.** The ceiling immediately includes its weight.
   - **Weight** (default 3): how much the model's verdict can move the total.
   - **Minimum score** (default 0.5): candidates the model scores below 50/100 get zero
     points from this criterion.
   - **Rerank instruction** — the question the model ranks by. This is the per-step
     difference and it is configuration, not code:
     - D4 default: *"Rank by same physical failure mechanism: judge whether the two cases
       fail the same way for the same physical reason. Ignore superficial matches of defect
       codes, part numbers or plant names."*
     - D5 default: *"Rank by whether the candidate case's corrective action would remove the
       root cause described in the query case…"*
3. Save. The next analysis run (or `findPrecedents` call) uses it.

### Reading the results

- **Precedent Panel / breakdown**: the re-rank line shows `rerank NN/100 — <reason>` so the
  ranking is never a black box.
- **Step Score preview** (`previewScore`): the preview is pure code and does not call the
  model — the re-rank row is labeled *"LLM pass — not simulated in preview"* and always
  shows 0 there. This is honest, not broken.

---

## 5. Fallback behavior

Re-rank can never break a search — the same philosophy as embedding failures:

| Failure | Behavior |
|---|---|
| LLM call fails or exceeds **20 s** | Stage-1 ranking stands; every pooled row keeps its placeholder with `matchedOn: "rerank unavailable"`; a warning is logged. |
| Model omits a candidate | That row stays at `none` with `matchedOn: "not scored by reranker"`. |
| Model returns malformed JSON | One retry with a correction hint (shared `callAndParse` machinery); then fallback as above. |
| Criterion enabled but no query text available | Treated as unavailable; stage-1 ranking stands. |

---

## 6. How to evaluate before enabling

Do not enable by default without numbers. The repo ships an evaluation asset designed for
exactly this: `mock-data/clean/` vs `mock-data/dirty/` — the same cases at two data-quality
levels.

Suggested A/B protocol:

1. Seed the library (`scripts/seed-library.ts`) and pick a set of open cases.
2. For each case, run `findPrecedents` twice against the D4 profile — re-rank off, then on.
3. Compare rankings: does the known same-mechanism case move up? Does an
   identical-defect-code-but-different-cause case move down?
4. Record the table of before/after rankings; enable only if the movement is consistently
   in the right direction.

---

## 7. Operations notes

- **No DB migration, no HDI artifact**: `matchType` is a free `String(20)`; the instruction
  reuses the criterion's `description` column; the floor reuses `minSimilarity`. Deploying
  to HANA requires nothing beyond the normal build.
- **Runs identically on SQLite and HANA** — the re-rank layer is pure TypeScript plus one
  LLM call; nothing engine-specific.
- **Cost**: one extra `reviewQuality` model call per search per enabled profile
  (≤ 20 candidates × ~700 chars each + the query text; output capped at 4 000 tokens).
- **Model routing**: the call goes through the standard activity registry — the admin can
  route `reviewQuality` to a cheaper/faster model in AI Settings without touching code.
- **Swap-ability**: the reranker is behind `rerankCandidates(instruction, query, candidates)`;
  a hosted cross-encoder (e.g. a dedicated rerank API) can replace the LLM listwise call at
  one site if the library grows past ~1 000 cases and latency starts to matter.

## 8. Source map

| Concern | File |
|---|---|
| Stage-2 call, output normalization, score application | `srv/src/domain/eightd/precedent/reranker.ts` |
| Two-stage wiring (pool, fallback, final ranking) | `srv/src/domain/eightd/precedent/findPrecedents.ts` (`scoreWithProfile`) |
| Stage-1 placeholder row + ceiling rule | `srv/src/domain/eightd/precedent/scoring.ts` (`scoreCase`) |
| SQL pre-filter awareness | `srv/src/domain/eightd/precedent/precedentRepository.ts` (`nonFilterableReach`) |
| Profile seeding (idempotent) | `srv/src/domain/eightd/precedent/profileRepository.ts` (`seedRetrievalProfiles`) + `defaults.ts` (`RERANK_PROFILE_SPECS`) |
| Token budget | `srv/src/domain/eightd/schemas.ts` (`BUDGET.rerank`) |
| Admin UI (criterion card, instruction editor) | `app/cnma_proresolve_ui/src/pages/object-schema/ProfileConfigPanel.tsx` |
| Preview disclosure | `app/cnma_proresolve_ui/src/pages/object-schema/StepScorePanel.tsx` |
| Unit tests | `srv/src/domain/eightd/precedent/__tests__/reranker.test.ts` |
