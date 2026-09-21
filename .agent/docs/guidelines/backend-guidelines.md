# Backend & Database Guidelines

**Version:** 3.0 (AI-Optimized)
**Target Audience:** Backend Developers, AI Agents, Architects

---

## 1. Executive Summary

This document defines backend standards for Antigravity applications using **SAP Cloud Application Programming Model (CAP)** with **TypeScript**. It prioritizes structural and naming standards to facilitate rapid, consistent development by both human developers and AI agents.

---

## 2. Architecture & Project Structure

### 2.1. Layered Architecture
```
┌──────────────────────────────────────────────────────────────┐
│                      OData V4 API                            │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Service Layer (srv/)                      │
│  - Input Validation                                          │
│  - Event Routing                                             │
│  - Transaction Management                                    │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                   Handler Layer (srv/handlers/)              │
│  - Business Logic Orchestration                              │
│  - Domain-Specific Operations                                │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                  Processor Layer (srv/lib/)                  │
│  - Pure Logic / Algorithms (Stateless, Testable)            │
│  - External Integrations (AI, API, Email)                    │
└──────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     Database Layer (db/)                     │
│  - CDS Data Models                                           │
│  - HANA / SQLite Persistence                                 │
└──────────────────────────────────────────────────────────────┘
```

### 2.2. Folder Organization
```
srv/
├── service.cds              # Service definitions
├── service.ts               # Class-based service entry
├── handlers/                # Event handlers (orchestration)
│   └── OrderHandler.ts
└── lib/                     # Business logic (testable, reusable)
    ├── processors/          # Complex algorithms
    ├── actions/             # Action executors
    ├── integrations/        # External API wrappers
    └── utils/               # Helper functions
```

---

## 3. Naming Conventions

Standard names ensure AI agents can navigate the codebase autonomously.

| Element | Convention | Example |
|---------|-----------|---------|
| Namespace | Reverse domain | `com.company.app` |
| Entities | PascalCase (Plural) | `SalesOrders`, `Documents` |
| Fields | camelCase | `orderQuantity`, `isProcessed` |
| Actions/Functions | camelCase | `calculateTotal`, `submit` |
| Handlers | PascalCase + Handler | `OrderHandler`, `DocumentHandler` |
| Processors | PascalCase + Processor | `ExtractionProcessor` |
| Utils | PascalCase + Helper/Util | `ValidationHelper` |

---

## 4. Database Modeling (CDS)

### 4.1. Standard Aspects
All entities must use standard aspects for consistency:
```cds
using { managed, cuid } from '@sap/cds/common';

entity Orders : cuid, managed {
    orderNumber : String not null;
    amount      : Decimal(10,2);
    status      : String enum { New; Approved; } default 'New';
}
```
- **`cuid`**: Adds UUID primary key `ID`.
- **`managed`**: Adds audit fields (`createdAt`, `createdBy`, etc.).

### 4.2. Data Types
- **JSON Configs**: `LargeString`
- **Files/Binary**: `LargeBinary`
- **Enums**: Inline enum preferred for fixed states.

---

## 5. Implementation Patterns

### 5.1. CDS First
**If it can be defined in `.cds`, it MUST NOT be in `.ts`.**
- Use `@assert.range`, `@assert.format`, `@readonly`, `@mandatory` in CDS.

### 5.2. No `any` - Ever
Strict typing is mandatory for reliability.
```typescript
import type { TypedRequest } from '@cap-js/cds-types';
// ✅ CORRECT
private async validate(req: TypedRequest<Orders>) { ... }
```

### 5.3. Class-Based Services
All services must extend `cds.ApplicationService` and use `init()`.
```typescript
export class CatalogService extends cds.ApplicationService {
    async init() {
        const { Products } = this.entities;
        this.before('CREATE', Products, this.validate);
        return super.init();
    }
}
```

### 5.4. TypeScript Development Standards

> **CRITICAL:** Follow the official CAP TypeScript guidelines. Do NOT create workaround `.js` proxy files.

**Project Setup (Once):**
```bash
cds add typescript
npm install
```
This command:
- Configures `tsconfig.json` with CAP-compatible settings
- Adds `@cap-js/cds-typer` for automatic type generation
- Adds `@cds-models` to `.gitignore`

