---
name: scout-config
mode: model_decision
description: Configuration priorities for searching files in the workspace.
---

# Scout Configuration for SAP CAP & React

## Priority 1: Backend (Core Logic)
- **Path:** db/
  - **Focus:** *.cds files for data modeling and data/ for mock CSVs.
- **Path:** srv/
  - **Focus:** *.cds for service definitions and *.ts for custom logic handlers.

## Priority 2: Frontend (UI)
- **Path:** app/frontend/src/
  - **Focus:** components/ and services/ to verify OData consumption.
  - **Note:** Always check package.json in this directory for frontend dependencies.

## Priority 3: Infrastructure & Security
- **Path:** ./ (Root)
  - **Files:** mta.yaml, package.json, xs-security.json.
  - **Purpose:** Essential for reviewing XSUAA configurations and deployment settings.

## Exclusion Rules
- Ignore 
ode_modules/, dist/, mta_archives/, and .build/ to save tokens.
