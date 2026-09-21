# Security Test Templates

Ready-to-use test templates for the Authorization & Roles feature.

## Template 1: RLS Test Suite

```typescript
/**
 * Row-Level Security Test Suite
 * 
 * Tests for: Requests, Steps, StepApprovals
 */

import { describe, it, expect, beforeAll } from 'vitest';
import cds from '@sap/cds';

describe('RLS Security Tests', () => {
    let db: any;
    let RequestService: any;
    
    beforeAll(async () => {
        db = await cds.connect.to('db');
        RequestService = await cds.connect.to('RequestService');
    });

    describe('Requests Entity', () => {
        const userA = { id: 'user-a', roles: ['Requester'] };
        const userB = { id: 'user-b', roles: ['Requester'] };
        const admin = { id: 'admin', roles: ['Administrator'] };

        it('DRAFT requests visible only to owner', async () => {
            // Arrange: User A's DRAFT request exists in DB
            const draftId = 'user-a-draft-id';
            
            // Act: User B tries to read it
            const result = await RequestService.read('Requests')
                .where({ ID: draftId })
                .with({ user: userB });
            
            // Assert: Should be empty
            expect(result).toHaveLength(0);
        });

        it('SUBMITTED requests visible to assigned approvers', async () => {
            // Arrange: Request with approver assignment
            const submittedId = 'submitted-request-id';
            
            // Act: Assigned approver reads
            const result = await RequestService.read('Requests')
                .where({ ID: submittedId })
                .with({ user: { id: 'assigned-approver', roles: ['Approver'] } });
            
            // Assert: Should be visible
            expect(result).toHaveLength(1);
        });

        it('Admin can see all requests', async () => {
            const result = await RequestService.read('Requests')
                .with({ user: admin });
            
            // Should see everything
            expect(result.length).toBeGreaterThan(0);
        });
    });
});
```

---

## Template 2: Authorization Boundary Test

```typescript
/**
 * Authorization Boundary Tests
 * 
 * Tests privilege escalation and role boundaries.
 */

describe('Authorization Boundaries', () => {
    describe('AdminService Access', () => {
        it('Requester cannot access AdminService', async () => {
            const requester = { id: 'user', roles: ['Requester'] };
            
            await expect(
                AdminService.read('SupportTypes').with({ user: requester })
            ).rejects.toThrow(/403|Forbidden/);
        });

        it('Approver cannot modify SupportTypes', async () => {
            const approver = { id: 'approver', roles: ['Approver'] };
            
            await expect(
                AdminService.update('SupportTypes', 'type-1')
                    .with({ isActive: false })
                    .with({ user: approver })
            ).rejects.toThrow(/403|Forbidden/);
        });
    });

    describe('Action Authorization', () => {
        it('Non-owner cannot submit request', async () => {
            const otherUser = { id: 'other-user', roles: ['Requester'] };
            const requestId = 'user-a-draft';
            
            await expect(
                RequestService.run(
                    { action: 'submit', on: `Requests(${requestId})` }
                ).with({ user: otherUser })
            ).rejects.toThrow(/403|not authorized/);
        });

        it('Non-group-member cannot claim step', async () => {
            const nonMember = { id: 'non-member', roles: ['Approver'] };
            const groupStepId = 'step-assigned-to-finance-team';
            
            await expect(
                RequestService.run(
                    { action: 'claimStep', on: `Steps(${groupStepId})` }
                ).with({ user: nonMember })
            ).rejects.toThrow(/403|not a member/);
        });
    });
});
```

---

## Template 3: IDOR Test Cases

```typescript
/**
 * Insecure Direct Object Reference (IDOR) Tests
 */

describe('IDOR Vulnerability Tests', () => {
    it('UUID enumeration does not leak data', async () => {
        // Test predictable ID patterns
        const guessedIds = [
            '00000000-0000-0000-0000-000000000001',
            '00000000-0000-0000-0000-000000000002',
            '11111111-1111-1111-1111-111111111111',
        ];
        
        const attacker = { id: 'attacker', roles: ['Requester'] };
        
        for (const id of guessedIds) {
            const result = await RequestService.read('Requests')
                .where({ ID: id })
                .with({ user: attacker });
            
            // Should NOT expose others' data
            expect(result.every(r => r.createdBy === 'attacker')).toBe(true);
        }
    });

    it('Direct URL access respects authorization', async () => {
        const sensitiveRequestId = 'other-user-sensitive-request';
        const attacker = { id: 'attacker', roles: ['Requester'] };
        
        const result = await RequestService.read('Requests')
            .where({ ID: sensitiveRequestId })
            .with({ user: attacker });
        
        expect(result).toHaveLength(0); // Not 1!
    });
});
```

---

## Template 4: Group Membership Exploitation

```typescript
/**
 * Group Membership Security Tests
 * 
 * Tests for group-based authorization bypass.
 */

describe('Group Membership Security', () => {
    it('Cannot self-add to group', async () => {
        const attacker = { id: 'attacker', roles: ['Requester'] };
        const adminGroupId = 'admin-group-id';
        
        await expect(
            AdminService.run({
                action: 'addGroupMember',
                params: { groupId: adminGroupId, userId: 'attacker' }
            }).with({ user: attacker })
        ).rejects.toThrow(/403/);
    });

    it('Group deletion requires admin', async () => {
        const requester = { id: 'user', roles: ['Requester'] };
        
        await expect(
            AdminService.delete('ShadowGroups', 'any-group-id')
                .with({ user: requester })
        ).rejects.toThrow(/403/);
    });

    it('Cannot approve via fake group membership', async () => {
        // Even if attacker knows group ID, they shouldn't be able to approve
        const attacker = { id: 'attacker', roles: ['Approver'] };
        const groupAssignedStep = 'step-for-finance-team';
        
        const result = await RequestService.read('Steps')
            .where({ ID: groupAssignedStep })
            .with({ user: attacker });
        
        // Step might be visible, but approve action should fail
        await expect(
            RequestService.run({
                action: 'approve',
                on: `Steps(${groupAssignedStep})`,
                params: { comment: 'Fake approval' }
            }).with({ user: attacker })
        ).rejects.toThrow(/not authorized|not a member/);
    });
});
```

---

## Template 5: Penetration Test Execution Checklist

```markdown
## Pre-Test Setup
- [ ] Test environment isolated from production
- [ ] Test users created with various roles
- [ ] Sample data seeded with known IDs
- [ ] Network traffic capture enabled (optional)

## Test Execution

### 1. Authentication Tests
- [ ] Expired token handling
- [ ] Invalid token rejection
- [ ] Missing token rejection
- [ ] Token scope validation

### 2. Authorization Tests (BOLA)
- [ ] Cross-user DRAFT access (expect 404)
- [ ] Cross-user SUBMITTED access (expect filtered)
- [ ] Admin bypass verification
- [ ] Coordinator cross-request access

### 3. Privilege Escalation
- [ ] Requester → Admin endpoints (expect 403)
- [ ] Approver → Admin endpoints (expect 403)
- [ ] User → modify read-only fields (expect 403)

### 4. Action Authorization
- [ ] submit by non-owner (expect 403)
- [ ] approve by non-approver (expect 403)
- [ ] claimStep by non-group-member (expect 403)
- [ ] delegate by non-coordinator (expect 403)

### 5. Input Validation
- [ ] SQL injection in $filter
- [ ] XSS in text fields
- [ ] Large payload handling
- [ ] Special characters in IDs

## Post-Test
- [ ] Document all findings
- [ ] Rate severity (Critical/High/Medium/Low)
- [ ] Create fix recommendations
- [ ] Verify fixes after remediation
```
