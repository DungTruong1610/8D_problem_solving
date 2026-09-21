---
description: Refactor an existing SAP UI5 application to follow Conarum standards (@cnma-cap-frontend) without breaking business logic.
---

# UI5 Refactoring Workflow

> **Purpose**: Systematically refactor an existing UI5 codebase to adopt the Conarum `cnma-cap-frontend` architecture (BaseController, Handler Pattern, DTOs) while ensuring **zealously** that no business logic is lost or altered.

## Prerequisites
- **Target**: An existing UI5 application directory (containing `manifest.json`, `webapp/`).
- **Skill**: `@cnma-cap-frontend` must be loaded.

## Workflow Steps

### 1. Input Validation & Analysis
1.  **Check Target Directory**:
    - Was a `<ui5 project directory>` provided in the command?
    - **If NO**: ASK user: "Please provide the path to the UI5 project to refactor."
    - **Validation**: Verify `manifest.json` exists.
2.  **Backup**:
    - Suggest creating a git branch or backup before starting.
3.  **Analyze Current State**:
    - List all Controllers.
    - Identify "Fat Controllers" (> 200 lines) as priority targets for Handler extraction.
    - Check if `BaseController` exists.

### 2. Infrastructure Setup
1.  **BaseController**:
    - If missing or not standard, create `webapp/controller/BaseController.js` from `cnma-cap-frontend` template.
    - Ensure all Controllers extend this new `BaseController`.
2.  **Directory Structure**:
    - Ensure `webapp/api/`, `webapp/model/`, `webapp/utils/Enum/`, `webapp/interfaces/` exist.
    - Create `webapp/api/ENTITY.js` if missing.

### 3. Refactoring Loop (Controller by Controller)

#### Phase A: Handler Extraction (The "Fat" Trimmer)
For each Controller (e.g., `Main.controller.js`):
1.  **Create Handler**:
    - Create `webapp/controller/{Domain}/handler/{Domain}Handler.js`.
    - Initialize with `constructor(oController)`.
2.  **Move Logic**:
    - Identify business logic functions (e.g., `onApprove`, `loadData`).
    - Move them to the Handler.
    - **CRITICAL**: Update `this` references to use `this.oController` or passed parameters.
    - **CRITICAL**: Ensure event handlers in Controller only delegate to Handler (e.g., `return this.handler.onApprove(oEvent);`).

#### Phase B: API & DTO Standardization
1.  **ENTITY Registry**:
    - Scan for hardcoded OData entity set names (e.g., "/PurchaseOrders").
    - Move them to `webapp/api/ENTITY.js`.
    - Replace usage with `ENTITY.PURCHASE_ORDERS`.
2.  **DTOs**:
    - Identify where JSON payloads are constructed manually.
    - Create `DTO` classes (e.g., `PurchaseOrderDTO.js`) using the `DTOInterface` pattern.
    - Replace manual object creation with `DTO.create(data)`.

#### Phase C: Utilities & Enums
1.  **Enums**:
    - Identify hardcoded status strings or route names.
    - Move to `webapp/utils/Enum/`.
    - Replace usage with `MyEnum.STATUS_PENDING`.

### 4. Verification Check
> **Rule**: Business Logic Parity Check

1.  **Logic Review**:
    - For every function moved, verify that:
        - All variables are accessible (scope check).
        - All models are accessed correctly via `this.oController.getView().getModel()`.
        - All i18n texts are retrieved via `this.oController.getResourceBundle()`.
2.  **Linting**:
    - Run ESLint to catch undefined variables or unused imports introduced by refactoring.

## Usage
```bash
agent run /cnma-ui5-refactor ./app/my-legacy-ui5-app
```
