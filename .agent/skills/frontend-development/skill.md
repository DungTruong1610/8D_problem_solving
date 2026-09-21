---
name: frontend-development
description: Expert capabilities for building React Applications with shadcn/ui and SAP Fiori-inspired design.
---

# 🎨 Frontend Development Skill

**Context:** Use this skill package for all UI/UX work in the `app/` directory.

## 1. The Core Stack

### Framework & Build
| Library | Purpose |
|---------|---------|
| React 19+ | UI Framework |
| TypeScript | Type safety |
| Vite | Build tool & dev server |
| React Router v7 | Routing |

### UI Components
| Library | Purpose |
|---------|---------|
| **shadcn/ui** | Component system (new-york style) |
| **Radix UI** | Headless primitives |
| **Tailwind CSS v4** | Utility styling |
| **Lucide React** | Icons |
| **Framer Motion** | Animations |

### State & Data
| Library | Purpose |
|---------|---------|
| **TanStack Query** | Server state + caching |
| **Zustand** | Client state |
| **Axios** | HTTP client |
| **React Hook Form + Zod** | Form handling + validation |

### Internationalization
| Library | Purpose |
|---------|---------|
| **react-i18next** | Multi-language (SAP requirement) |

### Specialized
| Library | Purpose |
|---------|---------|
| **ReactFlow** | Workflow diagrams |
| **dnd-kit** | Drag and drop |

---

## 2. shadcn/ui Setup

```bash
# Initialize
npx shadcn@latest init

# Add components
npx shadcn@latest add button card dialog input select tabs switch tooltip
```

**Key utility:**
```typescript
// lib/utils.ts
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs) => twMerge(clsx(inputs));
```

---

## 3. Reference Modules

- **[Design Guidelines](../../guidelines/design-guidelines.md)**: Brand colors, layout patterns, component standards.
- **[OData Frontend Integration](./resources/odata-integration-frontend.md)**: Connecting UI to CAP Backend.
- **[UI Component Gen](./resources/ui-component-gen.md)**: Creating reusable components.

---

## 4. Key Patterns

### Dynamic Forms
Render forms from JSON schema:
```tsx
function DynamicField({ field, value, onChange }) {
  switch (field.controlType) {
    case 'text': return <Input {...} />;
    case 'select': return <Select {...} />;
    case 'date': return <input type="date" {...} />;
  }
}
```

### Studio Pattern
Visual configuration UI with:
- Tab navigation (Workflow, Schema, Rules, Status)
- Drag-drop schema builder
- ReactFlow for workflow visualization

---

## 5. Best Practices

- **Mobile First:** Design for small screens, scale up
- **Optimistic UI:** Update UI before API returns, rollback on error
- **Error Boundaries:** Never let the whole app crash
- **Skeleton Loading:** Show loading states for perceived speed
- **60fps Animations:** Use Framer Motion or CSS transitions
