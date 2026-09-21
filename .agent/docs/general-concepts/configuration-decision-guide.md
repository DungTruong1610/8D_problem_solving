# 🧭 Configuration Decision Guide

"Where do I put this instruction?" use this simple logic to decide.

---

## The Decision Tree

### 1. Is it a Hard Constraint? 🛑
*   **Question:** "Is this forbidden or mandatory for EVERYONE?"
*   **Example:** "Never commit secrets", "Always use camelCase", "No `console.log`".
*   **Action:** Update **[.agent/rules/](../rules/)**.
*   *Why:* Rules are the "Law". They apply universally (or to specific file types) and are non-negotiable.

### 2. Is it a Step-by-Step Process? 📋
*   **Question:** "Do I need to ensure steps A, B, and C happen in order?"
*   **Example:** "Starting a feature involves pulling git, branching, and installing deps."
*   **Action:** Create/Update a **[.agent/workflows/](../workflows/)**.
*   *Why:* Workflows automate procedures. They don't teach *how* to code, but *what sequence* to run.

### 3. Is it a Specific Technical Capability? 🛠️
*   **Question:** "Is this a 'How-To' guide for a specific task?"
*   **Example:** "How to add a new table to the DB", "How to call an OData service".
*   **Action:** Create/Update a **[.agent/skills/](../skills/)**.
*   *Why:* Skills are recipes. Agents pull them out only when they need to do that specific job.

### 4. Is it Educational or Best Practice? 📚
*   **Question:** "Do I want to explain the 'Why' or the Philosophy?"
*   **Example:** "We prefer functional components because...", "Our security model uses RBAC because..."
*   **Action:** Update **[.agent/guidelines/](../guidelines/)**.
*   *Why:* Guidelines build the Agent's "intuition". They help it make good decisions when there is no specific rule.

### 5. Is it about "Who" or "Focus"? 🧠
*   **Question:** "Is this an operational habit for a specific role?"
*   **Example:** "The Backend Dev must restart the server", "The QA Engineer must be pessimistic".
*   **Action:** Update **[.agent/agents/](../agents/)**.
*   *Why:* Agents define the *Persona*. Instructions here act like a job description or immediate working memory.

---

## ⚡ Cheat Sheet

| Intent | Component | Example |
| :--- | :--- | :--- |
| **"Stop doing that!"** | **Rule** | "No `any` type in TS" |
| **"Follow this procedure."** | **Workflow** | "Deploy to Production" |
| **"Here is how to build X."** | **Skill** | "Create a UI Card" |
| **"Understand our style."** | **Guideline** | "Use Service-Layer Pattern" |
| **"Remember to do X."** | **Agent** | "Restart server after edit" |
