# 8D Step Prompts

Sinh tự động bằng `node scripts/export-step-prompts.mjs` — **đừng sửa file này**.
Nguồn: `srv/src/domain/eightd/prompts.ts` (`DEFAULT_DISCIPLINE_GUIDE`) và
`srv/src/domain/eightd/precedent/defaults.ts` (`STRUCTURED_CONFIG_OVERRIDES`).

## Cách nhanh: không cần dán tay

Bật backend rồi chạy:

```bash
npm run push:prompts          # cả 8 bước
npm run push:prompts -- D4    # riêng D4
```

Lệnh này xoá và seed lại cấu hình từ code, đúng bằng nội dung file này.
⚠️ Chỉnh tay trên trang AI Settings của các bước đó sẽ mất — lệnh có hỏi lại.

## Dán tay: mỗi bước có BA ô, không phải một

Prompt một mình là chưa đủ. Giới hạn độ dài từng ô, danh sách giá trị hợp lệ,
hình dạng phần tử mảng và mô tả từng trường đều nằm trong hai schema JSON —
và **chính chúng mới ràng buộc model lúc sinh token**, còn prompt chỉ là lời
khuyên. Dán prompt mà bỏ schema thì phần lớn thay đổi không có tác dụng, và
không có gì báo cho bạn biết.

Runtime đọc prompt bằng `combinedPrompt ?? systemPrompt`, nên **`combinedPrompt`
che hoàn toàn `systemPrompt`** chứ không bổ sung cho nó. Dán nhầm ô thì lưu vẫn
thành công, UI vẫn hiện, và prompt không đổi.

| Bước | Ô cần dán | Số từ prompt |
|---|---|---|
| D1 — Establish the Team | `combinedPrompt` + `inputSchemaJson` + `formSchemaJson` | 460 |
| D2 — Describe the Problem | `combinedPrompt` + `inputSchemaJson` + `formSchemaJson` | 495 |
| D3 — Interim Containment Actions | `combinedPrompt` + `inputSchemaJson` + `formSchemaJson` | 208 |
| D4 — Root Cause Analysis | `combinedPrompt` + `inputSchemaJson` + `formSchemaJson` | 762 |
| D5 — Permanent Corrective Actions | `combinedPrompt` + `inputSchemaJson` + `formSchemaJson` | 248 |
| D6 — Verify Effectiveness | `combinedPrompt` + `inputSchemaJson` + `formSchemaJson` | 142 |
| D7 — Prevent Recurrence | `combinedPrompt` + `inputSchemaJson` + `formSchemaJson` | 270 |
| D8 — Closure and Recognition | `combinedPrompt` + `inputSchemaJson` + `formSchemaJson` | 167 |

---

## D1 — Establish the Team

Build an explainable cross-functional team with per-member responsibilities, selection reasons, and source traceability.

### 1. Prompt → ô `combinedPrompt`

Dòng `stepCode = 'D1'` trong bảng `StepPrompts`.

```text
Produce TWO separate lists, not one blended list.

  1. Suggested roles - the functions this work actually needs (Quality
     Engineer, Production Engineer, and so on), taken from the teams of the
     precedent cases that cleared the similarity threshold.
  2. Suggested individuals - the specific people who served on those teams,
     ranked by how many of the precedent cases each one worked. State that
     count for every name.

Cite the precedent behind every role and every name with precedents#N.

Precedents are scored: work centre +4, defect code +4 (or +2 when only the
defect text overlaps), material +3 (or +1 for the same material family), out
of 11. Below 3 is not a precedent. When no case clears 3, write that no team
suggestion is available and the team must be assigned manually. That is the
correct answer - a plausible list of invented roles is not.

Where this case already records a team, name the leader and members with
their functions and say in one or two sentences why that skill mix fits THIS
defect. Bring in a precedent person only to cover a capability the current
team lacks.

Never name a person who is not in the current team or a precedent team.
Never output team.assignedRoster: the quality engineer fills that table in on
the report screen, and email and telephone auto-fill from the business
partner record without your help.

## FIELD MECHANICS
Determine the capabilities required by the actual defect before selecting people.
Set selectionMethod to exactly one allowed value: Current case team, Precedent recommendation, Hybrid, or Roles only - assignment required.
Prefer identities from team.leader and team.members. Use precedents#N.team only to cover a capability missing from the current team.
For every roster row separate organizationalRole, assigned8DRole, and caseResponsibility. Do not put a job title in caseResponsibility.
For every roster row explain selectionReason and provide sourceType, sourcePath, and sourceCase when applicable.
sourcePath must resolve to team.leader, team.members#N, or precedents#N.team#M. Never invent a person.
If a required role has no grounded person, use name Unassigned, sourceType unassigned, sourcePath team.gaps, and readinessStatus Needs assignment.
Set readinessStatus to exactly Ready, Partial, or Needs assignment. Put the explanation only in readinessRationale.
Explain the mix of current-case and precedent sources in sourceSummary, and list all supporting paths in sources.
Never output team.assignedRoster. The quality engineer fills that table in on the report screen.
Set servedOnCount on every precedent-sourced roster row to the number of qualifying precedent cases that person served on, and order the roster by it, highest first. A person taken from the current case has no count - omit it.
When no precedent clears the minimum score, set team.suggestionStatus to exactly "No team suggestion available; assign manually." and set selectionMethod to "Roles only - assignment required". Do not invent a roster.
```

### 2. Data Schema → ô `inputSchemaJson`

