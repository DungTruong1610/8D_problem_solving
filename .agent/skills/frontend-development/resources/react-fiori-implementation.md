---
skill: React Fiori Implementation
description: Building SAP Fiori-compliant UI patterns using React and Tailwind CSS.
---

# 🎨 React Fiori Implementation Skill

**Context:** Use this skill when building Pages (Worklist, Object Page) or complex Business Components.

## 1. The Strategy: Hybrid Approach
*   **Components (Atoms):** Use **`@ui5/webcomponents-react`**.
    *   *Why?* Accessible, Enterprise-ready, Standard Fiori look.
    *   *Rule:* Never build a custom DatePicker, Table, or ShellBar.
*   **Layout (Structure):** Use **Tailwind CSS**.
    *   *Why?* UI5 layouts are rigid. Tailwind allows flexible Flexbox/Grid structures.

## 2. Fiori Patterns with UI5
- **ShellBar:** Use `<ShellBar />` for the top navigation.
- **Data Table:** Use `<AnalyticalTable />` for advanced grids (grouping/sorting).
- **Cards:** Use `<Card />` with Tailwind containers for the grid layout.
- **Object Page:**
    - Header: Object Status, Key Info (Title, ID).
    - Anchor Bar: Navigation tabs (sticky).
    - Sections: Cards or defined containers for content.

## 3. Visual Style (Tailwind)
Use Tailwind only for **Spacing** and **positioning**:
- **Margins/Padding:** `p-4`, `m-2`, `gap-4`.
- **Containers:** `flex`, `grid`, `w-full`.
- **Don't override UI5:** Avoid `!important` on UI5 components. Trust the theme.

## 4. Interaction Design
- **Loading:** Always use Skeleton loaders (`animate-pulse`) for initial data fetch. Never show a blank screen.
- **Feedback:** Use Toast notifications for success/error actions (non-blocking).
- **Mobile:** All layouts must stack vertically on `< md` screens.
- **Drag & Drop (Studio):** UI5 does not provide DnD primitives. Use **`dnd-kit`** to enable "Form Builder" interactions, wrapping UI5 components as draggable items.

## 4. Accessibility (A11y)
- **Semantic HTML:** Use `<header>`, `<main>`, `<section>`, `<article>`.
- **Keyboard:** Ensure all interactive elements are focusable (`tabindex`).
- **ARIA:** Use `aria-label` for icon-only buttons.
