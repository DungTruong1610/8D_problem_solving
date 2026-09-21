---
name: cap-review-checklist
description: CAP-specific code review checklist extracted from backend-guidelines.md. Use during code reviews to ensure compliance with team standards.
---

# CAP Code Review Checklist

Use this checklist during code reviews. Items are extracted from [backend-guidelines.md](../../../guidelines/backend-guidelines.md).

## Entity & Schema

- [ ] Entity has `cuid` and `managed` aspects
- [ ] CDS types used appropriately (`LargeString` for JSON, `LargeBinary` for files)
- [ ] Inline enums for fixed state values
- [ ] Associations vs. compositions used correctly

## TypeScript Quality

- [ ] No `any` types — `cds-typer` generated types used
- [ ] `async/await` for asynchronous operations
- [ ] Descriptive function names in camelCase
- [ ] No hardcoded values (use env vars or constants)

## Architecture

- [ ] Logic separated: Handler (orchestration) vs Processor (business logic)
- [ ] Service extends `cds.ApplicationService` with `init()`
- [ ] Thin handlers — complex logic in `srv/lib/`
- [ ] External APIs wrapped in `srv/lib/integrations/`

## Event Handlers

- [ ] Correct hook usage: `before` (validation), `on` (custom), `after` (enrichment)
- [ ] Draft events handled (`draftPrepare`, `draftActivate`)
- [ ] `$expand` depth considered
- [ ] Transaction boundaries respected

## HANA & Database

- [ ] Fluent API used (`SELECT`, `INSERT`, `UPDATE`, `DELETE`)
- [ ] Raw SQL only for vector operations (`COSINE_SIMILARITY`, `TO_REAL_VECTOR`)
- [ ] **UPPERCASE** table and column names in raw HANA SQL
- [ ] No N+1 queries — use `$expand` or batch SELECT

## Async Processing

- [ ] `cds.queued()` for background tasks (NOT `cds.spawn`)
- [ ] Outbox configured for persistent queue
- [ ] Timeout handling for external calls

## Security & i18n

- [ ] `@requires` annotations for authorization
- [ ] XSUAA scopes checked where needed
- [ ] i18n keys for all user-facing messages
- [ ] No secrets in code — use environment variables

## Testing & Deployment

- [ ] Integration test covers new endpoint
- [ ] `mta.yaml` updated for new BTP services
- [ ] `xs-security.json` updated for new scopes/roles
- [ ] Seed data files created for new configuration entities

---

## Quick Reference

From [coding-standards.md](../../../rules/coding-standards.md):

| Principle | Application |
|-----------|-------------|
| **KISS** | Use CDS definitions before TypeScript logic |
| **DRY** | Extract repeated code to `srv/lib/utils/` |
| **YAGNI** | Build features when needed, not "just in case" |
| **SRP** | One class = one reason to change |
