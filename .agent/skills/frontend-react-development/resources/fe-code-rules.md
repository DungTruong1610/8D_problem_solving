# Frontend Code Rules

> Coding conventions for the **cnma-boilerplate** design system and all downstream apps.

---

## 0. Zero-Tolerance Rules (Auto-Fail Code Review)

> ⚠️ Any of these patterns in a PR will block merge. No exceptions outside design system primitives.

| ❌ Forbidden Pattern | ✅ Required Alternative |
|:---|:---|
| `className="p-[10px]"` | `className="p-2"` (Tailwind spacing scale) |
| `className="w-[600px]"` | `className="w-full max-w-2xl"` or layout token |
| `className="text-[14px]"` | `className="text-sm"` (Tailwind type scale) |
| `className="gap-[6px]"` | `className="gap-1.5"` |
| `className="bg-[#b10e10]"` | `className="bg-primary"` or Button variant |
| `className="text-[#6a6d70]"` | `className="text-muted-foreground"` |
| `className="bg-red-500"` | `className="bg-error"` or semantic token |
| `className="bg-[var(--ds-brand-red-6)]"` | `className="bg-primary"` |
| `<div style={{ color: '#b10e10' }}>` | CSS variable token or Tailwind class |
| Inline `style={{ padding: '10px' }}` | Tailwind utility class |

**Rule: If the value is hardcoded (pixel, hex, raw CSS variable), it is wrong.**
Use the Tailwind spacing scale (`p-1` = 4px, `p-2` = 8px, `p-4` = 16px) and semantic color tokens from `theme.css`.

### ✅ Grounding: Actual Theme Tokens (not aspirational)

> Design.md documents aspirational tokens like `status-new`, `status-progress`, `status-released`. **These may not exist yet in `theme.css`.** Always verify by inspecting `src/styles/theme.css` or `node_modules/@cnma/react-ui/dist/theme.css`.

**Currently confirmed tokens in theme.css:**
| Token | Use For |
|:------|:--------|
| `status-positive` / `text-status-positive-text` | Approved, Completed |
| `status-negative` / `text-status-negative-text` | Error, Rejected |
| `status-informative` / `text-status-informative-text` | Info, Processing |
| `status-neutral` | Inactive, Disabled |
| `status-risk` / `text-status-risk` | Warning |
| `bg-popover` / `text-popover-foreground` | Tooltips, dropdowns |
| `bg-info-bg` / `text-info` | Informational (light mode) |
| `bg-success-bg` / `text-success` | Positive (light mode) |
| `bg-warning-bg` / `text-warning` | Warning (light mode) |
| `bg-error-bg` / `text-destructive` | Error (light mode) |
| `bg-confidence-high/medium/low` | AI confidence levels |
| `bg-confidence-high-text` / `text-confidence-high` | Confidence text |

**Acceptable exceptions (no fix needed):**
- `<input type="color">` — color picker by design (TemplateEditorPanel button color)
- Email preview HTML — `dangerouslySetInnerHTML` generates client-side email HTML; Tailwind classes don't work in email clients, so inline `style` is correct and expected

---

## 1. Component Styling — CVA First

### ✅ Rule: Use CVA variants, never duplicate color maps

```tsx
// ✅ GOOD — use the shared CVA component
// Custom badge is a component for object that extend from Badge from design lib
import { CustomBadge } from "@/components/common/CustomBadge";
<CustomBadge status="Approved" />

// ❌ BAD — defining your own color map per page
const STATUS_COLORS: Record<string, string> = {
  "Approved": "bg-status-released text-status-released-text ...",
};
<Badge className={STATUS_COLORS[status]} variant="outline">{status}</Badge>
```

### ✅ Rule: Use Button variants, never inline brand colors

```tsx
// ✅ GOOD — use existing variant
<Button variant="create">Save</Button>
<Button variant="success">Saved</Button>
<Button variant="action">Submit</Button>

// ❌ BAD — hardcoding CSS variables
<Button className="bg-[var(--ds-brand-red-6)] text-white">Save</Button>
```

### ✅ Rule: Use design system components, never raw HTML equivalents

| Instead of | Use |
|:---|:---|
| `<textarea>` | `<Textarea>` from `@cnma/react-ui` |
| `<input>` | `<Input>` from `@cnma/react-ui` |
| `<button>` | `<Button>` from `@cnma/react-ui` |
| `<select>` | `<Select>` from `@cnma/react-ui` |
| Manual avatar `<div>` | `<Avatar>` from `@cnma/react-ui` |
| Manual progress `<div>` | `<Progress>` from `@cnma/react-ui` |

---

## 2. Status & Priority Badges

### ✅ Rule: Always use shared badge components

