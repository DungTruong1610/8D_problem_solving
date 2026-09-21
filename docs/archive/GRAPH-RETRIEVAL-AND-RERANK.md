# Graph Retrieval, Re-ranking and Chain-of-Thought — What Was Built and How to Test It

**Date:** 2026-09-03
**Branch:** `feat/graph-retrieval` (cut from `dev/Thien`, includes `feature/re-rank` by cherry-pick)
**Status:** implemented · **off by default** — this branch changes no behaviour until someone sets a config value
**Vietnamese:** `docs/GRAPH-RETRIEVAL-AND-RERANK.vi.md` (same content; edit both when you edit one)
**Related:** `docs/RERANK-PRECEDENT-RETRIEVAL.md` (Thanh, stage 2 for the scoring engine) · `docs/PRECEDENT-RETRIEVAL-REVIEW.md` (findings R2/R3/R4) · `docs/superpowers/specs/2026-09-03-graph-retrieval-design.md` (design + amendments)

**Audience:** anyone working on precedent retrieval, or reviewing this branch.

---

## 0. One-paragraph summary

Precedent retrieval now has **two ways to find** and **one way to read**. Stage 1 is either the
existing similarity scoring or a new graph traversal over SAP HANA Graph, chosen by a single
global switch. Stage 2 — an LLM that reads the open case and each candidate *together* — is
shared by both, and now reasons before it scores. Everything converges on the unchanged
`PerStepPrecedents` contract, so switching back costs a config value, not a revert.

---

## 1. Why any of this exists

Every discipline asks the scoring engine the same question — *"which closed case looks like this
one"* — and all eight steps are bound to the same `default` profile. A shadow run over
`8D-10048412` returns the **identical list for D1 through D8**. But D1 needs to know *who has
handled this kind of defect* and D4 needs to know *how this part fails*; those rank the library
in different orders.

Two measured defects from `PRECEDENT-RETRIEVAL-REVIEW.md` reproduce on the live dataset:

- **R3(a)** — `MIN_SHARED_KEYWORDS = 1`, so *"Flange edge burr above limit"* matched *"Chatter
  marks … on milled flange"* on the single word `flange` and earned the same points as a genuine
  match.
- **R3(b)** — `defectKeywords` was built only from `defectText`, the catalogue wording. The
  operator's own words in `symptomShortText` were never compared, so case `8D-10048880`
  (*"Bracket housing pocket depth varying unit to unit"*) scored **+0** against a case describing
  *"pocket depth reading shallow"*.

---

## 2. GraphDB

### 2.1 What it is

A property graph over **SAP HANA Cloud Graph**, queried with openCypher through
`OPENCYPHER_TABLE`. **14 vertex kinds, 18 edge kinds — all of them SQL views over tables that
already exist.** `HistoricalCases` remains the single source of truth; there is no second copy of
the data and nothing to keep in sync. Cypher returns keys; SQL joins them back for the payload.

| Vertices | Edges |
|---|---|
| `Case8D`, `OpenDefect`, `WorkCenter`, `DefectCode`, `Material`, `MaterialFamily`, `Keyword`, `Person`, `JobFunction`, `Action`, `TaskCode`, `RootCause`, `Fmea`, `InspectionLot` | `OCCURRED_AT`, `HAS_DEFECT`, `ON_MATERIAL`, `IN_FAMILY`, `MENTIONS`, `STAFFED_BY`, `ACTS_AS`, `RESOLVED_BY`, `CODED_AS`, `CAUSED_BY`, `REFERENCES_FMEA`, `COVERS_WORKCENTER`, `COVERS_MATERIAL`, `LOT_OF_MATERIAL`, `LOT_AT`, `DEFECT_AT`, `DEFECT_ON_MATERIAL`, `DEFECT_HAS_CODE` |

The label is `Case8D`, not `Case`: **`CASE` is a reserved word in openCypher** and
`MATCH (c:Case)` does not parse. HANA's error (*"expecting identifier near Case"*) never says why.
`Function` became `JobFunction` pre-emptively. A unit test checks every label against the reserved
list.

### 2.2 The two vertex kinds that do the work

