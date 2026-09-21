---
description: Setup XSUAA security architecture
---

1.  **Define Scopes**
    (Manual Step) Edit `xs-security.json` to define 'Scopes' (e.g., `Viewer`, `Admin`) and 'RoleTemplates'.

2.  **Create XSUAA Service**
    Create the service instance in BTP.
    ```bash
    cf create-service xsuaa application <app-name>-xsuaa -c xs-security.json
    ```

3.  **Bind Service (Dev)**
    Bind the generic XSUAA service to the local directory (generates default-env.json).
    ```bash
    cds bind --to <app-name>-xsuaa
    ```

4.  **Enforce in CDS**
    (Manual Step) Add `@(requires: 'authenticated-user')` or `@(restrict: ...)` to your `srv/service.cds`.
