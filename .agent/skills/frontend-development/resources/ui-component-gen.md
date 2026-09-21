---
skill: UI Component Generation
description: How to create React components following the Antigravity Design System.
---

# 🎨 UI Component Generation Skill

**Context:** Use this skill whenever implementing a new UI element in `app/frontend/src/components/`.

## 1. File Structure
- Components go in `src/components/<Domain>/<ComponentName>.tsx`.
- Generic UI atoms go in `src/components/ui/`.

## 2. Component Scaffolding
Always start with a functional component and strict Props interface.
```tsx
import React from 'react';
import { clsx } from 'clsx'; // Utility for dynamic classes

interface MyComponentProps {
  label: string;
  isActive?: boolean;
  onClick?: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ label, isActive, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={clsx(
        "base-classes transition-all duration-200", 
        isActive ? "active-classes" : "inactive-classes"
      )}
    >
      {label}
    </div>
  );
};
```

## 3. Styling Standards (Tailwind)
**Consult `design-guidelines.md` for the exact tokens.**
- **Primary Color:** `bg-[#b10e10]` (Brand Red)
- **Tables:** `border-gray-100`, Header `bg-gray-50`
- **Spacing:** standard tailwind scaling (`p-4`, `m-2`)

## 4. Constraints
- **No Class Components.** Use Hooks (`useState`, `useEffect`).
- **No CSS Files.** Use Tailwind utility classes.
- **Accessibility:** Ensure buttons have `aria-label` if icon-only.