**Development Commands:**
| Command | Usage |
|---------|-------|
| `cds watch` | **Standard development command.** Auto-detects `tsconfig.json` and uses `tsx` under the hood. |
| `cds-tsx serve` | Alternative if `cds watch` doesn't detect TS mode. |
| `npx cds-typer "*" --outputDirectory @cds-models` | Regenerate types after schema changes. |

**File Naming:**
- Service implementation: `srv/<service-name>.ts` (matches `.cds` file)
- No `.js` proxy files needed. CAP loads `.ts` files natively when `tsconfig.json` exists.

**Type Imports:**
```typescript
// Import generated types
import { Orders, Products } from '@cds-models/sap/myapp';

// Or import from index
import { Orders } from '@cds-models';
```

**Reference:** https://cap.cloud.sap/docs/node.js/typescript

---

## 6. Service Logic & Handlers

### 6.1. Thin Handlers
Handlers should only orchestrate. Delegate complex logic to `srv/lib/`.
*   **Exception:** For simple CRUD (e.g., defaulting a date), inline logic in the implementation is acceptable. Do not over-abstract.

### 6.2. Event Hooks
- `before`: Validation, authorization, defaulting.
- `on`: Custom logic (actions/functions), replacing default CRUD.
- `after`: Data enrichment, triggering side effects (async).

### 6.3. Data Access (Fluent API)
Avoid raw SQL. Use CAP's fluent API (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
```typescript
const order = await SELECT.one.from(Orders).where({ ID });
```

### 6.4. HANA Vector Operations (Raw SQL Exception)

> **EXCEPTION:** Raw SQL is required for HANA-specific vector functions (`COSINE_SIMILARITY`, `TO_REAL_VECTOR`, `L2_DISTANCE`) because CQL does not fully support these functions.

**Critical Convention: UPPERCASE Identifiers**

When using raw SQL with HANA, **BOTH table names AND column names** must be **UPPERCASE** when quoted:

```typescript
// ✅ CORRECT: UPPERCASE table AND column names
const hanaTableName = entityName.replace(/\./g, '_').toUpperCase();
const hanaColumnName = embeddingColumn.toUpperCase();
// Results: "CNMA_CLAIR2_ASNREFERENCEDATA", "SUPPLIERNAMEEMBEDDING"

await db.run(`
    SELECT *, COSINE_SIMILARITY("${hanaColumnName}", TO_REAL_VECTOR(?)) as "score"
    FROM ${hanaTableName}
    WHERE COSINE_SIMILARITY("${hanaColumnName}", TO_REAL_VECTOR(?)) >= ?
`, [vectorString, vectorString, threshold]);

// ❌ WRONG: Mixed-case quoted identifiers (case-sensitive mismatch)
`"supplierNameEmbedding"` // Will fail! HANA column is "SUPPLIERNAMEEMBEDDING"
`FROM "cnma_clair2_ASNReferenceData"` // Will fail!
```

**Why This Matters:**
- HANA creates tables AND columns in UPPERCASE when deployed via CAP/HDI
- Quoted identifiers (`"tableName"`, `"columnName"`) are case-sensitive in HANA
- Unquoted identifiers are auto-uppercased by HANA

**When to Use Raw SQL vs CQL:**
| Operation | Approach | Reason |
|-----------|----------|--------|
| Vector SELECT (cosine_similarity) | Raw SQL | CQL lacks support for vector function expressions |
| Vector UPDATE (to_real_vector) | Raw SQL | CQL doesn't support `TO_REAL_VECTOR()` in SET clause |
| All other CRUD | CQL | Type-safe, portable, CAP best practice |

**Always Add Documentation Comment:**
```typescript
// Raw SQL required: CQL doesn't support COSINE_SIMILARITY/TO_REAL_VECTOR
// IMPORTANT: HANA requires UPPERCASE for both table and column names
const hanaTableName = entityName.replace(/\./g, '_').toUpperCase();
const hanaColumnName = columnName.toUpperCase();
```

---