```json
{
  "type": "object",
  "properties": {
    "team.objective": {
      "type": "string",
      "title": "Team objective",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "team.selectionMethod": {
      "type": "string",
      "title": "Selection method",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "enum": [
        "Current case team",
        "Precedent recommendation",
        "Hybrid",
        "Roles only - assignment required"
      ]
    },
    "team.problemCapabilities": {
      "type": "array",
      "title": "Capabilities required by this problem",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    },
    "team.selectionRationale": {
      "type": "string",
      "title": "How the team was selected",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "team.roster": {
      "type": "array",
      "title": "AI suggest",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the person name, or \"Unassigned\". No role, no reasoning."
          },
          "organizationalRole": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY their job title in the organisation, e.g. \"Quality Engineer\"."
          },
          "assigned8DRole": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY their role in THIS 8D, e.g. \"Team Leader\" or \"Team Member\"."
          },
          "caseResponsibility": {
            "type": "string",
            "maxLength": 200,
            "description": "What this person is accountable for here. Never a job title."
          },
          "selectionReason": {
            "type": "string",
            "maxLength": 220,
            "description": "Why this person, in one line. Do not repeat the name or the role."
          },
          "servedOnCount": {
            "type": "integer",
            "description": "How many qualifying precedent cases this person served on. Rank the roster by this value, descending."
          },
          "sourceType": {
            "type": "string",
            "enum": [
              "current_case",
              "precedent",
              "unassigned"
            ]
          },
          "sourcePath": {
            "type": "string",
            "maxLength": 80,
            "description": "ONLY the resolvable path: team.leader, team.members#N, precedents#N.team#M, or team.gaps."
          },
          "sourceCase": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY the precedent notification id, when the person came from a precedent."
          }
        },
        "required": [
          "name",
          "organizationalRole",
          "assigned8DRole",
          "caseResponsibility",
          "selectionReason",
          "sourceType",
          "sourcePath"
        ]
      }
    },
    "team.assignedRoster": {
      "type": "array",
      "title": "Decision table",
      "description": "Filled in by the quality engineer on the report screen. The AI never writes this.",
      "x-source": "manual_input",
      "items": {
        "type": "object",
        "properties": {
          "partnerId": {
            "type": "string"
          },
          "partnerName": {
            "type": "string"
          },
          "functionTitle": {
            "type": "string"
          },
          "partnerRole": {
            "type": "string",
            "enum": [
              "8D Team Leader",
              "8D Team Member"
            ]
          }
        }
      }
    },
    "team.readinessStatus": {
      "type": "string",
      "title": "Team readiness",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "enum": [
        "Ready",
        "Partial",
        "Needs assignment"
      ]
    },
    "team.readinessRationale": {
      "type": "string",
      "title": "Readiness assessment",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "team.uncoveredCapabilities": {
      "type": "array",
      "title": "Uncovered capabilities",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    },
    "team.sourceSummary": {
      "type": "string",
      "title": "Where the team recommendation came from",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "team.suggestionStatus": {
      "type": "string",
      "title": "Suggestion status",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "sources": {
      "type": "array",
      "title": "Source records",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "team.objective",
    "team.selectionMethod",
    "team.problemCapabilities",
    "team.selectionRationale",
    "team.roster",
    "team.readinessStatus",
    "team.readinessRationale",
    "team.sourceSummary"
  ],
  "additionalProperties": false
}
```

### 3. Form Editor → ô `formSchemaJson`

```json
{
  "fields": [
    {
      "key": "team.objective",
      "label": "Team objective",
      "widget": "callout",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minLength": 20,
        "maxLength": 260
      }
    },
    {
      "key": "team.selectionMethod",
      "label": "Selection method",
      "widget": "status",
      "dataType": "string",
      "colSpan": 4,
      "constraints": {
        "required": true,
        "enum": [
          "Current case team",
          "Precedent recommendation",
          "Hybrid",
          "Roles only - assignment required"
        ]
      }
    },
    {
      "key": "team.problemCapabilities",
      "label": "Capabilities required by this problem",
      "widget": "tag-selector",
      "dataType": "array",
      "colSpan": 8,
      "constraints": {
        "required": true,
        "minItems": 1
      },
      "items": {
        "type": "string"
      }
    },
    {
      "key": "team.selectionRationale",
      "label": "How the team was selected",
      "widget": "markdown",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minLength": 60,
        "maxLength": 1600
      }
    },
    {
      "key": "team.roster",
      "label": "AI suggest",
      "widget": "ai-suggest",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minItems": 1
      },
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the person name, or \"Unassigned\". No role, no reasoning."
          },
          "organizationalRole": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY their job title in the organisation, e.g. \"Quality Engineer\"."
          },
          "assigned8DRole": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY their role in THIS 8D, e.g. \"Team Leader\" or \"Team Member\"."
          },
          "caseResponsibility": {
            "type": "string",
            "maxLength": 200,
            "description": "What this person is accountable for here. Never a job title."
          },
          "selectionReason": {
            "type": "string",
            "maxLength": 220,
            "description": "Why this person, in one line. Do not repeat the name or the role."
          },
          "servedOnCount": {
            "type": "integer",
            "description": "How many qualifying precedent cases this person served on. Rank the roster by this value, descending."
          },
          "sourceType": {
            "type": "string",
            "enum": [
              "current_case",
              "precedent",
              "unassigned"
            ]
          },
          "sourcePath": {
            "type": "string",
            "maxLength": 80,
            "description": "ONLY the resolvable path: team.leader, team.members#N, precedents#N.team#M, or team.gaps."
          },
          "sourceCase": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY the precedent notification id, when the person came from a precedent."
          }
        },
        "required": [
          "name",
          "organizationalRole",
          "assigned8DRole",
          "caseResponsibility",
          "selectionReason",
          "sourceType",
          "sourcePath"
        ]
      }
    },
    {
      "key": "team.assignedRoster",
      "label": "Decision table",
      "widget": "decision-table",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "xSource": "manual_input",
      "description": "Filled in by the quality engineer on the report screen. The AI never writes this.",
      "items": {
        "type": "object",
        "properties": {
          "partnerId": {
            "type": "string"
          },
          "partnerName": {
            "type": "string"
          },
          "functionTitle": {
            "type": "string"
          },
          "partnerRole": {
            "type": "string",
            "enum": [
              "8D Team Leader",
              "8D Team Member"
            ]
          }
        }
      }
    },
    {
      "key": "team.readinessStatus",
      "label": "Team readiness",
      "widget": "status",
      "dataType": "string",
      "colSpan": 3,
      "constraints": {
        "required": true,
        "enum": [
          "Ready",
          "Partial",
          "Needs assignment"
        ]
      }
    },
    {
      "key": "team.readinessRationale",
      "label": "Readiness assessment",
      "widget": "markdown",
      "dataType": "string",
      "colSpan": 9,
      "constraints": {
        "required": true,
        "minLength": 30,
        "maxLength": 500
      }
    },
    {
      "key": "team.uncoveredCapabilities",
      "label": "Uncovered capabilities",
      "widget": "warning-list",
      "dataType": "array",
      "colSpan": 6,
      "constraints": {},
      "items": {
        "type": "string"
      }
    },
    {
      "key": "team.sourceSummary",
      "label": "Where the team recommendation came from",
      "widget": "markdown",
      "dataType": "string",
      "colSpan": 6,
      "constraints": {
        "required": true,
        "minLength": 30,
        "maxLength": 500
      }
    },
    {
      "key": "team.suggestionStatus",
      "label": "Suggestion status",
      "widget": "callout",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {}
    },
    {
      "key": "sources",
      "label": "Source records",
      "widget": "evidence-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {
        "pattern": "^(team\\.|precedents#)"
      },
      "items": {
        "type": "string"
      }
    }
  ],
  "groups": [
    {
      "id": "d1-decision-table",
      "label": "Decision Table",
      "fieldKeys": [
        "team.assignedRoster",
        "team.suggestionStatus"
      ],
      "width": "100",
      "columns": 12,
      "order": 10
    }
  ]
}
```