**`Keyword` as a vertex** turns overlap from a boolean into `COUNT(DISTINCT)`. Anchored on
`8D-10048412` the graph ranks `8D-10049030` first with **3** shared tokens (`burr, edge, limit`)
and drops `8D-10049010` — the documented false positive, which shares only `flange` — down among
the ones. The old engine pays both the same. That closes R3(a).

Tokens come from a new column `HistoricalCases.searchKeywords`, computed at seed time by the
**same** `tokenizeDefectText` used at query time, over `defectText` **and** `symptomShortText`.
Tokenising inside the view would have been a second implementation of that function — lowercasing,
stopwords, minimum length — and the two would drift silently the first time anyone added a
stopword. That closes R3(b).

**`OpenDefect` + `InspectionLot`** give D2 the Is-Not side: *same material, same characteristic,
inspected at a different work centre, conforming* is a pattern, not an anti-join.

### 2.3 What the dialect forced

Measured on the bound instance, 2026-09-03:

| Works | Does not work |
|---|---|
| labels `MATCH (c:Case8D)` | **every aggregate** — `count`, `collect`, `count(DISTINCT)` |
| **named** relationships `-[e:TYPE]->` | anonymous `-[:TYPE]->` |
| comma-separated patterns (the V-shape) | reverse arrow `<-[e]-`, chained `(a)-[e1]->(b)-[e2]->(c)` |
| variable-length paths `p = (a)-[*1..3]-(b)` | `WITH`, `OPTIONAL MATCH`, multiple `MATCH` clauses |
| `WHERE`, `AND`/`OR`, `IN [literals]`, `<>` | `IN [$a, $b]` with **bind parameters** |
| `RETURN DISTINCT`, `ORDER BY`, `LIMIT` | `SKIP`, `IS NOT NULL`, `NOT (pattern)` |
| `PARAMETERS ('x' = ?)` — real bind parameters | |

So **Cypher matches patterns and SQL aggregates**. Every V-shape is a comma pattern; every count
is a `GROUP BY` wrapped around the call. This is how `OPENCYPHER_TABLE` is meant to be used — it
returns a table for SQL to consume.

Because `IN [$a, $b]` is rejected with bind parameters, keyword lists are an `OR` chain of
`= $kwN` (`anchor.ts`). Uglier, and completely safe: interpolating tokens would be the only path
in the module where SAP payload data reaches query text.

**Stated plainly:** under this dialect Cypher does not replace SQL, it adds to it. What SQL here
cannot do at all is the variable-length path, because HANA Cloud has no recursive CTE. That, plus
one declared place where the relationships live instead of them being spread across join
conditions, is what the graph buys.

### 2.4 What the data forced

`defectCodeGroup` is **null on all 25 library cases** (and a single constant `DEF-GENERIC` on the
25 open defects), and every case carries a **distinct** defect code — 25 codes for 25 cases. An
`IN_GROUP` hop would match nothing and `HAS_DEFECT` almost never joins two cases.

So `DefectGroup` is **not** in the graph, and no query connects cases through defect codes. The
real discriminators in this dataset are **Keyword, MaterialFamily** (MG-HOUSING covers 9 of 25),
**WorkCenter** (21 distinct) and **RootCause** (6).

Defect-code vertices key on the code alone, correct while one code space exists. **This must
become composite when CHAIN-ALIGNMENT Phase 1.3 populates groups** — an SAP defect code is only
unique within its group.

### 2.5 Where it is applied

All eight steps, when `engine = 'graph'` — never a subset. See §5.

Each step gets its own weights, so each asks its own question:

| Step | Question | Weighted evidence |
|---|---|---|
| D1 | Who has handled this at this work centre? | `workCenter 4`, `materialFamily 3`, `material 2`, `keywords 1` |
| D2 | Where does this defect appear? | `defectCode 4`, `material 3`, `workCenter 2`, `keywords 2` |
| D3 | How was this contained last time? | `keywords 2`, `materialFamily 2`, `workCenter 2`, `containment 2` |
| **D4** | How does this part fail? | `keywords 3` (cap 4), `materialFamily 1`, `workCenter 1`, minScore 5 |
| D5 | Which fix removed that cause? | `keywords 2`, `materialFamily 2`, `corrective 3` |
| D6 | What proves it is gone? | `keywords 2`, `materialFamily 1`, `corrective 3` |
| D7 | Where else is this risk? | `materialFamily 4`, `material 2`, `preventive 3`, `keywords 1` — **no** `workCenter` |
| D8 | Which comparable case closed cleanly? | `workCenter 2`, `materialFamily 2`, `keywords 1` |

