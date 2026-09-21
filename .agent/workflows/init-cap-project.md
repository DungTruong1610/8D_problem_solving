---
description: Initialize a new SAP CAP Project following CNMA Notification Service structure
---

This workflow guides the agent to create a new SAP CAP project by leveraging specialized skills.

# Step 0: Language Selection (MANDATORY)
**Before proceeding, the Agent MUST ask the User:**
> "Which language would you like to use for this CAP project?
> - **Node.js TypeScript** ★ (default) — Clean Architecture, TypeScript Strict Mode, cds.ql"
> - **Java** — Clean Architecture, Lombok, CQN"

**Default**: If the user does not specify, use **Node.js TypeScript**.

Set context variable: `backend_language` = `node` | `java`

# Step 1: Ask User for Project Details
If the user hasn't provided them, ask for:
1.  **Project Name** (e.g., `cnma_new_service`)
2.  **Namespace** (e.g., `cnma.newservice` — used in CDS schemas, UI5 module paths, manifest.json, etc.)
    > Convention: `cnma.{module_name}` using dot-separated lowercase. Examples:
    > - `cnma.notification` → DB namespace `cnma.notification`, UI5 namespace `cnma/notification/app`
    > - `cnma.sustainability.main` → DB namespace `cnma.sustainability.main`, UI5 namespace `cnma/sustainability/main`
3.  **Project Type** (Full CAP [DB+SRV+UI] or Backend Only [DB+SRV])
4.  **Frontend Type** (choose one — *Only if Full CAP is selected.*):
    - **A) React Clean Architecture** — Layered domain architecture (core/domain/data/di/presentation)
    - **B) UI5 Freestyle** — SAP UI5 with handler delegation pattern
    - **C) React v2 (Flat + @cnma/react-ui)** ★ — Flat structure (components/hooks/pages/services), consumes `@cnma/react-ui` package for UI components, styles and fonts. Mirrors `cnma_ai_agent_extraction_ui` structure.
5.  **Variant Management** (Yes/No - Do they need VariantSettings table and handlers?)

# Step 2: Initialize Backend
**Always** run this step first to create the core structure.

1.  Set the context variables:
    - `project_name` = user's project name (e.g., `cnma_new_service`)
    - `namespace` = user's namespace (e.g., `cnma.newservice`)
    - `backend_language` = selected language from Step 0 (`node` or `java`)
2.  **Call Skill**: `/cnma-cap-backend`
    *   Instruction: "Use the `cnma-cap-backend` skill to create the DB and SRV layers for project **{{project_name}}** with namespace **{{namespace}}** using **{{backend_language}}** backend language. Include the `--variant` flag if the user requested Variant Management."
    *   The skill will use the language to select templates from:
        - `templates/node/` for Node.js TypeScript
        - `templates/java/` for Java
    *   **CAP Standard Structure** (after generation):
        ```
        {{project_name}}/
        ├── db/
        │   ├── schema/
        │   │   └── *.cds              # CDS schema (namespace: {{namespace}})
        │   └── undeploy.json           # EMPTY before deployment
        └── srv/
            ├── {ServiceName}.cds      # Service definition (READ, CREATE, UPDATE, DELETE)
            ├── src/                    # Domain-driven source
            │   ├── common/            # Shared resources
            │   ├── domain/            # Feature-based (SRP)
            │   │   └── __feature__/
            │   │       ├── handler/   # Event registration (SRP)
            │   │       ├── events/   # Event logic (OnRead*, OnBefore*, OnAfter*)
            │   │       ├── model/
            │   │       ├── repository/
            │   │       └── service/
            │   └── infrastructure/    # External systems (DIP)
            ├── index.ts                # Module entry (Node.js)
            └── server.ts               # CAP bootstrap (Node.js)
        ```
    *   Replace placeholders in templates:
        - `{{namespace}}` → user's namespace (e.g., `cnma.newservice`)
        - `{{module_name}}` → user's module name (e.g., `newservice`)
        - `{{project_name}}` → user's project name (e.g., `cnma_new_service`)

# Step 3: Initialize Frontend (Optional)
If the user selected **Full CAP**, proceed according to the chosen frontend type.

1.  Determine the **UI namespace** from the base namespace:
    - Replace dots with `/` and append `/app` → e.g., `cnma.notification` → `cnma/notification/app`

## Option A & B: React Clean Architecture or UI5 Freestyle
2.  **Call Skill**: `/cnma-cap-frontend`
    *   Instruction: "Use the `cnma-cap-frontend` skill to add the UI layer. Pass the user's choice (React or UI5) and the namespace **{{namespace}}** (UI namespace: **{{ui_namespace}}**)."
    *   The skill will use the namespace in:
        - UI5 `manifest.json` → `"id": "{{ui_namespace}}"`
        - UI5 `Component.js` → `UIComponent.extend("{{ui_namespace}}.Component")`
        - UI5 `index.html` → `data-sap-ui-resourceroots='{\"{{ui_namespace}}\": \"./\"}'`
        - UI5 `sap.ui.define` paths → `"{{ui_namespace}}/controller/..."`
        - React `package.json` → `"name": "{{project_name}}-ui"`

## Option C: React v2 (Flat + @cnma/react-ui)
2.  **Use the `react-v2` template** from the `cnma-cap-frontend` skill:
    - Template location: `.agent/skills/cnma-cap-frontend/templates/react-v2/`
    - **Target folder**: `app/{{project_name}}_ui/` (inside the project root)
    - **Copy all files** from the template to the target folder.
    - **Replace placeholders** in all copied files:

    | Placeholder | Replace with | Example |
    |-------------|-------------|---------|
    | `{{project_name}}` | Project's MTA name | `cnma_reactdemo` |
    | `{{NAMESPACE}}` | Dot-notation namespace | `cnma.reactdemo` |
    | `{{APP_TITLE}}` | Human-readable app title | `CNMA React Demo` |
    | `{{APP_DESCRIPTION}}` | Short description | `CNMA React Demo Application` |
    | `{{SEMANTIC_OBJECT}}` | SAP semantic object | `CnmaReactDemo` |
    | `{{ACTION}}` | SAP intent action | `display` |
    | `{{APP_SUBTITLE}}` | Short subtitle | `React Demo` |
    | `{{DESTINATION_NAME}}` | xs-app.json destination | `{{project_name}}-srv-api` |
    | `{{CNMA_REACT_UI_VERSION}}` | @cnma/react-ui version | `"file:../../../cnma-react-ui"` or registry version |

    - **Run**: `npm install` inside `app/{{project_name}}_ui/`

3.  **Update `mta.yaml`** — Add modules following the `cnma-cap-frontend` skill's MTA Integration section:
    - UI module: `{{project_name}}_ui` (path: `app/{{project_name}}_ui`)
    - UI Deployer module: `{{project_name}}_ui_deployer`
    - Destination Content module: `{{project_name}}_destination_content`
    - Resources: xsuaa, html5_host, destination (if not already present)

# Step 4: Finalize
1.  Run `npm install` in the project root.
2.  Initialize git: `git init`.
3.  Notify user that project `{{project_name}}` with namespace `{{namespace}}` is ready.
