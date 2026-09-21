---
description: Seed the local database with mock data from CSV files
---

1.  **Check CSV Existence**
    Ensure that `db/data` contains the necessary CSV files (named `namespace-Entity.csv`).
    ```bash
    ls db/data
    ```

2.  **Reset and Seed**
    This will drop the SQLite tables, re-create them, and load data from CSVs.
    // turbo
    ```bash
    cds deploy --to sqlite
    ```

3.  **Verify Data**
    Query the database to confirm data is loaded.
    ```bash
    sqlite3 db.sqlite "SELECT count(*) FROM my_app_Entity;"
    ```