D7 omitting `workCenter` is deliberate: prevention extends *outside* the station that failed, so
rewarding a shared station works against the step.

**D4's weights came from a shadow run, not judgement.** At the designed 2/2/1/1 the case sharing
three keywords tied **6–6** with the case sharing only `flange` but matching work centre and
material — R3 returning through the side door at the step that cares most about mechanism.
Keywords now weigh 3 against a threshold of 5: three shared tokens score 9, one shared token plus
location scores 5. Both still surface, in the right order.

---

## 3. Re-ranking

Stage 2 is **Thanh's** (`feature/re-rank`, cherry-picked into this branch so there is exactly one
implementation). His design doc is `docs/RERANK-PRECEDENT-RETRIEVAL.md`; it is not restated here.

### 3.1 Why one reranker serves both engines

The two engines differ in how they **find**, not in how they read two texts and judge a shared
failure mechanism. A second reranker for the graph engine would have meant two prompts, two output
normalisers and two places to fix when the model changes — with nobody able to say which was
running. So stage 1 differs and stage 2 is shared.

### 3.2 Where it attaches

| Engine | Function | How the result attaches |
|---|---|---|
| scoring | `applyRerank` | Fills a placeholder `none` breakdown row that `scoreCase` left for it |
| graph | `applyRerankToScored` | **Adds** an evidence entry — graph does not know in advance which cases enter the pool, so there is nothing to reserve |

Both use the same formula — `points = weight × (score / 100)`, rounded to one decimal, with a
floor — so a shadow run compares like with like.

### 3.3 Pool admission

Both engines admit candidates by **reachability, not the real floor**: a case whose stage-1 score
plus the re-rank weight can still reach `minScore` enters the pool. Filtering by `minScore` first
would drop exactly the cases stage 2 exists to rescue. The real threshold is applied to the
**final** score.

This is why `scoreEvidence` was split into `accumulateEvidence` (sum and sort, no cut) and
`finalizeScores` (threshold and top-N) — re-rank sits between them.

### 3.4 Where it is applied

**D4 and D5 only**, on both engines, and **off by default**.

- Scoring engine: profiles `diagnosis` (D4) and `corrective` (D5), criterion `matchType = 'rerank'`, disabled.
- Graph engine: `GraphStepParams.wRerank` null for every step; D4 and D5 ship with `rerankFloor`
  and `rerankInstruction` seeded, so enabling it is **one number**.

D1 ranks people by counts, not text relevance. D3's relevance is structural. D6/D8 draw little
from retrieval at all.

---

## 4. Chain-of-thought

### 4.1 One frame per discipline

The schema used to hardcode D4's question - `queryAnalysis` read *"state what failure MECHANISM
the OPEN CASE shows"*. Enabling re-rank for D1 would have told the model to reason about failure
physics while D1 asks about people. It would have answered fluently and answered the wrong
question, and nothing in the output would show it: valid schema, a score, a plausible reason.

**Procedure and subject are separated.** `SYSTEM_PROMPT` carries only what is true for every step
- reason first, score after, never invent an id. The subject comes from a `RerankFrame` the step
owns:

| Part | What it does |
|---|---|
| `queryFrame` | What to establish about the **open case** before looking at any candidate. This is the reference every score is measured against - and it is what genuinely differs between steps. |
| `candidateFrame` | Which dimension to compare along. |
| `rubric` | What 0 and 100 mean **here**. Without it the model invents a scale, and the scale moves between calls. |

All eight steps carry a frame, even though weights stay 0. The frame has to be correct *before*
anyone enables a step, or what they measure is not what they think they are measuring.

| Step | What `queryFrame` establishes |
|---|---|
| D1 | Which capabilities the problem demands - equipment, measurement, process step, sign-off. Names no people. |
| D2 | The boundary: which part, station and characteristic is out of spec, and by how much. |
| D3 | What is exposed right now and must be protected - in transit, in stock, already shipped. |
| D4 | The physical failure mechanism: what moved, wore, deformed or drifted. |
| D5 | The root cause reached, and what would have to physically change for it to stop. |
| D6 | What would count as proof it is gone: which characteristic, measured how, over what population. |
| D7 | How far the risk reaches: which family, which processes, which FMEA entry. |
| D8 | What complete closure looks like, and what typically stays open. |

