# 📦 Antigravity UI Kit Template (9.5 Standards)

Pre-built reusable components and structure for new React projects, following strict architectural guidelines.

## Quick Start

Copy to your app:
```bash
cp -r .agent/ui-kit-template/src/* app/your-app/src/
```

## Contents

```
src/
├── components/
│   ├── ui/                   # Reusable atoms (PascalCase)
│   │   ├── Badge.tsx         # Status badges with variants
│   │   ├── Button.tsx        # Standard buttons (CVA variants)
│   │   ├── Card.tsx          # Content containers
│   │   ├── Checkbox.tsx      # Radix UI wrapped checkboxes
│   │   ├── Dialog.tsx        # Modals with backdrop
│   │   ├── Drawer.tsx        # Side panel with focus trap ⭐ NEW
│   │   ├── Input.tsx         # Text inputs
│   │   ├── Label.tsx         # Field labels
│   │   ├── Select.tsx        # Radix UI wrapped dropdowns
│   │   ├── Separator.tsx     # Visual dividers
│   │   ├── Skeleton.tsx      # Loading placeholders ⭐ NEW
│   │   ├── Switch.tsx        # Toggle switches
│   │   ├── Table.tsx         # Data tables
│   │   ├── Tabs.tsx          # Tabbed content
│   │   ├── TextArea.tsx      # Text areas
│   │   ├── Tooltip.tsx       # Tooltips
│   │   └── index.ts          # Barrel export
│   └── shared/               # Global widgets with business logic
│       ├── GlobalToast.tsx   # Toast notifications with ARIA
│       ├── GlobalErrorBoundary.tsx
│       └── index.ts
├── config/                   # Centralized Configs
│   ├── index.ts
│   └── statusConfig.ts       # Example config
├── lib/                      # Core Utilities & API
│   ├── api.ts                # Centralized Axios Instance
│   ├── events.ts             # Event emitter
│   └── utils.ts              # cn() helper
├── services/                 # Service Layer
│   └── ExampleService.ts     # Service pattern example
└── types/                    # Shared Types
    └── index.ts              # Type definitions
```

## Component Catalog

### Basic Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `Button` | Actions | `variant`, `size`, `asChild`, `disabled` |
| `Badge` | Status indicators | `variant` (success, warning, error, info) |
| `Card` | Content container | `className` |
| `Input` | Text input | Standard HTML input props |
| `TextArea` | Multi-line input | Standard HTML textarea props |

### Form Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `Checkbox` | Boolean selection | `checked`, `onCheckedChange` |
| `Select` | Dropdown selection | `value`, `onValueChange` |
| `Switch` | Toggle on/off | `checked`, `onCheckedChange` |
| `Label` | Field label | `htmlFor`, `variant` |

### Overlay Components

| Component | Purpose | Props |
|-----------|---------|-------|
| `Dialog` | Modal dialogs | `open`, `onOpenChange` |
| `Drawer` | Side panel | `isOpen`, `onClose`, `size`, `title` |
| `Tooltip` | Hover hints | `content` |

### Loading Components

| Component | Purpose |
|-----------|---------|
| `Skeleton` | Base shimmer animation |
| `PageLoadingSkeleton` | Full page loading |
| `CardSkeleton` | Card placeholder |
| `ListSkeleton` | List items placeholder |
| `TableSkeleton` | Table rows placeholder |

## Usage Examples

### Button Variants

```tsx
import { Button } from '@/components/ui';

<Button variant="default">Primary</Button>
<Button variant="outline">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Subtle</Button>
<Button size="sm">Small</Button>
<Button size="icon"><Icon /></Button>
```

### Badge Variants

```tsx
import { Badge } from '@/components/ui';

<Badge variant="success">Approved</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Rejected</Badge>
<Badge variant="info">In Progress</Badge>
```

### Drawer with Focus Trap

```tsx
import { Drawer } from '@/components/ui';

<Drawer
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Details"
  size="lg"
>
  <p>Drawer content with focus trap and ARIA support</p>
</Drawer>
```

### Skeleton Loading

```tsx
import { PageLoadingSkeleton, ListSkeleton } from '@/components/ui';

// In Suspense or loading state
{isLoading ? <PageLoadingSkeleton /> : <Content />}

// For lists
{isLoading ? <ListSkeleton count={5} /> : <ItemList />}
```

### Toast Notifications

```tsx
import { globalEvents, EVENT_TYPES } from '@/lib/events';

// Show success toast
globalEvents.emit(EVENT_TYPES.SHOW_TOAST, 'Operation successful!');

// Show error toast
globalEvents.emit(EVENT_TYPES.API_ERROR, 'Something went wrong');
```

## Architectural Guidelines

### 1. Service Layer Pattern

Encapsulate all API calls in `src/services/`. Never use inline `api.get()`.

```tsx
// ✅ Good
import { RequestService } from '@/services';
const data = await RequestService.getAll();

// ❌ Bad
const data = await api.get('/requests');
```

### 2. Centralized Types

Maintain types in `src/types/`. Export from barrel file.

```tsx
// types/index.ts
export interface Request {
  ID: string;
  title: string;
  status: RequestStatus;
}

export type RequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED';
```

### 3. Config over Magic Strings

Store UI constants and mappings in `src/config/`.

```tsx
// config/statusConfig.ts
export const STATUS_CONFIG = {
  DRAFT: { color: 'bg-slate-100', label: 'Draft' },
  PENDING: { color: 'bg-yellow-100', label: 'Pending' },
  APPROVED: { color: 'bg-green-100', label: 'Approved' },
};
```

### 4. Component Architecture

- **PascalCase** for all component files
- **Single Responsibility** - one component per file
- **Props Interface** - always define at top of file
- **React.memo** for list items
- **Forward Ref** for form components

## Accessibility Standards

All components follow WCAG 2.1 AA guidelines:

- ✅ Focus trap in modals/drawers
- ✅ ARIA labels on interactive elements
- ✅ Keyboard navigation support
- ✅ Skip link in layouts
- ✅ Color contrast 4.5:1 minimum

## Testing Setup

The template is designed to work with Vitest + React Testing Library:

```tsx
import { render, screen } from '@/test/utils';
import { Button } from '@/components/ui';

test('renders button', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

## Performance Patterns

### Memoization

```tsx
import { memo, useMemo } from 'react';

export const ListItem = memo(function ListItem({ item }) {
  const computed = useMemo(() => expensiveOp(item), [item]);
  return <div>{computed}</div>;
});
```

### Code Splitting

```tsx
import { lazy, Suspense } from 'react';

const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<PageLoadingSkeleton />}>
  <HeavyComponent />
</Suspense>
```

## Dependencies

Required packages:
- `tailwindcss` - Styling
- `class-variance-authority` - Variant management
- `lucide-react` - Icons
- `@radix-ui/*` - Accessible primitives
- `framer-motion` - Animations
- `clsx` + `tailwind-merge` - Class utilities

---

**Last Updated**: January 13, 2026
**Template Version**: 2.0.0