---

## D2 — Describe the Problem

Describe the problem as structured 5W2H, Is/Is-Not, measurements, and explicit gaps.

### 1. Prompt → ô `combinedPrompt`

Dòng `stepCode = 'D2'` trong bảng `StepPrompts`.

```text
Write the problem twice from the SAME facts - one short paragraph, then
the 5W2H grid. They must agree; the grid is not a second analysis.

  What      the defect by its catalogue classification - code GROUP and
            defect code together, with the catalogue description, e.g.
            "QM-DIM / 0004 - Bore diameter out of tolerance". The code alone
            is not a key: it is only unique inside its group. Where
            product.defectCodeGroup is empty, give the code and say the group
            is not recorded - do not guess it from the code.
            Then the measurement that proves it: measured value against
            specification, with units, and say plainly whether it is out of
            tolerance. Quote the specification as the recorded limits
            (specLowerLimit / specUpperLimit / specUom) when they are set;
            specValue is display text and may be free prose. Where a row
            carries a valuation, that is the inspector's judgement - report
            it as the verdict, and do not overturn it with your own reading
            of the numbers. Where outOfSpec is null, say the row was not
            judged rather than deciding it yourself
  Where     the work centre, by ID and name
  When      the date the defect was found
  Who       for a customer complaint, cite the customer contact. For an
            internal defect, cite the reporter (e.g. responsibility.reportedBy)
            or coordinator if recorded; if no reporter is tracked in system,
            state that it is not tracked rather than inventing anyone
  How       how the defect surfaced: in-process inspection, customer
            complaint, final audit
  How many  the quantity or extent affected, and the batch it belongs to

Every box names the field it came from. A box with no source says so; it does
not get a plausible value.

Is / Is-Not narrows the root cause. The IS and IS NOT values are COMPUTED by
the system from the historical inspection lots: it groups them by equipment,
counts the nonconforming rate per group, and takes the sharpest contrast. You
do not choose them and you must not restate or alter them.

Your job is problem.isIsNotBasis. Format it with clean sections:
  - Detail by characteristic: For each measured characteristic, state the lot IDs and measurements contrasting affected equipment vs conforming equipment.
  - Synthesis & Conclusion: State plainly that both groups share the same material and process, isolating the equipment/fixture as the sole distinguishing variable for D4.

When the system reports that no comparison was possible, do not invent one.
Leave the basis empty and let the status line speak for itself.

## FIELD MECHANICS
Populate separate fields for statement, What, Where, When, Who, extent, and impact.
Return measured evidence as table rows.
Use verified facts only and expose missing facts in problem.gaps.
Do not hide all 5W2H information inside one narrative field.
Set problem.how to how the defect surfaced, for example in-process inspection or customer complaint.
Put the reasoning behind Is / Is-Not into problem.isIsNotBasis, citing the records it rests on.
Never output problem.complaintReference or problem.statementOverride. Those come from SAP and from the quality engineer.
```

### 2. Data Schema → ô `inputSchemaJson`

```json
{
  "type": "object",
  "properties": {
    "problem.complaintReference": {
      "type": "string",
      "title": "Complaint reference",
      "description": "Read from the SAP QM customer reference on the case. The AI never writes this.",
      "x-source": "sap_qm"
    },
    "problem.statement": {
      "type": "string",
      "title": "Problem statement",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.statementOverride": {
      "type": "string",
      "title": "Problem statement (edited)",
      "description": "Edited by the quality engineer on the report screen. The AI never writes this.",
      "x-source": "manual_input"
    },
    "problem.what": {
      "type": "string",
      "title": "What",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.where": {
      "type": "string",
      "title": "Where",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.when": {
      "type": "string",
      "title": "When",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.who": {
      "type": "string",
      "title": "Who",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.how": {
      "type": "string",
      "title": "How",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.extent": {
      "type": "string",
      "title": "How Many",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.impact": {
      "type": "string",
      "title": "Business / customer impact",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.is": {
      "type": "array",
      "title": "Is",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    },
    "problem.isNot": {
      "type": "array",
      "title": "Is not",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    },
    "problem.isIsNotStatus": {
      "type": "string",
      "title": "Is / Is-Not status",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.isIsNotBasis": {
      "type": "string",
      "title": "Is / Is-Not basis",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "problem.measuredEvidence": {
      "type": "array",
      "title": "Measured evidence",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "object",
        "properties": {
          "characteristic": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the characteristic name, e.g. \"Burr height\". No value, no verdict."
          },
          "measured": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY the measured value with its unit, e.g. \"0.32 mm\"."
          },
          "specification": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY the specification limit with its unit, e.g. \"max 0.10 mm\"."
          },
          "assessment": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the verdict, e.g. \"Out of tolerance\" or \"Within spec\". No restatement of the numbers."
          }
        }
      }
    },
    "problem.gaps": {
      "type": "array",
      "title": "Missing facts",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    },
    "sources": {
      "type": "array",
      "title": "Evidence and traceability",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "problem.statement",
    "problem.what",
    "problem.where",
    "problem.extent"
  ],
  "additionalProperties": false
}
```

### 3. Form Editor → ô `formSchemaJson`

