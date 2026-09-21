---
name: docs-seeker
description: Strategies for efficiently navigating the internal Knowledge Base and external documentation.
---

# 📚 Documentation Seeker Skill

**Context:** Use this skill when you are unsure about a Requirement, Rule, or API.

## 1. Internal Knowledge Base Strategy
Don't guess project rules. Search the `.agent/` folder.
*   **Architecture?** -> `guidelines/backend-guidelines.md` or `agents/Solution Architect.md`.
*   **Process?** -> `workflows/`
*   **Formatting?** -> `rules/coding-standards.md`.

## 2. External Search Strategy (CAP/Node/React)
1.  **Keyword optimization:** Don't search "how to fix error". Search "CAP Node.js OData V4 Deep Insert Example".
2.  **Authoritative Sources:** Prioritize `cap.cloud.sap`, `nodejs.org`, `react.dev`.
3.  **Context Window:** When you find a doc, summarize the *relevant* part into the chat context. Do not dump the whole page.

## 3. When to Search?
*   **Before Planning:** "Do we have a guideline for this?"
*   **During Implementation:** "What is the exact syntax for `cds.ql` delete?"
*   **During Error Analysis:** "What does OData error code 40001 mean?"

## 4. Interaction Output
> **📖 Docs Check:**
> *   **Source:** `guidelines/security-guidelines.md`
> *   **Finding:** "All XSUAA instances must have `tenant-mode: dedicated`."
> *   **Application:** I will update the `mta.yaml` to match this rule.
