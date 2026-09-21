---
skill: OData Frontend Integration
description: Best practices for consuming CAP OData V4 services in React.
---

# 📡 OData Frontend Integration Skill

**Context:** Use this skill when writing the Data Fetching layer (Hooks/API Services) in the Frontend.

## 1. State Management
- **Tool:** Use **TanStack Query (React Query)** or similar async state manager.
- **Caching:** Cache keys must map to Entity + Filter combination.
    ```typescript
    useQuery(['invoices', { status: 'OPEN' }], ...)
    ```

## 2. OData Parameters
- **Querying:** Use standard OData V4 parameters manually or via a builder:
    - `$expand`: Fetch related data to avoid N+1 problems.
    - `$select`: Fetch ONLY needed fields to reduce payload.
    - `$count=true`: Essential for pagination.
- **Filtering:** Construct valid OData filter strings (e.g., `status eq 'OPEN' and totalAmount gt 1000`).

## 3. Optimistic Updates
- **UX Rule:** The UI should react *immediately*.
- **Constraint:** Only use for simple toggles/likes. For complex forms, a "Loading" spinner is safer and simpler.
- **Implementation:**
    1. Update local cache immediately upon mutation.
    2. Send API request.
    3. Rollback if API fails.

## 4. Error Handling
- **Service Layer:** Handle 401/403 globally (redirect to login).
- **Component Layer:** Display user-friendly error messages for 400/500 errors (e.g., "Could not save Invoice").
- **Validation:** Map backend 400 validation errors to Form Input fields.