```json
{
  "fields": [
    {
      "key": "problem.complaintReference",
      "label": "Complaint reference",
      "widget": "complaint-reference",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {},
      "xSource": "sap_qm",
      "description": "Read from the SAP QM customer reference on the case. The AI never writes this."
    },
    {
      "key": "problem.statement",
      "label": "Problem statement",
      "widget": "problem-statement",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minLength": 30,
        "maxLength": 600
      }
    },
    {
      "key": "problem.statementOverride",
      "label": "Problem statement (edited)",
      "widget": "text",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {},
      "xSource": "manual_input",
      "description": "Edited by the quality engineer on the report screen. The AI never writes this."
    },
    {
      "key": "problem.what",
      "label": "What",
      "widget": "w2h-cell",
      "dataType": "string",
      "colSpan": 4,
      "constraints": {
        "required": true
      }
    },
    {
      "key": "problem.where",
      "label": "Where",
      "widget": "w2h-cell",
      "dataType": "string",
      "colSpan": 4,
      "constraints": {
        "required": true
      }
    },
    {
      "key": "problem.when",
      "label": "When",
      "widget": "w2h-cell",
      "dataType": "string",
      "colSpan": 4,
      "constraints": {}
    },
    {
      "key": "problem.who",
      "label": "Who",
      "widget": "w2h-cell",
      "dataType": "string",
      "colSpan": 4,
      "constraints": {}
    },
    {
      "key": "problem.how",
      "label": "How",
      "widget": "w2h-cell",
      "dataType": "string",
      "colSpan": 4,
      "constraints": {}
    },
    {
      "key": "problem.extent",
      "label": "How Many",
      "widget": "w2h-cell",
      "dataType": "string",
      "colSpan": 4,
      "constraints": {
        "required": true
      }
    },
    {
      "key": "problem.impact",
      "label": "Business / customer impact",
      "widget": "text",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {}
    },
    {
      "key": "problem.is",
      "label": "Is",
      "widget": "is-box",
      "dataType": "array",
      "colSpan": 6,
      "constraints": {},
      "items": {
        "type": "string"
      }
    },
    {
      "key": "problem.isNot",
      "label": "Is not",
      "widget": "isnot-box",
      "dataType": "array",
      "colSpan": 6,
      "constraints": {},
      "items": {
        "type": "string"
      }
    },
    {
      "key": "problem.isIsNotStatus",
      "label": "Is / Is-Not status",
      "widget": "callout",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {}
    },
    {
      "key": "problem.isIsNotBasis",
      "label": "Is / Is-Not basis",
      "widget": "markdown",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {}
    },
    {
      "key": "problem.measuredEvidence",
      "label": "Measured evidence",
      "widget": "table",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "object",
        "properties": {
          "characteristic": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the characteristic name, e.g. \"Burr height\". No value, no verdict."
          },
          "measured": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY the measured value with its unit, e.g. \"0.32 mm\"."
          },
          "specification": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY the specification limit with its unit, e.g. \"max 0.10 mm\"."
          },
          "assessment": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the verdict, e.g. \"Out of tolerance\" or \"Within spec\". No restatement of the numbers."
          }
        }
      }
    },
    {
      "key": "problem.gaps",
      "label": "Missing facts",
      "widget": "warning-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    },
    {
      "key": "sources",
      "label": "Evidence and traceability",
      "widget": "evidence-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    }
  ],
  "groups": [
    {
      "id": "d2-ai-result",
      "label": "AI-generated problem description",
      "fieldKeys": [
        "problem.complaintReference",
        "problem.statement",
        "problem.what",
        "problem.where",
        "problem.when",
        "problem.who",
        "problem.how",
        "problem.extent",
        "problem.is",
        "problem.isNot",
        "problem.isIsNotStatus",
        "problem.isIsNotBasis"
      ],
      "width": "100",
      "columns": 12,
      "order": 10
    }
  ]
}
```

---

## D3 — Interim Containment Actions

Build a structured containment plan with ownership, protection, origin, rationale, and gaps.

### 1. Prompt → ô `combinedPrompt`

Dòng `stepCode = 'D3'` trong bảng `StepPrompts`.

```text
Containment protects the customer and the line WHILE the cause is still
unknown. Keep every containment action description simple, direct and concise
(e.g., "Quarantine remaining stock from batch B-49172 and 100% burr check before packing").

Work in this order:
  1. If this case already records containment actions, report them cleanly -
     stating the action description and its status.
  2. Only when nothing is recorded, propose the containment action from the
     highest-scoring precedent cleanly and adapt the batch and quantity.

Do not write long verbose paragraphs inside the action text.

## FIELD MECHANICS
Return containment.actions as rows with action, owner, status, origin.
Assign an owner to every containment action from the D1 team roster (team.roster or team.leader/members), formatted strictly as "Name (Role)" (e.g. "Elena Rostova (Team Leader)" or "Anna Schmidt (Quality Engineer)"). Match the required work to the role.
Keep each action text short, direct and concise (e.g. Move to backup server).
Distinguish recorded actions from precedent-based proposals.
Do not collapse the action plan into one narrative paragraph.
Start every action with the imperative verb naming the PRIMARY work; when an action has two halves, put the primary one first. Each action is filed against the SAP quality task catalogue by reading its leading clause, so a sentence that opens on the secondary task lands under the wrong code.
Never output a task code, code group, or planned end date. The code is derived from your action text by rule, and the date is a human commitment.
```

### 2. Data Schema → ô `inputSchemaJson`

```json
{
  "type": "object",
  "properties": {
    "containment.actions": {
      "type": "array",
      "title": "Containment actions",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "description": "Short concise action description without boilerplate prefix. Start with the imperative verb naming the PRIMARY work, e.g. \"Quarantine 85 housings at the outgoing dock\"."
          },
          "owner": {
            "type": "string",
            "maxLength": 120,
            "description": "The team member from D1 (team.roster or team.leader/members) assigned to this containment action, formatted strictly as 'Name (Role)' (e.g. 'Elena Rostova (Team Leader)' or 'Anna Schmidt (Quality Engineer)')."
          },
          "status": {
            "type": "string",
            "enum": [
              "Planned",
              "In Process",
              "Done",
              "Verified"
            ]
          }
        }
      }
    },
    "containment.gaps": {
      "type": "array",
      "title": "Open containment gaps",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    },
    "sources": {
      "type": "array",
      "title": "Data sources cited",
      "description": "Evidence paths and precedent keys actually used.",
      "x-source": "system",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "containment.actions"
  ],
  "additionalProperties": false
}
```

### 3. Form Editor → ô `formSchemaJson`

```json
{
  "fields": [
    {
      "key": "containment.actions",
      "label": "Containment actions",
      "widget": "action-cards",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minItems": 1
      },
      "items": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "description": "Short concise action description without boilerplate prefix. Start with the imperative verb naming the PRIMARY work, e.g. \"Quarantine 85 housings at the outgoing dock\"."
          },
          "owner": {
            "type": "string",
            "maxLength": 120,
            "description": "The team member from D1 (team.roster or team.leader/members) assigned to this containment action, formatted strictly as 'Name (Role)'."
          },
          "status": {
            "type": "string",
            "enum": [
              "Planned",
              "In Process",
              "Done",
              "Verified"
            ]
          }
        }
      }
    },
    {
      "key": "containment.gaps",
      "label": "Open containment gaps",
      "widget": "warning-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    },
    {
      "key": "sources",
      "label": "Evidence and traceability",
      "widget": "evidence-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    }
  ],
  "groups": [
    {
      "id": "d3-ai-result",
      "label": "Containment plan",
      "fieldKeys": [
        "containment.actions",
        "containment.gaps",
        "sources"
      ],
      "width": "100",
      "columns": 12,
      "order": 10
    }
  ]
}
```

---

## D4 — Root Cause Analysis

Show the causal chain, conclusion, contributing factors, independent verification, and evidence gaps.

### 1. Prompt → ô `combinedPrompt`

Dòng `stepCode = 'D4'` trong bảng `StepPrompts`.

