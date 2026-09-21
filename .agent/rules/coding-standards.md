---
name: coding-standards
mode: always_on
description: Strict Coding Standards for TypeScript, CAP, and React. Adherence is mandatory.
---

# Coding Standards

## Backend Development
- **Language**: TypeScript with strict mode enabled
- **Framework**: SAP Cloud Application Programming Model (CAP)
- **Architecture**: Service → Handler → Processor layered pattern
- **Database**: CDS models with `cuid` and `managed` aspects
- **Logging**: Use structured logging (no `console.log` in production)
- **Detailed Standards**: See `backend-guidelines.md` for comprehensive CAP patterns

## Layered Architecture Constraints (Mandatory)

> ⚠️ **Violation of these rules results in code review rejection.**

| Layer | Location | Allowed Content |
|-------|----------|-----------------|
| Service | `srv/*.ts` | `init()` with event registrations ONLY |
| Handlers | `srv/handlers/` | Event orchestration, validation routing |
| Processors | `srv/lib/processors/` | Business logic, algorithms |
| Integrations | `srv/lib/integrations/` | External API wrappers |
| Utils | `srv/lib/utils/` | Shared helper functions |

**❌ DO NOT:**
- Write business logic directly in service files (`srv/*.ts`)
- Put complex validation in service `init()` — use handlers
- Create "one-file-does-all" implementations

**✅ DO:**
- Keep service files thin (< 50 lines, only `init()` and method bindings)
- Delegate to `srv/handlers/` for event handling
- Use `srv/lib/` for testable, reusable logic

**⚠️ Exception:** Trivial CRUD defaults (< 5 lines, e.g., setting `createdAt`) may stay inline.

## TypeScript Constraints (Mandatory)

**❌ DO NOT:**
- Use `any` type — use `cds-typer` generated types from `@cds-models`
- Use `console.log` — use structured logging (`cds.log`)
- Use callbacks — use `async/await` for asynchronous operations

**✅ DO:**
- Run `npx cds-typer "*"` after CDS schema changes
- Import types: `import { Orders } from '@cds-models/namespace'`
- Define interfaces for all API responses and complex objects

## HANA Raw SQL Constraints (Mandatory)

> ⚠️ Only use raw SQL for vector operations (`COSINE_SIMILARITY`, `TO_REAL_VECTOR`)

**❌ DO NOT:**
- Use raw SQL for standard CRUD — use CQL fluent API (`SELECT`, `INSERT`, `UPDATE`, `DELETE`)
- Use mixed-case identifiers in raw SQL — HANA is case-sensitive when quoted

**✅ DO:**
- Use **UPPERCASE** for all table and column names in raw SQL
- Always add comment: `// Raw SQL required: CQL doesn't support [function]`
- Convert entity names: `entityName.replace(/\./g, '_').toUpperCase()`

## Async Processing Constraints (Mandatory)

**❌ DO NOT:**
- Use `cds.spawn()` in production — tasks are lost on server restart

**✅ DO:**
- Use `cds.queued()` for background tasks (persisted in `cds.outbox.Messages`)
- Configure outbox: `"outboxed": true` in `package.json`
- Handle timeouts for external API calls

## Frontend Development
- **Language**: TypeScript (strict mode enabled)
- **Framework**: React 19 with functional components and hooks
- **Styling**: Tailwind CSS v4 (utility-first approach)
- **File Extensions**: `.tsx` for components, `.ts` for utilities
- **Build Tool**: Vite
- **Detailed Standards**: See `design-guidelines.md` for comprehensive UI/UX patterns

## Design Principles (SOLID, KISS, DRY, YAGNI)
- **Single Responsibility**: One class = one reason to change (Service → Handler → Processor)
- **Dependency Injection**: Pass dependencies via constructor, not `new` inside methods
- **KISS**: Use CDS definitions before TypeScript logic
- **DRY**: Extract repeated code to utilities (`srv/lib/utils/`)
- **YAGNI**: Build features when needed, not "just in case"

## General Rules
- Define interfaces for all props, API responses, and entities
- Use `async/await` for asynchronous operations
- Follow Single Responsibility Principle (SRP)
- No hardcoded values (use environment variables or constants)
- All functions must have descriptive names in camelCase