`RERANK-PRECEDENT-RETRIEVAL.md` argues D1/D3/D6/D8 do not pay - ranking people is counting, not
text relevance - and that argument still holds. That is why every weight is 0.

**Measured on the real model.** Same open case, same candidate (`8D-10048788`, chatter marks from
a worn spindle bearing), three frames:

| Frame | Score | The model's own reasoning |
|---|---|---|
| D4 mechanism | **10/100** | *"forced vibration from a failing machine component ... fundamentally different from the query's mechanism"* |
| D7 systemic reach | **100/100** | *"both are equipment degradation over time ... where the existing monitoring was insufficient"* |
| D1 capability | **20/100** | *"cylindrical grinding, not milling ... the required capabilities differ"* |

A 10x swing on one pair, and each verdict is right for its own question. Under the shared frame
all three would have scored like D4, and D7 would have discarded the case its step needs most.

A test pins that **no two steps share a frame** and that each frame mentions its own subject - the
failure this fixes is invisible in the output, so it has to be caught in the test.

### 4.2 What changed

The re-rank schema now asks for reasoning **before** the number:

```
queryAnalysis   FIRST: state what failure mechanism the OPEN CASE shows, from its
                evidence alone. Do not mention any candidate here. This is the
                reference every score is measured against.

rankings[]
  notificationId
  analysis      Reason BEFORE scoring: what mechanism this candidate shows, and where
                it agrees or differs from queryAnalysis. Name the evidence. Then the
                score must follow it.
  score         0-100
  reason        One short sentence summarising the analysis, for the audit trail.
```

Both `queryAnalysis` and `analysis` are `required`.

The system prompt makes the order explicit:

```
Work in this order, and do not shortcut it:
1. queryAnalysis — read the open case ALONE and state the mechanism it shows. Mention no candidate.
2. For each candidate, write analysis FIRST: what mechanism it shows, and where it agrees or
   differs from queryAnalysis. Then let the score follow from what you just wrote.

A score that does not follow from its own analysis is the failure this stage exists to prevent.
```

### 4.3 Why field order *is* the mechanism

Models generate in field order. `analysis` before `score` means the number lands after the
reasoning is already in context. Reverse them and the analysis is a justification written after
the fact — **and the two look identical in the output**, which is why a unit test pins the order
rather than trusting review.

### 4.4 Why output fields and not extended thinking

A valid `thinkingBudget` (≥ 1024) makes the CDK attach `thinking_budget`, after which
`applyVendorCompat` strips `temperature` — Anthropic forbids temperature alongside extended
thinking. Losing `temperature: 0` costs exactly the determinism a ranking stage needs.

Reasoning in output fields keeps both: the model still thinks in words, at temperature 0. The
existing guard `effectiveThinkingBudget` drops the sub-threshold budget of 256 for Claude models,
so `temperature` survives; on Gemini the budget is meaningful and temperature is untouched. The
test asserts this conditionally rather than unconditionally — an earlier version asserted the
budget was always stripped and went red against the running configuration.

### 4.5 Cost, measured

| | |
|---|---|
| One re-rank call, 10 candidates, with CoT | **23.9 s** |
| Previous timeout (set before CoT existed) | 20 s — **never returned in time** |
| Current timeout | **45 s**, override with `RERANK_TIMEOUT_MS` |

The old timeout failed in the quietest way available: stage-1 ranking stood, results looked fine,
stage 2 never ran. Re-measure after any model or prompt change.

### 4.6 Observed on the real model

```
Re-rank: 10/10 candidates scored in 23514ms
queryAnalysis: "The open case describes a failure mechanism where a cutting tool, used beyond
its designated service life, becomes worn. This wear degrades its cutting geometry, causing it
to plastically deform the w…"                                    (log truncates at 200 chars)

D4   8D-10049030:  9 → 12.8
     8D-10049010:  5 →  7.6      ← the documented false positive is not lifted past it
D5   17.3 s, 10/10 scored, no points added — every verdict below the 0.5 floor
```

D5 adding nothing is the contract working: the model found no corrective action that would remove
this root cause, and below the floor nothing is added.