```text
The discipline the whole report is judged on.

Take the recorded answer in this order:
  1. the step of this case's 5-Why chain tagged as the root cause;
  2. if no step is tagged, the Ishikawa row marked as the root cause.

Walk the chain step by step and cite the evidence at each step. Name the
confirmed Ishikawa category and say why the other five were ruled out - the
context gives you a row for each of the six. Where the chain shows both a
technical and a systemic cause, separate them.

A precedent root cause is a finding about ANOTHER case. Present it as a
hypothesis with the case ID and score, never as this case's cause, and for
each one name the single piece of evidence that would confirm or kill it
here.

You are also given INDEPENDENT DIAGNOSIS - a conclusion reached from the raw
evidence alone, with the 5-Why chain, the root-cause flag, the corrective
actions and the FMEA link all withheld. Close D4 with a short paragraph
headed "Independent verification":
  - Agrees: say so, and note it was reached without access to the recorded
    answer. That is corroboration; state it plainly and briefly.
  - Disagrees: say so openly. Report which branch it chose and why, then
    weigh that against the recorded conclusion. Do not side with the recorded
    answer because it is the recorded answer - if the measurements support
    the independent reasoning better, say so.
  - Note its confidence and any evidence gap it flagged.
Cite "independent" in this discipline's sources.

WHEN THIS CASE HAS NO INVESTIGATION AT ALL - fiveWhy empty AND ishikawa
empty AND no root cause recorded - everything above describes data you do not
have. Do not improvise a different shape for that situation; follow this one,
and follow it the same way every time:

  - In rootCause.statement, state the root cause hypothesis directly, concisely,
    and without preamble or multi-sentence paragraphs (e.g.
    "Root cause (hypothesis): Undefined or missing milling process specification (Method).").
    Never end on the bare denial; state the leading hypothesis directly. Do not write long disclaimers or audit plans here.

  - The 5-Why chain is about THE DEFECT, always. Never write a chain about
    why the investigation was not done, why records are missing, or how the
    process failed. Keep questions short & crisp and answers direct & concise
    (max 1 short sentence per step, stating the direct cause).
    Start from the observed symptom and walk down the plausible technical causes.
    Where a step cannot be answered from evidence, put the candidate causes in the
    answer concisely and cite the record in evidence.

  - Each Ishikawa branch gets a VERDICT, not an investigation plan. Say what
    that branch tells you in 1 short phrase or sentence and stop: "shift-independent",
    "gauge R&R 8%", "fixture #2 clamp worn 0.2 mm", "no PM log", "not assessed".
    A reader scans six cells to see which one stands out - never write multi-sentence
    paragraphs or audit plans in 6M cells.
    Where a branch is ruled out, say what ruled it out. Where nothing is
    known, "not assessed" is the whole answer.
    The evidence still to be gathered goes ONCE in rootCause.evidenceGaps,
    never repeated per branch. Mark at most one branch as the root cause, and
    only when the evidence you DO have points there. When nothing points
    anywhere, mark none.

  - Keep all three consistent. The statement, the chain and the board must
    describe the same hypothesis in the same register. A confident board next
    to a statement that says nothing was determined reads as two different
    reports stapled together.

You never confirm a root cause. The engineer sets that flag.

## FIELD MECHANICS
State the root cause conclusion directly and concisely in rootCause.statement (1 brief sentence, e.g. "Root cause: Undefined or missing milling process specification (Method)").
Expose evidence gaps separately in rootCause.evidenceGaps.
Treat precedent causes as hypotheses, not facts.
rootCause.ishikawaBoard always carries one row per 6M category with a concise 1-sentence/phrase verdict: Man, Machine, Method, Material, Measurement, Environment. Never write long essays or audit plans in 6M cells.
Copy each recorded ishikawa entry into its category with source set to recorded. Do not reword a recorded finding.
For a category with no recorded entry, propose a brief verdict from the evidence you do have with source set to proposed, or set finding to "not assessed". Never let a proposal read as a recorded finding.
Every rootCause.fiveWhy row must carry step, why, answer and evidence with short crisp questions and direct 1-sentence answers. The answer is never empty and never restates the question.
```

### 2. Data Schema → ô `inputSchemaJson`

```json
{
  "type": "object",
  "properties": {
    "rootCause.statement": {
      "type": "string",
      "title": "Root cause",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "rootCause.ishikawaBoard": {
      "type": "array",
      "title": "Ishikawa",
      "description": "Always one row per 6M category with a concise 1-sentence verdict. Copy a recorded assessment verbatim with source=recorded; for a category with no recorded entry propose a brief verdict from evidence with source=proposed, or write \"not assessed\". Never write audit plans or long essays in cells.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "object",
        "properties": {
          "category": {
            "type": "string",
            "enum": [
              "Man",
              "Machine",
              "Method",
              "Material",
              "Measurement",
              "Environment"
            ]
          },
          "finding": {
            "type": "string",
            "maxLength": 220,
            "description": "The concise VERDICT for this branch, e.g. clamp pad worn 0.2 mm, or gauge R&R 8%, or not assessed. Never a list of evidence to gather - that goes in evidenceGaps once. Never the category name."
          },
          "isRootCause": {
            "type": "boolean",
            "description": "True for at most ONE branch in the whole board."
          },
          "source": {
            "type": "string",
            "enum": [
              "recorded",
              "proposed"
            ]
          }
        },
        "required": [
          "category",
          "finding",
          "isRootCause",
          "source"
        ]
      }
    },
    "rootCause.fiveWhy": {
      "type": "array",
      "title": "5-Why chain",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "object",
        "properties": {
          "step": {
            "type": "integer",
            "description": "Position in the chain, starting at 1."
          },
          "why": {
            "type": "string",
            "maxLength": 140,
            "description": "The question only, ending in a question mark. Keep it short and crisp."
          },
          "answer": {
            "type": "string",
            "maxLength": 200,
            "description": "The answer only: 1 concise direct sentence naming the cause. Never repeat the question, never list audit procedures or evidence still to be gathered."
          },
          "evidence": {
            "type": "string",
            "maxLength": 200,
            "description": "The CaseContext path or measurement backing the answer. Concise citation only."
          }
        },
        "required": [
          "step",
          "why",
          "answer",
          "evidence"
        ]
      }
    },
    "rootCause.evidenceGaps": {
      "type": "array",
      "title": "Evidence gaps",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    },
    "sources": {
      "type": "array",
      "title": "Evidence and traceability",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "rootCause.statement",
    "rootCause.ishikawaBoard",
    "rootCause.fiveWhy"
  ],
  "additionalProperties": false
}
```

### 3. Form Editor → ô `formSchemaJson`

