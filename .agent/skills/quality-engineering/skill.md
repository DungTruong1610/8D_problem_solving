---
name: quality-engineering
description: Engineering quality gates and decision framework. Enforces industry-standard practices over quick workarounds. MUST be consulted before writing custom security, authentication, or infrastructure code.
---

# Quality Engineering: Do It Right Over Making It Work

## Core Principle

> **If you are writing custom code to solve a problem that the platform already handles, you are doing it wrong.**

This skill defines mandatory quality gates that MUST be followed before implementing any solution. The priority order is:

1. **Platform Configuration** (e.g., `xs-app.json`, `package.json`, `.cdsrc.json`)
2. **Framework Features** (e.g., CDS annotations like `@requires`, `@restrict`)
3. **Platform Libraries** (e.g., `@sap/xssec`, `@sap/approuter`)
4. **Custom Code** (only as last resort, with explicit justification)

---

## Mandatory Quality Gates

### Gate 1: Root Cause Analysis (Before ANY Code Change)

**STOP and ask these questions before writing code:**

- [ ] What is the **exact error**? (HTTP status, error message, log output)
- [ ] **Where** does the error originate? (AppRouter? CAP? Database? External service?)
- [ ] Is this a **configuration issue** or a **code issue**?
- [ ] Does the platform already provide a solution for this?

**Anti-pattern:** Seeing a 401 error and immediately changing `authenticationType` to `"none"`.
**Standard approach:** Check AppRouter logs, verify CSRF settings, check token audience.

### Gate 2: Platform-Standard Check (Before Writing Custom Code)

**Before writing ANY custom code, verify:**

- [ ] Is there a **CDS annotation** that handles this? (`@requires`, `@restrict`, `@mandatory`, etc.)
- [ ] Is there a **configuration option** in `xs-app.json`, `mta.yaml`, or `package.json`?
- [ ] Is there a **built-in middleware** or service that handles this? (CAP auth, AppRouter CSRF, etc.)
- [ ] How do the **SAP official samples** (cloud-cap-samples, cap-sflight) solve this?

**Anti-pattern:** Writing custom JWT validation middleware when `@requires` annotation exists.
**Standard approach:** Define a CDS service with `@requires: 'integration'` and let CAP handle auth.

### Gate 3: Security Review (Before Changing Auth Configuration)

**NEVER do these without explicit justification:**

- ❌ Set `authenticationType: "none"` for any route that handles data
- ❌ Skip token validation in middleware
- ❌ Disable CSRF protection without understanding why it's needed
- ❌ Write custom auth code when the platform provides auth infrastructure

**If you must change security settings, document:**
1. What the standard behavior is
2. Why it doesn't work for this use case
3. What compensating control replaces the removed security

### Gate 4: Code Review Checklist (Before Committing)

- [ ] Does this follow the **SAP CAP best practices**?
- [ ] Would a **senior SAP consultant** approve this approach?
- [ ] Does this introduce **unnecessary complexity** that configuration could solve?
- [ ] Is this solution **maintainable** by someone unfamiliar with the codebase?
- [ ] Does this follow the **principle of least privilege**?

---

## Decision Framework: Configuration vs. Custom Code

```
Problem Encountered
       │
       ▼
Is there a platform config option?  ──YES──▶ Use it. Done.
       │
       NO
       ▼
Is there a CDS annotation?  ──YES──▶ Use it. Done.
       │
       NO
       ▼
Is there a platform library?  ──YES──▶ Use it with standard API. Done.
       │
       NO
       ▼
Write custom code, but:
  1. Document WHY platform options don't work
  2. Follow platform conventions (naming, structure)
  3. Add TODO to revisit when platform support arrives
```

---

## SAP-Specific Standards

### Authentication & Authorization
- **ALWAYS** use `authenticationType: "xsuaa"` for protected routes
- **ALWAYS** set `csrfProtection: false` for machine-to-machine API endpoints  
- **ALWAYS** use CDS `@requires` annotations for scope enforcement
- **NEVER** write custom JWT validation when CAP auth middleware exists
- **NEVER** set `authenticationType: "none"` without a compensating security control

### API Design
- **PREFER** CDS service definitions with OData protocol over custom Express routes
- **IF** custom Express routes are needed (e.g., file upload with multer), still leverage CAP auth infrastructure
- **ALWAYS** define scopes in `xs-security.json` and enforce them in CDS or middleware

### Error Handling
- **DIAGNOSE** before fixing — check logs, trace the request path
- **FIX** the root cause, not the symptom
- **TEST** the fix in isolation before deploying

### Deployment
- **ALWAYS** use `cf update-service` for XSUAA changes — redeploy only when code changes
- **ALWAYS** verify token scopes at `jwt.io` before debugging further
- **NEVER** assume the problem is in code when it could be in binding/configuration

---

## Common Anti-Patterns to Avoid

| Anti-Pattern | Why It's Wrong | Standard Approach |
|---|---|---|
| `authenticationType: "none"` | Removes security layer entirely | Investigate why `"xsuaa"` fails (CSRF? audience?) |
| Custom JWT middleware | Reinvents what platform provides | `@requires` in CDS or AppRouter auth |
| Hardcoded credentials | Security risk, maintenance burden | Service bindings, environment variables |
| `any` type casts to bypass TS | Hides real type issues | Fix the types, use correct API version |
| Catch-all `try/catch` without logging | Swallows errors silently | Log the error with context, rethrow if needed |
| Copy-paste from Stack Overflow | May not apply to SAP context | Check SAP official documentation first |

---

## When Uncertain

1. **Search SAP official docs** before implementing
2. **Check SAP community** (community.sap.com) for similar issues
3. **Ask the user** if the approach aligns with their standards
4. **Document your reasoning** in a comment if taking a non-standard approach

> **Remember:** A solution that takes 10 minutes to configure correctly is always better than a 2-hour custom implementation that creates technical debt.
