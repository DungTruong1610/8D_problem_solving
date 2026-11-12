# Documentation - 8D Copilot

**Team:** UIT_4Lovpe - **Competition:** AI4Biz 2026 - **Organizer:** LIKELION Vietnam

## Start here

- [Project README](../README.md) - Product overview, team, submission requirements and quick start.
- [Local setup](../RUNNING-LOCAL.md) - Installation, database initialization, provider configuration and troubleshooting.
- [User and judge guide](USER-AND-JUDGE-GUIDE.md) - Product navigation, guided tours and the review workflow.
- [Official AI4Biz challenge](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21) - The organizer's competition rules.

## Product and workflow

- [AI requirements](<AI Requirements - 8D Copilot POC.md>) - POC scope, input data, step requirements and acceptance criteria.
- [End-to-end guide](8D-COPILOT-E2E-GUIDE.md) - Business workflow, configuration and end-to-end checks.
- [Discipline pipeline and defect creation](8D-DISCIPLINE-PIPELINE-AND-CREATE-DEFECT-GUIDE.md) - Per-step AI settings and defect input.
- [Business process and AI infrastructure](BUSINESS-AND-AI-INFRASTRUCTURE.md) - D1 to D8 responsibilities, data flow and supporting services.
- [Maintenance history briefing](../presentation/maintenance-history-briefing.md) - Preventive proposals, human decisions and recurrence history.

## Architecture and configuration

- [AI and database architecture](AI-AND-DATABASE-ARCHITECTURE.md) - Data organization, retrieval, analysis and review controls.
- [Graph retrieval and reranking](GRAPH-RETRIEVAL-AND-RERANK.md) - Retrieval architecture, scoring and configuration.
- [Precedent reranking](RERANK-PRECEDENT-RETRIEVAL.md) - The second-stage reranker and its evidence contract.
- [D1 to D4 prompt configuration](AI-SETTINGS-D1-CONFIGURATION.md) - Configuration areas and runtime fallback behavior.
- [Generated step prompts](8d-step-prompts.md) - Prompt and schema reference generated from the application defaults with `npm run export:prompts`.

## Verification

- [Testing and validation matrix](8D-TESTING-AND-VALIDATION-MATRIX.md) - Functional scenarios, expected behavior and validation coverage.
- [Internal verification runbook](SPRINT1-VERIFY-RUNBOOK.md) - Commands, harness coverage and the limits of internal checks.

## Presentation references

Presentation research, scripts and feature briefings are maintained in English. HTML decks, PDFs, DOCX files and videos are separate artifacts and must be reviewed before submission. Available references:

- [Presentation source guide](../presentation/src/README.md) - HTML source and export conventions.
- [Presentation script](../presentation/PRESENTATION-SCRIPT.md) - English speaking notes and handoffs.
- [Demo walkthrough script](../presentation/DEMO-WALKTHROUGH-SCRIPT.md) - Video narration and rehearsal detail.
- [Intro video storyboard](../presentation/video-intro/STORYBOARD.md) - Scenes, captions and screenshot references.
- [Cycle-time evidence summary](../presentation/8D-CYCLE-TIME-SUMMARY.md) - Measured results, deadlines and corrections to earlier research.
- [Cycle-time research](<../presentation/8D Process Cycle Time Research.md>) - The detailed source compilation, read together with the evidence summary.

## Reading evidence

Product requirements describe intended behavior. Current source code, configuration and observed checks establish what a particular revision actually does. Distinguish measured results, historical observations, demo data, assumptions and proposed pilot metrics. Draft preparation time is different from investigation or case-closure time. A documented scenario is not evidence that the scenario has passed.
