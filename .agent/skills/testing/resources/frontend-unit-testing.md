# Frontend Unit Testing with Vitest + React Testing Library

**Context:** Use this guide for testing React components in the `request-management` frontend app.

## 1. Setup Overview

The project uses Vitest with JSDOM environment for component testing.

### Configuration (`vitest.config.ts`)

```typescript
projects: [
  // Unit tests project - runs component tests
  {
    extends: true,
    test: {
      name: 'unit',
      include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
      exclude: ['node_modules', 'dist', '**/*.stories.*'],
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  },
  // Storybook tests - separate project
  {
    extends: true,
    test: { name: 'storybook', /* browser-based */ },
  },
]
```

### Run Commands

```bash
npm run test              # Run all unit tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npx vitest run --project unit  # Unit tests only
```

---

## 2. Test File Structure

Place test files alongside components:

```
src/
├── components/
│   ├── shared/
│   │   ├── PrincipalSelect.tsx
│   │   └── PrincipalSelect.test.tsx  ← Test file
│   └── ui/
│       ├── Button.tsx
│       └── Button.test.tsx
└── features/
    └── inbox/
        ├── Inbox.tsx
        └── Inbox.test.tsx
```

---

## 3. Testing Patterns

### Basic Component Test

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
    it('renders correctly', () => {
        render(<MyComponent title="Hello" />);
        expect(screen.getByText('Hello')).toBeInTheDocument();
    });
});
```

### With TanStack Query Wrapper

Components using `useQuery` need a QueryClient wrapper:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },  // ← Important!
    });
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

describe('ComponentWithQuery', () => {
    it('renders', () => {
        render(<ComponentWithQuery />, { wrapper: createWrapper() });
        // ...
    });
});
```

### With React Router

```tsx
import { BrowserRouter } from 'react-router-dom';

function createWrapper() {
    return ({ children }: { children: React.ReactNode }) => (
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </BrowserRouter>
    );
}
```

---

## 4. Mocking Services

**Important:** Mock services BEFORE importing components!

```tsx
// ✅ Correct: Mock at top of file, before imports
vi.mock('@/services/AdminService', () => ({
    AdminService: {
        getSupportTypes: vi.fn().mockResolvedValue([
            { ID: '1', code: 'USER', name: 'Users' },
        ]),
        getShadowUsers: vi.fn().mockResolvedValue([
            { ID: 'user-1', displayName: 'Alice' },
        ]),
    },
}));

// Then import component
import { MyComponent } from './MyComponent';
```

### Mock globalEvents

```tsx
vi.mock('@/lib/events', () => ({
    globalEvents: { emit: vi.fn() },
    EVENT_TYPES: {
        API_ERROR: 'API_ERROR',
        SHOW_SUCCESS: 'SHOW_SUCCESS',
    },
}));
```

---

## 5. Query Strategies

### Recommended Order
1. `getByRole` - Accessible, semantic
2. `getByText` - Visible content
3. `getByTestId` - Last resort

### Learnings for Custom Components

Custom UI components (e.g., Radix-based) may not expose expected ARIA roles:

```tsx
// ❌ May fail with custom tabs
screen.getByRole('tab', { name: /my tasks/i })

// ✅ More reliable for custom components
screen.getByText(/my tasks/i)
```

---

## 6. User Events

Use `userEvent` for realistic interactions:

```tsx
import userEvent from '@testing-library/user-event';

it('handles click', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    
    render(<Button onClick={onClick}>Click me</Button>);
    
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
});
```

---

## 7. Async Testing

### waitFor for async operations

```tsx
import { waitFor } from '@testing-library/react';

it('loads data', async () => {
    render(<DataComponent />, { wrapper: createWrapper() });
    
    await waitFor(() => {
        expect(screen.getByText('Loaded data')).toBeInTheDocument();
    });
});
```

### findBy for elements that appear later

```tsx
// Automatically waits
const element = await screen.findByText('Loaded');
expect(element).toBeInTheDocument();
```

---

## 8. Critical Lessons Learned

| Issue | Solution |
|-------|----------|
| Storybook tests blocking unit tests | Add separate `unit` project in vitest.config.ts |
| TanStack Query retries causing test timeouts | Set `retry: false` in QueryClient options |
| Components not rendering in tests | Wrap with required providers (QueryClient, Router) |
| Role queries failing | Use `getByText()` for custom components without ARIA |
| Mock not working | Ensure `vi.mock()` is before component import |
| Act warnings in console | Usually safe to ignore; component state updating |

---

## 9. Test Template

```tsx
/**
 * [Component] Tests
 * 
 * Sprint X - Epic Y.Z: [Feature Name]
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyComponent } from './MyComponent';

// Mocks
vi.mock('@/services/MyService', () => ({
    MyService: {
        getData: vi.fn().mockResolvedValue([]),
    },
}));

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

    describe('Props', () => {
        it('accepts required props', () => {
            const { container } = render(
                <MyComponent prop="value" />,
                { wrapper: createWrapper() }
            );
            expect(container.firstChild).toBeDefined();
        });
    });

    describe('Interactions', () => {
        it('handles user actions', async () => {
            const user = userEvent.setup();
            // ...
        });
    });
});
```