**Not yet eyeballed:** the per-candidate `analysis` from a live call. It is `required` in the
schema and covered by a fake-provider test, but the log only prints `queryAnalysis`. Print it with
a short script when `cf` is logged in.

---

## 5. The engine switch is global, never per-step

`mergeStepPrecedents` folds all eight per-step results into **one list numbered once**, keeping
the highest-scoring version of each case:

```ts
if (!seen || p.score > seen.score) best.set(p.notificationId, p);
```

Under a mixed configuration that `>` compares a graph score (weighted evidence count, no fixed
ceiling) against a scoring score (0–16). `precedents#1` stops being the strongest case, and
**nothing catches it**: `postProcess` validates citations against `^(team\.|precedents#)`, which a
wrong-but-well-formed citation satisfies.

So `GraphRetrievalSettings` has no `stepCode` column. Comparison between engines happens in
`scripts/shadow-retrieval.mjs`, outside the report path, where it cannot leak into user output.

---

## 6. Where everything lives

### 6.1 New files

| Path | Role |
|---|---|
| `srv/src/domain/eightd/graph/model.ts` | Labels, edge types, workspace name — one source for views, Cypher and tests |
| `srv/src/domain/eightd/graph/anchor.ts` | `CaseContext` → anchor values + tokens; the `OR`-chain keyword predicate |
| `srv/src/domain/eightd/graph/graphClient.ts` | Builds `OPENCYPHER_TABLE`, binds parameters, checks the workspace is valid |
| `srv/src/domain/eightd/graph/probes.ts` | One function per kind of evidence; Cypher matches, SQL counts |
| `srv/src/domain/eightd/graph/stepProfiles.ts` | Eight weight sets, pure scoring, `normalizeStepParams`, `applyRerankToScored` |
| `srv/src/domain/eightd/graph/hydrate.ts` | Keys from Cypher + payload from relational tables → `Precedent` |
| `srv/src/domain/eightd/graph/settings.ts` | Engine switch, `GraphStepParams` read/seed, caches |
| `srv/src/domain/eightd/graph/engine.ts` | Picks the engine, collects evidence once, scores it eight ways, runs stage 2 |
| `db/schema/graph-config.cds` | `GraphRetrievalSettings`, `GraphStepParams` |
| `db/src/*.hdbview` (32) + `GW_8D.hdbgraphworkspace` | The graph itself — views, not new data tables |
| `db/src/.hdiconfig`, `.hdinamespace` | Required: CAP's generated `.hdiconfig` sits in `db/src/gen` and maps no plugin for `hdbgraphworkspace` |
| `scripts/seed-graph-library.mjs` | Loads the 25 case JSONs into the graph container |
| `scripts/shadow-retrieval.mjs` | Runs one case through **both** engines and prints a per-step diff |
| `scripts/run-graph-tests.mjs` | Runs the HANA-touching test suite with the right env |

### 6.2 Changed files

| Path | Change |
|---|---|
| `db/schema/case-library.cds` | New column `searchKeywords` |
| `srv/src/domain/eightd/precedent/librarySeeder.ts` | Writes `searchKeywords`; treats a row without it as incomplete so old rows backfill |
| `srv/src/domain/eightd/precedent/reranker.ts` | Chain-of-thought schema and prompt; `analysis` on the verdict; timeout 20 s → 45 s |
| `srv/src/domain/eightd/eightDAnalyzer.ts` | Two call sites: `findPrecedentsByStep` → `findPrecedents` (the dispatcher) |
| `srv/AiAdminService.cds` | Exposes `GraphRetrievalSettings` and `GraphStepParams` |
| `srv/src/services/aiAdminService.ts` | Warns when a saved config the running engine ignores |
| `srv/server.ts` | Seeds `GraphStepParams` at startup |

**The `PerStepPrecedents` / `Precedent` contract does not change.** `eightDAnalyzer`, `prompts`,
`postProcess`, `buildRuntimeSources` and the UI all read that shape, so reverting to the old
engine is a configuration change, not a revert.

---

## 7. Configuration

