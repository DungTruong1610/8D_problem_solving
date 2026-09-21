---
description: Perform routine maintenance and updates
---

1.  **Audit Dependencies**
    Check for security vulnerabilities.
    // turbo
    ```bash
    npm audit --production
    ```

2.  **Run Linting**
    Fix code style issues.
    // turbo
    ```bash
    npm run lint:fix
    ```

3.  **Update Core Packages**
    Update SAP CAP packages to simple latest version.
    ```bash
    npm update @sap/cds @sap/cds-dk
    ```

4.  **Dependency Graph**
    View the dependency tree to check for bloat.
    ```bash
    npm list --depth=0
    ```
