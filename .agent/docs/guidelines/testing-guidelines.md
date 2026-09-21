# Testing & Quality Assurance Guidelines

**Version:** 2.0 (AI-Optimized)
**Status:** Approved
**Target Audience:** All Developers, AI Agents

---

## 1. Code Coverage Standards

| Layer | Minimum Coverage | Target |
|-------|------------------|--------|
| **Business Logic** (Handlers, Processors) | 80% | 90% |
| **Utilities** | 90% | 95% |
| **React Components** | 60% | 75% |
| **API Routes** | 70% | 85% |

---

## 2. Test Organization

```
project/
├── srv/
│   ├── handlers/
│   │   ├── __tests__/      # Integration tests
│   │   └── DocumentHandler.ts
│   └── lib/
│       └── processors/
│           ├── __tests__/  # Unit tests
│           └── ExtractionProcessor.ts
├── app/frontend/src/
│   ├── __tests__/          # Component tests
│   └── Dashboard.jsx
└── e2e/                    # Playwright E2E tests
```

---

## 3. Backend Testing (Node.js + TypeScript)

### 3.1. Unit Tests (Processors, Utilities)
```typescript
// srv/lib/processors/__tests__/ExtractionProcessor.test.ts
describe('ExtractionProcessor', () => {
    it('should extract data correctly', async () => {
        const result = await processor.extract(mockDoc, mockSchema);
        expect(result.field.value).toBe('expected');
    });
});
```

### 3.2. Integration Tests (Handlers + Database)
```typescript
// srv/handlers/__tests__/DocumentHandler.test.ts
describe('DocumentHandler Integration', () => {
    beforeAll(async () => { srv = await cds.test('serve'); });
    it('should persist data', async () => {
        await INSERT.into(Entity).entries({...});
        const doc = await SELECT.one.from(Entity);
        expect(doc.status).toBe('New');
    });
});
```

---

## 4. Frontend Testing (React + Vite)

### 4.1. Component Tests (React Testing Library)
```jsx
// src/__tests__/Dashboard.test.jsx
it('renders data after fetch', async () => {
    api.get.mockResolvedValue({ data: { value: [...] } });
    render(<Dashboard />);
    await waitFor(() => {
        expect(screen.getByText('test-item')).toBeInTheDocument();
    });
});
```

### 4.2. Custom Hook Tests
```jsx
// src/hooks/__tests__/useData.test.js
it('fetches on mount', async () => {
    const { result } = renderHook(() => useData());
    await waitFor(() => expect(result.current.loaded).toBe(true));
});
```

---

## 5. End-to-End Testing (Playwright)

```typescript
// e2e/flow.spec.ts
test('complete flow', async ({ page }) => {
    await page.goto('/');
    await page.setInputFiles('input', 'file.pdf');
    await expect(page.locator('text=Success')).toBeVisible();
});
```

---

## 6. Testing Philosophy

We follow a **Pragmatic Testing Approach**: Write tests that provide value, not just coverage.
- **Unit**: Fast, isolation, exhaustive.
- **Integration**: Verifies layers work together.
- **E2E**: Verifies high-value user flows.

---

## 7. CI/CD Integration

All tests must pass before merging.
```yaml
# CI Step Examples
- run: npm test --prefix srv
- run: npm test --prefix app/frontend
- run: npx playwright test
```

---

## 8. Quality Checklist

- [ ] New features have unit tests.
- [ ] API endpoints have integration tests.
- [ ] Critical flows have E2E tests.
- [ ] Code coverage meets minimum standards.

---

## 9. SAP CAP Testing Best Practices

> [!IMPORTANT]
> For detailed CAP/CDS testing patterns, see `.agent/skills/testing/resources/cap-unit-testing.md`

### 9.1. CDS Model Loading

```typescript
// Set CDS root and load explicit files (NOT glob patterns)
cds.root = PROJECT_ROOT;
await cds.load([
    PROJECT_ROOT + '/db/schema.cds',
    PROJECT_ROOT + '/srv/my-service.cds'
]);
await cds.deploy('*').to('sqlite::memory:');
```

### 9.2. Windows Path Compatibility

```typescript
// Always convert backslashes for cross-platform compatibility
const PROJECT_ROOT = path.resolve(__dirname, '../..').replace(/\\/g, '/');
```

### 9.3. Common Pitfalls

| Issue | Solution |
|-------|----------|
| Glob patterns fail on Windows | Use explicit file arrays |
| `cds.model.definitions` is undefined | Use file-based annotation verification |
| Dynamic imports fail in Jest | Use static imports |
| `SELECT.one` returns undefined | Use `toBeFalsy()` instead of `toBeNull()` |

### 9.4. Jest Configuration for CAP

```javascript
// jest.config.js
transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }]
}
```

