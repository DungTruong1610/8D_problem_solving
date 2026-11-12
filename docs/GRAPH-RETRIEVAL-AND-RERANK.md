# Graph Retrieval, Re-ranking, and Chain-of-Thought - Architecture and Validation

> **Competition context:** [AI4Biz 2026 - LIKELION Vietnam](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21), team UIT_4Lovpe. Competition requirements and submission limits are maintained in that reference; technical examples below are not measured business outcomes unless explicitly documented.

**Configuration:** Implemented and **disabled by default**. Graph retrieval does not change behavior until the global configuration selects it.
**Related:** `docs/RERANK-PRECEDENT-RETRIEVAL.md` (Thanh's stage-2 scoring-engine design). The retrieval findings referred to as R2, R3, and R4 are explained directly below.
**Audience:** Engineers implementing or reviewing precedent retrieval.
**Evidence scope:** The live database, model, and shadow-run measurements below were recorded on 2026-09-03. They are historical observations, not a new validation run or a guarantee for another deployment.

## 0. Overview

Precedent retrieval has **two ways to find candidates** and **one shared way to assess them**. Stage 1 uses either the existing scoring engine or graph traversal in the database, selected by a single global switch. Stage 2 makes one model call to read the open case **together with** each candidate and produce an analysis **before** assigning scores. Both engines return the unchanged `PerStepPrecedents` contract, so switching back to the scoring engine requires one configuration change rather than a code revert.

## 1. Motivation

The original scoring configuration asked every D step the same question: *"Which closed cases look like this case?"* All eight steps pointed to the `default` profile. A shadow run for `8D-10048412` returned **identical lists from D1 through D8**. D1 needs to know *who has handled this type of defect*, while D4 needs to know *which physical mechanism caused the part to fail*. Those questions require different rankings of the library.

Two measured retrieval defects were reproduced against the actual dataset:

- **R3(a):** With `MIN_SHARED_KEYWORDS = 1`, *"Flange edge burr above limit"* matched *"Chatter marks ... on milled flange"* through the single word `flange`, earning the same keyword points as a relevant case.
- **R3(b):** `defectKeywords` tokenized only `defectText`, the defect-code **catalogue** text. The operator's wording in `symptomShortText` was never compared. As a result, `8D-10048880` (*"Bracket housing pocket depth varying unit to unit"*) earned **+0** against a case describing *"pocket depth reading shallow"*.

## 2. GraphDB

### 2.1. Structure

The implementation is a property graph on the **Database Graph Engine**, queried with openCypher through `OPENCYPHER_TABLE`. Its **14 vertex types and 18 edge types are all SQL views over existing tables**. `HistoricalCases` remains the single source of truth for historical cases; there is no duplicate dataset to synchronize. Cypher returns **keys**, and SQL joins those keys back to the relational content.

| Vertices | Edges |
| - | - |
| `Case8D`, `OpenDefect`, `WorkCenter`, `DefectCode`, `Material`, `MaterialFamily`, `Keyword`, `Person`, `JobFunction`, `Action`, `TaskCode`, `RootCause`, `Fmea`, `InspectionLot` | `OCCURRED_AT`, `HAS_DEFECT`, `ON_MATERIAL`, `IN_FAMILY`, `MENTIONS`, `STAFFED_BY`, `ACTS_AS`, `RESOLVED_BY`, `CODED_AS`, `CAUSED_BY`, `REFERENCES_FMEA`, `COVERS_WORKCENTER`, `COVERS_MATERIAL`, `LOT_OF_MATERIAL`, `LOT_AT`, `DEFECT_AT`, `DEFECT_ON_MATERIAL`, `DEFECT_HAS_CODE` |

The label is `Case8D`, not `Case`: **`CASE` is an openCypher keyword**, so `MATCH (c:Case)` fails to parse. The engine's error, *"expecting identifier near Case"*, does not identify the keyword conflict. `Function` was also renamed to `JobFunction` as a precaution. A unit test checks every label against the reserved-keyword list.

### 2.2. Vertices that change retrieval behavior

Because **`Keyword` is a vertex**, keyword overlap becomes `COUNT(DISTINCT)` rather than a yes/no match. Anchored on `8D-10048412`, the measured graph query ranked `8D-10049030` first with **3** shared words (`burr, edge, limit`), while `8D-10049010`, the documented false positive sharing only `flange`, fell into the one-word group. The old engine gave both the same keyword score. This addresses R3(a).

Tokens come from `HistoricalCases.searchKeywords`, populated during library ingestion by the **same** `tokenizeDefectText` function used at query time, over **both** `defectText` and `symptomShortText`. Tokenizing inside a view would duplicate lowercasing, stopword removal, and length filtering. The two implementations could silently diverge as soon as a stopword was added to only one of them. Sharing the tokenizer addresses R3(b).

**`OpenDefect` and `InspectionLot`** provide D2's Is-Not comparison: *same material, same characteristic, inspected at a different station, and passed* becomes a graph **pattern** rather than a complicated anti-join.

### 2.3. Database dialect constraints

The following behavior was measured directly on the bound database instance on 2026-09-03:

| Supported | Unsupported |
| - | - |
| Labels such as `MATCH (c:Case8D)` | **All aggregate functions:** `count`, `collect`, `count(DISTINCT)` |
| **Named** relationships: `-[e:TYPE]->` | Anonymous relationships: `-[:TYPE]->` |
| Comma-separated patterns forming a V shape | Reverse arrows `<-[e]-`; chains `(a)-[e1]->(b)-[e2]->(c)` |
| Variable-length paths: `p = (a)-[*1..3]-(b)` | `WITH`, `OPTIONAL MATCH`, multiple `MATCH` clauses |
| `WHERE`, `AND`/`OR`, `IN [literal]`, `<>` | `IN [$a, $b]` with **bound parameters** |
| `RETURN DISTINCT`, `ORDER BY`, `LIMIT` | `SKIP`, `IS NOT NULL`, `NOT (pattern)` |
| `PARAMETERS ('x' = ?)` for actual parameter binding | |

The division of work is **Cypher for pattern matching, SQL for aggregation**. V-shaped relationships use comma-separated patterns, and every count is computed by the enclosing SQL query. This fits `OPENCYPHER_TABLE`, which returns a table for further SQL processing.

Because `IN [$a, $b]` rejects bound placeholders, the keyword list is expressed as an `OR` chain of `= $kwN` comparisons in `anchor.ts`. The result is less compact but preserves parameter binding. Interpolating raw tokens into the query text instead would create a path from input payload data into executable query text.

**Tradeoff:** With this dialect, Cypher **complements SQL**. Its distinctive capability here is variable-length traversal, because the database does not support recursive CTEs. The graph also centralizes explicit relationship definitions instead of scattering them across SQL joins.

### 2.4. Dataset constraints

In the measured dataset, `defectCodeGroup` was **null in all 25 historical cases** and had the single constant value `DEF-GENERIC` across 25 open defects. Every historical case had a **different** defect code: 25 codes for 25 cases. An `IN_GROUP` hop would match nothing, and `HAS_DEFECT` would connect almost no pair of cases.

Consequently, `DefectGroup` is **not** part of this graph, and no query links cases through a shared defect code. The useful discriminating signals in this dataset are **Keyword**, **MaterialFamily** (`MG-HOUSING` covers 9/25 cases), **WorkCenter** (21 distinct values), and **RootCause** (6).

The defect-code vertex uses the code alone as its key, which is valid only within one code namespace. **If code groups are ingested, this must become a composite key**, because a defect code is unique only **within** its group.

### 2.5. Step-specific application

The graph engine applies to **all eight steps** when `engine = 'graph'`, never a subset. See section 5.

Each step has its own weights and therefore asks its own retrieval question:

| Step | Question | Evidence weights |
| - | - | - |
| D1 | Who has handled this type of defect at this station? | `workCenter 4`, `materialFamily 3`, `material 2`, `keywords 1` |
| D2 | Where does this defect occur? | `defectCode 4`, `material 3`, `workCenter 2`, `keywords 2` |
| D3 | How was it contained last time? | `keywords 2`, `materialFamily 2`, `workCenter 2`, `containment 2` |
| **D4** | What mechanism caused this part to fail? | `keywords 3` (count capped at 4), `materialFamily 1`, `workCenter 1`, threshold 5 |
| D5 | Which correction removes that cause? | `keywords 2`, `materialFamily 2`, `corrective 3` |
| D6 | What evidence demonstrates that the problem is resolved? | `keywords 2`, `materialFamily 1`, `corrective 3` |
| D7 | Where else does the same risk exist? | `materialFamily 4`, `material 2`, `preventive 3`, `keywords 1`; **no** `workCenter` weight |
| D8 | Which comparable case reached complete closure? | `workCenter 2`, `materialFamily 2`, `keywords 1` |

D7 deliberately omits `workCenter`: prevention extends **beyond** the station that failed, so rewarding the same station would work against the purpose of the step.

**The documented D4 weights came from a live shadow run.** Under the initial 2/2/1/1 weights, a case sharing three keywords **tied 6-6** with a case sharing only `flange` but matching both the station and material. That recreated R3 at the step most concerned with failure mechanisms. With keyword weight 3 and threshold 5, three shared words earn 9 points; one shared word plus the location matches earns 5. Both remain visible, in the intended order.

## 3. Re-ranking

The shared stage-2 design by **Thanh** is documented in `docs/RERANK-PRECEDENT-RETRIEVAL.md`.

### 3.1. Why both engines share one reranker

The engines differ in how they **find** candidates. Reading two texts and judging their relevance to a step does not require separate implementations. A graph-specific reranker would create two prompts, two output normalizers, and two places to change when model behavior changes. Stage 1 is engine-specific; stage 2 is shared.

### 3.2. Integration points

| Engine | Function | How the verdict is attached |
| - | - | - |
| Scoring | `applyRerank` | **Fills** the `none` breakdown row reserved by `scoreCase`. |
| Graph | `applyRerankToScored` | **Adds** an evidence item. The graph does not know in advance which candidates enter the pool, so it has no placeholder row. |

Both apply the same formula, `points = weight × (score / 100)`, rounded to one decimal place and subject to a floor. A shadow comparison therefore uses the same stage-2 scale on both sides.

### 3.3. Candidate-pool admission

Both engines admit candidates by **whether the threshold is reachable**: a case enters the pool if its stage-1 score plus the rerank weight can still reach `minScore`. Applying `minScore` before reranking would discard exactly the candidates stage 2 is intended to recover. The actual threshold applies to the **final** score.

This is why `scoreEvidence` is split into `accumulateEvidence` (sum and sort without filtering) and `finalizeScores` (apply the threshold and top-N). Re-ranking runs between those operations.

### 3.4. Enabled scope

The configured use cases are **D4 and D5** on both engines, **disabled by default**.

- Scoring engine: profiles `diagnosis` (D4) and `corrective` (D5) contain a disabled `matchType = 'rerank'` criterion.
- Graph engine: `GraphStepParams.wRerank` is null by default for every step. D4 and D5 have seeded `rerankFloor` and `rerankInstruction` values, so enabling a step requires setting **one numeric weight**.

D1 ranks **people** by participation counts rather than text relevance. D3's relevance is structural. D6 and D8 receive relatively little value from precedent retrieval.

## 4. Chain-of-Thought

### 4.1. A separate frame for each step

A schema that hardcodes D4's question in `queryAnalysis`, such as *"state what failure MECHANISM the OPEN CASE shows"*, would be wrong for D1. Enabling it for D1 would ask about failure physics when the step needs **people and capabilities**. The output could remain fluent, schema-valid, and plausibly scored while answering the wrong question.

**Separate procedure from subject matter.** `SYSTEM_PROMPT` contains only rules shared by every step: analyze first, score afterward, and never invent IDs. The subject matter comes from the step's **own** `RerankFrame`:

| Component | Purpose |
| - | - |
| `queryFrame` | Defines what to establish about the **open case** before reading any candidate. This is the reference against which all scores are measured and the main difference between steps. |
| `candidateFrame` | Defines the dimensions of comparison. |
| `rubric` | Defines what 0 and 100 mean **for this question**. Without it, the model could invent a different scale on every call. |

All eight steps have frames even when their rerank weights are zero. A frame must be correct **before** a step is enabled, or the evaluation will measure the wrong thing.

| Step | What `queryFrame` establishes |
| - | - |
| D1 | Required **capabilities**: equipment, disputed measurements, failed process stage, and functions that must sign off. Do not name individuals. |
| D2 | The problem's **boundaries**: part, station, out-of-spec characteristic, and magnitude of deviation. |
| D3 | What is **exposed to the defect** and must be contained: in transit, in stock, or already at the customer. |
| D4 | The physical **failure mechanism**: what moves, wears, deforms, or drifts. |
| D5 | The established **root cause** and the physical change needed to prevent recurrence. |
| D6 | What qualifies as **evidence of resolution**: characteristic, measurement method, and population. |
| D7 | The **reach of the risk**: affected material families, processes, and FMEA entries. |
| D8 | What **complete closure** requires and what is commonly left unresolved. |

`RERANK-PRECEDENT-RETRIEVAL.md` explains why D1/D3/D6/D8 are not configured for reranking. For example, ranking people by participation is a **counting** problem, not a text-relevance problem. Those steps retain zero rerank weight by default.

**Historical live-model observation:** The same open case and candidate (`8D-10048788`, chatter marks caused by a worn spindle bearing) produced different results under three frames:

| Frame | Score | Model explanation |
| - | - | - |
| D4 failure mechanism | **10/100** | *"forced vibration from a failing machine component ... fundamentally different from the query's mechanism"* |
| D7 systemic reach | **100/100** | *"both are equipment degradation over time ... where the existing monitoring was insufficient"* |
| D1 capabilities | **20/100** | *"cylindrical grinding, not milling ... the required capabilities differ"* |

This was a **10x** score difference for the same pair, with each judgment relevant to its own question. A single D4-style frame would have discarded the case that the prevention step needed.

Tests require **every step to have a distinct frame** and each frame to mention its own subject. Output shape alone cannot reveal a mismatched question.

### 4.2. Output contract

The rerank schema requires analysis **before** the numeric score. The descriptions are supplied by the step-specific frame:

```text
queryAnalysis   FIRST: establish what queryFrame asks about the OPEN CASE alone.
                Do not mention any candidate. This is the reference for every score.

rankings[]
  notificationId
  analysis      Reason BEFORE scoring according to candidateFrame.
                Compare the candidate with queryAnalysis and name the evidence.
  score         0-100, interpreted using the step-specific rubric
  reason        One short sentence summarising the analysis for the audit trail.
```

Both `queryAnalysis` and `analysis` are `required`.

The shared system prompt specifies the sequence:

```text
Work in this order, and do not shortcut it:
1. queryAnalysis - read the OPEN CASE alone and establish what the instruction asks you to
   establish. Mention no candidate. This is the reference everything else is measured against.
2. For each candidate, write analysis FIRST, then let the score follow from what you just wrote.

A score that does not follow from its own analysis is the failure this stage exists to prevent.
```

### 4.3. Why field order matters

The intended generation order puts `analysis` before `score`, so the explanation is already in context when the model emits the number. Reversing that order encourages a retrospective justification. Both arrangements can look identical when reading completed output, so a unit test locks down schema field order.

### 4.4. Output fields and extended thinking

In the documented provider configuration, a valid `thinkingBudget` of at least 1024 makes the CDK attach `thinking_budget`; `applyVendorCompat` then **removes `temperature`** because that Anthropic configuration does not allow temperature alongside extended thinking. This would remove the `temperature: 0` setting used to reduce ranking variability.

Analysis in output fields preserves that configuration: the model writes an explanation while retaining temperature 0. The existing `effectiveThinkingBudget` guard omits a sub-threshold budget of 256 for Claude, preserving `temperature`. For Gemini, the budget remains meaningful without removing temperature. Tests therefore check behavior **conditionally by model**. An unconditional assertion that the budget is always removed would fail under the documented Gemini configuration. Temperature 0 reduces variability; it is not an absolute reproducibility guarantee.

### 4.5. Measured latency and timeout

| Measurement or setting | Value |
| - | - |
| Historical rerank call with 10 candidates and analysis fields | **23.9 s** |
| Previous timeout, configured before analysis fields | 20 s, shorter than that observed call |
| Default timeout | **45 s**, overridable with `RERANK_TIMEOUT_MS` |

The old timeout failed quietly: stage-1 ranking remained plausible while stage 2 never returned in time. **Measure again whenever the model or prompt changes.**

### 4.6. Historical live-model observations

The following is a translated rendering of the recorded log, not a fresh run:

```text
Re-rank: 10/10 candidates scored in 23514ms
queryAnalysis: "The open case describes a failure mechanism where a cutting tool, used beyond
its designated service life, becomes worn. This wear degrades its cutting geometry, causing it
to plastically deform the w..."                         (log truncated at 200 characters)

D4   8D-10049030:  9 -> 12.8
     8D-10049010:  5 ->  7.6     (the false positive did NOT move above the relevant case)
D5   17.3 s, 10/10 scored, no points added: all judgments were below the 0.5 floor
```

D5 adding no points was **consistent with the contract**: the model did not identify a corrective action that sufficiently addressed this root cause, and below-floor judgments contribute nothing.

**Evidence limitation:** This observation did not inspect **each candidate's** `analysis` from a live model call. That field was required by the schema and covered with a mock provider, but the log printed only `queryAnalysis`. Inspect candidate-level analyses separately with an authenticated live-model script when validating them.

## 5. The engine switch is global

`mergeStepPrecedents` merges all eight steps into **one list numbered once**, keeping the highest-scoring occurrence:

```ts
if (!seen || p.score > seen.score) best.set(p.notificationId, p);
```

Mixing engines would make `>` compare graph scores, based on weighted evidence without a fixed ceiling, with the old engine's 0-16 scale. `precedents#1` would no longer reliably represent the strongest case. No downstream layer would detect this: `postProcess` checks citations against `^(team\.|precedents#)`, and a semantically incorrect citation can still match that syntax.

Consequently, `GraphRetrievalSettings` has **no `stepCode` column**. Engine comparisons belong in `scripts/shadow-retrieval.mjs`, **outside** report generation, where comparative results cannot leak into user output.

## 6. Source map

### 6.1. Graph components

| Path | Responsibility |
| - | - |
| `srv/src/domain/eightd/graph/model.ts` | Labels, edge types, and workspace name, shared by views, Cypher, and tests. |
| `srv/src/domain/eightd/graph/anchor.ts` | Converts `CaseContext` into anchor values and tokens; builds the keyword `OR` clause. |
| `srv/src/domain/eightd/graph/graphClient.ts` | Builds `OPENCYPHER_TABLE`, binds parameters, and checks workspace validity. |
| `srv/src/domain/eightd/graph/probes.ts` | One evidence type per function; Cypher matches patterns and SQL counts. |
| `srv/src/domain/eightd/graph/stepProfiles.ts` | Eight weight sets, pure scoring, `normalizeStepParams`, and `applyRerankToScored`. |
| `srv/src/domain/eightd/graph/hydrate.ts` | Combines Cypher keys with relational content into a `Precedent`. |
| `srv/src/domain/eightd/graph/settings.ts` | Engine switch, `GraphStepParams` reading/seeding, and caching. |
| `srv/src/domain/eightd/graph/engine.ts` | Selects the engine, collects evidence once, scores it eight ways, and runs stage 2. |
| `db/schema/graph-config.cds` | Defines `GraphRetrievalSettings` and `GraphStepParams`. |
| `db/src/*.hdbview` (32) and `GW_8D.hdbgraphworkspace` | The graph itself, implemented as **views**, not duplicate data tables. |
| `db/src/.hdiconfig`, `.hdinamespace` | Required because CAP-generated configuration under `db/src/gen` does not map an `hdbgraphworkspace` plugin. |
| `scripts/seed-graph-library.mjs` | Loads the 25 historical JSON cases into the graph container. |
| `scripts/shadow-retrieval.mjs` | Runs a case through **both** engines and prints a per-step comparison. |
| `scripts/run-graph-tests.mjs` | Runs database integration tests with the required environment variables. |

### 6.2. Integration components

| Path | Responsibility |
| - | - |
| `db/schema/case-library.cds` | Defines the `searchKeywords` column. |
| `srv/src/domain/eightd/precedent/librarySeeder.ts` | Writes `searchKeywords`; treats rows missing it as incomplete and eligible for reseeding. |
| `srv/src/domain/eightd/precedent/reranker.ts` | Analysis-first schema and prompt, candidate `analysis`, and the 45 s default timeout. |
| `srv/src/domain/eightd/eightDAnalyzer.ts` | Calls precedent retrieval through the engine selector. |
| `srv/AiAdminService.cds` | Exposes `GraphRetrievalSettings` and `GraphStepParams`. |
| `srv/src/services/aiAdminService.ts` | Warns when saving configuration that the active engine does not read. |
| `srv/server.ts` | Seeds `GraphStepParams` at startup. |

**The `PerStepPrecedents` and `Precedent` contracts remain unchanged.** `eightDAnalyzer`, `prompts`, `postProcess`, `buildRuntimeSources`, and the UI consume that shape, so returning to the scoring engine is a configuration change rather than a code revert.

## 7. Configuration

| Configuration | Effective when | Editable at runtime | Constraint |
| - | - | - | - |
| `GraphRetrievalSettings` | Always | Yes | One row with `ID = 'GLOBAL'`. |
| `GraphStepParams` | `engine = 'graph'` | Yes | Both `wKeywords` and `wRerank` must be `< minScore`. |
| `ProfileCriteria`, `RetrievalProfiles`, `StepRetrievalBindings` | `engine = 'scoring'` | Yes | Rerank criteria are configured per profile. |
| Cypher statements | Used by graph queries | **No**; stored in code | Versioned and tested; never supplied as arbitrary database strings. |

### 7.1. Invariants

`normalizeStepParams` **rejects the entire row** if `wKeywords >= minScore` or `wRerank >= minScore`, logs the reason, and uses defaults.

- `wKeywords >= minScore` would let **one** shared keyword qualify a precedent on its own, reintroducing R3 through configuration.
- `wRerank >= minScore` would let the **model alone** qualify a candidate without any shared graph relationship, discarding the requirement that each result have a supporting path.

Rejecting the whole row is preferable to silently clamping values: clamping would leave the UI displaying one value while the system uses another.

### 7.2. Enabling retrieval and reranking

```sql
-- Use the graph engine for all eight steps.
UPDATE GraphRetrievalSettings SET engine = 'graph' WHERE ID = 'GLOBAL';

-- Enable stage 2 for D4. With minScore 5, wRerank must be at most 4.
UPDATE GraphStepParams SET wRerank = 4 WHERE stepCode = 'D4';
```

Both changes take effect within the 30-second configuration-cache window. Saving settings that the active engine does not read returns a message pointing to the effective configuration table. This works in both directions through `req.info`, not `req.reject`: the saved settings remain valid and may be preparation for an engine switch.

## 8. Validation

### 8.1. Offline checks without credentials or network access

```bash
npm run typecheck
npm test
```

The historical baseline was **1126 passed, 22 skipped, and 0 failed across 41 suites**. These counts describe the recorded version and must not be presented as current results without running the commands. The 22 skipped tests require Cloud Graph DB. They report **skipped**, never *passed*, because `describe.skip` is selected **statically** through `GRAPH_INTEGRATION`. Automatically probing connectivity and silently doing nothing would produce a misleading green suite.

Offline coverage includes:

| Area | Property checked |
| - | - |
| `graphClient.test.ts` | Values enter bound parameters, never query text; no label conflicts with an openCypher keyword. |
| `stepProfiles.test.ts` | Weighted scoring; **one shared keyword alone never qualifies a precedent** at any step; deterministic tie-breaking; `accumulate`/`finalize` separation; rerank configuration normalization and **both** rejection rules. |
| `settings.test.ts` | Engine-switch normalization; unknown values fall back to `scoring`. |
| `rerankWiring.test.ts` | Full stage-2 flow with a mock provider: prompt content, **schema field order**, temperature 0, `analysis` parsing, rejection of invented IDs, and end-to-end recovery of a candidate through reranking. |
| `precedent/reranker.test.ts` | Thanh's normalization and `applyRerank` logic, plus analysis-field parsing. |

### 8.2. Live Cloud Graph Database checks

Use a container isolated from the shared container. Under that setup, **none of these commands targets** `cnma_proresolve_db`:

```bash
npm run cf:cpea && npm run cf:sandbox   # Log in and select the intended sandbox.
npm run deploy:graph                  # Deploy views, workspace, and configuration tables.
npm run seed:graph                    # Load the 25 historical cases.
npm run test:graph                    # Historical baseline: 79 passed.
```

`deploy:graph` fixes the profile to `--for graph`. Without it, `cds deploy` writes the post-deployment binding to **`hybrid`** by default and can silently redirect the team's shared profile to this container.

Integration coverage includes:

- Successful, valid workspace deployment and a library containing all 25 cases.
- **Dialect constraints that differ from standard Cypher:** named relationship variables and comma-separated V-shaped patterns, because reverse arrows do not parse.
- `[*1..2]` paths, the capability SQL does not replace here.
- Hostile values passed through `PARAMETERS` returning no matches, demonstrating that they remain data.
- Keyword `OR` chains required because `IN [$a,$b]` rejects bindings.
- **R3(a):** `8D-10049030` shares three words; `8D-10049010` shares one.
- **R3(b):** `"pocket depth"` finds `8D-10048880`, which received **+0** from the earlier scoring configuration.
- D1 counting each person's case participation (`100001`, Quality Engineer, three cases at `WC-MILL-07`).
- D5 reaching corrective task codes through `RootCause` (`TSK-3010`, four cases).
- Different result lists across the eight steps.
- Persisted database settings taking effect and invalid rows being rejected.

### 8.3. Live-model checks

In the documented test harness, `npm run test:graph` **could not execute the model call**: ts-jest ran CJS while the CDK provider dynamically loaded ESM. The call failed with `Unexpected token 'export'`, and the pipeline fell back to stage 1. That fallback was correct, so the test accepted it. It demonstrated *"enabling reranking does not break the pipeline"*, **not** *"the live model call works"*.

Run live calls through the shadow script under tsx/ESM, matching production execution:

```bash
npm run shadow:graph                         # All 25 cases, both engines.
npm run shadow:graph -- 8D-10048412          # One case.
npm run shadow:graph -- 8D-10048412 --rerank # Enable stage 2 for D4/D5.
```

`--rerank` derives `wRerank` from **each step's** `minScore`, then restores the original configuration. A fixed `wRerank = 4` would be rejected by D5 when its `minScore` is 4. Logging that reranking is enabled without confirming the write would be misleading.

Illustrative output with `--rerank`, translated from the recorded run:

```text
[shadow] re-rank ON: D5 wRerank=3, D4 wRerank=4
[precedent-rerank] Re-rank: 10/10 candidates scored in ~24000ms; inferred mechanism: ...
    D4   8D-10049030:12.8  8D-10049010:7.6      | scoring: 8D-10049010:9 ...
```

### 8.4. Interpreting a shadow comparison

The historical full run covered 25 cases × 8 steps = 200 case-step cells:

| Observation | Count |
| - | - |
| Results found by both engines | 98 |
| Results found only by graph | 372 |
| Results found only by the old scoring engine | 78 |
| Cells where graph returned no precedents | 27 / 200 |
| Cells where the old scoring engine returned no precedents | 104 / 200 |

**More retrieved results do not automatically mean better retrieval.** R4 raises exactly that concern. Two conclusions are supported by this run:

- The old engine returned **identical lists for all eight steps** for every case, the defect that motivated step-specific retrieval.
- The graph admitted more candidates, but **every admitted result had named relationship evidence sufficient to clear the threshold**, with the supporting path attached. In relevant places it also declined to return results more readily: for several D4 cases, graph returned no precedent while the old engine returned two cases exactly at its floor of 3.

The 372 graph-only results still require review of `topN` and `minScore`. They do not establish that the defaults are optimal.

## 9. Failure behavior

| Failure | Behavior | Effect |
| - | - | - |
| Graph workspace not deployed | Fall back to scoring; log the failed prerequisite. | Precedent retrieval remains available. |
| Graph query throws | Fall back to scoring. | Precedent retrieval remains available. |
| Rerank times out or parsing fails | Keep stage-1 ranking. | Stage 2 is lost; stage 1 remains. |
| Judgment is below the floor | Add no points and no evidence item. | Expected contract behavior. |
| Configuration violates an invariant | Reject the row, use defaults, and log the reason. | Safe fallback without a silent configuration change. |
| Both engines fail | Generate the report without precedents and include the reason. | No invented precedents. |

From outside, *"no precedent found"* and *"the engine did not run"* can look identical. Logs must distinguish them.

## 10. CDS model loading in scripts and tests

`cds.connect.to('db')` **does not load the CDS model**. The real server has a model because `cds.serve` loads it, but a Jest process or standalone script may not. Raw SQL can still work, while **CQN loses name mapping** and `UPDATE(...).set({ topN: 1 })` can silently write nothing.

A configuration test that reads the unchanged default can then pass without proving the intended update. Similarly, a shadow script can print "enabled" even though it persisted nothing. This behavior was observed in the original validation, including a damaged seeded row.

Any script or test using CQN **must load the model first**:

```ts
if (!cds.model) {
    cds.model = cds.linked(cds.compile.for.nodejs(await cds.load(cds.resolve('*'))));
}
```

## 11. Documented limitations

These limitations describe the scope recorded with the original graph validation; they are not a project roadmap or evidence of a fresh deployment check:

- Embeddings were **not wired as a booster** into the graph engine. `semanticUsed` reported `false`, and no step ran vector search when `engine = 'graph'`.
- D2 Is/Is-Not and D6 non-recurrence queries were validated as executable but **not wired into those steps' inputs**, because their results fall outside the `Precedent` contract.
- `prompts.ts:137-139` still hardcoded the old scoring formula, the R2 finding.
- `mta.yaml` declared one HDI container. A graph deployment requires the isolated graph container as a **second** resource alongside the existing one.
- The Similarity screen provided a notification after saving, rather than a persistent banner identifying the active engine. The backend exposed the information needed for such a display.
- Candidate-level `analysis` had not been inspected from a live-model call in the recorded validation; see section 4.6.
