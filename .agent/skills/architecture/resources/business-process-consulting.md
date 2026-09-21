---
skill: Business Process Consulting
description: Translating business requirements into SAP technical architecture and finding the "Fit-to-Standard".
---

# 👔 Business Process Consulting Skill

**Context:** Use this skill when analyzing a User Story or Feature Request *before* any technical design.

## 1. The "Clean Core" Mindset
- **Rule:** Do not clone standard S/4HANA functionality. Extend it side-by-side on BTP.
- **Question:** "Does this process already exist in S/4HANA?"
    - *Yes:* Use an API to trigger/read it.
    - *No:* Build it in CAP.

## 2. Fit-to-Standard Analysis
- **Challenge:** Users often ask for "Exactly what we had in the legacy system."
- **Response:** Propose the SAP Standard way first.
    - *Legacy:* "Custom table for Business Partners."
    - *Standard:* "Use S/4HANA Business Partner API (API_BUSINESS_PARTNER)."

## 3. Process Flow Mapping
- Define the End-to-End steps:
    1.  **Trigger:** User Action vs. System Event?
    2.  **Processing:** Validation, Enrichment, Approval?
    3.  **Result:** Update S/4HANA, Send Email, Store in HANA?

## 4. Requirement Translation
Translate "Business Speak" to "CAP Speak":
- "We need to track who changed this." -> `@managed` Aspect.
- "Only managers can see this." -> `@restrict` Annotation (RBAC).
- "This field is mandatory." -> `@assert.notNull`.
