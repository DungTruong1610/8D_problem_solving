---
skill: API Integration
description: How to consume external OData or REST services in SAP CAP.
---

# 🔗 API Integration Skill

**Context:** Use this skill when the application needs to talk to S/4HANA, AI Core, or other 3rd party APIs.

## 1. Service Definition
- Place the `.edmx` or `.json` (Swagger) file in `srv/external/`.
- Import the definition in `srv/service.cds`:
    ```cds
    using { API_BUSINESS_PARTNER as External } from './external/API_BUSINESS_PARTNER';
    ```

## 2. Configuration (`package.json`)
- Register the service in the `cds.requires` section.
    ```json
    "API_BUSINESS_PARTNER": {
        "kind": "odata-v2",
        "model": "srv/external/API_BUSINESS_PARTNER",
        "credentials": {
            "destination": "S4HANA_DEST",
            "path": "/sap/opu/odata/sap/API_BUSINESS_PARTNER"
        }
    }
    ```

## 3. Configuration (`mta.yaml`)
- Ensure the destination resource is defined and bound to the `srv` module.

## 4. Type Generation
Generate TypeScript types for the external service to ensure type safety.
```bash
npx @cap-js/cds-typer "*" --outputDirectory ./srv/types
```

## 5. Consumption Logic
- **Connect:**
    ```typescript
    const s4Endpoint = await cds.connect.to('API_BUSINESS_PARTNER');
    ```
- **Execute:**
    ```typescript
    const result = await s4Endpoint.run(SELECT.from(External.A_BusinessPartner).limit(10));
    ```
