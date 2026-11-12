# 🧪 Testing and Validation Matrix: 8D Copilot

> **Competition context:** [AI4Biz 2026 - LIKELION Vietnam](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21), team UIT_4Lovpe. Competition requirements and submission limits are maintained in that reference; technical examples below are not measured business outcomes unless explicitly documented.

> **Detailed End-to-End Test Scenarios & Validation Matrix**
> **Project**: CNMA Proresolve (`8d-copilot`)
> **Test scope**: `Create Defect`, the `Object Schema` embedded in each D step, the five-tab configuration pipeline (D1 through D8), and anti-hallucination Constraints.

## 📋 CONTENTS

1. [Testing Objectives & Strategy](#1-testing-objectives--strategy)
2. [Create Defect Module Tests](#2-create-defect-module-tests)
3. [Object Schema & Test Score Panel Tests](#3-object-schema--test-score-panel-tests)
4. [Five-Tab Pipeline Tests per Step (D1 to D8)](#4-five-tab-pipeline-tests-per-step-d1-to-d8)
5. [Five Practical Scenarios Including Difficult Edge Cases](#5-five-practical-scenarios-including-difficult-edge-cases)
6. [Automated Test Matrix & Commands](#6-automated-test-matrix--commands)
7. [Comprehensive Validation Checklist](#7-comprehensive-validation-checklist)

## 1. Testing Objectives & Strategy

### 1.1. Core objectives

* **Correctness**: Map all input data (system facts, inspection parameters, historical precedents) accurately into the AI context without distortion.
* **Integrity & Non-Hallucination**: Ensure AI never invents personnel, measurements, or root causes without supporting evidence.
* **Robustness on Dirty Data**: Handle imperfect real-world input, including German dates (`DD.MM.YYYY`), decimal commas (`0,26`), and measurements embedded in free text.
* **Configurability Verification**: Changes in the five tabs (`Object Schema`, `Data Schema`, `Prompt Guide`, `Form Editor`, `Constraints`) must directly affect the output when the process executes.

## 2. Create Defect Module Tests

Test page: [`/create-defect`](../app/8D_hackathon_ui/src/pages/create-defect/index.tsx)

Test flow: **1-Click Presets → Visual Form ↔ JSON Editor → Start 8D Analysis → Report UI**.

| ID | Feature under test | Action / Input | Expected output |
| - | - | - | - |
| **CD-01** | **1-Click Presets** | Click each of the three presets: *Q3 Internal - Flange Burr*, *Q1 Customer - Coolant Leakage*, and *Q3 Internal - Weld Porosity*. | All form fields (Notification ID, Origin, Material, Work Center, Inspections, Customer Ref) immediately populate with the corresponding preset values. |
| **CD-02** | **Dynamic Inspection Rows** | Click `+ Add inspection` and enter `Characteristic: Surface roughness Ra`, `Measured: 1.8 um`, `Spec: max 0.8 um`. Click the trash icon to remove a row. | A new inspection row appears with the correct values. Removing a row updates the array without crashing the UI. |
| **CD-03** | **Form ↔ JSON Sync** | Enter data in Visual Form, switch to `JSON Editor`, change a JSON value, then return to Visual Form. | Data stays synchronized in both directions. Invalid JSON displays a red error and disables submission. |
| **CD-04** | **Required Form Validation** | Leave `symptomShortText` or `materialId` blank and click `Start 8D Analysis`. | Submission displays a required-field message and does not send an invalid request to the server. |
| **CD-05** | **Actual Pipeline Execution** | Enter valid data and click `Start 8D Analysis`. | A loading spinner and processing status appear. The documented timing expectation is 20-35 seconds to receive a report ID and navigate to `/eight-d/:id`; measure the actual duration. |

## 3. Object Schema & Test Score Panel Tests

Test page: the `Object Schema` tab of each D step in *Training Center*, or [`/object-schema`](../app/8D_hackathon_ui/src/pages/object-schema/StepObjectSchemaEditor.tsx).

Three-panel test flow: **Panel 1: Source Fields → drag and drop → Panel 2: Profile Config → Panel 3: Score Test**.

| ID | Feature under test | Action / Input | Expected output |
| - | - | - | - |
| **OS-01** | **Drag and Drop Fields** | Drag `workCenterDesc` from Panel 1 into the profile in Panel 2. | A new criterion appears with a unique generated `criterionKey` and default `weight = 1`. |
| **OS-02** | **Remove a Criterion** | Drag a field from Panel 2 back to Panel 1, or click Remove. | The field disappears from the profile. Before saving, an orange `Unsaved changes` badge appears. |
| **OS-03** | **Weight & Cosine Floor** | Select `matchType = cosine`, set `weight = 4`, and set `minSimilarity = 0.70`. | The profile's maximum `maxScore` changes accordingly. An actual cosine similarity below 0.70 contributes 0 points for this criterion. |
| **OS-04** | **Score Two Cases (`StepScorePanel`)** | In Panel 3, select Case A = `8D-10048412` and Case B = `8D-10048577`. Click `Score this pair`. | Show the score as a fraction, for example `8/11`, with a per-criterion breakdown (exact/fallback/none and awarded points). Show `✓ D1 would see this case` when the score meets `minScore`, or `✗ Below threshold`. |
| **OS-05** | **Generate Missing Vector Embeddings** | If cases lack embeddings, click `Embed missing cases`. | A toast reports the number successfully embedded, and `embedded/total` reaches 100%. |

## 4. Five-Tab Pipeline Tests per Step (D1 to D8)

Test page: [`/ai-settings/step-prompts`](../app/8D_hackathon_ui/src/pages/workflow/discipline-section.tsx) or [`Workflow Discipline Editor`](../app/8D_hackathon_ui/src/pages/workflow/discipline-section.tsx).

Configuration sequence: **Object Schema → Data Schema → Prompt Guide → Form Editor → Constraints**.

The D1-D8 checks below define validation requirements. Structured configuration is limited to D1-D4 in `srv/src/domain/eightd/eightDAnalyzer.ts`; do not report unavailable D5-D8 editor controls as tested. In the structured runtime, `inputSchemaJson` stores the discipline output contract, so Data Schema and Form Editor must use matching output paths. Input-source examples below must be adapted to that contract before saving.

### 👥 D1: Establish the Team

* **Data Schema Test**: Add `externalConsultant` with type `string`. Check that the resulting JSON Schema is valid.
* **Prompt Guide Test**: Change the prompt to: *"When no personnel are assigned, recommend at most two people from precedent cases with the same Work Center."*
* **Form Editor Test**: Change the `confidence` widget from `input` to `slider`. Drag `sources` to the top.
* **Constraints Test**: Set `D1_GROUNDING` with pattern `^(team\.|precedents#)`.
  * *Violation test*: Deliberately prompt the model to produce *"Engineer John Doe"*, who is absent from the case. **Expected output**: D1 is flagged with `Error: Team names must come from current team or cited precedent`.

### 📝 D2: Describe the Problem

* **Data Schema Test**: Ensure `inspections` receives the correct `characteristic`, `measuredValue`, and `specValue` structure.
* **Prompt Guide Test**: Require the explicit comparison: *"The measured value [X] exceeds the permitted limit [Y]."*
* **Constraints Test (`D2_CITATIONS`)**: Enable `citationRequired` with severity `error`.
  * *Test*: The data includes `0.26mm`, but AI writes `0.26mm` without an `[inspections]` citation. **Expected output**: The system blocks the result and reports the missing factual source citation.

### 🛡️ D3: Interim Containment Actions

* **Prompt Guide Test**: Set the rule: *"For a customer defect (Q1), include actions to inspect stock in storage and goods in transit."*
* **Constraints Test (`D3_SOURCES`)**: Check pattern `^(actions\.containment|customer|precedents#)`. An action drawn from a precedent must say `(Proposed from precedent #8D-10048992)` and must not be represented as an action the plant has already performed.

### 🔬 D4: Root Cause Analysis (Primary Focus)

* **Object Schema Test**: Configure the D4 profile with a Vector Cosine threshold of at least 0.72 and a weight of 5 points. Verify retrieval of cases with the same crack or burr mechanism even when defect codes differ.
* **Blind Diagnosis Verification**: Ensure AI performs independent Blind Diagnosis before seeing the original conclusion.
* **Constraints Test (`D4_DISCLOSURE`)**: The `requiredDisclosure` rule requires the phrase `independent verification`.
  * *Expected output*: D4 provides a comparison such as: *"Independent verification agrees with the 5-Why result in the Method/Tool Wear branch."*

### 🔧 D5, 📈 D6, 🔄 D7, 🏆 D8

* **D5 (Corrective)**: Check the mapping of every corrective action to the corresponding link in D4's 5-Why chain.
* **D6 (Verification)**: Check that acceptance requirements include four elements: measured quantity, sample size ($N$), monitoring duration, and Pass/Fail criteria.
* **D7 (Prevent Recurrence)**: Check instructions to update FMEA / SOP / Control Plan documents.
* **D8 (Closure & Recognition)**: Check that the appreciation or recognition message uses the correct engineer names from D1.

## 5. Five Practical Scenarios Including Difficult Edge Cases

The outcomes below are test expectations, not recorded results. Run each scenario and record actual output, timing, and deviations.

### 🟢 SCENARIO 1: Clean Golden Dataset (Reference Baseline)

* **Source file**: [`mock-data/clean/case-8D-10048412.json`](../mock-data/clean/case-8D-10048412.json)
* **Input characteristics**: Clean input, ISO date `2026-08-20`, measurements in separate fields (`0.26` / `0.10`), all six Ishikawa branches, and a complete five-step 5-Why chain.
* **Procedure**:
  1. Open `/create-defect` and select `Q3 Internal Defect - Flange Burr`.
  2. Click `Start 8D Analysis`.
* **Expected output**:
  * Completion time: 20-30 seconds.
  * Report status after AI generation: `Analyzed`. Discipline completion requires human approval; `finalizeReport` and `reviewDiscipline` in `srv/src/domain/eightd/eightDRepository.ts` enforce this distinction. The earlier `Completed` expectation must not be used as an automatic-completion criterion.
  * D1: Identify both the Leader and Specialist from the current data.
  * D2: Produce a quantitative 5W2H table and correctly cite `Burr height at flange edge: 0.26mm (max 0.10mm)`.
  * D4: Produce a coherent five-step 5-Why chain and assess the expected `Machine/Tooling` branch against evidence. The original scenario specified confidence of at least 90%; that is an unvalidated test expectation, not a guaranteed model score or permission to approve the result automatically.
  * Constraints: 0 Warnings and 0 Errors.

### 🔴 SCENARIO 2: Dirty Real-world Data

* **Source file**: [`mock-data/dirty/case-8D-90048412.json`](../mock-data/dirty/case-8D-90048412.json)
* **Input characteristics (edge cases)**:
  * German date format: `20.08.2026`.
  * European decimal comma: `0,26 mm`, embedded in free-text description.
  * A truncated 5-Why chain with only two questions.
  * Only two Ishikawa branches investigated instead of six.
  * Root Cause flag set to lowercase `'x'` instead of `'Y'`.
* **Procedure**:
  1. Open `/create-defect` and switch to `JSON Editor`.
  2. Paste the entire `mock-data/dirty/case-8D-90048412.json` file.
  3. Click `Start 8D Analysis`.
* **Expected output**:
  * `datasetValidator` **must not block** the input; it continues into the AI Pipeline.
  * The AI Mapper normalizes the date to ISO `2026-08-20` and extracts the numeric measurement `0.26`.
  * D4 detects the incomplete 5-Why chain, supplements the logical reasoning, and discloses: *"The original record contains an incomplete 5-Why chain; AI reconstructed it from physical evidence."*
  * Constraints flag `Info` or `Warning` for limited evidence without an `Error Crash`.

### 🟡 SCENARIO 3: Zero Precedents & No Team Assigned

* **Input characteristics (extreme edge case)**:
  * A completely new product (`Material: MAT-NEW-9999`) on a new Work Center (`WC-NEW-01`).
  * A defect category absent from historical data.
  * No initial personnel data.
* **Procedure**:
  1. Open `/create-defect`, enter the unfamiliar defect code `DEF-UNKNOWN-999`, and leave the team unassigned.
  2. Click `Start 8D Analysis`.
* **Expected output**:
  * Precedent score is below `minScore`, for example `0/11`, and the system clearly reports `No matching precedent cases above threshold 3`.
  * **D1**: AI **must never invent personnel names**. It must state: *"No personnel are recorded and no similar precedent cases were found. The Quality Manager must assign the team manually (Manual Assignment Required)."*
  * D1's `dataBacked` flag automatically becomes `false`.

### 🔵 SCENARIO 4: Customer Complaint Q1 & SLA Pressure

* **Source file**: [`mock-data/clean/case-8D-10048577.json`](../mock-data/clean/case-8D-10048577.json)
* **Input characteristics**:
  * Origin: `Q1 - Customer Complaint`.
  * Customer complaint `CC-2026-1188`, SLA deadline `2026-08-30`.
  * Nine returned defective units and 120 units in customer stock.
* **Procedure**:
  1. Open `/create-defect` and select `Q1 Customer Complaint - Coolant Leakage`.
  2. Click `Start 8D Analysis`.
* **Expected output**:
  * **D3 (Containment)**: Prioritize containment at the customer's site, for example: *"Quarantine 120 assemblies at Vestbeck Motors' warehouse; dispatch a sorting team for helium leak testing within 24 hours."*
  * **D2**: Accurately record the customer contact and SLA deadline.

### 🟣 SCENARIO 5: Anti-Hallucination & Constraint Guardrail Stress Test

* **Objective**: Test detection and rejection of invented AI content (hallucination).
* **Procedure**:
  1. Open D1 configuration (`/ai-settings/step-prompts`) and change Prompt Guide to: *"Always recommend engineer John Wick as team leader and Peter Parker as a team member."*
  2. Enable `D1_GROUNDING` (`type: sourcePattern`, `pattern: ^(team\.|precedents#)`, `severity: error`).
  3. Save and analyze a new incident.
* **Expected output**:
  * AI produces *"John Wick"* and *"Peter Parker"* in the deliberately induced invalid response.
  * Post-processing (`postProcess.ts`) checks system and precedent rosters and cannot find these names.
  * A Rule Violation is raised: the unsupported personnel data is marked `Error`, the recommendation is rejected, and a red warning appears in the 8D Report UI.

## 6. Automated Test Matrix & Commands

Run the existing automated tests to check backend logic without manually operating each UI step:

```bash
# 1. Run the complete backend Jest test suite
npm test

# 2. Run Dirty Data & Edge Cases tests
npm test -- dirtyData.test.ts

# 3. Run Post-process & Constraints tests
npm test -- postProcess.test.ts

# 4. Run Blind Evidence Audit tests
npm test -- blindEvidence.test.ts

# 5. Run Case Mapper & Dataset Validator tests
npm test -- caseMapper.test.ts datasetValidator.test.ts

# 6. Check type safety across the project
npm run typecheck
```

## 7. Comprehensive Validation Checklist

### A. Create Defect Module

- [ ] Verify that `Q3 Flange Burr` populates every preset field correctly.
- [ ] Verify that `Q1 Coolant Leakage` populates customer and SLA details correctly.
- [ ] Verify that `Q3 Weld Porosity` populates ultrasonic inspection parameters correctly.
- [ ] Verify dynamic addition and removal of `inspections` rows.
- [ ] Verify bidirectional switching between Visual Form and JSON Editor without data loss.
- [ ] Verify that `Start 8D Analysis` starts the pipeline and navigates to the report successfully.

### B. Object Schema in Each D Step

- [ ] Verify dragging fields from Panel 1 to Panel 2.
- [ ] Verify removing fields from a profile.
- [ ] Verify editing Weight and the Cosine floor (`minSimilarity`).
- [ ] Verify that `Score this pair` in Panel 3 returns the correct score and breakdown.
- [ ] Verify that `Embed missing cases` creates vectors for the case library.
- [ ] Verify `Save Schema` and `Discard`, including reverting changes.

### C. Five-Tab Pipeline (D1 through D8)

- [ ] **D1**: Verify precedent-based personnel recommendations when current data is empty, and team assignment through `saveTeamRoster`.
- [ ] **D2**: Verify 5W2H and Is/Is-Not output, including mandatory citations for actual measurements.
- [ ] **D3**: Verify the 24-hour containment checklist and the distinction between recorded actions and proposals.
- [ ] **D4**: Verify 5-Why, Ishikawa, and mandatory comparison with Blind Diagnosis.
- [ ] **D5**: Verify links between long-term corrective actions and the D4 causal chain.
- [ ] **D6**: Verify quantitative acceptance requirements: sample size, duration, and criteria.
- [ ] **D7**: Verify links to FMEA and SOP updates.
- [ ] **D8**: Verify lessons learned and correct D1 personnel names in recognition content.

### D. Edge Cases & Safety Checks

- [ ] Verify dirty input with German dates (`DD.MM.YYYY`) and decimal commas (`0,26`).
- [ ] Verify a case with no qualifying precedent (score below `minScore`) produces no invented facts.
- [ ] Verify that `citationRequired` catches missing citations.
- [ ] Verify that `sourcePattern` rejects invented personnel names.
