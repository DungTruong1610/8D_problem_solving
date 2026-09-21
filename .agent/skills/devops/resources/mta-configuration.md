---
skill: MTA Configuration
description: specialized skill for configuring 'mta.yaml' for multi-target application deployment on SAP BTP.
---

# 📦 MTA Configuration Skill

**Context:** Use this skill when the `Lead CAP Architect` adds a new service or resource that needs deployment.

## 1. The Golden Structure
Your `mta.yaml` describes the entire Cloud Unit.
- **Global:** Define `ID` and `_schema-version: '3.3'`.
- **Modules (compute):**
    - `db-deployer` (Type: `hdb`): Deploys HANA artifacts.
    - `srv` (Type: `nodejs`): Runs the CAP Service.
    - `app-deployer` (Type: `html5`): Deploys UI content.
- **Resources (services):**
    - `hdi-container` (Service: `hana`).
    - `xsuaa` (Service: `xsuaa`).
    - `destinations` (Service: `destination`).

## 2. Dependencies (Requires/Provides)
- **Rule:** If `srv` needs the DB, it must list it in `requires`.
    ```yaml
    - name: srv
      requires:
       - name: my-app-db # Binds VCAP_SERVICES
    ```
- **Rule:** If `srv` provides an API, it can list it in `provides` (for cross-MTA usage).

## 3. Build Parameters
- **Ignore files:** Ensure `.gitignore` and `mtaignore` exclude `node_modules`.
- **Build Result:**
    ```yaml
    build-parameters:
      ignore: ["node_modules/"]
    ```

## 4. Verification
- Run `mbt build` locally. If it fails here, it will fail in the cloud.
