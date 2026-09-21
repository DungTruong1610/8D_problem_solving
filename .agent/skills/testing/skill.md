---
name: testing
description: A comprehensive suite for ensuring software quality, spanning E2E to Performance.
---

# 🛡️ Quality Assurance & Testing Skill

**Context:** Use this skill package for all testing activities.

## 1. The Testing Pyramid Strategy
1.  **Unit (Vitest/Jest):** Fast, isolated. Test individual functions and components. (See resources)
2.  **Integration (CAP):** Test Service <-> DB interaction.
3.  **E2E (Playwright):** Slow, realistic. Test User Flows.
4.  **Performance (k6):** Stress testing.

## 2. Reference Modules
Specific "How-To" guides are located in the references folder:

- **[CAP Unit Testing](./resources/cap-unit-testing.md)**: Jest + CDS + SQLite patterns for SAP CAP.
- **[Frontend Unit Testing](./resources/frontend-unit-testing.md)**: Vitest + React Testing Library patterns.
- **[End-to-End Testing (Playwright)](./resources/playwright.md)**: Browsers, locators, and user simulation.
- **[Load Testing (k6)](./resources/k6.md)**: Virtual users, thresholds, and latency analysis.

## 3. When to use what?
- **CAP Service Logic?** -> Read `cap-unit-testing.md` first.
- **React Component?** -> Read `frontend-unit-testing.md` first.
- **Feature Done?** -> Write E2E Test.
- **Release Ready?** -> Run Load Test.
- **Bug Fix?** -> Write Unit Test for regression.

## 4. Critical Learnings (2026-01)

### Backend (CAP/Jest)
- **Windows Paths:** Always use `path.replace(/\\\\/g, '/')` for CDS compatibility.
- **No Glob Patterns:** Use explicit file arrays for `cds.load()`.
- **Static Imports:** Avoid `await import()` in Jest tests.
- **Model Access:** `cds.model.definitions` may be undefined; use file inspection instead.

### Frontend (Vitest/React)
- **Separate Projects:** Use `vitest.config.ts` projects array to separate unit tests from Storybook tests.
- **Mock Services First:** Always mock API services (`vi.mock()`) before importing components.
- **QueryClient Wrapper:** Wrap components using TanStack Query in `QueryClientProvider` with `retry: false`.
- **Avoid Role Queries:** Custom UI components may not expose ARIA roles; use `getByText()` for reliability.
- **Test Module Exports:** For complex components, start with testing module exports before DOM interactions.
- **Act Warnings:** React state updates may trigger act() warnings; these are often harmless in tests.


