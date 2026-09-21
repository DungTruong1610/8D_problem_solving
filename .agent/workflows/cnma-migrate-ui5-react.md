---
description: Migrate legacy SAP UI5 applications to React Clean Architecture following Conarum standards (@cnma-cap-frontend).
---

# UI5 to React Migration Workflow

> **Purpose**: systematize the migration of SAP UI5 logic to React Clean Architecture, ensuring no business logic is lost and all Conarum patterns (Domain/Data/Presentation) are strictly followed.

## Prerequisites
- **Source**: A valid UI5 application directory (containing `manifest.json`, `webapp/`).
- **Target**: A React CAP project structure (scaffolded via `/init_cap_project` or compatible).
- **Skill**: `@cnma-cap-frontend` must be loaded.

## Workflow Steps

### 1. Preparation & Scaffolding
1.  **Analyze Input**:
    - **Check Source UI5 Directory**:
        - Was a `<ui5 apps directory>` provided in the command?
        - **If NO**: ASK user: "Please provide the path to the source UI5 application."
        - **Validation**: Verify `manifest.json` exists in `webapp/` or source root.
    - **Check Target React Directory**:
        - Was a `<target react directory>` provided in the command?
        - **If NO**: ASK user: "Please specify the target React application directory (e.g., ./app/my-react-app)."
    - **Check Features**:
        - Were `--feature` flags provided?
        - **If NO**: ASK user: "Are there specific features to migrate? (Options: `dashboard`, `variant`, `setting`)"
    - Identify App ID, OData services from `manifest.json`.
2.  **Scaffold Target (if needed)**:
    - If the React app doesn't exist, use `/init_cap_project` or manually scaffold the "React Clean Architecture" structure defined in `cnma-cap-frontend`.
    - Ensure `src/core`, `src/domain`, `src/data`, `src/presentation`, `src/di` exist.

### 2. Business Logic Extraction (The "Rules" Check)
> **Rule**: Check entire business logic of UI5 apps. Do not miss any logic.

1.  **Map Controllers to UseCases**:
    - List all `*.controller.js` and `handler/*.js` files.
    - For each public method/action in a UI5 controller:
        - **Identify Intent**: What is the user doing? (e.g., `onApprove`, `onSearch`).
        - **Create UseCase**: Draft a `{Verb}{Entity}UseCase.ts` in `src/domain/usecases`.
        - **Documentation**: Comment in the UseCase which UI5 method it replaces.
2.  **Map OData to Repositories**:
    - Identify usage of `ODataModel` (`this.getView().getModel()`).
    - Define Entities in `src/domain/entities`.
    - Create Repository Interfaces in `src/domain/repositories`.
    - Implement Data Sources in `src/data/datasources` using `HttpClient`.

### 3. Implementation Loop (Feature by Feature)

#### A. Core Migration (Standard Features)
For each logical module (e.g., Purchase Order, Supplier Inquiry):
1.  **Domain Layer**:
    - Create `I{Entity}Repository.ts`.
    - Create UseCases (e.g., `GetOrdersUseCase.ts`, `ApproveOrderUseCase.ts`).
2.  **Data Layer**:
    - Implement `OData{Entity}DataSource.ts` (handle URL generation, parameter mapping).
    - Implement `{Entity}Repository.ts` (adapter pattern).
3.  **Presentation Layer**:
    - Create `use{Entity}ViewModel.ts` hook (manages state, calls UseCases).
    - Create React Components (Page + Sub-components).
    - **UI Pattern**: Replace `sap.m.Table` with `shadcn/ui` Table. Replace `SmartFilterBar` with `FilterBar` + `ComboboxFilter`.

#### B. Dashboard Feature (--feature=dashboard)
If verified in inputs:
1.  **Analyze `Dashboard.controller.js`**: Look for chart bindings (VizFrame) and aggregation logic.
2.  **Migrate to Recharts**:
    - Use `Recharts` (Bar, Line, Pie) for visualizations.
    - Move aggregation logic (if client-side) to a dedicated UseCase (e.g., `GetDashboardStatsUseCase`).
    - If logic is server-side (CAP), ensure the `LogDataSource` or equivalent calls the correct action.

#### C. Settings Feature (--feature=setting)
If verified in inputs:
1.  **Skeleton Page**:
    - Create `SettingsPage.tsx` with a basic layout.
    - Add to `App.tsx` routing (`/settings`).
    - *Note*: Content is currently empty/placeholder as per requirements.

#### D. Variant Management (--feature=variant)
If verified in inputs:
1.  **Variant System**:
    - Implement `VariantRepository` as defined in `cnma-cap-frontend`.
    - Create `VariantManagement.tsx` component.
    - Migrate existing variants from UI5 (if stored in LREP/UserPersonalization) to the custom `VariantSettings` entity in CAP.

### 4. Verification & Clean Up
1.  **Logic Audit**:
    - Review every function in the old UI5 `Controller.js`.
    - Verify it has a corresponding `UseCase` or `ViewModel` logic in React.
    - **Mark Checked**: Maintain a checklist of migrated functions.
2.  **Styling**:
    - Ensure `TailwindCSS` is used.
    - No `sapUi*` classes should remain.
3.  **Routing**:
    - Verify `App.tsx` or `RouterProvider` matches `manifest.json` routes.

## Usage
```bash
agent run /cnma-migrate-ui5-react ./app/my-legacy-ui5-app --feature=dashboard,setting
```
