---
description: Migrate database schema to SQLite (Local) and preparing for HANA
---

1.  **Verify Schema**
    Check that the CDS model is valid.
    ```bash
    cds compile db/ -2 sql
    ```

2.  **Generate Artifacts**
    Build the HANA deployment artifacts (HDBCDS).
    // turbo
    ```bash
    cds build --production
    ```

3.  **Deploy to Local SQLite**
    Update the local development database.
    // turbo
    ```bash
    cds deploy --to sqlite
    ```

4.  **Deploy to HANA (Hybrid App)**
    (Optional) Push the changes to the BTP HANA Cloud instance without starting the app.
    ```bash
    cf deploy gen/db --no-start
    ```
