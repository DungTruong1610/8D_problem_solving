# OWASP API Security Top 10 (2023)

Use this checklist when reviewing or testing API endpoints.

## API1: Broken Object Level Authorization (BOLA)

**Description:** APIs expose endpoints that handle object IDs, enabling attackers to access resources belonging to other users.

**Test Scenarios:**
1. Get User A's resource ID → Request with User B's token → Expect 403/404
2. Enumerate IDs in collection endpoints
3. Check association expansion (e.g., `/requests?$expand=requester`)

**CAP Mitigation:**
```js
// In beforeRead handler
.where({ createdBy: req.user.id })
```

---

## API2: Broken Authentication

**Description:** Flawed authentication mechanisms allow attackers to assume other users' identities.

**Test Scenarios:**
1. Expired JWT token acceptance
2. Token without signature validation
3. Weak password policies

**CAP Mitigation:**
- Use XSUAA with proper scopes
- Never implement custom JWT validation

---

## API3: Broken Object Property Level Authorization

**Description:** Lack of validation for which properties a user can read/write.

**Test Scenarios:**
1. PATCH request with `isAdmin: true`
2. Read-only fields being modified
3. Hidden fields exposed in response

**CAP Mitigation:**
```cds
entity Users {
  email : String @readonly;
  role  : String @readonly;
}
```

---

## API4: Unrestricted Resource Consumption

**Description:** No limits on request rate, payload size, or query complexity.

**Test Scenarios:**
1. Send 1000 requests/second
2. Upload 10GB file
3. Request `$expand=*&$top=10000`

**CAP Mitigation:**
```cds
@cds.query.limit.max: 100
entity Requests { ... }
```

---

## API5: Broken Function Level Authorization

**Description:** Complex access control policies with unclear separation between admin and user functions.

**Test Scenarios:**
1. Non-admin calling admin endpoints
2. User triggering batch operations
3. Accessing internal/debug endpoints

**CAP Mitigation:**
```cds
service AdminService @(requires: 'Administrator') {
  entity Config as projection on db.Config;
}
```

---

## API6: Unrestricted Access to Sensitive Business Flows

**Description:** API exposes business flows that can be exploited when used excessively.

**Test Scenarios:**
1. Creating thousands of requests to flood inbox
2. Approval automation via scripts
3. Brute-force one-time codes

---

## API7: Server-Side Request Forgery (SSRF)

**Description:** API fetches remote resources without validating user-supplied URLs.

**Test Scenarios:**
1. Webhook URL pointing to internal services
2. File import from `file:///etc/passwd`
3. Redirect to internal metadata endpoints

---

## API8: Security Misconfiguration

**Description:** Insecure default configurations, incomplete setups, open cloud storage.

**Test Scenarios:**
1. Debug mode enabled in production
2. Default credentials
3. Verbose error messages exposing stack traces

---

## API9: Improper Inventory Management

**Description:** Outdated or undocumented API versions, endpoints left active.

**Test Scenarios:**
1. Access `/v1/` when only `/v2/` should be active
2. Deprecated endpoints still functional
3. Shadow APIs not in documentation

---

## API10: Unsafe Consumption of APIs

**Description:** Trusting third-party API responses without validation.

**Test Scenarios:**
1. External API returning malicious payloads
2. No timeout on external calls causing DoS
3. Following redirects to malicious sites
