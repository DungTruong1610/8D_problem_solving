# 🚀 10 Power Use-Cases for Your Agent Team

Here are 10 concrete ways to use your new `.agent` setup. You can copy-paste the **User Prompt** directly into the chat.

---

## 🏗️ Phase 1: Design & Planning

### 1. The Architectural Review
**Scenario:** You have a rough idea but want to ensure it fits the project structure.
**Prompt:**
> "Act as the **Architect**. Review my plan to add a 'Purchase Order' module. Check it against the **Design Guidelines** and **Backend Guidelines** for structural integrity."
**Behind Scenes:** Loads `agents/Solution Architect.md` + `guidelines/backend-guidelines.md`.

### 2. The Security Audit
**Scenario:** You modified permission logic and want to be safe.
**Prompt:**
> "Act as the **Architect**. Audit `srv/service.cds` against our **Security Guidelines**. specifically check RBAC and input validation."
**Behind Scenes:** Loads `agents/Solution Architect.md` + `guidelines/security-guidelines.md`.

---

## ⚙️ Phase 2: Implementation

### 3. The Feature Kickoff
**Scenario:** You are starting a fresh task.
**Prompt:**
> "Act as the **Backend Developer**. I need to start the 'Invoice Approval' feature. Run the `/feature-start` workflow."
**Behind Scenes:** Executes `workflows/dev-feature-start.md` (Git automation).

### 4. The Database Evolver
**Scenario:** You need to add a table for 'Suppliers'.
**Prompt:**
> "Act as the **Backend Developer**. I need to add a Supplier entity. Use the **Database Migration** skill to update `schema.cds` and deploy locally."
**Behind Scenes:** Loads `skills/db-migration.md` (Step-by-step schema/deploy guide).

### 5. The External Integrator
**Scenario:** You need to fetch data from S/4HANA.
**Prompt:**
> "Act as the **Backend Developer**. I need to consume the S/4HANA Business Partner API. Use the **API Integration** skill to set this up."
**Behind Scenes:** Loads `skills/api-integration.md` (EDMX import, typing, connection logic).

### 6. The UI Builder
**Scenario:** You need a button that looks "right".
**Prompt:**
> "Act as the **Backend Developer** (or Frontend). Create a 'Submit Invoice' button component using the **UI Component Gen** skill. It must match our **Design Guidelines**."
**Behind Scenes:** Loads `skills/ui-component-gen.md` + `guidelines/design-guidelines.md`.

### 7. The Refactorer
**Scenario:** You wrote some quick code and now want to clean it up.
**Prompt:**
> "Refactor `srv/extraction-service.ts`. Enforce all **Coding Standards**, specifically the Service-Handler-Processor pattern from the **Backend Guidelines**."
**Behind Scenes:** Checks `rules/coding-standards.md` + `guidelines/backend-guidelines.md`.

---

## 🧪 Phase 3: Testing & Deployment

### 8. The Edge Case Hunter
**Scenario:** You think your logic is perfect. It probably isn't.
**Prompt:**
> "Act as the **QA Lead**. Analyze the `createInvoice` action in `srv/service.ts`. Find 3 edge cases I missed and suggest tests following the **Testing Guidelines**."
**Behind Scenes:** Loads `agents/Lead QA Automation Engineer.md` (Pessimistic persona) + `guidelines/testing-guidelines.md`.

### 9. The Gatekeeper (PR Check)
**Scenario:** You are about to push code.
**Prompt:**
> "Act as the **QA Lead**. I am ready to merge. Run the `/pr-validation` workflow."
**Behind Scenes:** Executes `workflows/dev-pr-validation.md` (Lint, Test, Build).

### 10. The Deployer
**Scenario:** It works locally, time for the cloud.
**Prompt:**
> "Execute the `/deploy-dev` workflow."
**Behind Scenes:** Executes `workflows/deploy-dev.md` (MTA Build & CF Deploy).
