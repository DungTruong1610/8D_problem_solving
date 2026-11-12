# 8D Copilot - Intro Video Storyboard

> **AI4Biz submission status:** This is preparation material, not a confirmed final submission. Slides and the presentation must be in English. The submission PDF is limited to 15 slides, the demo video to 2 minutes, and the final pitch to 15 minutes plus 5 minutes of Q&A. At least 3 team members must present. Verify the exported assets separately.

> **Competition context:** [AI4Biz 2026 - LIKELION Vietnam](https://app.notion.com/p/likelion/AI-FOR-BUSINESS-INNOVATION-3f744860a4f480ab920ddb3911a25c21), team UIT_4Lovpe. Demo values below describe the captured sample case, not measured production outcomes or current test results.

> **Local production assets:** The `images/` paths below refer to screenshots and coordinates in the local workspace. Updating this Markdown does not publish those assets. Video production requires the original files and a separate duration check.

The storyboard contains 17 main scenes and one optional scene, following the order users encounter in the application. Each scene has:

- A clean screenshot: the 1920 x 1080 background captured from the application.
- A numbered screenshot: the same image with red frames and numbered circles.
- On-screen text: a scene title and a short subtitle.
- A callout table: numbered boxes, nearby captions and optional narration.

Exact box coordinates are stored in `images/boxes.json` as pixels on a 1920 x 1080 image. Use them to align highlights in Premiere, CapCut or After Effects.

From scene 9 onward, every screenshot shows the same demo case, **8D-10048788**: chatter marks on a rotor shaft after grinding, 88 defective units, cylindrical grinding unit 4. In the captured state, D1 to D6 have been completed in sequence and D7 is in progress.

## Scene index

| Scene | Topic | Screen | Suggested duration |
| - | - | - | - |
| 1 | 8D worklist | 8D Reports | 6 s |
| 2 | Create an 8D from a recorded defect | 8D Reports -> Create 8D Report | 6 s |
| 3 | Import a case as JSON | Create 8D Report -> JSON | 6 s |
| 4 | Inspection history | Master Data -> Inspection History | 6 s |
| 5 | Starting an 8D is a decision | Master Data -> Defect Records | 6 s |
| 6 | Closed-case library | Master Data -> Closed Case Library | 5 s |
| 7 | Where AI participates | AI Configuration | 6 s |
| 8 | Precedent retrieval | AI Configuration | 6 s |
| 9 | AI stop conditions | Case -> AI Stops | 7 s |
| 10 | Decision audit trail | Case -> Audit Log | 7 s |
| 11 | Eight disciplines in sequence | Case -> 8D Disciplines | 6 s |
| 12 | Human-controlled progression | Case -> D7 | 6 s |
| 13 | AI-generated draft | Case -> D5 | 6 s |
| 14 | D4 root-cause analysis | Case -> D4 | 8 s |
| 15 | AI Referee as a second assessment | Case -> D4 -> AI Referee | 8 s |
| 16 | Traceable evidence | Case -> Evidence | 6 s |
| 17 | Learning from qualified precedents | Case -> Evidence -> Precedents | 6 s |
| 18 | Case overview | Case -> Case Overview | 5 s, optional |

The suggested durations total 107 seconds without scene 18 and 112 seconds with it. Leave room for transitions and verify the final export stays within 2 minutes. Accelerate or cut processing waits; this edited video does not measure end-to-end analysis latency.

## Part 1. Open and create an 8D

### Scene 1. 8D worklist

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/01-worklist.jpg` | `images/01-worklist-marked.jpg` |

**Title:** Every 8D case, with urgent work first
**Subtitle:** Prioritized by severity, customer commitments and case age.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Most urgent case | This customer complaint is 18 days overdue in the captured demo, so it appears first. |
| 2 | Filter your work | My cases, overdue, critical and awaiting approval. Each chip displays its case count. |
| 3 | Progress across eight steps | The count represents approved steps, not steps merely drafted by AI. |
| 4 | Start a new 8D | Open the case-creation dialog. |

### Scene 2. Create an 8D from a recorded defect

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/02-create-pick.jpg` | `images/02-create-pick-marked.jpg` |

**Title:** Each 8D starts with a recorded defect
**Subtitle:** Select an existing defect. A defect can have one linked 8D.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Q1 customer - Q2 supplier - Q3 internal | Filter by defect origin. |
| 2 | Defects without an 8D | Defects that already have a linked report are excluded from this selection. |
| 3 | AI drafts in the background | Create & Analyze extracts the facts and prepares D1 to D8. The earlier demo took approximately 3 minutes; this is draft preparation, not case closure. |

### Scene 3. Import a case as JSON

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/03-create-json.jpg` | `images/03-create-json-marked.jpg` |

**Title:** A case from another system? Import JSON
**Subtitle:** Upload a file, select a sample or paste the data.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Upload a JSON file | The browser checks the input, and the server validates it again. |
| 2 | Select a sample case | The sample starts with symptoms and context, without a completed cause, action or team. |
| 3 | Paste JSON directly | Cases created this way are labeled "Imported as JSON". |

## Part 2. Source data

### Scene 4. Inspection history

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/04-inspection-history.jpg` | `images/04-inspection-history-marked.jpg` |

**Title:** Base the analysis on measurements
**Subtitle:** Four datasets follow the business workflow.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Inspections -> Defects -> Closed cases -> Catalogs | The tabs follow the business data chain. |
| 2 | One characteristic, one lot, one result | D2 Is / Is-Not analysis compares failing lots with passing lots. |
| 3 | Enter records or import JSON | Import inspection results in bulk. |

### Scene 5. Starting an 8D is a decision

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/05-defect-records.jpg` | `images/05-defect-records-marked.jpg` |

**Title:** Recording a defect does not automatically open an 8D
**Subtitle:** Escalating a defect to a structured investigation is a deliberate decision.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Record a new defect | Select the defect code, material, batch and equipment from the available catalogs. |
| 2 | Start 8D | Create a report for this defect and start the analysis. |
| 3 | Open 8D | When the defect already has a report, open that report instead of creating a duplicate. |

### Scene 6. Closed-case library

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/06-closed-case-library.jpg` | `images/06-closed-case-library-marked.jpg` |

**Title:** The system's case memory
**Subtitle:** Completed cases become precedents for future investigations.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Completed cases | Open investigations do not yet provide a completed case outcome for this library. |
| 2 | Import historical cases | Bring prior case records into the library in bulk. |

## Part 3. AI configuration

### Scene 7. Where AI participates

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/07-ai-chain.jpg` | `images/07-ai-chain-marked.jpg` |

**Title:** Two AI-supported stages in the displayed workflow
**Subtitle:** People remain responsible for the input records and final decisions.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | People inspect, record and open the case | The initial business actions supply the investigation context. |
| 2 | Retrieve precedents and draft D1 to D8 | These highlighted stages use the configured retrieval and AI services. |
| 3 | People review and close | A completed case can return to the precedent library. |

### Scene 8. Precedent retrieval

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/08-retrieval-engine.jpg` | `images/08-retrieval-engine-marked.jpg` |

**Title:** Retrieve cases through recorded relationships
**Subtitle:** Connect material, equipment and defect codes.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Knowledge Graph | The displayed configuration follows recorded relationships and exposes evidence paths. |
| 2 | Alternative retrieval | Configured scoring and embedding criteria provide another retrieval path. |
| 3 | Deployment-dependent fallback | Verify the active engine and fallback configuration before recording. The project also supports environments without SAP HANA. |

## Part 4. Work through one case

### Scene 9. AI stop conditions

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/09-ai-stops.jpg` | `images/09-ai-stops-marked.jpg` |

**Title:** Stop and ask the responsible person
**Subtitle:** AI suggestions do not authorize controlled process changes.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Authority required | Changing a controlled SOP requires human authorization. This demo stop blocks D7 approval. |
| 2 | Ask the process owner | Who approves this change, and for which document version? |
| 3 | Resolve | Record the responsible person's response in the case audit trail. |

### Scene 10. Decision audit trail

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/10-audit-log.jpg` | `images/10-audit-log-marked.jpg` |

**Title:** Review decisions leave a trace
**Subtitle:** Who acted, when, and with which recorded context.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Actor and timestamp | The demo record shows D4 approved by admin on October 14, 2026 at 15:33. |
| 2 | Decision-time context | The saved snapshot includes selected root-cause, measurement and precedent information. |
| 3 | Before and after | Draft -> Approved; InProgress -> Completed. |
| 4 | Draft provenance | Trace the draft's recorded model and analysis timestamp. |

### Scene 11. Eight disciplines in sequence

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/11-eight-disciplines.jpg` | `images/11-eight-disciplines-marked.jpg` |

**Title:** Eight steps, unlocked in sequence
**Subtitle:** Complete the preceding step before progressing.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Six of eight steps complete | Overall progress for the captured case. |
| 2 | D1 to D6 approved | Team, problem definition, containment, root cause, corrective action and verification. |
| 3 | D7 in progress | The currently active step. |
| 4 | D8 not started | Awaiting completion of D7. |

### Scene 12. Human-controlled progression

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/12-next-action.jpg` | `images/12-next-action-marked.jpg` |

**Title:** People control step progression
**Subtitle:** The next-action button shows what comes next.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Start before editing | A step begins read-only. Select "Start the process" to work on it. |
| 2 | Approve | Approval depends on the required conditions. Inspect any unmet requirements shown by the interface. |
| 3 | D7 in the stepper | The stepper and action button reflect the same case state. |

### Scene 13. AI-generated draft

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/13-ai-draft.jpg` | `images/13-ai-draft-marked.jpg` |

**Title:** AI proposes; people accept
**Subtitle:** D5 corrective actions build on the D4 root-cause assessment.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Suggested actions | Each proposal names the required role. Accepting it creates an actionable task. |
| 2 | Assigned tasks | Each task links to its cause category and has its own status. |

### Scene 14. D4 root-cause analysis

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/14-d4-root-cause.jpg` | `images/14-d4-root-cause-marked.jpg` |

**Title:** D4: investigate the root cause
**Subtitle:** Evaluate each category against evidence.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | The 6M fishbone | People, Machine, Method, Material, Measurement and Environment. The sample explains why five categories were excluded. |
| 2 | Machine as the selected cause | In this demo dataset, every failing record belongs to WHEEL1 and every WHEEL2 record passes. This is a case-specific observation. |
| 3 | The 5-Why chain | The sample chain ends with WHEEL1 dynamic imbalance and mounting runout. |
| 4 | AI Referee | Open a separate assessment of the available evidence. |

### Scene 15. AI Referee as a second assessment

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/15-ai-referee.jpg` | `images/15-ai-referee-marked.jpg` |

**Title:** A separate assessment
**Subtitle:** The referee evaluates evidence without seeing the engineer's recorded conclusion.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Independent hypothesis - displayed confidence 90% | The engineer's 5-Why chain and recorded root cause are withheld. The displayed confidence is model output, not measured accuracy. |
| 2 | Compare the conclusions | A disagreement prompts the engineer to review the evidence. |
| 3 | Sample hypothesis: Machine | WHEEL1 imbalance causes vibration during grinding. |
| 4 | Human verification remains necessary | Check the hypothesis against the source records. |

### Scene 16. Traceable evidence

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/16-evidence.jpg` | `images/16-evidence-marked.jpg` |

**Title:** Inspect the source behind each value
**Subtitle:** The captured example shows 17 of 17 cited records available to inspect.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Three source categories | Recorded facts, external or assumed information, and AI inference. |
| 2 | Label unsupported proposals | A proposed step is marked "Suggested by AI". |
| 3 | Inspection measurements | The demo records surface roughness Ra of 2.8 micrometers against a 0.8-micrometer limit. |

### Scene 17. Learning from qualified precedents

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/17-precedents.jpg` | `images/17-precedents-marked.jpg` |

**Title:** Return no precedent when none qualifies
**Subtitle:** An explicit empty result is more useful than a weak match presented as evidence.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Identify the retrieval engine | The interface records which engine retrieved candidates for this case. |
| 2 | No qualifying case in the captured result | This screenshot reports 22 candidates and none meeting its configured 3-of-16 threshold. Thresholds depend on the active profile. |

### Scene 18. Case overview, optional

| Clean screenshot | Numbered screenshot |
| - | - |
| `images/18-case-overview.jpg` | `images/18-case-overview-marked.jpg` |

**Title:** The whole case on one page
**Subtitle:** Facts, commitments and a concise summary.

| Box | On-screen caption | Narration |
| - | - | - |
| 1 | Case facts | Origin, material, batch, defect code, equipment and quantities. |
| 2 | Editable commitments | Completion deadline and coordinator. The sample internal defect has no automatic customer SLA deadline. |
| 3 | AI-drafted internal summary | A customer-complaint case can also include a customer-facing version for review. |

## Editing notes

- Use red `#C00000` for highlight frames and numbered circles, matching the application accent color.
- Reveal boxes in numeric order, with roughly 1.5 to 2 seconds per callout. Place the caption next to the box, then fade it out.
- Use clean screenshots as zoom backgrounds. Coordinates in `images/boxes.json` are pixels on the original 1920 x 1080 canvas.
- Screenshot data comes from the local demo database. Scene 10 filters the audit trail to D4 because other rows contain testing notes.
- The case audit trail is a product feature, distinct from a project development journal.