## 7. Asynchronous & External Integrations

### 7.1. Persistent Queue (Recommended)

> **UPDATED (Jan 2026):** Use `cds.queued()` for long-running tasks. This replaces `cds.spawn()` for production use.

Use CAP's persistent queue for tasks like AI extraction, Email sending, or any background processing:
```typescript
// Queue a task - stored in cds.outbox.Messages table
const taskService = await cds.connect.to('BackgroundTaskService');
const queuedService = cds.queued(taskService);
await queuedService.emit('processDocument', { documentId: doc.ID });
```

**Benefits over cds.spawn:**
- ✅ Survives server restarts (persisted in HANA)
- ✅ Auto-retry with exponential backoff (20 attempts default)
- ✅ Dead letter queue for failed tasks
- ✅ Transactional (task stored atomically with main transaction)

**Configuration (`package.json`):**
```json
"cds": {
  "requires": {
    "queue": {
      "kind": "persistent-queue",
      "maxAttempts": 20,
      "timeout": "2h"
    },
    "BackgroundTaskService": { "outboxed": true }
  }
}
```

### 7.2. cds.spawn (Legacy/Simple Use Only)

> **⚠️ DEPRECATED for production:** Only use for simple local development scenarios.

`cds.spawn` does NOT persist tasks - they are lost on server restart:
```typescript
// ❌ Tasks lost on server crash/restart
cds.spawn(userContext, async () => {
    await this.processLargeFile(doc.ID);
});
```

### 7.3. External Services
Wrap API calls in `srv/lib/integrations/`. Use `cds.connect.to` for destination handling.

---

## 8. Error Handling & Localization

- **User Errors**: `req.error(400, 'MESSAGE_KEY', 'targetField')`.
- **Not Found**: `req.reject(404, 'NOT_FOUND')`.
- **Localization**: Store messages in `i18n/messages.properties`.

---

## 9. Design Philosophy

### 9.1. SOLID Principles
- **S (Single Responsibility)**: One class = one task.
- **O (Open/Closed)**: Extend via Strategy patterns (e.g., Action Factory).
- **L (Liskov Substitution)**: Subtypes (Executors) must be interchangeable.
- **I (Interface Segregation)**: Small, focused interfaces.
- **D (Dependency Injection)**: Pass dependencies via constructor.

### 9.2. KISS & YAGNI
- **KISS**: Favor simplicity. CAP built-ins > Custom TS.
- **YAGNI**: Don't build for "maybe" futures. Build for current requirements.
- **DRY**: Shared logic belongs in `srv/lib/utils/`.

---

## 10. Testing Standards

- **Unit Tests**: `srv/lib/` logic tested in isolation with Jest.
- **Integration Tests**: Use `cds.test` to verify OData endpoints and handlers.
- **Coverage**: Aim for 80%+ coverage on handlers, 90%+ on library logic.

---

## 11. Performance & API Standards

- **Avoid N+1**: Use `$expand` or batch SELECT.
- **OData V4**: Default for all `srv/service.cds` definitions.
- **Streaming**: Use streams for large binary content (`LargeBinary`).

---

## 12. Implementation Checklist & Done

- [ ] Entity has `cuid`, `managed`.
- [ ] `npx cds-typer` executed, no `any` used.
- [ ] Logic separated (Handler vs Processor).
- [ ] i18n keys added for all UI messages.
- [ ] Integration test covers the new endpoint.
- [ ] No hardcoded strings/secrets.

### 12.1. Implementation Checklist Discipline

> **CRITICAL:** When implementing from a plan document (e.g., `implementation_plan.md` or feature-specific plans):
> 1. Read the full checklist BEFORE starting implementation
> 2. Mark each item `[/]` (in progress) as you work on it
> 3. Mark each item `[x]` (complete) only AFTER verifying that specific item
> 4. DO NOT mark the overall task complete until ALL checklist items are `[x]`
> 
> **Deployment configs are easy to miss - ALWAYS verify:**
> - `mta.yaml` - service bindings for new BTP services
> - `xs-security.json` - scopes/roles if new authorization needed
> - Environment variables documented for local development
> - Seed data files created for new configuration entities
