# 8D Copilot - UIT_4Lovpe

An AI assistant for manufacturing quality teams that connects defect records, inspection evidence and previous cases to help engineers prepare and review 8D reports.

8D Copilot supports the Eight Disciplines of Problem Solving, from team formation to incident closure. AI retrieves relevant precedents and drafts suggestions. Engineers verify the evidence, approve actions and decide whether a case can be closed.

## Quick Links

- [Web demo](https://8-d-problem-solving.vercel.app) - Check availability and the active configuration before presenting.
- [Source repository](https://github.com/DungTruong1610/8D_problem_solving) - Project source and commit history.
- [Reference video folder](https://drive.google.com/drive/folders/1EMNPvJtuusw9Dh1NjabfNLnO5E_v8n-h) - Existing recordings, not a verified final AI4Biz submission.
- [Reference presentation](https://drive.google.com/file/d/1MnYTZFrnOwkrmN3ThGfhsBjA8gm-xlBP/view?usp=sharing) - Existing slides that need a separate submission review.
- [AI4Biz competition reference](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21) - Official competition requirements, deadlines and judging criteria.
- [Documentation index](docs/INDEX.md) - Product requirements, technical guides and historical records.

## AI4Biz 2026

8D Copilot is being prepared for **AI4Biz - AI FOR BUSINESS INNOVATION**, organized by **LIKELION Vietnam**, under the theme **Solve Real Business Problems with AI**.

The project focuses on Manufacturing and Operations, with quality engineers at automotive component suppliers as the initial target users. The business objective is to reduce the effort spent finding evidence and preparing reports while retaining human responsibility for quality decisions.

### Team

**UIT_4Lovpe**, University of Information Technology, Vietnam National University Ho Chi Minh City:

- Trần Hoàng Đức
- Trương Đình Việt Dũng
- Trần Đình Duy
- Nguyễn Trung Dũng

### Submission Requirements

- Submission deadline: **23:59 on November 13, 2026**, Vietnam time.
- Submission document: **an English PDF with at most 15 slides**.
- Submission folder: `AI4Biz_UIT_4Lovpe_2026`.
- Submit the PDF's Google Drive link through the organizer's form with **Anyone with the link can view** access.
- A prototype or MVP link is optional and can strengthen the submission.
- Final pitch: **November 19, 2026**, in English, lasting at most **15 minutes**.
- Final presentation materials: slides and a demo video lasting at most **2 minutes**.
- Q&A: **5 minutes**.
- At least **3 team members** must attend and present at the final.

See the [official challenge](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21) and [submission form](https://docs.google.com/forms/d/e/1FAIpQLScoXGsQEvo_-kofEcYXvuQz8NrTdBCPS1HCIytfocO6EY8QyQ/viewform). The official page's summary table and detailed headings disagree on the Feasibility and Presentation weights.

Markdown updates do not rebuild existing HTML decks, PDFs, DOCX files or videos. Review the competition name, team roster, language, slide count and video duration in the exported submission assets.

## The Business Problem

Quality investigations require engineers to reconcile defect notifications, inspection measurements, production context and reports from earlier incidents. When these records are scattered, the team spends time reconstructing information before it can evaluate a corrective action.

8D Copilot brings that information into one workflow:

- Retrieve previous cases using the manufacturing context and configured similarity criteria.
- Draft structured explanations and proposed actions from available evidence.
- Highlight missing information, conflicting evidence and decisions that need human review.
- Record approvals and review history so the basis of a decision can be inspected later.

The intended benefit is lower report preparation and evidence retrieval effort. Any claimed savings need a defined comparison that includes review time and corrections. Draft generation time is not incident resolution time.

## Core Capabilities

- **Structured case intake:** Create an 8D report from a defect record or supported JSON input.
- **Precedent retrieval:** Find related closed cases and inspect the sources behind suggestions. The active engine and semantic capabilities depend on configuration.
- **AI drafting:** Prepare suggestions across D1 through D8, including problem descriptions, cause analysis and proposed actions.
- **Root cause analysis:** Work with 6M Ishikawa diagrams, 5-Why chains and supporting inspection evidence.
- **AI Referee:** Compare explanations with evidence to help engineers identify unsupported conclusions.
- **Stop conditions:** Request clarification or escalation when facts are unverified, evidence is insufficient or a decision exceeds the permitted scope.
- **Human approval and audit history:** Review each discipline and retain the recorded decisions.
- **Prevention and maintenance history:** Connect preventive measures with approved causes and inspect the history of approved maintenance proposals.

## The Eight Disciplines

1. **D1 - Team:** Define the people and responsibilities needed to investigate the issue.
2. **D2 - Problem:** Describe the defect, measurements and scope, including Is / Is-Not analysis.
3. **D3 - Containment:** Propose immediate measures to limit the impact of the defect.
4. **D4 - Root Cause:** Investigate causes using evidence, Ishikawa analysis, 5-Why chains and precedents.
5. **D5 - Corrective Actions:** Select actions that address the verified root cause.
6. **D6 - Verification:** Record evidence that the corrective actions are effective.
7. **D7 - Prevention:** Propose changes that reduce recurrence and update relevant process controls.
8. **D8 - Closure:** Review completion, capture lessons learned and close the case when authorized.

## Run Locally

### Prerequisites

- Node.js 22 and npm.
- Git.
- Windows with PowerShell for the commands below. The current development scripts include Windows shell behavior.
- Access to the package registries configured for this repository if installation requests authentication.
- Docker only for the optional PostgreSQL setup. The default SQLite setup does not require a database server.

### 1. Clone and Install

```powershell
git clone https://github.com/DungTruong1610/8D_problem_solving.git
cd 8D_problem_solving
npm install
cd app/8D_hackathon_ui
npm install
cd ../..
```

### 2. Configure the Environment

For a new checkout without an existing `.env` file:

```powershell
Copy-Item .env.example .env
```

For local development without live model calls, edit `.env` and set:

```env
MOCK_LLM=true
```

Mock mode returns test responses. It does not demonstrate the quality of a real AI model. See [AI Configuration](#ai-configuration) to enable a live provider.

### 3. Initialize SQLite

Run these commands from the repository root for a new local database:

```powershell
npm run deploy:sqlite
npm run seed:sqlite
```

The local configuration uses `db.sqlite`. Seeding supplies demonstration records and supporting reference data. These commands change the database; back up any data you need before reinitializing or reseeding it.

If a teammate provides an existing database compatible with this code revision, place it at the configured database path and skip initialization.

### 4. Start the Application

```powershell
npm run dev
```

The current development scripts start:

- Frontend: [http://localhost:5544](http://localhost:5544).
- Backend: [http://localhost:4008](http://localhost:4008).

To run the services separately, start the backend from the repository root in one terminal:

```powershell
npm run dev:backend
```

Start the frontend in another terminal:

```powershell
cd app/8D_hackathon_ui
npm run dev
```

The local Vite proxy supplies development authentication to the backend. This configuration is intended for local development, not production access control.

### Optional PostgreSQL Setup

With Docker available, review the database settings in `.env`, then run from the repository root:

```powershell
npm run db:up
npm run deploy:pg
npm run seed:pg
npm run dev:pg
```

Deployment and seed commands modify the selected database. Use the profile that matches the environment you intend to demonstrate.

## AI Configuration

The [environment template](.env.example) documents the supported chat and embedding settings. Model identifiers and endpoints must match the provider account you use.

- **DeepSeek:** Configure `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL` and `DEEPSEEK_MODEL`.
- **Google Gemini:** Configure `GEMINI_API_KEY` and the corresponding model settings.
- **Local models:** Configure `LOCAL_LLM_URL`, `LOCAL_LLM_MODEL` and any required endpoint credentials.
- **SAP AI Core:** Use the service key or individual AI Core settings in the environment template.
- **Embeddings:** Configure `JINA_API_KEY` or the explicit embedding endpoint, key and model settings. Semantic retrieval requires a configured embedding provider.

Set `MOCK_LLM=false` when testing a live provider, save `.env` and restart the application. Inspect the startup logs to confirm which chat model, embedding provider and retrieval configuration are active.

To verify the configured endpoints:

```powershell
npx tsx scripts/probe-ai.ts
```

The probe can make requests to the configured providers. When embeddings are unavailable or disabled, semantic matching is skipped. Keep credentials in local environment configuration, outside source files and submission materials.

## Try the Demo

1. Open the application and go to **8D Reports**.
2. Select **Create 8D Report**.
3. Choose a defect from **All**, **Q1 Customer**, **Q2 Supplier** or **Q3 Internal**, or use the supported JSON import flow.
4. Review the defect context and measurements, then select **Create & Analyze**.
5. Inspect the draft, retrieved precedents and supporting evidence. A populated draft is not an approved discipline.
6. Open D4 to examine the Ishikawa diagram, 5-Why chain and AI Referee observations.
7. Review stop conditions and provide the required clarification or decision.
8. Inspect preventive actions and the audit trail before progressing toward closure.

You can also open an existing sample report to inspect its disciplines and review state. Use **User & Judge Guide** for the guided walkthrough and internal evaluation tools.

For an AI4Biz demonstration, show one understandable case, the source of a suggestion, a situation requiring human review and the resulting audit record. Label sample data clearly.

## Sample Data and Verification

The repository includes demonstration fixtures for manufacturing defects, clean and dirty inputs, and regression checks. They support repeatable demonstrations; they are not evidence of a completed customer pilot or measured production savings.

- [Clean case fixtures](mock-data/clean/) - Structured reference inputs.
- [Dirty case fixtures](mock-data/dirty/) - Inputs used to exercise normalization and evidence review.
- [Dataset documentation](mock-data/README.md) - Context for the sample library.
- [Verification runbook](docs/SPRINT1-VERIFY-RUNBOOK.md) - Commands, coverage and limitations.

### Reference Case Catalog

The existing demonstration catalog covers these 25 cases. Expected outcomes belong to the fixtures and must not be treated as conclusions about a new incident.

- `8D-10048412` - Bracket Housing X240: Flange edge burr above limit after milling.
- `8D-10048420` - Sprocket Hub H22: Raised metal ridge at bore mouth.
- `8D-10048577` - Pump Housing P90: Porosity at sealing flange face.
- `8D-10048603` - Drive Shaft S150: Shaft diameter below lower tolerance.
- `8D-10048651` - Housing Cover C80: Coating layer peeling after salt spray test.
- `8D-10048702` - Gearbox End Cap G45: Bolt torque below specification.
- `8D-10048745` - Sensor Mount Bracket S22: Adhesive bond failure under thermal shock.
- `8D-10048788` - Rotor Shaft R60: Chatter marks on ground surface.
- `8D-10048811` - Manifold Block M12: Port thread depth insufficient.
- `8D-10048834` - Spring Retainer SR8: Retainer cracking during forming.
- `8D-10048857` - Bearing Cap BC14: Bore position out of true position.
- `8D-10048880` - Bracket Housing X240: Pocket depth inconsistent across units.
- `8D-10048903` - Trim Panel T18: Paint gloss out of specification.
- `8D-10049010` - Bracket Housing X240: Chatter marks and surface waviness on milled flange.
- `8D-10049020` - Bushing Sleeve B45: Outer diameter taper out of tolerance on CNC lathe.
- `8D-10049030` - Stamping Bracket SB-12: Excessive burr and edge micro-cracks on stamped sheet.
- `8D-10049040` - Electronic Enclosure EE-50: Sink mark and internal void on cosmetic injection molded surface.
- `8D-10049050` - Control Board PCBA-900: Solder bridging short circuit on fine-pitch QFN package.
- `8D-10049060` - Pump Motor Assembly PMA-30: Stripped plastic thread boss during automated screwdriving.
- `8D-10049070` - Bezel Frame BF-10: Pitting corrosion and dark discoloration on anodized aluminum bezel.
- `8D-10049080` - Drive Shaft S150: Insufficient case depth after induction hardening.
- `8D-10049090` - Exhaust Flange EF-80: Internal porosity in robotic fiber laser welded lap joint.
- `8D-10049100` - Pump Housing P90: Hydraulic pressure test leak due to O-ring seal extrusion.
- `8D-10049110` - Guide Rail GR-200: Grinding burn and micro-cracks on precision linear guideway.
- `8D-10049120` - Bracket Housing X240: Coordinate Measuring Machine false rejection on bolt circle true position.

### Internal Regression Harness

Run the four-scenario harness from the repository root:

```powershell
npm run verify:sprint1
```

It exercises a valid case, dirty data, conflicting evidence and a case without a qualifying precedent. It checks validation, mapping, precedent retrieval and stop rules. It does **not** call LLM drafting and does not measure complete AI workflow latency or business impact.

The `sprint1` command name, 90-second target and legacy competition labels are retained from earlier development. They are not AI4Biz scoring rules.

### Additional Development Checks

Run the backend tests and type checks from the repository root:

```powershell
npm test
npm run typecheck
```

Build the frontend from its own directory:

```powershell
cd app/8D_hackathon_ui
npm run build
```

Record the code revision, environment and actual output when reporting a result. Historical PASS records do not verify a later revision.

## Project Structure

- `app/8D_hackathon_ui/` - React and Vite frontend, report workspace, configuration screens and guided tours.
- `srv/` - SAP CAP services, application bootstrap and backend handlers.
- `srv/src/core/ai/` - Chat and embedding provider integration.
- `srv/src/domain/eightd/` - 8D logic, retrieval, drafting, stop conditions and review workflows.
- `db/` - Data model and database resources.
- `scripts/` - Development, database seeding, verification and export tools.
- `mock-data/` - Demonstration fixtures and sample datasets.
- `docs/` - Product requirements, user guides, verification guidance and archives.
- `docs_sprint2/` - Development notes, technical plans and implementation summaries.
- `presentation/` - Presentation sources, research and rehearsal material.
- `.env.example` - Environment configuration template.
- `package.json` - Backend dependencies, CAP profiles and project commands.

## Documentation

- [AI4Biz reference](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21) - Official competition requirements.
- [AI4Biz action plan](docs/HACKATHON-ACTION-PLAN.md) - Submission preparation and business evidence.
- [Implementation priorities](docs_sprint2/plan.md) - Tasks and acceptance conditions.
- [User and judge guide](docs/USER-AND-JUDGE-GUIDE.md) - Product walkthrough and evaluation tools.
- [AI requirements](<docs/AI Requirements - 8D Copilot POC.md>) - POC scope, input data and acceptance criteria.
- [End-to-end guide](docs/8D-COPILOT-E2E-GUIDE.md) - Business and technical workflow.
- [Discipline pipeline guide](docs/8D-DISCIPLINE-PIPELINE-AND-CREATE-DEFECT-GUIDE.md) - Step configuration and defect creation.
- [Testing matrix](docs/8D-TESTING-PLAN-AND-VALIDATION-MATRIX.md) - Scenarios and validation coverage.
- [Graph retrieval and reranking](docs/GRAPH-RETRIEVAL-AND-RERANK.vi.md) - Retrieval architecture and configuration.
- [Archived documents](docs/archive/README.md) - Earlier plans, decisions and verification records.

Some detailed guides are written in Vietnamese. Historical documents retain their original context. Use the current competition reference for submission requirements and the checked-in configuration for runtime commands.

## Troubleshooting

- **Missing database tables:** Check the selected database profile. Initialize a new SQLite database with `npm run deploy:sqlite` and load sample data with `npm run seed:sqlite` when needed.
- **Frontend cannot reach the backend:** Confirm that the backend started on port `4008` and that the Vite proxy uses the same address.
- **Port already in use:** Stop the conflicting local process or update the service and proxy configuration together.
- **Live AI request fails:** Check the endpoint, credentials and model identifier, inspect the logs, then run `scripts/probe-ai.ts` through `npx tsx`.
- **No semantic matches:** Check embedding settings and startup logs. Semantic matching is skipped when embeddings are unavailable or disabled.
- **Unexpected mock responses:** Check `MOCK_LLM` and the active provider configuration, then restart the application.
- **Dependency installation fails:** Resolve the specific registry, package or peer dependency error. Check registry access when authentication is required.
- **A draft cannot progress:** Inspect stop conditions, missing evidence and review requirements. A blocked step may be an expected control.

## Evidence and Limitations

This repository is a prototype with demonstration data and configurable integrations. A deployed instance's behavior depends on its database, provider access, configuration and code revision.

AI output requires review. A suggested root cause is not a verified cause, and an approved draft does not prove that a physical corrective action has been carried out. Business results should distinguish measured observations, sample data, assumptions and future pilot targets.
