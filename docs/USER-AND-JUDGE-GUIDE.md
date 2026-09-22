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
  3. Click *"Approve Step"* to lock the current discipline and unlock the subsequent step.

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
1. **Happy Path (TC-01):** Uses machine `WC-MILL-07`, material `MAT-10247`, burr measurement `0.26mm`. The retrieval engine matches 100% with historical precedent `8D-10048412`.
2. **Dirty Data (TC-02):** Injects raw German input `"Grat an Flanschkante"`, European decimal comma `"0,32 mm"`, and padded whitespace `" MAT-10247 "`. The pipeline normalizes dirty input and flags missing fields cleanly.
3. **Bias Hunter (TC-03):** Initial engineer feedback attributes defect to `Man`, but inspection records prove spindle runout of `0.9mm` (tolerance 0.2mm) across 3 shifts. The AI overrides human bias to conclude `Machine`.
4. **Safe Refusal (TC-04):** Novel fiber-laser welding cell `WC-WELD-11` and experimental material `MAT-12800`. Similarity < 60% safely triggers refusal with 3 structured handover questions for welding SMEs.

---

## 5. Sprint 1 Evaluation Suite & Defense Sandbox

### Scoring Rubric & Sprint 1 Criteria:
* **Criterion 2 (12 Points):** Automated execution of the 4 strategic test cases in < 90 seconds (Actual runtime: **~0.8s**, PASS 4/4).
* **Criterion 3 (8 Points):** Two-Tier Defense pipeline appropriately processes or safely refuses both Judge benchmark cases.
* **Mandatory Rule 3.b:** Hallucination firewall blocks false positives when similarity < 60%, generating 3 structured handover questions for SMEs.

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
