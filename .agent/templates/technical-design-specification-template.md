# [System Name] Technical Design Specification

**Version:** 1.0

**Status:** [Draft/Approved]

**Date:** YYYY-MM-DD

## 1. Executive Summary

- **Objective:** High-level summary of what this specific module/feature solves.

- **Core Architectural Pattern:** (e.g., Metadata-Driven, Hybrid SQL/JSON, Event-Driven).

- **Business Impact:** Why are we building this?

## 2. Core Principles & Constraints

- **Single Source of Truth:** (e.g., Backend calculates all permissions).

- **Scalability Goal:** (e.g., Support 20+ dynamic types without code changes).

- **Holy Trinity Compliance:** * **KISS:** How are we keeping this specific design simple?
  
  - **DRY:** What shared libraries (`lib/`) are we reusing?
  
  - **YAGNI:** What features are we explicitly *not* building yet?

## 3. Data Modeling (`db/schema.cds`)

*Describe the persistence layer. Distinguish between standard SQL columns and JSON blobs.*

### 3.1 Entity Definitions

- **Static Entities:** (Standard relational tables).

- **Dynamic Entities:** (Tables containing `LargeString` JSON payloads).

- **Configuration Entities:** (Blueprints, UI Schemas, Rule Engines).

### 3.2 Virtual Fields

- List any `@runtime` or `virtual` fields used for security maps (e.g., `_permissions`).

## 4. Security Architecture

### 4.1 Access Control (Row-Level)

- **Scopes:** Define required XSUAA scopes (e.g., `access.internal`, `task.write.own`).

- **@restrict rules:** Document the CDS-level restrictions.

### 4.2 Field Control (The "Brain")

- **Precedence Logic:** Document the order of rule application (e.g., `Status > Role > Type`).

- **The Bridge:** How are XSUAA scopes mapped to database-driven roles?

## 5. Service Layer Implementation (`srv/`)

### 5.1 API Definition (`.cds`)

- Service projections and actions/functions.

### 5.2 Custom Logic (`.ts`)

- **READ Handlers:** Describe batching strategies to avoid N+1 issues.

- **WRITE Handlers:** Describe validation logic (Incoming vs. DB State).

- **Shared Libraries:** Reference logic residing in `srv/lib/`.

## 6. Frontend Architecture (React)

### 6.1 Component Strategy

- **Runtime Components:** (e.g., `DynamicField`, `DynamicForm`).

- **Admin Components:** (e.g., Form Studio, Drag-and-Drop canvas).

### 6.2 State & Security Management

- **Hooks:** (e.g., `useFieldPermission` usage).

- **Metadata Consumer:** How the UI fetches and caches JSON Blueprints.

## 7. Performance & Optimization

- **Caching Strategy:** (e.g., Caching ScreenConfig results).

- **Concurrency:** (e.g., ETag handling for Admin configuration).

- **Payload Optimization:** (e.g., Batching OData requests).

## 8. Implementation Checklist (Definition of Done)

- [ ] **Database:** Schema updated and migrated.

- [ ] **Security:** `xs-security.json` updated; scopes tested.

- [ ] **Backend:** Unit tests for `fieldControl.ts` merge logic.

- [ ] **Integration:** Batch READ handlers optimized (no N+1).

- [ ] **Frontend:** Component handles all `ControlValue` states (Hidden, Read-Only, etc.).

- [ ] **Validation:** Write Guard rejects invalid JSON payloads.
