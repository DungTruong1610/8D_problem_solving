# Antigravity Design System & Technical Guidelines

**Version:** 3.0 (@cnma/react-ui + Modern React)
**Status:** Approved
**Target Audience:** Frontend Developers, AI Agents, UI/UX Designers

---

## 1. Executive Summary

This document serves as the **Single Source of Truth** for building applications within the Antigravity ecosystem. Applications are primarily deployed to **SAP BTP Foundry** and integrated into **SAP Build Work Zone**.

---

## 2. Technology Stack Standards

### Core Framework
| Library | Version | Purpose |
|---------|---------|---------|
| React | 19+ | UI Framework (Actions, useOptimistic) |
| TypeScript | 5.x | Type safety (strict mode) |
| Vite | 7+ | Build tool & dev server |
| React Router | v7 | Client-side routing |

### UI Component System
| Library | Purpose |
|---------|---------|
| **@cnma/react-ui** | Primary component library. Single source of truth. |
| **Radix UI** | Headless primitives (if not covered by @cnma/react-ui) |
| **Tailwind CSS v4** | Utility-first styling (avoid hardcoded colors/pixels) |
| **class-variance-authority** | Component variants (CVA) |
| **Lucide React** | 700+ icons |
| **Framer Motion** | Animations |

### State & Data
| Library | Purpose |
|---------|---------|
| **TanStack Query** | Server state, caching, API calls |
| **Zustand** | Client state management |
| **Axios** | HTTP client |
| **React Hook Form** | Form handling |
| **Zod** | Runtime schema validation |

### Internationalization
| Library | Purpose |
|---------|---------|
| **react-i18next** | Multi-language support (SAP requirement) |
| **i18next** | i18n framework |

### Specialized
| Library | Purpose |
|---------|---------|
| **ReactFlow (@xyflow/react)** | Workflow/graph visualization |
| **dnd-kit** | Drag and drop |
| **dagre** | Graph layout algorithms |

---

## 3. @cnma/react-ui Setup

### 3.1. Installation
The `@cnma/react-ui` library should be used as the single source of truth for all components. Check the `package.json` to ensure it is installed.

### 3.2. Usage Rule
Do not write raw HTML tags or reinvent standard components. Always rely on the library components. If you find yourself writing raw styling classes (e.g., `className="bg-red-500"`), consider if it should be a variant in the UI library.

---

## 4. Embedded Content Layout (Work Zone)

When running within SAP Build Work Zone, the application **must not** provide its own brand logo, global header, or main navigation sidebar.

**Visual Structure:**
```
┌─────────────────────────────────────────────────────────────┐
│  SAP Build Work Zone Portal (Shell)                         │
│  [Logo] [Global Search] [User Profile] [Global Nav]         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Antigravity Application (Embedded Container)               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Local Page Header / Breadcrumbs                      │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │                                                       │  │
│  │                Main Content Area                      │  │
│  │                (Fluid Width)                          │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Constraints:**
- **No Global Header**: Do not render a top bar with logo.
- **No Global Sidebar**: Do not render a side navigation shell.
- **Local Navigation**: Use horizontal tabs or subtle local sidebar inside content area.

---

## 5. Component Standards

### 5.1. Buttons (Primary Action)
Use the predefined variants from the library. Hardcoded colors (like `[#hex]`) are strictly prohibited.
```tsx
import { Button } from '@cnma/react-ui';

<Button>Submit</Button>              {/* default = brand red primary action */}
<Button variant="outline">Cancel</Button>
<Button variant="destructive">Delete</Button>
```

### 5.2. Cards
```tsx
<Card className="p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
  {children}
</Card>
```

### 5.3. Status Badges
```tsx
<Badge variant="success" dot>Approved</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="error">Rejected</Badge>
```

### 5.4. Dynamic Forms
Use the `DynamicForm` pattern for schema-driven forms:
```tsx
import { Input, Select, DatePicker } from '@cnma/react-ui';

// Parse JSON schema → Render form fields dynamically
function DynamicField({ field, value, onChange }) {
  switch (field.controlType) {
    case 'text': return <Input {...} />;
    case 'select': return <Select {...} />;
    case 'date': return <DatePicker {...} />;
  }
}
```

---

## 6. Standard UI Patterns

### 6.1. List Report (Worklist)
- **Top**: Filter Bar with "Go" and "Clear" actions
- **Bottom**: Data Table with toolbars (Create, Delete, Export)

### 6.2. Object Page (Detail)
- **Pattern A**: Side Navigation for complex objects
- **Pattern B**: Tabbed Navigation for simpler objects

### 6.3. Studio Pattern (Configuration)
- Visual configuration UI for any entity
- Drag-and-drop schema builder
- Workflow editor with ReactFlow
- Tab-based navigation (Workflow, Form Schema, Rules, Status)

---

## 7. Animation & Feedback

### 7.1. Transitions
- **List Entry**: Use `framer-motion` for stagger animations
- **Hover States**: Use `transition-all duration-200`

### 7.2. Loading States
- Buttons show spinner + disabled state
- Full page: Centered `Loader2` spinner
- Skeleton loaders for content

### 7.3. Toasts
- Non-blocking notifications via `GlobalToast` component

---

## 8. Implementation Checklist

1. [ ] **Initialize**: `npm create vite@latest -- --template react-ts`
2. [ ] **@cnma/react-ui**: Verify `@cnma/react-ui` is installed and properly linked
3. [ ] **Usage Check**: Ensure no raw HTML tags or hardcoded hex colors are used for standard components
4. [ ] **State**: Install TanStack Query + Zustand
5. [ ] **Work Zone Check**: Verify `App.tsx` has no standalone shell/sidebar
6. [ ] **Brand Colors**: Rely on `@cnma/react-ui` for brand color consistency
