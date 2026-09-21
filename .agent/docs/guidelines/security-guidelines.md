# Security & Error Handling Guidelines

**Version:** 2.0 (AI-Optimized)
**Status:** Approved
**Target Audience:** All Developers, AI Agents

---

## 1. Authentication & Authorization

### 1.1. XSUAA Integration
All services must use SAP BTP's XSUAA for JWT-based authentication.
```javascript
const xsuaaService = xsenv.getServices({ uaa: 'my-app-xsuaa' });
passport.use(new JWTStrategy(xsuaaService.uaa));
```

### 1.2. Role-Based Access Control (RBAC)
Define restrictions in `srv/service.cds`:
```cds
service ExtractionService @(requires: 'authenticated-user') {
    entity Documents @(restrict: [
        { grant: ['READ'], to: 'Viewer' },
        { grant: '*', to: 'Admin' }
    ]);
}
```

---

## 2. Input Validation

### 2.1. Backend-First Validation
Validate all inputs in service handlers or CDS constraints.
- **Media Type**: Use a whitelist (e.g., `application/pdf`).
- **Size**: Enforce strict limits (e.g., 20MB).
- **Format**: Use `@assert.format` in CDS for regex checks.

### 2.2. Frontend Validation
Validate before sending to API to improve UX, but never rely on it for security.

---

## 3. Error Handling Standards

### 3.1. User Feedback
Use structured error responses that i18n can translate.
`req.error(400, 'INVALID_FILE_NAME', 'fileName')`

### 3.2. Global Handling
- **Mask Internals**: Never expose stack traces or DB errors to the user in production.
- **Log Errors**: Record 5xx errors with full context for diagnostics.

---

## 4. Data Protection

### 4.1. Sensitive Data
- **Never Log**: Passwords, SSNs, or API Keys.
- **Mask PII**: Use masking utilities for logging personal data.

### 4.2. Encryption
Encrypt sensitive business data at rest using AES-256-CBC if not handled by the DB.

---

## 5. API Security

### 5.1. CSRF Protection (BTP/AppRouter)
**Critical for production deployments** with AppRouter:

- **Token Required**: All write operations (POST, PUT, PATCH, DELETE) must include CSRF token
- **Fetch Token**: Use `GET` with `x-csrf-token: Fetch` header (CAP doesn't support HEAD)
- **Single Axios Instance**: Never create multiple axios instances - use shared instance with interceptor
- **Build Process**: Always rebuild frontend (`npx vite build`) before `mbt build`

**📖 See:** [`.agent/guidelines/csrf-protection-troubleshooting.md`](./csrf-protection-troubleshooting.md) for complete implementation and debugging guide.

### 5.2. Additional Protections
- **Rate Limiting**: Apply to all public or heavy endpoints.
- **CORS**: Strictly whitelist allowed origins.
- **OWASP**: Follow top 10 mitigations (Injection, Broken Auth, etc.).

---

## 6. Security Checklist

- [ ] Authentication required for all endpoints.
- [ ] RBAC implemented at the service level.
- [ ] Input validation (Size, Type, Format) enforced.
- [ ] Sensitive data masked in logs.
- [ ] No secrets in source code (use env vars).
- [ ] Security headers enabled.
- [ ] **CSRF protection implemented for BTP deployments.**
