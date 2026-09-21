---
name: technical-consulting
description: Technical architecture decision framework. Use before choosing between platform-standard vs. custom implementations.
---

# Technical Consulting: Architecture Decision Framework

## Core Principle

> **"Use the platform for what the platform is good at. Use custom code for what the platform can't do."**

## The Decision Ladder

Before implementing ANY solution, climb this ladder from bottom to top. **Stop at the first rung that solves your problem.**

```
Rung 5: Custom Code (last resort — document why)
Rung 4: Platform Library (@sap/xssec, passport, etc.)
Rung 3: Framework Feature (CDS annotations, CAP middleware)
Rung 2: Platform Configuration (xs-app.json, mta.yaml, package.json)
Rung 1: Already Solved (existing service, existing module)
```

**Every rung you skip MUST be justified.** If you jump to Rung 5 without checking 1-4, you are doing it wrong.

---

## Protocol: Before Choosing an Approach

### Step 1: Identify the Consumer

| Consumer Type | Preferred Protocol | Auth Pattern |
|---|---|---|
| SAP UI (Fiori, React) | OData via CDS service | Session-based (AppRouter) |
| SAP-to-SAP integration | OData via CDS service | Client credentials (AppRouter + XSUAA) |
| 3rd party external system | REST (Express/custom) | Bearer token (client credentials) |
| Internal background job | Direct CDS API | Service-to-service (no auth) |

**Rule:** Don't force OData on non-SAP consumers. Don't force REST on SAP consumers.

### Step 2: Check Platform Capabilities

| Need | SAP Platform Answer | When to Go Custom |
|---|---|---|
| Authentication | XSUAA + AppRouter | Never — always use platform |
| Authorization / Scopes | CDS `@requires`, `@restrict` | Only if CDS can't express the rule |
| File upload | CDS media entities (PUT binary) | When `multipart/form-data` is required for 3rd party DX |
| Background jobs | CAP Outbox / `cds.spawn()` | When you need external queue (Redis, RabbitMQ) |
| API endpoints | CDS service + OData | When REST is required for external consumers |
| CSRF protection | AppRouter default | Disable only for machine-to-machine APIs |
| Data validation | CDS `@assert`, `@mandatory` | Complex cross-field validation |
| Caching | AppRouter caching headers | Custom in-memory cache for hot data |

### Step 3: Propose the Right Mix

Most real solutions are **hybrid** — use the platform where possible, custom where justified.

**Template for architectural recommendation:**

```markdown
## [Feature Name] Architecture

### Consumer: [Who uses this?]
### Protocol: [OData / REST / Both]

### Layer Responsibilities

| Layer | Handles | Standard? |
|-------|---------|-----------|
| AppRouter | [What] | ✅/⚠️/❌ |
| CDS Service | [What] | ✅/⚠️/❌ |
| Custom Code | [What] | Justified because: [reason] |

### Why Not Full Platform-Standard?
[Explain the gap that requires custom code]
```

---

## Common SAP CAP Architecture Decisions

### 1. REST API for External Integration

**Wrong:** Custom Express routes with custom JWT middleware
**Right:** Custom Express routes for upload + CDS service for auth/queries

```
AppRouter (token validation) → Express (file upload) + CDS (read endpoints + @requires)
```

### 2. File Upload

**Wrong:** Base64 encoding in OData action body
**Right:** `multipart/form-data` via Express + multer (industry standard for REST)
**Also Right:** CDS media entity via PUT (standard for OData consumers)

**Decision depends on consumer:** 3rd party → multer. SAP UI → CDS media entity.

### 3. Background Processing

**Wrong:** `setTimeout()` or `setInterval()` in Express middleware
**Right:** CAP Outbox pattern, `cds.spawn()`, or `emit()` to queued service

### 4. Authentication

**Wrong:** Custom JWT validation middleware, manual token decode
**Right:** AppRouter `authenticationType: "xsuaa"` + CDS `@requires`

### 5. CSRF Protection

**Wrong:** Disabling CSRF globally
**Right:** Disable CSRF only for machine-to-machine API routes (`csrfProtection: false`)

---

## Anti-Pattern Detection Checklist

Before committing code, scan for these anti-patterns:

| If You See This... | It's Probably Wrong Because... | Fix |
|---|---|---|
| `authenticationType: "none"` | Removes security entirely | Use `"xsuaa"` + fix the real issue |
| `import('@sap/xssec')` in custom middleware | Reinventing platform auth | Use `@requires` in CDS or AppRouter |
| Manual JWT `Buffer.from(base64)` decode | Token validation is platform's job | AppRouter validates, you just check scopes |
| `app.use('/api', customAuthMiddleware)` | Custom security code | CDS `@requires` or AppRouter auth |
| `any` type casts to bypass TypeScript | Hiding real API misuse | Use correct API version and types |
| `try { } catch { /* empty */ }` | Swallowing errors | Log context, rethrow or handle explicitly |
| Hardcoded URLs/credentials | Security risk | Use destinations, service bindings |

---

## When Custom Code IS Justified

Document these scenarios explicitly:

1. **Protocol mismatch:** Consumer needs REST, platform speaks OData
2. **File upload format:** Consumer sends `multipart/form-data`, CDS expects OData binary
3. **Complex business logic:** Rules too complex for CDS annotations
4. **Performance:** Platform approach has proven performance limits
5. **Third-party library:** Integrating with non-SAP system via specific SDK

**Template for justification:**

```markdown
### Custom Code Justification: [Component]
- **What:** [What custom code does]
- **Why not platform:** [Specific gap in platform capability]
- **Compensating controls:** [How we mitigate the risk of going custom]
- **Revisit when:** [Condition under which we'd switch to platform]
```

---

## Summary: The Consulting Mindset

1. **Understand the consumer** before choosing technology
2. **Climb the decision ladder** from platform config → custom code
3. **Justify every custom line** that replaces platform functionality
4. **Propose hybrid** when the problem spans multiple concerns
5. **Document the "why"** for future maintainers
