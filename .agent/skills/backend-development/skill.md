---
name: backend-development
description: Expert capabilities for building SAP Cloud Application Programming Model (CAP) services.
---

# ⚙️ Backend Development Skill

**Context:** Use this skill package for all Server-Layer, Database, and API logic.

## 1. The Core Stack
*   **Framework:** SAP CAP (Node.js)
*   **Language:** TypeScript
*   **Database:** HANA Cloud
*   **Protocol:** OData V4

## 2. Reference Modules
Specific "How-To" guides are located in the references folder:

- **[CDS Domain Modeling](./resources/cds-modeling.md)**: Entity relationships, Aspects, CMP.
- **[API Integration](./resources/api-integration.md)**: Consuming external S/4HANA OData services.
- **[Database Migration](./resources/db-migration.md)**: Managing `db/src` and HDI containers.
- **[Native HDI Artifacts](./resources/native-hdi-artifacts.md)**: Using `.hdbindex`, `.hdbfulltextindex` when CDS annotations are insufficient.
- **[Production Readiness](./resources/production-readiness.md)**: Preparing for BTP deployment (Security, MTA).
- **[Event Handlers](./resources/event-handlers.md)**: **Critical!** Managing Drafts, `$expand`, and Request Interception.

## 3. Best Practices
*   **Schema First:** Always define the CDS model before writing code.
*   **Service Layer:** Keep controllers thin. Use Service implementations for logic.
*   **Type Safety:** Generate types with `cds-typer` and use them strictly.
