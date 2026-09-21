# CAP Security Testing Patterns

Security testing patterns specific to SAP Cloud Application Programming Model (CAP).

## 1. Row-Level Security (RLS) Testing

### Test Pattern: Cross-User Data Access

```typescript
describe('RLS: Requests Entity', () => {
    it('User A cannot see User B DRAFT request', async () => {
        // Create request as User A
        const requestId = await createRequestAs('user-a@example.com');
        
        // Attempt to read as User B
        const response = await GET(`/odata/v4/request/Requests(${requestId})`, {
            auth: { user: 'user-b@example.com' }
        });
        
        expect(response.status).toBe(404); // Not 200!
    });

    it('Filtered list excludes other users DRAFTs', async () => {
        const response = await GET('/odata/v4/request/Requests', {
            auth: { user: 'user-a@example.com' }
        });
        
        const requests = response.data.value;
        const otherUserDrafts = requests.filter(
            r => r.status === 'DRAFT' && r.createdBy !== 'user-a@example.com'
        );
        
        expect(otherUserDrafts).toHaveLength(0);
    });
});
```

### What to Check in Code

```javascript
// ✅ CORRECT: RLS in beforeRead
this.before('READ', 'Requests', async (req) => {
    if (!isAdmin(req.user)) {
        req.query.where({ createdBy: req.user.id });
    }
});

// ❌ WRONG: No visibility filter
this.before('READ', 'Requests', async (req) => {
    // Missing filter - exposes all data!
});
```

---

## 2. Authorization Annotation Testing

### Test Pattern: @requires Enforcement

```typescript
describe('@requires: Administrator', () => {
    it('Non-admin cannot access AdminService', async () => {
        const response = await GET('/odata/v4/admin/SupportTypes', {
            auth: { user: 'regular-user@example.com' }
        });
        
        expect(response.status).toBe(403);
    });

    it('Admin can access AdminService', async () => {
        const response = await GET('/odata/v4/admin/SupportTypes', {
            auth: { user: 'admin@example.com', roles: ['Administrator'] }
        });
        
        expect(response.status).toBe(200);
    });
});
```

### Test Pattern: @restrict Grant Verification

```typescript
describe('@restrict on entity', () => {
    it('User can only update own requests', async () => {
        const otherUserRequest = 'other-user-request-id';
        
        const response = await PATCH(
            `/odata/v4/request/Requests(${otherUserRequest})`,
            { title: 'Hacked!' },
            { auth: { user: 'attacker@example.com' } }
        );
        
        expect(response.status).toBe(403);
    });
});
```

---

## 3. Action Authorization Testing

### Test Pattern: Bound Action Security

```typescript
describe('Bound Actions Authorization', () => {
    it('Non-approver cannot approve step', async () => {
        const stepId = 'step-assigned-to-someone-else';
        
        const response = await POST(
            `/odata/v4/request/Steps(${stepId})/approve`,
            { comment: 'Unauthorized approval' },
            { auth: { user: 'random-user@example.com' } }
        );
        
        expect(response.status).toBe(403);
    });

    it('Approver can approve assigned step', async () => {
        const stepId = 'step-assigned-to-approver';
        
        const response = await POST(
            `/odata/v4/request/Steps(${stepId})/approve`,
            { comment: 'Legitimate approval' },
            { auth: { user: 'assigned-approver@example.com' } }
        );
        
        expect(response.status).toBe(200);
    });
});
```

---

## 4. Association Expansion Security

### Test Pattern: Expand Leaking Data

```typescript
describe('Association Expansion Security', () => {
    it('Expanding user does not leak sensitive fields', async () => {
        const response = await GET(
            '/odata/v4/request/Requests?$expand=requester',
            { auth: { user: 'regular-user@example.com' } }
        );
        
        const requester = response.data.value[0].requester;
        
        // Should NOT expose sensitive fields
        expect(requester.passwordHash).toBeUndefined();
        expect(requester.internalId).toBeUndefined();
    });
});
```

### What to Check in Code

```cds
// ✅ CORRECT: Projection hides sensitive fields
entity ShadowUsers as projection on db.ShadowUsers {
    ID, email, displayName
    // passwordHash, internalId NOT included
}

// ❌ WRONG: Exposing full entity
entity ShadowUsers as projection on db.ShadowUsers;
```

---

## 5. Input Validation Testing

### Test Pattern: Injection Attempts

```typescript
describe('Input Validation', () => {
    it('Rejects SQL injection in search', async () => {
        const response = await GET(
            `/odata/v4/request/Requests?$filter=title eq 'x' OR 1=1 --'`,
            { auth: { user: 'attacker@example.com' } }
        );
        
        // CAP should sanitize or reject
        expect(response.status).not.toBe(200);
    });

    it('Rejects XSS in title field', async () => {
        const response = await POST(
            '/odata/v4/request/Requests',
            { title: '<script>alert("XSS")</script>' },
            { auth: { user: 'user@example.com' } }
        );
        
        // Should be sanitized or rejected
        expect(response.data.title).not.toContain('<script>');
    });
});
```

---

## 6. Security Checklist for Code Review

### Service Definition (CDS)
- [ ] All admin services have `@requires: 'Administrator'`
- [ ] Sensitive entities have `@restrict` annotations
- [ ] Read-only fields marked with `@readonly`
- [ ] Query limits set with `@cds.query.limit.max`

### Handlers (TypeScript)
- [ ] `beforeRead` has visibility filter for RLS
- [ ] Action handlers verify caller authorization
- [ ] Input validation before database operations
- [ ] No hardcoded credentials or secrets

### Associations
- [ ] Sensitive fields excluded from projections
- [ ] Expand paths validated or restricted
- [ ] Circular references handled