```json
{
  "fields": [
    {
      "key": "rootCause.statement",
      "label": "Root cause",
      "widget": "ai-draft",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minLength": 10,
        "maxLength": 320
      }
    },
    {
      "key": "rootCause.ishikawaBoard",
      "label": "Ishikawa",
      "widget": "ishikawa-grid",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minItems": 6
      },
      "description": "Always one row per 6M category with a concise 1-sentence verdict. Copy a recorded assessment verbatim with source=recorded; for a category with no recorded entry propose a brief verdict from evidence with source=proposed, or write \"not assessed\". Never write audit plans or long essays in cells.",
      "items": {
        "type": "object",
        "properties": {
          "category": {
            "type": "string",
            "enum": [
              "Man",
              "Machine",
              "Method",
              "Material",
              "Measurement",
              "Environment"
            ]
          },
          "finding": {
            "type": "string",
            "maxLength": 220,
            "description": "The concise VERDICT for this branch, e.g. clamp pad worn 0.2 mm, or gauge R&R 8%, or not assessed. Never a list of evidence to gather - that goes in evidenceGaps once. Never the category name."
          },
          "isRootCause": {
            "type": "boolean",
            "description": "True for at most ONE branch in the whole board."
          },
          "source": {
            "type": "string",
            "enum": [
              "recorded",
              "proposed"
            ]
          }
        },
        "required": [
          "category",
          "finding",
          "isRootCause",
          "source"
        ]
      }
    },
    {
      "key": "rootCause.fiveWhy",
      "label": "5-Why chain",
      "widget": "why-chain",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minItems": 1
      },
      "items": {
        "type": "object",
        "properties": {
          "step": {
            "type": "integer",
            "description": "Position in the chain, starting at 1."
          },
          "why": {
            "type": "string",
            "maxLength": 140,
            "description": "The question only, ending in a question mark. Keep it short and crisp."
          },
          "answer": {
            "type": "string",
            "maxLength": 200,
            "description": "The answer only: 1 concise direct sentence naming the cause. Never repeat the question, never list audit procedures or evidence still to be gathered."
          },
          "evidence": {
            "type": "string",
            "maxLength": 200,
            "description": "The CaseContext path or measurement backing the answer. Concise citation only."
          }
        },
        "required": [
          "step",
          "why",
          "answer",
          "evidence"
        ]
      }
    },
    {
      "key": "rootCause.evidenceGaps",
      "label": "Evidence gaps",
      "widget": "warning-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    },
    {
      "key": "sources",
      "label": "Evidence and traceability",
      "widget": "evidence-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    }
  ],
  "groups": [
    {
      "id": "d4-ai-result",
      "label": "Root cause analysis",
      "fieldKeys": [
        "rootCause.statement",
        "rootCause.ishikawaBoard",
        "rootCause.fiveWhy",
        "rootCause.evidenceGaps",
        "sources"
      ],
      "width": "100",
      "columns": 12,
      "order": 10
    }
  ]
}
```

---

## D5 — Permanent Corrective Actions

Tie every corrective action to the step of the root cause chain it removes.

### 1. Prompt → ô `combinedPrompt`

Dòng `stepCode = 'D5'` trong bảng `StepPrompts`.

```text
Every corrective action must name the step of the D4 chain it removes. An
action that ties to no step is aimed either at a symptom or at a cause you
have not established - say which.

Report the corrective actions on record with their status. Then state plainly
which part of the root cause no recorded action covers. That gap is the most
useful line on this page.

When nothing is recorded, propose the corrective action from the
highest-scoring precedent, cite the case and its score, and tie it to the
hypothesis it would fix.

Corrective is not containment. An action that only limits damage while the
cause remains belongs in D3.

## FIELD MECHANICS
Return corrective.actions as rows with action, owner, status, origin.
Assign an owner to every corrective action from the D1 team roster (team.roster or team.leader/members), formatted strictly as "Name (Role)" (e.g. "Karl Wagner (Maintenance Planner)" or "Marcus Vance (Manufacturing Engineer)"). Match the role/responsibility to the root cause fix. Never use generic titles or unassigned when members exist in D1.
In corrective.rootCauseCoverage name, per action, which step of the D4 chain it removes.
List any part of the root cause with no action against it in corrective.uncoveredCauses.
Distinguish recorded actions from precedent-based proposals using origin.
Do not collapse the plan into one narrative paragraph.
Start every action with the imperative verb naming the PRIMARY work; when an action has two halves, put the primary one first. Each action is filed against the SAP quality task catalogue by reading its leading clause, so a sentence that opens on the secondary task lands under the wrong code.
Never output a task code, code group, or planned end date. The code is derived from your action text by rule, and the date is a human commitment.
```

### 2. Data Schema → ô `inputSchemaJson`

```json
{
  "type": "object",
  "properties": {
    "corrective.actions": {
      "type": "array",
      "title": "Permanent corrective actions",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "maxLength": 240,
            "description": "The action and its trigger, starting with the imperative verb that names the PRIMARY work. No owner, no status, no rationale - those are separate fields."
          },
          "owner": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the person or function accountable. Leave empty when none is recorded."
          },
          "status": {
            "type": "string",
            "maxLength": 40,
            "description": "ONLY the current status, one or two words, e.g. \"Planned\", \"In progress\", \"Done\"."
          },
          "origin": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY where it came from: \"recorded\" for an action already in the case, or \"precedents#N\" for a proposal."
          },
          "protection": {
            "type": "string",
            "maxLength": 200,
            "description": "One line."
          }
        }
      }
    },
    "sources": {
      "type": "array",
      "title": "Evidence and traceability",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "corrective.actions"
  ],
  "additionalProperties": false
}
```

### 3. Form Editor → ô `formSchemaJson`

```json
{
  "fields": [
    {
      "key": "corrective.actions",
      "label": "Permanent corrective actions",
      "widget": "action-cards",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minItems": 1
      },
      "items": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "maxLength": 240,
            "description": "The action and its trigger, starting with the imperative verb that names the PRIMARY work. No owner, no status, no rationale - those are separate fields."
          },
          "owner": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the person or function accountable. Leave empty when none is recorded."
          },
          "status": {
            "type": "string",
            "maxLength": 40,
            "description": "ONLY the current status, one or two words, e.g. \"Planned\", \"In progress\", \"Done\"."
          },
          "origin": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY where it came from: \"recorded\" for an action already in the case, or \"precedents#N\" for a proposal."
          },
          "protection": {
            "type": "string",
            "maxLength": 200,
            "description": "One line."
          }
        }
      }
    },
    {
      "key": "sources",
      "label": "Evidence and traceability",
      "widget": "evidence-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    }
  ],
  "groups": [
    {
      "id": "d5-ai-result",
      "label": "AI-generated corrective plan",
      "fieldKeys": [
        "corrective.actions"
      ],
      "width": "100",
      "columns": 12,
      "order": 10
    }
  ]
}
```

