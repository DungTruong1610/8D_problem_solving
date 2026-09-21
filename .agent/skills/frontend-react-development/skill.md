---
name: frontend-react-development
description: Expert capabilities for building React Applications with @cnma/react-ui and SAP Fiori-inspired design.
---

# 🎨 Frontend React Development Skill

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
| **@cnma/react-ui** | Component system (custom library) |
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

## 2. @cnma/react-ui library

The core UI package is `@cnma/react-ui`. Do **NOT** install raw `shadcn` components via CLI.
Everything (Button, Input, Table, VariantSelector, FilterBar) is exported by the `node_modules/@cnma/react-ui` package.

```typescript
import { Button, Input, DataTable, FilterBar } from '@cnma/react-ui';
```

---

## 3. Reference Modules

- **[Design Rules & Guidelines](./resources/Design.md)**: Rules for brand colors, Fiori layout patterns, UI components, Status mapping, and floorplans for the React UI.
- **[Frontend Code Rules](./resources/fe-code-rules.md)**: Strictly enforced coding conventions. Section §0 lists auto-fail patterns (hard pixels, hard colors). Read it before writing any className.
- **[Frontend Review Checklist](./resources/frontend-review-checklist.md)**: **Pre-commit workflow.** Run against `git diff` before every commit touching `app/`. Use this to self-review or to review a teammate's diff.
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

### Project Structure (react-v2 Canonical)

For the full project folder structure, see **[CNMA CAP Frontend Skill — Option B](../cnma-cap-frontend/SKILL.md)**. The react-v2 template is the canonical structure for all new React projects.

### File Naming Conventions

| File Type | Convention | Example |
|:----------|:-----------|:--------|
| Components | PascalCase `.tsx` | `StatusBadge.tsx`, `MainLayout.tsx` |
| Hooks | camelCase with `use` prefix `.ts`/`.tsx` | `useODataQuery.ts`, `useFLPSync.ts` |
| Services | camelCase `.ts` | `itemsService.ts`, `api.ts` |
| Types | camelCase with `.types.ts` suffix | `worklist.types.ts` |
| Config/Utils | camelCase `.ts` | `queryClient.ts`, `i18n.ts` |
| Barrel exports | `index.ts` in each folder | `components/common/index.ts` |
| CSS | camelCase `.css` | `index.css` |
| Translation files | language code `.json` | `en.json`, `de.json` |

### Feature Folder Structure

When a component or feature has more than **3 sub-components** or exceeds **~300 lines**, extract it into a dedicated folder:

```
FeatureName/
├── FeatureName.tsx              ← Main orchestrator (thin, ~100 lines)
├── components/                  ← UI sub-components
│   ├── index.ts                 ← Barrel export
│   ├── SubComponent1.tsx        ← Isolated, single responsibility
│   ├── SubComponent2.tsx
│   └── [group-folders if >8]    ← See Components Sub-folder Organization below
├── hooks/                       ← State + business logic
│   ├── index.ts                 ← Barrel export (optional)
│   └── useFeatureName.ts
├── types/                       ← Feature-specific types, constants, defaults
│   ├── index.ts                 ← Barrel export
│   └── featureName.types.ts
├── utils/                       ← Pure helper functions (optional, only if needed)
│   ├── index.ts
│   └── featureName.utils.ts
└── index.ts                     ← Re-export main component
```

**Each folder = one import path.** Never mix concerns across folders (e.g., don't put types in hooks/). If a folder has only 1 small file and no exports are needed, the `index.ts` is optional — but `components/` always needs one for the group structure.

**Rules:**
- **Max file length: 300 lines** — If a file exceeds this, extract sub-components
- **Max hooks per file: 3** — If a component has >3 `useEffect`/`useCallback`, extract to a hook
- **Single Responsibility** — Each sub-component handles ONE thing
- **No God Files** — A file should be readable without scrolling in a standard IDE

### Components Sub-folder Organization

If `components/` grows beyond **~8 files**, split into logical **group folders**:

```
components/
├── index.ts                     ← Barrel export
├── groupA/
│   ├── index.ts                 ← Group barrel export
│   ├── SubComponent1.tsx
│   └── SubComponent2.tsx
├── groupB/
│   ├── index.ts
│   ├── SubComponent3.tsx
│   └── SubComponent4.tsx
└── Shared/                      ← Cross-cutting, small components
    ├── index.ts
    └── Badge.tsx
```

**Rules:**
- **Max files per folder: 8** — If `components/` has >8 files, group them
- **Group by domain, not type** — `EventList/` not `Panels/`, `Editor/` not `Forms/`
- **One level only** — Don't nest sub-folders inside groups (avoids deep hierarchy)
- **Keep `components/index.ts`** — Main barrel export for backward compatibility

**Example grouping:**
```
NotificationSettingsEditor/
└── components/
    ├── index.ts
    ├── EventList/               ← Group: event list panel + toggle
    │   ├── index.ts
    │   └── EventListPanel.tsx
    ├── TemplateEditor/          ← Group: editor + preview + placeholders
    │   ├── index.ts
    │   ├── TemplateEditorPanel.tsx
    │   ├── TemplatePreview.tsx
    │   └── PlaceholderBar.tsx
    └── shared/                  ← Group: truly reusable small pieces
        ├── index.ts
        ├── TestEmailDialog.tsx
        └── InfoFieldsGrid.tsx
```

**Example:****
```tsx
// ❌ BAD — 500-line file with 6 hooks, 4 sub-components all inline
export function ComplexEditor({ value, onChange }) {
    const [state, setState] = useState();
    const [a, setA] = useState(); // hook #2
    const [b, setB] = useState(); // hook #3
    const [c, setC] = useState(); // hook #4
    // ...render 4 different UI sections inline
}

// ✅ GOOD — Thin orchestrator, extracted sub-components and hooks
export function ComplexEditor({ value, onChange }) {
    return (
        <div>
            <EditorToolbar />
            <EditorCanvas />
            <EditorSidebar />
            <EditorFooter />
        </div>
    );
}
```

- **Mobile First:** Design for small screens, scale up
- **Optimistic UI:** Update UI before API returns, rollback on error
- **Error Boundaries:** Never let the whole app crash
- **Skeleton Loading:** Show loading states for perceived speed
- **60fps Animations:** Use Framer Motion or CSS transitions