| Table | Applies when | Editable at runtime | Constraint |
|---|---|---|---|
| `GraphRetrievalSettings` | always | yes | one row, `ID = 'GLOBAL'` |
| `GraphStepParams` | `engine = 'graph'` | yes | `wKeywords` **and** `wRerank` must be `< minScore` |
| `ProfileCriteria`, `RetrievalProfiles`, `StepRetrievalBindings` | `engine = 'scoring'` | yes | rerank criterion per profile |
| Cypher queries | — | **no** — in code | versioned, tested, no free-form Cypher from the database |

### 7.1 The invariant

`normalizeStepParams` **rejects the whole row** when `wKeywords >= minScore` or
`wRerank >= minScore`, logs why, and uses the defaults.

- `wKeywords >= minScore` means one shared keyword qualifies a precedent alone — R3 returning
  through the config path.
- `wRerank >= minScore` means the model alone decides, even for a case sharing no relationship in
  the graph — discarding the reason graph was chosen: every hit having a path.

Rejecting the row beats clamping the value: clamping shows one number on screen while the system
runs another.

### 7.2 Turning things on

```sql
-- graph engine, all eight steps
UPDATE GraphRetrievalSettings SET engine = 'graph' WHERE ID = 'GLOBAL';

-- stage 2 for D4 (minScore 5, so wRerank must be ≤ 4)
UPDATE GraphStepParams SET wRerank = 4 WHERE stepCode = 'D4';
```

Both take effect within the 30-second config cache. Saving a config the running engine ignores
returns a message naming the table that does apply — symmetric in both directions, via `req.info`
rather than `req.reject`, because the configuration is valid and may be staged ahead of a switch.

---

## 8. How to test

### 8.1 Offline — no credentials, no network

```bash
npm run typecheck
npm test
```

**Expected: 1126 passed, 22 skipped, 0 failed** across 41 suites. The 22 skipped are the
HANA-touching tests; they report as *skipped*, never as passed, because the gate is a static
`describe.skip` on `GRAPH_INTEGRATION`. Auto-detecting and quietly moving on would produce a green
suite that ran nothing — worse than no test, because it looks like coverage.

What the offline tests cover:

| Area | Pins down |
|---|---|
| `graphClient.test.ts` | Values go into bind slots, never into query text; no label collides with an openCypher reserved word |
| `stepProfiles.test.ts` | Weighted scoring; **one shared keyword never qualifies alone** in any step; determinism on ties; `accumulate`/`finalize` split; rerank config normalisation and both rejection rules |
| `settings.test.ts` | Engine switch normalisation; unknown values fall back to `scoring` |
| `rerankWiring.test.ts` | The full stage-2 chain against a fake provider: prompt content, **schema field order**, temperature 0, parsing of `analysis`, invented IDs dropped, and the two-stage rescue end to end |
| `precedent/reranker.test.ts` | Thanh's normalisation and `applyRerank`, plus CoT parsing |

### 8.2 Against real HANA

Prerequisites — the container is separate from the shared one, so nothing here touches
`cnma_proresolve_db`:

```bash
npm run cf:cpea && npm run cf:sandbox   # log in, target the sandbox
npm run deploy:graph                    # views + workspace + config tables
npm run seed:graph                       # 25 historical cases
npm run test:graph                       # 79 passed
```

`deploy:graph` pins `--for graph`. Without it `cds deploy` writes its post-deploy binding into
**`hybrid`** by default and silently repoints the team's profile at this container — which is
exactly what happened on the first run here.

What the integration tests cover:

- the workspace deploys and is valid; the library holds 25 cases
- **dialect constraints that are not standard Cypher**: relationships must be named, and a V-shape
  must be comma-separated because reverse arrows do not parse
- `[*1..2]` paths — the one capability SQL cannot replace here
- a hostile value through `PARAMETERS` returns nothing, so it stayed data
- the `OR` chain for keywords, which exists only because `IN [$a,$b]` is rejected
- **R3(a)**: `8D-10049030` shares three tokens where `8D-10049010` shares one
- **R3(b)**: `"pocket depth"` retrieves `8D-10048880` — the case scored **+0** today
- D1 counts cases per person (`100001`, Quality Engineer, 3 at `WC-MILL-07`)
- D5 reaches corrective task codes through `RootCause` (`TSK-3010`, 4 cases)
- the eight steps do **not** all return the same list
- config written to the database takes effect, and a violating row is rejected

### 8.3 Against the real model

