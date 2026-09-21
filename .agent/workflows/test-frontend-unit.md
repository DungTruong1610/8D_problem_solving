---
description: Create and run frontend unit tests for React components using Vitest
---

# Frontend Unit Test Workflow

Use this workflow to create unit tests for React components in the `app/request-management` frontend.

## Prerequisites
- Frontend app is set up with Vitest (`app/request-management`)
- Component to test exists

## Steps

### 1. Identify Components to Test
Ask the user which components need tests, or identify untested components:
```bash
# Find components without tests
Get-ChildItem -Path "app/request-management/src" -Recurse -Include "*.tsx" | 
    Where-Object { $_.Name -notmatch "\.(test|spec|stories)\.tsx$" }
```

### 2. Create Test File
Create a test file next to the component:
- Component: `src/features/inbox/Inbox.tsx`
- Test file: `src/features/inbox/Inbox.test.tsx`

### 3. Use Test Template
Apply this structure for each test:

```tsx
/**
 * [ComponentName] Tests
 * 
 * Sprint X - Epic Y.Z: [Feature Name]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 1. Mock services BEFORE importing component
vi.mock('@/services/MyService', () => ({
    MyService: {
        getData: vi.fn().mockResolvedValue([]),
    },
}));

// 2. Import component AFTER mocks
import { MyComponent } from './MyComponent';

// 3. Create wrapper for providers
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
}

describe('MyComponent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders without crashing', () => {
            render(<MyComponent />, { wrapper: createWrapper() });
            expect(document.body).toBeDefined();
        });
    });

    describe('Interactions', () => {
        it('handles user click', async () => {
            const user = userEvent.setup();
            render(<MyComponent />, { wrapper: createWrapper() });
            // Add interaction tests
        });
    });
});
```

// turbo
### 4. Run Tests
```bash
cd app/request-management && npx vitest run --project unit
```

### 5. Check Coverage (Optional)
```bash
cd app/request-management && npm run test:coverage
```

## Key Rules

1. **Mock before import** - `vi.mock()` must come before component imports
2. **QueryClient wrapper** - Use `retry: false` to prevent test timeouts  
3. **Use getByText** - Prefer over getByRole for custom components
4. **Clear mocks** - Always `vi.clearAllMocks()` in beforeEach

## Reference
See full documentation: `.agent/skills/testing/resources/frontend-unit-testing.md`
