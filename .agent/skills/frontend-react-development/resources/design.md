# Conarum Design Kit (CDK) — Design System Reference

> **Purpose**: This document defines the Conarum visual identity, design tokens, component library,
> and page floorplans. Use it as a **single source of truth** for generating screens
> in **Google Stitch** or any AI-based UI prototyping tool.

---

## 1. Brand Identity

| Property         | Value                  |
| :--------------- | :--------------------- |
| **Brand Name**   | conarum                |
| **Product Type** | Enterprise SaaS (SAP-like Fiori-inspired) |
| **Primary Font** | SAP 72 (Regular 400, Medium 500, Semibold 600, Bold 700) |
| **Mono Font**    | 72Mono                 |
| **Border Radius**| 0.5rem (8px)           |
| **Design Tone**  | Professional, clean, data-dense, enterprise-grade |

---

## 2. Color Palette

### 2.1 Brand Colors
| Token                   | Hex       | Usage                              |
| :---------------------- | :-------- | :--------------------------------- |
| `--color-brand`         | `#b10e10` | Primary / CTA buttons / brand accent |
| `--color-brand-hover`   | `#990c0e` | Hover state for primary elements   |
| `--color-link`          | `#820a0c` | Text links                         |

### 2.2 Semantic Palette (Base Colors)
| Token                    | Hex       | Meaning        |
| :----------------------- | :-------- | :------------- |
| `--palette-positive`     | `#256f3a` | Success / Approved / Completed |
| `--palette-negative`     | `#aa0808` | Error / Rejected / Obsoleted |
| `--palette-critical`     | `#e76500` | Warning / New / Draft |
| `--palette-informative`  | `#0070f2` | Info / In Progress / Processing |
| `--palette-neutral`      | `#788fa6` | Neutral / inactive elements |
| `--palette-purple`       | `#7800a4` | Sent / Shipped status |
| `--palette-teal`         | `#0d7278` | Released / Active status |

### 2.3 Core UI Colors (Light Mode)
| Token                 | Hex       | Usage                    |
| :-------------------- | :-------- | :----------------------- |
| `--background`        | `#edeff0` | Page background          |
| `--foreground`        | `#32363a` | Default text             |
| `--card`              | `#ffffff` | Card / panel background  |
| `--card-foreground`   | `#32363a` | Card text                |
| `--muted`             | `#f2f2f2` | Subdued backgrounds      |
| `--muted-foreground`  | `#6a6d70` | Secondary/helper text    |
| `--accent`            | `#dfdfdf` | Hover backgrounds        |
| `--border`            | `#d9d9d9` | Borders / dividers       |
| `--input-border`      | `#e2e8f0` | Input borders            |
| `--input-border-hover`| `#990c0e` | Input hover border (brand) |

### 2.4 Semantic Feedback Colors
| Token           | Base Hex    | Background (8% mix on white) |
| :-------------- | :---------- | :--------------------------- |
| `--success`     | `#256f3a`   | `--success-bg`               |
| `--error`       | `#e90b0b`   | `--error-bg`                 |
| `--warning`     | `#e76500`   | `--warning-bg`               |
| `--info`        | `#0070f2`   | `--info-bg`                  |
| `--edited`      | `#c99700`   | `#fef9e7`                    |

### 2.5 Confidence Levels
| Level    | Hex       | Background (8% on white) |
| :------- | :-------- | :----------------------- |
| Low      | `#e11d48` | subtle red tint          |
| Medium   | `#d97706` | subtle amber tint        |
| High     | `#059669` | subtle green tint        |

---

## 3. Badges

The design system uses **palette-derived status badges** with 3 layers per status:
- **Background**: 12% base color on white
- **Text**: the base palette color itself
- **Border**: 40% base color on white

### Status → Palette Mapping
| Status Variant | Palette Source       | Use Cases                              |
| :------------- | :------------------- | :------------------------------------- |
| `new`          | `--palette-critical` | New, Open, Draft, On Order             |
| `progress`     | `--palette-informative` | In Progress, Processing, Pending, Under Review |
| `released`     | `--palette-teal`     | Released, Active, Available, Packed    |
| `approved`     | `--palette-positive` | Approved                               |
| `sent`         | `--palette-purple`   | Sent, Shipped, In Transit, Awaiting Stock |
| `completed`    | `--palette-positive` | Completed, Delivered, Processed        |
| `obsoleted`    | `--palette-negative` | Obsoleted, Rejected, Cancelled, Inactive |