```tsx
import { StatusBadge } from "@/components/common/StatusBadge";
import { PriorityBadge } from "@/components/common/PriorityBadge";

// Status — auto-maps to theme colors
<StatusBadge status="Approved" />    // → green (released)
<StatusBadge status="In Progress" /> // → blue (progress)
<StatusBadge status="Rejected" />    // → red (obsoleted)

// Priority — auto-maps to severity colors
<PriorityBadge priority="Critical" />  // → red
<PriorityBadge priority="High" />      // → orange
<PriorityBadge priority="Medium" />    // → blue
<PriorityBadge priority="Low" />       // → gray
```

### ✅ Rule: Add new status mappings to the shared component, not the page

If a new status string appears (e.g. `"On Hold"`), add it to `STATUS_VARIANT_MAP` in `StatusBadge.tsx`, **not** to a local map in the page.

### ✅ Rule: Creating Domain-Specific Status Badges

When creating a new badge component for the statuses of a specific business object (e.g. `PurchaseOrderStatusBadge`, `InvoiceStatusBadge`), you must create it centrally inside `@/components/common/` (or equivalent shared folder). 

**Do not** invent a local badge inside the page's directory. 
Your new domain-specific badge must consume the `statusBadgeVariants` exported by `@cnma/react-ui` and map your domain terminology to the library's semantic colors (`new`, `progress`, `released`, `approved`, `sent`, `completed`, `obsoleted`), exactly like the sample `StatusBadge` implemented in the library.

---

## 3. Theme Colors & Shared Design System

### ✅ Rule: Use semantic CSS variables from the library's `theme.css`

> **Note for AI and Developers**: The core CSS design tokens are now bundled in the `@cnma/react-ui` library. To discover the available class names, CSS variables, and tailwind utilities, you should inspect `node_modules/@cnma/react-ui/dist/theme.css` or `node_modules/@cnma/react-ui/dist/styles.css`.

```tsx
// ✅ GOOD — semantic variables
className="bg-status-released text-status-released-text"
className="text-primary"
className="bg-muted text-muted-foreground"

// ❌ BAD — raw CSS variable references
className="bg-[var(--ds-brand-red-6)]"
className="text-[var(--ds-brand-red-7)]"

// ❌ BAD — hardcoded Tailwind colors
className="bg-emerald-600 text-white"
className="bg-red-500"
```

**Exception**: Raw CSS variable references are acceptable in design system primitives (e.g., `button.tsx`, `input.tsx`), but **never** in page-level code.

### ✅ Spacing Scale Quick Reference

Use Tailwind's 4px-base scale. Never use arbitrary pixel values.

| Need | ✅ Use | = px |
|:-----|:-------|:-----|
| 2px gap | `gap-0.5` | 2px |
| 4px padding | `p-1` | 4px |
| 6px gap | `gap-1.5` | 6px |
| 8px spacing | `p-2` or `gap-2` | 8px |
| 12px | `p-3` or `gap-3` | 12px |
| 16px | `p-4` or `gap-4` | 16px |
| 20px | `p-5` or `gap-5` | 20px |
| 24px | `p-6` or `gap-6` | 24px |
| 32px | `p-8` or `gap-8` | 32px |

For sizes not on the 4px grid, round to the nearest step. If a designer insists on a non-standard value, raise it as a design token in `theme.css`.

---

## 4. DataTable Columns

### ✅ Rule: Use `renderType: "custom"` with shared components

```tsx
// ✅ GOOD — delegate to StatusBadge
{
  key: "status",
  labelKey: "Status",
  renderType: "custom",
  render: (v: string) => <StatusBadge status={v} />
}

// ❌ BAD — inline Badge with color map lookup
{
  key: "status",
  render: (v: string) => (
    <Badge className={`${STATUS_COLORS[v]} border`} variant="outline">{v}</Badge>
  )
}
```

---

## 5. Adding New CVA Components

