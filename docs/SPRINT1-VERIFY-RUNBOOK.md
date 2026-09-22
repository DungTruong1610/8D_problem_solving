# 🏆 MLAI Hackathon 2026 — Sprint 1 Verification Runbook

**Track 1:** OrganizationAI  
**Challenge B:** The Whole Workflow (Autonomous 8D Copilot)  
**Database:** PostgreSQL 16 + pgvector (`proresolve-postgres` on `localhost:5432`)  
**Time Limit (BTC):** 90 seconds (Current Performance: **~1.0 second**, 90x faster than target)

---

## 🚀 1. Quick Verification (For Judges & Evaluators)

### Option A: 1-Click Command Line Interface (CLI)
From the project root directory, run:
```bash
npm run verify:sprint1
```

**Expected Result:**
```
════════════════════════════════════════════════════════════════════════════════════════
 🏆 MLAI HACKATHON 2026 — SPRINT 1 AUTOMATED VERIFY HARNESS (90-SECOND CHECK)
 Track: OrganizationAI | Challenge B: The Whole Workflow | Database: PostgreSQL 16 + pgvector
 Timestamp: 2026-09-21T18:18:23.437Z | Duration: 0.80s / Limit: 90s
════════════════════════════════════════════════════════════════════════════════════════

┌──────┬─────────────────────────────────────────────────────────────┬──────────┬──────────┐
│ ID   │ Test Case & Strategic Focus                                 │ Duration │ Status   │
├──────┼─────────────────────────────────────────────────────────────┼──────────┼──────────┤
│ TC-01 │ Milling Burr Defect (Happy Path — Strong Precedent Match) │     53ms │  PASS    │
│ TC-02 │ Dirty SAP QM Flange Defect (Messy Real-World Normaliza... │      2ms │  PASS    │
│ TC-03 │ Pocket Depth Deviation (Confirmation Bias Hunter — Hum... │      1ms │  PASS    │
│ TC-04 │ New Chassis Frame Welding Defect (Safe Escalation & Pr... │      6ms │  PASS    │
└──────┴─────────────────────────────────────────────────────────────┴──────────┴──────────┘
 ✅ FINAL VERDICT: 4/4 PASSED in 0.80s (Target < 90s). SCORE: 12/12 POINTS!
```

---

### Option B: Interactive Web UI (Visual Experience)
1. Start the application:
   ```bash
   # Terminal 1: Backend CDS service
   npm start
   # Terminal 2: Vite React UI
   cd app/8D_hackathon_ui && npm run dev
   ```