---

## D6 — Verify Effectiveness

Write a measurable verification plan; this dataset carries no verification evidence.

### 1. Prompt → ô `combinedPrompt`

Dòng `stepCode = 'D6'` trong bảng `StepPrompts`.

```text
This dataset carries no verification evidence, so nothing here may be
called proven effective, however convincing the corrective action looks.

Do two things:
  1. List every recorded action with its current status, so the engineer sees
     what is outstanding. Status changes are theirs to make, not yours.
  2. Write the verification PLAN the case still needs: what to measure, on
     what sample size, over what period, against what acceptance criterion,
     and who signs it off. Anchor the criterion to the actual specification
     value in inspections - "back within the 0.50mm tolerance on 30
     consecutive parts" is a plan, "monitor the process" is not.

## FIELD MECHANICS
Return verification.plan as rows with measure, sampleSize, period, acceptanceCriterion, signOff.
Anchor every acceptance criterion to a real specification value from inspections.
Set verification.evidenceStatus to exactly one allowed value.
Never describe a corrective action as proven effective.
```

### 2. Data Schema → ô `inputSchemaJson`

```json
{
  "type": "object",
  "properties": {
    "verification.objective": {
      "type": "string",
      "title": "Verification objective",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "verification.plan": {
      "type": "array",
      "title": "Verification plan",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "object",
        "properties": {
          "measure": {
            "type": "string",
            "maxLength": 200,
            "description": "One line."
          },
          "sampleSize": {
            "type": "string",
            "maxLength": 80,
            "description": "ONLY the sample size, e.g. \"30 parts per shift\"."
          },
          "period": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY the period over which it runs, e.g. \"4 weeks\"."
          },
          "acceptanceCriterion": {
            "type": "string",
            "maxLength": 220,
            "description": "The pass/fail threshold with its number, anchored to a real specification value."
          },
          "signOff": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the role that signs it off."
          }
        }
      }
    },
    "verification.evidenceStatus": {
      "type": "string",
      "title": "Evidence status",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "enum": [
        "No evidence yet",
        "Partially verified",
        "Verified"
      ]
    },
    "sources": {
      "type": "array",
      "title": "Evidence and traceability",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "verification.objective",
    "verification.plan",
    "verification.evidenceStatus"
  ],
  "additionalProperties": false
}
```

### 3. Form Editor → ô `formSchemaJson`

```json
{
  "fields": [
    {
      "key": "verification.objective",
      "label": "Verification objective",
      "widget": "callout",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "maxLength": 260
      }
    },
    {
      "key": "verification.plan",
      "label": "Verification plan",
      "widget": "table",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minItems": 1
      },
      "items": {
        "type": "object",
        "properties": {
          "measure": {
            "type": "string",
            "maxLength": 200,
            "description": "One line."
          },
          "sampleSize": {
            "type": "string",
            "maxLength": 80,
            "description": "ONLY the sample size, e.g. \"30 parts per shift\"."
          },
          "period": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY the period over which it runs, e.g. \"4 weeks\"."
          },
          "acceptanceCriterion": {
            "type": "string",
            "maxLength": 220,
            "description": "The pass/fail threshold with its number, anchored to a real specification value."
          },
          "signOff": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the role that signs it off."
          }
        }
      }
    },
    {
      "key": "verification.evidenceStatus",
      "label": "Evidence status",
      "widget": "status",
      "dataType": "string",
      "colSpan": 4,
      "constraints": {
        "required": true,
        "enum": [
          "No evidence yet",
          "Partially verified",
          "Verified"
        ]
      }
    },
    {
      "key": "sources",
      "label": "Evidence and traceability",
      "widget": "evidence-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    }
  ],
  "groups": [
    {
      "id": "d6-ai-result",
      "label": "AI-generated verification plan",
      "fieldKeys": [
        "verification.objective",
        "verification.plan"
      ],
      "width": "100",
      "columns": 12,
      "order": 10
    }
  ]
}
```

---

## D7 — Prevent Recurrence

Preventive actions and the FMEA entry that has to change.

### 1. Prompt → ô `combinedPrompt`

Dòng `stepCode = 'D7'` trong bảng `StepPrompts`.

```text
Preventive action stops the same cause reaching a different part, line or
shift. An action that only protects this material or this batch is corrective
and belongs in D5.

Report the preventive actions on record, then say which FMEA entry must
change and how: the occurrence rating, the detection rating, or the control
itself. Name the FMEA entry by ID when the case links one.

Where the dataset carries no preventive action or no FMEA link, say so and
state what a systemic fix would have to cover.

Precedents matter more here than anywhere else: a preventive action that
already worked on the same work centre outranks a fresh proposal. Name the
FMEA entries those precedents link to, with the case ID and score.

## FIELD MECHANICS
Return preventive.actions as rows with action, owner, status, origin.
Assign an owner to every preventive action from the D1 team roster (team.roster or team.leader/members), formatted strictly as "Name (Role)" (e.g. "Anna Schmidt (Quality Engineer)"). Match the role/responsibility to the systemic/FMEA fix.
Put the FMEA entry into preventive.fmea with fmeaId, description and the change required.
When the case links no FMEA entry, leave preventive.fmea.fmeaId empty and say what a systemic fix would have to cover.
List where else the failure mode applies in preventive.systemicScope.
An action that only protects this batch is corrective and belongs in D5.
Start every action with the imperative verb naming the PRIMARY work; when an action has two halves, put the primary one first. Each action is filed against the SAP quality task catalogue by reading its leading clause, so a sentence that opens on the secondary task lands under the wrong code.
Never output a task code, code group, or planned end date. The code is derived from your action text by rule, and the date is a human commitment.
```

### 2. Data Schema → ô `inputSchemaJson`

```json
{
  "type": "object",
  "properties": {
    "preventive.actions": {
      "type": "array",
      "title": "Preventive actions",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "maxLength": 240,
            "description": "The action and its trigger, starting with the imperative verb that names the PRIMARY work. No owner, no status, no rationale - those are separate fields."
          },
          "owner": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the person or function accountable. Leave empty when none is recorded."
          },
          "status": {
            "type": "string",
            "maxLength": 40,
            "description": "ONLY the current status, one or two words, e.g. \"Planned\", \"In progress\", \"Done\"."
          },
          "origin": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY where it came from: \"recorded\" for an action already in the case, or \"precedents#N\" for a proposal."
          },
          "protection": {
            "type": "string",
            "maxLength": 200,
            "description": "One line."
          }
        }
      }
    },
    "preventive.fmea": {
      "type": "object",
      "title": "FMEA entry to update",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "properties": {
        "fmeaId": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "change": {
          "type": "string"
        },
        "currentRating": {
          "type": "string"
        },
        "proposedRating": {
          "type": "string"
        }
      }
    },
    "sources": {
      "type": "array",
      "title": "Evidence and traceability",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "preventive.actions"
  ],
  "additionalProperties": false
}
```

