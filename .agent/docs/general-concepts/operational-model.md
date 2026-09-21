# ⚙️ Operational Model: The Sequential Swarm

**Context:** How does the "Agent Team" actually work together on a task?

## 1. The Core Concept
The team does **not** run as 6 independent, disconnected bots.
They work as a **Single Intelligent Entity** that "shifts gears" (Personas) based on the sub-task.

## 2. The Workflow (Sequential Handoffs)

### Step 1: Admission (The Principal)
*   **Actor:** `Principal Agent Architect`
*   **Action:** Analyses the User Request. Breaks it down into a Plan.
*   **Decision:** "This requires Backend changes, then Frontend changes."

### Step 2: Backend Execution
*   **Actor:** `Lead CAP Architect`
*   **Input:** The Plan from Step 1.
*   **Work:** Generates `schema.cds` and `service.ts`.
*   **Output:** Updated Codebase + "Backend Ready" status.

### Step 3: Frontend Execution
*   **Actor:** `Lead Frontend Engineer`
*   **Input:** The updated `schema.cds` (Source of Truth).
*   **Work:** Generates `Component.tsx` consuming the OData service.
*   **Output:** Completed UI.

### Step 4: Verification
*   **Actor:** `Lead QA Engineer`
*   **Action:** Scans the work of Step 2 & 3.
*   **Output:** "Pass" or "Refactor Request".

## 3. Why this way?
*   **Shared Context:** Everyone sees the same file system.
*   **No Hallucinations:** The Frontend Agent reads the *actual* CDS file the Backend Agent just wrote, guaranteeing the API matches.
*   **Simplicity:** No complex message buses. The **Codebase** is the message bus.

## 4. How to Invoke
You (The User) speak to the **Team**.
*   **"Build this feature"** -> Activates the Swarm (Principal -> Backend -> Frontend).
*   **"Fix this CI pipeline"** -> Activates the Specialist (DevOps) directly.