When creating a new component that needs variants:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const myComponentVariants = cva(
  "base-classes-here",
  {
    variants: {
      variant: {
        default: "...",
        primary: "...",
      },
      size: {
        sm: "...",
        md: "...",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface MyComponentProps extends VariantProps<typeof myComponentVariants> {
  className?: string;
  children: React.ReactNode;
}

export function MyComponent({ variant, size, className, children }: MyComponentProps) {
  return (
    <div className={cn(myComponentVariants({ variant, size }), className)}>
      {children}
    </div>
  );
}
```

---

## 6. Imports & Exports

### ✅ Rule: Import from barrel files when available

```tsx
// ✅ GOOD — import from common barrel
import { StatusBadge, PriorityBadge } from "@/components/common";

// ✅ ALSO GOOD — direct import
import { StatusBadge } from "@/components/common/StatusBadge";

// ❌ BAD — importing from internal paths
import { statusBadgeVariants } from "@/components/common/StatusBadge";
// (only if you truly need the raw CVA function)
```

### ✅ Rule: Clean up unused imports

Remove unused imports (components, hooks, types) when refactoring. TypeScript will warn about these with `TS6133`.

---

## 7. Reusable Patterns Checklist

Before writing page-specific styling, check if a shared component already exists:

| Pattern | Component |
|:---|:---|
| Status indicator | `StatusBadge` |
| Priority/risk indicator | `PriorityBadge` |
| Data table | `DataTable` |
| Filters | `FilterBar` |
| Table actions toolbar | `TableToolbar` |
| Form field with label | `Label` + `Input`/`Select`/`Textarea` |
| Confirmation dialog | `AlertDialog` |
| Side panel | `Sheet` |
| Loading skeleton | `Skeleton` |
| Toast notification | `toast()` from sonner |

If you need a pattern that doesn't exist, **create a reusable CVA component** in `components/common/` or `components/ui/` rather than building it inline in the page.

---

## 8. Internationalization (i18n)

### ✅ Rule: Always use i18n for text elements in the UI

Hardcoding strings in the UI makes the application untranslatable and difficult to maintain. Always use the `useTranslation` hook for text inside pages and components.

```tsx
// ✅ GOOD — using i18n hook
import { useTranslation } from 'react-i18next';

export function AnalyticsPage() {
  const { t } = useTranslation();

  return (
    <h1>{t('pages.BusinessAnalytics.ASNAnalytics.asnBusinessObject')}</h1>
  );
}

// ❌ BAD — hardcoding text
export function AnalyticsPage() {
  return (
    <h1>ASN Business Object Data</h1>
  );
}
```

---

## 9. React Rules of Hooks

> ⚠️ Violations here cause **"Rendered fewer hooks than expected"** crashes — a hard runtime failure with no graceful fallback.

### The Two Rules

| Rule | What it means |
|:----|:--------------|
| **Top-level only** | Call hooks at the **top level** of your component — never inside loops, conditions, or nested functions |
| **React functions only** | Call hooks only from **function components** or **custom hooks** — never from regular utility functions |

### ❌ Forbidden Patterns

```tsx
// ❌ VIOLATION — hooks inside conditional
function Component({ show }) {
  if (show) {
    const [state, setState] = useState();  // CRASH if show=false on re-render
  }
}

// ❌ VIOLATION — hooks inside nested function
function Component() {
  function handleClick() {
    const [state, setState] = useState();  // CRASH
  }
}

// ❌ VIOLATION — hooks inside loop
function Component({ items }) {
  items.for(item => {
    const [state, setState] = useState();  // CRASH
  });
}
```

### ✅ Correct Pattern

```tsx
// ✅ GOOD — all hooks at top level, same order every render
function Component({ show, items }) {
  const [a, setA] = useState();    // Always called
  const [b, setB] = useState();    // Always called
  const val = useMemo(() => ..., []); // Always called

  if (show) {
    // ❌ Don't put hooks here
  }

  return items.map(item => (
    // ❌ Don't put hooks here either
  ));
}
```

### Common Real-World Bug: Hooks Inside Render Functions

This pattern crashes when switching views:

```tsx
// ❌ BAD — hooks inside a render helper function
function Component({ mode }) {
  const [x, setX] = useState(0);

  const renderTable = () => {
    const columns = useMemo(() => ..., []);  // CRASH when mode changes
    return <Table columns={columns} />;
  };

  return mode === 'table' ? renderTable() : <Cards />;
}

// ✅ FIXED — extract to top-level hooks
function Component({ mode }) {
  const [x, setX] = useState(0);

  // All hooks at top level
  const columns = useMemo(() => ..., []);
  const handleRowClick = useCallback(() => ..., []);

  const renderTable = () => <Table columns={columns} onRowClick={handleRowClick} />;
  const renderCards = () => <Cards />;

  return mode === 'table' ? renderTable() : renderCards();
}
```

### Side Effect: `useEffect` cleanup functions

Return a cleanup function from `useEffect`. If you forget, React logs a warning but doesn't crash — but stale closures may cause subtle bugs.

```tsx
// ✅ GOOD — cleanup properly
useEffect(() => {
  const handler = (e) => doSomething(e);
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

// ❌ BAD — missing cleanup (causes memory leaks + stale state)
useEffect(() => {
  window.addEventListener('resize', handler);
  // No return — listener stays active after unmount
}, []);
```

### ✅ Code Review Checklist for Hooks

- [ ] No hooks inside `if`/`else` blocks
- [ ] No hooks inside `for`/`while` loops
- [ ] No hooks inside nested functions (e.g., `handleClick` that calls `useState`)
- [ ] No hooks inside `.map()` callbacks
- [ ] All hooks called in the **same order** on every render
- [ ] Cleanup functions returned from all `useEffect` hooks
- [ ] No `useCallback`/`useMemo` wrapping components that should be plain functions (check MemoizedTableCell pattern)