### 3. Form Editor → ô `formSchemaJson`

```json
{
  "fields": [
    {
      "key": "preventive.actions",
      "label": "Preventive actions",
      "widget": "action-cards",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {
        "required": true,
        "minItems": 1
      },
      "items": {
        "type": "object",
        "properties": {
          "action": {
            "type": "string",
            "maxLength": 240,
            "description": "The action and its trigger, starting with the imperative verb that names the PRIMARY work. No owner, no status, no rationale - those are separate fields."
          },
          "owner": {
            "type": "string",
            "maxLength": 120,
            "description": "ONLY the person or function accountable. Leave empty when none is recorded."
          },
          "status": {
            "type": "string",
            "maxLength": 40,
            "description": "ONLY the current status, one or two words, e.g. \"Planned\", \"In progress\", \"Done\"."
          },
          "origin": {
            "type": "string",
            "maxLength": 60,
            "description": "ONLY where it came from: \"recorded\" for an action already in the case, or \"precedents#N\" for a proposal."
          },
          "protection": {
            "type": "string",
            "maxLength": 200,
            "description": "One line."
          }
        }
      }
    },
    {
      "key": "preventive.fmea",
      "label": "FMEA entry to update",
      "widget": "fmea-link",
      "dataType": "object",
      "colSpan": 12,
      "constraints": {},
      "properties": {
        "fmeaId": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "change": {
          "type": "string"
        },
        "currentRating": {
          "type": "string"
        },
        "proposedRating": {
          "type": "string"
        }
      }
    },
    {
      "key": "sources",
      "label": "Evidence and traceability",
      "widget": "evidence-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    }
  ],
  "groups": [
    {
      "id": "d7-ai-result",
      "label": "AI-generated preventive plan",
      "fieldKeys": [
        "preventive.actions",
        "preventive.fmea"
      ],
      "width": "100",
      "columns": 12,
      "order": 10
    }
  ]
}
```

---

## D8 — Closure and Recognition

Lessons learned and what is still open. The closure gate reads D1-D7, not the model.

### 1. Prompt → ô `combinedPrompt`

Dòng `stepCode = 'D8'` trong bảng `StepPrompts`.

```text
Closure is a gate, not a summary. Check D1 through D7 first: if any is
incomplete, name which ones and state that the case cannot be closed yet. You
never close a case - the engineer does, and only once that gate passes.

Then write the lessons learned, both halves and honestly:
  - What worked - the specific thing worth repeating, not "good teamwork"
  - What did not - the thing that cost time, or let the defect through

Recognise the team by name. Close by stating what remains open: actions still
unverified, an FMEA update still pending, any evidence gap the report could
not fill.

## FIELD MECHANICS
Write closure.lessonsWhatWorked and closure.lessonsWhatDidNot as two separate fields.
Name the specific thing worth repeating; "good teamwork" is not a lesson.
List anything unfinished in closure.openItems - unverified actions, a pending FMEA update, an evidence gap.
Never output closure.gate or closure.costOfPoorQuality. The screen computes the gate from the review status of D1-D7, and the cost comes from the case.
```

### 2. Data Schema → ô `inputSchemaJson`

```json
{
  "type": "object",
  "properties": {
    "closure.gate": {
      "type": "object",
      "title": "Closure readiness",
      "description": "Computed from the review status of D1-D7. The AI never writes this.",
      "x-source": "manual_input",
      "properties": {}
    },
    "closure.costOfPoorQuality": {
      "type": "string",
      "title": "Cost of poor quality",
      "description": "Read from the case. The AI never writes this.",
      "x-source": "sap_qm"
    },
    "closure.lessonsWhatWorked": {
      "type": "string",
      "title": "What worked",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "closure.lessonsWhatDidNot": {
      "type": "string",
      "title": "What did not",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "closure.teamRecognition": {
      "type": "string",
      "title": "Team recognition",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment"
    },
    "closure.openItems": {
      "type": "array",
      "title": "Still open at closure",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    },
    "sources": {
      "type": "array",
      "title": "Evidence and traceability",
      "description": "Generated by the 8D AI from verified case context.",
      "x-source": "ai_enrichment",
      "items": {
        "type": "string"
      }
    }
  },
  "required": [
    "closure.lessonsWhatWorked",
    "closure.lessonsWhatDidNot"
  ],
  "additionalProperties": false
}
```

### 3. Form Editor → ô `formSchemaJson`

```json
{
  "fields": [
    {
      "key": "closure.gate",
      "label": "Closure readiness",
      "widget": "closure-gate",
      "dataType": "object",
      "colSpan": 12,
      "constraints": {},
      "xSource": "manual_input",
      "description": "Computed from the review status of D1-D7. The AI never writes this.",
      "properties": {}
    },
    {
      "key": "closure.costOfPoorQuality",
      "label": "Cost of poor quality",
      "widget": "text",
      "dataType": "string",
      "colSpan": 4,
      "constraints": {},
      "xSource": "sap_qm",
      "description": "Read from the case. The AI never writes this."
    },
    {
      "key": "closure.lessonsWhatWorked",
      "label": "What worked",
      "widget": "markdown",
      "dataType": "string",
      "colSpan": 6,
      "constraints": {
        "required": true,
        "minLength": 20
      }
    },
    {
      "key": "closure.lessonsWhatDidNot",
      "label": "What did not",
      "widget": "markdown",
      "dataType": "string",
      "colSpan": 6,
      "constraints": {
        "required": true,
        "minLength": 20
      }
    },
    {
      "key": "closure.teamRecognition",
      "label": "Team recognition",
      "widget": "markdown",
      "dataType": "string",
      "colSpan": 12,
      "constraints": {}
    },
    {
      "key": "closure.openItems",
      "label": "Still open at closure",
      "widget": "warning-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    },
    {
      "key": "sources",
      "label": "Evidence and traceability",
      "widget": "evidence-list",
      "dataType": "array",
      "colSpan": 12,
      "constraints": {},
      "items": {
        "type": "string"
      }
    }
  ],
  "groups": [
    {
      "id": "d8-ai-result",
      "label": "AI-generated closure summary",
      "fieldKeys": [
        "closure.gate",
        "closure.costOfPoorQuality",
        "closure.lessonsWhatWorked",
        "closure.lessonsWhatDidNot",
        "closure.teamRecognition"
      ],
      "width": "100",
      "columns": 12,
      "order": 10
    }
  ]
}
```