### 3.1 Domain-Specific Badges
- **DocumentStatusBadge**: Maps document extraction workflow statuses (`NEW`, `UPLOADED`, `EXTRACTED`, `VERIFIED`, `POSTED`) and malware statuses (`CLEAN`, `INFECTED`) to the appropriate semantic colors and icons. Extends the base **Badge** component.

### 3.2 AI Implementation Rule: Creating Custom Badges
When instructed to create a new domain-specific badge component (e.g., `InvoiceStatusBadge`), the AI MUST follow these rules:
1. **Location**: Always create the component centrally in `@/components/common/` (e.g., `src/components/common/InvoiceStatusBadge.tsx`). **Never** create local badges inside a page-specific directory.
2. **Extend Base Component**: Import and wrap the core `Badge` component (`import { Badge } from '@/components/ui/badge';`).
3. **Map Domain Statuses**: Create a dictionary mapping your domain-specific statuses (enums/strings) to the semantic CSS classes from `theme.css`.
   - Use the exact utility combinations: `bg-status-[variant] text-status-[variant]-text border-status-[variant]-border`.
   - Example mappings: `status-new` (red/orange), `status-progress` (orange/blue), `status-completed` (green), `status-obsoleted` (red).
4. **Apply Classes**: Use the `cn()` utility (`import { cn } from '@/lib/utils';`) to merge your mapped classes into the `className` prop of the `Badge`.
5. **Set Variant**: Always pass `variant="outline"` to the `Badge` component to ensure the semantic border styles are rendered properly.

---

## 4. Button Variants

