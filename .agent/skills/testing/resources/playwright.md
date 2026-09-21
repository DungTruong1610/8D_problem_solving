---
skill: End-to-End Testing (Playwright)
description: Automating browser-based user flows using Playwright.
---

# 🎭 End-to-End Testing (Playwright)

**Context:** Use this for validating the full application stack (UI -> API -> DB).

## 1. The Philosophy
- **User-Centric:** Test what the user *sees*, not implementation details.
- **Resilient:** Use semantic locators (`getByRole`, `getByText`) instead of brittle CSS selectors.

## 2. Test Structure
Tests reside in `tests/e2e/`.
```typescript
test('User can create an Invoice', async ({ page }) => {
  // 1. Arrange
  await page.goto('/invoices');
  
  // 2. Act
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByLabel('Amount').fill('100.00');
  await page.getByRole('button', { name: 'Save' }).click();
  
  // 3. Assert
  await expect(page.getByText('Invoice saved')).toBeVisible();
});
```

## 3. Best Practices
- **Authentication:** Use `global-setup.ts` to log in once and reuse state/cookies. Do not log in via UI for every single test.
- **Isolation:** Each test should be independent. Clean up data after the test (or use a fresh DB reset).
- **Screenshots:** Enable screenshots on failure for debugging.

## 4. Integration
- Run `npx playwright test` locally.
- In CI, running E2E tests is the final gate before production deployment.
