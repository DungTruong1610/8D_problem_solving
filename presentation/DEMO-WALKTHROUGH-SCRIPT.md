# AI4Biz demo script: recording of at most 2 minutes and detailed rehearsal

> **AI4Biz submission status:** This is preparation/reference material, not a confirmed final submission. Slides and presentation must be in English; PDF at most 15 slides, demo video at most 2 minutes, final pitch at most 15 minutes plus 5-minute Q&A, with at least 3 presenting members. Any longer English script is a rehearsal reference and must be adapted before submission.

> **Competition context:** [AI4Biz 2026 - LIKELION Vietnam](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21), team UIT_4Lovpe. Competition requirements and submission limits are maintained in that reference; technical examples below are not measured business outcomes unless explicitly documented.

## AI4Biz recording - English, target 1:50

| Time | Screen / action | English narration |
| - | - | - |
| 0:00-0:15 | Case and measurements | "This is a sample machining defect. The engineer needs to connect the inspection results, previous cases and proposed actions." |
| 0:15-0:35 | Precedents and sources | "The copilot retrieves relevant previous cases. The engineer can inspect the source before using a suggestion." |
| 0:35-1:00 | D4 draft | "AI prepares a draft explanation from the available evidence. A draft is not a confirmed root cause." |
| 1:00-1:20 | AI Stops | "When evidence is missing or conflicting, the workflow asks for human review instead of treating the suggestion as approved." |
| 1:20-1:40 | Approval and audit | "The engineer reviews the evidence and records a decision. The audit trail shows who approved or returned the step." |
| 1:40-1:50 | Closing | "Our goal is to reduce preparation effort while keeping quality decisions accountable. Business savings still require a measured pilot." |

Record only features that actually work in the demo session. If the recording removes or accelerates AI waiting time, disclose the edit; do not use the 1:50 video as a latency measurement. Check that the final exported file is at most 2 minutes and contains no sensitive data. The video counts toward the pitch limit of 15 minutes.

## Earlier detailed rehearsal - approximately 3 minutes

The English rehearsal below helps the presenter understand the steps; adapt it to the recording limit before submitting it to AI4Biz.

**Preparation:** Open the intended demo case (DEF-0489 at WC-MILL-07, a burr on the flange edge after milling), then click **Present Tour** in the left sidebar.

- **Next** means clicking **Next** or pressing the Right Arrow key.
- The tour has 11 steps, approximately 15 seconds each.
- Bold figures come from the case screen. For a different case, read the figures actually displayed.

| Step | Screen | Time |
| - | - | - |
| 1-3 | Case, progress, action button | 0:40 |
| 4 | D1 - Team | 0:20 |
| 5-7 | D4 - Root cause | 0:50 |
| 8 | D7 - Preventive maintenance | 0:25 |
| 9-11 | AI Stops, audit log, closing | 0:45 |
| | **Total** | **Approximately 3:00** |

## 1 - Case

> This defect comes from the sample data: the burr on a flange edge exceeds the limit after milling. When the case opened, AI drafted all eight steps from the defect record, inspection measurements and historical case library.

Next.

## 2 - D1-D8 progress

> Look at the left column: every step is still **Not started**, **0/8**. An AI draft does not mean the work is complete. Only steps approved by a person count toward progress.

Next.

## 3 - Action button

> Each step has one action button. The draft stays locked until the engineer clicks **Start the process**, then **Approve** to sign off. No step advances automatically.

Next.

## 4 - D1 - Response team

> At D1, AI proposes a team and explains why: this person **has worked on 5 similar cases**, based on the closed-case library. The engineer accepts each person individually.

Next.

## 5 - D4 - Ishikawa

> Next is D4, root-cause analysis. There are six 6M branches. **Machine** is marked and supported by measurements: the deburring tool has run for **11,800 cycles**, while the replacement limit is **8,000**. A branch without evidence remains **Not assessed**; it is not filled in merely to complete the diagram.

Next.

## 6 - 5-Why

> The five "why" questions go progressively deeper. At the last question, the data cannot distinguish among three possibilities, so AI states clearly that **there is no evidence** instead of guessing.

Next.

## 7 - AI Referee

> A second AI acts as a blinded referee: it sees the measurements but not the engineer's conclusion. If the two disagree, the case stops at D4.

Next.

## 8 - D7 - Preventive maintenance

> At D7, a rule engine uses the approved root cause to propose **preventive maintenance** for **DEF-0489 at WC-MILL-07**, without calling AI. Once the engineer approves it, the proposal becomes part of this defect type's maintenance history.

Next.

## 9 - AI Stops

> This is where AI stops. For example, a measurement is written as **"gemessen 0,32mm"**. AI does not independently decide to interpret that as 0.32 mm; it stops at D4 and asks a quality engineer. Changing an **FMEA** document at D7 exceeds AI's authority, so it asks the process owner. Each stop blocks approval of that step until someone responds.

Next.

## 10 - Audit Log

> Every decision is logged: who approved it, when, and why.

Next.

## 11 - Closing

> **AI drafts, cites sources and knows when to stop. People approve.**

Click Finish.

## Troubleshooting during the demo

- **A step is skipped** (for example, the case has no AI Referee result): the tour advances automatically; continue the narration.
- **The tour opens the wrong case:** click **Skip tour**, open the correct case, then click **Present Tour** again.
- **There are no AI Stops:** say, "For this case, AI completed its work without needing to stop," then continue.