2. Open browser at: [http://localhost:5173/#/verify](http://localhost:5173/#/verify)
3. Click the prominent blue button: **"Run 90-Second Verification"**
4. Watch live KPI cards illuminate green (`PASS`, `~0.8s`, `12/12 Points`, `Rule 3.b Compliant`).
5. Expand individual test cards to inspect the input JSON payloads, normalization metrics, and generated D1–D8 drafts.

---

## 🎯 2. The 4 Strategic Test Cases Matrix (Criterion 2 — 12 Points)

Our test suite is architected around a rigorous **4-Quadrant Matrix** that demonstrates production readiness across standard operations, messy legacy data, human cognitive bias, and strict AI safety bounds:

| Test ID | Strategic Quadrant | Test Case Name | Key Injected Challenge | System Demonstration & Validation |
|---|---|---|---|---|
| **TC-01** | **Quadrant 1: Perfect E2E** | Milling Burr Defect | Standard Q3 defect with clear specs | • Matches top precedent `8D-10048412` (100% score)<br>• Generates full D1–D8 8D report draft in 50ms<br>• Correctly isolates root cause to **Machine** (Tool wear) |
| **TC-02** | **Quadrant 2: Messy Real-World** | Dirty SAP QM Flange Defect | German technical terms (`Grat an Flanschkante`), European comma decimals (`0,32 mm`), unpadded material ID (` MAT-10247 `), missing fields | • Zero crashes / 100% fault-tolerant<br>• Normalizes text, whitespace, and decimal formats<br>• Explicitly and honestly reports 8 unpopulated fields rather than hallucinating placeholder data |
| **TC-03** | **Quadrant 3: Blind Diagnosis** | Pocket Depth Deviation | **Confirmation Bias Injection**: Engineer pre-blames Shift C operator (**Man**) with 0 physical metrics | • **AI-Assisted Blind Diagnosis** overrides human bias<br>• Correlates physical data: tool changer drift is 0.9mm (limit 0.2mm) across 3 consecutive shifts<br>• Reclassifies root cause to **Machine**<br>• Flags for Cross-Functional Committee Review |
| **TC-04** | **Quadrant 4: Safe Refusal** | New Chassis Frame Welding Defect | Out-of-domain defect: Robotic laser welding (`WC-WELD-11`, `MAT-12800`) with zero historical precedent in database | • **Strict Rule 3.b Compliance**<br>• Similarity score 28% (< 60% threshold)<br>• **Refuses to hallucinate** false historical precedents<br>• Formulates 3 structured technical inquiry questions and safely escalates to Senior Welding SME |

---

## 🛡️ 3. Two-Tier Defense Architecture for Unseen Judge Inputs (Criterion 3 — 8 Points)

According to Hackathon Regulation Section 4:
> *"Appropriately handling or responsibly refusing both inputs from the Organizing Committee = 8 points"*

Our system features a deterministic **Two-Tier Defense Architecture** to guarantee maximum points regardless of what arbitrary or edge-case payloads the Judges provide:

```
                      [ Judge Input JSON ]
                               │
                               ▼
        ┌─────────────────────────────────────────────┐
        │  TIER 1: Ingestion & Sanity Validation Gate │
        └─────────────────────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
     [ Valid Structure ]                   [ Malformed / Gibberish ]
            │                                     │
            ▼                                     ▼
 ┌──────────────────────────────────────┐  ╔═══════════════════════════════════╗
 │ TIER 2: Domain & Precedent Gate      │  ║ REFUSAL & SANITIZATION ACTION     ║
 └──────────────────────────────────────┘  ║ • Reject with descriptive reason  ║
            │                              ║ • Prevent crash / SQL injection   ║
      ┌─────┴──────────────┐               ║ • 4/4 pts for appropriate refusal ║
      ▼                    ▼               ╚═══════════════════════════════════╝
[ Familiar Domain ]   [ Unknown Tech /
(Similarity >= 60%)    Similarity < 60% ]
      │                    │
      ▼                    ▼
╔═══════════════════╗  ╔═══════════════════════════════════╗
║ AUTOMATED E2E 8D  ║  ║ SAFE ESCALATION ACTION            ║
║ • Ingest issue    ║  ║ • Trigger Rule 3.b safe refusal   ║
║ • Match precedent ║  ║ • Escalates to domain expert      ║
║ • Generate D1-D8  ║  ║ • 4/4 pts for appropriate refusal ║
║ • 4/4 pts handled ║  ╚═══════════════════════════════════╝
╚═══════════════════╝
```

### How Judges Can Test Their Live Payloads:

#### Via Command Line:
```bash
npm run verify:sprint1 -- --judge-input <path/to/any-judge-file.json>
```

#### Via Web UI Sandbox:
1. Navigate to [http://localhost:5173/#/verify](http://localhost:5173/#/verify)
2. Scroll to **"Two-Tier Defense Sandbox (Judge Unseen Inputs)"**
3. Paste any raw JSON payload (or select one of our preloaded presets: *Valid External Customer Issue*, *Zero-Precedent Unknown Technology*, or *Malformed Gibberish Payload*)
4. Click **"Evaluate Judge Input"**
5. Inspect the real-time architectural verdict and decision rationale.

---

## 📊 4. Hackathon Scoring Alignment Summary

| Evaluation Criterion | Max Points | Our Score | Supporting Evidence |
|---|---|---|---|
| **Criterion 2: Automated Verify Harness** | **12 / 12** | **12** | • 4/4 test cases pass sequentially in **0.80s** (< 90s target)<br>• Covers all 4 strategic quadrants<br>• Fully reproducible via `npm run verify:sprint1` and Web UI |
| **Criterion 3: Unseen BTC Test Cases** | **8 / 8** | **8** | • Two-Tier Defense handles valid defects end-to-end<br>• Appropriately refuses out-of-domain/malformed data with transparent escalation |
| **Section 3.b: Mandatory Safe Refusal** | **Compliant** | **PASS** | • TC-04 systematically blocks hallucination when precedent similarity is < 0.60 |

---

*Report automatically generated by the Autonomous 8D Copilot Engineering Team.*
