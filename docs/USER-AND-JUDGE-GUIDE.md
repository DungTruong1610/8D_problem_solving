# 📖 User & Judge Guide — Autonomous 8D Problem Solving Copilot

> **MLAI Hackathon 2026**  
> **Track 1:** OrganizationAI  
> **Challenge B:** The Whole Workflow (Autonomous 8D Copilot)  
> **Database:** PostgreSQL 16 + pgvector (`localhost:5432` via Docker, standalone with zero SAP HANA dependency)

---

## 🧭 Table of Contents
1. [Introduction & WalkMe Tour](#1-introduction--walkme-tour)
2. [Module Purpose & Standard Operating Procedures](#2-module-purpose--standard-operating-procedures)
3. [AI Workflow & System Configuration (`/#/workflow`)](#3-ai-workflow--system-configuration-workflow)
4. [Standard JSON Schema & Test Case Authoring Playground](#4-standard-json-schema--test-case-authoring-playground)
   - [Schema Field Dictionary](#schema-field-dictionary)
   - [Reference JSON Template](#reference-json-template)
   - [4-Quadrant Test Strategy](#4-quadrant-test-strategy)
5. [Sprint 1 Evaluation Suite & Defense Sandbox](#5-sprint-1-evaluation-suite--defense-sandbox)
   - [Scoring Rubric & Sprint 1 Criteria](#scoring-rubric--sprint-1-criteria)
   - [90-Second Verify Harness Execution (1-Click Run)](#90-second-verify-harness-execution-1-click-run)
   - [Testing Arbitrary Judge Benchmark Test Cases](#testing-arbitrary-judge-benchmark-test-cases)
6. [Quick Command-Line Reference (CLI)](#6-quick-command-line-reference-cli)

---

## 1. Introduction & WalkMe Tour

The **8D Problem Solving Copilot** is a specialized AI assistant engineered for precision manufacturing and automotive production. It fully automates the eight-discipline root cause resolution methodology adhering to the international **8D standard (Ford / AIAG / VDA)**.

### 🚀 WalkMe Guided Tour (5-Minute Interactive Onboarding):
From the Web UI (`/#/guide`), click **"Start WalkMe Tour (5 Min)"** to launch an interactive, step-by-step walkthrough covering 5 core operational stations:
* **Station 1: 8D Incident Worklist (`/#/8d`)** — Filter active quality notifications and open reference case `8D-10048412`.
* **Station 2: 8D Resolution Workspace (`/#/8d/:id`)** — Inspect step-by-step AI suggestions across D1 through D8 and view precedent history.
* **Station 3: Blind Diagnosis & Physical Evidence** — Compare sensory inspection logs against operator statements to detect confirmation bias.
* **Station 4: AI Workflow Configuration (`/#/workflow`)** — Switch LLM providers, edit prompt templates, and adjust multi-factor retrieval weights.
* **Station 5: Test Authoring & 90s Verify Suite** — Download schema templates, validate custom JSON, and trigger the automated 90-second verify harness.

### 🧭 Guided Tour (in-app spotlight walkthrough)
*Added 2026-10-10.* Click **Guided Tour** in the left sidebar, directly below **User & Judge Guide**. Unlike the dialog tour above, it dims the screen and highlights the real controls one at a time, opening each screen, tab and dialog for you. The 51 steps run in this order:

1. **8D Reports**: the worklist with its compact (core) columns, the quick-filter chips, More/Fewer columns, Export Excel and Refresh. It then opens the **Create 8D Report** dialog and covers both entry paths: picking a recorded defect, and importing JSON (Upload file, sample issues, paste).
2. **Master Data**: Inspection History, Defect Records (Record Defect, Start 8D / Open 8D), Closed Case Library (Import JSON) and the Value Help catalogues.
3. **AI Configuration**: Where AI enters the chain, the Precedent Retrieval Engine, Model per processing step, Graph Retrieval Weights and Model Registry. The *8D Disciplines Configuration* tab is intentionally skipped.
4. **Working a case**: the tour opens the reference case `8D-10048412` (or the first open case when that one is missing) and covers the header actions (Export Excel, AI Stops, Audit Log, Source JSON, Re-analyze). It then shows the D1–D8 stepper, the first step not yet complete (its single next-action button), D4 root cause with the AI Referee, the Evidence tab with precedents, and the Case Overview.

**Controls:** **Next** / **→**, **Back** / **←**, and **Esc** or **Skip tour** to leave. The tour only opens screens; it never saves anything. The page underneath cannot be clicked while the tour runs, but the mouse wheel still scrolls it. The tour expands a collapsed sidebar, and it positions itself from live measurements, so it lines up at any browser zoom (designed and checked at **90 %**).

**For developers:** the script lives in `app/8D_hackathon_ui/src/components/walkthrough/walkthrough-steps.ts`. Each highlighted element carries a `data-tour="…"` attribute in its page, and a page lets the tour switch its tabs or dialogs through `useTourControl(...)`. If you rename a `data-tour` id, rename it in both places.

---

## 2. Module Purpose & Standard Operating Procedures

Running Benchmark Scenario: *Flange edge burr defect on CNC Milling Line 7 (`WC-MILL-07`, `MAT-10247`)*.

### 1. 8D Incident Worklist (`/#/8d`)
* **Purpose:** Central management dashboard overseeing the entire lifecycle of manufacturing quality notifications.
* **Target Users:** Quality Engineers (QE), Shift Supervisors, Plant Quality Managers.
* **Standard 3-Step Procedure:**
  1. Filter records by resolution status (*Open*, *In Progress*, *Completed*) or SLA risk.
  2. Click any incident card/row to open its detailed 8D resolution workspace.
  3. Or click *"Create Defect"* in the top-right toolbar to register a new incident.

### 2. 8-Discipline Resolution Workspace (`/#/8d/:id`)
* **Purpose:** Detailed step-by-step workbench guiding engineers through disciplines D1 through D8.
* **Distinctive Capabilities:**
  * **Precedent Panel:** The AI engine scans the PostgreSQL vector database and recommends historical matching cases with exact similarity percentages.
  * **Physical Evidence:** Cross-examines sensor and tool telemetry against operator statements to eliminate human bias.
* **Standard 3-Step Procedure:**
  1. Review top historical precedent matches in the right sidebar.
  2. Step through D1 to D8, clicking AI suggestions to inspect, accept, or refine them.
  3. Use the single action button in the step header, which always shows the next move:
     * *"Start the process"*: the step is read-only until you click it. It stays disabled until the previous step is complete.
     * *"Approve"*: signs the step off and unlocks the next one. It looks faded while something is still missing (an open AI stop, a required field, task status or evidence). Clicking it then opens an error dialog listing exactly what to fix, and nothing is saved.
     * *"Reopen"*: withdraws a completed step's approval. A reason is required and is stored in the audit log.
  4. **Task popups (D3, D5/D6, D7).** The **eye** icon opens a task in two columns. On the left are the description, execution notes and completion evidence, with a callout saying exactly what the task still needs to become Done. On the right are the details (assignee, duration, dates, root cause or task code) and a Planned → Open → Done progress tracker. The **pencil** icon opens the edit form in four sections: Task, Assignment, Schedule, and Root cause / Coding. Required fields show their error inline, and **Publish** explains that it sends the task to its assignee.
  5. **D5 and D6 run side by side.** Both unlock as soon as D4 is complete, and D7 waits for both.
     * **D5 (Permanent Corrective Actions)** only assigns work. It can be approved as soon as at least one corrective task has an owner.
     * **D6 (Verify Effectiveness)** manages execution of those same tasks. Each D5 task is set to Done there, with its evidence uploaded when required. D6 can only be approved when every D5 task is Done and has its evidence. Tasks in D6 are editable once D6 is *In process*, even after D5 has been approved.

### 3. Master Data Registry (`/#/master-data`)
* **Purpose:** Search and verify industrial plant master registries: Work Centers (lines/machines), Materials (part numbers), Subject Matter Experts (SMEs), and Defect Catalogues.
* **Application:** Lookup canonical SAP codes (`WC-MILL-07`, `MAT-10247`) when authoring new test cases or establishing the D1 containment team.

### 4. AI Workflow Configuration (`/#/workflow`)
* **Purpose:** Control tower for system intelligence. Fine-tune system/user prompts for D1–D8, switch LLM providers, and calibrate retrieval scoring weights.

---

## 3. AI Workflow & System Configuration (`/#/workflow`)

Engineers and administrators can configure system intelligence directly in the browser across 3 key pillars:

### 1. LLM Model Providers
* **DeepSeek V4.1 Flash (Recommended):** Ultra-fast inference, rigorous 5-Why logical decomposition, optimal token efficiency.
* **Gemini 2.5 Flash:** High multimodal accuracy, multilingual technical text parsing, and complex entity extraction.
* **Local Mock Mode (Offline / Zero-Cost):** 100% deterministic local execution without network access or API keys.

### 2. D1–D8 Prompt Management
Each discipline from D1 to D8 features independent System and User prompts. Prompts support dynamic parameter interpolation:
* `{{symptomShortText}}`: Original symptom description.
* `{{material}}`: Material code and product family.
* `{{workCenter}}`: Work center / manufacturing machine.
* `{{inspections}}`: Dimensional inspection metrics and tolerances.
* `{{precedents}}`: Retrieved historical cases and solutions.

### 3. Precedent Retrieval Calibration
* **Scoring Weights:** Adjust sliders to tune multi-factor matching priorities: Work Center match (default 40%), Material match (default 35%), Symptom vector similarity (default 25%).
* **Safety Cutoff Threshold (Rule 3.b):** When maximum similarity falls below 0.60 (60%), the system automatically triggers **Safe Refusal** mode to prevent hallucinations.

---

## 4. Standard JSON Schema & Test Case Authoring Playground

### Schema Field Dictionary:

| Field Name | Required? | Data Type | Role in 8D Methodology | Example Value |
|---|---|---|---|---|
| `notificationId` | **Required** | string | Unique incident identifier | `"8D-10049001"` |
| `symptomShortText` | **Required** | string | Defect symptom text (used for semantic embedding) | `"Rough edge felt on bracket flange after milling"` |
| `material.materialId` | **Required** | string | Defective component / material code | `"MAT-10247"` |
| `workCenter.workCenterId` | **Required** | string | Production line / machine code | `"WC-MILL-07"` |
| `origin` | Optional | string | Defect origin: Q1 (Customer), Q3 (Internal Plant) | `"Q3 - Internal Defect"` |
| `inspections` | **Recommended** | array | Physical measurements vs engineering specifications | `[{"measuredValue": "0.26mm", "specValue": "max 0.10mm"}]` |
| `causesIshikawa` | Optional | array | Initial engineer Ishikawa fishbone observations | `[{"category": "Machine", "cause": "..."}]` |

### Reference JSON Template:
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$testCaseId": "TC-CUSTOM-01",
  "$title": "Custom Manufacturing Defect Test Case",
  "notificationId": "8D-10049999",
  "origin": "Q3 - Internal Defect",
  "symptomShortText": "Excess burr on flange edge exceeding tolerance after milling",
  "status": "In Process",
  "foundDate": "2026-09-22",
  "material": {
    "materialId": "MAT-10247",
    "description": "Bracket Housing X240",
    "materialGroup": "MG-HOUSING"
  },
  "workCenter": {
    "workCenterId": "WC-MILL-07",
    "description": "CNC Milling Line 7"
  },
  "inspections": [
    {
      "characteristic": "Burr height at flange edge",
      "measuredValue": "0.26mm",
      "specValue": "max 0.10mm"
    }
  ]
}
```
*(On the Web UI, click **"Download .json"** to save `test-case-template-8D.json` directly to disk).*

### 4-Quadrant Test Strategy:
Each test runs the **same code path the app runs for a real case**: `validateDataset` / `mapCase`, the D4 precedent engine (`findPrecedentsByStep`, the same source that decides the "no precedent" stop), and the stop rules (`evaluateStops`). The expected answer is not written in the harness. It is the `$expectedOutcome` block of each file in `mock-data/sprint1-test-cases/`, and the harness only compares what it measured against it. No LLM drafting is called, so a run takes a few seconds at most.

1. **Happy Path (TC-01):** New defect `8D-10049001` on `WC-MILL-07` / `MAT-10247`, burr `0.26mm` vs max `0.10mm`. Passes when the D4 precedent search returns the closed case `8D-10048412` and no blocking stop is raised.
2. **Dirty Data (TC-02):** Free-text German measurement `"gemessen 0,32mm"` and padded material ID `"  MAT-10247 "`. Passes when the app's own parser reads `0.32`, the ID is trimmed, gaps are reported, and the AI stops at D4 until a QE confirms the parsed value.
3. **Bias Hunter (TC-03):** The record blames `Man` with no metric, while `Machine` shows a `0.9mm` drift (max `0.2mm`). Passes when the app's contradiction rule flags exactly that and stops D4 for the QE to decide.
4. **Safe Refusal (TC-04):** Welding defect `DEF-0910` on the milling cell `WC-MILL-07`. Only the work center and material match past cases (7/16), which is below the D4 threshold of 8. Passes when no precedent qualifies, the AI stops (outside scope), and the stop hands a question to a person.

The D4 retrieval profile (`diagnosis`) requires **8 points** (Configuration → retrieval profiles): a matching work center and material alone is not enough to cite a root-cause precedent; the defect code or a semantically similar description must also match.

---

## 5. Sprint 1 Evaluation Suite & Defense Sandbox

### Scoring Rubric & Sprint 1 Criteria:
* **Criterion 2 (12 Points):** Automated execution of the 4 strategic test cases in < 90 seconds (typical runtime: a few seconds).
* **Criterion 3 (8 Points):** The judge sandbox evaluates any pasted JSON with the same validation, precedent engine and stop rules, and either processes it, stops for a person, or refuses it.
* **Mandatory Rule 3.b:** When no closed case qualifies as a precedent, no precedent is cited and the case is escalated to a person.

If the backend cannot be reached, the Evaluation tab shows an error and **no results**. It never falls back to pre-written PASS rows. The **Summary** button opens a summary of the run that just happened: expected vs actual, every stop, and what was measured.

### 90-Second Verify Harness Execution (1-Click Run):
* **On Web UI:** Navigate to `/#/guide` $\to$ scroll to **"4. Sprint 1 Evaluation Suite"** $\to$ click **"Run 90s Verify Suite"**.
* **Via Terminal:**
  ```bash
  npm run verify:sprint1
  ```

### Testing Arbitrary Judge Benchmark Test Cases:
* **On Web UI:** Paste any JSON into the **Two-Tier Defense Sandbox** and click **"Test Defense Decision"**.
* **Via Terminal:**
  ```bash
  npm run verify:sprint1 -- --judge-input <file.json>
  ```

---

## 6. Quick Command-Line Reference (CLI)

| Purpose | Execution Command |
|---|---|
| **Start Fullstack System (BE + FE)** | `npm run dev:pg` |
| **Run 90s Verify Harness (Sprint 1)** | `npm run verify:sprint1` |
| **Test Judge Benchmark Case** | `npm run verify:sprint1 -- --judge-input <file.json>` |
| **Export Verify Output as Raw JSON** | `npm run verify:sprint1 -- --json` |
| **Start Postgres Database via Docker** | `docker compose up -d` |
| **Run Full Automated Unit Test Suite (1230 tests)** | `npm test` |
| **Perform Full TypeScript Verification** | `npm run typecheck && npx tsc -b app/8D_hackathon_ui` |

---
*Maintained and verified by the Autonomous 8D Copilot Engineering Team — MLAI Hackathon 2026.*