| Variant       | Background             | Text     | Usage                           |
| :------------ | :--------------------- | :------- | :------------------------------ |
| `default`     | `--color-brand` (#b10e10) | White | Primary actions                  |
| `create`      | `--color-brand`        | White    | Create / Submit workflows        |
| `filter`      | `#374151` (dark gray)  | White    | Filter bar toggle               |
| `action`      | `#0070f2` (blue)       | White    | Secondary actions (info context) |
| `success`     | `#256f3a` (green)      | White    | Approve / Accept                |
| `subtle`      | White                  | Brand    | Transparent / ghost-like         |
| `destructive` | `#aa0808`              | White    | Delete / danger                  |
| `outline`     | `--color-brand`     | Brand red| Cancel / secondary               |
| `ghost`       | Transparent            | Default  | Toolbar icons, low-emphasis      |
| `link`        | None                   | Brand    | Inline navigation links          |

### Accept / Reject / Attention (Outline Variants)
| Type       | Border    | Hover BG   |
| :--------- | :-------- | :--------- |
| Accept     | `#107e3e` | `#f1fdf6`  |
| Reject     | `#bb0000` | `#ffebeb`  |
| Attention  | `#df6e0c` | `#fef7f1`  |

**Button Sizes**: `sm` (h-7), `default` (h-8), `lg` (h-10), `icon` (36×36)

---

## 5. Typography

| Element       | Font       | Weight      | Size Reference     |
| :------------ | :--------- | :---------- | :----------------- |
| Body text     | SAP 72     | 400 Regular | Base (14px)        |
| Labels        | SAP 72     | 500 Medium  | xs-sm              |
| Section titles| SAP 72     | 600 Semibold| sm-lg              |
| Page titles   | SAP 72     | 700 Bold    | xl-2xl             |
| Headings (h1–h6) | SAP 72 | 600 Semibold| -                  |
| Code          | 72Mono     | 400 Regular | -                  |

---

## 6. Component Library (81 Components)

### 6.1 Layout & Navigation
- **ShellBar** — Top header bar with brand logo, language switcher, help button, user avatar
- **Sidebar** — Collapsible navigation sidebar with brand-colored active state
- **Breadcrumb** — Hierarchical path navigation
- **NavigationMenu** — Desktop-style nav menus
- **Tabs** — Section-based content switching
- **Separator** — Visual content dividers
- **Resizable** — Draggable panel groups
- **ScrollArea** — Custom-styled scrollable containers

### 6.2 Data Display
- **DataTable** — Enterprise-grade table with sorting, filtering, pagination, responsive mobile card mode, resizable columns, and toolbar. Variants: `card` (wrapped in Card), `borderless` (raw)
- **FilterBar** — Collapsible filter panel with variant selector, supports `text`, `multiselect`, `dateRange`, `valuehelp` filter types
- **VariantSelector** — Named filter presets (Fiori-pattern)
- **Card** — Container with CardHeader, CardContent, CardTitle, CardDescription
- **Badge** — Variants: default, secondary, destructive, outline, success, warning, info
- **DocumentStatusBadge** — Domain-specific badge for document extraction and malware statuses, extending Badge component.
- **PriorityBadge** — Priority level indicator (High/Medium/Low)
- **ConfidenceBadge** — AI confidence level (Low/Medium/High)
- **Token** — Tag/chip component for selections
- **Empty** — Empty state with icon + title + description + action
- **Table** — Basic HTML table wrapper
- **Chart** — Recharts integration (Bar, Pie, Line, etc.)
- **Skeleton** — Loading placeholder

### 6.3 Forms & Input
- **Input** — Text input with Conarum styling (brand-hover border)
- **InputGroup** — Input with addons, buttons, helper text
- **InputContainer** — Wrapper for inputs
- **InputOTP** — One-time password input
- **Select** — Styled dropdown select
- **NativeSelect** — Native HTML select
- **Combobox** — Autocomplete with single/multi selection
- **Checkbox** — Checkbox control
- **RadioGroup** — Radio button set
- **Switch** — Toggle switch (neutral track color `#788fa6`)
- **Slider** — Range input
- **Textarea** — Multi-line text input
- **DatePicker** — Calendar-based date selector
- **DateRangeFilter** — Start/end date filter
- **Field** — Accessible label+input+error composition
- **FormField** — React-hook-form field wrapper
- **Form** — Form wrapper
- **Label** — Accessible label
- **ValueHelpDialog** — SAP-style value help popup with search + table
- **MultiSelectFilter** — Multi-select with popover checkboxes
- **TextFilter** — Simple text search input

### 6.4 Feedback & Overlays
- **Dialog** — Modal window
- **AlertDialog** — Confirmation modal
- **Alert** — Inline callout banner
- **Sheet** — Slide-in panel (top/right/bottom/left)
- **Drawer** — Bottom slide-up panel
- **Popover** — Floating content
- **Tooltip** — Hover info popup
- **HoverCard** — Rich preview on hover
- **DropdownMenu** — Action menu
- **ContextMenu** — Right-click menu
- **Menubar** — Desktop-style persistent menu
- **Sonner** — Toast notifications (themed with brand colors)
- **Spinner** — Loading indicator
- **Progress** — Progress bar

### 6.5 Miscellaneous
- **Accordion** — Expandable sections
- **Carousel** — Image/content slideshow
- **Collapsible** — Toggle-open sections
- **Toggle / ToggleGroup** — Toggle buttons
- **ButtonGroup** — Grouped action buttons
- **Kbd** — Keyboard shortcut display
- **Pagination** — Page navigation controls
- **AspectRatio** — Fixed aspect ratio container
- **Avatar** — User avatar with fallback
- **Command** — Command palette (Ctrl+K)
- **Direction** — RTL/LTR provider

---

## 7. Page Floorplans

### 7.1 Initial Page (Landing)
- Full-screen hero with gradient background (brand red blurs)
- **Glassmorphism search bar** centered with brand-colored CTA button
- Copilot/AI indicator badge
- Empty state with large icon, title, description
- Quick action chips row

### 7.2 List Report (Worklist)
Structure: `FilterBar` → `Card` → `TableToolbar` → `DataTable` (with expandable rows)
- Sticky toolbar with Export, Sort, Settings buttons
- Expandable row details in `muted/10` background
- Grid-based detail cards inside expanded area
- Tags displayed as secondary badges

### 7.3 Object Page (Tab-Based)
Structure: `Header Card` (with KPIs) → `Tabs` → `TabContent`
- Object header: Title + StatusBadge + type Badge + Edit/Save/Cancel actions
- KPI row: 4–5 compact stat cards with icon + label + value
- Tab sections: Items (DataTable), Details (key-value grid), History (DataTable), Notes (text)
- Edit mode toggles Input components in-place

### 7.4 Object Page (Sidebar)
Structure: `ResizablePanel` (left=detail, right=sidebar)
- Main panel: object header + tabs + content
- Side panel: contextual info, related documents, actions
- Panels are resizable via drag handle

### 7.5 Flexible Column Layout (Master-Detail-Detail)
Structure: 3-column responsive layout with animated transitions
- **Begin column**: Master list (DataTable, borderless)
- **Mid column**: Detail view with KPI cards + Notes card + Line items DataTable
- **End column**: Sub-item detail
- Columns hide/show with animated width transitions
- Mobile: shows only the most relevant column full-width

### 7.6 Analytical Dashboard
Structure: `FilterBar` → KPI cards row → Charts row → DataTable + Alerts
- 4 KPI cards with icon, value, trend indicator (↗/↘/⚠)
- Side-by-side: Pie chart (category breakdown) + Bar chart (trend)
- Bottom: DataTable (suppliers) + Alert card sidebar
- Alerts: icon + title + description + Resolve button

### 7.7 Wizard Process
Structure: `Stepper header` → `Step content` → `Footer actions`
- Horizontal step indicator with progress line (brand-colored)
- Numbered circles: active (brand border), completed (brand filled + check), future (gray)
- Step content: forms inside borderless Card
- Fixed footer: Cancel (ghost) | Back (outline) | Next/Create (brand `create` variant)

### 7.8 Kanban Board
Structure: Column-based drag-and-drop task board
- Column headers with count badges
- Cards with title, assignee avatar, StatusBadge, PriorityBadge

### 7.9 Process Flow Diagram
Structure: Visual workflow with connected nodes
- Nodes represent process steps with status colors
- Connectors with directional arrows

### 7.10 Settings / Profile Page
Structure: Sidebar navigation + form content
- Profile section with avatar
- Form groups with Label + Input pairs

### 7.11 Copilot (AI Chat) Full Page
Structure: Full-screen chat interface
- Message bubbles with sender info
- Input bar at bottom
- Side panel for context/history

---

## 8. Layout Conventions

| Pattern                 | Value / Convention                                   |
| :---------------------- | :--------------------------------------------------- |
| Page padding            | `p-2 sm:p-4`                                        |
| Card styling            | `bg-card rounded-xl border shadow-md`               |
| Section header bg       | `bg-muted/30` with border-b                         |
| Card inner gaps         | `space-y-4` or `gap-3/4`                            |
| KPI card grid           | `grid grid-cols-2 lg:grid-cols-4 gap-3`             |
| Chart grid              | `grid grid-cols-1 lg:grid-cols-2 gap-4`             |
| Detail key-value        | `flex justify-between text-sm` (label=muted, value=font-medium) |
| Form field grid         | `grid grid-cols-1 md:grid-cols-2 gap-6`             |
| Table toolbar           | Sticky `top-0 z-30` on card, title + actions        |
| Hover row               | `hover:bg-muted/40`                                 |
| Animations              | `animate-in fade-in slide-in-from-bottom-4 duration-500–1000` |
| Custom scrollbar        | 8px Webkit scrollbar, thumb `#9ca3af`, hover `#6b7280` |
| Shimmer animation       | Background position animation for loading states     |

---

## 9. Design Dos and Don'ts

### ✅ Do
- Create the custom Object 
- Use brand color for primary actions only — don't overuse
- Keep data density high — enterprise users need information, not whitespace
- Use `muted-foreground` (`#6a6d70`) for secondary text, labels, helper text
- Use Cards with `shadow-sm` or `shadow-md` — not heavy shadows
- Use FilterBar for any list/report page — it's the standard entry point
- Keep consistent spacing: `gap-3` for tight grids, `gap-4` for standard layouts

### ❌ Don't
- Don't use arbitrary colors for statuses — always map to the semantic palette
- Don't skip the ShellBar for **standalone** apps — every standalone page should have a top app bar. **Exception:** When embedded in SAP Build Work Zone (via iframe), do NOT render a ShellBar — the Workzone shell provides the global header. See `design-guidelines.md` §4 for the embedded layout constraints.
- Don't use `font-sans` system fonts — always use SAP 72
- Don't make buttons without rounded corners — `rounded-md` is the standard
- Don't create forms without Label + error message structure
- Don't use full-width layouts without max-width constraints on desktop
