---
skill: UI Component Generation
description: How to create React components following the Conarum Design System.
---

# 🎨 UI Component Generation Skill

**Context:** Use this skill whenever implementing a new UI element in `app/cnma_ai_agent_extraction_ui/src/components/`.

## 1. File Structure
- Reusable domain-agnostic components go in `src/components/ui/` (usually synced from the UI library).
- Shared business components (like custom badges, formatted fields) go in `src/components/common/`.
- Page-specific components go in `src/pages/<PageName>/components/`.

## 2. Component Scaffolding
Always start with a standard function component and strict Props interface.
Use `cn` from `@/lib/utils` for safely merging Tailwind classes.

```tsx
import { Button } from '@cnma/react-ui';
import { cn } from '@/lib/utils';

interface MyComponentProps {
  label: string;
  isActive?: boolean;
  className?: string;
  onClick?: () => void;
}

export function MyComponent({ label, isActive, className, onClick }: MyComponentProps) {
  return (
    <Button 
      variant={isActive ? "default" : "outline"}
      onClick={onClick}
      className={cn(className)}
    >
      {label}
    </Button>
  );
}
```

## 3. Styling Standards (Tailwind)
**Consult `fe-code-rules.md` and `Design.md` for exact tokens. ZERO-TOLERANCE for hardcoded values!**
- ❌ **Forbidden:** `bg-[#b10e10]`, `text-[14px]`, `w-[600px]`, `p-[10px]`
- ✅ **Required Semantic Colors:** `bg-primary`, `text-muted-foreground`, `bg-card`, `border-border`
- ✅ **Required Status Colors:** `bg-status-new`, `text-status-positive-text`, `bg-status-progress`
- ✅ **Required Spacing Scale:** `p-2` (8px), `gap-1.5` (6px), `m-4` (16px)

## 4. Constraints
- **Shared Components:** If building a generic UI or badge, use `cva` (class-variance-authority) and put it inside `src/components/common/`.
- **No Class Components:** Use React Hooks (`useState`, `useEffect`).
- **Internationalization:** Never hardcode display text. Always use `const { t } = useTranslation()` from `react-i18next`.
- **Accessibility:** Use proper semantic HTML (like `<button>` instead of `<div>` for clickable elements) and include `aria-label` where necessary.
