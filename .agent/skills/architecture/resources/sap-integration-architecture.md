---
skill: SAP Integration Architecture
description: Designing robust integrations between SAP BTP (CAP) and S/4HANA or other systems.
---

# 🔗 SAP Integration Architecture Skill

**Context:** Use this skill when designing how the CAP application talks to the outside world.

## 1. Connectivity Patterns
### Synchronous (OData/REST)
- **Use Case:** Real-time data fetch (e.g., Reading Business Partner details).
- **Tool:** SAP Destination Service + SAP Cloud Connector.
- **CAP Implementation:** Use `sap-cloud-sdk` or standard `cds.connect.to`.

### Asynchronous (Events)
- **Use Case:** Decoupling systems (e.g., S/4HANA creates an Invoice -> CAP triggers workflow).
- **Tool:** SAP Event Mesh.
- **CAP Implementation:** `cds.services.messaging`.

## 2. Integration Landscape Components
- **SAP Cloud Connector (SCC):** The secure tunnel for On-Premise S/4HANA.
    - *Architect Check:* Ensure the "Virtual Host" is correctly mapped in the Subaccount.
- **Destination Service:** The address book.
    - *Architect Check:* Use `NoAuthentication` for public APIs, `PrincipalPropagation` for user-centric flows.

## 3. Resilience Principles
- **Circuit Breakers:** Prevent cascading failures when S/4HANA is down.
- **Bulk Handling:** Prefer batch OData (`$batch`) over looping single requests.
- **Caching:** Cache reference data (e.g., Company Codes) in HANA or Redis to reduce API calls.

## 4. Verification Step
- "Does this integration require a new Destination in BTP?"
- "Is the S/4HANA API whitelisted in the Cloud Connector?"
