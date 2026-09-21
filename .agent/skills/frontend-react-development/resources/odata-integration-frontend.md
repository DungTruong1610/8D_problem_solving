---
skill: OData Frontend Integration
description: Best practices for consuming CAP OData V4 services in React.
---

# 📡 OData Frontend Integration Skill

**Context:** Use this skill when writing the Data Fetching layer (Hooks/API Services) in the Frontend.

## 1. Directory Structure for API Calls
- **`src/services/core/`**: Contains the foundational classes for OData communication (`BaseODataService`, `ODataQueryBuilder`, `ODataFilter`). **Do not modify these unless making core infrastructure changes.**
- **`src/services/domain/`**: Contains domain-specific service instances (e.g., `extraction`, `workflow`, `worklist`). Always check if a service exists here before creating a new one.

## 2. Creating a Domain Service
If you need to interact with a new OData entity, create a service class in `src/services/domain/<domain>/` extending `BaseODataService`:

```typescript
import { BaseODataService } from '@/services/core/baseService';
import { ODataQueryBuilder, ODataFilter } from '@/services/core/odataHelper';

export interface MyEntity {
  ID: string;
  status: string;
  createdAt?: string;
  __etag?: string;
}

class MyEntityService extends BaseODataService<MyEntity> {
  constructor() {
    // Arg 1: Service Base Path, Arg 2: Entity Set Name
    super('odata/v4/MyService', 'MyEntities');
  }

  // Define custom fetchers wrapping the core getList/getById
  async getActiveItems() {
    return this.getList(
      new ODataQueryBuilder()
        .filter(ODataFilter.eq('status', 'ACTIVE'))
        .orderBy('createdAt', 'desc')
        .count()
    );
  }
}

// Export a singleton instance
export const myEntityService = new MyEntityService();
```

## 3. Querying Data (The `ODataQueryBuilder`)
**Never manually concatenate OData URL strings.** Always use `ODataQueryBuilder` and `ODataFilter`:

```typescript
const query = new ODataQueryBuilder()
  .select(['ID', 'name', 'status'])
  .expand('relatedEntity')
  .filter(
    ODataFilter.and(
      ODataFilter.eq('status', 'OPEN'),
      ODataFilter.gt('amount', 1000)
    )
  )
  .top(20)
  .skip(0)
  .count(); // Sets $count=true for pagination

const response = await myEntityService.getList(query);
```

## 4. State Management (React Query)
- **Tool:** Use **TanStack Query (React Query)** inside your custom hooks.
- **Caching:** Cache keys must map to Entity + Filter combination.

```typescript
import { useQuery } from '@tanstack/react-query';
import { myEntityService } from '@/services/domain/myDomain/myEntityService';

export function useActiveItems() {
  return useQuery({
    queryKey: ['myEntities', { status: 'ACTIVE' }],
    queryFn: () => myEntityService.getActiveItems()
  });
}
```

## 5. Mutations & Optimistic Concurrency
`BaseODataService` handles `@odata.etag` automatically.
When calling `update` or `delete`, you **MUST** pass the `etag` if the entity supports concurrency control (which prevents mid-air collisions):

```typescript
// Etag is populated by BaseODataService during getById, create, or via list fetching
await myEntityService.update(item.ID, { status: 'CLOSED' }, item.__etag);
```

## 6. Actions and Functions
For unbound or bound OData actions and functions, use the built-in helper methods on `BaseODataService`:

```typescript
// Calling an unbound action
const result = await myEntityService.callUnboundAction<{ success: boolean }>('approveAll');

// Calling a bound action on a specific entity
const boundResult = await myEntityService.callAction<{ status: string }>('Approve', { note: 'OK' });

// Calling an OData function (GET)
const funcResult = await myEntityService.callFunction<{ count: number }>('GetTotalCount', { status: 'NEW' });
```
