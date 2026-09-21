---
name: security
description: Application Security, Penetration Testing, OWASP Compliance, and CAP Security Patterns.
---

# 🔐 Application Security Skill

**Context:** Use this skill for security testing, vulnerability assessment, and penetration testing.

## 1. Security Testing Strategy

| Layer | Focus | Tools/Approach |
|-------|-------|----------------|
| **Static Analysis** | Code patterns, hardcoded secrets | ESLint security plugins, manual review |
| **Dynamic Testing** | Runtime behavior, API security | OWASP ZAP, manual API testing |
| **Authorization** | Access control, RLS | Custom test scripts |
| **Authentication** | Token handling, session management | JWT analysis, cookie inspection |

## 2. Reference Modules

- **[OWASP API Security](./resources/owasp-api-security.md)**: API Security Top 10 checklist.
- **[CAP Security Testing](./resources/cap-security-testing.md)**: RLS, @requires, @restrict patterns.
- **[Security Test Templates](./resources/security-test-templates.md)**: Ready-to-use test code.

## 3. When to Use What?

- **New API Endpoint?** → Check OWASP API Top 10.
- **RLS Implementation?** → Run cross-user access tests.
- **Before Release?** → Full penetration test checklist.
- **Security Bug?** → Use attack chain analysis.

## 4. Critical Learnings

### CAP-Specific Security
- **Always use `@requires`** for service-level access control.
- **Always use `@restrict`** for entity-level fine-grained control.
- **`beforeRead` handlers** must add visibility filters for RLS.
- **Never trust `req.user`** without validation in multi-tenant scenarios.

### Common Vulnerabilities in CAP
1. **IDOR via UUID:** Predictable or enumerable IDs in URLs.
2. **Missing RLS:** `beforeRead` without visibility filter.
3. **Privilege Escalation:** Admin actions without `@requires`.
4. **Data Leakage:** Expanding associations without filters.