`npm run test:graph` **cannot** call the model: ts-jest runs CJS and the CDK provider loads ESM
dynamically, so the call dies with `Unexpected token 'export'` and the pipeline falls back. That
fallback is correct behaviour, so the integration test tolerates it — which means it proves
"enabling re-rank does not break the pipeline", not "the model call works".

The real call is exercised by the shadow script, which runs under tsx/ESM exactly like production:

```bash
npm run shadow:graph                            # all 25 cases, both engines
npm run shadow:graph -- 8D-10048412             # one case
npm run shadow:graph -- 8D-10048412 --rerank    # with stage 2 enabled for D4/D5
```

`--rerank` derives `wRerank` per step from that step's `minScore` and restores it afterwards. An
earlier version set a flat `wRerank = 4`, which D5 (`minScore 4`) rejected — it printed "re-rank
enabled" while D5 never ran it.

Expected output with `--rerank`:

```
[shadow] re-rank enabled: D5 wRerank=3, D4 wRerank=4
[precedent-rerank] Re-rank: 10/10 candidates scored in ~24000ms · queryAnalysis: …
    D4   8D-10049030:12.8  8D-10049010:7.6      | scoring: 8D-10049010:9 …
```

### 8.4 Reading a shadow run

Full run, 25 cases × 8 steps = 200 cells:

| | |
|---|---|
| both engines found it | 98 |
| graph only | 372 |
| scoring only | 78 |
| graph said "nothing" | 27 / 200 |
| scoring said "nothing" | 104 / 200 |

Read this carefully — **more results is not automatically better**; R4 is a warning about exactly
that. Two things are safe to conclude:

- Scoring returns the **identical list for all eight steps**, in every case block. That is the
  defect this work exists to fix.
- Graph is more permissive overall, but nothing surfaces without a named relationship crossing a
  threshold, and each hit carries the path that justified it. Where it matters it is also more
  willing to decline: on several cases graph returns nothing for D4 while scoring offers two cases
  at exactly the minimum score of 3.

The 372 figure still deserves tuning scrutiny against `topN` and `minScore`. It is not yet
evidence that the defaults are right.

---

## 9. Failure behaviour

| Failure | Behaviour | Cost |
|---|---|---|
| Graph workspace not deployed | falls back to scoring; log names which condition failed | no precedents lost |
| A graph query throws | falls back to scoring | no precedents lost |
| Re-rank times out or fails to parse | stage-1 ranking stands | stage 2 lost, stage 1 kept |
| A verdict is below the floor | no points, no evidence entry | nothing — the contract working |
| Config violates an invariant | whole row rejected, defaults used, reason logged | nothing, and not silently |
| Both engines fail | report is written with no precedents, and says why | no invented precedents |

"No precedent found" and "the engine did not run" look identical from outside. Telling them apart
is what the logs are for.

---

## 10. A harness bug worth knowing about

`cds.connect.to('db')` **does not load the CDS model**. A real server always has one because
`cds.serve` loads it; a jest process or a plain script does not. Raw SQL keeps working, so most
things stay green — but CQN loses name mapping, and `UPDATE(...).set({ topN: 1 })` **silently
writes nothing**.

It bit twice here: every config test would have read back the default and passed, proving
something untrue (and it had already corrupted a seeded row); and the shadow script's `--rerank`
flag printed "enabled" while writing nothing.

Any script or test that uses CQN must load the model first:

```ts
if (!cds.model) {
    cds.model = cds.linked(cds.compile.for.nodejs(await cds.load(cds.resolve('*'))));
}
```

---

## 11. Still open

- Embedding is **not** wired as a booster on the graph engine; `semanticUsed` reports `false`
  rather than claiming otherwise. Under `engine = 'graph'` vector search runs for **no** step.
- D2's Is/Is-Not and D6's non-recurrence traversals are verified as queries but are not yet
  consumed by those steps — both produce data outside the `Precedent` contract.
- `prompts.ts:137-139` still hardcodes the old scoring formula (finding R2).
- `mta.yaml` still declares one HDI container; the graph container is added only when this branch
  is deployed to CF, as a second resource beside the existing one.
- A UI banner on the Similarity screen would beat the current post-save message. The backend
  already exposes what the screen needs to render one.
- The per-candidate `analysis` has not been read from a live model call (see §4.6).
