---
skill: SAP CAP Production Readiness
description: Preparing CAP applications for deployment to SAP HANA Cloud and BTP.
---

# 🚀 Production Readiness Skill

**Context:** Use this skill before any deployment to the `dev` or `prod` environment.

## 1. HANA Configuration
- Ensure `package.json` has the correct production profile:
    ```json
    "cds": {
        "requires": {
            "db": { "kind": "hana" }
        }
    }
    ```
- Verify `db/src/.hdiconfig` exists (indicates HDI container support).

## 2. HDI Artifact Generation
Unlike SQLite, HANA requires explicit artifact generation.
- Run `cds build --production`.
- Verify that `gen/db/src/` contains `.hdbtable` or `.hdbview` files.

## 3. Security Hardening
- **Service Level:** Ensure all production services require authentication.
    ```cds
    service MyService @(requires: 'authenticated-user') { ... }
    ```
- **XSUAA:** Check `xs-security.json` for correct role templates and scopes matching your `cds` restrictions.

## 4. MTA Validation
- Check `mta.yaml` for:
    - **Modules:** `db` (hdb), `srv` (nodejs), `app_deployer` (html5).
    - **Resources:** `hdi-container`, `xsuaa`, `destination`.
    - **Bindings:** Ensure `srv` is bound to the UAA and HDI resources.

## 5. Final Check
Run `mbt build` locally to ensure the archive can be assembled without error.
