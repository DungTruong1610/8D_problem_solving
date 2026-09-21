---
description: Import an external OData service (e.g., S/4HANA)
---

1.  **Import EDMX**
    Import the service definition from a file.
    ```bash
    cds import <path-to-edmx-file>
    ```

2.  **Install SDK**
    Install the SAP Cloud SDK for connectivity if not present.
    ```bash
    npm install @sap-cloud-sdk/http-client @sap-cloud-sdk/connectivity
    ```

3.  **Mock Service**
    Start the app to verify the external service is mocked locally.
    ```bash
    cds watch
    ```

4.  **Configure Credential**
    (Manual Step) Update `.cdsrc.json` or `package.json` with the sandbox/production credentials for the external service.
