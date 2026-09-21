---
name: frontend-review-checklist
description: Pre-commit and PR review checklist for React/frontend code. Covers styling, component usage, state management, TypeScript quality, and accessibility. Run against `git diff` before any commit touching app/ files.
---

# Frontend Code Review Checklist

> Run this checklist against `git diff --cached` (staged) or `git diff HEAD` (all uncommitted) before committing any file in `app/`.
> 
> **Auto-fail items (§0) block merge immediately. Fix before proceeding.**

---

## § Workflow: How to Review Uncommitted Frontend Code

```bash
# 1. See what files changed
git status

# 2. Review staged changes
git diff --cached -- 'app/**/*.tsx' 'app/**/*.ts'

# 3. Review all uncommitted changes (staged + unstaged)
git diff HEAD -- 'app/**/*.tsx' 'app/**/*.ts'
```

Ask the AI agent: *"Review my uncommitted frontend changes against the frontend-review-checklist."*  
The agent will scan the diff and produce a structured report using the sections below.

---

## §0 — Zero-Tolerance & Styling (Auto-Fail)

**Crucial Check:** You must cross-reference all UI/styling code against the rules defined in `fe-code-rules.md` (Sections §0 and §1). 

- [ ] **No Hardcoding**: Reject any code using arbitrary pixels (`[10px]`), hex colors (`[#b10e10]`), or raw Tailwind colors (`bg-red-500`).
- [ ] **Semantic Tokens**: Verify that `bg-primary`, `bg-card`, `text-muted-foreground`, and `border-border` are used.
- [ ] **Component Primitives**: Reject raw HTML (`<button>`, `<input>`) if a `@cnma/react-ui` component exists.
- [ ] **Badges**: Reject inline status colors. Ensure `StatusBadge`, `PriorityBadge`, or centrally-created custom badges (using `variant="outline"` + `cn` mapped classes) are used.
- [ ] **i18n**: Reject hardcoded UI strings. Ensure `t('...')` is used everywhere.

---

## §2 — Component Architecture

- [ ] No file exceeds 300 lines — sub-components extracted if over limit
- [ ] No component has more than 3 `useEffect`/`useCallback` hooks — logic extracted to custom hook
- [ ] Feature folder structure used when component has >3 sub-components
- [ ] Each sub-component has Single Responsibility (one concern per file)
- [ ] No copy-pasted JSX blocks — repeated UI extracted to a shared component
- [ ] Barrel exports (`index.ts`) present for `components/`, `hooks/`, `types/`

---

## §3 — TypeScript Quality

- [ ] No `any` types — use explicit interfaces or `unknown` with type guards
- [ ] Props interfaces defined for every component (`interface MyComponentProps {}`)
- [ ] API response types defined — no implicit `any` from `axios.get<any>()`
- [ ] No `@ts-ignore` or `@ts-expect-error` without a comment explaining why
- [ ] `async/await` used — no raw `.then()/.catch()` chains
- [ ] No `console.log` / `console.warn` left in code

---

## §4 — State Management

- [ ] Server state (API data) managed by TanStack Query (`useQuery`, `useMutation`)
- [ ] Client-only UI state managed by Zustand or local `useState` (not mixed with server state)
- [ ] Mutations use `onSuccess`/`onError` callbacks for optimistic updates and rollback
- [ ] No direct `axios.get()` calls inside components — wrapped in a query hook
- [ ] Query keys are consistent and follow `[entity, id?, filters?]` pattern

---

## §5 — Forms

- [ ] All forms use React Hook Form (`useForm`)
- [ ] Validation schema defined with Zod (`z.object({...})`)
- [ ] `FormField` / `Field` wrapper used for label + input + error message
- [ ] No uncontrolled inputs outside React Hook Form
- [ ] Submit handler is `async` and shows loading state

---

## §6 — Internationalization (i18n)

- [ ] All user-visible strings use `t('key')` from `useTranslation()`
- [ ] No hardcoded English text in JSX (labels, placeholders, tooltips, error messages)
- [ ] New translation keys added to the i18n resource file
- [ ] Dynamic values passed as interpolation: `t('greeting', { name })` not `t('greeting') + name`

---

## §7 — Accessibility (A11y)

- [ ] Interactive elements are keyboard navigable (Radix primitives handle this automatically)
- [ ] Images have `alt` text
- [ ] Form inputs are associated with `<Label>` via `htmlFor` / `id`
- [ ] Color is not the only indicator of meaning (icons or text alongside status colors)
- [ ] Focus states are visible (Tailwind `focus-visible:` ring classes)

---

## §8 — Performance

- [ ] No expensive computations in render body — wrapped in `useMemo`
- [ ] Event handlers stable — wrapped in `useCallback` if passed as props
- [ ] Large lists use virtual scrolling (`DataTable` built-in pagination or react-virtual)
- [ ] Images use appropriate format (SVG for icons, WebP for photos)
- [ ] No unnecessary re-renders introduced (check for missing deps in `useEffect`)

---

## §9 — OData / API Integration

- [ ] OData queries use `$select` to fetch only needed fields
- [ ] Error states handled — loading skeleton shown during fetch, error message on failure
- [ ] `invalidateQueries` called after mutations to keep cache fresh
- [ ] No hardcoded entity URLs — use constants from the service layer

---

## Review Report Format

When reviewing, produce a report in this format:

```markdown
## Frontend Code Review — [date]

### §0 Auto-Fail Issues
- [ ] `src/pages/OrderList.tsx:42` — hard pixel `[10px]` in className
- [ ] `src/pages/OrderList.tsx:78` — local STATUS_COLORS map instead of StatusBadge

### §1 Styling Issues
- [ ] ...

### ✅ Passed Sections
- §3 TypeScript: clean
- §5 Forms: correct hook form usage

### Summary
2 auto-fail issues found. Fix before committing.
```

---

## Quick Commands for Agent Review

```
"Review my uncommitted frontend changes"
→ Agent runs git diff, applies this checklist, returns report

"Check staged changes for hard-coded values"  
→ Agent runs git diff --cached, checks §0 only

"Full pre-commit frontend review"
→ Agent runs git diff HEAD on app/ files, full checklist report
```
